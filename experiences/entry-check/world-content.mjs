// 입장 검사 — WORLD 안 캠퍼스 판(2026-11-04)의 원고 겉. 봄 축제 주간, 학생 스태프가 날마다 다른 캠퍼스 입구의 부스를 맡는다.
// LAB 화면은 content.mjs · narration.mjs 그대로다 — 이 모듈은 WORLD 안에서만 불러와 같은 객체의 화면 글만 바꾼다(applyWorld).
// 바꾸는 것: 손님 이름 · 나라 · 나이 일부 · 사진, 근무지 이름 · 안내문 제목 · 서류 제목 · 근무 전 안내, 날짜(8월 → 5월 축제 주간, 요일 그대로),
// 해설 · 「그 뒤에 생긴 일」 속 이름과 동물 말. 바꾸지 않는 것: 규칙 문장의 뜻 · 정답 · 근거 규칙 · 짐 · 시각 · 학습 항목,
// 그리고 목소리로 구운 손님 대사(line · reply — 바꾸면 소리와 글이 갈린다). 손님 열둘의 성별은 원고의 손님과 같아 목소리를 그대로 쓴다.
// 나이는 규칙에 묶이지 않은 어른 셋만 옮겼다(AGE — 2판, 11-04 유호님 「20대 학생만 하지 말고 어린이 · 할머니 · 할아버지 · 30대 · 40대 다양하게」).
// 실제 아이돌 · 공인의 이름 · 얼굴은 쓰지 않는다(손님은 지어낸 인물, 공개 전 실존 인물 대조).

/** 원고 손님 키(content.mjs CAST) → 캠퍼스 손님. call은 해설에서 부르는 말, role은 그림 대체 글. */
export const WORLD_CAST = Object.freeze({
  bear: { name: '바트에르데네', call: '바트', role: '몽골 유학생', from: '몽골' },
  raccoon: { name: '나경수', call: '경수', role: '학교 앞 치킨집 사장님', from: '한국' },
  rabbit: { name: '박말순', call: '말순', role: '학교 앞에 사는 할머니', from: '한국' },
  fox: { name: '루카스 마르탱', call: '루카스', role: '프랑스 대학원생', from: '프랑스' },
  squirrel: { name: '도다미', call: '다미', role: '유치원생', from: '한국' },
  hedgehog: { name: '고은호', call: '은호', role: '초등학생', from: '한국' },
  penguin: { name: '응우옌 티 린', call: '린', role: '베트남에서 온 회사원', from: '베트남' },
  ducks: { name: '마리아 산토스', call: '마리아', role: '아이와 온 필리핀 엄마', from: '필리핀' },
  otter: { name: '서달수', call: '달수', role: '퇴직한 할아버지', from: '한국' },
  deer: { name: '노미경', call: '미경', role: '동네 피아노 선생님', from: '한국' },
  panda: { name: '이단비', call: '단비', role: '중학생', from: '한국' },
  sheep: { name: '마디나 카리모바', call: '마디나', role: '우즈베키스탄 유학생', from: '우즈베키스탄' },
});
// 표정 일곱(2판): 말함 → 기다림(말이 끝나면) / 긴장(표 · 짐을 살피거나 거절 도장을 들 때 — 답과 상관없이 같다) / 찍은 뒤 통과 · 머쓱 · 몰래(놓친 손님) · 갸웃
export const MOODS = Object.freeze(['talk', 'idle', 'nervous', 'pass', 'sly', 'sorry', 'puzzled']);
// 규칙에 묶이지 않은 어른의 나이(원고 → 캠퍼스 판). 판정 규칙의 나이 경계(7 · 13 · 65살)를 넘지 않는다 — 시험이 본다.
export const AGE = Object.freeze({ penguin: [24, 33], deer: [26, 36], raccoon: [45, 47] });
// 나이를 옮긴 손님의 카드 번호 앞자리는 태어난 해처럼 읽힌다 — 나이에 맞춘다(판정과 상관없는 표시).
export const BORN = Object.freeze({ penguin: ['2002-', '1993-'] });
// 놓치면 씩 웃는 손님: 대사가 규칙을 비껴가려는 문항만(그냥 물어본 아이 · 어르신의 틀린 통과는 「고마워요」 웃음이다).
export const SNEAKY = Object.freeze(new Set(['pool-02', 'pool-04', 'pool-07', 'library-02', 'library-07', 'library-09', 'museum-03', 'museum-07', 'concert-09']));
export const worldGuestImage = (who, mood = 'talk') => `assets/world/guests/${who}-${MOODS.includes(mood) ? mood : 'talk'}.webp`;
export const worldGuestFace = (who) => `assets/world/guests/face/${who}.webp`;

