// 편 정본(episode.json) — 한 편의 모든 판본이 이 파일 하나에서 렌더된다(판끼리 따로 고치지 않는다 — v2 §4-3).
// 한국어(관용구 · 예문 · 해요체 · 목소리)는 판본 공통, 판본 언어 칸(loc.<언어>)만 그 나라 말로 다시 쓴다.
import data from './episode.json';

export type LocQuestion = {
  literal: string; // 다리 글 — 관용구를 글자 그대로 옮긴 말(따옴표 없이)
  options: [string, string, string]; // 보기 셋(episode.questions[].correct 순서와 같은 자리)
  why: string; // 「왜 그 뜻인지」 한 줄 — v5부터 화면에는 없다(캡션 · 은행)
  gloss: string; // 예문 풀이 — 화면에는 없다(캡션 · 은행)
  reading: string; // 해요체 읽는 법(몽골어판은 키릴 — ㅓ=ө · ㅐㅔ=э · ㅡ=ы · ㅜ=ү, 다른 언어는 표기표를 검수한 뒤에만)
  recap: string; // 끝 화면 「관용구 = 뜻」의 뜻(짧게)
  sayMean?: string; // 따라 말할 해요체 문장의 뜻(말끝이 바뀌어 뜻 줄과 달라질 때만 — 「파김치가 됐어요 = 몹시 지쳤어요」). 없으면 그 줄을 안 그린다
  when?: string; // 뜻 장면 귀퉁이의 때 · 곳 이름표(「오늘」 · 「그날 밤」 · 「다음 날」 — 뜻 장면 셋을 한 사람의 하루로 잇는다). 없으면 안 그린다
};

/** 장면 한 컷(public 아래 그림). 한 장면을 컷 여럿으로 이으면 그 장면 안에서 사건이 일어난다(v6 — 멈춘 그림 한 장은 「임팩트」로 안 읽혔다). */
export type Shot = {
  src: string;
  at?: number; // 이 컷이 시작하는 박(그 단계 시작 기준 — 글자 그대로는 문제 시작, 뜻은 카드가 뒤집힌 때). 첫 컷은 0. 생략하면 둘째 컷은 박자표 beat2
  focus?: [number, number]; // 이 컷에서 웃음이 있는 곳(가로 % · 세로 %) — 여기서 한 장 전체로 빠진다
};
/** 장면 속 한 곳의 움직임(그림 한 장 안에서 — 그 자리만 부드럽게 오려 제자리에서 움직인다. 누끼가 아니라 같은 그림의 한 조각이다). */
export type Move = {
  box: [number, number, number, number]; // 그림 안 자리(왼쪽 % · 위 % · 폭 % · 높이 %)
  kind: 'squash' | 'hop' | 'bob' | 'rock' | 'shake' | 'grow' | 'tilt';
  at?: number; // 시작 박(그 컷이 시작한 때 기준, 기본 0)
  amp?: number; // 세기(squash · grow는 비율, hop · bob · shake는 그림 높이의 %, rock · tilt는 도)
  every?: number; // 되풀이 주기(박) — bob · rock · hop
  shot?: number; // 몇째 컷에서(기본 0)
};
export type SceneArt = string | Shot[];
export type Question = {
  bank: string; // 문제 은행 id(LAB_퀴즈은행/은행.json)
  idiom: string; // 화면 큰 제목(한국어)
  // literal = 글자 그대로 장면, meaning = 뜻 장면(몽글 + 장면 한 장으로 구운 것). 글 하나면 한 컷, 배열이면 컷 여럿.
  // focus = 한 컷일 때 웃음이 있는 곳. moves = 그 장면 안 움직임.
  art: { literal: SceneArt; meaning: SceneArt; focus?: [number, number]; moves?: { literal?: Move[]; meaning?: Move[] }; whenRight?: boolean }; // whenRight(v6f): 때 · 곳 이름표를 뜻 장면 오른쪽 위에
  correct: 0 | 1 | 2; // 보기 셋 가운데 정답 자리
  show?: [number, number]; // 「둘 중 하나」 문제(둘째 문제): 화면에 낼 보기 둘(보기 셋의 자리, 화면 순서대로 — 정답과 함정 하나)
  trap?: number; // 「맞을까 틀릴까」 문제(셋째 문제): 화면에 낼 함정 뜻(오답 하나의 자리 — 글자 그대로의 그림에서 빠지기 쉬운 것). 없으면 첫 오답
  example: string; // 한국어 예문 — 화면에는 없다(캡션 · 은행)
  say: string; // 따라 말할 해요체
  stage: string; // 무대 색 이름(theme.ts STAGE_BG)
  ko?: Omit<LocQuestion, 'reading'>; // 원문(뜻) — 새 언어는 이것에서 다시 쓰고, 역번역은 이것과 견준다(판본글.mjs)
  loc: Record<string, LocQuestion>;
};
export type LocEpisode = {
  hook: string; // 위 알약(이 편의 주제 한 줄 — 「음식 관용구 3개」)
  ask: string; // 끝 질문(편마다 다르게 — 설계 6 · ⑯) — 한국어 목소리 end.askKo와 같은 뜻
  cheer: string; // 끝 응원말(한국어 end.cheerKo)의 뜻 — 「= …」
  handle: string; // 끝 화면 계정
};
/** v6f 끝 장면 이름표(문제 순서 셋) — 끝 그림이 세 관용구를 한 사건으로 엮을 때, 그 관용구가 일어난 자리(dot)와 이름표 가운데(box). 끝 장면 칸의 %(가로 · 세로). */
export type EndTag = { dot: [number, number]; box: [number, number] }; // dot = 끝 그림(4:3) 안의 % · box = 줄어든 끝 칸(855 폭) 안의 %
export type Episode = {
  id: string;
  title: string; // 사람이 읽는 편 이름(한국어)
  langs: string[]; // 렌더할 판본 언어
  questions: [Question, Question, Question];
  // art = 점수 칸 뒤 그림(몽글이 응원하는 장면 한 장) · 끝 목소리 두 줄(편마다 다르게). 맨 끝 1.2초는 첫 문제의 글자 그대로 장면으로 돌아간다.
  end: { art: string; stage: string; askKo: string; cheerKo: string; focus?: [number, number]; moves?: Move[]; cheerBy?: number; tags?: EndTag[] }; // cheerBy(v6e): 응원 말을 끝 장면 속 인물의 말풍선으로 — 꼬리가 가리키는 자리(장면 가로 %)
  ko?: Omit<LocEpisode, 'handle'>; // 원문(뜻)
  loc: Record<string, LocEpisode>;
};

