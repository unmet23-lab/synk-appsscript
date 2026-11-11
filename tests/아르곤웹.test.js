'use strict';
// 아르곤웹(tools/아르곤웹.js · tools/아르곤웹.mjs) — 브라우저 · 차례 · 네트워크 없이 인자 · 작업 · 결과 가르기 · 지시문 점검과
// 페이지 스크립트의 지킬 것(읽기는 주소를 옮기지 않는다 · 보내기 직전 표시 · 글 파일은 이름으로)을 본다.
// 올리기 잠금(11-08)은 임시 폴더 · 가짜 ego(node 스크립트) · 살아 있는 남의 프로세스로 실제로 잡고 · 넘겨받고 · 푸는 것까지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const 웹 = require('../tools/아르곤웹.js');
const 오마주 = require('../tools/오마주.js');

const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'argonweb-'));
const 쓰기 = (dir, name, body = 'x') => { const f = path.join(dir, name); fs.writeFileSync(f, body); return f; };

// 필수 문장을 다 갖춘 사람 사진 지시문(10-31 리더 세트 꼴을 줄인 것)
const 좋은 = [
  'The exact same young Korean woman as in the attached reference photo (Image 1): identical face and hairstyle.',
  'She is 24 years old - a mature adult woman, not a teenager.',
  'No brown dots, no freckles and no moles anywhere on her face or neck - only three faint pinkish micro-blemishes exactly as in Image 1 (one beside her nose on her right cheek, two under the left side of her jaw).',
  'Upper body from the waist up, facing the camera, the key light at the upper left.',
  'Skin: real, unretouched skin with clearly visible pores.',
  'No text, letters, logos or watermark anywhere. She is the only person in the photo.',
].join(' ');
const 걸린항목 = (prompt, extra = {}) => 웹.점검한편({ id: 't', prompt, ratio: '', ...extra }).걸림.map((x) => `${x.등급}:${x.항목}`);

test('인자 — --파일은 여러 개, 참거짓 깃발, 값이 없는 깃발은 오류', () => {
  const o = 웹.parseArgs(['보내기', '--파일', 'a.jpg', 'b.txt', '--지시문', 'q.md', '--답', 'o.md', '--두줄', '--이름', 'idol-gg']);
  assert.deepEqual(o._, ['보내기']);
  assert.deepEqual(o.파일, ['a.jpg', 'b.txt']);
  assert.equal(o.지시문, 'q.md');
  assert.equal(o.두줄, true);
  assert.equal(o.이름, 'idol-gg');
  assert.throws(() => 웹.parseArgs(['보내기', '--답']), /값이 없다/);
  assert.throws(() => 웹.parseArgs(['보내기', '--파일', '--답', 'o.md']), /파일이 없다/);
});

test('작업 파일 — 경로는 작업 폴더 기준, promptFile, 기본값(shots · 공간 · 머리)', () => {
  const dir = 임시();
  쓰기(dir, '사진.jpg');
  쓰기(dir, '질문.md', '역할: 지시문 검수자.\n');
  const f = 쓰기(dir, '작업_하나.json', JSON.stringify({ files: ['사진.jpg'], promptFile: '질문.md', out: '답.md' }));
  const j = 웹.작업읽기(f);
  assert.equal(j.이름, '작업_하나');
  assert.deepEqual(j.files, [path.join(dir, '사진.jpg')]);
  assert.equal(j.prompt, '역할: 지시문 검수자.');
  assert.equal(j.out, path.join(dir, '답.md'));
  assert.equal(j.shots, dir);
  assert.equal(j.space, 웹.기본공간);
  assert.equal(j.head, '아르곤 답');
  assert.deepEqual(웹.작업문제(j), []);
  // --공간은 작업 파일보다 앞선다
  assert.equal(웹.작업읽기(f, { 공간: 'pulse-idol-argon-check' }).space, 'pulse-idol-argon-check');
  // 못 읽는 작업 파일은 던지지 않고 문제로
  assert.match(웹.작업문제(웹.작업읽기(path.join(dir, '없음.json'))).join(' '), /작업 파일을 못 읽음/);
});

test('작업 문제 — 없는 파일 · 첨부 10개 넘음 · 4,300자 넘음 · 답 폴더 없음 · 글 파일 이름 겹침 · 빈 지시문', () => {
  const dir = 임시();
  const 사진 = Array.from({ length: 11 }, (_, i) => 쓰기(dir, `컷${i}.jpg`));
  const 문제 = (j) => 웹.작업문제(웹.작업만들기(j, dir, 't')).join(' | ');
  assert.match(문제({ files: ['없는.jpg'], prompt: 'p', out: '답.md' }), /파일이 없다/);
  assert.match(문제({ files: 사진, prompt: 'p', out: '답.md' }), /첨부 11개 — 한 번에 10개까지/);
  assert.match(문제({ files: [], prompt: 'x'.repeat(4301), out: '답.md' }), /지시문 4301자.*4300자를 넘으면/);
  assert.match(문제({ files: [], prompt: 'x'.repeat(4300), out: '답.md' }), /4300자를 넘으면/, '작업 표식까지 더해 잰다 — 보내는 글이 한도를 넘지 않게');
  assert.doesNotMatch(문제({ files: [], prompt: 'x'.repeat(4300 - 웹.표식길이), out: '답.md' }), /넘으면/);
  assert.match(문제({ files: [], prompt: 'p', out: '없는폴더/답.md' }), /답 폴더가 없다/);
  fs.mkdirSync(path.join(dir, '둘'));
  쓰기(dir, '측정.txt');
  쓰기(path.join(dir, '둘'), '측정.md');
  assert.match(문제({ files: ['측정.txt', '둘/측정.md'], prompt: 'p', out: '답.md' }), /글 파일 이름이 겹친다.*측정/);
  assert.match(문제({ files: [], prompt: '  ', out: '답.md' }), /지시문이 비었다/);
  assert.match(문제({ files: [], prompt: 'p' }), /답 파일\)이 없다/);
});

test('할 일 — 답이 있으면 건너뜀, 보냄 표시가 있으면 다시 보내지 않고 읽기(10-29 두 번 보냄)', () => {
  const dir = 임시();
  const j = 웹.작업만들기({ files: [], prompt: 'p', out: '답.md' }, dir, 't');
  assert.equal(웹.할일정하기(j, '보내기'), '보내기');
  assert.equal(웹.할일정하기(j, '읽기'), '읽기');
  fs.writeFileSync(웹.표시경로(j.out), '{}');
  assert.equal(웹.할일정하기(j, '보내기'), '읽기', '표시가 남은 작업은 보내기를 불러도 읽기');
  fs.writeFileSync(j.out, '# 답');
  assert.equal(웹.할일정하기(j, '보내기'), '건너뜀');
  assert.equal(웹.할일정하기(j, '보내기', { 덮어쓰기: true }), '읽기', '덮어쓰기여도 보냄 표시가 있으면 다시 보내지 않는다');
  fs.unlinkSync(웹.표시경로(j.out));
  assert.equal(웹.할일정하기(j, '보내기', { 덮어쓰기: true }), '보내기');
});

test('줄 이름 — 같은 작업이면 같은 이름(내 차례 사이 5분), 밑줄 · 띄어쓰기 없음', () => {
  const a = [{ out: 'C:/x/답_얼굴.md' }, { out: 'C:/x/답_장면.md' }];
  assert.equal(웹.줄이름(a), 웹.줄이름(a));
  assert.match(웹.줄이름(a), /^argonweb-[0-9a-f]{6}$/);
  assert.notEqual(웹.줄이름(a), 웹.줄이름([{ out: 'C:/x/답_다른.md' }]));
  assert.equal(웹.줄이름(a, { 이름: 'idol-gg-argon' }), 'idol-gg-argon');
});

