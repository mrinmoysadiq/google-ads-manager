const mk = () => ({
  answer: null,
  chatText: '',
  image: null,
  hasIssue: false,
  issueText: '',
  issueImage: null,
  spendAmount: '',
});

export const fbState = {
  buyer: '',
  date: '',
  account: '',
  currentQuestion: 0,
  items: Array.from({ length: 7 }, mk),
};

export function resetFbState() {
  fbState.buyer = '';
  fbState.date = '';
  fbState.account = '';
  fbState.currentQuestion = 0;
  fbState.items = Array.from({ length: 7 }, mk);
}
