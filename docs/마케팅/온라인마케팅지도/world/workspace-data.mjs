// 작업실(workspace.synk.im) SNS · 나라 지도 자료 — 로컬 지도와 같은 원천(model.mjs)으로 화면이 바로 그릴 모양을 한 파일로 굳힌다.
//
//   node docs/마케팅/온라인마케팅지도/world/workspace-data.mjs
//
// 쓰는 곳: engagement/company/public/marketing-map.json(작업실 화면 public/marketing-map.js가 읽는다).
// build-map.mjs --complete가 원장 지도 자료를 다시 만들 때 끝에서 이 파일도 다시 쓴다. PULSE 타깃(inputs/pulse-targets.json)만
// 바꿨으면 이 명령만 돌린다. 운영에 실으려면 화면 묶음 바꿔 끼우기(deploy/static/swap.mjs) — 처음 한 번만 이미지 판.
// 로그인 정보(loginAlias · 로그인 경로 · 이메일)는 원장에서 읽지도 않는다 — 계정은 플랫폼 · 공개 핸들 · 공개 주소 · 확보 여부뿐.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildWorld, headline, regionOf } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
export const WORKSPACE_MAP_FILE = join(root, 'engagement', 'company', 'public', 'marketing-map.json');

// 미확보 계정은 주소 · 핸들을 내지 않는다(원장 모양이 바뀌어도 공개 파일에 예정 주소가 새지 않게).
const account = a => { const secured = Boolean(a.secured); return { id:a.id, business:a.business, secondaryBusinesses:a.secondaryBusinesses || [], contentTrack:a.contentTrack, purpose:a.purpose || null, accountStatus:a.accountStatus, country:a.country || null, shared:a.shared===true, platform: a.platform, handle: secured ? a.handle || null : null, url: secured ? a.url || null : null, secured, state: a.state, note: a.note || null }; };

function country(c, brand) {
  return {
    code: c.code,
    name: c.name,
    status: c.status,
    region: regionOf(c.code).name,
    secured: c.secured,
    planned: c.planned,
    accounts: c.accounts.map(account),
    lines: (c.lines || []).map(l => ({ label: l.label, text: l.text })),
    role: c.role || null,
    verdict: c.verdict || null,
    language: c.language || null,
    why: c.why || null,
    labHere: brand === 'PULSE' ? c.labHere || 0 : 0,
    center: c.center,
    small: c.small,
    area: c.area
  };
}

function view(v) {
  return {
    brand: v.brand,
    name: v.name,
    what: v.what,
    headline: headline(v),
    summary: v.summary,
    countries: v.countries.filter(c => c.onMap).map(c => country(c, v.brand)),
    shared: v.shared.map(account),
    sharedNote: v.sharedNote || null
  };
}

export function buildWorkspaceMap({ data, targets, geo }) {
  const world = buildWorld({ data, targets, geo });
  return {
    schema: 'synk-marketing-map/v1',
    generatedAt: world.generatedAt,
    targetsUpdatedAt: world.targetsUpdatedAt,
    geo: { w: geo.w, h: geo.h, source: geo.source, countries: geo.countries.map(c => ({ a2: c.a2, d: c.d })) },
    views: { lab: view(world.lab), pulse: view(world.pulse), shift:view(world.shift), path:view(world.path) },
    all: {accounts:world.all.accounts.map(account), plans:world.all.plans.map(p=>({id:p.id,business:p.business,contentTrack:p.contentTrack,platform:p.platform,state:p.state,note:p.note})),summary:world.all.summary}
  };
}

export function readSources() {
  const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  return {
    data: read(join(root, 'dashboard', 'src', 'data.json')),
    targets: read(join(root, 'inputs', 'pulse-targets.json')),
    geo: read(join(here, 'geo.json'))
  };
}

export function writeWorkspaceMap(target = WORKSPACE_MAP_FILE) {
  const doc = buildWorkspaceMap(readSources());
  writeFileSync(target, JSON.stringify(doc) + '\n');
  return { file: target, bytes: Buffer.byteLength(JSON.stringify(doc)), lab: doc.views.lab.summary, pulse: doc.views.pulse.summary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(writeWorkspaceMap()));
}
