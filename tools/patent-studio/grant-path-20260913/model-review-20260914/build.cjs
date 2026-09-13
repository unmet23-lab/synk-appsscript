'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const BASE = path.resolve(__dirname, '..'), ROOT = path.resolve(BASE, '../../..');
const ASSETS = path.resolve(BASE, '../public/assets');
const OUTBASE = 'C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const OUT = path.join(OUTBASE, 'AI_교차검수_20260914'), NAME = 'SYNK_특허_교차검수_종합자료';
const read = f => fs.readFileSync(f, 'utf8');
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const uri = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
const sources = [
  ['S01', 'targeted/CLAIM_DECISIONS.md', 'P1·P2 문안 전문'],
  ['S02', '../core.cjs', '현재 판정 구현 발췌'],
  ['S03', '../projection.cjs', '결과 재사용·기여 전이'],
  ['S04', '../temporal-evidence.cjs', '발화·도움 시간관계'],
  ['S05', 'decision/P1_SUPPORT_CASES.json', 'P1 합성 실행 입력·출력'],
  ['S06', 'targeted/ACTION_INTEGRATION.md', '09.13 생산자·소비자 연결 검토'],
  ['S07', 'decision/P1_SUPPORT_REPAIR.md', 'P1 사유·독립 확인값·실시예'],
  ['S08', 'decision/P1_COMBINATION_AUDIT.md', 'P1 일곱 구성과 선행 대조'],
  ['S09', 'lab/RESULTS.json', '복수 후보·계약 실행'],
  ['S10', 'lab/VERIFICATION.json', '22개 시험·9쌍 비교의 저장 결과'],
  ['S11', 'lab/observation-contract.cjs', '현재 P2 로컬 어댑터'],
  ['S12', 'decision/PURPOSE_SENSITIVITY.json', '목적 변경의 실제 비교'],
  ['S13', 'targeted/AUDIO_PROBE.json', '별도 합성 음성의 로컬 측정'],
  ['S14', 'decision/P3_PRIOR_ART.md', 'P3 근접 연구'],
  ['S15', 'decision/LOOM_COMPARISON.md', 'LOOM 식·입력·결과 경계'],
  ['S16', 'decision/loom-comparison-20260913/RESULTS.json', 'LOOM 재합성 미실행·보존 확인'],
  ['S17', 'decision/OBSERVATION_SCOPE_PRIOR_ART.md', '수신 완결 조건의 선행'],
  ['S18', 'decision/OBSERVATION_SCOPE_INTEGRATION.md', '수신 완결 생산자 연결 가설'],
  ['S19', 'REQUIREMENTS.md', '09.13 공식 요건 조사 기록'],
  ['S20', 'model-review-20260914/CACHE_PROBE.json', '09.14 한 합성 입력의 캐시 대조'],
  ['S21', '../store.cjs', '발생 시각 기본값·서버 저장 시각의 경계'],
];
function functionExcerpt(relative, name) {
  const lines = read(path.resolve(BASE, relative)).split(/\r?\n/);
  const start = lines.findIndex(l => l.startsWith(`function ${name}(`));
  if (start < 0) throw Error('Function missing: ' + name);
  let end = start + 1;
  while (end < lines.length && lines[end] !== '}') end++;
  if (end === lines.length) throw Error('Function end missing: ' + name);
  const out = [];
  for (let at = start; at <= end; at += 12) {
    const to = Math.min(at + 11, end);
    out.push(`**${relative.replace('../', 'tools/patent-studio/')} · ${name} · ${at + 1}~${to + 1}행**\n\n\`\`\`javascript\n${lines.slice(at, to + 1).join('\n')}\n\`\`\``);
  }
  return out.join('\n\n');
}
async function main() {
  const savedQA = JSON.parse(read(path.join(OUTBASE, '등록성_보강_20260913/검수/verification.json')));
  for (const [, relative] of sources) {
    if (savedQA.sourceHashes[relative] && hash(path.resolve(BASE, relative)) !== savedQA.sourceHashes[relative]) throw Error('Previously reviewed evidence changed: ' + relative);
  }
  const cases = JSON.parse(read(path.join(BASE, 'decision/P1_SUPPORT_CASES.json')));
  if (!cases.validation.matchedExpectedStatesAndTransitions) throw Error('P1 examples failed');
  for (const [relative, expected] of Object.entries(cases.sources)) {
    if (hash(path.resolve(BASE, 'decision', relative)) !== expected) throw Error('P1 execution source changed: ' + relative);
  }
  for (const [filename, from] of [['lab/RESULTS.json', 'lab'], ['decision/PURPOSE_SENSITIVITY.json', 'decision']]) {
    for (const [relative, expected] of Object.entries(JSON.parse(read(path.join(BASE, filename))).sources)) {
      if (hash(path.resolve(BASE, from, relative)) !== expected) throw Error('Experiment source changed: ' + relative);
    }
  }
  const probe = JSON.parse(read(path.join(__dirname, 'CACHE_PROBE.json')));
  for (const [relative, expected] of Object.entries(probe.sources)) if (hash(path.resolve(BASE, relative)) !== expected) throw Error('Probe source changed: ' + relative);
  if (!probe.cellResultsMatchFull || !probe.asrInvalidations.length) throw Error('Probe unsuccessful');
  const manifest = JSON.parse(read(path.join(ASSETS, 'manifest.json')));
  const selected = ['suit.woff2', 'inter-tight.ttf', 'inter-tight-bold.ttf', 'dm-mono.ttf', 'bracket.ttf', 'tokens.css'];
  for (const name of selected) {
    const row = manifest.manifest.find(a => a.name === name);
    if (!row || hash(path.join(ASSETS, name)) !== row.sha256 || hash(path.join(ROOT, row.source)) !== (row.sourceSha256 || row.sha256)) throw Error('Design source changed: ' + name);
  }
  const text = read(path.join(BASE, 'targeted/CLAIM_DECISIONS.md'));
  const claims = prefix => [...text.matchAll(new RegExp(`^\\*\\*\\[${prefix}-0[1-7]\\]\\*\\*[^\\r\\n]+`, 'gm'))].map(m => m[0]);
  const p1 = claims('P1'), p2 = claims('P2');
  if (p1.length !== 7 || p2.length !== 6) throw Error('Claim counts changed');
  const label = { accepted: '반영', held: '보류', excluded: '제외', asr: '원음–전사', object: '조사', past: '과거형' };
  const rows = cases.cases.map(c => `| ${c.id}: ${c.description} | ${['asr', 'object', 'past'].map(s => label[c.cells.find(x => x.skill === s).status]).join(' | ')} | ${c.actualImmediateTransition.transitions.filter(x => x.action === 'withdrawn').map(x => label[x.cellId.split(':').pop()]).join('·') || '없음'} |`);
  const caseTable = '세 기록이 모두 반영된 상태에서 A를 만든 뒤, A에서 B·C를 각각 분기했다.\n\n| 입력 변화 | 원음–전사 | 조사 | 과거형 | 직전 상태에서 새로 철회 |\n|---|---|---|---|---|\n' + rows.join('\n') + '\n\nB의 조사 기여는 A에서 이미 철회했으므로 다시 차감하지 않는다. C도 A에서 분기하며 B 이후의 사건이 아니다.';
  const probeText = `기존 E01의 A 입력을 다시 사용한 제한된 실행에서, 캐시를 쓴 결과와 전체 재계산의 판정 셀이 같았다(**cellResultsMatchFull=true**). 전이는 ${probe.transitions.map(t => `${label[t.cell.split(':').pop()]} ${t.action === 'retained' ? '유지' : '철회'}`).join('·')}였다. 원음–전사 결과는 유지되지만 캐시 입력의 시간정보가 달라 원음–전사 관련 ${probe.asrInvalidations.length}개 내부 평가 키가 재계산 대상이었다. 따라서 기여 유지가 곧 계산 생략은 아니다. 실행 기록: ${probe.generatedAt}, Node ${probe.runtime}.`;
  const snippets = [['../core.cjs', 'parseControlled'], ['../core.cjs', 'collectBlockers'], ['../core.cjs', 'effectsFor'], ['../core.cjs', 'makeCell'], ['../temporal-evidence.cjs', 'classifyHelpTime'], ['../projection.cjs', 'actionFor'], ['../projection.cjs', 'createResolver']].map(([f, n]) => functionExcerpt(f, n)).join('\n\n');
  const sourceTable = sources.map(([id, relative, scope]) => `**${id} / ${scope}**\n\n원천: \`${relative.startsWith('../') ? relative.replace('../', 'tools/patent-studio/') : 'tools/patent-studio/grant-path-20260913/' + relative}\`\n\nSHA-256: \`${hash(path.resolve(BASE, relative))}\``).join('\n\n');
  const replacements = { P1_CLAIMS: p1.join('\n\n'), P2_CLAIMS: p2.join('\n\n'), P1_CASES: caseTable, CACHE_PROBE: probeText, CODE_EXCERPTS: snippets, SOURCE_TABLE: sourceTable };
  let md = read(path.join(__dirname, 'PACKET.template.md')).replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => { if (!(key in replacements)) throw Error('Unknown placeholder: ' + key); return replacements[key]; });
  if (/\{\{[A-Z0-9_]+\}\}|file:\/\/|C:[\\/]Users|unmet|tw23|010-|공개\s*이력/.test(md)) throw Error('Unresolved or out-of-scope content');
  const { marked } = await import(pathToFileURL('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js').href);
  const htmlBody = marked.parse(md);
  if (/<del[ >]/.test(htmlBody)) throw Error('Unexpected strikethrough in review packet');
  const localLinks = [...htmlBody.matchAll(/href="([^"]+)"/g)].filter(m => !/^https:\/\//.test(m[1]));
  if (localLinks.length) throw Error('Internal links in outbound document');
  const fonts = [['SUIT Variable', 'suit.woff2', '100 900', ''], ['Inter Tight', 'inter-tight.ttf', '500', ''], ['Inter Tight', 'inter-tight-bold.ttf', '700 900', ''], ['DM Mono', 'dm-mono.ttf', '500', ''], ['SYNK Bracket', 'bracket.ttf', '100 900', 'unicode-range:U+300C-300D;']].map(([family, file, weight, extra]) => `@font-face{font-family:'${family}';src:url('${uri(path.join(ASSETS, file), file.endsWith('woff2') ? 'font/woff2' : 'font/ttf')}');font-weight:${weight};font-display:block;${extra}}`).join('');
  const css = read(path.join(ASSETS, 'tokens.css')) + fonts + read(path.join(__dirname, 'style.css'));
  fs.mkdirSync(path.join(OUT, '검수'), { recursive: true });
  fs.writeFileSync(path.join(OUT, NAME + '.md'), md);
  const htmlFile = path.join(OUT, NAME + '.html');
  fs.writeFileSync(htmlFile, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${NAME.replaceAll('_',' ')}</title><style>${css}</style></head><body><div id="source">${htmlBody}</div></body></html>`);
  const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
    const network = [], errors = [];
    await page.route('**/*', route => { if (/^https?:/.test(route.request().url())) { network.push(route.request().url()); return route.abort(); } return route.continue(); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(htmlFile).href);
    await page.evaluate(async () => { await Promise.all(['500 14px "SUIT Variable"','800 30px "SUIT Variable"','500 14px "Inter Tight"','800 30px "Inter Tight"','500 10px "DM Mono"','500 14px "SYNK Bracket"'].map(f => document.fonts.load(f, '한글 SYNK 0123 「」'))); await document.fonts.ready; });
    const layout = await page.evaluate(() => {
      const source = document.querySelector('#source');
      [...source.querySelectorAll('table')].forEach((table,i)=>table.dataset.sourceTable=String(i));
      const expectedText = source.textContent.replace(/\s+/g, '');
      const blocks = [...source.children]; let paper, body; let section = '검토 목적과 사용법';
      const newPage = () => {
        paper = document.createElement('article'); paper.className = 'page';
        paper.innerHTML = '<header><b>SYNK / CORE</b><span>특허 교차검수 · 2026.09.14</span></header><main></main><footer><span>검토 자료 · 등록성 미확정</span><span class="number"></span></footer>';
        document.body.append(paper); body = paper.querySelector('main');
      };
      const fits = () => body.getBoundingClientRect().bottom + 22 <= paper.querySelector('footer').getBoundingClientRect().top;
      const add = node => {
        body.append(node);
        if (fits()) return;
        node.remove();
        if (node.tagName === 'TABLE') {
          let table = node.cloneNode(false), tbody = document.createElement('tbody');
          if (node.tHead) table.append(node.tHead.cloneNode(true));
          table.append(tbody); body.append(table);
          for (const row of [...node.querySelectorAll('tbody>tr')]) {
            tbody.append(row);
            if (!fits()) {
              row.remove(); if (!tbody.children.length) table.remove();
              newPage(); table = node.cloneNode(false); tbody = document.createElement('tbody');
              if (node.tHead) table.append(node.tHead.cloneNode(true));
              table.append(tbody); body.append(table); tbody.append(row);
              if (!fits()) throw Error('Oversized table row');
            }
          }
          return;
        }
        if (node.tagName === 'OL' || node.tagName === 'UL') {
          let list = node.cloneNode(false); body.append(list); let count = Number(node.start || 1);
          for (const item of [...node.children]) {
            list.append(item);
            if (!fits()) {
              item.remove(); if (!list.children.length) list.remove(); newPage();
              list = node.cloneNode(false); if (node.tagName === 'OL') list.start = count;
              body.append(list); list.append(item); if (!fits()) throw Error('Oversized list item');
            }
            count++;
          }
          return;
        }
        newPage(); body.append(node); if (!fits()) throw Error('Oversized block: ' + node.tagName + ' ' + node.textContent.slice(0,70));
      };
      newPage();
      for (let i=0; i<blocks.length; i++) {
        const node = blocks[i];
        const standaloneLabel = node.tagName === 'P' && node.children.length === 1 && node.firstElementChild.tagName === 'STRONG' && node.textContent === node.firstElementChild.textContent;
        if ((/^H[123]$/.test(node.tagName) || standaloneLabel) && blocks[i+1]) {
          const count = standaloneLabel && /^S\d{2} \//.test(node.textContent) ? 3 : 2;
          const group = blocks.slice(i, i+count); body.append(...group);
          const ok = fits(); group.forEach(n=>n.remove());
          if (!ok && body.children.length) newPage();
          group.forEach(add); i += group.length-1; if (node.tagName === 'H2') section = node.textContent;
        } else add(node);
      }
      source.remove();
      const pages = [...document.querySelectorAll('.page')];
      pages.forEach((p,i) => p.querySelector('.number').textContent = `${String(i+1).padStart(2,'0')} / ${pages.length}`);
      // Repeated table headers are intentionally excluded from comparison.
      const seenTables = new Set();
      const actualText = pages.map(p => {
        const copy = p.querySelector('main').cloneNode(true);
        for (const table of copy.querySelectorAll('table')) {
          if (seenTables.has(table.dataset.sourceTable)) table.tHead?.remove();
          else seenTables.add(table.dataset.sourceTable);
        }
        return copy.textContent;
      }).join('').replace(/\s+/g,'');
      const texts = pages.map(p => p.querySelector('main').innerText);
      return { pages: pages.length, gaps: pages.map(p => p.querySelector('footer').getBoundingClientRect().top-p.querySelector('main').getBoundingClientRect().bottom), textLengths: texts.map(t=>t.length),
        fontsLoaded: ['SUIT Variable','Inter Tight','DM Mono'].every(f=>document.fonts.check(`500 14px "${f}"`)),
        horizontalOverflow: pages.some(p=>p.querySelector('main').scrollWidth>p.querySelector('main').clientWidth+1),
        sourceTextLength: expectedText.length, renderedTextLength: actualText.length, allSourceTextPreserved: expectedText === actualText,
        sections: [...document.querySelectorAll('h2')].map(h=>({title:h.textContent,page:pages.indexOf(h.closest('.page'))+1})) };
    });
    if (!layout.fontsLoaded || !layout.allSourceTextPreserved || layout.horizontalOverflow || errors.length || network.length || layout.gaps.some(g=>g<21)) throw Error(JSON.stringify({layout,errors,network}));
    fs.writeFileSync(htmlFile, '<!doctype html>\n'+await page.evaluate(()=>document.documentElement.outerHTML));
    await page.pdf({ path: path.join(OUT, NAME+'.pdf'), preferCSSPageSize: true, printBackground: true });
    for (let i=0; i<layout.pages; i++) await page.locator('.page').nth(i).screenshot({ path:path.join(OUT,'검수',`browser-page-${i+1}.png`) });
    const record = {generatedAt:new Date().toISOString(),...layout,errors,networkRequests:network,
      currentClaimParagraphs:{P1:p1.length,P2:p2.length},questions:18,externalMessagesSent:false,
      sources:Object.fromEntries(sources.map(([,f])=>[f,hash(path.resolve(BASE,f))])),
      authoringSources:Object.fromEntries(['PACKET.template.md','build.cjs','style.css','probe.cjs'].map(f=>[f,hash(path.join(__dirname,f))])),
      assets:Object.fromEntries(selected.map(f=>[f,hash(path.join(ASSETS,f))])),
      files:Object.fromEntries(['md','html','pdf'].map(ext=>[NAME+'.'+ext,{bytes:fs.statSync(path.join(OUT,NAME+'.'+ext)).size,sha256:hash(path.join(OUT,NAME+'.'+ext))}]))};
    fs.writeFileSync(path.join(OUT,'검수/verification.json'),JSON.stringify(record,null,2));
    console.log(JSON.stringify({output:OUT,pages:layout.pages,sections:layout.sections,mdCharacters:md.length}));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
