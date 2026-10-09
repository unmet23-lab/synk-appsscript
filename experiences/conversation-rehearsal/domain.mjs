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

// Explicit choices select authored practice, never an interpretation of free text.
// Keep these IDs and their wording stable so saved sessions replay the same scene.
export const PRACTICES = Object.freeze({
  interview: {
    counterparts: {
      recruiter: { label: '채용 담당자', opening: '지원 내용을 함께 살펴볼게요.', pressure: '채용 기준에 맞는지 확인하고 싶어요.', hint: '직무 용어만 나열하지 말고, 처음 듣는 사람도 이해할 수 있게 설명해 보세요.' },
      lead: { label: '실무 팀장', opening: '함께 일할 장면을 생각하며 여쭤볼게요.', pressure: '우리 팀은 바로 함께 일할 사람을 찾고 있어요.', hint: '내가 맡은 일과 함께 일한 사람의 일을 구분해 보세요.' },
    },
    goals: {
      experience: { label: '경험으로 강점 전하기', goal: '내가 직접 한 일과 그 경험의 쓰임을 전하기', starter: '제가 직접 맡았던 일은…', check: '내 행동과 실제 결과를 구분하고, 지원 역할과 연결했나요?', turns: {
        opening: { title: '내가 한 일로 시작하기', prompt: '이 역할과 연결되는 경험을 하나 소개해 주시겠어요?', hint: '상황 한 문장 뒤에 내가 직접 한 일을 붙여 보세요.' },
        specific: { title: '내 행동과 결과 나누기', prompt: '그때 본인이 선택한 방법과 실제로 달라진 점은 무엇인가요?', hint: '내 선택 → 행동 → 확인한 결과를 적으세요. 수치가 없으면 관찰한 변화를 말해도 좋아요.' },
        concise: { title: '경험을 두 문장으로', prompt: '그 경험에서 드러난 강점을 두 문장으로 들려주시겠어요?', hint: '강점 한 문장, 그 근거가 되는 내 행동 한 문장으로 줄여 보세요.' },
        pressure: { title: '경험의 쓰임 설명하기', prompt: '같은 방법이 통하지 않는 상황이라면 어떻게 하시겠어요?', hint: '바로 성과를 약속하기보다, 먼저 확인할 조건과 바꿔 볼 행동을 나누세요.' },
        close: { title: '역할을 확인하는 질문', prompt: '그 강점을 쓸 수 있을지 판단하려면 저희에게 무엇을 확인하고 싶으세요?', hint: '실제 맡을 일이나 협업 방식에 대한 질문 한 가지로 마무리하세요.' },
      } },
      transition: { label: '새 역할에 도전하는 이유', goal: '부족한 경험을 인정하고 옮겨 쓸 역량과 준비를 전하기', starter: '이 역할은 새롭지만, 제가 옮겨 쓸 수 있는 경험은…', check: '아직 해 보지 않은 일과 이미 준비한 행동을 구분했나요?', turns: {
        opening: { title: '새 역할을 택한 이유', prompt: '이전과 다른 역할에 도전하려는 이유는 무엇인가요?', hint: '떠나고 싶은 이유보다, 새 역할에서 해 보고 싶은 일과 연결되는 경험을 말해 보세요.' },
        specific: { title: '준비를 행동으로 보여 주기', prompt: '새 역할을 이해하기 위해 지금까지 직접 해 본 일은 무엇인가요?', hint: '실제로 해 본 공부·작은 작업·관찰 중 하나와 거기서 알게 된 점을 적으세요.' },
        concise: { title: '전환 이유를 짧게', prompt: '왜 이 역할인지, 어떤 준비가 되었는지 두 문장으로 정리해 주세요.', hint: '도전 이유 한 문장과 준비한 행동 한 문장을 남겨 보세요.' },
        pressure: { title: '경험 부족에 답하기', prompt: '직접 해 본 경험이 부족한데, 처음 맡는 일은 어떻게 시작하시겠어요?', hint: '모르는 점을 인정한 뒤, 확인할 기준·도움을 구할 시점·첫 작업을 구체적으로 말하세요.' },
        close: { title: '첫걸음의 기준 확인하기', prompt: '입사 초기에 무엇을 배우거나 확인하고 싶으세요?', hint: '첫 업무의 성공 기준이나 적응 과정에 관한 질문 하나를 준비해 보세요.' },
      } },
    },
  },
  request: {
    counterparts: {
      colleague: { label: '함께 일하는 동료', opening: '지금 잠깐 이야기할 수 있어요.', pressure: '저도 맡은 일이 남아 있어요.', hint: '동료가 선택할 수 있도록 필요한 도움과 조정 가능한 범위를 함께 말하세요.' },
      manager: { label: '일정을 결정하는 상사', opening: '어떤 조정이 필요한지 말씀해 주세요.', pressure: '다른 업무 일정에도 영향이 생길 수 있어요.', hint: '현재 상태와 필요한 결정을 나누고, 내가 할 수 있는 대응도 제시하세요.' },
    },
    goals: {
      help: { label: '작은 도움 구하기', goal: '필요한 작업과 기한을 정해 도움을 요청하기', starter: '지금 ○○까지 했는데, ○○ 부분을 부탁드려도 될까요?', check: '도움의 크기·기한·상대가 거절하거나 줄일 여지를 말했나요?', turns: {
        opening: { title: '필요한 도움 하나 꺼내기', prompt: '어떤 도움이 필요한가요?', hint: '현재까지 한 일 뒤에, 부탁할 작업 하나와 필요한 시점을 붙이세요.' },
        specific: { title: '부탁의 끝을 정하기', prompt: '어디까지 도와드리면 되고, 언제까지 필요한가요?', hint: '작업의 시작과 끝, 필요한 기한, 전달 방법을 구체적으로 정해 보세요.' },
        concise: { title: '한 번에 이해할 부탁', prompt: '핵심 요청과 기한부터 짧게 말해 줄래요?', hint: '“○○를 ○○까지 부탁드릴 수 있을까요?” 다음에 이유를 한 문장만 붙이세요.' },
        pressure: { title: '도움을 줄일 수 있을 때', prompt: '전부 맡기는 어려운데, 가장 필요한 부분만 정할 수 있을까요?', hint: '상황을 인정하고 최소한의 도움 하나로 줄이거나 다른 시점을 물어보세요.' },
        close: { title: '가능한 범위를 확인하기', prompt: '가능한 범위와 전달 방법을 같이 정해 볼까요?', hint: '아직 합의하지 않은 도움을 확정하지 말고, 범위·기한·확인 방법을 질문으로 확인하세요.' },
      } },
      deadline: { label: '일정 조정 부탁하기', goal: '현재 진행 상황을 알리고 가능한 새 일정을 상의하기', starter: '현재 ○○까지 진행했고, ○○ 때문에 일정 조정을 상의드리고 싶어요.', check: '현재 상태·영향·가능한 대안·확인할 시점을 함께 전했나요?', turns: {
        opening: { title: '일정 문제를 먼저 알리기', prompt: '지금 진행 상황과 조정이 필요한 일정을 알려 주세요.', hint: '끝난 일과 남은 일을 나누고, 바꾸고 싶은 시점을 구체적으로 말하세요.' },
        specific: { title: '새 일정의 근거 세우기', prompt: '얼마나 더 필요하고, 그때까지 무엇을 마칠 수 있나요?', hint: '막연히 늦추지 말고, 남은 작업·가능한 날짜·중간 확인 시점을 제안하세요.' },
        concise: { title: '변경 요청을 짧게', prompt: '기존 일정과 제안하는 일정, 이유를 짧게 정리해 주세요.', hint: '“○○를 ○○로 조정할 수 있을까요? 현재 ○○가 남았습니다.”처럼 말해 보세요.' },
        pressure: { title: '마감이 고정돼 있을 때', prompt: '마감 자체를 바꾸기 어렵다면 어떤 방법이 있을까요?', hint: '그대로 가능하다고 약속하지 말고, 범위·우선순위·도움 중 조정할 수 있는 것을 상의하세요.' },
        close: { title: '조정안을 확정하기 전에', prompt: '그럼 변경 범위와 다음 확인 시점을 어떻게 정하면 될까요?', hint: '누가 무엇을 언제까지 하는지 제안하고, 상대가 동의하는지 확인하세요.' },
      } },
    },
  },
  refusal: {
    counterparts: {
      colleague: { label: '업무를 부탁하는 동료', opening: '업무와 관련해 부탁이 있어요.', pressure: '함께 일하는 사이인데 조금만 더 도와주시면 안 될까요?', hint: '상대에 대한 평가 대신, 현재 맡은 일과 가능한 범위를 말하세요.' },
      friend: { label: '가까운 친구', opening: '함께하고 싶은 일이 있어요.', pressure: '우리 사이인데 이번 한 번만 안 될까요?', hint: '친구의 마음을 인정해도 결정한 범위를 바꿀 필요는 없어요.' },
    },
    goals: {
      scope: { label: '맡기 어려운 일 거절하기', goal: '이번에 맡을 수 없는 범위를 분명하게 전하기', starter: '부탁한 마음은 이해해요. 다만 이번 일은 제가 맡기 어려워요.', check: '거절의 뜻이 분명하고, 할 수 없는 대안을 약속하지 않았나요?', turns: {
        opening: { title: '맡을 수 없는 범위 말하기', prompt: '이번 일을 맡아 줄 수 있을까요?', hint: '부탁을 받아 준 마음 한 문장과, 맡기 어려운 범위 한 문장을 나누세요.' },
        specific: { title: '어디까지 어려운지', prompt: '일부만이라도 맡을 수 있는지 알려 주세요.', hint: '전부 어려우면 그렇게 말해도 괜찮아요. 가능한 범위가 있을 때만 따로 제안하세요.' },
        concise: { title: '모호한 기대 남기지 않기', prompt: '그래서 이번 일은 맡을 수 있다는 뜻인가요?', hint: '“이번 일은 맡기 어렵습니다.”처럼 결정을 먼저 전하고 설명은 짧게 덧붙이세요.' },
        pressure: { title: '다시 부탁해도 내 범위 유지하기', prompt: '다른 사람을 구하기 어려워요. 조금만 맡아 줄 수 없나요?', hint: '상황이 어려운 점을 인정하되, 새 핑계를 만들지 말고 결정한 범위를 반복하세요.' },
        close: { title: '존중하며 끝맺기', prompt: '알겠어요. 다른 방법을 찾아볼게요.', hint: '들어 준 것에 고마움을 전하세요. 관계를 위해 불가능한 대안을 덧붙일 필요는 없어요.' },
      } },
      schedule: { label: '약속·시간 제안 거절하기', goal: '어려운 시간을 분명히 말하고 가능한 경우에만 다른 때를 제안하기', starter: '그 시간에는 함께하기 어려워요. 제 일정을 먼저 말씀드릴게요.', check: '어려운 시간을 분명히 말하고, 대안은 실제 가능할 때만 제안했나요?', turns: {
        opening: { title: '그 시간은 어렵다고 말하기', prompt: '이번에 제안한 시간에 함께할 수 있나요?', hint: '가능 여부를 먼저 말하세요. 개인 일정을 자세히 설명할 의무는 없어요.' },
        specific: { title: '가능한 시간과 불가능한 시간', prompt: '그 시간이 안 되면 가능한 다른 때가 있을까요?', hint: '가능한 때가 있으면 제안하고, 아직 모르겠으면 확인 전 약속하지 마세요.' },
        concise: { title: '가능 여부부터 짧게', prompt: '일정을 잡아야 해서요. 이번에는 참석할 수 있나요?', hint: '가능 여부 한 문장과, 필요하면 대안 한 문장으로 정리하세요.' },
        pressure: { title: '잠깐만 오라는 말에 답하기', prompt: '잠깐만 시간을 내면 안 될까요? 이미 기대하고 있어요.', hint: '기대하는 마음을 인정하고, 어렵다는 결정을 차분히 반복해 보세요.' },
        close: { title: '다음 약속을 강요하지 않고', prompt: '알겠어요. 다음 일정을 정할 때 어떻게 하면 좋을까요?', hint: '다음 연락 방법을 정하거나, 일정 확인 뒤 답하겠다고 말하세요. 날짜를 억지로 약속하지 않아도 돼요.' },
      } },
    },
  },
});

