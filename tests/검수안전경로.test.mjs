// 검수 경로 걷기(tools/lib/검수증명.mjs 안전경로): 뿌리에서 아래로, Windows에서는 칸마다 재분석 표지(fsutil)를 lstat보다 먼저 묻고,
// 링크 · 정션 · 마운트 지점은 따라가기 전에 멈춘다(11-19, 설계 검토 2 · 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import 자식 from 'node:child_process';
import { 안전경로, 파일상태 } from '../tools/lib/검수증명.mjs';

const 창 = process.platform === 'win32';
function 뿌리(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '검수안전경로-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  fs.mkdirSync(path.join(d, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(d, 'a', 'b', 'c.txt'), 'c\n');
  return d;
}
const 연결 = /검수 경로에 연결 파일이 있다/, 모름 = /검수 경로의 재분석 지점을 확인하지 못했다/;

// 걷기가 디스크에 물은 곳을 적는다. fs 호출과 fsutil 물음을 따로 센다(GPT review-tool-safe-path-20261119 GA2, 설계 검토 3 규칙 10).
function 물은곳(t) {
  const fs호출 = [], fsutil물음 = [];
  for (const 이름 of ['lstatSync', 'statSync', 'existsSync', 'readdirSync', 'readFileSync', 'openSync']) {
    const 원래 = fs[이름];
    t.mock.method(fs, 이름, function (...a) { fs호출.push(path.resolve(String(a[0]))); return 원래.apply(this, a); });
  }
  const 원래실행 = 자식.spawnSync;
  t.mock.method(자식, 'spawnSync', (cmd, args, ...rest) => {
    if (/fsutil\.exe$/i.test(String(cmd)) && args[0] === 'reparsepoint') fsutil물음.push(path.resolve(args[2]));
    return 원래실행(cmd, args, ...rest);
  });
  return { fs호출, fsutil물음 };
}
// fsutil이 어떤 경로에 내놓는 답만 바꾼다. 나머지는 진짜 fsutil이 답한다.
function fsutil답(t, 답들) {
  const 원래 = 자식.spawnSync, 물음 = [];
  t.mock.method(자식, 'spawnSync', (cmd, args, ...rest) => {
    if (/fsutil\.exe$/i.test(String(cmd)) && args[0] === 'reparsepoint') {
      const 곳 = path.resolve(args[2]); 물음.push(곳);
      if (답들.has(곳)) { const 답 = 답들.get(곳); return typeof 답 === 'function' ? 답() : 답; }
    }
    return 원래(cmd, args, ...rest);
  });
  return 물음;
}
// 한 폴더의 목록 읽기 결과를 바꾼다(항목을 빼거나 재분석 속성을 붙인다).
function 목록바꾸기(t, 폴더, 바꿈) {
  const 원래 = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (q, ...rest) => { const r = 원래(q, ...rest); return path.resolve(String(q)) === 폴더 ? 바꿈(r) : r; });
}
const 링크항목 = 이름 => ({ name: 이름, isSymbolicLink: () => true, isFile: () => false, isDirectory: () => false });
// lstat이 어떤 경로를 보통 폴더로 보고하게 바꾼다 — 볼륨 마운트 지점에서 libuv가 하는 일이다.
function lstat을폴더로(t, 곳, 폴더) {
  const 원래 = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (q, ...rest) => path.resolve(String(q)) === 곳 ? fs.statSync(폴더) : 원래(q, ...rest));
}

test('안전경로: 저장소 안의 보통 경로는 그대로 돌려주고, 없는 파일 · 없는 폴더 · 파일 아래 칸은 fsutil이 실패해도 지나간다', t => {
  const d = 뿌리(t);
  assert.equal(안전경로(d, 'a/b/c.txt'), path.join(d, 'a', 'b', 'c.txt'));
  assert.equal(안전경로(d, 'a/b/없음.txt'), path.join(d, 'a', 'b', '없음.txt'));
  assert.equal(안전경로(d, 'a/없는폴더/c.txt'), path.join(d, 'a', '없는폴더', 'c.txt'));
  assert.equal(안전경로(d, 'a/b/c.txt/아래'), path.join(d, 'a', 'b', 'c.txt', '아래'));
  assert.equal(파일상태(d, 'a/b/없음.txt').sha256, null);
});

test('안전경로: 저장소 상대 경로가 아니면 디스크를 보기 전에 거절한다', t => {
  const d = 뿌리(t);
  for (const 나쁨 of ['a\\b\\c.txt', path.join(d, 'a'), '../a', 'a//b', 'a/./b', 'a/../a/b/c.txt', 'C:a', '', 'a/']) assert.throws(() => 안전경로(d, 나쁨), /검수 상대 경로가 아니다/, JSON.stringify(나쁨));
});

