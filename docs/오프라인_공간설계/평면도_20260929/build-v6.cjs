// Build coordinate data only. The 5th concept and its preview remain unchanged.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '공간과_편의시설_좌표_5안.json'), 'utf8'));
const plan = structuredClone(base);
const rect = (room, kind, x, y, w, h, label, extra = {}) => ({ room, kind, x, y, w, h, label, ...extra });
const round = n => Math.round(n * 1e6) / 1e6;
function translate(value, dx, dy = 0) {
  if (Array.isArray(value)) return value.map(v => translate(v, dx, dy));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) out[key] = (key === 'x' || key === 'cx') && typeof val === 'number' ? round(val + dx) : (key === 'y' || key === 'cy') && typeof val === 'number' ? round(val + dy) : translate(val, dx, dy);
  return out;
}
Object.assign(plan, { revision: 6, baseRevision: 5, status: 'concept-not-measured', outline: { w: 19, h: 14.1 } });
const roomChanges = {
  D: { x: .2, y: 8.7, w: 5.75, h: 5.2, note: '5.75 × 5.20 m · 개인 책상 16개 · 왼쪽 TV/강사와 같은 방향으로 착석 · 북서쪽 입구' },
  office: { x: 6.1, y: 8.7, w: 4, h: 5.2, note: '4.00 × 5.20 m · 양측 벽에 개인 책상 4개씩, 8자리 · 착석 여유를 뺀 중앙 1.50 m 통로 가정' },
  consult: { x: 10.25, y: 8.7, w: 2.6, h: 5.2, note: '2.60 × 5.20 m · 4인 상담 / 가구 수납 후 2 × 2 m VR 비움 · 기존보다 뒤쪽 1.10 m 여유' },
  photo: { x: 13, y: 8.7, w: 2.15, h: 5.2, note: '2.15 × 5.20 m · 앞 1.50 m 커피·다과 + 뒤 3.70 m 사진·정비 · 늘어난 1.10 m는 소품/정비 여유, 별도 방 아님' }
};
for (const r of plan.rooms) if (roomChanges[r.id]) Object.assign(r, roomChanges[r.id]);
plan.rooms.push(
  { id: 'WC-M', name: '남자 화장실', short: '남자 화장실', type: 'restroom', x: 16.65, y: 8.7, w: 2.15, h: 2.475, note: '2.15 × 2.475 m · 양변기 1 + 세면대 1 · 1인 잠금실 초기안, 기구 수 적정성 미확정' },
  { id: 'WC-F', name: '여자 화장실', short: '여자 화장실', type: 'restroom', x: 16.65, y: 11.425, w: 2.15, h: 2.475, note: '2.15 × 2.475 m · 양변기 1 + 세면대 1 · 1인 잠금실 초기안, 기구 수 적정성 미확정' }
);
plan.secondaryCorridors = [{ id: 'wc-access', x: 15.3, y: 8.7, w: 1.2, h: 5.2, label: '화장실 접근통로 1.20 m', status: '주복도에서 두 화장실까지 연결. 문짝은 통로로 열리지 않는 슬라이딩 후보이며 1.20 m 폭에 대기·수납을 두지 않음' }];
plan.doors = plan.doors.filter(d => ['A', 'B', 'C'].includes(d.room));
plan.doors.push(
  { room: 'D', x: .6, y: 8.7, w: 1, swing: 'south' },
  { room: 'office', x: 7.6, y: 8.7, w: .95, swing: 'south' },
  { room: 'consult', x: 10.5, y: 8.7, w: .9, swing: 'south' },
  { room: 'photo', x: 13.25, y: 8.7, w: .9, swing: 'south' },
  { room: 'WC-M', x: 16.65, y: 8.9, w: 1, h: 1, swing: 'slide', orientation: 'vertical', slideDirection: 'south', clearOpening: .95, pocket: { x: 16.5, y: 9.9, w: .15, h: 1 }, note: '벽 안 수납형 슬라이딩 후보. 1.00 m 벽 개구와 약 0.95 m 유효폭은 제품 미선정 가정; 화장실 잠금·외부 비상해제·차음 상세 필요' },
  { room: 'WC-F', x: 16.65, y: 12.7, w: 1, h: 1, swing: 'slide', orientation: 'vertical', slideDirection: 'north', clearOpening: .95, pocket: { x: 16.5, y: 11.7, w: .15, h: 1 }, note: '벽 안 수납형 슬라이딩 후보. 1.00 m 벽 개구와 약 0.95 m 유효폭은 제품 미선정 가정; 화장실 잠금·외부 비상해제·차음 상세 필요' }
);
// Keep north classrooms, their walls, and the original east entrance intact.
plan.walls = [
  [0, 0, 19, .2], [0, 0, .2, 14.1], [0, 13.9, 19, .2],
  [18.8, 0, .2, 7.05], [18.8, 8.45, .2, 5.65],
  ...base.walls.filter(w => w[1] === .2 && w[2] === .15),
  ...base.walls.filter(w => w[1] === 6.8),
  ...[5.95, 10.1, 12.85, 15.15].map(x => [x, 8.7, .15, 5.2]),
  [16.5, 8.7, .15, .2], [16.5, 9.9, .15, 2.8], [16.5, 13.7, .15, .2],
  [16.65, 11.175, 2.15, .25]
];
let wallStart = .2;
for (const [start, end] of [[.6, 1.6], [7.6, 8.55], [10.5, 11.4], [13.25, 14.15], [15.3, 16.5]]) {
  if (start > wallStart) plan.walls.push([wallStart, 8.55, round(start - wallStart), .15]);
  wallStart = end;
}
plan.walls.push([wallStart, 8.55, round(18.8 - wallStart), .15]);

