'use strict';
// 올리기 전 검사(10-21)의 판단 부분 — 게시글 규칙, 준비.json 읽기, 끝 화면·정지 셈, 글자 인식 결과의 안전 영역 — 을 본다.
// 영상·글자 인식·네트워크는 부르지 않는다. 임시 폴더의 가짜 편 폴더만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 규칙 = require('../tools/lib/게시글규칙.js');
const 묶음 = require('../tools/lib/게시묶음.js');
const 정지 = require('../tools/정지구간.js');
const 검사 = require('../tools/올리기전검사.js');

const codes = (list) => list.map((f) => `${f.level}:${f.code}`);

test('첫 125자 안의 해시태그·링크·인사는 고칠 것, 뒤쪽은 괜찮다', () => {
  const long = '42초짜리 쇼츠를 재 보니, 24초가 멈춰 있었어요. ' + '가'.repeat(120);
  assert.deepEqual(codes(규칙.checkPlate({ caption: `${long}\n#쇼츠만들기 https://synk.im/builds/` }, { brand: 'yuhobuilds', language: 'ko', platform: 'instagram' })), []);
  const bad = 규칙.checkPlate({ caption: '#AI활용 오늘의 팁 synk.im/brief/ 를 보세요' }, { brand: 'synkbrief', language: 'ko', platform: 'instagram' });
  assert.ok(codes(bad).includes('고칠 것:first125-hashtag'));
  assert.ok(codes(bad).includes('고칠 것:first125-link'));
  assert.ok(codes(bad).includes('고칠 것:relative-date'), '「오늘」');
  assert.ok(codes(규칙.checkPlate({ caption: '안녕하세요! 오늘은…' }, { brand: 'synkbrief', language: 'ko', platform: 'instagram' })).includes('고칠 것:first125-greeting'));
});

test('인스타 해시태그는 캡션과 첫 댓글을 합쳐 다섯까지, 숫자만인 #5는 해시태그가 아니다', () => {
  const ok = 규칙.checkPlate({ caption: '훅 문장\n\n#가 #나 #다', firstComment: '질문? #라 #마' }, { brand: 'yuhobuilds', language: 'ko', platform: 'instagram' });
  assert.ok(!codes(ok).includes('고칠 것:hashtag-count'));
  const over = 규칙.checkPlate({ caption: '훅 문장\n\n#가 #나 #다 #바', firstComment: '#라 #마' }, { brand: 'yuhobuilds', language: 'ko', platform: 'instagram' });
  assert.ok(codes(over).includes('고칠 것:hashtag-count'));
  assert.deepEqual(규칙.hashtags('IDIOM QUIZ #5 · C# · #learnkorean'), ['#learnkorean']);
});

test('유튜브 제목은 100자·꺾쇠 금지, 설명은 5,000바이트', () => {
  const r = 규칙.checkPlate({ title: '<b>제목</b>', caption: '설명 첫 줄' }, { brand: 'synkbrief', language: 'ko', platform: 'youtube' });
  assert.ok(codes(r).includes('고칠 것:title-angle'));
  assert.ok(codes(규칙.checkPlate({ title: 'ㄱ'.repeat(101), caption: 'x' }, { brand: 'synkbrief', language: 'ko', platform: 'youtube' })).includes('고칠 것:title-length'));
  assert.ok(codes(규칙.checkPlate({ title: '제목', caption: '가'.repeat(1700) }, { brand: 'synkbrief', language: 'ko', platform: 'youtube' })).includes('고칠 것:description-length'));
  assert.ok(codes(규칙.checkPlate({ caption: '설명' }, { brand: 'synkbrief', language: 'ko', platform: 'youtube' })).includes('고칠 것:no-title'));
});

test('상대 날짜는 그 판의 언어로 본다 — LAB 외국어판의 한국어 낱말은 교재 내용이라 넘긴다', () => {
  const en = 규칙.checkText('Learn this today: 오늘 날씨가 좋아요', { where: '설명', brand: 'LAB', language: 'en', platform: 'youtube' });
  assert.deepEqual(en.map((f) => f.message.match(/「(.+?)」/)[1]), ['today']);
  const mn = 규칙.checkText('Өнөөдөр 3 хэлц үг · 내일 봐요', { where: '캡션', brand: 'LAB', language: 'mn', platform: 'instagram' });
  assert.deepEqual(mn.map((f) => f.code), ['relative-date']);
  assert.match(mn[0].message, /өнөөдөр/);
  assert.deepEqual(규칙.checkText('10월 23일 21시에 공개', { where: '캡션', brand: 'synkbrief', language: 'ko', platform: 'instagram' }), []);
});

