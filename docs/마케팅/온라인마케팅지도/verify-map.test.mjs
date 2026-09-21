import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only contract tests: never import the generator, which writes output files.
const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, ''));
const plan = read('inputs/plan.json');
const inventory = read('inputs/existing-accounts.json');
const production = read('inputs/content-status.json');
const dashboard = read('dashboard/src/data.json');
const rows = name => dashboard.queries[name].rows;
const operating = inventory.accounts.filter(row => ['operating', 'operating-contact'].includes(row.accountStatus));
const sourceChannels = inventory.accounts.filter(row => row.accountStatus !== 'web-destination');
const channels = rows('channels');
const planned = channels.filter(row => row.accountStatus === 'planned');
const sorted = values => [...values].sort();
const mongoliaIds = ['lab-youtube', 'lab-instagram', 'lab-tiktok', 'lab-facebook', 'lab-telegram'];
const countryCodes = ['VN', 'CN', 'JP', 'UZ', 'MN', 'TW', 'MM', 'TH', 'ID', 'RU', 'IN', 'KZ', 'NP', 'KG', 'KH', 'US', 'PH', 'LK', 'AU', 'PY', 'NZ', 'MY', 'CA'];
const contentIds = ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'C1', 'C2'];
const identityIds = ['founder', 'synk-yuh', 'unmet27', 'unmet23', '77yuhbs', 'unmet25'];

function uniqueIds(items, label, key = 'id') {
  assert.ok(items.every(row => typeof row[key] === 'string' && row[key].length > 0), `${label}: missing ${key}`);
  assert.equal(new Set(items.map(row => row[key])).size, items.length, `${label}: duplicate ${key}`);
}

