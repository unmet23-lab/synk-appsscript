// SNS · 나라 지도(작업실 판) 시험 — 자료 파일이 원장과 맞는지, 로그인 정보가 없는지, 화면 조각이 원장 숫자대로 그려지는지, 서버가 세 파일을 내는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import vm from 'node:vm';
import { createCompanyApp } from './server.mjs';
import { buildWorkspaceMap, readSources, WORKSPACE_MAP_FILE } from '../../world/workspace-data.mjs';

const publicDir = new URL('./public/', import.meta.url);
const shipped = JSON.parse(readFileSync(WORKSPACE_MAP_FILE, 'utf8'));
const sources = readSources();

function screen() {
  const source = readFileSync(new URL('marketing-map.js', publicDir), 'utf8');
  const cut = source.indexOf('// ── 상태와 불러오기 ──');
  assert.ok(cut > 0, '그리기 도우미 끝 표시줄');
  const context = { ssUnit: (n, u) => `${n}<small>${u}</small>`, ssMeter: cells => `<div class="ss-meter">${cells.map(([l, v]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join('')}</div>` };
  vm.createContext(context);
  vm.runInContext(source.slice(0, cut) + '\n;globalThis.mmPage=mmPage;globalThis.mmEsc=mmEsc;', context);
  return context;
}

test('작업실 지도 자료는 원장 · PULSE 타깃 · 나라 경계에서 다시 만든 것과 같다(원장을 고치면 workspace-data.mjs를 돌린다)', () => {
  assert.deepEqual(shipped, buildWorkspaceMap(sources));
  assert.equal(shipped.schema, 'synk-marketing-map/v1');
  const lab = sources.data.queries.countries.rows.filter(r => r.brand === 'LAB').length;
  assert.equal(shipped.views.lab.countries.length, lab);
  assert.deepEqual(shipped.views.pulse.countries.map(c => c.code), sources.targets.countries.map(c => c.code));
});

test('작업실 지도 자료에는 로그인 정보 · 이메일이 없다(공개 정적 파일)', () => {
  const text = JSON.stringify(shipped);
  assert.doesNotMatch(text, /loginAlias|loginIdentity|loginMethod|unmet\d+|synk\.yuh|비밀번호|password/i);
  // 이메일 꼴은 도메인과 상관없이 없어야 한다(핸들 「@synkpulse」 · 주소 「…com/@synklab.vn」은 @ 앞에 이름 칸이 없어 걸리지 않는다).
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, '이메일 주소');
  // 나라별 계정과 나라를 나누지 않은 공통 계정 모두 같은 여섯 칸만, 미확보면 주소 · 핸들 없음.
  for (const view of Object.values(shipped.views)) for (const a of [...view.shared, ...view.countries.flatMap(c => c.accounts)]) {
    assert.deepEqual(Object.keys(a).sort(), ['handle', 'note', 'platform', 'secured', 'state', 'url']);
    if (!a.secured) { assert.equal(a.url, null, '미확보 계정에 주소를 지어내지 않는다'); assert.equal(a.handle, null); }
  }
});

test('지도 장은 원장 숫자대로 칠하고, 고른 나라는 맨 위 · 작은 나라는 고리, PULSE만 이름표', () => {
  const { mmPage } = screen();
  const lab = mmPage(shipped, 'lab', null);
  assert.equal((lab.match(/class="mm-c hot is-active/g) || []).length, shipped.views.lab.summary.active);
  assert.equal((lab.match(/class="mm-lbl/g) || []).length, 0, 'LAB은 25곳이라 이름표 없음');
  assert.match(lab, new RegExp(`${shipped.views.lab.summary.secured}<small>/ ${shipped.views.lab.summary.planned}</small>`));
  const pulse = mmPage(shipped, 'pulse', 'SG');
  assert.equal((pulse.match(/class="mm-lbl/g) || []).length, shipped.views.pulse.countries.length);
  assert.match(pulse, /<h2 class="mm-name">싱가포르<\/h2>/);
  assert.match(pulse, /class="mm-locator"/);
  assert.match(pulse, /class="mm-c hot is-target is-selected" d="[^"]+" data-code="SG"/);
  assert.match(pulse, /검토 · 추가/);
  assert.doesNotMatch(lab + pulse, /\sstyle=/, '마크업 style 속성 없음(CSP)');
  assert.doesNotMatch(pulse, /mm-map has-sel/, 'PULSE는 고른 뒤에도 다른 나라를 옅게 하지 않는다');
  assert.match(mmPage(shipped, 'lab', 'TW'), /class="mm-map has-sel"/, 'LAB은 고르면 나머지를 옅게 한다');
});

test('서버는 지도 스크립트 · 스타일 · 자료를 내고, 첫 화면이 둘을 싣는다', async t => {
  const root = await mkdtemp(join(tmpdir(), 'synk-marketing-map-'));
  const drive = { active: async () => null, status: async () => ({ provider: 'local', connections: [] }) };
  const app = createCompanyApp({ dataDir: root, port: 0, allowTestHost: true, schedule: false, messengerDriveStorage: drive, synkIdentityConfig: null });
  t.after(async () => { await app.stop(); if (resolve(root).startsWith(resolve(tmpdir()) + sep)) await rm(root, { recursive: true, force: true }); });
  const address = await app.start();
  const base = 'http://127.0.0.1:' + address.port;
  for (const [path, type] of [['/marketing-map.js', /javascript/], ['/marketing-map.css', /css/], ['/marketing-map.json', /json/]]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), type, path);
    const body = await response.text();
    if (path.endsWith('.json')) assert.equal(JSON.parse(body).schema, 'synk-marketing-map/v1');
  }
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /\/marketing-map\.js\?v=/);
  assert.match(html, /\/marketing-map\.css\?v=/);
});
