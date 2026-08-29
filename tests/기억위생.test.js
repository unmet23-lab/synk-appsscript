'use strict';
/**
 * 기억 위생 회귀 — 자가 «죽었을 때 무엇이 보이나»까지 센다 (2026-08-30 신설).
 *
 * ■ 왜 이 시험이 있나
 *   08-29 에 사람이 손으로 기억 332벌을 훑어 `name` 불일치 70벌을 찾아 손으로 고쳤다.
 *   기계는 그 셋을 **원리상** 못 봤다 — `memory-graph.js` 가 프론트매터를 한 줄도 안 읽었다.
 *   그 구멍을 메우면서 «자 자신이 병드는» 자리를 넷 밟았고, 넷 다 쓰기 «직전» 검산으로 잡았다:
 *     ① `stripBacklinks` 가 끝 표식 없는 파일의 뒤를 통째로 버렸다(그대로 쓰면 문단 소실)
 *     ② 줄끝 판정이 CRLF 한 줄에 파일 전체를 뒤집었다(247벌)
 *     ③ 그걸 좁혀도 본문 CRLF·블록 LF 인 74벌이 여전히 뒤집혔다(매 실행 진동)
 *     ④ 래칫이 폴더를 안 갈라, 사본에 대고 돌린 값이 진짜 폴더의 상한이 됐다(거짓 경보)
 *   손으로 한 번 본 것은 그 한 번이 지나면 안 남는다. 그래서 여기서 «매번» 잰다.
 *
 * 🔴 이 시험이 지키는 한 문장 — **「0건」과 「미실행」은 절대 같은 얼굴이면 안 된다.**
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const M = require('../tools/memory-graph.js');

/** 임시 기억 폴더를 만들고 그 안에서 돌린다. */
function 임시폴더(파일들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-기억위생-'));
  for (const [이름, 내용] of Object.entries(파일들)) fs.writeFileSync(path.join(d, 이름), 내용, 'utf8');
  return d;
}
const 토픽 = (name, 본문 = '몸통') =>
  `---\nname: ${name}\ndescription: 한 줄\nmetadata:\n  node_type: memory\n  type: project\n---\n\n${본문}\n`;

test('프론트매터 — 있는 것/없는 것/들여쓴 것을 가른다', () => {
  const fm = M.프론트매터(토픽('가', '몸통'));
  assert.strictEqual(fm.있나, true);
  assert.strictEqual(fm.name, '가');
  assert.strictEqual(fm.node_type, 'memory');   // metadata 밑 들여쓴 줄
  assert.strictEqual(fm.type, 'project');
  // 🔴 없는 것은 «없다»가 아니라 있나:false 다 — 미실행과 통과가 같은 얼굴이면 안 된다.
  assert.strictEqual(M.프론트매터('프론트매터가 없는 파일').있나, false);
});

test('🔴 끝 표식이 없으면 stripBacklinks 는 «아무것도 안 자른다»', () => {
  const 원문 = `앞\n${M.MARK_START}\n- 관련 ← [[x]]\n뒤가 여기 있다`;
  assert.strictEqual(M.표식깨짐(원문), true);
  // 예전엔 여기서 「앞」만 남기고 뒤를 통째로 버렸다. 그게 writeBacklinks 의 base 가 되면 파일이 잘린다.
  assert.ok(M.stripBacklinks(원문).includes('뒤가 여기 있다'), '뒤가 사라지면 안 된다');
  // 성한 파일은 그대로 걷는다.
  const 성한 = `앞\n${M.MARK_START}\n- 관련 ← [[x]]\n${M.MARK_END}\n뒤`;
  assert.strictEqual(M.표식깨짐(성한), false);
  assert.ok(!M.stripBacklinks(성한).includes('[[x]]'));
});

test('위생 — 「0건」과 「확인 불가」가 다른 얼굴이다', () => {
  // ① 폴더를 못 읽음
  assert.match(M.위생(null, '/없는곳').확인불가, /못 읽었다/);
  // ② 폴더는 읽혔는데 토픽이 0벌 — 이건 «깨끗»이 아니다(워크트리에서 딴 폴더를 물면 이 얼굴이 난다)
  const 빈 = M.load(임시폴더({}));
  assert.match(M.위생(빈, '빈폴더').확인불가, /토픽 0벌/);
  // ③ 성한 폴더 — 확인불가는 null 이고 분모가 선다
  const d = 임시폴더({ '가.md': 토픽('가'), '나.md': 토픽('나') });
  const w = M.위생(M.load(d), d);
  assert.strictEqual(w.확인불가, null);
  assert.strictEqual(w.분모, 2);
  assert.strictEqual(w.판정거리.name불일치.length, 0);
});