export function defaultPractice(scenario) {
  const options = PRACTICES[scenario];
  return { counterpart: Object.keys(options.counterparts)[0], goal: Object.keys(options.goals)[0] };
}
function validPractice(scenario, practice) {
  return practice && typeof practice === 'object' && !Array.isArray(practice)
    && Object.keys(practice).length === 2 && Object.keys(practice).every(key => ['counterpart', 'goal'].includes(key))
    && Object.hasOwn(PRACTICES[scenario].counterparts, practice.counterpart) && Object.hasOwn(PRACTICES[scenario].goals, practice.goal);
}
export function practiceDetails(session) {
  if (!session.practice) return SCENARIOS[session.scenario];
  if (!validPractice(session.scenario, session.practice)) throw new TypeError('상대 유형과 연습 목표를 골라 주세요.');
  const options = PRACTICES[session.scenario], counterpart = options.counterparts[session.practice.counterpart], goal = options.goals[session.practice.goal];
  return { ...goal, counterpart: counterpart.label, label: `${counterpart.label} · ${goal.label}`, counterpartHint: counterpart.hint };
}

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

export function createSession({ scenario, counterpart, goal, practice, at = new Date().toISOString(), id = crypto.randomUUID() }) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new TypeError('연습할 상황을 골라 주세요.');
  const entry = { id, at, scenario, counterpart: cleanText(counterpart, 80), goal: cleanText(goal, 240), focus: null, turns: [], firstSentence: '', takeaway: '' };
  if (!entry.counterpart || !entry.goal) throw new TypeError('상대와 오늘의 목표를 적어 주세요.');
  if (practice !== undefined) {
    if (!validPractice(scenario, practice)) throw new TypeError('상대 유형과 연습 목표를 골라 주세요.');
    entry.practice = { ...practice };
  }
  return entry;
}

