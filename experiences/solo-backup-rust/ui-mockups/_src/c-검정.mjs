// 시안 C 「검정」 — 엔진 창을 11-16 PC 클라이언트 방향(검정 구)의 말씨로 옮기면 어떻게 보이는지 A와 견주려고 만든 판(2026-11-16).
// node experiences/solo-backup-rust/ui-mockups/_src/c-검정.mjs
// 플랫폼 클라이언트 시안(docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html)의 구 · 글자 · 1px 줄을 그대로 빌리고,
// 솔리오 방 자리에 A 확인서의 기본 화면 내용(문구 · 숫자는 copy.mjs 그대로)을 놓는다. 종이 · 도장 · 회색 책상은 없다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { D, josa } from './copy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const SRC = path.join(repo, 'docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html');
const OUT = path.resolve(here, '..', 'c-검정.html');

let html = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`바꿀 자리를 찾지 못함: ${from.slice(0, 60)}`);
  html = html.replace(from, () => to);
};

const RARR = '<svg class="la" viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8h41M35 1l7 7-7 7"/></svg>';
const row = (nm, val, when = '', cls = '') => `<div class="row ${cls}" role="listitem"><span class="nm">${nm}</span><span class="val">${val}</span><span class="when">${when}</span></div>`;
const gaugeRow = (nm, pct, val, when) => `<div class="row g" role="listitem"><span class="nm">${nm}</span><span class="gv"><span class="gauge" aria-hidden="true"><i style="--v:${pct}%"></i></span><span class="val">${val}</span></span><span class="when">${when}</span></div>`;

const ACT = `<button class="pill pill-main" type="button">파일 되살리기</button><a class="lnk" href="#move">새 PC로 옮겨 오기 ${RARR}</a>`;
const STATES = {
  home: {
    tone: 'ok',
    kick: `${D.device} · 매시간 저절로 지키는 중`,
    say: '안전합니다.',
    then: '매시간 저절로 확인하고, 일주일에 한 번은 파일을 실제로 되살려 원본과 같은지 봅니다.',
    rows: [
      row('마지막 확인', D.last.ko, `다음은 ${D.next.ko}`),
      row('지키는 폴더', `네 곳 · ${D.total.files}개`, D.total.size),
      row('되살려 본 날', D.proof.ko, `무작위 ${D.proof.files}개 모두 원본과 같음`),
    ],
    act: ACT,
  },
  'home-run': {
    tone: 'run',
    kick: `${D.device} · ${D.run.kind} 도는 중`,
    say: '지금 백업하고 있습니다.',
    then: `창을 닫아도 계속됩니다. 끝나기 전까지 가장 최근 판은 오늘 ${D.last.ko} 판입니다.`,
    rows: [
      gaugeRow(`${D.run.kind}`, D.run.pct, `${D.run.pct}%`, `${D.run.stage} · ${D.run.done} / ${D.run.all}`),
      row('바뀐 파일', `${D.run.changed}개`, `${D.run.startKo}에 시작`),
      row('다음 확인', D.nextRun.ko, ''),
    ],
    act: `${ACT}<span class="hint">파일 되살리기는 지금 누르면 ${josa(D.run.kind, '이/가')} 끝나는 대로 이어서 엽니다.</span>`,
  },
  'home-mass': {
    tone: 'bad',
    kick: `${D.device} · 확인이 필요합니다`,
    say: '많은 파일이 한꺼번에 지워졌습니다.',
    then: `${D.mass.whenKo} 「${D.mass.folder}」에서 ${D.mass.count}개가 사라졌습니다. 확인하기 전까지 이전 판을 지우지 않습니다.`,
    rows: [
      row(D.mass.folder, `${D.mass.docLeft}개`, `<b class="x">−${D.mass.count}</b>`, 'now'),
      row('네 곳 합계', `${D.mass.totalNow}개 · ${D.mass.sizeNow}`, ''),
      row('지우기 전 판', `${D.mass.totalBefore}개`, '붙들어 둠'),
    ],
    act: `<button class="pill pill-main" type="button">지워지기 전으로 되살리기</button><button class="pill" type="button">내가 한 일이 맞음</button><a class="lnk" href="#home-mass">지워진 ${D.mass.count}개 보기 ${RARR}</a>`,
  },
};

