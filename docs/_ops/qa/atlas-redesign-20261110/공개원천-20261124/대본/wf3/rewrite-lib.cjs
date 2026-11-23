// 공개 빌드의 고쳐 쓰기(tools/build-world-app-public.mjs rewrite())와 그 되돌리기.
// 되돌리기는 공개 파일을 원천 꼴로 돌린다 — 후보 트리(원천)에서 시험 · 리허설을 돌리려는 것이다. 늘 rewrite(unrewrite(x)) === x를 확인하고 쓴다.
const FOLDERS = /(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)/;
function makeRewrite(config) {
  return function rewrite(text, relative) {
    text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', 'href="' + config.account.learningUrl + '"');
    if (relative === 'me2-shop.mjs') text = text.replace("'../play-common/drag-rail.js'", "'./play-common/drag-rail.js'");
    if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
    if (relative === 'world-front-entry.mjs') text = text.replace("from '../seoul-arrival/", "from './seoul-arrival/");
    if (relative === 'world-missed-spot.mjs') text = text.replaceAll("from '../entry-check/", "from './entry-check/");
    text = text.replace(new RegExp(`(["'\`])\\/${FOLDERS.source}(?=[/"'\`])`, 'g'), (_, quote, folder) => quote + config.basePath + folder);
    return text;
  };
}
// originOf(공개 경로) → 그 파일의 원천 경로(빌드 manifest). home 모듈을 가리려고 쓴다.
function makeUnrewrite(config, originOf) {
  const base = config.basePath.replace(/\//g, '\\/');
  return function unrewrite(text, relative) {
    // ① 절대 주소: /world/<폴더> → /<폴더>
    text = text.replace(new RegExp(`(["'\`])${base}${FOLDERS.source}(?=[/"'\`])`, 'g'), (_, quote, folder) => quote + '/' + folder);
    // ② 루트 파일의 ./brand-opening/ → ../brand-opening/ (앞에 점 · 낱자가 붙은 것은 건드리지 않는다)
    if (!relative.includes('/')) text = text.replace(/(?<![.\w/])\.\/brand-opening\//g, '../brand-opening/');
    // ③ 배우기 허브 링크
    text = text.replaceAll('href="' + config.account.learningUrl + '"', 'href="../learning-hub/"');
    // ④ synk-world-home 모듈: 루트 파일의 './x', brand-opening 파일의 '../x' 가운데 원천이 synk-world-home인 것 → '../synk-world-home/x'
    const prefix = relative.startsWith('brand-opening/') ? '\\.\\.\\/' : '\\.\\/';
    text = text.replace(new RegExp(`(["'\`])(?<![.\\w/])${prefix}([A-Za-z0-9_.-]+\\.(?:mjs|js|css|json|webp|png|jpg|svg|woff2|mp3|wav|glb|bin))(?=["'\`?#])`, 'g'), (m, quote, name) => {
      const src = originOf(name);
      return src && src.startsWith('experiences/synk-world-home/') ? quote + '../synk-world-home/' + name : m;
    });
    return text;
  };
}
module.exports = { makeRewrite, makeUnrewrite };