// 원고 속 이름(전체 · 부르는 말). 받침이 같은 이름끼리 바꿔 조사가 맞는다(도치 → 은호). 「단비 · 단아 · 다미 · 달수」는 그대로다.
const FULL = [['노나래', '노미경'], ['김보리', '바트에르데네'], ['나구리', '나경수'], ['박토순', '박말순'], ['여우진', '루카스 마르탱'], ['고도치', '고은호'],
  ['남콩이', '응우옌 티 린'], ['오순 외 1명', '마리아 산토스 (2명)'], ['수달수', '서달수'], ['양솜이', '마디나 카리모바']];
const CALL = [['보리 씨', '바트 씨'], ['구리 씨', '경수 씨'], ['토순 할머니', '말순 할머니'], ['토순 씨', '말순 씨'], ['우진 씨', '루카스 씨'],
  ['도치', '은호'], ['콩이 씨', '린 씨'], ['오순 씨', '마리아 씨'], ['솜이 씨', '마디나 씨'], ['나래 씨', '미경 씨']];
// 동물 말이 든 해설 · 「그 뒤에 생긴 일」(목소리 없이 글로만 나온다)
const ANIMAL = [['아기 오리가 울먹였어요.', '아이가 울먹였어요.'], ['아기 오리가 엄마 날개를 꼭 잡았어요.', '아이가 엄마 손을 꼭 잡았어요.']];

