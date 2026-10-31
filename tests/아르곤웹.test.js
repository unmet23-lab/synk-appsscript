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
  const s = 웹.페이지글(j, '4', '보내기');
  const JOB = JSON.parse(s.split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.equal(JOB.mode, '보내기');
  assert.equal(JOB.u, 4);
  assert.ok(JOB.files.every((f) => !f.includes('\\')), JOB.files.join(','));
  assert.equal(JOB.mark, `${JOB.out}.보냄.json`);
  assert.equal(JOB.space, 웹.기본공간);
  assert.ok(s.includes('await taskSpace(space)'));
  const oj = 오마주.argonJob(path.join('C:', 'x', 'yt_abc'), path.join('C:', 'x', 'yt_abc', '원본.mp4'), '첫 분석');
  const OJ = JSON.parse(웹.페이지글(oj, 4, '보내기').split('\n')[0].replace(/^globalThis\.JOB = /, '').replace(/;$/, ''));
  assert.equal(OJ.space, 'synk-homage-argon', '오마주는 예전 작업 공간 그대로(밖의 읽기 스크립트가 그 공간을 본다)');
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
  assert.equal(웹.계정번호('gemini-a 계정 https://gemini.google.com/u/4/'), 4);
  assert.equal(웹.계정번호('gemini-b 계정 https://gemini.google.com/u/1/'), 1);
  assert.equal(웹.계정번호('쥔 줄 없음'), null);
  assert.equal(웹.종류('A_h1.jpg'), '사진');
  assert.equal(웹.종류('원본.MP4'), '영상');
  assert.equal(웹.종류('지시문_리더세트15_굽기전.txt'), '글');
  assert.equal(웹.칩이름('C:/x/현장노트_gemini사진_굽기전판.txt'), '현장노트_gemini사진_굽기전판');
});

test('페이지 스크립트 — 읽기는 주소를 옮기거나 누르지 않는다, 보내기는 새 탭 · 누르기 직전 표시 · 글 파일은 이름으로', () => {
  const s = fs.readFileSync(웹.페이지, 'utf8');
  const AsyncFunction = (async () => {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(s), '페이지 스크립트 문법');
  const 읽기 = s.slice(s.indexOf('if (mode === "읽기") {'), s.indexOf('} else {', s.indexOf('if (mode === "읽기") {')));
  assert.ok(읽기.length > 200, '읽기 갈래를 찾음');
  assert.doesNotMatch(읽기, /\.goto\(|\.click\(|\.reload\(|newPage\(/, '읽기는 탭을 옮기거나 새로 고치지 않는다(10-27 대화가 사라짐)');
  const 보내기 = s.slice(s.indexOf('} else {', s.indexOf('if (mode === "읽기") {')));
  assert.match(보내기, /page = await task\.newPage\(\)/, '보내기는 새 탭 — 답이 생기는 중인 탭을 옮기지 않는다');
  const 재사용 = 보내기.split('\n').find((l) => l.includes('await task.pages()')) || '';
  assert.match(재사용, /about:blank/, '다시 쓰는 탭은 빈 탭뿐');
  assert.match(재사용, /new-\?tab/, 'ego의 빈 탭은 chrome://new-tab-page/로 보인다(10-31)');
  assert.doesNotMatch(재사용, /gemini|\/app/, '대화가 열린 탭은 다시 쓰지 않는다');
  assert.ok(보내기.indexOf('await writeMark(null)') < 보내기.indexOf('aria-label="메시지 보내기"'), '보내기를 누르기 전에 표시를 쓴다');
  assert.match(s, /const chipN = files\.filter\(\(f\) => kind\(f\) !== "글"\)\.length/, '「첨부파일 닫기」로는 사진 · 영상만 센다(10-31 글 칩)');
  assert.match(s, /insertText\("\."\)/, '빈 입력창 모드 단추(10-31) — 「.」을 먼저 넣는다');
  assert.doesNotMatch(s, /\/u\/4\//, '계정 번호는 JOB.u로만');
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
