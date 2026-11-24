// 영어 줄 — 보통 눈높이 · 기능 글(말하는 사람 default). WORLD 짧은 연습(4-1)에 보이는 종류만(문항 위 이유 · 판 끝 문장).
// 세 겹 대조(11-11): 아르곤 문법 · flash와 Opus 직역 역번역에서 뜻이 원문과 같다 — 처음 초안의 「meet」(만나다 직역)은 「try · review ·
// back」으로 고쳤다. 셋째 겹 Fable은 4-1 화면 검수의 최종에서. 철자는 앱 영어 표의 이웃 줄을 따른다(이 흐름은 Practice).
// 학습 대상의 한국어 이름은 영어 따옴표 ‘…’ 안에 그대로 둔다 — 화면 글 표에서 한국어 학습 내용이 값으로 드는 줄(홈 추천 이유 등)과
// 같은 꼴이다(11-12 Fable 5.2 화면 최종 F5 — 낫표는 한국어 화면만). 홈 · 활동 고르기 문장(host.* · goal.match)은 4-3에서 더했다(맨 아래).
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
const times = n => `${n} ${n === 1 ? 'time' : 'times'}`;
const one = sentence => ({ standard: { default: [sentence] } });
// 말하는 사람 fan 줄이 함께 있는 종류(장면 사실 scene.* — 아래). 다른 눈높이는 standard로 물러선다.
const withFan = (sentence, fan) => ({ standard: { default: [sentence], fan: [fan] } });

// 장면 사실(서울행 「내 팬」 1차 — ko.mjs와 같은 뜻 · 같은 말투, 더한 주장 없음). 단계 이름은 서울행 화면 글 표(experiences/seoul-arrival/
// strings.mjs의 「1화 · 한 번 더」 · 「1화 · 처음 보는 말」)의 영어 One more time · Something new와 같다.
// 현지어 검수: Opus 역번역 → Fable 교정(11-25, 팬 줄 — 단계 이름은 큰따옴표 “…”, 마침표는 따옴표 안) → 카본 문법 채점. fan 줄만 화면에 낸다.
const lines = n => `${n} ${n === 1 ? 'line' : 'lines'}`;
const sceneLines = s => `You spoke ${lines(s.n)} out loud.`;
const SCENE_STEP = Object.freeze({
  take2: Object.freeze({
    done: Object.freeze({
      default: 'You tried ‘One more time’.',
      fan: 'You tried “One more time” too.',
    }),
    wait: Object.freeze({
      default: '‘One more time’ isn’t done yet.',
      fan: 'I’ll wait for you to try “One more time.” When you do, a seat lights up.',
    }),
  }),
  transfer: Object.freeze({
    done: Object.freeze({
      default: 'You tried saying something new.',
      fan: 'You even tried “Something new.”',
    }),
    wait: Object.freeze({
      default: '‘Something new’ isn’t done yet.',
      fan: 'I’d love to hear you try “Something new” too.',
    }),
  }),
});
const sceneStep = who => s => SCENE_STEP[s.step][s.state][who];

// 점검 칸의 쓰기 · 말하기(4-4d — 한국어 줄 ko.mjs와 같은 뜻). 유형 이름은 WORLD 화면 글 표(speaking.type.1 ~ 6)의 영어와 같다.
// 세 겹 대조(11-17, 세 번)에서 말하기 줄의 부정 수량(「haven’t tried 1 of the six」), 쓰기 다시 줄의 무생물 주어, 다시 하기 줄의 -ing 겹침을 고쳤다.
const WRITING = Object.freeze({
  'ending-53': Object.freeze({
    retry:
      'Practise the plain written style for Question 53 again — you missed it in your last response.',
    assisted:
      'You fixed your Question 53 sentence endings with help. This time, use the plain written style on your own.',
    gain: 'Using it helps your TOPIK Writing language-use score.',
  }),
});
const SPEAKING = Object.freeze({
  answer: 'Answer a question',
  roleplay: 'Role-play from a picture',
  narrate: 'Tell a story from pictures',
  respond: 'Complete a conversation',
  interpret: 'Interpret data',
  opinion: 'Give your opinion',
});
const writing = s => `${WRITING[s.focus][s.need]} ${WRITING[s.focus].gain}`;
const speaking = s =>
  `You still have ${s.untried} of the 6 TOPIK Speaking task types left to try on this device this week. Today, try ‘${SPEAKING[s.type]}’.`;

const retry = (s, name) =>
  s.other
    ? `You just missed ‘${name}’ — let’s try it again in a different question.`
    : `You just missed ‘${name}’ — let’s try it one more time.`;

// 숙제 — 능력 이름은 화면 언어로 번역된 이름이라 따옴표 없이 맨 앞에 둔다(skill.* 줄과 같다). 상태를 모르면 말하지 않는다(null).
const homework = (s, name) =>
  s.status === 'review'
    ? `${name}: This is your homework for the week. It’s been a while since you last worked on this skill, so we’ll review it with new questions.`
    : s.status === 'missed'
      ? `${name}: This is your homework for the week. You got a question wrong earlier, so we’ll review this skill with new questions.`
      : null;

