// 「오늘」 한 장(11-14, 깃발 ?today=1 뒤 — 공개 빌드는 이 폴더를 싣지 않는다)이 여는 1화 처음 보는 대사.
// 줄 · 능력 · 녹음 상한은 원고(experiences/drama/s1/ep01.mjs 처음보는대사)와 talk 대사 은행(tools/build-world-speaking-talk.mjs dramaLines)의
// 값을 옮겼다 — tests/drama-today.test.mjs가 원고와 맞는지 본다. 제목 · 상황 글 · 영어 설명은 이 판의 화면 글이라 **검수 전 초안**이다.
// 새 상황 규칙(pilot.mjs 머리): 첫 제출 전 화면에 한국어 답 · 첫 글자가 없다 — 제목 · 한국어 상황 글에는 그 줄의 핵심 말 · 대체 말(명세 keys)을
// 쓰지 않는다(시험이 본다). B(t9)처럼 한국어 글은 누구에게 · 어디서만 말하고, 무엇을 말할지는 영어 설명(prompt)이 맡는다.
// t9(B) · t6(C)는 WORLD 강의(world-lesson.json)의 것을 그대로 쓴다. t5는 검수 전(draft)이라 싣지 않는다.

export const EPISODE = 's1e01';

// 「복습」은 처음 보는 상황을 짝으로 열지 않는다(11-15) — 첫 화면과 같은 「틀린 장면 복습」으로 그 장면 그 대사를 빈칸 카드로 다시 한다
// (plan.mjs againItem · 유호님 11-14 「스스로 틀린장면 복습 … 튜터처럼 근거」). 11-14 판의 짝(6→t3 · 7→t4 · 8→t7)은 「오늘 공부」 차례에 그대로 있다.

// 「오늘 공부」: B를 안 했으면 B, 했으면 아래 차례로 아직 안 본 줄. 한국어 상황 글만으로 무엇을 말할지 서는 줄(t7 · t3)이 앞이다 —
// 「무엇을 말할지는 위 설명을 보세요」가 붙은 줄(t8 · t2 · t1 · t4)은 영어 설명을 읽어야 한다(설계 세션 11-14).
export const NEW_ORDER = Object.freeze(['s1e01-t7', 's1e01-t3', 's1e01-t8', 's1e01-t2', 's1e01-t1', 's1e01-t4']);

// 끝맺음 노트를 「'요'」로 불러도 되는 장면 줄 — 해요체 대사라 끝에 '요'를 붙이면 허용 꼴이 되는 줄(설계 세션 11-14 판정기 대조: 높임 대사의
// 끝맺음 노트는 반말로 확신될 때만 남는다). 반말 대사 · 합쇼체만 받는 줄이 오면 여기에 넣지 않고 일반 문장으로 내려간다.
export const YO_LINES = Object.freeze(['s1e01-6', 's1e01-7', 's1e01-8']);

// 태오가 그 장면 줄을 되부르는 말(그 줄을 말한 기록이 있을 때만 쓴다) — 사람이 나를 기억하고 말 거는 맛(설계 세션 11-14, 문장은 초안).
// 복습은 그 대사를 빈칸 카드로 다시 하는 일이라, 태오는 그 장면의 때와 곳만 떠올리고 대사의 내용은 말하지 않는다(11-15). 그 대사의
// 답 낱말(6번이면 「길을 잃어서」 · 「헤맸어요」)이 들어가면 빈칸이 뜻을 잃는다 — 시험이 본다. 태오는 1화의 선배라 장면에서처럼 「나」와 해요체로 말한다.
export const TAEO_CALL = Object.freeze({
 // 1화 장면 2는 점심의 학생 식당이다. 태오는 정문 지도 앞의 학생을 그 전에 봤을 뿐이고, 처음 말을 건 곳은 식당이다(11-15 Fable 검수 P3).
 's1e01-6': { text: '식당에서 처음 만났죠? 그 장면, 오늘 한 번 더 해요.' },
 's1e01-7': { text: '그날 나한테 하나 물어봤죠? 그 장면, 오늘 한 번 더 해요.' },
 's1e01-8': { text: '같이 가자고 했던 거 기억나요? 그 장면, 오늘 한 번 더 해요.' },
});

