export const SCHEMA = 1;
export const MAX_SESSIONS = 10;
export const MAX_IMPORT_BYTES = 500000;
export const REVIEWS = Object.freeze({ easy: '말할 수 있었어요', unsure: '조금 망설였어요', stuck: '말이 막혔어요' });
export const SCENARIOS = Object.freeze({
  interview: { name: '면접에서 나를 소개할 때', short: '면접', note: '내 경험을 근거로, 짧고 분명하게.', counterpart: '면접관', goal: '내 경험이 이 역할에 어떻게 도움이 되는지 전하기', opening: '이 역할에 지원한 이유를 들려주시겠어요?',
    turns: {
      opening: { title: '첫 인상보다, 첫 문장', prompt: '이 역할에 지원한 이유를 들려주시겠어요?', hint: '관심 있는 일 한 가지와 연결되는 내 경험 한 가지를 적어 보세요.' },
      specific: { title: '경험을 하나만 꺼내기', prompt: '그 경험에서 본인이 직접 한 일은 무엇이었나요?', hint: '상황 → 내가 한 행동 → 실제로 일어난 결과. 없는 성과를 만들 필요는 없어요.' },
      concise: { title: '핵심부터 말하기', prompt: '시간이 많지 않아서요. 가장 전하고 싶은 내용을 두 문장으로 정리해 주시겠어요?', hint: '먼저 결론 한 문장. 그다음 그 결론을 뒷받침하는 실제 경험 한 문장.' },
      pressure: { title: '예상 밖의 질문', prompt: '그 경험이 우리 팀의 일에도 도움이 된다고 생각하는 이유는 무엇인가요?', hint: '상대의 상황을 모르면, 먼저 확인하고 싶은 점을 질문해도 좋아요.' },
      close: { title: '대화를 이어 갈 한마디', prompt: '마지막으로 저희에게 물어보고 싶은 것이 있나요?', hint: '역할에 관해 정말 알고 싶은 점 한 가지로 마무리해 보세요.' },
    }, starter: '제가 이 역할에 관심을 가진 이유는…', check: '실제로 내가 한 행동을 한 가지 말했나요?' },
  request: { name: '부탁을 꺼내야 할 때', short: '부탁', note: '필요한 도움과 가능한 범위를 함께.', counterpart: '함께 일하는 동료', goal: '상대의 상황을 확인하며 필요한 도움을 구하기',
    turns: {
      opening: { title: '조심스럽게 시작하기', prompt: '무슨 일이에요? 지금 잠깐 이야기할 수 있어요.', hint: '대화를 나눌 수 있는지 확인하고, 부탁하고 싶은 일을 한 가지로 말해 보세요.' },
      specific: { title: '부탁의 크기를 분명하게', prompt: '제가 정확히 무엇을, 언제까지 도와드리면 될까요?', hint: '필요한 작업과 기한을 나누어 적고, 조정 가능한 부분도 말해 보세요.' },
      concise: { title: '짧게 핵심 전하기', prompt: '지금은 시간이 별로 없어요. 필요한 것부터 짧게 말해 줄래요?', hint: '“○○를 부탁드리고 싶어요. ○○까지 가능하실까요?”처럼 시작할 수 있어요.' },
      pressure: { title: '부담스럽다는 말에 답하기', prompt: '저도 일정이 꽉 차 있어서 전부 도와드리기는 어려울 것 같아요.', hint: '상대의 상황을 인정하고, 부탁을 줄이거나 다른 시점을 제안해 보세요.' },
      close: { title: '서로 같은 뜻인지 확인하기', prompt: '그럼 제가 가능한 범위에서 해 볼게요. 어떻게 진행하면 좋을까요?', hint: '합의한 범위와 다음 확인 시점을 정리해 보세요. 아직 합의되지 않은 일은 묻는 표현으로요.' },
    }, starter: '잠깐 이야기 나눌 수 있을까요? 부탁드리고 싶은 일이 있어요.', check: '무엇을 언제까지 부탁하는지, 조정 가능한 범위를 말했나요?' },
  refusal: { name: '관계를 지키며 거절할 때', short: '거절', note: '미안함에 묻히지 않게, 내 범위까지.', counterpart: '가까운 지인', goal: '할 수 없는 범위를 분명히 전하면서 관계를 존중하기',
    turns: {
      opening: { title: '내 범위를 말하는 시작', prompt: '이번에도 부탁 좀 해도 될까요? 꼭 해 줬으면 좋겠어요.', hint: '상대의 마음을 짧게 받아 준 뒤, 내가 할 수 없는 부분을 분명하게 말해 보세요.' },
      specific: { title: '이유와 범위를 나누기', prompt: '어떤 부분이 어려운 건지 알려 줄 수 있어요?', hint: '공유하고 싶은 만큼만 이유를 말해도 괜찮아요. 할 수 있는 범위가 있다면 따로 말해 보세요.' },
      concise: { title: '짧고 분명한 거절', prompt: '그래서, 이번에는 가능하다는 건가요? 어렵다는 건가요?', hint: '결정을 한 문장으로 먼저 말하고, 필요하면 설명을 덧붙이세요.' },
      pressure: { title: '한 번 더 부탁할 때', prompt: '딱 이번 한 번만 안 될까요? 다른 부탁은 안 할게요.', hint: '새로운 이유를 계속 만들기보다, 결정한 범위를 차분하게 반복해 보세요.' },
      close: { title: '관계를 남기는 마무리', prompt: '알겠어요. 조금 아쉽기는 하네요.', hint: '아쉬움을 인정하면서 마무리해 보세요. 할 수 없는 대안을 약속하지 않아도 괜찮아요.' },
    }, starter: '부탁한 마음은 이해해요. 다만 이번에는 제가…', check: '내가 할 수 없는 범위를 모호하지 않게 말했나요?' },
});