test('페이지 글 — JOB 머리(슬래시 경로 · 계정 번호 · 표시 경로) + 페이지 스크립트, 오마주 영상 작업도 같은 스크립트', () => {
  const j = 웹.작업만들기({ files: ['C:\\a\\대표.jpg', 'C:\\a\\지시문.txt'], prompt: '질문', out: 'C:\\a\\답.md' }, 'C:\\a', 't');
  const s = 웹.페이지글(j, '1', '보내기', '77yuhbs');
  const JOB = JSON.parse(s.split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.equal(JOB.mode, '보내기');
  assert.equal(JOB.u, 1);
  assert.equal(JOB.account, '77yuhbs', '차례가 준 계정 이름을 페이지 스크립트가 화면 계정과 대조한다(11-07)');
  assert.ok(JOB.files.every((f) => !f.includes('\\')), JOB.files.join(','));
  assert.equal(JOB.mark, `${JOB.out}.보냄.json`);
  assert.equal(JOB.space, 웹.기본공간);
  assert.equal(JOB.profile, 'Profile 7', '11-11 다시 로그인 뒤 구글 로그인은 ego 「Profile 7」(유호, 기본)에만 있다');
  assert.notEqual(웹.기본공간, 'synk-argon-web-p2', '11-07~10 공간은 사라진 Profile 2 것이다');
  assert.notEqual(웹.기본공간, 'synk-argon-web', '옛 이름 공간은 「유호」(Profile 1) 그대로 열려 로그아웃 화면이다');
  assert.ok(s.includes('await taskSpace(space, { profileId: profile })'));
  assert.ok(/oldSpace \? await taskSpace\(space\) :/.test(s), '이미 있는 공간에 profileId를 넘기면 ego가 막는다 — 있으면 이름만으로 연다(11-07 두 번째 실행 실패)');
  assert.ok(s.indexOf('listTaskSpaces()') < s.indexOf('await taskSpace('), '공간이 있는지 먼저 본다');
  assert.equal(JSON.parse(웹.페이지글(j, 5, '확인').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, '')).account, '', '계정을 안 주면 대조하지 않는다');
  const oj = 오마주.argonJob(path.join('C:', 'x', 'yt_abc'), path.join('C:', 'x', 'yt_abc', '원본.mp4'), '첫 분석');
  const OJ = JSON.parse(웹.페이지글(oj, 1, '보내기').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.equal(OJ.space, 'synk-homage-argon-p7', '오마주도 11-11 Profile 7 새 공간(옛 -p2는 사라진 Profile 2)');
  assert.equal(OJ.profile, 'Profile 7');
  assert.equal(OJ.files.length, 1);
  assert.match(OJ.out, /아르곤_답\.md$/);
  assert.match(OJ.failShot, /아르곤_실패\.png$/);
  assert.equal(OJ.answerMin, 15);
});

test('결과 가르기 — 받음 · 멈춤 · 보냄(표시가 남음) · 보내기 전 실패 · 탭 없음', () => {
  const 줄 = (...xs) => xs.map((x) => JSON.stringify(x)).join('\n');
  assert.deepEqual(웹.결과가르기(줄({ step: 'sent', url: 'u1' }, { step: 'done', url: 'u1', chars: 3465, out: 'o' }), false), { 결과: '받음', url: 'u1', 글자: 3465 });
  // ego는 console 출력을 표준 오류로 내고 줄 앞뒤에 빈 줄 · 다른 글이 섞인다 — 합친 출력에서 찾는다(10-31 「받음」을 못 보고 다시 보내려 함)
  assert.equal(웹.결과가르기(`\n  ${JSON.stringify({ step: 'done', url: 'u2', chars: 15000 })}  \n[error] 경고 한 줄\n`, false).결과, '받음');
  // 출력이 비어도 이번 실행에 답 파일이 새로 써졌으면 받음
  assert.deepEqual(웹.결과가르기('', false, { 글자: 15352 }), { 결과: '받음', url: '', 글자: 15352 });
  assert.equal(웹.결과가르기(줄({ step: 'fail', kind: '멈춤', why: '로봇 확인 화면(sorry)' }), false).결과, '멈춤');
  const 늦음 = 웹.결과가르기(줄({ step: 'clicking' }, { step: 'sent', url: 'https://g/app/ab12' }, { step: 'fail', kind: '늦음', why: '답이 12분 안에 안 끝남' }), true);
  assert.equal(늦음.결과, '보냄');
  assert.equal(늦음.늦음, true);
  assert.equal(늦음.url, 'https://g/app/ab12');
  // 출력이 없어도(ego가 끊김 · 탭이 닫힘) 표시가 남았으면 보냈을 수 있다 — 다시 보내지 않는다
  const 끊김 = 웹.결과가르기("Unhandled page p4 from p3: about:blank\nego's nodejs process exited with code 1.", true);
  assert.equal(끊김.결과, '보냄');
  assert.match(끊김.까닭, /exited with code 1/);
  assert.equal(웹.결과가르기(줄({ step: 'fail', kind: '실패', why: '모드 단추가 없음(도구 판을 열어도)' }), false).결과, '실패');
  assert.equal(웹.결과가르기(줄({ step: 'fail', kind: '없음', why: '이 지시문을 보낸 대화가 없다' }), false).결과, '없음');
});

test('결과 가르기(11-08) — 사이드바에서 찾아 받음 · 안 보내짐(표시를 옮겼을 때만) · 헷갈림 · 사라짐', () => {
  const 줄 = (...xs) => xs.map((x) => JSON.stringify(x)).join('\n');
  const 찾음 = 웹.결과가르기(줄({ step: 'sidebar', i: 1, 판정: '맞음' }, { step: 'found', via: '사이드바', url: 'https://gemini.google.com/u/1/app/ab12cd34ef56' }, { step: 'done', url: 'https://gemini.google.com/u/1/app/ab12cd34ef56', chars: 2100 }), true);
  assert.deepEqual(찾음, { 결과: '받음', url: 'https://gemini.google.com/u/1/app/ab12cd34ef56', 글자: 2100, 찾음: '사이드바' });
  const 풀림 = 웹.결과가르기(줄({ step: 'unsent', record: 'C:/x/답.md.안보내짐.json' }, { step: 'fail', kind: '안보내짐', why: '사이드바 최근 대화 15개에 없다', record: 'C:/x/답.md.안보내짐.json' }), false);
  assert.deepEqual(풀림, { 결과: '안 보내짐', 까닭: '사이드바 최근 대화 15개에 없다', 기록: 'C:/x/답.md.안보내짐.json' });
  assert.equal(웹.결과가르기(줄({ step: 'fail', kind: '안보내짐', why: 'x' }), true).결과, '보냄', '표시가 그대로 남았으면(옮기기 실패) 보냄 — 다시 보내지 않는다');
  const 헷갈림 = 웹.결과가르기(줄({ step: 'fail', kind: '헷갈림', why: '같은 대화가 2개', urls: ['u1', 'u2'] }), true);
  assert.equal(헷갈림.결과, '헷갈림');
  assert.deepEqual(헷갈림.후보, ['u1', 'u2']);
  assert.equal(헷갈림.보냄, true);
  const 사라짐 = 웹.결과가르기(줄({ step: 'sent', url: 'https://gemini.google.com/u/1/app' }, { step: 'fail', kind: '사라짐', why: '보낸 글이 화면에서 사라지고' }), true);
  assert.equal(사라짐.결과, '보냄');
  assert.equal(사라짐.사라짐, true, '1분 뒤 다시 읽어도 없다 — 바로 다시 읽지 않는다');
  assert.equal(웹.결과가르기(줄({ step: 'fail', kind: '없음', why: '보낸 지 3분 — 20분이 지나야 푼다' }), true).결과, '보냄', '사이드바에 없어도 20분 안이면 표시는 그대로');
});

test('새 답 · 다시 할 일 — 이번 실행에 써진 답만 받음, 실패한 건은 답이 생겼으면 그만 · 표시가 있으면 읽기', () => {
  const dir = 임시();
  const j = { ...웹.작업만들기({ files: [], prompt: 'p', out: '답.md' }, dir, 't'), 할일: '보내기' };
  assert.equal(웹.새답(j.out, Date.now()), null, '답 파일이 없음');
  assert.equal(웹.다시할일(j), '보내기', '보내기 전 실패만 다시 보낸다');
  fs.writeFileSync(웹.표시경로(j.out), '{}');
  assert.equal(웹.다시할일(j), '읽기');
  fs.writeFileSync(j.out, '# 답\n본문');
  assert.equal(웹.다시할일(j), '그만', '답이 생긴 건은 다시 보내지 않는다(10-31 두 번째 시도)');
  assert.deepEqual(웹.새답(j.out, Date.now() - 1000), { 글자: 6 });
  assert.equal(웹.새답(j.out, Date.now() + 60_000), null, '실행 시작 전에 있던 답은 이번 답이 아니다');
});

test('계정 번호 · 파일 종류 — 잡은 줄의 주소에서 /u/번호, 글 파일 칩 이름은 확장자를 뺀다', () => {
  assert.equal(웹.계정번호('gemini-a 77yuhbs https://gemini.google.com/u/1/'), 1);
  assert.equal(웹.계정번호('gemini-b unmet25 https://gemini.google.com/u/5/'), 5);
  assert.equal(웹.계정번호('쥔 줄 없음'), null);
  // 계정 이름은 번호에서 바꾸지 않고 차례 출력의 둘째 칸으로 — 로그인이 바뀌면 순번이 바뀐다(11-07 a /u/4 → /u/1)
  assert.equal(웹.계정이름('gemini-a 77yuhbs https://gemini.google.com/u/1/'), '77yuhbs');
  assert.equal(웹.계정이름('잡음\ngemini-b unmet25 https://gemini.google.com/u/5/\n'), 'unmet25');
  assert.equal(웹.계정이름('쥔 줄 없음'), '');
  assert.equal(웹.종류('A_h1.jpg'), '사진');
  assert.equal(웹.종류('원본.MP4'), '영상');
  assert.equal(웹.종류('지시문_리더세트15_굽기전.txt'), '글');
  assert.equal(웹.칩이름('C:/x/현장노트_gemini사진_굽기전판.txt'), '현장노트_gemini사진_굽기전판');
});

// 페이지 스크립트 조각 — 맨 앞 칸에서 시작하는 정의(const · let)나 갈래(if (mode …) 하나를 다음 맨 앞 칸 정의 앞까지
const 페이지 = () => fs.readFileSync(웹.페이지, 'utf8');
const 덩이 = (s, 머리) => {
  const i = s.indexOf(머리);
  assert.ok(i >= 0, `페이지 스크립트에서 「${머리}」를 찾음`);
  const 뒤 = s.slice(i + 머리.length);
  const m = /\n(?:const |let |if \(mode)/.exec(뒤);
  return s.slice(i, i + 머리.length + (m ? m.index : 뒤.length));
};
const 갈래 = (s) => {
  const 읽기시작 = s.indexOf('if (mode === "읽기") {');
  const 나머지 = s.indexOf('\n} else {', 읽기시작); // 맨 앞 칸의 else — 읽기 갈래 안의 else(들여 씀)는 건너뛴다
  assert.ok(읽기시작 > 0 && 나머지 > 읽기시작, '읽기 · 보내기 갈래를 찾음');
  return { 읽기: s.slice(읽기시작, 나머지), 보내기: s.slice(나머지) };
};

// 11-08 사이드바 찾기가 들어오며 「읽기는 주소를 옮기지 않는다」는 「이미 열린 탭은 옮기지 않는다 — 사이드바 찾기는 제 빈 탭만 옮긴다」로 좁혔다.
// 10-27 대화가 사라진 것은 답이 생기는 중인 탭을 옮겨서였다 — 그 탭은 여전히 화면만 읽는다.
test('페이지 스크립트 — 읽기는 열린 탭을 옮기거나 누르지 않는다(사이드바 찾기는 빈 탭 하나로만), 보내기는 빈 탭 · 누르기 직전 표시', () => {
  const s = 페이지();
  const AsyncFunction = (async () => {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(s), '페이지 스크립트 문법');
  const { 읽기, 보내기 } = 갈래(s);
  const 탭찾기 = 읽기.slice(0, 읽기.indexOf('await 사이드바에서읽기('));
  assert.ok(탭찾기.length > 200 && 탭찾기.includes('await task.pages()'), '읽기 ① 탭 찾기 갈래를 찾음');
  assert.doesNotMatch(탭찾기, /\.goto\(|\.click\(|\.reload\(|newPage\(|빈탭\(|첫화면\(|대화열기\(/, '① 열린 탭은 옮기거나 새로 고치지 않고 화면만 읽는다(10-27 대화가 사라짐)');
  for (const 이름 of ['const waitAnswer = async', 'const finish = async', 'const 보낸글읽기 = ', 'const answerNow = ']) {
    assert.doesNotMatch(덩이(s, 이름), /\.goto\(|\.click\(|\.reload\(/, `${이름} — 열린 탭에서 부르는 것은 주소를 옮기지 않는다`);
  }
  // 주소를 옮기는 곳은 첫화면 · 대화열기 둘뿐이고, 둘 다 빈탭()으로 받은 탭에서만 돈다
  const 옮김 = [...s.matchAll(/\.goto\(/g)].map((m) => m.index);
  const 첫화면 = 덩이(s, 'const 첫화면 = async () => {');
  const 대화열기 = 덩이(s, 'const 대화열기 = async (c) => {');
  for (const i of 옮김) assert.ok([첫화면, 대화열기].some((d) => i >= s.indexOf(d) && i < s.indexOf(d) + d.length), '주소 옮기기는 첫화면 · 대화열기 안에서만');
  assert.deepEqual([...s.matchAll(/^\s*page = (.+);/gm)].map((m) => m[1]).sort(), ['await 빈탭()', 'await 빈탭()', '고른탭.p'].sort(), 'page는 빈탭()이나 ① 탭 찾기가 고른 탭으로만');
  const 사이드바 = 덩이(s, 'const 사이드바에서읽기 = async (markId, claimed) => {');
  const 빈탭자리 = 사이드바.indexOf('page = await 빈탭()');
  assert.ok(빈탭자리 > 0 && 빈탭자리 < 사이드바.indexOf('await 첫화면()') && 빈탭자리 < 사이드바.indexOf('대화열기('), '사이드바 찾기는 빈 탭을 받은 뒤에만 연다');
  assert.ok(사이드바.indexOf('if (!표시) await fail(') < 빈탭자리, '사이드바는 보냄 표시가 있을 때만 본다');
  assert.ok(사이드바.indexOf('표시.공간 !== space') < 빈탭자리 && 사이드바.indexOf('표시계정(표시, u, account)') < 빈탭자리, '보낸 공간 · 계정이 다르면 열지 않는다');
  // 빈 탭만 다시 쓴다(보내기 · 확인 · 사이드바 찾기)
  const 빈탭 = 덩이(s, 'const 빈탭 = async () => {');
  const 재사용 = 빈탭.split('\n').find((l) => l.includes('about:blank')) || '';
  assert.match(재사용, /about:blank/, '다시 쓰는 탭은 빈 탭뿐');
  assert.match(재사용, /new-\?tab/, 'ego의 빈 탭은 chrome://new-tab-page/로 보인다(10-31)');
  assert.doesNotMatch(재사용, /gemini|\/app/, '일반 빈 탭은 바로 재사용, Gemini 첫 화면은 별도로 검사');
  assert.match(빈탭, /return await task\.newPage\(\)/, '빈 탭이 없으면 새 탭');
  // 보내기 — 빈 탭에서 첫 화면(계정 대조) → 누르기 직전 표시 → 보내기
  assert.match(보내기, /^\n\} else \{\r?\n\s*page = await 빈탭\(\);/, '보내기 · 확인은 빈 탭 — 답이 생기는 중인 탭을 옮기지 않는다');
  assert.ok(보내기.indexOf('await 첫화면()') < 보내기.indexOf('await writeMark(null)'), '계정 대조(첫화면)는 올리기 · 보내기 전에');
  assert.ok(보내기.indexOf('await writeMark(null)') < 보내기.indexOf('page.click(\'loc=css:[aria-label="메시지 보내기"]\''), '보내기를 누르기 전에 표시를 쓴다');
  assert.match(s, /const chipN = files\.filter\(\(f\) => kind\(f\) !== "글"\)\.length/, '「첨부파일 닫기」로는 사진 · 영상만 센다(10-31 글 칩)');
  assert.match(s, /insertText\("\."\)/, '빈 입력창 모드 단추(10-31) — 「.」을 먼저 넣는다');
  assert.doesNotMatch(s, /\/u\/4\//, '계정 번호는 JOB.u로만');
  // 11-07 계정 대조 · 확인 모드 — 계정이 다르면 올리기 전에 멈추고, 확인은 화면만 열고 닫는다
  const 확인 = s.slice(s.indexOf('if (mode === "확인") {'), s.indexOf('} else {', s.indexOf('if (mode === "확인") {')));
  assert.ok(확인.length > 20, '확인 갈래를 찾음');
  assert.match(첫화면, /for \(let i = 0; i < 45; i\+\+\) \{ await page\.waitForTimeout\(2000\); if \(\/sorry\/\.test\(await page\.url\(\)/, '첫 화면 기다림은 바퀴마다 sorry 주소부터 본다(11-07 26분 쥠)');
  assert.doesNotMatch(확인, /메시지 보내기|파일 업로드|writeMark|insertText/, '확인은 올리거나 보내지 않는다');
  assert.ok(s.indexOf('계정이 ${account}가 아님') > 0 && s.indexOf('계정이 ${account}가 아님') < s.indexOf('await writeMark(null)'), '계정 대조는 올리기 · 보내기 전에');
});

test('페이지 스크립트 — 사이드바 찾기: 대화 링크는 정확한 호스트 · 경로만, 헷갈리면 멈추고, 표시는 판단 · 기록 뒤에만 옮긴다', () => {
  const s = 페이지();
  const 링크 = 덩이(s, 'const 사이드바링크 = async (깊이) => {');
  assert.match(링크, /t\.host === "gemini\.google\.com"/, '다른 호스트 링크(계정 메뉴의 로그아웃 옵션)는 안 고른다(10-25)');
  assert.ok(링크.includes('new RegExp(`^/u/${n}/app/([0-9a-f]+)$`)'), '경로가 정확히 /u/<같은 계정>/app/<번호>인 것만');
  const 열기 = 덩이(s, 'const 대화열기 = async (c) => {');
  assert.match(열기, /t\.host === "gemini\.google\.com" && t\.pathname === p/, '누르는 링크도 같은 호스트 · 같은 경로만');
  assert.match(열기, /page\.goto\(`https:\/\/gemini\.google\.com\$\{c\.path\}`/, '주소로 열 때도 Gemini 대화 주소만');
  assert.match(열기, /지금표 === 앞글/, '앞 대화 글이 남은 화면을 새 대화로 읽지 않는다');
  assert.ok(열기.indexOf('if (/sorry/.test(pu)) return { sorry: true') < 열기.indexOf('await page.goto('), '누른 뒤 로봇 확인이면 주소로 다시 열지 않는다(가짜 Gemini 실측)');
  const 사이드바 = 덩이(s, 'const 사이드바에서읽기 = async (markId, claimed) => {');
  assert.match(사이드바, /Date\.now\(\) - 보낸때\(표시\) >= releaseAfter \? 15 : 8/, '최근 대화는 20분 안 8개 · 지나면 15개까지');
  assert.match(사이드바, /!claimed\.has\(l\.id\)/, '이 묶음의 다른 작업이 쓴 대화는 후보에서 뺀다');
  assert.match(사이드바, /i > 찾음\.i \+ 2/, '찾은 뒤 둘 더 보고 같은 대화가 또 있으면 멈춘다');
  const 적기 = 사이드바.indexOf('await writeMark(찾음.url');
  for (const 막음 of ['if (같음.length) await fail(', 'if (J.twins && !찾음.표시) await fail(', '대화견주기(다시.qs, 기대) !== "맞음"']) {
    assert.ok(사이드바.indexOf(막음) > 0 && 사이드바.indexOf(막음) < 적기, `헷갈림은 표시에 주소를 적기 전에: ${막음}`);
  }
  assert.ok(적기 < 사이드바.indexOf('log({ step: "found"') && 사이드바.indexOf('log({ step: "found"') < 사이드바.indexOf('await waitAnswer(찾음.url'), '찾은 주소를 표시 · 단계에 남긴 뒤 답을 읽는다');
  const 판단 = 사이드바.indexOf('표시풀까(표시, Date.now(), 본, releaseAfter)');
  const 기록 = 사이드바.indexOf('await fs.writeFile(unsentMark');
  const 지움 = 사이드바.indexOf('await fs.unlink(mark)');
  assert.ok(사이드바.indexOf('if (비슷함.length) await fail(') < 판단 && 판단 < 기록 && 기록 < 지움, '헷갈림 → 풀기 판단 → 「안 보내짐」 기록 → 표시 지움 차례');
  assert.ok(사이드바.indexOf('"안보내짐"', 지움) > 지움, '옮긴 뒤 「안보내짐」으로 끝낸다');
  assert.match(사이드바, /if \(e\.kind !== "멈춤"\) await page\.close\(\)/, '찾기 탭은 닫고, 로봇 확인 화면만 남긴다');
  assert.equal((s.match(/fs\.unlink\(mark\)/g) || []).length, 3, '표시를 지우는 곳은 받았을 때 · 보내기가 안 먹었을 때 · 사이드바까지 보고 옮길 때뿐');
  const 기다림 = 덩이(s, 'const waitAnswer = async');
  assert.match(기다림, /if \(사라짐 >= 3\) await fail\(.*, "사라짐"\);/, '보낸 글이 사라지고 새 채팅으로 돌아가면 12분을 기다리지 않는다(11-07 그림 8장)');
  assert.match(기다림, /사라짐 = r\.uqN === 0 && !busy && !text && /, '사라짐은 보낸 글 0 · 멈춤 단추 없음 · 답 글 없음이 함께일 때만');
  assert.match(기다림, /고정 = text && text === last \? 고정 \+ 1 : 0;\s*last = text;/, '글이 그대로인 횟수는 멈춤 단추와 상관없이 세고, last를 바꾸기 전에 센다');
  assert.match(기다림, /if \(busy && 고정 >= 36 && text\.length > 200\) \{ log\(\{ step: "answer-still"/, '멈춤 단추가 남아도 200자 넘는 글이 3분(5초 × 36) 그대로면 끝 — 다 쓴 답을 「늦음」으로 놓치지 않는다(11-11 여섯 번)');
  assert.match(s, /const norm = 글정규화;/, '보낸 글 견주기는 아르곤웹.js와 같은 함수');
  assert.match(s, /const promptHead = norm\(prompt\)\.slice\(0, 40\);/, '표시의 지시문앞은 그대로 정규화 앞 40자');
});

// ── 보낸 대화 알아보기 · 표시 풀기 판단(페이지 스크립트에 그대로 들어가는 함수) ──

// 미학맹검 꼴 — 긴 틀 + 화면 목록 + 답 꼴. 묶음끼리는 화면 목록만 다르다(11-07 · 11-08 「크리에이티브 디렉터의 시각 디자인 평가」)
const 틀 = (화면들) => [
  '너는 세계 최고 수준 광고 에이전시의 크리에이티브 디렉터다. 이 회사 대표의 기준은 이렇다: 「모든 화면이 곧 포트폴리오다.」',
  '',
  '붙인 글 파일 「유호님_기준」은 이 대표가 실제 결과물에 한 지적을 점검 질문으로 모은 것이다.',
  '',
  `아래 화면 ${화면들.length}장을 하나씩 따로 판정해라. 화면마다:`,
  '- 판정: 「그대로 냄」 · 「고쳐서 냄」 · 「기각」 중 하나',
  '- 점수: 1~10',
  '',
  '화면 목록(붙인 파일 이름이 화면 번호다)',
  ...화면들.map((n) => `- ${n}: 가상 러닝화 광고의 끝 화면(9:16)`),
  '',
  '답은 JSON 한 덩이만, 앞뒤 설명 없이:',
  '{"낱장":[{"번호":"01","판정":"그대로 냄|고쳐서 냄|기각","점수":0}]}',
].join('\n');
// Gemini가 그리는 보낸 글 — 「말씀하신 내용」 · 칩 이름 · 앞 몇 줄 줄임 뒤에 전체 글, 목록 번호 · 기호 · 빈 줄이 달라질 수 있다
const 그린글 = (지시문) => `말씀하신 내용 유호님_기준 MD ${지시문.slice(0, 50)} …\n\n${지시문.replace(/\n\n/g, '\n\n\n\n').replace(/^- /gm, '')}\nexpand_more`;

test('글정규화 · 대화견주기 — 지시문 전체 · 그림 수로 맞음, 같은 틀의 다른 묶음은 앞머리, 같은 지시문 다른 그림 수는 첨부다름', () => {
  assert.equal(웹.글정규화('1. 첫째\n2. 둘째 — **굵게** `코드` - 줄 | 칸 > 인용 # 머리'), '첫째둘째—굵게코드줄칸인용머리');
  const 앞 = 틀(['01', '02', '03', '04']);
  const 뒤 = 틀(['05', '06', '07', '08']);
  const 기대 = { 지시문: 앞, 그림: 4, 글: 1 };
  assert.equal(웹.글정규화(앞).slice(0, 40), 웹.글정규화(뒤).slice(0, 40), '두 묶음은 표시의 「지시문앞」(40자)이 같다 — 앞머리로는 못 가린다');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 4 }], 기대), '맞음');
  assert.equal(웹.대화견주기([{ 글: 그린글(뒤), 그림: 4 }], 기대), '앞머리', '같은 틀 · 다른 화면 목록은 이 작업이 아니다(표시를 풀 때 막지도 않는다)');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 8 }], 기대), '첨부다름', '같은 지시문을 8장으로 보낸 대화(11-07)');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 5 }], 기대), '맞음', '글 파일 칩 아이콘 하나만큼은 여유');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 0 }], 기대), '맞음', '그림을 못 세면(0) 지시문으로만');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 3 }], { ...기대, 그림: null }), '맞음', '영상 작업은 그림 수를 안 본다');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞.slice(0, Math.floor(앞.length * 0.6))), 그림: 4 }], 기대), '잘림', '앞은 맞고 거기서 끝난다 — 줄여 그렸을 수 있다');
  // 끝 줄이 짧은 틀(화면 목록이 맨 끝 가까이) — 끝 40자로 가르면 다른 묶음도 「잘림」이 되어 표시를 못 풀었다(가짜 Gemini 실측)
  const 짧은틀 = (화면들) => ['너는 세계 최고 수준 광고 에이전시의 크리에이티브 디렉터다. 이 회사 대표의 기준은 이렇다.', '', '화면 목록', ...화면들.map((n) => `- ${n}: 가상 러닝화 광고의 끝 화면(9:16)`), '', '답은 JSON 한 덩이만:', '{"낱장":[]}'].join('\n');
  const 짧은기대 = { 지시문: 짧은틀(['01', '02', '03', '04']), 그림: 4, 글: 1 };
  assert.equal(웹.대화견주기([{ 글: 그린글(짧은틀(['05', '06', '07', '08'])), 그림: 4 }], 짧은기대), '앞머리', '갈라진 뒤 남의 화면 목록이 길게 이어진다 — 다른 묶음');
  assert.equal(웹.대화견주기([{ 글: 그린글(짧은틀(['01', '02', '03', '09'])), 그림: 4 }], 짧은기대), '잘림', '맨 끝 몇 자만 다르면 줄여 그린 것과 못 가른다 — 막는 쪽으로');
  assert.equal(웹.대화견주기([{ 글: '말씀하신 내용 오늘 날씨 알려 줘', 그림: 0 }], 기대), '다름');
  assert.equal(웹.대화견주기([{ 글: '다른 질문', 그림: 0 }, { 글: 그린글(앞), 그림: 4 }], 기대), '맞음', '보낸 글이 여럿이면 하나라도');
  assert.equal(웹.대화견주기([{ 글: 그린글(뒤), 그림: 4 }, { 글: 그린글(앞), 그림: 8 }], 기대), '첨부다름', '여럿이면 더 가까운 쪽');
  assert.equal(웹.대화견주기([], 기대), '다름');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞), 그림: 4 }], { 지시문: '  ', 그림: 4 }), '다름', '빈 지시문은 아무것과도 안 맞춘다');
  assert.equal(웹.대화견주기([{ 글: '1) 첫 줄\n2) 둘째 줄', 그림: 0 }], { 지시문: '1. 첫 줄\n2. 둘째 줄', 그림: 0 }), '다름', '정규화는 「1.」 목록 번호만 걷는다');
  assert.equal(웹.대화견주기([{ 글: '말씀하신 내용 첫 줄\n둘째 **줄**', 그림: 0 }], { 지시문: '1. 첫 줄\n2. 둘째 줄', 그림: 0 }), '맞음', '목록 번호 · 굵게 표시가 빠져 그려져도');
  // 앞머리 40자 뒤는 글자 · 숫자만 — 미학맹검 끝 줄의 곧은 따옴표가 굽은 따옴표로 그려져도 내 대화를 남의 것으로 보지 않는다
  assert.equal(웹.대화견주기([{ 글: 그린글(앞).replace(/"([^"]*)"/g, '“$1”'), 그림: 4 }], 기대), '맞음', '앞머리 뒤 기호만 다르면 같은 지시문');
  assert.ok(그린글(앞).includes('\n03: '), '그린 글에는 목록 기호 없이 「03: 」');
  assert.equal(웹.대화견주기([{ 글: 그린글(앞).replace('\n03: ', '\n07: '), 그림: 4 }], 기대), '앞머리', '숫자 · 글자가 다르면 여전히 다른 지시문');
});

test('보낸때 · 표시계정 — 서울 시각 글, 계정 이름이 있으면 이름으로 · 없으면 번호로', () => {
  assert.equal(웹.보낸때({ 시각: '2026-11-08 03:10:00' }), Date.parse('2026-11-08T03:10:00+09:00'));
  assert.equal(웹.보낸때({ 시각: '깨짐', 파일시각: 1234 }), 1234, '못 읽으면 파일 시각');
  assert.ok(Number.isNaN(웹.보낸때({})));
  assert.ok(Number.isNaN(웹.보낸때(null)));
  assert.deepEqual(웹.표시계정({ 계정: 1, 계정이름: '77yuhbs' }, 1, '77yuhbs'), { 같음: true });
  assert.equal(웹.표시계정({ 계정: 1, 계정이름: '77yuhbs' }, 5, '77yuhbs').같음, true, '로그인이 바뀌어 순번이 달라도 이름이 같으면 같은 계정');
  assert.match(웹.표시계정({ 계정: 1, 계정이름: '77yuhbs' }, 1, 'unmet25').까닭, /77yuhbs/);
  assert.equal(웹.표시계정({ 계정: 4 }, 1, '77yuhbs').같음, false, '이름 없는 옛 표시(11-07 전 /u/4)는 번호로 — 다르면 사이드바를 안 본다');
  assert.equal(웹.표시계정({ 계정: 1 }, 1, '77yuhbs').같음, true);
  assert.equal(웹.표시계정(null, 1, '77yuhbs').같음, false);
});

test('표시풀까 · 풀린기록 — 계정 대조 · 사이드바 · 빈 화면 · 헷갈림 · 20분을 다 넘어야 「안 보내짐」', () => {
  const 서울 = (분전) => new Date(Date.now() - 분전 * 60_000).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
  const 본 = { 계정확인: true, 사이드바: 12, 열어봄: 15, 빈화면: 0, 헷갈림: 0 };
  const 표시 = { 시각: 서울(30), 공간: 웹.기본공간, 계정: 1, 계정이름: '77yuhbs', 대화: null, 지시문앞: 'x', 답: 'C:/x/답.md', 파일시각: 1 };
  const 풀림 = 웹.표시풀까(표시, Date.now(), 본, 웹.풀기기다림);
  assert.equal(풀림.풀기, true);
  assert.match(풀림.까닭, /15개에 없다 · 보낸 지 3\d분/);
  assert.equal(웹.풀기기다림, 20 * 60_000);
  const 안 = (바꿈, 표시바꿈 = {}) => 웹.표시풀까({ ...표시, ...표시바꿈 }, Date.now(), { ...본, ...바꿈 }, 웹.풀기기다림);
  assert.match(안({}, { 시각: 서울(10) }).까닭, /보낸 지 1\d분 — 20분이 지나야/, '보낸 지 20분 안이면 사이드바가 늦게 바뀐 것일 수 있다');
  assert.equal(안({ 계정확인: false }).풀기, false, '화면 계정을 대조하지 않았으면(계정 이름 없이) 안 푼다');
  assert.equal(안({ 사이드바: 0 }).풀기, false, '사이드바가 안 떴으면 안 푼다');
  assert.equal(안({ 빈화면: 1 }).풀기, false, '열어도 글이 안 뜬 대화가 있으면 안 푼다');
  assert.equal(안({ 헷갈림: 2 }).풀기, false, '거의 같은 대화가 있으면 안 푼다');
  assert.equal(안({}, { 시각: '', 파일시각: undefined }).풀기, false, '보낸 때를 모르면 안 푼다');
  assert.equal(웹.표시풀까(null, Date.now(), 본, 웹.풀기기다림).풀기, false);
  const 기록 = 웹.풀린기록(표시, 본, 풀림.까닭, '2026-11-08 04:00:00');
  assert.equal(기록.풀린때, '2026-11-08 04:00:00');
  assert.equal(기록.열어본대화, 15);
  assert.equal(기록.지시문앞, 'x', '표시 내용은 그대로 남긴다');
  assert.ok(!('파일시각' in 기록));
  assert.equal(웹.풀린표시경로('C:/x/답.md'), 'C:/x/답.md.안보내짐.json');
});

test('찾기정보 · 답대화 · 표시읽기 — 다른 작업이 쓴 대화는 빼고, 같은 지시문 · 그림 수인데 대화를 모르는 작업은 쌍둥이로 센다', () => {
  const dir = 임시();
  const 사진 = Array.from({ length: 8 }, (_, i) => 쓰기(dir, `화면${i + 1}.png`));
  const 기준 = 쓰기(dir, '유호님_기준.md', '기준');
  const 작업 = (이름, 그림, 지시문) => 웹.작업만들기({ files: [...그림, 기준], prompt: 지시문, out: `답_${이름}.md` }, dir, 이름);
  const 같은 = 틀(['01', '02', '03', '04']);
  const A = 작업('A', 사진.slice(0, 4), 같은), B = 작업('B', 사진.slice(4), 같은), C = 작업('C', 사진.slice(0, 4), 같은);
  const D = 작업('D', 사진.slice(0, 4), 틀(['09'])), E = 작업('E', 사진, 같은), F = 작업('F', 사진.slice(0, 4), 같은);
  fs.writeFileSync(A.out, '# 아르곤 답 — 2026-11-08 02:23:12\n\n대화: https://gemini.google.com/u/1/app/aaaa1111bbbb2222\n올린 것: …\n\n{}\n');
  fs.writeFileSync(웹.표시경로(B.out), JSON.stringify({ 시각: '2026-11-08 02:30:00', 대화: null }));
  fs.writeFileSync(웹.표시경로(C.out), '{깨짐');
  fs.writeFileSync(웹.표시경로(D.out), JSON.stringify({ 시각: '2026-11-08 02:31:00', 대화: 'https://gemini.google.com/u/1/app/dddd2222eeee3333' }));
  fs.writeFileSync(웹.표시경로(E.out), JSON.stringify({ 시각: '2026-11-08 02:32:00', 대화: null }));
  assert.equal(웹.답대화(A.out), 'aaaa1111bbbb2222');
  assert.equal(웹.답대화(B.out), '', '답이 없음');
  assert.equal(웹.표시읽기(F.out), null, '표시가 없음');
  assert.deepEqual(Object.keys(웹.표시읽기(C.out)), ['파일시각'], '깨진 표시는 파일 시각만');
  assert.equal(웹.표시읽기(D.out).대화, 'https://gemini.google.com/u/1/app/dddd2222eeee3333');
  const 묶음 = [A, B, C, D, E, F];
  const c = 웹.찾기정보(묶음, C);
  assert.deepEqual(c.claimed.sort(), ['aaaa1111bbbb2222', 'dddd2222eeee3333'], 'A의 답 · D의 표시에 적힌 대화는 C 후보가 아니다');
  assert.equal(c.twins, 1, 'B — 같은 지시문 · 그림 4장, 대화 주소 없는 보냄 표시(E는 8장, F는 보낸 적 없음, A는 대화를 앎)');
  assert.equal(웹.찾기정보(묶음, B).twins, 1, 'B 쪽에서도 C(깨진 표시)가 쌍둥이');
  assert.deepEqual(웹.찾기정보([C], C), { claimed: [], twins: 0 }, '혼자면 뺄 것 · 쌍둥이 없음');
  const JOB = JSON.parse(웹.페이지글({ ...C, ...c }, 1, '읽기', '77yuhbs').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.deepEqual(JOB.claimed.sort(), c.claimed);
  assert.equal(JOB.twins, 1);
  assert.equal(JOB.unsentMark, `${JOB.out}.안보내짐.json`);
  assert.equal(JOB.releaseAfterMs, 웹.풀기기다림);
});

test('작업 표식 — 지시문 · 그림 수가 같아도 다른 편 대화를 내 대화로 집지 않는다(11-08 대사바뀜이 목소리되풀이 답을 받음)', () => {
  const JOB글 = (s) => JSON.parse(s.split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  const 지시 = 틀(['01', '02', '03']);
  const dirA = 임시(), dirB = 임시();
  const 작업 = (dir) => 웹.작업만들기({ files: [쓰기(dir, '화면01.jpg'), 쓰기(dir, '화면02.jpg'), 쓰기(dir, '화면03.jpg'), 쓰기(dir, '유호님_기준.md', '기준')], prompt: 지시, out: '답_1.md' }, dir, '작업_1');
  const A = 작업(dirA), B = 작업(dirB);
  assert.equal(A.prompt, B.prompt, '편마다 지시문이 똑같은 것이 이 사고의 전제');

  // 보내기 — 맨 앞에 새 번호를 붙이고 JOB에도 준다(페이지 스크립트가 보냄 표시에 적는다). 보낼 때마다 다른 번호
  const 보낸A = JOB글(웹.페이지글(A, 1, '보내기', '77yuhbs')), 보낸B = JOB글(웹.페이지글(B, 1, '보내기', '77yuhbs'));
  assert.match(보낸A.표식, /^[0-9a-f]{8}$/);
  assert.notEqual(보낸A.표식, 보낸B.표식);
  assert.equal(보낸A.prompt, 웹.표식붙이기(지시, 보낸A.표식));
  assert.ok(보낸A.prompt.endsWith(지시), '지시문 자체는 그대로');
  assert.ok(웹.글정규화(보낸A.prompt).slice(0, 40).includes(보낸A.표식), '번호가 앞머리 40자 안에 있어야 다른 번호 대화가 「다름」이 된다');
  assert.equal(웹.작업만들기({ files: [], prompt: '질문', out: '답.md' }, dirA, 't').prompt, '질문', '작업 파일 · 줄 이름 쪽 지시문은 그대로');

  // 읽기 — 표시의 번호로 견준다. 남의 번호 대화 · 번호 없는 옛 대화는 「다름」, 내 번호 대화만 「맞음」
  fs.writeFileSync(웹.표시경로(B.out), JSON.stringify({ 시각: '2026-11-08 22:37:40', 대화: null, 표식: 보낸B.표식 }));
  const 읽기B = JOB글(웹.페이지글({ ...B, twins: 2 }, 1, '읽기', '77yuhbs'));
  assert.equal(읽기B.표식, 보낸B.표식);
  assert.equal(읽기B.prompt, 보낸B.prompt);
  assert.equal(읽기B.twins, 0, '번호로 갈리니 쌍둥이로 멈추지 않는다');
  const 기대 = { 지시문: 읽기B.prompt, 그림: 3, 글: 1 };
  assert.equal(웹.대화견주기([{ 글: 그린글(보낸A.prompt), 그림: 3 }], 기대), '다름', '다른 편 대화 — 지시문 · 그림 수가 같아도 내 대화가 아니다');
  assert.equal(웹.대화견주기([{ 글: 그린글(지시), 그림: 3 }], 기대), '다름', '번호를 붙이기 전에 보낸 대화');
  assert.equal(웹.대화견주기([{ 글: 그린글(보낸B.prompt), 그림: 3 }], 기대), '맞음');

  // 번호 없는 옛 표시 · 깨진 표시 · 확인은 지시문만으로(그때 보낸 대화에는 번호가 없다), 쌍둥이 검사도 그대로
  fs.writeFileSync(웹.표시경로(A.out), JSON.stringify({ 시각: '2026-11-08 21:41:00', 대화: null }));
  const 옛 = JOB글(웹.페이지글({ ...A, twins: 2 }, 1, '읽기', '77yuhbs'));
  assert.equal(옛.prompt, 지시);
  assert.equal(옛.twins, 2);
  assert.ok(!('표식' in 옛));
  fs.writeFileSync(웹.표시경로(A.out), JSON.stringify({ 시각: '2026-11-08 21:41:00', 표식: '이상한 값' }));
  assert.equal(JOB글(웹.페이지글(A, 1, '읽기', '77yuhbs')).prompt, 지시, '꼴이 다른 번호는 믿지 않는다');
  fs.writeFileSync(웹.표시경로(A.out), '{깨짐');
  assert.equal(JOB글(웹.페이지글(A, 1, '읽기', '77yuhbs')).prompt, 지시);
  fs.unlinkSync(웹.표시경로(A.out));
  assert.equal(JOB글(웹.페이지글(A, 1, '확인', '77yuhbs')).prompt, 지시, '확인은 아무것도 안 보낸다');

  // 페이지 스크립트가 번호를 표시에 적는다 — 읽기로 찾은 주소를 적을 때도 지우지 않게 JOB에서 다시 적는다
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'tools', '아르곤웹.mjs'), 'utf8'), /지시문앞: promptHead, \.\.\.\(J\.표식 \? \{ 표식: J\.표식 \} : \{\}\)/);
});

