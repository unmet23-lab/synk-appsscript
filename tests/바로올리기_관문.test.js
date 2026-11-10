/* 바로올리기 — push 앞 관문(공개 검사 · 관련 시험)과 곁 명령(따라가기 기본 · 장부 · 가볍게 · 명령줄).
 * 도구: tools/바로올리기.js. 임시 bare 원격(origin) · 공용 작업본(메인) · 세션 워크트리(연결 작업본) · 남의 클론으로 잰다.
 * 실제 저장소·원격·전역 git 설정은 건드리지 않는다. 판 · 환경 정리 · 시험 전용 전역 git 설정은 tests/lib/바로올리기판.js.
 * 한 파일이던 tests/바로올리기.test.js(시험 136개, 단독 47분)를 11-11에 다섯으로 나눴다 — 파일 안 시험은 동기 git 호출로 차례로 돌아
 *   나눠야 node --test가 나란히 돌린다(docs/현장노트/시험_화면확인.md 「바로올리기 시험 한 파일이 test-ci 전체 런의 긴 막대다」).
 *   이름으로 다시 돌릴 때: node --test --test-name-pattern="…" "tests/바로올리기*.test.js" */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  REPO, 도구경로, 도구, 정책, 원격머리, 새판, 지문, 공용글, rename막기,
} = require('./lib/바로올리기판.js');

// ── 공개 검사(tools/공개검사.js) ─────────────────────────────────────────────

/** 시험 값은 실행 때 조립한다 — 이 시험 파일 자체가 공개 검사에 걸리지 않게 */
const 이어 = (...조각) => 조각.join('');
const 공개정책 = (허용 = []) => `${JSON.stringify({ 판: 1, 설명: '시험', 허용 }, null, 2)}\n`;

// 가림 검사는 표시 글을 본다. Git SHA에 우연히 섞인 시험 번호 네 자리는 개인정보가 아니다.
function 공개표시글(결과) {
  const 표시 = structuredClone(결과);
  for (const 열쇠 of ['바탕', '원격머리']) {
    if (/^[a-f0-9]{40}$/.test(표시[열쇠] || '')) 표시[열쇠] = '<Git SHA>';
  }
  if (표시.공개) {
    if (/^[a-f0-9]{40}$/.test(표시.공개.공개판 || '')) 표시.공개.공개판 = '<Git SHA>';
    if (/^[a-f0-9]{9}:tools\/공개검사_허용\.json$/.test(표시.공개.정책 || '')) 표시.공개.정책 = '<정책 Git SHA>:tools/공개검사_허용.json';
  }
  return JSON.stringify(표시);
}


test('공개 검사: 가림 단언은 Git SHA의 번호 충돌만 제외하고 표시 값의 노출은 잡는다', () => {
  const 지문 = `5a207${이어('38', '47')}4af744bff71b8f9991cb1d6b314ad51`;
  const 번호 = 이어('38', '47');
  const 결과 = { 바탕: 지문, 원격머리: 지문, 공개: { 공개판: 지문, 정책: `${지문.slice(0, 9)}:tools/공개검사_허용.json`, 걸림: [{ 값: '010…(13자, 끝 13)' }] } };
  const 전 = structuredClone(결과);
  assert.ok(!공개표시글(결과).includes(번호));
  assert.deepEqual(결과, 전, '원래 결과는 바꾸지 않는다');
  assert.ok(공개표시글({ ...결과, 이유: 번호 }).includes(번호), '표시 글에 샌 번호는 잡는다');
  assert.ok(공개표시글({ ...결과, 바탕: 번호 }).includes(번호), 'SHA 꼴이 아닌 값은 제외하지 않는다');
  assert.ok(공개표시글({ ...결과, 공개: { ...결과.공개, 걸림: [{ 값: 번호 }] } }).includes(번호), '가림 값의 노출은 잡는다');
  assert.ok(공개표시글({ ...결과, 문제: [{ 값: 지문 }] }).includes(번호), '다른 필드의 해시는 무조건 제외하지 않는다');
});

test('공개 검사: 휴대폰·주민번호·개인 메일·특허 칸·비공개 표시·명단 표·파일 이름은 미리 보기와 --실행 모두 멈추고 아무것도 올리지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'tools/공개검사_허용.json': 공개정책(), 'docs/상담.md': '# 상담\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('docs/상담.md', [
    '# 상담',
    이어('- 바트 연락처 01', '0-3847-2913'),
    이어('- 몽골 번호 +976 99', '38 4721'),
    이어('- 등록번호 050315-3', '847291'),
    이어('- 메일 bat.erdene', '@gm', 'ail.com'),
    이어('【청구', '항 1】 학습 방법'),
    이어('**대외', '비**'),
    이어('| 이', '름 | 연락처 | 반 |'),
    '',
  ].join('\n'));
  워.쓰기(이어('docs/학생', '명단.xlsx'), Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0]));
  const 전 = { 원격: 판.원격머리(), 머리: 워.머리() };
  for (const 실행 of [false, true]) {
    const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs'], 메시지: '상담 기록', 실행 });
    assert.equal(r.결과, '멈춤', JSON.stringify(r));
    assert.match(r.이유, /공개 검사: .*공개허용/);
    assert.deepEqual(r.문제.filter((x) => x.공개).map((x) => x.경로),
      [2, 3, 4, 5, 6, 7, 8].map((n) => `docs/상담.md:${n}`).concat(이어('docs/학생', '명단.xlsx')));
    assert.deepEqual([...new Set(r.공개.걸림.map((x) => x.규칙))], ['휴대폰', '주민번호', '개인메일', '특허', '비공개표시', '명단표', '파일이름']);
    assert.ok(!/3847|38 4721|erdene/.test(공개표시글(r)), '결과에는 값을 가려서만 싣는다');
    assert.deepEqual({ 원격: 판.원격머리(), 머리: 워.머리() }, 전);
  }
  const 돌림 = spawnSync(process.execPath, [도구경로, 'docs', '-m', '상담 기록', '--실행'], { cwd: 워.폴더, encoding: 'utf8' });
  assert.equal(돌림.status, 1, 돌림.stdout + 돌림.stderr);
  assert.match(돌림.stdout, /✗ docs\/상담\.md:2: 휴대폰 번호 010…\(13자, 끝 13\) \(공개 검사\)/);
  assert.match(돌림.stdout, /공개 검사 걸림 8곳/);
  assert.equal(판.원격머리(), 전.원격);
});