// 태오 한 줄의 목소리 · 입 맞는 영상을 끼울 자리 — 틀 code(plan.mjs TAEO_LINES) → { video }(drama/pilot 기준 경로).
// 비어 있으면 듣는 고리 영상 + 화면 글로 간다. 굽는 법은 qa/오늘한장-20261114/태오굽기.py(11-16 유호님 「웅 써도 돼.」 — 드리미나 시댄스 2.5 flash 480p,
// 1화 태오 녹음을 목소리 결 참고로). 11-16 첫 줄은 음높이가 1화 녹음보다 낮지만(가운데 121Hz ↔ 152~165Hz) 유호님이 들어 보시고
// 「오케이 진행해 지금 보내준 세개 다 좋다」라고 하셨다(만족 사례 장부 S54). 나머지 줄은 `태오굽기.py --차례 --실행`이 하루 몫 안에서 굽고 여기에 넣는다.
export const TAEO_MEDIA = Object.freeze({
 'again.call.s1e01-6.yo': { video: 'media/today-taeo-6yo.mp4' },
 'again.review': { video: 'media/today-taeo-review.mp4' },
});

const SEE_ABOVE = '(무엇을 말할지는 위 설명을 보세요.)';
// 처음 보는 대사. title: 줄 위 짧은 제목. situation: 녹음 카드의 한국어 상황 글. prompt: 영어 설명. like: 1화의 어느 줄과 같은 말하기인지(까닭 글).
export const POOL = Object.freeze([
 { id: 's1e01-t1', scene: 'office', action: '찾아온 까닭 말하기', skill: 'ko.speaking.purpose', to: 'staff', answerSec: 13, text: '수강 신청에 대해 여쭤볼 게 있어서 왔어요.', meaning: 'I came to ask about course registration.',
  title: '학과 사무실, 조교 선생님께', situation: `학과 사무실에 왔어요. 조교 선생님께 왜 왔는지 공손하게 말해 보세요. ${SEE_ABOVE}`,
  prompt: 'You walk into the department office. Politely tell the assistant that you came because you have a question about signing up for classes.', like: null },
 { id: 's1e01-t2', scene: 'libdesk', action: '책 일로 여쭤보기', skill: 'ko.speaking.ask', to: 'staff', answerSec: 13, text: '이 책 반납 기한이 언제까지인지 궁금해서요.', meaning: 'I was wondering when this book is due.',
  title: '도서관 안내 데스크에서', situation: `도서관 안내 데스크 직원이 「무엇을 도와드릴까요?」라고 물어요. 들고 있는 책 일로 공손하게 물어보세요. ${SEE_ABOVE}`,
  prompt: 'At the library help desk, the librarian asks how they can help. Politely ask by when you have to bring back the book you are holding.', like: 's1e01-7' },
 { id: 's1e01-t3', scene: 'dorm', action: '요즘 지내는 얘기하기', skill: 'ko.speaking.status', to: 'staff', answerSec: 14, text: '처음엔 힘들었지만 조금씩 익숙해지고 있어요.', meaning: 'It was hard at first, but I\'m getting used to it little by little.',
  title: '기숙사 사감 선생님께, 요즘 얘기', situation: '기숙사 사감 선생님이 지낼 만하냐고 물으세요. 처음 며칠은 어땠는지, 요즘은 어떤지 한 번에 말해 보세요.',
  prompt: 'The dorm supervisor asks how you are settling in. Say that it was hard at first, but you are slowly getting used to it.', like: 's1e01-6' },
 { id: 's1e01-t4', scene: 'hall', action: '찾는 곳 여쭤보기', skill: 'ko.speaking.ask', to: 'staff', answerSec: 13, text: '선생님, 혹시 복사실이 어디에 있는지 아세요?', meaning: 'Excuse me, do you happen to know where the copy room is?',
  title: '처음 본 교직원께 길 묻기', situation: `찾는 곳이 있는데 못 찾았어요. 처음 본 교직원께 그곳을 공손하게 여쭤보세요. ${SEE_ABOVE}`,
  prompt: 'You need to make copies but cannot find the copy room. Politely ask a staff member you have never met whether they know where it is.', like: 's1e01-7' },
 { id: 's1e01-t7', scene: 'office', action: '해결해 주신 일에 인사하기', skill: 'ko.speaking.thank', to: 'staff', answerSec: 13, text: '선생님 덕분에 살았어요. 정말 감사합니다.', meaning: 'You\'re a lifesaver. Thank you so much.',
  title: '서류 일을 풀어 준 조교 선생님께', situation: '서류 일로 곤란했는데 조교 선생님이 해결해 주셨어요. 그 마음을 공손하게 전해 보세요.',
  prompt: 'The department assistant just sorted out your paperwork problem. Tell them they saved you, and thank them warmly and politely.', like: 's1e01-8' },
 { id: 's1e01-t8', scene: 'prof', action: '낼 곳 여쭤보기', skill: 'ko.speaking.ask', to: 'professor', answerSec: 15, text: '교수님, 과제를 어디에 내야 하는지 여쭤봐도 될까요?', meaning: 'Professor, may I ask where I should hand in the assignment?',
  title: '교수님 연구실 앞에서', situation: `교수님 연구실 앞이에요. 이번 주에 낼 것을 들고 왔어요. 교수님께 공손하게 여쭤보세요. ${SEE_ABOVE}`,
  prompt: 'You are outside your professor\'s office with this week\'s assignment. Politely ask if you may ask where you should hand it in.', like: 's1e01-7' },
]);

