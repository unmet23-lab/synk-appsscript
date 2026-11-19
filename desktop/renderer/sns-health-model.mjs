// 솔리오 「계정 건강」(2026-11-19)의 방을 요약 한 장에서 만든다. DOM이 없다.
// 요약은 이 PC의 진단 도구(tools/계정건강.js --요약쓰기)가 쓰고 desktop/src/sns-health.cjs가 읽는다.
// 진단과 글은 도구(tools/lib/계정건강.js)가 만든다. 이 모델은 그 글을 믿지 않고 아는 꼴만 받아 다듬는다 —
// 모르는 줄 꼴은 버리고, 보이지 않는 글자를 빼고, 길이와 줄 수를 자른다. 틀린 줄 하나는 그 줄만 버린다.
// 돌려주는 꼴은 방문자 분석(site-visits-model.mjs)과 같다: { visible, say, then, when, scope, rows, stale, problem }.
// 줄의 안쪽(more)에 방문자 분석에 없는 꼴이 있다:
//   ['head', 구역 이름] · ['text', 풀어 쓴 글] · ['good' | 'goal' | 'do', 이름, 글]
//   ['row', 이름, 글, 판정, 값, 강조(판정이 나쁨이면 1)]
//   ['flow', [{ name, big, text, verdict, leak }], 글] — 조회 1,000번이 가는 길. 맨 앞 단계는 「조회 1,000」이다
// 화면은 이 글을 모두 textContent로만 넣는다. 설계: docs/디자인/솔리오_계정건강_20261119/PC앱_구현설계.md 9절.
import { monthDay, stamp, rowSpeech } from './site-visits-model.mjs';

