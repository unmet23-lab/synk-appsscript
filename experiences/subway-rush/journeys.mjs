// 여정 틀과 안내 원고(설계 1 · 3절). 여정은 고정 대본이 아니라 변형으로 채우는 틀이다 — 출발역 · 내릴 역 · 문 쪽 · 출구 번호 · 표지 자리가 판마다 바뀐다.
// 안내 문장은 모두 여기서 만들어져 목소리 굽기와 AI 2중 검수의 원본이 된다(allLines · reviewDecisions). 화면 글(text)과 읽는 글(say)을 따로 둔다.
// 「첫 등굣길」은 1~2급(지도 ko.*), 「바쁜 아침」은 3~4급(지도 ko2.*, 설계 3절) — 짧은 운행 · 급행 · 고장 대체 · 출구 공사.
import { LINES, sayStation, transfersAt, 이에요 } from './lines.mjs';

export const SIDE_WORD = Object.freeze({ left: '왼쪽', right: '오른쪽' });
const SINO = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
export const sayNumber = (n) => SINO[n];
// 소리가 비슷해 듣기 미끼가 되는 출구 번호 짝
const EXIT_NEAR = Object.freeze({ 1: [2, 7], 2: [1, 4], 3: [4, 5], 4: [3, 2], 5: [3, 4], 6: [7, 1], 7: [6, 1], 8: [7, 6] });
const SLUG = Object.freeze({ 신촌: 'sinchon', 이대: 'ewha', 아현: 'ahyeon', 충정로: 'chungjeongno', 시청: 'cityhall', 을지로입구: 'euljiro1', 을지로3가: 'euljiro3', 을지로4가: 'euljiro4', 종각: 'jonggak', 종로3가: 'jongno3', 종로5가: 'jongno5', 동대문: 'dongdaemun' });
const slugOf = (station) => SLUG[station];

export function stopLine(station, line, side) {
  const others = transfersAt(station, line);
  const name = sayStation(station);
  let say = `이번 역은 ${name}, ${name}역입니다. 내리실 문은 ${SIDE_WORD[side]}입니다.`;
  let text = `이번 역은 ${station}, ${station}역입니다. 내리실 문은 ${SIDE_WORD[side]}입니다.`;
  if (others.length) {
    say += ` ${others.map((n) => LINES[n].say).join('과 ')}으로 갈아타실 분은 이번 역에서 내리시기 바랍니다.`;
    text += ` ${others.map((n) => `${n}호선`).join('과 ')}으로 갈아타실 분은 이번 역에서 내리시기 바랍니다.`;
  }
  return { voice: `stop-${slugOf(station)}-${side}`, role: 'announcer', say, text };
}
export const guideStart = (transfer, line) => ({ voice: `guide-start-${slugOf(transfer)}-${line}`, role: 'guide', say: `${sayStation(transfer)}역에서 ${LINES[line].say}으로 갈아타세요.`, text: `${transfer}역에서 ${line}호선으로 갈아타세요.`, key: [`${transfer}역`, `${line}호선`] });
export const guideFork = (line, way, dest) => ({ voice: `guide-fork-${line}-${slugOf(dest)}`, role: 'guide', say: `${LINES[line].say}, ${way} 방면이에요. ${sayStation(dest)}에서 내리세요.`, text: `${line}호선, ${way} 방면이에요. ${dest}에서 내리세요.`, key: [`${way} 방면`] });
export const guideExit = (n) => ({ voice: `guide-exit-${n}`, role: 'guide', say: `학교 셔틀은 ${sayNumber(n)} 번 출구 앞에 있어요.`, text: `학교 셔틀은 ${n}번 출구 앞에 있어요.`, key: [`${n}번 출구`] });
// 3~4급: 바뀐 안내(합쇼체 · 부정 · 조건 · 대체)
export const shortTurnLine = (station, side) => ({ voice: `busy-short-${slugOf(station)}-${side}`, role: 'announcer', say: `이 열차는 ${sayStation(station)}역까지만 운행합니다. 모두 내려 주시기 바랍니다. 내리실 문은 ${SIDE_WORD[side]}입니다.`, text: `이 열차는 ${station}역까지만 운행합니다. 모두 내려 주시기 바랍니다. 내리실 문은 ${SIDE_WORD[side]}입니다.`, key: [SIDE_WORD[side]] });
export const expressLine = (skip) => ({ voice: `busy-express-${slugOf(skip)}`, role: 'announcer', say: `이번 청량리행 열차는 ${sayStation(skip)}역에 서지 않습니다. 다른 역에는 모두 섭니다. ${sayStation(skip)}역에 가실 분은 다음 열차를 이용해 주시기 바랍니다.`, text: `이번 청량리행 열차는 ${skip}역에 서지 않습니다. 다른 역에는 모두 섭니다. ${skip}역에 가실 분은 다음 열차를 이용해 주시기 바랍니다.`, key: [`${skip}역에 서지 않습니다`] });
export const delayLine = () => ({ voice: 'busy-delay-1to2', role: 'announcer', say: '일호선 열차가 고장으로 멈췄습니다. 이호선을 이용해 주시기 바랍니다.', text: '1호선 열차가 고장으로 멈췄습니다. 2호선을 이용해 주시기 바랍니다.', key: ['2호선을'] });
export const exitClosedLine = (closed, open) => ({ voice: `busy-exit-${closed}-${open}`, role: 'announcer', say: `${sayNumber(closed)} 번 출구는 공사로 이용하실 수 없습니다. ${sayNumber(open)} 번 출구를 이용해 주시기 바랍니다.`, text: `${closed}번 출구는 공사로 이용하실 수 없습니다. ${open}번 출구를 이용해 주시기 바랍니다.`, key: [`${open}번 출구`] });

