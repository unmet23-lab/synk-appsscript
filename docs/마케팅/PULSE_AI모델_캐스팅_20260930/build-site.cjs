// PULSE AI 모델 고르기(캐스팅북)를 만든다. 사용: node build-site.cjs
// 결과: site/index.html(홈페이지용 전체 문서), site/artifact.html(claude.ai 보기용), site/img, site/voice, site/video
// 원본: roster-v2.json(모델) · voices.json(목소리) · catalog.json(고르기 설정·모델별 추가 자료) · 명세서/<코드>_<이름>.json(완성 명세서)
// 원본 사진(raw/)이 없는 PC에서는 이미 만든 site/img 파일을 그대로 쓴다. 둘 다 없으면 그 컷만 빠진다.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const here = __dirname, root = path.resolve(here, '../../..'), out = path.join(here, 'site');
const uri = (p, m) => `data:${m};base64,${fs.readFileSync(p).toString('base64')}`;
const { models } = require('./roster-v2.json');
const voices = require('./voices.json');
const catalog = require('./catalog.json');
const logic = require('./site-src/casting-logic.js');

const SHOTS = [
  ['hero', '기본', 'NEUTRAL'], ['angle-front', '정면', 'FRONT'], ['angle-left', '왼쪽', 'LEFT'], ['angle-right', '오른쪽', 'RIGHT'], ['angle-back', '뒤', 'BACK'],
  ['exp-smile', '웃음', 'SMILE'], ['exp-angry', '화남', 'ANGRY'], ['exp-surprised', '놀람', 'SURPRISED'],
  ['hair-2', '헤어 2', 'HAIR 2'], ['hair-3', '헤어 3', 'HAIR 3'],
  ['fullbody', '전신', 'FULL BODY'], ['look-1', '룩 1', 'LOOK 1'], ['look-2', '룩 2', 'LOOK 2'],
  ['skin', '피부 근접', 'SKIN'], ['hands', '손', 'HANDS'], ['context', '광고 장면', 'SCENE'],
];
const VOICE_NOTE = {
  Charon: '낮고 안정적인 톤 · 내레이션', Puck: '밝고 경쾌한 톤 · 추천·후기', Enceladus: '숨결이 섞인 낮은 톤 · 향수·무드',
  Despina: '매끄럽고 자신감 있는 톤 · 색조·패션', Zephyr: '밝고 또렷한 톤 · 소개·안내', Achernar: '부드럽고 가까운 톤 · 스킨케어·무드',
  Leda: '맑고 어린 톤 · 음료·앱', Aoede: '산뜻하고 가벼운 톤 · 일상·후기', Laomedeia: '들뜨고 생기 있는 톤 · 이벤트·챌린지',
  Kore: '또렷하고 단단한 톤 · 금융·안내', Erinome: '맑고 차분한 톤 · 설명·교육', Vindemiatrix: '부드럽고 다정한 톤 · 상담·케어',
  Algenib: '거칠고 묵직한 톤 · 향수·주류', Orus: '단단하고 깊은 톤 · 자동차·기업', Algieba: '부드럽고 낮은 톤 · 무드·내레이션',
  Autonoe: '밝고 맑은 톤 · 스킨케어·여행', Callirrhoe: '편안하고 자연스러운 톤 · 일상·브이로그', Sulafat: '따뜻하고 부드러운 톤 · 라이프스타일',
};

// 완성 명세서: 명세서/*.json 중 「코드」가 같은 것
const specs = {};
const specDir = path.join(here, '명세서');
if (fs.existsSync(specDir)) for (const f of fs.readdirSync(specDir).filter((f) => f.endsWith('.json'))) {
  try { const s = JSON.parse(fs.readFileSync(path.join(specDir, f), 'utf8')); if (s['코드']) specs[s['코드']] = { ...s, file: f }; } catch (e) { console.warn('명세서를 읽지 못함', f, e.message); }
}

const imgJobs = [], missing = [];
const outRel = (rel) => path.join(out, rel);
// 원본이 있으면 굽기 목록에 넣고, 없으면 이미 만든 파일이 있을 때만 쓴다.
function image(src, rel, side, q, crop) {
  if (src && fs.existsSync(src)) { imgJobs.push(crop ? [src, outRel(rel), side, q, crop] : [src, outRel(rel), side, q]); return true; }
  return fs.existsSync(outRel(rel));
}
function pair(src, base) {
  const s = `${base}-s.webp`, l = `${base}.webp`;
  const ok = image(src, s, 720, 80) & image(src, l, 1600, 84);
  return ok ? { s, l } : null;
}

