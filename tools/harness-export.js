#!/usr/bin/env node
/**
 * 하네스 내보내기 — repo 정본에서 바탕화면 이식 폴더를 **생성**한다.
 *
 * 왜 복사가 아니라 생성기인가:
 *   「붙여넣은 사본은 스스로 낡음을 모른다」(CLAUDE.md 머리말). cowork 사본이 v6.3에
 *   멈춰 v6.11까지 8판 밀린 것이 실측된 마찰이다. 사본을 6벌 만들면 6벌이 낡는다.
 *   → 정본은 언제나 repo 하나. 이 스크립트를 다시 돌리면 폴더 전체가 새로 만들어진다.
 *
 * 사용:
 *   node tools/harness-export.js            # 바탕화면\SYNK_하네스 에 생성
 *   node tools/harness-export.js --out <경로>
 *   node tools/harness-export.js --dry      # 무엇을 쓸지만 출력
 *
 * require 시에는 아무것도 만들지 않는다 — rot-check(주간 부패 점검)가 이식 폴더의
 * 낡음을 재려고 { DEFAULT_OUT, VER, STAMP }만 물어본다. 생성 실행은 CLI 직접 호출뿐.
 *
 * ⛔ 절대 담지 않는 것 (자격증명·머신 종속):
 *   settings.local.json · launch.json · .clasprc.json · 로그인.txt · *비밀번호* · worktrees/
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const outIdx = args.indexOf('--out');
const DEFAULT_OUT = path.join(os.homedir(), 'OneDrive', 'Desktop', 'SYNK_하네스');
const OUT = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT;

// ── 담지 않을 것 (이름 단위 차단 — .gitignore와 같은 정신) ─────────────
const DENY = [
  /settings\.local\.json$/i, /launch\.json$/i, /\.clasprc\.json$/i,
  /로그인\.txt$/i, /비밀번호/i, /password/i, /\.env($|\.)/i, /\.lnk$/i,
];
const denied = (p) => DENY.some((re) => re.test(p));

let written = 0, skipped = 0;
const log = (s) => console.log(s);

function copyFile(src, dst) {
  if (denied(src)) { skipped++; log(`  ⛔ 제외 ${path.basename(src)}`); return; }
  if (DRY) { written++; return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  written++;
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) { log(`  ⚠ 없음: ${src}`); return; }
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else copyFile(s, d);
  }
}

function write(rel, body) {
  const dst = path.join(OUT, rel);
  if (DRY) { written++; log(`  + ${rel} (${body.length}자)`); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, body, 'utf8');
  written++;
}

// ── 정본 읽기 + 버전 추출 (require 시에도 읽기만 한다) ──────────────────
const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
/* 🔴 **꼴이 둘이다 — 하나만 보면 조용히 눈이 먼다**(09-06 실측).
 *   v11.0 개편이 머리줄의 굵게 표시를 걷으면서(`> v11.0 · 2026-09-02 —`) 굵게만 찾던 이 자가
 *   「(버전 미검출)」을 내기 시작했다. 그런데 아무도 안 죽는다 — 이식 폴더 머리말에 그 글자가
 *   그대로 박히고, rot-check 은 그 값으로 낡음을 재므로 **자가 자기 눈이 먼 것을 모른다.**
 *   ⇒ 굵게 판과 머리줄 판을 둘 다 읽고, 그래도 못 읽으면 «침묵하지 않는다»(아래 `버전확인`). */
const mVer = claudeMd.match(/\*\*(v[\d.]+)\s*·\s*([\d-]+)\*\*/)
  || claudeMd.match(/^>\s*\**(v[\d.]+)\s*·\s*([\d-]+)/m);
const VER = mVer ? mVer[1] : '(버전 미검출)';
const VER_DATE = mVer ? mVer[2] : '';
const STAMP = `${VER} · 정본일 ${VER_DATE}`;

/** 버전을 못 읽었으면 **만들지 않는다** — 「미검출」이 박힌 폴더는 낡음을 재는 자를 눈멀게 한다. */
function 버전확인() {
  if (mVer) return;
  console.error('🔴 CLAUDE.md 에서 지침 판을 못 읽었다 — 이식 폴더를 만들지 않는다.');
  console.error('   찾는 꼴 둘: `**v11.0 · 2026-09-02**`(굵게) 또는 머리줄 `> v11.0 · 2026-09-02 —`');
  console.error('   그대로 만들면 폴더 머리말에 「(버전 미검출)」이 박히고, rot-check 이 그 값으로 낡음을 잰다.');
  process.exit(2);
}

