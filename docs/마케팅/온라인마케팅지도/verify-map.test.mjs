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

test('account search intersects the current rows and searches Korean platform names and login routes', () => {
  const index = createSearchIndex(channels, channelSearchFields);
  assert.deepEqual(searchRows(channels,index,'  ＹＵＨＯＫＯＲＥＡＮ 인스타  ').map(row=>row.id),['yuhokorean-instagram']);
  assert.deepEqual(searchRows(channels,index,'PROFILE 2 Behance').map(row=>row.id),['yuhobuilds-behance']);
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
  assert.equal(managedChannels(channels).length,70);
  assert.deepEqual(Object.fromEntries(loginSummary(channels).map(row=>[row.id,row.value])),{confirmed:54,'switch-only':6,partial:10,missing:0});
  assert.equal(loginSummary(channels).reduce((sum,row)=>sum+row.value,0),70);
  assert.ok(loginSummary(channels.filter(row=>row.accountStatus==='planned')).every(row=>row.value===0));
});

test('brand navigation opens its own channels and clears stale destination cuts', () => {
  assert.deepEqual(brandChannelView('PULSE'),{filters:{brand:'PULSE',channelCountry:'all',channelScope:'all',platform:'all',loginState:'all'},focus:{}});
  const pulse=channels.filter(row=>row.brand===brandChannelView('PULSE').filters.brand);
  assert.equal(pulse.length,4);
  assert.ok(pulse.some(row=>row.id==='pulse-youtube'));
  assert.ok(!pulse.some(row=>row.id==='lab-youtube'));
});

test('login filters and connection search use audited values without changing the inventory', () => {
  assert.deepEqual(dashboard.filters.find(row=>row.id==='loginState'),{id:'loginState',label:'로그인 확인 상태',field:'loginStatusLabel',defaultValue:'all',queryIds:['channels']});
  assert.equal(channels.filter(row=>row.loginStatusLabel==='일부 확인 · 보완 필요').length,10);
  const identities=rows('identities');
  const index=createSearchIndex(identities,identitySearchFields);
  assert.deepEqual(searchRows(identities,index,'Behance').map(row=>row.id),['adobe-owner']);
  assert.deepEqual(searchRows(identities,index,'Pinterest').map(row=>row.id),['pinterest-owner']);
  assert.equal(channels.length,88);
});

function uniqueIds(items, label, key = 'id') {
  assert.ok(items.every(row => typeof row[key] === 'string' && row[key].length > 0), `${label}: missing ${key}`);
  assert.equal(new Set(items.map(row => row[key])).size, items.length, `${label}: duplicate ${key}`);
}