test('existing operating accounts remain 23, including 22 public destinations and one personal contact', () => {
  assert.equal(operating.length, 23);
  assert.equal(operating.filter(row => row.publishable === true).length, 22);
  assert.equal(operating.filter(row => row.accountStatus === 'operating-contact').length, 1);
  assert.equal(inventory.accounts.length, 32);
  assert.equal(sourceChannels.length, 26);
  assert.equal(inventory.metadata.counts.operatingAccountsAndChannels, operating.length);
  assert.equal(inventory.metadata.counts.publicPublishingTargets, 22);
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

test('23 distinct countries and their 46 priority slots belong only to LAB', () => {
  assert.deepEqual(sorted(production.countries.map(row => row.code)), sorted(countryCodes));
  assert.deepEqual(sorted(rows('countries').map(row => row.code)), sorted(countryCodes));
  assert.equal(production.planCounts.countries, 23);
  assert.equal(production.planCounts.plannedCountryPlatformSlots, 46);
  for (const country of production.countries) {
    assert.equal(country.brand, 'LAB', country.code);
    assert.equal(country.channelSlots.length, 2, country.code);
    assert.equal(new Set(country.platforms).size, 2, country.code);
    assert.deepEqual(sorted(country.channelSlots.map(slot => slot.platform)), sorted(country.platforms), country.code);
    const output = rows('countries').find(row => row.code === country.code);
    assert.equal(output.brand, 'LAB');
    assert.equal(output.country, country.name);
    assert.equal(output.platformsLabel, country.platforms.join(' · '));
  }
});

test('44 new slots remain uncreated plans without invented handles, URLs, logins or publication evidence', () => {
  const slots = production.countries.flatMap(country => country.channelSlots.map(slot => ({country, slot})));
  const newSlots = slots.filter(({slot}) => slot.accountId === null);
  assert.equal(newSlots.length, 44);
  assert.equal(planned.length, 44);
  assert.equal(production.planCounts.newChannelSlotsPlanned, 44);
  assert.equal(production.planCounts.newCountryCandidates, 22);
  assert.equal(new Set(planned.map(row => row.countryCode)).size, 22);
  for (const {country, slot} of newSlots) {
    assert.notEqual(country.code, 'MN');
    assert.equal(slot.status, 'planned-not-created-or-verified');
    assert.equal(slot.handle, null);
    assert.equal(slot.url, null);
    const matches = planned.filter(row => row.countryCode === country.code && row.platform === slot.platform);
    assert.equal(matches.length, 1, `${country.code}/${slot.platform}`);
    const row = matches[0];
    assert.equal(row.brand, 'LAB');
    assert.equal(row.country, country.name);
    for (const key of ['handle', 'publicUrl', 'loginAlias', 'publicationEvidence', 'lastEvidenceAt']) assert.equal(row[key], null, `${row.id}.${key}`);
    assert.equal(row.channelScope, '신규 계획');
    for (const key of ['profileStatus', 'coverStatus', 'publishStatus']) assert.equal(row[key], '미착수', `${row.id}.${key}`);
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

test('70 channel rows mean 26 inventory entries plus 44 plans; LAB has 5 existing plus 44 planned', () => {
  assert.equal(channels.length, 70);
  assert.equal(channels.length, sourceChannels.length + planned.length);
  assert.equal(channels.filter(row => row.brand === 'LAB').length, 49);
  assert.equal(channels.filter(row => row.accountStatus === 'excluded-existing').length, 1);
  assert.equal(channels.filter(row => ['planned-unconfirmed', 'creation-deferred'].includes(row.accountStatus)).length, 2);
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
  assert.equal(rows('brands').reduce((sum, row) => sum + row.ownedCount, 0), 23);
  const expectedShared = {SYNK: 0, LAB: 1, SHIFT: 1, YUHO: 0, PULSE: 1, PATH: 0};
  for (const brand of rows('brands')) {
    assert.equal(brand.ownedCount, channels.filter(row => row.brand === brand.id && row.channelScope === '기존 운영').length, brand.id);
    assert.equal(brand.sharedCount, expectedShared[brand.id], brand.id);
  }
  assert.equal(rows('brands').find(row => row.id === 'PULSE').ownedCount, 0);
});

test('14 concepts preserve 12 faceless items and two other-session face videos without upgrading approval or publishing', () => {
  assert.deepEqual(sorted(production.contents.map(row => row.id)), sorted(contentIds));
  assert.deepEqual(rows('contents'), production.contents);
  const external = production.contents.filter(row => row.scopeOwner.includes('다른 세션'));
  assert.deepEqual(sorted(external.map(row => row.id)), ['L1', 'S1']);
  assert.equal(production.contents.length - external.length, 12);
  assert.equal(production.planCounts.facelessContentConcepts, 12);
  assert.equal(production.planCounts.faceVideoConceptsOtherSession, 2);
  for (const content of rows('contents')) {
    assert.equal(content.approvalStatus, 'unknown', content.id);
    assert.equal(content.currentExternalStatus, 'unknown', content.id);
    assert.match(content.publishStatus, /미게시/, content.id);
  }
});

test('six login identities retain unresolved security and proposal boundaries', () => {
  assert.deepEqual(sorted(plan.identities.map(row => row.id)), sorted(identityIds));
  assert.deepEqual(rows('identities'), plan.identities);
  for (const identity of plan.identities) assert.equal(identity.security, '미확인', identity.id);
  for (const id of ['founder', 'synk-yuh', 'unmet27']) assert.match(plan.identities.find(row => row.id === id).assignment, /제안.*미적용/, id);
  assert.match(plan.identities.find(row => row.id === 'founder').loginType, /독립 Google 로그인.*사용자 확인/);
  const synkYuh = plan.identities.find(row => row.id === 'synk-yuh');
  assert.equal(synkYuh.label, 'synk.yuh');
  assert.match(synkYuh.loginType, /전체 주소 미확인/);
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
  const expected = {existing: [23, '채널'], 'lab-mn': [5, '채널'], 'lab-world': [23, '개국'], 'lab-new': [44, '자리']};
  assert.deepEqual(sorted(rows('summary').map(row => row.id)), sorted(Object.keys(expected)));
  for (const row of rows('summary')) assert.deepEqual([row.value, row.unit], expected[row.id], row.id);
  const websites = inventory.accounts.filter(row => row.accountStatus === 'web-destination');
  assert.equal(websites.length, 6);
  assert.equal(rows('destinations').length, 7);
  for (const row of rows('destinations')) assert.ok(!channels.some(channel => channel.id === row.id), row.id);
  for (const row of websites) assert.equal(rows('destinations').find(output => output.id === row.id).publicUrl, row.publicUrl, row.id);
});

test('all declared sourcePaths and dashboard source files exist within the repository', () => {
  const declared = new Set();
  function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourcePaths') {
        assert.ok(Array.isArray(child));
        child.forEach(file => declared.add(file));
      } else collect(child);
    }
  }
  [plan, inventory, production, dashboard].forEach(collect);
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

test('the snapshot does not claim that live account verification occurred', () => {
  assert.equal(inventory.metadata.liveLoginVerified, false);
  assert.equal(production.audit.externalStateRechecked, false);
  for (const query of Object.values(dashboard.queries)) assert.ok(query.source.filters.some(filter => filter.includes('실시간 SNS 조회 아님')));
});
