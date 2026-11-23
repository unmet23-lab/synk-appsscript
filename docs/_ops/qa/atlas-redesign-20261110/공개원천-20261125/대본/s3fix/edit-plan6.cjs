'use strict';
// 계획 §6 5: ③ (나) · (2-2) 11-25 · 5-3 켜는 공개(설계 주인 11-23 조건 5 · (ㄱ) · 2단 알림 자리).  node edit-plan6.cjs <단계4_계획.md>
const fs = require('node:fs');
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 90)}`); s = s.replace(f, () => eol(repl)); };

rep(`셋째는 Fable P1(라이브 app-shell의 드라마 초대장 ad9723d)로 지금 main 위에서 다시 짓는다.
   - 5-2.`, `셋째는 Fable P1(라이브 app-shell의 드라마 초대장 ad9723d)로 지금 main 위에서 다시 짓는다.
     - 설계 주인 11-23 아침 (나). ③은 꺼진 판에서 닿지 않는 열일곱 파일(엔진 다섯 — \`atlas/0.1.0/\` 셋과 \`atlas/loader.*\` 둘, 새 길 모듈 열둘)을 빼고 남는 열여섯만 싣는다. 남는 파일의 P1(검수 -s3d)은 ③ 전에 고쳤다. 캐시 섞임은 「옛 이름은 옛 뜻, 새 뜻은 새 이름」으로 막는다. 셸 명령 \`exam-start\`와 알림 옵션 \`canMock\`은 옛 뜻이고, 새 뜻은 \`exam-check\` · \`mockNow\`다. 생활 화면은 옛 진도에 \`reviewHelped\`가 없으면 옛 뜻으로 읽는다. ③은 두 번에 나눠 올린다. (1) 토큰 없는 모듈 열하나(새 파일 world-month-answer 포함, 검수 \`atlas-world-step1-pub-20261123-s3e1\`) → 10분 → (2) app-shell · home.css · HTML 셋(\`-s3e2\`). (2)의 app-shell이 (1)의 world-month-answer를 부르므로 (2)는 (1)의 바이트가 라이브와 같아진 뒤에 올린다. 뺀 열일곱을 남는 파일이 정적으로 부르지 않는 것은 시험 atlas-next-off가 지킨다. 깃발이 잘못 켜져 입구가 404인 장면은 브라우저로 쟀다. 부르는 곳은 모두 옛 길로 가고, 셸은 입구 첫 실패를 계기에 한 번 남긴다(\`load\` · \`ENTRY_IMPORT\`, 시험 atlas-next-life-shell).
   - 5-2.`);
rep(`생활 층은 아래 1단계 켜기 차례의 켜기 전 공개에 싣는다. 2단계 뒤 부르는 쪽이 없어지는 \`world/world-life-engine.mjs\` · \`world/world-speaking-engine.mjs\`는 옛 계정 묶음을 캐시에 둔 기기가 부르므로 지우지 않는다(걷어 내기는 4-9).
   - 두 단계 모두:`, `생활 층은 아래 1단계 켜기 차례의 켜기 전 공개에 싣는다. 2단계 뒤 부르는 쪽이 없어지는 \`world/world-life-engine.mjs\` · \`world/world-speaking-engine.mjs\`는 옛 계정 묶음을 캐시에 둔 기기가 부르므로 지우지 않는다(걷어 내기는 4-9).
     - 설계 주인 11-23 답. 지도 22는 엔진과 함께 5-3에 싣는다. 허용 목록은 지금 넓히지 않는다. (2-2)는 생성물 셋(계정 · 생활 묶음 · 생활 css)의 한 사슬이다. (2-1) GC1은 ③ 뒤 같은 창(11-24)에 06시 전에 시작할 수 있을 때만 올린다. (2-2)는 11-25 02시 창으로 옮긴다. 까닭은 ③ P1 고침을 묶음에 싣기 위함이다. ③ 고침이 master에 오른 뒤 그 커밋에서 묶음 셋을 다시 짓는다(되돌림 목록은 그대로). 허용 목록은 새 명세 해시 하나로 바꾸고 spec-2-2k의 해시를 뺀다. 이 한 줄 변경은 (2-2) 사슬 배경에 적고 검수에 넣는다. 꺼진 판 대조(상태 여섯 × 390 · 1440)와 재확인 계정(1 · 7 · 30일) 대조를 새 후보로 다시 한다. 게임 세션(4-6e)이 생활 묶음의 입력을 바꾸는 커밋을 올리면 그 커밋도 바탕에 넣어, (2-2) 사슬의 원천 차이에 보이게 한다.
   - 5-3. **켜는 공개(6~8의 깃발보다 먼저).** ③ 뒤에 깃발만 켜서는 새 길이 서지 않는다(설계 주인 11-23 — 「③ 뒤 켜기는 깃발 하나」를 고친다). 깃발 전에 따로 올릴 것은 다섯이다. ① 엔진 판 폴더 0.1.0과 지도 22. ② 새 길 모듈 열둘(world-atlas-next · world-practice-next · world-today · world-position-next · world-diagnostic-next · world-mock-next · world-position-next-view · world-plan-next · world-lookback-next · world-me-next · world-old-engine-doors · world-atlas-game). ③ 계정 묶음의 새 함수(watchLifeDue · lifeReviewCandidate · prepareAtlasTrail). ④ 게임 폴더 아홉의 atlas-next 키트. ⑤ 2단 알림 WORLD 클라이언트 다섯(world-push · world-reminder-device · app-shell 15줄 · world-account · world-account.bundle — 설계 주인 11-23, 가지 \`claude/atlas-2step-push-world\`는 (2-2)가 라이브가 된 뒤 master에 합친다. app-shell과 world-reminder-device는 ③ 고침과 겹쳐, 합칠 때 서버 세션이 ③ 위로 옮기고 섞임 막기 규칙을 지킨다).
     - ③에서 뺀 파일의 P1 13건은 5-3 전에 고치고 그 파일만 다시 검수한다. 엔진 B1 · GB1~GB4, 입구 E1 · E2 · GE1 · GE2, 새 길 모듈 GD2 · GF1 · GH3 · GI1이다. 이 가운데 B1 · GB2는 설계대로로 닫았다(-s3d 지적표 처리 칸).
     - 5-3도 캐시 섞임 표를 짓고 같은 규칙으로 막는다. 섞임 표에 2단 알림 다섯 파일을 넣는다.
     - PC 4배 느림에서 답 저장 p95가 195ms로 목표 100ms를 넘는다. 이것이 켜기를 막는다. ③과 2단계 공개 뒤에 직렬화 · IndexedDB · 접기로 나눠 재고 100ms 아래로 낮춘다. 실제 휴대폰은 맨 끝에 유호님이 한 번 잰다.
   - 두 단계 모두:`);
fs.writeFileSync(file, s);
console.log('계획 §6 고침');
