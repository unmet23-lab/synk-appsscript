'use strict';
// 기존 Loom 출력 CSS와 자산을 고정하고, 같은 소재의 문안 변경만 비교한다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { marked } = require('marked');
const dir = __dirname;
const root = path.resolve(dir, '../../..');
const source = path.resolve(dir, '../회사별콘텐츠_20260910');
const { 색: color } = require(path.join(root, 'tools/lib/loom.js')).정본();
const config = [{ key: 'lab', folder: '01-lab', brand: 'LAB', handle: '@synk.mn' }, { key: 'shift', folder: '02-shift', brand: 'SHIFT', handle: '@synkbrief' }];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put = (p, value) => { const to = path.join(dir, p); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, value); };
function snapshot(from, relative) {
  const to = path.join(dir, relative); fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to) && hash(from) !== hash(to)) throw new Error('보존한 비교 원본이 달라졌습니다: ' + relative);
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
  return { source: path.relative(root, from).replace(/\\/g, '/'), snapshot: relative, sha256: hash(to) };
}
const lock = (brand, rel = '') => `<div class="brand-lock" role="img" aria-label="SYNK ${brand}"><img class="brand-synk" src="${rel}assets/brand-synk.webp" alt=""><img class="division-stitch-logo" data-division="${brand}" src="${rel}assets/brand-${brand.toLowerCase()}.webp" alt=""></div>`;
function html(title, body, rel = '', description = '', lang = 'ko', compare = false) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${description ? `<meta name="description" content="${esc(description)}">` : ''}<link rel="stylesheet" href="${rel}edition.css">${compare ? '<link rel="stylesheet" href="comparison.css">' : ''}</head><body class="account-collection execution${compare ? ' comparison' : ''}">${body}</body></html>`;
}
function card(p, slide, i) {
  const asset = slide.asset && slide.asset + (slide.asset === 'material-proof' ? '.png' : '.webp');
  return `<div class="canvas-wrap"><section class="artboard" data-brand="${p.brand}" data-layout="${slide.layout || 'lesson'}">${lock(p.brand, '../')}<div class="copy"><p class="eyebrow">${esc(slide.eyebrow || p.brand + ' / ' + (i + 1))}</p><h1 class="headline">${br(slide.title)}</h1>${slide.body ? `<p class="body-copy">${br(slide.body)}</p>` : ''}${slide.kr ? `<p class="kr" lang="ko">${br(slide.kr)}</p>` : ''}${slide.mn ? `<p class="mn" lang="mn">${br(slide.mn)}</p>` : ''}${slide.lines ? `<ul class="lines">${slide.lines.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${slide.tip ? `<p class="tip">${br(slide.tip)}</p>` : ''}</div>${asset ? `<img class="hero-asset" src="../assets/${asset}" alt="" decoding="sync">` : ''}<footer class="folio"><span>${p.brand === 'LAB' ? 'SYNK LAB · Солонгос хэл' : 'SYNK SHIFT · 1인 기업 실습'}</span><span>${i + 1} / ${p.slides.length}</span></footer></section></div>`;
}
const fit = `<script>function fit(){document.querySelectorAll('.canvas-wrap').forEach(e=>e.style.setProperty('--scale',e.clientWidth/1080))}fit();addEventListener('resize',fit)</script>`;

