// Collects the core-town captures, the fps run and the set builds into page-data.json for build-page.cjs.
//   node assemble.cjs --captures=<dir with v20/ town-claude/ town-argon/> --perf=<perf.json> --extra=<extra.json> --out=<page-data.json>
// Numbers come from the files; the words (how each version was made, the
// comparison table, what is still unverified) come from extra.json, and so does
// the list of versions (extra.variants: [{ id, dir, label }], v20 first).
const fs = require('node:fs'), path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const read = f => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
const extra = read(args.extra);
const VARIANTS = extra.variants || [{ id: 'v20', dir: 'v20', label: 'v20 (지금 공개판)' }, { id: 'claude', dir: 'town-claude', label: 'Claude 블렌더 판' }, { id: 'argon', dir: 'town-argon', label: '아르곤 블렌더 판' }];
const IDS = VARIANTS.map(v => [v.id, v.dir]);
const caps = Object.fromEntries(IDS.map(([id, dir]) => [id, read(path.join(args.captures, dir, 'report.json'))]));
// A version may name its set build record (extra.variants[].set, e.g. townwide-merged).
const sets = Object.fromEntries(VARIANTS.slice(1).map(v => [v.id, read(path.join(__dirname, 'results', `build-set-${v.set || v.id}.json`))]));
const perf = args.perf ? read(args.perf) : null;
const n = x => Number(x).toLocaleString('ko-KR');
// MB = 10^6 bytes, the unit the spec (자산규격.md 7절) sets its budgets in.
const mb = b => (b / 1e6).toFixed(2) + ' MB';
const VPS = [['1280x900', 'PC'], ['390x844', '390폭']];
const VIEWS = [['core', '가운데 위'], ['follow', '따라가기'], ['wide', '동네 전체'], ['cafe-close', '찻집 가까이'], ['home-close', '집 가까이'], ['workshop-close', '공방 가까이'], ['greenhouse-close', '온실 가까이']];
const views = VPS.flatMap(([vp, vl]) => VIEWS.map(([v, l]) => ({ key: `${vp}-${v}`, label: `${vl} · ${l}` })));
const shotsFor = (id, dir) => Object.fromEntries(views.map(({ key }) => [key, path.join(args.captures, dir, `${dir}-${key}.png`)]));
const per = (fn, best) => ({ values: Object.fromEntries(IDS.map(([id]) => [id, fn(caps[id], id)])), ...(best ? { best } : {}) });
const vp = (c, key) => c.viewports[key];
const setBytes = (id, tier) => sets[id].log.filter(l => l.tier === tier).reduce((s, l) => s + l.glbBytes, 0);
// The first entry stops when the core is in place; deferred parts (the outer ring) come after.
const first = (c, key) => vp(c, key).entry.bytes - (vp(c, key).district?.deferred?.bytes || 0);
const later = (c, key) => vp(c, key).district?.deferred?.bytes || 0;
const metrics = [
  { label: '첫 진입 내려받기 · PC', note: '문서와 모든 파일 합계(캐시 없음). 구운 판은 묶음 GLB·KTX2/meshopt 디코더 포함. 첫 화면 뒤에 받는 부품은 뺌', ...per(c => mb(first(c, '1280x900')), 'v20') },
  { label: '첫 진입 내려받기 · 390폭', note: '휴대폰 폭은 1024 지도 묶음을 받는다', ...per(c => mb(first(c, '390x844')), 'v20') },
  { label: '구운 묶음 · PC / 휴대폰', note: 'GLB 합계 — 가운데 5개(바닥·집·찻집·공방·온실), 동네 전체 판은 바깥 고리 2개 더', values: Object.fromEntries(IDS.map(([id]) => [id, id === 'v20' ? '없음 (코드로 생성)' : `${mb(setBytes(id, 'pc'))} / ${mb(setBytes(id, 'phone'))}`])) },
  { label: '첫 진입 추가 · PC / 390폭', note: '구운 판 − v20. 규격 한도 PC 12 MB · 휴대폰 6 MB', ...per((c, id) => id === 'v20' ? '—' : `+${mb(first(c, '1280x900') - first(caps.v20, '1280x900'))} / +${mb(first(c, '390x844') - first(caps.v20, '390x844'))}`) },
  { label: '첫 화면 뒤에 받기 · PC / 390폭', note: '바깥 고리(동네 전체 판): 가운데가 뜬 뒤 받고, 그동안 v20이 보인다', ...per(c => later(c, '1280x900') ? `${mb(later(c, '1280x900'))} / ${mb(later(c, '390x844'))}` : '—') },
  { label: '늘어난 GPU 텍스처 · PC', note: '구운 지도(밉맵 포함, 이 PC에서 BC7로 풀린 크기). v20 자체 텍스처는 모든 판에 그대로', ...per((c, id) => id === 'v20' ? '0' : mb(vp(c, '1280x900').district.textureBytes), 'v20') },
  { label: '늘어난 GPU 텍스처 · 390폭', note: '규격 상한 PC 96 MB · 휴대폰 32 MB', ...per((c, id) => id === 'v20' ? '0' : mb(vp(c, '390x844').district.textureBytes), 'v20') },
  { label: '구운 묶음 삼각형 · 메시', note: '바꿔 끼운 다섯 부품', ...per((c, id) => id === 'v20' ? '—' : `${n(vp(c, '1280x900').district.triangles)} · ${vp(c, '1280x900').district.meshes}`) },
  ...['core', 'follow', 'cafe-close', 'home-close'].flatMap(view => VPS.map(([key, vl]) => ({
    label: `그리기 호출 · 삼각형 — ${vl} ${VIEWS.find(v => v[0] === view)[1]}`, note: view === 'core' && key === '1280x900' ? '화면 전체, 그림자·AO 패스 포함(renderer.info)' : '',
    ...per(c => `${n(vp(c, key).views[view].drawCalls)} · ${n(vp(c, key).views[view].triangles)}`) }))),
  { label: '첫 화면까지 · PC', note: '주소를 연 뒤 걷기가 켜질 때까지. ' + (extra.metrics?.[0]?.note || '한 번 잰 값'), ...per(c => (vp(c, '1280x900').readyMs / 1000).toFixed(1) + '초') },
];
const fps = [];
if (perf) for (const [key, vl] of VPS) for (const [view, label] of VIEWS) {
  const row = { label: `${vl} · ${label}`, values: {} };
  for (const [id, name] of IDS) {
    const s = perf.summary.find(x => x.variant === name && x.viewport === key && x.view === view); if (!s) continue;
    row.values[id] = s.fps.length > 1 ? `${s.fpsMedian.toFixed(1)} (${Math.min(...s.fps).toFixed(0)}–${Math.max(...s.fps).toFixed(0)})` : s.fpsMedian.toFixed(1);
  }
  if (Object.keys(row.values).length) fps.push(row);
}
const rounds = perf ? Math.min(...perf.summary.map(x => x.fps.length)) : 0;
const adapter = perf ? [...new Set(perf.summary.map(s => s.adapter).filter(Boolean))].join(', ') : '';
const data = {
  eyebrow: extra.eyebrow || 'SYNK TOWN · 가운데 동네 굽기 비교', date: extra.date || '2026-10-18', title: extra.title, lead: extra.lead,
  views,
  variants: VARIANTS.map(v => ({ id: v.id, label: v.label, shots: shotsFor(v.id, v.dir), how: extra.how[v.id] })),
  metrics, fps,
  fpsNote: perf ? `정지 시점마다 ${perf.seconds}초씩 완성 프레임 수를 센 중앙값이고, 괄호는 회전 사이 최저–최고입니다. 기기 배율 ${perf.dpr}로 열고(Town 「가볍게」 규칙대로 PC 1.5배·휴대폰 1.25배로 그림) ${IDS.length}판을 순서를 돌려 가며 ${rounds === perf.rounds ? perf.rounds : rounds + '~' + perf.rounds}회전 쟀습니다. 헤드리스 Edge(${adapter}) 값이고 실물 휴대폰 값이 아닙니다.${extra.fpsNote ? ' ' + extra.fpsNote : ''}` : '',
  compression: extra.compression, compare: extra.compare, figures: extra.figures,
  unverified: extra.unverified, decide: extra.decide,
};
fs.writeFileSync(path.resolve(args.out), JSON.stringify(data, null, 2) + '\n');
console.log('ok', path.resolve(args.out), 'fps rows', fps.length);