export const EPISODE = data as unknown as Episode;

export const shotsOf = (a: SceneArt, focus?: [number, number]): Shot[] => (typeof a === 'string' ? [{ src: a, focus }] : a.map((s, i) => (i === 0 && !s.focus && focus ? { ...s, focus } : s)));

/** 판본 언어 글이 다 있는지 — 빠진 칸은 렌더 전에 멈춘다(조용히 빈 글로 나가지 않게). */
export const checkEpisode = (ep: Episode, lang: string) => {
  const miss: string[] = [];
  if (!ep.loc[lang]) miss.push(`loc.${lang}`);
  else for (const k of ['hook', 'ask', 'cheer', 'handle'] as const) if (!ep.loc[lang][k]?.trim()) miss.push(`loc.${lang}.${k}`);
  ep.questions.forEach((q, i) => {
    const l = q.loc[lang];
    if (!l) return miss.push(`questions[${i}].loc.${lang}`);
    for (const k of ['literal', 'reading', 'recap'] as const) if (!l[k]?.trim()) miss.push(`questions[${i}].loc.${lang}.${k}`);
    if (!Array.isArray(l.options) || l.options.length !== 3 || l.options.some((o) => !o?.trim())) miss.push(`questions[${i}].loc.${lang}.options`);
    if (q.show && (q.show.length !== 2 || q.show[0] === q.show[1] || !q.show.includes(q.correct) || q.show.some((k) => ![0, 1, 2].includes(k)))) miss.push(`questions[${i}].show(보기 둘 · 정답 포함)`);
    for (const side of ['literal', 'meaning'] as const) if (!shotsOf(q.art[side]).length || shotsOf(q.art[side]).some((s) => !s.src)) miss.push(`questions[${i}].art.${side}`);
  });
  if (!ep.questions[1]?.show) miss.push('questions[1].show(둘째 문제는 「둘 중 하나」 — 보기 둘)');
  ep.questions.forEach((q, i) => { if (q.trap !== undefined && (![0, 1, 2].includes(q.trap) || q.trap === q.correct)) miss.push(`questions[${i}].trap(오답 자리)`); });
  if (ep.end.tags && (ep.end.tags.length !== 3 || ep.end.tags.some((t) => t.dot?.length !== 2 || t.box?.length !== 2))) miss.push('end.tags(문제 순서 셋 — dot · box)');
  if (miss.length) throw new Error(`편 정본에 빠진 칸: ${miss.join(', ')}`);
};
