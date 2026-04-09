const mkItem = () => ({
  answer: null,       // 'yes' | 'no' | 'na'
  verifyText: '',
  verifyImage: null,  // base64
  issueText: '',
  issueImage: null,   // base64
  resolution: '',     // 'Fixed' | 'In Progress' | 'Needs Client Action' | 'Escalated'
});

export const ga4AuditState = {
  specialist: '',
  client: '',
  website: '',
  date: '',
  currentSlide: 0,
  items: Array.from({ length: 5 }, mkItem),
};

export function resetGa4AuditState() {
  ga4AuditState.specialist = '';
  ga4AuditState.client = '';
  ga4AuditState.website = '';
  ga4AuditState.date = '';
  ga4AuditState.currentSlide = 0;
  ga4AuditState.items = Array.from({ length: 5 }, mkItem);
}
