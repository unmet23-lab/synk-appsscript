// 솔리오 「사무실」 방의 사무실 그림(구현설계 11.2, 시안 사무실.html 553~755행의 그리기를 옮겼다). 캔버스 하나에 부서 좌대, 자리, 직원(구의 작은 분신)을 그린다.
// 유호님 11-20 취향 기록에 따라 시안에서 바꾼 것: 빈 자리의 동그라미 대신 가는 짧은 선 하나, 승인 물음의 물결 고리 없음, 도우미는 구 곁의 꽉 찬 작은 점(셋까지)을 가만히 둔다.
// 손을 따라 기우는 카메라, 위아래로 뜨는 몸, 몸을 도는 빛줄기, 구에서 날아오는 새 직원을 뺐다.
// 11-23: 직원은 둘레 선 대신 왼쪽 위에서 빛을 받은 검은 구로 칠하고 눈이 작게 빛난다(첫 팀 고르기 6판의 구운 직원을 따름, 맹검이 「와이어프레임」을 짚음).
// 움직이는 것과 그 크기(이것 말고는 움직이지 않는다):
//  · 눈 깜빡임: 직원마다 2.4~7.6초에 한 번, 0.12초쯤 눈을 감았다 뜬다.
//  · 눈길: 승인을 물은 직원은 손(포인터) 쪽을 본다. 눈의 점이 구 반지름의 20% 안에서만 옮긴다. 일하는 직원의 눈은 9초 주기로 반지름의 8%만큼 좌우로 흐른다.
//  · 일하는 중: 테두리 밝기가 3.2초 주기로 0.38~0.62 사이를 천천히 오간다. 몸은 그 자리에 있다.
//  · 느낌표: 알림이 새로 붙을 때 0.42초 동안 커지며 나오고, 승인을 물은 직원의 느낌표는 1.6초 주기로 2.5px 안에서 위아래로 뛴다.
//  · 새 직원: 제자리에서 0.3초 동안 나타난다.
//  · 보기 바꾸기: 손님이 설정에서 「비스듬히」 · 「위에서」를 바꿀 때만 카메라가 한 번 옮겨 간다(0.7초쯤).
//  · 스킨 바꾸기(꾸미기, 솔리오_사무실스킨_20261123/PC앱_설계.md 5절): 손님이 스킨을 고를 때(skinSeq가 바뀔 때)만, 바닥부터 부서 자리까지 뒤에서 앞으로
//    0.06초 간격으로 0.38초씩 앞 스킨에서 새 스킨으로 겹쳐 넘어간다. 판이 늦게 와서 스킨이 바뀌면 움직이지 않는다.
//  · 탁상 등(호두나무 서재): 부서에 일하는 직원이 서거나 모두 쉬면 0.45초에 걸쳐 켜지고 꺼진다. 첫 그림에서는 바로다.
//  · 스킨을 바꾸거나 첫 모자를 씌우면 바닥과 모자까지 들어가게 그림 크기를 한 번 바로 맞춘다(움직이지 않는다).
//  · 책상이 늘거나 줄거나 바뀔 때(부서별 책상, 솔리오_사무실책상_20261125/README.md 7절): 앞 그림에서 새 그림으로 0.38초에 겹쳐 넘어간다. 책상도 직원도 카메라도
//    미끄러지지 않는다. 새로 놓인 책상은 앞 모서리가 1.4초 동안 밝았다가 가라앉는다(빛만 바뀐다). 첫 그림과 그림판 크기가 바뀔 때는 바로다.
//  · 다가가기(솔리오_사무실한마디_20261126): 방이 보이는 동안 손님이 대화 상대를 바꿀 때만, 그림이 0.62초에 한 번 그 부서 책상 쪽으로 다가간다(크기 1.12~1.35배).
//    「사무실」을 고르면 전체로 돌아온다. 방을 다시 열면 늘 전체에서 시작한다.
//  · 한마디: 눌린 직원이 0.34초 동안 반지름의 1.2배쯤 일어서며 조금 커지고 눈을 떠 손 쪽을 본다. 말이 끝나면 앉는다. 말풍선은 화면이 그린다(onTalk이 머리 자리를 준다).
//  · 움직임 줄이기가 켜져 있으면 모두 멈추고, 장면이 바뀔 때마다 한 번만 그린다. 다가가지 않고 일어서지 않는다.
// 방이 보이는 동안만 그린다(show). 화면 밀도는 2배까지만 쓴다. 모듈 맨 위에서는 DOM을 건드리지 않는다.

import { countWord, officeDeskPlan } from './office-model.mjs';

export const FLOOR_MOTION = Object.freeze({
  blinkMin: 2400, blinkSpan: 5200, blinkMs: 120,
  gazePeriod: 9000, gaze: 0.08, look: 0.2,
  rimPeriod: 3200, rimLow: 0.38, rimHigh: 0.62,
  screenPeriod: 4200, screenLow: 0.86,
  bangPeriod: 1600, bangPx: 2.5, popMs: 420,
  fadeMs: 300, viewTau: 230, frameMs: 33,
  skinMs: 380, skinStep: 60, lampTau: 450,
  layoutMs: 380, freshMs: 1400, crowd: 40, crowdMs: 50,
  leanMs: 620, leanMin: 1.12, leanMax: 1.35, leanPull: 0.6, leanEdge: 44, leanHead: 62, talkMs: 340, talkUp: 0.36, talkGrow: 0.2,
});
const M = FLOOR_MOTION;
const INK = '243,241,236';
const ink = a => `rgba(${INK},${a})`;
/* 사무실의 치수(시안 값). 부서 좌대 하나가 3.2 × 2.4, 사이 0.6, 직원 반지름 0.3이다 */
const ZW = 3.2, ZD = 2.4, GAP = 0.6, SLAB = 0.1, R0 = 0.3, STRIP = 1.1, STEP = 1.2;
/* 책상의 치수(솔리오_사무실책상_20261125/README.md 6절). 3인 책상은 하나일 때 넓은 판(ZW × ZD)이고, 둘부터는 같은 폭의 얕은 책상이다.
   그래서 넷째 직원이 서면 넓은 판 하나가 같은 자리의 책상 둘이 된다. 자리는 [책상 폭에 대한 몫, 책상 가운데에서 잰 깊이]이고, 등(lamp)은 [폭의 몫, 뒤 모서리에서 잰 깊이, 크기]다.
   lines: 얕은 책상 몇 줄의 깊이를 쓰는가 */
const DESK = Object.freeze({
  1: { w: 1.2, d: 1.2, lines: 1, seats: [[0.5, -0.16]], lamp: [0.15, 0.2, 0.8] },
  2: { w: 2.2, d: 1.2, lines: 1, seats: [[0.27, -0.16], [0.73, -0.16]], lamp: [0.5, 0.2, 0.9] },
  3: { w: ZW, d: 1.2, lines: 1, seats: [[0.22, -0.16], [0.5, -0.16], [0.78, -0.16]], lamp: [0.075, 0.2, 1] },
  4: { w: 2.2, d: 2.4, lines: 2, seats: [[0.27, -0.74], [0.73, -0.74], [0.27, 0.42], [0.73, 0.42]], lamp: [0.5, 0.2, 0.9] },
});
const WIDE_LAMP = [0.075, 0.22, 1];
/* 책상 사이, 한 부서가 줄에서 차지하는 가장 좁은 폭(이름이 들어갈 만큼), 앞 바닥에 쓰는 이름의 깊이, 띠의 줄 사이, 한 줄 띠의 자리와 한 줄로 돌아가는 자리, 무리와 띠의 줄 수 한도 */
const DESK_GAP = 0.2, SLOT_MIN = 2, LABEL_ROOM = 0.95, STRIP_ROW = 1.25, STRIP_ONE = 8, STRIP_BACK = 6, OTHER_MAX = 24, ROWS_MAX = 4;
/* 지금 줄 수의 크기가 가장 큰 짝의 이만큼이면 바꾸지 않는다. 직원이 오갈 때마다 배치가 뒤집히지 않게 한다 */
const PACK_KEEP = 0.92;
/* 직원 반지름이 5.4px(배율 125% 화면에서 6.75px) 아래로 가면 줄이지 말고 앉히는 수를 줄인다(설계 검토 P1-1). [띠, 부서 하나]의 한도를 앞에서부터 본다. 끝은 11-25까지의 한도(여덟, 여섯)다.
   BIG_S보다 커지려고 줄을 더 쌓지는 않는다(넉넉한 창에서 띠가 네 줄 바둑판이 되지 않게) */
const MIN_S = 18, BIG_S = 64, CAPS = Object.freeze([[40, 24], [24, 24], [16, 24], [8, 24], [8, 18], [8, 12], [8, 6]]);
/* 상태마다의 밝기와 높이. 소식이 없는 직원도 점선 테두리 없이 흐린 테두리로 둔다(빽빽한 점 무늬를 쓰지 않는다) */
const LOOK = Object.freeze({
  working: { rim: 0.5, glow: 0.16, lift: 0.14, eye: 0.9, mode: 'open' },
  asked: { rim: 0.98, glow: 0.34, lift: 0.24, eye: 1, mode: 'look' },
  silent: { rim: 0.3, glow: 0.08, lift: 0.06, eye: 0.6, mode: 'open' },
  done: { rim: 0.62, glow: 0.15, lift: 0.05, eye: 0.9, mode: 'smile' },
  resting: { rim: 0.24, glow: 0.06, lift: 0, eye: 0.42, mode: 'closed' },
  // 「조용합니다」(훅 소식이 없는 세션 포함)는 그림에서 쉬는 직원과 같은 모습이다(4.2)
  quiet: { rim: 0.24, glow: 0.06, lift: 0, eye: 0.42, mode: 'closed' },
});
const lookOf = s => LOOK[s] || LOOK.quiet;
/* 스킨마다의 재질(시안 스킨.html의 SK, 미학 맹검 세 번으로 고친 값). rim은 직원 테두리의 빛, label은 부서 이름의 색이다 */
/* 11-24 검정은 「불 켜진 자리」다(솔리오 방 짜임 시안, 맹검 세 번 「공간감과 생동감이 없다」). 바닥은 가장자리로 갈수록 어둠에 묻히고,
   일하는 부서의 책상에만 위에서 빛이 떨어진다. 일하는 직원 앞에는 노트북이 열려 있고 그 화면 빛이 직원 얼굴 아래를 비춘다(첫 팀 고르기 6판의 구운 장면) */
const SKIN = Object.freeze({
  black: { slab: 0.16, rim: INK, label: INK, boost: 1.3, shadow: 0.62, lit: true },
  walnut: {
    slab: 0.12, boost: 1.25, rim: '255,221,182', label: '255,232,206', shadow: 0.55, mat: 'rgba(0,0,0,.26)',
    floor: { thick: 0.16, top: ['#1b120b', '#2a1c12'], front: '#120b06', left: '#0b0703', edge: 'rgba(255,214,170,.16)', seam: 'rgba(0,0,0,.6)', grain: 'rgba(255,212,168,.05)', tone: 'rgba(255,196,140,.028)' },
    ped: { top: ['#452c1c', '#5d3e28'], front: '#2a190e', left: '#1f1209', edge: 'rgba(255,224,190,.36)', line: 'rgba(255,224,190,.10)', hot: 'rgba(255,236,212,.85)', urgent: 'rgba(255,236,212,.6)', hotFill: 'rgba(255,220,180,.05)', grain: 'rgba(255,220,182,.07)' },
  },
});
export const FLOOR_SKINS = Object.freeze(Object.keys(SKIN));
const LAMP_ON = new Set(['working', 'asked', 'silent']);
const FLOOR_PAD = 0.45, LABEL_FRONT = 0.36, BANG_BACK = 0.5, LABEL_TOP = 0.45, TILT_CA = Math.cos(47 * Math.PI / 180);
const PLANE_MIN_S = 40, PLANE_PX = 29, PLANE_FONT = `500 ${PLANE_PX}px SUIT, "Malgun Gothic", sans-serif`;
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mixRGB = (a, b, k) => { if (a === b || k <= 0) return a; if (k >= 1) return b; const x = a.split(',').map(Number), y = b.split(',').map(Number); return x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(','); };
/* 자리보다 직원이 많으면 승인을 물은 직원, 느낌표가 붙은 직원, 일하는 직원부터 앉힌다. 처음 본 차례로만 앉히면 오래 조용한 직원이 자리를 차지해,
   맨 위 글은 「열둘이 일하고 있습니다」인데 그림에는 하나만 눈을 뜨고 있었다(유호님 PC 실제 확인 11-22, 직원 스물셋).
   지난 그림에도 앉아 있던 직원은 그 자리를 그대로 쓰고, 새로 앉는 직원이 빠진 직원의 자리를 채운다. 그러지 않으면 한 명이 조용해질 때마다
   그 사이 직원이 모두 한 칸씩 옮겨 앉는다(검수 solio-office-seats-20261122 F1). 자리 수보다 적으면 전처럼 처음 본 차례다.
   자리 수와 같을 때는 지난 배치의 자리 수도 같으면 지난 자리를 잇는다(검수 -r2 FA1) */
