import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, TURN_IDS } from '../domain.mjs';
import { ELEMENTS, COUNTER_LINES, TIPS, INTENSITY_IDS, FILLER_WORDS, analyzeAnswer, speakingStats, counterLine, nextTip, habits, splitSentences } from '../coach.mjs';

const ids = list => list.map(item => item.id);
const found = (scenario, text, turnId) => ids(analyzeAnswer({ scenario, text, turnId }).found);
const count = (list, word) => list.find(item => item.word === word)?.count ?? 0;
const AI_NAMES = /GPT|ChatGPT|Claude|Gemini|OpenAI|Anthropic|클로드|제미나이|챗GPT/i;

test('every scenario has a complete element list with why, example, expected turns and distinct priority', () => {
  assert.deepEqual(Object.keys(ELEMENTS).sort(), Object.keys(SCENARIOS).sort());
  for (const [scenario, elements] of Object.entries(ELEMENTS)) {
    assert.ok(elements.length >= 4, scenario);
    assert.equal(new Set(ids(elements)).size, elements.length);
    assert.equal(new Set(elements.map(e => e.priority)).size, elements.length);
    for (const element of elements) {
      assert.ok(element.label && element.why.endsWith('요.') && element.example && element.patterns.length, `${scenario}.${element.id}`);
      assert.ok(element.turns.length && element.turns.every(turn => TURN_IDS.includes(turn)), `${scenario}.${element.id}`);
      assert.ok(element.patterns.every(pattern => pattern instanceof RegExp && !pattern.global), `${scenario}.${element.id}`);
      for (const text of [element.label, element.why, element.example]) assert.doesNotMatch(text, AI_NAMES);
    }
  }
});

test('each example finds its own element and carries no filler or hedge habits', () => {
  for (const [scenario, elements] of Object.entries(ELEMENTS)) for (const element of elements) {
    const analysis = analyzeAnswer({ scenario, text: element.example, turnId: element.turns.at(-1) });
    assert.ok(ids(analysis.found).includes(element.id), `${scenario}.${element.id}: ${element.example}`);
    assert.deepEqual(analysis.fillers, [], `${scenario}.${element.id} fillers`);
    assert.deepEqual(analysis.hedges, [], `${scenario}.${element.id} hedges`);
  }
});

