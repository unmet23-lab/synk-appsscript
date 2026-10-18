// 앱 계정판 CSS(desktop/renderer/subscriptions.css)에서 영상용 src/board.css를 만든다. 앱 CSS가 바뀌면 다시 돌린다.
//   node scripts/board-css.mjs
// - 밝은 테마 줄은 뺀다(영상은 밤 테마).
// - @media (max-width:760px) 휴대폰 규칙은 .member-subs.ms-phone 아래로 옮긴다. 휴대폰 폭 판은 BoardZ가 ms-phone을 붙이고,
//   PC 폭 판(03 혜택 머리)은 붙이지 않는다.
// - vw·vh는 앱 창 크기 변수로 바꾼다(PC 1280×860, 휴대폰 540×960). 영상 화면(1080 폭)의 vw로 계산되지 않게.
// - 끝에 영상에만 쓰는 한 줄 계정 목록(mt-*)을 붙인다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../../../../desktop/renderer/subscriptions.css');
const OUT = path.resolve(here, '../src/board.css');

let css = fs.readFileSync(SRC, 'utf8').replace(/\r/g, '');
css = css
  .split('\n')
  .filter((ln) => !/data-theme=light|data-theme=day|prefers-color-scheme:light|prefers-reduced-motion/.test(ln))
  .join('\n');

const open = '@media (max-width:760px){';
const at = css.indexOf(open);
if (at < 0) throw new Error('휴대폰 규칙(@media max-width:760px)을 못 찾음');
let depth = 0;
let end = -1;
for (let i = at + open.length - 1; i < css.length; i++) {
  if (css[i] === '{') depth++;
  else if (css[i] === '}') {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end < 0) throw new Error('휴대폰 규칙 끝 괄호를 못 찾음');
const phone = css
  .slice(at + open.length, end)
  .split('\n')
  .map((ln) => ln.trim())
  .filter(Boolean)
  .map((ln) => ln.replace(/\.member-subs(?=[\s{,.:])/g, '.member-subs.ms-phone'))
  .join('\n');
css = css.slice(0, at).trimEnd() + '\n' + css.slice(end + 1).trim();

const units = (s) => s.replace(/(\d*\.?\d+)vw/g, 'calc($1 * var(--ms-vw))').replace(/(\d*\.?\d+)vh/g, 'calc($1 * var(--ms-vh))');

const MOTION_ONLY = `/* 영상에만 쓰는 한 줄 계정 목록(훅·지금 확인). 앱 서비스 줄과 같은 태그·작은 고리·「N% 남음」 부품만 쓴다. */
.member-subs .mt-list{display:flex;flex-direction:column}
.member-subs .mt-row{display:flex;align-items:center;gap:10px;min-height:42px;padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.075));font-size:.9375rem}
.member-subs .mt-row:first-child{border-top:0}
.member-subs .mt-row>b{font-weight:700;min-width:84px}
.member-subs .mt-row .ms-tag{min-width:92px;text-align:center}
.member-subs .mt-row .mt-left{margin-left:auto;white-space:nowrap}
.member-subs .mt-chip{display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 12px;border-radius:12px;background:var(--surface-1,#121317);border:1px solid var(--line-2,rgba(255,255,255,.14));font-size:.875rem;font-weight:650}
.member-subs .mt-chip .st{margin-left:auto;font-family:var(--mono,monospace);font-size:.8125rem}`;

const out = [
  `/* 자동 생성: scripts/board-css.mjs가 desktop/renderer/subscriptions.css에서 만든다. 손으로 고치지 않는다. */`,
  `.member-subs{--ms-vw:12.8px;--ms-vh:8.6px}`,
  `.member-subs.ms-phone{--ms-vw:5.4px;--ms-vh:9.6px}`,
  units(css.trim()),
  `/* 원래 @media (max-width:760px) — 휴대폰 폭 판(.ms-phone)에만 */`,
  units(phone),
  MOTION_ONLY,
  '',
].join('\n');
fs.writeFileSync(OUT, out);
console.log(`board.css ${out.split('\n').length}줄 (휴대폰 규칙 ${phone.split('\n').length}줄)`);