test('공개 검사: 예시 꼴·숫자열(날짜·버전·해시·실행 번호·시각)·회사·예시 도메인·이미 공개된 값·줄 표식·허용 목록은 그대로 올라간다', async (t) => {
  const 공개메일 = 이어('yuho.public', '@gm', 'ail.com'), 공개번호 = 이어('010-29', '17-4836');
  const 판 = 새판(t, { 파일: {
    'tools/공개검사_허용.json': 공개정책([{ 경로: 'docs/특허작업/**', 규칙: ['특허'], 까닭: '공개해도 되는 특허 작업 폴더(시험)' }]),
    'docs/연락.md': `# 연락\n- 대표 ${공개메일}\n- 대표 전화 ${공개번호}\n`,
  } });
  const 워 = 판.워크트리('wt');
  워.쓰기('docs/새글.md', [
    '# 새 글',
    이어('- 예시 01', '0-0000-0000 · 010-12', '34-5678 · +8210', '12345678'),
    '- 숫자열 2026-10-21 · v1.2.3 · 커밋 6f76f69b7 · 실행 39514282827 · 시각 1729500000000 · 0.01038472913 · 10.0.12.345',
    이어('- 회사·예시 hello', '@synk.im · a', '@example.com · u', '@b.test · https://user:pass', '@facebook.com/x · icon', '@2x.png'),
    이어('- 역할 계정 support', '@gm', 'ail.com · 학교 창구 admission', '@num.edu.mn'),
    이어('// Copyright (c) 2016 Some One (some.one', '@gm', 'ail.com)'),
    `- 다른 파일에 있던 대표 메일 ${공개메일.replace('@', '+news@')} · 전화 ${공개번호.replace(/-/g, '')}`,
    이어('- 기관 안내 전화 01', '0-5832-7716 (공개허용: 기관 누리집에 공개된 번호)'),
    이어('- 유선 02-7', '23-4567 · 대표번호 15', '88-1234 · 법인등록번호 110111-', '2345678'),
    '',
  ].join('\n'));
  워.쓰기('docs/특허작업/초안.md', 이어('【청구', '항 1】 시험\n'));
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs'], 메시지: '공개해도 되는 값 — 예시 010-0000-0000', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.deepEqual(r.공개.걸림, []);
  assert.deepEqual(r.공개.허용, { 예시: 4, 이미공개: 2, 표식: 1, 목록: 1 });
  assert.equal(판.원격파일('docs/특허작업/초안.md'), 이어('【청구', '항 1】 시험\n'));
});

test('공개 검사: 「이미 공개」는 이력이 아니라 지금 origin 트리 기준이라 origin에서 뺀 값을 다시 넣으면 걸리고, 같은 파일 안에서 옮긴 값은 지나간다', async (t) => {
  const 번호 = 이어('010-47', '29-1836'), 메일 = 이어('kim.minji', '@nav', 'er.com');
  const 판 = 새판(t, { 파일: { 'tools/공개검사_허용.json': 공개정책(), 'docs/옛.md': `- 옛 번호 ${번호}\n`, 'docs/명부.md': `# 명부\n- ${메일}\n` } });
  const 워 = 판.워크트리('wt');
  판.남push({ 'docs/옛.md': '- 옛 번호(뺌)\n' }, '개인정보를 파일에서 뺌');
  워.쓰기('docs/새.md', `- 다시 ${번호}\n`);
  워.쓰기('docs/명부.md', `# 명부\n\n## 옮김\n- ${메일} (반을 옮김)\n`);
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs'], 메시지: '다시 넣음', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.deepEqual(r.문제.filter((x) => x.공개).map((x) => x.경로), ['docs/새.md:1']);
  assert.equal(r.공개.허용.이미공개, 1);
});

test('공개 검사: 커밋 메시지의 휴대폰도 멈추고, 정책 파일이 없는 저장소에서는 돌지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'tools/공개검사_허용.json': 공개정책(), 'a.txt': 'a\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', 'a\nb\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 이어('상담 메모 — 연락 01', '0-6372-1948'), 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.문제.find((x) => x.공개).경로, /^커밋 메시지 [0-9a-f]{9}:1$/);
  assert.equal(판.원격파일('a.txt'), 'a\n');

  const 판2 = 새판(t, { 파일: { 'a.txt': 'a\n' } });
  const 워2 = 판2.워크트리('wt2');
  워2.쓰기('a.txt', 이어('a\n연락 01', '0-6372-1948\n'));
  const r2 = await 도구.올리기({ 저장소: 워2.폴더, 경로들: ['a.txt'], 메시지: '정책 없는 저장소', 실행: true });
  assert.equal(r2.결과, '올림', JSON.stringify(r2));
  assert.equal(r2.공개, undefined);
});

// ── 따라가기(push 없이 origin 최신으로) — 계획 · 경합 · rename EPERM · 새 경로 ────

test('따라가기: push 없이 origin 최신으로 옮기며 내 미커밋 고침과 새 파일은 그대로 둔다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  워.쓰기('메모.txt', '미추적\n');
  const O = 판.남push({ 'a.txt': '원격 2\n', 'b.txt': 'b1\nb2\nb3 원격\n' });
  const 미리 = await 도구.따라가기({ 저장소: 워.폴더 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.notEqual(워.머리(), O);
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('a.txt'), '원격 2\n');
  assert.equal(워.읽기('b.txt'), 'b1 내 것\nb2\nb3 원격\n');
  assert.equal(워.읽기('메모.txt'), '미추적\n');
  assert.deepEqual(워.상태(), [' M b.txt', '?? 메모.txt']);
  assert.ok(fs.existsSync(r.백업), '고친 파일의 바이트 백업');
});

test('따라가기: 계획을 세운 뒤 고치던 파일이 바뀌었으면 실행하지 않고 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const { 맥락, 따라가기계획, 따라가기실행 } = 도구._시험;
  const c = 맥락({ 저장소: 워.폴더 });
  c.저장 = new Map();
  워.g('fetch', '-q', 'origin');
  const 계획 = 따라가기계획(c, 워.머리(), O);
  assert.equal(계획.결과, '계획', JSON.stringify(계획));
  워.쓰기('b.txt', 'b1 내 것 더 고침\nb2\nb3\n');
  const 전머리 = 워.머리();
  const r = 따라가기실행(c, 계획);
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /그사이 작업본 파일이 바뀌었다/);
  assert.equal(워.머리(), 전머리);
  assert.equal(워.읽기('b.txt'), 'b1 내 것 더 고침\nb2\nb3\n');
});

