import TrackingStartPage from '../shared/TrackingStartPage'
import { metaAuditState, resetMetaAuditState } from '../metaAuditState'

const icon = (
  <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
    <circle cx="16" cy="16" r="13" fill="#1877f2" opacity="0.2" stroke="#1877f2" strokeWidth="1.5"/>
    <path d="M18 28V19h3l1-4h-4v-2c0-1.1.5-2 2-2H22V8s-1.4-.2-2.8-.2c-2.8 0-4.7 1.7-4.7 4.8V15H12v4h3v9" fill="#1877f2"/>
  </svg>
)

export default function MetaAuditStart() {
  return (
    <TrackingStartPage
      auditState={metaAuditState}
      resetState={resetMetaAuditState}
      auditTitle="Meta Pixel & CAPI Audit"
      accentColor="#1877f2"
      icon={icon}
      checklistPath="/tracking/meta/checklist"
      guardBack="/tracking"
    />
  )
}
