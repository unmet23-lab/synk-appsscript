#!/usr/bin/env node
/**
 * 제미나이LM 묶음 생성기 — repo 정본에서 제미나이LM 업로드 폴더를 **생성**한다.
 * (2026-08-22 개명: 구글이 「노트북LM」을 이 이름으로 바꿨다. 폴더 이름 자체는 안 바꿨다 —
 *  아래 DEFAULT_OUT 주석 참고.)
 *
 * 왜 생성기인가:
 *   `docs/AI_스택_가이드.md` §1-5의 잠금 3개 중 하나가 「사본에 만든 날짜를 박는다 —
 *   사본을 손으로 관리하지 않는다」다. 손으로 올린 묶음은 스스로 낡음을 모르고,
 *   낡은 사본이 출처를 찍어 답하면 그게 정확히 「정본 분열」이다.
 *   → 다시 돌리면 폴더 전체가 새로 만들어진다(harness-export.js와 같은 정신).
 *
 * 사용:
 *   node tools/geminilm-export.js           # 바탕화면\SYNK_노트북LM 에 생성
 *   node tools/geminilm-export.js --out <경로>
 *   node tools/geminilm-export.js --dry     # 무엇을 쓸지·무엇이 막히는지만 출력
 *
 * ⛔ 이 폴더는 **외부(구글 계정)로 나간다.** harness-export와 위험의 층이 다르다 —
 *    거긴 내 디스크 안이고 여긴 업로드다. 그래서 이름이 아니라 **내용까지** 검사한다.
 *    학생 개인정보·제3자 연락처·자격증명이 한 줄이라도 있으면 그 파일을 통째로 뺀다.
 *
 * require 시에는 아무것도 만들지 않는다 — 회귀 테스트가 { scanPII, DEFAULT_OUT }만
 * 물어본다. 생성 실행은 CLI 직접 호출뿐.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
// 하네스 경로는 손으로 조립하지 않는다 — 이 자리엔 이 기계 이름이 박혀 있었다(F206).
const MEM = require('./memory-graph.js').memoryDir();
// 폴더 이름은 「SYNK_노트북LM」 그대로 둔다 — geminilm-drive.js 의 같은 주석 참고
// (제미나이LM 쪽이 이미 이 이름을 소스로 물고 있을 수 있어, 여기서 바꾸면 조용히 갱신이 끊긴다).
const DEFAULT_OUT = path.join(os.homedir(), 'OneDrive', 'Desktop', 'SYNK_노트북LM');

// ── 담지 않을 폴더 (경로 단위) ──────────────────────────────────────────
// _archive·_구본 = 낡은 판. 제미나이LM이 낡은 판을 출처로 찍어 답하는 것이
// 이 묶음의 최대 위험이라 아예 안 넣는다. 보안 폴더는 사업 기밀.
const DENY_DIR = [
  /[\\/]_archive([\\/]|$)/, /[\\/]_구본([\\/]|$)/, /[\\/]SYNK 보안([\\/]|$)/,
  /[\\/]node_modules([\\/]|$)/, /[\\/]worktrees([\\/]|$)/,
];

// ── 내용 게이트 ─────────────────────────────────────────────────────────
// 정책: 「사람이 실제로 쓰는 표기」로 잡되, 알려진 안전값은 리터럴로 통과시킨다.
// 화이트리스트를 안 두면 공개 업체 대표번호 하나 때문에 판정 이력이 통째로 빠지고,
// 그렇게 헛돌기 시작한 게이트는 곧 --force 로 꺼진다.
const ALLOW = [
  'unmet23@gmail.com', 'unmet27@gmail.com', '77yuhbs@gmail.com',  // 유호님 본인 계정
  'info@qpay.mn', '+976 7610 2211',                                // QPay 공개 고객센터
  // SYNK 공개 연락처 — 둘 다 개인정보처리방침에 **게시된** 주소다(비공개 개인정보가 아니다)
  'hello@synk.im',                                                 // 삭제·철회 접수 창구
  'founder@synk.im',                                               // 개인정보 관리 책임자(양유호)
  'demo0X@synk.test',                                              // 문서용 더미
];

const PII = [
  { name: '휴대폰번호',   re: /01[016-9][-. ]?\d{3,4}[-. ]?\d{4}/g },
  { name: '몽골 전화번호', re: /\+?976[-. ]?\d{4}[-. ]?\d{4}/g },
  { name: '주민등록번호', re: /\b\d{6}-[1-4]\d{6}\b/g },
  { name: '카드번호',     re: /\b(?:\d{4}[- ]){3}\d{4}\b/g },
  { name: '이메일',       re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  // ⚠ 자격증명은 길이를 **고정하지 않는다** — 하한만 둔다.
  //   `AIza…{35}` + `\b` 로 못박았더니 한 글자 긴 값이 경계에서 미끄러져 **그냥 통과**했다
  //   (이 파일의 회귀 테스트가 잡은 실결함). 비밀값 게이트는 실패 방향이 「차단」이어야 한다.
  //   접두어도 고정하지 않는다 — 구글이 `AIza…` 말고 **`AQ.…` 형식**으로도 발급한다(08-05 실물 확인).
  //   접두어를 하나만 적으면 새 형식이 조용히 통과한다 — 같은 「실패 방향이 통과」 계열.
  { name: 'API 키',       re: /(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{30,})/g },
  { name: '텔레그램 토큰', re: /\b\d{8,12}:[A-Za-z0-9_-]{30,}/g },
];

/**
 * 본문에서 개인정보·자격증명 후보를 찾는다.
 * @returns {{kind:string, value:string, line:number}[]}  빈 배열이면 통과
 */