// 요소마다 잡혀야 하는 예문(미탐 방지)과 잡히면 안 되는 예문(오탐 방지).
const CASES = {
  interview: {
    situation: [['작년 겨울 인턴을 할 때였어요.', '2023년 학교 축제 준비를 맡았던 당시 이야기예요.', '카페에서 일하던 중에 생긴 일이에요.', '입사 초에 고객센터로 문의가 몰렸어요.'], ['저는 꼼꼼한 사람입니다.', '이 일을 정말 잘하고 싶어요.', '제 강점은 끈기예요.']],
    action: [['제가 문의를 유형별로 나누는 표를 만들었어요.', '일정 관리를 담당했습니다.', '저는 매일 아침 고객에게 직접 전화했어요.', '팀원들과 역할을 나눴고 회의록을 정리했어요.'], ['저희 팀이 다 했어요.', '저는 그때 많이 긴장했어요.', '회사가 크게 성장했어요.', '제가 이 역할에 지원했어요.']],
    result: [['그 결과 재방문 고객이 늘었어요.', '결국 마감 전에 출시했어요.', '덕분에 같은 문의가 줄었습니다.', '팀장님께 칭찬을 받았어요.'], ['그래서 제가 정리하기 시작했어요.', '열심히 노력했어요.', '질문을 받았어요.']],
    evidence: [['답변 시간이 3시간에서 1시간으로 줄었어요.', '문의가 절반으로 줄었어요.', '참여자가 두 배가 됐어요.', '불만 전화가 눈에 띄게 줄었어요.'], ['좋은 경험이었어요.', '많이 배웠습니다.', '정말 열심히 했어요.']],
    role: [['이 팀에서도 그 경험을 쓰고 싶어요.', '입사하면 고객 응대 흐름부터 정리하겠습니다.', '지원한 직무에서 그 경험이 도움이 될 거라고 생각해요.', '비슷한 상황에서도 같은 방법을 적용할 수 있어요.'], ['그 팀에서 많이 배웠어요.', '당시 동료들에게 도움이 됐어요.', '저희 팀은 다섯 명이었어요.']],
  },
  request: {
    ask: [['이 표 좀 같이 봐 주실 수 있을까요?', '자료 정리를 부탁드려도 될까요?', '마감을 하루만 미뤄 주실 수 있을까요?', '검토를 도와주세요.', '일정 조정을 상의드리고 싶어요.'], ['요즘 일이 많아서 정신이 없어요.', '어제 회의 잘 끝났어요.', '이 부분이 좀 어려웠어요.']],
    reason: [['처음 맡은 양식이라서요.', '다음 주에 발표가 있거든요.', '혼자서는 시간이 부족해서요.', '제가 이 프로그램을 몰라서 여쭤봐요.'], ['그래서 부탁드려요.', '내일까지 봐 주실 수 있을까요?', '그러니까 이 부분이요.']],
    deadline: [['목요일 오후 3시까지 필요해요.', '이번 주 안에만 되면 괜찮아요.', '마감이 내일이라서요.', '언제까지 가능하실지 여쭤봐도 될까요?'], ['이 자료를 봐 주실 수 있을까요?', '처음 하는 일이라 어려워요.', '여기까지만 도와주시면 돼요.']],
    ease: [['30분 정도면 충분해요.', '어려우시면 편하게 말해 주세요.', '초안은 제가 먼저 만들어 둘게요.', '이 부분만 봐 주셔도 큰 도움이 돼요.'], ['꼭 오늘 해 주셔야 해요.', '전부 다 부탁드려요.', '이건 중요한 일이에요.']],
    confirm: [['이렇게 부탁드려도 괜찮을까요?', '이 정도 일정이면 어떠세요?', '제가 이해한 게 맞나요?'], ['이 표를 봐 주실 수 있을까요?', '내일까지 필요해요.', '부탁드립니다.']],
  },
  refusal: {
    acknowledge: [['저를 믿고 부탁해 줘서 고마워요.', '급한 상황인 건 이해해요.', '많이 기대하고 있는 거 알아요.', '마음은 정말 고마워요.'], ['이번 일은 맡기 어려워요.', '다음 주는 일정이 꽉 찼어요.', '그 시간에는 다른 일이 있어요.']],
    decline: [['이번 일은 제가 맡기 어려워요.', '그날은 참석하기 어렵습니다.', '이번에는 못 해요.', '그 시간은 안 돼요.', '어려울 것 같아요.'], ['어렵지 않아요, 해 볼게요.', '할 수 있어요.', '어려운 부탁이지만 해 볼게요.', '안 될 건 없죠.']],
    reason: [['이번 주는 마감이 두 개 겹쳐 있어서요.', '선약이 있어요.', '요즘 컨디션이 안 좋아서요.'], ['미안해요.', '고마워요.', '그래서 이번엔 어려워요.']],
    alternative: [['다음 주 화요일 이후라면 한 시간은 볼 수 있어요.', '대신 잘하는 분을 소개해 줄게요.'], ['이번 일은 맡기 어려워요.', '미안해요.']],
    close: [['말해 줘서 고마워요.', '다음에 또 같이 해요.', '잘 되길 응원할게요.'], ['이번 일은 맡기 어려워요.', '일정이 겹쳐서요.']],
  },
  presentation: {
    conclusion: [['결론부터 말씀드리면 출시를 1주 미루겠습니다.', '이번 달 매출은 목표의 92%입니다.', '추가 인력이 한 명 필요합니다.', '안녕하세요, 기획팀 김유호입니다. 핵심은 일정이 1주 늦어진다는 겁니다.'], ['배경부터 설명드릴게요. 결론은 출시 연기입니다.', '요즘 고객 반응을 보면 재미있는 점이 있어요.']],
    evidence: [['테스트에서 오류가 12건 남아 있기 때문입니다.', '설문 결과를 보면 만족도가 낮았어요.', '지난 분기 대비 문의가 30% 늘었어요.'], ['출시를 미루는 게 좋겠습니다.', '모두 열심히 하고 있어요.']],
    example: [['예를 들어 어제 한 고객은 결제 화면에서 멈췄어요.', '실제로 현장에서 그런 일이 있었어요.', '지난주에 한 분이 같은 문제를 말씀하셨어요.'], ['결론은 출시 연기입니다.', '오류가 12건 남았습니다.']],
    restate: [['정리하면 출시를 1주 미루겠습니다.', '그래서 승인을 부탁드립니다.', '결론적으로 오류부터 잡는 게 좋겠습니다.'], ['오류가 12건 남았습니다.', '예를 들어 어제 한 고객은 멈췄어요.']],
  },
  negotiation: {
    ask: [['연봉은 4,800만 원을 희망합니다.', '단가를 10% 올려 주셨으면 해요.', '시작일을 다음 달로 조정해 주실 수 있을까요?', '금액은 5천 정도로 생각하고 있어요.'], ['저는 이 일이 정말 좋아요.', '회사 분위기가 좋다고 들었어요.']],
    basis: [['비슷한 경력의 시장 수준을 기준으로 했어요.', '지난해 매출을 20% 늘렸어요.', '이 작업에 두 사람이 3개월 동안 들어가요.', '경력이 5년이에요.'], ['그 정도면 좋겠어요.', '희망합니다.']],
    floor: [['4,500만 원 아래로는 받아들이기 어렵습니다.', '최소한 지금 수준은 유지되어야 해요.', '금액이 어렵다면 시작일을 조정해 주셨으면 해요.', '다른 회사 제안도 받아 둔 상태예요.'], ['연봉은 4,800만 원을 희망합니다.', '열심히 하겠습니다.']],
    benefit: [['입사하면 바로 결제 개선을 맡을 수 있습니다.', '그 대신 제가 운영 매뉴얼까지 만들겠습니다.', '장기적으로 비용을 줄일 수 있어요.'], ['저는 4,800만 원을 원해요.', '제 경력은 5년이에요.']],
    next: [['검토 결과는 금요일까지 메일로 받을 수 있을까요?', '다음 주에 다시 이야기 나눠요.', '정리해서 서면으로 보내 드릴게요.'], ['연봉은 4,800만 원을 희망합니다.', '그 금액은 어렵습니다.']],
  },
  apology: {
    admit: [['회의 자료를 늦게 보낸 건 제 잘못이에요.', '정말 죄송합니다.', '약속을 깜빡했어요. 미안해요.'], ['죄송하지만 이번엔 어려워요.', '그때 길이 너무 막혔어요.', '다음부터 조심할게요.']],
    impact: [['그 때문에 곤란하셨을 거예요.', '많이 기다리셨죠.', '제 말 때문에 마음이 상했을 것 같아요.'], ['제 잘못이에요.', '앞으로는 조심할게요.']],
    responsibility: [['제가 일정 확인을 미룬 탓이에요.', '변명하지 않을게요.', '제가 미리 확인했어야 했어요.', '제 책임이에요.'], ['차가 너무 막혀서 늦었어요.', '다들 바빠서 그랬어요.']],
    repair: [['오늘 오후 5시까지 고친 자료를 다시 보내 드릴게요.', '지금 바로 수정할게요.', '어떻게 하면 마음이 풀릴지 듣고 싶어요.'], ['정말 죄송해요.', '그때는 제가 바빴어요.']],
    prevent: [['앞으로는 마감 하루 전에 알림을 맞춰 두겠습니다.', '다시는 그런 말 하지 않을게요.', '같은 실수가 없게 체크리스트를 만들게요.'], ['정말 죄송해요.', '오늘 안에 다시 보내 드릴게요.']],
  },
  feedback: {
    observation: [['지난주 보고서에서 숫자 두 곳이 서로 달랐어요.', '어제 회의에서 고객 질문에 답이 늦었어요.', '이번 주에 지각이 세 번 있었어요.'], ['넌 늘 대충 해.', '태도가 별로예요.', '좀 더 잘해 주면 좋겠어요.']],
    impact: [['그래서 회의가 30분 늦어졌어요.', '그 바람에 팀원들이 다시 확인해야 했어요.', '덕분에 고객 문의가 줄었어요.'], ['지난주 보고서를 봤어요.', '다음부터 신경 써 줄래요?']],
    request: [['다음부터는 보내기 전에 숫자를 한 번 더 맞춰 봐 줄래요?', '회의 전에 자료를 공유해 주면 좋겠어요.', '앞으로도 이렇게 계속 해 주세요.'], ['지난주 보고서에서 숫자가 달랐어요.', '그래서 회의가 늦어졌어요.']],
    askView: [['그때 어떤 상황이었는지 들어 보고 싶어요.', '어떻게 생각해요?', '혹시 제가 모르는 사정이 있었어요?', '어떻게 그렇게 정리할 생각을 했어요?'], ['다음부터는 맞춰 봐 줄래요?', '보고서에서 숫자가 달랐어요.']],
  },
};