function createResource(p, md) {
  p = { ...p, discovery: { ...p.discovery, title: p.discovery.titleMn || p.discovery.title, description: p.discovery.descriptionMn || p.discovery.description } };
  const labels = p.key === 'lab'
    ? { back: 'Буцах', material: 'Жишээ ба дасгал', edit: 'Өөрийн өгүүлбэрээ бичье', original: 'Дасгалын эхийг авах', save: 'TXT файл авах', explain: 'Жишээг хараад өөрийн өгүүлбэрээ бичээрэй. Энэ хуудас бичсэн зүйлийг серверт илгээхгүй. Хуудсыг хаахаасаа өмнө TXT файлаа аваарай.', done: 'TXT файл бэлэн боллоо. Татсан файлуудаа шалгаарай.' }
    : { back: '글과 카드로', material: '완성 예시와 실습', edit: '내 조건으로 작성', original: '편집 원본 받기', save: '내 글 TXT 받기', explain: '예시와 확인 기준을 보고 내 조건으로 고쳐 쓰세요. 입력은 서버로 보내거나 자동 저장하지 않습니다. 창을 닫기 전에 TXT 파일로 받으세요.', done: 'TXT 파일을 만들었습니다. 다운로드 폴더에서 확인하세요.' };
  put(`${p.key}/material.md`, md);
  put(`${p.key}/material.html`, html(p.discovery.title, `<article class="editorial">${lock(p.brand, '../')}<nav class="material-actions"><a class="download" href="index.html">${labels.back}</a><a class="download" href="material.md" download>${labels.original}</a><a class="download" href="직접작성.html">${labels.edit}</a></nav>${marked.parse(md)}</article>`, '../', p.discovery.description, p.key === 'lab' ? 'mn' : 'ko'));
  const matches = [...md.matchAll(/```(?:text)?\n([\s\S]*?)```/g)];
  const template = matches.length ? matches.at(-1)[1] : md;
  put(`${p.key}/직접작성.html`, html(labels.edit, `<article class="editorial">${lock(p.brand, '../')}<a href="index.html">${labels.back}</a><h1>${labels.edit}</h1><p>${labels.explain}</p><a class="download" href="material.html" target="_blank" rel="noopener">${labels.material}</a><label class="work-label" for="work">${labels.edit}</label><textarea class="work-input" id="work" spellcheck="false">${esc(template)}</textarea><div class="material-actions"><button type="button" class="download" id="save">${labels.save}</button></div><p class="work-status" role="status" id="status"></p></article><script>document.getElementById('save').addEventListener('click',()=>{const value=document.getElementById('work').value;const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='SYNK-${p.brand}-practice.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('status').textContent=${JSON.stringify(labels.done)}})</script>`, '../', '', p.key === 'lab' ? 'mn' : 'ko'));
  const gallery = p.slides.map((s, i) => `<figure><img src="upload-${String(i + 1).padStart(2, '0')}.jpg" alt="${esc([s.title, s.body, s.kr, s.mn].filter(Boolean).join(' '))}" loading="lazy"><figcaption>${i + 1} / ${p.slides.length}</figcaption></figure>`).join('');
  put(`${p.key}/index.html`, html(p.discovery.title, `<article class="editorial">${lock(p.brand, '../')}<p class="kicker">${p.brand} · ${p.handle}</p><h1>${esc(p.discovery.title)}</h1><p>${esc(p.discovery.description)}</p><nav class="material-actions"><a class="download" href="material.html">${labels.material}</a><a class="download" href="직접작성.html">${labels.edit}</a><a class="download" href="material.md" download>${labels.original}</a></nav><div class="copy-text" lang="${p.key === 'lab' ? 'mn' : 'ko'}">${esc(p.caption)}</div>${gallery}</article>`, '../', p.discovery.description, p.key === 'lab' ? 'mn' : 'ko'));
  put(`${p.key}/게시문안.txt`, p.caption + '\n');
  if (p.captionKo) put(`${p.key}/게시문안_한국어뜻.txt`, p.captionKo + '\n');
  put(`${p.key}/제목.txt`, p.title + '\n');
  put(`${p.key}/대체텍스트.txt`, p.slides.map((s, i) => `${i + 1}. ${[s.title, s.body, s.kr, s.mn, s.tip].filter(Boolean).join(' ').replace(/\n/g, ' ')}`).join('\n\n') + '\n');
  put(`${p.key}/업로드안내.md`, `# ${p.brand} 비교판 · ${p.handle}\n\n- 기존 주제·표지 질문을 유지한 비교 후보입니다. 실제 SNS 게시·공개 웹 배포·추천 효과 측정은 하지 않았습니다.\n- upload-01.jpg~06.jpg를 번호순 한 게시물로, 게시문안.txt를 공개 본문으로 사용합니다.\n- 대체텍스트.txt는 지원되는 이미지 설명 칸에 넣습니다.\n- 본문만 읽어도 기본 예시와 연습을 쓸 수 있습니다. 댓글·개인정보·자동 DM을 자료 조건으로 두지 않았습니다.\n- index.html·material.html·직접작성.html은 작동하는 로컬 미리보기입니다. 실제 공개 URL이 생기기 전 SNS 본문에 로컬 주소를 붙이지 않습니다.\n- ${p.key === 'lab' ? '새 몽골어는 AI 의미 대조 범위를 결과 안내에서 확인하고 사람 원어민 감수와 구분합니다.' : '고객 요청과 제안은 가상 교육용 예시이며 실제 의뢰·납품·인쇄 결과가 아닙니다.'}\n`);
}

