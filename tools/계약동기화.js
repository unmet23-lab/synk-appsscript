#!/usr/bin/env node
/**
 * 계약 파일을 형제 저장소에 같은 바이트로 넣는다 (계약/*.json 전량)
 *
 * 왜 있나 — 이 파일의 `고치는_법`은 프로즈였다: "두 저장소 모두에 같은 바이트로 넣는다".
 *   그리고 c1 시절 실제로 갈라졌다(픽스처 「불변」이 한쪽에만 있었고 양쪽 회귀가 둘 다 못 봤다).
 *   손복사는 6KB JSON을 사람이 옮기는 일이라 언젠가 한 글자가 어긋난다 — 기계로 옮긴다.
 *
 * 정본 = 이 저장소. 형제(SYNK-talk)는 언제나 사본이다.
 *   tests/계약.test.js 가 **탐지**를 지고, 이 도구가 **수정**을 진다(탐지와 수정이 같은 손이면 둘 다 못 믿는다).
 *
 * 쓰는 법:
 *   node tools/계약동기화.js           형제에 덮어쓴다
 *   node tools/계약동기화.js --check   같은지만 보고 다르면 종료코드 1 (고치지 않는다)
 *
 * ⚠ 형제가 이 기계에 없으면 **조용히 통과시키지 않고** 그 사실을 말하고 끝낸다(종료코드 0).
 *   CI엔 형제가 없다 — 통과와 미실행이 같은 모양이면 안 된다.
 *
 * 🔑 **목록을 손으로 적지 않는다** — `계약/` 안의 `.json` 전량이 대상이다(2026-08-12).
 *   둘째 계약(`문법급수_계약.json`)이 생기던 날 손 목록으로 늘리려다 접었다: 셋째를 더하는
 *   손이 이 파일을 여는 것을 기억해야 하고, 안 열면 **새 계약만 조용히 동기화 밖에 남는다**
 *   (그 침묵이 정확히 이 도구가 막으려던 것이다 — 훅도 `--check` 만 부르므로 같이 샌다).
 */
'use strict';
const fs = require('fs');
const path = require('path');
/* 표기 접기의 정의는 저장소에 하나뿐이다 — `tests/lib/소스검사.js` 의 `표기접기`. 손으로 접으면
 * CRLF 축만 막히고 «줄끝 공백» 축은 그대로 샌다: 08-17 실측에서 도구층의 손 접기 12벌이
 * **전부** 그 반쪽이었다(#Q101). 도구가 tests/ 를 건너 부르는 것은 이미 선 통로다
 * (`tools/lib/시트도달.js`·`tools/실행층점검.js` 가 먼저 썼다). */
const { 표기접기 } = require('../tests/lib/소스검사.js');

const REPO = path.join(__dirname, '..');
const 계약폴더 = '계약';
/* 형제 자리도 통로가 하나다 — 손으로 `REPO/../SYNK-talk` 를 적으면 **워크트리에서 `..` 이
 * `worktrees/` 를 가리켜** 「형제가 이 기계에 없다」로 조용히 건너뛴다(아래 60행). 코드 트랙은
 * 규약상 워크트리에서 짓는다(CLAUDE.md) — 즉 계약 동기화가 정작 필요한 판에서 안 돌았다. */
const 형제저장소 = require(path.join(REPO, '.claude', 'hooks', 'lib', '형제저장소.js'));
const 형제뿌리 = 형제저장소.형제경로(REPO);

/** 동기화 대상 상대경로들 — 이름순(출력 순서를 기계로 고정). */
function 대상들() {
  const dir = path.join(REPO, 계약폴더);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(계약폴더, f));
}

// 표기를 접고 본다 — 이 저장소는 autocrlf=true 라 CRLF일 수 있고, 형제는 언제나 LF다.
// 거짓 경보를 내는 가드는 곧 꺼진다. 표기 차이는 계약의 분열이 아니다(회귀도 같은 기준).
const 읽기 = (p) => fs.readFileSync(p, 'utf8');
const 정규화 = 표기접기;

function main(argv) {
  const check = argv.includes('--check');
  const 목록 = 대상들();

  if (목록.length === 0) {
    console.error(`정본이 없다: ${path.join(REPO, 계약폴더)} 에 .json 이 0개다`);
    return 2;
  }
  if (!fs.existsSync(형제뿌리)) {
    console.log(`형제 저장소 SYNK-talk가 이 기계에 없다 — 동기화 건너뜀 (${형제뿌리})`);
    return 0;
  }

  let 갈라짐 = 0;
  let 넣음 = 0;
  for (const 상대 of 목록) {
    const 정본 = path.join(REPO, 상대);
    const 형제 = path.join(형제뿌리, 상대);
    const 원 = 정규화(읽기(정본));

    // 형제에 «없는» 것도 갈라짐이다 — 새 계약이 저쪽에 안 서면 저쪽 회귀는 그 값을 아예 못 본다.
    if (fs.existsSync(형제) && 정규화(읽기(형제)) === 원) continue;

    갈라짐 += 1;
    if (check) {
      console.error(`계약이 갈라졌다: ${상대}${fs.existsSync(형제) ? '' : ' (형제에 없다)'}`);
      continue;
    }
    // 형제는 언제나 LF다(SYNK-talk .gitattributes `* text=auto eol=lf`).
    // CRLF를 그대로 밀어넣으면 그쪽 커밋마다 전 줄이 바뀐 것으로 보인다.
    fs.mkdirSync(path.dirname(형제), { recursive: true });
    fs.writeFileSync(형제, 원, 'utf8');
    console.log(`형제에 정본을 넣었다 → ${형제}`);
    넣음 += 1;
  }

  if (갈라짐 === 0) {
    console.log(`계약 동일 ✓ ${목록.length}개 (줄바꿈 제외) — ${목록.join(' · ')}`);
    return 0;
  }
  if (check) {
    console.error(`  ${목록.length}개 중 ${갈라짐}개가 다르다 — \`node tools/계약동기화.js\` 로 형제에 정본을 넣어라`);
    return 1;
  }
  console.log(`⚠ ${넣음}개를 넣었다 — 형제 저장소에서도 커밋해야 계약이 계약이 된다.`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, 대상들 };
