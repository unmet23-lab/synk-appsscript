import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localBenefitPreview, publicBenefitEntry, filterBenefits, benefitDetail, benefitCards, benefitHero } from '../src/member-benefits.mjs';
import { normalizeLibrary } from '../src/library.mjs';
import { targetFor } from '../../learning-hub/server.mjs';
import { MEMBER_BENEFITS, memberBenefit } from '../../../desktop/renderer/benefits.mjs';

test('fixed benefit demos are available only in a local HTTP preview', () => {
  const previews = { care: 'http://127.0.0.1:4296/', fortune: 'http://127.0.0.1:4299/' };
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
  assert.deepEqual(filterBenefits().map(v => v.id), ['insight', 'subscriptions', 'care', 'fortune']);
  // The PC-only AI subscription board is discoverable on the web but has no web or local entry.
  assert.equal(localBenefitPreview('subscriptions', 'http://localhost/'), null);
  assert.equal(publicBenefitEntry('subscriptions'), null);
  assert.match(benefitCards(), /benefit-subscriptions[\s\S]*?class="benefit-link"[^>]*>어떤 경험인가요\?/);
  assert.deepEqual(filterBenefits('성향').map(v => v.id), ['insight']);
  assert.equal(localBenefitPreview('insight', 'http://localhost/'), null);
  assert.equal(publicBenefitEntry('insight'), null);
  assert.deepEqual(filterBenefits('운세').map(v => v.id), ['fortune']);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /href="http:\/\/127\.0\.0\.1:4299\/"/);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /비회원 입력은 이 화면에만 남아요/);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /계정 연결 후 저장을 누르면/);
  assert.doesNotMatch(benefitDetail('fortune', 'http://localhost/'), /기기 저장은 앱에서 직접 선택/);
  assert.deepEqual(normalizeLibrary({ saved: ['care', 'fortune'], favorites: ['care'] }).saved, ['care', 'fortune']);
  assert.doesNotMatch(benefitDetail('family-album', 'http://localhost/'), /type="file"|data-action="launch"/);
  assert.doesNotMatch(benefitDetail('<img src=x onerror=alert(1)>', 'http://localhost/'), /onerror/);
});

