// 드라마 말하기 로컬 시범판 — 1화 「개강 첫날」 학생 식당 장면 일부(2026-10-31).
// 이 모듈은 **서버만** import한다. 브라우저는 /api/bootstrap이 transfer.text·spec·modelAudio를 뺀 것만 받는다(새 상황 정답 보호).
// 대사·명세 원천은 experiences/drama/s1/ep01.mjs. 여기서 글을 고치지 않고 그대로 가져온다.
// 미디어는 tools/build-drama-pilot-assets.mjs가 승인 자산에서 정리한 것(새 생성 0). 음성만 있는 대사는 정지 사진+원래 녹음이며 립싱크 영상이 아니다.
import fs from 'node:fs';
import ep01 from '../s1/ep01.mjs';

// 빌드가 만든 재생 사본이 있을 때만 주소를 준다. 아직 없는 자리(코치 녹음·쇼케이스 영상)는 null — 화면은 글만, 장면은 지금 판 그대로 돈다.
const MEDIA_DIR = new URL('./media/', import.meta.url);
const built = (file) => (fs.existsSync(new URL(file, MEDIA_DIR)) ? `/media/${file}` : null);

// 이야기 밖 코치(결정 10-31 「싱크타운 다시 짜기」 ③). 목소리는 감독으로 골랐던 Harrison 그대로 쓴다.
// 감독 녹음(s1/소리/ep01-director-*)은 컷·촬영·「지난번엔」을 말해서 쓰지 않는다.
// 아직 녹음 전이다 — 힉스필드 크레딧이 들어 유호님 승인 뒤 쇼케이스 녹음과 한 번에 굽는다. s1/소리/<source>에 두고 빌드하면 자리에 붙는다.
// 테이크 2 통과에는 목소리를 두지 않고 화면 ✓만 둔다(쇼케이스 새글 G6). 장면 뒤 「다른 말로 한번 더」도 쇼케이스 흐름대로 글 카드만이다.
export const COACH_VOICE = {
 noteEnding: { text: '끝에 \'요\'를 붙여 봐요. 이 장면을 다시 해 볼까요?', source: 'ep01-coach-01.mp3', file: 'coach-note-ending.mp3' }, // 새글 G4
 noteOther: { text: '이 장면을 다시 해 볼까요?', source: 'ep01-coach-02.mp3', file: 'coach-note.mp3' }, // 길이·빠진 말 노트
 wrap: { text: '오늘은 여기까지! 수고했어요.', source: 'ep01-coach-03.mp3', file: 'coach-wrap.mp3' }, // 새글 G13
};

// 쇼케이스 한 테이크 넷(명세 qa/쇼케이스-20261031/지시문.mjs) — 아직 굽지 않았다(얼굴 결정·견적 승인 뒤).
// 구운 파일을 빌드의 --쇼케이스원천 폴더에 <src>로 두고, 받은 파일에서 잰 구간(초, [시작, 끝])으로 null을 채운 뒤 빌드하면 만들어진 사본만 장면에 붙는다.
//  listen: 학생(Hana) 목소리 구간 — 소리를 버리고 듣는 연기 고리로만 쓴다(학생 소리가 「내 대답」처럼 나지 않게).
//    쇼케이스 고리는 녹음을 누를 때 처음부터 돈다(pilot.mjs) — 영상판에서 Hana 줄과 듣는 반응이 맞게.
//    first: 그 줄의 첫 시도(아직 어긋남 없음)에만 쓰는 고리 — C3은 「헤맸어」에 눈이 반짝이는 반응이라 첫 시도용, 되물은 뒤에는 C2 고리.
//  reply·reask: 선배 목소리 구간(학생 소리가 끝난 뒤부터). retakeFrom: 테이크 2에서 웃음 뒤 대사를 시작할 곳(reply 사본 안의 초).
export const SHOWCASE_CUTS = [
 { cut: 'C1', src: 'C1.mp4', onto: 'a1', reply: null }, // 선배 1
 { cut: 'C3', src: 'C3.mp4', onto: 's1e01-6', listenFor: 's1e01-6', first: true, listen: null, reask: null }, // 「…헤맸어.」 → 「응? 응? 뭐라고요?」 — 6번 줄 첫 시도 · 첫 되묻기
 { cut: 'C2', src: 'C2.mp4', onto: 'a2', listenFor: 's1e01-6', listen: null, reply: null, retakeFrom: null }, // 6번 줄 + 선배 2
 { cut: 'C4', src: 'C4.mp4', onto: 'a3', listenFor: 's1e01-7', listen: null, reply: null }, // 7번 줄 + 선배 3
];
export const cutFile = (c, part) => `${c.cut.toLowerCase()}-${part}.mp4`;
export const cutParts = (c) => ['listen', 'reply', 'reask'].filter((p) => Array.isArray(c[p]));

