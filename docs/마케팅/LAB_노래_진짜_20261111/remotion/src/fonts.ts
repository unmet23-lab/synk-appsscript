// 서체 등록. 못 받으면 렌더가 멈춘다(조용히 다른 서체로 나오는 것보다 낫다).
// KO = 한국어(관용구 · 예문 · 해요체), LOC = 그 판본 언어 글(Film이 --loc-font에 언어 프로필의 글꼴 줄을 깐다).
// Inter Tight는 라틴 · 키릴(Ө · Ү 포함)을 가진다. 다른 문자(한자 · 버마 · 타이 · 크메르 · 싱할라 · 데바나가리)는 lang.ts의
// 그 언어 글꼴 줄이 맡는다 — 글꼴 파일이 public/fonts에 있으면 lang.ts files로 함께 등록한다.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';
import { allFontFiles } from './lang';

export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const LOC = "var(--loc-font, 'Inter Tight', 'SUIT', sans-serif)";

const handle = delayRender('fonts');
Promise.all([
  loadFont({ family: 'SUIT', url: staticFile('fonts/SUIT-Variable.woff2'), weight: '100 900', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Medium.ttf'), weight: '500', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-SemiBold.ttf'), weight: '600', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Bold.ttf'), weight: '700 900', display: 'block' }),
  ...allFontFiles().map((f) => loadFont({ family: f.family, url: staticFile(f.file), weight: f.weight ?? '400 900', display: 'block' })),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`서체 등록 실패 — 틀의 새편.mjs로 public/fonts를 채웠는지 본다. ${String(e)}`);
  });