test('내부 번호·만든 도구 이름·LAB의 AI 이름', () => {
  const r = 규칙.checkText('v6 판은 Typecast 목소리 · docs/마케팅/a.md 참고 · 장부 S17', { where: '캡션', brand: 'synkbrief', language: 'ko', platform: 'instagram' });
  assert.deepEqual(codes(r).sort(), ['고칠 것:internal-code', '고칠 것:internal-code', '고칠 것:internal-code', '고칠 것:maker-tool', '확인할 것:internal-code-maybe'].sort());
  assert.deepEqual(규칙.checkText('ChatGPT 대화 잠그는 법', { where: '캡션', brand: 'synkbrief', language: 'ko', platform: 'instagram' }), []);
  assert.deepEqual(codes(규칙.checkText('ChatGPT로 공부해요', { where: '캡션', brand: 'LAB', language: 'ko', platform: 'instagram' })), ['고칠 것:ai-name']);
  assert.deepEqual(규칙.checkText('ffmpeg -i 내영상.mp4 로 잽니다', { where: '캡션', brand: 'yuhobuilds', language: 'ko', platform: 'instagram' }), [], '따라 하는 법의 파일 이름은 둔다');
  const blog = 규칙.checkText('Remotion으로 만든 과정 · tools/정지구간.js', { where: '블로그', brand: 'yuhobuilds', language: 'ko', platform: 'blog', article: true });
  assert.deepEqual(codes(blog).sort(), ['확인할 것:internal-code', '확인할 것:maker-tool']);
});

test('숫자 대조: 조사가 붙은 단위, 한국어 숫자말, 옛 숫자를 찾는다', () => {
  assert.deepEqual(규칙.numbers('가로 270픽셀로 줄이고 24초가 2.5초(6%)가 됐어요'), ['270px', '24초', '2.5초', '6%']);
  assert.deepEqual(규칙.spelledNumbers('사십이 초 쇼츠를 재 보니, 이십사 초가 · 이 점 오 초 · 육 퍼센트'), ['42초', '24초', '2.5초', '6%']);
  assert.equal(규칙.sinoToNumber('천이백삼십사'), 1234);
  const found = 규칙.compareNumbers([{ name: '블로그 티스토리.md', text: '24초가 2초(5%)가 됐습니다. 기준은 15%.' }], ['24초 → 2.5초(6%), 기준 15% 이하']);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /2초 · 5%/);
  assert.equal(found[0].level, '확인할 것');
});

function 편만들기(root, name, prep, files = {}) {
  const dir = path.join(root, 'docs', '마케팅', name);
  fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify(prep));
  return dir;
}

