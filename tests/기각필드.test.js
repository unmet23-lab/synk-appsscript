/**
 * 기각 필드 가드 — 유호님이 「필드로 만들지 않는다」로 확정한 이름이
 * 계약·DDL·발주서에 **필드로** 되살아나는 것을 막는다.
 *
 * 왜 (F125, 2026-08-06): privacy_class 는 계약의 `필드로_만들지_않는다` 에
 * 재제안 금지로 박혀 있는데 발주서 DDL 이 그것을 되살렸다. 더 나쁜 건
 * 그 옆 주석이 「c4 계약 privacy_class 축 준수」라고 **정반대로** 적혀 있던 것이다.
 * 목록을 열지 않고 이름만 보고 준수라고 썼기 때문이고, 그건 사람이 읽어야
 * 발동하는 규칙이라 안 돌았다. 그래서 기계로 옮긴다.
 *
 * 🔑 설계 두 가지
 *  ① **설명·주석은 통과시킨다**(F103). 「privacy_class 는 만들지 않는다」라고
 *     쓰는 것까지 막으면 사람이 이 가드를 끄게 된다 — 금지 사유를 적는 것은
 *     위반이 아니라 정확히 우리가 원하는 행동이다. 잡는 것은 **정의부**뿐이다.
 *  ② 탐지력은 **픽스처**가 지고, 실저장소·형제 저장소 검사는 없으면
 *     **skip 으로 드러낸다**(통과와 미실행이 같은 모양이면 안 된다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const 계약경로 = path.join(REPO, '계약', '수집_교정_계약.json');
/** 형제 저장소(있을 때만 검사한다 — CI 에는 없다).
 *  자리는 정본 통로에서 — 손으로 `REPO/..` 를 적으면 **워크트리에서 이 검사가 늘 skip 된다**
 *  (`..` 이 `worktrees/` 를 가리킨다). 코드 트랙은 규약상 워크트리에서 짓는다. */
const TALK = require(path.join(REPO, '.claude', 'hooks', 'lib', '형제저장소.js')).형제경로(REPO);

function 계약읽기() {
  return JSON.parse(fs.readFileSync(계약경로, 'utf8'));
}

/** 계약이 「만들지 않는다」고 못박은 이름들 */
function 기각이름들(계약) {
  const 목록 = 계약?.learning_events?.필드로_만들지_않는다;
  return Object.keys(목록 || {});
}

/** SQL 에서 주석을 걷어낸다 — 주석 속 금지 사유는 위반이 아니다 */
function sql주석제거(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 블록 주석
    .replace(/--[^\n]*/g, ' ');          // 줄 주석
}

/**
 * SQL 본문에서 **컬럼으로 정의된** 이름만 뽑는다.
 * 잡는 것: `create table` 본문의 `<이름> <타입>` · `add column [if not exists] <이름>`
 * 안 잡는 것: 주석 · 문자열 · 다른 단어의 일부(경계 검사)
 */
function sql컬럼정의(sql, 이름) {
  const 본문 = sql주석제거(sql);
  const n = 이름.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const 패턴 = [
    new RegExp(`add\\s+column\\s+(if\\s+not\\s+exists\\s+)?"?${n}"?\\b`, 'i'),
    // 줄 첫머리(들여쓰기 허용)에 이름이 오고 뒤에 타입이 붙는 형태 = 테이블 본문의 컬럼 정의
    new RegExp(`^\\s*"?${n}"?\\s+[a-z]`, 'im'),
  ];
  return 패턴.some((p) => p.test(본문));
}

