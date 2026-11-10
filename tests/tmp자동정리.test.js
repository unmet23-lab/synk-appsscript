'use strict';

// .tmp 자동 정리 — 임시 폴더에 가짜 .tmp · 정리 대기 · 먼 정리 대기를 만들어 본다. 실제 .tmp · 정리 대기 · D:는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 자동 = require('../tools/tmp자동정리.js');
const 목록도구 = require('../tools/tmp정리목록.js');

const 윈도우 = process.platform === 'win32';
const 하루 = 24 * 60 * 60 * 1000;
function 옛날로(p, 일) {
  const 시각 = new Date(Date.now() - 일 * 하루);
  // 연결은 따라 들어가지 않고 연결 자체의 시각만 되돌린다(훑기는 연결의 시각도 「마지막 손댄 때」로 센다)
  const 돌기 = (q) => { for (const e of fs.readdirSync(q, { withFileTypes: true })) { const r = path.join(q, e.name); if (e.isSymbolicLink()) { fs.lutimesSync(r, 시각, 시각); continue; } if (e.isDirectory()) 돌기(r); fs.utimesSync(r, 시각, 시각); } };
  if (fs.statSync(p).isDirectory()) 돌기(p);
  fs.utimesSync(p, 시각, 시각);
}
function 방만들기(이름) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), `synk-tmp-auto-${이름}-`));
  const 자리 = { 방, 임시: path.join(방, '저장소', '.tmp'), 대기: path.join(방, '정리대기'), 먼대기: path.join(방, '먼정리대기'),
    트랙: path.join(방, '저장소', 'docs', '_ops', '트랙.md'), 장부: path.join(방, '기록', '자동.jsonl') };
  fs.mkdirSync(자리.임시, { recursive: true });
  const 만들기 = (이름2, 파일들, 일) => {
    for (const [f, 내용] of 파일들) { const p = path.join(자리.임시, 이름2, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 내용); }
    if (일 !== undefined) 옛날로(path.join(자리.임시, 이름2), 일);
  };
  const 문서 = (글) => { fs.mkdirSync(path.dirname(자리.트랙), { recursive: true }); fs.writeFileSync(자리.트랙, 글); };
  const 옵션 = (더 = {}) => ({ 임시: 자리.임시, 대기: 자리.대기, 먼대기: 자리.먼대기, 문서들: [자리.트랙], 장부: 자리.장부, 저장소: path.join(방, '저장소'), 명령줄들: () => '', ...더 });
  const 이름들 = (더) => 자동.고르기(옵션(더)).옮길.map((c) => c.이름).sort();
  return { ...자리, 만들기, 문서, 옵션, 이름들, 치우기: () => fs.rmSync(방, { recursive: true, force: true }) };
}
const 오늘이름 = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const 넘는다 = () => { const e = new Error('드라이브를 넘는다'); e.code = 'EXDEV'; throw e; };

test('이레 넘게 조용한 폴더만 고르고, 살아 있는 문서가 가리키거나 실행 중인 명령줄에 보이는 폴더는 남긴다', () => {
  const 방 = 방만들기('pick');
  try {
    for (const 이름 of ['옛것', '옛것-둘', '문서가가리킴', '조사붙음', 'job-1', '묶은것-끝판', '도는중']) 방.만들기(이름, [['a.txt', 'x']], 10);
    방.만들기('닷새', [['a.txt', 'x']], 5);
    방.만들기('새것', [['a.txt', 'x']]);
    // 이름이 더 긴 폴더(.tmp/옛것-둘-셋)나 같은 이름의 다른 자리(docs/옛것)는 그 폴더를 가리키는 것이 아니다.
    // 조사가 붙거나(…에 · …에서) 문장 끝 마침표가 붙어도, 별표 무늬로 적어도 가리키는 것이다.
    방.문서('- **일:** 증거는 `.tmp/문서가가리킴/shots`. 앞 판은 `.tmp\\옛것-둘-셋` · docs/옛것. 화면은 .tmp/조사붙음에 둔다. .tmp/job-1에서 돌린다.\n- 11-14 뒤 `.tmp/*-끝판` 묶음에서 센다.\n');
    const 명령줄들 = () => 'node c:/repo/.tmp/도는중/serve.js --port 1\nnode c:/x/옛것/run.js';
    const r = 자동.고르기(방.옵션({ 명령줄들 }));
    assert.equal(r.멈춤, null);
    assert.deepEqual(r.옮길.map((c) => c.이름).sort(), ['옛것', '옛것-둘'].sort());
    assert.deepEqual(r.지킨, ['job-1', '묶은것-끝판', '문서가가리킴', '조사붙음'].sort());
    assert.deepEqual(r.남김, [{ 이름: '도는중', 이유: '실행 중인 명령줄에 보임' }]);
    assert.deepEqual(방.이름들({ 일수: 3 }), ['닷새', '도는중', '옛것', '옛것-둘'].sort(), '기준을 줄이면 닷새 된 폴더도 든다(명령줄이 비면 도는중도)');
    // 프로세스 목록을 못 읽으면 그날은 아무것도 옮기지 않는다
    const 멈춘 = 자동.고르기(방.옵션({ 명령줄들: () => null }));
    assert.match(멈춘.멈춤, /프로세스 목록/);
    assert.deepEqual(멈춘.옮길, []);
  } finally { 방.치우기(); }
});

