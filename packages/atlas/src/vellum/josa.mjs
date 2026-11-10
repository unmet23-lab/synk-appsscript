// 받침에 맞는 조사(Vellum 문장 표가 쓴다). 규칙은 제품의 play-common/kit/josa.mjs와 같다 — 엔진 묶음에 제품 코드를 넣지 않으려고
// 같은 규칙을 여기 한 벌 둔다(시험이 두 벌의 결과를 견준다).
//   josa('「약국」', '으로', '로') → '으로' · josa('「우유」', '을', '를') → '를' · josa('「물」', '으로', '로') → '로'
// - 한글 음절은 받침을 본다. ‘으로…’는 ㄹ 받침도 받침 없는 쪽(로)을 쓴다.
// - 낱자는 이름으로 읽는다(자음은 받침이 있고 ㄹ은 리을, 모음은 없다). 숫자는 한국어 소리로 읽는다.
// - 끝의 문장부호 · 따옴표 · 낫표 · 괄호 · 빈칸과 로마자는 건너뛰고 그 앞의 한글을 본다. 읽을 글자가 없으면 받침이 없다.
const RIEUL = 8;
const DIGIT_FINAL = [21, RIEUL, 0, 16, 0, 0, 1, RIEUL, RIEUL, 0];

function finalOfCode(code) {
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (code >= 0x3131 && code <= 0x314e) return code === 0x3139 ? RIEUL : 1;
  if (code >= 0x314f && code <= 0x3163) return 0;
  if (code >= 0x30 && code <= 0x39) return DIGIT_FINAL[code - 0x30];
  return null;
}

// 끝소리의 받침 번호(0이면 받침 없음, 8이면 ㄹ).
export function finalOf(word) {
  const text = String(word ?? '');
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const final = finalOfCode(text.charCodeAt(i));
    if (final !== null) return final;
  }
  return 0;
}

// 받침이 있으면 withFinal, 없으면 without.
export function josa(word, withFinal, without) {
  const final = finalOf(word);
  if (final === 0) return without;
  return final === RIEUL && String(withFinal).startsWith('으로') ? without : withFinal;
}