// 화면의 브리프 추천이 제품 설명 속 낱말을 찾으므로 words는 같이 보낸다(fits·match는 빌드에서 모델에 붙인다)
const data = { updated: catalog.updated, industries: catalog.industries.map(({ id, label, hint, words, sub }) => ({ id, label, hint, words, sub })), moods: catalog.moods.map(({ id, label, words }) => ({ id, label, words })), genderWords: catalog.genderWords || {}, compareShots: catalog.compareShots, say: catalog.say || null, shareBase: catalog.artifactUrl || '', models: [] };

for (const m of models) {
  const code = m.code, extra = (catalog.models || {})[code] || {}, spec = specs[code];
  const shots = {};
  for (const [key, label, en] of SHOTS) {
    const src = key === 'hero' ? path.join(here, m.hero) : path.join(here, 'raw', `${m.key}-${key}.png`);
    const p = pair(src, `img/${code}/${key}`);
    if (!p) { missing.push(`${code} ${key}`); continue; }
    let lab = label;
    if (key === 'hair-2' || key === 'hair-3') lab = `헤어 ${key.slice(-1)} · ${m.hair[Number(key.slice(-1)) - 1].label}`;
    if (key === 'look-1' || key === 'look-2') lab = m.looks[Number(key.slice(-1)) - 1].label;
    if ((extra.shotLabels || {})[key]) lab = extra.shotLabels[key];
    shots[key] = { ...p, label: lab, en };
  }
  if (shots.hero) shots['hair-1'] = { ...shots.hero, label: `헤어 1 · ${m.hair[0].label}`, en: 'HAIR 1' };
  for (const it of (extra.fullAngles || {}).items || []) {
    const p = pair(path.join(extra.fullAngles.dir, it.file), `img/${code}/${it.key}`);
    if (p) shots[it.key] = { ...p, label: it.label, en: it.en }; else missing.push(`${code} ${it.key}`);
  }
  // 카드에 마우스를 올리면 보이는 웃음: 대표 사진과 눈 위치·얼굴 크기를 맞춘 사진(make-hover.py)만 쓴다
  const alt = pair(path.join(here, 'raw', `${m.key}-hover.png`), `img/${code}/hover`);

  const scenes = [];
  for (const it of (extra.scenes || {}).items || []) {
    const p = pair(path.join(extra.scenes.dir, it.file), `img/${code}/scene-${it.id}`);
    if (p) scenes.push({ id: it.id, ...p, place: it.place, label: it.label, tags: it.tags || [] }); else missing.push(`${code} scene ${it.id}`);
  }

  // 키 비교 띠: 정수리~발바닥을 자른 세로 띠. 띠 높이가 곧 키라서 화면에서 cm에 맞춰 세운다.
  let stand = null;
  if (extra.stand) {
    const span = extra.stand.feet - extra.stand.top, half = Math.round(span * 0.18); // 팔까지 들어가는 폭(키의 0.36)
    const ok = image(path.join(root, extra.stand.src), `img/${code}/stand.webp`, 1100, 82, { top: extra.stand.top, bottom: extra.stand.feet, half });
    if (ok) stand = { src: `img/${code}/stand.webp`, ratio: +(2 * half / span).toFixed(4) };
  }

  const mine = voices.filter((v) => v.name.startsWith(m.key + '-'));
  fs.mkdirSync(path.join(out, 'voice'), { recursive: true });
  const vs = mine.map((v, i) => {
    const wav = path.join(here, 'voice', `${v.name}.wav`), mp3 = `voice/${code}-${i + 1}.mp3`;
    if (fs.existsSync(wav)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '96k', outRel(mp3)]);
    if (!fs.existsSync(outRel(mp3))) { missing.push(`${code} voice ${i + 1}`); return null; }
    return { label: v.label, note: v.note || VOICE_NOTE[v.voice] || '', text: v.text || '', src: mp3, say: v.engine === 'typecast' && !!v.voiceId };
  }).filter(Boolean);

  const motion = [];
  (extra.motion || []).forEach((v, i) => {
    const src = path.join(root, v.src), rel = `video/${code}-${i + 1}.mp4`;
    fs.mkdirSync(path.join(out, 'video'), { recursive: true });
    if (fs.existsSync(src) && (!fs.existsSync(outRel(rel)) || fs.statSync(outRel(rel)).size !== fs.statSync(src).size)) fs.copyFileSync(src, outRel(rel));
    if (fs.existsSync(outRel(rel))) motion.push({ src: rel, label: v.label, note: v.note || '' }); else missing.push(`${code} motion ${i + 1}`);
  });

  // 보드에서 마우스를 올리면 도는 짧은 영상(loop/<코드>.mp4, 처음·끝 프레임이 대표 사진과 같다)
  let loop = null;
  if (extra.loop) {
    const src = path.join(here, extra.loop.src), rel = `video/${code}-loop.mp4`;
    fs.mkdirSync(path.join(out, 'video'), { recursive: true });
    if (fs.existsSync(src) && (!fs.existsSync(outRel(rel)) || fs.statSync(outRel(rel)).size !== fs.statSync(src).size)) fs.copyFileSync(src, outRel(rel));
    if (fs.existsSync(outRel(rel))) loop = { src: rel }; else missing.push(`${code} loop`);
  }

  // 몸 비율: 명세서가 있으면 명세서 값, 없으면 catalog의 측정값
  const measured = spec && spec['몸'] && spec['몸']['측정_전신기준'];
  const body = measured
    ? { heads: measured['등신_머리카락포함'], shoulderFace: measured['어깨_얼굴폭_비'], leg: measured['다리비율_골반관절에서바닥'], torso: measured['몸통비율_어깨에서골반'] }
    : extra.body ? { heads: extra.body.heads, shoulderFace: extra.body.shoulderFace, leg: extra.body.leg, torso: extra.body.torso } : null;
  const colors = spec && spec['색'] ? ['머리', '피부', '입술'].filter((k) => spec['색'][k]).map((k) => ({
    label: k, hex: spec['색'][k], range: ((spec['색']['측정범위_대표사진외3장'] || {})[k]) || null,
  })) : null;

  // 업종이 붙은 사진: 장면 사진이 먼저, 그다음 광고 장면·손·룩
  const tagged = [
    ...scenes.map((s) => ({ ref: `scene:${s.id}`, s: s.s, l: s.l, label: `${s.place} · ${s.label}`, tags: s.tags })),
    ...Object.entries(extra.shotTags || {}).filter(([k]) => shots[k]).map(([k, tags]) => ({ ref: `shot:${k}`, s: shots[k].s, l: shots[k].l, label: shots[k].label, tags })),
  ];

  const pub = {
    code, name: m.name, gender: m.gender, ageBand: m.ageBand || '', age: m.age || '', concept: m.concept, impression: m.impression, fits: m.fits,
    height: m.height || null, weightKg: m.weightKg || null, build: m.build || '', sizes: m.sizes || {}, skin: m.skin || '', eyes: m.eyes || '', hairBase: m.hairBase || '',
    realPerson: !!m.realPerson, hair: m.hair.map((h) => ({ label: h.label })), looks: m.looks.map((l) => ({ label: l.label })),
    hero: shots.hero || null, alt, shots, scenes, stand, body, colors, voices: vs, motion, loop, tagged,
    face: extra.face || null, bodyNote: extra.bodyNote || '', direction: extra.direction || null, spec: !!spec && scenes.length > 0, // 「상세 프로필」 꼬리표: 명세서에 장면 사진까지 갖춘 모델
    script: mine.every((v) => v.text) ? '' : (mine[0] || {}).script || '',
  };
  Object.assign(pub, logic.tagModel(pub, catalog));
  pub.shotCount = Object.keys(shots).filter((k) => k !== 'hair-1').length;
  data.models.push(pub);
}