test('준비.json 판을 한 모양으로 — 원고.json 판, md 코드 블록 판, 사본만 적힌 판의 원본 짐작, 편 머리의 AI·아동용·언어', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '올리기전검사-'));
  fs.mkdirSync(path.join(root, 'tools'));
  try {
    fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '마케팅', 'sns-계정.json'), JSON.stringify({ accounts: {
      'lab-youtube': { platform: 'youtube', madeForKids: false }, 'lab-instagram': { platform: 'instagram' },
      'yuhobuilds-instagram': { platform: 'instagram' }, 'yuhobuilds-youtube': { platform: 'youtube' }, 'shift-tistory': { platform: 'tistory' } } }));
    const lab = 편만들기(root, 'LAB_시험', { 브랜드: 'LAB', 슬롯: '2026-10-23', 판: [
      { 계정: 'lab-youtube', 파일: '게시/01-youtube-en/video.mp4', 게시글: '게시/01-youtube-en/게시문안.txt' },
      { 계정: 'lab-instagram', 파일: '게시/02-mn/upload_10MB.mp4', 원본: '게시/02-mn/video.mp4', 게시글: '게시/02-mn/캡션_mn.txt' },
    ] }, {
      '게시/01-youtube-en/video.mp4': 'x', '게시/01-youtube-en/원고.json': JSON.stringify({ title: 'Quiz', caption: 'Guess!', language: 'en', audioLanguage: 'ko', alteredContent: false, madeForKids: false, pinnedComment: 'Score?' }),
      '게시/01-youtube-en/게시문안.txt': '[제목]\nQuiz\n\n[설명]\nGuess!', '게시/02-mn/video.mp4': 'x', '게시/02-mn/upload_10MB.mp4': 'x',
      '게시/02-mn/원고.json': JSON.stringify({ caption: 'Таагаарай!', firstComment: 'synk.im', language: 'mn' }), '게시/02-mn/캡션_mn.txt': 'Таагаарай!',
    });
    const [yt, ig] = 묶음.plates(묶음.load(lab));
    assert.equal(yt.platform, 'youtube');
    assert.deepEqual([yt.texts.title, yt.texts.caption, yt.texts.pinnedComment, yt.language, yt.audioLanguage, yt.ai, yt.kids], ['Quiz', 'Guess!', 'Score?', 'en', 'ko', false, false]);
    assert.equal(path.basename(ig.video.path), 'video.mp4');
    assert.equal(ig.video.from, '원본');
    assert.deepEqual([ig.texts.caption, ig.texts.firstComment, ig.language, ig.ai], ['Таагаарай!', 'synk.im', 'mn', null]);

    const md = ['# 게시 묶음', '## 인스타 릴스(@yuhobuilds)', '', '**캡션**', '', '```', '훅 문장', '#가', '```', '', '**첫 댓글(질문)**', '', '```', '몇 %예요? #나', '```',
      '', '## 유튜브 쇼츠(@yuhobuilds)', '', '**제목**', '', '```', '제목입니다', '```', '', '**설명란**', '', '```', '설명입니다', '```', '', '**고정 댓글**', '', '```', '고정', '```'].join('\n');
    const yuho = 편만들기(root, 'yuhobuilds_시험', { 브랜드: 'yuhobuilds', 슬롯: '2026-10-23', 'AI 표시': '켬(내레이션 AI 음성)', 아동용: '아님', '유튜브 언어': 'ko', 판: [
      { 계정: 'yuhobuilds-instagram', 파일: 'remotion/out/a_upload.mp4', 게시글: '게시/게시글.md' },
      { 계정: 'yuhobuilds-youtube', 파일: 'remotion/out/a_final.mp4', 게시글: '게시/게시글.md' },
      { 계정: 'shift-tistory', 파일: '게시/티스토리.md' },
    ] }, { 'remotion/out/a_upload.mp4': 'x', 'remotion/out/a_final.mp4': 'x', '게시/게시글.md': md, '게시/티스토리.md': '> 메모 준비.json\n\n**제목**\n\n글 제목\n\n**본문**\n\n24초' });
    const b = 묶음.load(yuho);
    const [yi, yy, tistory] = 묶음.plates(b);
    assert.deepEqual([yi.texts.caption, yi.texts.firstComment, yi.ai, yi.language], ['훅 문장\n#가', '몇 %예요? #나', true, 'ko']);
    assert.deepEqual([path.basename(yi.video.path), yi.video.from, yi.video.reduced], ['a_final.mp4', '추정', false]);
    assert.deepEqual([yy.texts.title, yy.texts.caption, yy.texts.pinnedComment, yy.kids, yy.language], ['제목입니다', '설명입니다', '고정', false, 'ko']);
    assert.equal(tistory.blog, true);
    const [doc] = 묶음.companionTexts(b);
    assert.equal(doc.scheduled, true);
    assert.doesNotMatch(doc.text, /준비\.json/, '맨 위 메모는 올라가는 글이 아니다');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('틱톡 판(10-26) — 캡션 4,000자 · DM 약속은 고칠 것, 짝 틱톡 판이 없거나 끝 말이 DM · 고정 댓글 판과 같은 영상이면 확인할 것', () => {
  const tt = (caption) => codes(규칙.checkPlate({ caption }, { brand: 'yuhobuilds', language: 'ko', platform: 'tiktok' }));
  assert.ok(tt('훅 문장\n\n댓글에 「한줄」이라고 남겨 주시면 DM으로 보내 드려요').includes('고칠 것:tiktok-dm'));
  assert.ok(tt('훅 문장\n\n메시지로 보내 드릴게요').includes('고칠 것:tiktok-dm'));
  assert.ok(!tt('훅 문장\n\n한 줄 전문은 아래에 — 친구에게 보내 주세요').includes('고칠 것:tiktok-dm'), '친구에게 보내기는 DM 약속이 아니다');
  assert.ok(tt('가'.repeat(4001)).includes('고칠 것:caption-length'));
  assert.ok(!tt('가'.repeat(2500)).includes('고칠 것:caption-length'), '인스타 한도 2,200자보다 길어도 된다');
  // 매일 판 글 플랫폼(10-26): X는 한글 두 칸 · 주소 23칸으로 280칸, 스레드 500 · 링크드인 3,000 · 텔레그램 영상 설명 1,024자
  const len = (caption, platform) => codes(규칙.checkPlate({ caption }, { brand: 'yuhobuilds', language: 'ko', platform })).includes('고칠 것:caption-length');
  assert.deepEqual([규칙.xWeight('abc'), 규칙.xWeight('한글'), 규칙.xWeight('보기 https://synk.im/prompts')], [3, 4, 28]);
  assert.deepEqual([len('가'.repeat(140), 'x'), len('가'.repeat(141), 'x'), len('a'.repeat(280), 'x')], [false, true, false]);
  assert.deepEqual([len('가'.repeat(500), 'threads'), len('가'.repeat(501), 'threads'), len('가'.repeat(3001), 'linkedin'), len('가'.repeat(1025), 'telegram')], [false, true, true, true]);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), '올리기전검사-'));
  fs.mkdirSync(path.join(root, 'tools'));
  try {
    fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '마케팅', 'sns-계정.json'), JSON.stringify({ accounts: {
      'yuhobuilds-instagram': { platform: 'instagram' }, 'yuhobuilds-youtube': { platform: 'youtube' }, 'yuhobuilds-tiktok': { platform: 'tiktok' },
      'lab-instagram': { platform: 'instagram' }, 'lab-facebook': { platform: 'facebook' }, 'lab-tiktok': { platform: 'tiktok' } } }));
    const files = {
      'out/ig.mp4': 'x', 'out/yt.mp4': 'x', 'out/tt.mp4': 'x',
      '게시/01-ig/원고.json': JSON.stringify({ caption: '훅', dm: { keyword: '한줄' } }),
      '게시/02-yt/원고.json': JSON.stringify({ title: '제목', caption: '설명', pinnedComment: '한 줄 전문' }),
      '게시/03-tt/원고.json': JSON.stringify({ caption: '훅 · 한 줄 전문' }),
    };
    const ig = { 계정: 'yuhobuilds-instagram', 파일: 'out/ig.mp4', 원고: '게시/01-ig/원고.json' };
    const yt = { 계정: 'yuhobuilds-youtube', 파일: 'out/yt.mp4', 원고: '게시/02-yt/원고.json' };
    const run = (name, 판, more = {}) => {
      const prep = { 브랜드: 'yuhobuilds', 슬롯: '2026-10-27', 판, ...more };
      return 검사.tiktokFindings(묶음.plates(묶음.load(편만들기(root, name, prep, files))), prep).map((f) => `${f.code}:${f.where}`);
    };
    assert.deepEqual(run('짝없음', [ig, yt]), ['tiktok-plate:yuhobuilds-instagram']);
    assert.deepEqual(run('까닭', [ig, yt], { 틱톡없음: '여러 장 편' }), []);
    assert.deepEqual(run('끝말판', [ig, yt, { 계정: 'yuhobuilds-tiktok', 파일: 'out/tt.mp4', 원고: '게시/03-tt/원고.json' }]), [], '끝 말만 바꾼 틱톡판');
    assert.deepEqual(run('인스타같음', [ig, yt, { 계정: 'yuhobuilds-tiktok', 파일: 'out/ig.mp4', 원고: '게시/03-tt/원고.json' }]), ['tiktok-ending:yuhobuilds-tiktok']);
    assert.deepEqual(run('유튜브같음', [ig, yt, { 계정: 'yuhobuilds-tiktok', 파일: 'out/yt.mp4', 원고: '게시/03-tt/원고.json' }]), ['tiktok-ending:yuhobuilds-tiktok']);
    // LAB 몽골 화면 글 편은 인스타 · 페북 · 틱톡이 같은 영상 · 같은 캡션이어도 된다(DM · 고정 댓글이 없다).
    const mn = { '게시/01-mn/video.mp4': 'x', '게시/01-mn/캡션_mn.txt': 'Таагаарай!' };
    const labPrep = (판) => ({ 브랜드: 'LAB', 슬롯: '2026-10-27', 판 });
    const labPlate = (계정) => ({ 계정, 파일: '게시/01-mn/video.mp4', 게시글: '게시/01-mn/캡션_mn.txt' });
    const labRun = (name, 판) => 검사.tiktokFindings(묶음.plates(묶음.load(편만들기(root, name, labPrep(판), mn))), labPrep(판)).map((f) => `${f.code}:${f.where}`);
    assert.deepEqual(labRun('LAB_짝없음', [labPlate('lab-instagram'), labPlate('lab-facebook')]), ['tiktok-plate:lab-instagram']);
    assert.deepEqual(labRun('LAB_짝', [labPlate('lab-instagram'), labPlate('lab-facebook'), labPlate('lab-tiktok')]), []);
    const [, , ttPlate] = 묶음.plates(묶음.load(편만들기(root, 'yuho_말', { 브랜드: 'yuhobuilds', 슬롯: '2026-10-27', 판: [ig, yt, { 계정: 'yuhobuilds-tiktok', 파일: 'out/tt.mp4', 원고: '게시/03-tt/원고.json' }] }, files)));
    assert.equal(ttPlate.language, 'ko', 'synkbrief · yuhobuilds 틱톡 판은 한국어로 본다');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('⑩ 매일 판 — 판 계정의 줄에서 빠진 계정은 확인할 것, 「빠진판」 · 「틱톡없음」 · 막힌 계정은 넘어가고, 짝 틱톡이 매일 판이면 ⑨는 말하지 않는다', () => {
  const known = {
    'lab-instagram': { platform: 'instagram', dailyLine: 'LAB 몽골' }, 'lab-facebook': { platform: 'facebook', dailyLine: 'LAB 몽골' },
    'lab-tiktok': { platform: 'tiktok', dailyLine: 'LAB 몽골' }, 'lab-telegram': { platform: 'telegram', dailyLine: 'LAB 몽골' },
    'lab-youtube': { platform: 'youtube', dailyLine: 'LAB 영어' },
    'yuhobuilds-instagram': { platform: 'instagram', dailyLine: 'yuhobuilds' }, 'yuhobuilds-x': { platform: 'x', dailyLine: 'yuhobuilds', dailyBlocked: '로그인' },
    'lab-us-youtube': { platform: 'youtube', dailyOff: '나라별' } };
  const plates = (...accounts) => accounts.map((account) => ({ account, video: { path: 'v.mp4' }, texts: {} }));
  const codes = (list, prep = {}) => 검사.dailyFindings(list, prep, known).map((f) => `${f.code}:${f.where}`);
  assert.deepEqual(codes(plates('lab-instagram', 'lab-facebook')), ['daily-plate:lab-tiktok', 'daily-plate:lab-telegram']);
  assert.deepEqual(codes(plates('lab-instagram', 'lab-facebook'), { 빠진판: { 'lab-tiktok': '여러 장 편', 'lab-telegram': '그날 다른 편' } }), []);
  assert.deepEqual(codes(plates('lab-instagram', 'lab-facebook', 'lab-telegram'), { 틱톡없음: '여러 장 편' }), [], '옛 「틱톡없음」도 받는다');
  assert.deepEqual(codes(plates('lab-instagram', 'lab-facebook'), { 빠진판: { 'lab-tiktok': ' ' } }), ['daily-plate:lab-tiktok', 'daily-plate:lab-telegram'], '빈 까닭은 까닭이 아니다');
  assert.deepEqual(codes(plates('yuhobuilds-instagram')), [], '막힌 계정은 판이 없어도 된다');
  assert.deepEqual(codes(plates('lab-youtube', 'lab-us-youtube')), [], '줄 하나에 계정 하나 · 매일 판 밖 계정은 줄을 만들지 않는다');
  assert.deepEqual(검사.tiktokFindings(plates('lab-instagram'), {}, known).filter((f) => f.code === 'tiktok-plate'), [], '짝 틱톡이 매일 판이면 ⑩이 본다');
  assert.equal(검사.tiktokFindings(plates('lab-instagram'), {}, {}).filter((f) => f.code === 'tiktok-plate').length, 1, '계정 표에 줄이 없으면 ⑨가 그대로 본다');
});

