// PULSE AI 모델 캐스팅북을 만든다. 사용: node build-site.cjs
// 결과: site/index.html(홈페이지용 전체 문서), site/artifact.html(claude.ai 보기용), site/img, site/voice
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const here = __dirname, root = path.resolve(here, '../../..'), out = path.join(here, 'site');
const uri = (p, m) => `data:${m};base64,${fs.readFileSync(p).toString('base64')}`;
const { models } = require('./roster-v2.json');
const voices = require('./voices.json');

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

const imgJobs = [];
const data = {
  updated: '2026-09-30', models: [], infoRows: [
    ['신체 정보', '키·체형·옷과 신발 사이즈예요. 룩북과 의류 광고에서 옷이 맞게 보이도록 제작 기준으로 써요.'],
    ['앞뒤좌우', '옆모습과 뒷모습에서도 같은 사람으로 보이는지, 헤어 뒷모양은 어떤지 확인해요.'],
    ['표정', '웃음·화남·놀람처럼 감정 표현이 필요한 상황극과 리액션 광고에 맞는지 봐요.'],
    ['헤어 3가지', '얼굴은 그대로 두고 헤어만 바꾼 모습이에요. 브랜드 분위기에 맞는 스타일을 골라요.'],
    ['전신·룩', '전신 비율과 옷 태를 보고, 다른 옷을 입었을 때의 인상을 비교해요.'],
    ['디테일·장면', '뷰티 광고의 확대 컷, 제품을 드는 손, 실제 광고 장면에서 어색함이 없는지 확인해요.'],
    ['목소리 3가지', '같은 문장을 톤만 바꿔 읽었어요. 영상 내레이션과 대사의 기준이 돼요.'],
    ['어울리는 업종', '인상에 맞춰 추천하는 업종이에요. 목록에 없는 업종도 상담할 수 있어요.'],
  ],
};

for (const m of models) {
  const code = m.code, shots = {}, gallery = [];
  for (const [key, label, en] of SHOTS) {
    const src = key === 'hero' ? path.join(here, m.hero) : path.join(here, 'raw', `${m.key}-${key}.png`);
    if (!fs.existsSync(src)) continue;
    const s = `img/${code}/${key}-s.webp`, l = `img/${code}/${key}.webp`;
    imgJobs.push([src, path.join(out, s), 720, 80], [src, path.join(out, l), 1600, 84]);
    let lab = label;
    if (key === 'hair-2' || key === 'hair-3') lab = `헤어 ${key.slice(-1)} · ${m.hair[Number(key.slice(-1)) - 1].label}`;
    if (key === 'look-1' || key === 'look-2') lab = m.looks[Number(key.slice(-1)) - 1].label;
    shots[key] = { s, l, label: lab, en };
    gallery.push({ key, s, l, label: lab, alias: key === 'hero' ? 'hair-1' : undefined });
  }
  if (shots.hero) shots['hair-1'] = { ...shots.hero, label: `헤어 1 · ${m.hair[0].label}`, en: 'HAIR 1' };
  // 카드에 마우스를 올리면 보이는 웃음: 대표 사진과 눈 위치·얼굴 크기를 맞춘 사진(make-hover.py)만 쓴다
  const hoverSrc = path.join(here, 'raw', `${m.key}-hover.png`), hover = fs.existsSync(hoverSrc) ? { s: `img/${code}/hover-s.webp`, l: `img/${code}/hover.webp` } : null;
  if (hover) imgJobs.push([hoverSrc, path.join(out, hover.s), 720, 80], [hoverSrc, path.join(out, hover.l), 1600, 84]);
  const mine = voices.filter((v) => v.name.startsWith(m.key + '-'));
  const vs = mine.map((v, i) => {
    const wav = path.join(here, 'voice', `${v.name}.wav`), mp3 = `voice/${code}-${i + 1}.mp3`;
    fs.mkdirSync(path.join(out, 'voice'), { recursive: true });
    if (fs.existsSync(wav)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '96k', path.join(out, mp3)]);
    return { label: v.label, note: v.note || VOICE_NOTE[v.voice] || '', text: v.text || '', src: mp3 };
  });
  const { key, hero, heroEngine, outfit, context, hands, voiceBrief, looks, hair, ...pub } = m;
  data.models.push({
    ...pub,
    hair: hair.map((h) => ({ label: h.label })), looks: looks.map((l) => ({ label: l.label })),
    hero: shots.hero, alt: hover, shots, gallery, shotCount: gallery.length,
    voices: vs, script: mine.every((v) => v.text) ? '' : (mine[0] || {}).script || '',
  });
}

