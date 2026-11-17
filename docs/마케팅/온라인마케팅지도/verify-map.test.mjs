import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import { createSearchIndex, searchRows, visibleChannel, channelSearchFields, identitySearchFields, managedChannels, loginSummary, brandChannelView } from './dashboard/src/content/dashboard/account-view.mjs';
// 줄끝(CRLF/LF)은 체크아웃마다 달라지므로 원자료는 LF로 맞춘 바이트로 잰다(Windows 작업본과 리눅스·CI가 같은 값을 낸다).
const sourceHash = bytes => crypto.createHash('sha256').update(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1').digest('hex');

// Read-only contract tests: never import the generator, which writes output files.
const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, ''));
const plan = read('inputs/plan.json');
const inventory = read('inputs/existing-accounts.json');
const loginAudit = read('inputs/login-audit.json');
const production = read('inputs/content-status.json');
const proposal = read('account-setup-proposal.json');
const registry = JSON.parse(fs.readFileSync(path.join(repo,'docs/마케팅/sns-계정.json'),'utf8').replace(/^\uFEFF/,''));
const social = read('intl-social/execution-20260920.json');
const youtube = read('intl-youtube/publication.json');
const jpVnYoutube = read('jp-vn-profile/publication.json');
const dashboard = read('dashboard/src/data.json');
const verification = read('verification-data.json');
const rows = name => dashboard.queries[name].rows;
const operating = inventory.accounts.filter(row => ['operating', 'operating-contact'].includes(row.accountStatus));
const sourceChannels = inventory.accounts.filter(row => row.accountStatus !== 'web-destination');
const channels = rows('channels');
const planned = channels.filter(row => row.accountStatus === 'planned');
const sorted = values => [...values].sort();
const mongoliaIds = ['lab-youtube', 'lab-instagram', 'lab-tiktok', 'lab-facebook', 'lab-telegram'];
// 2026-10-02 브라질·멕시코 추가(유호님 10-17 「지도에 맥시코 브라질 넣어」).
const countryCodes = ['VN', 'CN', 'JP', 'UZ', 'MN', 'TW', 'MM', 'TH', 'ID', 'RU', 'IN', 'KZ', 'NP', 'KG', 'KH', 'US', 'PH', 'LK', 'AU', 'PY', 'NZ', 'MY', 'CA', 'MX', 'BR'];
const contentIds = ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'C1', 'C2'];
const identityIds = loginAudit.identities.map(row => row.id);
// 로그인 「확인」 · 「로그인 필요」는 관측 뒤 72시간까지만 지금 상태로 보이고, 그 뒤로는 「이전 확인 기록」이다(tools/lib/계정현황.js).
// 지도 자료는 만든 시각에 굳으므로, 시간에 따라 바뀌는 기대값은 시험을 돌리는 시각이 아니라 만든 시각(generatedAt)으로 원장에서 다시 센다.
// 11-13 판은 그날의 숫자(로그인 확인 18 등)를 박아 두어, 11-12 확인이 72시간을 넘긴 11-15에 지도를 다시 만들자 시험 다섯이 깨졌다.
const observations = read('inputs/account-observations.json');
const builtAt = Date.parse(dashboard.generatedAt);
function expectedLoginState(row) {
  if (!['operating', 'operating-contact', 'confirmed-expansion'].includes(row.accountStatus)) return 'unknown';
  const explicit = observations.accounts?.[row.id]?.login;
  const explicitAt = Date.parse(explicit?.observedAt || ''), registryAt = Date.parse(registry.accounts[row.id]?.loginVerifiedAt || '');
  const [state, at] = Number.isFinite(explicitAt) && (!Number.isFinite(registryAt) || explicitAt >= registryAt) ? [explicit.state, explicitAt]
    : Number.isFinite(registryAt) ? ['verified', registryAt]
    : Number.isFinite(Date.parse(loginAudit.accounts[row.id]?.loginEvidenceAt || '')) ? ['historical', null] : ['unknown', null];
  return ['verified', 'login-required'].includes(state) && builtAt - at > 72 * 3600000 ? 'historical' : state;
}

