// 공개 길(단계 4 · 선택 공개 2단계)의 변형 — 공개 전 확인(tools/publish.mjs)의 규칙을 하나씩 깬 사본을 unit 묶음이 잡아야 한다.
// 변형 하나 = [잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글]. 바꿀 파일이 도구면 tools/mutants.mjs의 TOOL_SUBJECTS에 들어야 사본에 있다.
const PUBLISH = 'tools/publish.mjs';

export const RELEASE_MUTANTS = [
  [
    'unit',
    '공개',
    '지도 칸을 올리기 목록에서 뺀다 — 켜진 길의 코치가 지도를 못 받아 MAP_FAILED로 지금 판에 돌아간다(설계 주인 11-20)',
    PUBLISH,
    '    ...Object.keys(manifest.map?.files ?? {}).map(name => `atlas/${edition}/map/${name}`),\n',
    '',
  ],
  [
    'unit',
    '공개',
    '지도 파일의 sha256을 보지 않는다 — manifest와 다른 지도가 올라가도 지나간다',
    PUBLISH,
    "    ...hashProblems(mapDir, mapTable, 'map/'),\n",
    '',
  ],
  [
    'unit',
    '공개',
    '같은 판이 공개돼 있으면 판 폴더 파일을 보지 않는다 — 공개된 지도와 다른 바이트로 같은 판 폴더를 덮는다(GPT GA1)',
    PUBLISH,
    '  for (const [name, info] of editionFiles(manifest)) {\n',
    '  for (const [name, info] of []) {\n',
  ],
  [
    'unit',
    '공개',
    '지도 없는 공개 판을 받는다 — 켜진 길의 코치가 MAP_FAILED로 지금 판에 돌아간다(GPT GA2)',
    PUBLISH,
    "          'manifest에 지도 파일이 없다(공개 판은 지도와 함께 낸다 — 없으면 켜진 길의 코치가 MAP_FAILED)',\n",
    '',
  ],
];
