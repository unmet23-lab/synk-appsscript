// 한국어 줄 — 보통 눈높이 · 기능 글(말하는 사람 default). 이유 종류마다 문장 틀 하나.
// 틀 = (slots, name, j) → 문장. name은 그 이유가 가리키는 단위 · 능력 · 주제의 화면 이름(낫표 밖), j는 조사(josa.mjs).
// 단위 · 능력 이야기(unit.* · skill.* · pace.* · idle · day.capped)는 단계 2의 reasonLine(reason/ko.mjs)과 같은 문장이다(시험이 맞댄다).
// host.* · goal.match는 WORLD의 hostReason(world-learning-plan.mjs)이 쓰던 문장을 옮겼다(host.next는 4-3에서 줄였다). host.missed ·
// host.bridge는 4-3 홈의 생활 복습 사실이다. host.order(제품 순서)는 문장이 없다.
const retry = (s, name) =>
  s.other
    ? `방금 놓친 「${name}」, 다른 문제로 한 번 더 만나요.`
    : `방금 놓친 「${name}」, 한 번 더 만나요.`;

// 같은 하루(days 0 — 기기 새벽 4시 경계)에 돌아오면 날 수를 말하지 않는다(Fable 5.2 끝 판 F4 · 설계 주인 11-13).
const shaky = (s, name) => {
  if (!s.days)
    return s.reviews === 1
      ? `오늘 놓친 「${name}」, 다시 만나요.`
      : `「${name}」 ${s.reviews}번 중 ${s.misses}번 놓쳤어요. 오늘 한 번 더 만나요.`;
  return s.reviews === 1
    ? `지난번에 놓친 「${name}」, ${s.days}일 만에 다시 만나요.`
    : `「${name}」 ${s.reviews}번 중 ${s.misses}번 놓쳤어요. ${s.days}일 만에 다시 만나요.`;
};
const due = (s, name) =>
  s.days
    ? `「${name}」 본 지 ${s.days}일 됐어요. 잊기 전에 한 번 더 만나요.`
    : `오늘 만난 「${name}」, 잊기 전에 한 번 더 만나요.`;

// 숙제 상태를 모르면 말하지 않는다(null) — plan.mjs가 review · missed만 싣는 것과 같이, 모르는 상태를 놓친 답 문장으로 짓지 않는다(카본 끝 판 C4).
const homework = (s, name) =>
  s.status === 'review'
    ? `이번 주 숙제예요. 「${name}」 기록이 오래돼 새 문항으로 다시 확인해요.`
    : s.status === 'missed'
      ? `이번 주 숙제예요. 「${name}」에서 놓친 답이 있어 새 문항으로 다시 확인해요.`
      : null;

const one = sentence => ({ standard: { default: [sentence] } });
// 말하는 사람 fan 줄이 함께 있는 종류(장면 사실 scene.* — 아래). 다른 눈높이는 standard로 물러선다.
const withFan = (sentence, fan) => ({ standard: { default: [sentence], fan: [fan] } });

// 장면 사실(서울행 「내 팬」 1차 — experiences/seoul-arrival/팬설계.md §12-2 표). 줄 수는 시범판이 「소리가 들린 학생 줄」로 센 수다(판정이 꺼진
// 판 · 손님 판도 센다). 그래서 「잘」 · 「끝까지」 · 「맞게」를 쓰지 않는다. 단계는 녹음 · 말해 본 기록이 있는지만 안다. 통과를 뜻하는 말
// (「해냈어요」)은 줄마다 판정이 오는 2차로 넘긴다. 아직(wait)에는 해 봤지만 안 들린 판도 섞여 탓하지 않는 꼴로 쓴다. default 줄은 기록만 말한다.
const sceneLines = s => `대사 ${s.n}줄을 소리 내어 말했어요.`;
const SCENE_STEP = Object.freeze({
  take2: Object.freeze({
    done: Object.freeze({
      default: '「한 번 더」를 말해 봤어요.',
      fan: '「한 번 더」도 말해 봤어요.',
    }),
    wait: Object.freeze({
      default: '「한 번 더」는 아직이에요.',
      fan: '「한 번 더」는 기다릴게요. 하면 자리 하나가 켜져요.',
    }),
  }),
  transfer: Object.freeze({
    done: Object.freeze({
      default: '처음 보는 말을 말해 봤어요.',
      fan: '「처음 보는 말」까지 말해 봤어요.',
    }),
    wait: Object.freeze({
      default: '처음 보는 말은 아직이에요.',
      fan: '「처음 보는 말」도 들어 보고 싶어요.',
    }),
  }),
});
const sceneStep = who => s => SCENE_STEP[s.step][s.state][who];