test('따라가기: 가지를 옮기기 직전에 남이 가지를 움직였으면(CAS) 작업본을 되돌리고 그 가지를 지킨다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  판.남push({ 'a.txt': '원격 2\n', 'b.txt': 'b1\nb2\nb3 원격\n' });
  const B = 워.머리();
  let 끼어든 = null;
  const r = await 도구.따라가기({
    저장소: 워.폴더, 실행: true,
    시험고리: { 가지옮기기직전: () => {
      const 트리 = 워.g('rev-parse', `${B}^{tree}`).trim();
      끼어든 = execFileSync('git', ['commit-tree', 트리, '-p', B, '-m', '그사이 남이 이 가지에 커밋'], { cwd: 워.폴더, encoding: 'utf8' }).trim();
      워.g('update-ref', 'refs/heads/claude/wt', 끼어든);
    } },
  });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  assert.match(r.이유, /그사이 움직임/);
  assert.equal(워.머리(), 끼어든, '남이 옮긴 가지를 덮지 않는다');
  assert.equal(워.읽기('a.txt'), '1\n', '작업본은 바탕 판으로 되돌림');
  assert.equal(워.읽기('b.txt'), 'b1 내 것\nb2\nb3\n', '고치던 파일도 되돌림');
});

test('따라가기: 가지를 옮긴 뒤 3방향 결과를 쓰기 직전에 남이 그 파일을 쓰면 덮지 않고 알린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const r = await 도구.따라가기({
    저장소: 워.폴더, 실행: true,
    시험고리: { 따라가기쓰기직전: () => 워.쓰기('b.txt', '편집기가 그사이 저장\n') },
  });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.match(r.주의, /그사이 누가 써서/);
  assert.equal(워.읽기('b.txt'), '편집기가 그사이 저장\n', '남이 쓴 판을 덮지 않는다');
  assert.ok(fs.existsSync(path.join(r.백업, '목록.json')), '내 고침은 백업에 있다');
});

test('따라가기: 3방향 결과를 쓰는 rename이 잠깐 EPERM이면 다시 해서 작업본 미커밋을 지킨다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const 막음 = rename막기(t, 'b.txt', 3);
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true, 시험고리: { 따라가기쓰기직전: 막음.걸기 } });
  막음.풀기();
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(막음.진, 3, '세 번 진 뒤 네 번째에 썼다');
  assert.equal(r.주의, undefined, JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('b.txt'), 'b1 내 것\nb2\nb3 원격\n', '미커밋을 얹은 3방향 결과');
  assert.deepEqual(fs.readdirSync(워.폴더).filter((n) => n.includes('.baro-')), [], '임시 파일이 남지 않는다');
});

test('따라가기: 3방향 결과를 끝내 못 쓰면 쓰려던 판을 백업 결과/에 남기고 복사할 곳을 알린다(지금 파일은 origin 판)', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const 막음 = rename막기(t, 'b.txt', Infinity);
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true, 시험고리: { 따라가기쓰기직전: 막음.걸기 } });
  막음.풀기();
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(막음.진, 20, '공통 replaceFile의 한도만큼 다시 했다');
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('b.txt'), 'b1\nb2\nb3 원격\n', '지금 파일은 read-tree가 쓴 origin 판');
  const 남김 = path.join(r.백업, '결과', '0');
  assert.match(r.주의, /b\.txt: 미커밋을 얹은 결과를 쓰지 못했다\(EPERM\) — 지금 파일은 origin 판이라 그 미커밋이 빠졌다/);
  assert.ok(r.주의.includes(남김), r.주의);
  assert.equal(fs.readFileSync(남김, 'utf8'), 'b1 내 것\nb2\nb3 원격\n', '남긴 판을 복사하면 미커밋이 돌아온다');
  assert.deepEqual(fs.readdirSync(워.폴더).filter((n) => n.includes('.baro-')), [], '임시 파일이 남지 않는다');
});

test('따라가기: rename이 EPERM이라 다시 하기를 기다리는 사이 남이 그 파일을 저장하면 덮지 않고 쓰려던 판을 남긴다(GPT GA1)', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  // 편집기가 파일을 잡고 있다가(첫 rename EPERM) 저장하며 놓는다 — 다음 rename은 될 테지만 그 저장을 덮으면 안 된다
  const 막음 = rename막기(t, 'b.txt', 1, { 기다리는사이: () => 워.쓰기('b.txt', '편집기가 잡고 있다 저장\n') });
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true, 시험고리: { 따라가기쓰기직전: 막음.걸기 } });
  막음.풀기();
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(막음.진, 1, '한 번 지고, 기다리는 사이 바뀐 것을 보고 더 하지 않았다');
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('b.txt'), '편집기가 잡고 있다 저장\n', '남이 저장한 판을 덮지 않는다');
  const 남김 = path.join(r.백업, '결과', '0');
  assert.match(r.주의, /b\.txt: 그사이 누가 써서 3방향 결과를 쓰지 않았다 — 쓰려던 판은 /);
  assert.ok(r.주의.includes(남김), r.주의);
  assert.equal(fs.readFileSync(남김, 'utf8'), 'b1 내 것\nb2\nb3 원격\n');
  assert.deepEqual(fs.readdirSync(워.폴더).filter((n) => n.includes('.baro-')), [], '임시 파일이 남지 않는다');
});

test('따라가기: origin이 새로 넣는 경로에 다른 미추적 파일이 있거나 폴더·파일이 부딪히면 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('새.txt', '내 미추적 파일\n');
  const O1 = 판.남push({ '새.txt': '원격이 넣은 파일\n' });
  const B = 워.머리();
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.equal(r.걸림[0].경로, '새.txt');
  assert.equal(워.머리(), B);
  assert.equal(워.읽기('새.txt'), '내 미추적 파일\n');
  // 같은 바이트면 받아들인다
  워.쓰기('새.txt', '원격이 넣은 파일\n');
  const r2 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(워.머리(), O1);
  // 작업본의 미추적 파일 「폴더」 자리에 origin이 그 아래 파일을 넣는다
  워.쓰기('겹침', '나는 파일\n');
  워.쓰기('a.txt', '내 위\n1\n');                         // 3방향으로 얹을 내 미커밋 고침(read-tree가 멈추면 되돌아와야 한다)
  판.남push({ '겹침/아래.txt': '원격\n', 'a.txt': '1\n원격 아래\n' });
  const B2 = 워.머리();
  const r3 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.notEqual(r3.결과, '따라감', JSON.stringify(r3));
  assert.equal(워.머리(), B2);
  assert.equal(워.읽기('겹침'), '나는 파일\n');
  assert.equal(워.읽기('a.txt'), '내 위\n1\n', '바탕 판으로 돌렸던 내 고침을 되돌려 놓는다');
});