/** md 안의 ```sql 코드블록만 이어붙인다 — 산문 속 언급은 검사 대상이 아니다 */
function mdSql블록(md) {
  const out = [];
  const re = /```sql\s*([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out.join('\n');
}

/** 계약 안에서 **필드로** 쓰인 이름 전부(값이 아니라 키) */
function 계약필드이름들(계약) {
  const 모음 = new Set();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k !== '필드로_만들지_않는다') 모음.add(k);
      if (v && typeof v === 'object' && k !== '필드로_만들지_않는다') walk(v);
    }
  })(계약?.learning_events?.필드);
  return 모음;
}

// ── 1. 목록 자체가 살아 있는가 ────────────────────────────────
// 빈 목록은 모든 검사를 통과시킨다 — 계약 파일 본문이 직접 그렇게 경고한다.
test('기각 목록이 비어 있지 않다 (빈 목록은 이 가드 전체를 무력화한다)', () => {
  const 이름들 = 기각이름들(계약읽기());
  assert.ok(이름들.length > 0, '계약의 learning_events.필드로_만들지_않는다 가 비었다');
  assert.ok(이름들.includes('privacy_class'), 'F125 의 원항목 privacy_class 가 목록에서 사라졌다');
});

// ── 2. 계약 자신이 자기 기각을 어기지 않는가 ──────────────────
test('기각된 이름이 계약의 필드 정의에 없다', () => {
  const 계약 = 계약읽기();
  const 필드 = 계약필드이름들(계약);
  for (const 이름 of 기각이름들(계약)) {
    assert.ok(!필드.has(이름), `계약이 스스로 기각한 ${이름} 을 필드로 정의했다`);
  }
});

// ── 3. 탐지력 — 픽스처로 못박는다 ────────────────────────────
test('픽스처: DDL 이 기각 필드를 되살리면 잡는다', () => {
  const 위반 = `
    create table engine.submissions (
      submission_id uuid primary key,
      privacy_class text not null,
      body text
    );`;
  assert.ok(sql컬럼정의(위반, 'privacy_class'), '컬럼 정의를 못 잡았다');

  const 위반2 = `alter table engine.submissions add column if not exists privacy_class text;`;
  assert.ok(sql컬럼정의(위반2, 'privacy_class'), 'add column 형태를 못 잡았다');
});

test('픽스처: 금지 사유를 적은 주석·산문은 통과시킨다 (F103 자기처방 검사)', () => {
  const 정당 = `
    -- privacy_class 는 만들지 않는다 (유호님 기각 확정 · L0 §6-2)
    /* 승격은 privacy_class 가 아니라 data_use.granted 사건으로 */
    create table engine.submissions (
      submission_id uuid primary key
    );`;
  assert.ok(
    !sql컬럼정의(정당, 'privacy_class'),
    '금지 사유를 적은 주석을 위반으로 잡았다 — 이러면 사람이 가드를 끈다'
  );
});

test('픽스처: 이름이 다른 단어에 묻혀 있으면 잡지 않는다', () => {
  const 무관 = `
    create table t (
      privacy_class_note text,
      x_privacy_class text
    );`;
  assert.ok(!sql컬럼정의(무관, 'privacy_class'), '부분 일치를 위반으로 잡았다');
});

test('픽스처: md 는 sql 코드블록만 본다', () => {
  const md = [
    '본문에서 privacy_class 를 왜 안 만드는지 설명한다.',
    '```sql',
    'alter table x add column privacy_class text;',
    '```',
  ].join('\n');
  assert.ok(sql컬럼정의(mdSql블록(md), 'privacy_class'), 'sql 블록 안 위반을 못 잡았다');

  const 산문만 = 'privacy_class 는 만들지 않는다. 승격은 사건이다.';
  assert.strictEqual(mdSql블록(산문만), '', '산문만 있는 md 에서 sql 을 뽑아냈다');
});

/**
 * 알려진 잔여 — **신규 유입만 막고 기존 부채는 통과시킨다.**
 * 이걸 안 두면 이 가드가 남의 배포 게이트를 막는다(CLAUDE.md: 주인 없이 남은 적색).
 * 🔑 목록은 **스스로 청소된다** — 여기 적힌 자리에 위반이 실제로 없으면 실패한다.
 *    그래야 「고쳐졌는데 예외만 남아 다음 위반을 덮는」 상태가 안 생긴다.
 */
const 알려진잔여 = {
  'docs\\검수의뢰_엔진수집설계.md: privacy_class':
    '영구 — GPT 이종 검수에 **잘못된 설계 원문 그대로** 보낸 기록이다. 고치면 검수 이력이 거짓이 된다.',
  // 2026-08-06 12:13 실측: 발주_수집파이프라인.md 는 L0 §9 재작성으로 SQL 블록에서 사라졌다.
  // 이 가드의 「유령 예외」 검사가 그 순간을 잡아 이 줄을 지우게 했다 — 목록은 스스로 청소된다.
};

// ── 4. 실물 검사 — 형제 저장소가 있을 때만 (없으면 skip 으로 드러낸다) ──
test('형제 저장소 SYNK-talk 의 DDL·발주서가 기각 필드를 되살리지 않았다', (t) => {
  if (!fs.existsSync(TALK)) {
    t.skip(`형제 저장소 없음(${TALK}) — 이 검사는 실행되지 않았다. 탐지력은 위 픽스처가 진다`);
    return;
  }
  const 이름들 = 기각이름들(계약읽기());
  const 대상 = [];

  const sqlDir = path.join(TALK, 'supabase');
  if (fs.existsSync(sqlDir)) {
    for (const f of fs.readdirSync(sqlDir).filter((n) => n.endsWith('.sql'))) {
      대상.push([path.join('supabase', f), fs.readFileSync(path.join(sqlDir, f), 'utf8')]);
    }
  }
  const docsDir = path.join(TALK, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir).filter((n) => n.endsWith('.md'))) {
      대상.push([path.join('docs', f), mdSql블록(fs.readFileSync(path.join(docsDir, f), 'utf8'))]);
    }
  }

  if (대상.length === 0) {
    t.skip('형제 저장소에 검사할 sql·md 가 없다 — 실행되지 않았다');
    return;
  }

  const 위반 = [];
  for (const [경로, 본문] of 대상) {
    for (const 이름 of 이름들) {
      if (sql컬럼정의(본문, 이름)) 위반.push(`${경로}: ${이름}`);
    }
  }

  const 신규 = 위반.filter((v) => !(v in 알려진잔여));
  assert.deepStrictEqual(
    신규,
    [],
    `유호님이 기각 확정한 필드가 DDL 에 새로 되살아났다(F125 재발):\n  ${신규.join('\n  ')}`
  );

  // 목록이 스스로 청소되게 — 고쳐진 자리에 예외만 남으면 다음 위반을 덮는다
  const 유령 = Object.keys(알려진잔여).filter((v) => !위반.includes(v));
  assert.deepStrictEqual(
    유령,
    [],
    `알려진잔여에 적힌 자리가 이미 고쳐졌다 — 그 줄을 지워라(안 지우면 다음 위반을 덮는다):\n  ${유령.join('\n  ')}`
  );
});
