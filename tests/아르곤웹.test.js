'use strict';
// 아르곤웹(tools/아르곤웹.js · tools/아르곤웹.mjs) — 브라우저 · 차례 · 네트워크 없이 인자 · 작업 · 결과 가르기 · 지시문 점검과
// 페이지 스크립트의 지킬 것(읽기는 주소를 옮기지 않는다 · 보내기 직전 표시 · 글 파일은 이름으로)을 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
  assert.match(문제({ files: [], prompt: 'x'.repeat(4301), out: '답.md' }), /4301자 — 4300자를 넘으면/);
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
  assert.equal(JOB.profile, 'Profile 2', '11-07부터 구글 로그인은 ego 「유호 (Chrome)」 프로필에만 있다');
  assert.notEqual(웹.기본공간, 'synk-argon-web', '옛 이름 공간은 「유호」(Profile 1) 그대로 열려 로그아웃 화면이다');
  assert.ok(s.includes('await taskSpace(space, { profileId: profile })'));
  assert.ok(/oldSpace \? await taskSpace\(space\) :/.test(s), '이미 있는 공간에 profileId를 넘기면 ego가 막는다 — 있으면 이름만으로 연다(11-07 두 번째 실행 실패)');
  assert.ok(s.indexOf('listTaskSpaces()') < s.indexOf('await taskSpace('), '공간이 있는지 먼저 본다');
  assert.equal(JSON.parse(웹.페이지글(j, 5, '확인').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, '')).account, '', '계정을 안 주면 대조하지 않는다');
  const oj = 오마주.argonJob(path.join('C:', 'x', 'yt_abc'), path.join('C:', 'x', 'yt_abc', '원본.mp4'), '첫 분석');
  const OJ = JSON.parse(웹.페이지글(oj, 1, '보내기').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.equal(OJ.space, 'synk-homage-argon-p2', '오마주도 11-07 Profile 2 새 공간(옛 synk-homage-argon은 「유호」 프로필)');
  assert.equal(OJ.profile, 'Profile 2');
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
  const 재사용 = 빈탭.split('\n').find((l) => l.includes('await task.pages()')) || '';
  assert.match(재사용, /about:blank/, '다시 쓰는 탭은 빈 탭뿐');
  assert.match(재사용, /new-\?tab/, 'ego의 빈 탭은 chrome://new-tab-page/로 보인다(10-31)');
  assert.doesNotMatch(재사용, /gemini|\/app/, '대화가 열린 탭은 다시 쓰지 않는다');
  assert.match(빈탭, /return await task\.newPage\(\)/, '빈 탭이 없으면 새 탭');
  // 보내기 — 빈 탭에서 첫 화면(계정 대조) → 누르기 직전 표시 → 보내기
  assert.match(보내기, /^\n\} else \{\r?\n\s*page = await 빈탭\(\);/, '보내기 · 확인은 빈 탭 — 답이 생기는 중인 탭을 옮기지 않는다');
  assert.ok(보내기.indexOf('await 첫화면()') < 보내기.indexOf('await writeMark(null)'), '계정 대조(첫화면)는 올리기 · 보내기 전에');
  assert.ok(보내기.indexOf('await writeMark(null)') < 보내기.indexOf('aria-label="메시지 보내기"'), '보내기를 누르기 전에 표시를 쓴다');
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
