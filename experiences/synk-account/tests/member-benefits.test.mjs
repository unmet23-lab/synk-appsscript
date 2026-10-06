import test from 'node:test';
import assert from 'node:assert/strict';
import { localBenefitPreview, filterBenefits, benefitDetail } from '../src/member-benefits.mjs';
import { normalizeLibrary } from '../src/library.mjs';
import { targetFor } from '../../learning-hub/server.mjs';

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
  assert.deepEqual(normalizeLibrary({ saved: ['care', 'fortune', 'rehearsal', 'family-album'], favorites: ['family-album'] }).saved, []);
  assert.doesNotMatch(benefitDetail('family-album', 'http://localhost/'), /type="file"|data-action="launch"/);
  assert.match(benefitDetail('family-album', 'http://localhost/'), /href="http:\/\/127\.0\.0\.1:4298\/"/);
  assert.match(benefitDetail('rehearsal', 'http://localhost/'), /기본은 이번 사용 중에만 보관/);
  assert.doesNotMatch(benefitDetail('<img src=x onerror=alert(1)>', 'http://localhost/'), /onerror/);
});

test('preview server serves only named public benefit assets, not source modules or private files', () => {
  for (const file of ['benefits.css', 'assets/member/care-note.webp', 'assets/member/fortune-star.avif', 'assets/member/teacher-cover.png', 'assets/member/studio-camera.webp', 'assets/member/wide-lapis.webp', 'assets/member/wide-butter.webp']) {
    assert.ok(targetFor('/synk-account/' + file), file);
  }
  for (const file of ['src/member-benefits.mjs', 'assets/member/private.json', 'assets/member/unknown.png']) assert.equal(targetFor('/synk-account/' + file), null);
});
