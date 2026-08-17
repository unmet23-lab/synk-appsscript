'use strict';
/* 업그레이드 제안 층 회귀 — 2026-08-05 (유호님 설계 3단 파이프라인의 ①·② 단)
 *
 * 무엇을 지키나:
 *   ① 기각된 제안은 **다시 올라오지 않는다** — 재제안 방지가 이 층의 존재 이유다.
 *   ② 제안은 **배포를 절대 막지 않는다** — 막으면 codex 없는 폰 경로가 죽는다(F103 재생산).
 *   ③ 기능체크의 「깨짐」은 차단급 지적으로 변환돼 기존 게이트 **한 통로**를 탄다.
 *   ④ 검수자는 앱의 방향(docs/제품방향.md)을 **매번** 먹는다 — 방향 없는 제안은 아무 데나 향한다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 검수 = require(path.join(ROOT, 'tools', 'codex-review.js'));

const 임시장부 = (rows) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-prop-fx-'));
  const p = path.join(d, '제안.jsonl');
  fs.writeFileSync(p, rows.map((o) => JSON.stringify(o)).join('\n') + (rows.length ? '\n' : ''));
  return p;
};
const 제안행 = (키, 제목) => ({ 종류: '제안', 시각: '2026-08-05T00:00:00.000Z', 대상: { 종류: 'uncommitted', 값: '(미커밋)' }, 키, 제목, 무엇을: 'ㄱ', 왜: 'ㄴ', 구현방향: 'ㄷ', 크기: '소', 관련기능: 'ㄹ' });
const 판정행 = (키, 상태, 사유) => ({ 종류: '판정', 시각: '2026-08-05T01:00:00.000Z', 키, 상태, 사유 });

// ───────────────────────────────── 상태 머신

test('제안→기각→같은 제안 재등장이어도 상태는 기각으로 남는다 (판정은 키에 대해 영구다)', () => {
  const p = 임시장부([제안행('k1', 'ㄱ제안'), 판정행('k1', '기각', '방향 안 맞음'), 제안행('k1', 'ㄱ제안')]);
  const s = 검수.제안현황(p);
  assert.strictEqual(s.get('k1').상태, '기각');
  assert.strictEqual(s.get('k1').사유, '방향 안 맞음');
});

test('채택도 같은 방식으로 접힌다 · 판정 없는 제안은 「제안됨」', () => {
  const p = 임시장부([제안행('k1', 'ㄱ'), 판정행('k1', '채택', ''), 제안행('k2', 'ㄴ')]);
  const s = 검수.제안현황(p);
  assert.strictEqual(s.get('k1').상태, '채택');
  assert.strictEqual(s.get('k2').상태, '제안됨');
});

test('제안 없는 판정 행은 유령을 만들지 않는다', () => {
  const s = 검수.제안현황(임시장부([판정행('없는키', '기각', 'x')]));
  assert.ok(!s.has('없는키'));
});

test('제안키는 지적 키와 네임스페이스가 갈린다 — 같은 제목이라도 서로를 못 지운다', () => {
  const 제목 = '같은 문구';
  assert.notStrictEqual(검수.제안키({ 제목 }), 검수.키({ 파일: '', 제목 }));
  assert.strictEqual(검수.제안키({ 제목: ' 같은  문구 ' }), 검수.제안키({ 제목 }), '공백 정규화가 안 된다');
});

// ───────────────────────────────── 프롬프트 (순수 함수 — 라이브 codex 없이 잰다)

test('🔑 선파악 프롬프트에 기각 이력이 「다시 내지 마라」로 실린다 — 재제안 방지의 실제 통로', () => {
  const p = 검수.제안프롬프트('DIFF본문', ['기각된 제안 A', '기각된 제안 B'], '방향본문');
  assert.match(p, /다시 내지 마라/);
  assert.ok(p.includes('기각된 제안 A') && p.includes('기각된 제안 B'));
  assert.ok(p.includes('DIFF본문'));
});

test('🔑 선파악·기능체크 프롬프트 둘 다 앱의 방향을 먹는다 (유호님: "gpt도 내 계획을 알아야")', () => {
  for (const p of [검수.제안프롬프트('d', [], '4개년로드맵텍스트'), 검수.기능체크프롬프트('d', [], '4개년로드맵텍스트')]) {
    assert.ok(p.includes('4개년로드맵텍스트'), '방향 텍스트가 프롬프트에 안 실렸다');
    assert.match(p, /어긋나는 제안은 내지 마라/);
  }
});

/* 🔑 계약이 2026-08-17 에 바뀌었다(유호 픽 ㉡ · F549). 옛 계약은 「**파일**이 상한 안」이었는데,
 *   그 파일은 유호님 확정 문구라 기계가 못 줄인다 — 그래서 master 가 주인 없는 적색으로 섰다.
 *   새 계약은 「**싣는 것**이 상한 안 · 중요한 절이 조용히 안 사라진다」다. 상한값은 그대로. */
