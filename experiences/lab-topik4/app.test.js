// SYNK LAB · TOPIK 4급 관심 등록 — 순수 함수와 화면 글 약속.
// 실행: node --test experiences/lab-topik4/app.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./src/copy.js');
const A = require('./src/app.js');

const FORM_PAGE_OPTIONS = {
  // 홈페이지 문의 구글 폼(2026-10-23 현행 분류)의 최종 선택지 글. 폼을 고치면 여기와 copy.js FORM을 함께 고친다.
  type: ['LAB · 한국어 교육', 'SHIFT · 학교·기업·기관 AI 강의', 'SHIFT · AI 강사·진로 강사 에이전시', 'SHIFT · AI 업무 자동화', 'PATH · 유학·취업 연계', 'PULSE · 제작 협업·작품 이용·광고', '출시 소식 문의'],
  consent: ['위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.'],
};

test('폼 고정 값은 구글 폼 선택지 글과 한 글자도 다르지 않다', () => {
  assert.ok(FORM_PAGE_OPTIONS.type.includes(C.FORM.typeValue));
  assert.ok(FORM_PAGE_OPTIONS.consent.includes(C.FORM.consentValue));
  assert.equal(C.ko.consent, C.FORM.consentValue, '한국어 화면의 동의 글은 기록되는 동의 글과 같아야 한다');
  assert.match(C.FORM.action, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
});

test('화면 언어: ?lang이 먼저, 그다음 기기 언어, 아니면 한국어', () => {
  assert.equal(A.pickLang('?lang=mn', ['ko-KR']), 'mn');
  assert.equal(A.pickLang('?lang=ko', ['mn-MN']), 'ko');
  assert.equal(A.pickLang('?lang=ru', ['mn']), 'mn');
  assert.equal(A.pickLang('', ['en-US', 'mn-MN']), 'mn');
  assert.equal(A.pickLang('', ['en-US']), 'ko');
  assert.equal(A.pickLang('', []), 'ko');
});

test('들어온 곳(?from)은 짧은 영소문자 이름만 받고 나머지는 direct', () => {
  assert.equal(A.fromKey('?from=univ-hanyang'), 'univ-hanyang');
  assert.equal(A.fromKey('?from=IG-Reel-01'), 'ig-reel-01');
  assert.equal(A.fromKey('?from=<script>'), 'direct');
  assert.equal(A.fromKey('?from=' + 'a'.repeat(41)), 'direct');
  assert.equal(A.fromKey('?from=-start'), 'direct');
  assert.equal(A.fromKey(''), 'direct');
});

test('이메일: 구글 폼이 거절할 꼴은 미리 막는다(no-cors라 거절이 화면에 안 보인다)', () => {
  for (const ok of ['a@b.mn', 'first.last+topik@example.com', 'x_y@mail.sub.example.org', 'Test@Example.COM']) assert.ok(A.validEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a@gmail..com', 'a@-mail.com', 'a@mail-.com', 'a@mail,com.mn', '.a@b.mn', 'a.@b.mn', 'a..b@b.mn', 'a b@b.mn', 'a@b.c', `${'a'.repeat(65)}@b.mn`]) assert.ok(!A.validEmail(bad), bad);
});

test('앞 사이트 주소는 보내지 않는다(안내문에 적은 것만 보낸다)', () => {
  assert.equal(A.refHost, undefined);
  assert.doesNotMatch(A.buildBody({ email: 'a@b.mn', level: 'has3', when: 'y2026', from: 'x', ref: 'instagram.com', lang: 'ko' }), /instagram|앞 사이트/);
});

test('검사: 이메일·급수·시기·동의는 꼭, 이름·시간·하고 싶은 말은 선택', () => {
  assert.deepEqual(Object.keys(A.validate({})).sort(), ['consent', 'email', 'level', 'when']);
  assert.deepEqual(A.validate({ email: 'a@b.mn', level: 'has3', when: 'y2026', consent: true }), {});
  assert.equal(A.validate({ email: 'a@b', level: 'has3', when: 'y2026', consent: true }).email, 'errEmail');
  assert.equal(A.validate({ email: 'a@b.mn', level: 'x', when: 'y2026', consent: true }).level, 'errPick');
  assert.equal(A.validate({ email: 'a@b.mn', level: 'has3', when: 'y2026', consent: 'yes' }).consent, 'errConsent');
});

test('보낼 값: 첫 줄 표식, 한국어 기록, 들어온 곳과 화면 언어, 동의 글', () => {
  const v = { name: ' 바트 ', email: ' bat@example.mn ', level: 'near3', when: 'h1-2027', time: 'evening', note: '54번 시간이 모자라요', from: 'club-mnsa-seoul', lang: 'mn', consent: true };
  const p = A.buildPayload(v);
  assert.equal(p.get(C.FORM.email), 'bat@example.mn');
  assert.equal(p.get(C.FORM.type), C.FORM.typeValue);
  assert.equal(p.get(C.FORM.consent), C.FORM.consentValue);
  const body = p.get(C.FORM.body).split('\n');
  assert.equal(body[0], C.FORM.marker);
  assert.ok(body.includes('이름: 바트'));
  assert.ok(body.includes('지금 급수: 3급 없음 · 비슷한 실력'));
  assert.ok(body.includes('4급이 필요한 때: 2027년 상반기'));
  assert.ok(body.includes('토요일 시간: 저녁'));
  assert.ok(body.includes('쓰기에서 어려운 점: 54번 시간이 모자라요'));
  assert.equal(body.at(-1), '들어온 곳: club-mnsa-seoul · 화면 언어 몽골어');
});

test('보낼 값: 선택 칸이 비면 그렇다고 적고, 긴 글·제어 문자는 자른다', () => {
  const body = A.buildBody({ email: 'a@b.mn', level: 'has3', when: 'unknown', note: `${'가'.repeat(400)}\u0007`, lang: 'ko' }).split('\n');
  assert.ok(body.includes('이름: (안 적음)'));
  assert.ok(body.includes('토요일 시간: (안 고름)'));
  const note = body.find(l => l.startsWith('쓰기에서 어려운 점: '));
  assert.equal(note.length, '쓰기에서 어려운 점: '.length + 300);
  assert.equal(body.at(-1), '들어온 곳: direct · 화면 언어 한국어');
});

test('「이메일을 고쳐 다시 등록하기」 뒤의 등록에는 다시 등록 줄이 붙는다', () => {
  const v = { email: 'a@b.mn', level: 'has3', when: 'y2026', lang: 'ko' };
  assert.ok(!A.buildBody(v).includes('다시 등록'));
  assert.match(A.buildBody({ ...v, resubmit: true }), /다시 등록: 앞서 보낸 등록의 이메일을 고쳐 다시 보냄/);
});

test('친구에게 보낼 주소는 from=friend로 바꾸고 화면 언어를 지킨다', () => {
  assert.equal(A.shareUrl('https://synk.im/lab/topik4/?from=univ-a&lang=ko#signup', 'mn'), 'https://synk.im/lab/topik4/?from=friend&lang=mn');
});

test('묶음: 「·」 말과 몽골어 서수 「4-р」는 줄이 갈리지 않게 한 칸으로', () => {
  assert.equal(A.keepDots('부가세·포함'), '<span class="nw">부가세·포함</span>');
  assert.match(A.keepDots('TOPIK 4-р түвшин'), /<span class="nw">4-р<\/span>/);
  assert.match(A.keepDots('51–54-р даалгавар'), /<span class="nw">51–54-р<\/span>/);
  assert.match(A.keepDots('оюутан 48%-иас 63%'), /<span class="nw">48%-иас<\/span>/);
  assert.equal(A.keepDots('<b>'), '&lt;b&gt;');
});

test('두 언어의 글 키·목록 길이가 같다', () => {
  assert.deepEqual(Object.keys(C.mn).sort(), Object.keys(C.ko).sort());
  for (const k of Object.keys(C.ko)) {
    if (Array.isArray(C.ko[k])) assert.equal(C.mn[k].length, C.ko[k].length, k);
  }
  for (const L of [C.LEVELS, C.WHEN, C.TIMES]) for (const o of L) assert.ok(o.ko && o.mn && o.record && o.id);
  assert.equal(C.WEEKS.length, 8);
});

test('화면 글 약속: 보장·할인·AI 도구 이름·「AI 생성」이 없고 조건은 결정 표와 같다', () => {
  // 공개되는 파일 전부(주석 포함) — 사이트에는 AI 도구 이름을 쓰지 않는다
  const all = JSON.stringify([C.ko, C.mn, C.WEEKS]) + ['src/index.html', 'src/app.js', 'src/page.css', 'src/copy.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('');
  for (const bad of [/보장|합격률|무제한|할인/, /Claude|GPT|Gemini|ChatGPT|Higgsfield|Codex|Argon/i, /AI 생성/]) assert.doesNotMatch(all, bad);
  // 사이트에 게임 링크를 새로 넣지 않는다(10-05 유호님) · 환불 기준점은 수업 시작
  assert.doesNotMatch(all, /\/try\//);
  assert.ok(C.ko.terms[2].d.includes('수업이 시작된 뒤 첫 2주'));
  const ko = JSON.stringify(C.ko);
  for (const must of ['30만 원', '부가세', '10명', '2027년 3월', '첫 2주', '전액', '합격이나 급수를 약속하지는 않아요']) assert.ok(ko.includes(must), must);
  const mn = JSON.stringify(C.mn);
  for (const must of ['300,000 вон', 'НӨАТ', '10 хүн', '2027 оны 3-р сард', '2 долоо хоног']) assert.ok(mn.includes(must), must);
  // 안내문은 실제로 보내는 것(이메일·이름·답 + 들어온 링크 표시·화면 언어)을 모두 적는다
  for (const must of ['이메일', '이름', '답', '링크 표시', '화면 언어', 'hello@synk.im']) assert.ok(C.ko.notice.includes(must), must);
  for (const must of ['имэйл', 'нэр', 'хариулт', 'холбоосны тэмдэглэгээ', 'дэлгэцийн хэл', 'hello@synk.im']) assert.ok(C.mn.notice.includes(must), must);
  // 화면 글은 해요체 한 목소리 — 합쇼체는 동의 문장(폼에 기록되는 글)만
  for (const [k, v] of Object.entries(C.ko)) if (typeof v === 'string' && k !== 'consent') assert.doesNotMatch(v, /(니다|십시오)[.!]?$|니다\. /, k);
});

test('첨삭 맛보기: 수업 자료 W3의 가상 학생 초안·기호 표시·한마디 세 줄과 글자 하나 다르지 않다', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/온라인반_TOPIK4급/쓰기과제.md'), 'utf8');
  assert.ok(doc.includes(C.SAMPLE.draft));
  for (const m of C.SAMPLE.marks) assert.ok(doc.includes(`「${m.q}」〔${m.code}〕`), m.q);
  for (const c of C.SAMPLE.comment) assert.ok(doc.includes(c.ko), c.ko);
  // 첨삭 기준: 고칠 곳은 다섯 곳까지, 잘 쓴 곳〔+〕은 한 곳 이상, 한마디는 세 줄
  assert.ok(C.SAMPLE.marks.filter(m => m.code !== '+').length <= 5);
  assert.ok(C.SAMPLE.marks.some(m => m.code === '+'));
  assert.equal(C.SAMPLE.comment.length, 3);
  for (const m of C.SAMPLE.marks) assert.ok(m.ko && m.mn, m.q);
  for (const c of C.SAMPLE.comment) assert.ok(c.mn, c.ko);
});

test('빌드 원고: 화면이 쓰는 그림이 원고 폴더에 있다', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  for (const m of html.matchAll(/assets\/(topik4-art-[\w-]+\.webp)/g)) assert.ok(fs.existsSync(path.join(__dirname, 'src/art', m[1])), m[1]);
});
