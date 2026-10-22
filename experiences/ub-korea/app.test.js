// SYNK · 울란바토르 한국 유학 준비 관심 등록 — 순수 함수와 화면 글 약속, 회사 서버 분류와의 맞물림.
// 실행: node --test experiences/ub-korea/app.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const C = require('./src/copy.js');
const A = require('./src/app.js');

const FORM_PAGE_OPTIONS = {
  // 홈페이지 문의 구글 폼(2026-10-21 viewform에서 읽음 — 질문 번호 1425474537·1372278933·1000387687, 이메일은 응답자 입력)의 선택지 글.
  // 폼을 고치면 여기와 copy.js FORM·BRANCHES를 함께 고친다(experiences/lab-topik4/app.test.js와 같은 목록).
  type: ['LAB · 한국어 교육', 'SHIFT · 기관 강의·기업 컨설팅·브랜딩', 'SHIFT · 유학·취업 연계', 'PULSE · 제작 협업·작품 이용·광고', '출시 소식 문의'],
  consent: ['위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.'],
};
// 회사 서버(문의 5분 수집)의 분류 함수 — 이 화면이 보낸 응답이 서버에서 어떻게 갈리는지 같은 코드로 본다.
const SERVER = path.join(__dirname, '../../docs/마케팅/온라인마케팅지도/engagement/company/website-inquiry-service.mjs');
const TEST_MARK = '[SYNK 기능 점검 · 실제 문의 아님]';
const full = { name: '바트', email: 'bat@example.mn', interest: ['academy', 'consult'], who: 'parent', level: 'topik1', when: 'y2028', times: ['weekday-eve', 'saturday'], study: 'college', note: '고등학생도 다닐 수 있나요?', from: 'ub-num-korean', lang: 'mn', consent: true };

