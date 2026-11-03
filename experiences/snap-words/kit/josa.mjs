// 받침에 맞는 조사 — SYNK LAB PLAY 게임이 같이 쓴다. 원본은 play-common/kit/josa.mjs이고,
// 게임의 kit/josa.mjs는 build-kit.mjs가 만드는 사본이다(사본은 직접 고치지 않는다).
//   josa('병원', '이에요', '예요') → '이에요' · josa('우유', '을', '를') → '를' · josa('물', '으로', '로') → '로'
// 끝소리는 이렇게 읽는다.
// - 한글 음절은 받침을 본다. ‘으로/로’는 ㄹ 받침도 받침 없는 쪽(로)을 쓴다(물로·공으로·라켓으로).
// - 낱자는 이름으로 읽는다. 자음은 받침이 있고(ㄱ 기역 → ㄱ은, ㄹ 리을 → ㄹ로), 모음은 없다(ㅏ 아 → ㅏ는).
// - 숫자는 한국어 소리로 읽는다. 0 영·1 일·3 삼·6 육·7 칠·8 팔은 받침이 있고, 2 이·4 사·5 오·9 구는 없다.
//   여러 자리 수의 끝이 0이어도 십·백·천·만이 모두 받침이 있어 같다.
// - 끝의 문장부호·따옴표·괄호·빈칸과 로마자는 건너뛰고 그 앞의 한글을 본다(“무엇을 먹어요?” → 요, 코스트 GT → 트).
//   읽을 글자가 없으면 받침이 없는 것으로 본다.
const RIEUL = 8;
const DIGIT_FINAL = [21, RIEUL, 0, 16, 0, 0, 1, RIEUL, RIEUL, 0];   // 영(ㅇ) 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구

/** 끝소리의 받침 번호(0이면 받침 없음, 8이면 ㄹ). */
export function finalOf(word) {
  const s = String(word ?? '');
  for (let i = s.length - 1; i >= 0; i--) {
    const code = s.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
    if (code >= 0x3131 && code <= 0x314e) return code === 0x3139 ? RIEUL : 1;   // 자음 낱자: 기역…히읗, ㄹ은 리을
    if (code >= 0x314f && code <= 0x3163) return 0;                           // 모음 낱자: 아…이
    if (code >= 0x30 && code <= 0x39) return DIGIT_FINAL[code - 0x30];
  }
  return 0;
}

/** 받침이 있으면 withFinal, 없으면 without. ‘으로…’로 시작하는 조사는 ㄹ 받침에도 without을 쓴다. */
export function josa(word, withFinal, without) {
  const final = finalOf(word);
  return final === 0 || (final === RIEUL && String(withFinal).startsWith('으로')) ? without : withFinal;
}
