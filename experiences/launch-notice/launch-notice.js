// 출시 안내 띠 — 체험 화면 맨 위에 「2027년 2월 정식 출시 · 지금은 사전예약만」과 사전예약 링크(/reserve/)를 보인다.
// 2026-11-21 유호님: 「지금 체험할수있는거 전부 맨 윗단에 27년 2월에 출시한다고 써주고 지금은 사전모집등록만 진행중이다」.
// 2026-11-23 유호님: 「온라인 반 계획은 철수하자. 앱 오픈을 집중해서 사전예약 받자」 — 둘째 문장을 사전예약으로 맞추고 링크를 붙였다.
// 링크는 /reserve/?lang=<띠 언어>&from=bar-<쪽 경로>로 간다(어느 쪽에서 들어왔는지 사전예약 집계가 센다).
// 공개 경로는 /assets/launch-notice.js 하나다. 쪽마다 <script src="/assets/launch-notice.js" defer></script> 한 줄을 붙인다.
// 글을 바꾸거나 띠를 걷을 때는 이 파일만 고쳐 다시 공개한다.
//
// 넣는 꼴(script 태그의 data-mode):
//   flow(기본) — body 맨 앞에 끼워 아래 내용을 밀어 내린다. 쌓임 순서를 만들지 않아(z-index auto) 쪽의 고정 메뉴 · 창이 띠 위에 덮인다.
//               게임 화면이 보이는 동안(body.playing 또는 main#game이 hidden이 아님)은 띠를 접는다.
//   overlay   — data-anchor="<선택자>"인 모달 창(WORLD는 첫 화면 .synk-opening)이 떠 있는 동안에만 그 창 안 맨 앞에 뜬다.
//               popover(manual)로 맨 위 층에 올리고 닫기 단추가 있다. 그 창이 이 로드에서 뜨지 않거나 닫히면 띠도 없다.
//               「이 로드에서 첫 화면이 뜨지 않는다」는 시간으로 재지 않고 첫 화면과 같은 조건(opening.mjs: ?opening=off,
//               또는 이 탭에서 이미 본 표시)으로 처음에 정하고, 앵커가 아닌 모달 창이 먼저 열리면 거둔다.
// 띠는 쪽의 다른 요소를 움직이지 않는다. 위에 붙은 고정 머리띠는 쪽 CSS가 --synk-launch-h(지금 보이는 띠 높이, 없으면 0px)로 내린다.
// 말은 <html lang>을 따르고, 쪽이 언어를 바꾸면(lang 속성 변경) 따라 바뀐다. 모르는 언어는 영어.
// 쪽마다 CSS가 달라(body > div 규칙 등) 띠는 Shadow DOM 안에 그리고, 바깥 상자는 인라인 !important로 고정한다.
// CSP가 style-src 'self'인 쪽(care, try/travel)에서도 그려지게 style 속성 · <style> 대신 CSSOM(setProperty · adoptedStyleSheets)을 쓴다.
(() => {
  'use strict';
  const TAG = 'synk-launch-notice';
  if (document.querySelector(TAG)) return;
  const script = document.currentScript;
  const anchorSel = (script && script.dataset.mode === 'overlay' && script.dataset.anchor) || '';
  const mode = anchorSel ? 'overlay' : 'flow';
  const VAR = '--synk-launch-h';
  const root = document.documentElement;

  const TEXT = {
    ko: { body: 'SYNK는 2027년 2월에 정식 출시합니다. 지금은 사전예약만 받고 있습니다.', cta: '사전예약하기', label: '출시 안내', close: '안내 닫기' },
    en: { body: 'SYNK officially launches in February 2027. For now, we are only taking pre-registrations.', cta: 'Pre-register', label: 'Launch notice', close: 'Close notice' },
    mn: { body: 'SYNK 2027 оны 2-р сард албан ёсоор нээлтээ хийнэ. Одоогоор зөвхөн урьдчилсан бүртгэл авч байна.', cta: 'Урьдчилан бүртгүүлэх', label: 'Нээлтийн мэдэгдэл', close: 'Мэдэгдлийг хаах' },
    es: { body: 'SYNK se lanza oficialmente en febrero de 2027. Por ahora, solo aceptamos preinscripciones.', cta: 'Preinscribirme', label: 'Aviso de lanzamiento', close: 'Cerrar aviso' },
  };
  // 사전예약 쪽(/reserve/)은 en · ko · mn만 있다. 스페인어 띠는 영어 쪽으로 보낸다.
  const RESERVE_LANG = { ko: 'ko', en: 'en', mn: 'mn', es: 'en' };
  const fromKey = () => {
    const slug = location.pathname.toLowerCase().replace(/index\.html$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return ('bar-' + (slug || 'home')).slice(0, 40).replace(/-+$/, '');
  };
  const lang = () => {
    const l = (root.getAttribute('lang') || '').trim().toLowerCase().slice(0, 2);
    return TEXT[l] ? l : 'en';
  };

  const BASE = [['all', 'initial'], ['display', 'block'], ['box-sizing', 'border-box'], ['margin', '0'], ['padding', '0'], ['border', '0'],
    ['background', 'transparent'], ['overflow', 'visible'], ['flex', 'none']];
  const HOST = {
    flow: BASE.concat([['position', 'static'], ['width', '100%'], ['z-index', 'auto']]),
    overlay: BASE.concat([['position', 'fixed'], ['top', '0'], ['left', '0'], ['right', '0'], ['bottom', 'auto'], ['width', 'auto'], ['height', 'auto'], ['z-index', '2147483000']]),
  };
  const CSS = `
:host{all:initial}
.bar{box-sizing:border-box;position:relative;margin:0;padding:10px 16px;background:#000;color:#fff;
  font-size:14px;font-weight:500;line-height:1.45;text-align:center;letter-spacing:0;
  -webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
.overlay{padding:calc(10px + env(safe-area-inset-top,0px)) 52px 10px}
p{margin:0;padding:0}
a{color:#fff;font-weight:700;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;white-space:nowrap}
a:hover{text-decoration-thickness:2px}
a:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:2px}
button{position:absolute;top:calc(50% + env(safe-area-inset-top,0px) / 2);right:8px;transform:translateY(-50%);width:36px;height:36px;margin:0;padding:0;
  border:0;border-radius:50%;background:transparent;color:#fff;font:inherit;font-size:20px;line-height:36px;cursor:pointer}
button:hover{background:rgba(255,255,255,.16)}
button:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media print{.bar{display:none}}`;

  const setVar = (px) => root.style.setProperty(VAR, Math.max(0, Math.round(px)) + 'px');

  const make = () => {
    const host = document.createElement(TAG);
    for (const [k, v] of HOST[mode]) host.style.setProperty(k, v, 'important');
    const shadow = host.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      shadow.adoptedStyleSheets = [sheet];
    } catch (_) {
      const style = document.createElement('style');
      style.textContent = CSS;
      shadow.append(style);
    }
    const bar = document.createElement('div');
    bar.className = 'bar ' + mode;
    bar.setAttribute('role', 'region');
    bar.style.fontFamily = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const p = document.createElement('p');
    const text = document.createTextNode('');
    const link = document.createElement('a');
    const linkText = document.createTextNode('');
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = ' →';
    link.append(linkText, arrow);
    p.append(text, link);
    bar.append(p);
    let btn = null;
    if (mode === 'overlay') {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '×';
      bar.append(btn);
    }
    shadow.append(bar);
    const render = () => {
      const l = lang(), t = TEXT[l];
      bar.lang = l;
      bar.setAttribute('aria-label', t.label);
      text.nodeValue = t.body + ' ';
      linkText.nodeValue = t.cta;
      link.href = '/reserve/?lang=' + RESERVE_LANG[l] + '&from=' + fromKey();
      if (btn) btn.setAttribute('aria-label', t.close);
    };
    render();
    new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ['lang'] });
    return { host, btn };
  };

  // flow: body 맨 앞. 쪽이 뒤늦게 맨 앞에 끼운 것(계정 안내 띠 등)보다 위에 남고, 게임 화면이 보이는 동안 접는다.
  const flow = () => {
    const { host } = make();
    document.body.insertBefore(host, document.body.firstChild);
    let moves = 0;
    new MutationObserver(() => {
      if (!host.previousElementSibling || moves >= 8) return;
      moves += 1;
      document.body.insertBefore(host, document.body.firstChild);
    }).observe(document.body, { childList: true });
    const game = document.querySelector('main#game');
    const update = () => {
      const playing = document.body.classList.contains('playing') || (game && !game.hidden);
      host.style.setProperty('display', playing ? 'none' : 'block', 'important');
      setVar(playing ? 0 : host.offsetHeight - (window.scrollY || 0));
    };
    update();
    new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (game) new MutationObserver(update).observe(game, { attributes: true, attributeFilter: ['hidden'] });
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    addEventListener('load', update, { once: true });
  };

  // overlay: 앵커 모달 창이 떠 있는 동안만 그 창 안 맨 앞에 띄운다. 창이 닫히거나 지워지면 띠를 거두고 --synk-launch-h를 0으로.
  // 앵커 창이 이 로드에서 뜨지 않는 조건 — WORLD 첫 화면(experiences/brand-opening/opening.mjs mountBrandOpening)과 같게 본다.
  const SEEN_KEYS = { '.synk-opening': 'synk.brand-opening.v1.seen' };
  const anchorSkipped = () => {
    const q = new URLSearchParams(location.search).get('opening');
    if (q === 'off') return true;
    const key = SEEN_KEYS[anchorSel];
    if (!key || q === 'replay') return false;
    try { return sessionStorage.getItem(key) === '1'; } catch (_) { return false; }
  };

  const overlay = () => {
    try { if (sessionStorage.getItem(TAG) === 'closed') return; } catch (_) { /* 저장소가 막혀도 띠는 보인다 */ }
    if (anchorSkipped()) return;
    const { host, btn } = make();
    const canPop = typeof host.showPopover === 'function';
    if (canPop) host.setAttribute('popover', 'manual');
    let done = false, watch = null;
    const stop = () => {
      done = true;
      host.remove();
      setVar(0);
      if (watch) watch.disconnect();
      document.removeEventListener('close', place, true);
      removeEventListener('resize', place);
    };
    btn.addEventListener('click', () => {
      stop();
      try { sessionStorage.setItem(TAG, 'closed'); } catch (_) { /* 이 창에서만 닫힌다 */ }
    });
    let seen = false;
    const place = () => {
      if (done) return;
      const a = document.querySelector(anchorSel);
      const open = !!(a && a.open);
      if (!open) {
        // 앵커보다 다른 모달 창이 먼저 열렸으면 이 로드의 첫 화면은 지나갔다.
        const other = !seen && [...document.querySelectorAll('dialog[open]')].some((d) => { try { return d.matches(':modal'); } catch (_) { return false; } });
        if (seen || other) stop();
        else if (host.isConnected) { host.remove(); setVar(0); }
        return;
      }
      seen = true;
      if (host.parentNode !== a) {
        a.insertBefore(host, a.firstChild);
        if (canPop) { try { host.showPopover(); } catch (_) { /* 못 올려도 창 안에서 보인다 */ } }
      }
      setVar(host.offsetHeight);
    };
    watch = new MutationObserver(place);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('close', place, true);
    addEventListener('resize', place);
    place();
  };

  const start = () => { if (!document.querySelector(TAG)) (mode === 'overlay' ? overlay : flow)(); };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