// 2호선 구간(시청에서 1호선으로): 첫 역이 답인 판도 있게 출발역을 고른다.
const LINE2_ROUTES = Object.freeze([
  { start: '충정로', stops: ['시청'] },
  { start: '아현', stops: ['충정로', '시청'] },
  { start: '이대', stops: ['아현', '충정로', '시청'] },
  { start: '을지로입구', stops: ['시청'] },
  { start: '을지로3가', stops: ['을지로입구', '시청'] },
  { start: '을지로4가', stops: ['을지로3가', '을지로입구', '시청'] },
]);
// 1호선 구간(시청에서 청량리 방면): 내릴 역을 길 안내가 알려 준다. 역이 하나뿐인 구조로 답이 정해지지 않게 둘 이상.
const LINE1_DESTS = Object.freeze([
  { dest: '종로3가', stops: ['종각', '종로3가'] },
  { dest: '종로5가', stops: ['종각', '종로3가', '종로5가'] },
  { dest: '동대문', stops: ['종로3가', '종로5가', '동대문'] },
]);
export const ROUTES = Object.freeze({ line2: LINE2_ROUTES, line1: LINE1_DESTS });

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
function shuffle(r, list) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const place = (r, correct, others) => shuffle(r, [correct, ...others]);

const DOORS = Object.freeze([{ id: 'left', text: '왼쪽 문', arrow: 'left' }, { id: 'stay', text: '그대로', arrow: 'stay' }, { id: 'right', text: '오른쪽 문', arrow: 'right' }]);
const BASIC = Object.freeze({ stop: 'ko.listening.detail', fork: 'ko.listening.detail', exit: 'ko.listening.detail' });
const TOPIK2 = 'ko2.listening.detail';

