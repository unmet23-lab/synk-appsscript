// 화면 바꾸기: 입구·레이스·결과·공통 차고 중 하나만 보인다. 레이스 화면에서는 문서가 스크롤되지 않는다.
export const SCREENS = ['lobby', 'game', 'results', 'garage'];
let current = 'lobby';

export function showScreen(id) {
  for (const name of SCREENS) document.getElementById(name).hidden = name !== id;
  document.body.classList.toggle('playing', id === 'game');
  if (current !== id) window.scrollTo(0, 0);
  current = id;
}
export const currentScreen = () => current;

export function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
export function closeDialog(dialog) { if (dialog.open) dialog.close(); }
