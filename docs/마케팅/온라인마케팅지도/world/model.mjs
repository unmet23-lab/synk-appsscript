// 세계 지도 화면의 자료 모양 — 브라우저(world.js)와 시험(world.test.mjs)이 같이 쓴다.
// 원천: dashboard/src/data.json(build-map.mjs가 원장에서 만든 것) + inputs/pulse-targets.json + world/geo.json.
// 화면은 이 결과만 그린다 — 원장 상태를 여기서 새로 판단하지 않는다(확보 · 미확보는 원장의 accountStatus 그대로).

export const SECURED = new Set(['operating', 'confirmed-expansion', 'operating-contact']);

// 목록을 지도처럼 읽게 지역으로 묶는다(지도의 서쪽 → 동쪽 순서). 표에 없는 나라는 「그 밖」.
export const REGIONS = [
  ['중앙아시아 · 러시아', ['RU', 'KZ', 'UZ', 'KG']],
  ['남아시아', ['IN', 'NP', 'LK']],
  ['동남아시아', ['MM', 'TH', 'KH', 'VN', 'MY', 'SG', 'ID', 'PH']],
  ['동아시아', ['MN', 'CN', 'HK', 'TW', 'KR', 'JP']],
  ['오세아니아', ['AU', 'NZ']],
  ['아메리카', ['CA', 'US', 'MX', 'BR', 'PY']]
];
export function regionOf(code) {
  const at = REGIONS.findIndex(([, codes]) => codes.includes(code));
  return at < 0 ? { name: '그 밖', order: REGIONS.length, rank: 0 } : { name: REGIONS[at][0], order: at, rank: REGIONS[at][1].indexOf(code) };
}
export function byRegion(a, b) {
  const ra = regionOf(a.code), rb = regionOf(b.code);
  return (ra.order - rb.order) || (ra.rank - rb.rank) || String(a.name).localeCompare(String(b.name), 'ko');
}

const BRAND_LABEL = {
  LAB: { name: 'LAB', what: '한국어 학습', color: 'lab' },
  PULSE: { name: 'PULSE', what: 'AI 광고 · 영상 제작', color: 'pulse' }
};

function accountOf(row, fallbackState) {
  const secured = SECURED.has(row.accountStatus);
  return {
    id: row.id,
    platform: row.platform,
    handle: secured ? (row.handle || null) : null,
    url: secured ? (row.publicUrl || null) : null,
    secured,
    state: secured ? '확보' : (fallbackState || '미확보'),
    note: secured ? null : (row.setupStatus || null)
  };
}

function byPlatform(a, b) {
  return (b.secured - a.secured) || String(a.platform).localeCompare(String(b.platform));
}

// 원장의 나라 이름(「베트남」)과 지도 나라 코드(VN)를 잇는다 — countries 행이 code와 이름을 함께 갖고 있다.
export function buildLab(data) {
  const countryRows = (data.queries?.countries?.rows || []).filter(row => row.brand === 'LAB' && row.code);
  const channels = (data.queries?.channels?.rows || []).filter(row => row.brand === 'LAB');
  const countries = countryRows.map(row => {
    const accounts = channels.filter(ch => ch.country === row.country).map(ch => accountOf(ch)).sort(byPlatform);
    const secured = accounts.filter(a => a.secured).length;
    return {
      code: row.code,
      name: row.country,
      status: secured > 0 ? 'active' : 'target',
      secured,
      planned: accounts.length,
      accounts,
      lines: [
        row.contentStatus ? { label: '게시 시간', text: row.contentStatus } : null,
        row.uploadPlan ? { label: '게시 준비', text: row.uploadPlan } : null,
        row.appStatus ? { label: '앱', text: row.appStatus } : null
      ].filter(Boolean),
      next: row.nextAction || null
    };
  });
  return finish('LAB', countries.sort(byRegion), []);
}