test('account search intersects the current rows and searches Korean platform names and login routes', () => {
  const index = createSearchIndex(channels, channelSearchFields);
  assert.deepEqual(searchRows(channels,index,'  ＹＵＨＯＫＯＲＥＡＮ 인스타  ').map(row=>row.id),['yuhokorean-instagram']);
  // 11-13 최신 원장: 로그인 경로(Adobe · Google)와 지금 확인한 브라우저 프로필 이름으로 찾는다. 증거 없는 옛 Profile 2 경로는 Behance에 남지 않는다.
  assert.deepEqual(searchRows(channels,index,'Adobe Behance').map(row=>row.id),['yuhobuilds-behance']);
  // 검색은 칸마다 부분 일치라 「3」 같은 짧은 칸은 날짜(…13)에도 걸린다 — 프로필은 실제 경로의 고유한 말로 찾는다.
  // 11-13 실제 경로: yuhokorean 인스타 = Aside 4번째 yuhokorean 프로필(Profile 3), LAB 본 인스타 = Ego Profile 5.
  assert.equal(channels.find(row=>row.id==='yuhokorean-instagram').loginBrowser,'Aside · 4번째 yuhokorean 프로필(Profile 3)');
  assert.equal(channels.find(row=>row.id==='lab-instagram').loginBrowser,'Ego · Profile 5');
  assert.deepEqual(searchRows(channels,index,'Aside 4번째 인스타').map(row=>row.id),['yuhokorean-instagram']);
  const ego5=searchRows(channels,index,'Ego Profile 5 인스타').map(row=>row.id);
  assert.ok(ego5.includes('lab-instagram')&&!ego5.includes('yuhokorean-instagram'),ego5.join(','));
  assert.doesNotMatch(channels.find(row=>row.id==='yuhobuilds-behance').loginBrowser,/Profile 2/);
  assert.deepEqual(searchRows(channels.filter(row=>row.brand==='LAB'),index,'yuhokorean 인스타'),[]);
  assert.equal(searchRows(channels,index,'  '),channels);
  assert.deepEqual(searchRows(channels,index,'no-such-channel'),[]);
  // Search only the intended visible account fields, not arbitrary source paths or extra private fields.
  const fixture=[{id:'a',handle:'public-name',privateNote:'never-search-this'}];
  assert.deepEqual(searchRows(fixture,createSearchIndex(fixture,channelSearchFields),'never-search-this'),[]);
});

test('the selected detail always belongs to the searched and filtered rows', () => {
  const index=createSearchIndex(channels,channelSearchFields);
  const pinterest=searchRows(channels,index,'Pinterest');
  assert.equal(visibleChannel(pinterest,'yuhobuilds-behance').id,'shift-pinterest');
  assert.equal(visibleChannel([], 'yuhobuilds-behance'),null);
  const pulse=channels.filter(row=>row.brand==='PULSE');
  assert.equal(visibleChannel(pulse,'yuhobuilds-behance'),null);
  assert.equal(visibleChannel(pulse,'pulse-instagram').id,'pulse-instagram');
});

test('login overview counts only managed channels and keeps partial and switch-only distinct', () => {
  const managed=managedChannels(channels);
  assert.equal(managed.length,71);
  // 11-13 최신 조합값: 경로 확인 60 · 전환만 4 · 보완 필요 7. 요약은 행의 loginMappingStatus를 그대로 센 값과 같아야 한다.
  const summary=Object.fromEntries(loginSummary(channels).map(row=>[row.id,row.value]));
  assert.deepEqual(summary,{confirmed:60,'switch-only':4,partial:7,missing:0});
  for(const [id,value] of Object.entries(summary))assert.equal(value,managed.filter(row=>row.loginMappingStatus===id).length,id);
  assert.equal(loginSummary(channels).reduce((sum,row)=>sum+row.value,0),71);
  // 미생성 계획 15곳: 로그인 경로를 지어내지 않는다(연결 없음 · 상태 unknown · 관측 시각 없음).
  assert.equal(planned.length,15);
  assert.ok(loginSummary(planned).every(row=>row.value===0));
  for(const row of planned){
    assert.equal(row.loginMappingStatus,'not-created',row.id);
    assert.equal(row.loginAlias,null,row.id);
    assert.equal(row.operations.login.state,'unknown',row.id);
    assert.equal(row.operations.login.observedAt,null,row.id);
  }
  // 제외 · 보류 3곳(제외 · 보류된 기존 · 개설 미룸)은 관리 대상 수와 로그인 요약에 들어가지 않고, 로그인도 unknown으로 둔다.
  const held=channels.filter(row=>['excluded','excluded-existing','creation-deferred'].includes(row.accountStatus));
  assert.deepEqual(sorted(held.map(row=>row.id)),['synk-instagram','synkbrief-threads','yuhobuilds-linkedin']);
  assert.ok(held.every(row=>!managed.includes(row)&&row.operations.login.state==='unknown'));
});

test('brand navigation opens its own channels and clears stale destination cuts', () => {
  assert.deepEqual(brandChannelView('PULSE'),{filters:{brand:'PULSE',channelCountry:'all',channelScope:'all',platform:'all',loginState:'all'},focus:{}});
  const pulse=channels.filter(row=>row.brand===brandChannelView('PULSE').filters.brand);
  // 11-17: X(@yuhobuilds → @synk_pulse)와 링크드인 대표 프로필이 PULSE로 옮겨 와 5 → 7곳이다.
  assert.equal(pulse.length,7);
  assert.ok(pulse.some(row=>row.id==='pulse-youtube'));
  assert.ok(pulse.some(row=>row.id==='yuhobuilds-x')&&pulse.some(row=>row.id==='yuho-linkedin-primary'));
  assert.ok(!pulse.some(row=>row.id==='lab-youtube'));
});