test('페이지글 — 판단 함수는 소스째 앞에 붙고 그대로 돈다(아르곤웹.js의 다른 이름을 안 쓴다), 전체 글은 문법이 맞다', () => {
  const AsyncFunction = (async () => {}).constructor;
  const j = 웹.작업만들기({ files: ['C:\\a\\화면01.png', 'C:\\a\\기준.md'], prompt: 틀(['01']), out: 'C:\\a\\답.md' }, 'C:\\a', 't');
  for (const mode of ['읽기', '보내기', '확인']) assert.doesNotThrow(() => new AsyncFunction(웹.페이지글(j, 1, mode, '77yuhbs')), `${mode} 글 문법(판단 함수와 페이지 스크립트 이름이 안 겹침)`);
  const 판단 = new Function(`${웹.판단머리()}\nreturn { 글정규화, 대화아이디, 대화견주기, 보낸때, 표시계정, 표시풀까, 풀린기록 };`)();
  const 기대 = { 지시문: 틀(['01', '02']), 그림: 2, 글: 1 };
  assert.equal(판단.대화견주기([{ 글: 그린글(기대.지시문), 그림: 2 }], 기대), '맞음');
  assert.equal(판단.대화견주기([{ 글: 그린글(틀(['03', '04'])), 그림: 2 }], 기대), '앞머리');
  assert.equal(판단.대화아이디('https://gemini.google.com/u/1/app/b349af8369faa0a3'), 'b349af8369faa0a3');
  assert.equal(판단.표시풀까({ 시각: '2026-11-08 01:00:00' }, Date.parse('2026-11-08T01:30:00+09:00'), { 계정확인: true, 사이드바: 3, 열어봄: 3 }, 20 * 60_000).풀기, true);
  assert.equal(판단.글정규화('1. 가 - 나'), 웹.글정규화('1. 가 - 나'));
});

