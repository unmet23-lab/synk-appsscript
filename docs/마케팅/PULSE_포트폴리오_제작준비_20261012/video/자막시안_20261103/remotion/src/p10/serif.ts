// 10번 명조 — Noto Serif KR(OFL)을 자막 글자만 잘라 쓴다(2026-11-08, Claude). 공용 lib/fonts에 넣지 않는 까닭: 남의 판 렌더가 이 파일을 찾지 않게.
//   만들기: C:/Windows/Fonts/NotoSerifKR-VF.ttf → fontTools subset(자막 글자 + 숫자 · 라틴) → public/fonts/NotoSerifKR-p10.woff2(git 밖, 굵기 200~900 가변).
//   자막 글이 바뀌면 다시 자른다 — 빠진 글자는 다른 글꼴로 떨어진다.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const SERIF = "'Noto Serif KR P10', 'SUIT', serif";

const handle = delayRender('serif-p10');
loadFont({ family: 'Noto Serif KR P10', url: staticFile('fonts/NotoSerifKR-p10.woff2'), weight: '200 900', display: 'block' })
  .then(() => continueRender(handle))
  .catch((e) => {
    throw new Error(`명조 등록 실패 — public/fonts/NotoSerifKR-p10.woff2를 먼저 만든다(serif.ts 머리 설명). ${String(e)}`);
  });
