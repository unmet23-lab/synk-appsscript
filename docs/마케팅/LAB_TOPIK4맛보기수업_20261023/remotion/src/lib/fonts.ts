// 서체 등록. 못 받으면 렌더가 멈춘다(조용히 다른 서체로 나오는 것보다 낫다). 파일은 node 준비.mjs가 public/fonts에 둔다.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

/** 한글 — SUIT. 키릴은 SUIT에 없어 Inter Tight로 넘어간다. */
export const KO = "'SUIT', 'Inter Tight', sans-serif";
/** 몽골어(키릴)·라틴 — Inter Tight. 자막 속 한국어 인용은 SUIT로 넘어간다. */
export const MN = "'Inter Tight', 'SUIT', sans-serif";
/** 작은 영문 라벨·시각 — DM Mono(한글·키릴 글리프가 없어 한글 문장에는 쓰지 않는다). */
export const MONO = "'DM Mono', 'SUIT', monospace";

const handle = delayRender('fonts');
Promise.all([
  loadFont({ family: 'SUIT', url: staticFile('fonts/SUIT-Variable.woff2'), weight: '100 900', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Regular.ttf'), weight: '400', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Medium.ttf'), weight: '500', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-SemiBold.ttf'), weight: '600', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Bold.ttf'), weight: '700 900', display: 'block' }),
  loadFont({ family: 'DM Mono', url: staticFile('fonts/DMMono-Regular.ttf'), weight: '400', display: 'block' }),
  loadFont({ family: 'DM Mono', url: staticFile('fonts/DMMono-Medium.ttf'), weight: '500', display: 'block' }),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`서체 등록 실패 — node 준비.mjs 를 먼저 돌린다. ${String(e)}`);
  });
