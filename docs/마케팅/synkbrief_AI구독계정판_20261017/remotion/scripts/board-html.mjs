// 앱 계정판 화면 코드(desktop/renderer/subscriptions.mjs)로 장면마다 계정판 HTML을 만들어 src/app/boards.json에 쓴다.
//   node scripts/board-html.mjs
// 글자·숫자·추천·개수 글은 앱이 그린 그대로다(손으로 옮기지 않는다). 데이터는 src/app/snapshot.json(10-18 16:18 개발 창 「지금 확인」,
// 메일은 앞부분만). 앱이 바뀌면 board-css.mjs와 함께 다시 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../../../../desktop/renderer/subscriptions.mjs');
const SNAP = path.resolve(here, '../src/app/snapshot.json');
const OUT = path.resolve(here, '../src/app/boards.json');

// 앱 화면 코드가 그릴 때 보는 브라우저 것: 초점(document.activeElement)과 CSS.escape만. 움직임(matchMedia)은 없어서 숫자를 굴리지 않는다.
globalThis.document = { activeElement: null, hidden: false };
globalThis.CSS = { escape: (s) => String(s) };
const { createSubscriptionsBoard } = await import(pathToFileURL(APP).href);

const snapshot = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const NOW = snapshot.check.at + 2 * 60e3; // 확인 2분 뒤 화면(상대 시각 「N분 뒤」의 기준)
const POSTER = { art: '__ART__', label: 'SYNK FOR YOU · 02 / 06', badge: 'PC 앱 · 회원 무료', status: 'integrated' };

/** 앱 계정판을 한 번 그려 innerHTML을 돌려준다. actions는 앱 단추 누르기(data-subs 데이터)를 차례로. */
function draw(snap, actions = []) {
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    let push = null;
    const handlers = new Map();
    const el = { dataset: {}, innerHTML: '', addEventListener: (name, cb) => handlers.set(name, cb), querySelector: () => null, contains: () => false };
    // 처음 불러오기는 끝나지 않게 둔다(나중에 다른 시각으로 다시 그리지 않게). 화면은 알림(onChanged)으로 받은 스냅숏으로만 그린다.
    const bridge = { subscriptions: { snapshot: () => new Promise(() => {}), onChanged: (cb) => { push = cb; return () => {}; } } };
    const board = createSubscriptionsBoard({ bridge, poster: POSTER });
    board.render(el, { signedIn: true, native: true });
    push({ ok: true, seq: 1, ...snap });
    for (const data of actions) handlers.get('click')({ target: { closest: () => ({ disabled: false, dataset: data }) } });
    const html = el.innerHTML;
    board.dispose();
    return html;
  } finally {
    Date.now = realNow;
  }
}

// 「지금 확인」 전·중: 아직 안 읽은 줄은 연결만 된 상태(값 없음 · 확인 전), 읽은 줄은 16:18에 읽은 값. 처음 확인이라 마지막 확인 시각은 없다.
const unread = (row) => ({ ...row, state: 'unknown', live: null, credits: null, creditsAt: null, usedUpAt: null, resetDay: null, resetHour: null, resetMinute: null });
const reading = (k) => ({ ...snapshot, rows: snapshot.rows.map((r, i) => (i < k ? r : unread(r))), check: null, checking: true, progress: { done: k, total: snapshot.rows.length } });

const boards = {
  glance: draw(snapshot),
  'glance-claude': draw(snapshot, [{ subs: 'toggle', id: 'g-claude' }]),
  'glance-more': draw(snapshot, [{ subs: 'more' }]),
  'check-idle': draw({ ...snapshot, rows: snapshot.rows.map(unread), check: null, checking: false }),
  manage: draw(snapshot, [{ subs: 'manage' }]),
  'manage-gemini': draw(snapshot, [{ subs: 'manage' }, { subs: 'guide', service: 'gemini' }]),
};
for (let k = 0; k <= snapshot.rows.length; k++) boards[`check-${k}`] = draw(reading(k));
boards.done = boards.glance;

fs.writeFileSync(OUT, JSON.stringify(boards, null, 1) + '\n');
const summary = Object.entries(boards).map(([k, v]) => `${k} ${Math.round(v.length / 1024)}KB`);
console.log(`boards.json ${Object.keys(boards).length}판 · 기준 ${new Date(NOW).toTimeString().slice(0, 5)}\n${summary.join(' · ')}`);