test('login filters and connection search use audited values without changing the inventory', () => {
  assert.deepEqual(dashboard.filters.find(row=>row.id==='loginState'),{id:'loginState',label:'로그인 확인 상태',field:'loginStatusLabel',defaultValue:'all',queryIds:['channels']});
  // 화면 거르기 라벨은 운영 상태(operations.login.state)와 한 쌍으로만 나온다 — 옛 확인을 지금 확인으로, 미확인을 실패로 바꾸지 않는다.
  const labelOf={historical:'이전 확인 기록 · 현재 미재검증',verified:'로그인 확인','login-required':'확인한 프로필에서 로그인 필요',unknown:'현재 로그인 미확인'};
  const counts={};for(const row of channels)counts[row.loginStatusLabel]=(counts[row.loginStatusLabel]||0)+1;
  const expected={};for(const row of channels){const label=labelOf[expectedLoginState(row)];expected[label]=(expected[label]||0)+1;}
  assert.deepEqual(counts,expected);
  // 시각과 상관없는 몫: 확인 기록이 있는 관리 계정 71곳(지금 확인 + 이전 기록 + 로그인 필요)과 미확인 18곳(계획 15 · 제외 · 보류 3).
  // 11-14 판은 지금 확인 18 · 이전 기록 52 · 로그인 필요 1, 11-15 판은 11-12 확인이 72시간을 넘겨 3 · 67 · 1이다.
  const n=label=>counts[label]||0;
  assert.equal(n('로그인 확인')+n('이전 확인 기록 · 현재 미재검증')+n('확인한 프로필에서 로그인 필요'),71);
  assert.equal(n('현재 로그인 미확인'),18);
  for(const row of channels){
    const login=row.operations?.login;
    assert.ok(login&&labelOf[login.state],row.id);
    assert.equal(login.state,expectedLoginState(row),`${row.id}: 만든 시각 기준 로그인 상태`);
    assert.equal(row.loginStatusLabel,labelOf[login.state],row.id);
    if(['historical','verified','login-required'].includes(login.state))assert.ok(Number.isFinite(Date.parse(login.observedAt)),`${row.id}: 확인 시각 없는 확인`);
    if(login.state==='unknown')assert.ok(!managedChannels([row]).length,`${row.id}: 관리 계정을 미확인으로 두지 않는다`);
  }
  // 로그인 필요는 확인한 프로필 범위로만(전체 로그아웃으로 넓히지 않음). 72시간이 지나 이전 기록이 되어도 범위 글은 그대로다.
  const required=channels.filter(row=>row.operations.login.state==='login-required');
  const x=channels.find(row=>row.id==='yuhobuilds-x');
  assert.deepEqual(required.map(row=>row.id),expectedLoginState(x)==='login-required'?['yuhobuilds-x']:[]);
  assert.match(x.operations.login.scope,/확인한 두 프로필/);
  const identities=rows('identities');
  const index=createSearchIndex(identities,identitySearchFields);
  assert.deepEqual(searchRows(identities,index,'Behance').map(row=>row.id),['adobe-owner']);
  assert.deepEqual(searchRows(identities,index,'Pinterest').map(row=>row.id),['pinterest-owner']);
  assert.equal(channels.length,89);
});

function uniqueIds(items, label, key = 'id') {
  assert.ok(items.every(row => typeof row[key] === 'string' && row[key].length > 0), `${label}: missing ${key}`);
  assert.equal(new Set(items.map(row => row[key])).size, items.length, `${label}: duplicate ${key}`);
}

test('37 existing operating channels include the ten previously omitted records and the 11-12 PULSE TikTok without enabling publishing', () => {
  assert.equal(operating.length, 37);
  assert.equal(operating.filter(row => row.publishable === true).length, 23);
  assert.equal(operating.filter(row => row.accountStatus === 'operating-contact').length, 1);
  assert.equal(inventory.accounts.length, 46);
  assert.equal(sourceChannels.length, 40);
  assert.equal(inventory.metadata.counts.operatingAccountsAndChannels, operating.length);
  assert.equal(inventory.metadata.counts.publicPublishingTargets, 23);
  assert.equal(inventory.metadata.counts.totalRows, inventory.accounts.length);
  assert.deepEqual(sorted(channels.filter(row => row.channelScope === '기존 운영').map(row => row.id)), sorted(operating.map(row => row.id)));
});

test('all five Mongolia LAB accounts survive, with two priorities and three retained additions', () => {
  const input = operating.filter(row => row.brand === 'LAB' && row.country === '몽골');
  const output = channels.filter(row => row.brand === 'LAB' && row.country === '몽골');
  assert.deepEqual(sorted(input.map(row => row.id)), sorted(mongoliaIds));
  assert.deepEqual(sorted(output.map(row => row.id)), sorted(mongoliaIds));
  assert.deepEqual(sorted(output.filter(row => row.priority === '우선 플랫폼').map(row => row.id)), ['lab-instagram', 'lab-youtube']);
  assert.equal(output.filter(row => row.priority === '기존 추가 채널 유지').length, 3);
  assert.equal(rows('countries').find(row => row.code === 'MN').existingCount, 5);
});

