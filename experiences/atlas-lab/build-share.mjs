// One-file share version of the Atlas lab (for a private share page). Reads the real lab, engine bundle,
// consultation rules and content specs from this repository and inlines fonts and felt slabs, so the
// page runs the same engine code with nothing stored or sent. Usage: node experiences/atlas-lab/build-share.mjs out.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const W = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('Usage: node experiences/atlas-lab/build-share.mjs out.html');
const read = file => fs.readFileSync(path.join(W, file), 'utf8');
const data = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(W, file)).toString('base64')}`;
const html = read('experiences/atlas-lab/index.html');
let main = html.slice(html.indexOf('<main>'), html.indexOf('</main>') + '</main>'.length);
main = main.replace('<a class="back" href="/learning-hub/">← 맞춤 학습으로</a>', '<span class="back">공유판 · 실제 엔진 코드가 이 페이지 안에서 돌아요</span>')
  .replace('data-model-host="same-origin"', 'data-model-host="disabled"')
  .replace('id="model-privacy" class="model-privacy"', 'id="model-privacy" class="model-privacy" hidden')
  .replace('/learning-hub/assets/sticker-book.webp', data('experiences/learning-hub/assets/sticker-book.webp', 'image/webp'))
  .replace(/<footer id="lab-privacy">.*?<\/footer>/s, '<footer id="lab-privacy">SYNK Atlas · 순간 맞춤 실험실 공유판 · 이 페이지는 아무것도 저장하거나 보내지 않아요.</footer>');
// The share page must never contact a host. If a source attribute changes and one of the
// replacements above silently misses, stop the build instead of shipping a live AI client.
if (!main.includes('data-model-host="disabled"') || main.includes('data-model-host="same-origin"')
  || !main.includes('id="model-privacy" class="model-privacy" hidden') || !main.includes('이 페이지는 아무것도 저장하거나 보내지 않아요.')) throw new Error('share page host isolation was not applied');
let css = read('experiences/atlas-lab/lab.css')
  .replace('url(/learning-hub/assets/SUIT-Variable.woff2)', `url(${data('experiences/learning-hub/assets/SUIT-Variable.woff2', 'font/woff2')})`)
  .replace('url(/learning-hub/assets/InterTight-700.woff2)', `url(${data('experiences/learning-hub/assets/InterTight-700.woff2', 'font/woff2')})`)
  .replace('url(/learning-hub/assets/slab-cream-long.webp)', `url(${data('experiences/learning-hub/assets/slab-cream-long.webp', 'image/webp')})`)
  .replace('url(/learning-hub/assets/slab-blush-long.webp)', `url(${data('experiences/learning-hub/assets/slab-blush-long.webp', 'image/webp')})`);
if (/url\(\/[^d]/.test(css)) throw new Error('an asset path was left outside the page');
const { FLOW_RUSH, LEVEL_WORDS } = await import(pathToFileURL(path.join(W, 'experiences/order-rush/learning.mjs')).href);
const { FLOW_RHYTHM } = await import(pathToFileURL(path.join(W, 'experiences/korean-rhythm/personalization.mjs')).href);
let lab = read('experiences/atlas-lab/lab.js');
const imports = ["import { FLOW_RUSH, LEVEL_WORDS } from '/order-rush/learning.mjs';", "import { FLOW_RHYTHM } from '/korean-rhythm/personalization.mjs';", "import { createComputerConsultation } from './consultation.mjs';", "import { createComputerInterpretation } from './interpretation.mjs';", "import { createComputerModelHost } from './model-host.mjs';", "import { mountMatchingLab } from './matching-ui.mjs';"];
for (const line of imports) { if (!lab.includes(line)) throw new Error('lab.js imports changed: ' + line); lab = lab.replace(line, ''); }
const matchingImport = "import { createMatchingAdapter, MATCHING_SCENARIOS } from './matching.mjs';";
const matchingUI = read('experiences/atlas-lab/matching-ui.mjs');
if (!matchingUI.includes(matchingImport)) throw new Error('matching UI import changed');
const matching = `const mountMatchingLab = (() => {\nconst {createMatchingAdapter, MATCHING_SCENARIOS} = (() => {\n`
  + read('experiences/atlas-lab/matching.mjs').replace(/^export /gm, '')
  + `\nreturn {createMatchingAdapter, MATCHING_SCENARIOS};})();\n`
  + matchingUI.replace(matchingImport, '').replace(/^export /gm, '') + '\nreturn mountMatchingLab;})();\n';
lab = `const FLOW_RUSH = ${JSON.stringify(FLOW_RUSH)};\nconst LEVEL_WORDS = ${JSON.stringify(LEVEL_WORDS)};\nconst FLOW_RHYTHM = ${JSON.stringify(FLOW_RHYTHM)};\n`
  + read('experiences/atlas-lab/consultation.mjs').replace(/^export /gm, '') + '\n'
  + read('experiences/atlas-lab/interpretation.mjs').replace(/^export /gm, '') + '\n'
  + read('experiences/atlas-lab/model-host.mjs').replace(/^export /gm, '') + '\n' + matching + lab;
// New static dependencies must be bundled explicitly; never emit a broken share page.
if (/^\s*(?:import|export)\s/m.test(lab)) throw new Error('share page has an unbundled module dependency');
// '<\\/script' keeps the backslash in the output; '<\/script' is the same string as '</script'.
const script = file => `<script>\n${read(file).replace(/<\/script/gi, '<\\/script')}\n</script>`;
const page = `<title>Atlas 순간 맞춤 실험실</title>\n<style>\n${css}\n</style>\n${main}\n`
  + script('experiences/learning-hub/atlas-learning.js') + '\n'
  + script('docs/마케팅/맞춤도구/computer/content.js') + '\n'
  + script('docs/마케팅/맞춤도구/computer/rules.js') + '\n'
  + script('atlas/domain.js') + '\n' + script('atlas/interpretation.js') + '\n' + script('atlas/temper-outcomes.js') + '\n'
  + `<script type="module">\n${lab.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
fs.writeFileSync(out, page);
console.log('wrote', out, (Buffer.byteLength(page) / 1024 / 1024).toFixed(2), 'MB');