fs.mkdirSync(out, { recursive: true });
const listFile = path.join(here, 'jobs', '_img-list.json');
fs.writeFileSync(listFile, JSON.stringify(imgJobs));
execFileSync('python', [path.join(here, 'make-images.py'), listFile], { stdio: 'inherit' });

// 글꼴: SUIT(한글) + Inter Tight·DM Mono. 발주서 빌드와 같은 원본을 쓴다.
let fonts = require(path.join(root, 'tools/lib/브랜드폰트.js')).면();
const fontDir = path.join(root, 'docs/마케팅/맞춤도구/dist/brief/computer/assets');
for (const [name, file, weight] of [['Inter Tight', 'InterTight-500.woff2', 500], ['Inter Tight', 'InterTight-700.woff2', 700], ['DM Mono', 'DMMono-500.woff2', 500]]) {
  fonts += `@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${uri(path.join(fontDir, file), 'font/woff2')}) format('woff2');}`;
}
const pulse = path.join(root, 'docs/마케팅/클라이언트_발주서_20260930/assets');
const common = fs.readFileSync(path.join(root, 'docs/디자인/펠트스크랩북/scrapbook.css'), 'utf8')
  + `:root{--thread:url('${uri(path.join(pulse, 'thread-pulse.webp'), 'image/webp')}')}`;
const rep = {
  FAVICON: uri(path.join(root, 'docs/마케팅/맞춤도구/assets/favicon-32.png'), 'image/png'),
  LOGO: uri(path.join(pulse, 'brand-pulse.webp'), 'image/webp'),
  FONTS: fonts, COMMON: common,
  STYLE: fs.readFileSync(path.join(here, 'site-src/style.css'), 'utf8'),
  DATA: JSON.stringify(data).replace(/</g, '\\u003c'),
  APP: fs.readFileSync(path.join(here, 'site-src/app.js'), 'utf8'),
};
let page = fs.readFileSync(path.join(here, 'site-src/template.html'), 'utf8');
for (const [k, v] of Object.entries(rep)) page = page.replace(`@@${k}@@`, () => v);
if (/@@\w+@@/.test(page)) throw Error('채우지 못한 자리표시가 있다');
const licenses = ['SUIT/LICENSE_OFL.txt', 'InterTight/OFL.txt', 'DM_Mono/OFL.txt']
  .map((p) => fs.readFileSync(path.join(root, 'docs/브랜드_폰트', p), 'utf8')).join('\n\n');
const cut = page.indexOf('</style>') + '</style>'.length;
const head = page.slice(0, cut), body = page.slice(cut);
const lic = `\n<!-- Embedded font licenses\n${licenses}\n-->`;
fs.writeFileSync(path.join(out, 'artifact.html'), head + lic + body);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head}${lic}</head>\n<body>${body}</body></html>\n`);
const size = (p) => (fs.statSync(path.join(out, p)).size / 1024 / 1024).toFixed(2) + 'MB';
console.log('모델', data.models.map((m) => `${m.code} ${m.name} ${m.shotCount}컷 목소리 ${m.voices.length}`).join(' / '));
console.log('index.html', size('index.html'), '· artifact.html', size('artifact.html'));