test('따라가기: origin이 새로 넣는 경로의 미추적 파일이 줄끝만 다르면(작업본 LF · 체크아웃 CRLF) 같은 파일로 보고 백업 뒤 체크아웃 판으로 바꾼다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' }, autocrlf: 'true' });
  const 워 = 판.워크트리('wt');
  워.쓰기('qa/README.md', '# 기록\n- 하나\n');             // 미추적 LF — 체크아웃 판은 CRLF다
  워.쓰기('다른.md', '내 판\n');
  const O1 = 판.남push({ 'qa/README.md': '# 기록\n- 하나\n' });
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O1);
  assert.deepEqual(r.고침, [{ 경로: 'qa/README.md', 방법: '이미 같음' }]);
  assert.equal(워.읽기('qa/README.md'), '# 기록\r\n- 하나\r\n', '체크아웃 판으로 바뀐다');
  assert.deepEqual(워.상태(), ['?? 다른.md'], '추적 파일이 되고 남은 차이가 없다');
  const 목록 = JSON.parse(fs.readFileSync(path.join(r.백업, '목록.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(r.백업, '파일', 목록.경로[0].파일), 'utf8'), '# 기록\n- 하나\n', '바꾸기 전 바이트는 백업에 있다');
  // 줄끝 말고 내용이 다르면 여전히 멈춘다
  워.쓰기('다른.md', '내 판\n');
  판.남push({ '다른.md': '원격 판\n' });
  const B = 워.머리();
  const r2 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r2.결과, '멈춤', JSON.stringify(r2));
  assert.equal(r2.걸림[0].경로, '다른.md');
  assert.equal(워.머리(), B);
  assert.equal(워.읽기('다른.md'), '내 판\n');
});

// ── 덧붙이기 장부(.jsonl) ────────────────────────────────────────────────────

/** 덧붙이기 장부(.jsonl) 줄 — 줄마다 시각이 달라 앞 60자도 다르다 */
const 장부줄 = (i) => `{"시각":"2026-10-${String(10 + i).padStart(2, '0')}T00:00:00.000Z","대상":"docs/x/${i}.txt","통과":true}\n`;
const 장부바탕 = [1, 2, 3].map(장부줄).join('');

test('장부 덧붙임: 양쪽이 바탕 끝에 더하기만 했을 때만 원격 줄 뒤에 원격에 없는 내 줄을 붙이고, 줄을 고치거나 지웠으면 보통 합치기로 돌린다', () => {
  const { 장부덧붙이기, 줄나누기, 줄잇기 } = require(path.join(REPO, 'tools', '내커밋.js'));
  const 합 = (p, o, c) => { const r = 장부덧붙이기(줄나누기(p), 줄나누기(o), 줄나누기(c)); return r && 줄잇기(r); };
  assert.equal(합('a\n', 'a\nx\ny\n', 'a\ny\nz\n'), 'a\nx\ny\nz\n', '이미 올라간 내 줄(y)은 한 번만');
  assert.equal(합('a\n', 'a\nx\n', 'a\nx\nx\n'), 'a\nx\nx\n', '같은 줄은 개수까지 센다');
  assert.equal(합('a', 'a\nx\n', 'a\ny\n'), 'a\nx\ny\n', '바탕 끝 줄에 줄바꿈이 없어도');
  assert.equal(합('a\nb\n', 'a\nb\nx\n', 'a\nB\ny\n'), null, '내가 바탕 줄을 고쳤다');
  assert.equal(합('a\nb\n', 'a\nx\n', 'a\nb\ny\n'), null, '원격이 바탕 줄을 지웠다');
});