test('안전경로: 길 중간의 정션, 경로 끝 자체인 정션, 대상이 사라진 깨진 정션을 모두 따라가기 전에 막는다', t => {
  const d = 뿌리(t);
  fs.symlinkSync(path.join(d, 'a', 'b'), path.join(d, 'a', 'J'), 'junction');
  assert.ok(fs.existsSync(path.join(d, 'a', 'J', 'c.txt')), '정션이 파일로 이어진다');
  assert.throws(() => 안전경로(d, 'a/J/c.txt'), 연결);
  assert.throws(() => 안전경로(d, 'a/J/없음.txt'), 연결, '그 너머의 파일이 없어도');
  assert.throws(() => 안전경로(d, 'a/J'), 연결, '경로 끝이 링크');
  assert.throws(() => 파일상태(d, 'a/J/c.txt'), 연결);
  fs.mkdirSync(path.join(d, 'gone'));
  fs.symlinkSync(path.join(d, 'gone'), path.join(d, 'a', 'K'), 'junction');
  fs.rmdirSync(path.join(d, 'gone'));
  assert.equal(fs.existsSync(path.join(d, 'a', 'K')), false, '따라가면 없다');
  assert.throws(() => 안전경로(d, 'a/K/c.txt'), 연결);
  assert.throws(() => 파일상태(d, 'a/K/c.txt'), 연결);
});

test('안전경로: 정션을 만나면 그 자리에서 멈춘다 — 부모 목록에서 정션을 보고, 정션과 그 아래는 fs로도 fsutil로도 한 번도 묻지 않는다', { skip: !창 && 'Windows의 재분석 표지' }, t => {
  const d = 뿌리(t);
  fs.symlinkSync(path.join(d, 'a', 'b'), path.join(d, 'a', 'J'), 'junction');
  fs.mkdirSync(path.join(d, 'gone'));
  fs.symlinkSync(path.join(d, 'gone'), path.join(d, 'a', 'K'), 'junction');
  fs.rmdirSync(path.join(d, 'gone'));
  const { fs호출, fsutil물음 } = 물은곳(t);
  for (const [경로, 정션] of [['a/J/c.txt', 'J'], ['a/J/없음/x.txt', 'J'], ['a/K/c.txt', 'K']]) {
    fs호출.length = 0; fsutil물음.length = 0;
    assert.throws(() => 안전경로(d, 경로), 연결, 경로);
    const 그자리 = path.join(d, 'a', 정션);
    assert.ok(fs호출.includes(path.join(d, 'a')), `${경로}: 부모 폴더 목록을 읽었다`);
    assert.deepEqual(fs호출.filter(x => x === 그자리 || x.startsWith(그자리 + path.sep)), [], `${경로}: fs는 정션과 그 아래를 부르지 않았다`);
    assert.deepEqual(fsutil물음.filter(x => x === 그자리 || x.startsWith(그자리 + path.sep)), [], `${경로}: 정션과 그 아래는 fsutil에도 묻지 않았다`);
  }
  fs호출.length = 0;
  assert.equal(안전경로(d, 'a/b/c.txt'), path.join(d, 'a', 'b', 'c.txt'));
  assert.equal(fs호출.filter(x => x === path.join(d, 'a', 'b', 'c.txt')).length, 1, '파일 자신은 lstat 한 번만 본다');
});

test('안전경로: lstat이 보통 폴더로 보고하는 칸(볼륨 마운트 지점 흉내)도 막는다 — 부모 목록의 재분석 속성으로, 목록에 없으면 진짜 fsutil이 읽은 표지로(정션은 마운트 지점과 같은 표지 0xa0000003 — 설계 검토 3 규칙 9)', { skip: !창 && 'Windows의 재분석 표지' }, t => {
  const d = 뿌리(t), 정션 = path.join(d, 'a', 'M');
  fs.symlinkSync(path.join(d, 'a', 'b'), 정션, 'junction');
  lstat을폴더로(t, 정션, path.join(d, 'a', 'b'));
  assert.ok(fs.lstatSync(정션).isDirectory() && !fs.lstatSync(정션).isSymbolicLink(), 'lstat은 보통 폴더로 본다(마운트 지점 흉내)');
  assert.throws(() => 안전경로(d, 'a/M/c.txt'), 연결, '부모 목록이 재분석 속성을 본다');
  assert.throws(() => 안전경로(d, 'a/M'), 연결, '그 칸 자체');
  목록바꾸기(t, path.join(d, 'a'), 목록 => 목록.filter(e => e.name !== 'M'));
  const 물음 = fsutil답(t, new Map());
  assert.throws(() => 안전경로(d, 'a/M/c.txt'), 연결, '목록에 없으면 진짜 fsutil이 표지를 읽어 막는다');
  assert.ok(물음.includes(정션), 'fsutil에 물었다');
  assert.equal(안전경로(d, 'a/b/c.txt'), path.join(d, 'a', 'b', 'c.txt'));
});

test('안전경로: 파일인 칸이 재분석 지점이어도 막는다', { skip: !창 && 'Windows의 재분석 표지' }, t => {
  const d = 뿌리(t);
  목록바꾸기(t, path.join(d, 'a', 'b'), 목록 => 목록.map(e => e.name === 'c.txt' ? 링크항목('c.txt') : e));
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 연결);
  assert.throws(() => 파일상태(d, 'a/b/c.txt'), 연결);
});

