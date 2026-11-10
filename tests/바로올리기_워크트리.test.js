/* 바로올리기 — 워크트리에서 올리기(내 경로만 최신 origin 위에 · 경합 · 줄끝 · 저장 용량 · 크기 알림 · 조각).
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
const { spawnSync } = require('node:child_process');

const {
  REPO, 도구, 새판, 지문, 공용글,
} = require('./lib/바로올리기판.js');

// ── 워크트리에서 ─────────────────────────────────────────────────────────────

const 잠금도구 = require(path.join(REPO, 'tools', 'git잠금.js'));

test('공용 작업본: 새 경로 목록이 Windows 명령 길이를 넘어도 받은 파일과 다른 작업을 보존한다', async (t) => {
  const 판 = 새판(t, { 파일: { '남의-작업.txt': '바탕\n' } });
  const 파일들 = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [
    `received/${String(i).padStart(4, '0')}-${'long-path-'.repeat(12)}[literal].txt`, `원격 ${i}\n`,
  ]));
  assert.ok(Object.keys(파일들).join(' ').length > 32767);
  const O = 판.남push(파일들);
  for (const [p, v] of Object.entries(파일들)) 판.공용.쓰기(p, v);
  판.공용.쓰기('남의-작업.txt', '다른 작업의 미커밋 수정\r\n');
  판.공용.쓰기('남의-미추적.txt', '다른 작업의 새 파일\r\n');
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  for (const [p, v] of Object.entries(파일들)) assert.equal(판.공용.읽기(p), v);
  assert.equal(판.공용.읽기('남의-작업.txt'), '다른 작업의 미커밋 수정\r\n');
  assert.equal(판.공용.읽기('남의-미추적.txt'), '다른 작업의 새 파일\r\n');
  assert.equal(판.공용.g('diff', '--cached', '--name-only').trim(), '');
  assert.match(판.공용.g('ls-files', '--', '남의-작업.txt'), /남의-작업/);
});

test('따라가기 묶어 읽기: cat-file --batch --filters로 미리 읽은 판이 경로마다 꺼낸 판과 같다(autocrlf · eol · ident · 이진 · 빈 파일) · .gitattributes가 끼거나 출력이 어긋나면 묶지 않는다', (t) => {
  const 판 = 새판(t, {
    autocrlf: 'true',
    파일: { '.gitattributes': '*.crlf text eol=crlf\n*.lf text eol=lf\n*.bin -text\n*.id ident\n', 'a.txt': '가\n나\n', 'b.crlf': 'x\ny\n', 'c.lf': 'x\r\ny\r\n', 'd.bin': Buffer.from([0, 10, 13, 10, 65]), 'f.id': '$Id$\n', '빈.txt': '', '하위/공백 든 [이름].md': 'z\n' },
  });
  const { 맥락, 꺼낸바이트, 꺼낸바이트미리 } = 도구._시험;
  const c = 맥락({ 저장소: 판.공용.폴더 });
  const 항 = 판.공용.g('ls-tree', '-r', '-z', 'HEAD').split('\0').filter(Boolean).map((줄) => [줄.split('\t')[0].split(' ')[2], 줄.split('\t')[1]])
    .filter(([, p]) => p !== '.gitattributes' && !p.startsWith('tools/'));
  const a = 항.find(([, p]) => p === 'a.txt')[0];
  항.push([a, '다른.crlf'], [a, '없는/폴더.bin']);   // 같은 blob도 경로의 규칙대로 꺼낸다
  const 하나씩 = 항.map(([s, p]) => 꺼낸바이트(c, s, p));
  assert.equal(하나씩[항.findIndex(([, p]) => p === 'a.txt')].toString('utf8'), '가\r\n나\r\n', '필터로 크기가 바뀐 판이 있다 — 묶음 머리의 크기(필터 전)로 끝을 찾으면 틀리는 경우');
  꺼낸바이트미리(c, 항);
  assert.ok(c.꺼냄, '묶어 읽었다');
  assert.equal(c.꺼냄.size, 항.length);
  for (const [i, [s, p]] of 항.entries()) assert.ok(c.꺼냄.get(`${s} ${p}`).equals(하나씩[i]), `${p}: 묶어 읽은 판이 하나씩 꺼낸 판과 같다`);
  for (const [i, [s, p]] of 항.entries()) assert.ok(꺼낸바이트(c, s, p).equals(하나씩[i]), `${p}: 꺼낸바이트가 미리 읽은 판을 쓴다`);

  꺼낸바이트미리(c, [...항, [a, '하위/.gitattributes']]);
  assert.equal(c.꺼냄, null, '.gitattributes가 끼면 묶지 않는다(쓰는 차례에 따라 뒤 파일의 변환이 달라진다)');
  const 잘린 = Object.assign((args, o) => { const b = c.git(args, o); return args.includes('--batch') ? b.subarray(0, b.length - 3) : b; }, c.git);
  const c2 = { ...c, git: 잘린 };
  꺼낸바이트미리(c2, 항);
  assert.equal(c2.꺼냄, null, '출력이 어긋나면 묶음을 버린다 — 꺼낼 때 하나씩 읽는다');
});

test('워크트리: 받은 새 경로를 이미 올렸어도 비슷한 다른 경로의 인덱스를 보존한다', async (t) => {
  const 판 = 새판(t, { 파일: { 'new1.txt': '비슷한 기존 경로\n', '남.txt': '기존\n' } });
  const 워 = 판.워크트리('indexed-paths');
  const O = 판.남push({ 'new[1].txt': '새 경로\n' });
  워.쓰기('new[1].txt', '새 경로\n');
  워.g('--literal-pathspecs', 'add', '--', 'new[1].txt');
  워.쓰기('남.txt', '다른 작업\r\n');
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('new[1].txt'), '새 경로\n');
  assert.equal(워.읽기('new1.txt'), '비슷한 기존 경로\n');
  assert.equal(워.읽기('남.txt'), '다른 작업\r\n');
  assert.equal(워.g('diff', '--cached', '--name-only').trim(), '');
  assert.equal(워.g('ls-files', '--', 'new1.txt').trim(), 'new1.txt');
});

test('워크트리: 꼬리(남의 미푸시)에서 떠도 내가 바꾼 것만 최신 origin 위에 올리고, 워크트리는 올린 커밋으로 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { '공용.md': 공용글, '남.txt': '바탕\n', 'tools/a.js': 'a\n' } });
  const P = 판.미푸시({ '공용.md': '# 공용\n\n## 가\n- a1\n- 남의 미푸시 줄\n\n## 나\n- b1\n', '꼬리.txt': '꼬리\n' });
  const 워 = 판.워크트리('wt');
  assert.equal(워.머리(), P, '앱처럼 로컬 master(꼬리 포함)에서 뜬다');
  워.쓰기('공용.md', '# 공용\n\n## 가\n- a1\n- 남의 미푸시 줄\n\n## 나\n- b1\n- 내 b2\n');
  워.쓰기('내.md', '# 내 문서\n');
  const O1 = 판.남push({ '남.txt': '바탕\n남이 올림\n', '공용.md': '# 공용\n\n## 가\n- a1\n- 원격 a2\n\n## 나\n- b1\n' });

  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['공용.md', '내.md'], 메시지: '내 줄과 내 문서', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.작업본, '워크트리');
  assert.equal(판.원격머리(), r.머리);
  assert.equal(판.원격부모(), O1, '막 받은 origin 바로 위');
  assert.equal(판.원격파일('공용.md'), '# 공용\n\n## 가\n- a1\n- 원격 a2\n\n## 나\n- b1\n- 내 b2\n', '꼬리 줄은 안 올라가고 내 줄만');
  assert.equal(판.원격파일('내.md'), '# 내 문서\n');
  assert.equal(판.원격에있나('꼬리.txt'), false, '꼬리 파일은 안 올라간다');
  assert.equal(판.원격파일('남.txt'), '바탕\n남이 올림\n');
  // 워크트리는 올린 커밋으로 — 꼬리를 벗어나고 남의 새 판도 받는다
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.머리(), r.머리);
  assert.deepEqual(워.상태(), [], '워크트리가 깨끗하다');
  assert.equal(워.읽기('남.txt'), '바탕\n남이 올림\n');
  assert.equal(워.있나('꼬리.txt'), false);
  // 공용 작업본은 꼬리가 있어 건너뛰고, 꼬리 커밋은 로컬 master에 그대로
  assert.equal(r.공용따라가기.결과, '건너뜀');
  assert.match(r.공용따라가기.이유, /꼬리/);
  assert.equal(판.공용.머리(), P);
  // 다시 돌리면 올릴 것 없음
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['공용.md', '내.md'], 메시지: '또', 실행: true });
  assert.equal(r2.결과, '올릴 것 없음', JSON.stringify(r2));
  assert.equal(판.원격머리(), r.머리);
});

test('워크트리: 미리 보기는 origin·가지·인덱스·작업본을 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  const 상태전 = 워.상태();                                // 시험의 git status가 인덱스를 새로 쓰므로 지문보다 먼저
  const 전 = { 원격: 판.원격머리(), 머리: 워.머리(), 인덱스: 지문(path.join(워.gitdir(), 'index')) };
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: '2' });
  assert.equal(r.결과, '미리 보기', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '계획');
  assert.deepEqual({ 원격: 판.원격머리(), 머리: 워.머리(), 인덱스: 지문(path.join(워.gitdir(), 'index')) }, 전);
  assert.deepEqual(워.상태(), 상태전);
  assert.equal(워.읽기('a.txt'), '2\n');
});

test('워크트리: 같은 문서 같은 자리에 원격도 줄을 더했으면 원격 줄 뒤에 내 줄을 붙이고, 공용 문서도 조각 없이 통째로 올린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/트랙.md': '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('docs/_ops/트랙.md', '# 트랙\n\n## 가\n- a1\n- 내 a2 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n');
  판.남push({ 'docs/_ops/트랙.md': '# 트랙\n\n## 가\n- a1\n- 원격 a2 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n' });
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs/_ops/트랙.md'], 메시지: '트랙 내 줄', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('docs/_ops/트랙.md'), '# 트랙\n\n## 가\n- a1\n- 원격 a2 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다\n- 내 a2 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n');
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 코드 파일의 같은 줄을 원격이 다르게 고쳤으면 멈추고 아무것도 올리지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'tools/a.js': 'const a = 1;\nconst b = 2;\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('tools/a.js', 'const a = 10;\nconst b = 2;\n');
  const O = 판.남push({ 'tools/a.js': 'const a = 100;\nconst b = 2;\n' });
  const 전머리 = 워.머리();
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/a.js'], 메시지: 'a', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.문제[0].이유, /겹친다/);
  assert.equal(판.원격머리(), O);
  assert.equal(워.머리(), 전머리);
  assert.equal(워.읽기('tools/a.js'), 'const a = 10;\nconst b = 2;\n');
});

test('워크트리: push 직전에 남이 먼저 올려 거절되면 다시 받아 그 위에 올린다(CAS 경합)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '남.txt': '0\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  let 끼어든 = null;
  const r = await 도구.올리기({
    저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true,
    시험고리: { push직전: (차례) => { if (차례 === 1) 끼어든 = 판.남push({ '남.txt': '끼어듦\n' }); } },
  });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.다시한수, 1);
  assert.equal(판.원격부모(), 끼어든, '끼어든 커밋 위에 다시 쌓았다');
  assert.equal(판.원격파일('남.txt'), '끼어듦\n');
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(워.머리(), r.머리);
  assert.equal(워.읽기('남.txt'), '끼어듦\n');
});

test('워크트리: 아직 고치는 다른 파일은 따라가며 3방향으로 지키고, 같은 줄이 겹치면 따라가지 않고(push는 됨) 다시 돌리면 올릴 것 없음', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '긴.txt': 'x1\nx2\nx3\nx4\nx5\n', '겹침.txt': 'y1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  워.쓰기('긴.txt', 'x1 내 고침\nx2\nx3\nx4\nx5\n');      // 아직 올리지 않는 내 고침(원격과 다른 자리)
  판.남push({ '긴.txt': 'x1\nx2\nx3\nx4\nx5 원격 고침\n' });
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.읽기('긴.txt'), 'x1 내 고침\nx2\nx3\nx4\nx5 원격 고침\n', '내 미커밋 고침 + 원격 고침');
  assert.deepEqual(워.상태(), [' M 긴.txt'], '남은 것은 내 미커밋 고침뿐');
  assert.equal(판.원격파일('긴.txt'), 'x1\nx2\nx3\nx4\nx5 원격 고침\n', '내 미커밋 고침은 안 올라간다');

  // 같은 줄이 겹치면: push는 되고 따라가기는 아무것도 바꾸지 않는다
  워.쓰기('겹침.txt', 'y1 내 것\n');
  판.남push({ '겹침.txt': 'y1 원격 것\n' });
  워.쓰기('b.txt', 'b\n');
  const 전머리 = 워.머리();
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['b.txt'], 메시지: 'b', 실행: true });
  assert.equal(r2.결과, '올림', JSON.stringify(r2));
  assert.equal(판.원격파일('b.txt'), 'b\n');
  assert.equal(r2.따라가기.결과, '멈춤', JSON.stringify(r2.따라가기));
  assert.equal(r2.따라가기.걸림[0].경로, '겹침.txt');
  assert.equal(워.머리(), 전머리, '가지는 그대로');
  assert.equal(워.읽기('겹침.txt'), 'y1 내 것\n');
  assert.equal(워.읽기('b.txt'), 'b\n');
  const r3 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['b.txt'], 메시지: 'b 또', 실행: true });
  assert.equal(r3.결과, '올릴 것 없음', JSON.stringify(r3));
  assert.equal(판.원격머리(), r2.머리);
});

test('워크트리: 이 가지에만 있는 커밋이 있으면 push는 하되 따라가지 않는다(커밋이 가지에서 빠지지 않게)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('로컬.txt', '로컬 커밋\n');
  워.g('add', '로컬.txt');
  워.g('commit', '-q', '-m', '가지에만');
  const 가지만 = 워.머리();
  워.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격에있나('로컬.txt'), false);
  assert.equal(r.따라가기.결과, '멈춤');
  assert.match(r.따라가기.이유, /에만 있고 origin에 올라가지 않은 커밋/);
  assert.equal(워.머리(), 가지만);
});

test('워크트리: 가지에만 있는 커밋이라도 origin에 짝(같은 작성자·시각·제목으로 다시 쌓아 올린 것)이 있으면 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('옛방식.txt', '내커밋으로 커밋\n');
  워.g('add', '옛방식.txt');
  워.g('commit', '-q', '-m', '옛 방식으로 커밋하고 올림');
  const 옛 = 워.머리();
  판.남push({ '남.txt': '먼저 올라온 남의 것\n' });
  const 짝 = 판.짝push(워, 옛, { '옛방식.txt': '내커밋으로 커밋\n' });
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), 짝);
  assert.equal(워.읽기('남.txt'), '먼저 올라온 남의 것\n');
  assert.deepEqual(워.상태(), []);
});

test('워크트리: index.lock — 내용 있는 잠금이 안 풀리면 따라가기만 멈추고, 주인 없는 잠금은 치우고 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  const 잠금 = path.join(워.gitdir(), 'index.lock');
  const 짧은잠 = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${Math.min(ms, 50)})`]);
  워.쓰기('a.txt', '2\n');
  fs.writeFileSync(잠금, '쓰는 중');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true, 잠금한도ms: { 잠금: 300 }, 잠깐: 짧은잠 });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '멈춤');
  assert.match(r.따라가기.이유, /index\.lock/);
  assert.equal(fs.readFileSync(잠금, 'utf8'), '쓰는 중', '남의 잠금은 안 지운다');
  // 0바이트·오래된·주인 없는 잠금은 한 번 치우고 따라간다
  fs.writeFileSync(잠금, '');
  const 옛날 = new Date(Date.now() - 60000);
  fs.utimesSync(잠금, 옛날, 옛날);
  const r2 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true, 잠금살피기: () => 잠금도구.살피기(워.폴더, { 잠금, 먼저시작한git: () => 0 }) });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.ok(!fs.existsSync(잠금));
  assert.equal(워.머리(), 판.원격머리());
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 줄끝 — CRLF 작업본에서 고쳐도 origin에는 LF로, CRLF로 든 blob은 CRLF 그대로 올라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'lf.md': '- 하나\n- 둘\n', 'crlf.md': '- 하나\r\n- 둘\r\n' }, autocrlf: 'true' });
  const 워 = 판.워크트리('wt');
  assert.equal(워.바이트('lf.md').toString(), '- 하나\r\n- 둘\r\n', 'autocrlf 체크아웃은 CRLF');
  워.쓰기('lf.md', '- 하나\r\n- 둘\r\n- 셋\r\n');
  워.쓰기('crlf.md', '- 하나\r\n- 둘\r\n- 셋\r\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['lf.md', 'crlf.md'], 메시지: '셋', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격바이트('lf.md').toString(), '- 하나\n- 둘\n- 셋\n');
  assert.equal(판.원격바이트('crlf.md').toString(), '- 하나\r\n- 둘\r\n- 셋\r\n');
  assert.equal(r.따라가기.결과, '따라감');
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 저장 용량 검사에 걸리면 올리지 않고 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': 'a\n' }, 정책고침: { maxBlobBytes: 64 } });
  const 워 = 판.워크트리('wt');
  워.쓰기('큰.bin', Buffer.alloc(65, 1));
  const 전 = { 원격: 판.원격머리(), 머리: 워.머리() };
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['큰.bin'], 메시지: '큰 파일', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.문제.map((x) => x.이유).join(' '), /저장 용량/);
  assert.deepEqual({ 원격: 판.원격머리(), 머리: 워.머리() }, 전);
  assert.ok(워.있나('큰.bin'));
});

test('워크트리: 크기 알림 — 늘 읽는 두 장이 상한을 넘겨 커지거나 결정·트랙에 2KB 넘는 줄이 새로 들어오면 막지 않고 알리고, 줄이는 push·상관없는 push는 조용하다(10-24 경량화 2차)', async (t) => {
  const 짧은결정 = '# 결정\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n| 2026-10-01 | 확정 | 짧은 행 | 근거 |\n';
  const 판 = 새판(t, { 파일: { 'AGENTS.md': '# 입구\n', 'docs/_ops/결정.md': 짧은결정, 'docs/_ops/트랙.md': '# 트랙\n\n- 짧은 줄\n', 'a.txt': 'a\n' } });
  const 워 = 판.워크트리('wt');
  const 긴줄 = (머리) => `${머리} ${'가'.repeat(700)}`;   // 한글 700자 = 2,100바이트
  워.쓰기('AGENTS.md', `# 입구\n${'x'.repeat(12 * 1024)}\n`);
  워.쓰기('docs/_ops/결정.md', `${짧은결정}${긴줄('| 2026-10-24 | 확정 | 긴 행')} | 근거 |\n`);
  워.쓰기('docs/_ops/트랙.md', `# 트랙\n\n- 짧은 줄\n${긴줄('- **긴 항목:**')}\n- 새 짧은 줄\n`);
  const 미리 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '크기' });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.equal(미리.크기알림.length, 3, JSON.stringify(미리.크기알림));
  assert.match(미리.크기알림[0], /^AGENTS\.md 12\.\dKB — 상한 11\.0KB을 넘겨 커졌다\(전 0\.0KB\)/);
  assert.match(미리.크기알림[1], /^docs\/_ops\/결정\.md에 2\.0KB 넘는 줄 1개 — 「\| 2026-10-24 \| 확정 \| 긴 행/);
  assert.match(미리.크기알림[2], /^docs\/_ops\/트랙\.md에 2\.0KB 넘는 줄 1개 — 「- \*\*긴 항목:\*\*/);
  assert.match(도구._시험.올리기글(미리), /크기 알림\(막지 않음\): AGENTS\.md/);
  const r = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '크기', 실행: true });
  assert.equal(r.결과, '올림', `알림은 막지 않는다 — ${JSON.stringify(r)}`);
  assert.equal(r.크기알림.length, 3);
  // 이미 상한을 넘은 문서를 줄이는 push와, 결정·트랙을 건드리지 않는 push에는 알림이 없다
  워.쓰기('AGENTS.md', `# 입구\n${'x'.repeat(11.5 * 1024)}\n`);
  워.쓰기('a.txt', 'b\n');
  const 줄임 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '줄임', 실행: true });
  assert.equal(줄임.결과, '올림', JSON.stringify(줄임));
  assert.equal(줄임.크기알림, undefined, JSON.stringify(줄임.크기알림));
});

