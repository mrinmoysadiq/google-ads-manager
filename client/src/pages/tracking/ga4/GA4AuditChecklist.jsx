import TrackingChecklistPage from '../shared/TrackingChecklistPage'
import { ga4AuditState } from '../ga4AuditState'
import { generateTrackingPdf } from '../shared/generateTrackingPdf'

const QUESTIONS = [
  // Slide 1
  {
    slide: 1,
    slideTitle: 'Real-time & Data Stream',
    question: 'Is GA4 real-time data showing correctly?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe what you saw in GA4 real-time view and confirm data is flowing correctly.',
    issuePrompt: 'Describe the real-time data issue and steps taken to investigate.',
    screenshotLabel: 'Screenshot of GA4 real-time data *',
  },
  // Slide 2 — 2 questions
  {
    slide: 2,
    slideTitle: 'Key Events',
    question: 'Are form submission events firing correctly?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe which form submission events were tested and confirmed firing in GA4.',
    issuePrompt: 'Describe which form events are not firing and steps taken to investigate.',
    screenshotLabel: 'Screenshot of form submission events in GA4 *',
  },
  {
    slide: 2,
    slideTitle: 'Key Events',
    question: 'Are call tracking events firing correctly?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe how call tracking events were confirmed firing in GA4.',
    issuePrompt: 'Describe the call tracking event issue and steps taken.',
    screenshotLabel: 'Screenshot of call tracking events in GA4 *',
  },
  // Slide 3 — 2 questions
  {
    slide: 3,
    slideTitle: 'Conversion Configuration',
    question: 'Are all key events marked as conversions in GA4?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'List the key events confirmed as marked conversions in GA4.',
    issuePrompt: 'Describe which events are not marked as conversions and steps taken.',
    screenshotLabel: 'Screenshot of GA4 conversion events configuration *',
  },
  {
    slide: 3,
    slideTitle: 'Conversion Configuration',
    question: 'Are conversion events showing data in the last 24 hours?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Confirm which conversion events have data and the approximate count in last 24 hours.',
    issuePrompt: 'Describe which conversion events have no recent data and steps taken to investigate.',
    screenshotLabel: 'Screenshot of conversion event data from last 24 hours *',
  },
]

export default function GA4AuditChecklist() {
  function genPdf() {
    generateTrackingPdf({
      auditState: ga4AuditState,
      questions: QUESTIONS,
      auditType: 'ga4',
      auditTitle: 'GA4 Audit',
      fileName: `${ga4AuditState.client} - GA4 Audit - ${ga4AuditState.date}.pdf`,
    })
  }

  return (
    <TrackingChecklistPage
      auditState={ga4AuditState}
      questions={QUESTIONS}
      auditType="ga4"
      totalSlides={3}
      completePath="/tracking/ga4/complete"
      onGenPdf={genPdf}
      guardPath="/tracking/ga4"
    />
  )
}