function withShowcase(scene) {
 const byId = (id) => scene.find((x) => x.id === id);
 for (const c of SHOWCASE_CUTS) {
  const url = (p) => (Array.isArray(c[p]) ? built(cutFile(c, p)) : null);
  const reply = url('reply'); const listen = url('listen'); const reask = url('reask');
  if (reply) Object.assign(byId(c.onto), { audio: null, video: reply, videoStart: 0, videoEnd: null, retakeStart: c.retakeFrom ?? 0 });
  if (listen) byId(c.listenFor)[c.first ? 'listenFirst' : 'listen'] = listen;
  if (reask) byId(c.onto).reaskVideo = reask;
 }
 return scene;
}

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
  synthetic: '인물은 지어냈고, 목소리는 모두 합성했어요.',
  analysis: '받아쓰기를 위해 녹음을 외부 AI 서비스로 보냅니다. 서버에 저장하지 않고, 이 창을 닫으면 녹음도 사라집니다.',
  practice: '이 시범판의 판정은 받아쓴 글과 미리 정한 규칙만 봅니다. 교사의 평가나 공식 시험 결과가 아닙니다.',
 },
 role: { me: '새로 온 유학생', partner: '권태오 · 3학년 선배', place: '점심시간, 캠퍼스' },
 // 상대 → 나 → 상대 → 나(목표) → 상대 → 나 → 상대. 내 대사는 셋.
 // 쇼케이스 영상을 구워 넣으면 a1·a2·a3은 그 영상으로, 6·7번 줄의 듣는 고리와 6번 줄 첫 되묻기도 그 영상으로 바뀐다(withShowcase).
 scene: withShowcase([
  actor('a1', 0, { audio: '/media/senior-01.mp3', image: STILL }),
  student('s1e01-6', '/media/model-6.mp3'),
  // 승인 원테이크의 선배 대답 구간(웃음 + 대사). 학생 모범 소리가 구워진 앞부분은 잘라 냈다.
  actor('a2', 1, { audio: null, image: STILL, video: '/media/taeo-reply.mp4', videoStart: 0, videoEnd: 9.99, retakeStart: 2.25 }), // 테이크2에선 웃음 뒤 대사부터(원본 6.3초)
  student('s1e01-7', '/media/model-7.mp3', { goal: true }),
  actor('a3', 2, { audio: '/media/senior-03.mp3', image: STILL }),
  student('s1e01-8', '/media/model-8.mp3'),
  actor('a4', 3, { audio: '/media/senior-04.mp3', image: STILL, last: true }),
 ]),
 // 장면 안 1번째 어긋남에 선배가 되묻는 녹음(ep01 되묻기.선배 순서 그대로).
 reasks: ep01.되묻기.선배.map((text, i) => ({ text, audio: `/media/senior-ask-${i + 1}.mp3` })),
 // audio가 null이면 녹음 전 — 화면에 코치 글만 보이고 소리는 내지 않는다.
 coach: Object.fromEntries(Object.entries(COACH_VOICE).map(([k, v]) => [k, { text: v.text, audio: built(v.file) }])),
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
  // 재생에 쓰는 파일 전부(제작 도구가 만들고 manifest.json에 바이트·sha256을 적는다). 코치 녹음·쇼케이스 영상은 만들어진 것만.
  media: ['taeo-listen.mp4', 'taeo-reply.mp4', 'taeo-still.webp', 'taeo-still-blur.webp',
   'senior-01.mp3', 'senior-03.mp3', 'senior-04.mp3', 'senior-ask-1.mp3', 'senior-ask-2.mp3', 'senior-ask-3.mp3',
   'model-6.mp3', 'model-7.mp3', 'model-8.mp3', 'SUIT-Variable.woff2',
   ...[...Object.values(COACH_VOICE).map((v) => v.file), ...SHOWCASE_CUTS.flatMap((c) => cutParts(c).map((p) => cutFile(c, p)))].filter(built)],
  listenLoop: '/media/taeo-listen.mp4',
  poster: STILL,
  backdrop: '/media/taeo-still-blur.webp',
 },
};

export default PILOT;
