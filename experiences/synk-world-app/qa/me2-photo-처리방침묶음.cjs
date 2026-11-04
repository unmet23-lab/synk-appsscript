'use strict';
// 「제2의 나」 사진 시범의 synk.im/privacy 공개 재료(2026-11-04): 공개본 HTML에 이 일의 줄만 정확히 한 번씩 얹은 두 폴더를 만든다.
// 공개본에는 10-30 · 10-31 개정이 직접 올라가 있어 원고(docs/개인정보처리방침_초안_v1.md)보다 앞서므로 원고에서 다시 그리지 않는다.
//   node experiences/synk-world-app/qa/me2-photo-처리방침묶음.cjs <개정일 YYYY-MM-DD> [--판 <글자>]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 날 = 값[0];
if (!/^\d{4}-\d{2}-\d{2}$/.test(날 || '')) throw Error('개정일 YYYY-MM-DD를 준다');
const 판자리 = 값.indexOf('--판'), 판 = 판자리 >= 0 ? 값[판자리 + 1] : '';
const OUT = path.join(공용작업본(ROOT), '.tmp', `me2-privacy-20261104${판 ? '-' + 판 : ''}`);
const [y, m, d] = 날.split('-').map(Number);
const 영월 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
execFileSync('git', ['-C', 사본, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore' });
const live = execFileSync('git', ['-C', 사본, '-c', 'core.autocrlf=false', 'show', 'FETCH_HEAD:privacy/index.html'], { maxBuffer: 1 << 28 }).toString('utf8');

const 뒤에 = (앵커, 더함) => [앵커, 앵커 + 더함];
const 자리 = [
  // 1항 — 처리하는 정보
  뒤에('<blockquote><p>아이의 얼굴과 이야기는 학원의 홍보 재료이기 전에 아이의 것입니다. 이 순서는 바뀌지 않습니다.</p></blockquote>',
    '\n    <p><strong>⑥ SYNK WORLD 「제2의 나」 내 사진으로 만들기 — 선택 항목이며 초대받은 만 18세 이상 시범 참여자만 해당합니다</strong></p>\n    <ul><li>본인이 고른 <strong>얼굴이 보이는 사진 1장</strong>과 그 사진으로 만든 모습, 본인이 고른 경우 「알려 주고 싶은 것」(안경·머리 가림·수염·휠체어·머리 길이·체격).</li><li>만든 모습이 본인과 닮았는지 확인하려고 얼굴을 숫자로 잠깐 견주지만, <strong>얼굴 특징은 저장하지 않고 본인 확인·다른 사람 찾기·광고에 쓰지 않습니다.</strong></li><li>기능 안에서 따로 동의를 받습니다. <strong>동의하지 않아도 게임은 똑같이 이용할 수 있고</strong>, 언제든 「사진으로 만든 모습 지우기」로 철회할 수 있습니다.</li></ul>'),
  // 4항 — 처리를 맡기는 곳
  뒤에('<tr><td><strong>OpenAI API</strong></td><td>SYNK-talk 앱의 음성 전사 · SYNK WORLD 말하기 연습과 드라마 말하기의 자동 피드백(녹음을 글로 옮기기)</td><td><strong>녹음 파일 원본</strong>(SYNK WORLD 말하기 연습 · 드라마 말하기: SYNK는 글로 옮긴 뒤 녹음을 저장하지 않음)</td></tr>',
    '<tr><td><strong>OpenAI API</strong></td><td>SYNK WORLD 「제2의 나」 내 사진으로 만들기(초대받은 시범 참여자가 동의한 경우만) — 이미지 생성</td><td><strong>얼굴 사진</strong>, 만든 모습, 고른 경우 알려 준 것, OpenAI가 계정을 직접 알아볼 수 없게 바꾼 남용 감시용 표식</td></tr><tr><td><strong>Supabase</strong> (Storage)</td><td>「제2의 나」 사진과 만든 모습 보관</td><td><strong>얼굴 사진</strong>(묶음이 끝나면 지움, 늦어도 25시간 안), 만든 모습</td></tr><tr><td><strong>Google Cloud Compute Engine</strong> (서울)</td><td>「제2의 나」 만든 모습이 본인과 닮았는지 숫자로 잠깐 견주는 SYNK 서버</td><td><strong>얼굴 사진</strong>, 만든 모습(저장하지 않음, 얼굴 특징은 확인 뒤 바로 버림)</td></tr>'),
  // 5항 — 보관
  뒤에('<tr><td><strong>사진·영상의 홍보 사용</strong></td><td>별도로 동의한 매체·목적·기간 안에서만 사용하며 철회 요청을 확인하면 추가 사용을 중단합니다.</td></tr>',
    '<tr><td><strong>「제2의 나」 사진</strong></td><td>원본 사진은 모습을 만든 직후 지웁니다. 만들지 못한 경우에도 지우며, 어떤 경우든 늦어도 25시간 안에 지웁니다. 만든 모습은 계정이 있는 동안 보관하고, 본인이 지우거나 계정을 지우면 함께 지웁니다. 서버 백업 사본에는 넣지 않습니다. 이미지 생성 서비스의 처리용 파일은 늦어도 25시간 안에 지우고, 그 회사의 남용 감시 기록은 최대 30일 남을 수 있습니다.</td></tr>'),
  // 변경 기록
  ['<p>2026년 10월 31일 변경: 드라마 말하기의 자동 피드백에서', `<p>${y}년 ${m}월 ${d}일 변경: SYNK WORLD 「제2의 나」 내 사진으로 만들기 시범(초대받은 만 18세 이상, 기능 안에서 따로 동의)의 항목과 처리업체, 보관 기준을 1·4·5항에 더했습니다.</p>\n    <p>2026년 10월 31일 변경: 드라마 말하기의 자동 피드백에서`],
  ['<td>이번 개정 시행일</td><td>2026-10-31</td>', `<td>이번 개정 시행일</td><td>${날}</td>`],
  ['<dt>이번 개정 / Revised</dt><dd>2026. 10. 31.</dd>', `<dt>이번 개정 / Revised</dt><dd>${y}. ${m}. ${d}.</dd>`],
  ['이번 개정 시행일: 2026년 10월 31일', `이번 개정 시행일: ${y}년 ${m}월 ${d}일`],
  // 영어
  뒤에('<li><strong>Optional photos, videos and activity outputs:</strong> publicity use requires a separate choice covering the media, purpose and period. Declining or withdrawing promotional use does not remove access to lessons, the app or progress records.</li>',
    '<li><strong>“Second me” photo in SYNK WORLD (optional; invited pilot participants aged 18 or older):</strong> one photo you choose that shows your face, the looks made from it and, if you choose them, the items you tell us about (glasses, covered hair, facial hair, wheelchair, hair length, build). A brief numeric comparison checks that a look resembles you; face features are not stored and are not used for identity checks, finding other people or advertising. Separate consent is requested in the feature. You can play the game just the same without it and can withdraw at any time by erasing your look.</li>'),
  뒤에('<tr><td>OpenAI API</td><td>SYNK-talk transcription; transcription for automatic feedback in SYNK WORLD speaking practice and Drama Speaking</td><td>Original audio (SYNK WORLD speaking practice and Drama Speaking: SYNK does not store the recording after transcription)</td></tr>',
    '<tr><td>OpenAI API</td><td>Image generation for “second me” in SYNK WORLD (invited pilot participants who agree in the feature)</td><td>Face photo, the looks made from it, items you chose to tell us and a hashed abuse-monitoring marker that does not let OpenAI identify your account directly</td></tr><tr><td>Supabase Storage</td><td>Storing “second me” photos and looks</td><td>Face photo (deleted when the batch ends, within 25 hours at the latest) and looks</td></tr><tr><td>Google Cloud Compute Engine (Seoul)</td><td>A SYNK server that briefly compares faces as numbers to check a “second me” look resembles the person</td><td>Face photo and looks (not stored; face features are discarded after the check)</td></tr>'),
  뒤에('<tr><td>Optional promotional photos and videos</td><td>Within the separately agreed media, purpose and period. Further use stops upon a verified withdrawal.</td></tr>',
    '<tr><td>“Second me” photos</td><td>The original photo is deleted right after the look is made, or if it cannot be made, and within 25 hours at the latest in any case. Looks are kept while the account exists and are deleted when the person erases them or deletes the account. They are not placed in server backup copies. Image-service processing files are deleted within 25 hours at the latest, and that company’s abuse-monitoring logs may remain for up to 30 days.</td></tr>'),
  ['The 31 October 2026 revision adds Microsoft Clarity', `The ${d} ${영월} ${y} revision adds the data, providers and retention for the invited “second me” photo pilot in SYNK WORLD (aged 18 or older, with separate consent in the feature). The 31 October 2026 revision adds Microsoft Clarity`],
  ['<td>This revision effective</td><td>31 October 2026</td>', `<td>This revision effective</td><td>${d} ${영월} ${y}</td>`],
];
let html = live;
for (const [from, to] of 자리) {
  if (html.split(from).length !== 2) throw Error('공개본에 정확히 한 번 있어야 한다: ' + from.slice(0, 70));
  html = html.replace(from, () => to);
}
fs.rmSync(OUT, { recursive: true, force: true });
for (const [dir, text] of [['base', live], ['new', html]]) {
  const file = path.join(OUT, dir, 'privacy', 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), 'privacy/index.html', '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
