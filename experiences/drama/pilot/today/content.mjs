// 「오늘」 한 장(11-14, 깃발 ?today=1 뒤 — 공개 빌드는 이 폴더를 싣지 않는다)이 여는 1화 처음 보는 대사.
// 줄 · 능력 · 녹음 상한은 원고(experiences/drama/s1/ep01.mjs 처음보는대사)와 talk 대사 은행(tools/build-world-speaking-talk.mjs dramaLines)의
// 값을 옮겼다 — tests/drama-today.test.mjs가 원고와 맞는지 본다. 제목 · 상황 글 · 영어 설명은 이 판의 화면 글이라 **검수 전 초안**이다.
// 새 상황 규칙(pilot.mjs 머리): 첫 제출 전 화면에 한국어 답 · 첫 글자가 없다 — 제목 · 한국어 상황 글에는 그 줄의 핵심 말 · 대체 말(명세 keys)을
// 쓰지 않는다(시험이 본다). B(t9)처럼 한국어 글은 누구에게 · 어디서만 말하고, 무엇을 말할지는 영어 설명(prompt)이 맡는다.
// t9(B) · t6(C)는 WORLD 강의(world-lesson.json)의 것을 그대로 쓴다. t5는 검수 전(draft)이라 싣지 않는다.

export const EPISODE = 's1e01';

// 「다시 만날 말」: 장면 줄에서 노트를 받은 점을 처음 보는 상황에서 — 같은 능력이 있으면 그 줄, 없으면 꼴(끝맺음 '-어요')이 같은 줄.
// B · C는 짝으로 쓰지 않는다(B는 장면 바로 뒤 새 상황, C는 7~10일 뒤 한 번뿐인 확인).
export const AGAIN_PAIR = Object.freeze({ 's1e01-6': 's1e01-t3', 's1e01-7': 's1e01-t4', 's1e01-8': 's1e01-t7' });

// 「새로 할 것」: B를 안 했으면 B, 했으면 아래 차례로 아직 안 본 줄. 한국어 상황 글만으로 무엇을 말할지 서는 줄(t7 · t3)이 앞이다 —
// 「무엇을 말할지는 위 설명을 보세요」가 붙은 줄(t8 · t2 · t1 · t4)은 영어 설명을 읽어야 한다(설계 세션 11-14).
export const NEW_ORDER = Object.freeze(['s1e01-t7', 's1e01-t3', 's1e01-t8', 's1e01-t2', 's1e01-t1', 's1e01-t4']);

// 끝맺음 노트를 「'요'」로 불러도 되는 장면 줄 — 해요체 대사라 끝에 '요'를 붙이면 허용 꼴이 되는 줄(설계 세션 11-14 판정기 대조: 높임 대사의
// 끝맺음 노트는 반말로 확신될 때만 남는다). 반말 대사 · 합쇼체만 받는 줄이 오면 여기에 넣지 않고 일반 문장으로 내려간다.
export const YO_LINES = Object.freeze(['s1e01-6', 's1e01-7', 's1e01-8']);

// 태오가 그 장면 줄을 되부르는 말(그 줄을 말한 기록이 있을 때만 쓴다) — 사람이 나를 기억하고 말 거는 맛(설계 세션 11-14, 문장은 초안).
// 문장은 그 줄이 여는 짝 상황(AGAIN_PAIR)에 맞춰 썼다 — pair가 AGAIN_PAIR와 다르면 시험이 걸린다(짝을 바꾸면 문장도 같이 고친다).
// 6번의 짝 t3는 같은 얘기가 아니라 요즘 지내는 얘기라 「그 얘기 한 번 더」로 쓰지 않는다(설계 세션 11-14). 짝 상황의 답 낱말(8번이면 「덕분에」)은 넣지 않는다.
export const TAEO_CALL = Object.freeze({
 's1e01-6': { pair: 's1e01-t3', text: '길 잃어서 헤맸다고 했죠? 오늘은 요즘 지내는 얘기를 해 봐요.' },
 's1e01-7': { pair: 's1e01-t4', text: '도서관은 잘 찾았어요? 오늘은 다른 곳을 물어봐요.' },
 's1e01-8': { pair: 's1e01-t7', text: '고맙다고 했죠? 오늘은 다른 분께 고마움을 전해 봐요.' },
});