test('안전경로: 목록에 없어 fsutil에 물었는데 모르는 답(권한 거부 · 시간 초과 · 실행 실패)이면, 있는 칸은 막고 기억하지 않는다', { skip: !창 && 'Windows의 재분석 표지' }, t => {
  const d = 뿌리(t), b = path.join(d, 'a', 'b');
  목록바꾸기(t, path.join(d, 'a'), 목록 => 목록.filter(e => e.name !== 'b'));
  let 몇번 = 0;
  const 답들 = new Map([[b, () => { 몇번++; return { status: 1, stdout: '오류 5: 액세스가 거부되었습니다.\r\n', stderr: '' }; }]]);
  const 물음 = fsutil답(t, 답들);
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 모름);
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 모름);
  assert.equal(몇번, 2, '모르는 답은 기억하지 않고 다시 묻는다');
  답들.set(b, { status: null, error: null, signal: 'SIGTERM', stdout: '', stderr: '' });
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 모름, '시간 초과');
  답들.set(b, { status: null, error: Object.assign(new Error('spawn fsutil.exe ENOENT'), { code: 'ENOENT' }), stdout: '', stderr: '' });
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 모름, 'fsutil을 실행하지 못함');
  답들.delete(b);
  물음.length = 0;
  assert.equal(안전경로(d, 'a/b/c.txt'), path.join(d, 'a', 'b', 'c.txt'), '진짜 fsutil이 보통이라 답하면 지나간다');
  assert.equal(안전경로(d, 'a/b/c.txt'), path.join(d, 'a', 'b', 'c.txt'));
  assert.equal(물음.filter(x => x === b).length, 1, '보통으로 답한 칸은 한 번만 묻는다');
  assert.ok(!물음.includes(path.join(d, 'a')), '목록에서 찾은 칸은 fsutil에 묻지 않는다');
});

test('안전경로: 이름에 4390이 든 없는 경로는 「보통」으로 기억되지 않는다 — 나중에 그 자리에 생긴 재분석 지점을 막는다', { skip: !창 && 'Windows의 재분석 표지' }, t => {
  const d = 뿌리(t), 자리 = path.join(d, 'a', '4390');
  assert.equal(안전경로(d, 'a/4390/x.txt'), path.join(자리, 'x.txt'), '없는 경로는 지나간다(fsutil은 오류 2)');
  fs.symlinkSync(path.join(d, 'a', 'b'), 자리, 'junction');
  lstat을폴더로(t, 자리, path.join(d, 'a', 'b'));
  목록바꾸기(t, path.join(d, 'a'), 목록 => 목록.filter(e => e.name !== '4390'));
  assert.throws(() => 안전경로(d, 'a/4390/x.txt'), 연결, '목록과 lstat이 못 봐도 fsutil이 다시 물어 막는다(「보통」으로 기억했으면 지나갔다)');
});

test('안전경로: 대소문자만 다른 이름과 Windows 8.3 짧은 이름은 막지 않는다(-b GA1)', t => {
  const d = 뿌리(t);
  assert.equal(안전경로(d, 'A/B/c.txt'), path.join(d, 'A', 'B', 'c.txt'));
  const 짧은 = 창 && fs.existsSync('C:\\PROGRA~1') && fs.existsSync('C:\\Program Files');
  if (!짧은) return t.skip('이 PC에 8.3 짧은 이름 C:\\PROGRA~1이 없다');
  assert.equal(안전경로('C:\\', 'PROGRA~1'), path.join('C:\\', 'PROGRA~1'));
});

test('안전경로: 뿌리와 볼륨 번호(dev)가 다른 칸도 막는다(Linux의 다른 파일 시스템 · 첫 거름)', t => {
  const d = 뿌리(t), 원래 = fs.lstatSync, 곳 = path.join(d, 'a', 'b');
  t.mock.method(fs, 'lstatSync', (q, ...rest) => {
    const st = 원래(q, ...rest);
    return path.resolve(String(q)) === 곳 ? Object.assign(Object.create(Object.getPrototypeOf(st)), st, { dev: st.dev + 1 }) : st;
  });
  assert.throws(() => 안전경로(d, 'a/b/c.txt'), 연결);
  assert.equal(안전경로(d, 'a/없음.txt'), path.join(d, 'a', '없음.txt'));
});

test('안전경로: 파일 자신이 심볼릭 링크여도 막는다(이 PC가 파일 링크를 만들 수 있을 때)', t => {
  const d = 뿌리(t);
  try { fs.symlinkSync(path.join(d, 'a', 'b', 'c.txt'), path.join(d, 'a', 'b', 'l.txt'), 'file'); }
  catch (e) { if (e.code === 'EPERM') return t.skip('파일 링크를 만들 권한이 없다(Windows 개발자 모드 꺼짐)'); throw e; }
  assert.throws(() => 안전경로(d, 'a/b/l.txt'), 연결);
});
