// 비교 페이지: 방향마다 컴퓨터 · 휴대폰 화면을 실제로 띄운다. 보이는 방향만 불러 영상이 한꺼번에 돌지 않게 한다.
const sizes = { d: [1440, 900], m: [390, 844] };
for (const dir of document.querySelectorAll('[data-dir]')) {
  const id = dir.dataset.dir; let page = 'index.html', loaded = false;
  const frames = { d: dir.querySelector('[data-view=d] iframe'), m: dir.querySelector('[data-view=m] iframe') };
  const url = () => `${id}/${page}`;
  const load = () => { for (const k of ['d', 'm']) { if (frames[k].getAttribute('src') !== url()) frames[k].setAttribute('src', url()); } loaded = true; dir.querySelector('[data-open]').href = `${id}/${page}`; };
  const unload = () => { if (!loaded) return; for (const k of ['d', 'm']) { frames[k].setAttribute('src', 'about:blank'); frames[k].parentElement.classList.remove('is-live'); } loaded = false; };
  dir.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.page; dir.querySelectorAll('[data-page]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); load(); }));
  new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); else unload(); }, { threshold: 0.2 }).observe(dir.querySelector('.stage'));
  const fit = () => { for (const k of ['d', 'm']) { const box = dir.querySelector(`[data-view=${k}]`), f = frames[k], [w, h] = sizes[k], s = box.clientWidth / w; f.width = w; f.height = h; f.style.setProperty('transform', `scale(${s})`); } };
  fit(); addEventListener('resize', fit);
  // 안쪽 화면은 눌러야 조작된다. 그전에는 위로 지나가도 이 페이지가 그대로 내려간다.
  for (const k of ['d', 'm']) {
    const box = dir.querySelector(`[data-view=${k}]`), shield = document.createElement('button');
    shield.type = 'button'; shield.className = 'shield'; shield.innerHTML = '<span>눌러서 직접 해 보기</span>';
    box.append(shield);
    shield.addEventListener('click', () => { box.classList.add('is-live'); frames[k].focus(); });
    box.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') box.classList.remove('is-live'); });
  }
}
