// Writes this folder's extra.json (the words of the comparison page) from the 10-18
// town extra plus the merged and whole-town versions. fps cells come from the
// five-way run when it exists.
//   node experiences/synk-town/qa/blender-merged-20261018/write-extra.cjs [perf.json]
const fs = require('fs'), path = require('path');
const here = __dirname, town = path.join(here, '../blender-town-20261018');
const base = JSON.parse(fs.readFileSync(path.join(town, 'extra.json'), 'utf8'));
const perfFile = process.argv[2] || path.join(town, 'results/perf-town5-igpu-dpr2.json');
const perf = fs.existsSync(perfFile) ? JSON.parse(fs.readFileSync(perfFile, 'utf8')) : null;
const fpsOf = (variant, vp = '1280x900', view = 'follow') => {
  const s = perf?.summary.find(x => x.variant === variant && x.viewport === vp && x.view === view);
  return s ? `${s.fpsMedian.toFixed(1)} (${Math.min(...s.fps).toFixed(0)}–${Math.max(...s.fps).toFixed(0)})` : '측정 전';
};
const e = {
  eyebrow: 'SYNK TOWN · 굽기 비교 · 합친 판과 동네 전체',
  date: '2026-10-18',
  title: '싱크타운 굽기 비교 — 합친 판과 동네 전체',
  lead: '싱크타운을 블렌더로 다시 만들고 빛·그림자를 텍스처에 구운 판들을 지금 공개판 v20과 같은 카메라로 비교합니다. 합친 판은 아르곤이 남긴 모델링 스크립트를 그대로 돌려 형상을 만들고(새 대화 없음) Claude 판의 굽기·후처리로 구운 가운데 동네이고, 동네 전체 판은 같은 방식으로 바깥 고리(이웃집 8채·큰길·뒷길·둘레길)까지 넓혀 바깥 고리를 가운데가 뜬 뒤에 받습니다. 모든 판은 같은 KTX2·meshopt 후처리를 거쳐 Town에 ?district=로 끼웠고, 풀·꽃·나무와 걷기·충돌·이름표는 v20 그대로입니다.',
  variants: [
    { id: 'v20', dir: 'v20', label: 'v20 (지금 공개판)' },
    { id: 'claude', dir: 'town-claude', label: 'Claude 판' },
    { id: 'argon', dir: 'town-argon', label: '아르곤 판' },
    { id: 'merged', dir: 'town-merged', label: '합친 판' },
    { id: 'wide', dir: 'townwide-merged', set: 'townwide-merged', label: '동네 전체 판' },
  ],
  how: {
    ...base.how,
    merged: '아르곤의 집·공방·온실·바닥(10-18)과 찻집(10-17) 모델링 스크립트를 한 장면에서 불러 형상을 만들고(2초, 부품마다 재질을 떼어 서로 덮어쓰지 않게), Claude 판의 town_bake.py로 같은 빛에서 굽고 내보냈습니다(지도 12장 — 바닥·온실은 2장씩). 길가 의자·화분·나무는 v20이 흐리게 지우는 물건이라 굽기 차폐물에서 빼고 그림자를 실시간에 맡겼고, 아르곤 돌마당 가장자리 돌을 4 mm 올렸고, 잔디 지도 색을 테두리에서 v20에 맞췄습니다. 형상 압축은 meshopt 필터(high).',
    wide: '합친 판에 바깥 고리를 더했습니다. 아르곤에게 이웃집 8채와 바깥 바닥 고리의 모델링 스크립트만 새로 맡기고(부품마다 새 대화, 굽기 없음 — 21분·40분), 가운데와 한 장면에서 Claude 쪽으로 구웠습니다(지도 16장). 바깥 두 부품은 가운데가 뜬 뒤 받고, 그동안 v20 바깥 고리가 그대로 보입니다. 구운 이웃집은 집마다 v20 집 뿌리에 붙어 카메라 앞에서 v20처럼 흐려집니다.',
  },
  compression: base.compression,
  compare: {
    title: '어느 판이 무엇에서 나은가',
    columns: [{ id: 'claude', label: 'Claude 판' }, { id: 'argon', label: '아르곤 판' }, { id: 'merged', label: '합친 판' }, { id: 'wide', label: '동네 전체 판' }],
    rows: [
      { label: '표면 결·입체감', values: { claude: 'v20 형상 그대로에 빛·그늘·불규칙 판석 줄눈. 차분하다', argon: '세 채를 새로 모델링, 네모 판석·테두리 돌·짙은 기와 골', merged: '아르곤 판 형상 그대로(같은 스크립트)', wide: '합친 판 + 아르곤 이웃집(판재 문·창틀 짜임·돌 창턱)' }, better: 'merged' },
      { label: 'v20과 이어짐(가운데 바닥 판 테두리 잔디, v20 대비)', values: { claude: '초록 −4.5%', argon: '초록 약 −4.5%·파랑 −7%(누렇다)', merged: '네 지점 평균 R +0.2%·G −0.1%·B −1.6%', wide: '가운데 테두리는 바깥 고리와 한 장면에서 구워 이음 없음' }, better: 'merged' },
      { label: '가까이 보기의 의자 그림자', values: { claude: 'v20이 지운 의자 그림자가 남음, 다리 그림자 검은 톱니', argon: '의자 그림자가 남음', merged: '없음 — v20처럼 의자와 함께 사라짐', wide: '없음' }, better: 'merged' },
      { label: '돌마당 가장자리', values: { claude: '깔끔', argon: '흰 점선', merged: '이어진 밝은 테두리(v20과 같음)', wide: '같음' } },
      { label: '첫 진입 추가 PC · 휴대폰(한도 12 · 6 MB)', values: { claude: '+11.06 · +5.22 MB', argon: '+12.11 · +6.34 MB (둘 다 넘음)', merged: '+11.77 · +5.53 MB', wide: '+11.72 · +5.51 MB, 바깥 고리 3.60 · 2.01 MB는 첫 화면 뒤' }, better: 'claude' },
      { label: '늘어난 GPU 텍스처 PC · 휴대폰(한도 96 · 32 MB)', values: { claude: '72.7 · 18.2 MB (13장)', argon: '78.3 · 19.6 MB (14장)', merged: '67.1 · 16.8 MB (12장)', wide: '81.1 · 20.3 MB (16장)' }, better: 'merged' },
      { label: '그리기 호출 (PC 따라가기, v20 1,340)', values: { claude: '933', argon: '1,014', merged: '931', wide: '917' }, better: 'wide' },
      { label: `정지 fps (PC 따라가기 중앙값, v20 ${fpsOf('v20')})`, values: { claude: fpsOf('town-claude'), argon: fpsOf('town-argon'), merged: fpsOf('town-merged'), wide: fpsOf('townwide-merged') } },
      { label: '한 번 돌리는 시간(GPU를 혼자 쓸 때)', values: { claude: '굽기 6.7분 + 묶기 약 10분', argon: '부품 24~34분(벽시계 61분) + 묶기 약 6분', merged: '짓기 2초 · 굽기 약 5분 · 묶기 약 5분', wide: '짓기 4초 · 굽기 약 8분 · 묶기 약 6분(아르곤 모델링은 처음 한 번 21·40분)' }, better: 'merged' },
      { label: '고치기 쉬움', values: { claude: '스크립트 한 벌을 고쳐 다시 굽는다', argon: '부품을 새 대화로 다시 맡겨야 한다', merged: '아르곤 스크립트를 직접 고치거나 짓기 단계에서 덧대고 다시 굽는다. 같은 입력이면 같은 결과', wide: '같음. 멈춰도 --resume으로 끝난 지도는 건너뛴다' }, better: 'merged' },
    ],
    note: '초록 칸이 그 줄에서 나은 쪽입니다. MB는 10⁶ 바이트(규격과 같은 단위)입니다. fps는 판들이 회전 사이 흔들림 안이면 가르지 않습니다.',
  },
  unverified: [
    '실물 휴대폰: 메모리가 버티는지, KTX2를 ASTC·ETC2로 푸는 시간, fps. 이 PC(인텔 내장 GPU)의 헤드리스 Edge에서만 쟀습니다.',
    '걷는 중·카메라가 도는 중의 fps. 정지 시점만 쟀습니다.',
    'GPU 메모리는 풀린 텍스처 크기로 계산한 값이고 드라이버에서 잰 값이 아닙니다.',
    '휴대폰 망에서 걸리는 시간. 로컬 서버에서 받은 바이트 합계만 쟀습니다(동네 전체 판의 바깥 고리는 이 PC에서 첫 화면 뒤 0.4초 안팎(PC 0.36초·390폭 0.43초)에 붙었지만, 느린 망에서는 몇 초 동안 v20 바깥 고리가 보입니다).',
    '동네 전체 판의 이웃집을 가까이 보면 벽 아래 검은 띠, 문 판재 하나가 밝게 번진 곳, v20보다 강한 회벽 얼룩 무늬가 있습니다(먼 배경으로는 괜찮음).',
    '합친 판·동네 전체 판은 나무 그림자를 굽지 않고 실시간에 맡겨, 나무 아래 은은한 하늘 가림이 구운 판들보다 약합니다.',
    'Claude 판·아르곤 판은 이번 고침(의자 그림자·잔디 색·가장자리 돌)을 넣어 다시 굽지 않았습니다.',
  ],
  decide: '합친 방식으로 동네 전체까지 넓힌 판이 예산 안에서 돌아갑니다. 이 판을 기준으로 이웃집 가까이의 흠을 손본 뒤 master 합치기를 정하시면 됩니다.',
  fpsNote: '측정은 이것 하나만 돌렸고, 블렌더·agy·캡처·다른 측정과 겹치지 않았습니다(18:02~18:55). 다만 그동안 다른 세션의 작업(18:08부터 서버 백업 내려받기, 18:02~18:56 talk 시험)과 초반 윈도우 디펜더 검사로 PC 전체 CPU가 1분 평균 30~100%(중앙값 72%)여서, 앞선 세 판 측정(중앙값 약 30%)에서 60 상한이던 390폭이 50대로 내려오고 판마다 흔들림이 컸습니다. 다섯 판을 회전마다 순서를 돌려 쟀으므로 영향은 판마다 비슷하게 나뉘지만, 판 사이 몇 fps 차이는 가르지 않습니다. 동네 전체 판은 바깥 고리가 붙은 뒤에 쟀습니다.',
  metrics: base.metrics,
};
fs.writeFileSync(path.join(here, 'extra.json'), JSON.stringify(e, null, 2) + '\n'); console.log('ok', perf ? 'fps filled' : 'fps pending');
