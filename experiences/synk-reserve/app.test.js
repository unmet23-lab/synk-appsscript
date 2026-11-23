// node --test experiences/synk-reserve/app.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const C = require('./src/copy.js');
const A = require('./src/app.js');
const T4 = require('../lab-topik4/src/copy.js');

const FORM_PAGE_OPTIONS = {
  // 홈페이지 문의 구글 폼(2026-10-23 현행 분류)의 최종 선택지 글. experiences/lab-topik4/app.test.js · ub-korea/app.test.js와 같은 목록.
  type: ['LAB · 한국어 교육', 'SHIFT · 학교·기업·기관 AI 강의', 'SHIFT · AI 강사·진로 강사 에이전시', 'SHIFT · AI 업무 자동화', 'PATH · 유학·취업 연계', 'PULSE · 제작 협업·작품 이용·광고', '출시 소식 문의'],
  consent: ['위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.'],
};

test('폼 고정 값은 구글 폼 선택지 글과 같고, 질문 번호는 같은 폼을 쓰는 쪽과 같다', () => {
  assert.ok(FORM_PAGE_OPTIONS.type.includes(C.FORM.typeValue));
  assert.ok(FORM_PAGE_OPTIONS.consent.includes(C.FORM.consentValue));
  assert.equal(C.ko.consent, C.FORM.consentValue, '한국어 화면의 동의 글은 기록되는 동의 글과 같아야 한다');
  for (const k of ['action', 'email', 'type', 'body', 'consent', 'consentValue']) assert.equal(C.FORM[k], T4.FORM[k], k);
});

test('세 언어의 글 키가 같고 빈 글이 없다', () => {
  const keys = Object.keys(C.ko).sort();
  for (const l of C.LANGS) {
    assert.deepEqual(Object.keys(C[l]).sort(), keys, l);
    for (const [k, v] of Object.entries(C[l])) assert.ok(typeof v === 'string' && v.trim(), `${l}.${k}`);
  }
  for (const o of C.INTERESTS) for (const l of C.LANGS) assert.ok(o[l], `${o.id}.${l}`);
});

test('화면 언어: ?lang → 기기 언어(몽골어 · 한국어) → 영어', () => {
  assert.equal(A.pickLang('?lang=mn', ['ko-KR']), 'mn');
  assert.equal(A.pickLang('?lang=en', ['mn']), 'en');
  assert.equal(A.pickLang('?lang=es', ['ko']), 'ko');
  assert.equal(A.pickLang('', ['en-US', 'mn-MN']), 'mn');
  assert.equal(A.pickLang('', ['ko-KR', 'en']), 'ko');
  assert.equal(A.pickLang('', ['ru-RU']), 'en');
  assert.equal(A.pickLang('', []), 'en');
});

test('들어온 곳: 짧은 영소문자 이름만, 아니면 direct', () => {
  assert.equal(A.fromKey('?from=bar-try-entry-check'), 'bar-try-entry-check');
  assert.equal(A.fromKey('?from=Topik4-Univ-QR'), 'topik4-univ-qr');
  assert.equal(A.fromKey('?from=<script>'), 'direct');
  assert.equal(A.fromKey('?from=' + 'a'.repeat(41)), 'direct');
  assert.equal(A.fromKey(''), 'direct');
});