test('폼 고정 값은 구글 폼 선택지 글과 한 글자도 다르지 않다', () => {
  for (const b of C.BRANCHES) assert.ok(FORM_PAGE_OPTIONS.type.includes(b.typeValue), b.typeValue);
  assert.ok(FORM_PAGE_OPTIONS.consent.includes(C.FORM.consentValue));
  assert.equal(C.ko.consent, C.FORM.consentValue, '한국어 화면의 동의 글은 기록되는 동의 글과 같아야 한다');
  assert.match(C.FORM.action, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
  assert.deepEqual(C.BRANCHES.map(b => b.id), ['academy', 'consult']);
  // 첫 줄 표식은 갈래마다 다르고, 같은 앞머리로 이 페이지의 등록만 함께 거를 수 있다(TOPIK 4급 반 표식과도 다르다).
  const marks = C.BRANCHES.map(b => b.marker);
  assert.equal(new Set(marks).size, marks.length);
  for (const m of marks) assert.match(m, /^\[울란바토르 관심 등록 · .+\]$/);
});

test('회사 서버 분류: 학원은 「한국어 교육」, 유학 상담은 「유학·취업 연계」, 시험 표식이면 둘 다 「기능 점검」으로 빠진다', async () => {
  const { classifyWebsiteInquiry } = await import(pathToFileURL(SERVER).href);
  const row = (v, id) => { const p = A.buildPayload(v, id); return { type: p.get(C.FORM.type), message: p.get(C.FORM.body) }; };
  const academy = classifyWebsiteInquiry(row(full, 'academy'));
  const consult = classifyWebsiteInquiry(row(full, 'consult'));
  assert.equal(academy.category, 'lab');
  assert.equal(academy.label, '한국어 교육');
  assert.equal(consult.category, 'shift-career');
  assert.equal(consult.label, '유학·취업 연계');
  assert.equal(academy.isTest, false);
  // 종단 시험은 궁금한 점 칸에 시험 표식을 넣는다 — 두 응답 모두 고객 문의·실적에서 빠지고 할 일을 만들지 않는다.
  const probe = { ...full, note: `${TEST_MARK} [시험] 울란바토르 관심 등록 종단 확인` };
  for (const id of ['academy', 'consult']) {
    const c = classifyWebsiteInquiry(row(probe, id));
    assert.equal(c.category, 'test', id);
    assert.equal(c.isTest, true, id);
  }
});

test('화면 언어: ?lang이 먼저, 기기 언어가 한국어면 한국어, 아니면 몽골어', () => {
  assert.equal(A.pickLang('?lang=ko', ['mn-MN']), 'ko');
  assert.equal(A.pickLang('?lang=mn', ['ko-KR']), 'mn');
  assert.equal(A.pickLang('?lang=ru', ['ko']), 'ko');
  assert.equal(A.pickLang('', ['ko-KR', 'en-US']), 'ko');
  assert.equal(A.pickLang('', ['en-US', 'ru-RU']), 'mn');
  assert.equal(A.pickLang('', ['mn-MN']), 'mn');
  assert.equal(A.pickLang('', []), 'mn');
});

test('들어온 곳(?from)은 짧은 영소문자 이름만 받고 나머지는 direct — 영업 명단 PATH 줄 열 곳의 키는 그대로 받는다', () => {
  for (const k of ['ub-num-korean', 'ub-iuu-ksc', 'ub-humanities', 'ub-msue', 'ub-ubschool', 'ub-sejong4', 'org-kremb-mn', 'org-mnemb-seoul', 'org-mn-moe', 'org-topik-mn']) assert.equal(A.fromKey(`?from=${k}&lang=mn`), k);
  assert.equal(A.fromKey('?from=FB-UB-1022'), 'fb-ub-1022');
  assert.equal(A.fromKey('?from=<script>'), 'direct');
  assert.equal(A.fromKey('?from=' + 'a'.repeat(41)), 'direct');
  assert.equal(A.fromKey('?from=-start'), 'direct');
  assert.equal(A.fromKey(''), 'direct');
});

test('이메일: 구글 폼이 거절할 꼴은 미리 막는다(no-cors라 거절이 화면에 안 보인다)', () => {
  for (const ok of ['a@b.mn', 'first.last+ub@example.com', 'x_y@mail.sub.example.org', 'Test@Example.COM']) assert.ok(A.validEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a@gmail..com', 'a@-mail.com', 'a@mail-.com', 'a@mail,com.mn', '.a@b.mn', 'a.@b.mn', 'a..b@b.mn', 'a b@b.mn', 'a@b.c', `${'a'.repeat(65)}@b.mn`]) assert.ok(!A.validEmail(bad), bad);
});

test('검사: 이메일·관심(하나 이상)·누가·수준·시기·동의는 꼭, 나머지는 선택', () => {
  assert.deepEqual(Object.keys(A.validate({})), ['interest', 'who', 'level', 'when', 'email', 'consent'], '양식에 놓인 순서(첫 오류 칸으로 초점)');
  const ok = { email: 'a@b.mn', interest: ['consult'], who: 'student', level: 'none', when: 'unknown', consent: true };
  assert.deepEqual(A.validate(ok), {});
  assert.equal(A.validate({ ...ok, interest: [] }).interest, 'errInterest');
  assert.equal(A.validate({ ...ok, interest: ['vip'] }).interest, 'errInterest', '모르는 갈래는 고른 것으로 치지 않는다');
  assert.equal(A.validate({ ...ok, who: 'x' }).who, 'errPick');
  assert.equal(A.validate({ ...ok, consent: 'yes' }).consent, 'errConsent');
});

test('갈래: 고른 순서와 상관없이 학원 → 유학 상담, 끊긴 뒤에는 남은 것만', () => {
  assert.deepEqual(A.selectedBranches({ interest: ['consult', 'academy', 'vip'] }), ['academy', 'consult']);
  assert.deepEqual(A.selectedBranches({}), []);
  assert.deepEqual(A.pendingBranches(['academy', 'consult'], ['academy']), ['consult']);
  assert.deepEqual(A.pendingBranches(['academy', 'consult'], []), ['academy', 'consult']);
  assert.equal(A.doneKey(['academy', 'consult']), 'both');
  assert.equal(A.doneKey(['consult']), 'consult');
});

test('보낼 값(둘 다 고름): 갈래마다 문의 유형·첫 줄 표식이 다르고, 「함께 등록」 줄로 같은 사람인 줄 안다', () => {
  const a = A.buildPayload(full, 'academy');
  const c = A.buildPayload(full, 'consult');
  assert.equal(a.get(C.FORM.email), 'bat@example.mn');
  assert.equal(a.get(C.FORM.type), 'LAB · 한국어 교육');
  assert.equal(c.get(C.FORM.type), 'SHIFT · 유학·취업 연계');
  assert.equal(a.get(C.FORM.consent), C.FORM.consentValue);
  const ab = a.get(C.FORM.body).split('\n');
  const cb = c.get(C.FORM.body).split('\n');
  assert.equal(ab[0], '[울란바토르 관심 등록 · 학원]');
  assert.equal(cb[0], '[울란바토르 관심 등록 · 유학 상담]');
  for (const line of ['이름: 바트', '누가 적었나: 학부모', '학생 한국어: TOPIK 1~2급 정도', '한국에 가려는 때: 2028년', '궁금한 점: 고등학생도 다닐 수 있나요?']) {
    assert.ok(ab.includes(line), line);
    assert.ok(cb.includes(line), line);
  }
  assert.ok(ab.includes('다니기 좋은 때: 평일 저녁 · 토요일'));
  assert.ok(!cb.some(l => l.startsWith('다니기 좋은 때')), '상담 응답에는 학원 칸을 싣지 않는다');
  assert.ok(cb.includes('생각하는 유학: 대학 · 전문대'));
  assert.ok(!ab.some(l => l.startsWith('생각하는 유학')), '학원 응답에는 상담 칸을 싣지 않는다');
  assert.ok(ab.includes('함께 등록: 유학 상담'));
  assert.ok(cb.includes('함께 등록: 학원'));
  assert.equal(ab.at(-1), '들어온 곳: ub-num-korean · 화면 언어 몽골어');
  assert.equal(cb.at(-1), '들어온 곳: ub-num-korean · 화면 언어 몽골어');
});

test('보낼 값(하나만): 함께 등록 줄이 없고, 빈 선택 칸은 그렇다고 적고, 긴 글·제어 문자는 자른다', () => {
  const v = { email: 'a@b.mn', interest: ['academy'], who: 'student', level: 'unsure', when: 'unknown', note: `${'가'.repeat(400)}\u0007`, lang: 'ko' };
  const body = A.buildBody(v, 'academy').split('\n');
  assert.ok(!body.some(l => l.startsWith('함께 등록')));
  assert.ok(body.includes('이름: (안 적음)'));
  assert.ok(body.includes('다니기 좋은 때: (안 고름)'));
  const note = body.find(l => l.startsWith('궁금한 점: '));
  assert.equal(note.length, '궁금한 점: '.length + 300);
  assert.equal(body.at(-1), '들어온 곳: direct · 화면 언어 한국어');
  assert.throws(() => A.buildBody(v, 'vip'), /모르는 갈래/);
});

test('앞 사이트 주소는 보내지 않는다(안내문에 적은 것만 보낸다)', () => {
  assert.doesNotMatch(A.buildBody({ ...full, ref: 'facebook.com' }, 'academy'), /facebook|앞 사이트/);
});

test('다시 등록(이메일을 고침 · 일부만 보낸 뒤 답을 바꿈)에는 앞서 보낸 이메일을 적어 앞 응답과 짝지을 수 있다', () => {
  assert.ok(!A.buildBody(full, 'consult').includes('다시 등록'));
  assert.ok(A.buildBody({ ...full, resubmit: true, prevEmail: 'bat@exmple.mn' }, 'consult').split('\n').includes('다시 등록: 앞서 bat@exmple.mn로 보낸 등록을 고쳐 다시 보냄(앞 등록은 버림)'));
  assert.match(A.buildBody({ ...full, resubmit: true, prevEmail: ' BAT@example.mn ' }, 'academy'), /다시 등록: 앞서 같은 이메일로 보낸 등록을 고쳐 다시 보냄/);
  assert.match(A.buildBody({ ...full, resubmit: true }, 'academy'), /다시 등록: 앞서 같은 이메일로/);
});

test('답 지문: 이메일·갈래·문항이 바뀌면 달라지고(→ 모두 다시 등록), 동의·화면 언어만 바뀌면 그대로(→ 남은 갈래만)', () => {
  const k = A.answerKey(full);
  assert.equal(A.answerKey({ ...full, email: ' BAT@example.mn ', consent: false, lang: 'ko', from: 'x' }), k);
  for (const change of [{ email: 'b@example.mn' }, { interest: ['academy'] }, { who: 'student' }, { level: 'none' }, { when: 'y2027' }, { times: [] }, { study: 'graduate' }, { name: '도르지' }, { note: '다른 질문' }]) assert.notEqual(A.answerKey({ ...full, ...change }), k, JSON.stringify(change));
});

test('궁금한 점의 줄바꿈은 한 줄로 편다 — 문의 내용은 한 줄에 한 칸', () => {
  const body = A.buildBody({ ...full, note: '첫 줄\r\n\n  둘째 줄\n[울란바토르 관심 등록 · 유학 상담]' }, 'academy').split('\n');
  assert.ok(body.includes('궁금한 점: 첫 줄 / 둘째 줄 / [울란바토르 관심 등록 · 유학 상담]'));
  assert.equal(body.filter(l => l.startsWith('[울란바토르 관심 등록')).length, 1, '첫 줄 표식은 하나뿐');
});

test('꼭 고를 칸은 fieldset의 aria-required로 알리고, 입력에 required를 달지 않는다(보내기 전부터 :invalid로 읽히지 않게)', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  for (const f of ['who', 'level', 'when']) assert.match(html, new RegExp(`data-field="${f}" role="radiogroup" aria-required="true"`), f);
  assert.match(html, /id="f-email"[^>]*aria-required="true"/);
  assert.match(html, /id="f-consent"[^>]*aria-required="true"/);
  assert.doesNotMatch(html, /<input[^>]*\srequired[\s>]/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8'), /' required'/);
  // 갈래에 딸린 칸은 「관심 있는 것」 바로 아래(고르면 그 자리에 나타난다)
  const order = ['interest', 'times', 'study', 'who', 'level', 'when'].map(f => html.indexOf(`data-field="${f}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('친구에게 보낼 주소는 from=friend, TOPIK 4급 반 연결은 from=ub-page로 화면 언어를 지킨다', () => {
  assert.equal(A.shareUrl('https://synk.im/ub/?from=ub-msue&lang=mn#signup', 'ko'), 'https://synk.im/ub/?from=friend&lang=ko');
  assert.equal(A.topikUrl('mn'), 'https://synk.im/lab/topik4/?from=ub-page&lang=mn');
  assert.equal(A.topikUrl('ko'), 'https://synk.im/lab/topik4/?from=ub-page&lang=ko');
});

test('묶음: 「·」 말, 몽골어 서수 「3-р」, 요일 묶음 「Даваа–Баасан」은 줄이 갈리지 않게 한 칸으로', () => {
  assert.equal(A.keepDots('수업 시간·장소'), '수업 <span class="nw">시간·장소</span>');
  assert.match(A.keepDots('TOPIK 3-р түвшин'), /<span class="nw">3-р<\/span>/);
  assert.match(A.keepDots('TOPIK 1–2-р түвшний'), /<span class="nw">1–2-р<\/span>/);
  assert.match(A.keepDots('Даваа–Баасан, орой'), /<span class="nw">Даваа–Баасан<\/span>/);
  assert.equal(A.keepDots('<b>'), '&lt;b&gt;');
});

test('두 언어의 글 키·목록 길이가 같다', () => {
  const shape = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v && typeof v === 'object') ? Object.keys(v).sort().join(',') : typeof v]));
  assert.deepEqual(shape(C.mn), shape(C.ko));
  for (const k of Object.keys(C.ko.what)) assert.deepEqual(Object.keys(C.mn.what[k]).sort(), Object.keys(C.ko.what[k]).sort(), k);
  for (const L of [C.BRANCHES, C.WHO, C.LEVELS, C.WHEN, C.TIMES, C.STUDY]) for (const o of L) assert.ok(o.ko && o.mn && o.record && o.id, JSON.stringify(o));
  assert.deepEqual(Object.keys(C.ko.what).sort(), C.BRANCHES.map(b => b.id).sort());
});

test('화면 글 약속: 여는 날짜·값·합격·비자를 약속하지 않고, 돈을 받지 않으며, AI 도구 이름이 없다', () => {
  // 공개되는 파일 전부(주석 포함) — 사이트에는 AI 도구 이름을 쓰지 않는다
  const files = ['src/index.html', 'src/app.js', 'src/page.css', 'src/copy.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('');
  for (const bad of [/보장|합격률|무제한|할인/, /Claude|GPT|Gemini|ChatGPT|Higgsfield|Codex|Argon/i, /AI 생성/]) assert.doesNotMatch(files, bad);
  assert.doesNotMatch(files, /\/try\//, '사이트에 게임 링크를 새로 넣지 않는다(10-05)');
  const ko = JSON.stringify(C.ko);
  const mn = JSON.stringify(C.mn);
  assert.doesNotMatch(ko + mn, /100\s?%|баталгаа/, '화면 글에 「100%」·「баталгаа(보장)」를 쓰지 않는다');
  // 여는 날짜·값을 적지 않는다(학생이 가려는 해 선택지 WHEN은 화면 글 밖이다)
  assert.doesNotMatch(ko, /\d+월|20\d\d년|개원일|\d[\d,]*\s*(원|₮)|만 원/);
  assert.doesNotMatch(mn, /\d+-р сард|20\d\d он|\d[\d,]*\s*(₮|төгрөг|вон)/);
  for (const must of ['돈을 받지 않아요', '합격·비자를 약속하지 않아요', '아직 정하지 않았어요', '합격은 학교가, 비자는 대사관이 정해요']) assert.ok(ko.includes(must), must);
  for (const must of ['төлбөр авахгүй', 'амлахгүй', 'хараахан тогтоогоогүй', 'Элчин сайдын яам']) assert.ok(mn.includes(must), must);
  // 안내문은 실제로 보내는 것(이메일·이름·답 + 들어온 링크 표시·화면 언어)과 14세 미만 안내를 모두 적는다
  for (const must of ['이메일', '이름', '답', '링크 표시', '화면 언어', '만 14세 미만', 'hello@synk.im']) assert.ok(C.ko.notice.includes(must), must);
  for (const must of ['имэйл', 'нэр', 'хариулт', 'холбоосны тэмдэглэгээ', 'дэлгэцийн хэл', '14 нас', 'hello@synk.im']) assert.ok(C.mn.notice.includes(must), must);
  // 화면 글은 해요체 한 목소리 — 합쇼체는 동의 문장(폼에 기록되는 글)만
  const walk = (o, at) => Object.entries(o).forEach(([k, v]) => { if (typeof v === 'string') { if (k !== 'consent') assert.doesNotMatch(v, /(니다|십시오)[.!]?$|니다\. /, `${at}.${k}`); } else if (v && typeof v === 'object') walk(v, `${at}.${k}`); });
  walk(C.ko, 'ko');
});

test('빌드 원고: 화면이 쓰는 그림이 원고 폴더에 있고, 크기 속성이 실제 그림과 같다', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  const seen = [...html.matchAll(/<img class="cut" src="assets\/(ub-art-[\w-]+\.webp)" width="(\d+)" height="(\d+)"/g)];
  assert.equal(seen.length, 4);
  for (const [, file, w, h] of seen) {
    const p = path.join(__dirname, 'src/art', file);
    assert.ok(fs.existsSync(p), file);
    const b = fs.readFileSync(p);
    // WebP 머리: VP8X(알파 확장)는 24비트씩, VP8L(무손실)은 14비트씩 너비·높이를 적는다
    const kind = b.toString('ascii', 12, 16);
    const size = kind === 'VP8X' ? [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1]
      : kind === 'VP8L' ? (bits => [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1])(b.readUInt32LE(21)) : null;
    assert.ok(size, `${file}: 모르는 WebP 머리 ${kind}`);
    assert.deepEqual(size, [Number(w), Number(h)], file);
  }
});