test('위생 — name 이 파일명과 어긋나면 «판정거리»로 올린다(자동으로 안 고친다)', () => {
  const d = 임시폴더({ '가.md': 토픽('가-2026-08-01') });
  const w = M.위생(M.load(d), d);
  assert.strictEqual(w.판정거리.name불일치.length, 1);
  assert.strictEqual(w.판정거리.name불일치[0].name, '가-2026-08-01');
  // 🔴 «고칠것»에는 없어야 한다 — 어느 쪽이 정본인지는 기계가 모른다(읽는 코드가 이 저장소에 0줄).
  assert.deepStrictEqual(Object.keys(w.고칠것), ['역링크뒤처짐']);
});

test('위생 — 「여러 절이 정상」이라고 파일이 선언하면 일지형에서 뺀다', () => {
  const 일지 = '## 회차 2026-08-01\n본문\n## 회차 2026-08-02\n본문\n## 회차 2026-08-03\n본문\n## 회차 2026-08-04\n본문\n';
  const d1 = 임시폴더({ '가.md': 토픽('가', 일지) });
  assert.strictEqual(M.위생(M.load(d1), d1).판정거리.일지형.length, 1);
  const 선언 = `---\nname: 가\ndescription: 한 줄\n위생: 여러절\nmetadata:\n  node_type: memory\n  type: project\n---\n\n${일지}`;
  const d2 = 임시폴더({ '가.md': 선언 });
  assert.strictEqual(M.위생(M.load(d2), d2).판정거리.일지형.length, 0,
    '면제는 숨은 목록이 아니라 «파일 안 필드»여야 한다(한글 grep 은 낱말 안을 문다)');
});

test('역링크 — 중복을 접고, 두 번째 실행은 0벌이다(멱등)', () => {
  const d = 임시폴더({
    '가.md': 토픽('가', '[[나]] 그리고 또 [[나]]'),
    '나.md': 토픽('나', '몸통'),
  });
  const r1 = M.위생고치기(M.load(d));
  assert.ok(r1.고친것.length >= 1);
  assert.strictEqual(r1.못고친것.length, 0);
  const 나 = fs.readFileSync(path.join(d, '나.md'), 'utf8');
  assert.strictEqual((나.match(/관련 ← \[\[가\]\]/g) || []).length, 1, '중복이 접혀야 한다');
  assert.ok(나.includes('## ← 역링크 (1)'), '헤더 수도 접힌 뒤 수여야 한다');
  // 멱등 — 다시 돌리면 0벌
  assert.strictEqual(M.위생고치기(M.load(d)).고친것.length, 0);
});

test('🔴 역링크 — 이미 있는 블록의 줄끝을 바꾸지 않는다(매 실행 진동 방지)', () => {
  const 본문CRLF = 토픽('나', '몸통').replace(/\n/g, '\r\n');
  const 블록LF = `\n\n${M.MARK_START}\n## ← 역링크 (1)\n- 관련 ← [[가]]\n${M.MARK_END}\n`;
  const d = 임시폴더({ '가.md': 토픽('가', '[[나]]'), '나.md': 본문CRLF.replace(/\s+$/, '') + 블록LF });
  const b = M.역링크블록(M.load(d).get('나'));
  assert.strictEqual(b.바뀌나, false, '뜻이 같으면 줄끝만으로 다시 쓰지 않는다');
});

test('🔴 역링크 — 표식이 반쪽인 파일은 «건너뛴다»', () => {
  const d = 임시폴더({
    '가.md': 토픽('가', '[[나]]'),
    '나.md': `${토픽('나', '몸통').replace(/\s+$/, '')}\n\n${M.MARK_START}\n- 관련 ← [[가]]\n지워지면 안 되는 꼬리`,
  });
  const nodes = M.load(d);
  assert.strictEqual(nodes.get('나').표식깨짐, true);
  M.위생고치기(nodes);
  assert.ok(fs.readFileSync(path.join(d, '나.md'), 'utf8').includes('지워지면 안 되는 꼬리'));
});

