const mkItem = () => ({
  answer: null,       // 'yes' | 'no' | 'na'
  verifyText: '',
  verifyImage: null,  // base64
  issueText: '',
  issueImage: null,   // base64
  resolution: '',     // 'Fixed' | 'In Progress' | 'Needs Client Action' | 'Escalated'
});

export const googleAdsTrackingState = {
  specialist: '',
  client: '',
  website: '',
  date: '',
  currentSlide: 0,
  items: Array.from({ length: 5 }, mkItem),
};

export function resetGoogleAdsTrackingState() {
  googleAdsTrackingState.specialist = '';
  googleAdsTrackingState.client = '';
  googleAdsTrackingState.website = '';
  googleAdsTrackingState.date = '';
  googleAdsTrackingState.currentSlide = 0;
  googleAdsTrackingState.items = Array.from({ length: 5 }, mkItem);
}