// 해설 고침(2026-11-04 문항 2중 검수 1차 Opus): 근거를 빠뜨렸거나 글에 없는 말을 쓴 아홉 곳. 정답 · 대사는 그대로이고 LAB 원고는 건드리지 않는다.
export const WORLD_WHY = Object.freeze({
  'pool-01': '짐에 「수영 모자」가 있고 음식은 없어요. 입장권에 「어른 · 21살」이라고 되어 있어서 어린이 규칙과도 상관없어요. 그래서 들여보내면 돼요.',
  'pool-08': '5살 아이가 어른과 함께 왔어요. 수영 모자도 두 개 있고, 짐에 음식이 없어요. 그래서 들여보내요.',
  'library-02': '도서관 카드가 있어야 들어갈 수 있어요. 경수 씨는 「카드는 집에 있어요」라고 했으니까 카드가 없어요. 지금은 오후 4시 57분이라서 시간은 괜찮아요.',
  'library-11': '린 씨 이름이 적힌 본인 도서관 카드가 있고, 지금은 「오후 5시 8분」이라서 5시 30분 전이에요. 「음료는 뚜껑이 있으면 괜찮습니다」라고 했는데 린 씨 커피에는 뚜껑이 있고 음식도 없어요. 그래서 들여보내요.',
  'museum-04': '「입장은 오후 5시까지만 할 수 있습니다」라고 했는데 지금은 오후 4시 37분이라 5시 전이에요. 짐이 없어서 카메라 문제도 없고, 박말순 씨는 72살이라 「65살 이상은 무료입니다」에도 맞아요. 그래서 들여보내요.',
  'pool-05': '다미는 6살이고 “아빠는 주차장에 있어요”라고 했으니 어른 없이 들어가려고 해요. 7살 이하 어린이는 어른과 함께 들어와야 해요. 수영 모자는 있고 튜브는 음식이 아니라서 다른 규칙은 괜찮아요.',
  'library-01': '바트에르데네 씨 이름이 적힌 도서관 카드가 있어요. 짐은 책뿐이라 음식도 없어요. 지금은 오후 4시 52분이라 5시 30분 전이에요. 그래서 들여보내요.',
  'library-03': '카드 이름이 박말순이라 손님 본인 카드예요. 지금은 오후 5시 1분이라 5시 30분 전이고, 음료는 뚜껑이 있으면 괜찮은데 커피에 뚜껑이 있어요. 그래서 들여보내요.',
  'museum-01': '지금은 오후 4시 22분이라 입장 시간에 맞아요. 짐은 휴대폰과 작은 가방인데 “휴대폰은 괜찮습니다”라고 했어요. 표는 어른, 나이는 36살이라 표도 맞아요. 그래서 들여보내요.',
  'museum-06': '지금은 오후 4시 48분이라 5시 전이에요. 보여 준 짐이 없으니 카메라도 없어요. 은호는 9살이라 13살 이하만 쓰는 어린이 표를 쓸 수 있어요. 그래서 들여보내요.',
  'concert-04': '비 때문에 음악회가 5월 17일로 바뀌었지만, 안내문에 “5월 16일 표로 들어올 수 있습니다”라고 했으니 16일 표도 괜찮아요. 돗자리는 “가지고 와도 됩니다”이고, 안내문에는 과자를 막는 말이 없어요. 그래서 들여보내요.',
  'concert-05': '6시 25분 알림에 “지금부터 음식은 가지고 들어갈 수 없습니다”라고 했어요. 경수 씨는 김밥을 가지고 왔어요. 날짜는 17일로 바뀌었지만 16일 표로 들어올 수 있으니 표는 괜찮아요.',
  'concert-06': '음악회는 17일로 바뀌었지만 16일 표로 들어올 수 있어요. 돗자리는 “가지고 와도 됩니다”이고, 음식은 안 되지만 “물은 괜찮습니다”라고 했어요. 그래서 들여보내요.',
  'concert-08': '음악회는 17일로 바뀌었지만 16일 표로 들어올 수 있어요. 5살 아이는 보호자인 마리아 씨와 함께 왔고, 짐은 돗자리뿐이라 의자 · 음식 문제도 없어요. 그래서 들여보내요.',
});

// 글로만 나오는 손님의 말을 다듬은 곳(11-04 문항 재검수 — 조사 호응). 목소리로 구운 말은 여기에 넣지 않는다.
export const WORLD_LINE = Object.freeze({ 'library-11': '커피 뚜껑을 닫았어요. 이대로 가지고 들어가도 되지요?' });