export const DIRECTIONS = Object.freeze({ specific: '내용을 구체적으로', concise: '짧고 분명하게', pressure: '부담스러운 반응에 답하기' });

export function followupQuestion(Ask, session, review) {
  if (!Object.hasOwn(REVIEWS, review)) throw new TypeError('내 느낌을 골라 주세요.');
  const questions = [
    { id: 'focus', about: 'focus', kind: 'follow_up', label: review === 'easy' ? '다음에는 어떤 상황까지 연습할까요?' : '다음에 어떤 부분을 도와주면 좋을까요?', options: Object.entries(DIRECTIONS).map(([id, label]) => ({ id, label })) },
    { id: 'pace', about: 'pace', kind: 'setting', options: [{ id: 'slow' }, { id: 'fast' }] },
  ];
  const decision = answers => ({ content: answers.focus || (review === 'easy' ? 'pressure' : 'specific'), shape: 'text' });
  // The product's authored branches are evaluated by canonical Core Ask. Pacing does
  // not change this text exercise, so that question is not put in front of the user.
  return Ask.choose({ questions, decide: decision, budget: 1, usedToday: 0 });
}

export function createSession({ scenario, counterpart, goal, at = new Date().toISOString(), id = crypto.randomUUID() }) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new TypeError('연습할 상황을 골라 주세요.');
  const entry = { id, at, scenario, counterpart: cleanText(counterpart, 80), goal: cleanText(goal, 240), focus: null, turns: [], firstSentence: '', takeaway: '' };
  if (!entry.counterpart || !entry.goal) throw new TypeError('상대와 오늘의 목표를 적어 주세요.');
  return entry;
}

export function getTurn(session, index = session.turns.length) {
  const key = index === 0 ? 'opening' : index === 1 ? session.focus || 'specific' : 'close';
  return { id: key, ...SCENARIOS[session.scenario].turns[key] };
}

export function cleanText(value, limit) {
  if (typeof value !== 'string' || value.length > limit || !safeCharacters(value)) throw new TypeError(`글은 ${limit}자 이내의 일반 문자로 적어 주세요.`);
  return value.trim();
}

export function firstSentenceFrom(answer) {
  return answer.slice(0, 600).replace(/[\ud800-\udbff]$/u, '');
}

