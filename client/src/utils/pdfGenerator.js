import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generateSessionPDF(session, slideResponsesMap) {
  const doc = new jsPDF()
  const accent = [87, 94, 207] // #575ECF

  // Header
  doc.setFillColor(...accent)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Google Ads Daily Session Report', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Infinix Online — Daily Management System', 14, 20)

  // Session info box
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(9)
  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.text('Account:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(session.account_name || '', 45, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Team Member:', 100, y)
  doc.setFont('helvetica', 'normal')
  doc.text(session.team_member || '', 135, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.text('Date:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(session.date || '', 45, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Session ID:', 100, y)
  doc.setFont('helvetica', 'normal')
  doc.text(String(session.id || ''), 135, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.text('Status:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Completed', 45, y)

  y += 12

  // Helper to render a section
  const renderSection = (title, fields) => {
    if (y > 250) { doc.addPage(); y = 20 }

    // Section title bar
    doc.setFillColor(...accent)
    doc.rect(14, y, 182, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 18, y + 5.5)
    y += 13

    if (fields.length === 0) {
      doc.setTextColor(150, 150, 150)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('No data recorded for this section.', 18, y)
      y += 8
      return
    }

    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: fields.map(([k, v]) => [k, v || '—']),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: [50, 50, 50] },
      headStyles: { fillColor: [230, 231, 248], textColor: [50, 50, 50], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { cellWidth: 112 } },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // Slide 1 — Daily Performance Review
  const s1 = slideResponsesMap[1] || {}
  renderSection('1. Daily Performance Review', [
    ['Spend Yesterday', s1.spend_yesterday ? `$${s1.spend_yesterday}` : ''],
    ['Conversions Yesterday', s1.conversions_yesterday || ''],
    ['Conversion Rate Yesterday', s1.conversion_rate_yesterday ? `${s1.conversion_rate_yesterday}%` : ''],
    ['Cost Per Conversion Yesterday', s1.cpr_yesterday ? `$${s1.cpr_yesterday}` : ''],
    ['Conversions (7 days)', s1.conversions_7d || ''],
    ['Conversion Rate (7 days)', s1.conversion_rate_7d ? `${s1.conversion_rate_7d}%` : ''],
    ['Cost Per Conversion (7 days)', s1.cpr_7d ? `$${s1.cpr_7d}` : ''],
    ['Conversions (14 days)', s1.conversions_14d || ''],
    ['Conversion Rate (14 days)', s1.conversion_rate_14d ? `${s1.conversion_rate_14d}%` : ''],
    ['Cost Per Conversion (14 days)', s1.cpr_14d ? `$${s1.cpr_14d}` : ''],
    ['Observations', s1.observations || ''],
  ].filter(([, v]) => v))

  // Slide 2 — Search Term Analysis
  const s2 = slideResponsesMap[2] || {}
  renderSection('2. Search Term Analysis', [
    ['Negative Keywords Added', s2.keywords_paused || ''],
    ['Negative Keyword Reason', s2.pause_reason || ''],
    ['New Keywords Added', s2.keywords_added || ''],
    ['Match Type', s2.add_match_type || ''],
    ['Add Reason', s2.add_reason || ''],
  ].filter(([, v]) => v))

  // Slide 3 — Asset & Landing Page Audit
  const s3 = slideResponsesMap[3] || {}
  renderSection('3. Ad Assets & Landing Page Audit', [
    ['Asset Status Snapshot', s3.asset_status_snapshot || ''],
    ['Disapproved Asset Issue', s3.disapproved_asset_issue || ''],
    ['Disapproved Asset Action', s3.disapproved_asset_action || ''],
    ['Account Sitelink Issues', s3.account_sitelink_issues || ''],
    ['Account Sitelink Action', s3.account_sitelink_action || ''],
    ['Campaign Sitelink Issues', s3.campaign_sitelink_issues || ''],
    ['Campaign Sitelink Action', s3.campaign_sitelink_action || ''],
    ['Landing Page Issues', s3.lp_issue_description || ''],
    ['Escalated To', s3.lp_escalated_to || ''],
    ['LP Issue Status', s3.lp_issue_status || ''],
  ].filter(([, v]) => v))

  // Slide 4 — Audience & Targeting
  const s4 = slideResponsesMap[4] || {}
  renderSection('4. Audience & Targeting Review', [
    ['Reviewed Audiences', s4.reviewed_audiences || ''],
    ['Underperforming Audiences', s4.underperforming_detail || ''],
    ['Bid Adjustments Made', s4.bid_adjustments || ''],
    ['Bid Audience Segments', s4.bid_audience_segments || ''],
    ['Bid Percentages', s4.bid_percentages || ''],
    ['Targeting Changes', s4.targeting_changes_detail || ''],
    ['Audiences Adjusted', s4.audiences_adjusted || ''],
    ['Bid Changes', s4.bid_changes || ''],
    ['Other Targeting', s4.other_targeting || ''],
    ['Targeting Reason', s4.targeting_reason || ''],
    ['Changes Made', s4.changes_made_note || ''],
  ].filter(([, v]) => v))

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generated by Infinix Online — Google Ads Daily Manager | Page ${i} of ${pageCount}`, 14, 290)
    doc.text(new Date().toLocaleString(), 160, 290)
  }

  const filename = `session-${(session.account_name || 'account').replace(/\s+/g, '-').toLowerCase()}-${session.date || 'date'}.pdf`
  doc.save(filename)
}
