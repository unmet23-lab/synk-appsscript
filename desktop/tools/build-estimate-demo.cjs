'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const brand = require('../../tools/lib/브랜드폰트.js');

const root = path.resolve(__dirname, '../..');
const screen = path.join(root, 'desktop/renderer/estimate');
const read = filename => fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
const scriptHash = script => "'sha256-" + createHash('sha256').update(script).digest('base64') + "'";

// The markup flag is present only in a deliberately built sample. A broken PC preload must never show sample mail.
function demoScript() {
  const repeat = read(path.join(root, 'desktop/src/estimate-repeat.cjs'));
  const domain = read(path.join(root, 'desktop/src/estimate-domain.cjs'));
  const adapter = read(path.join(root, 'desktop/tools/estimate-demo.cjs'));
  return [
    "'use strict';",
    "if (!window.solioEstimate && document.documentElement.hasAttribute('data-solio-example')) {",
    '  const repeat = (() => { const module = { exports: {} };', repeat, 'return module.exports; })();',
    '  const rules = ((require) => { const module = { exports: {} };', domain,
    "    return module.exports; })(name => { if (name === './estimate-repeat.cjs') return repeat; throw Error('Unknown module'); });",
    '  const examples = ((require) => { const module = { exports: {} };', adapter,
    "    return module.exports; })(name => { if (name === '../src/estimate-domain.cjs') return rules; throw Error('Unknown module'); });",
    '  window.solioEstimateDemo = examples.createDemo();',
    '}', '',
  ].join('\n');
}

function build(filename) {
  const browserDemo = demoScript();
  const loader = path.join(screen, 'estimate-demo.js');
  // The native window never loads sample data. Its renderer and the standalone version share the same UI.
  const nativeLoader = "'use strict';\n// The standalone example builder inserts its synthetic mailbox adapter here.\n";
  if (!fs.existsSync(loader) || read(loader) !== nativeLoader) fs.writeFileSync(loader, nativeLoader);
  const ui = read(path.join(screen, 'estimate-ui.js'));
  const css = read(path.join(screen, 'estimate.css')).replace(/@font-face\s*\{[^}]+\}/, '')
    .replace(/(['"])SUIT\1/g, "'SUIT Variable'");
  const head = ['<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src ',
    scriptHash(browserDemo), ' ', scriptHash(ui), "; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'", '">'].join('');
  let html = read(path.join(screen, 'index.html')).replace(/<html\b/, '<html data-solio-example')
    .replace(/<link\b[^>]*href="estimate\.css"[^>]*>/, () => head + brand.블록() + '<style>' + css + '</style>')
    .replace(/\s*<script\b[^>]*src="estimate-(?:demo|ui)\.js"[^>]*><\/script>/g, '');
  html = html.replace('</body>', () => '<script>' + browserDemo + '</script><script>' + ui + '</script>\n</body>');
  fs.mkdirSync(path.dirname(filename), {recursive: true});
  fs.writeFileSync(filename, html);
}

if (require.main === module) {
  const filename = process.argv[2] || path.join(root, '.tmp', 'solio-estimate', '견적비서.html');
  build(path.resolve(filename));
  console.log(path.resolve(filename));
}
module.exports = { build, demoScript };