test('25 countries and 51 LAB priority slots include Brazil TikTok', () => {
  assert.deepEqual(sorted(production.countries.map(row => row.code)), sorted(countryCodes));
  assert.deepEqual(sorted(rows('countries').map(row => row.code)), sorted(countryCodes));
  assert.equal(production.planCounts.countries, 25);
  assert.equal(production.planCounts.plannedCountryPlatformSlots, 51);
  for (const country of production.countries) {
    assert.equal(country.brand, 'LAB', country.code);
    assert.equal(country.channelSlots.length, country.code === 'BR' ? 3 : 2, country.code);
    assert.equal(new Set(country.platforms).size, country.channelSlots.length, country.code);
    assert.deepEqual(sorted(country.channelSlots.map(slot => slot.platform)), sorted(country.platforms), country.code);
    const output = rows('countries').find(row => row.code === country.code);
    assert.equal(output.brand, 'LAB');
    assert.equal(output.country, country.name);
    assert.equal(output.platformsLabel, country.platforms.join(' · '));
  }
});

test('49 expansion slots reconcile to 34 confirmed accounts and 15 unconfirmed places', () => {
  const slots = production.countries.flatMap(country => country.channelSlots.map(slot => ({country, slot})));
  const newSlots = slots.filter(({slot}) => slot.accountId === null);
  assert.equal(newSlots.length, 49);
  assert.equal(proposal.channels.length, 49);
  assert.equal(planned.length, 15);
  assert.equal(channels.filter(row => row.accountStatus === 'confirmed-expansion').length, 34);
  assert.equal(production.planCounts.newChannelSlotsPlanned, 49);
  assert.equal(production.planCounts.newCountryCandidates, 24);
  assert.equal(new Set(planned.map(row => row.countryCode)).size, 14);
  for (const {country, slot} of newSlots) {
    assert.notEqual(country.code, 'MN');
    assert.equal(slot.status, 'planned-not-created-or-verified');
    assert.equal(slot.handle, null);
    assert.equal(slot.url, null);
    const matches = channels.filter(row => row.countryCode === country.code && row.platform === slot.platform);
    assert.equal(matches.length, 1, `${country.code}/${slot.platform}`);
    const row = matches[0];
    assert.equal(row.brand, 'LAB');
    assert.equal(row.country, country.name);
    assert.deepEqual(row.publicationEvidence, row.operations.publication.receipts.length ? row.operations.publication.receipts : null);
    if (registry.accounts[row.id]) {
      assert.equal(row.accountStatus, 'confirmed-expansion');
      assert.equal(row.channelScope, '확장 확보');
    } else {
      assert.equal(row.accountStatus, 'planned');
      assert.equal(row.channelScope, '확장 미확인');
      for (const key of ['handle', 'publicUrl', 'loginAlias']) assert.equal(row[key], null, `${row.id}.${key}`);
    }
  }
});

test('the two reused Mongolia priority slots point to existing accounts, not new rows', () => {
  const reused = production.countries.flatMap(country => country.channelSlots.filter(slot => slot.accountId !== null).map(slot => ({country, slot})));
  assert.equal(reused.length, 2);
  assert.equal(production.planCounts.existingMongoliaRecordSlots, 2);
  assert.deepEqual(sorted(reused.map(({slot}) => slot.accountId)), ['lab-instagram', 'lab-youtube']);
  for (const {country, slot} of reused) {
    assert.equal(country.code, 'MN');
    const account = inventory.accounts.find(row => row.id === slot.accountId);
    assert.equal(slot.handle, account.handle);
    assert.equal(slot.url, account.publicUrl);
    assert.equal(channels.filter(row => row.id === slot.accountId).length, 1);
  }
});

test('89 channel rows mean 40 existing/deferred entries plus 49 expansion slots', () => {
  assert.equal(channels.length, 89);
  assert.equal(channels.length, sourceChannels.length + proposal.channels.length);
  assert.equal(channels.filter(row => row.brand === 'LAB').length, 54);
  assert.equal(channels.filter(row => row.channelScope === '확장 확보').length, 34);
  assert.equal(channels.filter(row => row.channelScope === '확장 미확인').length, 15);
  assert.equal(channels.filter(row => row.accountStatus === 'excluded-existing').length, 1);
  assert.equal(channels.filter(row => ['excluded', 'creation-deferred'].includes(row.accountStatus)).length, 2);
  assert.equal(channels.filter(row => row.accountStatus === 'web-destination').length, 0);
});

