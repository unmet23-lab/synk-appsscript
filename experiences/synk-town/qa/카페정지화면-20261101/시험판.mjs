#!/usr/bin/env node
/**
 * 가게 정지 화면 3장의 검수 · 시험 묶음 (2026-11-01). 0단계 「시험관 폴더」 방식 그대로 — 맥락 없는 시험관마다 폴더를 나누고 폴더 밖은 열지 않게.
 *   흐름 — 세 장을 차례로(나는 누구 · 코치는 누구 · 고른 것이 무엇을 바꾸나 · 내 자리 · 헷갈린 곳 · 몇 살용)
 *   얼굴 — 같은 카운터 화면을 GPT 이미지 2.5 판 / 나노바나나 2.1 판으로(시험관마다 순서를 바꿈) — 0단계 「너무 매끈」 6/6과 견준다
 * Fable 그림 · 화면 검수 묶음도 여기서 모은다(그림 원본 · 화면 · 참고).
 *
 *   node experiences/synk-town/qa/카페정지화면-20261101/시험판.mjs [얼굴2]   (얼굴2 — GPT 판 대 비 오는 나노바나나 판, 새 시험관 폴더)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 카운터, 찍기, 무대만들기 } from './화면.mjs';

const 밖 = process.env.TOWN_CAFE_OUT || path.resolve('C:/Users/q1212/Documents/SYNK-appsscript/.tmp/town-cafe-1-20261101');
const 검수 = path.join(밖, '검수');
const 화면 = (f) => path.join(밖, '화면', f);
const 주소 = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;

// 나노바나나 판 카운터 화면(얼굴 결 시험용) — 같은 글 · 같은 짜임에 무대만 바꾼다.
// 2회차(「얼굴2」): 첫 판(g3)은 맑은 구도 참고를 따라 창밖이 맑게 나와, GPT 비 오는 판에서 머리만 흐린 구도 참고로 다시 구운 talk2를 견준다.
const 회차 = process.argv[2] === '얼굴2' ? 2 : 1;
const nb원본 = 회차 === 2 ? 'counter-talk2-nb_g1.png' : 'counter-talk-nb_g3.png';
const nb화면 = 회차 === 2 ? '02_카운터-nb2.png' : '02_카운터-nb.png';
const nb무대 = 무대만들기(path.join(밖, 'nb', 'out', nb원본), path.join(밖, '화면', '무대', 회차 === 2 ? '카운터말할때-nb2.jpg' : '카운터말할때-nb.jpg'));
await 찍기([{ 파일: 화면(nb화면), html: 카운터(주소(nb무대)) }]);

const 폴더 = (이름) => { const p = path.join(검수, 이름); if (fs.existsSync(p) && fs.readdirSync(p).some((f) => /^답/.test(f))) throw new Error('답이 든 폴더는 덮지 않는다: ' + p); fs.rmSync(p, { recursive: true, force: true }); fs.mkdirSync(p, { recursive: true }); return p; };
const 복사 = (from, to) => fs.copyFileSync(from, to);
const 시험관들 = ['sonnet', 'haiku'];

const 흐름질문 = `# 처음 보는 사람 시험 — 휴대폰 앱 화면 세 장

당신은 한국 대학에 다니는 몽골 출신 유학생(20세)입니다. TOPIK 3급이고, 졸업과 취업에 4급이 필요합니다. 친구가 「한국어 공부 앱」이라며 같은 날의 화면 세 장을 보내 줍니다. 이 앱이나 만든 회사에 대해 다른 것은 아무것도 모릅니다.

- 이 폴더의 그림 세 장을 차례로 엽니다: 정지컷_01.jpg(아침) → 정지컷_02.jpg → 정지컷_03.jpg(저녁). 같은 사람의 같은 하루입니다. 1과 2 사이에 다른 화면이 하나 있었지만 받지 못했습니다.
- 소리는 없습니다. 화면의 글과 사진만 봅니다.
- 이 폴더 밖의 파일 · 폴더는 열거나 찾지 마세요(작업 폴더 목록도 보지 마세요). 인터넷도 쓰지 마세요.
- 짐작으로 답해도 됩니다. 모르면 「모름」이라고 쓰세요.

## 질문

1. 이 앱에서 「나」는 누구이고, 무엇을 하나요? 한두 문장.
2. 화면 3의 「코치」는 누구인가요? 이야기 속 사람인가요, 이야기 밖의 사람인가요?
3. 화면 1에서 내가 고른 것이 그날 · 다음 날에 무엇을 바꿨나요?
4. 내 자리(역할)는 지금 무엇이고, 다음에는 무엇이 될 수 있나요?
5. 헷갈린 곳: 화면 번호와 무엇이 헷갈렸는지. 없으면 「없음」.
6. 헷갈림 점수: 1(아주 분명하다) ~ 5(아주 헷갈린다).
7. 이 앱은 몇 살쯤을 위한 것 같나요? (예: 7~10세, 중고생, 대학생 · 성인)
8. TOPIK 4급을 준비하는 나에게 도움이 될 것 같나요? 1(전혀) ~ 5(아주) + 까닭 한 줄.
9. 내일 이 앱을 다시 열고 싶나요? 1(전혀) ~ 5(꼭) + 까닭 한 줄.
10. 사진이 AI로 만든 티가 나는 곳이 있나요? 화면 번호와 자리(없으면 「없음」).

## 답 꼴

\`\`\`
1. …
2. …
3. …
4. …
5. …
6. (숫자)
7. …
8. (숫자) — …
9. (숫자) — …
10. …
\`\`\`
`;

const 얼굴질문 = `# 처음 보는 사람 시험 — 같은 게임 화면 두 판

당신은 휴대폰 게임과 한국 드라마를 즐겨 보는 20대입니다. 처음 보는 한국어 공부 게임의 같은 화면을 두 가지 판으로 봅니다(사진만 다릅니다). 다른 것은 모릅니다.

- 이 폴더의 그림 두 장을 엽니다: 정지컷_A.jpg · 정지컷_B.jpg.
- 사진 아래 흰 글(손님의 말)은 실제 게임에서는 그 사람의 목소리로 들립니다. 이 시험에는 소리가 없습니다.
- 이 폴더 밖의 파일 · 폴더는 열거나 찾지 마세요(작업 폴더 목록도 보지 마세요). 인터넷도 쓰지 마세요.
- 사진을 꼼꼼히 봐 주세요. 짐작으로 답해도 됩니다.

## 질문

1. 판마다 사진이 AI로 만든 티가 얼마나 나나요? 1(실제로 찍은 사진 같다) ~ 5(AI 티가 심하다). A · B 각각 숫자, 그리고 AI 티가 난 자리.
2. 손님 얼굴 · 피부가 실제 사람 같나요? 1(실제 사람 같다) ~ 5(너무 매끈하다 · 화보 · 광고 사진 같다). A · B 각각 숫자 + 한 줄.
3. 빛(창밖 · 조명 · 얼굴의 밝기)이 자연스러운가요? A · B 각각 한 줄.
4. 사진 속 상황(날씨 · 시간 · 손님이 왜 왔는지)이 화면 글과 맞나요? A · B 각각 한 줄.
5. 손님이 말하는 목소리가 붙어도 어색하지 않을 것 같나요? 1(아주 어색) ~ 5(아주 자연스러움). A · B 각각.
6. 둘 중 실제 드라마 촬영 장면 같은 쪽은? 「A」 또는 「B」 + 까닭 한 줄.

## 답 꼴

\`\`\`
1. A (숫자) · B (숫자) — …
2. A (숫자) · B (숫자) — …
3. A … / B …
4. A … / B …
5. A (숫자) · B (숫자)
6. A/B — …
\`\`\`
`;

if (회차 === 1) for (const 누구 of 시험관들) {
  const p = 폴더(`시험-흐름/${누구}`);
  ['01_문열기', '02_카운터', '03_마감'].forEach((f, i) => 복사(화면(`${f}.png`), path.join(p, `정지컷_0${i + 1}.jpg`)));
  fs.writeFileSync(path.join(p, '질문.md'), 흐름질문);
}
// 얼굴 — sonnet은 A=GPT, haiku는 A=나노바나나(순서 바꿈). 답 풀이는 짝표.json
const 짝 = {};
const 얼굴폴더 = 회차 === 2 ? '시험-얼굴2' : '시험-얼굴';
시험관들.forEach((누구, i) => {
  const p = 폴더(`${얼굴폴더}/${누구}`);
  const [a, b] = i === 0 ? ['02_카운터.png', nb화면] : [nb화면, '02_카운터.png'];
  복사(화면(a), path.join(p, '정지컷_A.jpg'));
  복사(화면(b), path.join(p, '정지컷_B.jpg'));
  fs.writeFileSync(path.join(p, '질문.md'), 얼굴질문);
  짝[누구] = { A: /nb/.test(a) ? '나노바나나 2.1' : 'GPT 2.5', B: /nb/.test(b) ? '나노바나나 2.1' : 'GPT 2.5' };
});
fs.writeFileSync(path.join(검수, 얼굴폴더, '짝표.json'), JSON.stringify(짝, null, 1));
// 시험관이 PNG를 .jpg 이름으로 받지 않게 실제 JPEG로
for (const d of [얼굴폴더, ...(회차 === 1 ? ['시험-흐름'] : [])]) for (const 누구 of 시험관들) {
  for (const f of fs.readdirSync(path.join(검수, d, 누구)).filter((x) => x.endsWith('.jpg'))) {
    const 파일 = path.join(검수, d, 누구, f);
    const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; from PIL import Image; im = Image.open(sys.argv[1]); im.convert("RGB").save(sys.argv[1], "JPEG", quality=90)', 파일], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('JPEG 바꾸기 실패: ' + r.stderr);
  }
}
console.log('[시험판] 시험관 폴더 →', 검수, JSON.stringify(짝));