test('공용 작업본: 덧붙이기 장부는 origin도 같은 자리에 덧붙였어도 따라간다 — 이미 올라간 내 줄은 한 번만, 앞 60자가 같은 한 줄 회차도 막지 않는다', async (t) => {
  // 10-21 재현: 자리 맞춤은 가운데 낀 이미 올라간 줄을 「두 번 들어간다」로, 앞 60자가 같은 한 줄 회차를 「옛·새 판」으로 보고 따라가기를 막았다
  const 채널 = (at, 계정, n) => `{"at":"${at}","date":"${at.slice(0, 10)}","kind":"account","account":"${계정}","followers":${n}}\n`;
  const 채널바탕 = 채널('2026-10-01T00:00:00.000Z', 'a', 1);
  const 판 = 새판(t, { 파일: { 'docs/_ops/장부.jsonl': 장부바탕, 'docs/_ops/채널.jsonl': 채널바탕, '안내.md': '# 안내\n' } });
  const 공 = 판.공용;
  공.쓰기('docs/_ops/장부.jsonl', 장부바탕 + 장부줄(4) + 장부줄(5) + 장부줄(6));
  공.쓰기('docs/_ops/채널.jsonl', 채널바탕 + 채널('2026-10-20T08:32:23.286Z', 'a', 2));
  const O = 판.남push({
    'docs/_ops/장부.jsonl': 장부바탕 + 장부줄(7) + 장부줄(5) + 장부줄(8),          // 5는 공용 작업본 줄이 먼저 올라간 것
    'docs/_ops/채널.jsonl': 채널바탕 + 채널('2026-10-20T08:32:23.286Z', 'b', 3),    // 앞 60자가 같은 다른 회차 줄
    '안내.md': '# 안내\n- 원격\n',
  });
  const r = await 도구.따라가기({ 저장소: 공.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.deepEqual(r.고침.map((x) => x.방법).sort(), ['장부 덧붙임', '장부 덧붙임']);
  assert.equal(공.머리(), O);
  assert.equal(공.읽기('docs/_ops/장부.jsonl'), 장부바탕 + 장부줄(7) + 장부줄(5) + 장부줄(8) + 장부줄(4) + 장부줄(6));
  assert.equal(공.읽기('docs/_ops/채널.jsonl'), `${채널바탕}${채널('2026-10-20T08:32:23.286Z', 'b', 3)}${채널('2026-10-20T08:32:23.286Z', 'a', 2)}`);
  assert.equal(공.읽기('안내.md'), '# 안내\n- 원격\n');
  assert.deepEqual(공.상태(), [' M docs/_ops/장부.jsonl', ' M docs/_ops/채널.jsonl']);
});

test('공용 작업본: 도구가 덧붙인 장부를 올리는 사이 origin이 같은 장부 끝에 줄을 더했어도 원격 줄 뒤에 붙여 올리고, 공용 작업본은 깨끗하게 따라간다(CRLF 체크아웃)', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/장부.jsonl': 장부바탕 }, autocrlf: 'true' });
  const 공 = 판.공용;
  공.쓰기('docs/_ops/장부.jsonl', 장부바탕.replace(/\n/g, '\r\n'));                 // Windows 체크아웃 판
  fs.appendFileSync(path.join(공.폴더, 'docs/_ops/장부.jsonl'), 장부줄(4));            // 도구는 LF로 덧붙인다
  const O = 판.남push({ 'docs/_ops/장부.jsonl': 장부바탕 + 장부줄(5) });
  const r = await 도구.올리기({ 저장소: 공.폴더, 경로들: ['docs/_ops/장부.jsonl'], 메시지: 'chore(장부): 시험', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격부모(), O);
  assert.equal(판.원격파일('docs/_ops/장부.jsonl'), 장부바탕 + 장부줄(5) + 장부줄(4), 'origin 줄 뒤에 내 줄 · 줄끝은 origin 판(LF)');
  assert.match(r.경로.find((x) => x.경로 === 'docs/_ops/장부.jsonl').방법, /^장부 덧붙임/);
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(공.머리(), 판.원격머리());
  assert.deepEqual(공.상태(), []);
});

// ── 장부올리기(공용 작업본에서 도는 도구가 쓴 장부를 그 경로만 올린다) ───────

const 장부올리기도구 = require(path.join(REPO, 'tools', 'lib', '장부올리기.js'));
const 장부올리기 = (옵션) => 장부올리기도구.장부올리기(['docs/_ops/장부.jsonl'], 'chore(장부): 시험', 옵션);

test('장부올리기: 공용 작업본에서 도구가 장부에 쓴 줄은 그 경로만 origin에 올리고 따라간다 — 남의 미커밋은 그대로', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/장부.jsonl': 장부바탕, 'docs/_ops/트랙.md': 공용글, '남.txt': '바탕\n' } });
  const 공 = 판.공용;
  공.쓰기('남.txt', '바탕\n남의 미커밋\n');
  공.쓰기('docs/_ops/트랙.md', `${공용글}- 남이 쓰는 중인 줄\n`);
  fs.appendFileSync(path.join(공.폴더, 'docs/_ops/장부.jsonl'), 장부줄(4));
  const O = 판.남push({ 'c.txt': '원격\n' });
  const r = await 장부올리기({ 저장소: 공.폴더, 환경: {} });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격부모(), O);
  assert.equal(판.원격파일('docs/_ops/장부.jsonl'), 장부바탕 + 장부줄(4));
  assert.equal(판.원격파일('남.txt'), '바탕\n', '남의 미커밋은 안 올라간다');
  assert.equal(판.원격파일('docs/_ops/트랙.md'), 공용글);
  assert.equal(공.머리(), 판.원격머리());
  assert.equal(공.읽기('c.txt'), '원격\n');
  assert.deepEqual(공.상태(), [' M docs/_ops/트랙.md', ' M 남.txt']);
  assert.match(장부올리기도구.장부올리기글(r, '검문 장부'), /^ {3}검문 장부 → origin [0-9a-f]{9} ✓$/);
  const 또 = await 장부올리기({ 저장소: 공.폴더, 환경: {} });
  assert.equal(또.결과, '올릴 것 없음', JSON.stringify(또));
  assert.equal(장부올리기도구.장부올리기글(또), null, '이미 origin에 있으면 조용하다');
});

test('장부올리기: 워크트리·SYNK_장부올리기=끔·나중·시험 안(저장소를 안 줌)이면 올리지 않고, 못 올리면(꼬리) 던지지 않고 알린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/장부.jsonl': 장부바탕 } });
  const 워 = 판.워크트리('wt');
  fs.appendFileSync(path.join(워.폴더, 'docs/_ops/장부.jsonl'), 장부줄(4));
  fs.appendFileSync(path.join(판.공용.폴더, 'docs/_ops/장부.jsonl'), 장부줄(5));
  const 전 = 판.원격머리();
  const 워결과 = await 장부올리기({ 저장소: 워.폴더, 환경: {} });
  assert.equal(워결과.결과, '건너뜀', JSON.stringify(워결과));
  assert.match(장부올리기도구.장부올리기글(워결과), /워크트리/);
  assert.equal((await 장부올리기({ 저장소: 판.공용.폴더, 환경: { SYNK_장부올리기: '끔' } })).결과, '건너뜀');
  const 미룸 = await 장부올리기({ 저장소: 판.공용.폴더, 환경: { SYNK_장부올리기: '나중' } });
  assert.equal(미룸.결과, '미룸');
  assert.equal(장부올리기도구.장부올리기글(미룸), null);
  const 시험안 = await 장부올리기({ 환경: { NODE_TEST_CONTEXT: 'child' } });
  assert.deepEqual(시험안, { 결과: '건너뜀', 이유: '시험 안' }, '시험 안에서 저장소를 안 주면 실제 저장소에 손대지 않는다');
  assert.equal(판.원격머리(), 전);
  // 공용 작업본에 꼬리가 있으면 바로올리기가 멈춘다 — 던지지 않고 알린다(장부는 작업본에 남는다)
  판.미푸시({ '꼬리.txt': '꼬리\n' });
  const 멈춤 = await 장부올리기({ 저장소: 판.공용.폴더, 환경: {} });
  assert.equal(멈춤.결과, '멈춤', JSON.stringify(멈춤));
  assert.match(장부올리기도구.장부올리기글(멈춤), /올리지 못했다.*다음에 올릴 때 같이 올라간다/);
  assert.equal(판.원격머리(), 전);
  assert.equal(판.공용.읽기('docs/_ops/장부.jsonl'), 장부바탕 + 장부줄(5));
});

