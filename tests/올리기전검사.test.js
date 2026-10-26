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
