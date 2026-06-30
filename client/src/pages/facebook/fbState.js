const mk = () => ({
  answer: null,
  chatText: '',
  image: null,
  hasIssue: false,
  issueText: '',
  issueImage: null,
});

const mkPerformance = () => ({
  days7: { leads: '', cpl: '' },
  days3: { leads: '', cpl: '' },
});

const mkCampaignPerf = (groups) =>
  groups.map(g => ({ id: g.id, name: g.name, target_cpl: g.target_cpl, days7: { leads: '', cpl: '' }, days3: { leads: '', cpl: '' } }));

export const fbState = {
  buyer: '',
  date: '',
  account: '',
  currentQuestion: 0,
  sessionId: null,
  items: Array.from({ length: 3 }, mk),
  campaignGroups: [],               // loaded from API on session start
  performanceData: mkPerformance(),
  campaignPerformance: [],          // per-campaign perf when campaignGroups.length > 0
  flaggedAds: [],
  flaggedAdsAnswered: null,
  flaggedAdsNoVerification: '',
};

export function resetFbState() {
  fbState.buyer = '';
  fbState.date = '';
  fbState.account = '';
  fbState.currentQuestion = 0;
  fbState.sessionId = null;
  fbState.items = Array.from({ length: 3 }, mk);
  fbState.campaignGroups = [];
  fbState.performanceData = mkPerformance();
  fbState.campaignPerformance = [];
  fbState.flaggedAds = [];
  fbState.flaggedAdsAnswered = null;
  fbState.flaggedAdsNoVerification = '';
}

export { mkCampaignPerf };
