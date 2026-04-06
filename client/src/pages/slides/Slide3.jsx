import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { saveSlideResponse, saveChangeLog, getSlideResponses } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'

const SLIDE_NUMBER = 3
const SECTION_NAME = 'Asset & Landing Page Audit'

const ASSET_TYPES = [
  'Headlines',
  'Descriptions',
  'Logos',
  'Images',
  'Business Name',
  'Sitelinks',
  'Callouts',
  'Calls',
  'Locations',
]

const APPROVAL_OPTIONS = ['Approved', 'Pending', 'Disapproved', 'Not Available']

const ACCOUNT_SITELINK_QUESTIONS = [
  'Do account-level sitelinks reflect the correct services/offerings?',
  'Are all sitelink destination URLs going to the correct landing pages?',
  'Are all sitelink destination URLs live (no 404s or broken pages)?',
]

const CAMPAIGN_SITELINK_QUESTIONS = [
  'Are campaign-level sitelinks specific to this campaign\'s objective?',
  'Are there any sitelinks that belong to a different campaign?',
  'Are all campaign sitelink URLs going to the correct landing pages?',
  'Are all campaign sitelink URLs live (no 404s or broken pages)?',
]

const LP_QUESTIONS = [
  'Does the landing page have a visible CTA button (e.g. \'Get a Quote\', \'Call Now\')?',
  'Is there a contact form on the landing page?',
  'Is a click-to-call number or call button visible?',
  'Is the page loading without broken elements (images, fonts, layout)?',
  'Is the mobile version of the landing page fully functional with no broken elements (images, buttons, layout)?',
]

const TOGGLE_OPTIONS_YN = ['Yes', 'No', 'Needs Attention']
const TOGGLE_OPTIONS_LP = ['Yes', 'No', 'Needs Attention', 'N/A']

