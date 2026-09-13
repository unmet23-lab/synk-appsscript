'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../../..'), ASSETS = path.join(__dirname, '../public/assets');
const VROOT = 'C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const OUT = path.join(VROOT, '등록성_보강_20260913'), QA = path.join(OUT, '검수');
const NAME = 'SYNK_결합반론_대응구성';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
async function main() {
  const { marked } = await import(pathToFileURL('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js').href);
  const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  fs.mkdirSync(QA, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));
  const selected = ['suit.woff2', 'inter-tight.ttf', 'inter-tight-bold.ttf', 'dm-mono.ttf', 'bracket.ttf', 'tokens.css', 'logo.webp'];
  for (const name of selected) {
    const entry = manifest.manifest.find(a => a.name === name);
    if (!entry || hash(path.join(ASSETS, name)) !== entry.sha256 || hash(path.join(ROOT, entry.source)) !== (entry.sourceSha256 || entry.sha256)) throw Error('Current source mismatch: ' + name);
  }
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'lab/RESULTS.json'), 'utf8'));
  for (const [relative, expected] of Object.entries(results.sources)) {
    if (hash(path.resolve(__dirname, 'lab', relative)) !== expected) throw Error('Re-run experiment after source change: ' + relative);
  }
  const font = (family, file, weight, extra = '') => `@font-face{font-family:'${family}';src:url('${dataUri(path.join(ASSETS, file), file.endsWith('woff2') ? 'font/woff2' : 'font/ttf')}');font-weight:${weight};font-display:block;${extra}}`;
  const fonts = font('SUIT Variable', 'suit.woff2', '100 900') + font('Inter Tight', 'inter-tight.ttf', '500') + font('Inter Tight', 'inter-tight-bold.ttf', '700 900') + font('DM Mono', 'dm-mono.ttf', '500') + font('SYNK Bracket', 'bracket.ttf', '100 900', 'unicode-range:U+300C-300D;');
  const tokens = fs.readFileSync(path.join(ASSETS, 'tokens.css'), 'utf8');
  let index = 0, headings = [];
  const report = marked.parse(fs.readFileSync(path.join(__dirname, 'REPORT.md'), 'utf8').replace(/^# .+\r?\n\r?\n[^\n]+\r?\n/, ''))
    .replace(/<h2>(.*?)<\/h2>/g, (_, title) => { const id = 'section-' + ++index; headings.push({ id, title }); return `<h2 id="${id}">${title}</h2>`; });
  const logo = dataUri(path.join(ASSETS, 'logo.webp'), 'image/webp');
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>결합 반론에 대응할 다음 구성 · SYNK</title><style>${tokens}${fonts}${css}</style></head><body>
  <header class="mast"><img src="${logo}" alt="SYNK LAB"><span class="mono">RESEARCH / 2026.09.13</span><a href="${NAME}.pdf">인쇄본 PDF ↗</a></header>
  <div class="page-layout"><aside><span class="mono">CONTENTS</span><nav aria-label="보고서 목차"><a href="#experiment">직접 비교해 보기</a>${headings.map(h => `<a href="#${h.id}">${h.title}</a>`).join('')}</nav></aside>
  <main><div class="hero"><p class="eyebrow">SYNK CORE · 다음 출원 구성 검토</p><h1>무엇을 확인할지와<br>어디에 쓸지를<br><em>함께 정합니다.</em></h1><p class="lead">판정 차이에서 원음 확인과 결과 사용 조건을 연결하는 구성.<br>결합 반론의 쟁점, 실제 실험, 아직 필요한 증거까지.</p><p class="boundary">검토용 추가 설계 · 등록 우위 미확정 · 로컬 합성 시험</p></div>
  <section id="experiment" class="experiment" aria-labelledby="experiment-heading"><p class="eyebrow">기록이 바뀌는 과정을 직접 비교해 보세요</p><h2 id="experiment-heading">같은 답이어도,<br>같은 근거는 아닙니다.</h2><p>실제 실험 모듈이 계산한 여섯 결과를 재생합니다. 아래 선택은 운영 엔진 호출이나 실제 학생 기록 변경이 아닙니다.</p>
  <label for="scenario">상황 선택</label><select id="scenario">${results.scenarios.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.title)}</option>`).join('')}</select>
  <div class="case-actions"><button id="previous" type="button">이전 상황</button><span id="case-count" class="mono"></span><button id="next" type="button">다음 상황 →</button></div>
  <div id="case-result" aria-live="polite"><h3 id="case-title"></h3><p id="case-explain"></p><div class="result-cells" id="result-cells"></div><div class="decision"><strong id="decision-title"></strong><span id="decision-reason"></span></div></div>
  <div class="contract"><div><small>계약이 요구한 원음</small><strong id="contract-source"></strong></div><div><small>요구한 확인 범위</small><strong id="contract-range"></strong></div><div><small>실제로 제출된 결과</small><strong id="receipt-source"></strong></div></div>
  <p class="note">후보·단어 시각·도움 조건은 수동 시험 입력입니다. 짧은 구간 수치는 실제 단어 정렬이나 청취 정확성을 증명하지 않습니다. 아래 음성은 기존에 만든 합성 원음 전체입니다.</p><audio controls preload="none" aria-label="기존 합성 원음 전체" src="${dataUri(results.audio.filename, 'audio/wav')}"></audio>
  <details><summary>계약과 실제 결과 데이터 보기</summary><pre id="contract-json"></pre></details></section>
  <article class="report">${report}</article><section class="files"><h2>상담·구현 근거</h2><a href="${NAME}.pdf">인쇄본 PDF</a>${['REPORT.md', 'A_CORE.md', 'B_ALTERNATIVE.md', 'REQUIREMENTS.md', 'FACT_GATE.md', 'lab/DESIGN.md', 'lab/ADVERSARIAL_REVIEW.md', 'lab/RESULTS.json', 'lab/VERIFICATION.json'].map(file => `<a href="자료/${file}">${esc(file)}</a>`).join('')}</section></main></div>
  <footer class="foot"><strong>SYNK · 출원 상담용</strong><span>실행 근거와 등록 판단을 구분합니다.</span></footer>
  <script id="experiment-data" type="application/json">${JSON.stringify(results).replace(/</g, '\\u003c')}</script><script>${fs.readFileSync(path.join(__dirname, 'viewer.js'), 'utf8')}</script></body></html>`;
  const htmlFile = path.join(OUT, NAME + '.html'); fs.writeFileSync(htmlFile, html);
  for (const file of ['REPORT.md', 'A_CORE.md', 'B_ALTERNATIVE.md', 'REQUIREMENTS.md', 'FACT_GATE.md', 'lab/DESIGN.md', 'lab/ADVERSARIAL_REVIEW.md', 'lab/RESULTS.json', 'lab/VERIFICATION.json']) {
    const to = path.join(OUT, '자료', file); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(__dirname, file), to);
  }
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { if (/^https?:/.test(route.request().url())) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
    await page.goto(pathToFileURL(htmlFile).href); await page.evaluate(() => document.fonts.ready);
    const fontsLoaded = await page.evaluate(() => ['SUIT Variable', 'Inter Tight', 'DM Mono'].every(f => document.fonts.check(`500 16px "${f}"`)));
    await page.screenshot({ path: path.join(QA, 'desktop.png') });
    const scenariosSeen = [];
    for (let i = 0; i < results.scenarios.length; i++) {
      await page.selectOption('#scenario', String(i));
      if (await page.locator('#case-title').textContent() !== results.scenarios[i].title) throw Error('Wrong case title');
      const statuses = await page.locator('.result-cell').evaluateAll(nodes => nodes.map(n => n.dataset.after));
      if (JSON.stringify(statuses) !== JSON.stringify(results.scenarios[i].after.map(c => c.status))) throw Error('Wrong status render');
      scenariosSeen.push(results.scenarios[i].id);
    }
    await page.selectOption('#scenario', '1'); await page.locator('#experiment').screenshot({ path: path.join(QA, 'experiment.png') });
    await page.locator('#next').click(); if (await page.locator('#scenario').inputValue() !== '2') throw Error('Next action failed');
    await page.locator('#previous').click(); if (await page.locator('#scenario').inputValue() !== '1') throw Error('Previous action failed');
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(QA, 'mobile.png') });
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth === innerWidth);
    await page.locator('#experiment').screenshot({ path: path.join(QA, 'mobile-experiment.png') });
    if (!fontsLoaded || !noOverflow || errors.length || external.length) throw Error(JSON.stringify({ fontsLoaded, noOverflow, errors, external }));
    // Paginate actual report blocks; preserve tables and avoid orphan headings.
    const printFile = path.join(OUT, NAME + '_인쇄원본.html');
    const printHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>결합 반론 대응 구성</title><style>${tokens}${fonts}${css}</style></head><body class="printing"><div id="print-source">${report}</div></body></html>`;
    fs.writeFileSync(printFile, printHtml); await page.goto(pathToFileURL(printFile).href); await page.evaluate(() => document.fonts.ready);
    const pageCount = await page.evaluate(() => {
      const source = document.querySelector('#print-source'), blocks = [...source.children]; let number = 0, body, page;
      const make = () => { page = document.createElement('article'); page.className = 'pdf-page'; page.innerHTML = '<div class="print-mast"><b>SYNK / CORE</b><span>결합 반론에 대응할 다음 구성 · 2026.09.13</span></div><div class="page-body"></div><div class="print-foot"><span>출원 상담용 · 등록 우위 미확정 · 합성 실험</span><span class="page-number"></span></div>'; document.body.append(page); body = page.querySelector('.page-body'); number++; };
      const gap = () => page.querySelector('.print-foot').getBoundingClientRect().top - body.getBoundingClientRect().bottom;
      make(); const title = document.createElement('h1'); title.textContent = '결합 반론에 대응할 다음 구성'; body.append(title);
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i], group = [block]; if (/^H[23]$/.test(block.tagName) && blocks[i + 1]) group.push(blocks[++i]);
        group.forEach(n => body.append(n));
        if (gap() < 26) { group.forEach(n => n.remove()); make(); group.forEach(n => body.append(n)); if (gap() < 26) throw Error('Print block overflows: ' + block.textContent.slice(0, 45)); }
      }
      source.remove(); document.querySelectorAll('.pdf-page').forEach((p, i) => p.querySelector('.page-number').textContent = `${i + 1} / ${number}`); return number;
    });
    const gaps = await page.evaluate(() => [...document.querySelectorAll('.pdf-page')].map(p => p.querySelector('.print-foot').getBoundingClientRect().top - p.querySelector('.page-body').getBoundingClientRect().bottom));
    if (gaps.some(g => g < 26)) throw Error('PDF footer collision');
    fs.writeFileSync(printFile, '<!doctype html>\n' + await page.evaluate(() => document.documentElement.outerHTML));
    await page.pdf({ path: path.join(OUT, NAME + '.pdf'), preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(path.join(QA, 'verification.json'), JSON.stringify({ generatedAt: new Date().toISOString(), fontsLoaded, noOverflow, scenariosSeen, externalRequests: external.length, pageCount, gaps, errors, sourceHashes: { report: hash(path.join(__dirname, 'REPORT.md')), results: hash(path.join(__dirname, 'lab/RESULTS.json')) } }, null, 2));
    console.log(JSON.stringify({ html: htmlFile, pdf: path.join(OUT, NAME + '.pdf'), pageCount, scenariosSeen: scenariosSeen.length, fontsLoaded, noOverflow }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
