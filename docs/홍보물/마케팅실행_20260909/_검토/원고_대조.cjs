// 이번 공개용 로컬 패키지만 읽는 일회성 독립 QA. 게시/계정/외부 모델 호출 없음.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const review = __dirname;
const bundle = path.dirname(review);
const repo = path.resolve(bundle, '../../..');
const oldPath = path.join(repo, 'docs/홍보물/계정별콘텐츠_20260909/콘텐츠원고.json');
const newPath = path.join(bundle, '원고/콘텐츠원고.json');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const oldDoc = readJson(oldPath);
const newDoc = readJson(newPath);
const leaves = (value, at = '', result = []) => {
  if (typeof value === 'string') result.push({ path: at, text: value });
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) leaves(child, `${at}/${key}`, result);
  return result;
};
const oldMn = leaves(oldDoc).filter(x => /[\u0400-\u04ff]/.test(x.text));
const newMn = leaves(newDoc.items).filter(x => /[\u0400-\u04ff]/.test(x.text));
const preservedDifferences = [];
const preservedSceneTextDifferences = [];
const sceneText = scenes => (scenes || []).map(scene => Object.fromEntries(
  ['title', 'subtitle', 'eyebrow', 'body', 'text', 'kr', 'mn', 'lines', 'narration', 'caption']
    .filter(key => scene[key] !== undefined).map(key => [key, scene[key]])
));
for (const id of newDoc.evidence.copyPreservedIds) {
  const a = oldDoc.items.find(x => x.id === id);
  const b = newDoc.items.find(x => x.id === id);
  for (const key of ['title', 'subtitle', 'caption', 'alt', 'cards']) {
    if (JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key])) preservedDifferences.push({ id, key });
  }
  if (JSON.stringify(sceneText(a?.scenes)) !== JSON.stringify(sceneText(b?.scenes))) preservedSceneTextDifferences.push({id});
}
const materials = readJson(path.join(bundle, '제공자료/제공자료.json')).materials;
const materialIds = new Set(materials.map(item => item.id));
const resourceRefs = leaves(newDoc).filter(item => /\/resourceIds\/\d+$/.test(item.path));
const files = [];
const visit = dir => {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) visit(full);
    else if (/\.(md|json)$/i.test(item.name)) files.push(full);
  }
};
visit(path.join(bundle, '제공자료'));
visit(path.join(bundle, '원고'));
const localLinks = [];
for (const file of files.filter(p => p.endsWith('.md'))) {
  const body = fs.readFileSync(file, 'utf8');
  for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0].replace(/^<|>$/g, '')));
    localLinks.push({ source: path.relative(bundle, file), href, exists: fs.existsSync(target) });
  }
}
const out = {
  checkedAt: new Date().toISOString(),
  purpose: '문안 보존·계정 분모·로컬 링크 대조. 플랫폼 게시/사람 언어 감수/픽셀/교육 효과 검증과 별개.',
  sourceSha256: hash(oldPath),
  manuscriptSha256: hash(newPath),
  counts: {
    items: newDoc.items.length,
    uniqueIds: new Set(newDoc.items.map(x => x.id)).size,
    uniqueUploadOrders: new Set(newDoc.items.map(x => x.uploadOrder)).size,
    oldCyrillicLeaves: oldMn.length,
    currentCyrillicLeaves: newMn.length,
    lectures: newDoc.lectures?.length ?? null,
    extras: newDoc.extras?.length ?? null
  },
  preservedDifferences,
  preservedSceneTextDifferences,
  resources: {
    references: resourceRefs.length,
    unknownIds: resourceRefs.filter(item => !materialIds.has(item.text)),
    missingSourceFiles: materials.filter(item => !fs.existsSync(path.join(bundle, '제공자료', item.sourceFile))).map(item => ({id: item.id, sourceFile: item.sourceFile}))
  },
  newCyrillicNotContainedInOld: newMn.filter(x => !oldMn.some(y => y.text.includes(x.text))),
  recordedAccountDifferences: newDoc.items.slice(0, 16).flatMap(x => {
    const old = oldDoc.items.find(y => y.id === x.id);
    return ['account', 'platform', 'status', 'format'].filter(k => old?.[k] !== x[k]).map(k => ({ id: x.id, key: k, old: old?.[k], current: x[k] }));
  }),
  captionLengths: newDoc.items.map(x => ({ id: x.id, characters: [...x.caption].length })),
  localLinks,
  missingLocalLinks: localLinks.filter(x => !x.exists),
  fileHashes: files.map(p => ({ path: path.relative(bundle, p), sha256: hash(p) }))
};
fs.writeFileSync(path.join(review, '원고_대조.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ manuscriptSha256: out.manuscriptSha256, counts: out.counts, preservedDifferences: out.preservedDifferences, preservedSceneTextDifferences, resources: out.resources, newCyrillic: out.newCyrillicNotContainedInOld.length, accountDifferences: out.recordedAccountDifferences, missingLocalLinks: out.missingLocalLinks }, null, 2));
