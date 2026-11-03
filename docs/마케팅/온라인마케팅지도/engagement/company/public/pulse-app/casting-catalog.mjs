// Model facts and option labels: docs/마케팅/PULSE_AI모델_캐스팅_20260930/roster-v2.json.
// Six portraits are unchanged copies of desktop/assets/pulse/models/*.webp;
// their public-source provenance and hashes are in desktop/assets/pulse/sources.json.
// F04 was restored from PC_백업_20261003/복원목록.json on 2026-10-12 (SHA-256 checked).
// F04's hero is built from the approved raw/F20-fresh-v3-2-hairA.png.
// Models are shown with photos only (2026-10-22 founder decision): per-model reference films
// (the ad/runway slots) were withdrawn, and finished SYNK films live in films-view.mjs.
// `photos` are byte copies of the casting book build, site/img/<code>/<shot>-s.webp
// (fullbody · look-1 · look-2 · context, 720px); labels follow roster-v2.json looks and
// catalog.json shotLabels.context. The six portraits above are that build's hero-s.webp too.
// 2026-11-02: the casting book's later six (F05 · M04 · F06 · F07 · M05 · M06) were added in
// the book's order with the same rule — portrait = hero-s.webp, photos = <shot>-s.webp,
// all byte-identical to synk.im/pulse/casting — so a model a
// client picks in the casting book can be picked in the project too. Descriptions are
// roster-v2.json impressions (M03 follows the 2026-10-23 founder decision 「힙한 · 4차원」).
// `gender` is roster-v2.json `gender` (남 · 여); the clothing choices read it (casting-view MALE_MODELS).
// 2026-11-03: models carry no voices (founder decision 「둘 다 전부 빼기」). Voices are acted for each ad
// scene and played at the draft stage instead; the old A/B/C samples are kept outside the public
// folder in archive/casting-voice-20261103/ (company folder). Do not add a `voices` field back.

// 2026-11-03: the two idol teams (OPALINE F08 · F09 · F10 · F11, OUTBLUE M07 · M08 · M09 · M10) were added in the book's
// order with the same rule — portrait = hero-s.webp, photos = <shot>-s.webp from the style-v4 casting book build.

const photos = (file, [look1, look2], scene) => [
  { kind: 'fullbody', label: '전신', src: `./assets/casting/photos/${file}-fullbody.webp` },
  { kind: 'look', label: look1, src: `./assets/casting/photos/${file}-look-1.webp` },
  { kind: 'look', label: look2, src: `./assets/casting/photos/${file}-look-2.webp` },
  { kind: 'scene', label: scene, src: `./assets/casting/photos/${file}-context.webp` },
];

