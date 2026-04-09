const mkItem = () => ({
  answer: null,       // 'yes' | 'no' | 'na'
  verifyText: '',
  verifyImage: null,  // base64
  issueText: '',
  issueImage: null,   // base64
  resolution: '',     // 'Fixed' | 'In Progress' | 'Needs Client Action' | 'Escalated'
  emqScore: '',       // only used for Q5 (index 4)
});

export const metaAuditState = {
  specialist: '',
  client: '',
  website: '',
  date: '',
  currentSlide: 0,
  items: Array.from({ length: 5 }, mkItem),
};

export function resetMetaAuditState() {
  metaAuditState.specialist = '';
  metaAuditState.client = '';
  metaAuditState.website = '';
  metaAuditState.date = '';
  metaAuditState.currentSlide = 0;
  metaAuditState.items = Array.from({ length: 5 }, mkItem);
}