export function buildPulse(data, targets, nameOf = () => null) {
  const channels = (data.queries?.channels?.rows || []).filter(row => row.brand === 'PULSE');
  const labRows = (data.queries?.countries?.rows || []).filter(row => row.brand === 'LAB');
  const labChannels = (data.queries?.channels?.rows || []).filter(row => row.brand === 'LAB');
  const shared = channels.filter(ch => !ch.country || /공통|미분리|글로벌/.test(ch.country)).map(ch => accountOf(ch)).sort(byPlatform);
  const countries = (targets?.countries || []).map(entry => {
    const name = labRows.find(row => row.code === entry.code)?.country || nameOf(entry.code) || null;
    const accounts = channels.filter(ch => ch.country && ch.country === name).map(ch => accountOf(ch)).sort(byPlatform);
    const planned = (entry.plan || []).filter(platform => !accounts.some(a => a.platform === platform) && !(entry.status === 'active' && shared.some(a => a.platform === platform)))
      .map(platform => ({ id: entry.code + '-' + platform, platform, handle: null, url: null, secured: false, state: '계정 계획', note: null }));
    const labHere = name ? labChannels.filter(ch => ch.country === name && SECURED.has(ch.accountStatus)).length : 0;
    const secured = accounts.filter(a => a.secured).length + (entry.status === 'active' ? shared.filter(a => a.secured).length : 0);
    return {
      code: entry.code,
      name,
      status: entry.status === 'active' ? 'active' : 'target',
      role: entry.role || null,
      language: entry.language || null,
      secured,
      planned: accounts.length + planned.length + (entry.status === 'active' ? shared.length : 0),
      accounts: [...accounts, ...planned],
      sharedHere: entry.status === 'active',
      why: entry.why || null,
      labHere
    };
  });
  return finish('PULSE', countries, shared, targets?.shared || null);
}

function finish(brand, countries, shared, sharedNote = null) {
  const active = countries.filter(c => c.status === 'active');
  const target = countries.filter(c => c.status === 'target');
  return {
    brand,
    ...BRAND_LABEL[brand],
    countries,
    shared,
    sharedNote,
    summary: {
      active: active.length,
      target: target.length,
      secured: countries.reduce((n, c) => n + c.secured, 0),
      planned: countries.reduce((n, c) => n + c.planned, 0)
    }
  };
}

// 나라 이름을 지도 자료에서 채운다(원장에 없는 나라 — 예: PULSE 타깃의 캐나다가 LAB에 없을 때).
export function nameCountries(world, geo) {
  const byCode = new Map((geo?.countries || []).filter(c => c.a2).map(c => [c.a2, c]));
  for (const view of [world.lab, world.pulse]) {
    for (const c of view.countries) {
      const shape = byCode.get(c.code);
      if (!c.name) c.name = shape?.ko || c.code;
      c.onMap = Boolean(shape);
      c.small = Boolean(shape?.small);
      c.center = shape?.c || null;
      c.area = shape?.a ?? null;
    }
  }
  return world;
}

export function buildWorld({ data, targets, geo }) {
  const names = new Map((geo?.countries || []).filter(c => c.a2).map(c => [c.a2, c.ko]));
  const world = {
    generatedAt: data.generatedAt || null,
    targetsUpdatedAt: targets?.updatedAt || null,
    lab: buildLab(data),
    pulse: buildPulse(data, targets, code => names.get(code) || null)
  };
  return nameCountries(world, geo);
}

// 머리 문장 — 숫자는 모두 위 결과에서 온다.
export function headline(view) {
  const { active, target } = view.summary;
  const josa = view.brand === 'LAB' ? '은' : '는';
  if (view.brand === 'LAB') {
    return {
      first: `LAB${josa} ${active}개국에서`,
      second: target ? `운영하고, ${target}개국을 준비해요.` : '한국어 학습 계정을 운영해요.'
    };
  }
  const home = view.countries.filter(c => c.status === 'active').map(c => c.name);
  return {
    first: active === 1 ? `PULSE${josa} ${home[0]}에서 운영하고` : `PULSE${josa} ${active}개국에서 운영하고`,
    second: target ? `${target}개국을 준비하고 있어요.` : '준비 중인 나라는 아직 없어요.'
  };
}

export function formatKst(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('month')}월 ${get('day')}일 ${get('hour')}:${get('minute')}`;
}