test('장부올리기: 공용 작업본에서 장부를 쓰는 도구는 쓴 뒤 올리고, 검문기를 여러 번 부르는 묶음 실행기는 자식에 「나중」을 주고 끝에 한 번 올린다', () => {
  const 읽기 = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
  for (const p of ['tools/몽골어대조.js', 'tools/채널성과.js']) assert.match(읽기(p), /await 장부올리기\(/, p);
  for (const p of ['tools/몽골어출구.js', 'tools/검수표검문.js', 'evals/검문커버리지.js']) {
    assert.match(읽기(p), /SYNK_장부올리기: '나중'/, `${p}: 자식마다 올리지 않는다`);
    assert.match(읽기(p), /장부올리기\(\['docs\/_ops\/몽골어검문\.jsonl'\]/, `${p}: 끝에 한 번 올린다`);
  }
});

// ── 가볍게 ───────────────────────────────────────────────────────────────────

test('가볍게: 워크트리에서만 큰 미디어 폴더를 작업본에서 빼고(그 워크트리 설정), 되살린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'docs/캐릭터/정본_4K/까몽.png': Buffer.alloc(10, 2), 'docs/홍보물/x.mp4': Buffer.alloc(10, 3), 'docs/남길.md': '남김\n' } });
  const 워 = 판.워크트리('wt');
  const 공용거절 = await 도구.가볍게({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(공용거절.결과, '멈춤');
  const 미리 = await 도구.가볍게({ 저장소: 워.폴더 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.equal(미리.파일, 2);
  const r = await 도구.가볍게({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '가볍게 함', JSON.stringify(r));
  assert.match(r.설정, /^worktree/);
  assert.equal(워.있나('docs/캐릭터/정본_4K/까몽.png'), false);
  assert.equal(워.있나('docs/홍보물/x.mp4'), false);
  assert.equal(워.읽기('docs/남길.md'), '남김\n');
  assert.deepEqual(워.상태(), []);
  assert.ok(판.공용.있나('docs/캐릭터/정본_4K/까몽.png'), '공용 작업본은 그대로');
  // 가벼운 워크트리에서도 올리고 따라간다
  워.쓰기('a.txt', '2\n');
  const 올림 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(올림.결과, '올림', JSON.stringify(올림));
  assert.equal(판.원격에있나('docs/캐릭터/정본_4K/까몽.png'), true, '뺀 폴더가 origin에서 지워지지 않는다');
  assert.deepEqual(워.상태(), []);
  // 필요한 폴더만 다시 꺼낸다(무늬는 stdin으로 — Git Bash의 「/docs/…」 경로 바꾸기를 타지 않는다)
  const 하나 = await 도구.가볍게({ 저장소: 워.폴더, 되살림: true, 폴더들: ['docs/홍보물'], 실행: true });
  assert.equal(하나.결과, '되살림', JSON.stringify(하나));
  assert.ok(워.있나('docs/홍보물/x.mp4'));
  assert.equal(워.있나('docs/캐릭터/정본_4K/까몽.png'), false, '다른 뺀 폴더는 그대로 빠져 있다');
  assert.deepEqual(워.상태(), []);
  const 되 = await 도구.가볍게({ 저장소: 워.폴더, 되살림: true, 실행: true });
  assert.equal(되.결과, '되살림', JSON.stringify(되));
  assert.ok(워.있나('docs/캐릭터/정본_4K/까몽.png'));
});

test('가볍게: D: 세션 사본 자리에서는 빼지 않는다(되살림은 그대로) — 옛 안내를 읽은 세션이 비우지 않게', async (t) => {
  const 핵심 = require(path.join(REPO, 'tools', 'lib', 'git-publish-core.cjs'));
  for (const p of ['D:\\SYNK-worktrees\\SYNK-appsscript\\sched-a-1109-0700', 'D:/SYNK-worktrees/SYNK-appsscript/kind-lamport-3b49d6/']) assert.equal(핵심.D세션사본인가(p), true, p);
  for (const p of ['C:\\Users\\me\\Documents\\SYNK-worktrees\\talk-x', 'C:\\Users\\me\\Documents\\SYNK-appsscript\\.claude\\worktrees\\a', 'D:\\SYNK-worktrees\\SYNK-appsscript']) assert.equal(핵심.D세션사본인가(p), false, p);
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'docs/캐릭터/정본_4K/까몽.png': Buffer.alloc(10, 2) } });
  const 폴더 = path.join(판.뿌리, 'SYNK-worktrees', 'SYNK-appsscript', 'sched-a');
  판.공용.g('worktree', 'add', '-q', '-b', 'worktree-sched-a', 폴더, 'HEAD');
  const r = await 도구.가볍게({ 저장소: 폴더, 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /D: 세션 사본은 빼지 않는다/);
  const 켜짐 = spawnSync('git', ['-C', 폴더, 'config', '--get', 'core.sparseCheckout'], { encoding: 'utf8' });
  assert.notEqual(켜짐.stdout.trim(), 'true');
  assert.equal((await 도구.가볍게({ 저장소: 폴더, 되살림: true, 실행: true })).결과, '되살림');
});

test('가볍게: docs/마케팅은 소리·그림만 빼고, 되살림은 폴더 안 파일까지, 다시 구운 파일은 올리기가 꺼내 올린다', async (t) => {
  const 판 = 새판(t, { 파일: {
    'docs/마케팅/LAB_가/remotion/public/vo/s1.wav': Buffer.alloc(10, 1), 'docs/마케팅/LAB_가/remotion/public/vo/s1.json': '{"t":1}\n',
    'docs/마케팅/LAB_가/표지.PNG': Buffer.alloc(10, 2), 'docs/마케팅/LAB_나/기획.md': '기획\n', 'docs/마케팅/LAB_나/컷.jpg': Buffer.alloc(10, 3),
    'docs/마케팅/LAB_나/혼합.PnG': Buffer.alloc(10, 4),
  } });
  판.공용.g('config', 'core.ignorecase', 'false');
  const 워 = 판.워크트리('wt');
  const r = await 도구.가볍게({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '가볍게 함', JSON.stringify(r));
  assert.equal(r.파일, 4, '소리·그림 넷(확장자 대소문자 무관)');
  for (const p of ['docs/마케팅/LAB_가/remotion/public/vo/s1.wav', 'docs/마케팅/LAB_가/표지.PNG', 'docs/마케팅/LAB_나/컷.jpg', 'docs/마케팅/LAB_나/혼합.PnG']) assert.equal(워.있나(p), false, p);
  assert.equal(워.읽기('docs/마케팅/LAB_가/remotion/public/vo/s1.json'), '{"t":1}\n', '글·json은 남는다');
  assert.equal(워.읽기('docs/마케팅/LAB_나/기획.md'), '기획\n');
  assert.deepEqual(워.상태(), []);
  // 세션이 VO를 다시 구우면(빠진 자리에 새 파일) 올리기가 그 파일만 꺼내 함께 올린다 — 소리 없이 빠지지 않는다(Fable 설계 검토 P1-2)
  워.쓰기('docs/마케팅/LAB_가/remotion/public/vo/s1.wav', Buffer.alloc(12, 9));
  워.쓰기('docs/마케팅/LAB_가/remotion/public/vo/s1.json', '{"t":2}\n');
  워.쓰기('docs/마케팅/LAB_가/remotion/public/vo/s2.wav', Buffer.alloc(8, 7));
  const 올림 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs/마케팅/LAB_가'], 메시지: 'vo 다시', 실행: true });
  assert.equal(올림.결과, '올림', JSON.stringify(올림));
  assert.deepEqual(판.원격바이트('docs/마케팅/LAB_가/remotion/public/vo/s1.wav'), Buffer.alloc(12, 9));
  assert.deepEqual(판.원격바이트('docs/마케팅/LAB_가/remotion/public/vo/s2.wav'), Buffer.alloc(8, 7));
  assert.equal(판.원격파일('docs/마케팅/LAB_가/remotion/public/vo/s1.json'), '{"t":2}\n');
  assert.equal(판.원격에있나('docs/마케팅/LAB_나/컷.jpg'), true, '빠진 다른 파일은 origin에서 지워지지 않는다');
  assert.equal(판.원격에있나('docs/마케팅/LAB_가/표지.PNG'), true);
  assert.equal(워.있나('docs/마케팅/LAB_가/표지.PNG'), false, '꺼낸 것은 바뀐 파일뿐');
  // 폴더 되살림은 그 안 파일 무늬 제외까지 이긴다(`/폴더/`만으로는 안 됨 — P1-1)
  const 되 = await 도구.가볍게({ 저장소: 워.폴더, 되살림: true, 폴더들: ['docs/마케팅/LAB_나'], 실행: true });
  assert.equal(되.결과, '되살림', JSON.stringify(되));
  assert.ok(워.있나('docs/마케팅/LAB_나/컷.jpg'));
  assert.equal(워.있나('docs/마케팅/LAB_가/표지.PNG'), false);
});

// ── 명령줄 ───────────────────────────────────────────────────────────────────

test('인자 읽기: 명령마다 받는 인자만 받고 틀리면 사용법 오류', () => {
  assert.deepEqual(도구.인자읽기(['따라가기', '--실행']).명령, '따라가기');
  assert.equal(도구.인자읽기(['a.md', '-m', 'x']).명령, '올리기');
  assert.equal(도구.인자읽기([]).도움말, true);
  assert.throws(() => 도구.인자읽기(['따라가기', 'a.md']), /받지 않는다/);
  assert.throws(() => 도구.인자읽기(['a.md', '--되살림']), /가볍게에만/);
  assert.throws(() => 도구.인자읽기(['a.md', '--모르는']), /모르는 인자/);
  assert.throws(() => 도구.인자읽기(['a.md', '--조각', '공용.md']), /<경로>=<조각/);
});

test('재현: 워크트리에서 명령줄로 올리고 따라간다', (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  const 돌림 = spawnSync(process.execPath, [도구경로, 'a.txt', '-m', 'a 2', '--실행'], { cwd: 워.폴더, encoding: 'utf8' });
  assert.equal(돌림.status, 0, 돌림.stdout + 돌림.stderr);
  assert.match(돌림.stdout, /^\[올림\]/);
  assert.match(돌림.stdout, /따라가기: /);
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(워.머리(), 판.원격머리());
  const 또 = spawnSync(process.execPath, [도구경로, 'a.txt', '-m', 'a 2', '--실행'], { cwd: 워.폴더, encoding: 'utf8' });
  assert.equal(또.status, 0, 또.stdout + 또.stderr);
  assert.match(또.stdout, /^\[올릴 것 없음\]/);
});

// ── push 전 관련 시험(2026-10-21) ────────────────────────────────────────────

const 관련흐름 = 'name: syntax-check\non:\n  push:\n    paths-ignore:\n      - \'docs/_ops/트랙.md\'\njobs:\n  check:\n    steps:\n      - run: node --test --test-reporter=tap tests/*.test.js\n';
const 값시험 = "const { test } = require('node:test'); const assert = require('node:assert');\n"
  + "test('tools/값.json 의 값은 1이다', () => { assert.equal(require('../tools/값.json').값, 1); });\n";
const 관련판 = (t) => 새판(t, { 파일: { '.github/workflows/syntax-check.yml': 관련흐름, 'tests/값.test.js': 값시험, 'tools/값.json': '{"값":1}\n', 'a.txt': '1\n' } });

test('관련 시험: 바꾼 경로를 읽는 시험이 깨지면 push하지 않고 깨진 시험을 보인다', async (t) => {
  const 판 = 관련판(t);
  const 워 = 판.워크트리('wt');
  const 전 = 판.원격머리();
  워.쓰기('tools/값.json', '{"값":2}\n');
  const 미리 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/값.json'], 메시지: '값 2' });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.deepEqual(미리.관련시험.시험, ['tests/값.test.js']);
  assert.equal(미리.관련시험.결과, undefined, '미리 보기는 고르기만 한다');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/값.json'], 메시지: '값 2', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /관련 시험이 깨졌다\(1\/1\)/);
  assert.equal(r.관련시험.결과.실패[0].이름, 'tools/값.json 의 값은 1이다');
  assert.equal(판.원격머리(), 전, '아무것도 올라가지 않았다');
});

test('관련 시험: --시험건너뜀은 까닭을 트레일러 앞 문단으로 남기고 올린다 · 통과하면 그대로 올린다 · 기록 전용은 고르지 않는다', async (t) => {
  const 판 = 관련판(t);
  const 워 = 판.워크트리('wt');
  워.쓰기('tools/값.json', '{"값":2}\n');
  const 메시지 = '값 2\n\n본문\n\nCo-Authored-By: 시험 <t@example.invalid>\n';
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/값.json'], 메시지, 실행: true, 시험건너뜀: '값 시험은 다음 커밋에서 고친다' });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.관련시험.건너뜀, '값 시험은 다음 커밋에서 고친다');
  const 몸 = execFileSync('git', ['--git-dir', 판.원격, 'log', '-1', '--format=%B', 'master'], { encoding: 'utf8' });
  assert.match(몸, /본문\n\n관련 시험 건너뜀: 값 시험은 다음 커밋에서 고친다\n\nCo-Authored-By: 시험/);
  await assert.rejects(도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'x', 실행: true, 시험건너뜀: ' ' }), /까닭/);

  워.쓰기('tools/값.json', '{"값":1}\n');
  const 됨 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/값.json'], 메시지: '값 1로', 실행: true });
  assert.equal(됨.결과, '올림', JSON.stringify(됨));
  assert.equal(됨.관련시험.결과.통과함, true);
  assert.equal(판.원격파일('tools/값.json'), '{"값":1}\n');

  워.쓰기('docs/_ops/트랙.md', '- 기록\n');
  const 기록 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs/_ops/트랙.md'], 메시지: '트랙', 실행: true });
  assert.equal(기록.결과, '올림', JSON.stringify(기록));
  assert.equal(기록.관련시험.기록전용, true);
  assert.throws(() => 도구.인자읽기(['따라가기', '--시험건너뜀', 'x']), /받지 않는다/);
  assert.equal(도구.인자읽기(['a.md', '-m', 'x', '--시험건너뜀', '까닭']).시험건너뜀, '까닭');
});

test('관련 시험(공용 작업본): 깨진 시험이 남의 미커밋을 읽었을 수 있으면 막지 않고 주의를 남긴다(아르곤 10-22 P1)', async (t) => {
  const 시험글 = "// a.txt 를 바꾸면 이 시험이 골린다\n" + 값시험;
  const 판 = 새판(t, { 파일: { '.github/workflows/syntax-check.yml': 관련흐름, 'tests/값.test.js': 시험글, 'tools/값.json': '{"값":1}\n', 'a.txt': '1\n' } });
  판.공용.쓰기('tools/값.json', '{"값":2}\n'); // 다른 세션이 공용 작업본에서 고치다 만 파일
  판.공용.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.관련시험.결과.통과함, false);
  assert.match(r.주의, /남의 미커밋\(tools\/값\.json\)/);
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(판.원격파일('tools/값.json'), '{"값":1}\n', '남의 미커밋은 올라가지 않는다');
});

/** 공용 작업본 git 폴더에 받아 둔 CI 시험 지도를 둔다(tools/관련시험.js 지도읽기가 읽는 자리) — 시험마다 읽은 추적 파일. */
function 지도두기(판, 시험) {
  const 자리 = path.join(판.공용.gitdir(), 'synk-관련시험');
  fs.mkdirSync(자리, { recursive: true });
  fs.writeFileSync(path.join(자리, '지도.json'), JSON.stringify({ 판: 1, run: 1, 받은때: new Date().toISOString(), 시험 }));
}
const 새시험글 = "const { test } = require('node:test'); const assert = require('node:assert');\n"
  + "test('새 도구의 값은 1이다', () => { assert.equal(require('../tools/새.js').값, 1); });\n";

test('관련 시험(공용 작업본): 지도에 없는 새 시험이 깨지면 남의 미커밋이 있어도 막는다 — 그 시험이 불러오는 파일만 본다(10-30 840a50cad)', async (t) => {
  for (const 지도있음 of [true, false]) {
    const 판 = 관련판(t);
    if (지도있음) 지도두기(판, { 'tests/값.test.js': { 읽음: ['tools/값.json'], 폴더: [], 무늬: [] } });
    판.공용.쓰기('a.txt', '남이 고치다 만 줄\n'); // 다른 세션의 미커밋 둘 — 새 시험은 안 읽는다
    판.공용.쓰기('docs/남.json', '{"남":1}\n');
    판.공용.쓰기('tools/새.js', 'module.exports = { 값: 2 };\n');
    판.공용.쓰기('tests/새.test.js', 새시험글);
    const 전 = 판.원격머리();
    const r = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['tools/새.js', 'tests/새.test.js'], 메시지: '새 도구', 실행: true });
    const 판이름 = 지도있음 ? '지도에 그 시험이 없음' : '지도 없음';
    assert.equal(r.결과, '멈춤', `${판이름}: ${JSON.stringify(r)}`);
    assert.match(r.이유, /관련 시험이 깨졌다\(1\/1\)/, 판이름);
    assert.deepEqual(r.관련시험.시험, ['tests/새.test.js'], 판이름);
    assert.equal(r.관련시험.결과.실패[0].파일, 'tests/새.test.js', 판이름);
    assert.equal(판.원격머리(), 전, `${판이름}: 아무것도 올라가지 않았다`);
    assert.equal(판.공용.읽기('a.txt'), '남이 고치다 만 줄\n', `${판이름}: 남의 미커밋은 그대로`);
  }
});

