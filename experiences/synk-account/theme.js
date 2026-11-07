// SYNK 플랫폼(웹) 화면 테마(낮·밤·기기 설정), 검색 단축키, 위 막대 아래 선.
// 화면 스크립트(dist/platform.js)와 따로 돈다. <head>에서 바로 읽혀 첫 화면부터 고른 테마로 그린다.
// 2026-11-08 A 진열대: 기본은 낮(흰 종이). 저장된 선택은 그대로 따른다. 밤은 같은 뼈대에 색만 뒤집은 판이다.
(() => {
  const KEY = 'synk.platform.theme', CHOICES = ['day', 'night', 'system'];
  const LABEL = { night: '밤', day: '낮', system: '기기 설정' };
  const PAPER = { day: '#FFFFFF', night: '#0F0F10' };
  const root = document.documentElement;
  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const read = () => { try { const value = localStorage.getItem(KEY); return CHOICES.includes(value) ? value : 'day'; } catch { return 'day'; } };
  const save = value => { try { localStorage.setItem(KEY, value); } catch { /* 저장이 막힌 창에서는 이번 화면에만 적용한다 */ } };
  const resolved = value => value === 'system' ? (dark && dark.matches ? 'night' : 'day') : value;
  const next = value => CHOICES[(CHOICES.indexOf(value) + 1) % CHOICES.length];
  function apply(value) {
    root.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', PAPER[resolved(value)]);
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.dataset.choice = value;
      button.setAttribute('aria-label', '화면 테마: ' + LABEL[value] + '. 누르면 ' + LABEL[next(value)] + '(으)로 바꿔요');
      button.title = '화면 테마: ' + LABEL[value];
    }
    // 설정 화면의 테마 알약(낮 · 밤 · 기기 설정)도 같은 값을 보인다.
    if (document.querySelectorAll) for (const choice of document.querySelectorAll('[data-theme-choice]')) choice.setAttribute('aria-pressed', String(choice.dataset.themeChoice === value));
  }
  // 저장이 막혀 있어도 이 화면 안에서는 고른 값으로 계속 돈다.
  let current = read();
  apply(current);
  if (dark && dark.addEventListener) dark.addEventListener('change', () => apply(current));
  const choose = value => { if (!CHOICES.includes(value)) return; current = value; save(current); apply(current); };
  function wire() {
    apply(current);
    const button = document.getElementById('theme-toggle');
    if (button) button.addEventListener('click', () => choose(next(current)));
    document.addEventListener('click', event => {
      const target = event.target, choice = target && target.closest ? target.closest('[data-theme-choice]') : null;
      if (choice) choose(choice.dataset.themeChoice);
    });
    // 화면을 내리면 위 막대 아래에 1px 선을 긋는다.
    const bar = document.getElementById('topbar');
    if (bar && window.addEventListener) {
      const line = () => bar.classList.toggle('scrolled', (window.scrollY || 0) > 4);
      window.addEventListener('scroll', line, { passive: true }); line();
    }
    document.addEventListener('keydown', event => {
      const search = document.getElementById('platform-search');
      if (!search || event.defaultPrevented) return;
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault(); search.focus(); search.select(); return;
      }
      if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]')) {
        event.preventDefault(); search.focus(); return;
      }
      if (event.key === 'Escape' && document.activeElement === search && !search.value) search.blur();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true }); else wire();
})();
