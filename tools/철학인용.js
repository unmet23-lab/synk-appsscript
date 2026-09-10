#!/usr/bin/env node
'use strict';
/**
 * 철학인용 — 옛 철학(v1.24) 조항 번호 인용을 세고, 현행 자리를 대조표에서 찾아 «보고»한다. 고쳐 쓰지 않는다.
 *
 * ■ 왜 있나 (2026-09-11 · 발전안 20260911 갈래 ⑥)
 *   철학 v2.0(09-09)은 절 번호가 1~7 이고, 파생 문서·코드 주석은 아직 v1.24 번호(Ⅰ-3 · Ⅱ-8 · Ⅲ-8 …)로
 *   철학을 가리킨다. 그 번호는 죽은 링크가 아니다 — v3 머리와 적용 기준이 「v1.24 보존본의 당시 번호」라고
 *   밝히고 있어 보존본에서 뜻을 찾을 수 있다. 다만 «두 번 건너야» 하고, 옛 번호 → 현행 절 대조표가
 *   없었다. 이 도구는 (1) 어디에 몇 개가 있나 (2) 그 줄이 「당시·보존본·v1.24」 표시를 달고 있나
 *   (3) 현행 어느 절을 보면 되나 — 셋을 한 장으로 낸다. 일괄 치환은 하지 않는다(GPT 검토 09-11 ·
 *   우선순위는 세로줄 관통 검증이고, 번호 치환은 대조표만으로 충분하다).
 *
 * ■ 무엇을 세나
 *   · Ⅰ-N · Ⅱ-N · Ⅲ-N (v1.24 내부·교육·대외 조항)
 *   · 「부록 A-1」·「부록 A-2」·「철학 A-1」 꼴의 부록 인용(맨 「A-1」은 다른 문서의 표 이름일 수 있어 안 센다)
 *   같은 줄에 «v1.24 · 보존본 · 당시 · 옛 번호 · 구 » 표시가 있으면 «표시됨»으로 따로 센다 —
 *   그 줄은 이미 「옛 번호」임을 밝힌 줄이라 고칠 것이 없다.
 *
 * ■ 면제 — 역사 문서는 «그때 그랬다»의 기록이라 옛 번호가 정상이다(tools/인용검사.js 의 면제와 같은 결 +
 *   결정 원장·발전안 폴더·보존 원문). 사람이 `--파일` 로 콕 집으면 면제를 안 건다.
 *
 * 사용:
 *   node tools/철학인용.js                      # 저장소 전량 보고(표준 출력 · 마크다운)
 *   node tools/철학인용.js --보고 docs/_ops/발전안_20260911/철학인용_보고.md
 *   node tools/철학인용.js --파일 docs/앱재설계_v2.md docs/살아있는자리_설계_v1.md
 *   node tools/철학인용.js --대조 <대조표.json>   # 기본 = docs/_ops/발전안_20260911/철학번호대조.json
 * 종료 코드: 언제나 0(보고 도구다). 대조표를 못 읽으면 «대조표 없음»을 적고 계속한다(F207 — 못 읽음을 0 으로 접지 않는다).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** 옛 번호 꼴 — Ⅰ-3 · Ⅱ-8 · Ⅲ-8 · 부록 A-1 · 철학 A-2. 로마 숫자는 유니코드 한 글자(Ⅰ U+2160 · Ⅱ U+2161 · Ⅲ U+2162). */
const 조항꼴 = /[ⅠⅡⅢ]-[0-9]{1,2}(?![0-9])/g;
const 부록꼴 = /(?:부록|철학|정본)\s*(A-[12])(?![0-9])/g;
/** 이 낱말이 같은 줄에 있으면 「옛 번호임을 밝힌 줄」이다. */
const 표시낱말 = /v1\.2[0-4]|보존본|당시|옛 번호|구 [ⅠⅡⅢ]|구 번호|이관|폐번|아카이브|_archive/;