test('관련 시험(공용 작업본): 깨진 시험이 남이 고치는 파일을 읽으면 지금처럼 막지 않는다 — 지도에 있는 시험은 지도의 읽음, 새 시험은 require로 닿는 모듈', async (t) => {
  const 판 = 관련판(t);
  지도두기(판, { 'tests/값.test.js': { 읽음: ['a.txt', 'tools/값.json'], 폴더: [], 무늬: [] } });
  판.공용.쓰기('tools/값.json', '{"값":2}\n'); // 다른 세션이 고치다 만 파일 — 기존 시험이 이것 때문에 깨진다
  판.공용.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.관련시험.결과.통과함, false);
  assert.match(r.주의, /남의 미커밋\(tools\/값\.json\)/);
  assert.equal(판.원격파일('tools/값.json'), '{"값":1}\n', '남의 미커밋은 올라가지 않는다');

  const 둘 = 새판(t, { 파일: { '.github/workflows/syntax-check.yml': 관련흐름, 'tools/남.js': 'module.exports = { 값: 1 };\n', 'a.txt': '1\n' } });
  지도두기(둘, {});
  둘.공용.쓰기('tools/남.js', 'module.exports = { 값: 2 };\n'); // 다른 세션의 미커밋 — 새 시험이 내 도구를 거쳐 불러온다
  둘.공용.쓰기('tools/새.js', "module.exports = require('./남.js');\n");
  둘.공용.쓰기('tests/새.test.js', 새시험글);
  const 새 = await 도구.올리기({ 저장소: 둘.공용.폴더, 경로들: ['tools/새.js', 'tests/새.test.js'], 메시지: '새 도구', 실행: true });
  assert.equal(새.결과, '올림', JSON.stringify(새));
  assert.equal(새.관련시험.결과.통과함, false);
  assert.match(새.주의, /남의 미커밋\(tools\/남\.js\)/);
  assert.equal(둘.원격파일('tools/남.js'), 'module.exports = { 값: 1 };\n', '남의 미커밋은 올라가지 않는다');
});