function stopDecision(r, station, line, target, leg, grade = 'basic') {
  const side = r() < 0.5 ? 'left' : 'right';
  const hasTransfer = transfersAt(station, line).length > 0;
  return {
    kind: 'stop', station, line, leg, side, target, line_: stopLine(station, line, side), grade,
    id: `stop.${slugOf(station)}.${target ? 'off' : 'pass'}.${side}`, family: `stop.${slugOf(station)}.${target ? 'off' : 'pass'}`, skillId: BASIC.stop, difficulty: hasTransfer ? 2 : 1,
    // 환승 말이 없는 역의 「그대로」는 늘 그대로만 눌러도 맞으니 혼자 해낸 근거로 세지 않는다(설계 3절).
    assessable: target || hasTransfer,
    options: DOORS, answer: target ? side : 'stay',
  };
}
const forkOptions = (r, way) => place(r, { id: 'way', line: 1, color: LINES[1].color, text: `${way} 방면` }, [{ id: 'other', line: 1, color: LINES[1].color, text: '서울역 방면' }, { id: 'out', text: '나가는 곳' }]);
function exitDecision(r, dest, leg) {
  const exit = 1 + Math.floor(r() * 8);
  const exits = place(r, { id: `e${exit}`, exit }, EXIT_NEAR[exit].map((n) => ({ id: `e${n}`, exit: n })));
  return { kind: 'exit', station: dest, leg, line_: guideExit(exit), id: `exit.${exit}`, family: `exit.${exit}`, skillId: BASIC.exit, difficulty: 1, assessable: true, options: exits, answer: `e${exit}`, grade: 'basic' };
}

/** 여정 하나. seed가 같으면 같은 판이다(시험 · 다시 보기). level: 'basic' 첫 등굣길 · 'busy' 바쁜 아침. */
export function buildJourney({ seed = Date.now(), level = 'basic' } = {}) {
  const r = rng(seed);
  return level === 'busy' ? buildBusy(r, seed) : buildBasic(r, seed);
}
function buildBasic(r, seed) {
  // 결정 5~7번이 되도록 고른다(열차 결정 + 통로 + 출구).
  let line2, line1;
  for (;;) {
    line2 = pick(r, LINE2_ROUTES); line1 = pick(r, LINE1_DESTS);
    const n = line2.stops.length + line1.stops.length + 2;
    if (n >= 5 && n <= 7) break;
  }
  const way = '청량리', transfer = '시청', dest = line1.dest;
  const decisions = [];
  line2.stops.forEach((s, i) => decisions.push(stopDecision(r, s, 2, i === line2.stops.length - 1, 0)));
  decisions.push({ kind: 'fork', station: transfer, leg: 0, line_: guideFork(1, way, dest), id: `fork.${way}.${slugOf(dest)}`, family: `fork.${way}`, skillId: BASIC.fork, difficulty: 1, assessable: true, options: forkOptions(r, way), answer: 'way', grade: 'basic' });
  line1.stops.forEach((s) => decisions.push(stopDecision(r, s, 1, s === dest, 1)));
  decisions.push(exitDecision(r, dest, 1));
  return { seed, level: 'basic', start: line2.start, transfer, way, dest, opening: guideStart(transfer, 1), decisions };
}

