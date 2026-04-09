import TrackingCompletePage from '../shared/TrackingCompletePage'
import { googleAdsTrackingState, resetGoogleAdsTrackingState } from '../googleAdsTrackingState'

const QUESTIONS = [
  { slide: 1, question: 'Are all conversion actions firing correctly?' },
  { slide: 2, question: 'Are all Google Ads tags firing on correct triggers?' },
  { slide: 3, question: 'Is website call tracking working correctly?' },
  { slide: 3, question: 'Are form submissions being tracked and firing as conversions?' },
  { slide: 3, question: 'Are Google Ads call assets set up and tracking calls?' },
]

export default function GoogleAdsTrackingComplete() {
  return (
    <TrackingCompletePage
      auditState={googleAdsTrackingState}
      questions={QUESTIONS}
      auditType="googleAds"
      auditTitle="Google Ads Tracking Audit"
      startPath="/tracking/google-ads"
      resetState={resetGoogleAdsTrackingState}
    />
  )
}