// 같은 하루(days 0)에 돌아오면 날 수를 말하지 않는다(Fable 5.2 끝 판 F4).
const shaky = (s, name) => {
  if (!s.days)
    return s.reviews === 1
      ? `You missed ‘${name}’ earlier today — here it is again.`
      : `‘${name}’: missed ${s.misses} out of ${times(s.reviews)}. Back again today.`;
  return s.reviews === 1
    ? `You missed ‘${name}’ last time — it’s back after ${days(s.days)}.`
    : `‘${name}’: missed ${s.misses} out of ${times(s.reviews)}. Back after ${days(s.days)}.`;
};

export const EN = Object.freeze({
  'unit.retry': one(retry),
  'unit.shaky': one(shaky),
  'unit.due': one((s, name) =>
    s.days
      ? `It’s been ${days(s.days)} since you last saw ‘${name}’. Let’s review it once more before it fades.`
      : `You saw ‘${name}’ earlier today. Let’s review it once more before it fades.`,
  ),
  'unit.new': one((_, name) => `Seeing ‘${name}’ for the first time.`),
  'skill.up': one(
    (s, name) =>
      `${name}: you got it right on your own ${times(s.streak)} in a row. Let’s step it up a level.`,
  ),
  'skill.ease': one(
    (_, name) =>
      `${name}: let’s build this skill back up, starting with something a little easier.`,
  ),
  'pace.breather': one(
    (s, name) =>
      `You missed ${s.misses} in a row. Let’s catch our breath with ‘${name}’, one you know well.`,
  ),
  idle: one(
    () => 'You’ve covered everything due for review today. Let’s keep things light from here.',
  ),
  'day.capped': one(() => 'That’s it for today. We’ll save the rest for tomorrow.'),
  'pace.stubborn': one(
    () =>
      // 끈질긴 단위는 여러 날에 걸친 표시다 — 「this round」를 「kept missing」에 붙이면 「이번 판에서 자꾸 놓친 말」로 읽혀(이번 판에 한 문항만
      // 냈고 맞혔어도 나온다) 현재형 · 판 쪽으로 옮겼다(Fable 5.2 끝 판 넘친 #16 — 한국어 원문 「자꾸 놓치는 말은 이번 판에 여기까지」).
      'That’s it for this round on the expressions you keep missing. Next round, we’ll try them a different way.',
  ),
  // 홈 · 활동 고르기 문장(4-3 — 단계 4 §20-8). host.resume · host.prerequisite · host.form · host.recheck · host.start는 앱 화면 글 표
  // (world-strings.mjs msg.*)가 대조를 거쳐 쓰던 번역을 옮겼다. 그 밖은 11-15 세 겹 대조(현지어대조.js — 카본 문법 · flash 직역 · Opus 직역)를
  // 지났다(「met ‘…’」 → 「learned」, 명사구 조각 → 문장, 숙제의 「check it again」 → 「review」).
  'goal.match': one((_, name) => `You said you want to learn more about ‘${name}’.`),
  'host.resume': one(
    () =>
      'You’ll continue right where you left off. Your progress stays even if you pick something else.',
  ),
  'host.prerequisite': one(
    () => 'Let’s meet Hangul first. Listen to the sounds, pick the letters, and learn how to read.',
  ),
  'host.homework': one(homework),
  'host.form': one(
    () => 'Like the test: new questions within a set time. Nothing becomes a score or a level.',
  ),
  'host.recheck': one(
    () => 'This is this week’s check. We’ll see where you stand with questions you haven’t seen.',
  ),
  'host.start': one(
    () => 'For your test goal, let’s first find your starting point with a quick check.',
  ),
  'host.next': one(() => 'This is your next daily-life lesson.'),
  'host.missed': one((_, name) =>
    name
      ? `You missed ‘${name}’ — today, let’s try it again in a different situation.`
      : 'You missed some expressions — today, let’s try them again in a different situation.',
  ),
  'host.bridge': one((_, name) =>
    name
      ? `You learned ‘${name}’ in a lesson — today, let’s review it in a new situation.`
      : 'Today, let’s review expressions from your lessons in a new situation.',
  ),
  // 점검 칸의 쓰기 · 말하기(4-4d — 위 WRITING · SPEAKING).
  'host.writing': one(writing),
  'host.writing.start': one(
    () =>
      'Write a Question 53 response. The rule check points out what to review for TOPIK Writing, such as the plain written style.',
  ),
  'host.speaking': one(speaking),
  'host.speaking.again': one(
    () =>
      'You’ve tried all six TOPIK Speaking task types on this device this week. Try one again for more practice speaking within the time limit.',
  ),
  // 장면 사실(서울행 「내 팬」 — 위 SCENE_STEP). 줄 수 문장은 팬도 기록 그대로 말한다.
  'scene.lines': withFan(sceneLines, sceneLines),
  'scene.step': withFan(sceneStep('default'), sceneStep('fan')),
});