test('안전쓰기 — 검산에 실패하면 원문을 되돌린다', () => {
  const d = 임시폴더({ '가.md': 토픽('가') });
  const p = path.join(d, '가.md');
  const 원문 = fs.readFileSync(p, 'utf8');
  const r = M.안전쓰기(p, '깨진 내용(프론트매터가 없다)', 원문);
  assert.strictEqual(r.됐나, false);
  assert.strictEqual(fs.readFileSync(p, 'utf8'), 원문, '되돌아와야 한다');
  assert.strictEqual(fs.readdirSync(d).filter((f) => f.includes('.tmp')).length, 0, 'tmp 잔해 0');
});

test('위생훅줄 — 어떤 경우에도 던지지 않고, 침묵하지 않는다', () => {
  const 옛 = process.env.SYNK_MEMORY_DIR;
  try {
    for (const 자리 of [path.join(os.tmpdir(), '없는폴더-' + Date.now()), 임시폴더({}), 임시폴더({ '가.md': 토픽('가') })]) {
      process.env.SYNK_MEMORY_DIR = 자리;
      const 줄 = M.위생훅줄();
      assert.ok(typeof 줄 === 'string' && 줄.trim().length > 0, '침묵은 답이 아니다: ' + 자리);
      assert.ok(줄.includes('기억'), '무엇을 잰 줄인지 말해야 한다');
    }
  } finally {
    if (옛 === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = 옛;
  }
});

test('자판은 한 곳에만 산다 — 자가 바뀌면 수가 바뀐다는 것을 시험이 안다', () => {
  assert.ok(Number.isInteger(M.위생자판.판) && M.위생자판.판 >= 1);
  assert.ok(M.위생자판.시각지문절 >= 2);
  // 자를 고치면서 판을 안 올리면, 래칫이 «폴더가 변한 것»과 «자가 변한 것»을 못 가른다.
  assert.ok(Object.isFrozen(M.위생자판), '자판은 얼려 둔다 — 실행 중에 흔들리면 안 된다');
});

test('훅이 «스스로» 고친다 — 작은 표류는 사람 손을 안 부른다', () => {
  const d = 임시폴더({ '가.md': 토픽('가', '[[나]]'), '나.md': 토픽('나', '몸통') });
  const 옛 = process.env.SYNK_MEMORY_DIR;
  try {
    process.env.SYNK_MEMORY_DIR = d;
    const 줄1 = M.위생훅줄();
    assert.match(줄1, /스스로 고침/, '보고만 하면 미완성이다 — 그 자리에서 고쳐야 한다');
    // 두 번째는 고칠 것이 없으니 조용하다(멱등).
    assert.ok(!/스스로 고침/.test(M.위생훅줄()));
  } finally {
    if (옛 === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = 옛;
  }
});

test('🔴 잠금을 못 잡으면 «고치지 않고 말한다» — 남의 것을 죽이지 않는다', () => {
  const d = 임시폴더({ '가.md': 토픽('가', '[[나]]'), '나.md': 토픽('나', '몸통') });
  fs.writeFileSync(path.join(d, '.위생잠금'), '{"pid":999999}', 'utf8');   // 남이 잡고 있는 척
  const 옛 = process.env.SYNK_MEMORY_DIR;
  try {
    process.env.SYNK_MEMORY_DIR = d;
    const 줄 = M.위생훅줄();
    assert.match(줄, /잠금 못 잡음/, '왜 안 고쳤는지 말해야 한다 — 침묵은 「고쳤다」와 같은 얼굴이 된다');
    assert.ok(!/스스로 고침/.test(줄));
  } finally {
    if (옛 === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = 옛;
  }
});

test('🔴 뭉텅이는 훅이 «안» 건드린다 — 제 커밋으로 설 자리다', () => {
  const 파일들 = {};
  // 상한을 넘기려면 역링크가 뒤처진 파일이 상한보다 많아야 한다.
  const n = M.훅자동교정_상한 + 5;
  파일들['허브.md'] = 토픽('허브', Array.from({ length: n }, (_, i) => `[[t${i}]]`).join(' '));
  for (let i = 0; i < n; i++) 파일들[`t${i}.md`] = 토픽(`t${i}`, '몸통');
  const d = 임시폴더(파일들);
  const 옛 = process.env.SYNK_MEMORY_DIR;
  try {
    process.env.SYNK_MEMORY_DIR = d;
    const 줄 = M.위생훅줄();
    assert.match(줄, /뭉텅이라 안 건드린다/);
    assert.ok(!/스스로 고침/.test(줄), '뭉텅이를 훅이 삼키면 그날의 진짜 변경이 그 안에 묻힌다');
  } finally {
    if (옛 === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = 옛;
  }
});