test('방향 정본이 실재하고, 싣는 것이 상한 안이며, 안 실린 절은 이름이 드러난다', () => {
  const t = fs.readFileSync(검수.방향경로, 'utf8');
  assert.ok(t.includes('4개년') || t.includes('로드맵'), '방향 파일에 로드맵이 없다');

  const 원본 = console.error; const 잡힌 = []; console.error = (...a) => 잡힌.push(a.join(' '));
  let 실린것;
  try { 실린것 = 검수.방향텍스트(); } finally { console.error = 원본; }

  assert.ok(실린것.includes('데이터'), '방향텍스트()가 파일 내용을 안 돌려준다');
  if (t.length <= 검수.방향상한) {
    assert.strictEqual(잡힌.length, 0, '다 들어가는데 경고를 냈다 — 거짓양성');
    return;                                    // 파일이 상한 안이면 고를 것이 없다
  }
  /* 여기부터는 «넘쳤을 때» 계약이다 — 실저장소가 넘치든 안 넘치든 둘 다 정상이라 갈라 검사한다. */
  const 본문 = 실린것.split('\n\n…(상한')[0];
  assert.ok(본문.length <= 검수.방향상한, `싣는 본문이 상한(${검수.방향상한})을 넘었다 — 프롬프트가 비대해진다`);
  assert.strictEqual(잡힌.length, 1, '뺀 절이 있는데 stderr 가 조용하다 — 운영자가 못 본다');
  // 경고가 내는 수는 `trim()` 뒤 길이다(파일 끝 개행 차이로 1~2자 갈린다) — 재는 층을 맞춘다.
  assert.ok(잡힌[0].includes(t.trim().length.toLocaleString()), `실측 문자수가 경고에 없다: ${잡힌[0]}`);
  assert.match(실린것, /안 실렸다/, '프롬프트 본문에도 «무엇이 빠졌는지»가 있어야 검수자가 안다');
});

test('🔴 넘칠 때 가장 먼저 지키는 절은 «설계 불변식»이다 — 뒤에서 자르면 그게 첫 희생이었다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-방향-우선-'));
  const p = path.join(d, '방향.md');
  const 채움 = (n) => '가'.repeat(n);
  fs.writeFileSync(p, [
    '# 머리', 채움(100),
    '## 로드맵', 채움(2500),
    '## 「출시」의 정의', 채움(2500),
    '## 설계 불변식', 채움(2500),   // 문서 «맨 뒤» — 옛 통로에서 첫 희생이던 자리
  ].join('\n'));

  const 원본 = console.error; const 잡힌 = []; console.error = (...a) => 잡힌.push(a.join(' '));
  let r; try { r = 검수.방향텍스트(p); } finally { console.error = 원본; }

  assert.ok(r.includes('# 머리'), '머리는 언제나 실린다 — 나머지를 읽는 틀이다');
  assert.ok(r.includes('## 설계 불변식'), '🔴 문서 맨 뒤라는 이유로 불변식이 빠졌다 — 고치려던 병 그 자체다');
  assert.ok(!r.includes('## 「출시」의 정의'), '우선순위가 낮은 절이 상한을 먹었다');
  assert.match(r, /안 실렸다/, '빠진 절이 본문에 안 드러난다 — 검수자가 모르고 판정한다');
  assert.ok(잡힌.length === 1 && 잡힌[0].includes('출시'), `뺀 절 이름이 stderr 에 없다: ${잡힌.join('|')}`);
});

test('모르는 새 절은 «버리지 않고» 맨 뒤로 간다 — 정본이 개정돼도 사라지지 않는다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-방향-새절-'));
  const p = path.join(d, '방향.md');
  fs.writeFileSync(p, ['# 머리', '가'.repeat(100), '## 설계 불변식', '나'.repeat(100), '## 아직 없는 절', '다'.repeat(100)].join('\n'));
  const r = 검수.방향텍스트(p);
  assert.ok(r.includes('## 아직 없는 절') && r.includes('다'), '상한 안인데 새 절이 빠졌다');
});

