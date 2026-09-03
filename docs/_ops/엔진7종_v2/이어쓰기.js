// 절 하나를 「새로 쓰는」/「이어 채우는」 에이전트 프롬프트를 통째로 뱉는다.
// 사용: node docs/_ops/엔진7종_v2/이어쓰기.js §4        (프롬프트 하나)
//       node docs/_ops/엔진7종_v2/이어쓰기.js 남은것     (남은 절 목록과 권고 순서만)
//
// 왜 있나 — 09-04 실측: 을(정본 몸통)이 30KB 를 넘는 절은 「절 하나 = 에이전트 하나」로 전부 죽었다.
// 통과 7절의 을은 5~22KB, 실패·미착수 10절의 을은 34~58KB. 그래서 큰 절은 두 번에 나눠 쓰고,
// 두 번째 에이전트에게는 자.js 가 찍어 준 «빠진 것 목록»을 그대로 넘긴다.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const W = path.resolve(__dirname);
const REPO = path.resolve(W, '../../..');

const 갑뼈대 = new Set(['§0', '§3', '§4', '§5', '§10', '§11', '§12', '§16']);
const 큰절 = 30000; // 을 바이트. 넘으면 한 에이전트로 안 끝난다(09-04 실측).

function 재기(sec) {
  const 을 = W + '/재료/을/' + sec + '.md';
  const v2 = W + '/v2/' + sec + '.md';
  if (!fs.existsSync(을)) return null;
  const 을B = fs.statSync(을).size;
  const v2B = fs.existsSync(v2) ? fs.statSync(v2).size : 0;
  let 자출력 = '';
  let 통과 = false;
  if (v2B) {
    try {
      자출력 = execFileSync(process.execPath, [W + '/자.js', sec], { cwd: REPO, encoding: 'utf8' });
      통과 = 자출력.startsWith('✅');
    } catch (e) {
      자출력 = (e.stdout || '') + (e.stderr || '');
    }
  }
  return { sec, 을B, v2B, 자출력: 자출력.trim(), 통과 };
}

const 절들 = Array.from({ length: 17 }, (_, i) => '§' + i);

if ((process.argv[2] || '') === '남은것') {
  const 잰것 = 절들.map(재기).filter(Boolean);
  const 남음 = 잰것.filter((r) => !r.통과);
  console.log('=== 남은 절 ' + 남음.length + ' / ' + 잰것.length + ' ===\n');
  for (const r of 남음.sort((a, b) => b.v2B - a.v2B)) {
    const 갈래 = r.v2B === 0 ? '미착수' : '반제품 ' + Math.round((r.v2B / r.을B) * 100) + '%';
    const 무게 = r.을B > 큰절 ? '큰 절(두 번에 나눈다)' : '한 번에 된다';
    console.log(`${r.sec.padEnd(4)} ${갈래.padEnd(12)} 을 ${r.을B}B · ${무게}`);
  }
  console.log('\n권고 순서: 반제품 먼저(정본에 섞이면 자가 못 잡는 자리가 생긴다) → 미착수.');
  console.log('프롬프트: node docs/_ops/엔진7종_v2/이어쓰기.js §N');
  process.exit(0);
}

const sec = process.argv[2];
if (!sec || !/^§\d{1,2}$/.test(sec)) {
  console.error('절을 준다: node docs/_ops/엔진7종_v2/이어쓰기.js §4  (또는 「남은것」)');
  process.exit(2);
}
const r = 재기(sec);
if (!r) { console.error(sec + ' 의 재료(을)가 없다.'); process.exit(2); }
if (r.통과) { console.log(sec + ' 은 이미 ✅ 통과다. 다시 띄우지 않는다.'); process.exit(0); }

const 뼈대 = 갑뼈대.has(sec) ? '갑' : '을';
const 뼈대설명 = 뼈대 === '갑'
  ? '**갑 뼈대** — 갑의 소절 순서·표 꼴을 따른다. 내용은 을 전량 + 심사가 「갑에서 가져올 것」으로 꼽은 것.'
  : '**을 뼈대** — 을의 순서를 그대로 두고 문장만 갈아입힌다. 갑에서 가져올 것은 제자리에 넣는다.';
const 이어쓰기냐 = r.v2B > 0;
const 큰가 = r.을B > 큰절;