test('⑫ 한 편의 틱톡 판 둘이 같은 날(한국 시각)이면 고칠 것 — 버마어 판을 다음 날로 두면 통과(10-26 유호님)', () => {
  const tt = (account, time) => ({ account, platform: 'tiktok', time });
  const xhs = { account: 'lab-cn-xiaohongshu', platform: 'xiaohongshu', time: '2026-10-30T22:00:00+09:00' };
  const same = 검사.tiktokDayFindings([tt('lab-tiktok', '2026-10-30T21:00:00+09:00'), tt('lab-mm-tiktok', '2026-10-30T22:30:00+09:00'), xhs]);
  assert.deepEqual(same.map((f) => `${f.level}:${f.code}:${f.where}`), ['고칠 것:tiktok-same-day:lab-tiktok · lab-mm-tiktok']);
  assert.deepEqual(검사.tiktokDayFindings([tt('lab-tiktok', '2026-10-30T21:00:00+09:00'), tt('lab-mm-tiktok', '2026-10-31T22:30:00+09:00'), xhs]), [], '다음 날이면 된다 · 샤오훙수는 같은 날이어도 된다');
  // 한국 시각으로 나눈다 — 10-30 23:30 KST와 10-31 00:30 KST는 다른 날
  assert.deepEqual(검사.tiktokDayFindings([tt('lab-tiktok', '2026-10-30T14:30:00Z'), tt('lab-mm-tiktok', '2026-10-30T15:30:00Z')]), []);
});