function comparisonPage(items) {
  put('comparison.css', `/* 비교 UI의 배치만 조정. 카드·로고·폰트·색은 보존한 Loom 출력. */
.comparison [hidden]{display:none!important}.comparison .collection-shell{max-width:1260px;padding-top:36px}.comparison .collection-intro{padding:0 0 22px}.comparison .collection-intro h1{font-size:clamp(28px,4vw,44px);line-height:1.25;margin:18px 0}.comparison .collection-intro p{font-size:17px;max-width:52em}.comparison .topline,.comparison .controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.comparison .controls{margin:16px 0}.comparison .controls .download{margin:0;min-height:44px;cursor:pointer;transition:transform 120ms ease-out}.comparison .download[aria-pressed="true"]{background:${color.Ink};color:${color.Paper};border-color:${color.Ink}}.comparison .download:disabled{opacity:.45;cursor:default}.comparison .pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.comparison .pair>section{min-width:0}.comparison .pair h3{font-size:18px;line-height:1.5;margin:0 0 10px}.comparison .card-view{display:block;width:100%;height:auto;border:1px solid ${color.Oat};border-radius:8px}.comparison .legend{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.comparison .legend .metadata{margin:0}.comparison .caption{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;font-size:16px;background:${color.Oat};border-radius:8px;padding:24px}.comparison details{margin:24px 0;border-top:1px solid ${color.Oat};padding-top:20px}.comparison summary{cursor:pointer;min-height:44px;font-size:20px;font-weight:700}.comparison #slide-status{font-variant-numeric:tabular-nums}.comparison .change-note{font-size:16px;line-height:1.7;margin:14px 0}.comparison .review-note{font-size:15px;line-height:1.8;color:${color['Deep Wool']};margin:20px 0}.comparison .mobile-view{display:none}.comparison table{width:100%;border-collapse:collapse;font-size:15px;line-height:1.7}.comparison td,.comparison th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid ${color.Oat}}.comparison .stage-title{font-size:24px;line-height:1.4;margin:18px 0 8px}.comparison .resources-links{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.comparison .download:focus-visible,.comparison summary:focus-visible{outline:3px solid ${color['Coral 3']};outline-offset:3px}@media(max-width:640px){.comparison .collection-shell{padding:22px 18px}.comparison .pair{grid-template-columns:1fr}.comparison .mobile-view{display:flex}.comparison .pair>section.mobile-hidden{display:none}.comparison .caption{padding:18px}.comparison td,.comparison th{padding:8px}.comparison .stage-title{font-size:22px}}`);
  const body = `<main class="collection-shell field-edition"><header class="collection-intro"><div class="topline"><p class="kicker">SYNK / 2026.09.10 / CONTENT COMPARISON</p><a href="../회사별콘텐츠_20260910/index.html" target="_blank" rel="noopener">최근 네 편 전체 보기 ↗</a></div><h1>같은 이야기,<br>두 가지 안내.</h1><p>LAB과 SHIFT 두 편의 기존판과 새 기준판입니다. 같은 장을 넘기며 카드·게시 본문·자료 안내를 비교해 보세요.</p></header><nav class="controls" aria-label="콘텐츠 선택"><button class="download" data-brand="lab" aria-pressed="true">LAB · 한국어 표현</button><button class="download" data-brand="shift" aria-pressed="false">SHIFT · 요청 변경</button></nav><h2 class="stage-title" id="topic"></h2><p class="metadata" id="summary"></p><div class="controls" aria-label="카드 이동"><button class="download" id="prev">← 이전 장</button><span id="slide-status" aria-live="polite"></span><button class="download" id="next">다음 장 →</button><button class="download" id="first-change">바뀐 장 보기</button></div><nav class="controls mobile-view" aria-label="모바일 비교판 선택"><button class="download" data-side="old" aria-pressed="true">기존판</button><button class="download" data-side="new" aria-pressed="false">새 기준판</button></nav><div class="pair" id="cards-pair"><section data-pane="old"><div class="legend"><h3>기존판</h3><a id="old-full" target="_blank" rel="noopener">크게 보기 ↗</a></div><img class="card-view" id="old-image" width="1080" height="1350" alt=""></section><section data-pane="new"><div class="legend"><h3>새 기준판</h3><a id="new-full" target="_blank" rel="noopener">크게 보기 ↗</a></div><img class="card-view" id="new-image" width="1080" height="1350" alt=""></section></div><p class="change-note" id="change-note" aria-live="polite"></p><details open><summary>게시 문안 비교</summary><div class="controls" id="caption-controls"><button class="download" data-language="ko" aria-pressed="true">한국어 뜻</button><button class="download" data-language="mn" aria-pressed="false">몽골어 게시 본문</button></div><div class="pair" id="caption-pair"><section data-pane="old"><h3>기존 게시 문안</h3><div class="caption" id="old-caption"></div></section><section data-pane="new"><h3>새 게시 문안</h3><div class="caption" id="new-caption"></div></section></div></details><details><summary>유지한 것과 바꾼 것</summary><p id="preserved"></p><table><thead><tr><th>위치</th><th>변경 이유</th></tr></thead><tbody id="change-rows"></tbody></table></details><section><h2 class="stage-title">자료까지 직접 확인</h2><p>예시·연습 원본은 유지하고, 새 안내 페이지에서 예시 읽기 → 직접 작성 → TXT 받기로 연결했습니다.</p><div class="resources-links"><a class="download" id="old-material" target="_blank" rel="noopener">기존 자료</a><a class="download" id="new-page" target="_blank" rel="noopener">새 안내 페이지</a><a class="download" id="new-editor" target="_blank" rel="noopener">직접 작성해 보기</a><a class="download" id="new-caption-file" download>새 게시 문안 받기</a><a class="download" id="upload-zip" download>두 편 업로드 파일 ZIP</a></div></section><p class="review-note">비교용 제작본 · SNS 미게시 · 공개 웹 미배포<br>새 기준판의 우수함이나 AI 추천 효과를 입증한 실험은 아닙니다. 원래의 매력, 대상·용도의 이해, 실제 자료 사용 흐름을 비교합니다. LAB은 사람 원어민 감수 전입니다.</p><a href="읽어주세요.md">원본 보존·검토 범위 보기</a></main><script src="comparison.js"></script>`;
  put('index.html', html('SYNK · 기존판과 새 마케팅 기준판 비교', body, '', '같은 LAB·SHIFT 콘텐츠에서 설명과 자료 안내를 보완한 비교용 제작본.', 'ko', true));
  const cleanItems = Object.fromEntries(items.map(p => [p.key, { ...p, old: p.old, changed: p.changed }]));
  put('comparison.js', `'use strict';\nconst items=${JSON.stringify(cleanItems).replace(/</g, '\\u003c')};\nlet key='lab',slide=0,side='old',language='ko';
const el=id=>document.getElementById(id);function mobile(){document.querySelectorAll('[data-pane]').forEach(n=>n.classList.toggle('mobile-hidden',n.dataset.pane!==side));document.querySelectorAll('[data-side]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.side===side)))}
function update(){const p=items[key],n=String(slide+1).padStart(2,'0');el('topic').textContent=p.title;el('summary').textContent=p.brand+' · '+p.handle+' · 카드 '+p.slides.length+'장 중 '+p.changed.length+'장 문안 변경 · 색·폰트·자산 유지';el('slide-status').textContent=(slide+1)+' / '+p.slides.length;el('prev').disabled=slide===0;el('next').disabled=slide===p.slides.length-1;for(const [id,url]of[['old','baseline/'+key+'/upload-'+n+'.jpg'],['new',key+'/upload-'+n+'.jpg']]){el(id+'-image').src=url;el(id+'-image').alt=(id==='old'?'기존판':'새 기준판')+' '+(slide+1)+'장: '+(id==='old'?p.old.slides[slide].title:p.slides[slide].title);el(id+'-full').href=url}const fields=['eyebrow','title','body','kr','mn','lines','tip'].filter(f=>JSON.stringify(p.slides[slide][f])!==JSON.stringify(p.old.slides[slide][f]));el('change-note').textContent=fields.length?'이 장은 '+fields.map(f=>({eyebrow:'작은 제목',title:'제목',body:'상황 설명',kr:'한국어 표현',mn:'몽골어 뜻',lines:'본문',tip:'끝 안내'}[f])).join(' · ')+'을 조정했습니다.':'이 장은 기존 파일과 같은 이미지입니다.';el('caption-controls').hidden=key!=='lab';for(const name of ['old','new'])el(name+'-caption').textContent=(name==='old'?p.old:p)[key==='lab'&&language==='ko'?'captionKo':'caption'];document.querySelectorAll('[data-brand]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.brand===key)));document.querySelectorAll('[data-language]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.language===language)));el('preserved').textContent='유지: '+p.discovery.preserved.join(' · ');el('change-rows').replaceChildren(...p.discovery.changes.map(c=>{const tr=document.createElement('tr');for(const text of[c.field,c.reason]){const td=document.createElement('td');td.textContent=text;tr.append(td)}return tr}));el('old-material').href='../회사별콘텐츠_20260910/'+p.folder+'/material.html';el('new-page').href=key+'/index.html';el('new-editor').href=key+'/직접작성.html';el('new-caption-file').href=key+'/게시문안.txt';el('upload-zip').href='비교판_업로드.zip';mobile()}
document.querySelectorAll('[data-brand]').forEach(n=>n.addEventListener('click',()=>{key=n.dataset.brand;slide=0;update()}));document.querySelectorAll('[data-side]').forEach(n=>n.addEventListener('click',()=>{side=n.dataset.side;mobile()}));document.querySelectorAll('[data-language]').forEach(n=>n.addEventListener('click',()=>{language=n.dataset.language;update()}));el('prev').addEventListener('click',()=>{slide=Math.max(0,slide-1);update()});el('next').addEventListener('click',()=>{slide=Math.min(items[key].slides.length-1,slide+1);update()});el('first-change').addEventListener('click',()=>{const changed=items[key].changed;slide=changed.find(i=>i>slide)??changed[0]??0;update()});update();`);
}

