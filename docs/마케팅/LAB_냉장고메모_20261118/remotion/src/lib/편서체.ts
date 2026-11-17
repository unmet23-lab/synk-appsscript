// 이 편만의 서체 — 틀 파일(src/lib/fonts.ts)은 고치지 않고 여기서 따로 등록한다(작업 자리 「시작」 5).
// 나눔손글씨 펜(OFL) — 룸메이트가 날려 쓴 메모와 빨간 펜 뜻 줄. E29 · E41과 같은 파일.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const PEN = "'Nanum Pen Script', 'SUIT', sans-serif";

const handle = delayRender('pen-font');
loadFont({ family: 'Nanum Pen Script', url: staticFile('fonts/NanumPenScript-Regular.ttf'), weight: '400', display: 'block' })
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`나눔손글씨 펜 등록 실패 — public/fonts/NanumPenScript-Regular.ttf가 있는지 본다. ${String(e)}`);
  });
