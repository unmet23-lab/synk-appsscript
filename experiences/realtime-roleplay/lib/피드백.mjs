// 상황극 뒤 글 피드백(2026-10-30 시제품) — 전사만 글 모델에 넣고, 모델 출력은 서버가 검사한 뒤에만 보인다
// (WORLD 말하기 설계 §2-3 「서버가 정한다 — 모델 출력을 그대로 믿지 않는다」와 같은 방향).
// 주는 것: 미션 판정 · 잘한 말 · 고칠 말 · 다음에 써 볼 말 · 한마디. 주지 않는 것: 점수 · 발음 · 억양 · 기분 · 감정 추론.

export const 피드백모델 = 'gpt-6.1-terra';
// 설명 칸(왜 · 한마디)에만 건다 — 학습자가 실제로 한 말(「기분이 좋아요」)을 옮긴 인용은 거르지 않는다(Fable 설계 검토 10-30)
const 금지 = /발음|억양|목소리 ?톤|점수|등급|기분|감정|긴장|불안|자신감|떨리|당황|(즐거|행복|슬퍼|신나|기뻐|속상|답답|화가 ?나)[가-힣]* ?보(여|이)/;
const 상한 = { 잘한말: 3, 고칠말: 3, 써볼말: 2, 한마디: 90, 글: 120 };

export function 정규(s) {
  return String(s || '').normalize('NFC').replace(/[\s.,!?…~'"“”‘’·:;()「」\-]/g, '');
}

export function 스키마(장면) {
  const 문 = { type: 'string' };
  return {
    type: 'object', additionalProperties: false,
    required: ['미션', '잘한말', '고칠말', '써볼말', '한마디'],
    properties: {
      미션: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', '해냄', '근거'], properties: { id: { type: 'string', enum: 장면.미션.map((m) => m.id) }, 해냄: { type: 'boolean' }, 근거: 문 } } },
      잘한말: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['말', '왜'], properties: { 말: 문, 왜: 문 } } },
      고칠말: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['내말', '고친말', '왜'], properties: { 내말: 문, 고친말: 문, 왜: 문 } } },
      써볼말: { type: 'array', items: 문 },
      한마디: 문,
    },
  };
}

export function 지시(장면) {
  const 미션 = 장면.미션.map((m) => `- ${m.id}: ${m.할일}`).join('\n');
  return [
    '너는 외국인 한국어 초보 학습자의 말하기 상황극을 돌아보는 선생님이다. 아래 전사는 학습자(나)와 상대역(상대)의 대화다.',
    `장면: ${장면.이름} — ${장면.상황} 학습자 역할: ${장면.나}. 상대역: ${장면.상대.이름}.`,
    `미션(각각 학습자가 해냈는지 판정하고, 해냈으면 근거로 학습자가 실제 한 말을 전사에서 그대로 옮긴다. 못 했으면 해냄 false, 근거는 빈 글):\n${미션}`,
    '잘한말: 학습자가 실제로 한 말 가운데 상황에 잘 맞은 말(전사 그대로 옮김)과 왜 좋은지 한 줄. 최대 3.',
    '고칠말: 학습자가 실제로 한 말(전사 그대로) → 더 자연스럽거나 맞는 한국어 → 왜인지 한 줄(문법 · 낱말 · 존댓말 · 상황에 맞는 말). 최대 3. 고칠 것이 없으면 빈 배열.',
    '써볼말: 이 장면에서 다음에 써 보면 좋은 쉬운 한국어 문장 2개.',
    '한마디: 쉬운 한국어로 따뜻하게 한 문장.',
    '쉬운 한국어로 짧게 쓴다. 점수 · 등급을 매기지 않는다. 발음 · 억양 · 목소리는 말하지 않는다(받아 적은 글만 봤다). 학습자나 상대역의 기분 · 감정을 짐작하지 않는다.',
    '전사는 자동 받아쓰기라 억양 있는 말에서 자주 틀린다. 소리만 비슷한 차이(받침 · 모음 하나 · 띄어쓰기)는 받아쓰기 차이로 보고 고칠말로 고르지 않는다. 고칠말은 분명한 문법 · 낱말 · 존댓말 · 상황에 맞는 표현만 고른다.',
  ].join('\n');
}

/** 모델 출력 검사 — 전사에 없는 「내 말」 · 금지 낱말 · 장면 밖 미션 · 개수 초과를 버린다. */
export function 검사(장면, 출력, 전사) {
  const 내말들 = 전사.filter((t) => t.누가 === '나').map((t) => 정규(t.글)).filter(Boolean);
  const 했나 = (말) => { const n = 정규(말); return n.length >= 2 && 내말들.some((m) => m.includes(n)); };
  const 짧게 = (s, n = 상한.글) => String(s || '').trim().slice(0, n);
  const 깨끗 = (...글들) => 글들.every((s) => !금지.test(String(s || '')));
  const 버림 = [];
  const 미션 = 장면.미션.map((m) => {
    const 판 = (출력?.미션 || []).find((x) => x.id === m.id);
    const 해냄 = !!(판?.해냄 && 했나(판.근거));
    if (판?.해냄 && !해냄) 버림.push(`미션 ${m.id}: 근거가 전사에 없음`);
    return { id: m.id, 할일: m.할일, 해냄, 근거: 해냄 ? 짧게(판.근거) : '' };
  });
  const 잘한말 = (출력?.잘한말 || []).filter((x) => {
    const 통과 = 했나(x.말) && 깨끗(x.왜);
    if (!통과) 버림.push(`잘한말: ${짧게(x.말, 30)}`);
    return 통과;
  }).slice(0, 상한.잘한말).map((x) => ({ 말: 짧게(x.말), 왜: 짧게(x.왜) }));
  const 고칠말 = (출력?.고칠말 || []).filter((x) => {
    const 통과 = 했나(x.내말) && 정규(x.고친말) && 정규(x.고친말) !== 정규(x.내말) && 깨끗(x.왜);
    if (!통과) 버림.push(`고칠말: ${짧게(x.내말, 30)}`);
    return 통과;
  }).slice(0, 상한.고칠말).map((x) => ({ 내말: 짧게(x.내말), 고친말: 짧게(x.고친말), 왜: 짧게(x.왜) }));
  const 써볼말 = (출력?.써볼말 || []).filter((s) => 정규(s)).slice(0, 상한.써볼말).map((s) => 짧게(s));
  const 한마디 = 깨끗(출력?.한마디) ? 짧게(출력?.한마디, 상한.한마디) : '';
  return { 미션, 잘한말, 고칠말, 써볼말, 한마디, 버림 };
}

/** Responses API 본문 — 모델이 JSON 스키마 그대로 답하게 한다 */
export function 요청본문(장면, 전사) {
  const 줄 = 전사.map((t) => `${t.누가 === '나' ? '나' : '상대'}: ${t.글}`).join('\n');
  return {
    model: 피드백모델,
    reasoning: { effort: 'low' },
    max_output_tokens: 1500,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 지시(장면) }] },
      { role: 'user', content: [{ type: 'input_text', text: `전사:\n${줄}` }] },
    ],
    text: { format: { type: 'json_schema', name: 'roleplay_feedback', schema: 스키마(장면), strict: true } },
  };
}

export function 출력글(답) {
  return (답?.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
}
