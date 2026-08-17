#!/usr/bin/env node
// citation-guard — 문서에 «지금 쓰려는» `파일:줄` 인용이 거짓이면 편집 직전에 알린다. (F350 처방)
//
// 왜 있나: 「file:line 을 인용한 실측 주장」이 세 번째로 거짓이었다(F348→F350). 급소는 틀렸다는
//   사실이 아니라 **증상이 없다**는 것이다 — 줄번호를 달고 있어서 다음 독자가 재지 않고 그대로
//   인용하고, 그 위에 설계 판정이 선다(실측: 처분표의 거짓 주장이 설계 정본으로 전파됐다).
//
// 🔑 판정은 여기서 안 한다 — `tools/인용검사.js` 하나가 진다(같은 판정을 두 곳에 적으면 갈라지고,
//   갈라지는 방향은 언제나 「통과」다). 이 훅은 **발동 조건**만 맡는다.
//
// 🔑 왜 여기(편집 직전)인가 — 커밋 훅(`.git/hooks/pre-commit`)은 **git 밖이라 안 퍼진다**.
//   그 층은 이 기계에서만 돌고, 다른 기계·클라우드 세션에서는 통째로 죽는다(F044 ① 형태).
//   이 훅은 저장소에 실려 모든 세션에서 발화한다.
//
// **차단하지 않는다** — doc-propagation 과 같은 판단이다. 차단하면 「인용을 지워 통과」가 가장 싼
//   길이 되고, 그건 근거를 없애는 방향이다(F103·F384: 정직하게 적을수록 벌받으면 관습이 죽는다).
//   여기서 막을 것은 실수가 아니라 «안 재고 적음»이라, 재게 만드는 것으로 족하다.
'use strict';
const fs = require('fs');
const path = require('path');

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0);
}

function 나가기(문구) {
  if (문구) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 문구 },
    }));
  }
  process.exit(0);
}

try {
  const ti = (input && input.tool_input) || {};
  const rel = String(ti.file_path || '').replace(/\\/g, '/');
  if (!rel.endsWith('.md')) 나가기(null);

  /* 새로 쓰려는 텍스트만 본다 — Write 는 통째로, Edit 는 바뀌는 조각만. */
  const 조각 = [];
  if (typeof ti.content === 'string') 조각.push(ti.content);
  if (typeof ti.new_string === 'string') 조각.push(ti.new_string);
  if (Array.isArray(ti.edits)) {
    for (const e of ti.edits) if (e && typeof e.new_string === 'string') 조각.push(e.new_string);
  }
  if (!조각.length) 나가기(null);

  const ROOT = path.resolve(__dirname, '..', '..');
  const 검사 = require(path.join(ROOT, 'tools', '인용검사.js'));
  const { 저장소들 } = require(path.join(ROOT, 'tools', 'lib', '보드낡음.js'));

  /* 역사 문서(심문결과·장부·아카이브·보드·이력)는 면제 — 그쪽은 줄번호가 낡은 것이 정상이다.
   * 🔑 목록은 도구에서 «가져온다». 여기 다시 적으면 그게 두 번째 정본이다.
   *
   * 🔑 상대경로는 **바로 위에서 구한 `ROOT`** 에서 낸다 — 저장소 «이름»을 문자열로 자르면
   *   워크트리에서 면제가 통째로 죽는다: 워크트리는 `…/SYNK-appsscript/.claude/worktrees/<가지>/`
   *   아래라 첫 조각이 걸려 `.claude/worktrees/<가지>/docs/_ops/보드/…` 가 나오고, 면제 목록은
   *   `docs/_ops/보드/` 접두로 재기 때문이다(실측 08-17: 같은 보드 파일이 master 🟢 / 워크트리 🔴).
   *   CLAUDE.md 가 코드 트랙에 워크트리를 «의무»로 만든 뒤라, 보드·마찰신호·인계문을 고칠 때마다
   *   거짓 경고가 떴다 — 맞는 행동에 뜨는 경고는 무시를 정상 통로로 만든다(F103 축).
   *   이름 하드코딩은 다른 이름으로 클론한 기계·클라우드에서도 같은 방향으로 샌다(F044 ①).
   * ⚠ 면제를 «넓히지» 않는다 — 형제 저장소(SYNK-talk) 문서는 고치기 전과 똑같이 검사된다.
   *   가드가 새는 방향은 언제나 「통과」라, 안 재본 자리를 면제로 여는 것은 이 트랙 몫이 아니다. */
  const 워크트리접두 = /^\.claude\/worktrees\/[^/]+\//;
  const 저장소상대 = (path.isAbsolute(rel) ? path.relative(ROOT, rel) : rel)
    .replace(/\\/g, '/')
    .replace(워크트리접두, ''); /* 메인 체크아웃의 훅이 워크트리 파일을 볼 때도 같은 문서다 */
  if (검사.면제인가(저장소상대)) 나가기(null);

  const 저 = 저장소들(ROOT);
  const 색인 = 검사.색인만들기(저);
  const 읽기캐시 = new Map();
  const 읽기 = (절대) => {
    if (읽기캐시.has(절대)) return 읽기캐시.get(절대);
    let v;
    try { v = fs.readFileSync(절대, 'utf8'); } catch (_) { v = null; }
    읽기캐시.set(절대, v);
    return v;
  };

  const 적색 = [];
  let 분모 = 0;
  for (const t of 조각) {
    for (const p of 검사.문서판정(t, (경로) => 검사.파일풀기(경로, 저, 색인), 읽기)) {
      분모 += 1;
      if (p.수준 === '적색') 적색.push(`   · \`${p.인용.원문}\` — ${p.사유}`);
    }
  }
  if (!적색.length) 나가기(null);

  나가기([
    `🔴 [인용검사] 지금 쓰는 문서의 \`파일:줄\` 인용 ${적색.length}건이 **그 자리를 안 가리킨다**`,
    `   (잰 인용 ${분모}건 · 판정 = tools/인용검사.js · F350: 이 형태가 세 번째다)`,
    ...적색,
    '',
    '→ 셋 중 하나다: **고친다** · **인용을 지운다** · **「그 층엔 없다」까지만 적는다**.',
    '   ⚠ 「없다」는 판정은 값이 살 수 있는 층을 «먼저 열거하고» 그 전부를 연 뒤에만 쓴다(F348).',
    '   ⚠ 낫표 「…」 안에 «옮겨 적은» 남의 말은 이미 면제된다 — 이 경고는 지금 하는 주장에만 뜬다.',
  ].join('\n'));
} catch (_) {
  /* 가드가 스스로 죽어 편집을 막으면 안 된다 — 여기서 막을 것은 망각이지 실수가 아니다. */
  process.exit(0);
}
