import TrackingChecklistPage from '../shared/TrackingChecklistPage'
import { googleAdsTrackingState } from '../googleAdsTrackingState'
import { generateTrackingPdf } from '../shared/generateTrackingPdf'

const QUESTIONS = [
  // Slide 1
  {
    slide: 1,
    slideTitle: 'Conversion Actions',
    question: 'Are all conversion actions firing correctly?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe what you verified — which conversions were tested and confirmed working.',
    issuePrompt: 'Describe which conversion actions are not firing and what steps you took to investigate.',
    screenshotLabel: 'Screenshot of conversion actions status *',
  },
  // Slide 2
  {
    slide: 2,
    slideTitle: 'GTM Preview Mode',
    question: 'Are all Google Ads tags firing on correct triggers?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe which tags were tested in GTM preview mode and confirmed firing correctly.',
    issuePrompt: 'Describe which tags are not firing correctly and on which triggers the issue occurs.',
    screenshotLabel: 'Screenshot of GTM preview mode showing tag firing *',
  },
  // Slide 3 — three questions
  {
    slide: 3,
    slideTitle: 'Website Call & Form Tracking',
    question: 'Is website call tracking working correctly?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe how you verified call tracking is working (e.g. test call made, conversion confirmed).',
    issuePrompt: 'Describe the call tracking issue and steps taken to investigate or resolve.',
    screenshotLabel: 'Screenshot showing call tracking confirmation *',
  },
  {
    slide: 3,
    slideTitle: 'Website Call & Form Tracking',
    question: 'Are form submissions being tracked and firing as conversions?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe which forms were tested and how you confirmed the conversion fired.',
    issuePrompt: 'Describe which forms are not tracking and what you found during investigation.',
    screenshotLabel: 'Screenshot of form submission conversion firing *',
  },
  {
    slide: 3,
    slideTitle: 'Website Call & Form Tracking',
    question: 'Are Google Ads call assets set up and tracking calls?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe how you confirmed call assets are active and tracking is working.',
    issuePrompt: 'Describe the issue with call assets and steps taken.',
    screenshotLabel: 'Screenshot of Google Ads call asset tracking *',
  },
]

export default function GoogleAdsTrackingChecklist() {
  function genPdf() {
    generateTrackingPdf({
      auditState: googleAdsTrackingState,
      questions: QUESTIONS,
      auditType: 'googleAds',
      auditTitle: 'Google Ads Tracking Audit',
      fileName: `${googleAdsTrackingState.client} - Google Ads Tracking Audit - ${googleAdsTrackingState.date}.pdf`,
    })
  }

  return (
    <TrackingChecklistPage
      auditState={googleAdsTrackingState}
      questions={QUESTIONS}
      auditType="googleAds"
      totalSlides={3}
      completePath="/tracking/google-ads/complete"
      onGenPdf={genPdf}
      guardPath="/tracking/google-ads"
    />
  )
}
