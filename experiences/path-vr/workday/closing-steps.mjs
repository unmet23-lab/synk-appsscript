/** 맺음을 세 단계로 나눈다: 오늘 고른 것 → 내 생각 → 기록 한 장. 한 화면에 할 일 하나.
 * 진행기(play.mjs)가 채우는 칸은 그대로 두고, 어느 단계를 보일지만 #closing의 data-step으로 정한다.
 * 맺음이 새로 열릴 때마다 첫 단계부터 보인다. */
const closing = document.getElementById('closing');

function show(step, scroll = true) {
  closing.dataset.step = String(step);
  for (const node of closing.querySelectorAll('[data-go]')) node.hidden = !node.dataset.show.split(',').includes(String(step));
  closing.querySelectorAll('.close-steps li').forEach((item, index) => {
    item.className = index + 1 < step ? 'done' : index + 1 === step ? 'now' : '';
    item.querySelector('button')?.setAttribute('aria-current', index + 1 === step ? 'step' : 'false');
  });
  if (scroll) closing.scrollIntoView({ block: 'start' });
}

if (closing) {
  closing.addEventListener('click', (event) => {
    const target = event.target.closest('[data-go]');
    if (!target) return;
    show(Number(target.dataset.go));
    // The pressed button may now be hidden: keep keyboard focus on the step that is showing.
    closing.querySelector('.close-steps li.now button')?.focus({ preventScroll: true });
  });
  let open = !closing.hidden;
  new MutationObserver(() => { if (!closing.hidden && !open) show(1, false); open = !closing.hidden; }).observe(closing, { attributes: true, attributeFilter: ['hidden'] });
  show(1, false);
}