// 점검 칸의 쓰기 · 말하기(4-4d — 단계 4 계획 §21-23의 3, 설계 주인 11-17 답 4). 문장은 그 연습으로 학생이 얻는 것을 말한다. 쓰기는 TOPIK
// 쓰기의 어느 점수 칸에 도움이 되는지, 말하기는 시험의 어느 유형을 이번 주에 이 기기에서 아직 안 해 봤는지다(이번 주 계획의 speakingNeeds와 같은 셈). 칸은 slots.mjs 표의 것을 빠짐없이,
// 그것만 쓴다(시험이 세 언어 줄을 표와 맞댄다). 유형 이름은 WORLD 화면 글 표(speaking.type.1 ~ 6)와 같다.
const WRITING = Object.freeze({
  'ending-53': Object.freeze({
    retry: '지난 53번 글에서 놓친 「-다」 끝맺음을 다시 연습해요.',
    assisted: '도움을 받아 고친 53번 글의 「-다」 끝맺음을 이번에는 혼자 써 봐요.',
    gain: 'TOPIK 쓰기의 언어 사용 점수에 도움이 돼요.',
  }),
});
const SPEAKING = Object.freeze({
  answer: '질문에 대답하기',
  roleplay: '그림 보고 역할 수행하기',
  narrate: '그림 보고 이야기하기',
  respond: '대화 완성하기',
  interpret: '자료 해석하기',
  opinion: '의견 제시하기',
});
const writing = s => `${WRITING[s.focus][s.need]} ${WRITING[s.focus].gain}`;
const speaking = (s, _, j) =>
  `TOPIK 말하기 여섯 유형 가운데 이번 주에 이 기기에서 아직 안 해 본 유형이 ${s.untried}개예요. 오늘은 「${SPEAKING[s.type]}」${j(`「${SPEAKING[s.type]}」`, '을', '를')} 해 봐요.`;