test('그림 4장 넘음 — 보내기 전에 경고만(멈추지 않음: 실존대조 얼굴 조각 5~10장 묶음은 받았다)', () => {
  const dir = 임시();
  const 사진 = Array.from({ length: 10 }, (_, i) => 쓰기(dir, `${String(i + 1).padStart(2, '0')}.jpg`));
  const 글 = ['가.txt', '나.md', '다.json'].map((n) => 쓰기(dir, n));
  const 다섯 = 웹.작업만들기({ files: 사진.slice(0, 5), prompt: 'p', out: '답.md' }, dir, '다섯');
  assert.equal(웹.작업경고(다섯).length, 1);
  assert.match(웹.작업경고(다섯)[0], /그림 5장 — 한 대화 그림 4장까지\(11-07 8장 묶음 실패\) — 나눠 보낸다/);
  assert.deepEqual(웹.작업문제(다섯), [], '경고는 막지 않는다');
  assert.deepEqual(웹.작업경고(웹.작업만들기({ files: [...사진.slice(0, 4), ...글], prompt: 'p', out: '답.md' }, dir, '넷')), [], '글 파일은 그림으로 안 센다');
  assert.equal(웹.작업경고(웹.작업만들기({ files: 사진, prompt: 'p', out: '답.md' }, dir, '열')).length, 1, '실존대조 모델 꼴(얼굴 10장)도 경고만');
  assert.equal(웹.그림셈([...사진.slice(0, 2), 'C:/x/원본.mp4', ...글]), 2, '영상 · 글은 안 센다');
  assert.equal(웹.그림한도, 4);
});

test('지시문 점검 — 필수 문장을 다 갖추면 빠짐 없음', () => {
  assert.deepEqual(걸린항목(좋은), []);
});

test('지시문 점검 — 나이 · 점 · 결 · 글자 · 혼자 빠짐, 넘침, 영상 낱말', () => {
  assert.ok(걸린항목(좋은.replace('She is 24 years old - a mature adult woman, not a teenager.', '')).includes('빠짐:나이'));
  assert.ok(걸린항목(좋은.replace('24 years old', '17 years old')).includes('빠짐:나이'));
  assert.ok(걸린항목(좋은.replace(/No brown dots[^)]*\)\./, '')).includes('빠짐:점'));
  assert.ok(걸린항목(좋은.replace(/No brown dots[^)]*\)\./, 'There are no moles anywhere - never add a mark that is not in Image 1.')).includes('주의:점'),
    '「no moles」 금지뿐이면 허용 목록으로(10-31 새 점)');
  assert.ok(걸린항목(좋은.replace('Skin: real, unretouched skin with clearly visible pores.', '')).includes('빠짐:결'));
  assert.ok(!걸린항목(좋은.replace('Skin: real, unretouched skin with clearly visible pores.', 'Seen from directly behind.')).includes('빠짐:결'), '뒷모습은 결을 묻지 않는다');
  assert.ok(걸린항목(좋은.replace('No text, letters, logos or watermark anywhere.', '')).includes('빠짐:글자'));
  assert.ok(걸린항목(좋은.replace('She is the only person in the photo.', '')).includes('빠짐:혼자'));
  assert.ok(!걸린항목(`${좋은.replace('She is the only person in the photo.', '')} Three young women stand together.`).includes('빠짐:혼자'), '단체 컷');
  assert.ok(걸린항목(`${좋은} ${'x'.repeat(4300)}`).includes('넘침:길이'));
  assert.ok(걸린항목(`${좋은} Like a real frame from a smartphone video.`).includes('주의:영상'));
  assert.deepEqual(웹.점검한편({ id: 't', prompt: 'A clean empty studio with a sky-blue paper backdrop.' }).걸림, [], '사람이 없는 그림은 사람 문장을 묻지 않는다');
});

test('지시문 점검 — 지킬 문장과 바꿀 머리 · 핀 · 입 · 눈의 충돌, 지킬 목록 안 조건절은 충돌 아님', () => {
  const 지킴 = 'Also keep her glossy black chin-length bob with eyebrow-length full bangs, and the two small pearl-topped bar hair pins clipped above her right ear.';
  assert.ok(걸린항목(`${좋은} ${지킴} Her hairstyle is different: curtain bangs parted in the middle, no hair pins.`).includes('충돌:충돌'));
  assert.ok(걸린항목(`${좋은} ${지킴} The two hair pins are on the far side of her head, so they are hidden in this view.`).includes('충돌:충돌'));
  assert.ok(걸린항목(`${좋은} Keep her natural cat-like mouth - the corners of her lips turn up on their own. In this photo she is angry, lips pressed tight.`).includes('충돌:충돌'));
  assert.ok(!걸린항목(`${좋은} Keep her clean monolid eyes with no crease, even when she smiles or opens her eyes wide. Natural eye size.`).includes('충돌:충돌'),
    '지킬 목록 안 「even when … opens her eyes wide」는 바꾸라는 말이 아니다(10-31 막내 오탐)');
  assert.ok(걸린항목(`${좋은} Natural eye size. In this photo her eyes opened wide in surprise.`).includes('충돌:충돌'));
  assert.ok(!걸린항목(`${좋은} ${지킴} Same hairstyle.`).includes('충돌:충돌'));
});

test('지시문 점검 — 좌우: 본인 쪽 · 화면 쪽이 분명하면 통과, 「to the left」는 모호', () => {
  assert.deepEqual(웹.모호한좌우('her left cheek is deeper; pins above her right ear (on the left side of the photo); facing the left edge of the frame; key light at the upper left; two under the left side of her jaw; in the lower-left corner'), []);
  assert.equal(웹.모호한좌우('turned about 45 degrees to the left, her face toward the right').length, 2);
  assert.ok(걸린항목(`${좋은} She turns to the right.`).includes('주의:좌우'));
});

test('지시문 점검 — 비율 어긋남, --없이로 뺀다', () => {
  assert.ok(걸린항목(`${좋은} Vertical 9:16 full-length frame.`, { ratio: '3:4' }).includes('주의:비율'));
  assert.ok(!걸린항목(`${좋은} Vertical 9:16 full-length frame.`, { ratio: '9:16' }).includes('주의:비율'));
  const 빠진 = 좋은.replace('She is the only person in the photo.', '');
  assert.deepEqual(웹.점검한편({ id: 't', prompt: 빠진 }, new Set(['혼자'])).걸림, []);
});

test('지시문 읽기 — 작업 JSON 배열 · 이름 붙은 객체 · 「## 컷」 마크다운 · 글 한 편, 그리고 막힘 수', () => {
  const dir = 임시();
  const 배열 = 쓰기(dir, 'set_jobs.json', JSON.stringify([{ id: 'F08_angle-front', ratio: '3:4', prompt: 좋은 }, { id: 'F08_skin', ratio: '3:4', prompt: 좋은.replace('24 years old', 'young') }, { id: '빈', prompt: '' }]));
  assert.deepEqual(웹.지시문읽기(배열).map((x) => x.id), ['F08_angle-front', 'F08_skin']);
  const 객체 = 쓰기(dir, 'map.json', JSON.stringify({ front: 좋은, back: { prompt: 좋은 } }));
  assert.deepEqual(웹.지시문읽기(객체).map((x) => x.id), ['front', 'back']);
  const md = 쓰기(dir, '지시문.txt', `# 세트 — 굽기 전\n\n엔진: 나노바나나 2.1. 쓰임: LoRA 학습 사진.\n\n## angle-front — 정면 상반신\n\n${좋은}\n\n## 메모 — 한국어만\n\n한국어 메모만 있는 칸\n\n## hands — 손\n\n${좋은}\n`);
  assert.deepEqual(웹.지시문읽기(md).map((x) => x.id), ['angle-front', 'hands'], '영어 지시문이 없는 칸 · 머리말은 뺀다');
  const 한편 = 쓰기(dir, '한편.txt', 좋은);
  assert.deepEqual(웹.지시문읽기(한편).map((x) => x.id), ['한편']);
  const r = 웹.점검([배열, md]);
  assert.equal(r.편, 4);
  assert.equal(r.막힘, 1, '나이가 빠진 F08_skin 하나');
});

// ── 올리기 잠금(11-08) ──
// 07:13에 잠금을 쥔 주인(다른 세션의 공모전 영상 검수)이 gemini a · b 줄이 꺼진 07:41~14:22 내내 차례만 기다려, 이 PC의 아르곤 아홉 건이
// 「다른 아르곤웹이 파일을 올리는 중」만 찍었다(10번 전체 검수는 55분 뒤 timeout). 고친 뒤 — 잠금은 차례 뒤 올리기 한 건에만,
// 상한을 넘기면 주인 쪽이 그만두고 풀고(올리기 시간 넘김), 살아 있어도 상한 + 3분을 넘긴 주인은 기다리는 쪽이 치우고 넘겨받는다.

const 지금글 = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const 주인쓰기 = (폴더, 주인) => { fs.mkdirSync(폴더, { recursive: true }); fs.writeFileSync(path.join(폴더, 'owner.json'), JSON.stringify(주인)); };
// 새 판 잠금 — 실제 올리기잠금처럼 <열쇠>.key를 먼저 쓰고 owner.json(판 2)
const 새주인쓰기 = (폴더, 주인) => { fs.mkdirSync(폴더, { recursive: true }); fs.writeFileSync(path.join(폴더, `${주인.열쇠}.key`), ''); fs.writeFileSync(path.join(폴더, 'owner.json'), JSON.stringify({ 판: 2, ...주인 })); };
const 묵히기 = (폴더, 분 = 5) => { const t = new Date(Date.now() - 분 * 60_000); fs.utimesSync(폴더, t, t); };
const 주인읽기 = (폴더) => JSON.parse(fs.readFileSync(path.join(폴더, 'owner.json'), 'utf8'));
const 잠시 = (ms) => new Promise((r) => setTimeout(r, ms));
// 살아 있는데 아무것도 안 하는 주인 — 11-08 pid 25504처럼 잠금만 쥐고 있다
const 산주인 = () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
// 잠금 폴더 · 차례 폴더(막힘 기록 README.md · 줄 주인 owner.txt)를 임시로 두고, 출력은 모아 넘긴다 — 끝나면 설정 · 환경을 되돌린다
const 잠금시험 = async (fn) => {
  const dir = 임시();
  const 앞설정 = { ...웹.설정 };
  const 앞차례 = process.env.SYNK_CHARYE_PY;
  const 원래로그 = console.log;
  const 찍힘 = [];
  process.env.SYNK_CHARYE_PY = path.join(dir, '차례.py');
  Object.assign(웹.설정, { 폴더: path.join(dir, 'upload.lock'), 기록폴더: path.join(dir, 'logs'), 쉼: 25, 살핌: 25 });
  console.log = (...a) => { 찍힘.push(a.join(' ')); };
  try { return await fn(dir, 찍힘); } finally {
    console.log = 원래로그;
    Object.assign(웹.설정, 앞설정);
    if (앞차례 === undefined) delete process.env.SYNK_CHARYE_PY; else process.env.SYNK_CHARYE_PY = 앞차례;
  }
};
// 가짜 ego — 표준 입력 첫 줄의 JOB을 읽고 지시문대로: 「멈춤」은 잠금을 쥔 채 멈추고(11-08 올리기 멈춤), 「누름」은 실제 페이지 스크립트처럼
// 표시를 쓰고 clicking 뒤 잠금을 풀고(열쇠가 같을 때만) 답을 쓴다
const 가짜에고 = (dir) => {
  const f = path.join(dir, 'fake-ego.js');
  fs.writeFileSync(f, [
    "const fs = require('fs');",
    "let s = '';",
    "process.stdin.on('data', (d) => { s += d; });",
    "process.stdin.on('end', () => {",
    "  const J = JSON.parse(s.split('\\n')[0].replace(/^globalThis\\.JOB = /, '').replace(/;$/, ''));",
    "  if (J.표식) J.prompt = J.prompt.slice(J.prompt.indexOf('\\n\\n') + 2);", // 맨 앞 작업 표식을 걷고 지시문대로
    "  if (!J.upload) { console.error(JSON.stringify({ step: 'fail', kind: '없음', why: '가짜 ego — 잠금 없이 불림' })); return; }",
    "  if (J.prompt === '멈춤') { setInterval(() => {}, 1000); return; }",
    "  const 풀기 = () => { try { fs.unlinkSync(J.upload.lock + '/' + J.upload.key + '.key'); } catch { return; } fs.rmSync(J.upload.lock, { recursive: true, force: true }); };",
    "  if (J.prompt === '감시' || J.prompt === '늦은실패') {",
    "    setTimeout(() => {",
    "      console.error(JSON.stringify(J.prompt === '감시' ? { step: 'fail', kind: '올리기넘김', why: '마감까지 보내기 앞에 못 닿음' } : { step: 'fail', kind: '실패', why: '모드 단추가 없음(도구 판을 열어도)' }));",
    "      풀기();",
    "      process.exit(1);",
    "    }, Math.max(0, J.upload.deadline - Date.now()) + (J.prompt === '감시' ? 0 : 50));",
    "    return;",
    "  }",
    "  fs.writeFileSync(J.mark, '{}');",
    "  console.error(JSON.stringify({ step: 'clicking' }));",
    "  풀기();",
    "  setTimeout(() => {",
    "    fs.writeFileSync(J.out, '# 답\\n\\n대화: https://gemini.google.com/u/1/app/ab12cd34ef56\\n\\n' + '답'.repeat(300));",
    "    fs.rmSync(J.mark, { force: true });",
    "    console.error(JSON.stringify({ step: 'done', url: 'https://gemini.google.com/u/1/app/ab12cd34ef56', chars: 300 }));",
    "  }, 200);",
    "});",
  ].join('\n'));
  return `"${process.execPath}" "${f}"`;
};

test('실행기 원문 — exit 1의 긴 stdout · stderr 바이트와 오류 머리 보존, 재시도는 새 폴더, 보냄 표시는 그대로', async () => {
  await 잠금시험(async (dir) => {
    const out = Buffer.from('표준 출력 처음\r\n' + '가나다'.repeat(30000) + '\n출력 끝\n');
    const err = Buffer.from('TypeError: 읽기 원인\n' + '    at somewhere (read.mjs:20:3)\n'.repeat(10000) + "ego's nodejs process exited with code 1.\n");
    fs.writeFileSync(path.join(dir, 'expected-out'), out);
    fs.writeFileSync(path.join(dir, 'expected-err'), err);
    const fake = 쓰기(dir, 'failure.cjs', `const fs = require('fs'); const path = require('path');
      process.stdin.resume(); process.stdin.on('end', () => {
        const out = fs.readFileSync(path.join(__dirname, 'expected-out'));
        const err = fs.readFileSync(path.join(__dirname, 'expected-err'));
        process.stdout.write(out.subarray(0, 1));
        process.stderr.write(err);
        process.stdout.write(out.subarray(1));
        process.exitCode = 1;
      });`);
    웹.설정.에고 = `"${process.execPath}" "${fake}"`;
    const j = 웹.작업만들기({ files: [쓰기(dir, '첫영상.mp4')], prompt: '같은 지시문', out: '답.md' }, dir, 'first');
    const mark = 쓰기(dir, '답.md.보냄.json', '{"대화":"https://gemini.google.com/u/1/app/aaaabbbbccccdddd"}');
    const 원표시 = fs.readFileSync(mark);
    const a = await 웹.한건(j, 1, '읽기', 'acct');
    assert.equal(a.결과, '보냄');
    assert.equal(a.까닭, 'TypeError: 읽기 원인', '마지막 실행기 종료 줄 대신 원래 오류 머리를 보인다');
    assert.equal(a.종료코드, 1);
    assert.deepEqual(fs.readFileSync(a.실행기기록.stdout), out);
    assert.deepEqual(fs.readFileSync(a.실행기기록.stderr), err);
    const meta = JSON.parse(fs.readFileSync(a.실행기기록.실행));
    assert.deepEqual(meta.바이트, { stdout: out.length, stderr: err.length });
    assert.equal(meta.code, 1);
    assert.equal(meta.관닫음, false);
    const b = await 웹.한건(j, 1, '읽기', 'acct');
    assert.notEqual(a.실행기기록.폴더, b.실행기기록.폴더, '재시도는 원본을 덮지 않는다');
    assert.deepEqual(fs.readFileSync(a.실행기기록.stderr), err);
    assert.deepEqual(fs.readFileSync(mark), 원표시, '실패해도 보냄 표시를 안 지운다');
    assert.equal(fs.existsSync(웹.설정.폴더), false, '읽기는 올리기 잠금을 쥐지 않는다');
  });
});

test('실행기 단계 — UTF-8 · JSON이 잘린 채 두 관에서 번갈아 와도 성공 줄을 한 번 읽는다', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    const done = Buffer.from(JSON.stringify({ step: 'done', chars: 321, url: 'https://gemini.google.com/u/1/app/aaaabbbbccccdddd', note: '한글' }) + '\n');
    fs.writeFileSync(path.join(dir, 'done'), done);
    const fake = 쓰기(dir, 'chunks.cjs', `const fs = require('fs'); const path = require('path');
      process.stdin.resume(); process.stdin.on('end', () => {
        const b = fs.readFileSync(path.join(__dirname, 'done')); const cut = b.indexOf(Buffer.from('한')) + 1;
        process.stderr.write(b.subarray(0, cut));
        process.stdout.write('별도 출력\\n');
        setTimeout(() => process.stderr.write(b.subarray(cut)), 30);
      });`);
    웹.설정.에고 = `"${process.execPath}" "${fake}"`;
    const j = 웹.작업만들기({ files: [], prompt: '읽기', out: '답.md' }, dir, 'read');
    const run = await 웹.페이지돌리기(j, 1, '읽기', 'acct');
    assert.equal(웹.결과가르기(run.출력, false).글자, 321);
    assert.deepEqual(fs.readFileSync(run.기록.stderr), done);
    assert.equal(찍힘.filter(l => l.includes('"step":"done"')).length, 1);
    assert.ok(찍힘.some(l => l.includes('한글')));
  });
});