test('element patterns catch generous Korean inflections and reject look-alike sentences', () => {
  let checked = 0;
  for (const [scenario, elements] of Object.entries(CASES)) for (const [id, [yes, no]] of Object.entries(elements)) {
    // 끝맺음 요소(마지막 문장에서만 찾음)는 한 문장 예문이라 마무리 턴으로 본다.
    const zone = ELEMENTS[scenario].find(element => element.id === id).zone === 'end' ? 'close' : undefined;
    for (const text of yes) { assert.ok(found(scenario, text, zone).includes(id), `${scenario}.${id} 미탐: ${text}`); checked++; }
    for (const text of no) { assert.ok(!found(scenario, text, zone).includes(id), `${scenario}.${id} 오탐: ${text}`); checked++; }
  }
  for (const [scenario, elements] of Object.entries(ELEMENTS)) for (const element of elements) assert.ok(CASES[scenario][element.id], `${scenario}.${element.id} 예문 없음`);
  assert.ok(checked >= 200, String(checked));
});

test('a well-built answer per scenario finds every required element with a quoted evidence fragment', () => {
  const answers = {
    interview: '작년 인턴 때 고객 문의가 한꺼번에 몰렸어요. 제가 문의를 유형별로 나누는 표를 만들었어요. 그 결과 답변 시간이 3시간에서 1시간으로 줄었어요. 이 팀에서도 그 경험을 쓰고 싶어요.',
    request: '이번 보고서 표 부분을 같이 봐 주실 수 있을까요? 처음 맡은 양식이라서요. 목요일 오후 3시까지면 돼요. 30분이면 충분하고 어려우면 편하게 말해 주세요. 이렇게 부탁드려도 괜찮을까요?',
    refusal: '부탁해 줘서 고마워요. 이번 주는 마감이 두 개 겹쳐 있어서요. 이번 일은 제가 맡기 어려워요. 다음에 또 이야기해요.',
    presentation: '결론부터 말씀드리면 출시를 1주 미루는 게 좋겠습니다. 테스트에서 결제 오류가 12건 남아 있기 때문입니다. 예를 들어 어제 한 고객은 결제 화면에서 세 번 멈췄어요. 정리하면 1주 미루고 오류부터 잡겠습니다.',
    negotiation: '연봉은 4,800만 원을 희망합니다. 비슷한 경력의 시장 수준을 기준으로 했어요. 4,500만 원 아래로는 받아들이기 어렵습니다. 입사하면 바로 결제 개선을 맡을 수 있습니다. 검토 결과는 금요일까지 메일로 받을 수 있을까요?',
    apology: '회의 자료를 늦게 보낸 건 제 잘못이에요. 그 때문에 준비할 시간이 줄어 곤란하셨을 거예요. 제가 일정 확인을 미룬 탓이에요. 오늘 오후 5시까지 다시 보내 드릴게요. 앞으로는 마감 하루 전에 알림을 맞춰 두겠습니다.',
    feedback: '지난주 보고서에서 표의 숫자 두 곳이 서로 달랐어요. 그 바람에 회의가 30분 늦어졌어요. 다음부터는 보내기 전에 한 번 더 맞춰 봐 줄래요? 그때 어떤 상황이었는지 들어 보고 싶어요.',
  };
  for (const [scenario, text] of Object.entries(answers)) {
    const analysis = analyzeAnswer({ scenario, text });
    assert.deepEqual(analysis.missing, [], scenario);
    for (const element of ELEMENTS[scenario].filter(e => !e.optional)) {
      const hit = analysis.found.find(item => item.id === element.id);
      assert.ok(hit, `${scenario}.${element.id}`);
      assert.ok(text.includes(hit.evidence.replace(/^…|…$/gu, '')), `${scenario}.${element.id} 근거 문장`);
    }
  }
});

