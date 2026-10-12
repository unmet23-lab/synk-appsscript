export const INTERVIEWERS = Object.freeze([
  Object.freeze({id:'lead',name:'김지현',role:'채용 담당자',seat:0}),
  Object.freeze({id:'specialist',name:'이서윤',role:'돌봄 실무 담당자',seat:1}),
  Object.freeze({id:'observer',name:'박민준',role:'교육 담당자',seat:2})
]);

export const INTERVIEW_INFO = Object.freeze({
  id:'care-interview-v1',
  title:'요양기관 지원 면접',
  targetSeconds:Object.freeze([60,90]),
  answerLimitMs:25000,
  setting:'가상의 요양기관에서 세 명의 면접관과 앉아서 연습합니다.',
  branchingNotice:'이번 체험은 답변의 일부 한국어 표현으로 준비된 후속 질문을 고릅니다. 자유 대화 AI나 취업 평가가 아닙니다.',
  privacyNotice:'답변은 이 연습 화면의 메모리에만 남습니다. 계정이나 기기에 자동 저장하지 않습니다.',
  timingNotice:'두 번의 답변을 포함해 약 60~90초입니다. 다시 듣거나 더 생각하면 시간이 늘어날 수 있습니다.'
});

const prompt=(id,speakerId,text)=>Object.freeze({id,speakerId,text});

export const PROMPTS = Object.freeze({
  intro:prompt('intro','lead','안녕하세요. 편하게 앉으세요. 저희 세 명과 짧게 면접을 진행하겠습니다.'),
  question:prompt('question-motivation','lead','요양보호사로 일하고 싶은 이유를 말씀해 주세요. 계기나 관심 있는 돌봄 활동을 하나 이야기해 주세요.'),
  closing:prompt('closing','lead','말씀 감사합니다. 오늘 면접 연습은 여기까지입니다. 다음에는 방금 답변에 구체적인 행동 한 가지를 더해 보세요.')
});

export const FOLLOWUPS = Object.freeze({
  experience:prompt('followup-experience','specialist','말씀하신 경험에서 직접 하신 일은 무엇인가요? 기억나는 상황 한 가지와 본인의 역할을 말씀해 주세요.'),
  preparation:prompt('followup-preparation','observer','처음 일하기 전에 어떤 준비를 하고 싶으신가요? 배우거나 확인할 것을 한 가지 말씀해 주세요.'),
  motivation:prompt('followup-motivation','specialist','그 이유가 실제 일과 어떻게 연결될까요? 어르신을 도울 때 본인이 하고 싶은 행동을 하나 말씀해 주세요.'),
  unclear:prompt('followup-clarify','observer','지원하신 계기를 조금 더 듣고 싶습니다. 관심을 갖게 된 일이나 해 보고 싶은 돌봄 활동을 하나 말씀해 주세요.'),
  'off-topic':prompt('followup-return','observer','지원하신 이유로 돌아가 보겠습니다. 요양보호사 일에 관심을 갖게 된 계기를 하나 말씀해 주세요.')
});

export const REPAIRS = Object.freeze({
  empty:prompt('repair-empty','lead','아직 답변을 듣지 못했습니다. 천천히 생각하시고 준비되면 말씀해 주세요.'),
  uncertain:prompt('repair-uncertain','lead','잠깐 생각하셔도 괜찮습니다. 작은 계기나 관심 있는 활동부터 말씀해 주세요.'),
  recognition:prompt('repair-recognition','lead','음성을 또렷하게 확인하지 못했습니다. 다시 말씀하시거나 화면에서 직접 입력해 주세요.'),
  repeat:prompt('repair-repeat','lead','질문을 다시 들려드리겠습니다.'),
  timeout:prompt('repair-timeout','lead','생각할 시간이 더 필요하시면 계속 말씀해 주세요. 질문을 다시 들어도 괜찮습니다.'),
  length:prompt('repair-length','lead','이번에는 한 가지 계기나 상황을 짧게 말씀해 주세요.')
});

export const NEXT_PRACTICE = Object.freeze({
  experience:'직접 한 일 한 가지를 골라, 상황 → 본인의 행동 → 확인한 결과 순서로 다시 말해 보세요.',
  preparation:'입사 전에 배울 것 한 가지와 누구에게 어떻게 확인할지를 연결해 다시 말해 보세요.',
  motivation:'지원 계기 한 가지에 실제로 해 보고 싶은 돌봄 행동을 연결해 다시 말해 보세요.',
  unclear:'요양보호사 일에 관심을 갖게 된 계기를 한 문장으로 정리한 뒤 다시 말해 보세요.',
  'off-topic':'요양보호사에 지원한 이유 한 가지를 먼저 말하고, 그 이유와 연결되는 예를 덧붙여 보세요.'
});