test('같은 지시문 두 영상 읽기 — A 표시 주소로 고르고 B는 A 대화를 제외, 열린 탭 이동 · 업로드 없이 각 답을 받는다', async () => {
  const dir = 임시();
  const prompt = '두 영상에 똑같이 쓴 지시문. 실제로 들은 소리와 빠르기를 적어 달라.';
  const jobs = ['A', 'B'].map(n => 웹.작업만들기({ files: [쓰기(dir, `${n}.mp4`)], prompt, out: `${n}.md` }, dir, n));
  const urls = ['https://gemini.google.com/u/1/app/aaaabbbbccccdddd', 'https://gemini.google.com/u/1/app/eeeeffff00001111'];
  jobs.forEach((j, i) => 쓰기(dir, `${j.이름}.md.보냄.json`, JSON.stringify({ 시각: '2026-11-08 15:31:37', 공간: j.space, 계정: 1, 대화: i ? null : urls[0] })));
  const old = { taskSpace: globalThis.taskSpace, listTaskSpaces: globalThis.listTaskSpaces, JOB: globalThis.JOB, log: console.log };
  const closed = [];
  const pages = jobs.map((j, i) => ({
    url: async () => urls[i], info: async () => ({}), waitForTimeout: async () => {},
    close: async () => { closed.push(i); },
    goto: async () => assert.fail('열린 대화는 이동하면 안 된다'),
    click: async () => assert.fail('읽기는 누르면 안 된다'),
    evaluate: async fn => fn.toString().includes('model-response')
      ? { text: `${j.이름} 영상의 소리. `.repeat(30), busy: false, uqN: 1, path: new URL(urls[i]).pathname }
      : [{ 글: prompt, 그림: 1 }],
  }));
  globalThis.listTaskSpaces = async () => [{ name: jobs[0].space, profileId: 웹.기본프로필 }];
  // A의 같은 대화가 두 탭에 열린 경우: 하나를 닫아도 다른 A 탭이 남는다. B에서 claimed를 빼면 A · B 둘이 맞아 실패한다.
  const aCopy = { ...pages[0], close: async () => { closed.push('A-copy'); } };
  globalThis.taskSpace = async () => ({ pages: async () => [...pages.filter((p, i) => !closed.includes(i)), ...(!closed.includes('A-copy') ? [aCopy] : [])], newPage: async () => assert.fail('열린 답이 있는데 새 탭을 열면 안 된다') });
  console.log = () => {};
  try {
    const run = (async () => {}).constructor;
    assert.equal(웹.찾기정보(jobs, jobs[0]).twins, 1, '주소 없는 B를 같은 지시문 작업으로 센다');
    for (const j of jobs) await new run(웹.페이지글({ ...j, ...웹.찾기정보(jobs, j) }, 1, '읽기', 'acct'))();
    assert.match(fs.readFileSync(jobs[0].out, 'utf8'), /A 영상의 소리/);
    assert.doesNotMatch(fs.readFileSync(jobs[0].out, 'utf8'), /B 영상의 소리/);
    assert.match(fs.readFileSync(jobs[1].out, 'utf8'), /B 영상의 소리/);
    assert.doesNotMatch(fs.readFileSync(jobs[1].out, 'utf8'), /A 영상의 소리/);
    assert.deepEqual(closed, ['A-copy', 1]);
    for (const j of jobs) assert.equal(fs.existsSync(웹.표시경로(j.out)), false);
  } finally {
    globalThis.taskSpace = old.taskSpace; globalThis.listTaskSpaces = old.listTaskSpaces; globalThis.JOB = old.JOB; console.log = old.log;
  }
});

test('같은 지시문 두 영상의 사이드바 읽기 — 8개 탭 한도에서 빈 Gemini를 재사용해 A 답을 받고, 사라진 B에 A 답을 복사하지 않는다', async () => {
  const dir = 임시();
  const prompt = '첨부한 영상을 실제로 듣고 소리의 장르와 특징을 적어 달라. 두 작업의 지시문은 같다.';
  const jobs = ['A', 'B'].map(n => 웹.작업만들기({ files: [쓰기(dir, `${n}.mp4`)], prompt, out: `${n}.md` }, dir, n));
  const url = 'https://gemini.google.com/u/1/app/aaaabbbbccccdddd';
  const sent = new Date(Date.now() - 60 * 60_000).toISOString();
  // 보낸때는 서울 글 또는 파일 시각을 쓴다. 여기서는 파일 시각을 한 시간 전으로 두어 표시 풀기 조건을 실제로 지난다.
  for (const [i, j] of jobs.entries()) {
    const mark = 쓰기(dir, `${j.이름}.md.보냄.json`, JSON.stringify({ 공간: j.space, 계정: 1, 계정이름: 'acct', 대화: i ? null : url }));
    fs.utimesSync(mark, new Date(sent), new Date(sent));
  }
  let current = 'https://gemini.google.com/u/1/app';
  const visited = [], closed = [], steps = [];
  const old = { taskSpace: globalThis.taskSpace, listTaskSpaces: globalThis.listTaskSpaces, JOB: globalThis.JOB, log: console.log };
  const link = { innerText: 'A 영상 대화', getAttribute: n => n === 'href' ? url : null, getBoundingClientRect: () => ({ width: 100, height: 20 }), setAttribute: () => {}, parentElement: null };
  const q = { innerText: prompt, querySelectorAll: () => [] };
  const doc = {
    body: { innerText: '' },
    querySelector: s => s.includes('Gemini 프롬프트 입력') ? { innerText: '' } : null,
    querySelectorAll(s) {
      if (s === 'button') return [{ getAttribute: () => '모드 선택 도구 열기, 현재 Argon 높음 모드 사용 중' }];
      if (s === '[aria-label]') return [{ getAttribute: () => 'Google 계정: acct@example.test' }];
      if (s === 'user-query') return current === url ? [q] : [];
      if (s === 'model-response') return current === url ? [{ innerText: 'A 영상 답. '.repeat(40) }] : [];
      if (s === 'a[href]' || s === 'a[href*="/app/"]') return [link];
      return [];
    },
  };
  const page = {
    url: async () => current, info: async () => ({}), cdp: async () => ({ windowId: 1, bounds: { windowState: 'normal' } }),
    goto: async target => { current = target; visited.push(target); },
    click: async () => { current = url; visited.push(url); },
    waitForTimeout: async () => {}, close: async () => closed.push(current), screenshot: async () => {},
    evaluate: async (fn, arg) => new Function('document', 'location', 'arg', `return (${fn.toString()})(arg);`)(doc, { href: current, pathname: new URL(current).pathname }, arg),
  };
  globalThis.listTaskSpaces = async () => [{ name: jobs[0].space, profileId: 웹.기본프로필 }];
  const 남의탭 = Array.from({ length: 7 }, () => ({ url: async () => 'https://gemini.google.com/u/1/app', evaluate: async () => [], close: async () => assert.fail('다른 작업 탭을 닫음'), goto: async () => assert.fail('다른 작업 탭을 옮김') }));
  // 일곱 탭은 초안이 있어 재사용 불가. 여덟째만 빈 시작 화면이며, 닫고 나면 다음 읽기의 새 탭 한 자리가 난다.
  for (const p of 남의탭) p.evaluate = async fn => fn.toString().includes('const ed =') ? false : [];
  globalThis.taskSpace = async () => ({
    pages: async () => closed.length ? 남의탭 : [...남의탭, page],
    newPage: async () => { if (!closed.length) throw new Error('PageBudgetError: Page budget reached (8/8)'); current = 'about:blank'; return page; },
  });
  console.log = s => steps.push(JSON.parse(s));
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(웹.페이지글({ ...jobs[0], ...웹.찾기정보(jobs, jobs[0]) }, 1, '읽기', 'acct'))();
    assert.match(fs.readFileSync(jobs[0].out, 'utf8'), /A 영상 답/);
    assert.ok(steps.some(s => s.step === 'found' && s.via === '표시 주소'));
    assert.ok(steps.some(s => s.step === 'reuse-empty'), '한도 8/8에서도 새 탭을 만들지 않고 A를 읽었다');
    const visitsBeforeB = visited.filter(v => v === url).length;
    await assert.rejects(new AsyncFunction(웹.페이지글({ ...jobs[1], ...웹.찾기정보(jobs, jobs[1]) }, 1, '읽기', 'acct'))(), e => e.kind === '안보내짐');
    assert.equal(visited.filter(v => v === url).length, visitsBeforeB, 'B 읽기는 A의 사이드바 대화를 열지 않는다');
    assert.equal(fs.existsSync(jobs[1].out), false, 'B 답이 없으면 A 답으로 채우지 않는다');
    assert.equal(fs.existsSync(웹.풀린표시경로(jobs[1].out)), true, 'B 표시를 풀더라도 원래 기록은 남는다');
    assert.equal(closed.length, 2);
  } finally {
    globalThis.taskSpace = old.taskSpace; globalThis.listTaskSpaces = old.listTaskSpaces; globalThis.JOB = old.JOB; console.log = old.log;
  }
});

test('빈 Gemini 재사용 — 초안 · 첨부 · 대화 · 진행 중 · 다른 계정 · 화면 읽기 실패는 그대로 두고, 안전한 빈 탭이 없으면 한도를 보존한다', async () => {
  const AsyncFunction = (async () => {}).constructor;
  const run = new AsyncFunction('task', 'u', 'log', `${덩이(페이지(), 'const 빈탭 = async () => {')}\nreturn await 빈탭();`);
  const make = (state = {}) => ({
    url: async () => state.url ?? 'https://gemini.google.com/u/1/app',
    evaluate: async fn => {
      if (state.error) throw new Error('화면 읽기 실패');
      const doc = {
        querySelector: () => state.noEditor ? null : { innerText: state.draft || '' },
        querySelectorAll: s => s === 'user-query, model-response' ? (state.conversation ? [{}] : [])
          : s.includes('contenteditable') ? [{ innerText: state.draft || '' }]
          : s === 'button' ? (state.buttons || []).map(label => ({ getAttribute: () => label }))
          : s.includes('progressbar') ? [{ getBoundingClientRect: () => ({ width: state.busy ? 20 : 0, height: state.busy ? 20 : 0 }) }] : [],
      };
      return new Function('document', `return (${fn.toString()})();`)(doc);
    },
    close: async () => assert.fail('기존 탭을 닫음'), goto: async () => assert.fail('기존 탭을 옮김'),
  });
  const blocked = [{ draft: '.' }, { buttons: ['첨부파일 닫기'] }, { buttons: ['메시지 보내기'] },
    { buttons: ['대답 생성 중지'] }, { conversation: true }, { busy: true }, { noEditor: true }, { error: true },
    { url: 'https://gemini.google.com/u/5/app' }, { url: 'https://gemini.google.com/u/1/app/abcdef' }, { url: '' }].map(make);
  const budget = new Error('PageBudgetError: Page budget reached (8/8)');
  const task = { pages: async () => blocked, newPage: async () => { throw budget; } };
  await assert.rejects(run(task, 1, () => {}), e => e === budget, '빈 탭이 없을 때 남의 탭을 덮지 않는다');
  const safe = make();
  assert.equal(await run({ ...task, pages: async () => [...blocked, safe] }, 1, () => {}), safe, '숨은 사이드바 spinner만 있는 빈 Gemini는 재사용');
  const blank = make({ url: 'about:blank', error: true });
  assert.equal(await run({ ...task, pages: async () => [blank] }, 1, () => {}), blank, '일반 빈 탭은 DOM 검사 없이 사용');
});

test('올리기 잠금 — 멈춘 주인 판단: 죽은 pid · 살아 있어도 상한 + 3분 넘김 · 줄 없이 쥔 옛 판은 치우고, 상한 안 · 줄을 쥔 옛 판 · 못 읽음은 기다린다', () => {
  const 지금 = Date.parse('2026-11-08T14:30:00+09:00');
  const 분 = 60_000;
  const 새 = (상한분) => ({ pid: 1, 이름: 'argonweb-aaa', 시각: new Date(지금 - 20 * 분).toISOString(), 상한: new Date(지금 + 상한분 * 분).toISOString(), 열쇠: 'k', 판: 2 });
  assert.deepEqual(웹.멈춘주인(새(5), 지금, { 살아있음: false }), { 치움: true, 멈춤: false, 까닭: '주인 pid 1가 없다' }, '주인 pid가 없으면 상한 안이어도 바로');
  assert.equal(웹.멈춘주인(새(5), 지금, { 살아있음: true }).치움, false, '상한 안 — 올리는 중');
  assert.equal(웹.멈춘주인(새(-2), 지금, { 살아있음: true }).치움, false, '상한을 넘긴 지 2분 — 주인이 스스로 그만두고 푸는 틈(끄기여유 1분 + 남는 틈)');
  const 멈춤 = 웹.멈춘주인(새(-4), 지금, { 살아있음: true });
  assert.deepEqual([멈춤.치움, 멈춤.멈춤], [true, true], '살아 있는데 상한 + 3분을 넘김 — 멈춘 주인');
  assert.match(멈춤.까닭, /살아 있지만 올리기 상한\(14:26\)을 4분 넘김/);
  // 11-08 앞 판(상한 · 열쇠 없음 — 차례를 기다리는 동안에도 쥔다): 올리기는 gemini 줄을 쥐었을 때만 하니 번호표로 기다리는 중이면 올리는 중일 수 없다
  const 옛 = { pid: 25504, 이름: 'argonweb-779816', 시각: '2026-11-07T22:13:56.003Z' };
  const 줄섬 = 웹.멈춘주인(옛, 지금, { 살아있음: true, 줄: '줄섬' });
  assert.deepEqual([줄섬.치움, 줄섬.멈춤], [true, true]);
  assert.match(줄섬.까닭, /번호표로 차례를 기다리는 중/);
  assert.equal(웹.멈춘주인(옛, 지금, { 살아있음: true, 줄: { 줄: 'gemini-a', 시각: 지금 - 5 * 분 } }).치움, false, '줄을 쥔 옛 판 — 올리는 중일 수 있다');
  assert.equal(웹.멈춘주인(옛, 지금, { 살아있음: true, 줄: { 줄: 'gemini-a', 시각: 지금 - 80 * 분 } }).치움, true, '줄을 75분 넘게 쥔 옛 판은 멈춘 것');
  assert.equal(웹.멈춘주인(옛, 지금, { 살아있음: true, 줄: '모름' }).치움, false, '줄 주인 · 번호표를 못 읽으면 치우지 않는다');
  // 줄도 번호표도 없는 옛 판 — --차례없이(부르는 쪽이 다른 이름으로 차례를 쥠)로 올리는 중일 수 있어 잠금을 잡은 지 60분이 넘어야(11-08 GPT 검수 GA4)
  const 갓잡은 = { ...옛, 시각: new Date(지금 - 20 * 분).toISOString() };
  assert.equal(웹.멈춘주인(갓잡은, 지금, { 살아있음: true, 줄: null }).치움, false, '줄 · 번호표 없이 20분 — --차례없이로 올리는 중일 수 있다');
  const 오래 = 웹.멈춘주인({ ...옛, 시각: new Date(지금 - 61 * 분).toISOString() }, 지금, { 살아있음: true, 줄: null });
  assert.deepEqual([오래.치움, 오래.멈춤], [true, true]);
  assert.match(오래.까닭, /줄 · 번호표 없이 잠금을 61분째/);
  // 새 판인데 열쇠 파일이 없다 — 열쇠를 먼저 쓰니 푸는 중이거나 열쇠만 지우고 끊긴 잠금(2분 묵으면 치움)
  assert.equal(웹.멈춘주인(새(5), 지금, { 살아있음: true, 열쇠없음: true, 폴더나이: 30_000 }).치움, false, '막 푸는 중');
  assert.deepEqual(웹.멈춘주인(새(5), 지금, { 살아있음: true, 열쇠없음: true, 폴더나이: 3 * 분 }), { 치움: true, 멈춤: false, 까닭: '열쇠 없이 3분 남은 잠금(풀다 끊김)' });
  const { 판, ...판없음 } = 새(7);
  assert.equal(판, 2);
  assert.equal(웹.멈춘주인(판없음, 지금, { 살아있음: true, 열쇠없음: true, 폴더나이: 3 * 분 }).치움, false, '열쇠 파일을 안 쓰는 판(판 표시 없음)은 열쇠 파일이 없어도 멀쩡히 쥔 것 — 상한으로만 본다(GPT 다시 검수 GA1)');
  assert.equal(웹.멈춘주인({ 모름: true }, 지금, { 폴더나이: 60 * 분 }).치움, false, 'owner.json을 읽다 막히면 치우지 않는다');
  assert.equal(웹.멈춘주인(null, 지금, { 폴더나이: 30_000 }).치움, false, '주인 표시를 쓰는 중');
  assert.equal(웹.멈춘주인(null, 지금, { 폴더나이: 3 * 분 }).치움, true, '주인 표시 없이 묵은 폴더(쓰다 끊김)');
});

test('올리기 상한 — 10분 + 25MB마다 1분(올림), 15분까지 · 첨부 크기를 더한다', () => {
  const MB = 1024 * 1024;
  assert.equal(웹.올리기상한(0), 10 * 60_000);
  assert.equal(웹.올리기상한(1000), 11 * 60_000);
  assert.equal(웹.올리기상한(43_119_519), 12 * 60_000, '11-08 다녀왔어.mp4(43MB)');
  assert.equal(웹.올리기상한(101 * MB), 15 * 60_000);
  assert.equal(웹.올리기상한(2000 * MB), 15 * 60_000, '15분까지');
  const dir = 임시();
  const 둘 = [쓰기(dir, 'a.jpg', Buffer.alloc(3000)), 쓰기(dir, 'b.txt', 'xyz')];
  assert.equal(웹.올리기상한계산([...둘, path.join(dir, '없음.png')]), 11 * 60_000, '있는 파일 크기만 더한다');
  assert.equal(웹.올리기상한계산([]), 10 * 60_000);
});

