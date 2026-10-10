// SYNK 플랫폼(웹) 화면 테마(밤·낮·기기 설정)와 검색 단축키.
// 화면 스크립트(dist/platform.js)와 따로 돈다. <head>에서 바로 읽혀 첫 화면부터 고른 테마로 그린다.
(() => {
  const KEY = 'synk.platform.theme', CHOICES = ['night', 'day', 'system'];
  const LABEL = { night: '밤', day: '낮', system: '기기 설정' };
  const root = document.documentElement;
  const light = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const read = () => { try { const value = localStorage.getItem(KEY); return CHOICES.includes(value) ? value : 'night'; } catch { return 'night'; } };
  const save = value => { try { localStorage.setItem(KEY, value); } catch { /* 저장이 막힌 창에서는 이번 화면에만 적용한다 */ } };
  const resolved = value => value === 'system' ? (light && light.matches ? 'day' : 'night') : value;
  const next = value => CHOICES[(CHOICES.indexOf(value) + 1) % CHOICES.length];
  function apply(value) {
    root.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved(value) === 'day' ? '#ECECEA' : '#08090C');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.dataset.choice = value;
      button.setAttribute('aria-label', '화면 테마: ' + LABEL[value] + '. 누르면 ' + LABEL[next(value)] + '(으)로 바꿉니다');
      button.title = '화면 테마: ' + LABEL[value];
    }
  }
  // 저장이 막혀 있어도 이 화면 안에서는 고른 값으로 계속 돈다.
  let current = read();
  apply(current);
  if (light && light.addEventListener) light.addEventListener('change', () => apply(current));
  function wire() {
    apply(current);
    const button = document.getElementById('theme-toggle');
    if (button) button.addEventListener('click', () => { current = next(current); save(current); apply(current); });
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