export const poolItem = (id) => POOL.find((x) => x.id === id) || null;

// 처음 보는 대사 결과 글 — 드라마의 새 상황 글(transferPass · transferMissing)은 B(위치 묻기) 말이라, 「오늘」 줄에는 상황을 가리지 않는 말로(검수 전 초안).
export const TEXT = Object.freeze({
 transferPass: '받아 적은 글에서 이 상황에 필요한 말을 찾았어요. 자동 규칙으로 본 것이고, 교사 평가는 아니에요.',
 transferMissing: '받아 적은 글에서는 이 상황에 필요한 말이 다 보이지 않았어요. 위 상황을 다시 읽고 한 번 더 말해 보거나, 모범을 볼 수 있어요.',
});

// 장면 줄을 까닭 글에 짧게 부를 때: 「…한참 헤맸어요」. 정해 둔 꼬리가 없으면 끝 두 어절.
export const TAILS = Object.freeze({ 's1e01-6': '한참 헤맸어요', 's1e01-7': '어디에 있는지 아세요', 's1e01-8': '덕분에 살았어요' });
export function lineTail(text, id = null) {
 if (id && TAILS[id]) return TAILS[id];
 const words = String(text || '').replace(/[.!?。]+$/u, '').trim().split(/\s+/);
 return words.slice(-2).join(' ');
}