test('source account identity, login routing and profile evidence codes are preserved', () => {
  for (const source of sourceChannels) {
    const output = channels.find(row => row.id === source.id);
    assert.ok(output, source.id);
    for (const key of ['handle', 'publicUrl', 'loginAlias', 'accountStatus', 'publishable', 'lastEvidenceAt']) assert.equal(output[key], source[key], `${source.id}.${key}`);
    assert.equal(output.sourceBrand, source.brand);
    assert.equal(output.brand, source.operatingScope === 'YUHO' ? 'YUHO' : source.brand);
    assert.equal(output.profileStatusCode, source.profileStatus);
    assert.deepEqual(output.sharedBrands, source.sharedBrands);
    assert.deepEqual(output.sourcePaths, source.sourcePaths);
    assert.deepEqual(output.publicationEvidence, output.operations.publication.receipts.length ? output.operations.publication.receipts : null);
  }
});

test('shared YouTube and Substack stay single accounts and do not inflate owned counts', () => {
  assert.deepEqual(sorted(inventory.metadata.sharedChannels.map(row => row.accountId)), ['lab-youtube', 'synklab-substack']);
  for (const id of ['lab-youtube', 'synklab-substack']) assert.equal(channels.filter(row => row.id === id).length, 1);
  assert.deepEqual(channels.find(row => row.id === 'lab-youtube').sharedBrands, ['PULSE']);
  assert.deepEqual(channels.find(row => row.id === 'synklab-substack').sharedBrands, ['LAB', 'SHIFT']);
  assert.equal(rows('brands').reduce((sum, row) => sum + row.ownedCount, 0), 37);
  const expectedShared = {SYNK: 0, LAB: 1, SHIFT: 1, YUHO: 0, PULSE: 1, PATH: 0, YUHOKOREAN: 0, POLITICS: 0};
  for (const brand of rows('brands')) {
    assert.equal(brand.ownedCount, channels.filter(row => row.brand === brand.id && row.channelScope === '기존 운영').length, brand.id);
    assert.equal(brand.sharedCount, expectedShared[brand.id], brand.id);
  }
  // 11-17: X와 링크드인 대표 프로필이 YUHO에서 PULSE로 옮겨 PULSE 기존 운영은 5 → 7이다(합계 37은 그대로).
  assert.equal(rows('brands').find(row => row.id === 'PULSE').ownedCount, 7);
  assert.equal(channels.find(row => row.id === 'pulse-youtube').handle, '@synkpulse');
  assert.equal(registry.accounts['pulse-youtube'].expectedChannelId, 'UCvCOJtdC-JgotRgAsbdNFBg');
});

test('14 older concepts remain intact and two newer video review copies are tracked before publishing', () => {
  assert.deepEqual(sorted(production.contents.map(row => row.id)), sorted(contentIds));
  assert.deepEqual(rows('contents').slice(0,14), production.contents.map(row=>({...row,recordScope:'historical',publishStatus:`과거 제작 기록: ${row.publishStatus || '해당 문서 참조'}`})));
  assert.equal(rows('contents').length,25);
  const lines = rows('contents').filter(row => String(row.id).startsWith('CL-'));
  assert.equal(lines.length, 9);
  for (const line of lines) { assert.equal(line.approvalStatus, 'unknown', line.id); assert.match(line.publishStatus, /미게시/, line.id); assert.match(line.format, /^라인/, line.id); }
  const external = production.contents.filter(row => row.scopeOwner.includes('다른 세션'));
  assert.deepEqual(sorted(external.map(row => row.id)), ['L1', 'S1']);
  assert.equal(production.contents.length - external.length, 12);
  assert.equal(production.planCounts.facelessContentConcepts, 12);
  assert.equal(production.planCounts.faceVideoConceptsOtherSession, 2);
  for (const content of production.contents) {
    assert.equal(content.approvalStatus, 'unknown', content.id);
    assert.equal(content.currentExternalStatus, 'unknown', content.id);
    assert.match(content.publishStatus, /미게시/, content.id);
  }
  for (const id of ['YB-EP01','SB-EP01']) {
    const content=rows('contents').find(row=>row.id===id);
    assert.ok(content);
    assert.equal(content.approvalStatus,'unknown');
    assert.match(content.publishStatus,/게시 없음/);
  }
});

test('all login connections come from the audited source, not six historic role proposals', () => {
  assert.equal(identityIds.length,28);
  assert.deepEqual(rows('identities'),loginAudit.identities);
  for (const row of rows('identities')) assert.equal(row.security,'이번 점검 범위 밖',row.id);
  assert.equal(channels.find(row=>row.id==='lab-cn-xiaohongshu').loginIdentityRef,'rednote-phone');
  assert.equal(channels.find(row=>row.id==='lab-cn-xiaohongshu').loginMappingStatus,'confirmed');
  assert.equal(channels.find(row=>row.id==='yuhokorean-tiktok').loginIdentityRef,'tiktok-yuhokorean');
});

test('every input collection and dashboard query has unique nonempty identifiers', () => {
  uniqueIds(inventory.accounts, 'inventory');
  uniqueIds(plan.brands, 'plan brands');
  uniqueIds(plan.identities, 'identities');
  uniqueIds(production.contents, 'contents');
  uniqueIds(production.countries, 'countries', 'code');
  for (const [name, query] of Object.entries(dashboard.queries)) uniqueIds(query.rows, `dashboard ${name}`);
});

