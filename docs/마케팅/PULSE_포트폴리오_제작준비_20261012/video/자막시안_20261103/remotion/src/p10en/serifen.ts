// 10번 도담중공업 영어 판 명조 — Noto Serif KR(OFL)의 라틴 글자만 잘라 쓴다(2026-11-17, Claude). 한국어 판 serif.ts와 같은 까닭으로 공용 lib/fonts에 넣지 않는다.
//   만들기: python -m fontTools.subset C:/Windows/Fonts/NotoSerifKR-VF.ttf --unicodes="U+0020-007E,U+00B7,U+2018-201D,U+2014,U+2013,U+2026"
//           --flavor=woff2 --layout-features='*' --output-file=<public>/fonts/NotoSerifKR-p10en.woff2   (public = git 밖 최종/자막시안_public, 굵기 200~900 가변)
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const SERIF_EN = "'Noto Serif KR P10EN', serif";

const handle = delayRender('serif-p10en');
loadFont({ family: 'Noto Serif KR P10EN', url: staticFile('fonts/NotoSerifKR-p10en.woff2'), weight: '200 900', display: 'block' })
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`명조 등록 실패 — public/fonts/NotoSerifKR-p10en.woff2를 먼저 만든다(serifen.ts 머리 설명). ${String(e)}`);
  });