export { rowSpeech };
export const SNS_HEALTH_NAME = '계정 건강';
export const SUPPORTED_SUMMARY = 1;
export const LIMITS = Object.freeze({ rows: 80, more: 40, steps: 6, cell: 120, head: 300, text: 900 });
const STALE_DAYS = 2; // 요약이 이보다 오래면 결론 앞에 그것을 말한다. 진단은 3시간마다 다시 쓴다
const DAY = 864e5;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** 보이지 않는 글자와 글 방향을 뒤집는 글자의 구간(코드 값). 소스에 그 글자를 직접 쓰지 않으려고 숫자로 둔다 */
const HIDDEN = [[0x00, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]];
const hidden = code => HIDDEN.some(([from, to]) => code >= from && code <= to);
/** 요약에서 온 글 — 글이 아니면 빈 글, 보이지 않는 글자를 빼고 길이를 자른다(글자 하나를 반으로 자르지 않는다) */
function clean(s, max) {
  const text = typeof s === 'string' ? s : typeof s === 'number' && Number.isFinite(s) ? String(s) : '';
  let out = '';
  for (const ch of text) {
    if (hidden(ch.codePointAt(0))) continue;
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}

/** 길의 큰 숫자 — 10 이상은 정수, 그 아래는 소수 한 자리, 숫자가 없으면 「·」 */
function bigOf(step) {
  const given = clean(step.큰, 12);
  if (given) return given;
  const n = step.명;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '·';
  return (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('ko-KR');
}

/** 안쪽 줄 하나 → 다듬은 줄들(버리면 빈 배열) */
function moreLine(item) {
  if (!Array.isArray(item)) return [];
  const [kind, a, b, c, d] = item;
  if (kind === 'say' || kind === 'note' || kind === 'head' || kind === 'text') {
    const text = clean(a, kind === 'head' ? LIMITS.cell : LIMITS.text);
    return text ? [[kind, text]] : [];
  }
  if (kind === 'good' || kind === 'goal' || kind === 'do') {
    const text = clean(b, LIMITS.text);
    return text ? [[kind, clean(a, LIMITS.cell), text]] : [];
  }
  if (kind === 'row') {
    const name = clean(a, LIMITS.cell);
    if (!name) return [];
    const verdict = clean(c, 12);
    // 강조는 요약이 여섯째 칸에 싣는다. 그 칸이 없는 요약만 판정 글자로 정한다
    const mark = item.length > 5 ? (item[5] ? 1 : 0) : verdict === '나쁨' ? 1 : 0;
    return [['row', name, clean(b, LIMITS.text), verdict, clean(d, LIMITS.cell), mark]];
  }
  if (kind === 'flow') {
    const steps = (Array.isArray(a) ? a : []).filter(isObject).slice(0, LIMITS.steps - 1)
      .map(s => ({ name: clean(s.이름, 20), big: bigOf(s), text: clean(s.글, LIMITS.cell), verdict: clean(s.판정, 12), leak: s.샘 === true }))
      .filter(s => s.name);
    const text = clean(b, LIMITS.text);
    const out = [];
    if (steps.length) out.push(['flow', [{ name: '조회', big: '1,000', text: '1,000번 보이면', verdict: '', leak: false }, ...steps], text]);
    else if (text) out.push(['text', text]);
    return out;
  }
  return [];
}

/** 계정 줄 하나 → 다듬은 줄(버리면 null) */
function accountRow(r) {
  if (!isObject(r)) return null;
  const key = clean(r.key, LIMITS.cell), nm = clean(r.nm, LIMITS.cell);
  if (!key || !nm) return null;
  const more = [];
  for (const item of Array.isArray(r.more) ? r.more : []) {
    let lines;
    try { lines = moreLine(item); } catch { lines = []; }
    for (const line of lines) if (more.length < LIMITS.more) more.push(line);
  }
  return { key, nm, mid: clean(r.mid, LIMITS.cell), val: clean(r.val, LIMITS.cell), when: clean(r.when, LIMITS.cell), now: r.now ? 1 : 0, unread: r.unread ? 1 : 0, more };
}

/**
 * 요약 → 화면에 보일 것.
 * @param result desktop/src/sns-health.cjs snapshot()의 답
 * @returns {visible:false} | { visible:true, say, then, when, scope, rows[], stale, problem }
 */
export function snsHealthView(result, now = Date.now()) {
  if (!result || result.available !== true) return { visible: false };
  if (!result.ok || !isObject(result.summary) || !isObject(result.summary.방)) {
    const supported = result?.supported ?? SUPPORTED_SUMMARY;
    const newer = result?.code === 'VERSION' && Number.isInteger(result.version) && result.version > supported;
    const older = result?.code === 'VERSION' && Number.isInteger(result.version) && result.version < supported;
    return {
      visible: true, say: '진단을 읽지 못했습니다.',
      then: newer ? '진단 도구가 새 꼴로 썼습니다. 앱을 업데이트하면 보입니다.' : older ? '진단 도구가 옛 꼴로 썼습니다. 다음 진단 때 새 꼴로 쓰면 보입니다.' : '다음 진단 때 다시 쓰면 저절로 보입니다.',
      when: '', scope: '', rows: [], stale: false, problem: result?.code || 'UNREADABLE',
    };
  }
  const s = result.summary, room = s.방;
  const seen = new Set(), rows = [];
  for (const r of Array.isArray(room.rows) ? room.rows : []) {
    if (rows.length >= LIMITS.rows) break;
    let row;
    try { row = accountRow(r); } catch { row = null; }
    if (!row || seen.has(row.key)) continue; // 화면은 줄 이름(key)으로 펼침과 초점을 되살린다. 같은 이름은 하나만 둔다
    seen.add(row.key);
    rows.push(row);
  }
  let say = clean(room.say, LIMITS.head), then = clean(room.then, LIMITS.head);
  if (!say) { say = rows.length ? `계정 ${rows.length}개를 진단했습니다.` : '진단한 계정이 아직 없습니다.'; then = rows.length ? then : '게시물의 숫자가 쌓이면 여기에 보입니다.'; }
  // 만든때는 요약을 쓴 때이고, 숫자.게시는 게시 숫자를 마지막으로 읽은 때다. 요약은 숫자를 못 읽은 날에도 다시 쓰이므로
  // 둘을 따로 본다(설계 검토 P2-1). 숫자 칸이 없는 요약은 만든때만으로 말한다
  const made = Date.parse(s.만든때);
  const nums = isObject(s.숫자) ? s.숫자 : {};
  const read = typeof nums.게시 === 'string' ? Date.parse(nums.게시) : NaN;
  const follow = typeof nums.팔로워 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nums.팔로워) ? `${Number(nums.팔로워.slice(5, 7))}월 ${Number(nums.팔로워.slice(8, 10))}일` : '';
  const notWritten = !Number.isFinite(made) || now - made > STALE_DAYS * DAY;
  const notRead = Number.isFinite(read) && now - read > STALE_DAYS * DAY;
  if (notWritten && Number.isFinite(made)) { then = [say, then].filter(Boolean).join(' '); say = `${monthDay(s.만든때)} 뒤로 다시 진단하지 못했습니다.`; }
  else if (notRead) { then = [say, then].filter(Boolean).join(' '); say = `${monthDay(nums.게시)} 뒤로 게시 숫자를 새로 읽지 못했습니다.`; }
  const measured = [Number.isFinite(read) ? `게시 숫자는 ${stamp(nums.게시)}` : '', follow ? `팔로워는 ${follow}` : ''].filter(Boolean).join(', ');
  const stale = notWritten || notRead;
  return {
    visible: true, say, then,
    when: measured ? `${measured}에 잰 값입니다. 게시 숫자를 새로 읽을 때마다 다시 진단합니다.` : Number.isFinite(made) ? `${stamp(s.만든때)}에 진단했습니다. 게시 숫자를 새로 읽을 때마다 다시 진단합니다.` : '',
    scope: clean(room.scope, LIMITS.cell),
    rows, stale, problem: null,
  };
}