test('올리기 잠금 — 살아 있는데 멈춘 주인(상한 + 3분 넘김)은 치우고 넘겨받는다 · 막힘 기록에 남기고 · 그 프로세스는 끄지 않는다', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    const 주인 = 산주인();
    try {
      const 폴더 = 웹.설정.폴더;
      새주인쓰기(폴더, { pid: 주인.pid, 이름: 'argonweb-779816', 시각: new Date(Date.now() - 30 * 60_000).toISOString(), 상한: new Date(Date.now() - 10 * 60_000).toISOString(), 열쇠: 'old' });
      fs.writeFileSync(path.join(dir, 'README.md'), '## 막힘 기록\n- 11-08 14:25 argonweb-779816(gemini 차례): 줄 밖 ego 실행기가 3분 넘게 안 비어 그대로 잡음'); // 끝 줄바꿈 없는 README
      const 잠금 = await 웹.올리기잠금('argonweb-next', 60_000, { 할일: '보내기 시험' });
      const 지금주인 = 주인읽기(폴더);
      assert.deepEqual([지금주인.이름, 지금주인.pid, 지금주인.열쇠, 지금주인.할일], ['argonweb-next', process.pid, 잠금.열쇠, '보내기 시험']);
      assert.deepEqual(fs.readdirSync(폴더).sort(), [`${잠금.열쇠}.key`, 'owner.json'].sort(), '옛 주인의 열쇠 파일은 지워지고 내 열쇠 파일만 있다');
      assert.equal(Date.parse(지금주인.상한) - Date.parse(지금주인.시각), 60_000, '상한을 owner.json에 적는다 — 기다리는 쪽이 이것으로 멈춘 주인을 가린다');
      const 기록 = fs.readFileSync(path.join(dir, 'README.md'), 'utf8').split('\n');
      assert.equal(기록.length, 4, '앞 줄에 붙지 않고 새 줄로');
      assert.match(기록[2], /^- \d\d-\d\d \d\d:\d\d argonweb-next\(아르곤웹 올리기 잠금\): argonweb-779816\(pid \d+, .*\) 잠금을 치우고 넘겨받음 — 살아 있지만 올리기 상한\(\d\d:\d\d\)을 10분 넘김\. 그 프로세스는 끄지 않았다$/);
      assert.ok(찍힘.some((l) => /올리기 잠금 치움 — argonweb-779816/.test(l)), 찍힘.join('\n'));
      assert.equal(웹.살아있나(주인.pid), true, '남의 프로세스는 끄지 않는다');
      assert.equal(잠금.풀기(), true);
      assert.equal(fs.existsSync(폴더), false);
      assert.deepEqual(fs.readdirSync(dir).filter((n) => n.startsWith('upload.lock')), [], '옮겨 치운 잠금도 남기지 않는다');
    } finally { 주인.kill(); }
  });
});

test('올리기 잠금 — 상한 안의 산 주인 · gemini 줄을 쥔 옛 판 · 줄도 번호표도 없는 옛 판은 기다리고(차례를 잃으면 그만), 번호표로 기다리는 옛 판 주인은 넘겨받는다', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    const 주인 = 산주인();
    try {
      const 폴더 = 웹.설정.폴더;
      const 기다려 = (n) => { let k = 0; return 웹.올리기잠금('argonweb-next', 60_000, { 그만: () => (k += 1) > n }); };
      새주인쓰기(폴더, { pid: 주인.pid, 이름: 'argonweb-up', 시각: new Date().toISOString(), 상한: new Date(Date.now() + 10 * 60_000).toISOString(), 열쇠: 'up' });
      assert.equal(await 기다려(4), null, '상한 안 — 올리는 중이라 기다리다 차례를 잃으면 그만');
      assert.equal(주인읽기(폴더).열쇠, 'up', '남의 잠금은 그대로');
      assert.ok(찍힘.some((l) => /올리기 잠금 기다림 — argonweb-up\(pid \d+, .* · 상한 .*\) · 올리는 중/.test(l)), 찍힘.join('\n'));
      // 옛 판(상한 · 열쇠 없음) — 차례 a 줄을 쥐고 있으면 올리는 중일 수 있다
      fs.rmSync(폴더, { recursive: true });
      주인쓰기(폴더, { pid: 주인.pid, 이름: 'argonweb-old', 시각: new Date(Date.now() - 20 * 60_000).toISOString() });
      const 줄 = path.join(dir, 'gemini.lock');
      fs.mkdirSync(줄);
      fs.writeFileSync(path.join(줄, 'owner.txt'), `argonweb-old ${지금글()} 아르곤웹 1건 — 아르곤답 [77yuhbs]\n`);
      assert.equal(웹.줄주인('argonweb-old').줄, 'gemini-a');
      assert.equal(await 기다려(4), null, '줄을 쥔 옛 판 — 기다린다');
      // 줄도 번호표도 없다 — --차례없이로 올리는 중일 수 있다(20분째라 기다린다, GA4)
      fs.rmSync(줄, { recursive: true });
      assert.equal(웹.줄주인('argonweb-old'), null);
      assert.equal(await 기다려(4), null, '줄 · 번호표 없이 20분 — 기다린다');
      // 줄을 내려놓고 번호표로 다시 줄을 섰다 — 올리는 중일 수 없다(11-08 07:13~14:25의 꼴)
      const 대기열 = path.join(dir, 'gemini.queue');
      fs.mkdirSync(대기열);
      fs.writeFileSync(path.join(대기열, '1794116815_argonweb-other'), '');
      assert.equal(웹.줄주인('argonweb-old'), null, '남의 번호표는 안 센다');
      fs.writeFileSync(path.join(대기열, '1794116816_argonweb-old'), '');
      assert.equal(웹.줄주인('argonweb-old'), '줄섬');
      const 잠금 = await 기다려(200);
      assert.ok(잠금, '번호표로 기다리는 옛 판 주인은 넘겨받는다');
      assert.match(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), /argonweb-next\(아르곤웹 올리기 잠금\): argonweb-old\(pid \d+, .* · 옛 판\) 잠금을 치우고 넘겨받음 — 옛 판 주인이 gemini 줄 없이 번호표로 차례를 기다리는 중/);
      assert.equal(웹.살아있나(주인.pid), true);
      잠금.풀기();
      // 줄도 번호표도 없이 60분 넘게 쥔 옛 판은 넘겨받는다
      fs.rmSync(대기열, { recursive: true });
      주인쓰기(폴더, { pid: 주인.pid, 이름: 'argonweb-old', 시각: new Date(Date.now() - 61 * 60_000).toISOString() });
      const 잠금2 = await 기다려(200);
      assert.ok(잠금2, '줄 · 번호표 없이 61분');
      잠금2.풀기();
    } finally { 주인.kill(); }
  });
});

test('올리기 잠금 — 죽은 주인 · 주인 표시 없이 묵은 폴더는 치우고, 판단 뒤 새 주인이 잡은 잠금은 되돌려 둔다 · 푸는 것은 열쇠가 같을 때만', async () => {
  await 잠금시험(async (dir) => {
    const 폴더 = 웹.설정.폴더;
    const 죽은 = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout);
    새주인쓰기(폴더, { pid: 죽은, 이름: 'argonweb-dead', 시각: new Date().toISOString(), 상한: new Date(Date.now() + 600_000).toISOString(), 열쇠: 'd' });
    let k = 0;
    const a = await 웹.올리기잠금('me', 60_000, { 그만: () => (k += 1) > 200 });
    assert.ok(a && 웹.잠금주인읽기(폴더).열쇠 === a.열쇠, '주인 pid가 없으면 상한 안이어도 바로 넘겨받는다');
    assert.equal(fs.existsSync(path.join(dir, 'README.md')), false, '죽은 주인 치우기는 막힘 기록에 안 남긴다(멈춘 주인만)');
    assert.equal(웹.잠금풀기(폴더, 'other'), false, '열쇠가 다르면 손대지 않는다');
    assert.equal(fs.existsSync(폴더), true);
    assert.equal(a.풀기(), true);
    assert.equal(a.풀기(), false, '두 번 풀어도 된다');
    // 주인 표시(owner.json) 없는 폴더 — 쓰다 끊긴 것: 2분 넘게 묵으면 치운다
    fs.mkdirSync(폴더);
    const 옛때 = new Date(Date.now() - 5 * 60_000);
    fs.utimesSync(폴더, 옛때, 옛때);
    const b = await 웹.올리기잠금('me', 60_000, { 그만: () => (k += 1) > 400 });
    assert.ok(b, '주인 표시 없이 묵은 폴더');
    b.풀기();
    // 판단한 주인(stale)과 지금 주인(fresh)이 다르면 — 그새 풀리고 새 주인이 잡음 — stale의 열쇠 파일이 없어 옮기지도 지우지도 않는다(GA3)
    새주인쓰기(폴더, { pid: process.pid, 이름: 'fresh', 시각: new Date().toISOString(), 상한: new Date(Date.now() + 600_000).toISOString(), 열쇠: 'fresh' });
    const 옮김자국 = () => fs.readdirSync(dir).filter((n) => n.startsWith('upload.lock.'));
    assert.equal(웹.잠금치우기(폴더, { pid: 1, 이름: 'stale', 시각: 'x', 열쇠: 'stale' }, { 치움: true, 멈춤: true, 까닭: '시험' }, 'me'), true);
    assert.equal(웹.잠금주인읽기(폴더).열쇠, 'fresh', '새 주인의 잠금은 제자리에 그대로');
    assert.ok(fs.existsSync(path.join(폴더, 'fresh.key')));
    assert.deepEqual(옮김자국(), [], '옮기지도 않았다');
    // 옛 판으로 판단했는데 그새 새 주인(열쇠 파일)이 잡았다 — 옮겨 보고 열쇠 파일이 있으면 제자리로
    assert.equal(웹.잠금치우기(폴더, { pid: 1, 이름: 'old', 시각: 'x' }, { 치움: true, 멈춤: true, 까닭: '시험' }, 'me'), true);
    assert.equal(웹.잠금주인읽기(폴더).열쇠, 'fresh');
    assert.deepEqual(옮김자국(), []);
    // 주인 표시 없는 폴더로 판단했는데 그새 새 주인이 열쇠만 써 둔 참이다 — 열쇠 파일이 있으면 되돌린다
    fs.rmSync(path.join(폴더, 'owner.json'));
    assert.equal(웹.잠금치우기(폴더, null, { 치움: true, 멈춤: false, 까닭: '시험' }, 'me'), true);
    assert.ok(fs.existsSync(path.join(폴더, 'fresh.key')), '열쇠만 써 둔 새 주인의 폴더는 그대로');
    assert.equal(fs.existsSync(path.join(dir, 'README.md')), false, '되돌린 것은 기록하지 않는다');
    fs.rmSync(폴더, { recursive: true });
    // 열쇠만 지우고 폴더를 못 지운 채 끝난 잠금(같은 주인 표시 · 열쇠 파일 없음) — 막 지운 것은 남이 푸는 중이라 기다리고, 2분 묵었으면 옮겨 치운다
    const 반쯤 = { pid: 1, 이름: 'half', 시각: 'x', 상한: new Date().toISOString(), 열쇠: 'half', 판: 2 };
    주인쓰기(폴더, 반쯤);
    assert.equal(웹.잠금치우기(폴더, 반쯤, { 치움: true, 멈춤: false, 까닭: '시험' }, 'me'), false, '열쇠가 막 지워졌다 — 한 바퀴 기다린다');
    assert.equal(fs.existsSync(폴더), true);
    묵히기(폴더);
    assert.equal(웹.잠금치우기(폴더, 반쯤, { 치움: true, 멈춤: false, 까닭: '시험' }, 'me'), true);
    assert.equal(fs.existsSync(폴더), false);
    assert.deepEqual(옮김자국(), []);
  });
});

test('올리기 잠금 — 같은 죽은 주인을 둘이 넘겨받아도 막 열쇠를 지운 쪽의 폴더를 다른 쪽이 치우지 않는다 · 쓰다 끊겨 열쇠만 남은 폴더도 치운다(GPT 다시 검수 GA2 · GA3)', async () => {
  await 잠금시험(async (dir) => {
    const 폴더 = 웹.설정.폴더;
    const 죽은 = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout);
    const X = { pid: 죽은, 이름: 'argonweb-dead', 시각: new Date().toISOString(), 상한: new Date(Date.now() + 600_000).toISOString(), 열쇠: 'x', 판: 2 };
    새주인쓰기(폴더, X);
    const 판단 = 웹.멈춘주인(웹.잠금주인읽기(폴더), Date.now(), { 살아있음: false });
    assert.equal(판단.치움, true);
    // A가 X의 열쇠를 막 지웠고(폴더는 아직 그 자리) — B가 같은 판단으로 들어온다
    fs.unlinkSync(path.join(폴더, 'x.key'));
    assert.equal(웹.잠금치우기(폴더, X, 판단, 'B', ['x.key']), false, 'B는 이번 바퀴를 쉰다(남이 푸는 중)');
    assert.equal(웹.잠금주인읽기(폴더).열쇠, 'x', 'A가 치울 폴더를 B가 건드리지 않았다');
    // A가 마저 치우고 B가 다음 바퀴에 잡는다
    fs.rmSync(폴더, { recursive: true });
    let k = 0;
    const b = await 웹.올리기잠금('B', 60_000, { 그만: () => (k += 1) > 100 });
    assert.ok(b);
    assert.equal(웹.잠금주인읽기(폴더).판, 2, '새 판은 owner.json에 판 2를 적는다');
    b.풀기();
    // 열쇠만 쓰고 owner.json 전에 끊긴 폴더 — 2분 안은 쓰는 중으로 기다리고, 묵었으면 치운다(영원히 되돌리며 돌지 않는다)
    fs.mkdirSync(폴더);
    fs.writeFileSync(path.join(폴더, 'lost.key'), '');
    assert.equal(await 웹.올리기잠금('C', 60_000, { 그만: () => (k += 1) > 104 }), null, '막 쓰는 중 — 기다린다');
    assert.ok(fs.existsSync(path.join(폴더, 'lost.key')));
    묵히기(폴더);
    const c = await 웹.올리기잠금('C', 60_000, { 그만: () => (k += 1) > 300 });
    assert.ok(c, '열쇠만 남고 2분 묵은 폴더는 치우고 잡는다');
    assert.deepEqual(fs.readdirSync(폴더).sort(), [`${c.열쇠}.key`, 'owner.json'].sort());
    assert.deepEqual(fs.readdirSync(dir).filter((n) => n.startsWith('upload.lock.')), [], '옮긴 자국을 남기지 않는다');
    c.풀기();
  });
});

test('올리기 잠금 — 판단한 폴더와 옮긴 폴더의 정체가 다르면 안 지운다 · 쓰다 폴더를 잃은 쪽은 제 열쇠만 풀고 다시 잡는다(세 번째 검수)', async () => {
  await 잠금시험(async (dir) => {
    const 폴더 = 웹.설정.폴더;
    // A가 묵은 빈 폴더를 보고 「주인 표시 없음」으로 판단한 뒤 — B가 그것을 치우고 같은 경로에 새로 잡아 열쇠까지만 썼다
    fs.mkdirSync(폴더);
    묵히기(폴더);
    const 본표 = 웹.폴더표(폴더);
    assert.ok(본표);
    fs.rmSync(폴더, { recursive: true });
    fs.mkdirSync(폴더);
    fs.writeFileSync(path.join(폴더, 'b.key'), '');
    // 윈도(NTFS)는 파일 번호, 리눅스 ext4는 만든 때로 가린다 — 둘 다 못 가리는 파일 시스템(만든 때 없음 · 번호 바로 다시 씀)이면 이 갈래만 건너뛴다
    if (웹.폴더표(폴더) !== 본표) {
      assert.equal(웹.잠금치우기(폴더, null, { 치움: true, 멈춤: false, 까닭: '시험' }, 'A', ['b.key'], 본표), true);
      assert.ok(fs.existsSync(path.join(폴더, 'b.key')), '주인 표시 · 열쇠 목록이 맞아 떨어져도 정체가 다르면 B의 잠금은 그대로');
      assert.deepEqual(fs.readdirSync(dir).filter((n) => n.startsWith('upload.lock.')), []);
    } else assert.notEqual(process.platform, 'win32', '윈도에서는 같은 경로 새 폴더를 가려야 한다');
    fs.rmSync(폴더, { recursive: true });
    // 주인 표시를 쓰는 사이 폴더를 잃었다(ENOENT) — 경로째 지우지 않고 제 열쇠만 풀고 처음부터 다시 잡는다
    const 원래쓰기 = fs.writeFileSync;
    let 한번 = true;
    fs.writeFileSync = function (f, ...rest) {
      if (한번 && String(f).endsWith('owner.json') && String(f).startsWith(폴더)) { 한번 = false; const e = new Error('ENOENT: 시험'); e.code = 'ENOENT'; throw e; }
      return 원래쓰기.call(this, f, ...rest);
    };
    let a;
    try { a = await 웹.올리기잠금('a', 60_000); } finally { fs.writeFileSync = 원래쓰기; }
    assert.equal(한번, false);
    assert.deepEqual(fs.readdirSync(폴더).sort(), [`${a.열쇠}.key`, 'owner.json'].sort(), '두 번째로 잡았다 — 첫 열쇠는 남지 않는다');
    a.풀기();
    // 쓰는 사이 남이 내 폴더를 옮겼다가 되돌렸다 — 내 열쇠가 든 폴더는 내 것이니 주인 표시를 마저 쓰고 잡는다(제 잠금을 2분 기다리지 않는다)
    const 원래만들기 = fs.mkdirSync;
    const 옮김 = `${폴더}.남이옮김`;
    let 단계 = 0;
    fs.writeFileSync = function (f, ...rest) {
      if (단계 === 0 && String(f).endsWith('owner.json') && String(f).startsWith(폴더)) { 단계 = 1; fs.renameSync(폴더, 옮김); }
      return 원래쓰기.call(this, f, ...rest);
    };
    fs.mkdirSync = function (p, ...rest) {
      if (단계 === 1 && String(p) === 폴더) { 단계 = 2; fs.renameSync(옮김, 폴더); }
      return 원래만들기.call(this, p, ...rest);
    };
    let b;
    try { b = await 웹.올리기잠금('b', 60_000); } finally { fs.writeFileSync = 원래쓰기; fs.mkdirSync = 원래만들기; }
    assert.equal(단계, 2);
    assert.equal(웹.잠금주인읽기(폴더).열쇠, b.열쇠, '되돌아온 제 폴더에 주인 표시를 마저 썼다');
    assert.deepEqual(fs.readdirSync(폴더).sort(), [`${b.열쇠}.key`, 'owner.json'].sort());
    b.풀기();
    assert.equal(fs.existsSync(폴더), false);
  });
});

