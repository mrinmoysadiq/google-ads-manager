import TrackingChecklistPage from '../shared/TrackingChecklistPage'
import { metaAuditState } from '../metaAuditState'
import { generateTrackingPdf } from '../shared/generateTrackingPdf'

const QUESTIONS = [
  // Slide 1 — Pixel Health (2 questions)
  {
    slide: 1,
    slideTitle: 'Pixel Health',
    question: 'Is the Pixel firing on all key pages?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe which pages were tested and confirm the Pixel fired correctly on each.',
    issuePrompt: 'Describe which pages are not firing the Pixel and steps taken to investigate.',
    screenshotLabel: 'Screenshot showing Pixel firing on key pages *',
  },
  {
    slide: 1,
    slideTitle: 'Pixel Health',
    question: 'Are there any Pixel health warnings in Events Manager?',
    yesIsGood: false, // REVERSED: Yes = bad (warnings found), No = good
    hasNA: false,
    verifyPrompt: 'Confirm there are no active Pixel health warnings in Events Manager.',
    issuePrompt: 'Describe the Pixel health warnings found and what steps were taken to resolve them.',
    screenshotLabel: 'Screenshot of Events Manager Pixel health status *',
  },
  // Slide 2 — Events Manager (1 question)
  {
    slide: 2,
    slideTitle: 'Events Manager',
    question: 'Are test events showing correctly in Facebook Events Manager?',
    yesIsGood: true,
    hasNA: false,
    verifyPrompt: 'Describe which test events were sent and confirmed showing in Events Manager.',
    issuePrompt: 'Describe which test events are not showing and steps taken to investigate.',
    screenshotLabel: 'Screenshot of test events in Facebook Events Manager *',
  },
  // Slide 3 — CAPI (2 questions)
  {
    slide: 3,
    slideTitle: 'CAPI',
    question: 'Are CAPI events firing and matching browser events?',
    yesIsGood: true,
    hasNA: true,
    naLabel: 'N/A — CAPI not set up for this client',
    verifyPrompt: 'Describe how you verified CAPI events are matching browser events.',
    issuePrompt: 'Describe the CAPI mismatch issue and steps taken.',
    screenshotLabel: 'Screenshot showing CAPI events matching browser events *',
  },
  {
    slide: 3,
    slideTitle: 'CAPI',
    question: "Is the Event Match Quality score acceptable? What's the score?",
    yesIsGood: true,
    hasNA: false,
    hasEMQScore: true,
    emqScoreLabel: 'Event Match Quality Score *',
    emqScorePlaceholder: 'Enter score (e.g. 7.2, 8.5)',
    verifyPrompt: 'Confirm the EMQ score is at an acceptable level and describe any optimisations made.',
    issuePrompt: 'Describe the low EMQ score issue and what steps were taken to improve it.',
    screenshotLabel: 'Screenshot of Event Match Quality score *',
  },
]

export default function MetaAuditChecklist() {
  function genPdf() {
    generateTrackingPdf({
      auditState: metaAuditState,
      questions: QUESTIONS,
      auditType: 'meta',
      auditTitle: 'Meta Pixel & CAPI Audit',
      fileName: `${metaAuditState.client} - Meta Pixel CAPI Audit - ${metaAuditState.date}.pdf`,
    })
  }

  return (
    <TrackingChecklistPage
      auditState={metaAuditState}
      questions={QUESTIONS}
      auditType="meta"
      totalSlides={3}
      completePath="/tracking/meta/complete"
      onGenPdf={genPdf}
      guardPath="/tracking/meta"
    />
  )
}