test('영상 이름표는 편 폴더 기준 — 워크트리에서 돌려 영상이 공용 작업본에 있어도 같다', () => {
  const repo = path.join(os.tmpdir(), 'wt'), main = path.join(os.tmpdir(), 'main');
  const bundle = { repo, mediaRoot: main, dir: path.join(repo, 'docs', '마케팅', 'LAB_시험') };
  assert.equal(검사.labelOf(bundle, path.join(main, 'docs', '마케팅', 'LAB_시험', '게시', '01-mn', 'video.mp4')), '게시/01-mn/video.mp4');
  assert.equal(검사.labelOf(bundle, path.join(repo, 'docs', '마케팅', 'LAB_시험', 'remotion', 'out', 'a.mp4')), 'remotion/out/a.mp4');
});

test('참·거짓 칸 읽기', () => {
  assert.deepEqual(['켬(AI 음성)', '아님', true, 'false', '끔', '예', 'no', null, '모름'].map(묶음.yesNo), [true, false, true, false, false, true, false, null, null]);
});

test('끝 화면은 마지막 12초 안의 마지막 전체 컷부터 끝까지, 정지 기준은 그대로', () => {
  const frames = [];
  for (let i = 0; i <= 300; i++) {
    const t = i / 30;
    frames.push([t, t < 6 ? 2 : 0.05]); // 6초까지 계속 움직이고, 그 뒤 끝 화면 4초는 거의 멈춤
  }
  frames[180][1] = 25;
  const r = 정지.analyzeFrames(frames);
  assert.equal(Math.round(r.end.start * 10) / 10, 6);
  assert.ok(Math.abs(r.end.length - 4.03) < 0.05, String(r.end.length));
  assert.equal(r.pass, false, '끝 화면이 길이의 40%라 15% 기준을 넘는다');
  assert.equal(r.runs.length, 1);
  assert.equal(r.runs[0].endCard, true);
  const none = 정지.analyzeFrames(Array.from({ length: 200 }, (_, i) => [i / 30, 2]));
  assert.equal(none.end, null);
  assert.equal(none.pass, true);
});

