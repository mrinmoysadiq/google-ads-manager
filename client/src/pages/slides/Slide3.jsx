import { useState, useEffect, useCallback } from 'react'
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

const APPROVAL_OPTIONS = ['Approved', 'Pending', 'Disapproved', 'N/A']

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
]

const TOGGLE_OPTIONS_YN = ['Yes', 'No', 'Needs Attention']
const TOGGLE_OPTIONS_LP = ['Yes', 'No', 'Needs Attention', 'N/A']

function ToggleButtons({ value, onChange, options }) {
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
            : { backgroundColor: '#2a2a2a', color: '#8a8680', border: '1px solid rgba(255,255,255,0.1)' }
          }
          onMouseEnter={e => { if (value !== opt) e.currentTarget.style.borderColor = '#575ECF' }}
          onMouseLeave={e => { if (value !== opt) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

const defaultAssetRows = () => ASSET_TYPES.map(type => ({
  type,
  present: '',
  approvalStatus: '',
  notes: '',
  issueDesc: '',
  actionTaken: '',
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

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
  const labelClass = 'block text-sm font-semibold text-[#8a8680] mb-1.5'

  // Load persistent data on mount
  useEffect(() => {
    if (!sessionId) return
    getSlideResponses(sessionId).then(grouped => {
      // Server returns object grouped by slide_number key
      const slideData = grouped[SLIDE_NUMBER] || []
      const map = {}
      slideData.forEach(r => { map[r.field_key] = r.field_value || '' })

      // Restore asset rows
      if (map.asset_status_snapshot) {
        try {
          const parsed = JSON.parse(map.asset_status_snapshot)
          if (Array.isArray(parsed)) setAssetRows(parsed)
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

      // Restore landing page checks
      if (map.landing_page_snapshot) {
        try {
          const parsed = JSON.parse(map.landing_page_snapshot)
          if (Array.isArray(parsed)) setLandingPageChecks(parsed)
        } catch (e) { /* ignore */ }
      }
    }).catch(console.error)
  }, [sessionId])

  // Auto-save asset rows to slide_responses
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

    // Also save disapproved asset change_log entry if any are disapproved
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

  // Asset row helpers
  const updateAssetRow = (idx, field, value) => {
    setAssetRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  const updateAccountSitelink = (idx, field, value) => {
    setAccountSitelinks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  const updateCampaignSitelink = (idx, field, value) => {
    setCampaignSitelinks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  const updateLandingPage = (idx, field, value) => {
    setLandingPageChecks(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  // Derived state
  const hasDisapproved = assetRows.some(r => r.approvalStatus === 'Disapproved')
  const hasPending = assetRows.some(r => r.approvalStatus === 'Pending')
  const lpFlaggedCount = landingPageChecks.filter(r => r.response === 'No' || r.response === 'Needs Attention').length

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
        {!hasDisapproved && hasPending && (
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
          {assetRows.map((row, idx) => (
            <div key={row.type} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${row.approvalStatus === 'Disapproved' ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Asset type */}
                <div className="w-28 flex-shrink-0">
                  <span className="text-sm font-semibold text-[#c5c1b9]">{row.type}</span>
                </div>

                {/* Present toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8a8680] w-14 flex-shrink-0">Present?</span>
                  <div className="flex gap-1">
                    {['Yes', 'No'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateAssetRow(idx, 'present', opt)}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                        style={row.present === opt
                          ? { backgroundColor: '#575ECF', color: '#fff', border: '1px solid #575ECF' }
                          : { backgroundColor: '#333', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approval Status */}
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-[#8a8680] w-14 flex-shrink-0">Status</span>
                  <select
                    value={row.approvalStatus}
                    onChange={e => updateAssetRow(idx, 'approvalStatus', e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs focus:outline-none transition-colors flex-1"
                    style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
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
                    placeholder="Notes..."
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
                    <label className="block text-xs text-[#8a8680] mb-1">What is the issue with this asset?</label>
                    <textarea
                      rows={2}
                      placeholder="Describe the disapproval reason..."
                      value={row.issueDesc}
                      onChange={e => updateAssetRow(idx, 'issueDesc', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8a8680] mb-1">What action have you taken to resolve it?</label>
                    <textarea
                      rows={2}
                      placeholder="Describe the action taken..."
                      value={row.actionTaken}
                      onChange={e => updateAssetRow(idx, 'actionTaken', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
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
            {accountSitelinks.map((row, idx) => (
              <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${(row.response === 'No' || row.response === 'Needs Attention') ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <p className="text-sm text-[#c5c1b9] flex-1">{row.question}</p>
                  <ToggleButtons
                    value={row.response}
                    onChange={val => updateAccountSitelink(idx, 'response', val)}
                    options={TOGGLE_OPTIONS_YN}
                  />
                </div>
                {(row.response === 'No' || row.response === 'Needs Attention') && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <label className="block text-xs text-[#8a8680] mb-1">Which sitelink(s) have the issue?</label>
                      <textarea
                        rows={2}
                        placeholder="Identify the specific sitelinks with the issue..."
                        value={row.issues}
                        onChange={e => updateAccountSitelink(idx, 'issues', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                        style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8680] mb-1">What action have you taken?</label>
                      <textarea
                        rows={2}
                        placeholder="Describe the corrective action..."
                        value={row.action}
                        onChange={e => updateAccountSitelink(idx, 'action', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                        style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* B2 — Campaign-Level Sitelinks */}
        <div>
          <h4 className="text-sm font-semibold text-[#c5c1b9] mb-1">B2 — Campaign-Level Sitelinks</h4>
          <p className="text-xs text-[#8a8680] mb-4">Confirm that each campaign's sitelinks are specific to that campaign only.</p>
          <div className="space-y-4">
            {campaignSitelinks.map((row, idx) => (
              <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${(row.response === 'No' || row.response === 'Needs Attention') ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <p className="text-sm text-[#c5c1b9] flex-1">{row.question}</p>
                  <ToggleButtons
                    value={row.response}
                    onChange={val => updateCampaignSitelink(idx, 'response', val)}
                    options={TOGGLE_OPTIONS_YN}
                  />
                </div>
                {(row.response === 'No' || row.response === 'Needs Attention') && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <label className="block text-xs text-[#8a8680] mb-1">Which sitelink(s) have the issue?</label>
                      <textarea
                        rows={2}
                        placeholder="Identify the specific sitelinks with the issue..."
                        value={row.issues}
                        onChange={e => updateCampaignSitelink(idx, 'issues', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                        style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8680] mb-1">What action have you taken?</label>
                      <textarea
                        rows={2}
                        placeholder="Describe the corrective action..."
                        value={row.action}
                        onChange={e => updateCampaignSitelink(idx, 'action', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                        style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
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
          {landingPageChecks.map((row, idx) => (
            <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${(row.response === 'No' || row.response === 'Needs Attention') ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <p className="text-sm text-[#c5c1b9] flex-1">{row.question}</p>
                <ToggleButtons
                  value={row.response}
                  onChange={val => updateLandingPage(idx, 'response', val)}
                  options={TOGGLE_OPTIONS_LP}
                />
              </div>
              {(row.response === 'No' || row.response === 'Needs Attention') && (
                <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <label className="block text-xs text-[#8a8680] mb-1">Describe the issue</label>
                    <textarea
                      rows={2}
                      placeholder="What exactly is the issue on the landing page?"
                      value={row.issueDesc}
                      onChange={e => updateLandingPage(idx, 'issueDesc', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8a8680] mb-1">Action taken or escalated to</label>
                    <input
                      type="text"
                      placeholder="e.g. Escalated to web team / Fixed CTA button"
                      value={row.escalatedTo}
                      onChange={e => updateLandingPage(idx, 'escalatedTo', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8a8680] mb-1">Status</label>
                    <select
                      value={row.status}
                      onChange={e => updateLandingPage(idx, 'status', e.target.value)}
                      className="rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-colors w-40"
                      style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9' }}
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
          ))}
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
          onClick={onNext}
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