// 바쁜 아침: 같은 학교 길에 바뀐 안내가 섞인다. 판마다 두 갈래 중 하나.
const BUSY_START = Object.freeze([{ start: '아현', stops: ['충정로', '시청'] }, { start: '이대', stops: ['아현', '충정로', '시청'] }, { start: '충정로', stops: ['시청'] }]);
const BUSY_EXPRESS = Object.freeze([
  { dest: '종각', stops: ['종각'], skip: '종각', answer: 'wait' },   // 내릴 역을 건너뛰는 급행 → 다음 열차
  { dest: '종로3가', stops: ['종로3가'], skip: '종각', answer: 'board' },   // 건너뛰는 역이 내 역이 아니면 → 이 열차(종각은 지나친다)
  { dest: '종로5가', stops: ['종로3가', '종로5가'], skip: '종각', answer: 'board' },
]);
function busyExit(r, dest, leg) {
  // 공사: 길 안내가 말한 번호는 막혔고 안내방송의 다른 번호로 간다. 막힌 번호가 보기에 그대로 있다.
  const closed = 1 + Math.floor(r() * 7);
  const open = EXIT_NEAR[closed][0];
  const third = EXIT_NEAR[closed][1] !== open ? EXIT_NEAR[closed][1] : EXIT_NEAR[closed][0] + 1;
  const options = place(r, { id: `e${open}`, exit: open }, [{ id: `e${closed}`, exit: closed }, { id: `e${third}`, exit: third }]);
  return { kind: 'exit', station: dest, leg, lead: guideExit(closed), line_: exitClosedLine(closed, open), id: `busy.exit.${closed}.${open}`, family: `busy.exit.${closed}`, skillId: TOPIK2, difficulty: 1, assessable: true, options, answer: `e${open}`, grade: 'busy' };
}
function buildBusy(r, seed) {
  const route = pick(r, BUSY_START), decisions = [], transfer = '시청', way = '청량리';
  route.stops.slice(0, -1).forEach((s) => decisions.push(stopDecision(r, s, 2, false, 0, 'busy')));
  const side = r() < 0.5 ? 'left' : 'right';
  if (r() < 0.5) {
    // 갈래 ① 짧은 운행 → 통로 → 급행 → 출구 공사
    decisions.push({ kind: 'stop', station: transfer, line: 2, leg: 0, side, target: true, line_: shortTurnLine(transfer, side), id: `busy.short.${side}`, family: 'busy.short', skillId: TOPIK2, difficulty: 1, assessable: true, options: DOORS, answer: side, grade: 'busy' });
    const e = pick(r, BUSY_EXPRESS);
    decisions.push({ kind: 'fork', station: transfer, leg: 0, line_: guideFork(1, way, e.dest), id: `fork.${way}.${slugOf(e.dest)}`, family: `fork.${way}`, skillId: BASIC.fork, difficulty: 1, assessable: true, options: forkOptions(r, way), answer: 'way', grade: 'basic' });
    decisions.push({ kind: 'board', station: transfer, leg: 1, line_: expressLine(e.skip), id: `busy.express.${slugOf(e.skip)}.${slugOf(e.dest)}`, family: `busy.express.${slugOf(e.dest)}`, skillId: TOPIK2, difficulty: 1, assessable: true, dest: e.dest,
      options: [{ id: 'board', text: '이 열차 타기', arrow: 'stay' }, { id: 'wait', text: '다음 열차 기다리기', arrow: 'left' }, { id: 'opposite', text: '반대편 승강장 가기', arrow: 'right' }], answer: e.answer, grade: 'busy' });
    e.stops.forEach((s) => decisions.push(stopDecision(r, s, 1, s === e.dest, 1, 'busy')));
    decisions.push(busyExit(r, e.dest, 1));
    return { seed, level: 'busy', start: route.start, transfer, way, dest: e.dest, opening: guideStart(transfer, 1), decisions };
  }
  // 갈래 ② 1호선 고장 → 2호선으로 다시 → 출구 공사
  decisions.push({ ...stopDecision(r, transfer, 2, true, 0, 'busy') });
  const dest = '을지로3가';
  decisions.push({ kind: 'fork', station: transfer, leg: 0, line_: delayLine(), id: 'busy.delay.1to2', family: 'busy.delay', skillId: TOPIK2, difficulty: 1, assessable: true,
    options: place(r, { id: 'way', line: 2, color: LINES[2].color, text: '2호선 타는 곳' }, [{ id: 'other', line: 1, color: LINES[1].color, text: '1호선 타는 곳' }, { id: 'out', text: '나가는 곳' }]), answer: 'way', grade: 'busy', after: guideAfterDelay(dest) });
  ['을지로입구', dest].forEach((s) => decisions.push(stopDecision(r, s, 2, s === dest, 1, 'busy')));
  decisions.push(busyExit(r, dest, 1));
  return { seed, level: 'busy', start: route.start, transfer, way: '을지로', dest, opening: guideStart(transfer, 1), decisions };
}
const guideAfterDelay = (dest) => ({ voice: `guide-after-delay-${slugOf(dest)}`, role: 'guide', say: `이호선으로 ${sayStation(dest)}까지 가세요.`, text: `2호선으로 ${dest}까지 가세요.`, key: [dest] });