// 태오 한 줄의 목소리 · 입 맞는 영상을 끼울 자리 — 틀 code(plan.mjs TAEO_LINES) → { video, audio }(drama/pilot 기준 경로).
// 비어 있으면 듣는 고리 영상 + 화면 글로 간다. 굽는 일은 크레딧 숫자로 유호님께 여쭙고 답을 받은 뒤(설계 세션 11-14).
export const TAEO_MEDIA = Object.freeze({});

const SEE_ABOVE = '(무엇을 말할지는 위 설명을 보세요.)';
// 처음 보는 대사. title: 줄 위 짧은 제목. situation: 녹음 카드의 한국어 상황 글. prompt: 영어 설명. like: 1화의 어느 줄과 같은 말하기인지(까닭 글).
export const POOL = Object.freeze([
 { id: 's1e01-t1', skill: 'ko.speaking.purpose', to: 'staff', answerSec: 13, text: '수강 신청에 대해 여쭤볼 게 있어서 왔어요.', meaning: 'I came to ask about course registration.',
  title: '학과 사무실, 조교 선생님께', situation: `학과 사무실에 왔어요. 조교 선생님께 왜 왔는지 공손하게 말해 보세요. ${SEE_ABOVE}`,
  prompt: 'You walk into the department office. Politely tell the assistant that you came because you have a question about signing up for classes.', like: null },
 { id: 's1e01-t2', skill: 'ko.speaking.ask', to: 'staff', answerSec: 13, text: '이 책 반납 기한이 언제까지인지 궁금해서요.', meaning: 'I was wondering when this book is due.',
  title: '도서관 안내 데스크에서', situation: `도서관 안내 데스크 직원이 「무엇을 도와드릴까요?」라고 물어요. 들고 있는 책 일로 공손하게 물어보세요. ${SEE_ABOVE}`,
  prompt: 'At the library help desk, the librarian asks how they can help. Politely ask by when you have to bring back the book you are holding.', like: 's1e01-7' },
 { id: 's1e01-t3', skill: 'ko.speaking.status', to: 'staff', answerSec: 14, text: '처음엔 힘들었지만 조금씩 익숙해지고 있어요.', meaning: 'It was hard at first, but I\'m getting used to it little by little.',
  title: '기숙사 사감 선생님께, 요즘 얘기', situation: '기숙사 사감 선생님이 지낼 만하냐고 물으세요. 처음 며칠은 어땠는지, 요즘은 어떤지 한 번에 말해 보세요.',
  prompt: 'The dorm supervisor asks how you are settling in. Say that it was hard at first, but you are slowly getting used to it.', like: 's1e01-6' },
 { id: 's1e01-t4', skill: 'ko.speaking.ask', to: 'staff', answerSec: 13, text: '선생님, 혹시 복사실이 어디에 있는지 아세요?', meaning: 'Excuse me, do you happen to know where the copy room is?',
  title: '처음 본 교직원께 길 묻기', situation: `찾는 곳이 있는데 못 찾았어요. 처음 본 교직원께 그곳을 공손하게 여쭤보세요. ${SEE_ABOVE}`,
  prompt: 'You need to make copies but cannot find the copy room. Politely ask a staff member you have never met whether they know where it is.', like: 's1e01-7' },
 { id: 's1e01-t7', skill: 'ko.speaking.thank', to: 'staff', answerSec: 13, text: '선생님 덕분에 살았어요. 정말 감사합니다.', meaning: 'You\'re a lifesaver. Thank you so much.',
  title: '서류 일을 풀어 준 조교 선생님께', situation: '서류 일로 곤란했는데 조교 선생님이 해결해 주셨어요. 그 마음을 공손하게 전해 보세요.',
  prompt: 'The department assistant just sorted out your paperwork problem. Tell them they saved you, and thank them warmly and politely.', like: 's1e01-8' },
 { id: 's1e01-t8', skill: 'ko.speaking.ask', to: 'professor', answerSec: 15, text: '교수님, 과제를 어디에 내야 하는지 여쭤봐도 될까요?', meaning: 'Professor, may I ask where I should hand in the assignment?',
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