const 머리 = 이어쓰기냐
  ? `저장소 C:/Users/q1212/Documents/SYNK-appsscript 에서 「엔진 7종 상향 설계 v2」의 절 ${sec} 을 **이어 채운다**.
이미 있는 \`docs/_ops/엔진7종_v2/v2/${sec}.md\`(${r.v2B}B)는 앞 세션이 쓰다 만 반제품이다. **지우고 새로 쓰지 말고 이어 채운다.**`
  : `저장소 C:/Users/q1212/Documents/SYNK-appsscript 에서 「엔진 7종 상향 설계 v2」의 절 ${sec} 을 새로 쓴다.`;

const 빠진것 = r.자출력
  ? `\n## 지금 무엇이 빠져 있나 — 기계 자가 찍어 준 목록이다. 이것을 채우는 것이 이 일이다\n\`\`\`\n${r.자출력}\n\`\`\`\n각 이름은 을(\`재료/을/${sec}.md\`) 원문의 제자리에서 가져온다. 이름을 우리말로 갈아 끼우지 않는다. 백틱째 그대로 두고 옆에 괄호로 뜻을 단다.\n`
  : '';

const 큰절처방 = 큰가
  ? `\n## 🔴 이 절은 크다(을 ${r.을B}B) — 한 번에 쓰려다 죽은 절이다
09-04 실측: 을이 30KB 를 넘는 절은 「한 번에 쓰기」로 전부 죽었다. 뼈대만 쓰고 끊기거나, 이름 수십 개를 흘렸다.
그래서 **반드시 이렇게 쓴다**:
1. 소제목 전부(U 번호와 결론 줄)를 먼저 Write 로 저장한다. 이때 내용은 비운다.
2. **U 하나를 채울 때마다 Edit 로 저장한다.** 여러 U 를 모아서 한 번에 쓰지 않는다.
3. 절반쯤 채웠을 때 \`node docs/_ops/엔진7종_v2/자.js ${sec}\` 을 한 번 돌려 본다. 남은 분량을 그때 가늠한다.
4. 힘이 모자라면 **거짓으로 끝내지 말고** 최종 답에 「U몇까지 채웠다 · 남은 U 는 무엇」을 적는다. 다음 에이전트가 그 자리에서 잇는다.
`
  : '';

console.log(`${머리}

먼저 규칙 파일 \`docs/_ops/엔진7종_v2/규칙.md\` 를 전문으로 읽는다. 지키는 것·옷(문장 자)·뼈대·쓰는 법이 전부 거기 있다.

재료 셋을 전문으로 읽는다:
- \`docs/_ops/엔진7종_v2/재료/을/${sec}.md\` (${r.을B}B · **정본 몸통** · 내용의 정본)
- \`docs/_ops/엔진7종_v2/재료/갑/${sec}.md\` (Opus 판 · 문장 자의 본보기 · 「가져올 것」의 출처)
- \`docs/_ops/엔진7종_v2/재료/심사_${sec}.md\` (눈가림 심사 51 이 이 절에 적은 것 · 「갑에서 가져올 것」과 「틀림」 목록)

이 절의 뼈대 = ${뼈대설명}
${큰절처방}${빠진것}
## 놓치기 쉬운 것 둘 — 09-04 에 실제로 밟은 자리다
1. **「안 재봤다」를 지우지 않는다.** 다듬다 보면 지우기 쉬운 말로 보인다. 그런데 그것이 「0건」과 갈리는 자리다. 실패한 다섯 절에서 전부 줄었다(§3 은 3→0 · §15 는 13→6). 을에 있는 수만큼 v2 에도 있어야 한다.
2. **URL 을 흘리지 않는다.** 정찰 근거 링크는 표나 각주에서 조용히 빠진다. §15 는 39개를 흘렸다. 을에 있는 링크는 전부 v2 에 있어야 한다.

## 산출과 끝맺음
산출은 하나: \`docs/_ops/엔진7종_v2/v2/${sec}.md\`. 다른 파일은 만들지도 고치지도 않는다.
다 쓰면 저장소 루트에서 \`node docs/_ops/엔진7종_v2/자.js ${sec}\` 을 돌려 ✅ 가 나올 때까지 고친다(🔴 목록이 곧 고칠 것).
최종 답(반환값) = 규칙 §4 의 한 단락 꼴: 「${sec} ✅ 또는 🔴 · v2 바이트 · 줄당 평균 · 갑에서 가져온 것 · 고친 틀림 · 못 한 것(있으면 어디까지 했고 무엇이 남았는지)」. 인사·서론 없음.`);