async function build() {
  const original = read(path.join(source, 'content-b.json'));
  const origins = [snapshot(path.join(source, 'content-b.json'), 'baseline/content-b.json'), snapshot(path.join(source, 'edition.css'), 'edition.css')];
  const items = config.map(c => {
    const p = { ...read(path.join(dir, c.key + '.json')), ...c, old: original[c.key] };
    p.changed = p.slides.flatMap((s, i) => JSON.stringify(s) === JSON.stringify(p.old.slides[i]) ? [] : [i]);
    if (p.slides.length !== p.old.slides.length || p.changed.length > 3) throw new Error('같은 소재 비교 범위를 벗어났습니다: ' + p.key);
    return p;
  });
  const assets = new Set(['brand-synk.webp', 'brand-lab.webp', 'brand-shift.webp']);
  for (const p of items) for (const s of p.slides) if (s.asset) assets.add(s.asset + (s.asset === 'material-proof' ? '.png' : '.webp'));
  for (const a of assets) origins.push(snapshot(path.join(source, 'assets', a), 'assets/' + a));
  for (const p of items) {
    for (let i = 0; i < p.slides.length; i++) {
      const name = `upload-${String(i + 1).padStart(2, '0')}.jpg`;
      origins.push(snapshot(path.join(source, p.folder, name), `baseline/${p.key}/${name}`));
      if (!p.changed.includes(i)) { fs.mkdirSync(path.join(dir, p.key), { recursive: true }); fs.copyFileSync(path.join(dir, 'baseline', p.key, name), path.join(dir, p.key, name)); }
    }
    for (const f of ['게시문안.txt', 'material.md', ...(p.key === 'lab' ? ['게시문안_한국어뜻.txt'] : [])]) origins.push(snapshot(path.join(source, p.folder, f), `baseline/${p.key}/${f}`));
    put(`${p.key}/cards.html`, html(p.title, p.slides.map((s, i) => card(p, s, i)).join('') + fit, '../', '', p.key === 'lab' ? 'mn' : 'ko'));
    createResource(p, fs.readFileSync(path.join(dir, 'baseline', p.key, 'material.md'), 'utf8'));
  }
  comparisonPage(items);
  put('_검토/원본지문.json', JSON.stringify({ baselineCommit: '95d463fdc6c16000d9c4e718554e9b4dce4067e1', observedAt: new Date().toISOString(), origins }, null, 2));
  if (process.argv.includes('--render')) {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1600 }, deviceScaleFactor: 2 });
      const results = [];
      for (const p of items) {
        await page.goto(pathToFileURL(path.join(dir, p.key, 'cards.html')).href);
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
        const checks = await page.evaluate(() => [...document.querySelectorAll('.artboard')].map(a => { const copy = a.querySelector('.copy'), img = a.querySelector('.hero-asset'), r = a.getBoundingClientRect(), bottom = copy.getBoundingClientRect().bottom - r.top; if (img) { const available = Math.min(440, r.height - bottom - 150); img.style.height = Math.max(0, available) + 'px'; if (available < 100) img.style.display = 'none'; } return { bottom, overflow: bottom > r.height - 105 }; }));
        if (checks.some(c => c.overflow)) throw new Error(p.key + ' 글자 안전영역 초과: ' + JSON.stringify(checks));
        for (const i of p.changed) {
          const buffer = await page.locator('.artboard').nth(i).screenshot();
          const file = `${p.key}/upload-${String(i + 1).padStart(2, '0')}.jpg`;
          await sharp(buffer).resize(1080, 1350).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(path.join(dir, file));
          results.push({ file, sha256: hash(path.join(dir, file)), ...checks[i] });
        }
      }
      put('_검토/렌더.json', JSON.stringify({ changedCards: results.length, results }, null, 2));
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({ packages: items.map(p => ({ brand: p.brand, changedSlides: p.changed.map(i => i + 1), captionChanged: p.caption !== p.old.caption })), sourceFiles: origins.length }));
}
build().catch(e => { console.error(e); process.exitCode = 1; });
