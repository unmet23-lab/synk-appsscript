/** The local server and static app build use the same connected Maru document. */
export function renderWorldDocument(source, config) {
  const base = config.basePath;
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new TypeError('Invalid WORLD base path');
  const bootstrap = JSON.stringify(config).replaceAll('<', '\\u003c');
  const cover = '<div id="synk-opening-cover" aria-hidden="true" style="position:fixed;inset:0;background:#000;z-index:2147483646"></div>';
  return source
    .replace('<head>', `<head><script type="application/json" id="synk-world-config">${bootstrap}</script><script src="${base}world-bootstrap.js"></script>`)
    .replace(/<script type="module" src="home\.mjs"><\/script>/, '')
    .replace(/((?:src|href)=")assets\//g, `$1${base}brand-opening/assets/`)
    .replace('href="home.css"', `href="${base}brand-opening/home.css"`)
    .replace('href="../korean-runner/"', `href="${base}korean-runner/"`)
    .replace('</head>', `<link rel="stylesheet" href="${base}app-shell.css"><link rel="stylesheet" href="${base}brand-opening/opening.css"><script type="module" src="${base}app-shell.mjs"></script></head>`)
    .replace('<body>', '<body>' + cover);
}
