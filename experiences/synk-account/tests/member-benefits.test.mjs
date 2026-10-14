import test from 'node:test';
import assert from 'node:assert/strict';
import { localBenefitPreview, publicBenefitEntry, filterBenefits, benefitDetail } from '../src/member-benefits.mjs';
import { normalizeLibrary } from '../src/library.mjs';
import { targetFor } from '../../learning-hub/server.mjs';
import { memberBenefit } from '../../../desktop/renderer/benefits.mjs';

test('fixed benefit demos are available only in a local HTTP preview', () => {
  const previews = { care: 'http://127.0.0.1:4296/', fortune: 'http://127.0.0.1:4299/', rehearsal: 'http://127.0.0.1:4297/', 'family-album': 'http://127.0.0.1:4298/' };
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
  assert.deepEqual(filterBenefits('가족').map(v => v.id), ['family-album']);
  assert.deepEqual(filterBenefits('거절').map(v => v.id), ['rehearsal']);
  assert.deepEqual(filterBenefits().map(v => v.id), ['care', 'fortune', 'rehearsal', 'family-album']);
  assert.deepEqual(filterBenefits('운세').map(v => v.id), ['fortune']);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /href="http:\/\/127\.0\.0\.1:4299\/"/);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /비회원 입력은 이 화면에만 남아요/);
  assert.match(benefitDetail('fortune', 'http://localhost/'), /계정 연결 후 저장을 누르면/);
  assert.doesNotMatch(benefitDetail('fortune', 'http://localhost/'), /기기 저장은 앱에서 직접 선택/);
  assert.deepEqual(normalizeLibrary({ saved: ['care', 'fortune', 'rehearsal', 'family-album'], favorites: ['family-album'] }).saved, ['care', 'fortune', 'rehearsal', 'family-album']);
  assert.doesNotMatch(benefitDetail('family-album', 'http://localhost/'), /type="file"|data-action="launch"/);
  assert.match(benefitDetail('family-album', 'http://localhost/'), /href="http:\/\/127\.0\.0\.1:4298\/"/);
  assert.match(benefitDetail('rehearsal', 'http://localhost/'), /기본은 이번 사용 중에만 보관/);
  assert.doesNotMatch(benefitDetail('<img src=x onerror=alert(1)>', 'http://localhost/'), /onerror/);
});

test('release candidate links use only their exact public entry while development previews stay local', () => {
  for (const id of ['care', 'fortune', 'rehearsal']) {
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
  // 앨범은 2026-10-14부터 synk.im/album/ 에서 공개한다(id와 주소 이름이 다르다).
  assert.equal(publicBenefitEntry('family-album'), 'https://synk.im/album/');
  const albumHtml = benefitDetail('family-album', 'https://synk.im/platform/');
  assert.ok(albumHtml.includes('href="https://synk.im/album/" data-web="family-album"'));
  assert.match(albumHtml, /공개 웹 · PC 개발판/);
  assert.doesNotMatch(albumHtml, /href="http:\/\/127\.0\.0\.1/);
  for (const id of ['unknown', 'constructor', '__proto__']) assert.equal(publicBenefitEntry(id), null);
  assert.match(benefitDetail('fortune', 'https://synk.im/platform/'), /최근 7일의 기록/);
  assert.match(benefitDetail('rehearsal', 'https://synk.im/platform/'), /생성형 AI 대화와 자동 능력 평가는 제공하지 않아요/);
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
  const library = normalizeLibrary({ saved: ['rehearsal'], favorites: ['rehearsal'] });
  const before = structuredClone(library), html = benefitDetail('rehearsal', 'http://localhost/', { library });
  assert.match(html, /data-action="save" data-id="rehearsal" aria-pressed="true"/);
  assert.match(html, /data-action="favorite" data-id="rehearsal" aria-pressed="true"/);
  assert.match(html, /이 기기에 바로가기만 저장/);assert.doesNotMatch(html, /data-action="launch"/);
  assert.deepEqual(library, before);assert.deepEqual(library.recent, []);
  assert.match(benefitDetail('fortune', 'http://localhost/', { library }), /data-action="save" data-id="fortune" aria-pressed="false"/);
});

test('preview server serves only named public benefit assets, not source modules or private files', () => {
  for (const file of ['benefits.css', 'assets/member/care-note.webp', 'assets/member/fortune-star.avif', 'assets/member/teacher-cover.png', 'assets/member/studio-camera.webp', 'assets/member/wide-lapis.webp', 'assets/member/wide-butter.webp']) {
    assert.ok(targetFor('/synk-account/' + file), file);
  }
  for (const file of ['src/member-benefits.mjs', 'assets/member/private.json', 'assets/member/unknown.png']) assert.equal(targetFor('/synk-account/' + file), null);
});
