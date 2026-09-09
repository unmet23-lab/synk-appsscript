'use strict';
const access = window.SynkA11y?.install();
const button = document.querySelector('#motion-toggle');
const preferred = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isReduced = () => access ? access.getMotion().reduced : preferred();
function update() { button.setAttribute('aria-pressed', String(isReduced())); button.textContent = isReduced() ? '움직임 줄임 · 변경' : '움직임 줄이기'; }
button.addEventListener('click', () => { if (access) { access.setMotion(isReduced() ? 'allow' : 'reduce'); access.announce(isReduced() ? '움직임을 줄였습니다.' : '움직임을 허용했습니다.'); } update(); });
window.addEventListener('storage', update);
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', update);
update();