test('방향 정본이 상한을 넘으면 stderr 경고에 실측 문자수가 실린다 — 조용한 뒤잘림 금지 (상한 안이면 침묵)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-방향-fx-'));
  const 초과경로 = path.join(d, '초과.md');
  const 경계경로 = path.join(d, '경계.md');
  fs.writeFileSync(초과경로, '가'.repeat(검수.방향상한 + 1));
  fs.writeFileSync(경계경로, '가'.repeat(검수.방향상한));
  const 잡힌 = [];
  const 원본 = console.error;
  console.error = (...a) => 잡힌.push(a.join(' '));
  try {
    const 잘린 = 검수.방향텍스트(초과경로);
    assert.ok(잘린.startsWith('가'.repeat(검수.방향상한)) && 잘린.includes('잘림'), '잘린 본문·프롬프트 내 경고는 기존 그대로여야 한다');
    assert.strictEqual(잡힌.length, 1, 'stderr 경고가 정확히 1건이어야 한다');
    assert.ok(잡힌[0].includes((검수.방향상한 + 1).toLocaleString()), `실측 문자수가 경고에 없다: ${잡힌[0]}`);
    assert.strictEqual(검수.방향텍스트(경계경로), '가'.repeat(검수.방향상한), '상한 정확히면 절단 없이 원문 그대로');
    assert.strictEqual(잡힌.length, 1, '상한 안인데 경고를 냈다 — 거짓양성');
  } finally { console.error = 원본; }
});

test('기능체크 프롬프트에 채택된 업그레이드가 「구현됐는지 체크」로 실린다', () => {
  const p = 검수.기능체크프롬프트('d', ['채택된 업그레이드 X'], '');
  assert.ok(p.includes('채택된 업그레이드 X'));
  assert.match(p, /구현됐는지도/);
});

// ───────────────────────────────── 기능체크 → 지적 변환 (게이트 한 통로)

test('🔑 깨짐 = P1(차단급) · 의심 = P3(알림) · 정상 = 지적 없음', () => {
  const 지적 = 검수.기능체크지적들([
    { 기능: 'A', 판정: '정상', 근거: 'ok' },
    { 기능: 'B', 판정: '의심', 근거: '조건부' },
    { 기능: 'C', 판정: '깨짐', 근거: '안 돈다' },
  ]);
  assert.strictEqual(지적.length, 2);
  const 깨짐 = 지적.find((f) => f.제목.includes('C'));
  const 의심 = 지적.find((f) => f.제목.includes('B'));
  assert.strictEqual(깨짐.등급, 'P1');
  assert.ok(검수.차단급.has(깨짐.등급), '깨짐이 게이트를 못 막는다');
  assert.strictEqual(의심.등급, 'P3');
  assert.ok(!검수.차단급.has(의심.등급), '의심이 배포를 막는다 — 사람이 우회를 배운다');
});

test('변환된 지적은 키가 계산되고 기각 레버가 듣는 완전한 모양이다', () => {
  for (const f of 검수.기능체크지적들([{ 기능: 'X', 판정: '깨짐', 근거: 'r' }])) {
    assert.ok(f.파일 && f.제목 && f.수정방향, '게이트 출력에 빈 칸이 생긴다');
    assert.match(검수.키(f), /^[0-9a-f]{12}$/);
  }
});

test('기능체크 입력이 null/빈 배열이어도 죽지 않는다 (--버그만 경로)', () => {
  assert.deepStrictEqual(검수.기능체크지적들(null), []);
  assert.deepStrictEqual(검수.기능체크지적들([]), []);
});

// ───────────────────────────────── --제안판정 CLI (실행층)

const 판정실행 = (args, 장부경로) => spawnSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), ...args], {
  encoding: 'utf8',
  env: { ...process.env, SYNK_REVIEW_PROPOSALS: 장부경로 },
});

test('모르는 제안 키에 판정을 거부한다 — 오타 판정은 진짜 제안을 미판정으로 남긴다', () => {
  const r = 판정실행(['--제안판정', 'ghost1', '--채택'], 임시장부([]));
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /모르는 제안 키/);
});

test('기각에 사유가 없으면 거부한다', () => {
  const p = 임시장부([제안행('k1', 'ㄱ')]);
  const r = 판정실행(['--제안판정', 'k1', '--기각'], p);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /사유가 필요/);
});