test('missing is scoped to what this turn asks, ordered by importance, and optional elements are never demanded', () => {
  const weak = analyzeAnswer({ scenario: 'request', text: '그 좀 도와주세요.', turnId: 'specific' });
  assert.deepEqual(ids(weak.missing), ['deadline']);
  assert.ok(weak.missing[0].why && weak.missing[0].example);
  const whole = analyzeAnswer({ scenario: 'request', text: '좀 도와주세요.' });
  assert.deepEqual(ids(whole.missing), ['deadline', 'reason', 'ease', 'confirm']);
  const refusal = analyzeAnswer({ scenario: 'refusal', text: '마음은 고맙지만 이번엔 어려워요. 일정이 겹쳐서요. 다음에 또 봐요.' });
  assert.ok(!ids(refusal.missing).includes('alternative'));
  // 한 문장짜리 거절은 「관계 마무리」를 따로 하지 않은 것으로 본다(마음 받기와 겹쳐 세지 않음).
  assert.deepEqual(found('refusal', '마음은 고맙지만 이번엔 어려워요.'), ['acknowledge', 'decline']);
  assert.ok(found('refusal', '이번엔 어려워요. 그래도 말해 줘서 고마워요.').includes('close'));
  // 인사로 시작해도 결론 먼저는 그다음 문장에서 본다. 배경부터 말하면 결론 먼저가 아니다.
  assert.ok(found('presentation', '안녕하세요. 기획팀 김유호입니다. 결론부터 말씀드리면 출시를 미루겠습니다.').includes('conclusion'));
  assert.ok(!found('presentation', '지난달부터 여러 일이 있었어요. 결론은 출시 연기입니다.').includes('conclusion'));
  assert.ok(!found('presentation', '오류가 많아요. 그래서 출시를 미루겠습니다.', 'opening').includes('conclusion'));
});