/** 원고 전체(중복 없음) — 목소리 굽기가 읽는다. */
export function allLines() {
  const out = new Map();
  const add = (l) => { if (l && !out.has(l.voice)) out.set(l.voice, l); };
  add(guideStart('시청', 1));
  for (const route of LINE2_ROUTES) for (const s of route.stops) for (const side of ['left', 'right']) add(stopLine(s, 2, side));
  for (const d of LINE1_DESTS) { add(guideFork(1, '청량리', d.dest)); for (const s of d.stops) for (const side of ['left', 'right']) add(stopLine(s, 1, side)); }
  for (let n = 1; n <= 8; n++) add(guideExit(n));
  for (const side of ['left', 'right']) { add(shortTurnLine('시청', side)); add(stopLine('을지로3가', 2, side)); add(stopLine('을지로입구', 2, side)); }
  for (const e of BUSY_EXPRESS) { add(expressLine(e.skip)); add(guideFork(1, '청량리', e.dest)); for (const s of e.stops) for (const side of ['left', 'right']) add(stopLine(s, 1, side)); }
  add(delayLine()); add(guideAfterDelay('을지로3가'));
  for (let closed = 1; closed <= 7; closed++) add(exitClosedLine(closed, EXIT_NEAR[closed][0]));
  return [...out.values()];
}

/** 결정 하나의 해설(쪽지 · 문항 검수). 놓친 말을 짚는다. */
export function explainDecision(d, journey) {
  if (d.kind === 'stop') {
    if (d.id.startsWith('busy.short')) return `「${d.station}역까지만 운행합니다」는 모두 내리라는 말이에요. 내리실 문은 ${이에요(SIDE_WORD[d.side])}.`;
    if (d.target) return `내릴 역에 왔어요. 안내에서 내리실 문은 ${SIDE_WORD[d.side]}이라고 했어요.`;
    const others = transfersAt(d.station, d.line), goal = d.leg === 0 ? journey.transfer : journey.dest;
    return others.length ? `이번 역은 ${이에요(d.station)}. ${others.map((n) => `${n}호선`).join('과 ')}으로 갈아타는 역이지만, 내릴 곳은 ${이에요(goal)}. 그대로 타요.` : `이번 역은 ${이에요(d.station)}. 내릴 곳은 ${이에요(goal)}. 그대로 타요.`;
  }
  if (d.kind === 'fork') return d.id === 'busy.delay.1to2' ? '1호선이 고장으로 멈췄으니 2호선을 이용하라고 했어요.' : `길 안내에서 「${journey.way} 방면」이라고 했어요.`;
  if (d.kind === 'board') return d.answer === 'wait' ? `안내에서 「${journey.dest}역에 서지 않습니다」라고 했어요. 내릴 곳이 ${이에요(journey.dest)}. 다음 열차를 기다려요.` : `안내에서 「종각역에 서지 않습니다. 다른 역에는 모두 섭니다」라고 했어요. 내릴 곳은 ${이에요(journey.dest)}. 이 열차를 타요.`;
  if (d.id.startsWith('busy.exit')) { const [, , closed, open] = d.id.split('.'); return `${closed}번 출구는 공사로 쓸 수 없고, ${open}번 출구를 이용하라고 했어요.`; }
  return `길 안내에서 ${d.options.find((o) => o.id === d.answer).exit}번 출구라고 했어요.`;
}

/** 근거로 세는 결정의 변형 전체(문항 AI 2중 검수의 원본). 앞서 들은 길 안내를 맥락으로 함께 낸다. */
export function reviewDecisions() {
  const seen = new Map();
  for (const level of ['basic', 'busy']) for (let seed = 1; seed < 6000; seed++) {
    const journey = buildJourney({ seed: seed * 37 + 11, level });
    let heard = journey.opening;
    for (const d of journey.decisions) {
      if (d.assessable && !seen.has(d.id)) seen.set(d.id, { decision: d, context: [heard, ...(d.lead ? [d.lead] : [])], explanation: explainDecision(d, journey), journey });
      if (d.kind === 'fork' && d.id !== 'busy.delay.1to2') heard = d.line_;
      if (d.after) heard = d.after;
    }
  }
  return [...seen.values()];
}
