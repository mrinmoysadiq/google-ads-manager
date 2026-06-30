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

export const fbState = {
  buyer: '',
  date: '',
  account: '',
  currentQuestion: 0,
  sessionId: null,
  items: Array.from({ length: 3 }, mk),
  performanceData: mkPerformance(),
  flaggedAds: [],                  // array of { ad_name, campaign_name, action_taken, notes }
  flaggedAdsAnswered: null,        // null | 'yes' | 'no'
  flaggedAdsNoVerification: '',    // verification text when answered 'no'
};

export function resetFbState() {
  fbState.buyer = '';
  fbState.date = '';
  fbState.account = '';
  fbState.currentQuestion = 0;
  fbState.sessionId = null;
  fbState.items = Array.from({ length: 3 }, mk);
  fbState.performanceData = mkPerformance();
  fbState.flaggedAds = [];
  fbState.flaggedAdsAnswered = null;
  fbState.flaggedAdsNoVerification = '';
}