test('analysis has no score or grade, validates its inputs, and handles empty or unpunctuated speech', () => {
  const analysis = analyzeAnswer({ scenario: 'interview', text: '', turnId: 'opening' });
  assert.deepEqual(Object.keys(analysis).sort(), ['absolutes', 'fillers', 'found', 'hedges', 'missing', 'repeats', 'scenario', 'sentences', 'syllables', 'turnId'].sort());
  assert.equal(analysis.sentences, 0); assert.equal(analysis.syllables, 0); assert.deepEqual(ids(analysis.missing), ['action', 'situation']);
  assert.ok(!/score|grade|level|percent|점수|등급/i.test(JSON.stringify(analyzeAnswer({ scenario: 'feedback', text: '지난주 회의에서 봤어요.' }))));
  assert.throws(() => analyzeAnswer({ scenario: 'unknown', text: '안녕하세요' }));
  assert.throws(() => analyzeAnswer({ scenario: 'interview', text: '안녕하세요', turnId: 'middle' }));
  // 받아쓰기 글(마침표 없음)도 끝말에서 문장을 나눈다. 「필요 없어요」「예전보다」「모두 다」는 나누지 않는다.
  assert.deepEqual(splitSentences('제가 했어요 그리고 필요 없어요 예전보다 빨라졌다 모두 다 했어요'), ['제가 했어요', '그리고 필요 없어요', '예전보다 빨라졌다', '모두 다 했어요']);
  assert.equal(analyzeAnswer({ scenario: 'refusal', text: '고마워요 근데 이번엔 어려워요 다음에 또 봐요' }).sentences, 3);
  assert.equal(analyzeAnswer({ scenario: 'interview', text: '가나다 abc 123' }).syllables, 3);
});

