// 드라마 말하기 로컬 시범판 — 1화 「개강 첫날」 학생 식당 장면 일부(2026-10-31).
// 이 모듈은 **서버만** import한다. 브라우저는 /api/bootstrap이 transfer.text·spec·modelAudio를 뺀 것만 받는다(새 상황 정답 보호).
// 대사·명세 원천은 experiences/drama/s1/ep01.mjs. 여기서 글을 고치지 않고 그대로 가져온다.
// 미디어는 tools/build-drama-pilot-assets.mjs가 승인 자산에서 정리한 것(새 생성 0). 음성만 있는 대사는 정지 사진+원래 녹음이며 립싱크 영상이 아니다.
import ep01 from '../s1/ep01.mjs';

const dining = ep01.촬영일.find((d) => d.n === 3).줄;
const studentLine = (id) => {
 const l = dining.find((x) => x.id === id);
 if (!l) throw new Error(`대사 없음: ${id}`);
 return l;
};
const seniorLine = (i) => dining.filter((x) => x.누가 === '선배')[i];

const student = (id, modelAudio, extra = {}) => {
 const l = studentLine(id);
 // blanks: 장면 카드에서 가릴 핵심말(보고 말하기 A의 카드 — 정답 보호 대상 아님). spec은 서버가 브라우저에 보내지 않는다.
 return { type: 'student', id, text: l.말, meaning: l.뜻, modelAudio, blanks: l.명세.keys.map((k) => k.word), spec: { line: l.말, ...l.명세 }, ...extra };
};
const actor = (id, i, media) => {
 const l = seniorLine(i);
 return { type: 'actor', id, speaker: 'senior', text: l.말, meaning: l.뜻, ...media };
};

const STILL = '/media/taeo-still.webp';

export const PILOT = {
 id: 's1e01-pilot',
 title: '1화 · 개강 첫날 — 점심, 태오 선배',
 notices: {
  synthetic: '등장인물·얼굴·목소리는 AI로 만든 가상 인물과 합성 표현입니다. 실제 사람이 아닙니다.',
  analysis: '받아쓰기를 위해 녹음을 외부 AI 서비스로 보냅니다. 서버에 저장하지 않고, 이 창을 닫으면 녹음도 사라집니다.',
  practice: '이 시범판의 판정은 받아쓴 글과 미리 정한 규칙만 봅니다. 교사의 평가나 공식 시험 결과가 아닙니다.',
 },
 role: { me: '새로 온 유학생', partner: '권태오 · 3학년 선배', place: '점심시간, 캠퍼스' },
 // 상대 → 나 → 상대 → 나(목표) → 상대 → 나 → 상대. 내 대사는 셋.
 scene: [
  actor('a1', 0, { audio: '/media/senior-01.mp3', image: STILL }),
  student('s1e01-6', '/media/model-6.mp3'),
  // 승인 원테이크의 선배 대답 구간(웃음 + 대사). 학생 모범 소리가 구워진 앞부분은 잘라 냈다.
  actor('a2', 1, { audio: null, image: STILL, video: '/media/taeo-reply.mp4', videoStart: 0, videoEnd: 9.99, retakeStart: 2.25 }), // 테이크2에선 웃음 뒤 대사부터(원본 6.3초)
  student('s1e01-7', '/media/model-7.mp3', { goal: true }),
  actor('a3', 2, { audio: '/media/senior-03.mp3', image: STILL }),
  student('s1e01-8', '/media/model-8.mp3'),
  actor('a4', 3, { audio: '/media/senior-04.mp3', image: STILL, last: true }),
 ],
 // 장면 안 1번째 어긋남에 선배가 되묻는 녹음(ep01 되묻기.선배 순서 그대로).
 reasks: ep01.되묻기.선배.map((text, i) => ({ text, audio: `/media/senior-ask-${i + 1}.mp3` })),
 director: {
  cut: { text: '컷! 좋아요.', audio: '/media/director-cut.mp3' },
  again: { text: '한 번만 더 갈게요.', audio: '/media/director-again.mp3' },
  wrap: { text: '오늘 촬영 여기까지! 수고했어요.', audio: '/media/director-wrap.mp3' },
  betterEnding: { text: '지난번엔 끝이 빠졌는데, 이번엔 다 붙었어요. 좋아요.', audio: '/media/director-better-ending.mp3' },
 },
 // 새 상황 B — ep01 처음보는대사 t4(복사실·교직원)를 참고해 상대(처음 만난 같은 과 선배)·낱말(편의점) 난이도를 맞춘 **검수 전 연습 예시**.
 // 공식 검수 통과 문항·검증된 평가가 아니다. prompt는 학습자 언어(영어)로 상황과 필요한 정보만 — 한국어 답·첫 글자 없음.
 transfer: {
  id: 'transfer-location',
  prompt: 'Before your next class you want to buy a drink, but you can\'t find the convenience store. Another senior from your department, whom you met for the first time today, is standing nearby. Politely ask them where the convenience store is.',
  promptKo: '다음 수업 전에 마실 것을 사고 싶은데 가게를 못 찾았어요. 오늘 처음 인사한 같은 과의 다른 선배가 옆에 있어요. 공손하게 그 가게가 어디 있는지 물어보세요. (가게 이름은 영어 설명을 보세요.)',
  to: 'senior',
  text: '선배님, 혹시 편의점이 어디에 있는지 아세요?',
  spec: {
   line: '선배님, 혹시 편의점이 어디에 있는지 아세요?',
   to: 'senior',
   keys: [{ word: '편의점' }, { word: '어디에 있는지', alts: ['어디 있는지', '어디예요', '어디에 있어요', '어딘지', '어디에 있나요', '어디 있어요'] }],
   ending: ['polite', 'formal'],
   variants: ['선배님, 편의점이 어디예요?', '선배님, 편의점이 어디에 있어요?', '혹시 편의점이 어디 있는지 아세요?'],
   reviewed: false,
  },
 },
 nextEpisode: { title: ep01.예고.제목, line: '태오 선배가 데려간 동아리 박람회에서 동갑내기 친구를 만난다. 처음으로 말을 놓아 볼까?' },
 assets: {
  manifest: '/media/manifest.json',
  // 재생에 쓰는 파일 전부(제작 도구가 만들고 manifest.json에 바이트·sha256을 적는다).
  media: ['taeo-listen.mp4', 'taeo-reply.mp4', 'taeo-still.webp', 'taeo-still-blur.webp',
   'senior-01.mp3', 'senior-03.mp3', 'senior-04.mp3', 'senior-ask-1.mp3', 'senior-ask-2.mp3', 'senior-ask-3.mp3',
   'model-6.mp3', 'model-7.mp3', 'model-8.mp3',
   'director-cut.mp3', 'director-again.mp3', 'director-wrap.mp3', 'director-better-ending.mp3', 'SUIT-Variable.woff2'],
  listenLoop: '/media/taeo-listen.mp4',
  poster: STILL,
  backdrop: '/media/taeo-still-blur.webp',
 },
};

export default PILOT;
