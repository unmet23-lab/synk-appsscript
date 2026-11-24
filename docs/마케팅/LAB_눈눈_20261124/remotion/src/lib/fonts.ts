// 서체 등록. 못 받으면 렌더가 멈춘다(조용히 다른 서체로 나오는 것보다 낫다).
// 이 파일의 원천은 tools/편틀/src/lib/fonts.ts다 — 편에서 고치지 않는다(tests/편틀.test.js가 원천과 견준다).
// 편만의 서체는 src/lib/편서체.ts 같은 편 파일에서 따로 loadFont 한다.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const KO = "'SUIT', 'Inter Tight', sans-serif";
// 키즈판 현지어판(10-18)은 KidsFilm이 --kids-font에 그 언어 글꼴 줄을 깐다. 변수가 없으면 원래 줄 그대로다.
// var()가 들어 있어 CSS font-family에만 쓴다 — 캔버스 글꼴 · 글자 폭 재기(measureText)에 넘기면 조용히 기본 글꼴이 된다(그때는 KO를 쓴다).
export const EN = "var(--kids-font, 'Inter Tight', 'SUIT', sans-serif)";
export const MONO = "'DM Mono', 'SUIT', monospace";

const handle = delayRender('fonts');
Promise.all([
  loadFont({ family: 'SUIT', url: staticFile('fonts/SUIT-Variable.woff2'), weight: '100 900', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Medium.ttf'), weight: '500', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-SemiBold.ttf'), weight: '600', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Bold.ttf'), weight: '700 900', display: 'block' }),
  loadFont({ family: 'DM Mono', url: staticFile('fonts/DMMono-Medium.ttf'), weight: '500', display: 'block' }),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`서체 등록 실패 — 저장소 뿌리에서 node tools/새편.js <편 폴더> --실행 으로 public/fonts를 다시 찍는다. ${String(e)}`);
  });