test('summary cards reconcile to separate units, and web/product destinations are not SNS rows', () => {
  const expected = {existing: [37, '채널'], 'lab-secured': [34, '곳'], 'lab-pending': [15, '곳'], 'lab-world': [25, '개국']};
  assert.deepEqual(sorted(rows('summary').map(row => row.id)), sorted(Object.keys(expected)));
  for (const row of rows('summary')) assert.deepEqual([row.value, row.unit], expected[row.id], row.id);
  const websites = inventory.accounts.filter(row => row.accountStatus === 'web-destination');
  assert.equal(websites.length, 6);
  assert.equal(rows('destinations').length, 7);
  for (const row of rows('destinations')) assert.ok(!channels.some(channel => channel.id === row.id), row.id);
  for (const row of websites) assert.equal(rows('destinations').find(output => output.id === row.id).publicUrl, row.publicUrl, row.id);
});

test('confirmed account details follow the latest ledgers without promoting an individual VK account to a LAB channel', () => {
  assert.equal(social.counts.created,8);
  assert.equal(social.counts.notCreated,20);
  const expansion=channels.filter(row=>row.accountStatus==='confirmed-expansion');
  assert.equal(expansion.filter(row=>row.platform==='YouTube').length,18);
  assert.equal(expansion.filter(row=>row.platform!=='YouTube').length,16);
  // 09-20 원장에서 생성 미확인이던 인도네시아 TikTok은 10-19 레지스트리 개설 확인으로 확보가 된다. 사진은 11-15 밤에 LAB 로고로 채워 「사진 확인」으로 보인다(원장 profileStatus).
  const idTiktok=channels.find(row=>row.id==='lab-id-tiktok');
  assert.equal(social.channels.find(row=>row.id==='lab-id-tiktok').created,false);
  assert.equal(registry.accounts['lab-id-tiktok'].creationVerified,true);
  assert.equal(idTiktok.accountStatus,'confirmed-expansion');
  assert.equal(idTiktok.publicUrl,registry.accounts['lab-id-tiktok'].publicUrl);
  assert.match(idTiktok.profileStatus,/사진 확인/);
  assert.equal(idTiktok.observedGate,null);
  for(const record of [...youtube.channels,...jpVnYoutube.channels].filter(row=>row.id!=='lab-youtube')) {
    const row=channels.find(item=>item.id===record.id);
    assert.equal(row.publicUrl,record.url,record.id);
    assert.equal(row.youtubeProfileVerified,true,record.id);
  }
  const rednote=channels.find(row=>row.id==='lab-cn-xiaohongshu');
  assert.match(rednote.profileStatus,/미반영/);
  assert.match(rednote.verificationScope,/비로그인 공개 확인 아님/);
  // Preserve the 10-02 record, except Mexico TikTok's owner verification on 11-08 and its name · bio · avatar saved on 11-15.
  const brMx = JSON.parse(fs.readFileSync(path.join(repo,'docs/마케팅/프로필_클로드판_20261002/개설기록_브라질멕시코.json'),'utf8'));
  for (const record of brMx.channels) {
    const row = channels.find(item => item.id === record.id);
    assert.ok(row, record.id);
    if (record.id === 'lab-mx-tiktok') {
      assert.equal(row.accountStatus, 'confirmed-expansion');
      assert.equal(row.publicUrl, 'https://www.tiktok.com/@synklab.mx');
      assert.match(row.profileStatusCode, /name-bio-link-avatar-saved/);
      continue;
    }
    assert.equal(row.accountStatus, record.creationVerified ? 'confirmed-expansion' : 'planned', record.id);
    assert.equal(row.publicUrl, record.creationVerified ? record.publicUrl : null, record.id);
  }
  assert.equal(channels.find(row=>row.id==='lab-br-youtube').youtubeProfileVerified,true);
  assert.equal(channels.find(row=>row.id==='lab-mx-youtube').youtubeProfileVerified,false);
  assert.match(channels.find(row=>row.id==='lab-mx-youtube').profileStatus,/미확인/);
  const vk=channels.find(row=>row.id==='lab-ru-vk');
  assert.equal(vk.accountStatus,'confirmed-expansion');
  assert.equal(vk.publicUrl,'https://vk.ru/synklab_ru');
  // 11-12 Ego Profile 5 로그인 확인은 72시간이 지나도 경로 확인으로 남는다(지금 확인 여부만 만든 시각을 따른다).
  assert.equal(vk.loginMappingStatus,'confirmed');
  assert.match(vk.loginEvidenceAt,/^2026-11-12/);
  assert.equal(vk.operations.login.state,expectedLoginState(vk));
  assert.equal(vk.loginBrowser,'Ego · Profile 5');
});

