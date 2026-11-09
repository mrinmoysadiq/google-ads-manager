// Company name is optional, so a lead is named by the first thing we have
export function leadTitle(lead) {
  if (!lead) return ''
  return (lead.company_name || '').trim() || (lead.contact_name || '').trim() || lead.email || lead.phone || `Lead #${lead.id}`
}

// The line under the title: whoever isn't already the title
export function leadSubtitle(lead) {
  if (!lead) return ''
  const hasCompany = !!(lead.company_name || '').trim()
  return [hasCompany ? lead.contact_name : null, lead.job_title].filter(Boolean).join(' · ')
}
