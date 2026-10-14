// 중요한 대화 리허설 — 상황·대사·세션·저장 형식. 이 파일은 계정 저장 검증(synk-account personal-data,
// 운영 synk-personal 함수, 플랫폼 번들)이 그대로 가져가므로 다른 모듈을 import하지 않는다.
export const SCHEMA = 2;
export const SCHEMAS = Object.freeze([1, 2]);
// 2026-10-14: 10 → 30. 최악 분량(턴당 원문·재작성 2000자, 계획·돌아보기 최대)은 한 회 약 45KB라
// 30회를 모두 담을 수 없다. 그래서 횟수 한도와 함께 내보내기 JSON(들여쓰기 포함) 500000 bytes 안에
// 들어가는 최근 기록만 남긴다(keepSessions). 보통 한 회는 5KB 안팎이라 30회도 150KB쯤이다.
export const MAX_SESSIONS = 30;
export const MAX_IMPORT_BYTES = 500000;
export const MAX_SPOKEN_SECONDS = 600;
export const REVIEWS = Object.freeze({ easy: '말할 수 있었어요', unsure: '조금 망설였어요', stuck: '말이 막혔어요' });
export const INTENSITIES = Object.freeze({ gentle: '부드럽게', normal: '보통', tough: '세게' });
export const MODES = Object.freeze({ text: '글로 답함', voice: '말로 답함' });
export const OUTCOMES = Object.freeze({
  did: Object.freeze({ yes: '대화했어요', no: '하지 못했어요', later: '나중으로 미뤘어요' }),
  reaction: Object.freeze({ good: '잘 통했어요', mixed: '반반이었어요', hard: '어려웠어요' }),
});
export const TURN_IDS = Object.freeze(['opening', 'specific', 'concise', 'pressure', 'close']);

// 새 상황(2026-10-14)의 첫 목표 대사. 상대·목표를 고르지 않은 세션은 이 대사를 쓴다.
const PRESENTATION_STATUS = {
  opening: { title: '결론 한 문장으로 시작하기', prompt: '지금 진행 상황이 어떤지 먼저 말해 줄래요?', hint: '「결론부터 말씀드리면 ○○는 ○○ 상태입니다」처럼 상태를 먼저 말하고, 설명은 그 뒤에 붙이세요.' },
  specific: { title: '근거와 예시 붙이기', prompt: '그렇게 판단한 근거가 뭐예요? 숫자나 실제 사례가 있어요?', hint: '근거 하나에 그것을 보여 주는 숫자나 실제 장면 하나를 짝지어 말해 보세요.' },
  concise: { title: '30초 안에 정리하기', prompt: '회의가 곧 시작이라서요. 30초 안에 정리해 줄래요?', hint: '결론 한 문장, 근거 한 문장이면 충분해요. 배경 설명은 빼도 괜찮아요.' },
  pressure: { title: '근거가 약하다는 말에 답하기', prompt: '그 정도 근거로는 결정하기 어려운데요. 다른 자료는 없어요?', tones: { gentle: '근거를 조금만 더 들어 볼 수 있을까요?', tough: '그 숫자 하나로 결정하라는 거예요? 확실한 게 뭐예요?' }, hint: '근거를 부풀리지 말고 확인된 것과 아직 확인 중인 것을 나눠 말하세요. 언제까지 무엇을 더 확인할지도 덧붙이세요.' },
  close: { title: '필요한 결정으로 마무리하기', prompt: '알겠어요. 그래서 제가 정해 줘야 하는 게 뭐예요?', hint: '처음에 말한 결론을 한 번 더 말하고, 필요한 결정 하나를 분명히 부탁하세요.' },
};
const NEGOTIATION_PRICE = {
  opening: { title: '원하는 조건을 숫자로', prompt: '생각하시는 금액이 어느 정도인가요?', hint: '「○○을 희망합니다」처럼 숫자 하나로 먼저 말하고, 근거는 그다음 한 문장으로 붙이세요.' },
  specific: { title: '숫자의 근거 세우기', prompt: '그 금액을 생각하신 근거가 있을까요?', hint: '비슷한 일의 시장 수준, 내가 낸 결과, 맡을 일의 범위 가운데 실제로 확인한 것을 말하세요.' },
  concise: { title: '요청을 짧게 정리하기', prompt: '정리하면 원하시는 게 정확히 뭔가요?', hint: '금액 한 문장, 함께 원하는 조건 하나로 정리해 보세요.' },
  pressure: { title: '기준에 안 맞는다는 말에', prompt: '저희 기준으로는 그 금액을 맞춰 드리기 어려워요.', tones: { gentle: '저희도 맞춰 드리고 싶은데, 그 금액은 조금 어려울 것 같아요.', tough: '그 금액은 불가능해요. 이 조건이 싫으시면 어쩔 수 없고요.' }, hint: '바로 물러서지 말고, 금액 말고 조정할 수 있는 조건을 묻거나 받아들일 수 있는 선을 차분히 말하세요.' },
  close: { title: '다음 단계 정하기', prompt: '그럼 내부에서 다시 검토해 볼게요. 더 하실 말씀 있으세요?', hint: '오늘 이야기한 조건을 한 문장으로 다시 정리하고, 언제까지 어떤 방식으로 답을 받을지 확인하세요.' },
};
const APOLOGY_MISTAKE = {
  opening: { title: '변명 없이 인정하기', prompt: '무슨 일이 있었던 건지 먼저 말해 줄래요?', hint: '무엇을 잘못했는지 한 문장으로 인정하고 사과하세요. 사정 설명은 뒤로 미뤄도 괜찮아요.' },
  specific: { title: '무엇을 놓쳤는지 짚기', prompt: '정확히 어떤 부분이 문제였다고 생각해요?', hint: '상황 탓보다 내가 놓친 것 하나를 짚고, 그 때문에 상대가 겪은 일을 말하세요.' },
  concise: { title: '사과와 행동을 한 번에', prompt: '길게 말하지 않아도 돼요. 그래서 어떻게 할 거예요?', hint: '「제 실수였어요. 죄송해요. 오늘 안에 다시 보내 드릴게요.」처럼 인정과 바로잡을 행동을 한 번에 말해 보세요.' },
  pressure: { title: '또 그러면 어떡하냐는 말에', prompt: '다음에도 또 이러면 어떡해요?', tones: { gentle: '다음에는 괜찮겠죠? 조금 걱정돼서요.', tough: '이번엔 정말 달라지는 거 맞아요? 뭘 바꿀 건데요?' }, hint: '다짐보다 방법을 말하세요. 무엇을 바꿔서 같은 일이 다시 생기지 않게 할지 한 가지를 정하세요.' },
  close: { title: '관계를 다시 잇기', prompt: '알겠어요. 이번엔 믿어 볼게요.', hint: '받아 준 것에 고마움을 전하고, 약속한 행동을 언제 확인할지 말하며 마무리하세요.' },
};
const FEEDBACK_IMPROVE = {
  opening: { title: '본 것으로 시작하기', prompt: '무슨 이야기인지 먼저 들어 볼게요.', hint: '「지난 ○○ 때 ○○하는 걸 봤어요」처럼 언제 무엇을 봤는지로 시작하세요. 「항상」「늘」은 빼 보세요.' },
  specific: { title: '영향을 구체적으로', prompt: '그게 왜 문제가 되는 건지 잘 모르겠어요.', hint: '그 행동 때문에 일이나 다른 사람에게 실제로 생긴 일을 하나 말하세요.' },
  concise: { title: '바라는 것을 한 문장으로', prompt: '그래서 제가 어떻게 하면 되는 거예요?', hint: '「다음부터는 ○○해 주면 좋겠어요」처럼 바라는 행동 하나를 분명하게 말하세요.' },
  pressure: { title: '방어하는 반응에 답하기', prompt: '저만 그런 것도 아닌데요.', tones: { gentle: '아, 저는 그게 문제가 되는 줄 몰랐어요.', tough: '다른 사람들도 다 그렇게 하는데 왜 저한테만 그러세요?' }, hint: '다른 사람과 비교하는 이야기로 번지지 않게, 본 사실을 차분히 다시 말하고 상대의 사정을 물어보세요.' },
  close: { title: '함께 정하고 마무리하기', prompt: '알겠어요. 다음부터 신경 쓸게요.', hint: '고맙다고 말하고, 도울 일이 있는지 또는 언제 다시 이야기할지 물으며 마무리하세요.' },
};

