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
  } catch {
    return dateStr
  }
}

export function generateSessionPDF(session, slideResponsesMap) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const accent = [87, 94, 207]
  const pageW = 210
  const margin = 14

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

  // ── SESSION META ──
  let y = 38
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)

  const meta = [
    ['Account', session.account_name || '—'],
    ['Team Member', session.team_member || '—'],
    ['Date', ordinalDate(session.date)],
    ['Status', 'Completed'],
  ]
  meta.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 32, y)
    y += 6
  })
  y += 4

  // ── SECTION RENDERER ──
  const renderSection = (title, rows) => {
    if (y > 255) { doc.addPage(); y = 18 }

    // Section header bar
    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.rect(margin, y, pageW - margin * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, y + 5.5)
    y += 11

    const filteredRows = rows.filter(([, v]) => v && String(v).trim() !== '')

    if (filteredRows.length === 0) {
      doc.setTextColor(160, 160, 160)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('No data recorded for this section.', margin + 3, y)
      y += 8
      return
    }

    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: filteredRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [40, 40, 40],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [220, 222, 245],
        textColor: [40, 40, 40],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 248, 253] },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: pageW - margin * 2 - 60 },
      },
      didDrawPage: () => { y = doc.lastAutoTable.finalY },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── SLIDE 1 — Daily Performance ──
  const s1 = slideResponsesMap[1] || {}
  renderSection('1. Daily Performance Review', [
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

  // ── SLIDE 2 — Search Term Analysis ──
  const s2 = slideResponsesMap[2] || {}
  renderSection('2. Search Term Analysis', [
    ['Negative Keywords Added', s2.keywords_paused || ''],
    ['Negative Keyword Reason', s2.pause_reason || ''],
    ['New Keywords Added', s2.keywords_added || ''],
    ['Match Type', s2.add_match_type || ''],
    ['Reason for Adding', s2.add_reason || ''],
  ])

  // ── SLIDE 3 — Assets & Landing Page ──
  const s3 = slideResponsesMap[3] || {}

  // Parse asset snapshot for a readable summary
  let assetSummary = ''
  if (s3.asset_status_snapshot) {
    try {
      const assets = JSON.parse(s3.asset_status_snapshot)
      const disapproved = assets.filter(a => a.approvalStatus === 'Disapproved').map(a => a.type)
      const pending = assets.filter(a => a.approvalStatus === 'Pending').map(a => a.type)
      const parts = []
      if (disapproved.length) parts.push(`Disapproved: ${disapproved.join(', ')}`)
      if (pending.length) parts.push(`Pending: ${pending.join(', ')}`)
      assetSummary = parts.length ? parts.join(' | ') : 'All assets reviewed'
    } catch { assetSummary = s3.asset_status_snapshot }
  }

  renderSection('3. Ad Assets & Landing Page Audit', [
    ['Asset Status Summary', assetSummary],
    ['Disapproved Asset Type', s3.disapproved_asset_type || ''],
    ['Disapproved Asset Issue', s3.disapproved_asset_issue || ''],
    ['Resolution Taken', s3.disapproved_asset_action || ''],
    ['Account Sitelink Issues', s3.account_sitelink_issues || ''],
    ['Account Sitelink Action', s3.account_sitelink_action || ''],
    ['Campaign Sitelink Issues', s3.campaign_sitelink_issues || ''],
    ['Campaign Sitelink Action', s3.campaign_sitelink_action || ''],
    ['Landing Page Issues', s3.lp_issue_description || ''],
    ['Escalated To', s3.lp_escalated_to || ''],
    ['LP Issue Status', s3.lp_issue_status || ''],
  ])

  // ── FOOTER on every page ──
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Infinix Online — Google Ads Daily Manager  |  Page ${i} of ${totalPages}`,
      margin, 290
    )
    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      pageW - margin, 290,
      { align: 'right' }
    )
  }

  // ── FILENAME: "Client Alpha - 17th March.pdf" ──
  const accountSlug = (session.account_name || 'Account').replace(/[^a-zA-Z0-9 ]/g, '').trim()
  const dateLabel = ordinalDate(session.date)
  const filename = `${accountSlug} - ${dateLabel}.pdf`
  doc.save(filename)
}
