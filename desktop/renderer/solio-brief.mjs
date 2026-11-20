// 솔리오 구독 방의 비서 판(2026-11-20, docs/디자인/솔리오_구독비서_20261120/설계.md 3절과 7절 설계 검토 반영). DOM이 없다.
// 유호님 11-20 「딱 하나만 봤으면 좋겠어」, 「급한것 중요한것 위주로 맨 위로」, 「토큰 출력량이 실시간으로」, 「하루에 한번씩 총 사용량 진단」.
// 맨 위 한 가지(briefHead), 다가오는 일(briefSoon), 지금 출력(briefLive), 오늘 진단(briefDiag), 줄 안쪽 결론(poolSay)을 만든다.
import { serviceGroups, upcoming, costOf, monthPrice, monthCredits, ultraGuess, weightOf, planKey, nextRefill, balance, DAY_MS } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, whenWords, josa, joinNames } from './solio-today.mjs';
import { tokenDay, tokenText } from './subscriptions-tokens.mjs';

const HOUR = 3600e3, TEN_MIN = 600e3, SOON_MS = 48 * HOUR, LOOK_MS = 7 * DAY_MS, W_MS = 7 * DAY_MS;
/* 30분 안에 다시 열리는 막힘은 막힘으로 치지 않는다(GPT 검수 GA2, 화면 검수 r2 A1) */
const SHORT_MS = 30 * 60e3;
/* 문자판 바깥 눈금이 보이는 길이: 지금부터 사흘(11-20 유호님이 고르신 A 문자판) */
export const DIAL_MS = 72 * HOUR;
export const SOON_SHOWN = 3;      // 첫 화면의 다가오는 일(설계 검토 D11). 나머지는 상세내역 맨 위
export const RECENT_MS = 10 * 60e3;
const KEEP_MS = 15 * 60e3;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
/* 진단 판정의 문턱(설계 3.4 · 7절 D2 · D3) */
export const DIAG = Object.freeze({ shortShare: 0.5, earlyMs: DAY_MS, minWindows: 2, target: 80, spareOne: 15, creditShort: 0.9, creditSpare: 0.1 });
const VERDICT_WORD = Object.freeze({ short: '모자람', spare: '남음', fit: '알맞음', young: '아직 모름' });
const TOOL_NAME = Object.freeze({ claude: 'Claude Code', gpt: 'Codex', grok: 'Grok', gemini: 'Gemini' });
/* Codex와 Gemini의 %는 CLI 한도라 구독 전체(웹 · 앱)를 말하지 못한다(subscriptions-model.mjs 2차 검수 P1-1, 설계 검토 D3) */
const CLI_ONLY = Object.freeze({ gpt: { tool: 'Codex', web: 'ChatGPT 웹과 앱' }, gemini: { tool: 'Antigravity', web: 'Gemini 웹과 앱' } });

const pad = n => String(n).padStart(2, '0');
const fmt = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const ga = w => josa(w, ['이', '가']), neun = w => josa(w, ['은', '는']);
const here = g => g.accounts.filter(a => !a.away);
const svcName = g => (g.service && SOLIO_TODAY_NAMES[g.service]) || String(g.label || '').trim() || '직접 넣은 구독';
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (t, now) => Math.round((dayStart(t) - dayStart(now)) / DAY_MS);
/* 예측한 때는 한 시간 단위로 반올림해 「…쯤」으로 말한다. 읽은 때(초기화, 다시 열림)는 그대로 쓴다.
   30분 단위는 맨 위 문장을 두 줄로 밀어 첫 화면이 한 화면을 넘었다(11-20 실제 자료 캡처).
   반올림이 지금보다 앞이 되면(14:20에 14:28을 14:00으로) 10분 단위로 올린다(화면 검수 r2 A8) */
