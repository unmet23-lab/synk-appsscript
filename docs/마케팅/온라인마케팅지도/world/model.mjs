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
  PULSE: { name: 'PULSE', what: 'AI 광고 · 영상 제작 · 콘텐츠 IP', color: 'pulse' },
  SHIFT: { name: 'SHIFT', what: 'AI 교육 · 업무 자동화', color: 'shift' },
  PATH: { name: 'PATH', what: '한국 유학 · 취업 · 정착', color: 'path' }
};

function accountOf(row, fallbackState) {
  const secured = SECURED.has(row.accountStatus);
  return {
    id: row.id,
    business: row.business || row.brand,
    secondaryBusinesses: row.secondaryBusinesses || [],
    contentTrack: row.contentTrack || row.brand,
    purpose: row.purpose || row.channelRole || null,
    accountStatus: row.accountStatus,
    country: row.country || null,
    operations: row.operations ? {
      login:{state:row.operations.login?.state,observedAt:row.operations.login?.observedAt,observedDateOnly:row.operations.login?.observedDateOnly===true},
      publication:Object.fromEntries(['publishedCount','scheduledCount','pendingConfirmationCount','lastPublishedAt','nextScheduledAt','checkedAt'].map(k=>[k,row.operations.publication?.[k]??null])),
      collection:row.operations.collection ? {state:row.operations.collection.state,checkedAt:row.operations.collection.checkedAt,method:row.operations.collection.method,metrics:row.operations.collection.metrics} : null
    } : null,
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
  const channels = (data.queries?.channels?.rows || []).filter(row => (row.business || row.brand) === 'LAB');
  const countries = countryRows.map(row => {
    const accounts = channels.filter(ch => ch.countryCode === row.code || ch.country === row.country).map(ch => accountOf(ch)).sort(byPlatform);
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
  const assigned = new Set(countries.flatMap(c => c.accounts.map(a => a.id)));
  return finish('LAB', countries.sort(byRegion), channels.filter(ch => !assigned.has(ch.id)).map(ch => accountOf(ch)));
}

export function buildPulse(data, targets, nameOf = () => null) {
  const all = data.queries?.channels?.rows || [];
  const channels = all.filter(row => (row.business || row.brand) === 'PULSE');
  const labRows = (data.queries?.countries?.rows || []).filter(row => row.brand === 'LAB');
  const labChannels = (data.queries?.channels?.rows || []).filter(row => row.brand === 'LAB');
  const shared = channels.filter(ch => !ch.country || /공통|미분리|글로벌/.test(ch.country)).map(ch => accountOf(ch)).sort(byPlatform);
  const countries = (targets?.countries || []).map(entry => {
    const name = labRows.find(row => row.code === entry.code)?.country || nameOf(entry.code) || null;
    const refs = entry.accountRefs || [];
    const accounts = [...new Map([...channels.filter(ch => ch.country && ch.country === name), ...refs.map(id => all.find(ch => ch.id === id)).filter(Boolean)].map(ch => [ch.id, ch])).values()]
      .map(ch => ({ ...accountOf(ch), shared: refs.includes(ch.id) && ch.country !== name })).sort(byPlatform);
    const planned = (entry.plannedAccounts || []).map(a => ({ ...a, business: 'PULSE', contentTrack: 'PULSE', accountStatus: 'planned', handle: null, url: null, secured: false, state: '계정 계획' }));
    const labHere = name ? labChannels.filter(ch => ch.country === name && SECURED.has(ch.accountStatus)).length : 0;
    const secured = accounts.filter(a => a.secured).length;
    return {
      code: entry.code,
      name,
      status: entry.status === 'active' ? 'active' : 'target',
      role: entry.role || null,
      verdict: entry.verdict || null,
      language: entry.language || null,
      secured,
      planned: accounts.length + planned.length,
      accounts: [...accounts, ...planned],
      sharedHere: accounts.some(a => a.shared),
      why: entry.why || null,
      labHere
    };
  });
  return finish('PULSE', countries, shared, targets?.shared || null);
}

function finish(brand, countries, shared, sharedNote = null) {
  const active = countries.filter(c => c.status === 'active');
  const target = countries.filter(c => c.status === 'target');
  const unique = [...new Map([...countries.flatMap(c => c.accounts), ...shared].map(a => [a.id, a])).values()];
  return {
    brand,
    ...BRAND_LABEL[brand],
    countries,
    shared,
    sharedNote,
    summary: {
      active: active.length,
      target: target.length,
      secured: unique.filter(a => a.secured).length,
      planned: unique.length,
      primary: unique.filter(a => a.secured && a.business === brand).length,
      shared: unique.filter(a => a.secured && a.business !== brand).length
    }
  };
}

// 나라 이름을 지도 자료에서 채운다(원장에 없는 나라 — 예: PULSE 타깃의 캐나다가 LAB에 없을 때).
export function nameCountries(world, geo) {
  const byCode = new Map((geo?.countries || []).filter(c => c.a2).map(c => [c.a2, c]));
  for (const view of [world.lab, world.pulse, world.shift, world.path].filter(Boolean)) {
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
    pulse: buildPulse(data, targets, code => names.get(code) || null),
    shift: buildBusiness(data, 'SHIFT', names),
    path: buildBusiness(data, 'PATH', names),
    all: buildAll(data)
  };
  return nameCountries(world, geo);
}

function buildBusiness(data, business, names) {
  const rows = (data.queries?.channels?.rows || []).filter(row => (row.business || row.brand) === business);
  const countries = [...new Set(rows.map(row => row.countryCode || (row.country === '한국' ? 'KR' : null)).filter(Boolean))].map(code => {
    const accounts = rows.filter(row => row.countryCode === code || code === 'KR' && row.country === '한국').map(row => accountOf(row));
    return { code, name: names.get(code) || code, accounts, status: accounts.some(a => a.secured) ? 'active' : 'target', secured: accounts.filter(a => a.secured).length, planned: accounts.length };
  });
  const assigned = new Set(countries.flatMap(c => c.accounts.map(a => a.id)));
  const shared = rows.filter(row => !assigned.has(row.id)).map(row => accountOf(row));
  if (business === 'PATH') shared.push(...(data.queries?.channels?.rows || []).filter(row => row.secondaryBusinesses?.includes('PATH') && SECURED.has(row.accountStatus)).map(row => ({ ...accountOf(row), shared: true })));
  return finish(business, countries.sort(byRegion), shared, business === 'PATH' ? '독립 SNS 계정은 만들지 않는 기존 방침. LAB·회사 공통 계정의 유학·취업·정착 연계 계획이며 별도 개설·게시 실적이 아닙니다.' : '국가를 특정하지 않은 계정은 공통 계정으로 표시합니다.');
}

function buildAll(data) {
  const rows = data.queries?.channels?.rows || [];
  const plans = data.queries?.plans?.rows || [];
  return { accounts: rows.map(row => accountOf(row, row.accountStatus === 'planned' ? '미확보' : '운영 제외·보류')), plans,
    summary: { managed: rows.filter(row => SECURED.has(row.accountStatus)).length, planned: rows.filter(row => row.accountStatus === 'planned').length,
      excluded: rows.filter(row => !SECURED.has(row.accountStatus) && row.accountStatus !== 'planned').length, longTermPlans: plans.length } };
}

// 머리 문장 — 숫자는 모두 위 결과에서 온다.
// 머리 문장 — 지도 색(active)은 그 나라에 계정을 확보했다는 뜻이지, 매일 게시하고 있다는 증거가 아니다(11-13). 게시 여부는 계정의 게시 기록에서 본다.
export function headline(view) {
  const { active, target } = view.summary;
  const josa = view.brand === 'LAB' ? '은' : '는';
  if (view.brand === 'LAB') {
    return {
      first: `LAB${josa} ${active}개국에`,
      second: target ? `한국어 학습 계정이 있고, ${target}개국을 준비해요.` : '한국어 학습 계정을 확보했어요.'
    };
  }
  if (view.brand === 'PATH') return { first: 'PATH는 LAB·공통 계정과 연계해요.', second: '독립 SNS 계정은 아직 없어요.' };
  if (view.brand === 'SHIFT') return { first: 'SHIFT는 AI 교육과 업무 자동화를 다뤄요.', second: `확보 계정 ${view.summary.secured}개 · 국가 공통 계정 포함` };
  const home = view.countries.filter(c => c.status === 'active').map(c => c.name);
  return {
    first: active === 1 ? `PULSE${josa} ${home[0]}에 계정이 있고` : `PULSE${josa} ${active}개국에 계정이 있고`,
    second: target ? `${target}개국을 타깃 시장으로 준비하고 있어요.` : '준비 중인 타깃 시장은 아직 없어요.'
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