function ToggleButtons({ value, onChange, options, hasError }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={value === opt
            ? { backgroundColor: '#575ECF', color: '#fff', border: '1px solid #575ECF' }
            : hasError
              ? { backgroundColor: '#2a2a2a', color: '#8a8680', border: '1px solid rgba(248,113,113,0.5)' }
              : { backgroundColor: '#2a2a2a', color: '#8a8680', border: '1px solid rgba(255,255,255,0.1)' }
          }
          onMouseEnter={e => { if (value !== opt) e.currentTarget.style.borderColor = '#575ECF' }}
          onMouseLeave={e => {
            if (value !== opt) {
              e.currentTarget.style.borderColor = hasError ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'
            }
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

const defaultAssetRows = () => ASSET_TYPES.map(type => ({
  type,
  approvalStatus: '',
  notes: '',
  issueDesc: '',
  actionTaken: '',
  whyNoAsset: '',
  assetCreationAction: '',
}))

const defaultSitelinkRows = (questions) => questions.map(q => ({
  question: q,
  response: '',
  issues: '',
  action: '',
}))

const defaultLPRows = () => LP_QUESTIONS.map(q => ({
  question: q,
  response: '',
  issueDesc: '',
  escalatedTo: '',
  status: '',
}))

export default function Slide3({ session, sessionId, onNext, onBack }) {
  const [assetRows, setAssetRows] = useState(defaultAssetRows())
  const [accountSitelinks, setAccountSitelinks] = useState(defaultSitelinkRows(ACCOUNT_SITELINK_QUESTIONS))
  const [campaignSitelinks, setCampaignSitelinks] = useState(defaultSitelinkRows(CAMPAIGN_SITELINK_QUESTIONS))
  const [landingPageChecks, setLandingPageChecks] = useState(defaultLPRows())
  const [errors, setErrors] = useState({})

  const [saveStatus, setSaveStatus] = useState('idle')
  const [assetSaveStatus, setAssetSaveStatus] = useState('idle')
  const [accountSitelinkStatus, setAccountSitelinkStatus] = useState('idle')
  const [campaignSitelinkStatus, setCampaignSitelinkStatus] = useState('idle')
  const [lpStatus, setLpStatus] = useState('idle')

  const debouncedAssetRows = useDebounce(assetRows, 1000)
  const debouncedAccountSitelinks = useDebounce(accountSitelinks, 1000)
  const debouncedCampaignSitelinks = useDebounce(campaignSitelinks, 1000)
  const debouncedLandingPage = useDebounce(landingPageChecks, 1000)

  const resetStatus = (setter) => setTimeout(() => setter('idle'), 2000)

  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none'
  const labelClass = 'block text-sm font-semibold text-[#8a8680] mb-1.5'

  // Load persistent data on mount
  useEffect(() => {
    if (!sessionId) return
    getSlideResponses(sessionId).then(grouped => {
      const slideData = grouped[SLIDE_NUMBER] || []
      const map = {}
      slideData.forEach(r => { map[r.field_key] = r.field_value || '' })

      // Restore asset rows — migrate old snapshots (remove present, add new fields, N/A→Not Available)
      if (map.asset_status_snapshot) {
        try {
          const parsed = JSON.parse(map.asset_status_snapshot)
          if (Array.isArray(parsed)) {
            const migrated = parsed.map(row => ({
              type: row.type,
              approvalStatus: row.approvalStatus === 'N/A' ? 'Not Available' : (row.approvalStatus || ''),
              notes: row.notes || '',
              issueDesc: row.issueDesc || '',
              actionTaken: row.actionTaken || '',
              whyNoAsset: row.whyNoAsset || '',
              assetCreationAction: row.assetCreationAction || '',
            }))
            setAssetRows(migrated)
          }
        } catch (e) { /* ignore */ }
      }

      // Restore account sitelinks
      if (map.account_sitelinks_snapshot) {
        try {
          const parsed = JSON.parse(map.account_sitelinks_snapshot)
          if (Array.isArray(parsed)) setAccountSitelinks(parsed)
        } catch (e) { /* ignore */ }
      }

      // Restore campaign sitelinks
      if (map.campaign_sitelinks_snapshot) {
        try {
          const parsed = JSON.parse(map.campaign_sitelinks_snapshot)
          if (Array.isArray(parsed)) setCampaignSitelinks(parsed)
        } catch (e) { /* ignore */ }
      }

      // Restore landing page checks — merge to handle new questions
      if (map.landing_page_snapshot) {
        try {
          const parsed = JSON.parse(map.landing_page_snapshot)
          if (Array.isArray(parsed)) {
            const defaults = defaultLPRows()
            const merged = defaults.map(defaultRow => {
              const saved = parsed.find(r => r.question === defaultRow.question)
              return saved || defaultRow
            })
            setLandingPageChecks(merged)
          }
        } catch (e) { /* ignore */ }
      }
    }).catch(console.error)
  }, [sessionId])

  // Auto-save asset rows
  useEffect(() => {
    const snapshot = JSON.stringify(debouncedAssetRows)
    setAssetSaveStatus('saving')
    saveSlideResponse({
      session_id: sessionId,
      slide_number: SLIDE_NUMBER,
      section_name: SECTION_NAME,
      field_key: 'asset_status_snapshot',
      field_value: snapshot,
    })
      .then(() => { setAssetSaveStatus('saved'); resetStatus(setAssetSaveStatus) })
      .catch(() => { setAssetSaveStatus('error'); resetStatus(setAssetSaveStatus) })

    const disapproved = debouncedAssetRows.filter(r => r.approvalStatus === 'Disapproved')
    if (disapproved.length > 0) {
      saveChangeLog({
        session_id: sessionId,
        team_member: session.team_member,
        account_name: session.account_name,
        date: session.date,
        section: SECTION_NAME,
        change_type: 'disapproved_asset_action',
        disapproved_asset_type: disapproved.map(r => r.type).join(', '),
        disapproved_asset_issue: JSON.stringify(disapproved.reduce((acc, r) => ({ ...acc, [r.type]: r.issueDesc }), {})),
        disapproved_asset_action: JSON.stringify(disapproved.reduce((acc, r) => ({ ...acc, [r.type]: r.actionTaken }), {})),
        asset_status_snapshot: snapshot,
      }).catch(console.error)
    }

    const notAvailable = debouncedAssetRows.filter(r => r.approvalStatus === 'Not Available')
    if (notAvailable.length > 0) {
      saveChangeLog({
        session_id: sessionId,
        team_member: session.team_member,
        account_name: session.account_name,
        date: session.date,
        section: SECTION_NAME,
        change_type: 'not_available_asset',
        changes_made_note: notAvailable.map(r =>
          `${r.type}: ${r.whyNoAsset || '—'} | Action: ${r.assetCreationAction || '—'}`
        ).join('\n'),
        asset_status_snapshot: snapshot,
      }).catch(console.error)
    }
  }, [debouncedAssetRows])

  // Auto-save account sitelinks
  useEffect(() => {
    const snapshot = JSON.stringify(debouncedAccountSitelinks)
    saveSlideResponse({
      session_id: sessionId,
      slide_number: SLIDE_NUMBER,
      section_name: SECTION_NAME,
      field_key: 'account_sitelinks_snapshot',
      field_value: snapshot,
    }).catch(console.error)

    const flagged = debouncedAccountSitelinks.filter(r => r.response === 'No' || r.response === 'Needs Attention')
    if (flagged.length > 0) {
      setAccountSitelinkStatus('saving')
      saveChangeLog({
        session_id: sessionId,
        team_member: session.team_member,
        account_name: session.account_name,
        date: session.date,
        section: SECTION_NAME,
        change_type: 'account_sitelink_issue',
        account_sitelink_issues: flagged.map(r => `${r.question}: ${r.issues}`).join('\n'),
        account_sitelink_action: flagged.map(r => r.action).filter(Boolean).join('\n'),
      })
        .then(() => { setAccountSitelinkStatus('saved'); resetStatus(setAccountSitelinkStatus) })
        .catch(() => { setAccountSitelinkStatus('error'); resetStatus(setAccountSitelinkStatus) })
    }
  }, [debouncedAccountSitelinks])

  // Auto-save campaign sitelinks
  useEffect(() => {
    const snapshot = JSON.stringify(debouncedCampaignSitelinks)
    saveSlideResponse({
      session_id: sessionId,
      slide_number: SLIDE_NUMBER,
      section_name: SECTION_NAME,
      field_key: 'campaign_sitelinks_snapshot',
      field_value: snapshot,
    }).catch(console.error)

    const flagged = debouncedCampaignSitelinks.filter(r => r.response === 'No' || r.response === 'Needs Attention')
    if (flagged.length > 0) {
      setCampaignSitelinkStatus('saving')
      saveChangeLog({
        session_id: sessionId,
        team_member: session.team_member,
        account_name: session.account_name,
        date: session.date,
        section: SECTION_NAME,
        change_type: 'campaign_sitelink_issue',
        campaign_sitelink_issues: flagged.map(r => `${r.question}: ${r.issues}`).join('\n'),
        campaign_sitelink_action: flagged.map(r => r.action).filter(Boolean).join('\n'),
      })
        .then(() => { setCampaignSitelinkStatus('saved'); resetStatus(setCampaignSitelinkStatus) })
        .catch(() => { setCampaignSitelinkStatus('error'); resetStatus(setCampaignSitelinkStatus) })
    }
  }, [debouncedCampaignSitelinks])

  // Auto-save landing page checks
  useEffect(() => {
    const snapshot = JSON.stringify(debouncedLandingPage)
    saveSlideResponse({
      session_id: sessionId,
      slide_number: SLIDE_NUMBER,
      section_name: SECTION_NAME,
      field_key: 'landing_page_snapshot',
      field_value: snapshot,
    }).catch(console.error)

    const flagged = debouncedLandingPage.filter(r => r.response === 'No' || r.response === 'Needs Attention')
    if (flagged.length > 0) {
      setLpStatus('saving')
      saveChangeLog({
        session_id: sessionId,
        team_member: session.team_member,
        account_name: session.account_name,
        date: session.date,
        section: SECTION_NAME,
        change_type: 'landing_page_issue',
        lp_issue_description: flagged.map(r => `${r.question}: ${r.issueDesc}`).join('\n'),
        lp_escalated_to: flagged.map(r => r.escalatedTo).filter(Boolean).join(', '),
        lp_issue_status: flagged.map(r => r.status).filter(Boolean).join(', '),
      })
        .then(() => { setLpStatus('saved'); resetStatus(setLpStatus) })
        .catch(() => { setLpStatus('error'); resetStatus(setLpStatus) })
    }
  }, [debouncedLandingPage])

  // Row update helpers
  const updateAssetRow = (idx, field, value) => {
    setAssetRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    const errKey = `asset_${idx}_${field}`
    if (errors[errKey]) setErrors(prev => { const e = { ...prev }; delete e[errKey]; return e })
  }

  const updateAccountSitelink = (idx, field, value) => {
    setAccountSitelinks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    const errKey = `b1_${idx}_${field}`
    if (errors[errKey]) setErrors(prev => { const e = { ...prev }; delete e[errKey]; return e })
  }

  const updateCampaignSitelink = (idx, field, value) => {
    setCampaignSitelinks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    const errKey = `b2_${idx}_${field}`
    if (errors[errKey]) setErrors(prev => { const e = { ...prev }; delete e[errKey]; return e })
  }

  const updateLandingPage = (idx, field, value) => {
    setLandingPageChecks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    const errKey = `lp_${idx}_${field}`
    if (errors[errKey]) setErrors(prev => { const e = { ...prev }; delete e[errKey]; return e })
  }

  // Validation + navigation
  const handleNext = () => {
    const errs = {}

    // Section A: all statuses required; if Disapproved → issueDesc+actionTaken; if Not Available → whyNoAsset+assetCreationAction
    assetRows.forEach((row, idx) => {
      if (!row.approvalStatus) errs[`asset_${idx}_approvalStatus`] = true
      if (row.approvalStatus === 'Disapproved') {
        if (!row.issueDesc.trim()) errs[`asset_${idx}_issueDesc`] = true
        if (!row.actionTaken.trim()) errs[`asset_${idx}_actionTaken`] = true
      }
      if (row.approvalStatus === 'Not Available') {
        if (!row.whyNoAsset.trim()) errs[`asset_${idx}_whyNoAsset`] = true
        if (!row.assetCreationAction.trim()) errs[`asset_${idx}_assetCreationAction`] = true
      }
    })

    // Section B1: all responses required; if flagged → issues+action required
    accountSitelinks.forEach((row, idx) => {
      if (!row.response) errs[`b1_${idx}_response`] = true
      if (row.response === 'No' || row.response === 'Needs Attention') {
        if (!row.issues.trim()) errs[`b1_${idx}_issues`] = true
        if (!row.action.trim()) errs[`b1_${idx}_action`] = true
      }
    })

    // Section B2: same
    campaignSitelinks.forEach((row, idx) => {
      if (!row.response) errs[`b2_${idx}_response`] = true
      if (row.response === 'No' || row.response === 'Needs Attention') {
        if (!row.issues.trim()) errs[`b2_${idx}_issues`] = true
        if (!row.action.trim()) errs[`b2_${idx}_action`] = true
      }
    })

    // Section C: all responses required; if flagged → issueDesc+escalatedTo+status required
    landingPageChecks.forEach((row, idx) => {
      if (!row.response) errs[`lp_${idx}_response`] = true
      if (row.response === 'No' || row.response === 'Needs Attention') {
        if (!row.issueDesc.trim()) errs[`lp_${idx}_issueDesc`] = true
        if (!row.escalatedTo.trim()) errs[`lp_${idx}_escalatedTo`] = true
        if (!row.status) errs[`lp_${idx}_status`] = true
      }
    })

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error('Please complete all required fields before continuing.')
      return
    }

    setErrors({})
    onNext()
  }

  // Derived state
  const hasDisapproved = assetRows.some(r => r.approvalStatus === 'Disapproved')
  const hasNotAvailable = assetRows.some(r => r.approvalStatus === 'Not Available')
  const hasPending = assetRows.some(r => r.approvalStatus === 'Pending')
  const lpFlaggedCount = landingPageChecks.filter(r => r.response === 'No' || r.response === 'Needs Attention').length

  const errBorder = 'rgba(248,113,113,0.5)'
  const textareaStyle = (hasErr) => ({
    backgroundColor: '#1b1b1b',
    border: `1px solid ${hasErr ? errBorder : 'rgba(255,255,255,0.1)'}`,
    color: '#c5c1b9',
  })
  const selectStyle = (hasErr) => ({
    backgroundColor: '#1b1b1b',
    border: `1px solid ${hasErr ? errBorder : 'rgba(255,255,255,0.1)'}`,
    color: '#c5c1b9',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#c5c1b9]">Ad Assets & Landing Page Audit</h2>
          <AutoSaveIndicator saveStatus={assetSaveStatus} />
        </div>
        <p className="text-[#8a8680] text-sm">Review all ad assets and landing pages for quality and compliance.</p>
      </div>

      {/* ========================= SECTION A: Asset Status Review ========================= */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-base font-semibold text-[#c5c1b9] mb-2">Section A — Asset Status Review</h3>
        <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: 'rgba(87,94,207,0.1)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <p className="text-sm text-[#c5c1b9]">
            Review all assets at the account level and campaign level for all enabled campaigns. Check approval status for each asset type.
          </p>
        </div>

        {/* Banners */}
        {hasDisapproved && (
          <div className="mb-4 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#f87171' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#f87171' }}>
              {assetRows.filter(r => r.approvalStatus === 'Disapproved').map(r => r.type).join(', ')} — Disapproved. Action required.
            </span>
          </div>
        )}
        {hasNotAvailable && (
          <div className="mb-4 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#fbbf24' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>
              {assetRows.filter(r => r.approvalStatus === 'Not Available').map(r => r.type).join(', ')} — Not Available. Please provide details.
            </span>
          </div>
        )}
        {!hasDisapproved && !hasNotAvailable && hasPending && (
          <div className="mb-4 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#fbbf24' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>
              Some assets are Pending approval. Monitor status.
            </span>
          </div>
        )}

        {/* Asset Table */}
        <div className="space-y-3">
          {assetRows.map((row, idx) => {
            const statusErr = errors[`asset_${idx}_approvalStatus`]
            const borderColor = row.approvalStatus === 'Disapproved'
              ? 'rgba(248,113,113,0.4)'
              : row.approvalStatus === 'Not Available'
                ? 'rgba(251,191,36,0.4)'
                : statusErr
                  ? 'rgba(248,113,113,0.4)'
                  : 'rgba(255,255,255,0.06)'

            return (
              <div key={row.type} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${borderColor}` }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Asset type */}
                  <div className="w-28 flex-shrink-0">
                    <span className="text-sm font-semibold text-[#c5c1b9]">{row.type}</span>
                    {statusErr && <p className="text-red-400 text-xs mt-0.5">Required</p>}
                  </div>

                  {/* Approval Status */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-[#8a8680] w-14 flex-shrink-0">
                      Status <span className="text-red-400">*</span>
                    </span>
                    <select
                      value={row.approvalStatus}
                      onChange={e => updateAssetRow(idx, 'approvalStatus', e.target.value)}
                      className="rounded-lg px-2 py-1 text-xs focus:outline-none transition-colors flex-1"
                      style={selectStyle(statusErr)}
                    >
                      <option value="">Select...</option>
                      {APPROVAL_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Notes (optional)..."
                      value={row.notes}
                      onChange={e => updateAssetRow(idx, 'notes', e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-colors"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', color: '#c5c1b9' }}
                    />
                  </div>
                </div>

                {/* Expand if Disapproved */}
                {row.approvalStatus === 'Disapproved' && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(248,113,113,0.2)' }}>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`asset_${idx}_issueDesc`] ? '#f87171' : '#8a8680' }}>
                        What is the issue with this asset? <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Describe the disapproval reason..."
                        value={row.issueDesc}
                        onChange={e => updateAssetRow(idx, 'issueDesc', e.target.value)}
                        className={inputClass}
                        style={textareaStyle(errors[`asset_${idx}_issueDesc`])}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`asset_${idx}_actionTaken`] ? '#f87171' : '#8a8680' }}>
                        What action have you taken to resolve it? <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Describe the action taken..."
                        value={row.actionTaken}
                        onChange={e => updateAssetRow(idx, 'actionTaken', e.target.value)}
                        className={inputClass}
                        style={textareaStyle(errors[`asset_${idx}_actionTaken`])}
                      />
                    </div>
                  </div>
                )}

                {/* Expand if Not Available */}
                {row.approvalStatus === 'Not Available' && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(251,191,36,0.2)' }}>
                    <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#fbbf24' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>
                        No {row.type} asset found. Please provide details below.
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`asset_${idx}_whyNoAsset`] ? '#f87171' : '#8a8680' }}>
                        Why is there no {row.type} asset? <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder={`Explain why there is no ${row.type} asset...`}
                        value={row.whyNoAsset}
                        onChange={e => updateAssetRow(idx, 'whyNoAsset', e.target.value)}
                        className={inputClass}
                        style={textareaStyle(errors[`asset_${idx}_whyNoAsset`])}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`asset_${idx}_assetCreationAction`] ? '#f87171' : '#8a8680' }}>
                        Did you create a new asset, or do you need something to create one? If you need something, please describe it in detail. <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Describe what was created or what is needed..."
                        value={row.assetCreationAction}
                        onChange={e => updateAssetRow(idx, 'assetCreationAction', e.target.value)}
                        className={inputClass}
                        style={textareaStyle(errors[`asset_${idx}_assetCreationAction`])}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Last Action Box for Section A */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* ========================= SECTION B: Sitelink Review ========================= */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-[#c5c1b9]">Section B — Sitelink Review</h3>
          <div className="flex gap-2">
            <AutoSaveIndicator saveStatus={accountSitelinkStatus} />
            <AutoSaveIndicator saveStatus={campaignSitelinkStatus} />
          </div>
        </div>
        <div className="mb-5 rounded-lg p-3" style={{ backgroundColor: 'rgba(87,94,207,0.1)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <p className="text-sm text-[#c5c1b9]">
            Verify that sitelinks are correctly aligned and not mixed across campaigns.
          </p>
        </div>

        {/* B1 — Account-Level Sitelinks */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[#c5c1b9] mb-1">B1 — Account-Level Sitelinks</h4>
          <p className="text-xs text-[#8a8680] mb-4">Confirm that account-level sitelinks align with the overall business objectives, services offered, and correct landing pages.</p>
          <div className="space-y-4">
            {accountSitelinks.map((row, idx) => {
              const respErr = errors[`b1_${idx}_response`]
              const flagged = row.response === 'No' || row.response === 'Needs Attention'
              return (
                <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${flagged ? 'rgba(251,191,36,0.3)' : respErr ? errBorder : 'rgba(255,255,255,0.06)'}` }}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-[#c5c1b9]">{row.question}</p>
                      {respErr && <p className="text-red-400 text-xs mt-1">Please select a response.</p>}
                    </div>
                    <ToggleButtons
                      value={row.response}
                      onChange={val => updateAccountSitelink(idx, 'response', val)}
                      options={TOGGLE_OPTIONS_YN}
                      hasError={!!respErr}
                    />
                  </div>
                  {flagged && (
                    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: errors[`b1_${idx}_issues`] ? '#f87171' : '#8a8680' }}>
                          Which sitelink(s) have the issue? <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Identify the specific sitelinks with the issue..."
                          value={row.issues}
                          onChange={e => updateAccountSitelink(idx, 'issues', e.target.value)}
                          className={inputClass}
                          style={textareaStyle(errors[`b1_${idx}_issues`])}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: errors[`b1_${idx}_action`] ? '#f87171' : '#8a8680' }}>
                          What action have you taken? <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Describe the corrective action..."
                          value={row.action}
                          onChange={e => updateAccountSitelink(idx, 'action', e.target.value)}
                          className={inputClass}
                          style={textareaStyle(errors[`b1_${idx}_action`])}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* B2 — Campaign-Level Sitelinks */}
        <div>
          <h4 className="text-sm font-semibold text-[#c5c1b9] mb-1">B2 — Campaign-Level Sitelinks</h4>
          <p className="text-xs text-[#8a8680] mb-4">Confirm that each campaign's sitelinks are specific to that campaign only.</p>
          <div className="space-y-4">
            {campaignSitelinks.map((row, idx) => {
              const respErr = errors[`b2_${idx}_response`]
              const flagged = row.response === 'No' || row.response === 'Needs Attention'
              return (
                <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${flagged ? 'rgba(251,191,36,0.3)' : respErr ? errBorder : 'rgba(255,255,255,0.06)'}` }}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-[#c5c1b9]">{row.question}</p>
                      {respErr && <p className="text-red-400 text-xs mt-1">Please select a response.</p>}
                    </div>
                    <ToggleButtons
                      value={row.response}
                      onChange={val => updateCampaignSitelink(idx, 'response', val)}
                      options={TOGGLE_OPTIONS_YN}
                      hasError={!!respErr}
                    />
                  </div>
                  {flagged && (
                    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: errors[`b2_${idx}_issues`] ? '#f87171' : '#8a8680' }}>
                          Which sitelink(s) have the issue? <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Identify the specific sitelinks with the issue..."
                          value={row.issues}
                          onChange={e => updateCampaignSitelink(idx, 'issues', e.target.value)}
                          className={inputClass}
                          style={textareaStyle(errors[`b2_${idx}_issues`])}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: errors[`b2_${idx}_action`] ? '#f87171' : '#8a8680' }}>
                          What action have you taken? <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Describe the corrective action..."
                          value={row.action}
                          onChange={e => updateCampaignSitelink(idx, 'action', e.target.value)}
                          className={inputClass}
                          style={textareaStyle(errors[`b2_${idx}_action`])}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ========================= SECTION C: Landing Page Audit ========================= */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-[#c5c1b9]">Section C — Landing Page Audit</h3>
          <AutoSaveIndicator saveStatus={lpStatus} />
        </div>
        <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: 'rgba(87,94,207,0.1)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <p className="text-sm text-[#c5c1b9]">
            For each active destination URL, verify that the page is live, functional, and contains the necessary conversion elements.
          </p>
        </div>

        {lpFlaggedCount >= 2 && (
          <div className="mb-4 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#fbbf24' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>
              Multiple landing page issues detected ({lpFlaggedCount}). Consider escalating.
            </span>
          </div>
        )}

        <div className="space-y-4">
          {landingPageChecks.map((row, idx) => {
            const respErr = errors[`lp_${idx}_response`]
            const flagged = row.response === 'No' || row.response === 'Needs Attention'
            return (
              <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${flagged ? 'rgba(251,191,36,0.3)' : respErr ? errBorder : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-[#c5c1b9]">{row.question}</p>
                    {respErr && <p className="text-red-400 text-xs mt-1">Please select a response.</p>}
                  </div>
                  <ToggleButtons
                    value={row.response}
                    onChange={val => updateLandingPage(idx, 'response', val)}
                    options={TOGGLE_OPTIONS_LP}
                    hasError={!!respErr}
                  />
                </div>
                {flagged && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`lp_${idx}_issueDesc`] ? '#f87171' : '#8a8680' }}>
                        Describe the issue <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="What exactly is the issue on the landing page?"
                        value={row.issueDesc}
                        onChange={e => updateLandingPage(idx, 'issueDesc', e.target.value)}
                        className={inputClass}
                        style={textareaStyle(errors[`lp_${idx}_issueDesc`])}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`lp_${idx}_escalatedTo`] ? '#f87171' : '#8a8680' }}>
                        Action taken or escalated to <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Escalated to web team / Fixed CTA button"
                        value={row.escalatedTo}
                        onChange={e => updateLandingPage(idx, 'escalatedTo', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
                        style={textareaStyle(errors[`lp_${idx}_escalatedTo`])}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: errors[`lp_${idx}_status`] ? '#f87171' : '#8a8680' }}>
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={row.status}
                        onChange={e => updateLandingPage(idx, 'status', e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-colors w-40"
                        style={selectStyle(errors[`lp_${idx}_status`])}
                      >
                        <option value="">Select...</option>
                        <option value="Fixed">Fixed</option>
                        <option value="Escalated">Escalated</option>
                        <option value="Monitoring">Monitoring</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-[#c5c1b9]"
          style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="px-8 py-2.5 text-white rounded-lg font-medium text-sm transition-all"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          Save & Continue →
        </button>
      </div>
    </div>
  )
}
