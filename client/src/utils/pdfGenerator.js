import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function ordinalDate(dateStr) {
  if (!dateStr) return ''
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const dayNum = d.getDate()
    const suffix =
      dayNum >= 11 && dayNum <= 13 ? 'th'
      : dayNum % 10 === 1 ? 'st'
      : dayNum % 10 === 2 ? 'nd'
      : dayNum % 10 === 3 ? 'rd'
      : 'th'
    const monthName = d.toLocaleString('en-US', { month: 'long' })
    return `${dayNum}${suffix} ${monthName}`
  } catch { return dateStr }
}

export function generateSessionPDF(session, slideResponsesMap) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const accent = [87, 94, 207]
  const pageW = 210
  const margin = 14
  let y = 0

  // ── HEADER BANNER ──
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('Google Ads Daily Session Report', margin, 13)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Infinix Online — Ads Manager', margin, 21)

  // ── SESSION META TABLE ──
  y = 36
  autoTable(doc, {
    startY: y,
    body: [
      ['Account', session.account_name || '—', 'Team Member', session.team_member || '—'],
      ['Date', ordinalDate(session.date), 'Status', 'Completed'],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [40, 40, 40] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30, fillColor: [240, 241, 252] },
      1: { cellWidth: 66 },
      2: { fontStyle: 'bold', cellWidth: 30, fillColor: [240, 241, 252] },
      3: { cellWidth: 66 },
    },
    theme: 'plain',
    tableLineColor: [210, 212, 240],
    tableLineWidth: 0.2,
  })
  y = doc.lastAutoTable.finalY + 10

  // ── SECTION HEADER helper ──
  const sectionHeader = (title) => {
    if (y > 260) { doc.addPage(); y = 18 }
    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.rect(margin, y, pageW - margin * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, y + 5.5)
    y += 12
  }

  // ── KEY-VALUE TABLE helper ──
  const kvTable = (rows) => {
    const filtered = rows.filter(([, v]) => v && String(v).trim() !== '')
    if (filtered.length === 0) {
      doc.setTextColor(160, 160, 160)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('No data recorded.', margin + 3, y)
      y += 7
      return
    }
    autoTable(doc, {
      startY: y,
      body: filtered,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: [40, 40, 40], overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 248, 253] },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold', fillColor: [240, 241, 252] },
        1: { cellWidth: pageW - margin * 2 - 58 },
      },
      theme: 'plain',
      tableLineColor: [220, 222, 245],
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── SUB-HEADER helper ──
  const subHeader = (title) => {
    if (y > 265) { doc.addPage(); y = 18 }
    doc.setFillColor(220, 222, 245)
    doc.rect(margin, y, pageW - margin * 2, 6.5, 'F')
    doc.setTextColor(60, 65, 150)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, y + 4.5)
    y += 9
  }

  // ════════════════════════════════════════
  // SLIDE 1 — Daily Performance Review
  // ════════════════════════════════════════
  const s1 = slideResponsesMap[1] || {}
  sectionHeader('1. Daily Performance Review')
  kvTable([
    ['Spend Yesterday', s1.spend_yesterday ? `$${s1.spend_yesterday}` : ''],
    ['Conversions Yesterday', s1.conversions_yesterday || ''],
    ['Conversion Rate Yesterday', s1.conversion_rate_yesterday ? `${s1.conversion_rate_yesterday}%` : ''],
    ['Cost Per Conversion Yesterday', s1.cpr_yesterday ? `$${s1.cpr_yesterday}` : ''],
    ['Conversions (7 Days)', s1.conversions_7d || ''],
    ['Conversion Rate (7 Days)', s1.conversion_rate_7d ? `${s1.conversion_rate_7d}%` : ''],
    ['Cost Per Conversion (7 Days)', s1.cpr_7d ? `$${s1.cpr_7d}` : ''],
    ['Conversions (14 Days)', s1.conversions_14d || ''],
    ['Conversion Rate (14 Days)', s1.conversion_rate_14d ? `${s1.conversion_rate_14d}%` : ''],
    ['Cost Per Conversion (14 Days)', s1.cpr_14d ? `$${s1.cpr_14d}` : ''],
    ['Observations', s1.observations || ''],
  ])

  // ════════════════════════════════════════
  // SLIDE 2 — Search Term Analysis
  // ════════════════════════════════════════
  const s2 = slideResponsesMap[2] || {}
  sectionHeader('2. Search Term Analysis')

  const hasNegative = s2.keywords_paused || s2.pause_reason
  const hasNew = s2.keywords_added || s2.add_match_type || s2.add_reason

  if (!hasNegative && !hasNew) {
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No keyword changes recorded.', margin + 3, y)
    y += 7
  } else {
    if (hasNegative) {
      subHeader('Negative Keywords Added from Search Terms')
      kvTable([
        ['Keywords Added as Negative', s2.keywords_paused || ''],
        ['Reason', s2.pause_reason || ''],
      ])
    }
    if (hasNew) {
      subHeader('New Keywords Added from Search Terms')
      kvTable([
        ['Keywords Added', s2.keywords_added || ''],
        ['Match Type', s2.add_match_type || ''],
        ['Reason', s2.add_reason || ''],
      ])
    }
  }

  // ════════════════════════════════════════
  // SLIDE 3 — Ad Assets & Landing Page Audit
  // ════════════════════════════════════════
  sectionHeader('3. Ad Assets & Landing Page Audit')

  const s3 = slideResponsesMap[3] || {}

  // SECTION A — Asset Status Table
  subHeader('Section A — Asset Status Review')
  if (s3.asset_status_snapshot) {
    try {
      const assets = JSON.parse(s3.asset_status_snapshot)
      const assetRows = assets.map(a => [
        a.type || '',
        a.present || '—',
        a.approvalStatus || '—',
        a.notes || '',
      ])
      autoTable(doc, {
        startY: y,
        head: [['Asset Type', 'Present?', 'Approval Status', 'Notes']],
        body: assetRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [40, 40, 40], overflow: 'linebreak' },
        headStyles: { fillColor: [220, 222, 245], textColor: [60, 65, 150], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 253] },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 38, halign: 'center' },
          3: { cellWidth: pageW - margin * 2 - 96 },
        },
        didParseCell: (data) => {
          if (data.column.index === 2 && data.section === 'body') {
            const val = data.cell.text[0]
            if (val === 'Disapproved') data.cell.styles.textColor = [200, 50, 50]
            if (val === 'Pending') data.cell.styles.textColor = [180, 120, 0]
            if (val === 'Approved') data.cell.styles.textColor = [50, 160, 80]
          }
        },
        tableLineColor: [220, 222, 245],
        tableLineWidth: 0.2,
      })
      y = doc.lastAutoTable.finalY + 6

      // Show disapproved details
      const disapprovedAssets = assets.filter(a => a.approvalStatus === 'Disapproved')
      if (disapprovedAssets.length > 0) {
        disapprovedAssets.forEach(a => {
          if (a.issueDesc || a.actionTaken) {
            kvTable([
              [`${a.type} — Issue`, a.issueDesc || ''],
              [`${a.type} — Action Taken`, a.actionTaken || ''],
            ])
          }
        })
      }
    } catch {
      doc.setTextColor(160, 160, 160)
      doc.setFontSize(8)
      doc.text('Asset data unavailable.', margin + 3, y)
      y += 7
    }
  } else {
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No asset data recorded.', margin + 3, y)
    y += 7
  }

  // SECTION B — Sitelink Review
  subHeader('Section B — Sitelink Review')
  const hasSitelinks = s3.account_sitelink_issues || s3.account_sitelink_action || s3.campaign_sitelink_issues || s3.campaign_sitelink_action
  if (hasSitelinks) {
    kvTable([
      ['Account Sitelink Issues', s3.account_sitelink_issues || ''],
      ['Account Sitelink Action', s3.account_sitelink_action || ''],
      ['Campaign Sitelink Issues', s3.campaign_sitelink_issues || ''],
      ['Campaign Sitelink Action', s3.campaign_sitelink_action || ''],
    ])
  } else {
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No sitelink issues recorded.', margin + 3, y)
    y += 7
  }

  // SECTION C — Landing Page Audit
  subHeader('Section C — Landing Page Audit')
  const hasLP = s3.lp_issue_description || s3.lp_escalated_to || s3.lp_issue_status
  if (hasLP) {
    kvTable([
      ['Issue Description', s3.lp_issue_description || ''],
      ['Escalated To', s3.lp_escalated_to || ''],
      ['Status', s3.lp_issue_status || ''],
    ])
  } else {
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No landing page issues recorded.', margin + 3, y)
    y += 7
  }

  // ── FOOTER on every page ──
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`Infinix Online — Google Ads Daily Manager  |  Page ${i} of ${totalPages}`, margin, 291)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 291, { align: 'right' })
  }

  // ── FILENAME: "Client Alpha - 17th March.pdf" ──
  const accountSlug = (session.account_name || 'Account').replace(/[^a-zA-Z0-9 ]/g, '').trim()
  const dateLabel = ordinalDate(session.date)
  doc.save(`${accountSlug} - ${dateLabel}.pdf`)
}
