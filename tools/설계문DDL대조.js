'use strict';
/* 설계문 DDL 사본 ↔ 형제 저장소 실물 스키마 대조 — 2026-09-02
 *
 * ■ 왜 있나 (실측이 세운 자리)
 *   `docs/상태기반_과제선택_설계.md` §3-5-b 는 스스로 **「이 절은 규격이 아니라 «계약»이다.
 *   구현은 이 DDL 과 시그니처를 그대로 쓴다」**고 적은 **발주서**다. 그런데 그 납품은 이미 끝났고
 *   (talk `supabase/L0_스키마.sql` 에 표 셋·함수 넷이 전부 서 있다), **납품 뒤의 발주서는 사본**이다.
 *   그 절 자신이 그 위험을 알고 적어 뒀다 — 「사본은 갈라진다 · §12-21 회귀가 기계로 대조한다」.
 *   🔴 **그런데 그 회귀(`tests/설계문값대조.test.js`)는 08-19 대청소(e75fc7fc)로 걷혔다**
 *   (같은 절이 그 사실도 적어 뒀다). 지키는 기계가 사라진 사본이 어떻게 되는지는 09-02 에 실측했다:
 *     · `generation_batch_runs_freeze` 의 갱신 허용 칸 — 문서 여섯 · **실물 여덟**
 *       (`deliver_check_reds`·`deliver_check_at` 이 실물에만)
 *     · `generation_jobs` — `attempt_id`·`attempt_no` 가 실물에만
 *   **실물이 앞섰고 문서가 낡았다.** 사람 눈으로는 1839줄에서 이걸 못 찾는다.
 *
 * ■ 🔑 왜 «걷지» 않고 «대조»하나
 *   §3-5-b 1839줄의 구성을 재보니 SQL 실행줄은 **348줄(19%)**뿐이고 나머지 **1430줄(78%)이
 *   주석과 산문 — 즉 «왜»**다. 그리고 그 「왜」는 표본 21줄 중 **20줄이 실물 SQL 에 없다.**
 *   ⇒ 사본을 걷으면 자산을 버린다. **사본은 두되 갈리면 울게 한다**가 옳은 처방이다.
 *
 * ■ 어느 쪽이 참인가 — **실물이다.** 납품이 끝났으므로 설계문이 따라간다.
 *   그래서 이 자는 「설계문이 낡았다」로 말한다(반대가 아니다).
 *
 * ■ 형제 저장소가 없으면 «못 쟀다»(종료 2)이지 «통과»(0)가 아니다.
 *   0 = 갈린 것 없음 · 1 = 갈렸다 · 2 = 못 쟀다.
 *
 * 쓰기: node tools/설계문DDL대조.js [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 설계문 = path.join(ROOT, 'docs', '상태기반_과제선택_설계.md');
const 실물후보 = [
  path.resolve(ROOT, '..', 'SYNK-talk', 'supabase', 'L0_스키마.sql'),
  path.resolve(ROOT, '..', 'synk-talk', 'supabase', 'L0_스키마.sql'),
];

/** 줄끝을 먼저 고른다 — 두 저장소의 eol 규약이 다르다(형제 정본 함정). */
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** 견줄 수 있게 고른다 — 주석·빈줄·공백을 걷고 소문자로. 따옴표 종류는 안 센다. */
function 고르기(s) {
  return s
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/[«»`'"]/g, '')
    .toLowerCase();
}

/**
 * 이름으로 `create table` 본문을 뽑는다.
 * 🔴 괄호 짝을 세서 끊는다 — 「앞에서 N자」로 자르면 **다음 표까지 긁어** 열 집합이 거짓이 된다
 *   (09-02 에 실제로 그렇게 틀렸다: `generation_attempts` 15열 vs 32열 · 자를 먼저 의심한 자리).
 */
function 표본문(src, 이름) {
  const re = new RegExp('create table\\s+(?:if not exists\\s+)?(?:engine\\.)?' + 이름 + '\\s*\\(', 'gi');
  let 시작 = -1;
  let m;
  while ((m = re.exec(src)) !== null) 시작 = m.index + m[0].length;   // 마지막 정의가 이긴다
  if (시작 < 0) return null;
  let 깊이 = 1;
  let i = 시작;
  while (i < src.length && 깊이 > 0) {
    const c = src[i];
    if (c === '(') 깊이 += 1;
    else if (c === ')') 깊이 -= 1;
    i += 1;
  }
  return 깊이 === 0 ? src.slice(시작, i - 1) : null;
}

/* 열 이름이 아닌 것들 — 제약의 «이어지는 줄»이 `and …`·`or …` 로 시작해 열로 잡힌다.
 * 🔴 09-02 에 실제로 `and` 가 「실물에만 있는 열」로 보고됐다 — 자를 먼저 의심한 둘째 자리다. */
const 열아님 = new Set([
  'constraint', 'primary', 'unique', 'foreign', 'check', 'exclude', 'like',
  'and', 'or', 'not', 'when', 'then', 'else', 'end', 'case', 'references',
  'default', 'using', 'with', 'on', 'deferrable', 'initially',
]);

/** 표 본문 → 열 이름 집합(제약 줄과 그 이어지는 줄은 뺀다). */
function 열들(몸) {
  if (!몸) return null;
  const 열 = [];
  for (const raw of 몸.split('\n')) {
    const l = raw.replace(/--.*$/, '').trim();
    if (!l) continue;
    const m = /^([a-z_][a-z0-9_]*)\s+([a-z])/i.exec(l);
    if (!m) continue;
    const 이름 = m[1].toLowerCase();
    if (열아님.has(이름)) continue;
    열.push(이름);
  }
  return [...new Set(열)];
}

/** 이름으로 함수 본문을 뽑는다 — 마지막 정의가 이긴다(L0 는 마이그 이력이 눌린 파일이다). */
function 함수본문(src, 이름) {
  const re = new RegExp('create or replace function\\s+(?:engine\\.)?' + 이름 + '\\s*\\(', 'gi');
  let 시작 = -1;
  let m;
  while ((m = re.exec(src)) !== null) 시작 = m.index;
  if (시작 < 0) return null;
  /* 달러 인용 태그를 그 정의에서 «읽어» 끊는다 — 태그 이름이 자리마다 다르다($function$·$protect$…). */
  const 태그 = /\$([a-z_]*)\$/i.exec(src.slice(시작, 시작 + 800));
  if (!태그) return src.slice(시작, 시작 + 4000);
  const 닫기 = src.indexOf(태그[0], src.indexOf(태그[0], 시작) + 태그[0].length);
  return 닫기 > 시작 ? src.slice(시작, 닫기 + 태그[0].length) : src.slice(시작, 시작 + 4000);
}

/** 설계문에서 §3-5-b 구간만 잘라 낸다 — 절 머리로 찾는다(줄번호를 박지 않는다). */
function 절뽑기(md) {
  const 줄 = md.split('\n');
  const s = 줄.findIndex((l) => /^### 3-5-b\./.test(l));
  if (s < 0) return null;
  let e = 줄.length;
  for (let i = s + 1; i < 줄.length; i += 1) {
    if (/^#{2,3} /.test(줄[i])) { e = i; break; }
  }
  return 줄.slice(s, e).join('\n');
}

const 표들 = ['generation_jobs', 'generation_attempts', 'generation_batch_runs'];
const 함수들 = ['level_dist_ok', 'generation_jobs_freeze', 'jobs_nontarget_settled', 'generation_batch_runs_freeze'];

function 재기() {
  if (!fs.existsSync(설계문)) return { 잼: false, 왜: `설계문이 없다: ${설계문}` };
  const 실물경로 = 실물후보.find((p) => fs.existsSync(p));
  if (!실물경로) {
    return { 잼: false, 왜: '형제 저장소 L0_스키마.sql 을 못 찾았다 — 「갈린 것 0」이 아니라 «안 잰 것»이다' };
  }
  const 절 = 절뽑기(읽기(설계문));
  if (!절) return { 잼: false, 왜: '설계문에서 §3-5-b 절 머리를 못 찾았다(절 이름이 바뀌었으면 이 자부터 고친다)' };
  const 실물 = 읽기(실물경로);

  const 갈린것 = [];
  const 잰것 = [];

  for (const t of 표들) {
    const a = 열들(표본문(절, t));
    const b = 열들(표본문(실물, t));
    if (!a) { 갈린것.push({ 종류: '표', 이름: t, 왜: '설계문에 create table 이 없다' }); continue; }
    if (!b) { 갈린것.push({ 종류: '표', 이름: t, 왜: '실물에 create table 이 없다' }); continue; }
    잰것.push(t);
    const 문서만 = a.filter((c) => !b.includes(c));
    const 실물만 = b.filter((c) => !a.includes(c));
    if (문서만.length || 실물만.length) {
      갈린것.push({ 종류: '표', 이름: t, 문서만, 실물만, 문서열: a.length, 실물열: b.length });
    }
  }

  for (const f of 함수들) {
    const a = 함수본문(절, f);
    const b = 함수본문(실물, f);
    if (!a) { 갈린것.push({ 종류: '함수', 이름: f, 왜: '설계문에 정의가 없다' }); continue; }
    if (!b) { 갈린것.push({ 종류: '함수', 이름: f, 왜: '실물에 정의가 없다' }); continue; }
    잰것.push(f);
    const ga = 고르기(a);
    const gb = 고르기(b);
    if (ga !== gb) {
      let i = 0;
      while (i < ga.length && i < gb.length && ga[i] === gb[i]) i += 1;
      갈린것.push({
        종류: '함수',
        이름: f,
        첫갈림: i,
        문서: ga.slice(Math.max(0, i - 30), i + 70),
        실물: gb.slice(Math.max(0, i - 30), i + 70),
      });
    }
  }

  return { 잼: true, 실물경로, 잰것, 갈린것 };
}

const 결과 = 재기();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(결과, null, 2));
  process.exit(결과.잼 ? (결과.갈린것.length ? 1 : 0) : 2);
}

console.log('📐 설계문 DDL 사본 ↔ 실물 스키마 대조');
if (!결과.잼) {
  console.log(`  🟠 못 쟀다 — ${결과.왜}`);
  console.log('  ⚠ 「못 쟀다」는 「갈린 것 0」이 아니다.');
  process.exit(2);
}
console.log(`  과녁: docs/상태기반_과제선택_설계.md §3-5-b  ↔  ${path.basename(결과.실물경로)}`);
console.log(`  잰 것: 표 ${표들.length} · 함수 ${함수들.length} (성립 ${결과.잰것.length})`);
console.log('');
if (!결과.갈린것.length) {
  console.log('  ✅ 갈린 것 없음 — 사본이 실물과 같다.');
  process.exit(0);
}
console.log(`  🔴 갈렸다 ${결과.갈린것.length}건 — **실물이 참이다**(납품이 끝났다). 설계문을 따라오게 한다.\n`);
for (const g of 결과.갈린것) {
  if (g.왜) { console.log(`  · ${g.종류} ${g.이름} — ${g.왜}`); continue; }
  if (g.종류 === '표') {
    console.log(`  · 표 ${g.이름} (문서 ${g.문서열}열 · 실물 ${g.실물열}열)`);
    if (g.실물만.length) console.log(`      실물에만: ${g.실물만.join(', ')}   ← 설계문이 낡았다`);
    if (g.문서만.length) console.log(`      문서에만: ${g.문서만.join(', ')}   ← 실물이 안 받았거나 설계문이 앞섰다`);
  } else {
    console.log(`  · 함수 ${g.이름} — ${g.첫갈림}자째부터 갈린다`);
    console.log(`      문서 …${g.문서}`);
    console.log(`      실물 …${g.실물}`);
  }
}
console.log('\n  🔑 사본을 안 두는 길은 없다 — 그 절의 78%가 실물에 없는 «왜»다. 그래서 대조로 지킨다.');
process.exit(1);