const SEAT_RANK = Object.freeze({ working: 2, done: 3, quiet: 4, resting: 5 });
const seatRank = s => (s.status === 'asked' ? 0 : s.alert ? 1 : SEAT_RANK[s.status] ?? 9);
/* 구역 이름표. 일하는 직원이 자리를 넘어 그림에 다 없으면 알린다(맨 위 글은 일하는 수를 다 세므로, 검수 solio-office-seats-20261122 F2).
   세는 것은 어느 꼴이나 일하는 직원뿐이라 맨 위 · 왼쪽 목록과 같은 수다. 「직원 스물넷 더」는 쉬는 직원까지 센 수라 맨 위의 「직원 열이 일하고 있습니다」와
   어긋나 보였고(11-23 둘째 맹검), 쉬는 직원까지 모두 적은 「직원 서른다섯 중 여덟만 보임」도 그랬다(11-25 맹검).
   일하는 직원이 다 앉아 있으면 수를 적지 않는다. 때에 따라 쉬는 직원을 세면 같은 「+N」이 다른 것을 뜻한다(카본 solio-office-words A1).
   꼴은 셋이고 긴 것부터 들어가는 것을 쓴다. 이름이 먼저라 어느 꼴도 안 들어가면 이름만 줄여 쓴다(검수 solio-office-ga1-20261122 F1).
   - full 「 · 일하는 직원 열여섯 중 여덟만 보임」. 느낌표가 붙은 끝낸 직원이 자리를 다 차지해 앉은 일하는 직원이 없으면 「 · 일하는 직원 셋 더」
   - long 「 · 여덟 더 일함」. 「스물둘 더」는 무엇이 더 있는지 몰랐다(11-23 맹검)
   - short 「 +8」: 좁은 이름표. 「그 밖 셋」은 이름의 수가 부서 수라 어느 꼴에나 「직원」을 붙인다(F4)
   fits(글): 그 글이 이름표 폭에 들어가는가. from: 이 장면이 쓰는 꼴(더 긴 꼴은 쓰지 않는다). form은 쓴 꼴이고, clip이면 그리는 쪽이 줄인다 */
const LABEL_FORMS = Object.freeze(['full', 'long', 'short']);
const workingOf = staff => (Array.isArray(staff) ? staff : []).filter(s => LAMP_ON.has(s?.status)).length;
export function floorZoneLabel(z, fits, from = 'full') {
  const name = String(z?.name || ''), seen = workingOf(z?.staff), more = Math.max(0, (Number(z?.active) || 0) - seen);
  if (more) {
    const other = z.kind === 'other';
    const tails = {
      full: ' · 일하는 직원 ' + (seen ? countWord(seen + more) + ' 중 ' + countWord(seen) + '만 보임' : countWord(more) + ' 더'),
      long: ' · ' + (other ? '직원 ' : '') + countWord(more) + ' 더 일함',
      short: (other ? ' · 직원 ' : ' ') + '+' + more,
    };
    for (const form of LABEL_FORMS.slice(Math.max(0, LABEL_FORMS.indexOf(from)))) if (fits(name + tails[form])) return { text: name + tails[form], clip: false, form };
  }
  return { text: name, clip: true, form: 'none' };
}
/* 이 장면이 쓰는 꼴: 빠진 일하는 직원이 있는 구역마다 들어가는 가장 긴 꼴을 보고, 그 가운데 가장 짧은 꼴이다.
   어느 꼴도 안 들어가는 구역(수를 적지 못함)은 이 판단에서 뺀다(검수 solio-office-ga1b-20261122-r2 FA1). fitsOf(구역): 그 구역 이름표 폭의 fits */
export function floorLabelForm(zones, fitsOf) {
  const used = (Array.isArray(zones) ? zones : []).filter(z => z && z.hidden > 0).map(z => LABEL_FORMS.indexOf(floorZoneLabel(z, fitsOf(z)).form)); // 수를 적지 않는 구역은 -1
  return LABEL_FORMS[Math.max(0, ...used)];
}
function seated(staff, n, before) {
  // 자리 수와 같아질 때도 지난 자리를 잇는다. 넘쳤다가 그림에 없던 직원이 빠져 자리 수와 같아질 때 모두가 옮겨 앉지 않게(검수 -r2 F1)
  if (staff.length < n || (staff.length === n && !(before && before.spots?.length === n))) return staff;
  const chosen = staff.map((s, i) => [s, i]).sort(([a, i], [b, j]) => seatRank(a) - seatRank(b) || i - j).slice(0, n).sort((a, b) => a[1] - b[1]).map(([s]) => s);
  if (!before || before.spots?.length !== n || !Array.isArray(before.staff)) return chosen;
  const byId = new Map(chosen.map(s => [s.id, s]));
  const seats = Array.from({ length: n }, (_, i) => (before.staff[i] && byId.has(before.staff[i].id) ? byId.get(before.staff[i].id) : null));
  const kept = new Set(seats.filter(Boolean).map(s => s.id));
  const fresh = chosen.filter(s => !kept.has(s.id));
  return seats.map(s => s || fresh.shift());
}

/* 부서 하나의 책상 무리: 뒤에서 앞으로 한 열을 채우고 오른쪽 열로 간다. 열의 길이가 그대로면 책상이 늘어도 먼저 놓인 책상은 무리 안에서 움직이지 않는다.
   wide: 3인 책상이 하나뿐인 넓은 판. 이름은 넓은 판이면 판 위에, 그 밖에는 무리 앞 바닥에 쓴다 */
function clusterOf(plan, lines) {
  const kind = DESK[plan.size], wide = plan.size === 3 && plan.desks === 1, d = wide ? ZD : kind.d;
  // 한 열의 책상 수: 무리가 네모에 가깝게, 사무실이 고른 깊이(lines) 안에서
  const most = Math.max(1, Math.min(Math.floor(lines / kind.lines), Math.round(Math.sqrt(plan.desks * kind.w / kind.d))));
  const rows = Math.min(most, plan.desks), cols = Math.ceil(plan.desks / most);
  const width = cols * kind.w + (cols - 1) * DESK_GAP, depth = rows * d + (rows - 1) * DESK_GAP;
  return { plan, wide, w: kind.w, d, most, width, depth, slot: Math.max(SLOT_MIN, width), foot: depth + (wide ? 0 : LABEL_ROOM) };
}
const threes = list => { const out = []; for (let i = 0; i < list.length; i += 3) out.push(list.slice(i, i + 3)); return out; };
/* 띠가 앉히는 수: 여덟까지는 모두, 그 위로는 일하거나 느낌표가 붙은 직원이 다 보일 만큼만(쉬는 직원 서른이 그림을 채우지 않게, 설계 검토 P2-10).
   넷씩 늘리고, 줄일 때는 여덟이 남아야 줄인다. 한 명이 조용해질 때마다 띠의 폭이 바뀌지 않게 한다. was는 지난 배치의 자리 수다 */
const STRIP_STEP = 4;
function stripSeats(z, cap, was = 0) {
  const busy = z.staff.filter(s => LAMP_ON.has(s?.status) || s?.alert).length, need = Math.ceil(busy / STRIP_STEP) * STRIP_STEP, want = Math.max(STRIP_ONE, need);
  return Math.min(z.staff.length, z.kind === 'other' ? Math.min(cap, OTHER_MAX) : cap, was > want && was - need < STRIP_STEP * 2 ? was : want);
}
const stripLines = (n, lines, two) => (n <= STRIP_ONE && !(two && n > STRIP_BACK) ? 1 : lines);
const stripPer = (n, lines) => Math.max(1, Math.ceil(n / lines));
const stripNeed = (n, lines) => Math.max(2, stripPer(n, lines)) * STEP + 0.8;
/* 무리 줄 수(desk)와 띠 줄 수(strip)를 정했을 때의 사무실 크기 */
function packSize(plans, strips, desk, strip, two) {
  let width = 0, depth = 0;
  for (const row of threes(plans.map(p => clusterOf(p, desk)))) {
    width = Math.max(width, row.reduce((a, c) => a + c.slot, 0) + GAP * (row.length - 1));
    depth += (depth ? GAP : 0) + Math.max(...row.map(c => c.foot));
  }
  if (strips.length) {
    const lines = strips.map(n => stripLines(n, strip, two));
    width = Math.max(width, strips.reduce((a, n, i) => a + stripNeed(n, lines[i]), 0) + GAP * (strips.length - 1));
    depth += (depth ? 0.65 : 0) + STRIP + (Math.max(...lines) - 1) * STRIP_ROW + LABEL_ROOM;
  }
  return { width, depth };
}
/* 그 크기가 그림판에 얼마나 크게 들어가는가(비스듬히 보기의 어림: 몸을 16도 틀고 47도로 내려다본다). 보기를 바꿔도 같은 배치를 쓴다 */
function packScale({ width, depth }, box) {
  const pw = 0.96 * width + 0.28 * depth, ph = (0.28 * width + 0.96 * depth) * 0.73 + 0.72;
  return Math.min((box.w - 20) / pw, (box.h - 20) / ph, BIG_S);
}
/* 앉히는 한도와 줄 수를 고른다. 크기를 모르는 그림판(아직 안 보이는 방)에서는 한도를 줄이지 않고, 그때 고른 것은 다음에 잇지 않는다 */
function packOf(depts, bottom, scene, box, before, wasSeats) {
  const known = !!box, frame = box || { w: 920, h: 320 }, prev = before && before.known ? before : null, two = !!prev?.two;
  for (let cap = 0; cap < CAPS.length; cap++) {
    const [lobbyCap, deptCap] = CAPS[cap];
    const plans = depts.map(z => officeDeskPlan(z.desk, z.staff.length, scene?.seats, { held: z.held, cap: deptCap }));
    const strips = bottom.map(z => stripSeats(z, lobbyCap, wasSeats(z.key)));
    const deskMax = Math.min(ROWS_MAX, Math.max(1, ...plans.map(p => p.desks * DESK[p.size].lines)));
    const stripMax = strips.some(n => stripLines(n, 2, two) > 1) ? ROWS_MAX : 1;
    let best = null, kept = null;
    for (let desk = 1; desk <= deskMax; desk++) for (let strip = 1; strip <= stripMax; strip++) {
      const k = packScale(packSize(plans, strips, desk, strip, two), frame), one = { desk, strip, k };
      if (prev && prev.desk === desk && prev.strip === strip) kept = one;
      if (!best || k > best.k + 1e-9) best = one;
    }
    const pick = kept && kept.k >= best.k * PACK_KEEP ? kept : best;
    const enough = MIN_S * (!prev ? 1 : cap < prev.cap ? 1.06 : cap === prev.cap ? 0.94 : 1);
    if (!known || pick.k >= enough || cap === CAPS.length - 1) return { desk: pick.desk, strip: pick.strip, cap, known, two: strips.some(n => stripLines(n, pick.strip, two) > 1), plans, strips, lines: strips.map(n => stripLines(n, pick.strip, two)) };
  }
  return null;
}
/* 자리 잡기: 부서는 셋씩 두 줄이고, 줄마다 왼쪽 끝과 뒷모서리를 맞춘다. 그 아래 한 띠에 「부서 없는 일」과 「그 밖」을 나란히 둔다. 빈 부서도 그린다.
   box: 그림판의 크기(px). 무리와 띠의 줄 수, 앉히는 한도를 여기에 맞춘다. 부서마다 책상 하나(직원 셋 이하, 고르지 않음)면 11-24 C판과 같은 자리다 */
