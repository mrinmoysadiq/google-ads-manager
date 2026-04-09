import TrackingCompletePage from '../shared/TrackingCompletePage'
import { metaAuditState, resetMetaAuditState } from '../metaAuditState'

const QUESTIONS = [
  { slide: 1, question: 'Is the Pixel firing on all key pages?', yesIsGood: true },
  { slide: 1, question: 'Are there any Pixel health warnings in Events Manager?', yesIsGood: false },
  { slide: 2, question: 'Are test events showing correctly in Facebook Events Manager?', yesIsGood: true },
  { slide: 3, question: 'Are CAPI events firing and matching browser events?', yesIsGood: true },
  { slide: 3, question: "Is the Event Match Quality score acceptable?", yesIsGood: true },
]

export default function MetaAuditComplete() {
  return (
    <TrackingCompletePage
      auditState={metaAuditState}
      questions={QUESTIONS}
      auditType="meta"
      auditTitle="Meta Pixel & CAPI Audit"
      startPath="/tracking/meta"
      resetState={resetMetaAuditState}
    />
  )
}