// 생성물 머리말 — 파일이 스스로 「나는 사본이다」라고 말하게 한다
const banner = (vendor, entry) => `<!-- 이 파일은 생성물이다. 손으로 고치지 말 것. -->
> ⚠ **이 파일은 사본이다 — 정본이 아니다.**
> 정본 = SYNK-appsscript 저장소의 \`CLAUDE.md\` (**${STAMP}**)
> 다시 만들기: 저장소에서 \`node tools/harness-export.js\`
> 대상: **${vendor}** — 이 도구는 \`${entry}\`를 읽는다.
>
> 아래 본문에서 \`/deploy\`·\`/evolve\`·훅(\`clasp-guard\` 등)·\`Skill\` 도구는 **Claude Code 고유**다.
> 다른 도구에서는 그 조항을 「같은 목적을 사람이 수행한다」로 읽는다(규칙 자체는 벤더 무관).

`;

function main() {
  버전확인();                                            // 못 읽으면 여기서 멈춘다(조용한 「미검출」 금지)
  log(`하네스 내보내기 — 정본 ${STAMP}`);
  log(`대상: ${OUT}${DRY ? '  [DRY RUN]' : ''}\n`);

  if (!DRY && fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });   // 재생성이므로 통째로 새로
    log('  (기존 폴더를 지우고 새로 만든다 — 이 폴더는 언제나 생성물이다)\n');
  }

  // ── 00 정본 ─────────────────────────────────────────────────────────
  log('00_정본/');
  write('00_정본/CLAUDE.md', claudeMd);                                  // Claude Code — 원문 그대로
  write('00_정본/AGENTS.md', banner('GPT Codex · Kimi Code CLI', 'AGENTS.md') + claudeMd);
  write('00_정본/지침_붙여넣기용.md', banner('웹 채팅(Claude.ai · ChatGPT · Gemini) 커스텀 인스트럭션', '설정 화면에 붙여넣기') + claudeMd);

  // ── 01~05 이식물 ─────────────────────────────────────────────────────
  log('01_스킬/');   copyDir(path.join(REPO, '.claude', 'skills'), path.join(OUT, '01_스킬'));
  log('02_훅/');     copyDir(path.join(REPO, '.claude', 'hooks'), path.join(OUT, '02_훅'));
                     copyFile(path.join(REPO, '.claude', 'settings.json'), path.join(OUT, '02_훅', 'settings.json'));
  log('03_에이전트/'); copyDir(path.join(REPO, '.claude', 'agents'), path.join(OUT, '03_에이전트'));
  log('04_메모리_볼트/');
  // 하네스 경로는 손으로 조립하지 않는다 — 이 자리엔 이 기계 이름이 박혀 있었다(F206).
  const MEM = require('./memory-graph.js').memoryDir();
  copyDir(MEM, path.join(OUT, '04_메모리_볼트'));
  log('05_도구/');   copyDir(path.join(REPO, 'tools'), path.join(OUT, '05_도구'));

  // ── 06 브랜드 키트 (색·폰트 정본 + 검증 도구 + 회귀 가드) ─────────────
  // 정본 2종이 뿌리다. 도구는 눈으로 보는 용, 가드는 기계가 지키는 용 — 셋이 한 벌이다.
  log('06_브랜드키트/');
  for (const f of ['docs/디자인_컨셉_정본_v1.md', 'docs/브랜드_폰트_정본.md']) {
    copyFile(path.join(REPO, f), path.join(OUT, '06_브랜드키트', '정본', path.basename(f)));
  }
  const BRAND_TOOLS = [
    'synk_palette.html',            // 킷 팔레트 뷰어
    '브랜드_포스터_컬러.html',
    '브랜드_포스터_폰트.html',
    '트렌디미니멀_색전환_비교.html',
    '표지_AB_코랄vs레드.html',
    '_mn_font_probe.html',          // 몽골 키릴 글리프 실측(ө·ү)
  ];
  for (const f of BRAND_TOOLS) {
    const s = path.join(REPO, 'docs', 'tools', f);
    if (fs.existsSync(s)) copyFile(s, path.join(OUT, '06_브랜드키트', '도구', f));
    else log(`  ⚠ 없음: docs/tools/${f}`);
  }
  for (const f of ['브랜드색.test.js', '브랜드폰트.test.js']) {
    copyFile(path.join(REPO, 'tests', f), path.join(OUT, '06_브랜드키트', '회귀가드', f));
  }

  // ── README ──────────────────────────────────────────────────────────
  write('README.md', `# SYNK 하네스 이식 꾸러미

> **생성물이다.** 정본 = SYNK-appsscript 저장소 · 지침 **${STAMP}**
> 다시 만들기 = 저장소에서 \`node tools/harness-export.js\`
> **이 폴더를 직접 고치지 마십시오.** 고쳐도 다음 생성 때 지워집니다. 고칠 곳은 저장소입니다.

## 무엇이 들어 있나

| 폴더 | 내용 | 성격 |
|---|---|---|
| \`00_정본/\` | CLAUDE.md(원문) · AGENTS.md · 붙여넣기용 | **지침** — 모든 도구의 뿌리 |
| \`01_스킬/\` | deploy · evolve · forge · synk-brand · synk-content | 절차를 문서로 굳힌 것 |
| \`02_훅/\` | board-guard · clasp-guard · doc-propagation · git-scope-guard + settings.json | **기계 강제** — 프로즈로 못 지킨 규칙 |
| \`03_에이전트/\` | reviewer | 컨텍스트 독립 검증자 |
| \`04_메모리_볼트/\` | 판정·결정 이력 (Obsidian 볼트로 바로 열림) | **가장 큰 자산** |
| \`05_도구/\` | bump-version · memory-graph · doc-graph · friction · deploy-security-check · harness-export | 자동화 |
| \`06_브랜드키트/\` | **색·폰트 정본** + 검증 도구 + 회귀 가드 | 아래 별도 설명 |

## 🎨 브랜드 키트 (\`06_브랜드키트/\`)

**정본 2종이 뿌리입니다. 색을 쓸 일이 생기면 여기부터 엽니다.**

| | 파일 | 확정 |
|---|---|---|
| **색** | \`정본/디자인_컨셉_정본_v1.md\` | 「v10 Crew Dossier」 19색 + 「06 Slate」 2색 + 「07 Lime Family」 2색 = **23색** · 신호색 = **Coral \`#FF6B5C\`** |
| **폰트** | \`정본/브랜드_폰트_정본.md\` | **SUIT**(한글) · **Inter Tight**(라틴+몽골 키릴) · **DM Mono**(워드마크) |

**코랄 + 노랑 조합** = 모드 C(2도 겹침): 바탕 Paper \`#FAFAF9\` / 잉크 **KC Sun \`#FFD447\` + Coral \`#FF6B5C\`**, 블렌드 multiply → 겹친 자리가 진한 주황(\`#FF591A\` 계열).
⚠ \`Lime #C8FF3D\`와 헷갈리지 마십시오 — 라임은 **앱 UI의 성장·획득(XP·포인트·스트릭) 전용**이고, 캐러셀·발표물·교재에 등장하면 신호색이 둘이 되어 2색 원칙이 깨집니다.

- \`도구/synk_palette.html\` — 킷 색을 눈으로 봅니다(브라우저로 열기)
- \`도구/_mn_font_probe.html\` — **몽골 고유자 \`ө\`·\`ү\` 실측**. 새 서체는 "키릴 지원"이라고 써 있어도 이 두 글자를 직접 찍어봐야 합니다(글리프가 없으면 폭이 「비슷」이 아니라 **완전 동일**하게 나옵니다)
- \`회귀가드/\` — 색·폰트가 정본에서 밀렸는지 **기계가 검사**합니다. 정본 대비 수치 오류 5곳을 실제로 잡아낸 가드입니다

**🚫 재론 금지 6건**(이미 결론난 것 — 다시 꺼내면 시간만 씁니다): 코랄 5단 운용 · 코랄 메인 확정 · 디더 일상 복귀 · AI 3안 하이브리드 · V9 레드 회귀 · 쿨블루 2도 복귀.

## 도구별 적용

### 1. Claude Code (메인 · 2계정)
할 일 **없음**. 저장소를 열면 \`CLAUDE.md\`·\`.claude/\`를 자동으로 읽습니다.
이 폴더는 **다른 도구에 옮길 때만** 씁니다.

### 2. GPT Codex
\`00_정본/AGENTS.md\`를 **작업할 저장소 최상위에 복사**합니다. Codex는 \`CLAUDE.md\`가 아니라 \`AGENTS.md\`를 읽습니다.
⚠ 07-31에 저장소에서 지운 파일입니다 — 되살리는 것이므로, **정본은 여전히 \`CLAUDE.md\` 하나**임을 잊지 마십시오.

### 3. Kimi Code CLI
같은 \`AGENTS.md\`를 씁니다. 두 곳 중 하나:
- 프로젝트별 → 저장소 최상위 \`AGENTS.md\`
- 전역 → \`~/.kimi-code/AGENTS.md\`
Kimi도 **Agent Skills를 지원**하므로 \`01_스킬/\`이 이식 후보입니다(형식 차이는 옮길 때 확인).

### 4. Obsidian
\`04_메모리_볼트/\` 폴더를 **볼트로 열면 끝**입니다(Open folder as vault).
메모리는 이미 \`[[문서명]]\` 위키링크로 서로 연결돼 있어 **그래프 뷰가 즉시 작동**합니다 — 변환이 필요 없습니다.
⚠ **읽기 전용으로 쓰십시오.** 여기서 고치면 정본과 갈라지고 다음 생성 때 사라집니다.

### 5. Hermes
지침 파일 방식이 아니라 \`~/.hermes/config.yaml\` + \`.env\` 설정형입니다(\`hermes setup\`).
이 꾸러미에서 옮길 것은 **\`00_정본/지침_붙여넣기용.md\`의 본문을 시스템 프롬프트에** 넣는 것뿐입니다.
⚠ API 키는 별도 지갑(종량 과금)입니다.

### 6. Orca
자체 모델을 부르지 않고 각 CLI를 껍데기로 실행합니다 → **각 CLI의 기존 로그인을 그대로 씁니다**(\`~/.claude\` 자동 인식).
따라서 이 꾸러미에서 Orca에 따로 넣을 것은 **없습니다.** 위 1~3을 해두면 Orca가 그걸 그대로 씁니다.

## 💬 "대화를 이어가고 싶다" — 무엇을 붙여넣나

**하네스의 절반은 「규칙」이고 절반은 「기계」인데, 붙여넣기로 옮겨가는 건 규칙뿐입니다.**

| 어디에 | 이어짐 | 해야 할 일 |
|---|---|---|
| **다른 Claude Code 세션**(이 저장소) | ✅ 그대로 | **없음.** 저장소를 열면 자동으로 읽습니다 — 이 폴더는 쓸 일이 없습니다 |
| **다른 컴퓨터의 Claude Code** | ✅ 거의 그대로 | 저장소를 clone + \`04_메모리_볼트/\`를 그 PC의 memory 폴더로(메모리는 git 밖입니다) |
| **웹 Claude · Codex · Kimi** | ⚠ 부분적 | 아래 3개를 붙여넣기 |

### 웹/타 벤더에 붙여넣을 3개 (순서대로)

1. \`00_정본/지침_붙여넣기용.md\` — **어떻게 일하는가**(호칭·판정 기준·검증 규모)
2. \`04_메모리_볼트/MEMORY.md\` — **무엇이 이미 결정됐는가의 지도**(🚫재제안 금지 목록이 여기 있습니다)
3. 그 주제의 메모리 파일 1~2개 — 위 지도에서 골라서

**2번이 실질적으로 가장 중요합니다.** 지침은 "어떻게 일할지"고, 대화를 이어가려면 "무엇이 결정됐는지"가 필요합니다. 지침만 붙여넣으면 이미 기각한 안을 다시 제안받습니다.

### ⚠ 붙여넣어도 따라가지 않는 것

- **훅(기계 강제)** — \`02_훅/\`은 **Claude Code에서만** 작동합니다. 다른 곳에서는 커밋 범위·보드 길이·배포 순서가 **프로즈로 되돌아갑니다.** 프로즈는 같은 사고를 다섯 번 막지 못했습니다(그래서 훅으로 옮긴 것입니다)
- **메모리 자동 열람** — Claude Code는 107개를 필요할 때 엽니다. 웹 채팅은 **붙여넣은 것만** 압니다(107개 661KB는 한 번에 안 들어갑니다)
- **도구 연결** — 파일·git·배포·브라우저가 없으면 「실행」이 아니라 「가이드」가 됩니다

## 🔴 낡음 방지 — 하나만 기억하십시오

**정본은 저장소의 \`CLAUDE.md\` 하나입니다.** 지침이 바뀌면:

\`\`\`
node tools/harness-export.js
\`\`\`

한 번 돌리고, 위 2·3의 복사만 다시 하면 전부 최신이 됩니다.
이 폴더 안의 파일은 **모두 머리말에 정본 버전이 박혀 있어**, 열었을 때 낡았는지 스스로 알 수 있습니다.
(낡음은 저장소 쪽에서도 감시합니다 — \`tools/rot-check.js\` 주간 부패 점검이 이 폴더의 스탬프를 정본과 대조합니다.)

## ⛔ 담지 않은 것 (의도적)

\`settings.local.json\`(머신 종속 권한) · \`launch.json\`(절대경로) · \`.clasprc.json\`·\`로그인.txt\`·\`*비밀번호*\`(**자격증명 — 영구히 git 밖**) · \`.claude/worktrees/\`(14MB 작업 잔여물).
`);

  log(`\n생성 ${written}건 · 제외 ${skipped}건`);
  if (DRY) log('(DRY RUN — 실제로 쓰지 않았다)');
  else log(`완료: ${OUT}`);
}

if (require.main === module) main();
module.exports = { DEFAULT_OUT, VER, STAMP };
