// 서체 등록. 못 받으면 렌더가 멈춘다(조용히 다른 서체로 나오는 것보다 낫다).
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const EN = "'Inter Tight', 'SUIT', sans-serif";
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
    throw new Error(`서체 등록 실패 — node 준비.mjs 를 먼저 돌린다. ${String(e)}`);
  });