const room = Object.entries(STATES).map(([id, s]) => `
      <div class="st" data-st="${id}" data-tone="${s.tone}">
        <p class="kick rise" style="--i:0"><i class="dot" aria-hidden="true"></i>${s.kick}</p>
        <p class="say rise" style="--i:1">${s.say}<span class="then">${s.then}</span></p>
        <div class="rows" role="list">${s.rows.map((r, i) => r.replace('class="row', `style="--i:${3 + i}" class="rise row`)).join('')}</div>
        <div class="act rise" style="--i:${3 + s.rows.length}">${s.act}</div>
      </div>`).join('');

// 1. 글꼴: 이 폴더에서 저장소의 SUIT를 잇는다
swap("url(../../브랜드_폰트/SUIT/SUIT-Variable.woff2)", "url(../../../docs/브랜드_폰트/SUIT/SUIT-Variable.woff2)");
swap('<title>검정 구 시안</title>', '<title>업무 백업 · 시안 C 검정</title>');

// 2. 엔진 창의 글 자리
const CSS = `
/* ── 시안 C: 엔진 창(백업·복구) ── */
:root{--ok:#9FD3A8;--warn:#E9C27A;--bad:#F08A6C}
.here-sub{font:400 12px/1 var(--sans);letter-spacing:.04em;color:var(--dim);margin-left:2px}
.set{appearance:none;position:absolute;z-index:2;right:clamp(20px,9.5vw,168px);top:calc(clamp(12px,3.4vh,38px) + 9px);height:26px;margin:0;padding:0;background:none;border:0;
  font:400 13px/1 var(--sans);color:rgba(243,241,236,.7);cursor:pointer;transition:color .25s ease}
.set:hover{color:var(--paper)}
.room.bk{top:50%}
/* 둘째 줄은 설명이 길어 제목보다 작게 둔다(가는 제목 + 회색 둘째 줄) */
.bk .say .then{margin-top:.55em;font-size:.56em;line-height:1.55;letter-spacing:-.01em;max-width:30em}
.st{display:none}
#stage[data-st="home"] .st[data-st="home"],#stage[data-st="home-run"] .st[data-st="home-run"],#stage[data-st="home-mass"] .st[data-st="home-mass"]{display:block}
.kick{margin:0 0 clamp(14px,2.4vh,22px);display:flex;align-items:center;gap:10px;font:400 14px/1.3 var(--sans);color:rgba(243,241,236,.72)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--paper);flex:none}
.st[data-tone="ok"] .dot{background:var(--ok)}
.st[data-tone="run"] .dot{background:var(--paper);animation:blink 1.6s ease-in-out infinite}
.st[data-tone="bad"] .dot{background:var(--bad)}
@keyframes blink{50%{opacity:.25}}
.bk .rows{margin-top:clamp(30px,6.4vh,64px)}
.bk .row{grid-template-columns:minmax(110px,168px) minmax(0,1fr) auto;color:var(--dim)}
.bk .row .val{text-align:left;color:var(--paper)}
.bk .row.now .when .x{color:var(--bad);font-weight:400}
.bk .row.g .gv{display:grid;grid-template-columns:minmax(0,1fr) 4.2em;align-items:center;column-gap:clamp(16px,2.4vw,36px)}
.bk .row.g .gv .val{text-align:right}
.bk .row.g .gauge i{background:var(--paper)}
.act{margin-top:clamp(30px,5.6vh,54px);display:flex;flex-wrap:wrap;align-items:center;gap:14px 26px}
.pill{appearance:none;height:48px;margin:0;padding:0 26px;border:1px solid rgba(243,241,236,.42);border-radius:999px;background:var(--pit);
  font:500 15px/1 var(--sans);color:var(--paper);cursor:pointer;transition:background-color .25s ease,border-color .25s ease}
.pill:hover{border-color:var(--paper);background:#1A1A19}
.pill-main{background:var(--paper);border-color:var(--paper);color:var(--void)}
.pill-main:hover{background:#fff;border-color:#fff}
.lnk{display:inline-flex;align-items:center;gap:12px;padding:0 0 5px;border-bottom:1px solid rgba(243,241,236,.4);font:400 15px/1 var(--sans);color:var(--paper);text-decoration:none}
.lnk:hover{border-bottom-color:var(--paper)}
.la{width:30px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.hint{flex-basis:100%;font:var(--small);color:var(--dim)}
.pill:focus-visible,.lnk:focus-visible,.set:focus-visible{outline:1px solid var(--ring);outline-offset:5px}
#meta [data-mode],#meta #sigbtn,#meta #sound{display:none}
@media (max-height:860px) and (min-width:641px){
  .say{font-size:clamp(25px,min(3.2vw,5vh),44px)}
  .bk .rows{margin-top:clamp(22px,4.4vh,40px)}
  .bk .row{padding:14px 0}
  .act{margin-top:clamp(22px,4vh,36px)}
}
@media (max-width:640px){
  .bk .row{grid-template-columns:minmax(0,1fr) auto}
  .bk .row .when{grid-column:1 / -1;grid-row:2;text-align:left}
  .bk .row.g .gv{grid-column:2}
  .set{right:16px}
}
`;
swap('</style>', CSS + '</style>');

// 3. 솔리오 방 자리에 엔진 창의 기본 화면을 놓는다(공간 바꾸기는 엔진 창에 없다)
html = html.replace(/<div class="room" data-room="solio">[\s\S]*?<\/div>\s*\n\s*<div class="room" data-room="workspace">/, () =>
  `<div class="room bk" data-room="solio">${room}\n    </div>\n\n    <div class="room" data-room="workspace">`);
if (!html.includes('class="room bk"')) throw new Error('솔리오 방을 바꾸지 못함');
swap('<span id="here-text">SOLIO</span><svg viewBox="0 0 8 5" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" d="M1 1l3 3 3-3"/></svg>',
  '<span id="here-text">SOLIO</span><span class="here-sub">백업·복구</span>');
swap('<section id="app" class="layer" aria-label="앱">', '<section id="app" class="layer" aria-label="앱">\n    <button class="set" type="button">설정</button>');
swap(`$('#here-text').textContent = { solio: 'SOLIO', workspace: 'WORKSPACE', pulse: 'PULSE' }[space];`, '');

// 4. 시안 조작 막대: 켜는 상황 대신 화면 셋
swap('<button type="button" id="replay">처음부터</button>',
  `<div class="grp" role="group" aria-label="화면"><button type="button" data-st="home" aria-pressed="true">안전함</button><button type="button" data-st="home-run" aria-pressed="false">도는 중</button><button type="button" data-st="home-mass" aria-pressed="false">한꺼번에 지워짐</button></div>
    <button type="button" id="replay">창 다시 열기</button>`);

// 5. 흐름: 창이 열리면 왼쪽 위의 작은 구가 켜지고 글이 떠오른다(열 때 한 번). 도는 중이면 구의 빛줄기가 시곗바늘처럼 돈다
swap("let diveTo = 'solio', hotWant = -1, faceWant = null, sigOn = true;", "let diveTo = 'solio', hotWant = -1, faceWant = null, sigOn = true, busy = 0, busyWant = 0;");
swap('const az = S.az + ((ptrS.x', 'busy += (busyWant - busy) * .04;\n  const az = S.az + busy * t * 1.4 + ((ptrS.x');
swap("orbBtn.addEventListener('click', openSwitch);\n$('#here-name').addEventListener('click', openSwitch);", '');
swap("$('#reread').addEventListener('click', () => {", "$('#reread') && $('#reread').addEventListener('click', () => {");
swap("$('#replay').addEventListener('click', boot);", `
function showState(id) {
  if (!['home', 'home-run', 'home-mass'].includes(id)) id = 'home';
  stage.dataset.st = id; busyWant = id === 'home-run' ? 1 : 0;
  $$('#meta [data-st]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.st === id)));
}
async function openEngine() {
  const my = ++run;
  stage.classList.remove('still');
  setUI('none'); snap('home'); S.lit = 0;
  await wait(260); if (my !== run) return;
  setUI('app');
  await tween('home', 900, easeOut);
}
$$('#meta [data-st]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.st); showState(b.dataset.st); openEngine(); }));
$('#replay').addEventListener('click', openEngine);`);
swap("if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') boot();", "if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') openEngine();");
swap("resize(); setMode('first'); applySpace(); wakeMeta();\nrequestAnimationFrame(frame);\nboot();",
  "resize(); setMode('first'); applySpace(); wakeMeta(); showState(location.hash.slice(1));\nrequestAnimationFrame(frame);\nif (/[?&]still\\b/.test(location.search)) { window.__orb.at('app', { space: 'solio' }); } else openEngine();");
// 확인 손잡이는 맨 뒤에 정의되므로 still은 그 뒤에 부른다
html = html.replace("if (/[?&]still\\b/.test(location.search)) { window.__orb.at('app', { space: 'solio' }); } else openEngine();", "if (!/[?&]still\\b/.test(location.search)) openEngine();");
swap('  pump() { stage.classList.remove(\'still\');', '  st: showState,\n  pump() { stage.classList.remove(\'still\');');
swap('};\n})();\n</script>', "};\nif (/[?&]still\\b/.test(location.search)) window.__orb.at('app', { space: 'solio' });\n})();\n</script>");

fs.writeFileSync(OUT, html, 'utf8');
console.log(`${path.basename(OUT)} · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