export function getTurn(session, index = session.turns.length) {
  const key = index === 0 ? 'opening' : index === 1 ? session.focus || 'specific' : 'close';
  const details = practiceDetails(session), turn = { id: key, ...details.turns[key] };
  if (session.practice) {
    const counterpart = PRACTICES[session.scenario].counterparts[session.practice.counterpart];
    const lead = key === 'opening' ? counterpart.opening : key === 'pressure' ? counterpart.pressure : '';
    turn.prompt = lead ? `${lead} ${turn.prompt}` : turn.prompt;
    turn.hint = `${turn.hint} ${counterpart.hint}`;
  }
  return turn;
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
    if (!keys(s, ['id', 'at', 'scenario', 'counterpart', 'goal', 'practice', 'focus', 'turns', 'firstSentence', 'takeaway']) || !bounded(s.id, 80, false) || ids.has(s.id) || !bounded(s.at, 40, false) || !Number.isFinite(Date.parse(s.at)) || !Object.hasOwn(SCENARIOS, s.scenario) || !Object.hasOwn(DIRECTIONS, s.focus) || !bounded(s.counterpart, 80, false) || !bounded(s.goal, 240, false) || !bounded(s.firstSentence, 600) || !bounded(s.takeaway, 600) || !Array.isArray(s.turns) || s.turns.length !== 3 || (Object.hasOwn(s, 'practice') && !validPractice(s.scenario, s.practice))) invalid();
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
