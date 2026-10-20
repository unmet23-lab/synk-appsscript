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
// F02's ad slot holds the finished 20-second iced-coffee ad (2026-10-20, storyboard v5 in
// docs/마케팅/PULSE_포트폴리오_제작준비_20261012), shown as an expression reference at the founder's request;
// its runway slot is still a 5-second motion sample. Other models' ad/runway films remain unproduced.
// `works` are finished SYNK self-produced films, kept apart from the ad/runway slots.
// M03's music video media is cut from the approved 2026-10-13 2K master
// (198.333s); poster = frame 1995, excerpt = frames 4602-5205.

const voices = (modelId, labels) => labels.map((label, index) => ({
  id: ['A', 'B', 'C'][index], label, src: `./assets/casting/voice/${modelId}-${index + 1}.mp3`,
}));
const videos = () => [
  { kind: 'ad', label: '메인 광고', src: '' },
  { kind: 'runway', label: '런웨이', src: '' },
];

export const CASTING_MODELS = Object.freeze([
  {
    id: 'M01', name: '이안', description: '부드러운 · 지적인 · 배우 같은',
    image: './assets/casting/m01.webp',
    hairLabels: ['기본 · 가운데 가르마 웨이브', '넘긴 올백', '내린 댄디컷'],
    voices: voices('M01', ['부드럽고 차분한', '밝고 다정한', '낮고 깊은']),
    videos: videos(),
  },
  {
    id: 'F01', name: '유나', description: '세련된 · 섹시한 · 도회적인',
    image: './assets/casting/f01.webp',
    hairLabels: ['기본 · 긴 웨이브', '슬릭 하이 포니테일', '턱선 단발'],
    voices: voices('F01', ['세련되고 또렷한', '낮고 깊은', '가까이 속삭이는']),
    videos: videos(),
  },
  {
    id: 'F02', name: '하린', description: '상큼한 · 발랄한 · 친근한',
    image: './assets/casting/f02.webp',
    hairLabels: ['기본 · 어깨 길이 레이어드', '하이 포니테일', '긴 웨이브'],
    voices: voices('F02', ['밝고 상큼한', '신나고 생기 있는', '편안하고 다정한']),
    videos: [
      { kind: 'ad', label: '아이스커피 광고 · 20초', description: '하린의 표정과 분위기를 보여 드리는 참고용 시안이에요. 실제로 만드는 광고의 화질·연출과는 달라요.', src: './assets/casting/video/F02-ad-iced-coffee-20s-v1.mp4', poster: './assets/casting/video/F02-ad-iced-coffee-20s-v1-poster.webp', aspectRatio: '9:16', sampleType: 'expression' },
      { kind: 'runway', label: '런웨이 · 5초 움직임 샘플', src: './assets/casting/video/F02-runway-motion-5s-v1.mp4', aspectRatio: '9:16', sampleType: 'motion' },
    ],
  },
  {
    id: 'F03', name: '서진', description: '지적인 · 단정한 · 차분한',
    image: './assets/casting/f03.webp',
    hairLabels: ['기본 · 낮게 묶은 포니테일', '긴 생머리', '옆가르마 단발'],
    voices: voices('F03', ['또렷하고 단정한', '차분하게 설명하는', '밝게 안내하는']),
    videos: videos(),
  },
  {
    id: 'M02', name: '태준', description: '강렬한 · 성숙한 · 남성적인',
    image: './assets/casting/m02.webp',
    hairLabels: ['기본 · 흘러내리게 넘긴 머리', '깔끔한 슬릭백', '짧은 크롭컷'],
    voices: voices('M02', ['낮고 묵직한', '단단하고 또렷한', '가까이 속삭이는']),
    videos: videos(),
  },
  {
    id: 'F04', name: '지유', description: '청순한 · 상큼한 · 싱그러운',
    image: './assets/casting/f04.webp',
    hairLabels: ['기본 · 긴 흑발 생머리', '앞머리 단발', '로우 번'],
    voices: voices('F04', ['맑고 산뜻한', '차분하고 부드러운', '가까이 속삭이는']),
    videos: videos(),
  },
  {
    id: 'M03', name: '유호', description: '힙한 · 지적인 · 호감 가는 · SYNK 창업자 본인 기반',
    image: './assets/casting/m03.webp',
    voiceNote: '실제 목소리 · 인터뷰 원음(배경음악 포함)',
    hairLabels: ['기본 · 콘로우', '짧은 투블럭', '어깨 길이 생머리'],
    // These labels refer to the founder's interview recordings, including music.
    voices: voices('M03', ['힘주어 말할 때', '차분하게 설명할 때', '가볍게 말할 때']),
    videos: videos(),
    works: [{
      kind: 'music-video', title: 'Happy, Happy Gangster',
      poster: './assets/casting/video/M03-mv-happy-gangster-poster-v1.webp',
      excerpt: { src: './assets/casting/video/M03-mv-happy-gangster-excerpt-20s-v1.mp4', duration: '20초' },
      full: { src: './assets/casting/video/M03-mv-happy-gangster-full-v1.mp4', duration: '3분 18초' },
      description: 'SYNK가 직접 만든 뮤직비디오의 20초 발췌예요. 3분 넘는 본편 내내 장면과 옷이 바뀌어도 같은 얼굴로 이어져요.',
    }],
  },
]);