export function floorLayout(scene, prev = null, box = null) {
  const was = key => (Array.isArray(prev) ? prev.find(p => p && p.key === key) : null);
  const zones = Array.isArray(scene?.zones) ? scene.zones : [];
  const depts = zones.filter(z => z.kind === 'dept'), bottom = zones.filter(z => z.kind !== 'dept');
  const pack = packOf(depts, bottom, scene, box && box.w > 40 && box.h > 40 ? box : null, Array.isArray(prev) ? prev.pack : null, key => was(key)?.spots?.length || 0);
  const rows = threes(depts.map((z, i) => ({ z, c: clusterOf(pack.plans[i], pack.desk) })));
  const wide = Math.max(0, ...rows.map(row => row.reduce((a, { c }) => a + c.slot, 0) + GAP * (row.length - 1))), deep = rows.map(row => Math.max(...row.map(({ c }) => c.foot)));
  const depthAll = deep.reduce((a, b) => a + b, 0) + GAP * Math.max(0, rows.length - 1);
  const out = [];
  let z0 = -depthAll / 2;
  rows.forEach((row, r) => {
    let x0 = -wide / 2;
    row.forEach(({ z, c }, j) => {
      const desks = [], spots = [];
      // 넓은 판 하나의 자리는 11-24와 같다(하나 · 둘 · 셋)
      const at = c.wide ? (c.plan.seats === 1 ? [0.5] : c.plan.seats === 2 ? [0.34, 0.66] : [0.22, 0.5, 0.78]).map(f => [f, -0.18]) : DESK[c.plan.size].seats;
      for (let k = 0; k < c.plan.desks; k++) {
        const q = { key: z.key + '#' + k, x0: x0 + Math.floor(k / c.most) * (c.w + DESK_GAP), z0: z0 + (k % c.most) * (c.d + DESK_GAP) };
        q.x1 = q.x0 + c.w; q.z1 = q.z0 + c.d;
        for (const [f, dz] of at) spots.push({ x: q.x0 + c.w * f, z: (q.z0 + q.z1) / 2 + dz, desk: k });
        desks.push(q);
      }
      const shown = seated(z.staff, spots.length, was(z.key));
      out.push({
        ...z, plan: c.plan, staff: shown, hidden: z.staff.length - shown.length, active: workingOf(z.staff), desks, spots, wide: c.wide, slot: c.slot,
        rect: { x0, x1: x0 + c.width, z0, z1: z0 + c.depth },
        // 앞 바닥에 쓰는 이름은 오른쪽 부서 앞까지 쓴다. 1인 책상 하나뿐인 부서의 이름이 두 글자에서 잘리지 않게
        labelMax: j < row.length - 1 ? c.slot + GAP - 0.2 : c.slot + 1.6,
      });
      x0 += c.slot + GAP;
    });
    z0 += deep[r] + GAP;
  });
  if (bottom.length) {
    const need = bottom.map((z, i) => stripNeed(pack.strips[i], pack.lines[i]));
    const half = Math.max(wide / 2, (need.reduce((a, b) => a + b, 0) + GAP * (bottom.length - 1)) / 2);
    const height = STRIP + (Math.max(...pack.lines) - 1) * STRIP_ROW, top = rows.length ? depthAll / 2 + 0.65 : -height / 2;
    // 남는 폭은 구역마다 필요한 폭에 비례해 나눈다. 고르게 나누면 직원이 많은 구역의 구슬이 좌대 밖으로 나간다(0.5.2 공개 검수 A5)
    const total = need.reduce((a, b) => a + b, 0), spare = Math.max(0, 2 * half - GAP * (bottom.length - 1) - total);
    let x = -half;
    bottom.forEach((z, i) => {
      const width = need[i] + spare * (need[i] / total);
      const x0 = x, x1 = x0 + width, mid = (x0 + x1) / 2, n = pack.strips[i], per = stripPer(n, pack.lines[i]);
      x = x1 + GAP;
      const spots = Array.from({ length: n }, (_, k) => ({ x: mid + (k % per - (per - 1) / 2) * STEP, z: top + STRIP / 2 - 0.05 + Math.floor(k / per) * STRIP_ROW }));
      const shown = seated(z.staff, n, was(z.key));
      out.push({ ...z, staff: shown, hidden: z.staff.length - shown.length, active: workingOf(z.staff), rect: { x0, x1, z0: top, z1: top + height }, spots });
    });
  }
  Object.defineProperty(out, 'pack', { value: { desk: pack.desk, strip: pack.strip, cap: pack.cap, known: pack.known, two: pack.two } });
  return out;
}
/* 그림에 보일 자리 수(그림판이 넉넉할 때). 화면이 그림 칸의 높이를 정할 때 쓴다 */
export function floorSeatCount(scene) {
  let n = 0;
  for (const z of Array.isArray(scene?.zones) ? scene.zones : []) {
    if (z.kind !== 'dept') { n += stripSeats(z, CAPS[0][0]); continue; }
    const p = officeDeskPlan(z.desk, z.staff.length, scene.seats, { held: z.held });
    n += p.desks * p.seats;
  }
  return n;
}

/* canvas: 그림을 그릴 캔버스(자리 요소 안에 꽉 찬다). reduced(): 움직임 줄이기. isOpen(key): 그 부서 줄이 열려 있는가.
   onHover(zone, staff): 손이 가리키는 부서 열쇠와 직원 번호(바뀔 때만). onPress(zone, staff): 눌린 부서와 직원(빈 곳이면 null).
   onTalk({ id, x, y, r, endY }): 말하는 직원의 머리 자리(그릴 때마다). endY는 다가가기가 끝났을 때의 높이다(말풍선이 위아래로 뒤집히지 않게). 그 직원이 그림에 없으면 null */