test('filler words keep Korean word boundaries; 음·어 are never counted', () => {
  const f = text => habits(text).fillers;
  assert.equal(count(f('그래서 그런 거예요. 그게 제 생각이에요.'), '그'), 0);
  assert.equal(count(f('그 경험에서 배웠어요. 그 사람이 도왔어요.'), '그'), 0);
  assert.equal(count(f('그, 제가 말씀드리면 그 제가 했어요.'), '그'), 2);
  assert.equal(count(f('그 이제 시작할게요.'), '그'), 1);
  assert.equal(count(f('좀비 영화를 좋아해요.'), '좀'), 0);
  assert.equal(count(f('좀 더 봐 주세요.'), '좀'), 1);
  assert.equal(count(f('막상 해 보니 막막했어요.'), '막'), 0);
  assert.deepEqual(f('이제 막 시작했어요.'), []);
  assert.equal(count(f('막 던졌어요.'), '막'), 1);
  assert.equal(count(f('이제야 알았어요. 이제는 달라요.'), '이제'), 0);
  assert.equal(count(f('사실은 제가 몰랐어요. 저는 사실 긴장했어요.'), '사실'), 2);
  assert.equal(count(f('중요한 사실을 알았어요. 그런 사실 처음 들어요.'), '사실'), 0);
  assert.equal(count(f('진짜로 그래요. 진짜 좋았어요. 진짜요?'), '진짜'), 2);
  assert.equal(count(f('일단은 해 볼게요. 일단 정리하면요.'), '일단'), 2);
  assert.equal(count(f('약간의 시간이 필요해요.'), '약간'), 0);
  assert.equal(count(f('뭐 그런 거죠. 뭐? 뭐가 필요해요?'), '뭐'), 1);
  assert.equal(count(f('뭐랄까 뭔가 그니까 아무튼 그냥 되게 어쨌든'), '뭐랄까') + count(f('뭐랄까 뭔가 그니까 아무튼 그냥 되게 어쨌든'), '어쨌든'), 2);
  assert.deepEqual(f('음 어 음 어 그러니까요.'), []);
  assert.ok(!FILLER_WORDS.includes('음') && !FILLER_WORDS.includes('어'));
  assert.deepEqual(f('그래서 결론은 그렇습니다.'), []);
});