export const SCENARIOS = Object.freeze({
  interview: { name: '면접에서 나를 소개할 때', short: '면접', note: '내 경험을 근거로, 짧고 분명하게.', counterpart: '면접관', goal: '내 경험이 이 역할에 어떻게 도움이 되는지 전하기', opening: '이 역할에 지원한 이유를 들려주시겠어요?',
    turns: {
      opening: { title: '첫 인상보다, 첫 문장', prompt: '이 역할에 지원한 이유를 들려주시겠어요?', hint: '관심 있는 일 한 가지와 연결되는 내 경험 한 가지를 적어 보세요.' },
      specific: { title: '경험을 하나만 꺼내기', prompt: '그 경험에서 본인이 직접 한 일은 무엇이었나요?', hint: '상황 → 내가 한 행동 → 실제로 일어난 결과. 없는 성과를 만들 필요는 없어요.' },
      concise: { title: '핵심부터 말하기', prompt: '시간이 많지 않아서요. 가장 전하고 싶은 내용을 두 문장으로 정리해 주시겠어요?', hint: '먼저 결론 한 문장. 그다음 그 결론을 뒷받침하는 실제 경험 한 문장.' },
      pressure: { title: '예상 밖의 질문', prompt: '그 경험이 우리 팀의 일에도 도움이 된다고 생각하는 이유는 무엇인가요?', tones: { gentle: '그 경험이 저희 일에도 도움이 될 수 있을지 궁금해요.', tough: '그 경험이 우리 일이랑 무슨 상관이죠?' }, hint: '상대의 상황을 모르면, 먼저 확인하고 싶은 점을 질문해도 좋아요.' },
      close: { title: '대화를 이어 갈 한마디', prompt: '마지막으로 저희에게 물어보고 싶은 것이 있나요?', hint: '역할에 관해 정말 알고 싶은 점 한 가지로 마무리해 보세요.' },
    }, starter: '제가 이 역할에 관심을 가진 이유는…', check: '실제로 내가 한 행동을 한 가지 말했나요?' },
  request: { name: '부탁을 꺼내야 할 때', short: '부탁', note: '필요한 도움과 가능한 범위를 함께.', counterpart: '함께 일하는 동료', goal: '상대의 상황을 확인하며 필요한 도움을 구하기',
    turns: {
      opening: { title: '조심스럽게 시작하기', prompt: '무슨 일이에요? 지금 잠깐 이야기할 수 있어요.', hint: '대화를 나눌 수 있는지 확인하고, 부탁하고 싶은 일을 한 가지로 말해 보세요.' },
      specific: { title: '부탁의 크기를 분명하게', prompt: '제가 정확히 무엇을, 언제까지 도와드리면 될까요?', hint: '필요한 작업과 기한을 나누어 적고, 조정 가능한 부분도 말해 보세요.' },
      concise: { title: '짧게 핵심 전하기', prompt: '지금은 시간이 별로 없어요. 필요한 것부터 짧게 말해 줄래요?', hint: '“○○를 부탁드리고 싶어요. ○○까지 가능하실까요?”처럼 시작할 수 있어요.' },
      pressure: { title: '부담스럽다는 말에 답하기', prompt: '저도 일정이 꽉 차 있어서 전부 도와드리기는 어려울 것 같아요.', tones: { gentle: '저도 일정이 좀 있어서, 일부만 도와드려도 괜찮을까요?', tough: '저도 일정이 꽉 찼어요. 그걸 왜 제가 해야 하죠?' }, hint: '상대의 상황을 인정하고, 부탁을 줄이거나 다른 시점을 제안해 보세요.' },
      close: { title: '서로 같은 뜻인지 확인하기', prompt: '그럼 제가 가능한 범위에서 해 볼게요. 어떻게 진행하면 좋을까요?', hint: '합의한 범위와 다음 확인 시점을 정리해 보세요. 아직 합의되지 않은 일은 묻는 표현으로요.' },
    }, starter: '잠깐 이야기 나눌 수 있을까요? 부탁드리고 싶은 일이 있어요.', check: '무엇을 언제까지 부탁하는지, 조정 가능한 범위를 말했나요?' },
  refusal: { name: '관계를 지키며 거절할 때', short: '거절', note: '미안함에 묻히지 않게, 내 범위까지.', counterpart: '가까운 지인', goal: '할 수 없는 범위를 분명히 전하면서 관계를 존중하기',
    turns: {
      opening: { title: '내 범위를 말하는 시작', prompt: '이번에도 부탁 좀 해도 될까요? 꼭 해 줬으면 좋겠어요.', hint: '상대의 마음을 짧게 받아 준 뒤, 내가 할 수 없는 부분을 분명하게 말해 보세요.' },
      specific: { title: '이유와 범위를 나누기', prompt: '어떤 부분이 어려운 건지 알려 줄 수 있어요?', hint: '공유하고 싶은 만큼만 이유를 말해도 괜찮아요. 할 수 있는 범위가 있다면 따로 말해 보세요.' },
      concise: { title: '짧고 분명한 거절', prompt: '그래서, 이번에는 가능하다는 건가요? 어렵다는 건가요?', hint: '결정을 한 문장으로 먼저 말하고, 필요하면 설명을 덧붙이세요.' },
      pressure: { title: '한 번 더 부탁할 때', prompt: '딱 이번 한 번만 안 될까요? 다른 부탁은 안 할게요.', tones: { gentle: '정말 어렵다면 어쩔 수 없지만, 이번 한 번만 다시 생각해 줄 수 있어요?', tough: '이번 한 번인데 그것도 안 돼요? 다른 부탁은 안 한다니까요.' }, hint: '새로운 이유를 계속 만들기보다, 결정한 범위를 차분하게 반복해 보세요.' },
      close: { title: '관계를 남기는 마무리', prompt: '알겠어요. 조금 아쉽기는 하네요.', hint: '아쉬움을 인정하면서 마무리해 보세요. 할 수 없는 대안을 약속하지 않아도 괜찮아요.' },
    }, starter: '부탁한 마음은 이해해요. 다만 이번에는 제가…', check: '내가 할 수 없는 범위를 모호하지 않게 말했나요?' },
  presentation: { name: '결론부터 발표·보고할 때', short: '발표·보고', note: '결론을 먼저, 근거와 예시로 받치고, 끝에서 다시 결론.', counterpart: '보고를 받는 팀장', goal: '결론을 먼저 말하고 근거와 예시로 결정을 돕기',
    turns: PRESENTATION_STATUS, starter: '결론부터 말씀드리면…', check: '첫 문장에 결론이 있고, 마지막에 다시 결론을 말했나요?' },
  negotiation: { name: '조건과 연봉을 협상할 때', short: '협상', note: '원하는 것과 근거를 먼저, 물러설 수 없는 선은 미리 정해 두기.', counterpart: '처우를 정하는 인사 담당자', goal: '원하는 조건을 근거와 함께 말하고 다음 단계까지 정하기',
    turns: NEGOTIATION_PRICE, starter: '제가 희망하는 조건은 ○○입니다. 그렇게 생각한 근거는…', check: '원하는 것을 숫자로 말하고, 근거와 다음 단계를 함께 정했나요?' },
  apology: { name: '진심으로 사과해야 할 때', short: '사과', note: '변명보다 인정, 말보다 바로잡을 행동.', counterpart: '함께 일하는 동료', goal: '잘못을 인정하고 바로잡을 행동과 재발 방지를 약속하기',
    turns: APOLOGY_MISTAKE, starter: '제가 ○○한 건 제 잘못이에요. 죄송해요.', check: '변명 없이 인정하고, 상대가 겪은 일과 바로잡을 행동을 말했나요?' },
  feedback: { name: '피드백을 건네야 할 때', short: '피드백', note: '평가 대신 본 것, 그 영향, 바라는 것.', counterpart: '함께 일하는 후배', goal: '관찰한 사실과 영향을 말하고 바라는 점을 함께 정하기',
    turns: FEEDBACK_IMPROVE, starter: '지난 ○○ 때 본 것을 이야기하고 싶어요.', check: '평가가 아니라 본 사실을 말하고, 상대의 생각을 물었나요?' },
});