test('all declared sourcePaths and dashboard source files exist within the repository', () => {
  const declared = new Set();
  function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourcePaths' || key === 'loginSourcePaths') {
        assert.ok(Array.isArray(child));
        child.forEach(file => declared.add(file));
      } else collect(child);
    }
  }
  [plan, inventory, production, dashboard, loginAudit].forEach(collect);
  for (const query of Object.values(dashboard.queries)) query.source.files.forEach(file => declared.add(file));
  assert.ok(declared.size > 0);
  for (const file of declared) {
    assert.equal(typeof file, 'string');
    const resolved = path.resolve(repo, file);
    const relative = path.relative(repo, resolved);
    assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `outside repository: ${file}`);
    assert.ok(fs.existsSync(resolved), `missing source: ${file}`);
    assert.ok(fs.statSync(resolved).isFile(), `source is not a file: ${file}`);
  }
});

test('the snapshot does not claim live verification of the entire inventory', () => {
  assert.equal(inventory.metadata.liveLoginVerified, false);
  assert.equal(production.audit.externalStateRechecked, false);
  for (const query of Object.values(dashboard.queries)) assert.ok(query.source.filters.some(filter => filter.includes('실시간 SNS 조회 아님')));
});

test('the built snapshot records hashes of the current source ledgers', () => {
  assert.equal(verification.generatedAt,dashboard.generatedAt);
  assert.equal(verification.counts.expansionConfirmed,34);
  assert.equal(verification.counts.expansionUnconfirmed,15);
  for(const item of verification.files) {
    const actual=sourceHash(fs.readFileSync(path.join(dir,item.file)));
    assert.equal(item.sha256,actual,`${item.file} changed after the map was built`);
  }
});

test('every registry account and supplemental channel has one explicit login audit row', () => {
  assert.equal(Object.keys(registry.accounts).length,64);
  assert.equal(loginAudit.supplementalIds.length,10);
  for (const id of [...Object.keys(registry.accounts),...loginAudit.supplementalIds]) {
    assert.equal(channels.filter(row=>row.id===id).length,1,id);
    assert.ok(loginAudit.accounts[id],id);
  }
  assert.deepEqual(sorted(Object.keys(loginAudit.accounts)),sorted(channels.map(row=>row.id)));
  for (const row of channels) {
    for (const key of ['loginMethod','loginBrowser','loginMappingStatus','loginStatusLabel','loginSessionStatus']) assert.ok(row[key],`${row.id}.${key}`);
    assert.ok(row.loginSourcePaths.length>=2,row.id);
    if (row.loginMappingStatus==='missing') assert.equal(row.loginEvidenceAt,null,row.id);
  }
  for (const id of loginAudit.supplementalIds) {
    assert.equal(inventory.accounts.find(row=>row.id===id).publishable,false,id);
    assert.equal(registry.accounts[id],undefined,`${id} must not be silently added to publishing registry`);
  }
});

test('yuhokorean Facebook keeps its public profile number and only the catalog gets its Graph page number', () => {
  const catalog = read('engagement/company/account-catalog.json');
  const source = inventory.accounts.find(row => row.id === 'yuhokorean-facebook');
  const entry = catalog.accounts.find(row => row.id === 'yuhokorean-facebook');
  // 11-14 Business Suite 페이지 설정에서 읽은 페이지 번호다. API 연결 확인이 아니며 공개 프로필 번호와 섞지 않는다.
  assert.equal(source.publicUrl, 'https://www.facebook.com/profile.php?id=61596244437180');
  assert.equal(source.apiPageId, '1439595579236894');
  assert.equal(entry.publicUrl, source.publicUrl);
  assert.equal(entry.externalId, '1439595579236894');
  assert.equal(channels.find(row => row.id === 'yuhokorean-facebook').apiPageId, undefined, '현황판 행에는 싣지 않는다');
  // 등록 수 불변: 게시 원장에 넣지 않고 카탈로그 행 수도 그대로다
  assert.equal(registry.accounts['yuhokorean-facebook'], undefined);
  assert.equal(catalog.accounts.length, loginAudit.counts.channelRows);
  // 원장 밖 계정의 externalId는 Facebook 지도 목록 행의 apiPageId에서만 온다
  for (const row of catalog.accounts) if (!registry.accounts[row.id]) assert.equal(row.externalId, (row.platform === 'facebook' && inventory.accounts.find(a => a.id === row.id)?.apiPageId) || null, row.id);
});