test('가리킴 · 낱말있음 — 뒤에 영문 · 숫자 · 붙임표가 이어지면 다른 이름이고, 한글 조사 · 문장 끝 마침표는 같은 이름이다', () => {
  const 글 = 'a .tmp/job-a/x.js b .tmp/job-ab c .tmp/job-c. d .tmp/job-d.bak e .tmp/끝 f .tmp/job-e에서 g 검수 id 배포대기-20261101로 올린다. 배포대기-20261102-둘';
  assert.equal(자동.가리킴(글, 'job-a'), true);
  assert.equal(자동.가리킴(글, 'job'), false, '.tmp/job-a는 job이 아니다');
  assert.equal(자동.가리킴(글, 'JOB-AB'), true, '대소문자는 가리지 않는다(글은 소문자로 맞춘 것)');
  assert.equal(자동.가리킴(글, 'job-c'), true, '문장 끝 마침표');
  assert.equal(자동.가리킴(글, 'job-d'), false, '.tmp/job-d.bak은 다른 폴더');
  assert.equal(자동.가리킴(글, '끝'), true);
  assert.equal(자동.가리킴(글, 'job-e'), true, '조사가 붙은 언급');
  assert.equal(자동.낱말있음(글, '배포대기-20261101'), true, '조사가 붙은 검수 ID');
  assert.equal(자동.낱말있음(글, '배포대기-20261102'), false, '더 긴 ID의 앞부분');
  assert.equal(자동.낱말있음(글, '대기-20261101'), true, '한글 뒤에 붙은 것은 남기는 쪽으로 본다');
  // 별표 무늬 — 폴더 이름 조각까지 맞으면 가리킨 것(안쪽 경로가 더 붙어 있어도). 별표뿐인 조각은 버린다.
  const 무늬 = 자동.무늬들('본다 .tmp/검수/*-끝판 묶음. `.tmp/x-*/y/z`. .tmp/그냥폴더 .tmp/* 아래. .tmp/검수/* 전부. .tmp/pub-*에서 본다. .tmp/a/b/*.png');
  const 맞음 = (이름) => 무늬.some((r) => 자동.무늬맞음(r, 이름));
  assert.deepEqual(['검수/a-끝판', '검수/a-끝판2', 'x-1', 'x', '그냥폴더', '아무폴더', '검수/아무묶음', 'pub-7', 'a'].map(맞음),
    [true, false, true, false, false, false, false, true, false]);
});

test('문서의 별표 무늬가 너무 넓거나 문서를 못 읽으면 조용히 넘어가지 않고 멈춘다', () => {
  const 방 = 방만들기('wide');
  try {
    for (let i = 0; i < 24; i++) 방.만들기(`old-${i}`, [['a.txt', 'x']], 10);
    방.문서('- 화면은 `.tmp/*` 아래에 둔다. 묶음은 .tmp/검수/* 를 본다.\n');
    assert.equal(자동.고르기(방.옵션()).옮길.length, 24, '별표뿐인 무늬는 아무것도 지키지 않는다');
    방.문서('- 화면은 `.tmp/old-*` 아래에 둔다.\n');
    const 넓은 = 자동.고르기(방.옵션());
    assert.match(넓은.멈춤, /폴더 24곳 가운데 24곳을 가리킨다/);
    assert.deepEqual(넓은.옮길, []);
    fs.rmSync(방.트랙); fs.mkdirSync(방.트랙);   // 읽을 수 없는 문서(폴더)
    assert.match(자동.고르기(방.옵션()).멈춤, /살아 있는 문서를 읽지 못했다\(트랙\.md\)/);
    assert.equal(자동.고르기(방.옵션({ 문서들: [path.join(방.방, '없는문서.md')] })).멈춤, null, '없는 문서는 넘어간다');
  } finally { 방.치우기(); }
});

test('올리지 않은 git 변경이 있는 폴더는 고르지 않고, 릴리스 옛 판도 이레가 지나야 고른다', () => {
  const 방 = 방만들기('git');
  try {
    const 옛 = Date.now() - 30 * 하루;
    const 가짜목록 = () => ({ 후보: [
      { 이름: '깨끗한사본', MB: 1, 파일: 1, 마지막: '2026-10-01', 마지막ms: 옛, git: { 미커밋: 0, 안올린커밋: 0 }, 까닭: ['14일'] },
      { 이름: '고치던사본', MB: 1, 파일: 1, 마지막: '2026-10-01', 마지막ms: 옛, git: { 미커밋: 2, 안올린커밋: 0 }, 까닭: ['14일'] },
      { 이름: '안올린사본', MB: 1, 파일: 1, 마지막: '2026-10-01', 마지막ms: 옛, git: { 미커밋: 0, 안올린커밋: 3 }, 까닭: ['14일'] },
      { 이름: '못읽은사본', MB: 1, 파일: 1, 마지막: '2026-10-01', 마지막ms: 옛, git: { 미커밋: null, 안올린커밋: 0 }, 까닭: ['14일'] },
      { 이름: '그냥폴더', MB: 1, 파일: 1, 마지막: '2026-10-01', 마지막ms: 옛, git: null, 까닭: ['14일'] },
      { 이름: 'x-release-20261101', MB: 1, 파일: 1, 마지막: '2026-11-09', 마지막ms: Date.now() - 하루, git: null, 까닭: ['릴리스옛판'] },
    ], 참조로남김: [], 참조잘림: false, 잰폴더: [] });
    const r = 자동.고르기(방.옵션({ 목록만들기: 가짜목록 }));
    assert.deepEqual(r.옮길.map((c) => c.이름), ['깨끗한사본', '그냥폴더']);
    assert.deepEqual(r.남김.map((x) => x.이름), ['고치던사본', '안올린사본', '못읽은사본', 'x-release-20261101']);
    assert.match(r.남김[3].이유, /릴리스 옛 판이지만 아직 7일이 안 됨/);
    // 참조를 끝까지 못 훑은 목록이면 멈춘다
    assert.match(자동.고르기(방.옵션({ 목록만들기: () => ({ 후보: [], 참조잘림: true }) })).멈춤, /참조/);
  } finally { 방.치우기(); }
});

test('릴리스 옛 판 — 셋째 판이 생겨도 방금 만든 첫 판은 옮기지 않고, 이레가 지난 뒤 옮긴 것을 되돌리면 다시 고르지 않는다', () => {
  const 방 = 방만들기('release');
  try {
    for (const 날 of ['20261001', '20261002', '20261003']) 방.만들기(`x-release-${날}`, [['a.txt', 날]]);
    assert.deepEqual(방.이름들(), [], '방금 만든 폴더는 옛 판이어도 고르지 않는다');
    assert.deepEqual(자동.옮기기([{ 이름: 'x-release-20261001', 까닭: ['릴리스옛판'] }], 방.옵션()).남김.map((x) => x.이유), ['그새 바뀜'], '옮기기도 새 폴더는 두고 본다');
    옛날로(path.join(방.임시, 'x-release-20261001'), 10);
    const 고른 = 자동.고르기(방.옵션());
    assert.deepEqual(고른.옮길.map((c) => c.이름), ['x-release-20261001']);
    assert.deepEqual(자동.옮기기(고른.옮길, 방.옵션()).옮김.map((x) => x.이름), ['x-release-20261001']);
    assert.equal(자동.되돌리기('x-release-20261001', 방.옵션({ 실행: true })).됨, true);
    assert.deepEqual(방.이름들(), [], '되돌린 옛 판은 표식 때문에 새것이라 다시 고르지 않는다');
  } finally { 방.치우기(); }
});

