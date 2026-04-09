import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = {
  accent: [87, 94, 207],
  green: [34, 197, 94],
  amber: [245, 158, 11],
  red: [239, 68, 68],
  dark: [27, 27, 27],
  surface: [36, 36, 36],
  text: [197, 193, 185],
  muted: [138, 134, 128],
  white: [255, 255, 255],
}

function isGoodAnswer(idx, answer, auditType) {
  if (auditType === 'meta' && idx === 1) return answer === 'no'
  return answer === 'yes'
}

function addPageFooter(doc, pageNum, totalPages, date, auditTitle) {
  const pageH = doc.internal.pageSize.height
  const pageW = doc.internal.pageSize.width
  doc.setFillColor(...COLORS.surface)
  doc.rect(0, pageH - 18, pageW, 18, 'F')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(`Infinix Online Ltd. · ${auditTitle} · Confidential · ${date}`, 14, pageH - 6)
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 14, pageH - 6, { align: 'right' })
}

export function generateTrackingPdf({ auditState, questions, auditType, auditTitle, fileName }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width
  const margin = 14

  // ── Cover / Header ─────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.accent)
  doc.rect(0, 0, pageW, 42, 'F')

  doc.setFontSize(10)
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.text('INFINIX ONLINE LTD.', margin, 16)

  doc.setFontSize(18)
  doc.text(auditTitle, margin, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.text)

  // Meta block
  let y = 54
  const metaItems = [
    ['Specialist', auditState.specialist],
    ['Client', auditState.client],
    ['Website', auditState.website || '—'],
    ['Date', auditState.date],
  ]
  doc.setFillColor(...COLORS.surface)
  doc.roundedRect(margin, y - 6, pageW - margin * 2, metaItems.length * 8 + 4, 3, 3, 'F')
  metaItems.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.muted)
    doc.text(label + ':', margin + 4, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text(String(value), margin + 30, y)
    y += 8
  })
  y += 8

  // ── Slides ────────────────────────────────────────────────────────────────
  const slideNumbers = [...new Set(questions.map(q => q.slide))]
  let currentPage = 1

  for (const slideNum of slideNumbers) {
    const slideQs = questions.filter(q => q.slide === slideNum)
    const slideTitle = slideQs[0]?.slideTitle || `Slide ${slideNum}`
    const slideIndices = questions.reduce((acc, q, i) => { if (q.slide === slideNum) acc.push(i); return acc }, [])

    // Slide title
    if (y > 240) { doc.addPage(); y = 20; currentPage++ }
    doc.setFillColor(...COLORS.accent)
    doc.rect(margin, y, pageW - margin * 2, 0.5, 'F')
    y += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.accent)
    doc.text(`Slide ${slideNum}: ${slideTitle}`, margin, y)
    y += 10

    for (let si = 0; si < slideQs.length; si++) {
      const q = slideQs[si]
      const idx = slideIndices[si]
      const item = auditState.items[idx]

      if (y > 230) { doc.addPage(); y = 20; currentPage++ }

      // Question
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.text)
      const qLines = doc.splitTextToSize(`Q${idx + 1}. ${q.question}`, pageW - margin * 2 - 10)
      doc.text(qLines, margin + 3, y)
      y += qLines.length * 5 + 3

      // Answer badge
      if (!item.answer) {
        doc.setTextColor(...COLORS.muted)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.text('Not answered', margin + 3, y)
        y += 8
        continue
      }

      const ansLabel = item.answer === 'na' ? 'N/A' : item.answer.toUpperCase()
      const good = item.answer !== 'na' ? isGoodAnswer(idx, item.answer, auditType) : null
      const ansColor = item.answer === 'na' ? COLORS.muted : (good ? COLORS.green : COLORS.red)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...ansColor)
      doc.text(`Answer: ${ansLabel}`, margin + 3, y)
      y += 6

      if (item.answer === 'na') {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.muted)
        if (q.naLabel) doc.text(q.naLabel, margin + 3, y)
        else doc.text('Not applicable for this client', margin + 3, y)
        y += 10
        continue
      }

      // EMQ score (Meta Q5)
      if (auditType === 'meta' && idx === 4 && item.emqScore) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.amber)
        doc.text(`EMQ Score: ${item.emqScore}`, margin + 3, y)
        y += 6
      }

      if (good) {
        // Verified
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.green)
        doc.text('✓ VERIFIED', margin + 3, y)
        y += 5
        if (item.verifyText) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...COLORS.text)
          const lines = doc.splitTextToSize(item.verifyText, pageW - margin * 2 - 14)
          if (y + lines.length * 4.5 > 260) { doc.addPage(); y = 20; currentPage++ }
          doc.text(lines, margin + 6, y)
          y += lines.length * 4.5 + 4
        }
        if (item.verifyImage) {
          try {
            if (y + 45 > 260) { doc.addPage(); y = 20; currentPage++ }
            doc.addImage(item.verifyImage, 'JPEG', margin + 3, y, 80, 40, undefined, 'FAST')
            y += 46
          } catch {}
        }
      } else {
        // Issue
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.amber)
        doc.text('⚠ ISSUE', margin + 3, y)
        y += 5
        if (item.issueText) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...COLORS.text)
          const lines = doc.splitTextToSize(item.issueText, pageW - margin * 2 - 14)
          if (y + lines.length * 4.5 > 260) { doc.addPage(); y = 20; currentPage++ }
          doc.text(lines, margin + 6, y)
          y += lines.length * 4.5 + 4
        }
        if (item.issueImage) {
          try {
            if (y + 45 > 260) { doc.addPage(); y = 20; currentPage++ }
            doc.addImage(item.issueImage, 'JPEG', margin + 3, y, 80, 40, undefined, 'FAST')
            y += 46
          } catch {}
        }
        if (item.resolution) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(...COLORS.amber)
          doc.text(`Resolution: ${item.resolution}`, margin + 3, y)
          y += 6
        }
      }
      y += 4

      // Divider
      doc.setDrawColor(...COLORS.surface)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageW - margin, y)
      y += 6
    }
    y += 4
  }

  // Add footers to all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    addPageFooter(doc, p, totalPages, auditState.date, auditTitle)
  }

  doc.save(fileName)
}
