import TrackingStartPage from '../shared/TrackingStartPage'
import { googleAdsTrackingState, resetGoogleAdsTrackingState } from '../googleAdsTrackingState'

const icon = (
  <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
    <path d="M16 3L29 27H3L16 3Z" fill="#4285F4" opacity="0.2" stroke="#4285F4" strokeWidth="1.5"/>
    <circle cx="16" cy="20" r="4" fill="#4285F4"/>
    <path d="M16 3L5 27" stroke="#34A853" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 3L27 27" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export default function GoogleAdsTrackingStart() {
  return (
    <TrackingStartPage
      auditState={googleAdsTrackingState}
      resetState={resetGoogleAdsTrackingState}
      auditTitle="Google Ads Tracking Audit"
      accentColor="#4285F4"
      icon={icon}
      checklistPath="/tracking/google-ads/checklist"
      guardBack="/tracking"
    />
  )
}