function scanPII(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const { name, re } of PII) {
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(re)) {
        if (ALLOW.includes(m[0].trim())) continue;
        hits.push({ kind: name, value: m[0], line: i + 1 });
      }
    }
  }
  return hits;
}

// ── 수집 ────────────────────────────────────────────────────────────────
/* ⚠ 거부 판정은 **걷는 뿌리 기준 상대경로**로 한다 — 절대경로에 걸면 뿌리 자체가 인질이 된다.
 * 실측(2026-08-05): 워크트리 세션의 REPO 는 `…\.claude\worktrees\<이름>\` 아래라, `worktrees`
 * 거부 규칙이 docs **전량**을 걸러 수집이 조용히 0이 됐다(같은 코드가 메인 트리·CI에선 초록). */
function walk(dir, out = [], base) {
  const root = base || dir;
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (DENY_DIR.some((re) => re.test(path.sep + path.relative(root, p)))) continue;
    if (e.isDirectory()) walk(p, out, root);
    else if (e.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out;
}

// 제미나이LM은 **폴더 구조를 잃는다** — 업로드하면 파일명만 남는다.
// 그래서 출처가 어디서 왔는지를 파일명이 스스로 말하게 한다.
const flatName = (prefix, rel) =>
  `${prefix}__${rel.replace(/[\\/]/g, '__')}`;

// 톱레벨에 둔 이유: rot-check(주간 부패 점검)가 「묶음을 만든 뒤 원천이 몇 개 바뀌었나」를
// 세려면 원천 목록을 알아야 한다. 생성기 안에 가둬두면 그 점검을 다시 쓸 수 없다.
const SOURCE_ROOTS = [
  { prefix: '기억', root: MEM, label: '판정 이력(memory)' },
  { prefix: '문서', root: path.join(REPO, 'docs'), label: '정본 문서(docs)' },
];

function main() {
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry');
  const outIdx = args.indexOf('--out');
  const OUT = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT;

  const today = new Date().toISOString().slice(0, 10);
  const log = (s) => console.log(s);

  log(`제미나이LM 묶음 생성 — 만든 날 ${today}`);
  log(`대상: ${OUT}${DRY ? '  [DRY RUN]' : ''}\n`);

  // 정본 버전 (묶음이 어느 판에서 나왔는지)
  const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  const mVer = claudeMd.match(/\*\*(v[\d.]+)\s*·\s*([\d-]+)\*\*/);
  const VER = mVer ? `${mVer[1]} (정본일 ${mVer[2]})` : '(버전 미검출)';

  const banner = (원본경로) => `> ⚠ **사본이다 — 정본이 아니다.**
> **만든 날: ${today}** · 지침 ${VER}
> 원본 = SYNK-appsscript 저장소 \`${원본경로}\`
> 다시 만들기: 저장소에서 \`node tools/geminilm-export.js\`
>
> ⛔ **여기서 결정하지 않는다.** 이 묶음의 답은 **재료지 판정이 아니다** —
> 확정은 저장소의 정본과 대조한 뒤에만. 이 사본은 만든 날 이후 갱신되지 않는다.

---

`;

  const sources = SOURCE_ROOTS;

  if (!DRY && fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });   // 재생성이므로 통째로 새로
    log('  (기존 폴더를 지우고 새로 만든다 — 이 폴더는 언제나 생성물이다)\n');
  }
  if (!DRY) fs.mkdirSync(OUT, { recursive: true });

  let written = 0;
  const blocked = [];

  for (const { prefix, root, label } of sources) {
    const files = walk(root);
    log(`${label} — ${files.length}개 후보`);
    for (const abs of files) {
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      const body = fs.readFileSync(abs, 'utf8');
      const hits = scanPII(body);
      if (hits.length) {
        blocked.push({ prefix, rel, hits });
        continue;
      }
      const name = flatName(prefix, rel);
      if (!DRY) fs.writeFileSync(path.join(OUT, name), banner(`${prefix === '기억' ? 'memory' : 'docs'}/${rel}`) + body, 'utf8');
      written++;
    }
  }

  // ── 제외 목록도 묶음 안에 쓴다 ─────────────────────────────────────────
  // 터미널 출력은 스크롤로 사라진다. 「무엇이 빠졌는지」가 묶음 안에 있어야
  // 나중에 제미나이LM이 답을 못 할 때 「없는 것」과 「빠진 것」을 구분할 수 있다.
  const 제외본문 = `# 이 묶음에서 **빠진** 파일 (${blocked.length}개)

> 만든 날 ${today} · 자동 생성 — 손으로 고치지 말 것

개인정보·제3자 연락처·자격증명이 본문에 있어 **업로드에서 제외**했다.
제미나이LM이 이 주제를 못 답하면 「자료가 없어서」가 아니라 「일부러 뺐기 때문」이다.

| 원본 | 걸린 것 | 줄 | 값 |
|---|---|---|---|
${blocked.length === 0 ? '| — | (없음) | — | — |' :
  blocked.flatMap(({ prefix, rel, hits }) =>
    hits.slice(0, 3).map((h) => `| ${prefix}/${rel} | ${h.kind} | ${h.line} | \`${h.value}\` |`)
  ).join('\n')}