fs.mkdirSync(out, { recursive: true });
const listFile = path.join(here, 'jobs', '_img-list.json');
fs.writeFileSync(listFile, JSON.stringify(imgJobs));
execFileSync('python', [path.join(here, 'make-images.py'), listFile], { stdio: 'inherit' });

// 글꼴: SUIT(한글) + SYNK Latin(Inter Tight, 영문·숫자) + DM Mono(영문 라벨). PULSE 고객 앱과 같은 파일을 쓴다.
const pulseAssets = path.join(root, 'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets');
const LATIN = 'U+0020-007E,U+00A0-00B6,U+00B8-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2010-2024,U+2026-2027,U+2030-203A,U+20A9,U+20AC,U+2122,U+2212';
let fonts = require(path.join(root, 'tools/lib/브랜드폰트.js')).면();
for (const [file, range] of [['SYNKLatin-Regular.woff2', '100 549'], ['SYNKLatin-SemiBold.woff2', '550 649'], ['SYNKLatin-Bold.woff2', '650 1000']]) {
  fonts += `@font-face{font-family:'SYNK Latin';font-style:normal;font-weight:${range};font-display:swap;unicode-range:${LATIN};src:url(${uri(path.join(pulseAssets, file), 'font/woff2')}) format('woff2');}`;
}
fonts += `@font-face{font-family:'DM Mono';font-style:normal;font-weight:400 600;font-display:swap;unicode-range:U+0021-007E,U+00A0-00FF,U+2010-2027;src:url(${uri(path.join(pulseAssets, 'DMMono.ttf'), 'font/ttf')}) format('truetype');}`;

