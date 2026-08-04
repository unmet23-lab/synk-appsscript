#!/usr/bin/env node
/* codex-review — 이종 벤더(GPT/Codex) 적대 검수 러너
 *
 * 왜 이종인가: 같은 벤더 에이전트끼리는 **블라인드스팟이 상관된다**(2026-07-10 판정).
 *   내가 내 코드를 리뷰하면 내가 못 보는 것은 리뷰에서도 안 보인다. 2026-08-05 실측이 이걸
 *   그대로 보여줬다 — 내가 **변이 테스트로 내 회귀의 구멍을 찾아 고친** 커밋(fff91f0)에서
 *   Codex 가 테스트 격리 결함을 하나 더 찾아냈다(tests/배포판점검.test.js PATH 격리).
 *
 * ■ 이 도구가 지키는 불변식 하나
 *   「라이브로 나가는 바이트가 검수를 받았는가」 — 커밋 메시지도 절차 기억도 아니라 **내용 지문**으로 건다.
 *   지문은 `배포판점검.지문()` 을 그대로 쓴다(새로 정의하지 않는다 — 같은 판정을 두 곳에 적으면
 *   갈라지고 갈라지는 방향은 언제나 「통과」다). 파일이 한 바이트라도 바뀌면 지문이 바뀌어
 *   옛 검수 기록이 자동으로 무효가 된다.
 *
 * ■ 통과와 미실행을 절대 같은 모양으로 두지 않는다
 *   종료 코드 0=차단급 0건 · 1=차단급 지적 있음 · 2=**확인 불가**(codex 없음·로그인 만료·타임아웃·
 *   스키마 파싱 실패). 2 를 0 으로 접으면 「안 돌았는데 초록」이 되는데, 그게 이 저장소가
 *   가장 여러 번 데인 형태다. 그래서 파싱 실패에 산문 폴백을 두지 않았다 — 폴백은 조용히
 *   「지적 0건」을 만들어내고, 그건 거짓 초록이다.
 *
 * ■ 기각 이력이 노이즈를 회차마다 줄인다
 *   내가 검토해서 기각한 지적은 `검수기각.jsonl` 에 사유와 함께 남고 **다음 검수 프롬프트에 먹인다.**
 *   안 그러면 같은 지적이 매번 오고 내가 매번 다시 판단한다 — 그럼 검수는 상시 세금이 되지
 *   감가하는 비용이 안 된다.
 *
 * 사용 (유호님 설계 3단 파이프라인 · 2026-08-05):
 *   ① node tools/codex-review.js --제안           # 설계 선파악 — 기능지도 + 업그레이드 제안(sol/max)
 *   ② node tools/codex-review.js --제안판정 <키> --채택 [--사유 ".."]   # 클로드가 제안을 판정
 *      node tools/codex-review.js --제안판정 <키> --기각 --사유 "왜"    # 기각은 다음 회차에 안 올라온다
 *   ③ node tools/codex-review.js                  # 최종 검수 = 버그 사냥 + 기능 전수 체크
 *
 *   대상 지정: (기본) 미커밋 있으면 그것, 없으면 HEAD / --commit <sha> / --base <브랜치> / --uncommitted
 *   픽 전환:   --검수 luna   (기본 sol · 선택지·근거 = tools/모델정책.js)
 *   빠르게:    --버그만      (기능 전수 체크 생략 — 유호님 「빠르게」 모드)
 *   지적 기각: --기각 <키> --사유 "왜 기각했는지"
 *   게이트 조회: --확인      (검수 안 돌림·부작용 0)
 */
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));
const 프로젝트 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'clasp-project.js'));

/* 장부 경로 — env 로 갈아끼울 수 있다. 회귀가 **픽스처로 탐지력을 못 박기** 위해서다
 * (실저장소 장부로 시험하면 「지금 마침 지적이 없어서」 초록인지 「검사가 죽어서」 초록인지 안 갈린다).
 * 우회 수단이 되지는 않는다 — env 를 세울 수 있는 사람은 CLASP_GUARD_BYPASS 도 세울 수 있고,
 * 그쪽이 이미 **의식적인** 정식 레버다. */
const 기록경로 = process.env.SYNK_REVIEW_LEDGER || path.join(ROOT, 'docs', '_ops', '검수기록.jsonl');
const 기각경로 = process.env.SYNK_REVIEW_REJECTS || path.join(ROOT, 'docs', '_ops', '검수기각.jsonl');
const 제안경로 = process.env.SYNK_REVIEW_PROPOSALS || path.join(ROOT, 'docs', '_ops', '검수제안.jsonl');
const 스키마경로 = path.join(__dirname, 'codex-review.schema.json');
const 제안스키마경로 = path.join(__dirname, '검수제안.schema.json');
const 기능체크스키마경로 = path.join(__dirname, '기능체크.schema.json');

/* 차단급 — P0(라이브 데이터 손상·보안) · P1(배포 전 반드시). P2/P3 는 알리되 막지 않는다.
 * 등급을 넓히면 사람이 우회를 배운다(v6.11) — 막는 것은 정말 막아야 하는 것만. */
const 차단급 = new Set(['P0', 'P1']);

// ─────────────────────────────────────────────────────────────── 공용

const jsonl = (p) => {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try { return JSON.parse(l); } catch (_) { return null; }
    })
    .filter(Boolean);
};

const append = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8');
};

/* 지적 키 — 같은 지적이 회차를 넘어 같은 것으로 인식되게 하는 손잡이.
 * 파일+제목으로 만든다(등급은 뺀다 — 같은 결함에 회차마다 다른 등급이 붙을 수 있고,
 * 그때 기각이 풀리면 기각의 뜻이 사라진다). 제목은 공백·대소문자를 눌러 정규화한다. */