plan.furniture = plan.furniture.filter(f => !['D', 'office'].includes(f.room));
for (const x of [1.7, 2.75, 3.8, 4.85]) for (const y of [9.1, 9.9, 11.9, 12.7]) {
  plan.furniture.push(rect('D', 'desk', x, y, .45, .6, '개인 책상', { faces: '-x' }));
  plan.furniture.push(rect('D', 'chair', round(x + .55), round(y + .1), .4, .4, '학생 의자', { faces: '-x' }));
}
for (const y of [8.9, 10.1, 11.3, 12.5]) {
  plan.furniture.push(rect('office', 'desk', 6.1, y, .6, 1.2, '개인 업무 책상', { faces: '-x' }));
  plan.furniture.push(rect('office', 'chair', 6.82, round(y + .375), .45, .45, '업무 의자', { faces: '-x' }));
  plan.furniture.push(rect('office', 'desk', 9.5, y, .6, 1.2, '개인 업무 책상', { faces: '+x' }));
  plan.furniture.push(rect('office', 'chair', 8.93, round(y + .375), .45, .45, '업무 의자', { faces: '+x' }));
}
plan.officeLayout = {
  deskCount: 8, deskSize: { w: 1.2, d: .6 },
  workingEnvelopes: [rect('office', 'occupied-chair-band', 6.7, 8.9, .65, 4.8, '왼쪽 착석/당김 후보 띠'), rect('office', 'occupied-chair-band', 8.85, 8.9, .65, 4.8, '오른쪽 착석/당김 후보 띠')],
  clearAisle: rect('office', 'aisle', 7.35, 8.7, 1.5, 5.2, '중앙 통로 1.50 m'),
  note: '8개의 1.20 × 0.60 m 개인 책상을 양측 벽에 4개씩 둔 배치. 통로는 의자 사용을 각 .65 m로 가정한 잔여치이며 실제 의자·책상 제품과 동시 사용 시험 필요.'
};
Object.assign(plan.teachers.find(t => t.room === 'D'), { x: 1.15, y: 11.2, faces: '+x' });
Object.assign(plan.cameras.find(c => c.room === 'D'), { x: 3.25, y: 11.2, aim: { x: 1.15, y: 11.2 }, equipment: { x: .8, y: 12.5 }, planDistance: 2.1 });
Object.assign(plan.displays.find(d => d.room === 'D'), { x: .35, y: 10.2, w: .12, h: 2, faces: '+x' });
const appliancePositions = {
  'AP-D': [.7, 9.85], 'H-D': [.45, 13.35],
  'AP-office': [6.9, 13.45], 'H-office': [8.95, 13.5],
  'AP-consult': [10.33, 13.35], 'H-consult': [12.3, 13.35],
  'AP-photo': [14.6, 13.35], 'H-photo': [13.05, 12.35]
};
for (const a of plan.appliances) if (appliancePositions[a.id]) [a.x, a.y] = appliancePositions[a.id];
plan.consultation = translate(base.consultation, -3.65);
plan.photoConvenience = translate(base.photoConvenience, -3.65);
plan.photoConvenience.rearZone.h = 3.7;
plan.photoConvenience.rearZone.label = '사진·정비 영역';
plan.photoConvenience.backdrop.y = 13.8;
plan.photoConvenience.extensionUse = rect('photo', 'rear-maintenance-zone', 13, 12.8, 2.15, 1.1, '추가된 뒤쪽 정비·소품 여유', { partition: false, status: '독립실이나 추가 구획벽이 아닌 기존 사진 공간의 연장. 앞쪽 촬영 기준점·카메라 1.40 m 거리는 그대로이며 촬영 구도는 실증 필요.' });
plan.photoConvenience.fixtures.push(rect('photo', 'supply-cabinet', 13, 12.85, .4, .65, '닫힌 소모품·소품장', { status: '0.40 × 0.65 m 외곽 후보. 0.45 m 전면 서비스 여유를 따로 표시; 물건 적재량·문짝 방식 제품 미확정' }));
plan.photoConvenience.serviceZones = [rect('photo', 'cabinet-service', 13.4, 12.85, .45, .65, '소품장 앞 정비 여유'), rect('photo', 'printer-service', 13.85, 10.55, .65, .6, '프린터 장비함 앞 점검 후보 여유')];
plan.photoConvenience.constraint += ' 6안의 뒤쪽 1.10 m 연장은 장비 정비·소모품·소품 여유로 쓰며 추가 분리벽을 만들지 않음.';