test('🔑 기각 판정이 장부에 실려 다음 현황에서 기각으로 읽힌다 (왕복)', () => {
  const p = 임시장부([제안행('k1', 'ㄱ제안')]);
  const r = 판정실행(['--제안판정', 'k1', '--기각', '--사유', '방향과 다름'], p);
  assert.strictEqual(r.status, 0, r.stderr);
  const s = 검수.제안현황(p);
  assert.strictEqual(s.get('k1').상태, '기각');
  assert.strictEqual(s.get('k1').사유, '방향과 다름');
});

test('채택은 사유 없이도 되고 장부에 채택으로 남는다', () => {
  const p = 임시장부([제안행('k2', 'ㄴ제안')]);
  const r = 판정실행(['--제안판정', 'k2', '--채택'], p);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(검수.제안현황(p).get('k2').상태, '채택');
});

test('--채택 과 --기각 을 같이 주면 거부한다 (둘 다 아닌 것도)', () => {
  const p = 임시장부([제안행('k1', 'ㄱ')]);
  assert.notStrictEqual(판정실행(['--제안판정', 'k1', '--채택', '--기각', '--사유', 'x'], p).status, 0);
  assert.notStrictEqual(판정실행(['--제안판정', 'k1'], p).status, 0);
});

// ───────────────────────────────── 스키마 (OpenAI 구조화 출력 규약)

test('제안·기능체크 스키마가 구조화 출력 규약을 지킨다 — required 전수 + additionalProperties:false', () => {
  for (const f of ['검수제안.schema.json', '기능체크.schema.json']) {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8'));
    const 확인 = (obj, 경로) => {
      if (!obj || obj.type !== 'object' || !obj.properties) return;
      const keys = Object.keys(obj.properties);
      const req = obj.required || [];
      for (const k of keys) assert.ok(req.includes(k), `${f} ${경로}.${k} 가 required 에 없다`);
      assert.strictEqual(obj.additionalProperties, false, `${f} ${경로} 에 additionalProperties:false 가 없다`);
      for (const k of keys) {
        확인(obj.properties[k], `${경로}.${k}`);
        if (obj.properties[k].items) 확인(obj.properties[k].items, `${경로}.${k}[]`);
      }
    };
    확인(s, '$');
  }
});

// ───────────────────────────────── 변경지문(change_id) · 계보 — 제안 61d775a5b85d 채택분

test('🔑 변경지문은 내용으로 갈린다 — 같은 diff는 같고, 한 글자만 달라도 다르다', () => {
  assert.strictEqual(검수.변경지문('DIFF'), 검수.변경지문('DIFF'));
  assert.notStrictEqual(검수.변경지문('DIFF'), 검수.변경지문('DIFf'));
  assert.match(검수.변경지문('x'), /^[0-9a-f]{12}$/);
});

test('🔑 선파악 기능지도·제안 행에 변경지문이 박힌다 (안 박히면 최종이 지도를 못 찾는다)', () => {
  const 결과 = { 기능지도: [{ 기능: 'A', 설명: 'ㄱ' }], 제안: [{ 제목: 'P', 무엇을: 'a', 왜: 'b', 구현방향: 'c', 크기: '소', 관련기능: 'A' }] };
  const { 기록행들 } = 검수.선파악행들({ 종류: 'uncommitted', 값: '(미커밋)' }, 결과, new Map(), 'T', 'dir00', 'chg00');
  assert.strictEqual(기록행들.length, 2);
  for (const 행 of 기록행들) assert.strictEqual(행.변경, 'chg00', `${행.종류} 행에 변경지문이 없다`);
});

test('🔑 판정 행은 변경지문을 원 제안에서 **복사**한다 — 다시 재면 딴 변경을 가리킨다', () => {
  const p = 임시장부([{ ...제안행('k1', 'ㄱ'), 변경: 'chg99' }]);
  assert.strictEqual(판정실행(['--제안판정', 'k1', '--채택'], p).status, 0);
  const 마지막 = fs.readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse).pop();
  assert.strictEqual(마지막.종류, '판정');
  assert.strictEqual(마지막.변경, 'chg99');
});

// ───────────────────────────────── 폐루프 대조 — 제안 590c00590105 채택분(알림이지 차단이 아니다)

