// 솔리오 첫 화면(PC 클라이언트 1단계, 2026-11-16)의 맨 위 문장과 구독별 줄을 구독 스냅숏에서 만든다. DOM이 없다.
// 규칙의 원문은 docs/디자인/플랫폼_클라이언트_검정구_20261116/1단계_구현설계.md 8절이다. 셈은 subscriptions-model.mjs를 그대로 쓰고,
// 새로 세는 것은 「쓰는 속도를 셀 기록이 사흘 안 됐는지」(rate3가 없는 계정이 있는지) 하나뿐이다.
import { serviceGroups, paceTip, balance, monthCredits, nextBill, freshness, DAY_MS, usageDays, monthPrice, costOf, monthlyBill, nextRefill, planKey } from './subscriptions-model.mjs';

/* 서비스의 짧은 이름은 이 표 한 곳에서만 읽는다(문장 · 줄 · 화면 읽기 프로그램의 글). gpt 줄의 남은 양은 Codex가 알려 주는 한도다 */
export const SOLIO_TODAY_NAMES = Object.freeze({ claude: 'Claude', gpt: 'Codex', gemini: 'Gemini', higgsfield: 'Higgsfield', typecast: 'Typecast' });
const MANUAL_NAME = '직접 넣은 구독';
const LONG_STALE_MS = 6 * 3600e3; // 이보다 오래된 값으로는 막히는 때를 말하지 않는다(옮기기 설계 「정한 것」 9의 최대 6시간)
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const pad = n => String(n).padStart(2, '0');
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (t, now) => Math.round((dayStart(t) - dayStart(now)) / DAY_MS);
/* now가 속한 날의 n일 뒤 0시. 24시간을 곱해 더하지 않는다. 서머타임이 끝나는 날(25시간)이 끼면 하루 앞선 날이 나왔다(0.4.95 원천 후보 검수 E5) */
const dayAfter = (now, n) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const partOf = h => (h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤');
const fmt = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');

/* 받침이 있으면 true(한글 끝 글자만 본다. 영문 이름은 모음으로 끝난다고 본다) */
function hasBatchim(word) {
  const ch = String(word || '').trim().slice(-1), code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
}
export const josa = (word, pair) => word + (hasBatchim(word) ? pair[0] : pair[1]);
const ga = w => josa(w, ['이', '가']), neun = w => josa(w, ['은', '는']), wa = w => josa(w, ['과', '와']), do_ = w => w + '도';
/* 이름 여럿을 잇는다: 「Claude와 Gemini」, 「Claude, Gemini와 Higgsfield」 */
export function joinNames(list) {
  const names = list.filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  return names.slice(0, -2).map(n => n + ', ').join('') + wa(names[names.length - 2]) + ' ' + names[names.length - 1];
}

/* 문장 안의 때: 1시간 안이면 「N분 뒤」, 같은 날 「오늘 오후」, 「내일 오전」, 「모레 밤」, 7일 안 「토요일 오후」, 그 뒤 「12월 3일」.
   withTime이면 시각을 붙인다(「토요일 오후 2시」, 「내일 오전 9시 30분」) */
export function whenWords(t, now, { withTime = false } = {}) {
  const ms = t - now;
  // 이미 지난 때는 「1분 뒤」로 읽지 않고 날과 때로 적는다(줄 안의 shortWhen과 같은 기준). 1시간 안은 59분을 넘기지 않는다(0.4.95 원천 후보 검수)
  if (ms > 0 && ms < 3600e3) return Math.min(59, Math.max(1, Math.round(ms / 60e3))) + '분 뒤';
  const d = new Date(t), days = daysBetween(t, now), h = d.getHours(), m = d.getMinutes();
  const hour = h === 0 ? 0 : h % 12 === 0 ? 12 : h % 12; // 새벽 0시 · 오후 12시 · 오후 1시
  const time = withTime ? ' ' + hour + '시' + (m ? ' ' + m + '분' : '') : '';
  // 날이 바뀐 지난 때는 요일이 아니라 날짜로 적는다. 자정을 넘겨 어제가 된 때가 「일요일 밤」처럼 다가올 날로 읽혔다. 같은 날 지난 때는 「오늘」이다(0.4.95 다시 검수 FA2)
  if (ms <= 0 && days < 0) return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + partOf(h) + time;
  if (days >= 7) return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  const day = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : WEEKDAY[d.getDay()] + '요일';
  return day + ' ' + partOf(h) + time;
}
/* 줄 안의 때: 7일 안이면 「목 09:00」, 그 뒤 「12월 3일」 */
export function shortWhen(t, now) {
  const d = new Date(t);
  return daysBetween(t, now) >= 7 || t < now ? (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : WEEKDAY[d.getDay()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
/* 화면 읽기 프로그램에 읽히는 때: 「목요일 오전 9시」 */
const spokenWhen = (t, now) => whenWords(t, now, { withTime: true });

/* 읽은 때 한 줄 */
export function readLine(checkAt, now, checking) {
  // 한 번도 읽지 않았으면 「처음 읽고 있습니다」다. 맨 위 문장과 줄 문구와 맞춘다(0.4.95 원천 후보 검수 E2)
  if (checking) return checkAt ? '다시 읽고 있습니다.' : '처음 읽고 있습니다.';
  if (!checkAt) return '';
  const age = Math.max(0, now - checkAt);
  if (age < 2 * 60e3) return '방금 읽은 값입니다.';
  if (age < 3600e3) return Math.floor(age / 60e3) + '분 전에 읽은 값입니다.';
  if (age < DAY_MS) return Math.floor(age / 3600e3) + '시간 전에 읽은 값입니다.';
  return Math.floor(age / DAY_MS) + '일 전에 읽은 값입니다.';
}

const groupName = g => (g.service && SOLIO_TODAY_NAMES[g.service]) || String(g.label || '').trim() || MANUAL_NAME;
const here = g => g.accounts.filter(a => !a.away);

/* 들어올 때 스스로 한 번 다시 읽을지: 한 번도 안 읽었거나, 1시간이 넘었거나, 초기화가 지나 「다시 찼을 것」인 계정이 있으면 */
export function solioTodayNeedsReread(snapshot, now) {
  if (!snapshot?.ok) return false;
  const rows = snapshot.rows || [], autos = rows.filter(r => r.source === 'auto');
  if (!autos.length) return false;
  const checkAt = snapshot.check?.at || null;
  if (!checkAt || freshness(checkAt, now) === 'stale') return true;
  return serviceGroups(rows, now, checkAt).some(g => g.projected.length > 0);
}

function weeklyFact(snapshot, g, now) {
  const stats = snapshot?.usage?.accounts || {}, usable = g.usable.filter(a => a.g?.weekly);
  if (!usable.length && !g.projected.length && g.out.length) return { kind: 'out', at: g.out[0].unblock, focus: g.out[0].focus || 'weekly' };
  if (!usable.length) return { kind: 'unknown' };
  const pace = paceTip(snapshot, g, now);
  if (pace) return { kind: 'pace', at: pace.at, release: pace.release };
  const best = g.best;
  if (best && (best.state === 'low' || best.state === 'out')) return { kind: 'low', left: best.left, at: best.g?.resetsAt || null };
  // 「기록이 아직 쌓이지 않았다」는 읽은 계정의 기록이 정말 모자랄 때만이다. 다른 계정이 초기화 시각을 지나 다시 찼을 것이라는 것은
  // 기록 부족이 아니다. 그 묶음은 「모든 구독이 넉넉합니다」에서만 빠진다(allSure, 0.4.95 원천 후보 검수 E1)
  const young = usable.some(a => a.g.weekly.guess || !Number.isFinite(stats[a.row.id]?.rate3));
  return young ? { kind: 'young' } : { kind: 'fine', reset: Math.min(...usable.map(a => a.g.weekly.resetsAt).filter(Boolean)) };
}

function rowOf(snapshot, g, fact, now, checking) {
  const name = groupName(g), count = here(g).length, best = g.best, row = { key: g.key, name, sub: count > 1 ? '계정 ' + count + '개' : '', gauge: null, val: '', when: '', spoken: '', urgent: false };
  const prices = snapshot?.prices || null;
  if (g.kind === 'weekly') {
    if (fact?.kind === 'out') {
      Object.assign(row, { val: '다 씀', gauge: 0, when: fact.at ? shortWhen(fact.at, now) + '에 다시 열림' : '', urgent: true });
      row.spoken = fact.at ? spokenWhen(fact.at, now) + '에 다시 열림' : '';
    } else if (best && best.g && !best.projected && (best.state === 'ok' || best.state === 'low')) {
      const at = best.g.resetsAt;
      Object.assign(row, { val: best.left + '% 남음', gauge: best.left, when: at ? shortWhen(at, now) + ' 초기화' : '', urgent: fact?.kind === 'pace' || best.state === 'low' });
      row.spoken = at ? spokenWhen(at, now) + ' 초기화' : '';
    } else if (g.projected.length) {
      Object.assign(row, { val: '다시 찼을 것', when: checking ? '다시 읽고 있습니다' : '다시 읽으면 확인됩니다' });
    } else if (g.login.length) {
      Object.assign(row, { val: '다시 로그인', when: '계정 관리에서 다시 로그인합니다' });
    } else if (g.error.length) {
      Object.assign(row, { val: '못 읽음', when: '계정 관리에서 연결을 확인합니다' });
    } else if (g.pending.length) {
      Object.assign(row, { val: '읽기 전', when: checking ? '읽고 있습니다' : '' });
    } else {
      const r = best?.row || g.accounts[0]?.row || {};
      const reset = r.resetDay !== null && r.resetDay !== undefined && r.resetDay !== '' ? '매주 ' + WEEKDAY[Number(r.resetDay)] + ' ' + pad(r.resetHour || 0) + ':' + pad(r.resetMinute || 0) + ' 초기화' : '';
      Object.assign(row, { val: '직접 기록', when: reset || (r.billDay ? '매월 ' + r.billDay + '일 결제' : '') });
    }
  } else if (!(best && (best.state === 'ok' || best.state === 'low')) && (g.login.length || g.error.length)) {
    // 다시 로그인해야 하거나 못 읽은 크레딧형은 남은 옛 잔액을 정상처럼 보이지 않는다(최종 검수)
    Object.assign(row, { val: g.login.length ? '다시 로그인' : '못 읽음', when: g.login.length ? '계정 관리에서 다시 로그인합니다' : '계정 관리에서 연결을 확인합니다' });
  } else {
    const a = best || g.accounts[0], b = a ? balance(a.row) : null, allot = a ? monthCredits(prices, a.row) : null;
    const bill = a?.row?.billDay ? nextBill(a.row.billDay, now) : null;
    const billText = bill === null ? '' : (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일 결제')(new Date(dayAfter(now, bill)));
    if (b) {
      const pct = allot?.credits > 0 ? Math.max(0, Math.min(100, Math.floor((b.value / allot.credits) * 100))) : null;
      row.val = pct === null ? fmt(b.value) + ' 크레딧' : pct + '% 남음';
      row.gauge = pct;
      row.when = [pct === null ? '' : fmt(b.value) + ' / ' + fmt(allot.credits) + ' 크레딧', billText].filter(Boolean).join(' · ');
      row.urgent = a.state === 'low';
    } else {
      row.val = a?.state === 'login' ? '다시 로그인' : a?.state === 'error' ? '못 읽음' : a?.state === 'unknown' ? '읽기 전' : '직접 기록';
      row.when = billText;
    }
  }
  if (!row.spoken) row.spoken = row.when;
  row.label = [row.name, row.sub, row.val, row.spoken].filter(Boolean).join(', ') + '. 누르면 자세히 펼칩니다.';
  row.more = moreOf(snapshot, g, fact, now);
  return row;
}

/* ── 줄 안쪽(2단계 첫 조각, 2단계_첫조각_구현설계.md 2.2절). 자료가 없는 줄은 예시 값으로 채우지 않고 뺀다.
   돌려주는 값: { say 결론 한 문장, fix 손볼 계정 줄들, accounts 계정마다(이 PC 계정이 둘 이상일 때), week 지난 7일, cost 요금, empty 사실이 없을 때의 까닭 } ── */
const NO_RECORD = '아직 기록이 모이지 않았습니다. 하루쯤 지나면 지난 7일이 보입니다.';
const MANUAL_EMPTY = '직접 넣은 구독이라 남은 양을 읽지 않습니다.';
const dateWords = t => (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(t));

/* 서비스 하나의 결론 문장. 한도형은 weeklyFact의 갈래로, 크레딧형은 잔액 · 하루 속도 · 다음 충전이 모두 있을 때만 쓴다(설계 검토 1차 11) */
function moreSay(snapshot, g, fact, now) {
  const name = groupName(g);
  if (g.kind === 'weekly') {
    if (!fact) return '';
    if (fact.kind === 'out') return neun(name) + ' ' + (fact.focus === 'session' ? '5시간 한도' : '이번 주 한도') + '를 다 썼습니다.' + (fact.at ? ' ' + spokenWhen(fact.at, now) + '에 다시 열립니다.' : '');
    if (fact.kind === 'pace') return ga(name) + ' ' + whenWords(fact.at, now) + '에 바닥납니다.' + (fact.release ? ' ' + spokenWhen(fact.release, now) + '에 다시 찹니다.' : '');
    if (fact.kind === 'low') return neun(name) + ' ' + fact.left + '%만 남았습니다.' + (fact.at ? ' ' + spokenWhen(fact.at, now) + '에 초기화됩니다.' : '');
    if (fact.kind === 'young') return neun(name) + ' 사흘쯤 쓰면 언제 바닥날지 미리 알려 드립니다.';
    if (fact.kind === 'fine') return neun(name) + ' 이번 주 내내 넉넉합니다.' + (Number.isFinite(fact.reset) ? ' ' + spokenWhen(fact.reset, now) + '에 초기화됩니다.' : '');
    return '';
  }
  if (!g.service) return '';
  const a = g.best, stats = snapshot?.usage?.accounts || {}, st = a ? stats[a.row.id] : null;
  if (!a || !(a.credits > 0) || !(st?.perDay > 0)) return '';
  const refill = nextRefill(g.service, a.row, st.refillAt, now);
  if (!refill) return '';
  const emptyAt = now + (a.credits / st.perDay) * DAY_MS;
  return emptyAt >= refill ? neun(name) + ' 다음 충전(' + dateWords(refill) + ')까지 남습니다.' : name + ' 크레딧이 ' + whenWords(emptyAt, now) + '쯤 바닥납니다. 다음 충전은 ' + dateWords(refill) + '입니다.';
}

/* 계정 하나의 남은 양 글. 쓰지 않는 말: 「지금 쓰는 계정」(자료가 없다, 설계 검토 1차 5) */
function accountLine(a, g, now) {
  const line = { name: a.name || '이름 없는 계정', val: '', when: '', tag: g.today === a ? '먼저 쓸 계정' : '' };
  if (a.state === 'login') line.val = '다시 로그인해야 합니다';
  else if (a.state === 'error') line.val = '읽지 못했습니다';
  else if (a.projected) Object.assign(line, { val: '다시 찼을 것', when: '다시 읽으면 확인됩니다' });
  else if (a.state === 'out') Object.assign(line, { val: '다 씀', when: a.unblock ? shortWhen(a.unblock, now) + '에 다시 열림' : '' });
  else if (g.kind === 'weekly' && a.g) Object.assign(line, { val: a.left + '% 남음', when: a.g.resetsAt ? shortWhen(a.g.resetsAt, now) + ' 초기화' : '' });
  else if (g.kind === 'credit' && Number.isFinite(a.credits)) line.val = fmt(a.credits) + ' 크레딧';
  else if (a.state === 'unknown') line.val = '읽기 전';
  else line.val = '직접 기록';
  return line;
}

/* 요금 한 줄(설계 검토 1차 6). 넣은 값이 먼저이고, 공식 요금으로 채운 값에는 「공식 요금」, 달러를 원으로 바꾼 값에는 「약」을 붙인다.
   가족 공유는 0원이 아니라 「가족 공유」다. 연간 결제는 「매월 n일」을 붙이지 않는다. 일부 계정만 금액을 알면 합을 전체처럼 쓰지 않는다 */
function costLine(snapshot, g, now) {
  const rows = here(g).map(a => a.row);
  if (!rows.length) return null;
  let krw = 0, known = 0, family = 0, official = false, approx = false;
  for (const row of rows) {
    const p = monthPrice(snapshot, row, now);
    if (!p) continue;
    if (p.official && p.krw === 0) { family++; continue; }
    if (planKey(row.plan) === 'family' && p.krw === 0) { family++; continue; }
    known++; krw += p.krw;
    if (p.official) official = true;
    if ((p.official ? p.table?.currency : row.currency) === 'USD') approx = true;
  }
  const unknown = costOf(snapshot, rows, now).unknown;
  const bills = rows.map(row => monthlyBill(row, now)).filter(d => d !== null);
  const bill = bills.length ? '다음 결제 ' + dateWords(dayAfter(now, Math.min(...bills))) : '';
  if (!known) return family ? { val: '가족 공유', note: '', bill } : null;
  const notes = [official ? '공식 요금' : '', family ? '가족 공유 ' + family + '개' : '', unknown ? '계정 ' + rows.length + '개 가운데 ' + known + '개의 금액만 압니다' : ''].filter(Boolean);
  return { val: '월 ' + (approx ? '약 ' : '') + fmt(krw) + '원', note: notes.join(' · '), bill };
}

function moreOf(snapshot, g, fact, now) {
  const say = moreSay(snapshot, g, fact, now);
  const list = here(g);
  // 손볼 계정은 결론 문장 다음 줄에서 먼저 말한다. 지금 줄은 가장 좋은 계정 하나만 보여서 다른 계정의 문제가 여기서 처음 드러난다(설계 검토 1차 5)
  const fix = list.filter(a => a.state === 'login' || a.state === 'error').map(a => (a.name ? a.name + ' 계정은' : '이름 없는 계정은') + ' ' + (a.state === 'login' ? '다시 로그인해야 합니다.' : '읽지 못했습니다.'));
  const accounts = list.length > 1 ? list.map(a => accountLine(a, g, now)) : null;
  let week = null;
  if (g.service) {
    const u = usageDays(snapshot?.usage, g);
    if (u.bars.some(Boolean)) {
      const avg = u.avg === null ? '' : '하루 평균 ' + (u.kind === 'pct' ? Math.round(u.avg) + '%' : fmt(u.avg) + ' 크레딧');
      week = { bars: u.bars.map(b => (b ? { height: b.height, level: b.level } : null)), avg, kind: u.kind };
    }
  }
  const cost = costLine(snapshot, g, now);
  const empty = !say && !fix.length && !accounts && !week && !cost ? (g.service ? NO_RECORD : MANUAL_EMPTY) : '';
  return { say, fix, accounts, week, cost, empty };
}

/* 확인할 구독 한 줄. 서비스의 계정 일부만 문제면 「Claude 계정 1개는 …」, 모두 문제면 「Codex는 …」 */
function troubleLine(list) {
  // 계정 여럿 가운데 일부만 확인할 구독은 몇 개인지 적는다. 둘 이상이어도 그렇게 해야 첫 줄(넉넉한 구독)과 어긋나지 않는다(0.4.95 원천 후보 검수)
  return neun(joinNames(list.map(t => (t.partial ? t.name + ' 계정 ' + t.count + '개' : t.name)))) + ' 계정 관리에서 확인해 주세요.';
}

/* 맨 위 두 줄. 차례는 설계 8절 표: 읽지 못함 · 구독 없음 · 처음 읽는 중 · 6시간 넘음 · 다 씀 · 막힘 · 부족 · 모두 넉넉 · 기록 부족 */
function sentence(facts, creditLow, now, { trouble = [], credits = [], manual = 0, allSure = false } = {}) {
  const outs = facts.filter(f => f.fact.kind === 'out').sort((a, b) => (a.fact.at ?? Infinity) - (b.fact.at ?? Infinity));
  if (outs.length) {
    const o = outs[0];
    // 5시간 창이 바닥이면 「5시간 한도」, 주간 창이 바닥일 때만 「이번 주 한도」라고 쓴다(최종 검수)
    const which = o.fact.focus === 'session' ? '5시간 한도' : '이번 주 한도';
    return { say: neun(o.name) + ' ' + which + '를 다 썼습니다.', then: o.fact.at ? spokenWhen(o.fact.at, now) + '에 다시 열립니다.' : '' };
  }
  const paces = facts.filter(f => f.fact.kind === 'pace').sort((a, b) => a.fact.at - b.fact.at);
  const fine = facts.filter(f => f.fact.kind === 'fine'), young = facts.filter(f => f.fact.kind === 'young'), low = facts.filter(f => f.fact.kind === 'low');
  if (paces.length) {
    const p = paces[0], say = ga(p.name) + ' ' + whenWords(p.fact.at, now) + '에 바닥납니다.';
    if (paces.length > 1) return { say, then: do_(paces[1].name) + ' ' + whenWords(paces[1].fact.at, now) + '에 바닥납니다.' };
    const others = facts.filter(f => f !== p && f.fact.kind !== 'unknown');
    if (others.length && others.every(f => f.fact.kind === 'fine')) return { say, then: neun(joinNames(others.map(f => f.name))) + ' 이번 주 내내 넉넉합니다.' };
    return { say, then: p.fact.release ? neun(p.name) + ' ' + spokenWhen(p.fact.release, now) + '에 다시 찹니다.' : '' };
  }
  if (low.length) {
    const l = low[0];
    return { say: neun(l.name) + ' ' + l.fact.left + '%만 남았습니다.', then: l.fact.at ? spokenWhen(l.fact.at, now) + '에 초기화됩니다.' : '' };
  }
  if (creditLow.length) {
    const c = creditLow[0];
    return { say: c.name + ' 크레딧이 얼마 남지 않았습니다.', then: c.billAt ? (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(c.billAt)) + '에 다시 찹니다.' : '' };
  }
  if (young.length) {
    const tail = neun(joinNames(young.map(f => f.name))) + ' 사흘쯤 쓰면 언제 바닥날지 미리 알려 드립니다.';
    if (fine.length) return { say: '이번 주는 ' + ga(joinNames(fine.map(f => f.name))) + ' 넉넉합니다.', then: tail };
    return { say: '쓰는 속도를 셀 만큼 기록이 아직 쌓이지 않았습니다.', then: tail };
  }
  if (fine.length) {
    const first = fine.filter(f => Number.isFinite(f.fact.reset)).sort((a, b) => a.fact.reset - b.fact.reset)[0];
    const firstLine = first ? '가장 먼저 ' + ga(first.name) + ' ' + spokenWhen(first.fact.reset, now) + '에 초기화됩니다.' : '';
    // 「모든 구독」은 주간 한도형이 모두 넉넉하고, 확인할 구독도 크레딧형 · 직접 기록도 없을 때만 쓴다(검수 B2, 8절 「넉넉하다고 말할 근거」)
    if (allSure) return { say: '이번 주는 모든 구독이 넉넉합니다.', then: firstLine };
    return { say: '이번 주는 ' + ga(joinNames(fine.map(f => f.name))) + ' 넉넉합니다.', then: trouble.length ? troubleLine(trouble) : firstLine };
  }
  // 확인할 구독이 있으면 맨 위는 그 안내다(state: check)
  if (trouble.length) return null;
  // 크레딧형만 있고 모자라지 않을 때: 가장 적게 남은 것 하나를 말한다(검수 B1)
  if (credits.length) {
    const c = [...credits].sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))[0];
    const left = c.pct === null ? fmt(c.value) : c.pct + '%';
    return { say: c.name + ' 크레딧이 ' + left + ' 남았습니다.', then: c.billAt ? (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(c.billAt)) + '에 다시 찹니다.' : '' };
  }
  // 직접 기록한 구독만 있을 때(검수 B1)
  if (manual) return { say: '직접 넣은 구독은 남은 양을 읽지 않습니다.', then: '초기화하는 때와 결제일은 아래 줄에 있습니다.' };
  return null;
}

/* input: { native, signedIn, waiting('pending' | 'error' | null), authChecking, snapshot, error(code), checking, rereadFailed }. 돌려주는 값: { state, say, then, rows, read, action }
 * 손님 문장은 signedIn(회원 판정)이 거짓일 때만 쓴다. 회원으로 보이는 동안 본체가 읽기를 거절한 것(SIGN_IN_REQUIRED)은
 * 손님이라는 뜻이 아니라 계정 확인을 기다린다는 뜻이다(다시 검수 -c) */
export function solioToday({ native = true, signedIn = true, waiting = null, authChecking = false, snapshot = null, error = null, checking = false, rereadFailed = false } = {}, now = Date.now()) {
  const empty = { rows: [], read: '', action: null };
  if (!native) return { ...empty, state: 'preview', say: '구독 자료는 PC 앱에서 읽습니다.', then: '' };
  if (!signedIn) return { ...empty, state: 'guest', say: '로그인하면 구독별 남은 양이 여기에 보입니다.', then: '' };
  // 토큰을 갱신하는 동안은 조용히 기다린다. 계정 연결 오류이거나 본체가 읽기를 거절했으면 그렇다고 말하고 「다시 확인」을 둔다(설계 검토 3차 P2-1)
  if (!snapshot && waiting === 'pending') return { ...empty, state: 'loading', say: '', then: '' };
  if (!snapshot && (waiting || error === 'SIGN_IN_REQUIRED')) {
    // 확인하는 동안에도 「다시 확인」 단추를 숨기지 않는다(누를 수 없게만 둔다). 숨기면 초점이 얼굴 밖으로 빠진다(다시 검수 -d)
    if (authChecking) return { ...empty, state: 'waiting', say: '계정 연결을 다시 확인하고 있습니다.', then: '', action: 'recheck-auth', checking: true };
    return { ...empty, state: 'waiting', say: '계정 연결을 확인하지 못했습니다.', then: '연결되면 구독별 남은 양을 읽습니다.', action: 'recheck-auth' };
  }
  if (error) return { ...empty, state: 'error', say: '구독 자료를 읽지 못했습니다.', then: '잠시 뒤 「다시 읽기」를 눌러 주세요.', action: 'reread' };
  if (!snapshot) return { ...empty, state: 'loading', say: '', then: '' };
  const rows = snapshot.rows || [], checkAt = snapshot.check?.at || null, busy = checking || !!snapshot.checking;
  const groups = serviceGroups(rows, now, checkAt).filter(g => here(g).length > 0);
  if (!groups.length) return { ...empty, state: 'none', say: '아직 연결한 AI 구독이 없습니다.', then: '구독을 연결하면 남은 양과 다시 차는 때를 여기에서 알려 드립니다.', action: 'connect' };
  const facts = groups.filter(g => g.kind === 'weekly' && g.service).map(g => ({ g, name: groupName(g), fact: weeklyFact(snapshot, g, now) }));
  const factOf = g => facts.find(f => f.g === g)?.fact || null;
  const lines = groups.map(g => rowOf(snapshot, g, factOf(g), now, busy));
  // 직접 넣은 구독만 있으면 읽을 것이 없다. 처음 읽기와 6시간 가지를 거치지 않고, 「다시 읽기」와 읽은 때 줄도 내지 않는다(최종 검수)
  const autos = groups.some(g => here(g).some(a => a.row?.source === 'auto'));
  if (!autos) return { rows: lines, read: '', action: null, state: 'ready', say: '직접 넣은 구독은 남은 양을 읽지 않습니다.', then: '초기화하는 때와 결제일은 아래 줄에 있습니다.' };
  const read = readLine(checkAt, now, busy);
  const result = { rows: lines, read, action: 'reread' };
  if (!checkAt) return { ...result, state: 'first', say: busy ? '구독별 남은 양을 처음 읽고 있습니다.' : '아직 구독별 남은 양을 읽지 않았습니다.', then: busy ? '' : '「다시 읽기」를 누르면 지금 남은 양을 읽습니다.', dim: true };
  if (now - checkAt > LONG_STALE_MS) {
    if (busy && !rereadFailed) return { ...result, state: 'rereading', say: '구독별 남은 양을 다시 읽고 있습니다.', then: '', dim: true };
    // 「새로 읽지 못했습니다」는 다시 읽기가 실제로 실패했을 때만 쓴다(설계 8절 차례 4, 최종 검수)
    if (rereadFailed) return { ...result, state: 'stale', say: '마지막으로 읽은 지 6시간이 넘었습니다.', then: '지금은 새로 읽지 못했습니다. 잠시 뒤 「다시 읽기」를 눌러 주세요.', dim: true };
    return { ...result, state: 'stale', say: '마지막으로 읽은 지 6시간이 넘었습니다.', then: '「다시 읽기」를 누르면 지금 남은 양을 읽습니다.', dim: true };
  }
  const creditLow = groups.filter(g => g.kind === 'credit' && g.best && g.best.state === 'low').map(g => {
    const day = g.best.row?.billDay ? nextBill(g.best.row.billDay, now) : null;
    return { name: groupName(g), billAt: day === null ? null : dayAfter(now, day) };
  });
  // 다시 로그인하거나 읽지 못한 계정이 하나라도 있는 구독(계정 여럿 가운데 하나여도 센다), 넉넉한 크레딧형, 직접 기록(검수 B1 · B2, 최종 검수)
  const trouble = groups.filter(g => g.login.length || g.error.length).map(g => ({ name: groupName(g), count: g.login.length + g.error.length, partial: g.usable.length + g.projected.length + g.out.length > 0 }));
  const credits = groups.map((g, i) => ({ g, line: lines[i] })).filter(({ g, line }) => g.kind === 'credit' && g.best?.state === 'ok' && !g.login.length && !g.error.length && (line.gauge !== null || / 크레딧$/.test(line.val))).map(({ g, line }) => {
    const a = g.best || g.accounts[0], b = a ? balance(a.row) : null, day = a?.row?.billDay ? nextBill(a.row.billDay, now) : null;
    return { name: groupName(g), pct: line.gauge, value: b ? b.value : 0, billAt: day === null ? null : dayAfter(now, day) };
  });
  const manual = lines.filter(r => r.val === '직접 기록').length;
  // 「모든 구독이 넉넉합니다」는 보이는 묶음 모두가 주간 한도형이고 넉넉하다고 확인된 때만 쓴다
  const allSure = groups.every(g => g.kind === 'weekly' && factOf(g)?.kind === 'fine' && !g.login.length && !g.error.length && !g.out.length && !g.pending.length && !g.projected.length);
  const s = sentence(facts, creditLow, now, { trouble, credits, manual, allSure });
  if (s) return { ...result, state: 'ready', ...s };
  // 확인 안내는 다시 로그인하거나 못 읽은 구독이 있을 때만 쓴다. 그 밖에는 까닭에 맞게 말한다(최종 검수)
  if (!trouble.length) {
    if (groups.some(g => g.projected.length)) return { ...result, state: 'projected', say: busy ? '구독별 남은 양을 다시 읽고 있습니다.' : '초기화 시각이 지나 남은 양이 다시 찼을 수 있습니다.', then: busy ? '' : '「다시 읽기」를 누르면 지금 남은 양을 읽습니다.', dim: true };
    if (groups.some(g => g.pending.length)) return { ...result, state: 'first', say: busy ? '구독별 남은 양을 처음 읽고 있습니다.' : '아직 남은 양을 읽지 않은 구독이 있습니다.', then: busy ? '' : '「다시 읽기」를 누르면 지금 남은 양을 읽습니다.', dim: true };
  }
  return { ...result, state: 'check', say: '구독 연결을 확인해야 합니다.', then: '줄을 누르면 자세히 펼쳐지고, 계정 관리에서 다시 로그인하거나 연결을 확인할 수 있습니다.' };
}