const pulse = path.join(root, 'docs/마케팅/클라이언트_발주서_20260930/assets');
const rep = {
  FAVICON: uri(path.join(root, 'docs/마케팅/맞춤도구/assets/favicon-32.png'), 'image/png'),
  LOGO: uri(path.join(pulse, 'brand-pulse.webp'), 'image/webp'),
  FONTS: fonts,
  STYLE: fs.readFileSync(path.join(here, 'site-src/style.css'), 'utf8'),
  DATA: '@@DATA@@',
  LOGIC: fs.readFileSync(path.join(here, 'site-src/casting-logic.js'), 'utf8'),
  APP: fs.readFileSync(path.join(here, 'site-src/app.js'), 'utf8'),
};
let page = fs.readFileSync(path.join(here, 'site-src/template.html'), 'utf8');
for (const [k, v] of Object.entries(rep)) if (k !== 'DATA') page = page.replace(`@@${k}@@`, () => v);
if (/@@(?!DATA@@)\w+@@/.test(page)) throw Error('채우지 못한 자리표시가 있다');
// 「우리 광고 문장으로 듣기」 서버 주소는 홈페이지판(index.html)에만 넣는다. claude.ai 페이지는 다른 주소로 요청을 보낼 수 없다.
const sayBase = { max: (catalog.say || {}).max || 60, daily: (catalog.say || {}).daily || 10 };
const dataJson = (api) => JSON.stringify({ ...data, say: { ...sayBase, api } }).replace(/</g, '\\u003c');
const withData = (html, api) => html.replace('@@DATA@@', () => dataJson(api));
// 화면에 나가는 글에 만든 도구 이름이 섞이지 않았는지 본다(목소리 이름표는 VOICE_NOTE로 바꿔서 나간다)
const banned = /Gemini|Nano ?Banana|Higgsfield|Soul 2|Vertex|LoRA|pls_f0|MediaPipe|Leda|Aoede|Laomedeia|SYNK-LoRA|Typecast|타입캐스트|tc_[0-9a-f]{8}/i;
const leak = JSON.stringify(data).match(banned);
if (leak) throw Error('공개 자료에 도구 이름이 들어 있다: ' + leak[0]);
const licenses = ['SUIT/LICENSE_OFL.txt', 'InterTight/OFL.txt', 'DM_Mono/OFL.txt']
  .map((p) => fs.readFileSync(path.join(root, 'docs/브랜드_폰트', p), 'utf8')).join('\n\n');
const cut = page.indexOf('</style>') + '</style>'.length;
const head = page.slice(0, cut), body = page.slice(cut);
const lic = `\n<!-- Embedded font licenses\n${licenses}\n-->`;
const homeApi = process.env.PULSE_SAY_API ?? ((catalog.say || {}).api || '');
fs.writeFileSync(path.join(out, 'artifact.html'), withData(head + lic + body, ''));
fs.writeFileSync(path.join(out, 'index.html'), withData(`<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head}${lic}</head>\n<body>${body}</body></html>\n`, homeApi));
const size = (p) => (fs.statSync(path.join(out, p)).size / 1024 / 1024).toFixed(2) + 'MB';
console.log('모델', data.models.map((m) => `${m.code} ${m.name} 컷${m.shotCount} 장면${m.scenes.length} 목소리${m.voices.length}${m.voices.some((v) => v.say) ? '(문장 듣기)' : ''}${m.loop ? ' 움직임' : ''}${m.spec ? ' 명세서' : ''}`).join(' / '));
if (homeApi) console.log('문장 듣기 서버', homeApi);
if (missing.length) console.log('빠진 것', missing.join(', '));
console.log('index.html', size('index.html'), '· artifact.html', size('artifact.html'));