test('36 existing operating channels include the ten previously omitted records without enabling publishing', () => {
  assert.equal(operating.length, 36);
  assert.equal(operating.filter(row => row.publishable === true).length, 23);
  assert.equal(operating.filter(row => row.accountStatus === 'operating-contact').length, 1);
  assert.equal(inventory.accounts.length, 45);
  assert.equal(sourceChannels.length, 39);
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
    assert.equal(row.publicationEvidence, null);
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

test('88 channel rows mean 39 existing/deferred entries plus 49 expansion slots', () => {
  assert.equal(channels.length, 88);
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
    assert.equal(output.publicationEvidence, null);
  }
});

test('shared YouTube and Substack stay single accounts and do not inflate owned counts', () => {
  assert.deepEqual(sorted(inventory.metadata.sharedChannels.map(row => row.accountId)), ['lab-youtube', 'synklab-substack']);
  for (const id of ['lab-youtube', 'synklab-substack']) assert.equal(channels.filter(row => row.id === id).length, 1);
  assert.deepEqual(channels.find(row => row.id === 'lab-youtube').sharedBrands, ['PULSE']);
  assert.deepEqual(channels.find(row => row.id === 'synklab-substack').sharedBrands, ['LAB', 'SHIFT']);
  assert.equal(rows('brands').reduce((sum, row) => sum + row.ownedCount, 0), 36);
  const expectedShared = {SYNK: 0, LAB: 1, SHIFT: 1, YUHO: 0, PULSE: 1, PATH: 0, YUHOKOREAN: 0, POLITICS: 0};
  for (const brand of rows('brands')) {
    assert.equal(brand.ownedCount, channels.filter(row => row.brand === brand.id && row.channelScope === '기존 운영').length, brand.id);
    assert.equal(brand.sharedCount, expectedShared[brand.id], brand.id);
  }
  assert.equal(rows('brands').find(row => row.id === 'PULSE').ownedCount, 4);
  assert.equal(channels.find(row => row.id === 'pulse-youtube').handle, '@synkpulse');
  assert.equal(registry.accounts['pulse-youtube'].expectedChannelId, 'UCvCOJtdC-JgotRgAsbdNFBg');
});

test('14 older concepts remain intact and two newer video review copies are tracked before publishing', () => {
  assert.deepEqual(sorted(production.contents.map(row => row.id)), sorted(contentIds));
  assert.deepEqual(rows('contents').slice(0,14), production.contents);
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
  assert.equal(identityIds.length,27);
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
  const expected = {existing: [36, '채널'], 'lab-secured': [34, '곳'], 'lab-pending': [15, '곳'], 'lab-world': [25, '개국']};
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
  // 09-20 원장에서 생성 미확인이던 인도네시아 TikTok은 10-19 레지스트리 개설 확인으로 확보가 되고, 사진 미반영이 그대로 보인다.
  const idTiktok=channels.find(row=>row.id==='lab-id-tiktok');
  assert.equal(social.channels.find(row=>row.id==='lab-id-tiktok').created,false);
  assert.equal(registry.accounts['lab-id-tiktok'].creationVerified,true);
  assert.equal(idTiktok.accountStatus,'confirmed-expansion');
  assert.equal(idTiktok.publicUrl,registry.accounts['lab-id-tiktok'].publicUrl);
  assert.match(idTiktok.profileStatus,/사진 미반영/);
  assert.equal(idTiktok.observedGate,null);
  for(const record of [...youtube.channels,...jpVnYoutube.channels].filter(row=>row.id!=='lab-youtube')) {
    const row=channels.find(item=>item.id===record.id);
    assert.equal(row.publicUrl,record.url,record.id);
    assert.equal(row.youtubeProfileVerified,true,record.id);
  }
  const rednote=channels.find(row=>row.id==='lab-cn-xiaohongshu');
  assert.match(rednote.profileStatus,/미반영/);
  assert.match(rednote.verificationScope,/비로그인 공개 확인 아님/);
  // Preserve the 10-02 record, except Mexico TikTok's owner verification on 11-08.
  const brMx = JSON.parse(fs.readFileSync(path.join(repo,'docs/마케팅/프로필_클로드판_20261002/개설기록_브라질멕시코.json'),'utf8'));
  for (const record of brMx.channels) {
    const row = channels.find(item => item.id === record.id);
    assert.ok(row, record.id);
    if (record.id === 'lab-mx-tiktok') {
      assert.equal(row.accountStatus, 'confirmed-expansion');
      assert.equal(row.publicUrl, 'https://www.tiktok.com/@synklab.mx');
      assert.match(row.profileStatusCode, /name-bio-avatar-pending/);
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
  assert.equal(vk.loginMappingStatus,'partial');
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
  assert.equal(Object.keys(registry.accounts).length,63);
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

test('login route confidence reconciles without claiming that every session is live', () => {
  const active=channels.filter(row=>['operating','operating-contact','confirmed-expansion'].includes(row.accountStatus));
  assert.equal(active.length,70);
  const expected={confirmed:54,'switch-only':6,partial:10,missing:0};
  for (const [state,count] of Object.entries(expected)) assert.equal(active.filter(row=>row.loginMappingStatus===state).length,count,state);
  assert.deepEqual(active.filter(row=>row.loginMappingStatus==='missing').map(row=>row.id),[]);
  assert.equal(active.filter(row=>row.platform==='YouTube' && row.loginEvidenceAt==='2026-11-09').length,24);
  for (const id of ['lab-th-tiktok','lab-kz-tiktok','lab-mx-tiktok']) assert.match(channels.find(row=>row.id===id).loginSessionStatus,/로그아웃/);
});

test('parent administrators, account switching, and unknown identifiers remain distinct', () => {
  const get=id=>channels.find(row=>row.id===id);
  assert.equal(get('pulse-facebook').loginIdentityRef,'meta-main');
  assert.equal(get('yuhokorean-facebook').loginIdentityRef,'meta-yuhokorean');
  assert.notEqual(get('yuhokorean-tiktok').loginIdentityRef,get('yuhokorean-youtube').loginIdentityRef);
  assert.match(get('yuhokorean-tiktok').loginBrowser,/Aside.*4번째/);
  assert.equal(get('pulse-instagram').loginMappingStatus,'switch-only');
  assert.equal(get('lab-jp-instagram').loginMappingStatus,'switch-only');
  assert.equal(get('lab-uz-instagram').loginMappingStatus,'switch-only');
  assert.equal(get('shift-naverblog').loginIdentityRef,'naver-main');
  assert.equal(get('pulse-naverblog').loginIdentityRef,'naver-pulse');
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
  assert.equal(loginAudit.otherPlanned.length,17);
  assert.equal(planned.length+loginAudit.otherPlanned.length,32);
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