export const KO = Object.freeze({
  'unit.retry': one(retry),
  'unit.shaky': one(shaky),
  'unit.due': one(due),
  'unit.new': one((s, name) =>
    s.relearn ? `「${name}」 처음부터 다시 만나요.` : `「${name}」 처음 만나요.`,
  ),
  'skill.up': one(
    (s, name) => `「${name}」 ${s.streak}번 이어서 혼자 맞혔어요. 한 단계 올려 볼게요.`,
  ),
  'skill.ease': one((_, name) => `「${name}」 조금 쉬운 것부터 다시 잡아 볼게요.`),
  'pace.breather': one(
    (s, name, j) =>
      `${s.misses}번 이어서 놓쳤어요. 잘 아는 「${name}」${j(`「${name}」`, '으로', '로')} 숨을 고르고 가요.`,
  ),
  idle: one(s =>
    s.left
      ? '돌아온 말은 이번 판에 여기까지예요. 남은 말은 다음에 만나요.'
      : '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.',
  ),
  'day.capped': one(() => '오늘은 여기까지예요. 남은 것은 내일 만나요.'),
  'pace.stubborn': one(
    () => '자꾸 놓치는 말은 이번 판에 여기까지 만나요. 다음 판에 다른 방법으로 다시 만나요.',
  ),
  'goal.match': one(
    (_, name, j) => `더 배우고 싶다고 알려 준 「${name}」${j(`「${name}」`, '이에요', '예요')}.`,
  ),
  'host.resume': one(
    () => '하던 학습의 같은 자리에서 이어가요. 다른 활동을 골라도 지금 진도는 남아 있어요.',
  ),
  'host.prerequisite': one(() => '한글부터 만나요. 소리를 듣고 글자를 고르며 읽는 법을 익혀요.'),
  'host.homework': one(homework),
  'host.form': one(
    () => '시험처럼 처음 보는 문항을 정해진 시간 안에 풀어 봐요. 점수나 급수로 바꾸지 않아요.',
  ),
  'host.recheck': one(
    () => '이번 주 계획의 다시 확인이에요. 처음 보는 문항으로 지금 위치를 확인해요.',
  ),
  'host.start': one(() => '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.'),
  // 다음 레슨은 엔진 기록을 읽지 않는 제품 사실이라 기록을 말하지 않는다(확인 중에도 쓴다 — 단계 4 §20-4 · 설계 검토 H8).
  'host.next': one(() => '생활 팩의 다음 레슨이에요.'),
  // 제품이 차례를 정하는 생활 복습(§20-6의 5). 놓친 것은 혼자 맞힐 때까지 돌아오고(world-life-next lifeDue ①), 다리는 레슨 다음 날의
  // 새 상황 복습이다(②). 이름은 근거의 단위에서만 — 모르면 이름 없는 틀이다. 놓친 것의 문장은 조건을 걸어 재촉하지 않는다(「혼자
  // 맞힐 때까지」를 뺌 — 말 걸기 설계 E절). 「오늘」 한 장의 복습 까닭(같은 점을 처음 보는 상황에서 다시)을 말한다(설계 주인 11-15).
  'host.missed': one((_, name) =>
    name
      ? `놓친 「${name}」, 오늘은 다른 장면에서 다시 해 봐요.`
      : '놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.',
  ),
  'host.bridge': one((_, name) =>
    name
      ? `레슨에서 만난 「${name}」, 오늘은 새 상황에서 다시 만나요.`
      : '레슨에서 만난 표현을 오늘은 새 상황에서 다시 만나요.',
  ),
  // 30일째 문장(진도의 사실 — 단계 4 계획 §21-7, 설계 주인 승인 21-10의 9 · 13). 앞 창(30일 전 학습일에서 끝나는 7학습일)에 놓친 자리 수와
  // 그 뒤의 자리 수는 기록 그대로다. 「모두 혼자 맞혔어요」는 뒤 창에 놓침과 힌트를 보고 맞힘이 하나도 없을 때만 고른다(memory/lookback.mjs).
  'progress.month': one(
    (s, name) =>
      `한 달 전에 ${s.misses}번 놓친 「${name}」, 그 뒤로 ${s.reviews}번 모두 혼자 맞혔어요.`,
  ),
  // 장면 사실(서울행 「내 팬」 — 위 SCENE_STEP). 줄 수 문장은 팬도 기록 그대로 말한다.
  'scene.lines': withFan(sceneLines, sceneLines),
  'scene.step': withFan(sceneStep('default'), sceneStep('fan')),
  // 점검 칸의 쓰기 · 말하기(4-4d — 위 WRITING · SPEAKING). 칸 없는 둘은 근거 없는 정상 경로다(한 가지 고치기 전 · 여섯 유형을 다 해 봄).
  'host.writing': one(writing),
  'host.writing.start': one(
    () =>
      '53번 글을 한 편 써 봐요. 규칙 점검이 「-다」 끝맺음처럼 TOPIK 쓰기에서 확인해 볼 곳을 짚어 줘요.',
  ),
  'host.speaking': one(speaking),
  'host.speaking.again': one(
    () =>
      'TOPIK 말하기 여섯 유형을 이번 주에 이 기기에서 모두 해 봤어요. 한 유형을 다시 하며 정해진 시간 안에 말하는 연습을 이어가요.',
  ),
});