test('옮기기는 직전에 다시 재어 그새 바뀐 폴더를 두고, 같은 이름이 이미 있으면 번호를 붙인다', () => {
  const 방 = 방만들기('move');
  try {
    방.만들기('옛것', [['a.txt', 'x'], ['안/b.txt', 'yy']], 10);
    방.만들기('그새바뀜', [['a.txt', 'x']], 10);
    const 고른 = 자동.고르기(방.옵션());
    assert.deepEqual(고른.옮길.map((c) => c.이름).sort(), ['그새바뀜', '옛것'].sort());
    fs.writeFileSync(path.join(방.임시, '그새바뀜', '새.txt'), '목록을 만든 뒤에 씀');
    fs.mkdirSync(path.join(방.대기, 오늘이름(), '옛것'), { recursive: true });   // 같은 날 같은 이름이 먼저 와 있다
    const r = 자동.옮기기([...고른.옮길, { 이름: '../밖', 까닭: [] }, { 이름: '없는것', 까닭: [] }], 방.옵션());
    assert.deepEqual(r.옮김.map((x) => x.이름), ['옛것']);
    assert.deepEqual(r.남김.map((x) => [x.이름, x.이유]).sort(), [['../밖', '이름이 폴더 하나가 아님'], ['그새바뀜', '그새 바뀜'], ['없는것', '없어졌거나 읽지 못함']].sort());
    assert.ok(fs.existsSync(path.join(방.대기, 오늘이름(), '옛것__2', '안', 'b.txt')), '먼저 온 폴더를 덮지 않는다');
    assert.ok(fs.existsSync(path.join(방.임시, '그새바뀜', '새.txt')));
    assert.equal(r.옮김[0].바이트, 3);
    assert.equal(r.옮김[0].파일, 2);
  } finally { 방.치우기(); }
});

