// Model facts and option labels: docs/마케팅/PULSE_AI모델_캐스팅_20260930/{roster-v2,voices}.json.
// Six portraits are unchanged copies of desktop/assets/pulse/models/*.webp;
// their public-source provenance and hashes are in desktop/assets/pulse/sources.json.
// F04 was restored from PC_백업_20261003/복원목록.json on 2026-10-12 (SHA-256 checked).
// Voice samples: six models use the casting book's Typecast takes (2026-10-18,
// docs/마케팅/PULSE_AI모델_캐스팅_20260930/voices.json → site/voice), copied on
// 2026-10-19 so the client room and the casting book play the same voices. M03 keeps
// the founder's interview audio.
// F04's hero is built from the approved raw/F20-fresh-v3-2-hairA.png.
// Voice 1/2/3 maps to A/B/C through roster-v2.json + voices.json + build-site.cjs.
// Models are shown with photos only (2026-10-22 founder decision): per-model reference films
// (the ad/runway slots) were withdrawn, and finished SYNK films live in films-view.mjs.
// `photos` are byte copies of the casting book build, site/img/<code>/<shot>-s.webp
// (fullbody · look-1 · look-2 · context, 720px); labels follow roster-v2.json looks and
// catalog.json shotLabels.context. The six portraits above are that build's hero-s.webp too.

const voices = (modelId, labels) => labels.map((label, index) => ({
  id: ['A', 'B', 'C'][index], label, src: `./assets/casting/voice/${modelId}-${index + 1}.mp3`,
}));
const photos = (file, [look1, look2], scene) => [
  { kind: 'fullbody', label: '전신', src: `./assets/casting/photos/${file}-fullbody.webp` },
  { kind: 'look', label: look1, src: `./assets/casting/photos/${file}-look-1.webp` },
  { kind: 'look', label: look2, src: `./assets/casting/photos/${file}-look-2.webp` },
  { kind: 'scene', label: scene, src: `./assets/casting/photos/${file}-context.webp` },
];

export const CASTING_MODELS = Object.freeze([
  {
    id: 'M01', name: '이안', description: '부드러운 · 지적인 · 배우 같은',
    image: './assets/casting/m01.webp',
    hairLabels: ['기본 · 가운데 가르마 웨이브', '넘긴 올백', '내린 댄디컷'],
    voices: voices('M01', ['부드럽고 차분한', '밝고 다정한', '낮고 깊은']),
    photos: photos('m01', ['셔츠 오피스', '레더 스트리트'], '창가 카페 · 커피잔'),
  },
  {
    id: 'F01', name: '유나', description: '세련된 · 섹시한 · 도회적인',
    image: './assets/casting/f01.webp',
    hairLabels: ['기본 · 긴 웨이브', '슬릭 하이 포니테일', '턱선 단발'],
    voices: voices('F01', ['세련되고 또렷한', '낮고 깊은', '가까이 속삭이는']),
    photos: photos('f01', ['슬립 드레스', '트렌치 캐주얼'], '화장대 · 립스틱 바르기'),
  },
  {
    id: 'F02', name: '하린', description: '상큼한 · 발랄한 · 친근한',
    image: './assets/casting/f02.webp',
    hairLabels: ['기본 · 어깨 길이 레이어드', '하이 포니테일', '긴 웨이브'],
    voices: voices('F02', ['밝고 상큼한', '신나고 생기 있는', '편안하고 다정한']),
    photos: photos('f02', ['파스텔 캐주얼', '스트라이프 원피스'], '카페 카운터 · 딸기 라떼'),
  },
  {
    id: 'F03', name: '서진', description: '지적인 · 단정한 · 차분한',
    image: './assets/casting/f03.webp',
    hairLabels: ['기본 · 낮게 묶은 포니테일', '긴 생머리', '옆가르마 단발'],
    voices: voices('F03', ['또렷하고 단정한', '차분하게 설명하는', '밝게 안내하는']),
    photos: photos('f03', ['네이비 수트', '코트 포멀'], '회의실 · 발표'),
  },
  {
    id: 'M02', name: '태준', description: '강렬한 · 성숙한 · 남성적인',
    image: './assets/casting/m02.webp',
    hairLabels: ['기본 · 흘러내리게 넘긴 머리', '깔끔한 슬릭백', '짧은 크롭컷'],
    voices: voices('M02', ['낮고 묵직한', '단단하고 또렷한', '가까이 속삭이는']),
    photos: photos('m02', ['차콜 수트', '스웨이드 캐주얼'], '바 라운지 · 위스키'),
  },
  {
    id: 'F04', name: '지유', description: '청순한 · 상큼한 · 싱그러운',
    image: './assets/casting/f04.webp',
    hairLabels: ['기본 · 긴 흑발 생머리', '앞머리 단발', '로우 번'],
    voices: voices('F04', ['맑고 산뜻한', '차분하고 부드러운', '가까이 속삭이는']),
    photos: photos('f04', ['린넨 내추럴', '니트 스커트'], '바닷가 산책로 · 탄산수'),
  },
  {
    id: 'M03', name: '유호', description: '힙한 · 지적인 · 호감 가는 · SYNK 창업자 본인 기반',
    image: './assets/casting/m03.webp',
    voiceNote: '실제 목소리 · 인터뷰 원음(배경음악 포함)',
    hairLabels: ['기본 · 콘로우', '짧은 투블럭', '어깨 길이 생머리'],
    // These labels refer to the founder's interview recordings, including music.
    voices: voices('M03', ['힘주어 말할 때', '차분하게 설명할 때', '가볍게 말할 때']),
    photos: photos('m03', ['스트리트', '세미 포멀'], '음악 작업실 · 믹싱 데스크'),
  },
]);