test('hedges, absolute words and repeated content words are counted without verbs or particles', () => {
  const h = text => habits(text).hedges;
  assert.equal(count(h('어려울 것 같아요. 그럴 거 같습니다. 좋은 것 같은데요.'), '~것 같아요'), 3);
  assert.equal(count(h('저랑 같아요. 같은 팀이에요.'), '~것 같아요'), 0);
  assert.equal(count(h('죄송하지만 어려워요. 죄송한데요.'), '죄송하지만'), 2);
  assert.equal(count(h('정말 죄송합니다.'), '죄송하지만'), 0);
  assert.equal(count(h('혹시 시간 되세요? 혹시라도 늦으면 말해 주세요.'), '혹시'), 2);
  assert.equal(count(h('아마도 될 거예요. 아마 괜찮을 거예요.'), '아마'), 2);
  assert.equal(count(h('조금만 도와주세요.'), '조금'), 0);
  assert.equal(count(h('조금 늦을 듯해요.'), '조금'), 1);
  assert.equal(count(h('조금 늦을 듯해요. 비가 올 듯합니다.'), '~인 듯'), 2);
  assert.equal(count(h('말하듯이 쉽게 해요.'), '~인 듯'), 0);
  assert.equal(count(h('잘 모르겠지만 해 볼게요.'), '잘 모르겠지만'), 1);
  assert.deepEqual(habits('넌 항상 늦어. 맨날 그래. 한 번도 안 지켰어.').absolutes.map(a => a.word).sort(), ['맨날', '한 번도', '항상'].sort());
  assert.deepEqual(habits('늘었어요. 항상성.').absolutes, []);
  const r = text => habits(text).repeats;
  assert.deepEqual(r('프로젝트 프로젝트를 프로젝트에서 했어요. 회의 회의는 회의를 봤어요.'), [{ word: '프로젝트', count: 3 }, { word: '회의', count: 3 }]);
  assert.deepEqual(r('했어요 했어요 했어요. 있는 있는 있는. 제가 제가 제가.'), []);
  assert.deepEqual(r('한국 한국에서 한국은 좋아요.'), [{ word: '한국', count: 3 }]);
  assert.deepEqual(r('고객 고객이'), []);
  assert.deepEqual(r('그냥 그냥 그냥'), []);
});

test('speaking stats report seconds and Hangul syllables per minute without judging against a fixed norm', () => {
  assert.deepEqual(speakingStats({ text: '가'.repeat(60), durationMs: 15000 }), { seconds: 15, syllablesPerMinute: 240 });
  assert.deepEqual(speakingStats({ text: '안녕하세요 반갑습니다', durationMs: 2500 }), { seconds: 3, syllablesPerMinute: 240 });
  assert.deepEqual(speakingStats({ text: 'hello', durationMs: 5000 }), { seconds: 5, syllablesPerMinute: null });
  for (const durationMs of [0, -1, NaN, undefined, 999]) assert.equal(speakingStats({ text: '가나다', durationMs }).syllablesPerMinute, null);
  assert.deepEqual(Object.keys(speakingStats({ text: '가', durationMs: 1000 })), ['seconds', 'syllablesPerMinute']);
});

test('counter lines: 3+ per element and strength, distinct tones, natural endings', () => {
  for (const [scenario, elements] of Object.entries(ELEMENTS)) {
    const all = [];
    for (const element of elements.filter(e => !e.optional)) {
      const lines = COUNTER_LINES[scenario][element.id];
      assert.ok(lines, `${scenario}.${element.id}`);
      for (const intensity of INTENSITY_IDS) {
        assert.ok(lines[intensity].length >= 3, `${scenario}.${element.id}.${intensity}`);
        for (const line of lines[intensity]) { assert.match(line, /[.?!…]$/u, line); assert.doesNotMatch(line, /\s{2}|AI|undefined/u); all.push(line); }
      }
      assert.equal(lines.gentle.filter(line => lines.tough.includes(line)).length, 0);
    }
    assert.equal(new Set(all).size, all.length, `${scenario} 대사 중복`);
  }
});

