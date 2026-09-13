'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const BASE = path.resolve(__dirname, '..');
const OUTBASE = 'C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/등록성_보강_20260913';
const OUT = path.join(OUTBASE, '발송검토'), NAME = 'SYNK_CORE_P1_검토요청';
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
async function main() {
  const qa = JSON.parse(read(path.join(OUTBASE, '검수/verification.json')));
  for (const file of ['REPORT.md', 'targeted/CLAIM_DECISIONS.md', 'decision/P1_SUPPORT_REPAIR.md', 'decision/P1_COMBINATION_AUDIT.md']) {
    if (digest(path.join(BASE, file)) !== qa.sourceHashes[file]) throw Error('Rebuild the current report first: ' + file);
  }
  const claimsSource = read(path.join(BASE, 'targeted/CLAIM_DECISIONS.md'));
  const claimMatches = [...claimsSource.matchAll(/^\*\*\[P1-0[1-7]\]\*\*[^\r\n]+/gm)].map(m => m[0]);
  if (claimMatches.length !== 7) throw Error('Expected all seven current P1 paragraphs');
  const cases = JSON.parse(read(path.join(BASE, 'decision/P1_SUPPORT_CASES.json')));
  if (!cases.validation.matchedExpectedStatesAndTransitions) throw Error('P1 examples failed');
  for (const [file, expected] of Object.entries(cases.sources)) {
    if (digest(path.resolve(BASE, 'decision', file)) !== expected) throw Error('P1 execution source changed: ' + file);
  }
  const labels = { accepted: '반영', held: '보류', excluded: '제외', asr: '원음–전사', object: '조사', past: '과거형' };
  const rows = cases.cases.map(c => {
    const columns = ['asr', 'object', 'past'].map(skill => labels[c.cells.find(cell => cell.skill === skill).status]);
    const removed = c.actualImmediateTransition.transitions.filter(t => t.action === 'withdrawn').map(t => labels[t.cellId.split(':').pop()]);
    return `| ${c.id}: ${c.description} | ${columns.join(' | ')} | ${removed.join('·') || '없음'} |`;
  });
  const table = '기존 실행은 최초에 세 기록을 모두 반영한 뒤 A를 만들고, A에서 B·C를 각각 분기했습니다.\n\n| 입력 변화 | 원음–전사 | 조사 | 과거형 | 직전 상태에서 새로 철회 |\n|---|---|---|---|---|\n' + rows.join('\n') + '\n\nB에서 조사 기여는 A에서 이미 철회되었으므로 중복 철회하지 않습니다. 기여 유지 여부와 전체 메타데이터의 동일성은 다릅니다.';
  const markdown = read(path.join(__dirname, 'PACKET.template.md')).replace('{{CLAIMS}}', claimMatches.join('\n\n')).replace('{{CASES}}', table);
  if (/\{\{[A-Z_]+\}\}|file:\/\/|C:\/Users|unmet|010-/.test(markdown)) throw Error('Packet has an unresolved token or internal/private path');
  const currentPrint = read(path.join(OUTBASE, 'SYNK_결합반론_대응구성_인쇄원본.html'));
  const style = currentPrint.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (!style || !style.includes('SUIT Variable')) throw Error('Verified current print style missing');
  const { marked } = await import(pathToFileURL('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js').href);
  const content = marked.parse(markdown);
  const localLinks = [...content.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => !/^https:\/\//.test(h));
  if (localLinks.length) throw Error('Outbound packet contains a local link');
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, '검수'), { recursive: true });
  fs.writeFileSync(path.join(OUT, NAME + '.md'), markdown);
  const htmlFile = path.join(OUT, NAME + '.html');
  fs.writeFileSync(htmlFile, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK CORE 특허 검토 요청</title><style>${style}</style></head><body class="printing"><div id="print-source">${content}</div></body></html>`);
  const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    const network = [], errors = [];
    await page.route('**/*', route => { if (/^https?:/.test(route.request().url())) { network.push(route.request().url()); return route.abort(); } return route.continue(); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(htmlFile).href);
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('500 14px "SUIT Variable"', '한글'),
        document.fonts.load('800 21px "SUIT Variable"', '한글'),
        document.fonts.load('500 14px "Inter Tight"', 'SYNK'),
        document.fonts.load('800 21px "Inter Tight"', 'SYNK'),
        document.fonts.load('500 9px "DM Mono"', '012345'),
        document.fonts.load('500 14px "SYNK Bracket"', '「」')
      ]);
      await document.fonts.ready;
    });
    const pagination = await page.evaluate(() => {
      const source = document.querySelector('#print-source'), blocks = [...source.children]; let body, page;
      const make = () => { page = document.createElement('article'); page.className = 'pdf-page'; page.innerHTML = '<div class="print-mast"><b>SYNK / CORE</b><span>IP디딤돌 상담 · P1 검토 요청 · 2026.09.14</span></div><div class="page-body"></div><div class="print-foot"><span>검토용 문안 · 등록성 미확정 · 합성 입력 실행 근거</span><span class="page-number"></span></div>'; document.body.append(page); body = page.querySelector('.page-body'); };
      const gap = () => page.querySelector('.print-foot').getBoundingClientRect().top - body.getBoundingClientRect().bottom;
      make();
      for (let i = 0; i < blocks.length; i++) {
        const group = [blocks[i]]; if (/^H[123]$/.test(blocks[i].tagName) && blocks[i + 1]) group.push(blocks[++i]);
        group.forEach(n => body.append(n));
        if (gap() < 26) { group.forEach(n => n.remove()); make(); group.forEach(n => body.append(n)); if (gap() < 26) throw Error('Packet block too large'); }
      }
      source.remove(); const pages = [...document.querySelectorAll('.pdf-page')];
      pages.forEach((p, i) => p.querySelector('.page-number').textContent = `${i + 1} / ${pages.length}`);
      return { pageCount: pages.length, gaps: pages.map(p => p.querySelector('.print-foot').getBoundingClientRect().top - p.querySelector('.page-body').getBoundingClientRect().bottom), fontsLoaded: ['SUIT Variable', 'Inter Tight', 'DM Mono'].every(f => document.fonts.check(`500 16px "${f}"`)) };
    });
    if (!pagination.fontsLoaded || network.length || errors.length) throw Error(JSON.stringify({ pagination, network, errors }));
    fs.writeFileSync(htmlFile, '<!doctype html>\n' + await page.evaluate(() => document.documentElement.outerHTML));
    await page.pdf({ path: path.join(OUT, NAME + '.pdf'), preferCSSPageSize: true, printBackground: true });
    for (let i = 0; i < pagination.pageCount; i++) await page.locator('.pdf-page').nth(i).screenshot({ path: path.join(OUT, '검수', `browser-page-${i + 1}.png`) });
    fs.copyFileSync(path.join(__dirname, 'EMAIL.txt'), path.join(OUT, '메일_발송전_검토.txt'));
    const record = { generatedAt: new Date().toISOString(), ...pagination, networkRequests: network, errors, exactCurrentClaimParagraphs: 7, localLinks: 0, noExternalMessageSent: true,
      sources: Object.fromEntries(['targeted/CLAIM_DECISIONS.md', 'decision/P1_SUPPORT_REPAIR.md', 'decision/P1_COMBINATION_AUDIT.md', 'decision/P1_SUPPORT_CASES.json', 'lab/RESULTS.json', 'review-request/PACKET.template.md', 'review-request/EMAIL.txt'].map(f => [f, digest(path.join(BASE, f))])),
      files: Object.fromEntries([NAME + '.pdf', NAME + '.md', NAME + '.html', '메일_발송전_검토.txt'].map(f => [f, { bytes: fs.statSync(path.join(OUT, f)).size, sha256: digest(path.join(OUT, f)) }])) };
    fs.writeFileSync(path.join(OUT, '검수/verification.json'), JSON.stringify(record, null, 2));
    console.log(JSON.stringify({ pdf: path.join(OUT, NAME + '.pdf'), pages: pagination.pageCount, claimParagraphs: 7, externalRequests: network.length, sent: false }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