/** 한 본문에서 옛 번호 인용을 줄 단위로 뽑는다. 코드 펜스 안은 안 센다(붙여넣은 출력·예제). */
function 인용찾기(본문) {
  const 결과 = [];
  let 펜스 = false;
  String(본문).split(/\r?\n/).forEach((줄, i) => {
    if (/^\s*```/.test(줄)) { 펜스 = !펜스; return; }
    if (펜스) return;
    const 번호들 = [];
    for (const m of 줄.matchAll(조항꼴)) 번호들.push(m[0]);
    for (const m of 줄.matchAll(부록꼴)) 번호들.push(m[1]);
    if (!번호들.length) return;
    결과.push({ 줄번호: i + 1, 원문: 줄.trim().slice(0, 160), 번호들, 표시됨: 표시낱말.test(줄) });
  });
  return 결과;
}

/** 역사·기록 문서 — 옛 번호가 정상인 자리. 접두는 폴더, `.md` 로 끝나면 파일 하나. */
const 면제 = [
  'docs/_archive/', 'docs/_ops/심문결과/', 'docs/_ops/장부/', 'docs/_ops/검수결과/', 'docs/노션_대조_',
  'docs/_ops/발전안_', 'docs/_ops/철학개정_', 'docs/버전_이력.md', 'docs/_ops/결정.md', 'docs/_ops/트랙_재료.md',
  'docs/철학_실물현황.md', 'docs/_ops/철학_판정거리_0902.md', 'docs/_ops/엔진심문_', 'docs/엔진심문_',
];
const 면제인가 = (rel) => 면제.some((p) => (p.endsWith('.md') ? rel === p : rel.startsWith(p)));

/** 대조표에서 번호의 현행 자리를 찾는다. 없으면 null — 「없음」과 「대조표 못 읽음」은 호출부가 가른다. */
function 자리찾기(번호, 대조) {
  if (!대조 || !Array.isArray(대조.대조)) return null;
  const 행 = 대조.대조.find((r) => r.옛 === 번호);
  return 행 ? { 새: 행.새 || [], 정도: 행.정도 || '', 비고: 행.비고 || '', 담당설계: 행.담당설계 || [] } : null;
}

/** 저장소를 훑을 과녁 — docs 의 md 전부 + 루트 js + 스킬 md. node_modules·.git·워크트리는 안 본다. */
function 과녁들(root) {
  const 나온것 = [];
  const 걷기 = (dir, 깊이) => {
    let 항목;
    try { 항목 = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of 항목) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'worktrees' || e.name.startsWith('.claude')) {
        if (!(dir === root && e.name === '.claude')) continue;
      }
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (깊이 < 8) 걷기(p, 깊이 + 1); continue; }
      const rel = path.relative(root, p).replace(/\\/g, '/');
      if (/^docs\/.*\.md$/.test(rel) || /^[^/]+\.js$/.test(rel) || /^\.claude\/skills\/.*\.md$/.test(rel)) 나온것.push(rel);
    }
  };
  걷기(root, 0);
  return 나온것.sort();
}

function 보고서({ root, 파일들, 대조, 대조경로, 면제적용 }) {
  const 줄들 = [];
  const 파일별 = [];
  const 번호별 = new Map();
  let 면제된 = 0;
  for (const rel of 파일들) {
    if (면제적용 && 면제인가(rel)) { 면제된++; continue; }
    let 본문;
    try { 본문 = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    const 인용 = 인용찾기(본문);
    if (!인용.length) continue;
    const 표시 = 인용.filter((x) => x.표시됨).length;
    파일별.push({ 파일: rel, 건수: 인용.length, 표시됨: 표시, 미표시: 인용.length - 표시, 인용 });
    for (const x of 인용) for (const n of x.번호들) 번호별.set(n, (번호별.get(n) || 0) + 1);
  }
  파일별.sort((a, b) => b.미표시 - a.미표시 || b.건수 - a.건수);
  const 전체 = 파일별.reduce((s, f) => s + f.건수, 0);
  const 미표시전체 = 파일별.reduce((s, f) => s + f.미표시, 0);

  줄들.push('# 철학 옛 번호 인용 보고');
  줄들.push('');
  /* 날짜는 «이 기계의 오늘»이다(UTC 로 찍으면 밤 작업이 전날로 적힌다 · 09-11 실측). */
  const 오늘 = new Date().toLocaleDateString('en-CA');
  /* 대조표 자리는 저장소 상대 경로로 적는다 — 기계마다 다른 절대 경로가 보고에 박히면 그 보고를 옮겨 읽는 사람이 헤맨다. 밖이면 파일 이름만. */
  const 대조표시 = (() => {
    if (!대조) return '없음(못 읽음 — 자리 칸이 빈 것은 「없음」이 아니다)';
    const rel = path.relative(root, path.resolve(root, 대조경로)).replace(/\\/g, '/');
    return rel && !rel.startsWith('..') ? rel : path.basename(String(대조경로));
  })();
  줄들.push(`> 생성 ${오늘} · 도구 \`tools/철학인용.js\` · 과녁 ${파일들.length}벌 중 면제 ${면제된}벌 · 인용이 있는 파일 ${파일별.length}벌 · 인용 ${전체}건(표시됨 ${전체 - 미표시전체} · 미표시 ${미표시전체}) · 대조표 ${대조표시}`);
  줄들.push('>');
  줄들.push('> 「표시됨」 = 같은 줄에 v1.24·보존본·당시 같은 낱말이 있어 옛 번호임을 이미 밝힌 줄. 「미표시」 = 읽는 사람이 현행 절로 착각할 수 있는 줄. 이 보고는 세기만 하고 고치지 않는다.');
  줄들.push('');
  줄들.push('## 번호별 — 현행 어느 절을 보면 되나');
  줄들.push('');
  줄들.push('| 옛 번호 | 건수 | 정도 | 현행 자리 | 담당 설계 |');
  줄들.push('|---|---:|---|---|---|');
  const 번호정렬 = [...번호별.entries()].sort((a, b) => b[1] - a[1]);
  for (const [n, c] of 번호정렬) {
    const 자리 = 자리찾기(n, 대조);
    줄들.push(`| ${n} | ${c} | ${자리 ? 자리.정도 : (대조 ? '대조표에 없음' : '—')} | ${자리 ? 자리.새.join(' · ') : ''} | ${자리 ? 자리.담당설계.join(' · ') : ''} |`);
  }
  줄들.push('');
  줄들.push('## 파일별 — 미표시가 많은 순');
  줄들.push('');
  줄들.push('| 파일 | 인용 | 표시됨 | 미표시 |');
  줄들.push('|---|---:|---:|---:|');
  for (const f of 파일별) 줄들.push(`| ${f.파일} | ${f.건수} | ${f.표시됨} | ${f.미표시} |`);
  줄들.push('');
  줄들.push('## 미표시 줄 — 파일마다 앞 12줄까지');
  줄들.push('');
  for (const f of 파일별) {
    const 미 = f.인용.filter((x) => !x.표시됨);
    if (!미.length) continue;
    줄들.push(`### ${f.파일} (미표시 ${미.length})`);
    for (const x of 미.slice(0, 12)) 줄들.push(`- L${x.줄번호} [${x.번호들.join('·')}] ${x.원문.replace(/\|/g, '¦')}`);
    if (미.length > 12) 줄들.push(`- … ${미.length - 12}줄 더`);
    줄들.push('');
  }
  return { 글: 줄들.join('\n'), 셈: { 과녁: 파일들.length, 면제된, 파일: 파일별.length, 전체, 미표시: 미표시전체, 번호별: Object.fromEntries(번호정렬) } };
}

function main() {
  const argv = process.argv.slice(2);
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : null; };
  const 파일자리 = argv.indexOf('--파일');
  const 대조경로 = 값('--대조') || path.join('docs', '_ops', '발전안_20260911', '철학번호대조.json');
  let 대조 = null;
  try { 대조 = JSON.parse(fs.readFileSync(path.resolve(ROOT, 대조경로), 'utf8')); } catch { 대조 = null; }
  const 파일들 = 파일자리 >= 0 ? argv.slice(파일자리 + 1).filter((a) => !a.startsWith('--')) : 과녁들(ROOT);
  const r = 보고서({ root: ROOT, 파일들, 대조, 대조경로, 면제적용: 파일자리 < 0 });
  const 보고 = 값('--보고');
  if (보고) {
    fs.writeFileSync(path.resolve(ROOT, 보고), r.글 + '\n', 'utf8');
    console.log(`[철학인용] ${보고} — 인용 ${r.셈.전체}건(미표시 ${r.셈.미표시}) · 파일 ${r.셈.파일}벌 · 면제 ${r.셈.면제된}벌`);
  } else {
    console.log(r.글);
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { 인용찾기, 자리찾기, 면제인가, 과녁들, 보고서, 조항꼴, 부록꼴, 표시낱말 };