plan.restrooms = {
  type: 'two-separate-single-occupant-rooms',
  allocation: '남자 1실 + 여자 1실. 각각 양변기 1개와 세면대 1개를 두는 초기 배치안; 이용인원에 따른 기구 수는 확정하지 않음.',
  fixtures: [
    rect('WC-M', 'toilet', 18.2, 10.475, .4, .7, '양변기', { faces: '-y', tankSide: '+y', status: '제품 미선정 외곽 가정; 배관 접속·손잡이·좌우 접근 상세 미확정' }),
    rect('WC-M', 'washbasin', 18.3, 8.9, .5, .6, '세면대', { faces: '-x', status: '제품 미선정 외곽 가정; 하부 무릎 공간·높이 미확정' }),
    rect('WC-F', 'toilet', 18.2, 11.425, .4, .7, '양변기', { faces: '+y', tankSide: '-y', status: '제품 미선정 외곽 가정; 배관 접속·손잡이·좌우 접근 상세 미확정' }),
    rect('WC-F', 'washbasin', 18.3, 13.1, .5, .6, '세면대', { faces: '-x', status: '제품 미선정 외곽 가정; 하부 무릎 공간·높이 미확정' })
  ],
  turningZones: [
    { room: 'WC-M', cx: 17.45, cy: 9.6, diameter: 1.5, label: '지름 1.50 m 바닥 회전 여유' },
    { room: 'WC-F', cx: 17.45, cy: 13, diameter: 1.5, label: '지름 1.50 m 바닥 회전 여유' }
  ],
  sideApproachZones: [
    rect('WC-M', 'toilet-side-floor', 17.2, 10.35, 1, .825, '변기 왼쪽 비움 후보'),
    rect('WC-F', 'toilet-side-floor', 17.2, 11.425, 1, .825, '변기 왼쪽 비움 후보')
  ],
  wetWall: { x: 16.65, y: 11.175, w: 2.15, h: .25, label: '공유 배관벽 .25 m 가정', status: '두 변기를 서로 등지게 배치. 기존 수직 배수관과 연결될 위치는 현장 조건으로 확인해야 하며 .25 m 두께가 실제 제품·배관을 수용한다는 확정은 아님.' },
  serviceChase: { x: 18.25, y: 11.175, w: .55, h: .25, label: '배관 점검 구간 후보', containedIn: 'wetWall', status: '공유벽 동쪽 끝 점검구 후보. 입상관 실제 위치·지름·배수 구배·슬래브 관통 가능 여부 미확정.' },
  wallMountedAccessories: [
    { room: 'WC-M', kind: 'mirror', x: 18.77, y: 8.9, w: .03, h: .6, floorOccupancy: false },
    { room: 'WC-F', kind: 'mirror', x: 18.77, y: 13.1, w: .03, h: .6, floorOccupancy: false },
    { room: 'WC-M', kind: 'closed-supply-storage', x: 16.85, y: 10.98, w: .8, h: .195, floorOccupancy: false, label: '상부 닫힌 소모품 수납 후보' },
    { room: 'WC-F', kind: 'closed-supply-storage', x: 16.85, y: 11.425, w: .8, h: .195, floorOccupancy: false, label: '상부 닫힌 소모품 수납 후보' }
  ],
  ventilation: { separateExtract: true, discharge: '건물 배기 경로 확인 후 외부 배기 연결', recirculateToClassroom: false, note: '화장실에는 AP/가습기를 추가하지 않음. 닫힌 문 상태의 배기·급기 경로를 설비 설계에서 정함.' },
  notes: [
    '화장실 두 곳은 서로 통과하지 않고 각자 접근통로에서 들어감. 출입문은 접근통로 1.20 m를 침범하지 않는 슬라이딩 후보.',
    '남녀실 각각 지름 1.50 m 원이 제안 기구 외곽과 충돌하지 않는 바닥 여유를 좌표로 확보. 이 확인은 접근성 법규 충족이나 실제 휠체어 사용 인증이 아님.',
    '입구 유효폭 .95 m, 접근통로 1.20 m는 후보치. 문틀·손잡이·접근 조작 공간·휠체어 변기 이동·무릎 공간·문턱·미끄럼·안전손잡이는 실제 제품과 현지 설계로 확정.',
    '사용인원·성별 이용량·현지 관할 기준에 따라 변기/세면대 수와 실 크기를 재조정할 수 있음. 화장실 내부 카메라는 없음.',
    '바닥 방수와 구배, 점검구 및 배관 소음, 외부 배기, 전기와 물의 이격을 설비도에서 확정. 벽/바닥을 실제로 관통하도록 승인한 도면이 아님.'
  ]
};
plan.assumptions = plan.assumptions.filter(s => !s.includes('화장실은 건물 공용') && !s.includes('사진실 앞1.5m/뒤2.6m') && !s.includes('본 5안'));
plan.assumptions.push(
  '6안은 내부 남녀 화장실을 포함하기 위해 외곽 가정을 19 × 14.10 m로 변경. 267.90㎡ ≈81.04평으로 5안보다20.90㎡ ≈6.32평 증가. 확정 임대 면적이나 실측 외곽이 아님.',
  '큰 강의실 A 66㎡·B/C 각각27.39㎡는 유지. D는29.90㎡,8석 사무실은20.80㎡로 재배치. 네 교실의 개인책상16개와 사무실8개는 제안 가구 수량.',
  '상담/사진실은 각각 폭2.60/2.15m를 유지하고 깊이5.20m로 연장. 상담 VR2×2m 후보와 사진 카메라1.40m 후보 거리를 유지.',
  '화장실2개와 접근통로는 내부에 추가. 각실 양변기1+세면대1의 초기 가정이며 적정 기구 수·현지 인허가·배수·실제 무장애 접근 확인 전.',
  '기존7개 방 AP7대/H7대 유지. 화장실2개에는 가습기와 공기청정기를 추가하지 않고 전용 배기를 계획.',
  '남녀화장실 중앙 배관벽.25m와 문 포켓벽.15m는 개념 치수. 실제 배관·문 제품·차음벽 사양에 따라 조정될 수 있음.',
  '6안도 교실 통로 상부 고정 수업카메라4대 후보를 유지. 화장실 촬영 장비 없음.'
);
plan.mainRoom.transition = plan.mainRoom.transition.replace('5안', '6안');
plan.mainRoom.modes = {
  defaultMode: 'lecture',
  lecture: {
    label: '수업', mirrorVisible: false, curtainState: 'closed',
    studentFurniture: 'use plan.furniture where room is A: 16 desks and 16 chairs',
    displayPosition: structuredClone(plan.displays.find(d => d.room === 'A')),
    emptyTableCarts: [8.45, 9.35].map(x => rect('A', 'table-cart', x, 2.65, .75, .7, '빈 책상 수납카트 후보', { storedKind: 'desk', storedCount: 0, height: .2, status: '댄스 때 접은 책상을 싣는 빈 카트의 평면 후보; 제품 미선정' })),
    note: '북벽 거울 앞 커튼을 닫고 디지털 화면과 개인 책상16개·의자16개를 사용한다. 거울을 없애거나 화면 뒤에서 제거한 것이 아니다. 이동식 화면의 수업 위치 받침·강사 발 위치·배선 간섭은 제품 실측으로 확인한다.'
  },
  dance: {
    label: '댄스', mirrorVisible: true, curtainState: 'open',
    studentFurniture: 'replace the 16 A desks and 16 A chairs with the storage candidates below; other rooms unchanged',
    displayDock: rect('A', 'display-dock', 9.05, .5, .95, 2, 'TV 동쪽 도킹 후보', {
      height: 1.9, facing: 'west',
      panel: { x: 9.6, y: .5, w: .12, h: 2, facing: 'west' },
      standFootprint: { x: 9.12, y: .8, w: .6, h: 1.4 },
      status: '화면을90도 돌려 동쪽 벽 옆에 세우는 후보. 표기 외곽은2m 화면 위치기호와 가정 받침을 포함하며 실물 크기·전체높이·바퀴잠금·전도·이동경로 검증 전.'
    }),
    storageCandidates: [
      ...[8.45, 9.35].map(x => rect('A', 'table-cart', x, 2.65, .75, .7, '접은 개인 책상8개 수납카트 후보', {
        storedKind: 'desk', storedCount: 8, suggestedCapacity: 8, height: 1.2,
        itemAssumption: { foldedW: .6, foldedD: .45, foldedThickness: .12, cartDeckHeight: .2 },
        capacityStatus: '600×450mm 책상의 다리가 접히고 두께.12m가 된다고 가정한8개 수평 적재 후보. 적재총높이 약1.16m를1.20m로 표시. 실제 접힘 규격·하중·8개적재·운반·전도방지 미검증.'
      })),
      ...[3.65, 5.65].flatMap(y => [8.45, 9.35].map(x => rect('A', 'chair-stack', x, y, .65, .75, '의자4개 적재 후보', {
        storedKind: 'chair', storedCount: 4, suggestedCapacity: 4, height: 1.3,
        capacityStatus: '실제 제품이4개 적재를 허용하고 .65×.75m 외곽·높이1.30m 안에 들어간다는 가정. 의자 형태·쌓임·운반방법·전도안정성 미검증.'
      })))
    ],
    serviceApproach: rect('A', 'storage-approach', 7.6, 2.65, .85, 3.75, '수납 앞 접근 띠 후보', {
      status: '카트를 꺼내는 방향을 보여 주는 .85m 띠. 2열 수납이라 앞 묶음을 먼저 옮겨야 하는 순서가 있으며 카트 회전·두사람운반·완전한 서비스 여유가 검증된 것은 아님.'
    }),
    storedTotals: { desks: 16, chairs: 16, status: '표현한 가정 수납량의 합계. 실제 제품으로16개씩 보관 가능 확정 아님.' },
    note: '커튼을 열어 북쪽 거울을 드러내고 TV는 동쪽 도킹, 책상/의자는 동쪽 수납 후보로 옮긴 모습이다. 가구를 모델에서 단순 삭제한 빈 방이 아니다. 활동 정원·안전 활동면적은 계산하지 않는다.'
  }
};
plan.mainRoom.mirrorCurtain.heightAssumption = 2.4;
plan.mainRoom.mirrorCurtain.heightStatus = '입체표현을 위한2.4m 높이 가정. 원본 의도와 별개로 실제 제작높이·바탕·거울시스템 실측 필요.';
plan.mainRoom.mirrorCurtain.curtainOpenStatus = '댄스 모드에는 양끝으로 걷힌 커튼으로 표현. 실제 레일·패브릭 묶음폭·유효 거울폭은 제작 사양 확인 전.';
plan.mainRoom.transition = '수업↔댄스 개념 전환에는 북벽 거울 커튼, TV동쪽도킹, A의 개인책상16개·의자16개의 동쪽 수납후보를 함께 표시한다. 수납카트/적재 외곽·높이와 총량은 제품 미선정 가정이며 실제 수납 가능이나 댄스 활동정원 확정이 아니다. 수업 때 기존 개인좌석을 유지하고 다른 방 가구·카메라·벽은 바꾸지 않는다.';
// 2026-10-01 operational amendment. Keep the shell, room boundaries and seat counts.
const op = (id, room, kind, x, y, w, h, height, facing, label, serviceZone, extra = {}) => ({ id, room, kind, x, y, w, h, height, facing, label, floorOccupancy: true, serviceZone, status: '제품 미선정 외곽·동작 여유 후보. 실제 제품·적재량·동시 사용은 확인 전.', ...extra });
const service = (x,y,w,h,label='사용·정비 여유') => ({x,y,w,h,label,status:'사용 중 잠시 점유하는 후보. 통행 적합성 인증 아님.'});
for (const f of plan.furniture.filter(f=>f.room==='D'&&f.y>=11.9)) f.y=round(f.y-.25);
for (const id of ['B','C']) {
  const dx=id==='C'?4.3:0;
  Object.assign(plan.appliances.find(a=>a.id==='AP-'+id),{x:round(10.4+dx),y:.8});
  Object.assign(plan.appliances.find(a=>a.id==='H-'+id),{x:round(14+dx),y:1.05,mist:'교사 장비함 반대쪽 전면 후보. 전자장비·화면·학생을 직접 향하지 않는 증발식/비분무식부터 검토하며 실제 제품 이격·습도는 현장 확인.'});
}
Object.assign(plan.cameras.find(c=>c.room==='A').equipment,{x:.5,y:1.0});
plan.officeLayout.clearAisle.h=4.6;
plan.officeLayout.clearAisle.label='중앙 1.50 m 통로 / 남쪽 복합기 앞 종료';
plan.officeLayout.note+=' 2026-10-01 남쪽 중앙 복합기장 추가로 중앙 통로는 남벽 .60m 앞에서 끝난다. 복합기 사용 여유는 통로 끝의 일시 점유이며 별도 통과동선으로 중복 계산하지 않는다.';
Object.assign(plan.photoConvenience.fixtures.find(f=>f.kind==='coffee-counter'),{x:14.6,y:8.85,w:.55,h:1.3,height:.9,facing:'west',label:'정수·커피 편의대',status:'정수기·커피·컵 모듈을 나눈 .55×1.30m 후보. 실제 급수·배수·제품 높이·물통과 점검 여유 확인 전.'});
Object.assign(plan.doors.find(d=>d.room==='photo'),{swing:'slide',orientation:'horizontal',slideDirection:'east',clearOpening:.85,pocket:{x:14.15,y:8.55,w:.9,h:.15},note:'편의대 앞 사용자와 문 회전을 분리하기 위한 북벽 포켓 미닫이 후보. 벽 두께·배선·문 제품·유효폭은 현장 확인 전.'});
plan.operations={amendment:'2026-10-01',units:'m',status:'concept-operational-amendment-not-procurement',fixtures:[
  op('COAT-A','A','coat-shoe-cabinet',.2,1.65,.5,2.8,1.85,'east','외투·실내화 16칸 목표',service(.7,1.65,.75,2.8),{targetUsers:16,compartments:{columns:4,rows:4},storageNote:'외투는 접어 두는 개인 칸 후보. 하단 젖은 신발 트레이와 위쪽 마른 외투를 분리. 겨울 외투·가방·신발을 한 칸에 모두 수용한다고 가정하지 않음.'}),
  ...['B','C'].flatMap(id=>{const dx=id==='C'?4.3:0;return [
    op('COAT-'+id+'-L',id,'coat-shoe-cabinet',round(10.4+dx),6.35,1.3,.45,1.85,'north','외투 8칸 목표',service(round(10.4+dx),5.8,1.3,.55),{targetUsers:8,compartments:{columns:2,rows:4},storageNote:'접은 외투 8칸과 하부 탈착 신발트레이 후보. 앞 .55m는 한 사람 사용 가정이며 수업 교대 때 순차 사용.'}),
    op('COAT-'+id+'-R',id,'coat-shoe-cabinet',round(13.05+dx),6.35,1.3,.45,1.85,'north','외투 8칸 목표',service(round(13.05+dx),5.8,1.3,.55),{targetUsers:8,compartments:{columns:2,rows:4},storageNote:'접은 외투 8칸과 하부 탈착 신발트레이 후보. 중앙 출입문과 의자 사용 영역에 문짝이 나오지 않는 개방/슬라이딩 후보.'})];}),
  op('COAT-D','D','coat-shoe-cabinet',1.7,13.55,4.1,.35,1.85,'north','외투·실내화 16칸 목표',service(1.7,13.05,4.1,.5),{targetUsers:16,compartments:{columns:4,rows:4},storageNote:'접은 외투 칸과 하부 신발트레이. 얕은 .35m 깊이이므로 실제 겨울 외투 수용 확인 전. 뒤쪽 두 좌석열만 .25m 북쪽으로 이동.'}),
  op('CARE-SINK','consult','service-sink',10.85,13.3,.7,.6,1.85,'north','잠금형 물통 세척·급수',service(10.85,12.5,.7,.8),{sinkTop:.9,concealed:true,locked:true,connectionStatus:'현장 급수·배수·트랩·방수·환기 연결 확인 전',useMode:'상담/VR 미사용 시간에만 관리',storageNote:'닫힌 문 안에 높이 .90m 관리용 싱크. 개인 음료·VR 충전과 구분하고 실제 물통 유효 볼·수전 높이, 문 열림/건조를 확인.'}),
  op('CARE-LOCK','consult','locked-cleaning-cabinet',11.6,13.3,.6,.6,1.85,'north','잠금 청소·소모품장',service(11.6,12.5,.6,.8),{locked:true,useMode:'상담/VR 미사용 시간에만 관리',storageNote:'청소약품 잠금 칸, 걸레 건조/받이 칸, 마른 소모품을 내부 분리. 바닥 도구 크기·건조 방식 확인.'}),
  op('PRINT-O','office','printer-supply-cabinet',7.45,13.3,1.3,.6,.8,'north','복합기·서류·재고장',service(7.45,12.5,1.3,.8),{locked:true,storageNote:'상판에 A4 복합기, 하부에 용지·토너·잠금 서류·봉인된 다과재고를 칸별 분리. 식품과 토너는 한 칸에 섞지 않음.'}),
  op('UMBRELLA-P','photo','umbrella-drip-cabinet',14.25,8.72,.25,.3,.65,'west','우산 물받이',service(13.9,9.05,.7,.65),{storageNote:'편의실 입구 옆 세로 물받이 후보. 복도/주출입문에는 세우지 않음. 젖은 우산 운반 동선과 보관량 실제 확인.'}),
  op('TEACH-A','A','teacher-equipment-cabinet',.2,.7,.6,.65,.9,'east','교사 장비·마이크',service(.8,.7,.7,.65),{locked:true,connectionPoint:{x:.5,y:1}}),
  op('TEACH-B','B','teacher-equipment-cabinet',10.85,.65,.6,.55,.9,'south','교사 장비·마이크',service(10.85,1.2,.6,.5),{locked:true,connectionPoint:{x:10.95,y:.8}}),
  op('TEACH-C','C','teacher-equipment-cabinet',15.15,.65,.6,.55,.9,'south','교사 장비·마이크',service(15.15,1.2,.6,.5),{locked:true,connectionPoint:{x:15.25,y:.8}}),
  op('TEACH-D','D','teacher-equipment-cabinet',.35,12.3,.6,.6,.9,'east','교사 장비·마이크',service(.95,12.3,.65,.6),{locked:true,connectionPoint:{x:.8,y:12.5}})
],wallItems:[],countertopItems:[
  {id:'WATER-P',room:'photo',kind:'water-dispenser',x:14.65,y:8.87,w:.45,h:.35,z:.9,height:.55,facing:'west',floorOccupancy:false,containedIn:'coffee-counter',label:'정수기',status:'상판형 외곽 후보. 얼음 기능 포함 제품의 실제 크기·급배수·발열·높이 확인 전.'},
  {id:'COFFEE-P',room:'photo',kind:'coffee-machine',x:14.65,y:9.25,w:.45,h:.4,z:.9,height:.5,facing:'west',floorOccupancy:false,containedIn:'coffee-counter',label:'커피머신',status:'상판형 외곽 후보. 물통/원두/찌꺼기통 인출 방향과 정비 확인 전.'},
  {id:'BOTTLE-P',room:'photo',kind:'bottle-landing',x:14.65,y:9.68,w:.45,h:.23,z:.9,height:.02,facing:'west',floorOccupancy:false,containedIn:'coffee-counter',label:'물병·컵 놓는 면',status:'다른 기기를 올리지 않는 상판 후보. 물병 지름/컵 받침 확인.'},
  {id:'CUPS-P',room:'photo',kind:'cups-snacks',x:14.65,y:9.95,w:.45,h:.16,z:.9,height:.25,facing:'west',floorOccupancy:false,containedIn:'coffee-counter',label:'컵·소량 포장 다과',status:'밀폐 용기 후보. 음료와 사진 인화지 분리. 여분 다과는 사무실 닫힌 재고장.'},
  {id:'CUP-BIN-P',room:'photo',kind:'used-cup-bin',x:14.65,y:9.68,w:.4,h:.23,z:.05,height:.45,facing:'west',floorOccupancy:false,containedIn:'coffee-counter',label:'하부 컵 수거',status:'상판 물병 면 아래 분리 수거함. 슬라이딩/인출 방식·누수 받이와 세척 확인.'},
  {id:'PRINTER-O',room:'office',kind:'office-printer',x:7.5,y:13.35,w:.55,h:.5,z:.8,height:.4,facing:'north',floorOccupancy:false,containedIn:'PRINT-O',label:'A4 복합기',status:'상부 스캐너 열림·급지·배출·카트리지 교체 치수 확인 전.'}
],floorZones:[
  {id:'ENTRY-MAT',room:'corridor',kind:'flush-entry-mat',x:17,y:7.08,w:1.05,h:1.34,z:0,height:.006,floorOccupancy:false,walkable:true,label:'입구 물·먼지 매트',status:'문 회전 바깥, 바닥 단차 없이 고정하는 후보. 미끄럼·받이 깊이·실제 출입문 확인 전.'},
  {id:'DRINK-SERVICE',room:'photo',kind:'service-zone',x:13.85,y:9.05,w:.75,h:1.1,z:0,floorOccupancy:false,label:'음료 1인 사용',status:'편의대 앞 .75m 후보. 문은 미닫이로 바꿔 회전을 제거하고 한 명씩 이용. 큰 기기 정비 때는 편의/촬영 사용을 멈춤.'}
],deskAccessories:{studentBagStorage:'학생 책상마다 기존 상판 투영 안쪽의 가방걸이/하부 받침 1곳. 중앙/행간 통로로 늘어뜨리지 않는 제품으로 선정.',studentCount:64,targetFurniture:{roomIds:['A','B','C','D'],kind:'desk',quantity:64,attachment:'상판 투영 안쪽 가방걸이/하부 받침',floorOccupancy:'기존 책상 footprint 안쪽, 실제 무릎·발·가방 크기 확인 전'},staffStorage:'직원 8자리 각각 책상 내 서랍/접은 외투 칸을 검토. 독립 행거를 중앙 통로에 추가하지 않음.',staffCount:8},policies:[
 '일반 수업64석·사무실8석과 기존 방 경계를 유지. 외투 수납은 사용자별 칸 목표이며 실제 겨울옷·신발 적재량 확인 전.',
 '댄스는 움직이기 편한 옷으로 오는 운영을 기본으로 한다. 상담실을 탈의실로 자동 겸용하지 않으며 별도 탈의 수요가 확인되면 프라이버시·시간·잠금·배치를 다시 검토.',
 '관리싱크·청소장 사용은 상담/VR 종료 후. 급배수 연결과 물통 세척·건조·청소도구 출납은 시공 및 실제 운영 검증 전.',
 '큰방 전환과 교실 교대는 순차 운영한다. 복도에 줄·행거·카트·가구를 적치하지 않으며 동시 사용량은 실물 시뮬레이션 후 결정.',
 '외투장과 장비함은 실제 문짝이 통로로 돌출하지 않는 형식을 우선 검토. 표시한 사용띠는 가구 외곽과만 대조한 후보이며 신체·운반·피난 기준 적합성을 보증하지 않음.'
]};
const wallItem=(id,room,kind,x,y,w,h,z,height,facing,label,status)=>({id,room,kind,x,y,w,h,z,height,facing,label,status,wallMounted:true,floorOccupancy:false});
plan.operations.wallItems.push(
  wallItem('ENTRY-GUIDE','corridor','entry-guide',17.4,8.56,1.05,.04,1.25,.65,'north','오늘 수업·도움 안내','주복도 남측 벽의 얕은 안내판. 방 문자·용도·시간표·SYNK WORLD 입구를 표시하며 계정정보는 게시하지 않음.'),
  wallItem('PAST-WORDS','corridor','student-memory-wall',3,6.87,2.4,.04,1.15,.85,'south','지나간 말들','A 남벽 복도 면의 얕은 카드 슬리브. 이름·반·급수 없이 시즌과 한 줄만, 본인 동의 후 게시.'),
  ...plan.doors.filter(d=>!d.room.startsWith('WC-')).map(d=>wallItem('STATUS-'+d.room,'corridor','room-status',round(d.x+d.w+.15),d.swing==='north'?6.87:8.56,.25,.04,1.35,.25,d.swing==='north'?'south':'north',d.room+' · 방/이용 상태','문 옆 수업/촬영/상담·VR 상태를 수동 또는 연결형으로 표시. 자동 연동 구현 완료 뜻 아님.')),
  ...plan.operations.fixtures.filter(f=>f.kind==='teacher-equipment-cabinet').map(f=>wallItem('MIC-'+f.room,f.room,'microphone-charge',f.x+.1,f.y+.1,.22,.2,.9,.12,f.facing,'마이크 충전','교사 장비장 상부의 교실별 충전·반납 자리. 물과 분리하고 마이크 배터리·음소거·송출 상태를 수업 전 확인.'))
);
// Second operational supplement: contents of existing furniture only.
const contained=(id,room,kind,quantity,unit,parent,x,y,w,h,z,height,label,viewNote,extra={})=>({id,room,kind,quantity,unit,containedIn:parent,x:round(x),y:round(y),w,h,z,height,label,viewNote,floorOccupancy:false,mount:'inside',facing:'north',status:'장 내부 외곽을 배정한 제품 미선정 후보. 실물 크기·판 두께·서랍 레일·문 열림·습기·열배출 확인 전.',...extra});
plan.operations.containedItems=[
 ...plan.operations.fixtures.filter(f=>f.kind==='teacher-equipment-cabinet').map(f=>contained('PEN-'+f.room,f.room,'loan-pen-tray',2,'개',f.id,f.x+.08,f.y+.08,.25,.20,.72,.07,'대여 펜 2개','교사 장 위쪽 얕은 서랍 · 대여 펜 2개 · 반납 자리와 수업 전원을 표시',{facing:f.facing,locked:true})),
 contained('LOST-BOX-O','office','lost-property-box',1,'개','PRINT-O',8.1,13.35,.60,.45,.08,.30,'닫힌 분실물 상자','공용 출력장 오른쪽 아래 · 일반 소형 분실물 1상자 · 귀중품은 별도 잠금 서랍',{closed:true,capacityStatus:'큰 겨울 외투·큰 가방까지 한 번에 보관한다는 용량 가정 없음.'}),
 contained('PAPER-O','office','storage-reserve',1,'기존 구획','PRINT-O',7.5,13.35,.55,.45,.08,.16,'사용 중인 용지','출력장 왼쪽 아래 · 당장 사용하는 용지 분량 · 벌크 재고 전체 수용 보장 아님'),
 contained('STUDENT-FILES-O','office','storage-reserve',1,'기존 구획','PRINT-O',7.5,13.35,.55,.45,.28,.25,'학생 서류 잠금 구획','출력장 왼쪽 중간 · 학생 서류 공용 잠금 · 직원 사물·PC와 분리',{locked:true}),
 contained('VALUABLES-O','office','storage-reserve',1,'기존 구획','PRINT-O',7.5,13.35,.55,.45,.57,.12,'귀중 분실물 잠금 구획','출력장 왼쪽 위 · 귀중 분실물만 · 학생 서류와 별도 잠금',{locked:true}),
 contained('TONER-O','office','storage-reserve',1,'기존 구획','PRINT-O',8.1,13.35,.60,.45,.42,.12,'토너·소모품 구획','출력장 오른쪽 중간 · 실제 카트리지 포장 크기 확인 전'),
 contained('SNACK-RESERVE-O','office','storage-reserve',1,'기존 구획','PRINT-O',8.1,13.35,.60,.45,.58,.14,'밀폐 다과 재고 구획','출력장 오른쪽 위 · 밀폐 식품 상자 · 토너 칸과 칸막이로 분리',{sealed:true}),
 contained('LIQUID-BIN-P','photo','residual-drink-container',1,'개','coffee-counter',14.65,9.28,.35,.28,.05,.38,'남은 음료 수거통','편의대 하부 · 밀폐 가능한 잔음료통 1개 · 컵통과 분리해 직원이 수거',{facing:'west',closed:true,removable:true,noDrainConnection:true,capacityStatus:'표시 외곽의 통 후보이며 실제 용량·무게·인출·넘침 방지·수거 주기를 확인. 상시 배수 연결 아님.'}),
 contained('CARE-LONG-TOOLS','consult','storage-reserve',1,'기존 구획','CARE-LOCK',11.65,13.35,.18,.48,.12,1.60,'긴 청소도구 칸','관리장 왼쪽 · 긴 도구 세로 보관 · 실제 도구 폭 확인',{locked:true}),
 contained('CARE-CHEMICALS','consult','storage-reserve',1,'기존 구획','CARE-LOCK',11.87,13.35,.28,.48,.12,.65,'청소약품 잠금 칸','관리장 오른쪽 아래 · 청소약품 잠금 · 물통 세척 도구와 구분',{locked:true}),
 contained('CARE-WET-TRAY','consult','storage-reserve',1,'기존 구획','CARE-LOCK',11.87,13.35,.28,.48,.82,.22,'청소도구 물받이 칸','관리장 오른쪽 중간 · 도구용 물받이 · 건조·환기 방식은 제품 확인 전'),
 contained('TANK-CLEAN-KIT','consult','tank-cleaning-kit',1,'세트','CARE-LOCK',11.87,13.35,.28,.48,1.10,.27,'물통 전용 세척·건조 도구','관리장 오른쪽 위 · 전용 솔·천·접이 받침 1세트 · 7개 물통 동시 건조 아님',{locked:true,contents:['물통 전용 솔','물통 전용 천','접어 보관하는 건조 받침'],dryingCapacity:'도구 보관 외곽만 배정. 실제 물통은 한 개부터 세척·건조 시험 후 순차 관리량을 정함. 7개 물통 동시 건조 공간을 확보한 뜻 아님.'}),
 contained('CARE-DRY-STOCK','consult','storage-reserve',1,'기존 구획','CARE-LOCK',11.87,13.35,.28,.48,1.42,.30,'마른 관리 소모품 칸','관리장 오른쪽 최상부 · 마른 소모품 · 세척 도구와 선반 분리')
];
const staffDesks=plan.furniture.filter(f=>f.room==='office'&&f.kind==='desk').sort((a,b)=>a.y-b.y||a.x-b.x);
plan.operations.deskAccessories.staffCompartments=[];
plan.operations.deskAccessories.staffUnits=staffDesks.map((d,i)=>{
 const n=String(i+1).padStart(2,'0');Object.assign(d,{id:'OFFICE-DESK-'+n,height:.72});
 const parts=[
  contained('STAFF-'+n+'-BAG','office','staff-personal-storage',1,'개인 구획',d.id,d.x+.03,d.y+.03,.50,.28,.06,.49,'직원 '+n+' 가방·접은 외투','책상 한쪽 개인 칸 · 가방 또는 접은 외투 · 두꺼운 외투와 큰 가방 동시 수납은 확인 전'),
  contained('STAFF-'+n+'-VALUABLES','office','staff-lockable-drawer',1,'개인 구획',d.id,d.x+.03,d.y+.03,.50,.28,.59,.08,'직원 '+n+' 개인 잠금 서랍','가방 칸 위 얕은 잠금 서랍 · 개인 귀중품 · 학생 서류는 공용 잠금장',{locked:true}),
  contained('STAFF-'+n+'-PC','office','pc-clearance-reserve',1,'기존 구획',d.id,d.x+.03,d.y+.96,.50,.20,.06,.54,'직원 '+n+' PC 후보 영역','책상 반대쪽 PC 영역 · 실제 본체·열배출·배선 이격은 제품 확인 전',{ventilationUnverified:true})
 ];
 parts.forEach(p=>p.facing=i%2===0?'east':'west');plan.operations.deskAccessories.staffCompartments.push(...parts);
 return {deskId:d.id,room:'office',label:'직원 '+n,compartmentIds:parts.map(p=>p.id),studentFilesAt:'STUDENT-FILES-O',kneeClearZone:{x:d.x,y:round(d.y+.34),w:.6,h:.58,z:0,height:.67},winterClothing:'가방 칸과 접은 외투 칸은 대체 사용 가정. 큰 가방과 겨울 외투를 동시에 넣을 수 있다고 가정하지 않으며 실제 출근 소지품 시험 후 책상 내부 구획을 확정.',status:'책상 높이 .72m와 단순 내부 외곽 후보. 책상 다리/보/레일과 앉은 자세·열배출은 실물 검증 전.'};
});
plan.operations.deskAccessories.staffStorage='직원 8개 책상마다 개인 가방/접은 외투 칸, 개인 잠금 서랍, 반대편 PC 영역을 분리. 학생 서류는 공용 STUDENT-FILES-O로 분리. 큰 가방과 겨울 외투 동시 수용 미확정.';
plan.operations.supplement={revision:2,date:'2026-10-01',status:'minimum-daily-operation-supplement-not-procurement',newFloorFixtures:0,inventory:[
 {id:'LOAN-PENS',label:'교실 대여 펜',quantity:8,unit:'개',itemIds:['PEN-A','PEN-B','PEN-C','PEN-D']},
 {id:'LOST-BOX',label:'닫힌 일반 분실물 상자',quantity:1,unit:'개',itemIds:['LOST-BOX-O']},
 {id:'LIQUID-BIN',label:'밀폐 가능한 잔음료통',quantity:1,unit:'개',itemIds:['LIQUID-BIN-P']},
 {id:'TANK-KIT',label:'물통 전용 세척·건조 도구',quantity:1,unit:'세트',itemIds:['TANK-CLEAN-KIT']},
 {id:'LABELS',label:'기존 장의 최소 전원·수납 라벨',quantity:1,unit:'세트',positions:7,itemIds:['LABEL-TEACH-A','LABEL-TEACH-B','LABEL-TEACH-C','LABEL-TEACH-D','LABEL-PRINT-O','LABEL-COFFEE-P','LABEL-CARE']}
],labelSets:[
 ...['A','B','C','D'].map(room=>({id:'LABEL-TEACH-'+room,room,containedIn:'TEACH-'+room,quantity:1,unit:'자리',texts:['대여 펜','마이크 반납','수업 전원'],floorOccupancy:false,status:'기존 장 안쪽/기기 연결부의 작은 문자 표기. 상시전원/마감차단 회로는 실제 배선 확인 후 구분.'})),
 {id:'LABEL-PRINT-O',room:'office',containedIn:'PRINT-O',quantity:1,unit:'자리',texts:['일반 분실물','귀중 분실물','학생 서류','개점 카드','마감 카드','상시 유지 / 작업 완료 후 종료 / 퇴근 시 종료'],floorOccupancy:false,status:'기존 장 안쪽 작은 표기와 실제 기기 연결부의 전원 구분. 개인 식별 정보 표시 안 함. 기기별 실제 전원 회로는 설치 후 확인.'},
 {id:'LABEL-COFFEE-P',room:'photo',containedIn:'coffee-counter',quantity:1,unit:'자리',texts:['남은 음료','빈 컵'],floorOccupancy:false,status:'기존 수거부의 구분 표기. 큰 안내판 추가 없음.'},
 {id:'LABEL-CARE',room:'consult',containedIn:'CARE-LOCK',quantity:1,unit:'자리',texts:['물통 전용','청소용','상담·VR 종료 후'],applianceIds:plan.appliances.filter(a=>a.kind==='H').map(a=>a.id),floorOccupancy:false,status:'기존 장 안쪽 용도 표시와 가습기/물통별 작은 기기번호. 건조 상태는 직원이 확인.'}
],scheduleAssumptions:{classChangeoverMinutes:10,mainRoomModeChangeMinutes:20,status:'실제 측정 전 시간표 시작값. 실제 16세트/교대 인원으로 측정 후 늘리거나 운영방식을 수정.'},roomNotes:{
 all:['기존 가구 안에 펜·분실물·잔음료통·물통 도구 보완 · 새 바닥 가구 0개'],
 A:['교사 서랍: 대여 펜 2개 · 마이크 반납·수업 전원 라벨'],B:['교사 서랍: 대여 펜 2개 · 외투 16칸은 반 교대 32명 동시 수용 아님'],C:['교사 서랍: 대여 펜 2개 · 외투 16칸은 반 교대 32명 동시 수용 아님'],D:['교사 서랍: 대여 펜 2개 · 외투 16칸은 반 교대 32명 동시 수용 아님'],
 office:['출력장: 일반 분실물 1상자 / 귀중 분실물·학생 서류 각각 잠금','직원 8자리: 개인 칸·잠금 서랍·PC 분리 / 큰 가방+겨울 외투 동시 수납 미확정','서랍 레일·무릎 여유·PC 열배출은 실물 확인 전'],
 photo:['편의대 하부: 남은 음료 1통 / 빈 컵통 분리 · 직원 순회 수거'],
 consult:['물통 전용 솔·천·접이 받침 1세트 · 7개 물통 동시 건조 공간 아님','상담·VR 종료 후 세척·급수 · 급배수 현장 연결 미확정'],
 corridor:['16명 퇴실·물건 회수 후 다음 반 입실 · 빈 교실이 없으면 시간표 조정','휴대폰 없이도 교사 수동 출석 · 첫 방문 안내와 개점/마감 책임자 지정'],
 restrooms:['이용 필요 시 바로 안내 · 교실별 쉬는 시간을 분산하고 복도에 대기 가구를 두지 않음']
},policies:[
 '반 교대 16명+16명의 외투 32개 동시 수용을 가정하지 않는다. 이전 반의 물건 회수·교실 비움 후 다음 반이 입실한다. 비어 있는 실내 교실이 없으면 도착 안내·시간표 간격을 조정하며 복도/건물 밖 대기를 기본 해결책으로 삼지 않는다.',
 '휴대폰이 없거나 앱 미로그인 상태여도 수업에 입실한다. 교사가 수동 출석을 기록하고 장애 때는 비공개 임시 기록을 담당자 1명이 사후 대조한다. 신규 키오스크나 학생 충전 장비를 추가하지 않는다.',
 '개점 책임자와 최종 마감 책임자, 늦은 퇴실 연락 담당을 정한다. 모든 교실·상담/VR·포토·화장실의 잔류 확인 후 잠금/전원을 마감하고 필요한 상시 회로는 유지한다.',
 '상담·VR 사용 중에는 관리 싱크/청소장을 열어 급수·세척하지 않는다. 물통은 실제 제품으로 한 개부터 세척·건조 시험 후 순차 관리한다.',
 '잔음료통은 컵통과 분리해 직원이 넘치기 전에 수거·세척한다. 학생을 상담실 관리 싱크로 안내하지 않는다. 수거량·보관·처리 시간은 현장 운영 시험 후 정한다.',
 '일반 수업은 매트에서 물·먼지를 정리하고 입실하는 운영안을 기본으로 하며 전원 신발 교체 줄을 만들지 않는다. 댄스용 깨끗한 개인 실내 운동화 안내를 입학/첫 방문 안내에 포함한다. 물건은 교실과 책상 안에 두고 젖은 신발·우산은 기존 받이에 분리한다. 현장 바닥/겨울 물기 시험 후 확정.',
 '화장실 필요는 바로 안내하고 가능한 범위에서 쉬는 시간을 분산한다. 물 이용을 우선하고 커피·포토 체험은 수업 전후 여유 시간에 순차 이용한다.'
]};
plan.assumptions.push('2026-10-01 운영 보완: 방 경계/총면적/64석/사무실8석 보존. 접은 외투/신발 수납, 관리싱크·청소장, 정수·복합기, 교사장비, 안내·기록 패널을 좌표로 제안. 실제 제품·시설 연결·사용 여유 확인 전.');
plan.assumptions.push('2026-10-01 두 번째 운영 보완: 새 바닥 가구 없이 기존 장의 대여 펜·분실물·잔음료통·물통 도구·최소 라벨과 직원 책상 내부 개인 구획을 배정. 내부 외곽 검사는 제품 용량·건조 능력·겨울옷 동시 수용을 증명하지 않음.');
plan.areaSummary = {
  gross: 267.9, grossPyeong: round(267.9 / 3.305785),
  previousGross: 247, additionalGross: 20.9,
  rooms: round(plan.rooms.reduce((s, r) => s + r.w * r.h, 0)),
  circulation: round(plan.corridor.w * plan.corridor.h + plan.secondaryCorridors.reduce((s, r) => s + r.w * r.h, 0))
};
plan.areaSummary.walls = round(plan.areaSummary.gross - plan.areaSummary.rooms - plan.areaSummary.circulation);
plan.areaSummary.wallsLabel = '벽체·문 개구 접속부를 포함한 잔여 면적';
const cardinal = { '-x': 'west', '+x': 'east', '-y': 'north', '+y': 'south' };
for (const f of plan.furniture) f.facing = cardinal[f.faces] || 'north';
for (const f of plan.restrooms.fixtures) f.facing = cardinal[f.faces];
for (const f of plan.consultation.modes.consult.furniture) if (f.kind === 'folding-chair') f.facing = f.y < 10.65 ? 'south' : 'north';