test('counterLine targets the most important missing element, avoids repeating the next prompt, and varies by seed', () => {
  const deadline = counterLine({ scenario: 'request', missingIds: ['deadline'], intensity: 'normal', turnId: 'pressure' });
  assert.ok(COUNTER_LINES.request.deadline.normal.includes(deadline));
  assert.ok(COUNTER_LINES.request.ask.tough.includes(counterLine({ scenario: 'request', missingIds: ['confirm', 'ask'], intensity: 'tough', turnId: 'pressure' })));
  // 다음 턴(specific)이 이미 「무엇을 언제까지」를 묻는다 → 요청 대신 이유를 되묻는다.
  assert.ok(COUNTER_LINES.request.reason.gentle.includes(counterLine({ scenario: 'request', missingIds: ['ask', 'reason'], intensity: 'gentle', turnId: 'specific' })));
  assert.ok(COUNTER_LINES.request.ask.gentle.includes(counterLine({ scenario: 'request', missingIds: ['ask'], intensity: 'gentle', turnId: 'specific' })));
  assert.equal(counterLine({ scenario: 'refusal', missingIds: ['alternative'], intensity: 'normal', turnId: 'close' }), null);
  assert.equal(counterLine({ scenario: 'refusal', missingIds: [], turnId: 'close' }), null);
  assert.equal(counterLine({ scenario: 'refusal', missingIds: ['unknown'], turnId: 'close' }), null);
  const input = { scenario: 'apology', practice: { counterpart: 'family', goal: 'hurt' }, missingIds: ['admit'], intensity: 'tough', turnId: 'specific' };
  assert.equal(counterLine(input), counterLine({ ...input }));
  const seeded = new Set(Array.from({ length: 12 }, (_, i) => counterLine({ ...input, seed: `session-${i}` })));
  assert.ok(seeded.size >= 2);
  const lines = COUNTER_LINES.apology.admit.tough;
  assert.equal(counterLine({ ...input, avoid: lines.slice(0, -1) }), lines.at(-1));
  assert.ok(lines.includes(counterLine({ ...input, avoid: lines })));
  for (const intensity of INTENSITY_IDS) assert.ok(COUNTER_LINES.apology.admit[intensity].includes(counterLine({ ...input, intensity })));
  assert.throws(() => counterLine({ scenario: 'request', missingIds: ['ask'], intensity: 'loud' }));
  assert.throws(() => counterLine({ scenario: 'nope', missingIds: ['ask'] }));
});

test('nextTip names only what is missing now, changes wording by turn, and never repeats an avoided tip', () => {
  for (const [scenario, elements] of Object.entries(ELEMENTS)) for (const element of elements.filter(e => !e.optional)) {
    const tips = TIPS[scenario][element.id];
    assert.equal(tips.length, 3, `${scenario}.${element.id}`);
    assert.equal(new Set(tips).size, 3);
    for (const tip of tips) { assert.notEqual(tip, element.why); assert.ok(!tip.includes(element.example)); assert.doesNotMatch(tip, AI_NAMES); }
  }
  const at = turnId => nextTip(analyzeAnswer({ scenario: 'request', text: '그 자료 좀 봐 주실 수 있을까요?', turnId }));
  assert.ok(TIPS.request.deadline.includes(at('specific')) && TIPS.request.deadline.includes(at('close')));
  assert.notEqual(at('specific'), at('close'));
  const analysis = analyzeAnswer({ scenario: 'request', text: '그 자료 좀 봐 주실 수 있을까요?', turnId: 'specific' });
  assert.notEqual(nextTip(analysis, { avoid: [nextTip(analysis)] }), nextTip(analysis));
  assert.equal(nextTip(analyzeAnswer({ scenario: 'request', text: '목요일 3시까지 이 표를 봐 주실 수 있을까요?', turnId: 'specific' })), null);
  assert.match(nextTip(analyzeAnswer({ scenario: 'request', text: '그, 좀 이 표를 목요일까지 봐 주실 수 있을까요? 좀 급해서요.', turnId: 'specific' })), /‘좀’을 2번/);
  assert.match(nextTip(analyzeAnswer({ scenario: 'feedback', text: '지난주 회의에서 봤는데 항상 늦어요.', turnId: 'opening' })), /‘항상’/);
  assert.match(nextTip(analyzeAnswer({ scenario: 'refusal', text: '이번엔 어려울 것 같아요.', turnId: 'concise' })), /「어려워요」로 끝내면/);
  assert.match(nextTip(analyzeAnswer({ scenario: 'interview', text: '혹시 아마 될 것 같아요. 제가 표를 만들었어요.', turnId: 'concise' })), /result|결과|그래서/);
  assert.throws(() => nextTip(null));
});
