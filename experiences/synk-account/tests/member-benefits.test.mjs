import { solioInsightPage } from '../src/platform-solio.mjs';
import { benefitsPage } from '../src/member-benefits.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localBenefitPreview, publicBenefitEntry, filterBenefits, benefitDetail, benefitCards, benefitHero } from '../src/member-benefits.mjs';
import { normalizeLibrary } from '../src/library.mjs';
import { targetFor } from '../../learning-hub/server.mjs';
import { MEMBER_BENEFITS, memberBenefit } from '../../../desktop/renderer/benefits.mjs';

test('fixed benefit demos are available only in a local HTTP preview', () => {
  const previews = { care: 'http://127.0.0.1:4296/' };
  for (const origin of ['http://127.0.0.1:4280/', 'http://localhost:4280/', 'http://[::1]:4280/']) {
    for (const [id, url] of Object.entries(previews)) assert.equal(localBenefitPreview(id, origin), url);
    for (const id of ['unknown', 'constructor', '__proto__']) assert.equal(localBenefitPreview(id, origin), null);
  }
  for (const origin of ['https://synk.im/platform/', 'http://platform.example/', 'http://127.0.0.1.evil.test/', 'http://user:secret@localhost/', 'file:///C:/platform.html', 'broken']) {
    for (const id of Object.keys(previews)) {
      assert.equal(localBenefitPreview(id, origin), null);
      assert.doesNotMatch(benefitDetail(id, origin), /href="http:\/\/127\.0\.0\.1/);
    }
  }
});

test('benefits are discoverable without being treated as installed or entitled applications', () => {
  assert.deepEqual(filterBenefits('가족').map(v => v.id), []);
  assert.deepEqual(filterBenefits('거절').map(v => v.id), []);
  // 2026-11-13 솔리오 판: 회원 혜택은 플레저 하나 — 내 성향은 내 계정 › 맞춤 정보, AI 구독 계정판은 솔리오 › AI 구독 관리로 옮겼다(platform-solio 시험).
  assert.deepEqual(filterBenefits().map(v => v.id), ['care']);
  // The PC-only AI subscription board has no web or local entry.
  assert.equal(localBenefitPreview('subscriptions', 'http://localhost/'), null);
  assert.equal(publicBenefitEntry('subscriptions'), null);
  assert.doesNotMatch(benefitCards(), /benefit-subscriptions|benefit-insight/);
  assert.deepEqual(filterBenefits('성향').map(v => v.id), []);
  assert.equal(localBenefitPreview('insight', 'http://localhost/'), null);
  assert.equal(publicBenefitEntry('insight'), null);
  assert.match(benefitDetail('care', 'http://localhost/'), /href="http:\/\/127\.0\.0\.1:4296\/"/);
  assert.match(benefitDetail('care', 'http://localhost/'), /기기에 저장할지는 앱에서 골라요/);
  assert.deepEqual(normalizeLibrary({ saved: ['care', 'world'], favorites: ['care'] }).saved, ['care', 'world']);
  assert.doesNotMatch(benefitDetail('family-album', 'http://localhost/'), /type="file"|data-action="launch"/);
  assert.doesNotMatch(benefitDetail('<img src=x onerror=alert(1)>', 'http://localhost/'), /onerror/);
});

test('release candidate links use only their exact public entry while development previews stay local', () => {
  for (const id of ['care']) {
    const url = `https://synk.im/${id}/`;
    assert.equal(publicBenefitEntry(id), url);
    const publicHtml = benefitDetail(id, 'https://synk.im/platform/');
    assert.ok(publicHtml.includes(`href="${url}" data-web="${id}"`));
    assert.doesNotMatch(publicHtml, /href="http:\/\/127\.0\.0\.1/);
    assert.match(publicHtml, /웹에서 무료/);
    const localHtml = benefitDetail(id, 'http://localhost:4280/');
    assert.ok(localHtml.includes(`href="${url}" data-web="${id}"`));
    assert.ok(localHtml.includes(`href="${localBenefitPreview(id, 'http://localhost/')}" data-web="${id}"`));
    // Introduction and account links are not instrumented as service usage.
    assert.doesNotMatch(publicHtml, /href="#benefits\/[^\"]+" data-web/);
  }
  for (const id of ['unknown', 'constructor', '__proto__']) assert.equal(publicBenefitEntry(id), null);
  assert.match(benefitDetail('care', 'https://synk.im/platform/'), /알림을 받으려면/);
});

test('public benefit links reject off-site, sibling, credential-bearing and normalized variants instead of widening the allowlist', () => {
  const item = memberBenefit('care'), original = item.publicUrl;
  try {
    for (const value of ['https://other.example/care/', 'https://synk.im/fortune/', 'https://synk.im/care/?from=account', 'https://synk.im/care/#login', 'https://user@synk.im/care/', 'https://synk.im:443/care/', 'https://synk.im/a/../care/', 'https://synk.im/%63are/', 'http://synk.im/care/', '//synk.im/care/']) {
      item.publicUrl = value;
      assert.equal(publicBenefitEntry('care'), null, value);
      assert.doesNotMatch(benefitDetail('care', 'https://synk.im/platform/'), /data-web="care"/);
    }
  } finally { item.publicUrl = original; }
});

test('paused free fortune has no catalogue, search, detail or entry link while it is rebuilt', () => {
  assert.equal(memberBenefit('fortune'), null);
  assert.equal(localBenefitPreview('fortune', 'http://localhost/'), null);
  assert.equal(publicBenefitEntry('fortune'), null);
  assert.deepEqual(filterBenefits('운세').map(v => v.id), []);
  assert.match(benefitDetail('fortune', 'https://synk.im/account/'), /찾는 회원 혜택이 없어요/);
  assert.doesNotMatch(benefitDetail('care', 'https://synk.im/account/'), /benefit-fortune|synk\.im\/fortune/);
  assert.doesNotMatch(benefitCards() + benefitHero(), /운세|benefit-fortune/);
  assert.match(benefitHero(), /<h1 id="benefit-heading">회원 혜택<\/h1>/);assert.doesNotMatch(benefitHero(), /셋 다|세 가지|모두 무료/);
});

test('benefit detail reflects device save and favorite state without creating a launch or changing records', () => {
  const library = normalizeLibrary({ saved: ['care'], favorites: ['care'] });
  const before = structuredClone(library), html = benefitDetail('care', 'http://localhost/', { library });
  assert.match(html, /data-action="save" data-id="care" aria-pressed="true"/);
  assert.match(html, /data-action="favorite" data-id="care" aria-pressed="true">★ 홈에 고정됨</);assert.match(html, /고정하면 내 홈 선반에 나와요/);
  assert.match(html, /이 기기에 바로가기만 저장/);assert.doesNotMatch(html, /data-action="launch"/);
  assert.deepEqual(library, before);assert.deepEqual(library.recent, []);
  assert.match(benefitDetail('care', 'http://localhost/', { library: normalizeLibrary() }), /data-action="save" data-id="care" aria-pressed="false"/);
  assert.match(benefitDetail('care', 'http://localhost/', { library: normalizeLibrary() }), /data-action="favorite" data-id="care" aria-pressed="false">☆ 홈에 고정</);
  // 옮긴 둘(구독 계정판 · 내 성향)은 회원 혜택 소개가 아니다 — 옛 #benefits/… 주소는 platform-solio가 새 주소로 바꾼다.
  for (const id of ['subscriptions', 'insight']) { assert.match(benefitDetail(id, 'http://localhost/', { library }), /찾는 회원 혜택이 없어요/);assert.doesNotMatch(benefitDetail(id, 'http://localhost/', { library }), /data-action="(save|favorite)"/); }
  // 웹에서 바로 여는 플레저는 칸 아래에서 공개 입구로 바로 연다.
  assert.match(benefitCards('플레저'), /<a class="go-link benefit-link" href="https:\/\/synk\.im\/care\/" data-web="care"[^>]*>웹에서 열기 ↗<\/a>/);
  // 회원 혜택 첫 화면의 「옮긴 곳」 두 줄.
  const page = benefitsPage();
  assert.match(page, /<a class="row-act link" href="#account\/insight">맞춤 정보 열기 →<\/a>/);assert.match(page, /<a class="row-act link" href="#solio\/subscriptions">AI 구독 관리 열기 →<\/a>/);
  assert.doesNotMatch(page, /benefit-promise|여는 곳은/);
});

test('preview server serves only named public benefit assets, not source modules or private files', () => {
  for (const file of ['benefits.css', 'member-insight.css', 'assets/member/benefit-gift.webp', 'assets/member/benefit-insight.webp', 'assets/member/benefit-subscriptions.webp', 'assets/member/benefit-care.webp', 'assets/member/benefit-fortune.webp', 'assets/member/wide-lapis.webp', 'assets/member/wide-butter.webp']) {
    assert.ok(targetFor('/synk-account/' + file), file);
  }
  for (const file of ['src/member-benefits.mjs', 'assets/member/private.json', 'assets/member/unknown.png', 'assets/member/care-note.webp']) assert.equal(targetFor('/synk-account/' + file), null);
});

test('web benefit shelf uses the PC felt objects, and every object the web draws is built and served', () => {
  const cards = benefitCards();
  const files = MEMBER_BENEFITS.map(item => item.asset);
  for (const item of MEMBER_BENEFITS) assert.ok(cards.includes(`<img class="benefit-object" src="./assets/member/${item.asset}"`), item.id);
  // A 진열대: 첫머리는 선물 포스터 · 영문 꼬리표 없이 두 줄 제목, 혜택은 회색 선반 칸에 선다.
  assert.ok(benefitHero().includes('<h1 id="benefit-heading">회원 혜택</h1>'));
  assert.doesNotMatch(benefitHero(), /benefit-gift|SYNK FOR YOU|MEMBER BENEFITS/);
  assert.match(cards, /^<ul class="shelf benefit-grid cols-3" aria-label="회원 혜택">/);
  for (const file of files) {
    assert.ok(targetFor('/synk-account/assets/member/' + file), file);
    assert.ok(fs.existsSync(new URL('../assets/member/' + file, import.meta.url)), file);
  }
  // 맞춤 정보(내 성향)도 PC 앱처럼 포스터를 받아 연다 — 머리 꼬리표는 「맞춤 정보」, 뒤로 가기는 「내 계정」(#account).
  const insight = solioInsightPage({ status: 'signed-out', report: null });
  assert.ok(insight.includes('<header class="mi2-poster"><img class="mi2-object" src="./assets/member/benefit-insight.webp"'));
  assert.ok(insight.includes('<span class="mi2-eyebrow">맞춤 정보</span>'));assert.ok(insight.includes('<a class="mi2-back" href="#account">'));
  assert.doesNotMatch(insight, /SYNK FOR YOU|mi2-en/);
  // 다른 혜택 소개는 앱 소개와 같은 7 : 5 — 회색 무대 위 물건 하나, 이름 · 한 줄 제목 · 위치 줄.
  const care = benefitDetail('care', 'https://synk.im/platform/');
  assert.ok(care.includes('<div class="detail-stage"><img class="benefit-object" src="./assets/member/benefit-care.webp"'));
  assert.ok(care.includes('<nav class="crumb" aria-label="위치"><a href="#benefits">회원 혜택</a>'));
  assert.ok(care.includes('<h1>플레저</h1><p class="sub">오늘 연락할 사람과 다가오는 날을 먼저 알려 줘요.</p>'));
  assert.doesNotMatch(care, /SYNK FOR YOU|HOW IT WORKS|COMING SOON/);
});

test('removed member apps have no catalogue, search, launch link or public assets', () => {
  for (const id of ['rehearsal', 'family-album']) {
    assert.equal(memberBenefit(id), null);
    assert.equal(localBenefitPreview(id, 'http://localhost/'), null);
    assert.equal(publicBenefitEntry(id), null);
    assert.match(benefitDetail(id, 'https://synk.im/account/'), /찾는 회원 혜택이 없어요/);
  }
  for (const id of ['rehearsal','album']) assert.equal(targetFor('/synk-account/assets/member/benefit-' + id + '.webp'), null);
  assert.deepEqual(normalizeLibrary({ saved:['care','world','rehearsal','family-album'], favorites:['family-album'], recent:[{id:'rehearsal',at:1,mode:'web'}] }).saved,['care','world']);
  assert.doesNotMatch(benefitCards()+benefitHero(), /리허설|가족 이야기|benefit-album|benefit-rehearsal/);
});