// Meaningful geometry checks: counts, boundaries, fixture collisions, door swings,
// and the specific restroom turning circles. Product service clearances are not certified.
const roomFor = id => plan.rooms.find(r => r.id === id);
const inside = (a, r) => a.x >= r.x - 1e-6 && a.y >= r.y - 1e-6 && a.x + a.w <= r.x + r.w + 1e-6 && a.y + a.h <= r.y + r.h + 1e-6;
const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6;
const fixtures = [...plan.furniture, ...plan.appliances, ...plan.photoConvenience.fixtures, ...plan.restrooms.fixtures, ...plan.operations.fixtures];
for (const f of fixtures) assert(inside(f, roomFor(f.room)), `Outside room: ${JSON.stringify(f)}`);
for (let i = 0; i < fixtures.length; i++) for (let j = i + 1; j < fixtures.length; j++) if (fixtures[i].room === fixtures[j].room) assert(!overlaps(fixtures[i], fixtures[j]), `Fixture collision: ${JSON.stringify([fixtures[i], fixtures[j]])}`);
for (const id of ['A', 'B', 'C', 'D']) assert.equal(plan.furniture.filter(f => f.room === id && f.kind === 'desk').length, 16);
assert.equal(plan.furniture.filter(f => f.room === 'office' && f.kind === 'desk').length, 8);
assert.equal(plan.appliances.length, 14);
assert.equal(plan.cameras.length, 4);
for (const c of plan.cameras) for (const f of fixtures.filter(f => f.room === c.room && f.kind!=='teacher-equipment-cabinet')) assert(!(c.equipment.x > f.x && c.equipment.x < f.x + f.w && c.equipment.y > f.y && c.equipment.y < f.y + f.h), `Equipment connection point in ${f.kind} for ${c.room}`);
for (const d of plan.doors.filter(d => d.swing === 'south' || d.swing === 'north')) {
  const clearance = { x: d.x, y: d.swing === 'south' ? d.y : d.y - d.w, w: d.w, h: d.w };
  for (const f of fixtures.filter(f => f.room === d.room)) assert(!overlaps(clearance, f), `Door swing ${d.room} vs ${f.kind}`);
}
for (const mode of Object.values(plan.consultation.modes)) for (const f of mode.furniture) assert(inside(f, roomFor('consult')));
assert(inside(plan.consultation.vrClearZone, roomFor('consult')));
for (const f of [...plan.consultation.modes.vr.furniture, ...plan.appliances.filter(a => a.room === 'consult')]) assert(!overlaps(f, plan.consultation.vrClearZone), `VR overlap: ${f.kind}`);
for (const z of plan.restrooms.turningZones) {
  const r = z.diameter / 2;
  assert(inside({ x: z.cx - r, y: z.cy - r, w: 2 * r, h: 2 * r }, roomFor(z.room)), `Turning circle outside ${z.room}`);
  for (const f of plan.restrooms.fixtures.filter(f => f.room === z.room)) {
    const dx = z.cx - Math.max(f.x, Math.min(z.cx, f.x + f.w));
    const dy = z.cy - Math.max(f.y, Math.min(z.cy, f.y + f.h));
    assert(dx * dx + dy * dy >= r * r - 1e-6, `Turning circle collision ${z.room}/${f.kind}`);
  }
}
for (const z of plan.photoConvenience.serviceZones) for (const f of fixtures.filter(f => f.room === 'photo')) assert(!overlaps(z, f), `Photo service clearance vs ${f.kind}`);
const dance = plan.mainRoom.modes.dance;
const danceObjects = [dance.displayDock, ...dance.storageCandidates, ...plan.appliances.filter(a => a.room === 'A')];
for (const f of danceObjects) assert(inside(f, roomFor('A')), `A dance candidate outside room: ${f.kind}`);
for (let i = 0; i < danceObjects.length; i++) for (let j = i + 1; j < danceObjects.length; j++) assert(!overlaps(danceObjects[i], danceObjects[j]), `A dance candidate collision: ${danceObjects[i].kind}/${danceObjects[j].kind}`);
for (const d of plan.doors.filter(d => d.room === 'A')) for (const f of danceObjects) assert(!overlaps({ x: d.x, y: d.y - d.w, w: d.w, h: d.w }, f), `A door/dance candidate collision: ${f.kind}`);
assert.equal(dance.storageCandidates.filter(f => f.storedKind === 'desk').reduce((s, f) => s + f.storedCount, 0), 16);
assert.equal(dance.storageCandidates.filter(f => f.storedKind === 'chair').reduce((s, f) => s + f.storedCount, 0), 16);
for (const f of danceObjects) assert(!overlaps(dance.serviceApproach, f), `A storage approach/candidate collision: ${f.kind}`);
for (const mode of ['consult','vr']) {
  const all=[...fixtures,...plan.consultation.modes[mode].furniture];
  for (const f of plan.operations.fixtures) {
    assert(inside(f.serviceZone,roomFor(f.room)), `Operation service outside room ${f.id}`);
    for (const other of all.filter(o=>o.room===f.room && o!==f)) assert(!overlaps(f.serviceZone,other), `Operation service collision ${f.id}/${other.id||other.kind}`);
    for (const d of plan.doors.filter(d=>d.room===f.room&&d.swing!=='slide')) assert(!overlaps(f.serviceZone,{x:d.x,y:d.swing==='north'?d.y-d.w:d.y,w:d.w,h:d.w}), `Operation service in door envelope ${f.id}`);
  }
  if(mode==='vr') for(const f of plan.operations.fixtures.filter(f=>f.room==='consult')){assert(!overlaps(f,plan.consultation.vrClearZone));assert(!overlaps(f.serviceZone,plan.consultation.vrClearZone));}
}
for (const f of plan.operations.fixtures.filter(f=>f.room==='A')) for(const d of danceObjects) assert(!overlaps(f,d)&&!overlaps(f.serviceZone,d), `A operation/dance collision ${f.id}/${d.kind}`);
for(const f of plan.operations.countertopItems){const parent=[...plan.photoConvenience.fixtures,...plan.operations.fixtures].find(p=>p.id===f.containedIn||p.kind===f.containedIn);assert(parent&&inside(f,parent),`Countertop containment ${f.id}`);}
for(let i=0;i<plan.operations.countertopItems.length;i++)for(let j=i+1;j<plan.operations.countertopItems.length;j++){const a=plan.operations.countertopItems[i],b=plan.operations.countertopItems[j];if(a.room===b.room&&Math.min(a.z+a.height,b.z+b.height)>Math.max(a.z,b.z)+1e-6)assert(!overlaps(a,b),`Countertop volume collision ${a.id}/${b.id}`);}
for(const z of plan.operations.floorZones.filter(z=>z.kind==='service-zone')) for(const f of fixtures.filter(f=>f.room===z.room))assert(!overlaps(z,f),`Operating area collision ${z.id}/${f.id||f.kind}`);
const insideItems=[...plan.operations.containedItems,...plan.operations.deskAccessories.staffCompartments];
const parents=[...plan.photoConvenience.fixtures,...plan.operations.fixtures,...plan.furniture];
for(const f of insideItems){const parent=parents.find(p=>p.id===f.containedIn||p.kind===f.containedIn);assert(parent&&inside(f,parent),`Internal footprint outside parent ${f.id}`);assert(f.z>=0&&f.z+f.height<=parent.height+1e-6,`Internal height outside parent ${f.id}`);assert(!f.floorOccupancy,`Internal item must not add floor fixture ${f.id}`);}
const volumes=[...insideItems,...plan.operations.countertopItems];
for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++){const a=volumes[i],b=volumes[j];if(a.room===b.room&&Math.min(a.z+a.height,b.z+b.height)>Math.max(a.z,b.z)+1e-6)assert(!overlaps(a,b),`Internal volume collision ${a.id}/${b.id}`);}
for(const u of plan.operations.deskAccessories.staffUnits)for(const f of insideItems.filter(f=>f.containedIn===u.deskId))assert(!overlaps(f,u.kneeClearZone),`Staff knee area occupied ${f.id}`);
assert.equal(plan.operations.fixtures.length,14);assert.equal(plan.operations.containedItems.filter(f=>f.kind==='loan-pen-tray').reduce((s,f)=>s+f.quantity,0),8);assert.equal(plan.operations.deskAccessories.staffCompartments.length,24);
plan.operations.validation={date:'2026-10-01',floorFixtures:plan.operations.fixtures.length,newFloorFixturesInSupplement:0,serviceZones:'제안 바닥가구·문 회전 사각영역·VR 2×2m와 비충돌',countertopItems:'상판 포함·같은높이 외곽 비충돌, 물병면과 하부컵수거 높이 분리',containedItems:{count:plan.operations.containedItems.length,staffCompartments:24,staffUnits:8,pens:8,result:'기존 부모가구 XY·높이 안에 포함. 내부 소품·예약구획 및 기존 상판물품 간 3D 외곽 비충돌. 직원 무릎 후보 구획 비충돌.'},limitations:'외곽 검증만 수행. 판두께·레일·문·열배출·인체/제품 용량·겨울외투 동시 수용·물통 건조능력·실제 배선/배관·정비 동시사용·차음/공조·법규 적합성은 미검증.'};
const file = path.join(__dirname, '공간과_편의시설_좌표_6안.json');
fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ file, revision: plan.revision, rooms: plan.rooms.length, studentDesks: 64, officeDesks: 8, cameras: 4, appliances: 14, toilets: 2, basins: 2, area: plan.areaSummary, checks: 'geometry and counts passed; not measured CAD or code compliance' }, null, 2));