test('registry Graph page and company numbers generate the catalog numbers while public profile numbers stay in the registry', () => {
  const catalog = read('engagement/company/account-catalog.json');
  for (const account of catalog.accounts) { const row = registry.accounts?.[account.id]; if (row && (row.apiPageId || row.companyId)) assert.equal(account.externalId, row.channelId || row.expectedChannelId || row.profileId || row.companyId || row.apiPageId, account.id); }
  const graph = {'lab-np-facebook': '1311065102093068', 'lab-kh-facebook': '1311331138729740', 'lab-lk-facebook': '1322127544319220', 'pulse-facebook': '1376159468922910'};
  for (const [id, graphId] of Object.entries(graph)) { assert.equal(registry.accounts[id].apiPageId, graphId, id); assert.equal(catalog.accounts.find(row => row.id === id).externalId, graphId, id); }
  assert.deepEqual(['lab-np-facebook', 'lab-kh-facebook', 'lab-lk-facebook'].map(id => registry.accounts[id].pageId), ['61594359371146', '61594726675164', '61594274084966'], 'public profile numbers stay as they were');
  assert.equal(registry.accounts['pulse-facebook'].expectedPageId, '61596231157441');
});

test('login route confidence reconciles without claiming that every session is live', () => {
  const active=channels.filter(row=>['operating','operating-contact','confirmed-expansion'].includes(row.accountStatus));
  assert.equal(active.length,71);
  assert.equal(active.filter(row=>['confirmed','switch-only','partial','missing'].includes(row.loginMappingStatus)).length,active.length);
  assert.deepEqual(active.filter(row=>row.loginMappingStatus==='missing').map(row=>row.id),[]);
  assert.ok(active.some(row=>row.operations.login.state==='historical'),'old evidence does not claim a live session');
  for (const id of ['lab-th-tiktok','lab-kz-tiktok','lab-mx-tiktok']) { const row=channels.find(row=>row.id===id); assert.equal(row.operations.login.state,expectedLoginState(row),id); assert.notEqual(row.operations.login.state,'unknown',id); assert.equal(row.loginMappingStatus,'confirmed',id); assert.match(row.loginEvidenceAt,/2026-11-12/); assert.doesNotMatch(row.loginSessionStatus,/로그아웃/); }
});

test('parent administrators, account switching, and unknown identifiers remain distinct', () => {
  const get=id=>channels.find(row=>row.id===id);
  assert.equal(get('pulse-facebook').loginIdentityRef,'meta-main');
  assert.equal(get('yuhokorean-facebook').loginIdentityRef,'meta-yuhokorean');
  assert.notEqual(get('yuhokorean-tiktok').loginIdentityRef,get('yuhokorean-youtube').loginIdentityRef);
  assert.match(get('yuhokorean-tiktok').loginBrowser,/Aside.*4번째/);
  assert.equal(get('pulse-instagram').loginMappingStatus,'switch-only');
  assert.equal(get('lab-jp-instagram').loginMappingStatus,'confirmed');
  assert.equal(get('lab-uz-instagram').loginMappingStatus,'confirmed');
  assert.equal(get('shift-naverblog').loginIdentityRef,'naver-main');
  assert.equal(get('pulse-naverblog').loginIdentityRef,'naver-pulse');
  assert.equal(get('pulse-tiktok').loginIdentityRef,'tiktok-pulse-email');
  assert.equal(get('pulse-tiktok').handle,'@synkpulse');
  assert.equal(get('pulse-tiktok').publishable,false);
  assert.equal(get('shift-class-naverblog').loginIdentityRef,'naver-class');
  assert.equal(get('lab-kz-tiktok').loginIdentityRef,'naver-class');
  assert.equal(get('lab-mx-tiktok').loginIdentityRef,'naver-pulse');
  assert.match(get('lab-ru-rutube').loginMethod,/GID 이메일/);
  assert.equal(registry.accounts['lab-ru-rutube'].loginEmail,undefined);
});

test('mail aliases and older long-term plans are not counted as created accounts', () => {
  const assigned=planned.filter(row=>row.plannedLoginIdentityRef);
  assert.equal(assigned.length,6);
  for (const row of assigned) {
    assert.equal(row.plannedLoginIdentityRef,'workspace-founder');
    assert.equal(row.loginIdentityRef,null);
    assert.equal(row.loginAlias,null);
    assert.equal(row.loginMappingStatus,'not-created');
  }
  assert.equal(channels.find(row=>row.id==='lab-br-tiktok').plannedLoginIdentityRef,undefined);
  assert.equal(loginAudit.otherPlanned.length,16);
  assert.equal(planned.length+loginAudit.otherPlanned.length,31);
  assert.ok(!loginAudit.otherPlanned.some(row=>row.brand==='PULSE' && row.platform==='TikTok'),'11-12 PULSE TikTok은 계획에서 기존 등록으로 옮겼다');
  for (const row of loginAudit.otherPlanned) {
    assert.equal(row.accountStatus,'planned-unconfirmed');
    assert.ok(!channels.some(channel=>channel.id===row.id));
  }
  assert.equal(channels.find(row=>row.id==='synk-instagram').loginMappingStatus,'excluded');
});

test('the public login audit contains aliases and no full email addresses or credentials', () => {
  const text=JSON.stringify(loginAudit);
  assert.doesNotMatch(text,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(text,/"(?:password|accessToken|refreshToken|verificationCode|cookie)"\s*:/i);
  assert.ok(loginAudit.privateDetails.includes('비공개'));
});
