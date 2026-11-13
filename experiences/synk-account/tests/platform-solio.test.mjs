// 웹 플랫폼 SYNK SOLIO 판(2026-11-13): 솔리오 · 내 계정 · 맞춤 정보 주소, 옛 회원 혜택 주소 이음, 솔리오 화면 글, 홈 칸, 둘러보기 묶음, 프로필 메뉴.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solioLegacyHash, solioPage, solioHomeItem, solioDiscoverSection, solioAccountPage, solioInsightPage } from '../src/platform-solio.mjs';
import { platformRoute } from '../src/platform-home.mjs';
import { memberBenefit } from '../../../desktop/renderer/benefits.mjs';
import { targetFor } from '../../learning-hub/server.mjs';

const source = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

test('SOLIO and account routes resolve, and the two old benefit addresses move to their new places', () => {
  assert.deepEqual(['#solio', '#solio/backup', '#solio/subscriptions', '#account', '#account/insight'].map(hash => [platformRoute(hash).page, platformRoute(hash).id ?? null]),
    [['solio', null], ['solio', 'backup'], ['solio', 'subscriptions'], ['account', null], ['account', 'insight']]);
  assert.equal(solioLegacyHash('#benefits/insight'), '#account/insight');
  assert.equal(solioLegacyHash('#benefits/subscriptions'), '#solio/subscriptions');
  assert.equal(solioLegacyHash('#benefits/subscriptions?from=old'), '#solio/subscriptions');
  for (const hash of ['#benefits', '#benefits/care', '#benefits/__proto__', '#benefits/hasOwnProperty', '#home', '', '#solio/subscriptions']) assert.equal(solioLegacyHash(hash), null, hash);
  // 첫 그림 전과 주소가 바뀔 때 기록을 더하지 않고 바꿔 적는다(뒤로 가기 한 번에 앞 쪽).
  const platform = source('../src/platform.mjs');
  assert.match(platform, /function solioFollowLegacy\(\)\{const moved=solioLegacyHash\(location\.hash\);if\(moved\)window\.history\.replaceState\(/);
  assert.match(platform, /window\.addEventListener\('hashchange',\(\)=>\{solioFollowLegacy\(\);/);
  assert.ok(platform.indexOf('solioFollowLegacy();\r\ncontinuity=mountPlatformLibrary(') > 0 || platform.indexOf('solioFollowLegacy();\ncontinuity=mountPlatformLibrary(') > 0);
});

test('the SOLIO page: underline tabs, home with what works now, backup only in preparation, and a web intro that never reads PC usage', () => {
  const home = solioPage();
  assert.match(home, /<p class="solio-kicker">SYNK SOLIO<\/p>/);
  assert.deepEqual([...home.matchAll(/<a class="tab" href="([^"]+)"( aria-current="page")?>([^<]+)<\/a>/g)].map(m => [m[1], !!m[2], m[3]]), [['#solio', true, '홈'], ['#solio/backup', false, '백업·복구'], ['#solio/subscriptions', false, 'AI 구독 관리']]);
  assert.match(home, /<h1 id="solio-title">솔리오<\/h1>/);assert.match(home, /AI 1인기업을 위한 통합 업무 앱/);
  assert.match(home, /AI 구독 관리<\/a><span class="solio-state">[^]*?지금 써요 · PC 앱/);assert.match(home, /백업·복구<\/a><span class="solio-state">[^]*?준비 중/);
  const backup = solioPage('backup');
  assert.match(backup, /aria-current="page">백업·복구/);assert.match(backup, /설치 파일과 요금은 아직 공개하지 않았어요/);
  // 준비 중인 것에는 설치 · 다운로드 · 신청 · 결제 단추가 없다(탭 링크만).
  assert.doesNotMatch(backup.replace(/<header class="solio-head">[^]*?<\/header>/, ''), /<a |<button|sb-btn/);
  const subs = solioPage('subscriptions');
  assert.match(subs, /<h1 id="solio-title">AI 구독 관리<\/h1>/);assert.match(subs, /<a class="sb-btn" href="#downloads">PC 앱 받기/);
  assert.match(subs, /PC 앱 위 메뉴 「솔리오」 → 「AI 구독 관리」에서 열어요\. 이전 판에서는 「회원 혜택」 → 「AI 구독 계정판」에서 열어요\./);
  assert.match(subs, /기록은 이 PC에만 저장해요/);
  assert.doesNotMatch(subs, /usedPercent|남은 양 \d|%<|data-subs/);
  assert.equal(solioPage('unknown'), solioPage());
});

test('home and discover: SOLIO has one home cell, and search finds the moved places by their old names', () => {
  const cell = solioHomeItem(true);
  assert.match(cell, /^<li class="shelf-item big home-item solio-item" data-shortcut="solio"><a class="shelf-link" href="#solio">/);
  assert.match(cell, /src="\.\/assets\/member\/solio-object\.webp"/);
  const plain = solioDiscoverSection('', { care: memberBenefit('care') });
  assert.match(plain, /<h2 id="discover-solio-title">솔리오와 회원 혜택<\/h2>/);assert.match(plain, /data-shortcut="solio"/);assert.match(plain, /data-benefit="care"/);
  assert.doesNotMatch(plain, /세 가지/);
  const found = solioDiscoverSection('계정판');
  assert.match(found, /<a class="row-main" href="#solio\/subscriptions">AI 구독 관리<\/a>/);
  assert.match(solioDiscoverSection('성향'), /href="#account\/insight">내 성향</);
  assert.match(solioDiscoverSection('경조사'), /href="#benefits\/care">플레저</);
  assert.match(solioDiscoverSection('<img src=x onerror=1>'), /검색어에 맞는 솔리오 · 회원 혜택이 없어요/);
  // 웹 홈: 최근 · 즐겨찾기(셋까지) → 솔리오 → PATH, 손님 · 처음 문구는 「SYNK 앱과 솔리오」.
  const platform = source('../src/platform.mjs');
  assert.match(platform, /const shelfItems=\[\.\.\.mine,solioHomeItem\(!mine\.length\)\];/);
  assert.match(platform, /'SYNK 앱과 솔리오,<br><span>한 ID로 열어요\.<\/span>'/);
  assert.match(platform, /<p class="shelf-note">솔리오 소개와 웹에서 여는 면접 연습을 먼저 두었어요\.<\/p>/);
  assert.doesNotMatch(platform, /'insight','subscriptions'\]|세 가지 회원 혜택|설치 없이 열 수 있는 것부터 모았어요/);
});

test('my account and 맞춤 정보: signed-in shows the insight row, signed-out points to sign-in and benefits, insight keeps its screen', () => {
  const signed = solioAccountPage({ status: 'signed-in', name: '합성 <회원>' });
  assert.match(signed, /<h1 id="account-title">내 계정<\/h1>/);assert.match(signed, /합성 &lt;회원&gt; 님/);
  assert.match(signed, /<h2 id="account-personal">맞춤 정보<\/h2>[^]*<strong>내 성향<\/strong>[^]*href="#account\/insight"/);
  assert.match(signed, /href="\.\/client\.html\?product=platform">SYNK ID 관리 ↗/);
  assert.doesNotMatch(signed, /솔리오|진단|성격/);
  const out = solioAccountPage({ status: 'signed-out' });
  assert.match(out, /로그인하면 맞춤 정보를 볼 수 있어요/);assert.match(out, /href="#benefits">회원 혜택 보기/);assert.doesNotMatch(out, /account-personal/);
  assert.match(solioAccountPage({ status: 'loading' }), /로그인 상태를 확인하고 있어요/);
  const insight = solioInsightPage({ status: 'loading' }, { signedIn: true });
  assert.match(insight, /<span class="mi2-eyebrow">맞춤 정보<\/span>/);assert.match(insight, /<a class="mi2-back" href="#account">/);
  // 내 성향을 보일 때만 불러오는 조건은 새 주소로 옮겼다.
  const platform = source('../src/platform.mjs');
  assert.match(platform, /memberInsight\.setVisible\(pageActive&&!document\.hidden&&route\(\)\.page==='account'&&route\(\)\.id==='insight'\)/);
  assert.match(platform, /onChange: \(\) => \{ if \(route\(\)\.page === 'account' && route\(\)\.id === 'insight'\) render\(\); \}/);
});

test('the profile menu opens only for a signed-in account, closes on Escape, focus leaving, outside click and navigation, and the menus moved', () => {
  const html = source('../platform.html'), platform = source('../src/platform.mjs');
  assert.match(html, /<a class="account-entry" href="\.\/client\.html\?product=platform">[^]*?<\/a><div id="profile-menu" class="profile-menu" hidden><p class="profile-menu-who" id="profile-menu-who"><\/p><a href="#account">내 계정<\/a><a href="#benefits">회원 혜택<\/a>/);
  assert.match(html, /<a href="#solio" data-route="solio">솔리오<\/a>/);
  assert.match(html, /<footer class="launcher-footer">[^]*<a href="#benefits">회원 혜택<\/a>/);
  assert.doesNotMatch(html + platform, /aria-haspopup/);
  assert.match(platform, /solioProfileEntry\.setAttribute\('role','button'\);solioProfileEntry\.setAttribute\('aria-expanded',String\(open\)\);solioProfileEntry\.setAttribute\('aria-controls','profile-menu'\);/);
  assert.match(platform, /solioProfileEntry\?\.addEventListener\('click',event=>\{if\(!signedIn\(\)\)return;event\.preventDefault\(\);/);
  assert.match(platform, /document\.addEventListener\('focusout',event=>\{const next=event\.relatedTarget;if\(solioProfileMenu&&!solioProfileMenu\.hidden&&\(solioProfileMenu\.contains\(event\.target\)\|\|solioProfileEntry\?\.contains\(event\.target\)\)&&next&&!solioProfileMenu\.contains\(next\)&&!solioProfileEntry\?\.contains\(next\)\)solioProfileSet\(false\);\}/);
  assert.match(platform, /if\(event\.key==='Escape'&&solioProfileMenu&&!solioProfileMenu\.hidden\)\{solioProfileSet\(false\);solioProfileEntry\?\.focus\(\);\}/);
  assert.match(platform, /window\.addEventListener\('hashchange',\(\)=>\{solioFollowLegacy\(\);solioProfileSet\(false\);/);
  // 로그인 전에는 role · aria-expanded · aria-controls를 지워 계정 칩이 지금처럼 로그인 링크다.
  assert.match(platform, /for\(const key of \['role','aria-expanded','aria-controls'\]\)solioProfileEntry\.removeAttribute\(key\)/);
});

test('every new top-level name in the SOLIO module starts with solio (the live patch adds this module without renaming others)', () => {
  const text = source('../src/platform-solio.mjs');
  const names = [...text.matchAll(/^(?:export )?(?:const|let|function) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  assert.ok(names.length >= 8);
  for (const name of names) assert.match(name, /^solio/i, name);
  assert.ok(targetFor('/synk-account/assets/member/solio-object.webp'));
  assert.ok(fs.existsSync(new URL('../assets/member/solio-object.webp', import.meta.url)));
});