function 키(f) {
  const norm = String(f.제목 || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(String(f.파일 || '') + '\0' + norm).digest('hex').slice(0, 12);
}

/* 프로젝트별 지문 — 지금 이 순간 라이브로 나갈 바이트의 지문이다.
 *
 * 🔴 **검수한 것과 지문이 같은 것을 가리킬 때만 기록한다.** 2026-08-05, 이 도구를 이 도구로
 *   검수하다가 잡힌 P1 결함이다(첫 실전 검수의 첫 지적):
 *     `--commit <sha>` 로 검수하는 동안 작업본에 **다른** 미커밋 배포 파일 변경이 있으면,
 *     검수된 것은 그 커밋인데 기록되는 지문은 **작업본**이다. 그러면 게이트는 검수된 적 없는
 *     작업본 바이트를 「검수됨」으로 읽고 통과시킨다 — 정확히 이 게이트가 막으려던 미탐이다.
 *   그래서 대상과 작업본이 어긋나면 그 프로젝트의 지문을 **아예 안 적는다.** 빠진 지문은
 *   게이트에서 `none`(알림)이 되므로, 모르는 것은 「모름」으로 나타난다. */
function 유효지문(대상) {
  const dirty = 미커밋파일들();
  let head = '';
  try { head = git(['rev-parse', 'HEAD']); } catch (_) {}

  const out = {};
  for (const p of 점검.claspProjects()) {
    const 이름 = path.relative(ROOT, p).replace(/\\/g, '/') || '(루트)';
    const 더러움 = dirty.some((f) => 프로젝트.isDeployFile(f, p, ROOT));
    /* uncommitted = 작업본 자체가 검수 대상이라 언제나 일치한다.
     * base/commit = 커밋된 상태를 검수한 것이라, 작업본에 그 프로젝트의 미커밋 배포 변경이
     *   있으면 어긋난다. commit 은 추가로 **그 커밋이 곧 HEAD** 여야 한다(옛 커밋을 검수하고
     *   지금 작업본을 「검수됨」이라 부르면 안 된다). */
    const 일치 =
      대상.종류 === 'uncommitted' ? true :
      대상.종류 === 'base' ? !더러움 :
      !더러움 && head && 대상.값 === head;
    if (!일치) continue;
    try { out[이름] = 점검.지문(p, ROOT); } catch (_) { /* 못 읽는 프로젝트는 빼둔다(없는 지문을 지어내지 않는다) */ }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────── 대상

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/* 미커밋(스테이지·비스테이지·미추적) 파일 목록.
 * core.quotepath=false — 끄지 않으면 한글 파일명이 이스케이프돼 매칭이 통째로 빗나간다
 * (이 저장소 배포 파일 상당수가 한글이라 이 한 줄이 없으면 「깨끗함」으로 보인다). */
function 미커밋파일들() {
  return git(['-c', 'core.quotepath=false', 'status', '--porcelain'])
    .split('\n').filter(Boolean)
    .map((l) => { let p = l.slice(3).trim(); const a = p.indexOf(' -> '); if (a !== -1) p = p.slice(a + 4).trim(); return p.replace(/^"|"$/g, ''); });
}

/* 검수 대상 결정 + 그 대상이 건드린 파일 목록.
 * 파일 목록이 필요한 이유: **어느 clasp 프로젝트가 실제 검수 범위였는지**를 기록해야
 * 「루트만 검수하고 crewcard 를 배포」가 통과로 보이지 않는다(미탐 방향 차단). */
function 대상결정(argv) {
  const i = (k) => argv.indexOf(k);
  if (i('--commit') !== -1) {
    const sha = argv[i('--commit') + 1];
    if (!sha) throw new Error('--commit 뒤에 커밋 해시가 없다');
    return { 종류: 'commit', 값: sha, flags: ['--commit', sha], 파일들: git(['-c', 'core.quotepath=false', 'show', '--name-only', '--format=', sha]).split('\n').filter(Boolean) };
  }
  if (i('--base') !== -1) {
    const br = argv[i('--base') + 1];
    if (!br) throw new Error('--base 뒤에 브랜치명이 없다');
    return { 종류: 'base', 값: br, flags: ['--base', br], 파일들: git(['-c', 'core.quotepath=false', 'diff', '--name-only', br + '...HEAD']).split('\n').filter(Boolean) };
  }
  if (i('--uncommitted') !== -1) return { 종류: 'uncommitted', 값: '(미커밋)', flags: ['--uncommitted'], 파일들: 미커밋파일들() };

  // 기본값 — 미커밋이 있으면 그것, 없으면 HEAD. **무엇을 골랐는지 항상 출력한다**(조용한 선택 금지).
  const d = 미커밋파일들();
  if (d.length) return { 종류: 'uncommitted', 값: '(미커밋)', flags: ['--uncommitted'], 파일들: d };
  const sha = git(['rev-parse', 'HEAD']);
  return { 종류: 'commit', 값: sha, flags: ['--commit', sha], 파일들: git(['-c', 'core.quotepath=false', 'show', '--name-only', '--format=', sha]).split('\n').filter(Boolean) };
}

/* 검수 범위에 든 clasp 프로젝트 — 대상 diff 가 그 프로젝트의 **배포 파일**을 건드렸는가. */
function 범위(파일들) {
  const out = [];
  for (const p of 점검.claspProjects()) {
    const 이름 = path.relative(ROOT, p).replace(/\\/g, '/') || '(루트)';
    if (파일들.some((f) => 프로젝트.isDeployFile(f, p, ROOT))) out.push(이름);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────── 업그레이드 제안 층 (2026-08-05 유호님 설계)

/* 유호님이 정한 검수 파이프라인의 1단이다:
 *   ① 검수자(sol/max)가 변경의 **설계·기능을 선파악**해 기능지도 + 업그레이드 제안을 낸다 (--제안)
 *   ② 클로드가 제안마다 채택/기각을 **판정**하고 장부에 남긴다 (--제안판정)
 *   ③ 채택이면 구현 후, 기각이면 원래 방향 그대로 → 최종 검수(버그 + 기능 전수 체크)로 간다
 *
 * ■ 제안은 **절대 배포를 막지 않는다.** 차단으로 만들면 codex 없는 폰 클라우드 경로가 통째로
 *   죽는다 — 「따를 수 없는 처방」의 재생산이다(F103). 제안 없음·제안 미판정은 게이트와 무관하다.
 * ■ 기각된 제안은 다음 제안 프롬프트에 「다시 내지 마라」로 실린다 — 지적 기각 이력과 같은 축
 *   (재제안 방지). 지적과 달리 이건 codex 쪽에서도 걸러진다: 제안 단계는 `exec`(커스텀 프롬프트
 *   가능)라 기각 이력을 **먹일 수 있다.** review 단계가 못 먹이는 것과 갈리는 지점(위 막다른 길). */

const 제안키 = (p) => {
  const norm = String(p.제목 || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // 지적 키와 네임스페이스를 가른다('제안\0') — 같은 문구라도 지적 기각이 제안을 못 지우게.
  return crypto.createHash('sha256').update('제안\0' + norm).digest('hex').slice(0, 12);
};

/* 장부(제안됨→채택/기각 판정 누적)를 키별 최신 상태로 접는다.
 * 판정은 키에 대해 **영구**다 — 같은 제안이 다시 올라와도(재제안 행) 앞선 채택/기각을 지우지 않는다.
 * 지우면 기각의 뜻(다시 보지 않는다)이 사라진다. */
function 제안현황(경로) {
  const 상태 = new Map();
  for (const r of jsonl(경로 || 제안경로)) {
    if (!r.키) continue;
    if (r.종류 === '제안') {
      const 이전 = 상태.get(r.키);
      상태.set(r.키, { ...r, 상태: 이전 && 이전.상태 !== '제안됨' ? 이전.상태 : '제안됨', 사유: 이전 ? 이전.사유 : undefined });
    } else if (r.종류 === '판정' && 상태.has(r.키)) {
      상태.set(r.키, { ...상태.get(r.키), 상태: r.상태, 사유: r.사유 });
    }
  }
  return 상태;
}

/* 대상 diff 를 프롬프트에 **인라인**한다 — 에이전트가 스스로 git 을 돌리게 두면 무엇을 읽었는지
 * 확정할 수 없다. 너무 크면 통계+파일 목록으로 접고 「직접 읽어라」로 넘긴다(읽기 전용이라 안전). */
const 디프상한 = 180000;
function 디프수집(대상) {
  let d = '';
  if (대상.종류 === 'commit') d = git(['-c', 'core.quotepath=false', 'show', 대상.값]);
  else if (대상.종류 === 'base') d = git(['-c', 'core.quotepath=false', 'diff', 대상.값 + '...HEAD']);
  else {
    d = git(['-c', 'core.quotepath=false', 'diff', 'HEAD']);
    // 미추적 파일은 diff 에 안 나온다 — 전문을 붙인다(새 파일이 제안 대상의 핵심인 경우가 많다)
    const 미추적 = git(['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
    for (const f of 미추적) {
      try {
        const 본문 = fs.readFileSync(path.join(ROOT, f), 'utf8');
        d += `\n--- 미추적 새 파일: ${f} ---\n${본문.length > 40000 ? 본문.slice(0, 40000) + '\n…(잘림)' : 본문}`;
      } catch (_) { d += `\n--- 미추적 새 파일: ${f} (읽기 실패 — 직접 읽어라) ---`; }
    }
  }
  if (d.length > 디프상한) {
    return `(diff 가 ${d.length.toLocaleString()}자로 상한을 넘어 접었다 — 아래 파일들을 저장소에서 직접 읽어라)\n파일 목록:\n` +
      대상.파일들.map((f) => '  - ' + f).join('\n');
  }
  return d;
}

/* 앱의 방향 정본 — 유호님 확정 4개년 로드맵(2026-08-05 "gpt에도 내 계획을 알아야 할 것 같아").
 * 검수자가 방향을 모르면 업그레이드 제안이 아무 데나 향한다 — 그래서 선파악·기능체크 프롬프트에
 * 매번 실린다. 파일이 없으면 **없다고 크게 말한다**(조용히 방향 없이 돌면 그게 미탐이다). */
const 방향경로 = path.join(ROOT, 'docs', '제품방향.md');
const 방향상한 = 6000;
function 방향텍스트() {
  try {
    const t = fs.readFileSync(방향경로, 'utf8').trim();
    return t.length > 방향상한 ? t.slice(0, 방향상한) + '\n…(상한 초과로 잘림 — docs/제품방향.md 를 압축하라)' : t;
  } catch (_) {
    console.error('⚠ docs/제품방향.md 가 없다 — 검수자가 앱의 방향을 모른 채 제안한다(만들어라).');
    return '';
  }
}
const 방향블록 = (방향) => (방향 ? `\n앱의 방향 (유호님 확정 — 제안과 판정은 이 방향에 복무해야 하고, 어긋나는 제안은 내지 마라):\n${방향}\n` : '');

function 제안프롬프트(diff텍스트, 기각제목들, 방향) {
  return `당신은 SYNK 저장소의 이종 검수자다. 지금은 **설계 선파악 단계**다 — 버그를 찾지 마라(그건 다음 단계다).
아래 변경의 설계와 기능을 정밀히 파악한 뒤 두 가지를 내라:

1) 기능지도 — 이 변경이 새로 만들거나 바꾸는 기능 **전부**. 빠뜨리지 마라 — 최종 검수가 이 지도로 전수 체크한다.
2) 업그레이드 제안 — 이 변경을 기능적으로 한 단계 올릴 **구체적** 제안. 실제로 값어치 있는 것만 —
   억지 제안·장식을 위한 장식 금지. 진짜 없으면 빈 배열이 옳은 답이다.
   각 제안의 크기: 소=1시간 내 · 중=반나절 · 대=하루 이상 또는 방향 전환.
${방향블록(방향)}
${기각제목들.length ? `이미 기각된 제안 — **같은 것을 다시 내지 마라**:\n${기각제목들.map((t) => '  · ' + t).join('\n')}\n` : ''}
--- 변경 내용 ---
${diff텍스트}`;
}

function 기능체크프롬프트(diff텍스트, 채택제안들, 방향) {
  return `당신은 SYNK 저장소의 이종 검수자다. 지금은 **기능 전수 체크 단계**다 — 방금 구현이 끝난 변경이다.
아래 변경이 만들거나 바꾸는 기능을 **하나도 빠짐없이** 스스로 나열하고, 각각 실제로 그 일을 하는지 판정하라
(정상 / 의심 / 깨짐 + 코드 근거). 목록은 diff 에서 직접 뽑아라 — 남이 준 목록을 믿지 말고 전수를 다시 세라.
방향에 어긋나는 설계를 발견하면 「의심」으로 표시하고 근거에 어느 조항과 어긋나는지 적어라.
${방향블록(방향)}
${채택제안들.length ? `이번에 채택돼 함께 구현됐어야 하는 업그레이드 — 실제로 구현됐는지도 각각 체크에 넣어라:\n${채택제안들.map((t) => '  · ' + t).join('\n')}\n` : ''}
--- 변경 내용 ---
${diff텍스트}`;
}

/* 기능체크 결과를 지적으로 변환 — 게이트·기각 레버·재발 필터를 **한 통로**로 태우기 위해서다.
 * 깨짐 = 차단급(P1): 기능이 의도대로 안 도는 채 배포되는 것이 이 게이트가 막는 바로 그것.
 * 의심 = P3(알림): 막지 않는다 — 의심을 차단으로 만들면 사람이 우회를 배운다. */
function 기능체크지적들(체크) {
  return (체크 || [])
    .filter((c) => c.판정 === '깨짐' || c.판정 === '의심')
    .map((c) => ({
      등급: c.판정 === '깨짐' ? 'P1' : 'P3',
      파일: '(기능체크)',
      라인: 0,
      제목: `기능 ${c.판정}: ${c.기능}`,
      근거: c.근거 || '',
      수정방향: c.판정 === '깨짐' ? '기능을 고치고 재검수하거나, 오판이면 사유와 함께 기각' : '확인해 보고 문제면 고친다',
    }));
}

/* codex exec + 스키마 직행 한 번 — 제안·기능체크 공용. `exec` 는 스키마를 지키므로(실측)
 * 2단계 구조화가 필요 없다. 실패는 전부 확인 불가(2)로 드러난다. */
function 스키마실행(프롬프트, 스키마, timeoutMs, 라벨) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-'));
  const out = path.join(임시, 'out.json');
  codex(['exec', ...잠금플래그, ...모델플래그(모델설정.분석), '--output-schema', 스키마, '--ephemeral', '-o', out, '-'],
    프롬프트, timeoutMs, 라벨);
  try { return JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) {
    const err = new Error(`${라벨} 결과가 스키마와 다르다(` + String(e.message) + ')');
    err.확인불가 = true; throw err;
  }
}

// ─────────────────────────────────────────────────────────────── 프롬프트

/* ⛔ 막다른 길(2026-08-05 실측) — **1단계에는 커스텀 프롬프트를 줄 수 없다.**
 *   `codex exec review` 는 타깃 플래그와 `[PROMPT]` 가 **배타적**이다. 셋 다 확인했다:
 *     the argument '--uncommitted' cannot be used with '[PROMPT]'
 *     the argument '--commit <SHA>'  cannot be used with '[PROMPT]'
 *     the argument '--base <BRANCH>' cannot be used with '[PROMPT]'
 *   PROMPT 모드로 가면 프롬프트는 되찾지만 **검수 범위가 불확정**해진다 — 이 도구의 기록은
 *   「어느 범위가 검수됐나」로 게이트를 거는 것이라 범위의 확정성이 프롬프트보다 값지다.
 *   그래서 타깃 플래그를 택했다. 다음 세션이 이 벽을 다시 받지 않도록 남긴다.
 *
 * 그럼 SYNK 고유의 검수 렌즈는 어디서 오나 — **저장소의 `CLAUDE.md` 다.**
 *   실측: 첫 검수에서 codex 가 시키지도 않았는데 `CLAUDE.md:45` 를 근거로 인용했다
 *   (「repo 밖 환경에 기대는 검사는 CI에서 깨진다」로 테스트 격리 결함을 잡아냈다).
 *   즉 렌즈는 이미 닿고 있다. repo 에 `AGENTS.md` 를 심지 않은 것은 그대로 유지한다 —
 *   그건 「여기서 구현해도 된다」는 신호이고, 그 순서는 08-03 판정이 따로 정해뒀다.
 *
 * 기각 이력의 효과는 그래서 **한쪽만** 남는다: codex 는 기각된 지적을 다시 올릴 수 있지만,
 *   `main()` 이 키로 걸러 **내 앞에는 안 온다.** 줄어드는 것은 내 판단 시간이지 codex 토큰이 아니다.
 *   (검수 비용은 유호님 ChatGPT 구독 몫이라 이 비대칭은 실질 손해가 아니다.) */

// ─────────────────────────────────────────────────────────────── 실행

/* 🔒 읽기 전용을 **실제로** 강제하는 조합 — 2026-08-05 실측으로 정해졌다. 세 개가 한 벌이다.
 *
 *   --ignore-user-config      ~/.codex/config.toml 을 안 읽는다. **이게 핵심이다.**
 *     그 파일에는 ①`[mcp_servers.node_repl]` — 임의 node 실행 MCP ②`[projects.'c:\users\q1212']
 *     trust_level="trusted"` — 홈 전체 신뢰 ③`[windows] sandbox="elevated"` 가 들어 있다.
 *     ③ 때문에 샌드박스 러너가 권한 오류로 죽고(`SpawnChild … Windows error 5`), 그러면
 *     에이전트는 셸 대신 **node_repl 로 우회해 `execFileA('git',…)` 를 그대로 돌린다.**
 *     즉 이 플래그가 없으면 `sandbox_mode="read-only"` 는 **글자만 읽기 전용**이다(실측).
 *   -c sandbox_mode="read-only"   쓰기 차단. 실측: `patch rejected: writing is blocked by
 *     read-only sandbox` 가 뜨고 프로브 파일이 실제로 안 생겼다.
 *   -c approval_policy="never"    신뢰 설정이 함께 빠지면서 **읽기 명령까지** 승인 대기로 거절된다
 *     (실측 6건 `blocked by policy`). 검수자가 정보를 덜 보면 검수 품질이 조용히 낮아지므로 연다.
 *     쓰기가 막히는지는 이 플래그를 넣고 다시 쟀다 — 그대로 막혔다.
 *
 * ⚠ 이 셋 중 하나라도 빠지면 「읽기 전용」이 사실이 아니게 된다. 지우지 말 것. */
const 잠금플래그 = ['--ignore-user-config', '-c', 'sandbox_mode="read-only"', '-c', 'approval_policy="never"'];

/* ■ 모델·추론 수준은 **`tools/모델정책.js` 가 혼자 정한다** — 여기엔 사본을 두지 않는다.
 *   벤더가 둘(코덱스·제미나이)이 된 뒤로 결정이 두 곳에 있으면 갈라지고, 갈라지는 방향은
 *   언제나 얕은 쪽이다. 왜 그렇게 정했는지(효력이 모델보다 레버다 · 변환은 최하급이 옳다 ·
 *   선택지를 sol·luna 둘로 닫은 이유)는 전부 그 파일 주석에 있다.
 *
 * 고르는 법: `--검수 sol|luna`(또는 `SYNK_REVIEW_PICK`) · 1회성 하향은 `--효력 high`.
 *   모르는 이름은 **기본값으로 접지 않고 거절**한다 — 오타를 조용히 sol 로 읽으면
 *   「luna 로 돌렸다」고 믿는 상태가 만들어진다. */
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));
const 효력들 = 정책.효력들;
const 모델플래그 = 정책.코덱스플래그;
/* require 시점엔 **기본 픽만** 놓는다 — env·CLI 는 main() 에서 얹는다. 이 모듈은 clasp-guard 훅도
 * require 하므로, 여기서 env 오타로 던지면 **가드가 통째로 죽는다**(등록층 누수 · CLAUDE.md 맹점 ①). */
const 모델설정 = {
  분석: 정책.검수선택(),
  구조화: { ...정책.구조화설정 },
};

function codex(args, 입력, timeoutMs, 라벨) {
  const isWin = process.platform === 'win32';
  const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'codex.cmd') : 'codex';
  if (isWin && !fs.existsSync(bin)) {
    const e = new Error(`codex CLI 를 찾을 수 없다: ${bin}`); e.확인불가 = true; throw e;
  }
  try {
    execFileSync(
      isWin ? (process.env.ComSpec || 'cmd.exe') : bin,
      isWin ? ['/c', bin, ...args] : args,
      { cwd: ROOT, input: 입력, encoding: 'utf8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (e) {
    /* 실행 자체가 실패했다 = **확인 불가**다. 여기서 「지적 0건」으로 접으면 거짓 초록이 된다. */
    const err = new Error(`${라벨} 실패: ` + String((e && e.stderr) || (e && e.message) || e).split('\n').slice(0, 3).join(' / '));
    err.확인불가 = true;
    throw err;
  }
}

/* 2단계인 이유 — 1단계가 스키마를 안 지키기 때문이다(실측).
 *   `codex exec review` 는 자체 리뷰 하네스(다단계 적대 패스)를 돌리는 대신 **`--output-schema` 를
 *   무시하고 산문을 낸다.** 반대로 `codex exec` 는 스키마를 지키지만 그 리뷰 하네스가 없다.
 *   그래서 분석은 `review` 에, 구조화는 `exec` 에 맡긴다.
 * 🔑 산문을 정규식으로 파싱하지 **않는 이유**: 지적 0건과 파싱 실패가 **같은 모양**(빈 결과)이라
 *   구멍이 나면 조용히 초록이 된다. 2단계는 실패하면 실패한다고 말한다. */
function codex실행(대상, timeoutMs) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-'));
  const 산문 = path.join(임시, 'review.txt');
  const 구조 = path.join(임시, 'review.json');

  // 1단계 — 분석(리뷰 하네스). 커스텀 프롬프트는 못 준다(위 「막다른 길」 참조) — 렌즈는 CLAUDE.md 가 진다.
  codex(['exec', 'review', ...대상.flags, ...잠금플래그, ...모델플래그(모델설정.분석), '--ephemeral', '-o', 산문],
    '', timeoutMs, `codex 검수(1단계 분석 · ${모델설정.분석.model}/${모델설정.분석.effort})`);

  let raw;
  try { raw = fs.readFileSync(산문, 'utf8').trim(); } catch (_) {
    const e = new Error('1단계가 결과 파일을 남기지 않았다'); e.확인불가 = true; throw e;
  }
  if (!raw) { const e = new Error('1단계 결과가 비었다'); e.확인불가 = true; throw e; }

  // 2단계 — 구조화(순수 변환). 새 지적을 만들지 못하게 못 박는다.
  const 변환 = `아래는 코드 검수 결과 원문이다. 스키마에 맞춰 **그대로** 구조화해라.

규칙:
- **원문에 없는 지적을 만들어내지 마라.** 이건 변환이지 검수가 아니다.
- 원문이 「문제 없음」이면 「지적」은 빈 배열이다.
- 등급이 원문에 있으면([P0]~[P3]) 그대로 쓰고, 없으면 심각도에 맞춰 고른다.
- 「파일」은 저장소 루트 기준 상대 경로로 바꿔라(절대경로 금지). 행 번호를 모르면 「라인」은 0.

--- 원문 ---
${raw}`;
  codex(['exec', ...잠금플래그, ...모델플래그(모델설정.구조화), '--output-schema', 스키마경로, '--ephemeral', '-o', 구조, '-'],
    변환, Math.min(timeoutMs, 300000), `codex 검수(2단계 구조화 · ${모델설정.구조화.model}/${모델설정.구조화.effort})`);

  let j;
  try {
    j = JSON.parse(fs.readFileSync(구조, 'utf8'));
    if (!Array.isArray(j.지적)) throw new Error('지적 배열이 없다');
  } catch (e) {
    const err = new Error('2단계 결과가 스키마와 다르다(' + String(e.message) + ')');
    err.확인불가 = true;
    throw err;
  }
  j.원문 = raw;
  return j;
}

// ─────────────────────────────────────────────────────────────── 게이트 조회 (부작용 0)

/* clasp-guard 가 부르는 순수 조회. 검수를 돌리지 않는다 — 훅 안에서 5분짜리를 돌릴 수는 없다.
 * 돌려주는 것: level = 'ok' | 'none' | 'scope' | 'block'
 *   ok    = 이 지문에 대해 범위 안에서 검수됐고 차단급 미해결 0
 *   none  = 이 지문에 대한 검수 기록 자체가 없다        → 알림
 *   scope = 기록은 있으나 이 프로젝트가 검수 범위 밖이었다 → 알림 (「모름」과 「정상」을 가른다)
 *   block = 차단급 지적이 미해결                        → 차단
 */
function 게이트판정(projRoot, root = ROOT, 장부 = {}) {
  const 기록p = 장부.기록경로 || 기록경로;   // 회귀가 픽스처 장부를 끼워 넣는 자리
  const 기각p = 장부.기각경로 || 기각경로;
  const 이름 = path.relative(root, projRoot).replace(/\\/g, '/') || '(루트)';
  const fp = 점검.지문(projRoot, root);
  const 기각키 = new Set(jsonl(기각p).map((r) => r.키));

  const 해당 = jsonl(기록p).filter((r) => r.지문 && r.지문[이름] === fp);
  if (!해당.length) {
    return { level: 'none', 이름, fp, lines: [
      `⚠ ${이름}: 이 배포 내용(#fp:${fp})에 **이종 검수 기록이 없다**`,
      `   → node tools/codex-review.js   (약 5분 · 읽기 전용)`,
    ] };
  }

  const 범위안 = 해당.filter((r) => Array.isArray(r.범위) && r.범위.includes(이름));
  if (!범위안.length) {
    return { level: 'scope', 이름, fp, lines: [
      `⚠ ${이름}: 검수 기록은 있으나 **이 프로젝트는 검수 범위 밖**이었다(#fp:${fp})`,
      `   내용이 안 바뀌었다면 그대로 나가도 되지만, 「검수됨」은 아니다.`,
      `   → node tools/codex-review.js --base master`,
    ] };
  }

  // 가장 최근 기록 기준. 기각된 것은 미해결에서 뺀다(기각이 곧 의식적 통과 레버다).
  const 최신 = 범위안[범위안.length - 1];
  const 미해결 = (최신.지적 || []).filter((f) => 차단급.has(f.등급) && !기각키.has(f.키));
  if (미해결.length) {
    return { level: 'block', 이름, fp, 지적: 미해결, lines: [
      `${이름}: 이종 검수가 **차단급 ${미해결.length}건**을 지적했고 아직 미해결이다(#fp:${fp})`,
      ...미해결.map((f) => `  - [${f.등급}] ${f.파일}${f.라인 ? ':' + f.라인 : ''} — ${f.제목}\n      ${f.근거}\n      → ${f.수정방향}`),
      `  해소 방법 둘:`,
      `    ① 고친다 → 파일이 바뀌면 지문이 바뀌므로 재검수: node tools/codex-review.js`,
      `    ② 틀린 지적이면 사유와 함께 기각한다:`,
      ...미해결.map((f) => `       node tools/codex-review.js --기각 ${f.키} --사유 "왜 틀렸는지"`),
    ] };
  }
  return { level: 'ok', 이름, fp, lines: [`${이름}: 이종 검수 통과 (#fp:${fp} · ${(최신.지적 || []).length}건 지적, 차단급 미해결 0)`] };
}

// ─────────────────────────────────────────────────────────────── CLI

/* ① 설계 선파악 — 기능지도 + 업그레이드 제안. 결과는 장부에 「제안됨」으로 쌓이고,
 * 클로드가 --제안판정 으로 채택/기각을 정한다. **배포 게이트와 무관하다**(위 설계 주석). */
function 제안실행(argv, 대상, timeoutMs) {
  const 현황 = 제안현황();
  const 기각제목들 = [...현황.values()].filter((p) => p.상태 === '기각').map((p) => p.제목).slice(-50);
  const diff = 디프수집(대상);

  console.log(`설계 선파악 중… (${모델설정.분석.model}/${모델설정.분석.effort} · 읽기 전용 샌드박스)`);
  const 결과 = 스키마실행(제안프롬프트(diff, 기각제목들, 방향텍스트()), 제안스키마경로, timeoutMs,
    `codex 선파악(${모델설정.분석.model}/${모델설정.분석.effort})`);

  const now = new Date().toISOString();
  append(제안경로, { 종류: '기능지도', 시각: now, 대상: { 종류: 대상.종류, 값: 대상.값 }, 기능지도: 결과.기능지도 || [] });

  console.log('\n── 기능지도 (검수자가 파악한 이 변경의 기능) ──');
  for (const f of 결과.기능지도 || []) console.log(`  · ${f.기능} — ${f.설명}`);

  const 신규 = [];
  for (const p of 결과.제안 || []) {
    const k = 제안키(p);
    const 이전 = 현황.get(k);
    if (이전 && 이전.상태 === '기각') continue;        // 기각된 것은 내 앞에 다시 오지 않는다
    if (이전 && 이전.상태 === '채택') continue;        // 이미 채택된 것도 — 구현 몫이지 재판정 몫이 아니다
    append(제안경로, { 종류: '제안', 시각: now, 대상: { 종류: 대상.종류, 값: 대상.값 }, 키: k, ...p });
    신규.push({ ...p, 키: k });
  }

  console.log(`\n── 업그레이드 제안 ${신규.length}건 ──`);
  if (!신규.length) console.log('  (없음 — 검수자가 올릴 것이 없다고 판단했다)');
  for (const p of 신규) {
    console.log(`\n[${p.크기}] ${p.제목}   (관련: ${p.관련기능})`);
    console.log(`  무엇을: ${p.무엇을}`);
    console.log(`  왜: ${p.왜}`);
    console.log(`  방향: ${p.구현방향}`);
    console.log(`  판정: node tools/codex-review.js --제안판정 ${p.키} --채택`);
    console.log(`        node tools/codex-review.js --제안판정 ${p.키} --기각 --사유 "..."`);
  }
  if (신규.length) {
    console.log('\n다음 순서: 제안마다 채택/기각을 판정한다 — 채택이면 구현 후, 기각이면 그대로 최종 검수(node tools/codex-review.js).');
    console.log('크기 「대」또는 방향을 바꾸는 제안은 클로드가 정하지 말고 유호님께 선택지로 올린다.');
  }
  console.log(`\n기록: ${path.relative(ROOT, 제안경로).replace(/\\/g, '/')}`);
  return 0;
}

function main(argv) {
  // 제안 판정 — 클로드(또는 유호님)가 채택/기각을 장부에 남긴다
  if (argv.includes('--제안판정')) {
    const k = argv[argv.indexOf('--제안판정') + 1];
    const 채택 = argv.includes('--채택');
    const 기각 = argv.includes('--기각');
    const 사유 = argv.includes('--사유') ? argv[argv.indexOf('--사유') + 1] : '';
    if (!k || 채택 === 기각) {
      console.error('사용: --제안판정 <키> --채택 [--사유 "..."]  또는  --제안판정 <키> --기각 --사유 "왜"');
      return 2;
    }
    if (기각 && !사유) {
      console.error('기각에는 사유가 필요하다 — 없으면 다음 회차에 왜 안 하는지 설명할 수 없다.');
      return 2;
    }
    const 현황 = 제안현황();
    if (!현황.has(k)) {
      console.error(`모르는 제안 키 "${k}" — 오타로 허공에 판정을 남기면 진짜 제안이 미판정으로 남는다.`);
      return 2;
    }
    append(제안경로, { 종류: '판정', 시각: new Date().toISOString(), 키: k, 상태: 채택 ? '채택' : '기각', 사유 });
    const p = 현황.get(k);
    console.log(`${채택 ? '채택' : '기각'}: ${p.제목}${사유 ? ' — ' + 사유 : ''}`);
    console.log(채택
      ? '구현한 뒤 최종 검수(node tools/codex-review.js)를 돌린다 — 기능체크가 구현 여부까지 본다.'
      : '이 제안은 다음 선파악 프롬프트에 「기각됨」으로 실려 다시 올라오지 않는다.');
    return 0;
  }

  // 기각 등록
  if (argv.includes('--기각')) {
    const k = argv[argv.indexOf('--기각') + 1];
    const 사유 = argv.includes('--사유') ? argv[argv.indexOf('--사유') + 1] : '';
    if (!k || !사유) {
      console.error('사용: --기각 <키> --사유 "왜 기각했는지"  (사유 없는 기각은 받지 않는다 — 다음 회차에 왜 무시하는지 설명할 수 없다)');
      return 2;
    }
    const 원본 = jsonl(기록경로).flatMap((r) => r.지적 || []).find((f) => f.키 === k);
    append(기각경로, { 시각: new Date().toISOString(), 키: k, 파일: 원본 ? 원본.파일 : '(모름)', 제목: 원본 ? 원본.제목 : '(모름)', 사유 });
    console.log(`기각 등록: ${k} — ${사유}`);
    console.log('이 지적은 다음 검수 프롬프트에 「기각됨」으로 실려 다시 올라오지 않는다.');
    return 0;
  }

  // 게이트 조회
  if (argv.includes('--확인')) {
    let 최악 = 0;
    for (const p of 점검.claspProjects()) {
      const r = 게이트판정(p, ROOT);
      console.log(r.lines.join('\n'));
      if (r.level === 'block') 최악 = Math.max(최악, 1);
    }
    return 최악;
  }

  const 대상 = 대상결정(argv);
  if (!대상.파일들.length) {
    console.log('검수할 변경이 없다 — 대상 diff 가 비었다.');
    return 0;
  }
  const 기각들 = jsonl(기각경로);
  const 범위들 = 범위(대상.파일들);

  // 선택지는 둘뿐이다(sol·luna · 둘 다 max). `--효력` 은 1회성 조정 — 급하면 `--효력 high`.
  try {
    모델설정.분석 = 정책.분석설정(argv);
    모델플래그(모델설정.분석);      // 조합 검사를 **먼저** 한다 — 몇 분 기다린 뒤 오타를 알 이유가 없다
    모델플래그(모델설정.구조화);    // 2단계도 지금 — 1단계가 끝난 뒤 죽으면 그 몇 분이 통째로 버려진다
  } catch (e) {
    console.error('🔴 확인 불가 — 검수가 **안 돌았다**(통과가 아니다): ' + e.message);
    return 2;
  }

  const 초 = argv.includes('--timeout') ? Number(argv[argv.indexOf('--timeout') + 1]) : 900;

  // ① 설계 선파악 모드 — 버그 검수 대신 기능지도+업그레이드 제안만 내고 끝낸다
  if (argv.includes('--제안')) {
    console.log(`대상: ${대상.종류} ${대상.값} · 파일 ${대상.파일들.length}개`);
    try {
      return 제안실행(argv, 대상, 초 * 1000);
    } catch (e) {
      if (e.확인불가) {
        console.error('🔴 확인 불가 — 선파악이 **안 돌았다**: ' + e.message);
        console.error('   제안 단계는 게이트와 무관하다 — 최종 검수(버그+기능체크)로 그냥 진행해도 된다.');
        return 2;
      }
      throw e;
    }
  }

  console.log(`대상: ${대상.종류} ${대상.값} · 파일 ${대상.파일들.length}개`);
  console.log(`검수 범위(clasp 프로젝트): ${범위들.length ? 범위들.join(', ') : '없음 — 배포 파일이 아닌 변경'}`);
  if (기각들.length) console.log(`기각 이력 ${기각들.length}건으로 재발 지적을 걸러낸다.`);
  console.log(`모델: 분석=${모델설정.분석.model}/${모델설정.분석.effort}(${모델설정.분석.이름}) · 구조화=${모델설정.구조화.model}/${모델설정.구조화.effort}`);
  console.log(`codex 검수 중… (읽기 전용 샌드박스 · 2단계 · ${모델설정.분석.effort} 추론 — xhigh 실측이 5~8분이었다)`);

  let 결과;
  try {
    결과 = codex실행(대상, 초 * 1000);
  } catch (e) {
    if (e.확인불가) {
      console.error('🔴 확인 불가 — 검수가 **안 돌았다**(통과가 아니다): ' + e.message);
      console.error('   codex 로그인 상태는 `codex login status` 로 본다.');
      return 2;
    }
    throw e;
  }

  /* ③-2 기능 전수 체크 — 버그 사냥(위)과 별개 패스로, 바뀐 기능 하나하나가 실제로 도는지 본다.
   * 유호님 설계(2026-08-05): 「검수자가 최종적으로 꼼꼼히 버그 체크하고 **업데이트되는 기능
   * 세세히 전부 체크**」. 지적 0건과 「기능 X 는 본 적도 없음」이 같은 모양이면 안 되는 자리다.
   * 깨짐은 P1 지적으로 변환돼 같은 게이트를 탄다. `--버그만` 은 유호님 「빠르게」 모드용. */
  let 기체 = null;
  if (!argv.includes('--버그만')) {
    const 채택제안들 = [...제안현황().values()].filter((p) => p.상태 === '채택').map((p) => p.제목).slice(-20);
    console.log('기능 전수 체크 중… (같은 모델 · 별도 패스)');
    try {
      기체 = 스키마실행(기능체크프롬프트(디프수집(대상), 채택제안들, 방향텍스트()), 기능체크스키마경로,
        Math.min(초 * 1000, 900000), `codex 기능체크(${모델설정.분석.model}/${모델설정.분석.effort})`);
    } catch (e) {
      if (e.확인불가) {
        console.error('🔴 확인 불가 — 기능체크가 **안 돌았다**(통과가 아니다): ' + e.message);
        return 2;
      }
      throw e;
    }
  } else {
    console.log('(--버그만: 기능 전수 체크 생략 — 유호님 「빠르게」 모드)');
  }

  const 지적 = [...(결과.지적 || []), ...기능체크지적들(기체 && 기체.체크)].map((f) => ({ ...f, 키: 키(f) }));
  const 기각키 = new Set(기각들.map((r) => r.키));
  const 신규 = 지적.filter((f) => !기각키.has(f.키));

  append(기록경로, {
    시각: new Date().toISOString(),
    대상: { 종류: 대상.종류, 값: 대상.값 },
    // 어느 모델이 어느 추론 수준으로 봤는지 남긴다 — 나중에 「그때 왜 못 잡았나」를 물을 수 있어야 한다
    모델: { 분석: { ...모델설정.분석 }, 구조화: { ...모델설정.구조화 } },
    범위: 범위들,
    지문: 유효지문(대상),
    요약: 결과.요약 || '',
    지적,
    기능체크: (기체 && 기체.체크) || [],
    // 1단계 산문을 그대로 보관한다 — 2단계 구조화가 무엇을 떨어뜨렸는지 나중에 대조할 수 있어야 한다.
    원문: 결과.원문 || '',
  });

  console.log('\n── 검수 결과 ──');
  console.log(결과.요약 || '(요약 없음)');
  if (기체) {
    console.log('\n── 기능 전수 체크 ──');
    if (!(기체.체크 || []).length) console.log('  (검수자가 체크할 기능을 하나도 못 찾았다 — diff 가 기능 변경이 아닐 때만 정상)');
    for (const c of 기체.체크 || []) {
      const 표 = c.판정 === '정상' ? '✅' : c.판정 === '의심' ? '⚠' : '🔴';
      console.log(`  ${표} ${c.기능}${c.판정 !== '정상' ? ' — ' + String(c.근거 || '').slice(0, 140) : ''}`);
    }
  }
  if (!신규.length) console.log('\n새 지적 0건.');
  for (const f of 신규) {
    console.log(`\n[${f.등급}] ${f.파일}${f.라인 ? ':' + f.라인 : ''} — ${f.제목}`);
    console.log(`  근거: ${f.근거}`);
    console.log(`  수정: ${f.수정방향}`);
    console.log(`  키: ${f.키}   (틀린 지적이면: node tools/codex-review.js --기각 ${f.키} --사유 "...")`);
  }
  const 차단 = 신규.filter((f) => 차단급.has(f.등급));
  if (지적.length !== 신규.length) console.log(`\n(기각 이력으로 걸러낸 재발 지적 ${지적.length - 신규.length}건)`);
  console.log(`\n기록: docs/_ops/검수기록.jsonl`);
  return 차단.length ? 1 : 0;
}

module.exports = {
  게이트판정, 유효지문, 키, 범위, 대상결정, 미커밋파일들, 차단급, 기록경로, 기각경로, 모델설정, 효력들, 모델플래그,
  제안경로, 제안키, 제안현황, 제안프롬프트, 기능체크프롬프트, 기능체크지적들, 방향텍스트, 방향경로, 방향상한, 디프상한,
};

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error('🔴 ' + String((e && e.message) || e));
    process.exit(2);
  }
}
