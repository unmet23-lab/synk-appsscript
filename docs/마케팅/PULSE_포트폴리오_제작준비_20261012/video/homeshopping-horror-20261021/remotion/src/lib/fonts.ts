// 서체 등록. 못 받으면 렌더가 멈춘다(조용히 다른 서체로 나오는 것보다 낫다).
// 홈쇼핑 화면은 장면 속 소품이라 굵고 촌스러운 Black Han Sans · Anton(SIL OFL), 끝 문구만 우리 서체 SUIT · Inter Tight.
// Black Han Sans에는 「·」「●」「★」「▶」가 없다 — 점 · 별은 도형으로 그리고 가운뎃점은 SUIT로 넘어가게 둔다.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const HS = "'Black Han Sans', 'SUIT', sans-serif";
export const HS_EN = "'Anton', 'Black Han Sans', sans-serif";
export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const EN = "'Inter Tight', 'SUIT', sans-serif";
// 콘티 v3 공포 대사 자막 — 가는 명조(Noto Serif KR, SIL OFL · 지유 광고 서체 시안에서 유호님 「여기에는 명조가 낫네」)
export const SERIF = "'Noto Serif KR', serif";

const handle = delayRender('fonts');
Promise.all([
  loadFont({ family: 'Black Han Sans', url: staticFile('fonts/BlackHanSans-Regular.ttf'), weight: '400', display: 'block' }),
  loadFont({ family: 'Anton', url: staticFile('fonts/Anton-Regular.ttf'), weight: '400', display: 'block' }),
  loadFont({ family: 'SUIT', url: staticFile('fonts/SUIT-Variable.woff2'), weight: '100 900', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-SemiBold.ttf'), weight: '600', display: 'block' }),
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-Bold.ttf'), weight: '700 900', display: 'block' }),
  loadFont({ family: 'Noto Serif KR', url: staticFile('fonts/NotoSerifKR-VF.ttf'), weight: '200 900', display: 'block' }),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`서체 등록 실패 — node 준비.mjs 를 먼저 돌린다. ${String(e)}`);
  });
