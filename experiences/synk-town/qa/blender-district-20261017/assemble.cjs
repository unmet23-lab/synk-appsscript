// Collects captures, perf runs and build reports into page-data.json for build-page.cjs.
// node assemble.cjs --captures=<dir> --perf=<default.json>[,<high.json>] --claude=<export.json> --argon=<report.json> --out=<page-data.json>
const fs = require('node:fs'), path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const read = f => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
const cap = id => read(path.join(args.captures, 'final-' + id, 'report.json'));
const caps = { v20: cap('v20'), claude: cap('claude'), argon: cap('argon') };
const perfs = (args.perf || '').split(',').filter(Boolean).map(read);
const claude = read(args.claude), argon = read(args.argon), extra = args.extra ? read(args.extra) : {};
const n = x => Number(x).toLocaleString('ko-KR');
const mb = b => (b / 1048576).toFixed(2) + ' MB';
const VIEWS = [['1280x900-follow', 'PC · 따라가기'], ['1280x900-close', 'PC · 가까이'], ['1280x900-wide', 'PC · 동네 전체'], ['390x844-follow', '390폭 · 따라가기'], ['390x844-close', '390폭 · 가까이'], ['390x844-wide', '390폭 · 동네 전체']];
const shotsFor = id => Object.fromEntries(VIEWS.map(([key]) => { const [vp, view] = key.split(/-(?=[a-z]+$)/); return [key, path.join(args.captures, 'final-' + id, `${id}-${vp}-${view}.png`)]; }));
const pc = c => c.viewports['1280x900'], phone = c => c.viewports['390x844'];
const district = { v20: { tris: 40057 + 1000, meshes: '49 (인스턴스 23개 · 177개체)', file: 0 },
  claude: { tris: claude.total_triangles, meshes: String(claude.meshes), file: fs.statSync(path.resolve(args.claudeGlb)).size },
  argon: { tris: argon.totals.triangles, meshes: String(argon.totals.meshes), file: argon.totals.glb_size_bytes } };