const roundHalf = (t, now) => { const r = Math.round(t / HOUR) * HOUR; return r > now ? r : Math.ceil(t / TEN_MIN) * TEN_MIN; };
/* 「…까지는 막히지 않습니다」는 늦게 말하지 않게 내린다(화면 검수 r2 A8) */
const floorAt = (t, now) => { const f = Math.floor(t / HOUR) * HOUR; return f > now ? f : Math.floor(t / TEN_MIN) * TEN_MIN; };
const spoken = (t, now) => whenWords(t, now, { withTime: true });
/* 다가오는 일 왼쪽 칸: 「오늘 22:15」, 「내일 10:59」, 「모레 07:00」, 그 뒤 「일 03:00」 */
export function soonWhen(t, now, dateOnly = false) {
  const d = new Date(t), days = daysBetween(t, now);
  const day = days <= 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : days < 7 ? WEEKDAY[d.getDay()] + '요일' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  return dateOnly ? day : day + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
/* 막히는 길이: 「40분」, 「20시간」, 「2일」 */
function spanWords(ms) {
  const h = ms / HOUR;
  if (h < 1) return Math.max(1, Math.round(ms / 60e3)) + '분';
  if (h < 48) return Math.round(h) + '시간';
  return Math.round(h / 24) + '일';
}
/* 5시간 한도로 막힌 계정이 섞이면 「다 썼습니다」가 아니라 「막혀 있습니다」다(설계 검토 D5) */
const blocked = list => list.some(a => a.focus === 'session');
/* 「10개 가운데 7개를 다 썼습니다」, 「7개가 막혀 있습니다」 */
const outCount = (n, list) => n + '개 가운데 ' + list.length + (blocked(list) ? '개가 막혀 있습니다.' : '개를 다 썼습니다.');
/* 「Claude는 지금 모든 계정이 막혀 있습니다.」, 「…모든 계정을 다 썼습니다.」 조사를 동사에 맞춘다(화면 검수 r2 A6) */
const allOutSay = (name, list) => neun(name) + ' 지금 모든 계정' + (blocked(list) ? '이 막혀 있습니다.' : '을 다 썼습니다.');

/* 지금 볼 묶음: 이 PC 계정이 하나라도 있는 구독 */
export function briefGroups(snapshot, now) {
  return serviceGroups(snapshot?.rows || [], now, snapshot?.check?.at || null).filter(g => here(g).length > 0);
}

/* ── 지금 속도면 언제 모두 막히나(설계 3.1, 설계 검토 D1, 화면 검수 A1 · A2) ──
   계정 여럿을 돌려 쓰면 막힌 계정의 몫이 남은 계정으로 옮겨 간다. 그래서 남은 계정 각자의 지난 속도가 아니라
   이 PC 계정 모두의 최근 3일 속도 합(요금제 무게)을 서비스의 속도로 본다.
   계정마다 남은 몫을 따로 들고, 쓰는 몫은 먼저 초기화되는 계정부터 덜어 낸다(솔리오가 권하는 「오늘은 이 계정부터」와 같은 차례).
   계정이 초기화되거나 다시 열리면 그 계정만 다시 찬다(5시간 한도로 막힌 계정은 풀릴 때 주간 남은 몫, 주간 초기화 때 100%). 초기화 뒤 7일마다 또 찬다.
   다시 찼을 계정, 아직 읽지 않은 계정, 속도를 모르는 계정(기록 3일 미만), 요금제 무게를 모르는 서비스(Codex Pro와 Plus)는 null이다.
   돌려주는 값: { at 모두 막히는 때, next 그 뒤 처음 몫이 생기는 사건(없으면 null), beyond 일주일 넘어서야 막힘, perWeek 한 주에 쓰는 계정 수, same 모든 계정의 요금제가 같은지 } */
export function poolRunout(snapshot, g, now) {
  if (g.kind !== 'weekly' || !g.service) return null;
  const stats = snapshot?.usage?.accounts || {}, list = here(g);
  if (!list.length || g.projected.length || g.pending.length) return null;
  const known = list.filter(a => ['ok', 'low', 'out'].includes(a.state));
  if (!known.length || known.some(a => !Number.isFinite(stats[a.row.id]?.rate3))) return null;
  // 다시 로그인하거나 못 읽은 계정의 속도도 그 서비스에서 쓴 양이라 있으면 넣는다
  // 본체가 그때의 요금제 무게로 센 속도(rate3w)를 먼저 쓴다. 3일 안에 요금제를 바꾼 계정의 옛 몫을 지금 무게로 부풀리지 않는다(GPT 검수 GA3)
  const rateOf = a => { const st = stats[a.row.id]; return Number.isFinite(st?.rate3w) ? st.rate3w : Number.isFinite(st?.rate3) ? st.rate3 * weightOf(a.row) : 0; };
  const rateW = list.reduce((n, a) => n + rateOf(a), 0);
  if (!(rateW > 0)) return null;
  // 요금제 무게를 모르는 서비스(Codex Pro와 Plus)는 계정마다의 %를 더할 수 없다(설계 검토 D4)
  const same = new Set(list.map(a => planKey(a.row.plan))).size === 1;
  if (g.service !== 'claude' && !same) return null;
  const end = now + LOOK_MS, weekOf = a => (a.g?.weekly && !a.g.weekly.guess ? a.g.weekly : null);
  // 계정마다: 지금 남은 몫(무게 곱)과 앞으로 차는 때들
  const accts = [];
  for (const a of known) {
    const w = weightOf(a.row), wk = weekOf(a), fills = [];
    const every = t0 => { for (let t = t0; t && t <= end; t += W_MS) fills.push({ t, to: 100 * w, type: 'reset' }); };
    if (a.state === 'out') {
      if (a.focus === 'session') {
        // 5시간 한도로 막힌 계정: 주간 몫이나 풀리는 때를 모르면 셀 수 없다. 5시간 풀림을 주간 100%로 부풀리지 않는다(화면 검수 r2 A2)
        if (!wk || !a.unblock) return null;
        // 주간 초기화가 5시간 한도가 풀리기 전에 오면, 풀릴 때 100%로 열린다
        if (wk.resetsAt && wk.resetsAt <= a.unblock) { fills.push({ t: a.unblock, to: 100 * w, type: 'reopen' }); every(wk.resetsAt + W_MS); }
        else { fills.push({ t: a.unblock, to: wk.left * w, type: 'reopen' }); every(wk.resetsAt); }
      } else if (a.unblock) { fills.push({ t: a.unblock, to: 100 * w, type: 'reopen' }); every(a.unblock + W_MS); }
      fills.sort((p, q) => p.t - q.t);
      accts.push({ a, level: 0, fills });
      continue;
    }
    every(wk?.resetsAt || null);
    accts.push({ a, level: (wk ? wk.left : a.left ?? 0) * w, fills });
  }
  const events = accts.flatMap(x => x.fills.filter(f => f.t > now).map(f => ({ ...f, x }))).sort((p, q) => p.t - q.t);
  const nextFill = x => x.fills.find(f => f.t > tNow)?.t ?? Infinity;
  const unit = Math.max(...list.map(a => weightOf(a.row))), perWeek = (rateW * 7) / (100 * unit);
  const perMs = rateW / DAY_MS, base = { perWeek, same, accounts: list.length };
  let tNow = now;
  // 그 사이에 쓸 몫을 먼저 초기화되는 계정부터 덜어 낸다. 모자라면 그때 모두 막힌다
  const drain = until => {
    let need = (until - tNow) * perMs;
    const total = accts.reduce((n, x) => n + x.level, 0);
    // 다 쓰는 바로 그때 다른 계정이 열리면 막히지 않는다(GPT 검수 GA2)
    if (need > total) return tNow + total / perMs;
    for (const x of [...accts].filter(x => x.level > 0).sort((p, q) => nextFill(p) - nextFill(q))) {
      const take = Math.min(x.level, need);
      x.level -= take; need -= take;
      if (need <= 0) break;
    }
    return null;
  };
  // 모두 바닥난 때. 30분 안에 다시 열리면 막힘으로 치지 않고 이어 세어 그 뒤의 진짜 막힘을 찾는다(화면 검수 r2 A1)
  let gapAt = null;
  for (const e of events) {
    const out = drain(e.t);
    if (out !== null) { if (gapAt === null) gapAt = out; for (const x of accts) x.level = 0; }
    tNow = e.t;
    // 몫이 늘지 않는 사건(주간 몫이 0인 채 풀리는 5시간 한도 같은)은 다시 열림이 아니다(화면 검수 r2 A1)
    if (!(e.to > e.x.level)) continue;
    if (gapAt !== null) {
      if (e.t - gapAt >= SHORT_MS) return { ...base, at: gapAt, next: { t: e.t, a: e.x.a, type: e.type }, beyond: false };
      gapAt = null;
    }
    e.x.level = e.to;
  }
  if (gapAt !== null) return { ...base, at: gapAt, next: null, beyond: false };
  const total = accts.reduce((n, x) => n + x.level, 0), at = tNow + total / perMs;
  return { ...base, at, next: null, beyond: at > end };
}

/* 줄 안쪽의 결론 문장(설계 검토 D5). 다 쓴 계정이 있거나 일주일 안에 모두 막히는 서비스만 만든다. 그 밖에는 지금 문장(solio-today moreSay) 그대로 */
export function poolSay(snapshot, g, now) {
  if (g.kind !== 'weekly' || !g.service) return '';
  const list = here(g), name = svcName(g), r = poolRunout(snapshot, g, now), one = list.length === 1;
  // 쓸 계정은 없는데 다시 로그인하거나 읽지 못한 계정이 있으면 「모든 계정」이 아니라 그 할 일을 말한다(Fable 최종 F1)
  if (!g.usable.length && !g.projected.length && g.out.length && (g.login.length || g.error.length)) return fixSay(g);
  if (!g.usable.length && !g.projected.length && g.out.length) {
    const first = g.out[0];
    return (one ? neun(name) + ' ' + (first.focus === 'session' ? '5시간 한도' : '이번 주 한도') + '를 다 썼습니다.' : allOutSay(name, g.out))
      + (first.unblock ? ' ' + spoken(first.unblock, now) + '에 ' + (one ? '' : ga(first.name) + ' 먼저 ') + '다시 열립니다.' : '');
  }
  const runWords = r && !r.beyond ? '지금 속도면 ' + whenWords(roundHalf(r.at, now), now, { withTime: true }) + '쯤 ' + (one ? '바닥납니다.' : '모두 막힙니다.') : '';
  if (g.out.length && !one) {
    const first = g.out[0];
    return name + ' ' + outCount(list.length, g.out) + ' '
      + (runWords || (r ? '지금 속도면 이번 주는 모두 막히지는 않습니다.' : first.unblock ? spoken(first.unblock, now) + '에 ' + ga(first.name) + ' 먼저 다시 열립니다.' : ''));
  }
  return runWords;
}

/* 다 쓴 계정과 다시 로그인할(또는 읽지 못한) 계정만 있는 서비스: 「Claude 3개 가운데 2개를 다 썼고 1개는 다시 로그인해야 합니다.」 */
function fixSay(g) {
  const n = here(g).length, login = g.login.length, error = g.error.length;
  const rest = login && error ? login + '개는 다시 로그인해야 하고 ' + error + '개는 읽지 못했습니다.' : login ? login + '개는 다시 로그인해야 합니다.' : error + '개는 읽지 못했습니다.';
  return svcName(g) + ' ' + n + '개 가운데 ' + g.out.length + '개를 다 썼고 ' + rest;
}

/* 맨 위 한 가지(설계 3.1, 설계 검토 D5). 자료를 다 읽은 상태에서만 부른다.
   돌려주는 값: { say, then, covers 다가오는 일에서 뺄 열쇠, service 말한 구독(문자판이 이 구독을 가운데 둔다), pull 둘째 줄을 다가오는 일의 첫 줄로 채울지 }.
   고를 것이 없으면 지금 solioToday 문장(fallback)을 쓴다 */
export function briefHead(snapshot, groups, now, fallback = null) {
  const weekly = groups.filter(g => g.kind === 'weekly' && g.service);
  const runs = new Map(weekly.map(g => [g, poolRunout(snapshot, g, now)]));
  // 0. 쓸 계정은 없고 다시 로그인하거나 읽지 못한 계정이 남은 서비스: 로그인하면 바로 쓸 수 있으니 그 할 일이 맨 위다(Fable 최종 F1)
  const fixable = weekly.find(g => !g.usable.length && !g.projected.length && g.out.length && (g.login.length || g.error.length));
  if (fixable) return { say: fixSay(fixable), then: '계정 관리에서 ' + (fixable.login.length ? '다시 로그인합니다.' : '연결을 확인합니다.'), covers: [], service: fixable.service };
  // 1. 한 서비스의 이 PC 계정이 모두 막힘. 다시 열리는 때가 가장 늦은 것부터
  const allOut = weekly.filter(g => !g.usable.length && !g.projected.length && g.out.length && !g.login.length && !g.error.length).sort((a, b) => (b.out[0].unblock ?? Infinity) - (a.out[0].unblock ?? Infinity));
  if (allOut.length) {
    const g = allOut[0], first = g.out[0], name = svcName(g), one = here(g).length === 1;
    const say = one ? neun(name) + ' ' + (first.focus === 'session' ? '5시간 한도' : '이번 주 한도') + '를 다 썼습니다.' : allOutSay(name, g.out);
    const then = first.unblock ? spoken(first.unblock, now) + '에 ' + (one ? '' : ga(first.name) + ' 먼저 ') + '다시 열립니다.' : '';
    return { say, then, covers: first.unblock ? ['unblock:' + first.row.id] : [], service: g.service };
  }
  // 2. 지금 속도면 48시간 안에 모두 막힘. 막히는 때가 가장 이른 것부터. 30분 안에 다시 열리면 말하지 않는다
  const soonRun = weekly.map(g => ({ g, r: runs.get(g) })).filter(({ r }) => r && !r.beyond && r.at <= now + SOON_MS && (!r.next || r.next.t - r.at >= 30 * 60e3)).sort((a, b) => a.r.at - b.r.at)[0];
  if (soonRun) {
    const { g, r } = soonRun, name = svcName(g), one = here(g).length === 1;
    const say = '지금 속도면 ' + neun(name) + ' ' + whenWords(roundHalf(r.at, now), now, { withTime: true }) + '쯤 ' + (one ? '바닥납니다.' : '모두 막힙니다.');
    const then = r.next
      ? spoken(r.next.t, now) + '에 ' + (one ? '' : ga(r.next.a.name) + ' ') + (r.next.type === 'reopen' ? '다시 열릴' : '초기화될') + ' 때까지 ' + spanWords(r.next.t - r.at) + '쯤 막힙니다.'
      : '일주일 안에는 다시 열리는 계정이 없습니다.';
    return { say, then, covers: ['runout:' + g.service, ...(r.next ? [(r.next.type === 'reopen' ? 'unblock:' : 'reset:') + r.next.a.row.id] : [])], service: g.service };
  }
  // 3. 계정 둘 이상인 서비스에서 절반 이상이 막힘. 막힌 몫이 큰 것부터
  const many = weekly.filter(g => here(g).length >= 2 && g.out.length * 2 >= here(g).length).sort((a, b) => b.out.length / here(b).length - a.out.length / here(a).length)[0];
  if (many) {
    const name = svcName(many), r = runs.get(many), first = many.out[0];
    const say = name + ' ' + outCount(here(many).length, many.out);
    let then = '', covers = [];
    if (r) then = r.beyond ? '지금 속도면 이번 주는 모두 막히지는 않습니다.' : '지금 속도면 ' + whenWords(floorAt(r.at, now), now, { withTime: true }) + '까지는 막히지 않습니다.';
    else if (first.unblock) { then = spoken(first.unblock, now) + '에 ' + ga(first.name) + ' 먼저 다시 열립니다.'; covers = ['unblock:' + first.row.id]; }
    return { say, then, covers, service: many.service };
  }
  // 4. 다시 로그인하거나 읽지 못한 계정. 할 일을 그대로 말한다
  const trouble = groups.filter(g => g.service && (g.login.length || g.error.length));
  if (trouble.length) {
    const g = trouble[0], a = g.login[0] || g.error[0], name = svcName(g);
    const what = g.login.length ? '다시 로그인해야 합니다' : '읽지 못했습니다';
    const others = trouble.length > 1 || g.login.length + g.error.length > 1 ? ' 손볼 계정이 더 있으면 상세내역에서 보입니다.' : '';
    return { say: name + ' ' + (a.name ? a.name + ' 계정은 ' : '계정 하나는 ') + what + '.', then: '계정 관리에서 ' + (g.login.length ? '다시 로그인합니다.' : '연결을 확인합니다.') + others, covers: [], service: g.service };
  }
  // 5. 오늘은 이 계정부터: 24시간 안에 초기화되는데 20% 넘게 남은 계정(serviceGroups의 g.today)
  const today = weekly.filter(g => g.today).sort((a, b) => a.today.g.weekly.resetsAt - b.today.g.weekly.resetsAt)[0];
  if (today) {
    const a = today.today;
    return { say: '오늘은 ' + svcName(today) + ' ' + a.name + '부터 쓰세요.', then: spoken(a.g.weekly.resetsAt, now) + '에 초기화되는데 ' + a.g.weekly.left + '%가 남았습니다.', covers: ['reset:' + a.row.id], service: today.service };
  }
  // 6. 거의 다 씀(주간 한도 10% 이하만 남은 서비스, 크레딧 부족)
  const low = groups.find(g => g.best && g.best.state === 'low' && !g.usable.some(a => a.state === 'ok'));
  if (low) {
    const name = svcName(low), b = low.best;
    if (low.kind === 'weekly') return { say: neun(name) + ' ' + b.left + '%만 남았습니다.', then: b.g?.resetsAt ? spoken(b.g.resetsAt, now) + '에 초기화됩니다.' : '', covers: [], service: low.service };
    // 충전일은 결제일이 아니라 지난 충전에서 센다(Higgsfield 30일, Typecast 한 달). 상세내역 줄과 같은 규칙(화면 검수 r2 A4)
    const refill = nextRefill(low.service, b.row, snapshot?.usage?.accounts?.[b.row.id]?.refillAt || null, now);
    return { say: name + ' 크레딧이 얼마 남지 않았습니다.', then: refill === null ? '' : (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일에 다시 찹니다.')(new Date(refill)), covers: [], service: low.service };
  }
  // 7. 48시간 안 결제
  const bills = upcoming(snapshot?.rows || [], now, snapshot?.check?.at || null, snapshot?.prices || null).filter(i => i.type === 'bill' && i.days <= 1);
  if (bills.length) {
    const same = bills.filter(b => b.days === bills[0].days), day = bills[0].days === 0 ? '오늘' : '내일';
    const names = [...new Set(same.map(b => SOLIO_TODAY_NAMES[b.row.service] || String(b.row.label || '').trim()))];
    const krw = same.reduce((n, b) => { const p = monthPrice(snapshot, b.row, now); return p && n !== null ? n + p.krw : null; }, 0);
    const svcs = [...new Set(same.map(b => b.row.service).filter(Boolean))];
    return { say: day + ' ' + joinNames(names) + ' 결제가 있습니다.', then: krw ? '모두 약 ' + fmt(krw) + '원입니다.' : '', covers: same.map(b => 'bill:' + b.row.id), service: svcs.length === 1 ? svcs[0] : undefined };
  }
  // 8. 다 쓴 계정이 있지만 급하지 않음. 「넉넉」은 쓰지 않는다(설계 4절 1). 둘째 줄은 다가오는 일의 첫 줄이 맡는다
  if (weekly.some(g => g.out.length)) return { say: '지금은 급한 일이 없습니다.', then: '', covers: [], pull: true };
  // 9. 그 밖(모두 넉넉, 기록 부족, 직접 넣은 구독만)은 지금 문장이 근거를 갖추고 있다(solio-today allSure · young)
  return fallback ? { say: fallback.say, then: fallback.then, covers: [] } : { say: '지금은 급한 일이 없습니다.', then: '', covers: [], pull: true };
}

/* 다가오는 일 한 줄의 글(설계 3.2, 설계 검토 D6) */
function soonText(item, snapshot, now, todayIds) {
  const row = item.row, svc = SOLIO_TODAY_NAMES[row.service] || String(row.label || '').trim(), who = row.source === 'auto' ? (row.email ? row.email.split('@')[0] : row.keyHint || '') : '';
  const name = [svc, who].filter(Boolean).join(' ');
  if (item.type === 'unblock') return item.focus === 'session' ? name + '의 5시간 한도가 풀립니다' : ga(name) + ' 다시 열립니다';
  if (item.type === 'reset') {
    if (item.left <= 10) return ga(name) + ' 다시 찹니다';
    if (item.left < 20) return ga(name) + ' 초기화됩니다';
    return ga(name) + ' 초기화됩니다 · 남은 ' + item.left + '%가 사라집니다' + (todayIds.has(row.id) ? ', 오늘 먼저 쓰세요' : '');
  }
  if (item.type === 'bill') {
    const p = monthPrice(snapshot, row, now);
    // 결제일에 사라지는 API 크레딧(upcoming이 결제 줄에 붙인 bill.api)도 함께 쓴다(GPT 검수 GA13)
    return name + ' 결제' + (p && p.krw > 0 ? ' · 약 ' + fmt(p.krw) + '원' : '') + (item.api > 0 ? ' · API 크레딧 $' + Number(item.api).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '가 사라집니다' : '');
  }
  if (item.type === 'pass') return svc + ' 초기화권 ' + item.count + '장이 사라집니다';
  if (item.type === 'api') return svc + ' API 크레딧 $' + Number(item.amount).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '가 사라집니다';
  if (item.type === 'flow') return 'Gemini Flow 크레딧이 다시 찹니다';
  return '';
}

/* 다가오는 일(설계 3.2): 48시간 안의 것을 시간 차례로. 첫 화면은 세 줄(shown), 상세내역은 모두(all). 48시간 안에 없으면 가장 가까운 하나. 맨 위가 말한 것은 뺀다.
   문자판은 같은 셈을 사흘(horizon)로 쓴다 */
export function briefSoon(snapshot, groups, now, covers = [], horizon = SOON_MS) {
  const skip = new Set(covers), rows = (snapshot?.rows || []).filter(r => r.state !== 'elsewhere');
  const acct = new Map(groups.flatMap(g => g.accounts.map(a => [a.row.id, a])));
  const todayIds = new Set(groups.map(g => g.today?.row?.id).filter(Boolean));
  const items = [], bills = new Map();
  for (const i of upcoming(rows, now, snapshot?.check?.at || null, snapshot?.prices || null)) {
    const key = (['unblock', 'reset', 'bill'].includes(i.type) ? i.type : i.type + '@' + i.t) + ':' + i.row.id;
    if (skip.has(key)) continue;
    const a = acct.get(i.row.id);
    if (a?.away) continue;
    // 같은 날 같은 구독의 결제는 한 줄로 묶는다(계정 열 개면 결제 줄도 열 개가 된다, 유호님 「난잡해」)
    if (i.type === 'bill') { const k = (i.row.service || i.row.label) + '|' + i.t; if (!bills.has(k)) bills.set(k, []); bills.get(k).push(i); continue; }
    const left = a?.g?.weekly && !a.g.weekly.guess ? a.g.weekly.left : a?.left ?? 0;
    const text = soonText({ ...i, left }, snapshot, now, todayIds);
    items.push({ at: i.t, when: soonWhen(i.t, now), text, key, say: spoken(i.t, now) + '에 ' + text.split(' · ')[0] + '.' });
  }
  for (const list of bills.values()) {
    const first = list[0];
    // 결제는 그날 0시로 온다. 때 칸에는 날만 쓴다(설계 검토 D6)
    const svc = SOLIO_TODAY_NAMES[first.row.service] || String(first.row.label || '').trim(), day = soonWhen(first.t, now, true);
    const prices = list.map(b => monthPrice(snapshot, b.row, now)?.krw || 0), krw = prices.every(v => v > 0) ? prices.reduce((s, v) => s + v, 0) : 0;
    if (list.length === 1) { items.push({ at: first.t, when: day, text: soonText(first, snapshot, now, todayIds), key: 'bill:' + first.row.id, say: day + ' ' + svc + ' 결제가 있습니다' + (krw ? '(약 ' + fmt(krw) + '원).' : '.') }); continue; }
    // 묶은 결제도 그날 사라지는 API 크레딧을 함께 쓴다(화면 검수 r2 A12)
    const api = list.reduce((n, b) => n + (Number(b.api) || 0), 0);
    items.push({ at: first.t, when: day, text: svc + ' 결제 ' + list.length + '건' + (krw ? ' · 약 ' + fmt(krw) + '원' : '') + (api > 0 ? ' · API 크레딧 $' + api.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '가 사라집니다' : ''), key: list.map(b => 'bill:' + b.row.id).join(','), say: day + ' ' + svc + ' 결제가 ' + list.length + '건 있습니다' + (krw ? '(약 ' + fmt(krw) + '원).' : '.') });
  }
  for (const g of groups) {
    if (g.kind !== 'weekly' || !g.service || skip.has('runout:' + g.service)) continue;
    const r = poolRunout(snapshot, g, now);
    // 30분 안에 다시 열리는 막힘은 맨 위처럼 다가오는 일에도 쓰지 않는다(GPT 검수 GA2)
    if (r && !r.beyond && r.at > now && (!r.next || r.next.t - r.at >= 30 * 60e3)) {
      const what = here(g).length === 1 ? ga(svcName(g)) + ' 바닥납니다' : svcName(g) + ' 계정이 모두 막힙니다';
      // 줄 세우는 때와 보이는 때를 같게 한다(반올림한 15:00이 14:45 일정 위에 오지 않게, 화면 검수 r2 A8)
      const at = roundHalf(r.at, now);
      items.push({ at, when: soonWhen(at, now), text: what + ' · 지금 속도면', key: 'runout:' + g.service, say: '지금 속도면 ' + whenWords(at, now, { withTime: true }) + '쯤 ' + what + '.' });
    }
  }
  items.sort((a, b) => a.at - b.at);
  const near = items.filter(i => i.at <= now + horizon);
  const all = near.length ? near : items.slice(0, 1);
  return { all, shown: all.slice(0, SOON_SHOWN), more: Math.max(0, all.length - SOON_SHOWN) };
}

/* ── 오늘 진단(설계 3.4, 설계 검토 D2 · D3 · D4) ── */
/* 4주 기록을 빈틈 없이 아는 계정(subscriptions-model fourKnown과 같은 기준) */
const fourKnown = (row, w4) => row.source === 'auto' && row.state === 'ok' && !!w4?.cover && !!w4.known && (w4.weeks || []).every(w => w.reads > 0);
function mostPlanRow(list) {
  const count = new Map();
  for (const a of list) count.set(planKey(a.row.plan), (count.get(planKey(a.row.plan)) || 0) + 1);
  const key = [...count.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  return (list.find(a => planKey(a.row.plan) === key) || list[0]).row;
}
function weeklyVerdict(snapshot, g, now) {
  const stats = snapshot?.usage?.accounts || {}, list = here(g).filter(a => a.row.source === 'auto'), n = list.length, cli = CLI_ONLY[g.service] || null;
  // 주간 창마다 한 번: 판정할 수 있는 창(끝났고 알 수 있는 창, 아직 열렸지만 이미 다 쓴 창). 초기화 하루 넘게 전에 다 썼으면 「일찍 바닥남」
  // 다 쓴 때가 두 읽기 사이 어디인지 몰라 하루 넘게 일찍인지 가를 수 없는 창은 뺀다(early < 하루 ≤ earlyMax, GPT 검수 GA6)
  const unsure = w => w.hit && w.early < DIAG.earlyMs && Number.isFinite(w.earlyMax) && w.earlyMax >= DIAG.earlyMs;
  const wins = list.flatMap(a => (stats[a.row.id]?.weeks4?.windows || []).filter(w => ((w.closed && w.known) || (!w.closed && w.hit)) && !unsure(w)));
  const early = wins.filter(w => w.hit && w.early >= DIAG.earlyMs).length;
  const r = poolRunout(snapshot, g, now);
  if (wins.length >= DIAG.minWindows && early / wins.length >= DIAG.shortShare) {
    // 하나 더 살 때의 값은 그 요금제의 공식 요금이다. 한 계정에 넣은 할인 요금을 쓰지 않는다(GPT 검수 GA11)
    const price = monthPrice(snapshot, { ...mostPlanRow(list), price: null }, now);
    // 「계정 약 n개 몫」은 모든 계정의 요금제가 같을 때만 머릿수와 견줄 수 있다(Max 20x와 Pro가 섞이면 큰 요금제 몫과 머릿수가 다르다, 화면 검수 A3)
    // 보이는 어림값이 지금 계정 수보다 클 때만 쓴다. 「약 1개 몫입니다(지금 1개)」가 되지 않게(화면 검수 r2 A3)
    const perW = r ? Math.round(r.perWeek) : 0;
    const pace = r && r.same && perW > n ? '지금 속도는 한 주에 계정 약 ' + perW + '개 몫입니다(지금 ' + n + '개).' : '';
    return { verdict: 'short', say: '지난 4주 동안 주간 한도 ' + wins.length + '번 가운데 ' + early + '번이 초기화 하루 넘게 전에 바닥났습니다.',
      more: [pace, price && price.krw > 0 ? '계정을 하나 더하면 월 약 ' + fmt(price.krw) + '원입니다.' : ''].filter(Boolean).join(' '), scope: cli ? cli.tool + ' 한도 기준' : '' };
  }
  // 「남음」은 모든 계정의 4주를 빈틈 없이 알 때만, 서비스 합의 가장 바쁜 7일로 센다(설계 검토 D3)
  // 요금제가 섞이면 줄일 계정의 몫이 계정마다 달라 머릿수로 셀 수 없다. 그때는 「남음」을 내지 않는다(화면 검수 A3)
  // 5시간 한도에 닿은 적이 있는 계정이 있으면(읽은 5시간 % 최고 90 이상) 주간이 한가해도 줄이라고 하지 않는다(GPT 검수 GA8)
  const all = list.every(a => fourKnown(a.row, stats[a.row.id]?.weeks4) && !(Number(stats[a.row.id].weeks4.hPeak) >= 90)) && new Set(list.map(a => planKey(a.row.plan))).size === 1;
  if (all && n) {
    const unit = Math.max(...list.map(a => weightOf(a.row)));
    const busiest = Math.max(...[0, 1, 2, 3].map(i => list.reduce((s, a) => { const w = stats[a.row.id].weeks4.weeks[i]; return s + (Math.min(100, Math.max(Number(w.used) || 0, Number(w.peak) || 0)) * weightOf(a.row)) / unit; }, 0)));
    const need = Math.max(1, Math.ceil(busiest / DIAG.target)), k = n - need;
    if (n >= 2 && k >= 1) {
      if (cli) return { verdict: 'spare', say: cli.tool + '로는 가장 바쁜 주에도 계정 ' + need + '개 몫만 썼습니다.', more: cli.web + '을 덜 쓴다면 계정 ' + k + '개를 줄일 수 있습니다.', scope: cli.tool + ' 한도 기준' };
      const cheap = list.map(a => monthPrice(snapshot, a.row, now)?.krw ?? null).filter(v => v !== null).sort((x, y) => x - y);
      const save = cheap.length >= k ? cheap.slice(0, k).reduce((s, v) => s + v, 0) : 0;
      return { verdict: 'spare', say: '가장 바쁜 주에도 계정 ' + need + '개 몫만 썼습니다. 계정 ' + k + '개를 줄여도 됩니다.', more: save > 0 ? '월 약 ' + fmt(save) + '원을 아낍니다.' : '', scope: '' };
    }
    if (n === 1 && busiest <= DIAG.spareOne) {
      const p = monthPrice(snapshot, list[0].row, now), money = p && p.krw > 0 ? '지금 월 약 ' + fmt(p.krw) + '원입니다.' : '';
      if (cli) return { verdict: 'spare', say: cli.tool + '로는 가장 바쁜 주에도 ' + Math.round(busiest) + '%만 썼습니다.', more: cli.web + '을 덜 쓴다면 낮은 요금제로 충분합니다. ' + money, scope: cli.tool + ' 한도 기준' };
      return { verdict: 'spare', say: '가장 바쁜 주에도 ' + Math.round(busiest) + '%만 썼습니다. 끊거나 낮은 요금제로 바꿔도 됩니다.', more: money, scope: '' };
    }
  }
  if (wins.length < DIAG.minWindows) return { verdict: 'young', say: '주간 한도 기록이 두 번 쌓이면 진단합니다.', more: '', scope: '' };
  const seen = early ? '지난 4주 동안 주간 한도 ' + wins.length + '번 가운데 ' + early + '번만 일찍 바닥났습니다.' : '지난 4주 동안 주간 한도 ' + wins.length + '번 모두 초기화 하루 전까지 남았습니다.';
  return { verdict: 'fit', say: seen + ' 지금 ' + (n > 1 ? '계정 수가' : '요금제가') + ' 알맞습니다.', more: '', scope: cli ? cli.tool + ' 한도 기준' : '' };
}
function creditVerdict(snapshot, g) {
  const stats = snapshot?.usage?.accounts || {}, list = here(g).filter(a => a.row.source === 'auto');
  let spent = 0, allot = 0, counted = 0;
  for (const a of list) {
    const w4 = stats[a.row.id]?.weeks4, m = monthCredits(snapshot?.prices, a.row);
    // 한 달 크레딧을 어림하는 계정(Higgsfield Ultra)은 셀 수 없다(설계 검토 D12)
    if (!fourKnown(a.row, w4) || !m || ultraGuess(a.row, m)) continue;
    counted++; spent += w4.weeks.reduce((n, w) => n + (Number(w.used) || 0), 0); allot += m.credits * (28 / (365.25 / 12));
  }
  // 이 PC 계정을 모두 셀 수 있을 때만 서비스 전체를 진단한다. 일부만 세고 「끊어도 됩니다」를 말하지 않는다(GPT 검수 GA10)
  if (!counted || counted < list.length || !(allot > 0)) return { verdict: 'young', say: '모든 계정의 4주 기록과 한 달 크레딧을 알면 진단합니다.', more: '', scope: '' };
  // 4주 동안 쓴 양을 한 달로 늘려 한 달 크레딧과 견준다. 「지난 4주 동안 n%를 썼다」가 아니라 「지금 속도면 한 달에 n%」다(GPT 검수 GA9)
  const pct = Math.round((spent / allot) * 100), pace = '지금 속도면 한 달에 크레딧의 ' + pct + '%를 씁니다.';
  if (spent / allot >= DIAG.creditShort) return { verdict: 'short', say: pace, more: '크레딧이 모자랍니다.', scope: '' };
  if (spent / allot <= DIAG.creditSpare) return { verdict: 'spare', say: pace, more: '끊거나 낮은 요금제로 바꿔도 됩니다.', scope: '' };
  return { verdict: 'fit', say: pace + ' 지금 요금제가 알맞습니다.', more: '', scope: '' };
}

/* 오늘 진단. 회원이 고른 목표가 「아끼기」(save)면 남음을, 그 밖에는 모자람을 앞에 둔다 */
export function briefDiag(snapshot, groups, now) {
  const items = groups.filter(g => g.service).map(g => ({ key: g.service, name: svcName(g), ...(g.kind === 'credit' ? creditVerdict(snapshot, g) : weeklyVerdict(snapshot, g, now)) }));
  const rank = snapshot?.settings?.goal === 'save' ? { spare: 0, short: 1, fit: 2, young: 3 } : { short: 0, spare: 1, fit: 2, young: 3 };
  items.sort((a, b) => rank[a.verdict] - rank[b.verdict]);
  for (const i of items) {
    i.word = VERDICT_WORD[i.verdict];
    // 첫 화면 한 줄(설계 검토 D11, 화면 검수 A5): 할 일이 담긴 문장을 고른다. 근거 문장은 상세내역에 둔다.
    // CLI 한도만 보는 「남음」은 범위의 단서가 할 일이라 두 문장을 함께 쓴다
    i.line = i.verdict === 'short' && i.more ? i.more : i.verdict === 'spare' && i.scope ? i.say + ' ' + i.more : i.say;
  }
  // 직접 넣은 구독은 쓴 양을 읽지 못한다. 요금을 알면 함께 적는다
  // 묶음(serviceGroups)은 한도형과 크레딧형만 담는다. 월정액만 넣은 구독(Grok Ultra 같은)도 여기서 같이 센다
  const manual = (snapshot?.rows || []).filter(r => r.source !== 'auto').map(r => ({ name: String(r.label || '').trim() || '직접 넣은 구독', krw: monthPrice(snapshot, r, now)?.krw || 0 }));
  const priced = manual.filter(m => m.krw > 0);
  const manualSay = manual.length ? neun(joinNames(manual.map(m => m.name))) + ' 쓴 양을 읽지 못해 진단에서 뺐습니다' + (priced.length ? '(' + priced.map(m => (manual.length > 1 ? m.name + ' ' : '') + '월 ' + fmt(m.krw) + '원').join(', ') + ').' : '.') : '';
  return { items, manual: manualSay, cost: costLine(snapshot, now) };
}
/* 한 달 구독료 한 줄. 진단과 달리 하루 한 번 기억하지 않고 늘 지금 요금과 환율로 센다(상세내역 요금 줄과 같은 값, GPT 검수 GA12) */
export function costLine(snapshot, now) {
  const rows = snapshot?.rows || [], cost = rows.length ? costOf(snapshot, rows, now) : null;
  return cost && cost.count ? '한 달 구독료 ' + (cost.usd > 0 ? '약 ' : '') + fmt(cost.approx) + '원' + (cost.unknown ? ' · 요금을 모르는 ' + cost.unknown + '개 빼고' : '') : '';
}
/* 진단을 다시 셀지 정하는 열쇠: 계정과 요금제, 넣은 요금, 목표(설계 검토 D10) */
/* 계정의 상태(다시 로그인, 못 읽음, 처음 읽기 전)가 풀리면 그날 안에서도 다시 센다(화면 검수 A9) */
export const diagKey = snapshot => [snapshot?.settings?.goal || '', snapshot?.settings?.usdKrw ?? '', ...(snapshot?.rows || []).map(r => [r.id, planKey(r.plan), r.price ?? '', r.currency || '', r.cycle || '', r.state || '', r.live?.readAt ? 'read' : ''].join(':')).sort()].join('|');
/* 하루 한 번(설계 검토 D10): 그날 처음 읽은 자료(check.at이 오늘)로 센 진단을 그날 동안 쓴다.
   오늘 아직 읽지 않았으면 앞 진단을 그대로 두고, 앞 진단이 없을 때만 지금 자료로 센다. memo는 컨트롤러가 들고 있다 */
export function dailyDiag(memo, snapshot, groups, now) {
  const at = snapshot?.check?.at || null, key = diagKey(snapshot);
  const readToday = at !== null && tokenDay(at) === tokenDay(now);
  if (memo?.diag && memo.key === key && (memo.day === tokenDay(now) || !readToday)) return memo;
  return { day: readToday ? tokenDay(now) : null, key, at, diag: briefDiag(snapshot, groups, now) };
}
/* 진단 제목 옆의 때: 「오늘 07:12에 읽은 기록으로」, 「어제 23:40에 읽은 기록으로」 */
export function diagWhen(at, now) {
  if (!at) return '';
  const d = new Date(at), days = daysBetween(at, now);
  const day = days === 0 ? '오늘' : days === -1 ? '어제' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  return day + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '에 읽은 기록으로';
}

/* ── 지금 출력(설계 3.3, 설계 검토 D7 · D8) ── */
/* 오늘 출력 토큰 합과 도구마다의 몫 */
export function todayOut(tokens, now) {
  const day = tokenDay(now), by = {};
  let out = 0;
  for (const r of Array.isArray(tokens?.cells) ? tokens.cells : []) {
    if (!Array.isArray(r) || r[0] !== day) continue;
    const v = Number(r[4]) || 0;
    out += v; by[r[1]] = (by[r[1]] || 0) + v;
  }
  return { day, out, by };
}
/* 실시간으로 받은 오늘 합계를 (때, 값)으로 15분까지 기억한다. 세는 중이거나 다 훑은 셈(scannedAt)이 바뀐 알림, 날이 바뀐 알림은
   그 사이 밀린 몫이 섞이므로 기억을 비우고 그 값을 새 바닥으로 삼는다. 돌려주는 값은 새 기억(바꾸지 않은 배열은 그대로) */
export function tokSample(samples, tokens, prev, now) {
  if (!tokens || tokens.enabled !== true) return [];
  const t = todayOut(tokens, now), list = samples || [], last = list[list.length - 1];
  // 처음 세는 중(scannedAt 없음)이거나 날이 바뀌면 새로 센다. 15분마다의 다시 세기(scanning)는 기억을 그대로 둔다(Fable 최종 F3)
  if (!last || last.day !== t.day || (tokens.scanning && !tokens.scannedAt)) return [{ t: now, day: t.day, out: t.out }];
  if (tokens.scanning) return list;
  // 다 훑은 셈(5분마다)이 바뀐 알림은 그 사이 밀린 몫을 담는다. 기억을 비우지 않고 앞 값들을 그만큼 올려 잇는다.
  // 비우면 10분 넘게 켜 둔 방이 셈마다 「쉬는 중」으로 떨어졌다(화면 검수 A4). 밀린 몫은 최근 10분에 넣지 않는다(적게 잡는 쪽)
  // 마지막 하나는 오래돼도 남긴다(10분 넘게 조용했어도 바닥이 있어야 「쉬는 중」을 말한다)
  // 15분보다 오래된 기억은 지우되 그 가운데 가장 늦은 하나는 바닥으로 남긴다. 오래 쉬다 다시 쓰면 10분 전 값이 그것이다(GPT 검수 GA14)
  const old = list.filter(s => s.t < now - KEEP_MS), kept = list.filter(s => s.t >= now - KEEP_MS), base = old.length ? [old[old.length - 1], ...kept] : kept.length ? kept : [last];
  // 셈이 바뀐 알림도 같은 바닥을 남긴 채 올려 잇는다(화면 검수 r2 A10)
  if (prev && prev.scannedAt !== tokens.scannedAt) { const shift = t.out - last.out; return base.map(s => ({ ...s, out: s.out + shift })); }
  return last.out === t.out ? base : [...base, { t: now, day: t.day, out: t.out }];
}
/* 최근 10분의 출력: 10분 전 값과의 차이. 기억한 지 10분이 안 됐으면 처음 기억한 값과의 차이(partial) */
export function recentOut(samples, now) {
  // 자정을 넘긴 기억(어제 밤 값)은 오늘 차이에 섞지 않는다(화면 검수 r2 A11)
  const day = tokenDay(now), list = (samples || []).filter(s => s.day === day);
  if (!list.length) return null;
  const last = list[list.length - 1], before = list.filter(s => s.t <= now - RECENT_MS);
  const base = before.length ? before[before.length - 1] : list[0];
  return { delta: Math.max(0, last.out - base.out), partial: !before.length };
}
/* 지금 출력 줄 하나. state: off · first · error · on. 최근 10분은 기억(samples)만으로 센다: 10분 전 기억이 없으면 「방금부터」 */
export function briefLive(tokens, samples, now) {
  if (!tokens) return null;
  if (tokens.enabled !== true) return { state: 'off', big: '', unit: '', small: '토큰 세기가 꺼져 있습니다.' };
  if (!tokens.scannedAt && tokens.scanning) {
    const p = tokens.progress, part = p && Number.isFinite(p.done) && Number.isFinite(p.total) ? ' ' + fmt(p.done) + '/' + fmt(p.total) : '';
    return { state: 'first', big: '', unit: '', small: '처음 세는 중입니다.' + part };
  }
  if (!tokens.scannedAt && tokens.error) return { state: 'error', big: '', unit: '', small: '세다가 멈췄습니다.' };
  const t = todayOut(tokens, now), r = recentOut(samples, now);
  const top = Object.entries(t.by).sort((a, b) => b[1] - a[1])[0];
  const share = top && t.out > 0 ? (TOOL_NAME[top[0]] || top[0]) + ' ' + Math.round((top[1] / t.out) * 100) + '%' : '';
  // 기억한 지 10분이 안 됐으면 「방금부터」다. 10분 넘게 늘지 않았으면 쉬는 중이다
  const recent = !r ? '' : r.partial ? (r.delta > 0 ? '방금부터 ' + tokenText(r.delta) : '') : r.delta > 0 ? '최근 10분 ' + tokenText(r.delta) : '최근 10분은 쉬는 중';
  return { state: 'on', big: tokenText(t.out), unit: '오늘 출력 토큰', small: [recent, share].filter(Boolean).join(' · '), out: t.out };
}

/* ── 문자판(11-20 유호님이 고르신 A, 설계 10절) ──
   구를 가운데 둔 사흘짜리 시계판의 자료. DOM이 없다. 때는 모두 지금부터의 거리(ms)다.
   rings: 이 PC 계정이 읽히는 구독마다 계정 칸(left 0~100, 읽지 못한 계정은 null).
   hero: 가운데 구독(맨 위가 말한 구독, 없으면 계정이 가장 많은 한도형 구독)의 큰 숫자.
   arcs: 바깥 궤도의 구간들(from · to, k: safe 막히지 않음 · gap 모두 막힘 · after 그 뒤나 모름). 지금 모두 막혀 있으면 첫 다시 열림까지 gap부터다.
   ticks · days · events: 바깥 눈금(한 시간마다, 여섯 시간마다, 자정), 날 이름, 다가오는 일 표식 */
const weeklyLeft = a => Math.max(0, Math.min(100, Math.round(a.g?.weekly && !a.g.weekly.guess ? a.g.weekly.left : a.left ?? 0)));
/* 칸의 남은 양(0~100, 모르면 null). 주간 한도를 다 쓴 계정은 0, 5시간 한도로 잠깐 막힌 계정은 주간 남은 양(Fable 최종 P2),
   크레딧형은 남은 크레딧 ÷ 한 달 크레딧(상세내역 줄과 같은 셈, Fable 최종 P1) */
function cellLeft(a, prices) {
  if (a.row.kind === 'credit') {
    if (!['ok', 'low'].includes(a.state)) return null;
    const b = balance(a.row), allot = monthCredits(prices, a.row);
    return b && allot?.credits > 0 ? Math.max(0, Math.min(100, Math.floor((b.value / allot.credits) * 100))) : null;
  }
  if (a.state === 'out') return a.focus === 'session' && a.g?.weekly && !a.g.weekly.guess ? weeklyLeft(a) : 0;
  return ['ok', 'low'].includes(a.state) ? weeklyLeft(a) : null;
}
/* 칸에 다가가면 뜨는 글 */
function cellNote(a, left) {
  if (a.state === 'out') return a.focus === 'session' ? '5시간 한도로 막힘' + (left > 0 ? ' · 주간 ' + left + '% 남음' : '') : '다 씀';
  if (a.state === 'needs-login' || a.state === 'login') return '다시 로그인';
  if (a.state === 'error') return '못 읽음';
  if (left === null) { const b = a.row.kind === 'credit' ? balance(a.row) : null; return b ? fmt(b.value) + ' 크레딧' : '읽는 중'; }
  return left + '% 남음';
}
const KIND = Object.freeze({ unblock: 'open', reset: 'reset', bill: 'bill', runout: 'runout' });
export function briefDial(snapshot, groups, now, focusService = null) {
  const auto = groups.filter(g => g.service && here(g).some(a => a.row.source === 'auto'));
  const weekly = auto.filter(g => g.kind === 'weekly');
  // 맨 위가 말한 구독(한도형이든 크레딧형이든)을 먼저 찾는다(화면 검수 dial A6)
  const focus = auto.find(g => g.service === focusService) || [...weekly].sort((a, b) => here(b).length - here(a).length || (b.service === 'claude') - (a.service === 'claude'))[0] || auto[0];
  if (!focus) return null;
  const prices = snapshot?.prices || null;
  const rings = auto.map(g => ({ key: g.service, name: svcName(g), focus: g === focus, accounts: here(g).filter(a => a.row.source === 'auto').map(a => { const left = cellLeft(a, prices); return { id: a.row.id, name: a.name || '', state: a.state, left, blocked: a.state === 'out', note: cellNote(a, left) }; }) }));
  // 큰 숫자: 계정 여럿은 합친 몫(무게를 아는 Claude나 요금제가 같을 때), 섞인 요금제는 열린 계정 수, 하나는 그 계정의 남은 양.
  // 크레딧형은 남은 크레딧 ÷ 한 달 크레딧, 한 달 양을 모르면 남은 크레딧 수다(Fable 최종 P1)
  const list = here(focus).filter(a => a.row.source === 'auto'), name = svcName(focus), read = list.filter(a => ['ok', 'low', 'out'].includes(a.state));
  const pooled = focus.service === 'claude' || new Set(list.map(a => planKey(a.row.plan))).size === 1;
  const lefts = read.map(a => ({ a, v: cellLeft(a, prices) })), known = lefts.filter(x => x.v !== null);
  const login = list.some(a => focus.login.includes(a)), broken = list.some(a => focus.error.includes(a));
  let hero;
  // 읽힌 계정이 없으면 까닭을 가른다. 다시 로그인이나 못 읽음을 「읽는 중」이라 하지 않는다(Fable 최종 P1)
  if (!read.length) hero = { value: '–', unit: '', label: name + (login ? ' 다시 로그인 필요' : broken ? ' 읽지 못함' : ' 읽는 중') };
  else if (focus.kind === 'credit' && !known.length) hero = { value: fmt(read.reduce((n, a) => n + (balance(a.row)?.value || 0), 0)), unit: '', label: name + ' 남은 크레딧' };
  else if (list.length === 1 || focus.kind === 'credit') hero = { value: String(Math.floor(known.reduce((n, x) => n + x.v, 0) / Math.max(1, known.length))), unit: '%', label: name + ' 남은 양' };
  else if (pooled) { const w = known.reduce((n, x) => n + weightOf(x.a.row), 0); hero = { value: String(w ? Math.floor(known.reduce((n, x) => n + x.v * weightOf(x.a.row), 0) / w) : 0), unit: '%', label: name + ' 남은 몫' }; }
  else hero = { value: String(read.filter(a => a.state !== 'out').length), unit: '/' + list.length, label: name + ' 열린 계정' };
  const end = now + DIAL_MS, ticks = [];
  for (let t = Math.ceil(now / HOUR) * HOUR; t < end; t += HOUR) { const h = new Date(t).getHours(); ticks.push({ off: t - now, k: h === 0 ? 'day' : h % 6 === 0 ? 'six' : 'hour' }); }
  // 자정이 「지금」이나 사흘 끝에서 한 시간 반 안이면 날 이름이 「지금」과 겹친다. 그 자정은 눈금만 남긴다(화면 검수 dial A4)
  const NEAR = 1.5 * HOUR;
  const days = [{ off: 0, label: '지금' }, ...ticks.filter(k => k.k === 'day' && k.off > NEAR && k.off < DIAL_MS - NEAR).map(k => ({ off: k.off, label: soonWhen(now + k.off, now, true) }))];
  const r = focus.kind === 'weekly' ? poolRunout(snapshot, focus, now) : null;
  // 맨 위 구독의 막힘 표식은 궤도와 같은 때(반올림 전)에 찍는다. 글(title)은 반올림한 때 그대로다(화면 검수 dial A5)
  const events = briefSoon(snapshot, groups, now, [], DIAL_MS).all.filter(i => i.at > now && i.at <= end)
    .map(i => ({ off: i.key === 'runout:' + focus.service && r && r.at > now ? r.at - now : i.at - now, kind: KIND[i.key.split(':')[0]] || 'other', text: i.when + ' ' + i.text }));
  const open = read.filter(a => a.state !== 'out').length;
  // 바깥 궤도. 지금 모두 막혀 있으면 첫 다시 열림까지가 붉다. 30분 안에 열리는 막힘도 지금 막힌 것이라 그린다(화면 검수 dial A2)
  const firstOpen = open || !read.length ? null : Math.min(...read.map(a => (a.unblock && a.unblock > now ? a.unblock : Infinity)));
  const arcs = [], add = (from, to, k) => { const a = Math.max(0, from), b = Math.min(DIAL_MS, to); if (b > a) arcs.push({ from: a, to: b, k }); };
  let start = 0;
  if (read.length && !open) { const t = Number.isFinite(firstOpen) ? firstOpen - now : DIAL_MS; add(0, t, 'gap'); start = t; }
  if (r) {
    const at = r.beyond ? Infinity : r.at - now, back = r.next ? r.next.t - now : DIAL_MS;
    add(start, at, 'safe');
    if (at < DIAL_MS) { add(Math.max(start, at), back, 'gap'); add(back, DIAL_MS, 'after'); }
  } else add(start, DIAL_MS, 'after');
  // 낭독 이름. 읽는 중에는 열린 계정 수를 단정하지 않고, 지금 모두 막혔으면 예측 대신 첫 다시 열림을 말한다(화면 검수 dial A2)
  const reopenWords = Number.isFinite(firstOpen) ? ' ' + spoken(firstOpen, now) + '에 처음 다시 열립니다.' : '';
  // 계정이 하나면 「1개 가운데 1개」가 아니라 「Codex는 열려 있습니다」, 「바닥납니다」로 말한다
  const one = list.length === 1;
  // 다시 로그인하거나 못 읽은 계정을 막힌 계정으로 세지 않는다. 맨 위(fixSay)와 같은 말로 나눈다(Fable 최종 P2)
  const label = !read.length ? (login ? name + ' 계정은 다시 로그인해야 합니다.' : broken ? name + ' 계정을 읽지 못했습니다.' : name + ' 계정을 읽는 중입니다.')
    : !open ? (read.length < list.length && (login || broken) ? fixSay(focus) : one ? neun(name) + ' 막혀 있습니다.' : name + ' 계정 ' + read.length + '개가 모두 막혀 있습니다.') + reopenWords
    : [one ? neun(name) + ' 열려 있습니다.' : name + ' 계정 ' + list.length + '개 가운데 ' + open + '개가 열려 있습니다.', hero.unit === '%' ? hero.label + ' ' + hero.value + '%.' : '',
      r && !r.beyond && r.at > now && r.at < end ? '지금 속도면 ' + whenWords(roundHalf(r.at, now), now, { withTime: true }) + '쯤 ' + (one ? '바닥납니다.' : '모두 막힙니다.') : r ? '지금 속도면 사흘 안에는 막히지 않습니다.' : ''].filter(Boolean).join(' ');
  return { span: DIAL_MS, focus: focus.service, hero, rings, arcs, ticks, days, events, label };
}

/* 스냅숏에서 나오는 판(맨 위, 다가오는 일, 진단, 줄 안쪽 결론). 지금 출력은 따로 붙인다(briefLive).
   today는 solioToday의 결과다. ready일 때만 맨 위를 바꾼다. 줄을 접을지(fold)는 상태로 정한다(설계 검토 D9) */
const FOLD = new Set(['ready', 'stale', 'rereading', 'projected', 'first']);
export function solioBrief({ today, snapshot, memo = null } = {}, now = Date.now()) {
  if (!today || !snapshot || !FOLD.has(today.state) || !(today.rows && today.rows.length)) return null;
  if (today.state !== 'ready') return { fold: true, head: null, soon: null, diag: null, says: {}, memo };
  const groups = briefGroups(snapshot, now);
  // 직접 넣은 구독만 있으면 읽을 것이 없고 맨 위 문장이 「아래 줄」을 가리킨다. 접지 않고 줄을 그대로 보인다(Fable 최종 F4)
  if (!groups.some(g => g.service)) return null;
  const head = briefHead(snapshot, groups, now, today);
  const soon = briefSoon(snapshot, groups, now, head.covers);
  const next = dailyDiag(memo, snapshot, groups, now);
  // 할 일이 없는 맨 위(「지금은 급한 일이 없습니다」)만 둘째 줄을 다가오는 일의 첫 줄로 채운다. 그 줄은 다가오는 일에서 뺀다.
  // 다른 갈래의 빈 둘째 줄에 다른 구독의 일정을 섞지 않는다(화면 검수 r2 A7)
  let then = head.then, list = soon;
  if (!then && head.pull && soon.all.length) {
    // 표 조각이 아니라 문장으로 쓴다(화면 검수 A7). 「지금 속도면」으로 시작하는 줄에는 「가장 먼저」를 붙이지 않는다
    const first = soon.all[0];
    then = first.key.startsWith('runout:') ? first.say : '가장 먼저 ' + first.say;
    const rest = soon.all.slice(1);
    list = { all: rest, shown: rest.slice(0, SOON_SHOWN), more: Math.max(0, rest.length - SOON_SHOWN) };
  }
  const says = Object.fromEntries(groups.filter(g => g.service).map(g => [g.key, poolSay(snapshot, g, now)]).filter(([, s]) => s));
  return { fold: true, head: { say: head.say, then }, soon: list, diag: { ...next.diag, cost: costLine(snapshot, now), when: diagWhen(next.at, now) }, dial: briefDial(snapshot, groups, now, head.service || null), says, memo: next };
}