test('워크트리: --모두는 고친·새·지운 파일을 모두 올린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '지울.txt': 'x\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  워.쓰기('새/파일.md', '새\n');
  fs.rmSync(path.join(워.폴더, '지울.txt'));
  const r = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '모두', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(판.원격파일('새/파일.md'), '새\n');
  assert.equal(판.원격에있나('지울.txt'), false);
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 조각으로 일부만 올리면 남은 내 고침은 올린 판을 바탕으로 3방향 — 붙어 있는 코드 줄도 따라간다', async (t) => {
  const 바탕글 = 'const a1 = 1;\nconst a2 = 2;\nconst a3 = 3;\nconst a4 = 4;\n';
  const 판 = 새판(t, { 파일: { 'tools/x.js': 바탕글 } });
  const 워 = 판.워크트리('wt');
  const 고친글 = 'const a1 = 1;\nconst a2 = 20;\nconst a3 = 30;\nconst a4 = 4;\n';
  워.쓰기('tools/x.js', 고친글);
  const 내커밋도구 = require(path.join(REPO, 'tools', '내커밋.js'));
  const { 묶음 } = 내커밋도구.조각만들기(바탕글, 고친글);
  assert.equal(묶음.length, 1, '붙은 두 줄은 한 조각');
  // 조각 줄: 1·2 = 뺀 a2·a3, 3·4 = 더한 a2·a3 새 판 → a2 고침만 올린다
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: [], 조각: [['tools/x.js', `${묶음[0].id}:1,${묶음[0].id}:3`]], 메시지: 'a2만', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('tools/x.js'), 'const a1 = 1;\nconst a2 = 20;\nconst a3 = 3;\nconst a4 = 4;\n');
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.머리(), r.머리);
  assert.equal(워.읽기('tools/x.js'), 고친글, '올리지 않은 a3 고침은 작업본에 남는다');
  assert.deepEqual(워.상태(), [' M tools/x.js']);
});
