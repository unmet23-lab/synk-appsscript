// 드라마 말하기 로컬 시범판 — 1화 「개강 첫날」 학생 식당 장면 일부(2026-10-31).
// 이 모듈은 **서버만** import한다. 브라우저는 /api/bootstrap이 transfer.text·spec·modelAudio를 뺀 것만 받는다(새 상황 정답 보호).
// 대사·명세 원천은 experiences/drama/s1/ep01.mjs. 여기서 글을 고치지 않고 그대로 가져온다 — 예외는 쇼케이스 영상이 붙는 자리의
// SHOWCASE_CUTS text · meaning뿐이다(영상이 대본의 말을 빼고 연기한 곳을 들리는 말에 맞춤, 11-03 Fable FA1).
// 미디어는 tools/build-drama-pilot-assets.mjs가 승인 자산에서 정리한 것(새 생성 0). 음성만 있는 대사는 정지 사진+원래 녹음이며 립싱크 영상이 아니다.
import fs from 'node:fs';
import ep01 from '../s1/ep01.mjs';
import { MEANING_MN, PROMPT_MN } from './content-mn.mjs';
import { dramaSpecOf, dramaReviewStatus } from '../../../tools/lib/drama-spec-review-unit.mjs';

// 새 상황 카드(도움 언어). 대본 상황 「다음 수업 전에 마실 것을 사려는데 편의점을 못 찾아, 오늘 처음 인사한 같은 과의 다른 선배께」를 옮긴 것
// — 설계 qa/WORLD올리기-20261102/설계.md §5 · §14(11-03 t4 → t9). 한국어 줄에는 답 낱말(편의점)과 위치 묻는 꼴(어디 있는지 · 위치 등 허용 표현)을 쓰지 않는다.
export const TRANSFER_PROMPT = {
 en: 'Before your next class you want to buy a drink, but you can\'t find the convenience store. Politely ask another senior from your department, whom you met for the first time today, where it is.',
 ko: '다음 수업 전에 마실 것을 사고 싶은데 그 가게를 못 찾았어요. 오늘 처음 인사한 같은 과의 다른 선배께 공손하게 여쭤보세요. (가게 이름은 영어 설명을 보세요.)',
};
const T9 = ep01.처음보는대사.find((x) => x.id === 's1e01-t9');
// 새 상황 C — 7~10일 뒤 Atlas 지연 관측(d7)으로 한 번 내는 처음 보는 문항 s1e01-t6(학교 앞 버스 정류장에서 지나가는 어른께 정문 위치,
// 설계 §17). t9와 같은 능력 · 같은 「상황만 보고 만들어 말하기」라 측정 칸이 같다. 카드 두 줄은 t6 허용 표현(정문 · 어디… 등)도, 모범 글의 문장(「길을 잃었어요」)도 쓰지 않는다.
export const DELAYED_PROMPT = {
 en: "You're lost at the bus stop in front of the university. Politely ask an adult walking by where the university's main gate is.",
 ko: '학교 앞 버스 정류장에 처음 내려서 헤매고 있어요. 지나가는 처음 보는 어른께 학교로 들어가는 큰 출입구의 위치를 공손하게 여쭤보세요. (장소 이름은 영어 설명을 보세요.)',
};
const T6 = ep01.처음보는대사.find((x) => x.id === 's1e01-t6');

// 재생 사본 목록(media-list.json, 커밋 — build-drama-pilot-assets.mjs가 쓴다)에 있는 파일만 주소를 준다. 아직 없는 자리(코치 녹음·쇼케이스 영상)는 null — 화면은 글만.
// media/는 git 밖 생성물이라 파일 유무로 정하면 CI · 미디어가 낡은 사본에서 강의가 달라지고 공개본의 영상 참고가 빠진다(11-03).
const MEDIA_LIST = new Set(JSON.parse(fs.readFileSync(new URL('./media-list.json', import.meta.url), 'utf8')));
const built = (file) => (MEDIA_LIST.has(file) ? `/media/${file}` : null);

// 이야기 밖 코치(결정 10-31 「싱크타운 다시 짜기」 ③). 목소리는 감독으로 골랐던 Harrison 그대로 쓴다.
// 감독 녹음(s1/소리/ep01-director-*)은 컷·촬영·「지난번엔」을 말해서 쓰지 않는다.
// 11-03 일레븐 v4 Harrison으로 세 줄을 한 번에 굽고 줄 사이에서 잘랐다(s1/소리/ep01-coach.json). s1/소리/<source>에 두고 빌드하면 자리에 붙는다.
// 테이크 2 통과에는 목소리를 두지 않고 화면 ✓만 둔다(쇼케이스 새글 G6). 장면 뒤 「다른 말로 한번 더」도 쇼케이스 흐름대로 글 카드만이다.
export const COACH_VOICE = {
 noteEnding: { text: '끝에 \'요\'를 붙여 봐요. 이 장면을 다시 해 볼까요?', source: 'ep01-coach-01.mp3', file: 'coach-note-ending.mp3' }, // 새글 G4
 noteOther: { text: '이 장면을 다시 해 볼까요?', source: 'ep01-coach-02.mp3', file: 'coach-note.mp3' }, // 길이·빠진 말 노트
 wrap: { text: '오늘은 여기까지! 수고했어요.', source: 'ep01-coach-03.mp3', file: 'coach-wrap.mp3' }, // 새글 G13
};