const texMB = count => (count * 2048 * 2048 * 4 * 4 / 3 / 1048576).toFixed(0);
const metrics = [
  { label: '찻집 구역 삼각형', note: 'v20은 찻집 그룹 40,057 + 구역 바닥 약 1,000', values: { v20: '약 ' + n(district.v20.tris), claude: n(district.claude.tris), argon: n(district.argon.tris) } },
  { label: '찻집 구역 메시', note: '그리기 단위. 블렌더 판은 지도별로 합침', values: { v20: district.v20.meshes, claude: district.claude.meshes, argon: district.argon.meshes }, best: 'claude' },
  { label: '화면 전체 그리기 호출', note: 'PC 따라가기 시점, 그림자·AO 패스 포함', values: Object.fromEntries(Object.entries(caps).map(([k, c]) => [k, n(pc(c).views.follow.drawCalls)])) },
  { label: '화면 전체 삼각형', note: 'PC 따라가기 시점, 그림자·AO 패스 포함', values: Object.fromEntries(Object.entries(caps).map(([k, c]) => [k, n(pc(c).views.follow.triangles)])) },
  { label: '첫 진입 내려받기', note: 'PC, 문서와 모든 파일 합계(캐시 없음)', values: Object.fromEntries(Object.entries(caps).map(([k, c]) => [k, mb(pc(c).entry.bytes)])), best: 'v20' },
  { label: '구역 파일', note: 'GLB 한 개 + 처음 쓸 때만 받는 로더 약 160 KB', values: { v20: '없음 (코드로 생성)', claude: mb(district.claude.file), argon: mb(district.argon.file) } },
  { label: '구운 지도', note: 'GPU 메모리는 밉맵 포함 추정치', values: { v20: '없음', claude: `2048² × 4장 · 약 ${texMB(4)} MB`, argon: `2048² × 3장 · 약 ${texMB(3)} MB` } },
  { label: '첫 화면까지', note: 'PC, 주소를 연 뒤 걷기가 켜질 때까지(한 번 잰 값)', values: Object.fromEntries(Object.entries(caps).map(([k, c]) => [k, (pc(c).readyMs / 1000).toFixed(1) + '초'])) },
  ...(extra.metrics || []),
];
const fps = [], capped = [];
for (const [index, perf] of perfs.entries()) {
  const gpuLabel = (perf.gpu === 'high' ? '외장 GPU' : '내장 GPU') + (perf.dpr >= 2 ? ' · 고배율' : ' · 1배');
  for (const [key, label] of VIEWS) {
    const [vp, view] = key.split(/-(?=[a-z]+$)/), row = { label: `${label} · ${gpuLabel}`, values: {}, best: null };
    let low = 60;
    for (const [id, name] of [['v20', 'v20'], ['claude', 'cafe-claude'], ['argon', 'cafe-argon']]) {
      const s = perf.summary.find(x => x.variant === name && x.viewport === vp && x.view === view);
      if (!s) continue;
      low = Math.min(low, s.fpsMedian);
      row.values[id] = s.fps.length > 1 ? `${s.fpsMedian.toFixed(1)} (${Math.min(...s.fps).toFixed(0)}–${Math.max(...s.fps).toFixed(0)})` : s.fpsMedian.toFixed(1);
    }
    // The main run shows every view; control runs show only views that left the 60 fps cap.
    if (index === 0 || low < 58.5) fps.push(row); else capped.push(`${label} · ${gpuLabel}`);
  }
}
const adapters = [...new Set(perfs.flatMap(p => p.summary.map(s => s.adapter)).filter(Boolean))];
const data = {
  date: '2026-10-17',
  lead: '싱크타운 찻집 한 채와 앞마당만 블렌더로 다시 만들고 빛·그림자·접촉 음영을 텍스처에 구웠습니다. 승인된 v20(코드로 만든 판)과 같은 카메라·같은 화질 설정으로 나란히 찍었고, 보행·충돌·이름표·클릭은 v20 것을 그대로 썼습니다.',
  views: VIEWS.map(([key, label]) => ({ key, label })),
  variants: [
    { id: 'v20', label: 'v20 (지금 공개판)', shots: shotsFor('v20'), how: extra.how?.v20 || '' },
    { id: 'claude', label: 'Claude 블렌더 판', shots: shotsFor('claude'), how: extra.how?.claude || '' },
    { id: 'argon', label: '아르곤 블렌더 판', shots: shotsFor('argon'), how: extra.how?.argon || '' },
  ],
  metrics, fps,
  fpsNote: `정지 시점마다 8초씩 완성 프레임 수를 센 중앙값이고, 괄호는 회전 사이 최저–최고입니다. 고배율은 기기 배율 2로 열어 Town이 「가볍게」 화질 규칙대로 PC 1.5배·휴대폰 1.25배로 그린 값으로, 세 판을 순서를 돌려 가며 ${Math.min(...perfs[0].summary.map(x => x.fps.length))}~${perfs[0].rounds}회전 쟀습니다. 이 노트북의 내장 GPU는 같은 판·같은 시점에서도 회전마다 크게 흔들려(발열·전력 조절로 보임) 세 판의 차이가 이 흔들림보다 작습니다. 대조로 잰 1배 화면(내장 GPU)과 고배율 외장 GPU(RTX 5090)는 ${capped.length}개 시점에서 세 판 모두 60fps 상한이라 표에서 뺐습니다. 같은 세션에서 번갈아 잰 짧은 대조(results/ab-cut.json)에서도 구운 판이 v20보다 −10~+5fps 사이로 오갔습니다. 헤드리스 Edge 값이고 실물 휴대폰 값이 아닙니다.`,
  unverified: extra.unverified || [],
  decide: extra.decide || '',
};
fs.writeFileSync(path.resolve(args.out), JSON.stringify(data, null, 2) + '\n');
console.log('ok', path.resolve(args.out));