// 「오늘」 장면 판(11-18 유호님 「드라마 장면 쪽으로」 · 「앱에 옮겨」) — 할 일마다 그 드라마의 장면 한 컷과 머리글(어디 · 누구), 할 일, 한 줄.
// 장면 컷은 재생 사본(git 밖 media/, 원천은 ~/Documents/synk-vendor/drama-today-20261116/장면/ — qa/오늘한장-20261114/장면넣기.mjs가 만든다).
// 파일이 없는 작업본에서는 화면이 빈 칸 대신 종이색 칸으로 둔다. 사람은 이름 없는 새 얼굴이다(태오 장면만 1화의 태오).
// 새 상황(B · C · 처음 보는 대사)의 한 줄은 그 상황 글의 첫 문장이다 — 정답 말을 미리 보이지 않는다(새 상황 규칙 · 시험이 본다).
export const SCENES = Object.freeze({
 cafe: { img: 'media/today-scene-cafe.webp', place: '학생 식당', who: '태오 선배' },
 transfer: { img: 'media/today-scene-transfer.webp', place: '캠퍼스', who: '같은 과 다른 선배' },
 office: { img: 'media/today-scene-office.webp', place: '학과 사무실', who: '조교 선생님' },
 libdesk: { img: 'media/today-scene-libdesk.webp', place: '도서관 안내 데스크', who: '직원' },
 dorm: { img: 'media/today-scene-dorm.webp', place: '기숙사', who: '사감 선생님' },
 hall: { img: 'media/today-scene-hall.webp', place: '학교 복도', who: '처음 본 교직원' },
 prof: { img: 'media/today-scene-prof.webp', place: '연구실 앞', who: '교수님' },
 bus: { img: 'media/today-scene-bus.webp', place: '학교 앞 버스 정류장', who: '지나가는 어른' },
});
// 입장 검사 근무지 그림 — 드라마 장면과 같은 실사 컷(장면넣기.mjs VENUE_SOURCE, 아직 없으면 그 게임의 근무지 그림)을 재생 사본으로 옮긴 것.
export const VENUE_IDS = Object.freeze(['pool', 'library', 'museum', 'concert']);
const venueImg = (id) => (VENUE_IDS.includes(id) ? `media/today-venue-${id}.webp` : null);
const first = (t) => String(t || '').split(/(?<=[.?!])\s+/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
// 복습 한 줄 — 기록의 노트 갈래(끝맺음 · 길이 · 빠진 말)를 오늘 할 일로 바꾼다. 「요」는 내용 표에 '요' 줄로 적은 줄에서만.
export function againSay(tail, kind, yo) {
 const q = `「${tail}」`;
 if (kind === 'ending') return yo ? `${q} 끝의 '요'까지 또렷하게` : `${q} 끝맺음을 대사대로`;
 if (kind === 'length') return `${q} 끝까지 다 말하기`;
 return `${q} 빠진 말 없이`;
}
// 날 수를 모르면(시각 없는 기록) 「지난번」 — null <= 0이 참이라 「오늘」로 새지 않게(11-18 카본 A4).
const whenOf = (ago) => (!Number.isFinite(ago) ? '지난번' : ago <= 0 ? '오늘' : ago === 1 ? '어제' : '지난번');
/**
 * 할 일 하나(plan.mjs 계약)를 장면 판의 칸으로 — { scene: { img, place, who }, action, say }. lesson은 world-lesson.json의 lesson.
 * 모르는 꼴이면 null(화면은 옛 제목 · 이유로 그린다).
 */
export function sceneFor(it, lesson = {}) {
 if (!it) return null;
 if (it.kind === 'again') {
  const ev = it.why?.evidence || {};
  // 꼬리는 그 대사 글에서 — 내용 표(TAILS)에 없는 줄도 끝 두 어절로 서고, 글을 못 찾으면 일반 문장으로 내린다(11-18 Opus 대체 검수 F3).
  // 장면 컷은 1화 식당(태오)이다 — 지금 학습 표의 학생 줄(6 · 7 · 8번)이 모두 그 장면이다. 다른 장면의 줄이 표에 들면 칸을 그 장면으로 나눈다.
  const line = (lesson.scene || []).find((x) => x.id === ev.lineId);
  const tail = lineTail(line?.text, ev.lineId);
  return { scene: SCENES.cafe, action: `${whenOf(ev.ago)} 한 말 다시 하기`, say: tail ? againSay(tail, it.note, Boolean(ev.yo)) : '그 대사를 끝까지 또렷하게' };
 }
 if (it.kind === 'new' && it.open?.type === 'scene') return { scene: SCENES.cafe, action: '1화 이어서 하기', say: it.why?.lead || '' };
 if (it.kind === 'new' && it.open?.source === 'transfer') return { scene: SCENES.transfer, action: '길 묻기', say: first(lesson.transfer?.promptKo) };
 if (it.kind === 'new' && it.open?.type === 'situation') {
  const p = poolItem(it.open.lineId);
  return p ? { scene: SCENES[p.scene], action: p.action, say: first(p.situation) } : null;
 }
 if (it.kind === 'check' && it.open?.source === 'delayed') return { scene: SCENES.bus, action: '처음 보는 분께 길 묻기', say: first(lesson.delayed?.promptKo) };
 if (it.kind === 'check' && it.open?.type === 'game') {
  const id = it.open.venueId || null, name = it.open.venueName || (String(it.title || '').match(/·\s*(.+?)\s*근무$/) || [])[1] || '입장 검사';
  // 머리글의 둘째 자리는 다른 칸에서는 말을 거는 사람이지만, 여기서는 학습자 자신이 알바라 「입장 검사 게임」이라고 한다(11-18 Opus 대체 검수 F5).
  return { scene: { img: venueImg(id), place: name, who: '입장 검사 게임' }, action: '손님 표와 짐 확인', say: '손님의 표와 짐을 안내문과 하나씩 맞춰 봐요.' };
 }
 return null;
}
/**
 * 끝 화면(오늘 달라진 것 · 다음에 할 것 · 뜯으면 보이는 다음 장)이 같은 할 일을 부르는 이름 — { place, who, action }.
 * 오늘 장면 판의 머리글(어디 · 누구)과 할 일을 그대로 쓴다. 다만 다른 날에 읽어도 맞게 때(어제 · 지난번)를 빼고, 복습은 그 대사로 부른다
 * (「「한참 헤맸어요」 다시 하기」). 11-18 Opus 대체 검수 F2 · 유호님 「네, 맞춰」 — 끝 화면이 계약의 옛 제목(「1화에서 그 대사 한 번 더」,
 * 「서류 일을 풀어 준 조교 선생님께」)을 써서, 다음 날 오늘 화면의 카드와 같은 일인지 맞춰 보기 어려웠다. 모르는 꼴이면 null(화면은 제목을 쓴다).
 */
export function nameFor(it, lesson = {}) {
 const c = sceneFor(it, lesson);
 if (!c) return null;
 const base = { place: c.scene.place || '', who: c.scene.who || '' };
 if (it.kind !== 'again') return { ...base, action: c.action };
 const id = it.why?.evidence?.lineId || it.open?.lineId;
 const tail = lineTail((lesson.scene || []).find((x) => x.id === id)?.text, id);
 return { ...base, action: tail ? `「${tail}」 다시 하기` : '1화 그 대사 다시 하기' };
}