// 쇼케이스 한 테이크 넷(명세 qa/쇼케이스-20261031/지시문.mjs) — 11-03 덧니 선배로 구워 원래 녹음(Hana · Julian)을 문장 시작에 맞춰 얹은 판(시댄스 2.5 무제한).
// 원천은 빌드의 --쇼케이스원천 폴더의 <src>, 구간(초, [시작, 끝])은 원래 녹음 판에서 잰 것. 구간을 채운 자리만 장면에 붙는다.
//  listen: 학생(Hana) 목소리 구간 — 소리를 버리고 듣는 연기 고리로만 쓴다(학생 소리가 「내 대답」처럼 나지 않게).
//    쇼케이스 고리는 녹음을 누를 때 처음부터 돈다(pilot.mjs) — 영상판에서 Hana 줄과 듣는 반응이 맞게.
//    first: 그 줄의 첫 시도(아직 어긋남 없음)에만 쓰는 고리 — C3은 「헤맸어」에 눈이 반짝이는 반응이라 첫 시도용, 되물은 뒤에는 C2 고리.
//  reply·reask: 선배 목소리 구간(학생 소리가 끝난 뒤부터). retakeFrom: 테이크 2에서 웃음 뒤 대사를 시작할 곳(reply 사본 안의 초).
export const SHOWCASE_CUTS = [
 { cut: 'C1', src: 'C1.mp4', onto: 'a1', reply: [0, null] }, // 선배 1
 { cut: 'C3', src: 'C3.mp4', onto: 's1e01-6', listenFor: 's1e01-6', first: true, listen: [0.2, 4.0], reask: [4.05, null] }, // 「…헤맸어.」 → 「응? 응? 뭐라고요?」 — 6번 줄 첫 시도 · 첫 되묻기
 { cut: 'C2', src: 'C2.mp4', onto: 'a2', listenFor: 's1e01-6', listen: [0.3, 4.6], reply: [4.65, null], retakeFrom: 2.0 }, // 6번 줄 + 선배 2(테이크2는 웃음 뒤 「여기」부터)
 { cut: 'C4', src: 'C4.mp4', onto: 'a3', listenFor: 's1e01-7', listen: [0.3, 7.2], reply: [7.3, null], // 7번 줄 + 선배 3
  // 영상이 대본의 「도서관?」 한 마디를 빼고 연기해 얹은 원래 녹음에서도 뺐다 — 자막 · 뜻도 들리는 말 그대로(아르곤 A1, 11-03).
  text: '선배님은 좀 부담스러운데… 뭐, 편한 대로 해요. 밥 먹고 같이 가요. 내가 데려다줄게요.',
  meaning: "\"Sunbae-nim\" feels like a bit much... well, whatever you're comfortable with. Let's go together after we eat. I'll take you there." },
];
export const cutFile = (c, part) => `${c.cut.toLowerCase()}-${part}.mp4`;
export const cutParts = (c) => ['listen', 'reply', 'reask'].filter((p) => Array.isArray(c[p]));