test('글자 인식 줄의 안전 영역과 작은 글자 — 1080×1920 기준으로 늘려 본다', () => {
  const image = { width: 540, height: 960, lines: [
    { text: '제목 줄', words: [{ x: 40, y: 200, w: 300, h: 40 }] },
    { text: '오른쪽 끝 글', words: [{ x: 300, y: 300, w: 200, h: 20 }] },
    { text: '작은 글자', words: [{ x: 60, y: 400, w: 100, h: 6 }] },
    { text: '毳鸞詹畚', words: [{ x: 60, y: 500, w: 100, h: 20 }] },
  ] };
  const lines = 검사.linesOf(image);
  assert.deepEqual(lines.map((l) => l.text), ['제목 줄', '오른쪽 끝 글', '작은 글자'], '드문 한자 줄은 무늬로 본다');
  assert.deepEqual(검사.problemsOf(lines[0]).map((p) => p.kind), []);
  assert.deepEqual(검사.problemsOf(lines[1]).map((p) => p.kind), ['right']);
  assert.deepEqual(검사.problemsOf(lines[2]).map((p) => p.kind), ['small']);
  assert.equal(검사.linesOf(image, { allowHan: true }).length, 4, '중국어판은 한자 줄을 둔다');
});

test('아르곤 검수(10-22)에서 나온 오탐 — 낱말 속 상대 날짜, 단위 뒤 다른 낱말, 띄움 없는 숫자말, 코드 블록 안 제목', () => {
  const ko = (s) => 규칙.checkText(s, { where: '캡션', brand: 'synkbrief', language: 'ko', platform: 'instagram' }).map((f) => f.code);
  for (const s of ['오늘날 AI는', '그제서야 알았다', '내일배움카드로', '자체 제작일 경우', '지원금일 때', '좋은 시작일 수 있다']) assert.deepEqual(ko(s), [], s);
  for (const s of ['오늘 배운 것', '어제 나온 기능', '이번 주에 바뀜']) assert.deepEqual(ko(s), ['relative-date'], s);
  assert.deepEqual(규칙.numbers('1원칙 · 1분기 · 2분할 · 1명령 · 24초가 · 3초간 · 270픽셀로 · 3명이'), ['24초', '3초', '270px', '3명']);
  assert.deepEqual(규칙.spelledNumbers('구분에 따라 · 이분법 · 사십이 초'), ['42초']);
  const md = ['## 인스타 릴스', '', '**캡션**', '', '```', '# 이건 캡션 속 주석', '본문', '```', '', '## 유튜브'].join('\n');
  assert.deepEqual(묶음.parseMarkdown(md, 'instagram'), { caption: '# 이건 캡션 속 주석\n본문' });
});