test('이메일 미리 보기', () => {
  for (const ok of ['a@b.co', 'name.last+tag@example.mn']) assert.ok(A.validEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a@@b.co', '.a@b.co', 'a..b@c.co', 'a@-b.co', 'a b@c.co', 'a@b.c', '홍길동@example.com', 'kimㅎ@example.com', 'аbc@example.com']) assert.ok(!A.validEmail(bad), bad);
  assert.deepEqual(A.validate({ email: 'a@b.co', consent: true }), {});
  assert.deepEqual(A.validate({ email: 'x', consent: false }), { email: 'errEmail', consent: 'errConsent' });
});

test('문의 내용: 표식 · 관심 · 들어온 곳 줄(받는 쪽 약속)', () => {
  assert.equal(A.buildBody({ interests: ['job', 'korean', 'nope'], from: 'synk-mn', lang: 'mn' }),
    '[SYNK 사전예약]\n관심: 한국어 · 취업\n들어온 곳: synk-mn · 화면 언어 몽골어');
  assert.equal(A.buildBody({ interests: [], from: '', lang: 'en' }),
    '[SYNK 사전예약]\n관심: (안 고름)\n들어온 곳: direct · 화면 언어 영어');
  const again = A.buildBody({ email: 'right@example.com', prevEmail: 'wrnog@example.com', interests: ['study'], from: 'friend', lang: 'ko', resubmit: true }).split('\n');
  assert.equal(again[1], '관심: 유학');
  assert.equal(again[3], '다시 등록: 앞서 wrnog@example.com로 보낸 사전예약을 고쳐 다시 보냄(앞 등록은 버림)', '앞 응답과 짝지을 수 있게 앞 이메일을 적는다');
  assert.match(A.buildBody({ email: 'a@b.co', prevEmail: 'A@B.co', interests: [], lang: 'ko', resubmit: true }), /다시 등록: 앞서 같은 이메일로/);
  const p = A.buildPayload({ email: ' a@b.co ', interests: [], from: 'direct', lang: 'ko' });
  assert.equal(p.get('emailAddress'), 'a@b.co');
  assert.equal(p.get(C.FORM.type), '출시 소식 문의');
  assert.equal(p.get(C.FORM.consent), C.FORM.consentValue);
});

test('회사 서버가 이 문의를 「SYNK 사전예약」으로 세고 답장 할 일을 만들지 않는다', async () => {
  const mod = path.join(__dirname, '../../docs/마케팅/온라인마케팅지도/engagement/company/website-inquiry-registration.mjs');
  const { websiteInquiryRegistration } = await import(pathToFileURL(mod).href);
  for (const lang of C.LANGS) {
    const message = A.buildBody({ interests: ['korean'], from: 'bar-world', lang });
    const r = websiteInquiryRegistration({ type: C.FORM.typeValue, message });
    assert.ok(r, `${lang}: 등록으로 읽혀야 한다`);
    assert.equal(r.productId, 'app-reserve');
    assert.equal(r.waitlistOnly, true, lang);
    assert.equal(r.source, 'bar-world');
  }
  const again = websiteInquiryRegistration({ type: C.FORM.typeValue, message: A.buildBody({ interests: [], from: 'direct', lang: 'ko', resubmit: true }) });
  assert.equal(again.resubmitted, true);
});

test('친구에게 보낼 주소: from=friend, 언어 유지, 안내 띠(notice) 빠짐', () => {
  assert.equal(A.shareUrl('https://synk.im/reserve/?from=topik4-x&lang=mn&notice=topik4#signup', 'mn'), 'https://synk.im/reserve/?from=friend&lang=mn');
});

test('철수한 /lab/topik4/: 들어온 곳에 topik4-를 붙여 사전예약으로 넘긴다', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/lab-topik4.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const go = search => {
    let to = '';
    vm.runInNewContext(code, { URLSearchParams, location: { search, replace: u => { to = u; } } });
    return to;
  };
  assert.equal(go('?from=univ-shinhan-qr&lang=mn'), '/reserve/?from=topik4-univ-shinhan-qr&lang=mn&notice=topik4');
  assert.equal(go(''), '/reserve/?from=lab-topik4&notice=topik4');
  assert.equal(go('?from=Bad%20Value&lang=ru'), '/reserve/?from=lab-topik4&notice=topik4');
  const long = go('?from=' + 'a'.repeat(30) + '-' + 'b'.repeat(9));
  assert.ok(new URLSearchParams(long.split('?')[1]).get('from').length <= 40);
  assert.match(new URLSearchParams(long.split('?')[1]).get('from'), /^[a-z0-9][a-z0-9-]{0,39}$/);
  assert.match(html, /http-equiv="refresh" content="3; url=\/reserve\/\?from=lab-topik4&amp;notice=topik4"/);
});

test('출시 안내 띠: 링크가 /reserve/로 가고 들어온 곳을 bar-<경로>로 적는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../launch-notice/launch-notice.js'), 'utf8');
  const fromCode = src.match(/const fromKey = \(\) => \{([\s\S]*?)\n  \};/)[1];
  const key = pathname => new Function('location', fromCode)({ pathname });
  assert.equal(key('/try/entry-check/'), 'bar-try-entry-check');
  assert.equal(key('/world/'), 'bar-world');
  assert.equal(key('/'), 'bar-home');
  assert.equal(key('/path/interview/film/rehearsal.html'), 'bar-path-interview-film-rehearsal-html');
  assert.ok(key('/' + 'x'.repeat(80) + '/').length <= 40);
  assert.match(src, /link\.href = '\/reserve\/\?lang=' \+ RESERVE_LANG\[l\] \+ '&from=' \+ fromKey\(\);/);
  for (const l of ['ko', 'en', 'mn', 'es']) assert.match(src, new RegExp(`${l}: \\{ body: '[^']+', cta: '[^']+'`), l);
  // 데스크톱 앱 창은 /reserve/ 이동을 막으므로 그 창에서는 링크를 숨긴다.
  assert.match(src, /window\.synkDesktop \|\| window\.synkProduct/);
  assert.match(src, /link\.hidden = inDesktopApp\(\);/);
});