function withShowcase(scene) {
 const byId = (id) => scene.find((x) => x.id === id);
 for (const c of SHOWCASE_CUTS) {
  const url = (p) => (Array.isArray(c[p]) ? built(cutFile(c, p)) : null);
  const reply = url('reply'); const listen = url('listen'); const reask = url('reask');
  if (reply) Object.assign(byId(c.onto), { audio: null, video: reply, videoStart: 0, videoEnd: null, retakeStart: c.retakeFrom ?? 0 }, c.text ? { text: c.text } : {}, c.meaning ? { meaning: c.meaning } : {});
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
 return { type: 'student', id, text: l.말, meaning: l.뜻, skill: l.능력, modelAudio, blanks: l.명세.keys.map((k) => k.word), spec: { line: l.말, ...l.명세 }, ...extra };
};
const actor = (id, i, media) => {
 const l = seniorLine(i);
 return { type: 'actor', id, speaker: 'senior', text: l.말, meaning: l.뜻, ...media };
};

const STILL = '/media/taeo-still.webp';
// 몽골어 뜻(content-mn.mjs)을 화면에 나가는 대사 글과 짝 지어 붙인다 — 짝 글이 지금 대사와 다르면 멈춘다(옛 대사의 뜻이 나가지 않게).
function withMongolian(scene) {
 for (const line of scene) {
  const pair = MEANING_MN[line.id];
  if (!pair || pair[0] !== line.text) throw new Error(`몽골어 뜻의 짝 글이 대사와 다르다: ${line.id}`);
  line.meaningMn = pair[1];
 }
 return scene;
}

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
 scene: withMongolian(withShowcase([
  actor('a1', 0, { audio: '/media/senior-01.mp3', image: STILL }),
  student('s1e01-6', '/media/model-6.mp3'),
  actor('a2', 1, { audio: null, image: STILL }), // 선배 2는 쇼케이스 C2 영상(웃음 + 대사)으로만 — withShowcase가 붙인다
  student('s1e01-7', '/media/model-7.mp3', { goal: true }),
  actor('a3', 2, { audio: '/media/senior-03.mp3', image: STILL }),
  student('s1e01-8', '/media/model-8.mp3'),
  actor('a4', 3, { audio: '/media/senior-04.mp3', image: STILL, last: true }),
 ])),
 // 장면 안 1번째 어긋남에 선배가 되묻는 녹음(ep01 되묻기.선배 순서 그대로).
 reasks: ep01.되묻기.선배.map((text, i) => ({ text, audio: `/media/senior-ask-${i + 1}.mp3` })),
 // audio가 null이면 녹음 전 — 화면에 코치 글만 보이고 소리는 내지 않는다.
 coach: Object.fromEntries(Object.entries(COACH_VOICE).map(([k, v]) => [k, { text: v.text, audio: built(v.file) }])),
 // 새 상황 B — ep01 처음보는대사 s1e01-t9(편의점 위치를 오늘 처음 인사한 다른 선배께 · 11-03에 t4 복사실에서 옮김). 장면 7번 줄(도서관 위치를
 // 태오 선배께)과 같은 목적을 다른 장소 · 다른 선배로 묻는 다른 문항이고, 칸 명세 AI 2중 검수(drama-ep01-r13)를 통과했다(검수지문이 지금 내용과
 // 같을 때만 reviewed — 고치면 풀린다). talk 대사 은행(world-drama-lines)과 같은 줄이라 WORLD 안 화면은 talk take로 판정한다.
 // prompt는 학습자 언어로 상황과 필요한 정보만 — 한국어 답 · 첫 글자 없음(기획 §3-5 B). promptKo도 답 낱말(편의점)을 쓰지 않는다 — 장소 이름은 영어 설명에서 본다.
 transfer: {
  id: T9.id,
  skill: T9.능력, // 학습 기록의 능력 이름(말하기 지도). 한국어 답의 실마리가 아니라 화면에 보낸다.
  prompt: TRANSFER_PROMPT.en,
  promptKo: TRANSFER_PROMPT.ko,
  promptMn: PROMPT_MN.transfer,
  to: T9.명세.to,
  text: T9.말,
  spec: { ...dramaSpecOf({ row: T9, kind: 'unseen' }), reviewed: dramaReviewStatus({ row: T9, kind: 'unseen', day: null, before: null }, ep01.id).status === 'passed' },
 },
 delayed: {
  id: T6.id,
  skill: T6.능력,
  prompt: DELAYED_PROMPT.en,
  promptKo: DELAYED_PROMPT.ko,
  promptMn: PROMPT_MN.delayed,
  to: T6.명세.to,
  text: T6.말,
  spec: { ...dramaSpecOf({ row: T6, kind: 'unseen' }), reviewed: dramaReviewStatus({ row: T6, kind: 'unseen', day: null, before: null }, ep01.id).status === 'passed' },
 },
 nextEpisode: { title: ep01.예고.제목, line: '태오 선배가 데려간 동아리 박람회에서 동갑내기 친구를 만난다. 처음으로 말을 놓아 볼까?' },
 assets: {
  manifest: '/media/manifest.json',
  // 재생에 쓰는 파일 전부(제작 도구가 만들고 manifest.json에 바이트·sha256을 적는다). 코치 녹음·쇼케이스 영상은 만들어진 것만.
  media: ['taeo-listen.mp4', 'taeo-still.webp', 'taeo-still-blur.webp', 'next-fair.webp', // next-fair: 오늘 기록 예고 그림 — 화면은 pilot.mjs FALLBACK 경로로 부른다
   'senior-01.mp3', 'senior-03.mp3', 'senior-04.mp3', 'senior-ask-1.mp3', 'senior-ask-2.mp3', 'senior-ask-3.mp3',
   'model-6.mp3', 'model-7.mp3', 'model-8.mp3', 'SUIT-Variable.woff2',
   ...['InterTight-Medium.woff2', 'InterTight-Bold.woff2', 'DMMono-Regular.woff2', 'DMMono-Medium.woff2', ...Object.values(COACH_VOICE).map((v) => v.file), ...SHOWCASE_CUTS.flatMap((c) => cutParts(c).map((p) => cutFile(c, p)))].filter(built)],
  listenLoop: '/media/taeo-listen.mp4',
  poster: STILL,
  backdrop: '/media/taeo-still-blur.webp',
 },
};

export default PILOT;