export function appendTurn(session, { answer, review, focus = session.focus }) {
  if (session.turns.length >= 3) throw new TypeError('세 번의 연습이 끝났어요.');
  if (!Object.hasOwn(REVIEWS, review)) throw new TypeError('내 느낌을 골라 주세요.');
  if (!Object.hasOwn(DIRECTIONS, focus)) throw new TypeError('다음 연습 방향을 골라 주세요.');
  if (session.turns.length > 0 && focus !== session.focus) throw new TypeError('시작한 연습의 방향은 중간에 바꿀 수 없어요. 새 연습에서 골라 주세요.');
  const text = cleanText(answer, 2000);
  if (!text) throw new TypeError('상대에게 하고 싶은 말을 적어 주세요.');
  const turn = getTurn(session);
  return { ...session, focus, turns: [...session.turns, { id: turn.id, answer: text, review, retry: '', retryReview: null }] };
}

export function retryTurn(session, index, answer, review) {
  if (!Number.isInteger(index) || !session.turns[index]) throw new TypeError('다시 연습할 대화를 찾지 못했어요.');
  if (!Object.hasOwn(REVIEWS, review)) throw new TypeError('다시 말한 뒤의 느낌을 골라 주세요.');
  const retry = cleanText(answer, 2000);
  if (!retry) throw new TypeError('다시 해 볼 말을 적어 주세요.');
  return { ...session, turns: session.turns.map((turn, i) => i === index ? { ...turn, retry, retryReview: review } : turn) };
}

export function stuckTurn(session) {
  const stuck = session.turns.findIndex(turn => (turn.retryReview || turn.review) === 'stuck');
  return stuck >= 0 ? stuck : session.turns.findIndex(turn => (turn.retryReview || turn.review) === 'unsure');
}

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const safeCharacters = value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value);
const bounded = (value, max, allowEmpty = true) => typeof value === 'string' && value.length <= max && safeCharacters(value) && (allowEmpty || value.trim().length > 0);

export function validateArchive(value) {
  const invalid = () => { throw new TypeError('리허설 기록 형식이 올바르지 않아요. 이 앱에서 내보낸 JSON 파일을 선택해 주세요.'); };
  if (!keys(value, ['schema', 'savedAt', 'sessions']) || value.schema !== SCHEMA || !bounded(value.savedAt, 40, false) || !Number.isFinite(Date.parse(value.savedAt)) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS) invalid();
  const ids = new Set();
  for (const s of value.sessions) {
    if (!keys(s, ['id', 'at', 'scenario', 'counterpart', 'goal', 'focus', 'turns', 'firstSentence', 'takeaway']) || !bounded(s.id, 80, false) || ids.has(s.id) || !bounded(s.at, 40, false) || !Number.isFinite(Date.parse(s.at)) || !Object.hasOwn(SCENARIOS, s.scenario) || !Object.hasOwn(DIRECTIONS, s.focus) || !bounded(s.counterpart, 80, false) || !bounded(s.goal, 240, false) || !bounded(s.firstSentence, 600) || !bounded(s.takeaway, 600) || !Array.isArray(s.turns) || s.turns.length !== 3) invalid();
    ids.add(s.id);
    for (const [index, turn] of s.turns.entries()) {
      const expected = index === 0 ? 'opening' : index === 1 ? s.focus : 'close';
      if (!keys(turn, ['id', 'answer', 'review', 'retry', 'retryReview']) || turn.id !== expected || !bounded(turn.answer, 2000, false) || !Object.hasOwn(REVIEWS, turn.review) || !bounded(turn.retry, 2000) || (turn.retry ? !Object.hasOwn(REVIEWS, turn.retryReview) : turn.retryReview !== null)) invalid();
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function archive(sessions, at = new Date().toISOString()) {
  return validateArchive({ schema: SCHEMA, savedAt: at, sessions: sessions.slice(0, MAX_SESSIONS) });
}

export function parseArchive(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new TypeError('파일은 500KB 이하로 선택해 주세요.');
  try { return validateArchive(JSON.parse(text)); } catch (error) {
    if (error instanceof SyntaxError) throw new TypeError('JSON 파일을 읽지 못했어요. 리허설에서 내보낸 파일인지 확인해 주세요.');
    throw error;
  }
}
