import TrackingStartPage from '../shared/TrackingStartPage'
import { ga4AuditState, resetGa4AuditState } from '../ga4AuditState'

const icon = (
  <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
    <rect width="32" height="32" rx="6" fill="#E37400" opacity="0.15"/>
    <path d="M8 24V16" stroke="#E37400" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 24V8" stroke="#E37400" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 24V13" stroke="#E37400" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="8" cy="13" r="2" fill="#E37400" opacity="0.5"/>
    <circle cx="16" cy="5" r="2" fill="#E37400" opacity="0.5"/>
    <circle cx="24" cy="10" r="2" fill="#E37400" opacity="0.5"/>
  </svg>
)

export default function GA4AuditStart() {
  return (
    <TrackingStartPage
      auditState={ga4AuditState}
      resetState={resetGa4AuditState}
      auditTitle="GA4 Audit"
      accentColor="#E37400"
      icon={icon}
      checklistPath="/tracking/ga4/checklist"
      guardBack="/tracking"
    />
  )
}