test('올리기 잠금 — 같은 잠금을 두 쪽이 풀어도(감시 · finally · 부르는 쪽) 그새 잡은 새 주인 것은 안 지운다 · 남의 프로세스가 쥔 판에도 내 열쇠로만 푼다(GA2)', async () => {
  await 잠금시험(async () => {
    const 폴더 = 웹.설정.폴더;
    const a = await 웹.올리기잠금('a', 60_000);
    assert.equal(웹.잠금풀기(폴더, a.열쇠), true, '첫 풀기');
    const b = await 웹.올리기잠금('b', 60_000);
    assert.equal(a.풀기(), false, 'a를 두 번째로 푸는 쪽 — 지금은 b의 잠금이라 내 열쇠 파일이 없다');
    assert.equal(웹.잠금주인읽기(폴더).열쇠, b.열쇠, 'b의 잠금은 그대로');
    assert.ok(fs.existsSync(path.join(폴더, `${b.열쇠}.key`)));
    assert.equal(b.풀기(), true);
    assert.equal(fs.existsSync(폴더), false);
  });
});

test('올리기 상한(주인 쪽) — 보내기 앞에 못 닿으면 실행기를 나무째 끄고 잠금을 풀어 「올리기 시간 넘김」(표시 없음 · 다시 보내도 된다), 누르기 직전에 풀면 그대로 답을 받는다', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    Object.assign(웹.설정, { 에고: 가짜에고(dir), 상한: 600, 끄기여유: 300 });
    const 사진 = 쓰기(dir, '컷.jpg');
    const 작업 = (prompt, 이름) => 웹.작업만들기({ files: [사진], prompt, out: `${이름}.md` }, dir, 이름);
    const 멈춤 = 작업('멈춤', '멈춤답');
    const t0 = Date.now();
    const r = await 웹.한건(멈춤, 1, '보내기', 'acct', [멈춤], { 이름: 'argonweb-t' });
    assert.equal(r.결과, '올리기 시간 넘김', JSON.stringify(r));
    assert.match(r.까닭, /상한 \d+분 안에 보내기 앞까지 못 갔다 — 실행기를 끄고 잠금을 풀었다\(보내지 않음/);
    assert.ok(Date.now() - t0 < 20_000, `상한 + 여유 뒤 바로 끝난다(${Date.now() - t0}ms)`);
    assert.equal(fs.existsSync(웹.설정.폴더), false, '잠금을 풀었다');
    assert.equal(fs.existsSync(웹.표시경로(멈춤.out)), false, '보냄 표시가 없다 — 다시 보내도 된다');
    assert.ok(찍힘.some((l) => /올리기 시간 넘김 — 상한 \d\d:\d\d까지 보내기 앞에 못 가 실행기를 끄고/.test(l)), 찍힘.join('\n'));
    const 누름 = 작업('누름', '누름답');
    const r2 = await 웹.한건(누름, 1, '보내기', 'acct', [누름], { 이름: 'argonweb-t' });
    assert.equal(r2.결과, '받음', JSON.stringify(r2));
    assert.equal(fs.existsSync(웹.설정.폴더), false, '스크립트가 누르기 직전에 풀었다');
    assert.equal(fs.existsSync(웹.표시경로(누름.out)), false);
    // 읽기 · 파일 없는 보내기는 잠금을 쥐지 않는다(올리기가 없다)
    새주인쓰기(웹.설정.폴더, { pid: process.pid, 이름: 'other', 시각: new Date().toISOString(), 상한: new Date(Date.now() + 600_000).toISOString(), 열쇠: 'other' });
    const 글만 = 웹.작업만들기({ files: [], prompt: '누름', out: '글만.md' }, dir, '글만');
    fs.writeFileSync(웹.표시경로(글만.out), '{}');
    const r3 = await 웹.한건(글만, 1, '읽기', 'acct', [글만], { 이름: 'argonweb-t' });
    assert.equal(r3.결과, '보냄', `잠금 없이 바로 불렸다(가짜 ego가 「잠금 없이 불림」) — 표시가 있어 다시 보내지 않는다: ${JSON.stringify(r3)}`);
    assert.equal(주인읽기(웹.설정.폴더).열쇠, 'other', '남이 쥔 올리기 잠금을 기다리지 않고 그대로 둔다');
    const r4 = await 웹.한건({ ...글만, out: path.join(dir, '글만2.md') }, 1, '보내기', 'acct', [글만], { 이름: 'argonweb-t' });
    assert.equal(r4.결과, '없음', `파일 없는 보내기도 잠금 없이: ${JSON.stringify(r4)}`);
  });
});

test('올리기 상한(주인 쪽) — 스크립트가 마감에 스스로 그만두면 끄지 않고 「올리기 시간 넘김」, 마감 즈음 제 까닭으로 실패한 건은 「실패」 그대로(한 번 다시 한다)', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    Object.assign(웹.설정, { 에고: 가짜에고(dir), 상한: 500, 끄기여유: 2000 });
    const 사진 = 쓰기(dir, '컷.jpg');
    const 작업 = (prompt) => 웹.작업만들기({ files: [사진], prompt, out: `${prompt}답.md` }, dir, prompt);
    const t0 = Date.now();
    const 감시 = await 웹.한건(작업('감시'), 1, '보내기', 'acct', [], { 이름: 'argonweb-t' });
    assert.equal(감시.결과, '올리기 시간 넘김', JSON.stringify(감시));
    assert.match(감시.까닭, /마감까지 보내기 앞에 못 닿음/, '스크립트가 찍은 까닭 그대로');
    assert.ok(Date.now() - t0 < 1800, `끄기여유(2초)를 기다리지 않았다 — 스크립트가 풀자 바로(${Date.now() - t0}ms)`);
    assert.ok(!찍힘.some((l) => /실행기를 끄고 올리기 잠금을 푼다/.test(l)), '실행기를 끄지 않았다');
    const 늦은실패 = await 웹.한건(작업('늦은실패'), 1, '보내기', 'acct', [], { 이름: 'argonweb-t' });
    assert.equal(늦은실패.결과, '실패', `마감 뒤에 풀렸어도 제 까닭(모드 단추)이 있으면 실패 — ${JSON.stringify(늦은실패)}`);
    assert.equal(fs.existsSync(웹.설정.폴더), false);
  });
});

test('올리기 시간 넘김 — 묶음을 멈추고(남은 건은 「안 함」) 보고에 남긴다, 종료 1', async () => {
  await 잠금시험(async (dir, 찍힘) => {
    Object.assign(웹.설정, { 에고: 가짜에고(dir), 상한: 400, 끄기여유: 200 });
    const 사진 = 쓰기(dir, '컷.jpg');
    const jobs = ['멈춤', '누름'].map((p, i) => 웹.작업만들기({ files: [사진], prompt: p, out: `답${i}.md` }, dir, `작업${i}`));
    const code = await 웹.돌리기(jobs, { _: [], 파일: [], 차례없이: true, u: '1', 계정: 'acct' }, '보내기');
    assert.equal(code, 1);
    const 글 = 찍힘.join('\n');
    assert.match(글, /아르곤웹 · 2건 — 받음 0 · 보냄\(답 기다림\) 0 · 올리기 시간 넘김 1 · 실패 0 · 건너뜀 0 · 안 함 1/);
    assert.match(글, /올리기 시간 넘김 {2}작업0 — 올리기가 상한/);
    assert.match(글, /안 함 {2}작업1 — 올리기가 상한/);
    assert.match(글, /멈춤: 올리기가 상한/);
    assert.equal(fs.existsSync(jobs[1].out), false, '뒤 작업은 보내지 않았다');
    assert.equal(fs.existsSync(웹.설정.폴더), false);
  });
});

// 페이지 스크립트를 가짜 ego 전역(listTaskSpaces · taskSpace)으로 돌린다 — 늦음 = { 공간 ms, 탭 ms }만큼 그 호출이 늦게 돌아오고, 첫 화면 이동은 영영 안 끝난다.
// 잠금 폴더는 잠금열쇠로 쥐어 두고 스크립트에는 열쇠를 준다. 돌아온 뒤 { 실패 줄, 닫은 탭 수, 탭 목록 · 이동 · 파일 넣기 부른 수, 보냄 표시 }
const 페이지돌려 = async ({ 열쇠, 잠금열쇠, 마감뒤 = 250, 늦음 = {}, 기다림 = 1500 }) => {
  const AsyncFunction = (async () => {}).constructor;
  const 앞 = { listTaskSpaces: globalThis.listTaskSpaces, taskSpace: globalThis.taskSpace, log: console.log };
  const dir = 임시();
  const lock = path.join(dir, 'upload.lock');
  const 마감 = Date.now() + 마감뒤;
  새주인쓰기(lock, { pid: process.pid, 이름: 't', 시각: new Date().toISOString(), 상한: new Date(마감).toISOString(), 열쇠: 잠금열쇠 });
  const job = { ...웹.작업만들기({ files: [쓰기(dir, '컷.jpg')], prompt: '질문', out: '답.md' }, dir, 't'), upload: { lock: lock.replace(/\\/g, '/'), key: 열쇠, deadline: 마감 } };
  const 찍힘 = [];
  const 셈 = { 닫음: 0, 탭목록: 0, 이동: 0, 파일넣기: 0 };
  const 쪽 = {
    url: async () => 'about:blank', info: async () => ({}), cdp: async () => ({ windowId: 1, bounds: { windowState: 'normal' } }),
    goto: () => { 셈.이동 += 1; return new Promise(() => {}); }, close: async () => { 셈.닫음 += 1; }, screenshot: async () => {},
    waitForFileChooser: async () => ({ setFiles: async () => { 셈.파일넣기 += 1; } }),
  };
  globalThis.listTaskSpaces = async () => [{ name: 웹.기본공간, profileId: 웹.기본프로필 }];
  globalThis.taskSpace = async () => { await 잠시(늦음.공간 || 0); return { pages: async () => { 셈.탭목록 += 1; await 잠시(늦음.탭 || 0); return [쪽]; }, newPage: async () => 쪽 }; };
  console.log = (x) => { 찍힘.push(String(x)); };
  let 끝 = false;
  try {
    new AsyncFunction(웹.페이지글(job, 1, '보내기', 'acct'))().catch(() => {}).finally(() => { 끝 = true; });
    for (let t = 0; t < 기다림 && !끝 && !(셈.닫음 && 찍힘.length); t += 20) await 잠시(20);
    await 잠시(60);
  } finally { globalThis.listTaskSpaces = 앞.listTaskSpaces; globalThis.taskSpace = 앞.taskSpace; console.log = 앞.log; delete globalThis.JOB; }
  const 실패 = 찍힘.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((x) => x && x.step === 'fail');
  return { lock, 실패, ...셈, 표시: fs.existsSync(웹.표시경로(job.out)) };
};

test('페이지 스크립트(올리기 마감) — 보내기 앞에 못 닿은 채 마감이 오면 「올리기넘김」을 찍고 잠금을 풀고 제 탭을 닫는다 · 남이 넘겨받은 잠금은 그대로', async () => {
  const 내것 = await 페이지돌려({ 열쇠: 'k1', 잠금열쇠: 'k1' });
  assert.ok(내것.닫음 >= 1, '마감에 제 탭을 닫아 하던 조작을 끊는다');
  assert.equal(내것.실패 && 내것.실패.kind, '올리기넘김');
  assert.equal(fs.existsSync(내것.lock), false, '내 열쇠 파일을 지우고 잠금을 푼다');
  assert.equal(내것.표시, false, '보냄 표시를 안 썼다');
  const 남의것 = await 페이지돌려({ 열쇠: 'k2', 잠금열쇠: 'taken' });
  assert.ok(남의것.닫음 >= 1);
  assert.ok(fs.existsSync(path.join(남의것.lock, 'taken.key')), '남이 넘겨받은 잠금(내 열쇠 파일이 없음)은 손대지 않는다');
});

test('페이지 스크립트(올리기 마감) — 공간 열기 · 탭 목록이 마감 뒤에 늦게 돌아와도 그 뒤로는 탭을 옮기거나 파일을 넣지 않는다(GA1)', async () => {
  const 공간늦음 = await 페이지돌려({ 열쇠: 'k1', 잠금열쇠: 'k1', 마감뒤: 150, 늦음: { 공간: 450 } });
  assert.equal(공간늦음.실패 && 공간늦음.실패.kind, '올리기넘김');
  assert.deepEqual([공간늦음.탭목록, 공간늦음.이동, 공간늦음.파일넣기], [0, 0, 0], '공간이 늦게 열려도 빈 탭을 고르지 않는다');
  assert.equal(fs.existsSync(공간늦음.lock), false);
  const 탭늦음 = await 페이지돌려({ 열쇠: 'k1', 잠금열쇠: 'k1', 마감뒤: 150, 늦음: { 탭: 450 } });
  assert.equal(탭늦음.실패 && 탭늦음.실패.kind, '올리기넘김');
  assert.deepEqual([탭늦음.이동, 탭늦음.파일넣기], [0, 0], '빈 탭이 늦게 와도 첫 화면으로 옮기지 않는다');
  assert.ok(탭늦음.닫음 >= 1, '늦게 받은 탭은 맨 끝 finally가 닫는다');
  assert.equal(탭늦음.표시, false);
});

test('올리기 기다림(11-08 사라짐 넷) — 고정 기다림은 큰 묶음만큼 더, 누르기 직전 끝 기다림 상한은 크기에 비례(150초까지)', () => {
  const MB = 1024 * 1024;
  assert.equal(웹.올리기뒤기다림(0, 1, false), 13_500, '작은 한 장은 그대로(12초 + 1.5초)');
  assert.equal(웹.올리기뒤기다림(2 * MB, 2, false), 15_000, '2MB까지는 더하지 않는다');
  assert.equal(웹.올리기뒤기다림(10.6 * MB, 5, false), 12_000 + 7_500 + 17_200, '구로 그림 넷 + 글 하나(10.6MB) — 17초 더');
  assert.equal(웹.올리기뒤기다림(10.1 * MB, 1, true), 12_000 + 1_500 + 15_000 + 16_200, '10번 영상 하나(10.1MB)');
  assert.equal(웹.올리기뒤기다림(500 * MB, 1, true) - (12_000 + 1_500 + 15_000), 60_000, '더하는 것은 1분까지');
  assert.equal(웹.올리기끝상한초(0), 30);
  assert.equal(웹.올리기끝상한초(10 * MB), 60);
  assert.equal(웹.올리기끝상한초(100 * MB), 150, '150초까지 — 그 뒤엔 그대로 보낸다');
  const 판단 = new Function(`${웹.판단머리()}\nreturn { 올리기뒤기다림, 올리기끝상한초 };`)();
  assert.equal(판단.올리기끝상한초(10 * MB), 60, '페이지 스크립트 앞에 붙는 판단 함수로 그대로 돈다');
  assert.equal(판단.올리기뒤기다림(10.1 * MB, 1, true), 웹.올리기뒤기다림(10.1 * MB, 1, true));
});