test('가져갈 프롬프트(10-22) — yuhobuilds 편만, 칸이 없으면 확인할 것, 있으면 항목·공개 페이지를 본다', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '올리기전검사-프롬프트-'));
  try {
    const data = path.join(root, 'docs', '마케팅', '맞춤도구', 'prompts');
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, '프롬프트.json'), JSON.stringify({ 항목: [{ id: 'still-time' }] }));
    const page = (status, body) => async () => ({ status, text: async () => body });
    const ok = { 브랜드: 'yuhobuilds', 슬롯: '2026-10-25', 프롬프트: { id: 'still-time', 주소: 'https://synk.im/prompts/#still-time' } };
    const run = (prep, fetchImpl, more = {}) => 검사.promptFindings(prep, { repo: root, fetchImpl, ...more }).then(codes);

    assert.deepEqual(await run({ 브랜드: 'LAB' }, page(200, '')), [], 'yuhobuilds 편만 본다');
    assert.deepEqual(await run({ 브랜드: 'yuhobuilds', 슬롯: '2026-10-25' }, page(200, '')), ['확인할 것:prompt-missing']);
    assert.deepEqual(await run({ 브랜드: 'yuhobuilds', 슬롯: '2026-10-22' }, page(200, '')), [], '10-23 슬롯 전 편은 짚지 않는다');
    assert.deepEqual(await run(ok, page(200, '<article class="item" id="still-time">')), []);
    assert.deepEqual(await run(ok, page(200, '<article id="other">')), ['고칠 것:prompt-unpublished'], '200이어도 그 항목이 공개본에 없으면 고친다');
    assert.deepEqual(await run(ok, page(404, '')), ['고칠 것:prompt-page']);
    assert.deepEqual(await run(ok, async () => { throw Object.assign(new Error('끊김'), { name: 'TypeError' }); }), ['확인할 것:prompt-unknown']);
    assert.deepEqual(await run({ 브랜드: 'yuhobuilds', 슬롯: '2026-10-25', 프롬프트: { id: 'nope', 주소: 'https://synk.im/prompts/#nope' } }, page(200, 'id="nope"')), ['고칠 것:prompt-item']);
    assert.deepEqual(await run({ 브랜드: 'yuhobuilds', 슬롯: '2026-10-25', 프롬프트: { id: 'still-time', 주소: 'synk.im/prompts' } }, page(200, 'id="still-time"')), ['고칠 것:prompt-url']);
    assert.deepEqual(await run(ok, page(404, ''), { skipLinks: true }), [], '--링크건너뛰기면 공개 페이지는 열지 않는다');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// ── 10-28 관문 넓히기(유호님 「반영해」) — 흰 기본 글자 · 목소리 ──
function 회색판(w, h, 바탕) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) g[y * w + x] = 바탕(x, y);
  return g;
}
// 글자 줄 상자(1080 기준 x 100~1000 · y 400~520 → 540 폭 회색 칸 50~500 · 200~260) 안에 세로 획을 5칸 간격으로 긋는다(흰 칸 약 20%)
function 획긋기(g, w, { 외곽선 = false } = {}) {
  for (let y = 205; y < 255; y += 1) for (let x = 52; x < 498; x += 5) {
    g[y * w + x] = 250;
    if (외곽선) for (const dx of [-2, -1, 1, 2]) if (g[y * w + x + dx] !== 250) g[y * w + x + dx] = 20;
  }
  return g;
}
const 줄상자 = { x0: 100, x1: 1000, y0: 400, y1: 520 };

test('흰 기본 글자 — 판 · 테두리 없이 얼룩진 그림 위 흰 글자만 잡는다(10-28 LAB E8 끝 화면)', () => {
  const w = 540, h = 960;
  const 그림 = (x, y) => 90 + ((x * 7 + y * 13) % 5) * 22; // 얼룩진 중간 밝기 그림(표준편차 30 남짓)
  assert.equal(검사.plainWhite(획긋기(회색판(w, h, 그림), w), w, h, 줄상자).plain, true, '그림 위 흰 글자');
  assert.equal(검사.plainWhite(획긋기(회색판(w, h, () => 30), w), w, h, 줄상자).plain, false, '어두운 판 위 흰 글자는 바탕이 고르다');
  assert.equal(검사.plainWhite(획긋기(회색판(w, h, 그림), w, { 외곽선: true }), w, h, 줄상자).plain, false, '외곽선 · 그림자가 있으면 읽힌다');
  assert.equal(검사.plainWhite(회색판(w, h, (x, y) => (y > 200 && y < 260 && x % 9 ? 245 : 60)), w, h, 줄상자).plain, false, '흰 칸이 42% 넘으면 흰 판 · 도장이다');
  assert.equal(검사.plainWhite(회색판(w, h, 그림), w, h, 줄상자).plain, false, '흰 글자가 없으면 아니다');
});

// 16비트 모노 wav(48kHz)
function wav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(48000, 24);
  head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, data]));
}
const 사인 = (hz, 크기 = 0.5, 초 = 0.6) => Array.from({ length: 48000 * 초 }, (_, i) => 크기 * Math.sin((2 * Math.PI * hz * i) / 48000));