test('돌기 --실행: 옮기고, 정리 대기를 먼 자리로 내려놓고, 장부에 한 줄 — 연결은 끊기만 하고, 되돌리면 다시 잇는다', { skip: !윈도우 && 'robocopy는 Windows에만 있다' }, () => {
  const 방 = 방만들기('run');
  try {
    방.만들기('옛것', [['a.txt', 'x'], ['안/b.bin', Buffer.alloc(2048)]]);
    방.만들기('새것', [['a.txt', 'x']]);
    const 밖 = path.join(방.방, '밖'); fs.mkdirSync(밖); fs.writeFileSync(path.join(밖, '지키는것.txt'), '지우면 안 된다');
    fs.symlinkSync(밖, path.join(방.임시, '옛것', '이음'), 'junction');
    옛날로(path.join(방.임시, '옛것'), 10);
    fs.mkdirSync(path.join(방.대기, '20261001', '지난것'), { recursive: true });
    fs.writeFileSync(path.join(방.대기, '20261001', '지난것', 'x.txt'), '전에 옮겨 둔 것');
    fs.mkdirSync(path.join(방.대기, '_되돌리는중', '남의것'), { recursive: true });   // 도구가 쓰는 자리는 내려놓지 않는다

    const 미리 = 자동.돌기(방.옵션());
    assert.equal(미리.실행, false);
    assert.deepEqual(미리.옮길.map((x) => x.이름), ['옛것']);
    assert.ok(fs.existsSync(path.join(방.임시, '옛것', 'a.txt')), '미리 보기는 아무것도 옮기지 않는다');
    assert.ok(!fs.existsSync(방.장부), '미리 보기는 장부를 쓰지 않는다');

    const r = 자동.돌기(방.옵션({ 실행: true }));
    assert.equal(r.멈춤, null);
    assert.deepEqual(r.옮김.map((x) => x.이름), ['옛것']);
    assert.deepEqual(fs.readdirSync(방.임시).sort(), ['새것']);
    const 내린자리 = path.join(방.먼대기, 오늘이름(), '옛것');
    assert.equal(fs.readFileSync(path.join(내린자리, 'a.txt'), 'utf8'), 'x');
    assert.equal(fs.statSync(path.join(내린자리, '안', 'b.bin')).size, 2048);
    assert.ok(fs.existsSync(path.join(방.먼대기, '20261001', '지난것', 'x.txt')), '전에 옮겨 둔 것도 같이 내려놓는다');
    assert.deepEqual(fs.readdirSync(방.대기), ['_되돌리는중'], '같은 드라이브의 정리 대기는 도구 자리만 남는다');
    assert.equal(fs.readFileSync(path.join(밖, '지키는것.txt'), 'utf8'), '지우면 안 된다', '연결이 가리키던 곳은 그대로');
    assert.ok(!fs.existsSync(path.join(내린자리, '이음', '지키는것.txt')), '연결 안쪽은 복사하지 않는다');
    const 끊은 = JSON.parse(fs.readFileSync(path.join(방.먼대기, 오늘이름(), '_끊은연결.json'), 'utf8'));
    assert.equal(끊은.length, 1);
    assert.match(끊은[0].자리, /옛것.이음$/);
    let 줄들 = fs.readFileSync(방.장부, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(줄들.length, 1);
    assert.equal(줄들[0].옮김[0].이름, '옛것');
    assert.deepEqual(줄들[0].내려놓음.map((x) => x.이름).sort(), ['20261001', 오늘이름()].sort());
    assert.equal(줄들[0].끊은연결.length, 1);
    assert.equal(줄들[0].재기.폴더, 1, '옮긴 폴더는 재기에서 빠진다');
    assert.ok(줄들[0].재기.먼대기GB >= 0 && 줄들[0].재기.여유GB > 0);

    // 같은 날 같은 이름이 한 번 더 내려와도 먼 자리의 앞 것과 합치지 않는다(파일을 덮어쓰지 않는다)
    방.만들기('옛것', [['a.txt', '둘째 판']], 10);
    const 둘째 = 자동.돌기(방.옵션({ 실행: true }));
    assert.deepEqual(둘째.내려놓음.map((x) => x.번호붙임), [['옛것 → 옛것__2']]);
    assert.equal(fs.readFileSync(path.join(내린자리, 'a.txt'), 'utf8'), 'x', '먼저 내려간 것은 그대로');
    assert.equal(fs.readFileSync(path.join(방.먼대기, 오늘이름(), '옛것__2', 'a.txt'), 'utf8'), '둘째 판');

    // 되돌리기 — 가장 늦게 옮긴 것(번호 붙은 것)부터 제자리로, 표식을 남겨 다음 날 다시 옮겨지지 않는다
    const 볼 = 자동.되돌리기('옛것', 방.옵션());
    assert.equal(볼.미리, true);
    assert.match(볼.있는곳, /옛것__2$/);
    assert.equal(볼.다른곳.length, 1);
    assert.equal(자동.되돌리기('옛것', 방.옵션({ 실행: true })).됨, true);
    assert.equal(fs.readFileSync(path.join(방.임시, '옛것', 'a.txt'), 'utf8'), '둘째 판');
    assert.ok(fs.existsSync(path.join(방.임시, '옛것', '_되돌림.txt')));
    assert.deepEqual(방.이름들(), [], '되돌린 폴더는 다시 고르지 않는다');
    assert.equal(자동.되돌리기('옛것', 방.옵션({ 실행: true })).이유, '.tmp에 같은 이름의 폴더가 이미 있음');
    assert.equal(자동.되돌리기('없는이름', 방.옵션({ 실행: true })).이유, '정리 대기에 그 이름이 없음');
    assert.equal(자동.되돌리기('../밖', 방.옵션({ 실행: true })).이유, '이름이 폴더 하나가 아님');

    // 드라이브를 넘는 되돌리기 — 「되돌리는 중」 자리로 다 옮긴 뒤 한 번에 제자리로, 끊었던 연결은 다시 잇는다
    fs.renameSync(path.join(방.임시, '옛것'), path.join(방.방, '치움'));
    const 멈춘 = 자동.되돌리기('옛것', 방.옵션({ 실행: true, 이름바꾸기: 넘는다, 로보옮김: (원래, 목적) => { fs.mkdirSync(목적, { recursive: true }); fs.renameSync(path.join(원래, 'a.txt'), path.join(목적, 'a.txt')); return { 코드: 9, 됨: false }; } }));
    assert.match(멈춘.이유, /robocopy 9 — 옮기다 멈췄다\. 다시 부르면 이어서 한다/);
    assert.ok(!fs.existsSync(path.join(방.임시, '옛것')), '반쯤 옮긴 것은 .tmp에 내놓지 않는다');
    assert.ok(fs.existsSync(path.join(방.대기, '_되돌리는중', '옛것', 'a.txt')));
    const 이은 = 자동.되돌리기('옛것', 방.옵션({ 실행: true, 이름바꾸기: 넘는다 }));
    assert.equal(이은.됨, true);
    assert.equal(이은.이은연결, 1);
    assert.equal(fs.readFileSync(path.join(방.임시, '옛것', 'a.txt'), 'utf8'), 'x');
    assert.equal(fs.statSync(path.join(방.임시, '옛것', '안', 'b.bin')).size, 2048);
    assert.ok(fs.lstatSync(path.join(방.임시, '옛것', '이음')).isSymbolicLink(), '끊었던 연결을 다시 잇는다');
    assert.equal(fs.readFileSync(path.join(방.임시, '옛것', '이음', '지키는것.txt'), 'utf8'), '지우면 안 된다');
    assert.ok(!fs.existsSync(path.join(방.먼대기, 오늘이름(), '_끊은연결.json')), '이은 연결은 기록에서 지운다');
    assert.ok(!fs.existsSync(path.join(방.대기, '_되돌리는중', '옛것')));
    assert.ok(!fs.existsSync(내린자리), '먼 자리에는 남지 않는다');

    // 다른 자동 정리가 돌고 있으면 멈춘다(살아 있는 pid의 새 잠금) — 되돌리기도 기다린다
    const 잠금 = path.join(path.dirname(방.장부), '자동.lock');
    fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    assert.match(자동.돌기(방.옵션({ 실행: true })).멈춤, /다른 자동 정리/);
    assert.match(자동.되돌리기('지난것', 방.옵션({ 실행: true })).이유, /정리 대기에 그 이름이 없음|자동 정리가 돌고 있다/);
    assert.ok(fs.existsSync(잠금), '남의 잠금은 지우지 않는다');
    // 죽은 주인의 잠금은 넘겨받는다
    fs.writeFileSync(잠금, JSON.stringify({ pid: 999999, at: new Date().toISOString() }));
    assert.equal(자동.돌기(방.옵션({ 실행: true })).멈춤, null);
    assert.ok(!fs.existsSync(잠금), '끝나면 잠금을 푼다');
    줄들 = 자동.추이(방.옵션());
    assert.equal(줄들.length, 3);
    assert.match(자동.추이글(줄들), /^날짜 /);
  } finally { 방.치우기(); }
});

test('내려놓을 드라이브가 안 보이거나 robocopy가 실패하면 정리 대기에 그대로 둔다', { skip: !윈도우 && 'Windows 경로 시험' }, () => {
  const 방 = 방만들기('far');
  try {
    fs.mkdirSync(path.join(방.대기, '20261001', '지난것'), { recursive: true });
    fs.writeFileSync(path.join(방.대기, '20261001', '지난것', 'x.txt'), 'x');
    const 없는 = 자동.내려놓기(방.옵션({ 먼대기: 'Q:\\없는드라이브\\정리대기' }));
    assert.match(없는.건너뜀, /드라이브/);
    const 실패 = 자동.내려놓기(방.옵션({ 로보옮김: () => ({ 코드: 16, 됨: false }) }));
    assert.deepEqual(실패.남김, [{ 이름: '20261001', 이유: '지난것(robocopy 16 — 다음 회차가 잇는다)' }]);
    assert.deepEqual(실패.내려놓음, []);
    assert.ok(fs.existsSync(path.join(방.대기, '20261001', '지난것', 'x.txt')));
    assert.match(자동.내려놓기(방.옵션({ 먼대기: 방.대기 })).건너뜀, /이미 그 자리/);
    // 시간이 다 되면 남은 폴더는 다음 회차로 넘긴다
    assert.deepEqual(자동.내려놓기(방.옵션({ 한도분: -1 })).남김, [{ 이름: '20261001', 이유: '지난것(시간이 다 돼 다음 회차로)' }]);
  } finally { 방.치우기(); }
});

test('끊긴 내려놓기는 다음 회차가 같은 자리로 이어 옮긴다 — 폴더를 둘로 쪼개지 않고, 먼저 내려간 같은 이름의 다른 폴더와도 합치지 않는다', { skip: !윈도우 && 'robocopy는 Windows에만 있다' }, () => {
  const 방 = 방만들기('resume');
  try {
    const 날 = path.join(방.대기, '20261105'), 먼날 = path.join(방.먼대기, '20261105');
    for (const [f, 글] of [['큰폴더/1.txt', '하나'], ['큰폴더/2.txt', '둘'], ['큰폴더/안/3.txt', '셋'], ['검수/옛묶음/묶음.json', '{}'], ['검수/옛묶음/화면.png', 'png']]) {
      fs.mkdirSync(path.dirname(path.join(날, f)), { recursive: true }); fs.writeFileSync(path.join(날, f), 글);
    }
    fs.mkdirSync(path.join(먼날, '큰폴더'), { recursive: true });   // 같은 날 먼저 내려간, 이름만 같은 다른 폴더
    fs.writeFileSync(path.join(먼날, '큰폴더', '1.txt'), '먼저 내려간 다른 폴더');
    // 첫 회차 — robocopy가 폴더마다 파일 하나만 옮기고 끊긴다
    const 끊김 = (원래, 목적) => { fs.mkdirSync(목적, { recursive: true }); const 첫 = fs.readdirSync(원래, { withFileTypes: true }).find((e) => e.isFile()); if (첫) fs.renameSync(path.join(원래, 첫.name), path.join(목적, 첫.name)); return { 코드: 9, 됨: false }; };
    const 첫회 = 자동.내려놓기(방.옵션({ 로보옮김: 끊김 }));
    assert.equal(첫회.내려놓음.length, 0);
    assert.equal(첫회.남김.length, 2);
    assert.ok(fs.existsSync(path.join(먼날, '큰폴더.옮기는중', '1.txt')), '옮기던 것은 「옮기는 중」 자리에만 있다');
    assert.equal(자동.되돌리기('큰폴더', 방.옵션()).있는곳, path.join(먼날, '큰폴더'), '옮기는 중인 것은 되돌리기가 보지 않는다');
    // 다음 회차 — 진짜 robocopy가 같은 자리로 마저 옮기고 이름을 붙인다
    const 둘째 = 자동.내려놓기(방.옵션());
    assert.deepEqual(둘째.남김, []);
    assert.deepEqual(둘째.내려놓음.map((x) => x.번호붙임), [['큰폴더 → 큰폴더__2']]);
    assert.deepEqual(fs.readdirSync(먼날).sort(), ['검수', '큰폴더', '큰폴더__2'].sort());
    assert.deepEqual(fs.readdirSync(path.join(먼날, '큰폴더__2')).sort(), ['1.txt', '2.txt', '안'].sort(), '한 폴더가 둘로 쪼개지지 않는다');
    assert.equal(fs.readFileSync(path.join(먼날, '큰폴더__2', '안', '3.txt'), 'utf8'), '셋');
    assert.equal(fs.readFileSync(path.join(먼날, '큰폴더', '1.txt'), 'utf8'), '먼저 내려간 다른 폴더', '이름만 같은 다른 폴더는 그대로');
    assert.deepEqual(fs.readdirSync(path.join(먼날, '검수', '옛묶음')).sort(), ['묶음.json', '화면.png'].sort());
    assert.ok(!fs.existsSync(날), '다 옮긴 날짜 폴더는 정리 대기에서 사라진다');
    // 다 옮기고 끝 이름만 못 붙인 채 남은 것(원본이 없는 「옮기는 중」)은 다음 회차가 이름을 붙인다
    fs.mkdirSync(path.join(먼날, '외톨이.옮기는중'), { recursive: true }); fs.writeFileSync(path.join(먼날, '외톨이.옮기는중', 'a.txt'), 'a');
    자동.내려놓기(방.옵션());
    assert.equal(fs.readFileSync(path.join(먼날, '외톨이', 'a.txt'), 'utf8'), 'a');
    // 되돌리기는 가장 늦게 내려간 것(번호가 큰 것)을 통째로 되돌린다
    assert.equal(자동.되돌리기('큰폴더', 방.옵션({ 실행: true })).됨, true);
    assert.deepEqual(fs.readdirSync(path.join(방.임시, '큰폴더')).sort(), ['1.txt', '2.txt', '_되돌림.txt', '안'].sort());
  } finally { 방.치우기(); }
});

test('끝 이름을 못 붙인 채 남은 「옮기는 중」에 같은 날 같은 이름의 새 폴더를 합치지 않는다 — 빈 껍데기 원본으로 빈 번호 폴더도 만들지 않는다', { skip: !윈도우 && 'robocopy는 Windows에만 있다' }, () => {
  const 방 = 방만들기('orphan');
  try {
    const 먼날 = path.join(방.먼대기, 오늘이름()), 날 = path.join(방.대기, 오늘이름());
    // 첫째 폴더는 다 옮겨졌는데 끝 이름을 못 붙였다(가까운 자리에 원본 없음)
    fs.mkdirSync(path.join(먼날, 'foo.옮기는중'), { recursive: true });
    fs.writeFileSync(path.join(먼날, 'foo.옮기는중', 'a.txt'), '첫째 폴더');
    fs.writeFileSync(path.join(먼날, 'foo.옮기는중', '첫째에만.txt'), 'x');
    방.만들기('foo', [['a.txt', '둘째 폴더'], ['둘째에만.txt', 'y']], 10);
    const r = 자동.돌기(방.옵션({ 실행: true }));
    assert.deepEqual(r.옮김.map((x) => x.이름), ['foo']);
    assert.deepEqual(fs.readdirSync(먼날).filter((n) => !n.startsWith('_')).sort(), ['foo', 'foo__2'].sort());
    assert.deepEqual(fs.readdirSync(path.join(먼날, 'foo')).sort(), ['a.txt', '첫째에만.txt'].sort());
    assert.equal(fs.readFileSync(path.join(먼날, 'foo', 'a.txt'), 'utf8'), '첫째 폴더', '첫째의 파일이 덮어써지지 않는다');
    assert.deepEqual(fs.readdirSync(path.join(먼날, 'foo__2')).sort(), ['a.txt', '둘째에만.txt'].sort());
    // 옮기기만 따로 불러도, 먼 자리에 같은 이름의 「옮기는 중」이 있으면 번호를 붙여 놓는다
    fs.mkdirSync(path.join(먼날, 'bar.옮기는중'), { recursive: true });
    방.만들기('bar', [['a.txt', 'b']], 10);
    assert.match(자동.옮기기([{ 이름: 'bar', 까닭: [] }], 방.옵션()).옮김[0].자리, /bar__2$/);
    // 가까운 자리에 빈 껍데기만 남은 폴더(앞 회차가 다 옮기고 폴더를 못 지움)는 다시 옮기지 않고 치운다
    fs.rmSync(path.join(날, 'bar__2'), { recursive: true }); fs.rmSync(path.join(먼날, 'bar.옮기는중'), { recursive: true });
    fs.mkdirSync(path.join(날, 'foo', '빈안'), { recursive: true });
    const 껍데기 = 자동.내려놓기(방.옵션());
    assert.deepEqual(껍데기.남김, []);
    assert.deepEqual(fs.readdirSync(먼날).filter((n) => !n.startsWith('_')).sort(), ['foo', 'foo__2'].sort(), '빈 foo__3이 생기지 않는다');
    assert.ok(!fs.existsSync(날));
    // 번호 붙은 폴더가 먼 자리로 옮겨지는 중이면 되돌리기가 그 반쪽을 고르지 않는다
    fs.mkdirSync(path.join(날, 'foo__3'), { recursive: true }); fs.writeFileSync(path.join(날, 'foo__3', '남은반쪽.txt'), 'x');
    fs.mkdirSync(path.join(먼날, 'foo__3.옮기는중'), { recursive: true }); fs.writeFileSync(path.join(먼날, 'foo__3.옮기는중', '먼저간반쪽.txt'), 'x');
    assert.match(자동.되돌리기('foo', 방.옵션()).있는곳, /먼정리대기.*foo__2$/);
    // 앞 회차의 robocopy가 아직 그 폴더를 옮기는 중이면 건드리지 않는다
    const 도는 = 자동.내려놓기(방.옵션({ 명령줄들: () => `robocopy ${path.join(날, 'foo__3')} d:/x /e /move`.toLowerCase().replace(/\\+/g, '/') }));
    assert.deepEqual(도는.남김, [{ 이름: 오늘이름(), 이유: 'foo__3(앞 회차의 robocopy가 아직 옮기는 중)' }]);
    // 되돌리던 원본 쪽지가 깨졌으면 반쪽을 .tmp에 내놓지 않고 멈춘다
    fs.mkdirSync(path.join(방.대기, '_되돌리는중', 'baz'), { recursive: true }); fs.writeFileSync(path.join(방.대기, '_되돌리는중', 'baz', '반쪽.txt'), 'x');
    fs.writeFileSync(path.join(방.대기, '_되돌리는중', 'baz.원본.json'), '{깨짐');
    assert.match(자동.되돌리기('baz', 방.옵션({ 실행: true })).이유, /쪽지를 읽지 못했다/);
    fs.writeFileSync(path.join(방.대기, '_되돌리는중', 'baz.원본.json'), JSON.stringify({ p: 'Q:\\없는드라이브\\20261001\\baz', 날: '20261001', 날폴더: 'Q:\\없는드라이브\\20261001', 안자리: 'baz' }));
    assert.match(자동.되돌리기('baz', 방.옵션({ 실행: true })).이유, /드라이브가 안 보인다/);
    assert.ok(!fs.existsSync(path.join(방.임시, 'baz')));
  } finally { 방.치우기(); }
});

test('드라이브를 넘는 되돌리기를 이어 할 때 다른 날짜의 같은 이름과 섞지 않는다 — 끝 이름 바꾸기가 막혔으면 다음에 이름만 바꿔 끝낸다', { skip: !윈도우 && 'robocopy는 Windows에만 있다' }, () => {
  const 방 = 방만들기('generations');
  try {
    for (const [날, 파일들] of [['20261001', { 'a.txt': '옛 세대', '옛것에만.txt': 'x' }], ['20261105', { 'a.txt': '새 세대', 'b.txt': 'b' }]]) {
      for (const [f, 글] of Object.entries(파일들)) { const p = path.join(방.먼대기, 날, 'foo', f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); }
    }
    const 막힘 = () => { const e = new Error('잡힘'); e.code = 'EPERM'; throw e; };
    const 첫 = 자동.되돌리기('foo', 방.옵션({ 실행: true, 이름바꾸기: 넘는다, 끝이름바꾸기: 막힘 }));
    assert.match(첫.이유, /EPERM — 다시 부르면 이어서 한다/);
    assert.ok(!fs.existsSync(path.join(방.임시, 'foo')));
    assert.ok(!fs.existsSync(path.join(방.먼대기, '20261105', 'foo')), '새 세대는 「되돌리는 중」 자리로 다 넘어갔다');
    const 둘째 = 자동.되돌리기('foo', 방.옵션({ 실행: true, 이름바꾸기: 넘는다 }));
    assert.equal(둘째.됨, true);
    assert.equal(둘째.있던곳, path.join(방.먼대기, '20261105', 'foo'));
    assert.deepEqual(fs.readdirSync(path.join(방.임시, 'foo')).sort(), ['_되돌림.txt', 'a.txt', 'b.txt'].sort(), '옛 세대의 파일이 섞이지 않는다');
    assert.equal(fs.readFileSync(path.join(방.임시, 'foo', 'a.txt'), 'utf8'), '새 세대');
    assert.equal(fs.readFileSync(path.join(방.먼대기, '20261001', 'foo', 'a.txt'), 'utf8'), '옛 세대', '옛 세대는 먼 자리에 그대로');
    assert.deepEqual(fs.readdirSync(path.join(방.대기, '_되돌리는중')), [], '끝나면 「되돌리는 중」 자리와 원본 쪽지를 치운다');
    // 이름은 대소문자를 가리지 않고 찾는다(Windows 폴더 이름)
    fs.renameSync(path.join(방.임시, 'foo'), path.join(방.방, '치움'));
    assert.equal(자동.되돌리기('FOO', 방.옵션()).있는곳, path.join(방.먼대기, '20261001', 'foo'));
  } finally { 방.치우기(); }
});

test('목록은 재기를 켜면 남기는 폴더 · 검수 묶음까지 모든 맨 위 폴더를 잰다 — 평소 목록에는 싣지 않고, 사라진 폴더는 건너뛴다', () => {
  const 방 = 방만들기('all');
  try {
    방.만들기('옛것', [['a.txt', 'xx']], 10);
    방.만들기('새것', [['a.txt', 'x']]);
    방.만들기('보존_작업트리_20261001', [['f.txt', 'xxx']], 30);
    방.만들기('지키는것', [['_보존.txt', 'x'], ['d.txt', 'xxxx']], 30);
    방.만들기('검수/옛묶음', [['묶음.json', '{}']], 30);
    방.만들기('검수/새묶음', [['묶음.json', '{}']]);
    assert.equal('잰폴더' in 목록도구.목록만들기({ 임시: 방.임시, 대기: 방.대기 }), false);
    const 고른 = 자동.고르기(방.옵션());
    assert.deepEqual(고른.목록.잰폴더.map((f) => f.이름).sort(), ['검수/새묶음', '검수/옛묶음', '보존_작업트리_20261001', '새것', '옛것', '지키는것'].sort());
    assert.equal(고른.목록.잰폴더.find((f) => f.이름 === '지키는것').바이트, 5);
    assert.deepEqual(고른.옮길.map((c) => c.이름).sort(), ['검수/옛묶음', '옛것'].sort(), '남기는 폴더는 재기만 하고, 모음은 통째로 두되 옛 묶음만 고른다');
    assert.equal(자동.재기(고른.목록, 방.옵션()).폴더, 6);
    assert.deepEqual(목록도구.훑기(path.join(방.임시, '없는폴더')), { 최신: 0, 크기: 0, 파일: 0, 없음: true }, '훑는 사이 사라진 폴더로 통째 멈추지 않는다');
    // 부르는 쪽이 남기라고 한 이름은 _보존.txt처럼 후보에서 빠진다
    assert.deepEqual(목록도구.목록만들기({ 임시: 방.임시, 대기: 방.대기, 일수: 7, 지킬: ['옛것'] }).후보, []);
  } finally { 방.치우기(); }
});

test('검수 모음의 옛 묶음 — 새 묶음의 사슬 · _보존 · 문서가 검수 ID로 적은 묶음과 그 사슬 · 배포 후보는 남기고, 옮긴 묶음은 제자리로 되돌릴 수 있다', () => {
  const 방 = 방만들기('bundle');
  try {
    방.만들기('검수/옛묶음', [['묶음.json', '{}'], ['화면/a.png', 'png']], 30);
    방.만들기('검수/사슬앞', [['묶음.json', '{}']], 30);
    방.만들기('검수/지키는묶음', [['묶음.json', '{}'], ['_보존.txt', 'x']], 30);
    방.만들기('검수/처음검수-20261020', [['묶음.json', '{}']], 30);
    방.만들기('검수/배포대기-20261101', [['묶음.json', JSON.stringify({ 앞: { 이름: '처음검수-20261020' }, 배포후보: '.tmp/후보-20261101/후보.json' })]], 30);
    방.만들기('후보-20261101', [['후보.json', JSON.stringify({ 앞판: '../후보-20261020/후보.json' })]], 30);
    방.만들기('후보-20261020', [['후보.json', '{}']], 30);
    방.만들기('검수/새묶음', [['묶음.json', JSON.stringify({ 앞: { 이름: '사슬앞' } })]]);
    방.문서('- **배포 대기:** 검수 ID 배포대기-20261101로 올린다. 배포대기-20261101-둘 은 다른 묶음.\n');
    const 고른 = 자동.고르기(방.옵션());
    assert.deepEqual(고른.옮길.map((c) => [c.이름, c.까닭]), [['검수/옛묶음', ['옛묶음']]], '문서가 지킨 묶음의 앞 고리 · 배포 후보 · 그 앞 판까지 남는다');
    assert.deepEqual(고른.지킨, ['검수/배포대기-20261101']);
    const r = 자동.옮기기(고른.옮길, 방.옵션());
    assert.deepEqual(r.옮김.map((x) => x.이름), ['검수/옛묶음']);
    assert.ok(fs.existsSync(path.join(방.대기, 오늘이름(), '검수', '옛묶음', '화면', 'a.png')));
    assert.deepEqual(fs.readdirSync(path.join(방.임시, '검수')).sort(), ['배포대기-20261101', '사슬앞', '새묶음', '지키는묶음', '처음검수-20261020'].sort());
    // 모음이 아닌 폴더의 안쪽 · 위로 올라가는 이름은 받지 않는다
    assert.deepEqual(자동.옮기기([{ 이름: '새것/안', 까닭: [] }, { 이름: '검수/../밖', 까닭: [] }, { 이름: '검수/a/b', 까닭: [] }], 방.옵션()).남김.map((x) => x.이유), ['이름이 폴더 하나가 아님', '이름이 폴더 하나가 아님', '이름이 폴더 하나가 아님']);
    const 돌린 = 자동.되돌리기('검수/옛묶음', 방.옵션({ 실행: true }));
    assert.equal(돌린.됨, true);
    assert.ok(fs.existsSync(path.join(방.임시, '검수', '옛묶음', '화면', 'a.png')));
    assert.deepEqual(방.이름들(), [], '되돌린 묶음은 다시 고르지 않는다');
  } finally { 방.치우기(); }
});

test('재기는 목록이 잰 폴더들로 나이별 합과 큰 폴더를 낸다 — 나이는 꽉 찬 날수로 센다', () => {
  const 방 = 방만들기('measure');
  try {
    const 지금 = Date.now(), 기가 = 1024 ** 3;
    const 목록 = { 잰폴더: [
      { 이름: '오늘', 바이트: 2 * 기가, 마지막ms: 지금 - 0.5 * 하루 }, { 이름: '이틀반', 바이트: 0.25 * 기가, 마지막ms: 지금 - 2.5 * 하루 },
      { 이름: '엿새반', 바이트: 1 * 기가, 마지막ms: 지금 - 6.5 * 하루 }, { 이름: '열흘', 바이트: 3 * 기가, 마지막ms: 지금 - 10 * 하루 },
      { 이름: '검수/옛묶음', 바이트: 0.5 * 기가, 마지막ms: 지금 - 30 * 하루 },
    ] };
    const j = 자동.재기(목록, 방.옵션({ 지금 }));
    assert.equal(j.임시GB, 6.75);
    assert.deepEqual(j.나이GB, { '0-2': 2.25, '3-6': 1, '7-13': 3, '14+': 0.5 }, '6.5일은 아직 이레가 아니다 — 옮길 대상이 아닌 것을 「7일 넘음」에 섞지 않는다');
    assert.deepEqual(j.큰것.map((x) => [x.이름, x.GB, x.일]), [['열흘', 3, 10], ['오늘', 2, 0], ['엿새반', 1, 6], ['검수/옛묶음', 0.5, 30], ['이틀반', 0.25, 2]]);
    assert.equal(j.대기GB, 0);
  } finally { 방.치우기(); }
});

test('인자는 아는 것만 받는다 — 모르는 인자 · 값 없는 선택지 · 안 맞는 짝은 아무것도 하지 않고 2', () => {
  const 빈것 = { 실행: false, 일수: null, 되돌리기: null, 추이: null, json: false };
  for (const [argv, 기대] of [
    [[], {}], [['--실행'], { 실행: true }], [['--실행', '--json'], { 실행: true, json: true }], [['--일수', '3'], { 일수: 3 }],
    [['--되돌리기', '옛것', '--실행'], { 되돌리기: '옛것', 실행: true }], [['--추이'], { 추이: 14 }], [['--추이', '5', '--json'], { 추이: 5, json: true }],
  ]) assert.deepEqual(자동.인자읽기(argv), { ...빈것, ...기대 }, argv.join(' '));
  assert.deepEqual(자동.인자읽기(['--help', '--모름']), { 도움: true });
  for (const argv of [['--모름'], ['--일수'], ['--일수', '0'], ['--되돌리기'], ['--추이', '0'], ['--추이', '--실행'], ['--되돌리기', '옛것', '--일수', '3'], ['옛것']]) {
    assert.ok(자동.인자읽기(argv).오류, argv.join(' '));
  }
  const 찍은 = [], 알린 = [];
  let 기기 = 0;
  const 주입 = { 찍기: (글) => 찍은.push(글), 알리기: (글) => 알린.push(글), 기기모델: () => { 기기++; return '83F5'; } };
  assert.equal(자동.실행(['--help'], 주입), 0);
  assert.equal(찍은[0], 자동.쓰는법);
  assert.equal(자동.실행(['--실행', '--모름'], 주입), 2);
  assert.match(알린[0], /모르는 인자 --모름 — 아무것도 하지 않았다/);
  assert.equal(기기, 0, '쓰는 법이 틀리면 기기 확인에도 닿지 않는다');
  assert.equal(자동.실행([], { ...주입, 기기모델: () => 'X1' }), 2);
  assert.match(알린[1], /새 노트북\(83F5\)이 아니라서 아무것도 하지 않았다/);
});

test('명령 본체 — 미리 보기는 옮길 것을 글로, --json은 JSON으로, 멈추면 끝 코드 1', () => {
  const 방 = 방만들기('cli');
  try {
    방.만들기('옛것', [['a.txt', 'x']], 10);
    const 새로 = (더 = {}) => { const 찍은 = []; return { 찍은, 주입: { 찍기: (글) => 찍은.push(글), 알리기: () => {}, 기기모델: () => '83F5', 옵션: 방.옵션(더) } }; };
    let { 찍은, 주입 } = 새로();
    assert.equal(자동.실행([], 주입), 0);
    assert.match(찍은[0], /^\[미리 보기\] 7일 넘게 조용한 임시 폴더 1개/);
    assert.match(찍은[0], /- 옛것 · /);
    ({ 찍은, 주입 } = 새로());
    assert.equal(자동.실행(['--json', '--일수', '30'], 주입), 0);
    assert.deepEqual(JSON.parse(찍은[0]).옮길, []);
    ({ 찍은, 주입 } = 새로({ 명령줄들: () => null }));
    assert.equal(자동.실행([], 주입), 1);
    assert.match(찍은[0], /^멈춤: 실행 중인 프로세스 목록을 읽지 못했다/);
    ({ 찍은, 주입 } = 새로());
    assert.equal(자동.실행(['--추이'], 주입), 0);
    assert.equal(찍은[0], '장부가 비어 있다.');
    assert.ok(fs.existsSync(path.join(방.임시, '옛것', 'a.txt')), '실행을 붙이지 않으면 아무것도 옮기지 않는다');
  } finally { 방.치우기(); }
});