// 2판 공부 장치: 판정 뒤 근거 규칙에서 형광펜이 지나갈 낱말(규칙 문장의 글자 그대로 — 시험이 본다).
export const RULE_KEYS = Object.freeze({
  'pool.cap': ['꼭 써야 합니다'], 'pool.food': ['가지고 들어갈 수 없습니다', '물은 괜찮습니다'], 'pool.kid': ['7살 이하', '어른과 함께'],
  'library.card': ['카드가 있어야', '쓸 수 없습니다'], 'library.food': ['가지고 들어갈 수 없습니다', '뚜껑이 있으면 괜찮습니다'], 'library.time': ['오후 5시 30분부터는', '들어올 수 없습니다'],
  'museum.time': ['오후 5시까지만'], 'museum.camera': ['가지고 들어갈 수 없습니다', '휴대폰은 괜찮습니다'], 'museum.fee': ['13살 이하만', '65살 이상은 무료'],
  'concert.date': ['5월 17일(일)로 바뀌었습니다', '5월 16일 표로 들어올 수 있습니다'], 'concert.chair': ['가지고 와도 됩니다', '가지고 올 수 없습니다'], 'concert.kid': ['7살 이하', '보호자와 함께'],
  'concert.food': ['지금부터', '가지고 들어갈 수 없습니다', '물은 괜찮습니다'],
});
// 근무 끝 「오늘 읽은 표현」: 규칙 하나 = 표현 하나. 틀린 손님의 근거 규칙이면 앞에 놓는다. 풀이는 초급이 읽을 쉬운 말(문항 검수를 함께 탄다).
export const EXPRESSIONS = Object.freeze({
  'pool.cap': { form: '-아/어야 하다', quote: '수영 모자를 꼭 써야 합니다', plain: '안 하면 안 돼요. 꼭 해요.' },
  'pool.food': { form: '-(으)ㄹ 수 없다', quote: '음식은 가지고 들어갈 수 없습니다', plain: '하면 안 돼요.' },
  'pool.kid': { form: '숫자 + 이하', quote: '7살 이하 어린이', plain: '7살까지를 말해요. 7살, 6살, 5살은 맞아요. 8살은 아니에요.' },
  'library.card': { form: '-아/어야', quote: '도서관 카드가 있어야 들어갈 수 있습니다', plain: '카드가 없으면 못 들어가요.' },
  'library.food': { form: '-(으)면', quote: '음료는 뚜껑이 있으면 괜찮습니다', plain: '뚜껑이 없으면 안 돼요.' },
  'library.time': { form: '시간 + 부터', quote: '오후 5시 30분부터는 들어올 수 없습니다', plain: '5시 30분에도 못 들어와요. 5시 29분까지 돼요.' },
  'museum.time': { form: '시간 + 까지만', quote: '입장은 오후 5시까지만 할 수 있습니다', plain: '5시가 지나면 못 들어가요.' },
  'museum.camera': { form: '-(으)ㄹ 수 없다', quote: '카메라는 가지고 들어갈 수 없습니다', plain: '안 찍어도 가지고 들어가면 안 돼요.' },
  'museum.fee': { form: '이하 · 이상', quote: '13살 이하만 · 65살 이상은 무료', plain: '13살까지 어린이 표를 써요. 65살부터 무료예요.' },
  'concert.date': { form: '날짜가 바뀌다', quote: '5월 17일(일)로 바뀌었습니다', plain: '음악회 날이 달라졌어요. 표는 16일 표 그대로예요.' },
  'concert.chair': { form: '-아/어도 되다', quote: '돗자리는 가지고 와도 됩니다', plain: '가지고 와도 괜찮아요.' },
  'concert.kid': { form: '숫자 + 이하', quote: '7살 이하 어린이', plain: '7살까지는 보호자와 같이 와요.' },
  'concert.food': { form: '지금부터', quote: '지금부터 음식은 가지고 들어갈 수 없습니다', plain: '알림 전에는 괜찮았어요. 지금부터 안 돼요.' },
});

