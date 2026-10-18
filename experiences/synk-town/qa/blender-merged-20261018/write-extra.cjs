// Writes this folder's extra.json (the words of the comparison page) from the 10-18
// town extra plus the merged and whole-town versions. fps cells come from the
// five-way run when it exists.
//   node experiences/synk-town/qa/blender-merged-20261018/write-extra.cjs [perf.json]
const fs = require('fs'), path = require('path');
const here = __dirname, town = path.join(here, '../blender-town-20261018');
const base = JSON.parse(fs.readFileSync(path.join(town, 'extra.json'), 'utf8'));
const perfFile = process.argv[2] || path.join(town, 'results/perf-town5b-igpu-dpr2.json'); // 10-19 re-run after the neighbour and core fixes
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
    wide: '합친 판에 바깥 고리를 더했습니다. 아르곤에게 이웃집 8채와 바깥 바닥 고리의 모델링 스크립트만 새로 맡기고(부품마다 새 대화, 굽기 없음 — 21분·40분), 가운데와 한 장면에서 Claude 쪽으로 구웠습니다(지도 16장). 바깥 두 부품은 가운데가 뜬 뒤 받고, 그동안 v20 바깥 고리가 그대로 보입니다. 구운 이웃집은 집마다 v20 집 뿌리에 붙어 카메라 앞에서 v20처럼 흐려집니다. 이웃집은 굽기 전에 안쪽을 향한 면을 뒤집고 다른 조각에 묻힌 면을 지웠고(면마다 여러 점으로 판정), 조각끼리 굽기 여백이 서로 덮어쓰지 않게 여백 없이 구운 뒤 빈칸을 직접 메웠고, 텍셀보다 얇은 조각은 지도에서 넓혀 구웠고, 벽 지도만 UASTC로 압축합니다(2048표본). 모든 지도를 굽기 여백 없이 구웠고, Town 서버 보안 정책(CSP)에 WebAssembly·blob을 허용해 정책을 켠 브라우저에서도 뜹니다(그 전 QA는 정책을 끄고 열어 실패를 못 봤습니다).',
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
      { label: '첫 진입 추가 PC · 휴대폰(한도 12 · 6 MB)', values: { claude: '+11.06 · +5.22 MB', argon: '+12.11 · +6.34 MB (둘 다 넘음)', merged: '+11.77 · +5.53 MB', wide: '+10.67 · +5.33 MB, 바깥 고리 6.04 · 2.69 MB는 첫 화면 뒤' }, better: 'claude' },
      { label: '늘어난 GPU 텍스처 PC · 휴대폰(한도 96 · 32 MB)', values: { claude: '72.7 · 18.2 MB (13장)', argon: '78.3 · 19.6 MB (14장)', merged: '67.1 · 16.8 MB (12장)', wide: '81.1 · 20.3 MB (16장)' }, better: 'merged' },
      { label: '그리기 호출 (PC 따라가기, v20 1,340)', values: { claude: '933', argon: '1,014', merged: '931', wide: '917' }, better: 'wide' },
      { label: `정지 fps (PC 따라가기 중앙값, v20 ${fpsOf('v20')})`, values: { claude: fpsOf('town-claude'), argon: fpsOf('town-argon'), merged: fpsOf('town-merged'), wide: fpsOf('townwide-merged') } },
      { label: '한 번 돌리는 시간(GPU를 혼자 쓸 때)', values: { claude: '굽기 6.7분 + 묶기 약 10분', argon: '부품 24~34분(벽시계 61분) + 묶기 약 6분', merged: '짓기 2초 · 굽기 약 5분 · 묶기 약 5분', wide: '짓기 4초 · 굽기 약 8분 · 묶기 약 9분(아르곤 모델링은 처음 한 번 21·40분). 이웃집 지도 2장 2048표본 다시 굽기는 GPU를 혼자 쓸 때 재지 않았다(나눠 쓸 때 약 21분)' }, better: 'merged' },
      { label: '고치기 쉬움', values: { claude: '스크립트 한 벌을 고쳐 다시 굽는다', argon: '부품을 새 대화로 다시 맡겨야 한다', merged: '아르곤 스크립트를 직접 고치거나 짓기 단계에서 덧대고 다시 굽는다. 같은 입력이면 같은 결과', wide: '같음. 멈춰도 --resume으로 끝난 지도는 건너뛴다' }, better: 'merged' },
    ],
    note: '초록 칸이 그 줄에서 나은 쪽입니다. MB는 10⁶ 바이트(규격과 같은 단위)입니다. fps는 판들이 회전 사이 흔들림 안이면 가르지 않습니다.',
  },
  figures: {
    title: '이웃집 가까이 — 고치기 전과 뒤',
    lead: '동네 전체 판 이웃집 두 채를 문 앞에서 본 화면입니다(PC 1280폭). 고치기 전 판의 벽 아래 검은 띠, 황갈색으로 번진 문 판자, 회벽의 회녹색 얼룩, 덧문 가로대 검은 줄이 고친 뒤에는 없습니다.',
    items: [{ src: '.tmp/town-blender-20261018/nb-close-compare.png', label: '왼쪽부터 v20 · 고치기 전 · 고친 뒤 — 위 왼쪽 이웃집, 아래 오른쪽 이웃집' }],
    note: '원인과 고침: 굽기 여백이 다른 조각의 자리를 덮어씀 → 여백 없이 굽고 빈칸을 직접 메움, 텍셀보다 얇은 조각이 구워지지 않음 → 지도에서 넓혀 굽기, ETC1S 압축 얼룩 → 벽 지도만 UASTC, 안쪽을 향한 면과 묻힌 면 → 굽기 전 면 청소(면마다 여러 점으로 판정).',
  },
  unverified: [
    '실물 휴대폰: 메모리가 버티는지, KTX2를 ASTC·ETC2로 푸는 시간, fps. 이 PC(인텔 내장 GPU)의 헤드리스 Edge에서만 쟀습니다.',
    '걷는 중·카메라가 도는 중의 fps. 정지 시점만 쟀습니다.',
    'GPU 메모리는 풀린 텍스처 크기로 계산한 값이고 드라이버에서 잰 값이 아닙니다.',
    '휴대폰 망에서 걸리는 시간. 로컬 서버에서 받은 바이트 합계만 쟀습니다(동네 전체 판의 바깥 고리는 이 PC에서 첫 화면 뒤 1초 안쪽(PC 0.51초·390폭 0.12초)에 붙었지만, 느린 망에서는 몇 초 동안 v20 바깥 고리가 보입니다).',
    '동네 전체 판 이웃집 가까이의 흠(벽 아래 검은 띠, 황갈색으로 번진 문 판자, 회벽 얼룩, 덧문 가로대 검은 줄)은 고쳤습니다. 이웃집 벽 지도는 미터당 약 31텍셀이라 아주 가까이서는 v20의 평평한 색보다 그늘이 부드럽게 번져 보입니다.',
    '가운데 집들 지도(덮어쓰기 0.9~5.3%, 1024로 줄여 잰 값)도 여백 없이 다시 구웠습니다(10-19 0시). 같은 시점 화면에서 바뀐 것은 조각 가장자리 몇 픽셀뿐이고 새로 생긴 흠은 찾지 못했습니다. 동네 전체 판 묶음은 PC 16.85 → 15.81 MB로 줄었습니다.',
    '합친 판·동네 전체 판은 나무 그림자를 굽지 않고 실시간에 맡겨, 나무 아래 은은한 하늘 가림이 구운 판들보다 약합니다.',
    'Claude 판·아르곤 판은 이번 고침(의자 그림자·잔디 색·가장자리 돌)을 넣어 다시 굽지 않았습니다.',
  ],
  decide: '합친 방식으로 동네 전체까지 넓힌 판이 예산 안에서 돌아가고, 이웃집 가까이의 흠도 고쳤습니다. 이 판을 기준으로 master 합치기를 정하시면 됩니다.',
  fpsNote: '이웃집과 가운데 집들을 고친 뒤 다시 잰 값입니다(10-19 00:50~01:27, perf-town5b). 측정은 이것 하나만 돌렸고 블렌더·agy·캡처·다른 측정과 겹치지 않았으며, PC 전체 CPU는 1분 평균 중앙값 16%(시작 직후 43%, 01:04에 한 번 91%)로 조용했습니다. 390폭은 다섯 판 모두 60 상한에 붙었습니다. PC 따라가기에서 구운 판들이 v20보다 2~7 fps 낮게 나오지만, 회전 사이 흔들림(괄호)이 판 사이 차이만큼 커서 구운 판끼리 순위는 매기지 않습니다. 동네 전체 판은 바깥 고리가 붙은 뒤에 쟀습니다. 앞선 측정(10-18 18:02~18:55)은 PC CPU 중앙값 72%로 흔들려 이 값으로 바꿨습니다.',
  metrics: base.metrics,
};
fs.writeFileSync(path.join(here, 'extra.json'), JSON.stringify(e, null, 2) + '\n'); console.log('ok', perf ? 'fps filled' : 'fps pending');
