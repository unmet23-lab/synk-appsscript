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

test('방향 정본 파일이 저장소에 실재하고 상한 안이다 — 없으면 검수자가 방향 없이 돈다', () => {
  const t = fs.readFileSync(검수.방향경로, 'utf8');
  assert.ok(t.includes('4개년') || t.includes('로드맵'), '방향 파일에 로드맵이 없다');
  assert.ok(t.length <= 검수.방향상한, `방향 파일이 상한(${검수.방향상한})을 넘는다 — 프롬프트가 비대해진다`);
  assert.ok(검수.방향텍스트().includes('데이터'), '방향텍스트()가 파일 내용을 안 돌려준다');
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