export const DIRECTIONS = Object.freeze({ specific: '내용을 구체적으로', concise: '짧고 분명하게', pressure: '부담스러운 반응에 답하기' });

// Explicit choices select authored practice, never an interpretation of free text.
// Keep these IDs and their wording stable so saved sessions replay the same scene.
// 기존 opening·pressure·prompt 문장은 보통(normal) 강도로 그대로 두고, 부드럽게·세게는 tone·tones에 따로 둔다.
export const PRACTICES = Object.freeze({
  interview: {
    counterparts: {
      recruiter: { label: '채용 담당자', opening: '지원 내용을 함께 살펴볼게요.', pressure: '채용 기준에 맞는지 확인하고 싶어요.', hint: '직무 용어만 나열하지 말고, 처음 듣는 사람도 이해할 수 있게 설명해 보세요.',
        tone: { gentle: { opening: '편하게 말씀하셔도 돼요. 지원 내용을 함께 살펴볼게요.', pressure: '기준에 맞는지 같이 확인해 보고 싶어서요.' }, tough: { opening: '지원자가 많아서 짧게 여쭤볼게요.', pressure: '솔직히 지금까지 말씀만으로는 기준에 못 미쳐 보여요.' } } },
      lead: { label: '실무 팀장', opening: '함께 일할 장면을 생각하며 여쭤볼게요.', pressure: '우리 팀은 바로 함께 일할 사람을 찾고 있어요.', hint: '내가 맡은 일과 함께 일한 사람의 일을 구분해 보세요.',
        tone: { gentle: { opening: '편하게 이야기 나눠요. 함께 일하는 장면을 떠올리며 여쭤볼게요.', pressure: '저희 팀 일에 어떻게 맞을지 조금 더 듣고 싶어요.' }, tough: { opening: '실무 이야기만 할게요.', pressure: '저희는 가르칠 시간이 없어요.' } } },
    },
    goals: {
      experience: { label: '경험으로 강점 전하기', goal: '내가 직접 한 일과 그 경험의 쓰임을 전하기', starter: '제가 직접 맡았던 일은…', check: '내 행동과 실제 결과를 구분하고, 지원 역할과 연결했나요?', turns: {
        opening: { title: '내가 한 일로 시작하기', prompt: '이 역할과 연결되는 경험을 하나 소개해 주시겠어요?', hint: '상황 한 문장 뒤에 내가 직접 한 일을 붙여 보세요.' },
        specific: { title: '내 행동과 결과 나누기', prompt: '그때 본인이 선택한 방법과 실제로 달라진 점은 무엇인가요?', hint: '내 선택 → 행동 → 확인한 결과를 적으세요. 수치가 없으면 관찰한 변화를 말해도 좋아요.' },
        concise: { title: '경험을 두 문장으로', prompt: '그 경험에서 드러난 강점을 두 문장으로 들려주시겠어요?', hint: '강점 한 문장, 그 근거가 되는 내 행동 한 문장으로 줄여 보세요.' },
        pressure: { title: '경험의 쓰임 설명하기', prompt: '같은 방법이 통하지 않는 상황이라면 어떻게 하시겠어요?', tones: { gentle: '혹시 그 방법이 잘 안 통했던 경우도 있었을까요?', tough: '그건 운이 좋았던 거 아닌가요? 안 통하면 어떻게 할 건데요?' }, hint: '바로 성과를 약속하기보다, 먼저 확인할 조건과 바꿔 볼 행동을 나누세요.' },
        close: { title: '역할을 확인하는 질문', prompt: '그 강점을 쓸 수 있을지 판단하려면 저희에게 무엇을 확인하고 싶으세요?', hint: '실제 맡을 일이나 협업 방식에 대한 질문 한 가지로 마무리하세요.' },
      } },
      transition: { label: '새 역할에 도전하는 이유', goal: '부족한 경험을 인정하고 옮겨 쓸 역량과 준비를 전하기', starter: '이 역할은 새롭지만, 제가 옮겨 쓸 수 있는 경험은…', check: '아직 해 보지 않은 일과 이미 준비한 행동을 구분했나요?', turns: {
        opening: { title: '새 역할을 택한 이유', prompt: '이전과 다른 역할에 도전하려는 이유는 무엇인가요?', hint: '떠나고 싶은 이유보다, 새 역할에서 해 보고 싶은 일과 연결되는 경험을 말해 보세요.' },
        specific: { title: '준비를 행동으로 보여 주기', prompt: '새 역할을 이해하기 위해 지금까지 직접 해 본 일은 무엇인가요?', hint: '실제로 해 본 공부·작은 작업·관찰 중 하나와 거기서 알게 된 점을 적으세요.' },
        concise: { title: '전환 이유를 짧게', prompt: '왜 이 역할인지, 어떤 준비가 되었는지 두 문장으로 정리해 주세요.', hint: '도전 이유 한 문장과 준비한 행동 한 문장을 남겨 보세요.' },
        pressure: { title: '경험 부족에 답하기', prompt: '직접 해 본 경험이 부족한데, 처음 맡는 일은 어떻게 시작하시겠어요?', tones: { gentle: '경험이 아직 많지 않으신데, 처음엔 어떻게 시작해 보고 싶으세요?', tough: '이 일을 직접 해 본 적이 없으시잖아요. 왜 경험자 대신 뽑아야 하죠?' }, hint: '모르는 점을 인정한 뒤, 확인할 기준·도움을 구할 시점·첫 작업을 구체적으로 말하세요.' },
        close: { title: '첫걸음의 기준 확인하기', prompt: '입사 초기에 무엇을 배우거나 확인하고 싶으세요?', hint: '첫 업무의 성공 기준이나 적응 과정에 관한 질문 하나를 준비해 보세요.' },
      } },
    },
  },
  request: {
    counterparts: {
      colleague: { label: '함께 일하는 동료', opening: '지금 잠깐 이야기할 수 있어요.', pressure: '저도 맡은 일이 남아 있어요.', hint: '동료가 선택할 수 있도록 필요한 도움과 조정 가능한 범위를 함께 말하세요.',
        tone: { gentle: { opening: '그럼요, 편하게 말해 줘요.', pressure: '저도 일이 좀 있긴 한데, 이야기는 들어 볼게요.' }, tough: { opening: '지금 좀 바쁜데, 급한 거예요?', pressure: '제 일도 밀려 있어요. 왜 하필 저예요?' } } },
      manager: { label: '일정을 결정하는 상사', opening: '어떤 조정이 필요한지 말씀해 주세요.', pressure: '다른 업무 일정에도 영향이 생길 수 있어요.', hint: '현재 상태와 필요한 결정을 나누고, 내가 할 수 있는 대응도 제시하세요.',
        tone: { gentle: { opening: '무슨 일인지 편하게 말해 봐요.', pressure: '다른 일정도 있어서 같이 고민해 봐야겠네요.' }, tough: { opening: '용건만 간단히 말해 줘요.', pressure: '지금 와서 바꾸면 다른 팀 일정까지 다 꼬여요.' } } },
    },
    goals: {
      help: { label: '작은 도움 구하기', goal: '필요한 작업과 기한을 정해 도움을 요청하기', starter: '지금 ○○까지 했는데, ○○ 부분을 부탁드려도 될까요?', check: '도움의 크기·기한·상대가 거절하거나 줄일 여지를 말했나요?', turns: {
        opening: { title: '필요한 도움 하나 꺼내기', prompt: '어떤 도움이 필요한가요?', hint: '현재까지 한 일 뒤에, 부탁할 작업 하나와 필요한 시점을 붙이세요.' },
        specific: { title: '부탁의 끝을 정하기', prompt: '어디까지 도와드리면 되고, 언제까지 필요한가요?', hint: '작업의 시작과 끝, 필요한 기한, 전달 방법을 구체적으로 정해 보세요.' },
        concise: { title: '한 번에 이해할 부탁', prompt: '핵심 요청과 기한부터 짧게 말해 줄래요?', hint: '“○○를 ○○까지 부탁드릴 수 있을까요?” 다음에 이유를 한 문장만 붙이세요.' },
        pressure: { title: '도움을 줄일 수 있을 때', prompt: '전부 맡기는 어려운데, 가장 필요한 부분만 정할 수 있을까요?', tones: { gentle: '다 도와주긴 어렵지만, 꼭 필요한 부분이 있으면 말해 줘요.', tough: '그걸 다 해 달라고요? 저도 바빠요. 정말 필요한 게 뭐예요?' }, hint: '상황을 인정하고 최소한의 도움 하나로 줄이거나 다른 시점을 물어보세요.' },
        close: { title: '가능한 범위를 확인하기', prompt: '가능한 범위와 전달 방법을 같이 정해 볼까요?', hint: '아직 합의하지 않은 도움을 확정하지 말고, 범위·기한·확인 방법을 질문으로 확인하세요.' },
      } },
      deadline: { label: '일정 조정 부탁하기', goal: '현재 진행 상황을 알리고 가능한 새 일정을 상의하기', starter: '현재 ○○까지 진행했고, ○○ 때문에 일정 조정을 상의드리고 싶어요.', check: '현재 상태·영향·가능한 대안·확인할 시점을 함께 전했나요?', turns: {
        opening: { title: '일정 문제를 먼저 알리기', prompt: '지금 진행 상황과 조정이 필요한 일정을 알려 주세요.', hint: '끝난 일과 남은 일을 나누고, 바꾸고 싶은 시점을 구체적으로 말하세요.' },
        specific: { title: '새 일정의 근거 세우기', prompt: '얼마나 더 필요하고, 그때까지 무엇을 마칠 수 있나요?', hint: '막연히 늦추지 말고, 남은 작업·가능한 날짜·중간 확인 시점을 제안하세요.' },
        concise: { title: '변경 요청을 짧게', prompt: '기존 일정과 제안하는 일정, 이유를 짧게 정리해 주세요.', hint: '“○○를 ○○로 조정할 수 있을까요? 현재 ○○가 남았습니다.”처럼 말해 보세요.' },
        pressure: { title: '마감이 고정돼 있을 때', prompt: '마감 자체를 바꾸기 어렵다면 어떤 방법이 있을까요?', tones: { gentle: '마감은 그대로 두고 싶은데, 다른 방법이 있을까요?', tough: '마감은 못 바꿔요. 그 안에 어떻게 끝낼 건지 말해 봐요.' }, hint: '그대로 가능하다고 약속하지 말고, 범위·우선순위·도움 중 조정할 수 있는 것을 상의하세요.' },
        close: { title: '조정안을 확정하기 전에', prompt: '그럼 변경 범위와 다음 확인 시점을 어떻게 정하면 될까요?', hint: '누가 무엇을 언제까지 하는지 제안하고, 상대가 동의하는지 확인하세요.' },
      } },
    },
  },
  refusal: {
    counterparts: {
      colleague: { label: '업무를 부탁하는 동료', opening: '업무와 관련해 부탁이 있어요.', pressure: '함께 일하는 사이인데 조금만 더 도와주시면 안 될까요?', hint: '상대에 대한 평가 대신, 현재 맡은 일과 가능한 범위를 말하세요.',
        tone: { gentle: { opening: '혹시 시간 되면 부탁 하나 해도 될까요?', pressure: '어렵다면 괜찮은데, 혹시 조금이라도 안 될까요?' }, tough: { opening: '바쁜 건 아는데, 이번엔 거절하지 말아 줘요.', pressure: '팀 일인데 이렇게 빠지면 곤란하죠.' } } },
      friend: { label: '가까운 친구', opening: '함께하고 싶은 일이 있어요.', pressure: '우리 사이인데 이번 한 번만 안 될까요?', hint: '친구의 마음을 인정해도 결정한 범위를 바꿀 필요는 없어요.',
        tone: { gentle: { opening: '같이 하고 싶은 일이 있는데, 들어 볼래요?', pressure: '아쉽다… 정말 안 되는 거예요?' }, tough: { opening: '이번엔 꼭 들어줬으면 해요.', pressure: '친구라면서 이 정도도 못 해 줘요?' } } },
    },
    goals: {
      scope: { label: '맡기 어려운 일 거절하기', goal: '이번에 맡을 수 없는 범위를 분명하게 전하기', starter: '부탁한 마음은 이해해요. 다만 이번 일은 제가 맡기 어려워요.', check: '거절의 뜻이 분명하고, 할 수 없는 대안을 약속하지 않았나요?', turns: {
        opening: { title: '맡을 수 없는 범위 말하기', prompt: '이번 일을 맡아 줄 수 있을까요?', hint: '부탁을 받아 준 마음 한 문장과, 맡기 어려운 범위 한 문장을 나누세요.' },
        specific: { title: '어디까지 어려운지', prompt: '일부만이라도 맡을 수 있는지 알려 주세요.', hint: '전부 어려우면 그렇게 말해도 괜찮아요. 가능한 범위가 있을 때만 따로 제안하세요.' },
        concise: { title: '모호한 기대 남기지 않기', prompt: '그래서 이번 일은 맡을 수 있다는 뜻인가요?', hint: '“이번 일은 맡기 어렵습니다.”처럼 결정을 먼저 전하고 설명은 짧게 덧붙이세요.' },
        pressure: { title: '다시 부탁해도 내 범위 유지하기', prompt: '다른 사람을 구하기 어려워요. 조금만 맡아 줄 수 없나요?', tones: { gentle: '다른 사람을 찾기가 좀 어려워서요. 정말 조금이라도 안 될까요?', tough: '지금 맡아 줄 사람이 없어요. 이번만 그냥 해 줘요.' }, hint: '상황이 어려운 점을 인정하되, 새 핑계를 만들지 말고 결정한 범위를 반복하세요.' },
        close: { title: '존중하며 끝맺기', prompt: '알겠어요. 다른 방법을 찾아볼게요.', hint: '들어 준 것에 고마움을 전하세요. 관계를 위해 불가능한 대안을 덧붙일 필요는 없어요.' },
      } },
      schedule: { label: '약속·시간 제안 거절하기', goal: '어려운 시간을 분명히 말하고 가능한 경우에만 다른 때를 제안하기', starter: '그 시간에는 함께하기 어려워요. 제 일정을 먼저 말씀드릴게요.', check: '어려운 시간을 분명히 말하고, 대안은 실제 가능할 때만 제안했나요?', turns: {
        opening: { title: '그 시간은 어렵다고 말하기', prompt: '이번에 제안한 시간에 함께할 수 있나요?', hint: '가능 여부를 먼저 말하세요. 개인 일정을 자세히 설명할 의무는 없어요.' },
        specific: { title: '가능한 시간과 불가능한 시간', prompt: '그 시간이 안 되면 가능한 다른 때가 있을까요?', hint: '가능한 때가 있으면 제안하고, 아직 모르겠으면 확인 전 약속하지 마세요.' },
        concise: { title: '가능 여부부터 짧게', prompt: '일정을 잡아야 해서요. 이번에는 참석할 수 있나요?', hint: '가능 여부 한 문장과, 필요하면 대안 한 문장으로 정리하세요.' },
        pressure: { title: '잠깐만 오라는 말에 답하기', prompt: '잠깐만 시간을 내면 안 될까요? 이미 기대하고 있어요.', tones: { gentle: '잠깐 얼굴만 보는 것도 어려울까요? 다들 보고 싶어 해서요.', tough: '다들 오는데 혼자만 빠지는 거예요? 잠깐이면 되잖아요.' }, hint: '기대하는 마음을 인정하고, 어렵다는 결정을 차분히 반복해 보세요.' },
        close: { title: '다음 약속을 강요하지 않고', prompt: '알겠어요. 다음 일정을 정할 때 어떻게 하면 좋을까요?', hint: '다음 연락 방법을 정하거나, 일정 확인 뒤 답하겠다고 말하세요. 날짜를 억지로 약속하지 않아도 돼요.' },
      } },
    },
  },
  presentation: {
    counterparts: {
      lead: { label: '보고를 받는 팀장', opening: '바쁘니까 핵심부터 들어 볼게요.', pressure: '이대로 위에 올리기엔 아직 근거가 약해 보여요.', hint: '팀장이 바로 결정하거나 위에 전달할 수 있게, 결론과 필요한 결정을 앞에 두세요.',
        tone: { gentle: { opening: '편하게 말해 주세요. 핵심부터 들어 볼게요.', pressure: '조금만 더 보완하면 좋겠어요.' }, tough: { opening: '5분밖에 없어요. 결론부터 말해요.', pressure: '이 근거로는 위에 못 올려요.' } } },
      client: { label: '제안을 듣는 고객', opening: '오늘 어떤 이야기를 들고 오셨는지 궁금하네요.', pressure: '좋은 말씀인데, 저희 상황에도 맞는지는 잘 모르겠어요.', hint: '우리 쪽 사정보다 고객이 얻는 것과 고객이 정할 일을 먼저 말하세요.',
        tone: { gentle: { opening: '천천히 들어 볼게요.', pressure: '저희 상황에 맞는지 조금 더 알고 싶어요.' }, tough: { opening: '비슷한 제안을 많이 받아서요. 다른 점부터 말씀해 주세요.', pressure: '솔직히 다른 곳 제안이랑 차이를 모르겠어요.' } } },
    },
    goals: {
      status: { label: '진행 상황 보고하기', goal: '현재 상태를 결론부터 알리고 필요한 결정을 받기', starter: '결론부터 말씀드리면, ○○는 지금 ○○ 상태입니다.', check: '첫 문장에 현재 상태가 있고, 근거와 필요한 결정을 함께 말했나요?', turns: PRESENTATION_STATUS },
      proposal: { label: '새 방안 제안하기', goal: '제안을 결론부터 말하고 근거와 예시로 설득하기', starter: '제안드리고 싶은 것은 ○○입니다. 이유는 두 가지예요.', check: '제안을 먼저 말하고, 근거·예시·다시 결론의 순서로 정리했나요?', turns: {
        opening: { title: '제안을 먼저 꺼내기', prompt: '오늘 제안하려는 게 정확히 뭐예요?', hint: '「○○를 ○○ 방식으로 바꾸자고 제안드립니다」처럼 무엇을 바꾸자는 건지 한 문장으로 먼저 말하세요.' },
        specific: { title: '근거를 예시로 보여 주기', prompt: '그 방법이 효과가 있다는 걸 어떻게 알 수 있어요?', hint: '직접 확인한 숫자·사례·비교 중 하나를 고르고, 예를 들어 어떤 장면에서 달라지는지 붙이세요.' },
        concise: { title: '제안을 두 문장으로', prompt: '핵심만 두 문장으로 정리해 주세요.', hint: '제안 한 문장, 가장 강한 근거 한 문장으로 줄여 보세요.' },
        pressure: { title: '반대 의견에 답하기', prompt: '지금 방식도 큰 문제는 없잖아요. 굳이 바꿔야 해요?', tones: { gentle: '지금 방식도 괜찮아 보이는데, 바꾸면 뭐가 좋아지는지 조금 더 듣고 싶어요.', tough: '바꿨다가 안 되면 누가 책임져요? 지금 방식으로도 충분해요.' }, hint: '지금 방식의 장점을 인정한 뒤, 바꾸지 않으면 생기는 손해와 작게 시험해 볼 방법을 말해 보세요.' },
        close: { title: '다시 결론과 다음 단계', prompt: '좋아요. 그럼 다음에 뭘 하면 될까요?', hint: '제안을 한 문장으로 다시 말하고, 시험해 볼 범위와 확인 날짜를 제안하세요.' },
      } },
    },
  },
  negotiation: {
    counterparts: {
      hr: { label: '처우를 정하는 인사 담당자', opening: '처우 이야기를 나눠 볼게요.', pressure: '다른 직원들과의 형평성도 봐야 해서요.', hint: '감정보다 기준과 근거로 말하세요. 금액이 막히면 시작일·직급·교육비처럼 다른 조건도 함께 보세요.',
        tone: { gentle: { opening: '편하게 원하시는 조건을 말씀해 주세요.', pressure: '다른 분들과 균형도 맞춰야 해서 고민이에요.' }, tough: { opening: '저희가 드릴 수 있는 범위는 정해져 있어요.', pressure: '이 조건이면 다른 지원자를 볼 수밖에 없어요.' } } },
      partner: { label: '계약을 정하는 거래처 담당자', opening: '이번 계약 조건을 정리해 보죠.', pressure: '다른 곳은 더 낮은 견적을 냈어요.', hint: '가격만 맞서지 말고 품질·일정·범위처럼 상대가 얻는 것과 함께 말하세요.',
        tone: { gentle: { opening: '서로 좋은 조건을 찾아봤으면 해요.', pressure: '예산이 조금 빠듯해서 고민이에요.' }, tough: { opening: '시간이 많지 않으니 숫자로 이야기하죠.', pressure: '다른 업체는 20% 싸게 해 준대요.' } } },
    },
    goals: {
      price: { label: '금액 협상하기', goal: '원하는 금액을 근거와 함께 말하고 받아들일 수 있는 선을 지키기', starter: '제가 희망하는 금액은 ○○입니다. 그 근거는…', check: '희망 금액, 근거, 내 기준선, 다음 단계를 구분해서 말했나요?', turns: NEGOTIATION_PRICE },
      terms: { label: '일정·범위 같은 조건 맞추기', goal: '금액 밖의 조건에서 지킬 것과 양보할 것을 나눠 합의하기', starter: '이번에 제가 꼭 지키고 싶은 조건은 ○○입니다.', check: '지킬 조건과 양보할 수 있는 조건을 나누고, 상대가 얻는 것을 말했나요?', turns: {
        opening: { title: '꼭 지킬 조건 먼저', prompt: '금액 말고 가장 중요하게 보시는 조건이 뭔가요?', hint: '일정·업무 범위·근무 방식 가운데 꼭 지킬 조건 하나를 먼저 말하고, 이유를 한 문장 붙이세요.' },
        specific: { title: '조건의 근거 세우기', prompt: '그 조건이 꼭 필요한 이유가 뭐예요?', hint: '들어가는 시간, 이전 경험, 결과물의 품질처럼 확인할 수 있는 근거를 말하세요.' },
        concise: { title: '조건을 한 번에 정리하기', prompt: '원하시는 조건을 한 번에 정리해 주시겠어요?', hint: '꼭 지킬 조건 하나, 양보할 수 있는 조건 하나를 나눠 말해 보세요.' },
        pressure: { title: '조건이 많다는 말에', prompt: '그 조건까지 맞춰 드리긴 어려워요.', tones: { gentle: '그 조건은 저희가 조금 고민이 되네요.', tough: '조건을 이렇게 많이 거시면 진행이 어려워요.' }, hint: '모든 조건을 지키려 하지 말고, 꼭 지킬 것 하나를 남기고 나머지는 바꿀 수 있는 대안을 제안하세요.' },
        close: { title: '합의 내용 확인하기', prompt: '좋아요. 그럼 어떻게 마무리할까요?', hint: '합의한 조건을 정리하고, 서면으로 확인할 시점과 방법을 제안하세요.' },
      } },
    },
  },
  apology: {
    counterparts: {
      colleague: { label: '함께 일하는 동료', opening: '네, 지금 잠깐 괜찮아요.', pressure: '이번이 처음도 아니잖아요.', hint: '상대가 겪은 불편을 구체적으로 말하고, 일에서 바로잡을 것을 정해 말하세요.',
        tone: { gentle: { opening: '네, 천천히 말해도 돼요.', pressure: '솔직히 조금 서운하긴 했어요.' }, tough: { opening: '지금 좀 화가 나 있어요. 짧게 말해 줘요.', pressure: '사과는 지난번에도 들었어요.' } } },
      family: { label: '가족이나 가까운 친구', opening: '응, 지금 괜찮아요.', pressure: '그때 내가 얼마나 속상했는지 알아요?', hint: '잘잘못을 따지기보다 상대의 마음을 먼저 인정하세요. 사정 설명은 상대가 물을 때 짧게만요.',
        tone: { gentle: { opening: '응, 천천히 말해요.', pressure: '사실 그때 좀 속상했어요.' }, tough: { opening: '이제 와서요?', pressure: '그때 나는 정말 혼자라고 느꼈어요.' } } },
    },
    goals: {
      mistake: { label: '실수 인정하고 바로잡기', goal: '내 실수를 인정하고 바로잡을 행동과 시점을 약속하기', starter: '○○를 놓친 건 제 실수예요. 죄송해요.', check: '실수를 내 말로 인정하고, 바로잡을 행동과 시점을 말했나요?', turns: APOLOGY_MISTAKE },
      hurt: { label: '마음을 상하게 한 일 사과하기', goal: '상대가 겪은 마음을 인정하고 책임 있게 사과하기', starter: '그때 내가 한 말 때문에 속상했을 것 같아요. 미안해요.', check: '상대가 겪은 마음을 말하고, 변명 없이 내 책임을 인정했나요?', turns: {
        opening: { title: '마음에 걸린 일 꺼내기', prompt: '어떤 이야기예요?', hint: '그 일이 계속 마음에 걸렸다고 말한 뒤, 무엇이 미안한지 구체적으로 말하세요.' },
        specific: { title: '무엇이 잘못이었는지', prompt: '정확히 뭐가 미안하다는 거예요?', hint: '「○○라고 말한 것」처럼 내가 한 행동을 짚고, 그게 상대에게 어떻게 닿았을지 말하세요.' },
        concise: { title: '한마디로 진심 전하기', prompt: '그래서 하고 싶은 말이 뭐예요?', hint: '「그때 ○○해서 미안해요. 앞으로는 ○○할게요.」처럼 사과와 달라질 행동을 한 번에 말해 보세요. 「~했다면」 같은 조건은 빼 보세요.' },
        pressure: { title: '쉽게 풀리지 않을 때', prompt: '미안하다고 하면 다 끝나는 거예요?', tones: { gentle: '사과해 줘서 고마운데, 아직은 마음이 좀 그래요.', tough: '말로만 미안하다고 하면 뭐가 달라져요?' }, hint: '마음이 바로 풀리지 않아도 괜찮다고 인정하고, 앞으로 달라질 행동 하나를 말하세요.' },
        close: { title: '기다려 주는 마무리', prompt: '조금 생각할 시간이 필요해요.', hint: '시간이 필요하다는 마음을 존중한다고 말하고, 재촉하지 않고 마무리하세요.' },
      } },
    },
  },
  feedback: {
    counterparts: {
      junior: { label: '함께 일하는 후배', opening: '네, 지금 괜찮아요.', pressure: '저는 나름대로 열심히 했는데요.', hint: '사람이 아니라 행동을 이야기하세요. 실제로 잘한 점이 있다면 함께 말해도 좋아요.',
        tone: { gentle: { opening: '네, 편하게 말씀하세요.', pressure: '아, 그렇게 보였을 수도 있겠네요.' }, tough: { opening: '혹시 제가 뭐 잘못했나요?', pressure: '다들 그렇게 하는데 왜 저한테만 그러세요?' } } },
      peer: { label: '같은 팀 동료', opening: '잠깐이면 괜찮아요.', pressure: '그건 제 방식인데, 꼭 바꿔야 해요?', hint: '동료는 내 지시를 받는 사람이 아니에요. 부탁과 제안의 말로, 함께 정하는 방식으로 말하세요.',
        tone: { gentle: { opening: '네, 들을게요.', pressure: '저는 그게 편해서 그랬는데요.' }, tough: { opening: '바쁜데 짧게 해 줄래요?', pressure: '제 일에 그렇게까지 말할 건 아니지 않아요?' } } },
    },
    goals: {
      improve: { label: '고쳤으면 하는 점 말하기', goal: '관찰한 행동과 영향을 말하고 다음에 바라는 행동을 함께 정하기', starter: '지난 ○○ 때 ○○하는 걸 봤어요. 그래서 ○○ 일이 생겼어요.', check: '본 사실·영향·바라는 행동을 말하고, 상대의 사정을 물었나요?', turns: FEEDBACK_IMPROVE },
      praise: { label: '잘한 점 구체적으로 칭찬하기', goal: '잘한 행동과 그 효과를 구체적으로 말해 계속하도록 돕기', starter: '어제 ○○한 거, 정말 도움이 됐어요.', check: '「잘했어요」 대신 무엇을 어떻게 했고 어떤 효과가 있었는지 말했나요?', turns: {
        opening: { title: '잘한 행동을 짚기', prompt: '어떤 일 때문에 부르셨어요?', hint: '「잘했어요」 대신 언제 무엇을 했는지 구체적으로 짚으세요.' },
        specific: { title: '그 효과를 말하기', prompt: '그게 그렇게 도움이 됐어요?', hint: '그 행동 덕분에 실제로 달라진 일이나 사람들의 반응을 말하세요.' },
        concise: { title: '계속 바라는 것 한 문장', prompt: '쑥스럽네요. 그럼 앞으로도 이렇게 하면 된다는 거죠?', hint: '「다음에도 ○○해 주면 좋겠어요」처럼 계속 해 줬으면 하는 행동을 분명히 말해 보세요.' },
        pressure: { title: '칭찬을 밀어낼 때', prompt: '에이, 별것 아니었어요. 다들 하는 건데요.', tones: { gentle: '그렇게 말해 주시니 감사해요. 근데 별건 아니었어요.', tough: '칭찬하시는 거 보니 뭔가 부탁하실 게 있는 거죠?' }, hint: '겸손을 받아 주되, 그 행동이 왜 특별했는지 본 사실로 한 번 더 말하고 어떻게 했는지 물어보세요.' },
        close: { title: '계속하도록 묻기', prompt: '감사해요. 다음에도 그렇게 해 볼게요.', hint: '계속 해 줬으면 하는 점을 말하고, 그렇게 하는 데 필요한 게 있는지 물어보세요.' },
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

export function createSession({ scenario, counterpart, goal, practice, intensity = 'normal', at = new Date().toISOString(), id = crypto.randomUUID() }) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new TypeError('연습할 상황을 골라 주세요.');
  if (!Object.hasOwn(INTENSITIES, intensity)) throw new TypeError('상대 반응 세기를 골라 주세요.');
  const entry = { id, at, scenario, counterpart: cleanText(counterpart, 80), goal: cleanText(goal, 240), focus: null, turns: [], firstSentence: '', takeaway: '', intensity, plan: null, realAt: null, outcome: null };
  if (!entry.counterpart || !entry.goal) throw new TypeError('상대와 오늘의 목표를 적어 주세요.');
  if (practice !== undefined) {
    if (!validPractice(scenario, practice)) throw new TypeError('상대 유형과 연습 목표를 골라 주세요.');
    entry.practice = { ...practice };
  }
  return entry;
}

// schema 1 기록에는 intensity가 없다. 그때 대사는 지금의 보통 강도와 같다.
export function sessionIntensity(session) {
  const value = session.intensity ?? 'normal';
  if (!Object.hasOwn(INTENSITIES, value)) throw new TypeError('상대 반응 세기를 골라 주세요.');
  return value;
}

export function getTurn(session, index = session.turns.length) {
  const key = index === 0 ? 'opening' : index === 1 ? session.focus || 'specific' : 'close';
  const intensity = sessionIntensity(session), base = practiceDetails(session).turns[key];
  const turn = { id: key, title: base.title, prompt: intensity !== 'normal' && base.tones?.[intensity] ? base.tones[intensity] : base.prompt, hint: base.hint };
  if (session.practice) {
    const counterpart = PRACTICES[session.scenario].counterparts[session.practice.counterpart];
    const voice = intensity === 'normal' ? counterpart : counterpart.tone[intensity];
    const lead = key === 'opening' ? voice.opening : key === 'pressure' ? voice.pressure : '';
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

function spoken(mode, seconds) {
  if (!Object.hasOwn(MODES, mode)) throw new TypeError('글로 답했는지 말로 답했는지 확인해 주세요.');
  if (seconds !== null && (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SPOKEN_SECONDS)) throw new TypeError(`말한 시간은 0~${MAX_SPOKEN_SECONDS}초의 정수로 남겨 주세요.`);
  if (seconds !== null && mode !== 'voice') throw new TypeError('말한 시간은 말로 답했을 때만 남겨요.');
  return { mode, seconds };
}

// 녹음 파일은 저장하지 않는다. 말로 답했는지와 말한 시간(초)만 남긴다.
export function appendTurn(session, { answer, review, focus = session.focus, mode = 'text', seconds = null }) {
  if (session.turns.length >= 3) throw new TypeError('세 번의 연습이 끝났어요.');
  if (!Object.hasOwn(REVIEWS, review)) throw new TypeError('내 느낌을 골라 주세요.');
  if (!Object.hasOwn(DIRECTIONS, focus)) throw new TypeError('다음 연습 방향을 골라 주세요.');
  if (session.turns.length > 0 && focus !== session.focus) throw new TypeError('시작한 연습의 방향은 중간에 바꿀 수 없어요. 새 연습에서 골라 주세요.');
  const text = cleanText(answer, 2000);
  if (!text) throw new TypeError('상대에게 하고 싶은 말을 적어 주세요.');
  const said = spoken(mode, seconds);
  const turn = getTurn(session);
  return { ...session, focus, turns: [...session.turns, { id: turn.id, answer: text, review, retry: '', retryReview: null, mode: said.mode, seconds: said.seconds, retryMode: null, retrySeconds: null }] };
}

export function retryTurn(session, index, answer, review, { mode = 'text', seconds = null } = {}) {
  if (!Number.isInteger(index) || !session.turns[index]) throw new TypeError('다시 연습할 대화를 찾지 못했어요.');
  if (!Object.hasOwn(REVIEWS, review)) throw new TypeError('다시 말한 뒤의 느낌을 골라 주세요.');
  const retry = cleanText(answer, 2000);
  if (!retry) throw new TypeError('다시 해 볼 말을 적어 주세요.');
  const said = spoken(mode, seconds);
  return { ...session, turns: session.turns.map((turn, i) => i === index ? { ...turn, retry, retryReview: review, retryMode: said.mode, retrySeconds: said.seconds } : turn) };
}

export function stuckTurn(session) {
  const stuck = session.turns.findIndex(turn => (turn.retryReview || turn.review) === 'stuck');
  return stuck >= 0 ? stuck : session.turns.findIndex(turn => (turn.retryReview || turn.review) === 'unsure');
}

// ── 실제 대화 계획과 돌아보기(schema 2) ─────────────────────────────
export function setPlan(session, plan) {
  if (plan === null || plan === undefined) return { ...session, plan: null };
  if (!keys(plan, ['ifThey', 'iWill'])) throw new TypeError('「만약 상대가 ~하면 나는 ~」 계획을 확인해 주세요.');
  const ifThey = cleanText(plan.ifThey ?? '', 200), iWill = cleanText(plan.iWill ?? '', 200);
  return { ...session, plan: ifThey || iWill ? { ifThey, iWill } : null };
}

export function setRealDate(session, date) {
  if (date === null || date === undefined || date === '') return { ...session, realAt: null };
  if (!calendarDate(date)) throw new TypeError('실제 대화 날짜를 YYYY-MM-DD 형식으로 골라 주세요.');
  return { ...session, realAt: date };
}

export function recordOutcome(session, { did, usedFirst = null, reaction = null, note = '', at = new Date().toISOString() } = {}) {
  if (session.turns.length !== 3) throw new TypeError('연습을 끝낸 뒤에 돌아보기를 남길 수 있어요.');
  if (!Object.hasOwn(OUTCOMES.did, did)) throw new TypeError('실제로 대화했는지 골라 주세요.');
  if (usedFirst !== null && typeof usedFirst !== 'boolean') throw new TypeError('준비한 첫 문장을 썼는지 골라 주세요.');
  if (reaction !== null && !Object.hasOwn(OUTCOMES.reaction, reaction)) throw new TypeError('상대 반응을 골라 주세요.');
  if (did !== 'yes' && (usedFirst !== null || reaction !== null)) throw new TypeError('첫 문장과 상대 반응은 실제로 대화했을 때만 남겨요.');
  if (!bounded(at, 40, false) || !Number.isFinite(Date.parse(at))) throw new TypeError('돌아본 시각을 확인해 주세요.');
  return { ...session, outcome: { did, usedFirst, reaction, note: cleanText(note, 600), at } };
}

const seoulDay = iso => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);

// 예정일이 지났는데(오늘 날짜보다 앞) 돌아보기가 없는 완료 세션, 오래된 예정일부터.
// 「나중으로 미뤘어요」를 남긴 뒤 새 예정일을 잡았다면 그 날짜가 지났을 때 다시 묻는다.
export function pendingFollowups(sessions, today) {
  if (!calendarDate(today)) throw new TypeError('오늘 날짜를 YYYY-MM-DD 형식으로 넘겨 주세요.');
  return sessions
    .filter(s => s.turns?.length === 3 && s.realAt && s.realAt < today && (!s.outcome || (s.outcome.did === 'later' && seoulDay(s.outcome.at) < s.realAt)))
    .sort((a, b) => a.realAt.localeCompare(b.realAt) || Date.parse(a.at) - Date.parse(b.at));
}

const STEP_UP = { gentle: 'normal', normal: 'tough', tough: 'tough' };

// 같은 상황의 지난 기록에서 다시 해 볼 곳(stuckTurn 확장).
// 1) 실제 대화를 돌아보며 첫 문장을 못 썼거나 어려웠다고 남긴 기록 2) 직접 고른 막힘·망설임
// 3) analyze(analyzeAnswer)를 넘기면 다시 쓰지 않은 답에서 그 턴에 필요한 요소가 빠진 곳. 다시 써서 편해졌다고 고른 턴은 추천하지 않는다.
// 이 파일은 coach.mjs를 import하지 않으므로(계정 검증 번들) 분석기는 화면이 넘긴다.
export function continueFrom(sessions, scenario, { analyze } = {}) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new TypeError('연습할 상황을 골라 주세요.');
  const own = sessions.filter(s => s.scenario === scenario && s.turns?.length === 3).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const result = (session, index, reason, extra = {}) => {
    const turn = session.turns[index], shown = getTurn(session, index), intensity = sessionIntensity(session);
    return { sessionId: session.id, index, turnId: turn.id, title: shown.title, prompt: shown.prompt, answer: turn.retry || turn.answer, reason, missing: [], practice: session.practice ? { ...session.practice } : null, focus: session.focus, intensity, ...extra };
  };
  for (const session of own) {
    const outcome = session.outcome;
    if (outcome?.did === 'yes' && (outcome.reaction === 'hard' || outcome.usedFirst === false)) {
      return outcome.reaction === 'hard'
        ? result(session, 1, 'outcome', { focus: 'pressure', intensity: STEP_UP[sessionIntensity(session)] })
        : result(session, 0, 'outcome');
    }
    const index = stuckTurn(session);
    if (index >= 0) return result(session, index, (session.turns[index].retryReview || session.turns[index].review));
  }
  if (typeof analyze === 'function') {
    for (const session of own) for (const [index, turn] of session.turns.entries()) {
      if (turn.retry) continue;
      const missing = analyze({ scenario, text: turn.answer, turnId: turn.id }).missing;
      if (missing.length) return result(session, index, 'missing', { missing: missing.map(({ id, label }) => ({ id, label })) });
    }
  }
  return null;
}

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const safeCharacters = value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value);
const bounded = (value, max, allowEmpty = true) => typeof value === 'string' && value.length <= max && safeCharacters(value) && (allowEmpty || value.trim().length > 0);
const isoTime = value => bounded(value, 40, false) && Number.isFinite(Date.parse(value));
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
const byteLength = text => new TextEncoder().encode(text).length;

const SESSION_KEYS = { 1: ['id', 'at', 'scenario', 'counterpart', 'goal', 'practice', 'focus', 'turns', 'firstSentence', 'takeaway'] };
SESSION_KEYS[2] = [...SESSION_KEYS[1], 'intensity', 'plan', 'realAt', 'outcome'];
const TURN_KEYS = { 1: ['id', 'answer', 'review', 'retry', 'retryReview'] };
TURN_KEYS[2] = [...TURN_KEYS[1], 'mode', 'seconds', 'retryMode', 'retrySeconds'];
const has = (value, key) => Object.hasOwn(value, key);
const secondsValue = value => value === null || (Number.isInteger(value) && value >= 0 && value <= MAX_SPOKEN_SECONDS);

// schema 2 칸은 모두 있으면 검사하고 없으면 schema 1처럼 읽는다(이전 기록을 고치지 않고 함께 보관).
function validSchema2Session(s) {
  if (has(s, 'intensity') && !Object.hasOwn(INTENSITIES, s.intensity)) return false;
  if (has(s, 'plan') && s.plan !== null && (!keys(s.plan, ['ifThey', 'iWill']) || Object.keys(s.plan).length !== 2 || !bounded(s.plan.ifThey, 200) || !bounded(s.plan.iWill, 200) || !(s.plan.ifThey.trim() || s.plan.iWill.trim()))) return false;
  if (has(s, 'realAt') && s.realAt !== null && !calendarDate(s.realAt)) return false;
  if (has(s, 'outcome') && s.outcome !== null) {
    const o = s.outcome;
    if (!keys(o, ['did', 'usedFirst', 'reaction', 'note', 'at']) || Object.keys(o).length !== 5 || !Object.hasOwn(OUTCOMES.did, o.did) || !(o.usedFirst === null || typeof o.usedFirst === 'boolean') || !(o.reaction === null || Object.hasOwn(OUTCOMES.reaction, o.reaction)) || (o.did !== 'yes' && (o.usedFirst !== null || o.reaction !== null)) || !bounded(o.note, 600) || !isoTime(o.at)) return false;
  }
  return true;
}
function validSchema2Turn(turn) {
  if (has(turn, 'mode') && !Object.hasOwn(MODES, turn.mode)) return false;
  if (has(turn, 'seconds') && (!secondsValue(turn.seconds) || (turn.seconds !== null && turn.mode !== 'voice'))) return false;
  // 다시 쓴 말의 입력 방식을 모르면 null로 둔다(retryTurn은 늘 채운다). 다시 쓴 말이 없으면 반드시 null.
  if (has(turn, 'retryMode') && (turn.retry ? !(turn.retryMode === null || Object.hasOwn(MODES, turn.retryMode)) : turn.retryMode !== null)) return false;
  if (has(turn, 'retrySeconds') && (!secondsValue(turn.retrySeconds) || (turn.retrySeconds !== null && turn.retryMode !== 'voice'))) return false;
  return true;
}

export function validateArchive(value) {
  const invalid = () => { throw new TypeError('리허설 기록 형식이 올바르지 않아요. 이 앱에서 내보낸 JSON 파일을 선택해 주세요.'); };
  if (!keys(value, ['schema', 'savedAt', 'sessions']) || !SCHEMAS.includes(value.schema) || !bounded(value.savedAt, 40, false) || !Number.isFinite(Date.parse(value.savedAt)) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS) invalid();
  const ids = new Set(), sessionKeys = SESSION_KEYS[value.schema], turnKeys = TURN_KEYS[value.schema];
  for (const s of value.sessions) {
    if (!keys(s, sessionKeys) || !bounded(s.id, 80, false) || ids.has(s.id) || !bounded(s.at, 40, false) || !Number.isFinite(Date.parse(s.at)) || !Object.hasOwn(SCENARIOS, s.scenario) || !Object.hasOwn(DIRECTIONS, s.focus) || !bounded(s.counterpart, 80, false) || !bounded(s.goal, 240, false) || !bounded(s.firstSentence, 600) || !bounded(s.takeaway, 600) || !Array.isArray(s.turns) || s.turns.length !== 3 || (Object.hasOwn(s, 'practice') && !validPractice(s.scenario, s.practice)) || !validSchema2Session(s)) invalid();
    ids.add(s.id);
    for (const [index, turn] of s.turns.entries()) {
      const expected = index === 0 ? 'opening' : index === 1 ? s.focus : 'close';
      if (!keys(turn, turnKeys) || turn.id !== expected || !bounded(turn.answer, 2000, false) || !Object.hasOwn(REVIEWS, turn.review) || !bounded(turn.retry, 2000) || (turn.retry ? !Object.hasOwn(REVIEWS, turn.retryReview) : turn.retryReview !== null) || !validSchema2Turn(turn)) invalid();
    }
  }
  const text = JSON.stringify(value);
  if (byteLength(text) > MAX_IMPORT_BYTES) invalid();
  return JSON.parse(text);
}

// 앞쪽(최근) 기록부터 횟수 한도와 내보내기 크기(들여쓰기 2칸 JSON, savedAt 최대 길이 가정) 안에 드는 만큼 남긴다.
// 화면은 기록 목록을 바꿀 때 이 결과로 맞춰 두면 저장본과 화면 목록이 어긋나지 않는다.
export function keepSessions(sessions) {
  const list = sessions.slice(0, MAX_SESSIONS);
  const fits = count => byteLength(JSON.stringify({ schema: SCHEMA, savedAt: '0'.repeat(40), sessions: list.slice(0, count) }, null, 2)) <= MAX_IMPORT_BYTES;
  if (fits(list.length)) return list;
  let low = 0, high = list.length;
  while (low + 1 < high) { const middle = (low + high) >> 1; if (fits(middle)) low = middle; else high = middle; }
  return list.slice(0, low);
}

export function archive(sessions, at = new Date().toISOString()) {
  return validateArchive({ schema: SCHEMA, savedAt: at, sessions: keepSessions(sessions) });
}

export function parseArchive(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new TypeError('파일은 500KB 이하로 선택해 주세요.');
  try { return validateArchive(JSON.parse(text)); } catch (error) {
    if (error instanceof SyntaxError) throw new TypeError('JSON 파일을 읽지 못했어요. 리허설에서 내보낸 파일인지 확인해 주세요.');
    throw error;
  }
}