export const CASTING_MODELS = Object.freeze([
  {
    id: 'M01', name: '이안', gender: '남', description: '부드러운 · 지적인 · 배우 같은',
    image: './assets/casting/m01.webp',
    hairLabels: ['기본 · 가운데 가르마 웨이브', '넘긴 올백', '내린 댄디컷'],
    photos: photos('m01', ['셔츠 오피스', '레더 스트리트'], '창가 카페 · 커피잔'),
  },
  {
    id: 'F01', name: '유나', gender: '여', description: '세련된 · 섹시한 · 도회적인',
    image: './assets/casting/f01.webp',
    hairLabels: ['기본 · 긴 웨이브', '슬릭 하이 포니테일', '턱선 단발'],
    photos: photos('f01', ['슬립 드레스', '트렌치 캐주얼'], '화장대 · 립스틱 바르기'),
  },
  {
    id: 'F02', name: '하린', gender: '여', description: '상큼한 · 발랄한 · 친근한',
    image: './assets/casting/f02.webp',
    hairLabels: ['기본 · 어깨 길이 레이어드', '하이 포니테일', '긴 웨이브'],
    photos: photos('f02', ['파스텔 캐주얼', '스트라이프 원피스'], '카페 카운터 · 딸기 라떼'),
  },
  {
    id: 'F03', name: '서진', gender: '여', description: '지적인 · 단정한 · 차분한',
    image: './assets/casting/f03.webp',
    hairLabels: ['기본 · 낮게 묶은 포니테일', '긴 생머리', '옆가르마 단발'],
    photos: photos('f03', ['네이비 수트', '코트 포멀'], '회의실 · 발표'),
  },
  {
    id: 'M02', name: '태준', gender: '남', description: '강렬한 · 성숙한 · 남성적인',
    image: './assets/casting/m02.webp',
    hairLabels: ['기본 · 흘러내리게 넘긴 머리', '깔끔한 슬릭백', '짧은 크롭컷'],
    photos: photos('m02', ['차콜 수트', '스웨이드 캐주얼'], '바 라운지 · 위스키'),
  },
  {
    id: 'F04', name: '지유', gender: '여', description: '청순한 · 상큼한 · 싱그러운',
    image: './assets/casting/f04.webp',
    hairLabels: ['기본 · 긴 흑발 생머리', '앞머리 단발', '로우 번'],
    photos: photos('f04', ['린넨 내추럴', '니트 스커트'], '바닷가 산책로 · 탄산수'),
  },
  {
    id: 'M03', name: '유호', gender: '남', description: '힙한 · 4차원 · SYNK 창업자 본인 기반',
    image: './assets/casting/m03.webp',
    hairLabels: ['기본 · 콘로우', '짧은 투블럭', '어깨 길이 생머리'],
    photos: photos('m03', ['스트리트', '세미 포멀'], '음악 작업실 · 믹싱 데스크'),
  },
  {
    id: 'F05', name: '소연', gender: '여', description: '따뜻한 · 단정한 · 친근한',
    image: './assets/casting/f05.webp',
    hairLabels: ['기본 · 쇄골 C컬', '낮게 묶은 머리', '턱선 단발'],
    photos: photos('f05', ['카디건 · 줄무늬 티', '샴브레이 셔츠 · 앞치마'], '아침 주방 · 요리'),
  },
  {
    id: 'M04', name: '민재', gender: '남', description: '친근한 · 솔직한 · 호감 가는',
    image: './assets/casting/m04.webp',
    hairLabels: ['기본 · 일자 앞머리', '올린 투블럭', '자연스러운 펌'],
    photos: photos('m04', ['후드 집업 · 조거 팬츠', '옥스퍼드 셔츠 · 치노(첫 출근)'], '원룸 · 택배 상자 열기'),
  },
  {
    id: 'F06', name: '은정', gender: '여', description: '우아한 · 세련된 · 다정한',
    image: './assets/casting/f06.webp',
    hairLabels: ['기본 · 중단발 웨이브', '낮은 시뇽', '턱선 단발'],
    photos: photos('f06', ['캐멀 코트 · 터틀넥', '실크 블라우스 · 진주 목걸이'], '창가 카페 · 책과 차'),
  },
  {
    id: 'F07', name: '채원', gender: '여', description: '건강한 · 발랄한 · 친근한',
    image: './assets/casting/f07.webp',
    hairLabels: ['기본 · 픽시컷', '넘긴 픽시컷', '운동 헤어밴드'],
    photos: photos('f07', ['크롭 스웻셔츠 · 레깅스', '윈드브레이커 · 러닝 쇼츠'], '강변 러닝 뒤 · 스트레칭'),
  },
  {
    id: 'M05', name: '준호', gender: '남', description: '믿음직한 · 다정한 · 단정한',
    image: './assets/casting/m05.webp',
    hairLabels: ['기본 · 옆 가르마', '짧은 크루컷', '넘긴 머리'],
    photos: photos('m05', ['옥스퍼드 셔츠 · 치노(평일)', '퀼팅 조끼 · 헨리넥(캠핑)'], '캠핑장 아침 · 커피 물 붓기'),
  },
  {
    id: 'M06', name: '한결', gender: '남', description: '청량한 · 상큼한 · 친근한',
    image: './assets/casting/m06.webp',
    hairLabels: ['기본 · 짧은 크롭', '투블럭 · 시스루 앞머리', '쉼표 머리 · 소프트 펌'],
    photos: photos('m06', ['러닝 윈드브레이커 · 쇼츠(운동)', '오버핏 후드 · 카고 팬츠(캠퍼스)'], '농구장 벤치 · 경기 뒤 물 한 병'),
  },
  {
    id: 'F08', name: '윤슬', gender: '여', description: '상큼한 · 친근한 · 믿음직한',
    image: './assets/casting/f08.webp',
    hairLabels: ['기본 · 턱선 단발', '양쪽 귀 뒤로 넘긴 단발', '윗머리 작은 묶음'],
    photos: photos('f08', ['검정 라이더 · 새틴 스커트(시티)', '포플린 셔츠 · 체리 카디건 · 생지 데님(일상)'], '카페 창가 · 커피 한 잔'),
  },
  {
    id: 'F09', name: '로하', gender: '여', description: '청순한 · 세련된 · 우아한',
    image: './assets/casting/f09.webp',
    hairLabels: ['기본 · 체리 웨이브', '낮은 트위스트 · 잔머리', '한쪽 어깨로 넘긴 웨이브'],
    photos: photos('f09', ['프릴 블라우스 · 쉬폰 스커트 · 슬라우치 부츠(로맨틱)', '자수 바시티 · 크림 쉬폰 원피스(스트리트)'], '꽃집 · 작은 꽃다발'),
  },
  {
    id: 'F10', name: '새봄', gender: '여', description: '발랄한 · 상큼한 · 귀여운',
    image: './assets/casting/f10.webp',
    hairLabels: ['기본 · 코퍼 샤기', '집게핀 반묶음', '크게 부풀린 샤기'],
    photos: photos('f10', ['남색 니트 · 크림 셔츠 · 베이지 와이드(프레피)', '애플 그린 바람막이 · 연청 와이드(스트리트)'], '연습실 · 쉬는 시간 물 한 병'),
  },
  {
    id: 'F11', name: '해인', gender: '여', description: '상큼한 · 청순한 · 밝은',
    image: './assets/casting/f11.webp',
    hairLabels: ['기본 · 버터 레이어', '낮은 번', '귀 뒤로 넘긴 레이어'],
    photos: photos('f11', ['카키 필드 재킷 · 레이스 미디 · 레이스업 부츠', '오간자 트렌치 · 포플린 셔츠 · 크링클 와이드'], '공원 피크닉 · 레모네이드'),
  },
  {
    id: 'M07', name: '도현', gender: '남', description: '친근한 · 믿음직한 · 따뜻한',
    image: './assets/casting/m07.webp',
    hairLabels: ['기본 · 가른 앞머리', '앞으로 내린 앞머리', '손으로 넘긴 앞머리'],
    photos: photos('m07', ['스웨이드 초어 재킷 · 스트라이프 셔츠 · 에크루 치노', '스웨이드 모토 재킷 · 빈티지 티 · 생지 데님'], '강변 벤치 · 아이스커피'),
  },
  {
    id: 'M08', name: '하람', gender: '남', description: '상큼한 · 발랄한 · 친근한',
    image: './assets/casting/m08.webp',
    hairLabels: ['기본 · 베이비 펌', '헤어밴드로 넘긴 컬', '앞으로 부풀린 컬'],
    photos: photos('m08', ['보틀 그린 항공 재킷 · 블루 니트 · 빈티지 데님', '시어링 코트 · 하이넥 · 벨트 두 줄 데님'], '스튜디오 앞 계단 · 물 한 병'),
  },
  {
    id: 'M09', name: '서율', gender: '남', description: '세련된 · 청순한 · 차분한',
    image: './assets/casting/m09.webp',
    hairLabels: ['기본 · 소프트 울프', '귀 뒤로 넘긴 울프', '뒤로 넘긴 앞머리'],
    photos: photos('m09', ['멀티 스트라이프 니트 · 버건디 글로시 팬츠', '케이프 차콜 블레이저 · 스카프 · 크림 팬츠'], '책방 창가 · 책 읽기'),
  },
  {
    id: 'M10', name: '지온', gender: '남', description: '힙한 · 개성 있는 · 발랄한',
    image: './assets/casting/m10.webp',
    hairLabels: ['기본 · 텍스처 컷', '검정 비니', '뒤로 넘긴 앞머리'],
    photos: photos('m10', ['코듀로이 블루종 · 레트로 저지 · 배기 데님 · 캡', '크링클 수트 재킷 · 딥 틸 후드 · 골반에 걸친 팬츠'], '농구장 벤치 · 농구공'),
  },
]);