test('release candidate links use only their exact public entry while development previews stay local', () => {
  for (const id of ['care', 'fortune']) {
    const url = `https://synk.im/${id}/`;
    assert.equal(publicBenefitEntry(id), url);
    const publicHtml = benefitDetail(id, 'https://synk.im/platform/');
    assert.ok(publicHtml.includes(`href="${url}" data-web="${id}"`));
    assert.doesNotMatch(publicHtml, /href="http:\/\/127\.0\.0\.1/);
    assert.match(publicHtml, /공개 웹 · PC 개발판/);
    const localHtml = benefitDetail(id, 'http://localhost:4280/');
    assert.ok(localHtml.includes(`href="${url}" data-web="${id}"`));
    assert.ok(localHtml.includes(`href="${localBenefitPreview(id, 'http://localhost/')}" data-web="${id}"`));
    // Introduction and account links are not instrumented as service usage.
    assert.doesNotMatch(publicHtml, /href="#benefits\/[^\"]+" data-web/);
  }
  for (const id of ['unknown', 'constructor', '__proto__']) assert.equal(publicBenefitEntry(id), null);
  assert.match(benefitDetail('fortune', 'https://synk.im/platform/'), /최근 7일의 기록/);
});

test('public benefit links reject off-site, sibling, credential-bearing and normalized variants instead of widening the allowlist', () => {
  const item = memberBenefit('fortune'), original = item.publicUrl;
  try {
    for (const value of ['https://other.example/fortune/', 'https://synk.im/care/', 'https://synk.im/fortune/?from=account', 'https://synk.im/fortune/#login', 'https://user@synk.im/fortune/', 'https://synk.im:443/fortune/', 'https://synk.im/a/../fortune/', 'https://synk.im/%66ortune/', 'http://synk.im/fortune/', '//synk.im/fortune/']) {
      item.publicUrl = value;
      assert.equal(publicBenefitEntry('fortune'), null, value);
      assert.doesNotMatch(benefitDetail('fortune', 'https://synk.im/platform/'), /data-web="fortune"/);
    }
  } finally { item.publicUrl = original; }
});

test('benefit detail reflects device save and favorite state without creating a launch or changing records', () => {
  const library = normalizeLibrary({ saved: ['care'], favorites: ['care'] });
  const before = structuredClone(library), html = benefitDetail('care', 'http://localhost/', { library });
  assert.match(html, /data-action="save" data-id="care" aria-pressed="true"/);
  assert.match(html, /data-action="favorite" data-id="care" aria-pressed="true"/);
  assert.match(html, /이 기기에 바로가기만 저장/);assert.doesNotMatch(html, /data-action="launch"/);
  assert.deepEqual(library, before);assert.deepEqual(library.recent, []);
  assert.match(benefitDetail('fortune', 'http://localhost/', { library }), /data-action="save" data-id="fortune" aria-pressed="false"/);
  // PC 앱 안 혜택(구독 계정판)은 기기 바로가기 목록에 없어 담기·즐겨찾기 단추를 내지 않는다.
  assert.doesNotMatch(benefitDetail('subscriptions', 'http://localhost/', { library }), /data-action="(save|favorite)"/);
  // 웹 소개는 PC 앱 받기로 잇고, 카드는 「내 기록」이 아니라 소개로 간다(내 기록은 성향만).
  assert.ok(benefitDetail('subscriptions', 'http://localhost/').includes('<a class="benefit-link" href="#downloads">PC 앱 받기 →</a>'));
  assert.ok(benefitCards('계정판').includes('어떤 경험인가요?'));
  assert.ok(!benefitCards('계정판').includes('내 기록 살펴보기'));
});

test('preview server serves only named public benefit assets, not source modules or private files', () => {
  for (const file of ['benefits.css', 'member-insight.css', 'assets/member/benefit-gift.webp', 'assets/member/benefit-insight.webp', 'assets/member/benefit-subscriptions.webp', 'assets/member/benefit-care.webp', 'assets/member/benefit-fortune.webp', 'assets/member/wide-lapis.webp', 'assets/member/wide-butter.webp']) {
    assert.ok(targetFor('/synk-account/' + file), file);
  }
  for (const file of ['src/member-benefits.mjs', 'assets/member/private.json', 'assets/member/unknown.png', 'assets/member/care-note.webp']) assert.equal(targetFor('/synk-account/' + file), null);
});

test('web benefit posters use the PC felt objects, and every object the web draws is built and served', () => {
  const cards = benefitCards(), total = String(MEMBER_BENEFITS.length).padStart(2, '0');
  const files = ['benefit-gift.webp', ...MEMBER_BENEFITS.map(item => item.asset)];
  for (const item of MEMBER_BENEFITS) assert.ok(cards.includes(`<img class="benefit-object" src="./assets/member/${item.asset}"`), item.id);
  assert.ok(benefitHero().includes('<img class="benefit-object" src="./assets/member/benefit-gift.webp" alt="">'));
  for (const file of files) {
    assert.ok(targetFor('/synk-account/assets/member/' + file), file);
    assert.ok(fs.existsSync(new URL('../assets/member/' + file, import.meta.url)), file);
  }
  // 성향 소개도 PC 앱처럼 포스터(물건·번호 라벨·상태 스티커)를 받아 다른 소개 머리와 같은 틀로 연다.
  const insight = benefitDetail('insight', 'https://synk.im/platform/');
  assert.ok(insight.includes('<header class="mi-hero has-art"><img class="mi-object" src="./assets/member/benefit-insight.webp"'));
  assert.ok(insight.includes(`SYNK FOR YOU · 01 / ${total}`));
  const care = benefitDetail('care', 'https://synk.im/platform/');
  assert.ok(care.includes('<header class="benefit-detail-hero benefit-care"><img class="benefit-object" src="./assets/member/benefit-care.webp"'));
  assert.ok(care.includes(`SYNK FOR YOU · 03 / ${total}`));
  assert.ok(care.includes('<h1><span class="sr-only">플레저. </span>'));
});

test('removed member apps have no catalogue, search, launch link or public assets', () => {
  for (const id of ['rehearsal', 'family-album']) {
    assert.equal(memberBenefit(id), null);
    assert.equal(localBenefitPreview(id, 'http://localhost/'), null);
    assert.equal(publicBenefitEntry(id), null);
    assert.match(benefitDetail(id, 'https://synk.im/account/'), /서비스를 찾을 수 없어요/);
  }
  for (const id of ['rehearsal','album']) assert.equal(targetFor('/synk-account/assets/member/benefit-' + id + '.webp'), null);
  assert.deepEqual(normalizeLibrary({ saved:['care','fortune','rehearsal','family-album'], favorites:['family-album'], recent:[{id:'rehearsal',at:1,mode:'web'}] }).saved,['care','fortune']);
  assert.doesNotMatch(benefitCards()+benefitHero(), /리허설|가족 이야기|benefit-album|benefit-rehearsal/);
});