test('페이지 스크립트(올리기 끝 기다림) — 누르기 직전, 빙글 표시 · 꺼진 보내기 단추가 없어질 때까지 보고, 상한을 넘겨도 막지 않고 보낸다 · 기다린 초를 남긴다', async () => {
  const s = 페이지();
  const { 보내기 } = 갈래(s);
  const 자리 = (t) => { const i = 보내기.indexOf(t); assert.ok(i > 0, `보내기 갈래에서 「${t}」를 찾음`); return i; };
  const 지시문넣기 = 자리('await page.keyboard.insertText(prompt);');
  const 기다림 = 자리('const 상한초 = 올리기끝상한초(올릴바이트);');
  const 마감검사 = 자리('"올리기넘김");');
  assert.ok(지시문넣기 < 기다림 && 기다림 < 마감검사, '지시문을 넣은 뒤 · 마감 검사(누름 · 보냄 표시) 앞에서 기다린다');
  assert.match(보내기, /await page\.waitForTimeout\(올리기뒤기다림\(올릴바이트, files\.length, /, '썸네일 뒤 고정 기다림도 크기에 맞춘다');
  assert.match(s, /올릴바이트 \+= \(await fs\.stat\(f\)\)\.size/, '올릴 크기는 첨부 파일 크기 합');
  // 그 덩이를 그대로 떼어 가짜 화면으로 돌린다 — 빙글 표시 · 단추 상태를 차례로 돌려준다
  const 처음 = s.search(/if \(files\.length\) \{\r?\n\s*const 상한초 = 올리기끝상한초\(올릴바이트\);/);
  const 끝 = s.indexOf('\n', s.indexOf('step: "upload-wait"', 처음));
  assert.ok(처음 > 0 && 끝 > 처음);
  const 덩어리 = `${s.slice(처음, 끝)}\n}`;
  assert.doesNotMatch(덩어리, /fail\(/, '기다림은 실패로 끝내지 않는다(선택자가 다른 것을 잡아도 늦어질 뿐)');
  const AsyncFunction = (async () => {}).constructor;
  const { 올리기끝상한초 } = new Function(`${웹.판단머리()}\nreturn { 올리기끝상한초 };`)();
  const 돌려 = async (보임들, { MB = 1, 넘김 = false } = {}) => {
    const 기록 = [];
    let 물음 = 0, 쉼 = 0;
    const page = {
      evaluate: async () => 보임들[Math.min(물음++, 보임들.length - 1)],
      waitForTimeout: async () => { 쉼 += 1; },
    };
    await new AsyncFunction('page', 'files', '올릴바이트', '넘김', 'log', '올리기끝상한초', 덩어리)(page, ['a.jpg'], MB * 1024 * 1024, 넘김, (o) => 기록.push(o), 올리기끝상한초);
    return { 줄: 기록.find((x) => x.step === 'upload-wait'), 물음, 쉼 };
  };
  const 빙글 = (n, 꺼짐 = false) => ({ 빙글: n, 꺼짐 });
  const 사라짐 = await 돌려([빙글(2), 빙글(1), 빙글(0)]);
  assert.deepEqual([사라짐.줄.초, 사라짐.줄.빙글, 사라짐.쉼], [2, 0, 2], '빙글 표시가 없어지면 바로 누르러 간다');
  const 단추 = await 돌려([빙글(0, true), 빙글(0, true), 빙글(0, false)]);
  assert.deepEqual([단추.줄.초, 단추.줄.꺼짐], [2, false], '보내기 단추가 꺼져 있으면 켜질 때까지');
  const 바로 = await 돌려([빙글(0)]);
  assert.deepEqual([바로.줄.초, 바로.쉼], [0, 0], '올리기가 끝나 있으면 기다리지 않는다(초 0도 남긴다)');
  const 안사라짐 = await 돌려([빙글(1)], { MB: 10 });
  assert.equal(안사라짐.줄.상한초, 60);
  assert.equal(안사라짐.줄.초, 61, '상한(60초)을 다 본 뒤');
  assert.equal(안사라짐.줄.빙글, 1, '남은 빙글 표시를 기록에 남기고 그대로 보내러 간다(실패하지 않음)');
  assert.equal(안사라짐.줄.MB, 10);
  const 마감 = await 돌려([빙글(3)], { 넘김: true });
  assert.equal(마감.물음, 0, '마감 감시가 울렸으면 기다리지 않고 바로 마감 검사로 간다');
});

test('페이지 스크립트(올리기 잠금) — 마감 검사 → 누름 → 보냄 표시 → clicking → 잠금 풀기 → 보내기 누르기, 맨 끝 finally가 감시를 끄고 푼다', () => {
  const s = 페이지();
  const { 보내기 } = 갈래(s);
  const 자리 = (t) => { const i = 보내기.indexOf(t); assert.ok(i > 0, `보내기 갈래에서 「${t}」를 찾음`); return i; };
  const 검사 = 자리('"올리기넘김");');
  const 누름 = 자리('누름 = true;');
  const 표시 = 자리('await writeMark(null)');
  const 찍음 = 자리('log({ step: "clicking"');
  const 풀기 = 자리('await 올리기풀기();');
  const 보냄 = 자리('page.click(\'loc=css:[aria-label="메시지 보내기"]\'');
  assert.ok(검사 < 누름 && 누름 < 표시 && 표시 < 찍음 && 찍음 < 풀기 && 풀기 < 보냄, '마감을 넘겼으면 표시를 쓰지 않고, 누르기 직전에 잠금을 넘긴다');
  assert.doesNotMatch(보내기.slice(검사, 누름), /await /, '마감 검사와 「누름」 사이에 await가 없다 — 감시가 끼어들지 못한다');
  const 푸는곳 = 덩이(s, 'const 올리기풀기 = async () => {');
  assert.match(푸는곳, /await fs\.unlink\(`\$\{up\.lock\}\/\$\{up\.key\}\.key`\); break;/, '내 열쇠 파일 지우기가 확인이다(한 사람만 지운다)');
  assert.ok(푸는곳.indexOf('fs.unlink(') < 푸는곳.indexOf('await fs.rename(up.lock, 무덤)') && 푸는곳.indexOf('await fs.rename(up.lock, 무덤)') < 푸는곳.indexOf('await fs.rm(무덤'), '열쇠 파일을 지운 뒤에만 폴더를 옮겨 지운다(경로째 지우지 않는다)');
  assert.match(푸는곳, /e\.code === "ENOENT"[^\n]*\) return;/, '내 열쇠 파일이 없으면(남이 넘겨받음) 손대지 않는다');
  assert.match(덩이(s, '감시 = setTimeout(() => {'), /^감시 = setTimeout\(\(\) => \{\r?\n\s*if \(누름\) return;/, '감시는 누른 뒤에는 아무것도 안 한다');
  assert.match(s, /\n\} finally \{\r?\n {2}if \(감시\) clearTimeout\(감시\);\r?\n {2}await 올리기풀기\(\);\r?\n {2}if \(넘김 && page\) await page\.close\(\)[^\n]*\r?\n\}\s*$/, '맨 끝 finally — 어느 길로 끝나든 감시를 끄고 잠금을 풀고, 마감으로 그만뒀으면 제 탭을 닫는다');
  // 마감확인 — 공간 열기 뒤 · 빈 탭 뒤 · 첫 화면 뒤 · 올리기 앞 · 파일 넣기 앞(GA1)
  const 확인자리 = [...s.matchAll(/await 마감확인\(\);/g)].map((m) => m.index);
  const 앞에 = (t) => { const i = s.indexOf(t); assert.ok(i > 0, t); return 확인자리.some((k) => k < i && s.slice(k, i).split('\n').length <= 3); };
  for (const t of ['let s = await 첫화면();', 'const menuText = () =>', 'await chooser.setFiles(files);']) assert.ok(앞에(t), `「${t}」 바로 앞에 마감확인`);
  assert.ok(확인자리.some((k) => k > s.indexOf('await taskSpace(space)') && k < s.indexOf('const 빈탭 = async')), '공간 열기 바로 뒤에 마감확인');
  assert.match(s, /\ntry \{\r?\n\/\/ profileId는/, '본문 첫 줄(공간 열기)부터 try 안');
  const j = 웹.작업만들기({ files: ['C:\\a\\컷.jpg'], prompt: 'p', out: 'C:\\a\\답.md' }, 'C:\\a', 't');
  const JOB = (x) => JSON.parse(웹.페이지글(x, 1, '보내기', 'acct').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.deepEqual(JOB({ ...j, upload: { lock: 'C:/t/upload.lock', key: 'k', deadline: 1 } }).upload, { lock: 'C:/t/upload.lock', key: 'k', deadline: 1 });
  assert.equal(JOB(j).upload, undefined, '잠금을 쥐지 않은 부름(읽기 · 오마주)에는 없다');
});

// ── 11-11 카본 고르기(유호님 「제미나이 관련한 검수나 이미지 생성 · 딥리서치 전부 카본(max)」) ──
test('카본 판단 — 사고 수준 단계 순위(max > 높음 · 최고가 > 보통 > 낮음), 가장 높은 단계, 모드 칸 대조', () => {
  assert.equal(웹.수준순위('Max\n가장 깊게 생각'), 3);
  assert.equal(웹.수준순위('최대'), 3);
  assert.equal(웹.수준순위('최고'), 3);
  assert.equal(웹.수준순위('최고가'), 2, '10-19 판의 「최고가」는 「높음」 자리');
  assert.equal(웹.수준순위('높음(매우 철저함)'), 2);
  assert.equal(웹.수준순위('보통'), 1);
  assert.equal(웹.수준순위('낮음\n빠른 응답'), 0);
  assert.equal(웹.수준순위('사고 수준\n높음'), -1, '하위 메뉴를 여는 항목은 단계가 아니다');
  assert.equal(웹.수준순위('4 Carbon'), -1);
  assert.deepEqual(웹.가장높은수준(['4 Carbon', '사고 수준\n높음', '낮음', '보통', '높음\n매우 철저함', 'Max\n가장 깊게']), { 글: 'Max', 순위: 3, 차례: 5 });
  assert.deepEqual(웹.가장높은수준(['최저가', '보통', '최고가']), { 글: '최고가', 순위: 2, 차례: 2 }, 'max가 없는 판은 그 판의 가장 높은 단계');
  assert.equal(웹.가장높은수준(['4 Carbon', '4 Argon', '사고 수준']), null);
  assert.equal(웹.카본인가('모드 선택 도구 열기, 현재 카본 높음 모드 사용 중'), true);
  assert.equal(웹.카본인가('모드 선택 도구 열기, 현재 Carbon Max 모드 사용 중'), true);
  assert.equal(웹.카본인가('모드 선택 도구 열기, 현재 Argon 높음 모드 사용 중'), false);
  assert.equal(웹.카본모드맞나('모드 선택 도구 열기, 현재 카본 Max 모드 사용 중', 'Max'), true);
  assert.equal(웹.카본모드맞나('모드 선택 도구 열기, 현재 카본 높음 모드 사용 중', 'Max'), false, 'max가 있는데 높음이면 아니다');
  assert.equal(웹.카본모드맞나('모드 선택 도구 열기, 현재 Argon Max 모드 사용 중', 'Max'), false);
  assert.equal(웹.카본모드맞나('모드 선택 도구 열기, 현재 카본 높음 모드 사용 중', null), false, '단계를 못 읽었으면 맞다고 하지 않는다');
  const 판단 = new Function(`${웹.판단머리()}\nreturn { 수준순위, 가장높은수준, 카본모드맞나, 카본인가 };`)();
  assert.deepEqual(판단.가장높은수준(['낮음', 'Max']), 웹.가장높은수준(['낮음', 'Max']), '페이지 스크립트에 소스째 붙는다');
});

// 가짜 Gemini 화면 — 모드 칸은 지금 모델 · 단계로 그리고, 모드 메뉴 · 사고 수준 하위 메뉴 · 항목 누르기를 흉내 낸다.
// 메뉴 글은 11-11 실물 꼴(설명 다음 모델 이름 · 「단계 + 설명」)을 따른다. 실물 아르곤의 단계는 「낮음 · 보통 · 높음」이고, Max는 있다고 치고 본 갈래다.
const 카본화면 = ({ 모델 = 'Argon', 단계 = '높음', 단계들 = ['낮음\nFast and efficient', '보통\n균형 잡힌 깊이', '높음\n매우 철저함', 'Max\n가장 깊게'], 칸 = null } = {}) => {
  const 화 = { 모델, 단계, 메뉴: false, 하위: false, 표시: {}, 누름: [] };
  const 항목 = (t) => ({ innerText: t, getBoundingClientRect: () => ({ width: 100, height: 20 }), setAttribute: (k, v) => { 화.표시[v] = t; }, removeAttribute: () => {} });
  const 모드칸 = () => (칸 ? 칸(화) : `모드 선택 도구 열기, 현재 ${화.모델} ${화.단계} 모드 사용 중`);
  const doc = {
    body: { innerText: '' },
    querySelector: (s) => (s.includes('Gemini 프롬프트 입력') ? { innerText: '' } : null),
    querySelectorAll(s) {
      if (s === 'button') return [{ getAttribute: () => 모드칸() }, { getAttribute: () => '업로드 및 도구' }];
      if (s === '[aria-label]') return [{ getAttribute: () => 'Google 계정: acct@example.test' }];
      if (s.startsWith('[data-synk=')) return [];
      if (s.includes('gem-menu-item')) return [...(화.메뉴 ? ['Quick answers\n3.5 Flash-Lite', '무엇이든 도움을 받으세요\n3.8 Flash', 'Code & analysis\n4 Argon', 'Most complex work\n4 카본', '사고 수준'] : []), ...(화.하위 ? 단계들 : [])].map(항목);
      return [];
    },
  };
  const 닫기 = () => { 화.메뉴 = false; 화.하위 = false; };
  const page = {
    url: async () => 'https://gemini.google.com/u/1/app', info: async () => ({}), cdp: async () => ({ windowId: 1, bounds: { windowState: 'normal' } }),
    goto: async () => {}, waitForTimeout: async () => {}, screenshot: async () => {}, close: async () => { 화.닫힘 = true; },
    click: async (sel) => {
      화.누름.push(sel);
      if (sel.includes('모드 선택 도구 열기')) 화.메뉴 = true;
      else if (sel.includes('data-synk="carbon"')) { 화.모델 = '카본'; 닫기(); }
      else if (sel.includes('data-synk="think"')) 화.하위 = true;
      else if (sel.includes('data-synk="lvl"')) { 화.단계 = 화.표시.lvl.split('\n')[0]; 닫기(); }
    },
    keyboard: { insertText: async () => {}, press: async (k) => { if (k === 'Escape') 닫기(); } },
    evaluate: async (fn, arg) => new Function('document', 'location', 'arg', `return (${fn.toString()})(arg);`)(doc, { href: 'https://gemini.google.com/u/1/app', pathname: '/u/1/app' }, arg),
  };
  return { 화, page };
};
const 확인돌리기 = async (화면) => {
  const dir = 임시();
  const job = { 이름: '계정 확인', files: [], prompt: '', out: path.join(dir, '확인.md'), shots: dir, space: 웹.기본공간, head: '계정 확인', answerMin: 1 };
  const steps = [];
  const old = { taskSpace: globalThis.taskSpace, listTaskSpaces: globalThis.listTaskSpaces, JOB: globalThis.JOB, log: console.log };
  globalThis.listTaskSpaces = async () => [{ name: 웹.기본공간, profileId: 웹.기본프로필 }];
  globalThis.taskSpace = async () => ({ pages: async () => [], newPage: async () => 화면.page });
  console.log = (s) => steps.push(JSON.parse(s));
  try {
    const AsyncFunction = (async () => {}).constructor;
    let 오류 = null;
    try { await new AsyncFunction(웹.페이지글(job, 1, '확인', 'acct'))(); } catch (e) { 오류 = e; }
    return { steps, 오류 };
  } finally {
    globalThis.taskSpace = old.taskSpace; globalThis.listTaskSpaces = old.listTaskSpaces; globalThis.JOB = old.JOB; console.log = old.log;
  }
};

test('페이지 스크립트(카본 고르기) — 확인은 보내기 없이 아르곤 → 카본, 사고 수준 하위 메뉴의 가장 높은 단계(Max)까지 고르고 닫는다', async () => {
  const 화면 = 카본화면();
  const { steps, 오류 } = await 확인돌리기(화면);
  assert.equal(오류, null, 오류 && 오류.message);
  const 모드 = steps.find((x) => x.step === 'mode');
  assert.deepEqual([모드.level, 모드.rank], ['Max', 3]);
  assert.match(모드.mode, /현재 카본 Max 모드/);
  assert.deepEqual(steps.find((x) => x.step === 'levels').단계, ['낮음', '보통', '높음', 'Max']);
  assert.ok(steps.some((x) => x.step === 'done'));
  assert.equal(화면.화.닫힘, true);
  assert.ok(화면.화.누름.some((s) => s.includes('data-synk="carbon"')), '모델을 카본으로 바꿨다');
  assert.ok(!화면.화.누름.some((s) => /메시지 보내기|파일 업로드/.test(s)), '확인은 올리거나 보내지 않는다');
});

test('페이지 스크립트(카본 고르기) — max가 없는 판은 그 판의 가장 높은 단계, 이미 카본이면 모델은 그대로', async () => {
  const 화면 = 카본화면({ 모델: '카본', 단계: '보통', 단계들: ['낮음', '보통', '높음\n매우 철저함'] });
  const { steps, 오류 } = await 확인돌리기(화면);
  assert.equal(오류, null, 오류 && 오류.message);
  assert.deepEqual([steps.find((x) => x.step === 'mode').level, steps.find((x) => x.step === 'mode').rank], ['높음', 2]);
  assert.ok(!화면.화.누름.some((s) => s.includes('data-synk="carbon"')), '이미 카본이면 모델 항목을 누르지 않는다');
});

test('페이지 스크립트(카본 고르기) — 모드 칸에 고른 단계가 안 보이면 맞다고 하지 않고 멈춘다(보내지 않음)', async () => {
  const 화면 = 카본화면({ 칸: (화) => `모드 선택 도구 열기, 현재 ${화.모델} 모드 사용 중` });
  const { steps, 오류 } = await 확인돌리기(화면);
  assert.ok(오류, '멈춘다');
  assert.match(오류.message, /모드가 카본 · 사고 수준 가장 높은 단계\(Max\)가 아님/);
  assert.ok(!steps.some((x) => x.step === 'done'));
});