test('🔑 선파악이 알던 기능을 최종이 안 짚으면 미확인으로 드러난다 · 이름 흔들림(공백·대소문자)은 흡수한다', () => {
  const 지도 = [{ 기능: 'Alpha 기능' }, { 기능: '베타' }, { 기능: '감마' }];
  const 체크 = [{ 기능: 'alpha  기능' }, { 기능: ' 베타 ' }];
  assert.deepStrictEqual(검수.미확인기능들(지도, 체크), ['감마']);
  assert.deepStrictEqual(검수.미확인기능들(지도, 지도), [], '같은 목록인데 미확인이 남는다');
});

test('🔑 선파악이 없으면 null — 「대조 안 함」과 「미확인 0건」이 같은 모양이면 안 된다', () => {
  const p = 임시장부([{ 종류: '기능지도', 시각: 'T', 변경: 'chgAA', 기능지도: [{ 기능: 'A' }] }]);
  assert.strictEqual(검수.선파악지도('없는변경', p), null);
  assert.deepStrictEqual(검수.선파악지도('chgAA', p), [{ 기능: 'A' }]);
});

test('🔑 미확인·학습데이터는 지적 배열에 섞이지 않는다 — 둘 다 알림이지 차단 레버가 아니다', () => {
  // 채택 판정문이 명시적으로 「미매칭은 반드시 알림(미확인)이지 차단이 아니다」로 못박았다.
  // 누가 지적 조립부에 얹으면 P1 이 되어 배포를 막는다 — 그 시도를 여기로 데려온다.
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 줄 = src.split('\n').find((l) => l.includes('const 지적 = ['));
  assert.ok(줄, '지적 조립부를 소스에서 못 찾았다');
  assert.doesNotMatch(줄, /미확인|학습데이터/, '미확인·학습데이터가 지적으로 변환된다(차단 레버에 얹혔다)');
});

// ───────────────────────────────── 학습데이터 영향 계약 — 제안 16967d287d18 채택분

test('🔑 두 프롬프트 다 「해당 없으면 빈 배열」을 시킨다 — 기능마다 「없음」을 적게 하면 노이즈가 검사를 끈다', () => {
  for (const p of [검수.제안프롬프트('d', [], ''), 검수.기능체크프롬프트('d', [], '')]) {
    assert.match(p, /수집·시트 스키마·학생 산출물/, '학습데이터 지시가 프롬프트에 없다');
    assert.match(p, /빈 배열/);
    assert.match(p, /기능마다 「없음」을 적지 마라/);
  }
});

test('학습데이터 줄은 외부 PII 전송을 눈에 띄게 표시한다 · 빈 입력에서 죽지 않는다', () => {
  const 줄 = 검수.학습데이터줄들([{ 기능: 'A', 영향: '생성', 원문보존: true, 키: '학생ID', 스키마버전: 'c8', 외부PII전송: true }]);
  assert.match(줄[0], /외부 PII 전송/);
  assert.deepStrictEqual(검수.학습데이터줄들(null), []);
});

test('스키마 두 벌 다 학습데이터를 계약 5필드로 요구한다 (기능 참조 + 영향 3값)', () => {
  for (const f of ['검수제안.schema.json', '기능체크.schema.json']) {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8'));
    assert.ok(s.required.includes('학습데이터'), `${f} 루트 required 에 학습데이터가 없다`);
    const it = s.properties.학습데이터.items;
    assert.deepStrictEqual(it.required, ['기능', '영향', '원문보존', '키', '스키마버전', '외부PII전송']);
    // 「없음」이 열거에 있으면 채택 때 잘라낸 「전 항목 없음 선언」이 그대로 되살아난다
    assert.deepStrictEqual(it.properties.영향.enum, ['조회', '생성', '스키마변경']);
  }
});

// ───────────────────────────────── 게이트 무관성 (제안은 절대 안 막는다)

test('🔑 기각 안 된 제안이 산더미여도 게이트판정은 제안 장부를 아예 안 본다', () => {
  // 누가 제안을 게이트에 물리면(=차단 사유로 만들면) F103 재생산이다. 함수 본문에 제안 관련
  // 식별자가 등장하는 순간 이 테스트가 깨져 그 시도를 여기로 데려온다.
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 시작 = src.indexOf('function 게이트판정');
  assert.ok(시작 !== -1, '게이트판정을 소스에서 못 찾았다');
  const 끝 = src.indexOf('\n}', 시작);
  const 본문 = src.slice(시작, 끝);
  assert.doesNotMatch(본문, /제안/, '게이트판정이 제안 층을 읽는다 — 제안은 절대 배포를 막지 않는다(F103)');
});