export function createOfficeFloor(canvas, { win = globalThis, reduced = () => false, isOpen = () => false, onHover = () => {}, onPress = () => {}, onTalk = () => {} } = {}) {
  const ctx = canvas?.getContext?.('2d') || null;
  const raf = fn => (typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame(fn) : setTimeout(() => fn(Date.now()), M.frameMs));
  const unraf = id => (typeof win.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame(id) : clearTimeout(id));
  const clock = () => { try { return win.performance?.now?.() ?? Date.now(); } catch { return Date.now(); } };
  let scene = { view: 'tilted', viewSeq: 0, seats: 1, zones: [] }, sceneKey = '', layout = [];
  let view = 1, viewTo = 1, viewSeq = null, shown = false, frame = 0, lastDraw = -1e9, W = 0, H = 0;
  let hot = { zone: null, staff: null }, ptr = { x: -1e4, y: -1e4 }, over = { zone: null, staff: null };
  const life = new Map(); // 직원마다: 나타난 때, 깜빡임, 느낌표가 붙은 때
  let first = true, crowded = false;
  const cam = { cy: 1, sy: 0, ca: 0, sa: 1, k: 0, S: 50, S0: 50, ox: 0, oy: 0 };
  // 다가가기: 고른 부서(to)와 떠난 때의 크기 · 자리(z, x, y). 한마디: 말하는 직원과, 일어서거나 앉는 중인 직원들
  const lean = { to: null, at: -1e9, z0: 1, x0: 0, y0: 0, z: 1, x: 0, y: 0, goal: { z: 1, x: 0, y: 0 } };
  let talkId = null;
  const rises = new Map();
  let zonesOnScreen = [], staffOnScreen = [];
  // 꾸미기: 지금 스킨과 넘어가는 중인 앞 스킨, 부서마다 탁상 등의 밝기, 나뭇결 모음
  let skinFrom = 'black', skinTo = 'black', skinT0 = -1e9, skinSeq = null, rectKey = '';
  const lampK = new Map(), TEX = new Map();
  // 부서별 책상: 겹쳐 넘어갈 앞 그림과 그때, 새로 놓인 책상의 때, 손님이 책상을 고른 차례
  let ghost = null, ghostAt = -1e9, ghostOn = false, deskSeq = null;
  const deskBorn = new Map();

  function setCam(t) {
    const e = t * t * (3 - 2 * t);
    const yaw = (-16 * e) * Math.PI / 180, pitch = (90 - 43 * e) * Math.PI / 180;
    cam.cy = Math.cos(yaw); cam.sy = Math.sin(yaw); cam.ca = Math.cos(pitch); cam.sa = Math.sin(pitch); cam.k = 0.028 * e;
  }
  function P0(x, y, z) {
    const xr = x * cam.cy - z * cam.sy, zr = x * cam.sy + z * cam.cy;
    const d = zr * cam.ca + y * cam.sa, s = 1 / (1 - d * cam.k);
    return [xr * s, (zr * cam.sa - y * cam.ca) * s, d, s];
  }
  const P = (x, y, z) => { const p = P0(x, y, z); return [cam.ox + p[0] * cam.S, cam.oy + p[1] * cam.S, p[2], p[3]]; };
  // 위에서 보기에 얼마나 가까운가(비스듬히 0, 위에서 1)
  const topness = () => 1 - Math.min(1, cam.ca / TILT_CA);
  // 위에서 볼 때 이름을 앞으로 더 내리는 구역: 얕은 책상의 부서와 두 줄부터의 띠(직원이 앞 모서리 가까이 앉는다)
  const lowLabel = z => (z.kind === 'dept' ? !z.wide : z.rect.z1 - z.rect.z0 > STRIP + 0.01);
  /* fl: 스킨의 바닥 한 판(있으면 그 두께까지 잰다). hatOn: 모자를 쓴 직원이 있으면 모자와 그 위의 느낌표까지 잰다(설계 검토 12) */
  function fit(fl = null, hatOn = false) {
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
    const take = (x, y, zz) => { const p = P0(x, y, zz); a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]); };
    // 검정의 띠 이름과 얕은 책상 무리의 이름은 앞 바닥에 서므로 그 자리까지 잰다
    const ahead = z => (z.kind === 'dept' ? !z.wide : skinTo === 'black') ? LABEL_FRONT + 0.12 + (lowLabel(z) ? LABEL_TOP * topness() : 0) : 0;
    // 위에서 보면 얕은 책상에 앉은 직원의 느낌표가 책상 뒷모서리를 넘는다. 비스듬히 보기에서는 아래의 높이(1.05)가 그 몫까지 잰다
    const behind = z => (z.kind === 'dept' && !z.wide ? BANG_BACK * topness() : 0);
    for (const z of layout) for (const x of [z.rect.x0, Math.max(z.rect.x1, z.rect.x0 + (z.slot || 0))]) for (const zz of [z.rect.z0 - behind(z), z.rect.z1 + ahead(z)]) for (const y of [0, hatOn ? 1.45 : 1.05]) take(x, y, zz);
    if (fl) for (const x of [fl.x0, fl.x1]) for (const zz of [fl.z0, fl.z1]) for (const y of [0, -SKIN.walnut.floor.thick]) take(x, y, zz);
    if (!(b > a) || !(e > c)) return false;
    const pad = 10;
    cam.S = Math.max(1, Math.min((W - pad * 2) / (b - a), (H - pad * 2) / (e - c), 120));
    cam.ox = W / 2 - (a + b) / 2 * cam.S;
    cam.oy = pad + (H - pad * 2 - (e - c) * cam.S) * 0.3 - c * cam.S;
    cam.S0 = cam.S;
    return true;
  }
  /* 다가가기의 끝 모습: 고른 부서를 그림 가운데 쪽으로 데려오며 키운다. 아주 큰 무리는 조금만, 작은 책상은 1.35배까지 */
  function leanGoal() {
    const z = lean.to && layout.find(q => q.key === lean.to);
    if (!z) return { z: 1, x: 0, y: 0 };
    const pts = [[z.rect.x0, z.rect.z0], [z.rect.x1, z.rect.z0], [z.rect.x1, z.rect.z1], [z.rect.x0, z.rect.z1]].flatMap(([x, zz]) => [P(x, 0, zz), P(x, 1, zz)]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.max(M.leanMin, Math.min(M.leanMax, W * 0.5 / Math.max(1, x1 - x0), H * 0.82 / Math.max(1, y1 - y0)));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fx = cx + (W / 2 - cx) * M.leanPull;
    // 높이는 조금만 옮긴다: 머리 위에 말풍선이 들어갈 만큼 내리고, 이름이 잘리지 않을 만큼 올린다. 둘이 부딪치면 말풍선이 먼저다
    const fy = Math.max(Math.min(M.leanHead, H * 0.34) + (cy - y0) * k, Math.min(cy + (H / 2 - cy) * 0.4, H - 20 - (y1 - cy) * k));
    return { z: k, x: fx - cx * k, y: fy - cy * k };
  }
  const ease3 = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const backOut = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  function applyLean(now, still) {
    const t = still ? 1 : Math.min(1, Math.max(0, (now - lean.at) / M.leanMs)), e = ease3(t), g = lean.goal = still ? { z: 1, x: 0, y: 0 } : leanGoal();
    lean.z = lean.z0 + (g.z - lean.z0) * e; lean.x = lean.x0 + (g.x - lean.x0) * e; lean.y = lean.y0 + (g.y - lean.y0) * e;
    cam.S *= lean.z; cam.ox = cam.ox * lean.z + lean.x; cam.oy = cam.oy * lean.z + lean.y;
  }
  /* 일어선 만큼(0~1). 일어설 때만 아주 조금 넘쳤다 돌아온다 */
  function riseOf(id, now, still) {
    const r = rises.get(id);
    if (!r) return 0;
    if (still) { if (!r.to) rises.delete(id); return 0; } // 움직임 줄이기: 일어서지 않는다(카본 A3)
    const t = Math.min(1, Math.max(0, (now - r.at) / M.talkMs));
    if (t >= 1 && r.to === 0) { rises.delete(id); return 0; }
    return r.from + (r.to - r.from) * (r.to ? backOut(t) : ease3(t));
  }
  const setRise = (id, to) => { const now = clock(), k = riseOf(id, now, reduced()); if (!to && !rises.has(id)) return; rises.set(id, { from: k, to, at: now }); };
  const moving = now => now - lean.at < M.leanMs + 60 || [...rises.values()].some(r => now - r.at < M.talkMs + 60);
  function poly(pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  function clipText(text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  function eyes(x, y, R, mode, gx, gy, blink, a) {
    const ex = 0.21 * R, ey = -0.06 * R, er = Math.max(1.05, R * 0.085);
    ctx.fillStyle = ctx.strokeStyle = ink(a); ctx.lineWidth = Math.max(1, er * 0.95); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const cx = x + s * ex + gx, cy = y + ey + gy;
      ctx.beginPath();
      if (mode === 'closed') { ctx.moveTo(cx - er * 1.4, cy + er); ctx.lineTo(cx + er * 1.4, cy + er); ctx.stroke(); }
      else if (mode === 'smile') { ctx.arc(cx, cy + er * 1.3, er * 1.7, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke(); }
      else {
        // 뜬 눈은 작게 빛난다(구운 직원의 눈). 빛은 눈 둘레의 흐린 번짐 하나이고 고리를 긋지 않는다
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, er * 3.2);
        glow.addColorStop(0, ink(a * 0.32)); glow.addColorStop(1, ink(0));
        ctx.fillStyle = glow; ctx.fillRect(cx - er * 3.2, cy - er * 3.2, er * 6.4, er * 6.4);
        ctx.fillStyle = ink(a);
        ctx.beginPath(); ctx.ellipse(cx, cy, er, Math.max(0.3, er * (1 - blink)), 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  /* 직원 위의 느낌표. 꽉 찬 밝은 원 안에 검은 느낌표다(줄 이름 옆의 표와 같은 꼴). 맨 글자 하나는 맹검이 「조형 없이 띡 얹었다」고 했다(11-24) */
  function bang(x, y, R, s, life1, now, still) {
    const k = still || first ? 1 : Math.min(1, (now - (life1.popAt ?? -1e9)) / M.popMs);
    const e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
    // 구슬이 작은 그림에서는 느낌표도 작게 둔다(구슬보다 커지면 무엇에 붙었는지 모른다, 책상 설계 검토 P1-1)
    const r = Math.max(Math.min(6.5, R * 0.8), R * 0.42) * e;
    const cy = y - R - 4 - r - (s.status === 'asked' && !still ? Math.abs(Math.sin(now * Math.PI / M.bangPeriod)) * M.bangPx : 0);
    if (r < 1) return;
    ctx.save();
    const g = ctx.createRadialGradient(x, cy, r * 0.6, x, cy, r * 2.6); g.addColorStop(0, ink(0.22)); g.addColorStop(1, ink(0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, r * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink(0.97); ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
    const lw = Math.max(1.4, r * 0.2);
    ctx.strokeStyle = ctx.fillStyle = '#0b0b0a'; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, cy - r * 0.5); ctx.lineTo(x, cy + r * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, cy + r * 0.48, lw * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  /* rimInk · boost: 스킨의 테두리 빛과 그 세기. 꾸미기 줄에서 고른 직원(picked)은 테두리가 밝고 눈웃음을 짓는다 */
  function orb(x, y, R, s, now, t3, still, rimInk = INK, boost = 1, up = 0) {
    const L = up > 0.35 ? { ...LOOK.asked, mode: 'look' } : lookOf(s.status), one = life.get(s.id), isHot = up > 0.1 || hot.staff === s.id || over.staff === s.id || !!s.picked;
    const oink = a => `rgba(${rimInk},${a})`;
    // 몸: 왼쪽 위에서 빛을 받은 검은 구(첫 팀 고르기 6판의 구운 직원, 유호님 11-23 「깔끔하다」). 테두리를 고르게 긋지 않는다 —
    // 둘레 전체에 같은 선을 그으면 선으로 그린 밑그림(고리)처럼 보였다(11-23 맹검 「와이어프레임」)
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
    const lit = 0.4 + 0.6 * t3;
    const g = ctx.createRadialGradient(x - R * 0.36, y - R * 0.44, R * 0.04, x - R * 0.12, y - R * 0.14, R * 1.2);
    g.addColorStop(0, oink(Math.min(0.46, (0.2 + L.glow * 0.8) * lit)));
    g.addColorStop(0.42, oink((0.05 + L.glow * 0.22) * lit));
    g.addColorStop(1, oink(0.012));
    ctx.fillStyle = g; ctx.fill();
    // 일하는 중은 빛 받은 쪽 가장자리의 밝기만 천천히 오간다(빛줄기 · 고리 없음). 가장자리 빛은 왼쪽 위에서 오른쪽 아래로 사라진다
    let rim = L.rim;
    if (s.status === 'working' && up < 0.35) rim = still ? (M.rimLow + M.rimHigh) / 2 : M.rimLow + (M.rimHigh - M.rimLow) * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / M.rimPeriod + (one?.phase || 0)));
    const edge = Math.min(1, (isHot ? Math.max(rim, 0.85) : rim) * boost);
    const e = ctx.createLinearGradient(x - R * 0.8, y - R * 0.9, x + R * 0.7, y + R * 0.8);
    e.addColorStop(0, oink(edge)); e.addColorStop(0.5, oink(edge * 0.28)); e.addColorStop(1, oink(isHot ? edge * 0.22 : 0));
    ctx.strokeStyle = e; ctx.lineWidth = s.status === 'asked' ? 1.3 : 1;
    ctx.stroke();
    // 아주 작은 구슬에는 눈과 모자를 그리지 않는다. 느낌표는 작아도 그린다(Fable 최종 F1)
    const told = s.alert && up < 0.2; // 말하는 동안에는 말풍선이 느낌표를 대신한다
    if (R < 5) { if (told) bang(x, y, R, s, one || {}, now, still); return; }
    let gx = 0, gy = 0, mode = L.mode === 'look' ? 'open' : L.mode;
    if (s.picked && s.status !== 'asked' && up < 0.35) mode = 'smile';
    if (L.mode === 'look') {
      const dx = ptr.x - x, dy = ptr.y - y, m = Math.hypot(dx, dy) || 1, k = ptr.x < -9000 || still ? 0 : Math.min(1, m / 120) * R * M.look;
      gx = dx / m * k; gy = dy / m * k;
    } else if (mode === 'open') { gy = R * 0.16; gx = still ? 0 : Math.sin(now * 2 * Math.PI / M.gazePeriod + (one?.phase || 0)) * R * M.gaze; }
    eyes(x, y, R, mode, gx, gy, one?.blink || 0, L.eye);
    const lift = hat(x, y, R, s.hat);
    if (told) bang(x, y - lift, R, s, one || {}, now, still);
    return lift;
  }
  /* 도우미: 구 오른쪽 아래에 꽉 찬 작은 점, 셋까지. 움직이지 않는다 */
  function helpers(x, y, R, n) {
    const r = Math.max(1.6, R * 0.14);
    ctx.fillStyle = ink(0.7);
    for (let i = 0; i < Math.min(3, n); i++) { ctx.beginPath(); ctx.arc(x + R + 4 + r + i * (r * 2 + 3), y + R * 0.55, r, 0, Math.PI * 2); ctx.fill(); }
  }

  /* ── 꾸미기의 그리기(PC앱_설계.md 5절, 시안 스킨.html 985~1240행을 옮겼다) ──
     스킨은 바닥 · 부서 자리 · 빛만 바꾸고, 직원은 늘 검은 구다. 모자는 머리 위 소품이고 구의 모양 · 색 · 눈은 그대로다 */
  const HQ = (q, y) => [P(q.x0, y, q.z0), P(q.x1, y, q.z0), P(q.x1, y, q.z1), P(q.x0, y, q.z1)];
  const area = f => { let a = 0; for (let i = 0; i < f.length; i++) { const p = f[i], n = f[(i + 1) % f.length]; a += p[0] * n[1] - n[0] * p[1]; } return a / 2; };
  /* 상자의 옆면 가운데 보이는 것만(뒤로 돈 면은 그리지 않는다) */
  function faces(q, y0, y1) {
    const b = HQ(q, y0), t = HQ(q, y1), out = [];
    [['back', 0, 1], ['right', 1, 2], ['front', 2, 3], ['left', 3, 0]].forEach(([kind, i, j]) => { const f = [t[j], t[i], b[i], b[j]]; if (area(f) > 0.5) out.push({ kind, pts: f }); });
    return out;
  }
  const midOf = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function depthGrad(top, c0, c1) { const a = midOf(top[0], top[1]), b = midOf(top[3], top[2]), g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  function seg(a, b, color, w = 1) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
  function wpath(pts, y) { ctx.beginPath(); pts.forEach(([x, z], i) => { const p = P(x, y, z); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); }
  /* 바닥 위에 퍼지는 둥근 빛이나 그림자. 바닥의 원이 비스듬히 보이는 만큼 납작하게 그린다 */
  /* soft: 가장자리로 갈수록 천천히 사라진다(곧게 줄면 넓고 짙은 그림자의 끝이 둥근 선처럼 보였다, 11-24 시안) */
  const SOFT = [[0.3, 0.82], [0.55, 0.45], [0.78, 0.14], [0.92, 0.03]];
  function pool(x, y, z, rad, rgb, alpha, op, soft = false) {
    const p = P(x, y, z), R = rad * cam.S * p[3];
    if (R < 1 || alpha < 0.003) return;
    ctx.save(); if (op) ctx.globalCompositeOperation = op;
    ctx.translate(p[0], p[1]); ctx.scale(1, Math.max(0.22, cam.sa));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(${rgb},${alpha})`);
    if (soft) for (const [t, k] of SOFT) g.addColorStop(t, `rgba(${rgb},${alpha * k})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  /* 책상이 바닥에 놓인 그림자: 바닥 위의 타원이고 폭과 깊이의 반지름을 따로 둔다. 둘 중 큰 값으로 둥글게 그리면
     긴 띠(부서 없는 일)의 그림자가 뒤로 뻗어 먼저 그린 부서 책상과 이름을 덮었다(검수 solio-room-layout-20261124 대체 최종 F1) */
  function shade(cx, cz, rx, rz, alpha) {
    if (alpha < 0.003) return;
    const o = P(cx, 0, cz), ex = P(cx + rx, 0, cz), ez = P(cx, 0, cz + rz);
    const a = ex[0] - o[0], b = ex[1] - o[1], c = ez[0] - o[0], d = ez[1] - o[1];
    if (Math.abs(a * d - b * c) < 1) return;
    ctx.save(); ctx.transform(a, b, c, d, o[0], o[1]);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    for (const [t, k] of SOFT) g.addColorStop(t, `rgba(0,0,0,${alpha * k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  /* 재질의 결: 나뭇결, 마루의 널과 이음매. 책상의 결은 책상 안 좌표로, 마루의 널은 세계에 붙인 격자로 만든다. 그래서 책상이 늘어 둘레가 비켜 앉아도
     같은 책상은 같은 결이고 널 이음매가 제자리다(책상 설계 검토 P2-8). 한 번 만들어 두고 배치가 바뀌면 비운다(설계 검토 11) */
  const seedOf = text => { let h = 7; for (let i = 0; i < text.length; i++) h = Math.imul(h, 31) + text.charCodeAt(i) | 0; return Math.abs(h); };
  function tex(id, part, q, seed) {
    const key = [id, part, seed, ...(part === 'floor' ? [q.x0, q.z0, q.x1, q.z1] : [q.x1 - q.x0, q.z1 - q.z0]).map(v => v.toFixed(2))].join('|');
    if (TEX.has(key)) return TEX.get(key);
    const out = [];
    const L = (c, pts, w) => out.push({ c, pts, w }), F = (c, pts) => out.push({ c, pts, fill: true });
    const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    if (id === 'walnut') {
      const floor = part === 'floor', pl = floor ? 0.44 : 0.2, X0 = floor ? q.x0 : 0, X1 = floor ? q.x1 : q.x1 - q.x0, Z0 = floor ? q.z0 : 0, Z1 = floor ? q.z1 : q.z1 - q.z0;
      for (let i = Math.floor(Z0 / pl); i * pl < Z1 - 0.02; i++) {
        const z = Math.max(Z0, i * pl), z1 = Math.min(Z1, (i + 1) * pl), r = rng(seedOf(seed + ':' + i));
        if (z1 - z < 0.01) continue;
        if (floor) {
          if (r() < 0.5) F('tone', rect(X0, z, X1, z1));
          if (z > Z0) L('seam', [[X0, z], [X1, z]]);
          let x = -60 + r() * 2.4;
          while (x < X1 - 0.4) { if (x > X0 + 0.4) L('seam', [[x, z], [x, z1]]); x += 2.3 + r() * 1.9; }
        }
        for (const f of floor ? [0.3, 0.7] : [0.5]) {
          const zz = z + (z1 - z) * f, ph = r() * 6, amp = floor ? 0.03 : 0.016, pts = [];
          for (let x = X0; x <= X1 + 0.01; x += 0.4) pts.push([x, zz + Math.sin(x * 1.3 + ph) * amp]);
          L('grain', pts, 0.8);
        }
      }
    }
    TEX.set(key, out);
    return out;
  }
  function paintTex(id, part, q, y, seed = part) {
    const st = part === 'floor' ? SKIN[id].floor : SKIN[id].ped, dx = part === 'floor' ? 0 : q.x0, dz = part === 'floor' ? 0 : q.z0;
    for (const t of tex(id, part, q, seed)) {
      wpath(dx || dz ? t.pts.map(([x, z]) => [x + dx, z + dz]) : t.pts, y);
      if (t.fill) { ctx.closePath(); ctx.fillStyle = st[t.c]; ctx.fill(); } else { ctx.strokeStyle = st[t.c]; ctx.lineWidth = t.w || 1; ctx.stroke(); }
    }
  }
  /* 무리에 켜진 불의 세기: 책상 가운데 가장 밝은 것 */
  const litOf = z => (z.desks || []).reduce((n, q) => Math.max(n, lampK.get(q.key) || 0), 0);
  /* 스킨의 바닥: 부서 자리와 부서 없는 일의 자리까지 덮는 마루 한 판. 등이 켜진 부서 아래에 둥근 빛이 번진다 */
  function paintFloor(id, a, q, t3) {
    const f = SKIN[id].floor;
    if (!f || a < 0.003) return;
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ(q, 0);
    if (t3 > 0.02) for (const fc of faces(q, -f.thick * t3, 0)) { poly(fc.pts); ctx.fillStyle = fc.kind === 'front' ? f.front : f.left; ctx.fill(); }
    poly(top); ctx.fillStyle = depthGrad(top, f.top[0], f.top[1]); ctx.fill();
    ctx.save(); poly(top); ctx.clip();
    paintTex(id, 'floor', q, 0);
    // 바닥에 번진 빛은 무리에 하나다. 책상마다 더하면 1인 책상 여럿에서 바닥이 하얗게 뜬다(책상 설계 검토 P2-4)
    for (const z of layout) {
      const lk = litOf(z);
      if (lk > 0.01) pool((z.rect.x0 + z.rect.x1) / 2, 0, (z.rect.z0 + z.rect.z1) / 2, Math.max(3.1, Math.hypot(z.rect.x1 - z.rect.x0, z.rect.z1 - z.rect.z0) * 0.6), '255,168,92', 0.09 * lk, 'lighter');
    }
    ctx.restore();
    seg(top[3], top[2], f.edge);
    ctx.restore();
  }
  /* 호두나무 책상의 탁상 등. 그 부서에 일하는 직원이 있는 동안만 켜진다 */
  function deskLamp(q, at, slab, lk, t3) {
    // 책상 뒤 왼쪽 귀퉁이에 낮게 둔다. 시안 자리(0.36 · 0.34, 높이 0.72)에서는 첫 직원의 모자와 등불이 겹쳐 뭉개졌다(미학 맹검 11-23 C137).
    // 2인 · 4인 책상은 왼쪽 직원이 귀퉁이에 가까워 두 직원 사이 가운데에 둔다(책상 설계 검토 P2-4)
    const lx = q.x0 + (q.x1 - q.x0) * at[0], lz = q.z0 + at[1], b = P(lx, slab, lz), t = P(lx, slab + 0.6 * at[2], lz), s = 1.4 * at[2] * cam.S * t[3] / 50;
    if (t3 > 0.3) {
      seg(b, t, 'rgba(16,10,5,.95)', Math.max(1, 1.3 * s));
      ctx.save(); ctx.translate(b[0], b[1]); ctx.scale(1, Math.max(0.3, cam.sa)); ctx.beginPath(); ctx.arc(0, 0, 3.6 * s, 0, Math.PI * 2); ctx.fillStyle = '#1a1009'; ctx.fill(); ctx.restore();
    }
    // 위에서 보면 등갓은 위에서 본 꽉 찬 원이다(옆모습을 그대로 두면 시점이 어긋난다, 미학 맹검 2회차). 고리를 쓰지 않는다
    if (t3 <= 0.3) {
      const r = 4.6 * s;
      if (lk > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(t[0], t[1], 0, t[0], t[1], r * 3.2); g.addColorStop(0, `rgba(255,196,128,${0.45 * lk})`); g.addColorStop(1, 'rgba(255,196,128,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t[0], t[1], r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.beginPath(); ctx.arc(t[0], t[1], r, 0, Math.PI * 2); ctx.fillStyle = '#21150c'; ctx.fill();
      return;
    }
    const hw0 = 2.2 * s, hw1 = 6.2 * s, h0 = 5.4 * s, cx = t[0], cy = t[1], by = cy + h0 * 0.45;
    ctx.beginPath(); ctx.moveTo(cx - hw0, cy - h0 * 0.55); ctx.lineTo(cx + hw0, cy - h0 * 0.55); ctx.lineTo(cx + hw1, by); ctx.lineTo(cx - hw1, by); ctx.closePath();
    ctx.fillStyle = '#21150c'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,190,.18)'; ctx.lineWidth = 1; ctx.stroke();
    if (lk > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, by, 0, cx, by, 16 * s); g.addColorStop(0, `rgba(255,196,128,${0.55 * lk})`); g.addColorStop(1, 'rgba(255,196,128,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, by, 16 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      seg([cx - hw1, by], [cx + hw1, by], `rgba(255,220,168,${0.9 * lk})`, Math.max(1, 1.3 * s));
    }
  }
  /* 책상 하나. fin은 책상의 재질(부서가 고른 것, 없으면 스킨), skin은 사무실 스킨이다. 면과 모서리는 재질을, 불빛(위에서 내리는 빛 · 탁상 등)은 스킨을 따른다.
     일하는 중의 표시가 부서마다 달라지지 않게 한다(책상 설계 검토 C3). lamp는 이 책상의 탁상 등 자리([폭의 몫, 깊이, 크기], 없으면 null), glow는 새로 놓인 책상의 밝기 */
  function paintDesk(fin, skin, a, z, q, slab, hotZ, t3, lk, lamp, lampLit, glow) {
    const p = SKIN.walnut.ped, wood = fin === 'walnut', cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ(q, slab);
    if (slab > 0.004 && t3 > 0.02) for (const fc of faces(q, 0, slab)) {
      poly(fc.pts); ctx.fillStyle = wood ? (fc.kind === 'front' ? p.front : p.left) : fc.kind === 'front' ? 'rgb(30,30,28)' : 'rgb(12,12,11)'; ctx.fill();
      if (wood) { ctx.strokeStyle = p.line; ctx.lineWidth = 1; ctx.stroke(); }
    }
    poly(top);
    ctx.fillStyle = wood ? depthGrad(top, p.top[0], p.top[1]) : depthGrad(top, hotZ ? 'rgb(48,48,45)' : 'rgb(40,40,37)', hotZ ? 'rgb(26,26,24)' : 'rgb(19,19,18)');
    ctx.fill();
    // 일하는 직원이 있는 책상에만 빛이 떨어진다. 빛은 책상 윗면 안에서만 퍼진다
    ctx.save(); poly(top); ctx.clip();
    if (wood) paintTex('walnut', 'ped', q, slab, q.key);
    if (skin === 'walnut') { if (lamp && lampLit > 0.01) pool(q.x0 + Math.min(1, (q.x1 - q.x0) * 0.5), slab, q.z0 + Math.min(0.8, (q.z1 - q.z0) * 0.5), 2.1, '255,176,100', 0.28 * lampLit, 'lighter'); else if (lk > 0.01) pool(cx, slab, cz, 1.4, '255,176,100', 0.16 * lk, 'lighter', true); }
    else if (lk > 0.01) pool(cx, slab, cz - 0.1, Math.max(q.x1 - q.x0, q.z1 - q.z0) * 0.62, '255,236,212', (wood ? 0.08 : 0.16) * lk, 'lighter', true); // 검은 방의 나무 책상은 같은 빛에서 더 튄다
    if (glow > 0.01) pool(cx, slab, cz, Math.max(q.x1 - q.x0, q.z1 - q.z0) * 0.7, '255,236,212', 0.16 * glow, 'lighter', true);
    if (wood && hotZ) { ctx.fillStyle = p.hotFill; poly(top); ctx.fill(); }
    ctx.restore();
    // 둘레는 아주 흐리게, 빛을 받는 앞 모서리만 밝다(두께 있는 판의 모서리에 빛이 맺힌다).
    // 길을 다시 잡는다. 빛과 그림자를 그린 동그라미 길이 남아 있으면 그 둘레가 고리로 그어진다(11-24 시안 첫 캡처)
    poly(top); ctx.strokeStyle = wood ? (hotZ ? p.hot : z.urgent ? p.urgent : p.line) : ink(hotZ ? 0.42 : z.urgent ? 0.3 : 0.07); ctx.lineWidth = 1; ctx.stroke();
    seg(top[3], top[2], wood ? (hotZ ? p.hot : p.edge) : ink(hotZ ? 0.62 : 0.2 + 0.18 * lk));
    if (glow > 0.01) seg(top[3], top[2], `rgba(255,236,212,${0.7 * glow})`, 1.4);
    if (skin === 'walnut' && lamp) deskLamp(q, lamp, slab, lampLit, t3);
    ctx.restore();
  }
  /* 부서 없는 일과 「그 밖」의 자리: 스킨에서는 바닥 위의 깔개다 */
  function paintMat(id, a, z, q, hotZ) {
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ({ x0: q.x0 + 0.1, x1: q.x1 - 0.1, z0: q.z0 + 0.1, z1: q.z1 - 0.1 }, 0.004);
    poly(top); ctx.fillStyle = SKIN[id].mat; ctx.fill();
    ctx.strokeStyle = `rgba(${SKIN[id].label},${hotZ ? 0.5 : z.urgent ? 0.36 : 0.22})`; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  /* 바닥에 지는 것: 자리가 바닥에 놓인 그림자와 앞 바닥에 번진 빛. 모든 자리의 것을 책상보다 먼저 그린다. 책상마다 그림자부터 면까지 한 번에 그리면
     붙은 책상의 그림자가 먼저 그린 책상을 덮는다(책상 설계 7절) */
  function groundBlack(a, q, dept, lk, t3) {
    ctx.save(); ctx.globalAlpha *= a;
    const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    // 바닥에 닿은 둘레가 어두워야 판이 떠 보이지 않는다
    shade(cx, cz + 0.15, (q.x1 - q.x0) * 0.62, Math.max(0.5, (q.z1 - q.z0) * 0.62), dept ? 0.7 : 0.5);
    if (dept && lk > 0.01 && t3 > 0.02) pool(cx, 0, q.z1 + 0.35, (q.x1 - q.x0) * 0.42, '255,236,212', 0.035 * lk * t3, 'lighter', true); // 앞 바닥에 번진 빛
    ctx.restore();
  }
  /* 기본 「검정」의 띠(부서 없는 일 · 그 밖): 검은 판과 가는 선. 11-23부터 윗면이 뒤에서 앞으로 어두워져 두께 있는 판으로 보인다
     (선만 있던 판은 맹검이 「얇은 회색 선 사각형」 · 「와이어프레임」이라 했다) */
  function stripBlack(a, z, q, hotZ, t3) {
    ctx.save(); ctx.globalAlpha *= a;
    const y = 0.012 * t3, topF = HQ(q, y);
    if (y > 0.004 && t3 > 0.02) for (const fc of faces(q, 0, y)) { poly(fc.pts); ctx.fillStyle = fc.kind === 'front' ? 'rgb(19,19,18)' : 'rgb(12,12,11)'; ctx.fill(); }
    poly(topF); ctx.fillStyle = depthGrad(topF, 'rgb(24,24,23)', 'rgb(14,14,13)'); ctx.fill();
    ctx.save(); poly(topF); ctx.clip();
    for (let i = 0; i < Math.min(z.staff.length, z.spots.length); i++) if (LAMP_ON.has(z.staff[i].status)) pool(z.spots[i].x, y, z.spots[i].z - 0.05, 0.62, '255,236,212', 0.07, 'lighter', true);
    ctx.restore();
    poly(topF); ctx.strokeStyle = ink(hotZ ? 0.42 : z.urgent ? 0.3 : 0.05); ctx.lineWidth = 1; ctx.stroke();
    seg(topF[3], topF[2], ink(hotZ ? 0.62 : 0.1));
    ctx.restore();
  }
  /* 검정의 바닥: 자리를 모두 덮는 넓은 판이 가장자리로 갈수록 어둠에 묻힌다. 경계선을 긋지 않는다 */
  function floorBlack(a, t3) {
    if (a < 0.003 || !layout.length) return;
    const q = floorRect(1.6), top = HQ(q, 0);
    ctx.save(); ctx.globalAlpha *= a;
    poly(top); ctx.fillStyle = depthGrad(top, 'rgb(9,9,9)', `rgb(${Math.round(16 + 6 * t3)},${Math.round(16 + 6 * t3)},${Math.round(15 + 6 * t3)})`); ctx.fill();
    // 사무실 위에서 내리는 넓은 빛 한 겹(바닥의 가운데가 가장 밝다)
    pool((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2, Math.max(q.x1 - q.x0, q.z1 - q.z0) * 0.42, '243,241,236', 0.05, 'lighter', true);
    // 판의 둘레를 어둠으로 지운다(바닥에 그린 것만 있는 때에 그린다)
    const c = P((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2), e = P(q.x1, 0, (q.z0 + q.z1) / 2), f = P((q.x0 + q.x1) / 2, 0, q.z1);
    // 지우는 타원은 그림판 안에 둔다. 판이 그림판 밖까지 넓으면 둘레가 덜 지워져 바닥이 그림판 끝에서 곧게 잘렸다(대체 최종 F3)
    const rx = Math.max(10, Math.min(Math.hypot(e[0] - c[0], e[1] - c[1]), c[0] - 8, W - c[0] - 8)), ry = Math.max(6, Math.min(Math.hypot(f[0] - c[0], f[1] - c[1]), c[1] - 8, H - c[1] - 8));
    ctx.globalCompositeOperation = 'destination-in';
    ctx.translate(c[0], c[1]); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-W * 4, -H * 8, W * 8, H * 16);
    ctx.restore();
  }
  /* 일하는 직원 앞의 노트북. 화면은 직원 쪽을 보고, 화면 빛이 직원 얼굴 아래와 책상에 번진다. 빛의 세기만 4.2초에 한 번 숨쉬듯 오간다.
     자판은 직원 쪽(zh~zf)에 놓이고, 경첩은 보는 사람 쪽(zf)에 있어 뚜껑은 그쪽으로 조금 기운다. 보는 사람은 뚜껑 뒷면을 본다(대체 최종 F5) */
  function laptop(c, base, s, now, still, t3) {
    if (!LAMP_ON.has(s.status)) return;
    const one = life.get(s.id), br = still ? 1 : M.screenLow + (1 - M.screenLow) * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / M.screenPeriod + (one?.phase || 0)));
    const x0 = c.x - 0.02, x1 = c.x + 0.34, zf = c.z + 0.42, zh = c.z + 0.24, lidH = 0.21 * (0.35 + 0.65 * t3);
    const glowAt = P((x0 + x1) / 2, base + lidH * 0.55, zf - 0.1), gr = 0.62 * cam.S * glowAt[3];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(glowAt[0], glowAt[1], 0, glowAt[0], glowAt[1], gr);
    g.addColorStop(0, `rgba(226,234,255,${0.26 * br})`); g.addColorStop(0.45, `rgba(226,234,255,${0.08 * br})`); g.addColorStop(1, 'rgba(226,234,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(glowAt[0], glowAt[1], gr, 0, Math.PI * 2); ctx.fill();
    pool((x0 + x1) / 2, base, zh - 0.12, 0.42, '226,234,255', 0.12 * br, 'lighter', true); // 화면 빛이 책상에 닿는 자리
    ctx.restore();
    const b = [P(x0, base + 0.012, zh), P(x1, base + 0.012, zh), P(x1, base + 0.012, zf), P(x0, base + 0.012, zf)];
    poly(b); ctx.fillStyle = 'rgb(30,30,29)'; ctx.fill();
    seg(b[0], b[1], ink(0.22)); // 화면 빛을 받는 자판의 직원 쪽 모서리
    const lid = [P(x0, base + 0.012, zf), P(x1, base + 0.012, zf), P(x1, base + lidH, zf + 0.06), P(x0, base + lidH, zf + 0.06)];
    poly(lid); ctx.fillStyle = 'rgb(22,22,21)'; ctx.fill();
    seg(lid[3], lid[2], `rgba(226,234,255,${0.5 * br})`); // 화면 빛이 뚜껑 위 모서리로 새어 나온다
  }
  /* 바닥 위의 글: 그 자리의 바닥 축(세계의 x, z)대로 눕혀 쓴다. 화면에서 12.5px쯤으로 보이게 키를 맞춘다. 위에서 보면 그대로 똑바르다.
     스킨에서만 쓴다. 똑바른 글은 비스듬한 책상의 앞 모서리를 가로질렀다(미학 맹검 11-23 C014, 시안도 같은 지적으로 눕혔다) */
  function planeText(text, x, y, z, max) {
    ctx.save();
    ctx.font = PLANE_FONT;
    const u = 12.5 / PLANE_PX / Math.max(1, cam.S), fit = max / u;
    let s = text;
    if (ctx.measureText(s).width > fit) { while (s.length > 1 && ctx.measureText(s + '…').width > fit) s = s.slice(0, -1); s += '…'; }
    const o = P(x, y, z), ex = P(x + u, y, z), ez = P(x, y, z + u);
    ctx.translate(o[0], o[1]);
    ctx.transform(ex[0] - o[0], ex[1] - o[1], ez[0] - o[0], ez[1] - o[1], 0, 0);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  }
  /* 이름이 서는 자리: 넓은 판은 판 위, 얕은 책상 무리와 검정의 띠는 앞 바닥(띠 안에 쓰면 노트북이 글을 덮었다, 11-24 시안), 스킨의 띠는 띠 위다 */
  function labelAt(z, skin, y) {
    const q = z.rect, dept = z.kind === 'dept', front = dept ? !z.wide : skin === 'black', inset = dept && front ? 0.06 : 0.2;
    // 위에서 본 작은 그림에서는 똑바로 쓴 이름이 책상 앞 모서리에 걸린다. 글 높이만큼 앞으로 내린다(비스듬히 보면 앞줄 직원의 머리가 그 자리에 온다)
    const more = front && lowLabel(z) && cam.S0 < PLANE_MIN_S ? Math.max(0, Math.min(LABEL_TOP, 15 / cam.S0 - LABEL_FRONT)) * topness() : 0;
    const at = { front, x: q.x0 + inset, y: front ? 0 : y, z: front ? q.z1 + LABEL_FRONT + more : q.z1 - 0.2, max: dept && front ? z.labelMax - inset : q.x1 - q.x0 - inset * 2 };
    // 오른쪽 끝 부서의 이름은 무리보다 넓게 쓸 수 있다. 그림판 밖으로 나가지 않게 오른쪽 끝까지만 쓴다
    if (dept && front) { const l = P(at.x, at.y, at.z)[0], r = P(at.x + at.max, at.y, at.z)[0]; if (r > W - 10) at.max = Math.max(0.4, at.max * (W - 10 - l) / (r - l)); }
    return at;
  }
  /* 부서 이름과 빈 자리의 가는 선. 바닥에 쓴 이름은 스킨의 색, 책상 위의 것은 재질의 색이다 */
  /* late: 작은 그림에서 앞 바닥에 똑바로 쓰는 부서 이름은 직원 다음에 쓴다. 앞줄 직원의 머리와 느낌표가 이름을 가리지 않게 한다(Fable 최종 F4) */
  function zoneText(id, a, z, y, hotZ, labelFits, labelForm, late = false) {
    const fin = z.plan?.finish || id, at = labelAt(z, id, y), lc = SKIN[at.front ? id : fin].label, dark = (at.front ? id : fin) === 'black';
    const over = cam.S0 < PLANE_MIN_S && at.front && z.kind === 'dept';
    if (late && !over) return;
    ctx.save(); ctx.globalAlpha *= a;
    const lp = P(at.x, at.y, at.z), lr = P(at.x + at.max, at.y, at.z);
    ctx.fillStyle = `rgba(${lc},${hotZ || z.urgent ? 0.95 : dark ? 0.62 : 0.72})`;
    const room = Math.max(24, lr[0] - lp[0]), label = floorZoneLabel(z, labelFits(z), labelForm);
    // 그림이 작으면(좁은 창) 눕힌 글이 뭉개져 똑바로 쓴다(미학 맹검 2회차). 검정도 11-24부터 판 위에 눕힌다 —
    // 두께 있는 책상과 띠가 서자 똑바른 글이 판 모서리를 가로질렀다(맹검 「수평 글자가 판 테두리를 침범」)
    if (over && !late) { /* 이름은 직원 다음에 */ } else if (cam.S0 < PLANE_MIN_S) {
      const text = label.clip ? clipText(label.text, room) : label.text;
      // 작은 그림에서는 앞줄 직원의 머리가 이름 자리에 닿는다. 글 둘레를 어둡게 눌러 글자가 먼저 읽히게 한다
      if (at.front) { ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = id === 'black' ? 'rgba(0,0,0,.8)' : 'rgba(20,12,7,.75)'; ctx.strokeText(text, lp[0], lp[1]); }
      ctx.fillText(text, lp[0], lp[1]);
    } else planeText(label.text, at.x, at.y, at.z, at.max);
    // 빈 자리는 가는 짧은 선 하나다
    const sc = SKIN[fin].label, sd = fin === 'black';
    if (!late) for (let i = z.staff.length; i < z.spots.length; i++) {
      const c = z.spots[i], s0 = P(c.x - 0.17, y, c.z + 0.3), s1 = P(c.x + 0.17, y, c.z + 0.3);
      seg(s0, s1, `rgba(${sc},${sd ? (hotZ ? 0.22 : 0.12) : (hotZ ? 0.5 : 0.3)})`);
    }
    ctx.restore();
  }
  /* 직원 아래: 자리에 지는 그림자(스킨에만) */
  function underOrb(id, a, c, base, y, t3) {
    const k = SKIN[id];
    if (!(k.floor || k.lit) || a < 0.003) return;
    const h = Math.max(0, y - R0 - base), sp = P(c.x, base, c.z), sr = R0 * (1.25 + h * 1.6) * cam.S * sp[3], al = Math.min(0.85, k.shadow * 1.25 * (1 - Math.min(0.5, h * 1.6)) * t3) * a;
    if (sr <= 1 || al <= 0.003) return;
    ctx.save(); ctx.translate(sp[0], sp[1]); ctx.scale(1, Math.max(0.22, cam.sa));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
    g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(0.45, `rgba(0,0,0,${al * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  /* 모자를 그리고, 느낌표를 그만큼 올릴 높이를 돌려준다. 색은 디자인 토큰의 2027 실(버터 · 코랄 · 청금석 · 메도우)이다 */
  function hat(x, y, R, kind) {
    if (!kind || R < 5) return 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let top = 0;
    if (kind === 'beanie') {
      ctx.beginPath(); ctx.ellipse(x, y - R * 0.44, R * 1.0, R * 0.8, 0, Math.PI, Math.PI * 2); ctx.closePath();
      const g = ctx.createLinearGradient(x - R, y - R * 1.2, x + R, y - R * 0.3); g.addColorStop(0, '#FFE08A'); g.addColorStop(1, '#D9A42C'); ctx.fillStyle = g; ctx.fill();
      rr(x - R * 1.05, y - R * 0.6, R * 2.1, R * 0.3, R * 0.12); ctx.fillStyle = '#E3AE33'; ctx.fill(); // 접은 단
      ctx.strokeStyle = 'rgba(126,90,16,.4)'; ctx.lineWidth = Math.max(0.8, R * 0.06);
      for (const f of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(x + f * R, y - R * 0.56); ctx.lineTo(x + f * R, y - R * 0.34); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y - R * 1.28, R * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#F5C445'; ctx.fill(); // 방울
      top = R * 0.5;
    } else if (kind === 'beret') {
      ctx.translate(x + R * 0.14, y - R * 0.8); ctx.rotate(-0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.02, R * 0.36, 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(0, -R * 0.36, 0, R * 0.36); g.addColorStop(0, '#D4554A'); g.addColorStop(1, '#8E2620'); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-R * 0.04, -R * 0.32); ctx.lineTo(0, -R * 0.56); ctx.strokeStyle = '#8E2620'; ctx.lineWidth = Math.max(1, R * 0.11); ctx.stroke();
      top = R * 0.25;
    } else if (kind === 'gat') {
      const by = y - R * 0.84;
      ctx.strokeStyle = 'rgba(236,226,206,.36)'; ctx.lineWidth = Math.max(0.7, R * 0.05); // 갓끈
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.64, by + R * 0.06); ctx.quadraticCurveTo(x + s * R * 0.8, y + R * 0.4, x + s * R * 0.3, y + R * 0.94); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(x, by, R * 1.75, R * 0.42, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,19,16,.74)'; ctx.fill(); // 양태: 말총이라 비친다
      // 양태와 대우의 테두리는 짙은 나무 바닥에서도 모양이 보이게 조금 밝다(미학 맹검 11-23 C137)
      ctx.beginPath(); ctx.ellipse(x, by, R * 1.75, R * 0.42, 0, Math.PI * 1.06, Math.PI * 1.94); ctx.strokeStyle = 'rgba(236,226,206,.5)'; ctx.lineWidth = 1; ctx.stroke();
      rr(x - R * 0.46, by - R * 0.8, R * 0.92, R * 0.82, R * 0.18); ctx.fillStyle = '#16130F'; ctx.fill(); // 대우
      ctx.strokeStyle = 'rgba(236,226,206,.45)'; ctx.stroke();
      top = R * 0.66;
    } else if (kind === 'phones') {
      ctx.beginPath(); ctx.arc(x, y - R * 0.06, R * 1.14, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = '#3D6BC9'; ctx.lineWidth = Math.max(1.4, R * 0.17); ctx.stroke();
      for (const s of [-1, 1]) {
        rr(x + s * R * 1.02 - R * 0.21, y - R * 0.42, R * 0.42, R * 0.7, R * 0.19); ctx.fillStyle = '#3D6BC9'; ctx.fill();
        rr(x + s * R * 1.02 - R * 0.21 + (s < 0 ? R * 0.24 : 0), y - R * 0.34, R * 0.18, R * 0.54, R * 0.08); ctx.fillStyle = '#24448C'; ctx.fill();
      }
      top = R * 0.2;
    } else if (kind === 'sprout') {
      const b0 = y - R * 0.98, b1 = y - R * 1.44;
      ctx.beginPath(); ctx.moveTo(x, b0); ctx.quadraticCurveTo(x + R * 0.06, (b0 + b1) / 2, x, b1); ctx.strokeStyle = '#3F6B2E'; ctx.lineWidth = Math.max(1, R * 0.09); ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x, b1); ctx.quadraticCurveTo(x + s * R * 0.24, b1 - R * 0.52, x + s * R * 0.66, b1 - R * 0.3); ctx.quadraticCurveTo(x + s * R * 0.34, b1 + R * 0.06, x, b1);
        ctx.fillStyle = s < 0 ? '#7DB45A' : '#8FC46A'; ctx.fill();
      }
      top = R * 0.8;
    }
    ctx.restore();
    return top;
  }
  /* 스킨이 바뀌는 차례: 바닥(0)부터, 그다음 부서 자리가 뒤에서 앞으로(1, 2, …) 0.06초 간격, 0.38초씩 */
  const skinK = (i, now, still) => {
    if (skinFrom === skinTo || still) return 1;
    const k = Math.min(1, Math.max(0, (now - skinT0 - i * M.skinStep) / M.skinMs));
    return k * k * (3 - 2 * k);
  };
  /* 바닥 한 판: 배치한 자리를 모두 덮고 둘레에 조금 남긴다 */
  function floorRect(pad = FLOOR_PAD) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const z of layout) { x0 = Math.min(x0, z.rect.x0); x1 = Math.max(x1, z.rect.x1); z0 = Math.min(z0, z.rect.z0); z1 = Math.max(z1, z.rect.z1); }
    return { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
  }

  function draw(now = clock()) {
    lastDraw = now;
    if (!ctx || !W || !H) return;
    const still = reduced();
    const dt = Math.min(400, Math.max(0, now - (draw.last ?? now))); draw.last = now;
    view += (viewTo - view) * (still ? 1 : 1 - Math.exp(-dt / M.viewTau));
    if (Math.abs(viewTo - view) < 0.001) view = viewTo;
    ctx.clearRect(0, 0, W, H);
    zonesOnScreen = []; staffOnScreen = [];
    if (!layout.length) return;
    const t3 = view * view * (3 - 2 * view);
    // 책상의 불: 그 책상에 일하는(승인을 물은 · 소식 없는) 직원이 있으면 켠다. 첫 그림과 움직임 줄이기에서는 바로(설계 검토 10)
    for (const z of layout) {
      const on = new Set();
      z.staff.forEach((s, i) => { if (LAMP_ON.has(s.status) && z.spots[i]) on.add(z.spots[i].desk); });
      (z.desks || []).forEach((q, k) => {
        const want = on.has(k) ? 1 : 0, was = lampK.get(q.key);
        lampK.set(q.key, still || first || was === undefined ? want : was + (want - was) * (1 - Math.exp(-dt / M.lampTau)));
      });
    }
    const A = skinFrom, B = skinTo, order = [...layout].sort((a, b) => P0(0, 0, a.rect.z0)[2] - P0(0, 0, b.rect.z0)[2]);
    if (A !== B && skinK(1 + order.length, now, still) >= 1) skinFrom = skinTo;
    const mix = k => (A === B ? [[B, 1]] : [[A, 1 - k], [B, k]]);
    const floorOn = !!(SKIN[A].floor || SKIN[B].floor), fl = floorOn ? floorRect() : null;
    const hatOn = layout.some(z => z.staff.some(s => s.hat));
    setCam(view);
    if (!fit(fl, hatOn)) return;
    ctx.font = '400 12.5px SUIT, "Malgun Gothic", sans-serif'; ctx.textBaseline = 'alphabetic';
    // 이름표 폭. 한 장면 안에서는 빠진 수를 한 꼴로 적는다: 어느 구역이든 긴 꼴이 안 들어가면 모두 그다음 꼴이다(검수 solio-office-ga1b-20261122 F2)
    const slabB = SKIN[B].slab * t3;
    const labelFits = z => { const at = labelAt(z, B, z.kind === 'dept' ? slabB : 0), room = Math.max(24, P(at.x + at.max, at.y, at.z)[0] - P(at.x, at.y, at.z)[0]); return t => ctx.measureText(t).width <= room; };
    const labelForm = floorLabelForm(layout, labelFits);
    applyLean(now, still);
    // 검정 스킨: 가장자리로 갈수록 어둠에 묻히는 바닥 한 판(11-24 「불 켜진 자리」). 다른 스킨의 바닥보다 먼저 그려야 둘레 지우기가 그것만 지운다
    const blackK = mix(skinK(0, now, still)).reduce((n, [id, a]) => n + (id === 'black' ? a : 0), 0);
    if (blackK > 0.01) floorBlack(blackK, t3);
    if (fl) { const k0 = skinK(0, now, still); for (const [id, a] of mix(k0)) paintFloor(id, a, fl, t3); }
    const kZ = new Map(), yZ = new Map(), hotOf = new Map(), desks = [];
    order.forEach((z, i) => {
      const k = A === B ? 1 : skinK(1 + i, now, still), slabOf = id => SKIN[z.plan?.finish || id].slab, y = z.kind === 'dept' ? (slabOf(A) * (1 - k) + slabOf(B) * k) * t3 : 0;
      kZ.set(z.key, k); yZ.set(z.key, y);
      hotOf.set(z.key, hot.zone === z.key || over.zone === z.key || isOpen(z.key) || z.staff.some(s => s.picked));
      // 얕은 책상(1인 · 2인)은 무리에 등 하나(첫 책상)다. 작은 등이 줄지어 서지 않게 한다(책상 설계 검토 P2-4)
      (z.desks || []).forEach((q, n) => desks.push({ z, q, n, k, y, depth: P0((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2)[2], lamp: z.wide ? WIDE_LAMP : z.plan.size >= 3 || n === 0 ? DESK[z.plan.size].lamp : null, lone: !z.wide && z.plan.size < 3 }));
      zonesOnScreen.push({ key: z.key, pts: HQ(z.rect, y) });
    });
    desks.sort((a, b) => a.depth - b.depth);
    // 바닥에 지는 것 → 띠와 책상(뒤에서 앞으로) → 이름과 빈자리 → 직원
    for (const z of order) if (z.kind !== 'dept') for (const [id, a] of mix(kZ.get(z.key))) if (id === 'black' && a >= 0.003) groundBlack(a, z.rect, false, 0, t3);
    for (const { z, q, k } of desks) for (const [id, a] of mix(k)) {
      if (a < 0.003) continue;
      const fin = z.plan.finish || id;
      if (fin === 'black' || id === 'black') groundBlack(a, q, true, id === 'black' ? lampK.get(q.key) || 0 : 0, t3);
    }
    for (const z of order) if (z.kind !== 'dept') for (const [id, a] of mix(kZ.get(z.key))) { if (a < 0.003) continue; if (id === 'black') stripBlack(a, z, z.rect, hotOf.get(z.key), t3); else paintMat(id, a, z, z.rect, hotOf.get(z.key)); }
    for (const { z, q, k, y, lamp, lone } of desks) {
      const lk = lampK.get(q.key) || 0, age = now - (deskBorn.get(q.key) ?? -1e9), glow = still || age >= M.freshMs ? 0 : Math.pow(1 - Math.max(0, age) / M.freshMs, 1.6);
      for (const [id, a] of mix(k)) if (a >= 0.003) paintDesk(z.plan.finish || id, id, a, z, q, y, hotOf.get(z.key), t3, lk, lamp, lone ? litOf(z) : lk, glow);
    }
    for (const z of order) for (const [id, a] of mix(kZ.get(z.key))) if (a >= 0.003) zoneText(id, a, z, yZ.get(z.key), hotOf.get(z.key), labelFits, labelForm);
    const list = [];
    for (const z of layout) {
      const base = yZ.get(z.key) || 0;
      z.staff.slice(0, z.spots.length).forEach((s, i) => {
        const c = z.spots[i], L = lookOf(s.status), up = riseOf(s.id, now, still), y = base + R0 + L.lift * (0.25 + 0.75 * t3) + M.talkUp * up * (0.25 + 0.75 * t3), p = P(c.x, y, c.z);
        list.push({ s, z, c, base, y, p, up, R: R0 * cam.S * p[3] * (1 + M.talkGrow * up), depth: p[2] + (up > 0.02 ? 1e3 : 0) });
        const one = life.get(s.id);
        if (one && !still) {
          if (one.blink > 0) one.blink = Math.max(0, one.blink - dt / M.blinkMs);
          else if (now > one.nextBlink) { one.blink = 1; one.nextBlink = now + M.blinkMin + Math.random() * M.blinkSpan; }
        }
      });
    }
    list.sort((a, b) => a.depth - b.depth);
    let told = null;
    for (const { s, z, c, base, y, p, R, up } of list) {
      const one = life.get(s.id), k = kZ.get(z.key) ?? 1, near = k < 0.5 ? A : B;
      const alpha = still || first || !one ? 1 : Math.min(1, (now - one.bornAt) / M.fadeMs);
      ctx.save(); ctx.globalAlpha = alpha;
      for (const [id, a] of mix(k)) underOrb(id, a, c, base, y, t3);
      if (s.subagents > 0) helpers(p[0], p[1], R, s.subagents);
      const hatUp = orb(p[0], p[1], R, s, now, t3, still, mixRGB(SKIN[A].rim, SKIN[B].rim, k), SKIN[near].boost || 1, up) || 0;
      if (s.id === talkId) told = { id: s.id, x: p[0], y: p[1] - hatUp, r: R, endY: (p[1] - hatUp - lean.y) / lean.z * lean.goal.z + lean.goal.y };
      // 검정에서는 일하는 직원 앞에 노트북이 열려 있다(직원보다 앞이라 직원 뒤에 그린다)
      const lapA = (A === 'black' ? 1 - k : 0) + (B === 'black' ? k : 0);
      if (lapA > 0.01) { ctx.save(); ctx.globalAlpha *= lapA; laptop(c, base, s, now, still, t3); ctx.restore(); }
      ctx.restore();
      staffOnScreen.push({ id: s.id, zone: s.zone, x: p[0], y: p[1], r: R });
    }
    for (const z of order) for (const [id, a] of mix(kZ.get(z.key))) if (a >= 0.003) zoneText(id, a, z, yZ.get(z.key), hotOf.get(z.key), labelFits, labelForm, true);
    crowded = list.length > M.crowd;
    softEdge();
    crossFade(now, still);
    first = false;
    if (talkId) onTalk(told);
  }
  /* 다가간 그림은 칸 밖으로 잘린다. 잘린 자리가 칼로 벤 듯 보이지 않게 네 가장자리를 바탕으로 흐린다 */
  function softEdge() {
    const a = Math.min(1, Math.max(0, (lean.z - 1) / 0.1));
    if (a < 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    const wipe = (x0, y0, x1, y1, w, h, n) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.35, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w || n, h || n); };
    const n = Math.min(M.leanEdge, W * 0.08), v = Math.min(M.leanEdge * 0.6, H * 0.12);
    wipe(0, 0, n, 0, n, H); wipe(W, 0, W - n, 0, n, H); wipe(0, 0, 0, v, W, v); wipe(0, H, 0, H - v, W, v);
    ctx.restore();
  }
  /* 앞 그림에서 새 그림으로 겹쳐 넘어간다. 새 그림을 e만큼, 앞 그림을 1 − e만큼 남겨 더한다 */
  function crossFade(now, still) {
    if (!ghostOn) return;
    const p = (now - ghostAt) / M.layoutMs;
    if (still || first || !ghost || !(p < 1) || ghost.width !== canvas.width || ghost.height !== canvas.height) { ghostOn = false; return; }
    const t = Math.max(0, p), e = t * t * (3 - 2 * t);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = `rgba(0,0,0,${e})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - e; ctx.drawImage(ghost, 0, 0);
    ctx.restore();
  }
  /* 지금 그림을 앞 그림으로 떠 둔다 */
  function keepFrame() {
    ghostOn = false;
    if (!ctx || !canvas.width || !canvas.height) return;
    try {
      if (!ghost) ghost = canvas.ownerDocument?.createElement?.('canvas') || null;
      const g = ghost?.getContext?.('2d');
      if (!g) return;
      ghost.width = canvas.width; ghost.height = canvas.height;
      g.drawImage(canvas, 0, 0);
      ghostAt = clock(); ghostOn = true;
    } catch { ghost = null; }
  }
  function loop(t) {
    frame = 0;
    if (!shown || reduced()) return;
    frame = raf(loop);
    if (t - lastDraw >= (moving(t) ? 0 : crowded && !ghostOn ? M.crowdMs : M.frameMs)) draw(t);
  }
  function kick() {
    if (!shown) return;
    if (reduced()) { if (frame) { unraf(frame); frame = 0; } draw(); return; }
    if (!frame) frame = raf(loop);
  }
  function resize() {
    if (!canvas) return;
    const box = canvas.parentElement?.getBoundingClientRect?.() || { width: 0, height: 0 };
    const dpr = Math.min(2, Number(win.devicePixelRatio) || 1);
    W = Math.round(box.width); H = Math.round(box.height);
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    ghostOn = false;
    place();
    // 크기가 바뀌어 놓이거나 빠진 책상은 새 책상이 아니다. 다음 장면에서 뒤늦게 밝아지지 않게 여기서 맞춘다(0.5.12 공개 후보 카본 A1)
    const keys = new Set(layout.flatMap(z => (z.desks || []).map(q => q.key)));
    for (const k of keys) if (!deskBorn.has(k)) deskBorn.set(k, -1e9);
    for (const m of [deskBorn, lampK]) for (const k of [...m.keys()]) if (!keys.has(k)) m.delete(k);
    if (shown) draw();
  }
  /* 배치를 다시 잡는다. 자리가 바뀌었으면 나뭇결 모음을 비우고 참을 돌려준다 */
  function place() {
    layout = floorLayout(scene, layout, { w: W, h: H });
    const rk = layout.map(z => (z.desks || [z.rect]).map(q => [q.x0, q.x1, q.z0, q.z1].map(v => v.toFixed(2)).join(',')).join('/')).join(';');
    if (rk === rectKey) return false;
    rectKey = rk; TEX.clear();
    return true;
  }
  const ro = typeof win.ResizeObserver === 'function' && canvas?.parentElement ? new win.ResizeObserver(() => resize()) : null;
  ro?.observe(canvas.parentElement);

  /* 손: 부서에 다가가면 그 부서의 줄이 열리고(화면이 정한 머무는 시간 뒤), 직원을 가리키면 그 직원의 줄이 밝아진다 */
  function inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function hit(x, y) {
    let st = null;
    for (const s of staffOnScreen) if (Math.hypot(x - s.x, y - s.y) < s.r + 6) st = s;
    let zone = st ? st.zone : null;
    // 「그 밖」 구역은 줄이 따로 없어 누를 곳이 아니다. 그 안의 직원은 제 부서로 간다(카본 A4)
    if (!zone) for (const q of zonesOnScreen) if (q.key !== 'other' && inside(q.pts, x, y)) zone = q.key;
    return { zone, staff: st ? st.id : null };
  }
  const at = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = e => {
    const p = at(e); ptr = p;
    const h = hit(p.x, p.y);
    canvas.style.cursor = h.zone ? 'pointer' : '';
    if (h.zone !== over.zone || h.staff !== over.staff) { over = h; if (reduced()) draw(); onHover(h.zone, h.staff, e); }
  };
  const onLeave = e => { ptr = { x: -1e4, y: -1e4 }; canvas.style.cursor = ''; if (over.zone || over.staff) { over = { zone: null, staff: null }; if (reduced()) draw(); onHover(null, null, e); } };
  const onClick = e => { const p = at(e), h = hit(p.x, p.y); onPress(h.zone, h.staff); };
  canvas?.addEventListener?.('pointermove', onMove);
  canvas?.addEventListener?.('pointerleave', onLeave);
  canvas?.addEventListener?.('click', onClick);

  return {
    /* 장면을 받는다. 같은 장면이면 아무것도 하지 않는다. 보기는 손님이 바꾼 때(viewSeq가 바뀜)만 옮겨 가고, 그 밖에는 바로 그 각도다 */
    setScene(next) {
      const s = next && typeof next === 'object' ? next : { view: 'tilted', viewSeq: 0, seats: 1, zones: [] };
      const key = JSON.stringify(s);
      if (key === sceneKey) return;
      sceneKey = key; scene = s;
      const want = s.view === 'top' ? 0 : 1;
      if (viewSeq === null || s.viewSeq === viewSeq || reduced()) { view = viewTo = want; } else viewTo = want;
      viewSeq = s.viewSeq;
      // 책상이 늘거나 줄거나 손님이 책상을 고르면 앞 그림에서 새 그림으로 겹쳐 넘어간다. 첫 그림, 숨은 방, 움직임 줄이기에서는 바로다
      const still = reduced(), before = new Set(layout.map(z => z.key)), picked = deskSeq !== null && (s.deskSeq ?? 0) !== deskSeq, live = shown && !first && !still;
      const look = layout.map(z => z.plan?.finish || '').join();
      deskSeq = s.deskSeq ?? 0;
      // 자리를 다시 잡아도 캔버스에는 아직 앞 그림이 있다. 바뀐 것이 있을 때만 떠 두어, 넘어가는 중에 온 상태 바뀜이 넘어가기를 끊지 않는다
      const moved = place();
      if (live && (moved || (picked && look !== layout.map(z => z.plan?.finish || '').join()))) keepFrame();
      const t0 = clock(), keys = new Set();
      for (const z of layout) for (const q of z.desks || []) { keys.add(q.key); if (!deskBorn.has(q.key)) deskBorn.set(q.key, live && before.has(z.key) ? t0 : -1e9); }
      for (const k of [...deskBorn.keys()]) if (!keys.has(k)) deskBorn.delete(k);
      // 스킨은 손님이 고른 때(skinSeq가 바뀜)만 겹쳐 넘어가고, 그 밖에는 바로 그 스킨이다(설계 검토 10)
      const skin = Object.hasOwn(SKIN, s.skin) ? s.skin : 'black';
      // 넘어가는 중에 같은 skinSeq의 다른 장면(직원 상태 바뀜)이 와도 넘어가기를 끊지 않는다. 스킨까지 다르면 판을 따라 바로 바꾼다(최종 검수 F3)
      if (skinSeq === null || reduced() || !shown) { skinFrom = skinTo = skin; skinT0 = -1e9; }
      else if (s.skinSeq === skinSeq) { if (skin !== skinTo) { skinFrom = skinTo = skin; skinT0 = -1e9; } }
      else if (skin !== skinTo) { skinFrom = skinTo; skinTo = skin; skinT0 = clock(); }
      skinSeq = s.skinSeq ?? 0;
      for (const k of [...lampK.keys()]) if (!keys.has(k)) lampK.delete(k);
      const t = clock(), ids = new Set();
      for (const z of layout) for (const st of z.staff) {
        ids.add(st.id);
        const one = life.get(st.id);
        if (!one) life.set(st.id, { bornAt: first ? -1e9 : t, blink: 0, nextBlink: t + 1500 + Math.random() * 5000, phase: Math.random() * Math.PI * 2, alert: st.alert, popAt: st.alert && !first ? t : -1e9 });
        else { if (st.alert && !one.alert) one.popAt = t; one.alert = st.alert; }
      }
      for (const id of [...life.keys()]) if (!ids.has(id)) life.delete(id);
      if (shown) { draw(); kick(); }
    },
    /* 대화 상대가 바뀌었다: 그 부서로 다가간다. zone이 없거나 그림에 없으면 전체로 돌아온다. now: 움직이지 않고 바로(방을 다시 열 때) */
    lean(zone, { now = false } = {}) {
      const to = zone && layout.some(z => z.key === zone) ? zone : null;
      if (to === lean.to && !now) return;
      lean.to = to;
      if (now || reduced() || !shown) { lean.at = -1e9; lean.z0 = 1; lean.x0 = lean.y0 = 0; if (!to) { lean.z = 1; lean.x = lean.y = 0; } }
      else { lean.at = clock(); lean.z0 = lean.z; lean.x0 = lean.x; lean.y0 = lean.y; }
      if (shown) { draw(); kick(); }
    },
    /* 직원 하나가 말한다(null이면 앉는다) */
    talk(id) {
      const next = id || null;
      // 같은 직원을 다시 누르면 말이 바뀌므로 말풍선 자리를 다시 잰다(카본 A1)
      if (next === talkId) { if (shown) draw(); return; }
      if (talkId) setRise(talkId, 0);
      talkId = next;
      if (talkId) setRise(talkId, 1);
      if (shown) { draw(); kick(); }
    },
    leaning: () => ({ to: lean.to, z: lean.z }),
    talking: () => talkId,
    /* 시험이 본다: 그 직원이 일어선 만큼(0~1) */
    standing: id => riseOf(id, clock(), reduced()),
    setHot(next) { const h = { zone: next?.zone || null, staff: next?.staff || null }; if (h.zone === hot.zone && h.staff === hot.staff) return; hot = h; if (shown && reduced()) draw(); },
    /* 방이 보이는 동안만 그린다 */
    show(on) {
      const want = !!on;
      if (want === shown) { if (want) kick(); return; }
      shown = want;
      if (!want) { if (frame) { unraf(frame); frame = 0; } first = true; talkId = null; rises.clear(); lean.to = null; lean.at = -1e9; lean.z = lean.z0 = 1; lean.x = lean.x0 = lean.y = lean.y0 = 0; return; }
      resize();
      draw();
      kick();
    },
    redraw() { if (shown) draw(); },
    zones: () => layout.map(z => z.key),
    view: () => (viewTo ? 'tilted' : 'top'),
    /* 시험이 본다: 지금 스킨(넘어가는 중이면 앞 스킨도)과 나뭇결 모음의 크기 */
    skin: () => ({ from: skinFrom, to: skinTo }),
    texSize: () => TEX.size,
    /* 시험이 본다: 놓인 책상의 열쇠, 앞 그림과 겹쳐 넘어가는 중인가, 불 모음의 크기, 고른 줄 수와 한도 */
    desks: () => layout.flatMap(z => (z.desks || []).map(q => q.key)),
    fading: () => ghostOn,
    lampSize: () => lampK.size,
    pack: () => layout.pack || null,
    dispose() {
      shown = false;
      if (frame) { unraf(frame); frame = 0; }
      ro?.disconnect();
      canvas?.removeEventListener?.('pointermove', onMove);
      canvas?.removeEventListener?.('pointerleave', onLeave);
      canvas?.removeEventListener?.('click', onClick);
    },
  };
}
