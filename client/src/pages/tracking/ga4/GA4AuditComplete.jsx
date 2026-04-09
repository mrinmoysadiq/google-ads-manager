import TrackingCompletePage from '../shared/TrackingCompletePage'
import { ga4AuditState, resetGa4AuditState } from '../ga4AuditState'

const QUESTIONS = [
  { slide: 1, question: 'Is GA4 real-time data showing correctly?', yesIsGood: true },
  { slide: 2, question: 'Are form submission events firing correctly?', yesIsGood: true },
  { slide: 2, question: 'Are call tracking events firing correctly?', yesIsGood: true },
  { slide: 3, question: 'Are all key events marked as conversions in GA4?', yesIsGood: true },
  { slide: 3, question: 'Are conversion events showing data in the last 24 hours?', yesIsGood: true },
]

export default function GA4AuditComplete() {
  return (
    <TrackingCompletePage
      auditState={ga4AuditState}
      questions={QUESTIONS}
      auditType="ga4"
      auditTitle="GA4 Audit"
      startPath="/tracking/ga4"
      resetState={resetGa4AuditState}
    />
  )
}