export const WORLD_VENUES = Object.freeze({
  pool: { name: '캠퍼스 수영장', from: '하늘 수영장', date: '5월 13일 수요일',
    briefing: '축제 주간이라 학교 수영장을 동네 사람들에게도 열었어요. 오늘이 첫 근무예요. 안내문은 세 줄뿐이니까 걱정하지 말고, 손님의 표와 짐을 안내문과 하나씩 맞춰 봐요.' },
  library: { name: '중앙도서관', from: '별빛 도서관', date: '5월 14일 목요일',
    briefing: '오늘은 축제 날이라 도서관이 일찍 문을 닫아요. 시계를 자주 보고, 카드에 적힌 이름도 꼭 확인해요.' },
  museum: { name: '대학 미술관', from: '바람 미술관', date: '5월 15일 금요일',
    briefing: '축제 주간 특별 전시가 열려서 손님이 많아요. 표의 종류와 나이, 그리고 입장 시간을 잘 봐요.' },
  concert: { name: '봄 축제 음악회', from: '노을 공원 음악회', date: '5월 17일 일요일', notice: '봄 축제 K팝 음악회', ticket: ['여름 음악회 입장권', '봄 축제 음악회 입장권'],
    memoFrom: '축제 운영 본부',
    briefing: '어제 비가 와서 축제 음악회가 하루 미뤄졌어요. 오늘 무대에는 K팝 공연도 있어서 손님이 아주 많아요. 근무 중에 새 알림이 올 수도 있으니 꼭 읽어요.' },
});
// 날짜: 8월 → 5월 축제 주간. 요일이 같은 날로 옮긴다(2026년 5월 13일이 수요일). 음악회의 「하루 미뤄짐」 · 「다른 날 표」 간격도 그대로다.
const DAY = { 2: 9, 6: 13, 7: 14, 8: 15, 9: 16, 10: 17, 16: 23 };
export function worldDate(text) {
  return text.replace(/(8월 )?(\d{1,2})일(?!차)/g, (all, month, d) => {
    if (!(d in DAY)) throw new Error(`캠퍼스 판 날짜 표에 없는 날: ${all}`);
    return `${month ? '5월 ' : ''}${DAY[d]}일`;
  });
}
const swap = (text, pairs) => pairs.reduce((t, [a, b]) => t.split(a).join(b), text);
/** 화면 글 하나를 캠퍼스 판으로: 근무지 이름 → 사람 이름 → 동물 말 → 날짜. */
export function worldText(text, venueId) {
  if (typeof text !== 'string') return text;
  const v = WORLD_VENUES[venueId];
  let t = swap(text, [...(v?.ticket ? [v.ticket] : []), ...Object.values(WORLD_VENUES).map((x) => [x.from, x.name]), ['하늘 수영장', WORLD_VENUES.pool.name]]);
  t = swap(swap(swap(t, FULL), CALL), ANIMAL);
  return worldDate(t);
}

let applied = false;
/**
 * WORLD 안에서 한 번: content.mjs · narration.mjs의 객체를 그 자리에서 캠퍼스 판 글로 바꾼다.
 * core.mjs · learning.mjs · correction.mjs는 같은 객체를 id로 쓰므로 판정 · 학습 기록 · 다시 확인은 그대로다.
 * 목소리로 구운 손님 대사(line · reply)는 바꾸지 않는다 — 시험(world-content.test.mjs)이 막는다.
 */
export function applyWorld({ VENUES, CAST, TUTORIAL }) {
  if (applied) return;
  applied = true;
  for (const [key, w] of Object.entries(WORLD_CAST)) {
    const c = CAST[key];
    if (!c) continue;
    Object.assign(c, { name: w.name, label: w.role, img: worldGuestImage(key), call: w.call, scale: 1, wide: key === 'ducks', age: AGE[key]?.[1] ?? c.age });
  }
  for (const v of VENUES) {
    const w = WORLD_VENUES[v.id];
    if (!w) continue;
    v.name = w.name; v.date = w.date; v.briefing = w.briefing;
    v.notice.title = w.notice || worldText(v.notice.title, v.id);
    for (const r of v.notice.rules) r.text = worldText(r.text, v.id);
    if (v.memo) { v.memo.from = w.memoFrom || v.memo.from; v.memo.rule.text = worldText(v.memo.rule.text, v.id); }
    for (const c of v.cases) {
      const age = AGE[c.who], born = BORN[c.who], aged = (t) => (age && typeof t === 'string' ? t.split(`${age[0]}살`).join(`${age[1]}살`).split(born?.[0] ?? '\0').join(born?.[1] ?? '\0') : t);
      if (c.doc) { c.doc.title = worldText(c.doc.title, v.id); c.doc.rows = c.doc.rows.map(([k, val]) => [k, aged(worldText(val, v.id))]); }
      for (const f of ['why', 'oops']) c[f] = aged(worldText(c[f], v.id));
      if (WORLD_WHY[c.id]) c.why = WORLD_WHY[c.id];
      // 글로만 나오는 확인용 손님(textOnly)은 목소리가 없어 대사도 바꿀 수 있다
      if (c.textOnly) for (const f of ['line', 'reply']) c[f] = worldText(c[f], v.id);
      if (c.textOnly && WORLD_LINE[c.id]) c.line = WORLD_LINE[c.id];
    }
  }
  for (const s of TUTORIAL || []) s.text = worldText(s.text, 'pool');
}