test('⑭ 목소리 — 렌더에 쓰는 줄 파일만 찾고, 560Hz 넘음 · 원본 잘림 · 영상보다 나중에 만든 줄은 고칠 것(10-28)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '올리기전검사-목소리-'));
  try {
    const 편 = path.join(root, 'docs', '마케팅', 'LAB_시험_20261028');
    fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
    fs.mkdirSync(path.join(편, '게시'), { recursive: true });
    fs.writeFileSync(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: '2026-11-01', 판: [] }));
    const vo = path.join(편, 'remotion', 'public', 'vo');
    wav(path.join(vo, 'n1.wav'), 사인(650)); // 「Nope!」처럼 뒤집히는 높이
    wav(path.join(vo, 'b1.wav'), 사인(180)); // 범수 높이
    wav(path.join(vo, 'b2.wav'), 사인(200, 1.4)); // 꽉 차게 잘린 원본
    const video = path.join(편, '게시', 'video.mp4');
    fs.writeFileSync(video, 'x');
    const 렌더 = Date.parse('2026-10-28T01:00:00Z');
    fs.utimesSync(video, 렌더 / 1000, 렌더 / 1000);
    fs.writeFileSync(path.join(vo, 'vo.json'), JSON.stringify({ tool: 'tools/나레이션굽기.mjs', made: '2026-10-28T03:00:00Z',
      lines: [{ id: 'n1', src: 'n1.wav' }, { id: 'b1', src: 'b1.wav' }, { id: 'b2', src: 'b2.wav' }] }));
    wav(path.join(편, '음성', '억양시험', 'x1.wav'), 사인(700)); // 시험 폴더는 렌더에 안 들어간다
    fs.writeFileSync(path.join(편, '음성', '억양시험', 'vo.json'), JSON.stringify({ tool: 'tools/나레이션굽기.mjs', made: '2026-10-28T03:00:00Z', lines: [{ id: 'x1', src: 'x1.wav' }] }));
    const bundle = 묶음.load(편);
    assert.deepEqual(검사.voiceFiles(bundle).map((v) => v.id).sort(), ['b1', 'b2', 'n1']);
    const r = await 검사.voiceFindings(bundle, [video]);
    const by = Object.fromEntries(r.findings.map((f) => [f.code, f]));
    assert.equal(by['voice-pitch'].level, '고칠 것');
    assert.match(by['voice-pitch'].message, /n1 65\dHz/);
    assert.doesNotMatch(by['voice-pitch'].message, /b1/);
    assert.match(by['voice-clipped'].message, /b2 \d+표본/);
    assert.match(by['voice-newer'].message, /3개/, 'vo.json 만든 때가 영상보다 늦으면 다시 산 목소리가 안 들어간 것');
    assert.equal(r.summary.줄, 3);
    // 영상이 줄보다 나중이면 「영상보다 나중」은 없다 — wav 수정 시각이 아니라 vo.json 만든 때로 본다
    fs.utimesSync(video, (렌더 + 6 * 3600e3) / 1000, (렌더 + 6 * 3600e3) / 1000);
    assert.equal((await 검사.voiceFindings(bundle, [video])).findings.some((f) => f.code === 'voice-newer'), false);
    // 준비.json 「목소리」에 적으면 그 폴더만 본다
    bundle.prep.목소리 = ['음성/억양시험'];
    assert.deepEqual(검사.voiceFiles(bundle).map((v) => v.id), ['x1']);
    // 줄 파일이 없는데 대본이 있으면 확인할 것
    const none = await 검사.voiceFindings(bundle, [video], { files: [], scriptText: '말이 있다' });
    assert.deepEqual(none.findings.map((f) => `${f.level}:${f.code}`), ['확인할 것:voice-none']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('⑭ 목소리 엉킴 — 목소리마다 프레임 가중 평균, 기본음 165Hz 이상인 목소리만 15%를 넘으면 고칠 것(남자 목소리는 결함 없이도 높다)', () => {
  const out = [
    'C:/e/vo/n1.wav\t엉킨 프레임   5.9% · 최악 3프레임 0.39 · 중앙 0.02 · 프레임 34 · 최고 음높이 594Hz ⚠ 높아 뒤집힐 수 있음 · 중앙 기본음 470Hz',
    'C:/e/vo/n3.wav\t엉킨 프레임  28.6% · 최악 3프레임 0.53 · 중앙 0.13 · 프레임 28 · 최고 음높이 617Hz ⚠ 높아 뒤집힐 수 있음 · 중앙 기본음 480Hz',
    'C:/e/vo/b1.wav\t엉킨 프레임  57.4% · 최악 3프레임 0.52 · 중앙 0.38 · 프레임 54 · 최고 음높이 178Hz · 중앙 기본음 120Hz',
    'C:/e/vo/s1.wav\t엉킨 프레임   0.0% · 최악 3프레임 0.10 · 중앙 0.01 · 프레임 40 · 최고 음높이 498Hz · 중앙 기본음 300Hz',
    'C:/e/vo/x.wav\t모음 없음',
  ].join('\n');
  const m = 검사.parseTangle(out);
  assert.deepEqual(m[path.resolve('C:/e/vo/n3.wav')], { pct: 28.6, frames: 28, f0: 480 });
  assert.equal(m[path.resolve('C:/e/vo/x.wav')], undefined);
  const files = [{ wav: 'C:/e/vo/n1.wav', voice: '하나' }, { wav: 'C:/e/vo/n3.wav', voice: '하나' }, { wav: 'C:/e/vo/b1.wav', voice: '범수' }, { wav: 'C:/e/vo/s1.wav', voice: '소진' }];
  assert.deepEqual(검사.tangledVoices(files, m), [{ voice: '하나', pct: 16.2, f0: 480, lines: 2 }], '범수 57%는 남자 목소리라 넘기고, 소진 0%는 깨끗하다');
});