**안전한 값으로 판명되면** \`tools/geminilm-export.js\`의 \`ALLOW\` 목록에 그 값을
그대로 추가하고 다시 돌린다(파일 단위 예외가 아니라 **값 단위 예외** — 파일을 통째로
통과시키면 그 파일에 나중에 들어올 진짜 개인정보까지 함께 통과한다).
`;
  if (!DRY) fs.writeFileSync(path.join(OUT, '_빠진_파일.md'), 제외본문, 'utf8');

  const 안내 = `# SYNK 제미나이LM 묶음 — 올리는 방법

> **만든 날 ${today}** · 지침 ${VER} · 자료 **${written}개** (제외 ${blocked.length}개)
> ⚠ 이 안내의 접속 URL·상한 개수는 「노트북LM」시절 값을 그대로 옮긴 것이다(2026-08-22) —
> 구글이 이름을 제미나이LM으로 바꾼 뒤 실제 화면에서 달라졌으면 그대로 따르면 된다.

## 이 묶음의 자리 (왜 만드는가)
**클로드 한도가 찼을 때의 조회 창구.** 제미나이LM은 클로드 한도를 **0** 쓴다.
능력 경쟁이 아니라 **결손 보전** — 정본 = \`docs/AI_스택_가이드.md\` §1-5.

## 올리는 순서
1. 크롬에서 **notebooklm.google.com** 접속 → 구글 계정(Google AI Pro) 로그인
2. 왼쪽 위 **「새로 만들기(Create new)」** 클릭
3. 자료 추가 창이 뜨면 **「파일 업로드」** 선택
4. 이 폴더(\`SYNK_노트북LM\`)를 열고 **Ctrl+A**로 전부 선택 → **열기**
   - 자료 ${written}개 (Plus 상한 300개 이내)
5. 왼쪽 위 노트북 이름을 **\`SYNK 판정이력 ${today}\`** 로 바꾼다
   - 🔑 **이름에 날짜를 넣는 게 핵심이다.** 다음에 다시 만들면 노트북이 2개가 되는데,
     날짜가 없으면 어느 쪽이 최신인지 화면으로 구별할 방법이 없다.

## 쓸 때의 규칙 3개 (이게 없으면 오히려 사고다)
1. ⛔ **여기서 결정하지 않는다.** 답은 재료지 판정이 아니다.
2. ⛔ **학생 데이터·개인정보를 추가로 올리지 않는다.** 이 묶음은 이미 걸러져 있다.
3. ⛔ **답을 정본에 되돌려 쓰지 않는다.** 정본은 저장소 하나뿐 — 반영은 클로드에게 시킨다.

## 다시 만들 때
저장소가 바뀌면 이 묶음은 그날로 낡는다. 클로드에게 **"제미나이LM 묶음 만들어줘"** 라고 하면
이 폴더가 새로 생성된다. 그 뒤 **제미나이LM에서 옛 노트북은 지우고 새로 올린다**
(자료만 갈아끼우면 옛 자료가 남아 섞인다).
`;
  if (!DRY) fs.writeFileSync(path.join(OUT, 'README_먼저읽기.md'), 안내, 'utf8');

  log('');
  log(`✅ 자료 ${written}개 생성${DRY ? ' (예정)' : ''}`);
  if (blocked.length) {
    log(`⛔ 제외 ${blocked.length}개 — 개인정보·자격증명이 본문에 있다:`);
    for (const { prefix, rel, hits } of blocked) {
      const 요약 = [...new Set(hits.map((h) => h.kind))].join('·');
      log(`   ${prefix}/${rel}  [${요약}] 예) ${hits[0].value} (${hits[0].line}줄)`);
    }
    log('   → 안전한 값이면 ALLOW 목록에 값을 추가하고 다시 돌린다.');
  }
  if (!DRY) log(`\n폴더: ${OUT}`);
}

if (require.main === module) main();

module.exports = { scanPII, walk, flatName, DEFAULT_OUT, ALLOW, DENY_DIR, SOURCE_ROOTS };
