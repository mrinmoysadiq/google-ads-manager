const mk = () => ({
  answer: null,
  chatText: '',
  image: null,
  hasIssue: false,
  issueText: '',
  issueImage: null,
});

export const fbState = {
  buyer: '',
  date: '',
  account: '',
  currentQuestion: 0,
  sessionId: null,        // set after first save; used to PATCH on edit
  items: Array.from({ length: 4 }, mk),
};

export function resetFbState() {
  fbState.buyer = '';
  fbState.date = '';
  fbState.account = '';
  fbState.currentQuestion = 0;
  fbState.sessionId = null;
  fbState.items = Array.from({ length: 4 }, mk);
}
