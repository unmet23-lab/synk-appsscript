#!/usr/bin/env node
// 검수 입력 파일 준비·바이트 대조만 한다. 모델·검수기·시험·배포를 실행하지 않는다.
// node tools/검수입력준비.mjs 준비 --저장소 <작업본> --배경 <짧은 글> --상세 <원문...> --출력 <새 .tmp 폴더>
// 반환한 reviewOptions를 기존 검수묶음.mjs 준비의 --배경·--곁에 쓴다(--끝 없이 작업본).
// baselineOptions는 같은 자료를 배경에 합친 비교용 입력이다. 실제 검수에는 reviewOptions를 쓴다.
// node tools/검수입력준비.mjs 대조 --입력 <입력.json> --전 <새 비교 묶음> --후 <새 분리 묶음>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const lf = b => b.toString('utf8').replace(/\r\n/g, '\n');
const slash = p => p.split(path.sep).join('/');
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  return v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
}
function fail(message) { throw new Error(message); }
function noLinks(file) {
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) fail(`연결 경로는 쓰지 않는다: ${p}`);
    if (p === path.dirname(p)) break;
  }
  return path.resolve(file);
}
function inside(root, file) {
  const p = path.resolve(file), rel = path.relative(root, p);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) fail(`폴더 밖 경로: ${p}`);
  noLinks(p);
  return { absolute: p, relative: slash(rel) };
}
function relativeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || relative.split('/').some(x => !x || x === '.' || x === '..') || path.isAbsolute(relative)) fail('안전한 상대 파일 경로가 필요하다');
  return inside(root, path.join(root, relative)).absolute;
}
function textFile(file) {
  const p = noLinks(file);
  if (!fs.statSync(p).isFile()) fail(`파일이 아니다: ${p}`);
  const b = fs.readFileSync(p);
  if (b.includes(0) || !Buffer.from(b.toString('utf8')).equals(b)) fail(`UTF-8 글 파일이 아니다: ${p}`);
  return b;
}
function metadata(relative, b) { return { path: relative, bytes: b.length, sha256: sha(b), lfSha256: sha(lf(b)) }; }
function combined(background, details) {
  return Buffer.concat([background, ...details.flatMap(b => [Buffer.from('\n\n'), b])]);
}

export function prepareReviewInput({ repository = process.cwd(), background, details = [], output }) {
  if (!background || !output || !Array.isArray(details) || !details.length) fail('--배경·--상세·--출력이 필요하다');
  const root = fs.realpathSync(noLinks(repository));
  const destination = inside(root, path.resolve(root, output));
  if (!destination.relative.startsWith('.tmp/')) fail('출력은 저장소 안의 새 .tmp 하위 폴더여야 한다');
  if (fs.existsSync(destination.absolute)) fail('출력 폴더가 이미 있다 — 새 경로를 준다');
  const inputs = [background, ...details].map(p => path.resolve(root, p));
  const keys = inputs.map(p => process.platform === 'win32' ? p.toLowerCase() : p);
  if (new Set(keys).size !== keys.length) fail('같은 입력 경로를 두 번 지정할 수 없다');
  const buffers = inputs.map(textFile);
  if (buffers.some(b => !b.toString('utf8').trim())) fail('빈 배경·상세 파일은 사용할 수 없다');
  const bgName = `${destination.relative}/배경.md`;
  const detailRows = buffers.slice(1).map((b, i) => metadata(`${destination.relative}/상세-${String(i + 1).padStart(2, '0')}.md`, b));
  const baseline = combined(buffers[0], buffers.slice(1));
  const manifest = {
    version: 1, purpose: 'review-input-preparation-only', repository: root,
    background: metadata(bgName, buffers[0]), details: detailRows,
    baseline: metadata(`${destination.relative}/비교용-합친배경.md`, baseline),
    reviewOptions: { background: path.join(root, bgName), companions: detailRows.map(x => x.path) },
    baselineOptions: { background: path.join(root, destination.relative, '비교용-합친배경.md'), companions: [] },
    sourceFiles: inputs.map((p, i) => ({ path: p, sha256: sha(buffers[i]), bytes: buffers[i].length })),
  };
  fs.mkdirSync(path.dirname(destination.absolute), { recursive: true });
  noLinks(destination.absolute);
  fs.mkdirSync(destination.absolute); // 이미 있는 폴더는 여기서도 거절한다.
  const write = (relative, data) => fs.writeFileSync(relativeFile(root, relative), data, { flag: 'wx' });
  write(bgName, buffers[0]);
  detailRows.forEach((row, i) => write(row.path, buffers[i + 1]));
  write(manifest.baseline.path, baseline);
  const manifestPath = path.join(destination.absolute, '입력.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { manifestPath, ...manifest, notice: '입력만 준비했다. 기존 검수묶음 준비에 reviewOptions의 배경·곁 경로를 전달한다. 모델 검수·통과 판정은 하지 않았다.' };
}

function readInput(manifestPath) {
  const manifest = JSON.parse(textFile(manifestPath).toString('utf8'));
  if (manifest.version !== 1 || manifest.purpose !== 'review-input-preparation-only' || !Array.isArray(manifest.details) || !manifest.details.length) fail('검수 입력 manifest 형식이 다르다');
  const root = fs.realpathSync(noLinks(manifest.repository));
  inside(root, manifestPath);
  const rows = [manifest.background, ...manifest.details, manifest.baseline];
  if (new Set(rows.map(x => x.path)).size !== rows.length) fail('입력 manifest 경로가 겹친다');
  const buffers = rows.map(row => {
    if (!row.path?.startsWith('.tmp/')) fail('입력은 .tmp 하위 파일이어야 한다');
    const b = textFile(relativeFile(root, row.path));
    if (!same(row, metadata(row.path, b))) fail(`입력 파일이 준비 뒤 바뀌었다: ${row.path}`);
    return b;
  });
  if (!buffers.at(-1).equals(combined(buffers[0], buffers.slice(1, -1)))) fail('비교용 합친 배경이 같은 자료가 아니다');
  return { manifest, root, background: buffers[0], details: buffers.slice(1, -1), baseline: buffers.at(-1) };
}

function readReview(folder) {
  const root = fs.realpathSync(noLinks(folder));
  const manifest = JSON.parse(textFile(path.join(root, '묶음.json')).toString('utf8'));
  if (manifest.판 !== 2 || !manifest.증명 || !Array.isArray(manifest.묶음) || !manifest.묶음.length) fail('준비된 판 2 검수 묶음이 필요하다');
  const seenFiles = new Set(), seenIds = new Set();
  const bundles = manifest.묶음.map(row => {
    if (seenFiles.has(row.파일) || !Array.isArray(row.항목)) fail('중복 묶음 파일 또는 잘못된 항목');
    seenFiles.add(row.파일);
    const b = textFile(relativeFile(root, row.파일));
    if (row.바이트 !== b.length || row.sha256 !== sha(b)) fail(`묶음 바이트·SHA 불일치: ${row.파일}`);
    const text = b.toString('utf8'), ending = `\n\n자료 끝 표식: ${row.표식}\n`;
    if (!row.표식 || !text.endsWith(ending)) fail(`묶음 끝 표식 불일치: ${row.파일}`);
    const matches = [...text.matchAll(/^### \[([^\]\r\n]+)\] ([^\r\n]*)\n/gm)].filter(m => row.항목.includes(m[1]));
    if (!same(matches.map(m => m[1]), row.항목)) fail(`실제 항목과 목록 불일치: ${row.파일}`);
    const items = matches.map((m, i) => {
      if (seenIds.has(m[1])) fail(`검수 항목 중복: ${m[1]}`);
      seenIds.add(m[1]);
      const end = i + 1 < matches.length ? matches[i + 1].index - 2 : text.length - ending.length - 1;
      const body = text.slice(m.index + m[0].length, end);
      if (!m[1].endsWith(`-${sha(body).slice(0, 4)}`)) fail(`항목 내용 해시 불일치: ${m[1]}`);
      return { id: m[1], title: m[2], body };
    });
    return { row, bytes: b.length, text, items };
  });
  if (!same(manifest.증명.항목, manifest.묶음.map(x => x.sha256))) fail('검수 증명과 입력 묶음 SHA 불일치');
  return { root, manifest, bundles, bytes: bundles.reduce((n, x) => n + x.bytes, 0) };
}

// 현행 쪼개기가 아주 긴 한 줄에 넣은 줄바꿈만 허용한다. 원문 문자 누락·순서 변경은 거절한다.
function sameTextWithWraps(expected, actual) {
  let i = 0, j = 0;
  while (i < expected.length && j < actual.length) {
    if (expected[i] === actual[j]) { i++; j++; }
    else if (actual[j] === '\n') j++;
    else return false;
  }
  return i === expected.length && /^\n*$/.test(actual.slice(j));
}
function verifyDetails(input, review) {
  const specs = review.manifest.설정?.곁;
  if (!Array.isArray(specs)) fail('후 묶음의 곁자료 설정이 없다');
  const allItems = review.bundles.flatMap(x => x.items);
  return input.manifest.details.map((row, i) => {
    if (specs.filter(x => x === row.path || x.startsWith(`${row.path}:`)).length !== 1 || !specs.includes(row.path)) fail(`상세 전체를 --곁에 한 번 지정해야 한다: ${row.path}`);
    const snapshots = review.manifest.증명.파일?.filter(x => x.경로 === row.path) || [];
    if (snapshots.length !== 1 || snapshots[0].역할 !== '의존' || snapshots[0].sha256 !== row.lfSha256) fail(`상세의 의존 SHA가 연결되지 않았다: ${row.path}`);
    const prefix = `X${String(specs.indexOf(row.path) + 1).padStart(2, '0')}`;
    const matcher = new RegExp(`^${prefix}(?:[a-z](?:\\d+)?)?-[a-f0-9]{4}$`);
    const items = allItems.filter(x => matcher.test(x.id));
    if (!items.length || items.some(x => !x.title.startsWith(`곁 자료 ${row.path} `))) fail(`상세 검토 항목이 없다: ${row.path}`);
    const expected = lf(input.details[i]).split('\n').map((line, k) => `${String(k + 1).padStart(5)}| ${line}`).join('\n');
    if (!sameTextWithWraps(expected, items.map(x => x.body).join('\n'))) fail(`상세 본문 누락·중복·변경: ${row.path}`);
    return { path: row.path, sha256: row.sha256, lfSha256: row.lfSha256, itemIds: items.map(x => x.id), wholeTextIncluded: true };
  });
}

export function inspectReviewInput({ input, review }) {
  const prepared = readInput(path.resolve(input)), current = readReview(review);
  if (path.resolve(current.manifest.저장소) !== prepared.root || current.manifest.설정?.끝 !== '작업본') fail('입력을 준비한 같은 저장소의 작업본 검수여야 한다');
  if (current.manifest.배경?.sha256 !== prepared.manifest.background.sha256 || path.resolve(current.manifest.설정.배경파일) !== path.join(prepared.root, prepared.manifest.background.path)) fail('준비한 짧은 배경과 다르다');
  return { purpose: 'input-inclusion-only', bytes: current.bytes, bundles: current.bundles.length, details: verifyDetails(prepared, current), notice: '상세 원문이 준비된 입력에 들어갔는지만 확인했다. 모델 검수·통과 판정이 아니다.' };
}

export function compareReviewInputs({ input, before, after }) {
  if (!input || !before || !after) fail('--입력·--전·--후가 필요하다');
  const prepared = readInput(path.resolve(input));
  const a = readReview(before), b = readReview(after);
  if (a.root === b.root) fail('전·후는 서로 다른 새 묶음이어야 한다');
  for (const review of [a, b]) {
    if (path.resolve(review.manifest.저장소) !== prepared.root || review.manifest.설정?.끝 !== '작업본') fail('입력을 준비한 같은 저장소의 작업본 검수여야 한다');
  }
  const bgMatches = (r, row) => r.manifest.배경?.sha256 === row.sha256 && path.resolve(r.manifest.설정.배경파일) === path.join(prepared.root, row.path);
  if (!bgMatches(a, prepared.manifest.baseline) || !bgMatches(b, prepared.manifest.background)) fail('전·후의 배경이 준비한 동일 자료 대조 입력과 다르다');
  if (a.manifest.최대바이트 !== b.manifest.최대바이트) fail('같은 묶음 크기 한도에서 대조해야 한다');
  for (const key of ['정책', '바탕', '파일']) if (!same(a.manifest[key], b.manifest[key])) fail(`전·후 ${key} 범위가 다르다`);
  for (const key of ['배포후보', '자료해시']) if (!same(a.manifest.증명[key], b.manifest.증명[key])) fail(`전·후 ${key}가 다르다`);
  const detailPaths = new Set(prepared.manifest.details.map(x => x.path));
  const details = verifyDetails(prepared, b);
  if ((a.manifest.설정.곁 || []).some(x => [...detailPaths].some(p => x === p || x.startsWith(`${p}:`)))) fail('전 묶음에 이미 분리 상세가 들어 있다');
  if (!same(a.manifest.설정.곁 || [], (b.manifest.설정.곁 || []).filter(x => !detailPaths.has(x)))) fail('기존 곁자료가 바뀌었다');
  if (!same(a.manifest.증명.파일, b.manifest.증명.파일.filter(x => !detailPaths.has(x.경로)))) fail('원천·기존 의존 파일이 바뀌었다');
  return {
    purpose: 'input-size-comparison-only', before: { folder: a.root, bundles: a.bundles.length, bytes: a.bytes },
    after: { folder: b.root, bundles: b.bundles.length, bytes: b.bytes },
    savedBytes: a.bytes - b.bytes, savedPercent: Number(((a.bytes - b.bytes) / a.bytes * 100).toFixed(2)),
    unchanged: { policy: true, sources: true, candidate: true, diff: true, existingCompanions: true }, details,
    notice: '준비된 입력의 실제 UTF-8 바이트 합 대조다. 모델 호출·검수 통과·토큰 또는 시간 절감은 측정하지 않았다.',
  };
}

export function parseArgs(argv) {
  const [command, ...rest] = argv, options = { details: [] };
  const names = { '--저장소': 'repository', '--배경': 'background', '--출력': 'output', '--입력': 'input', '--전': 'before', '--후': 'after' };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--상세') {
      const start = options.details.length;
      while (i + 1 < rest.length && !rest[i + 1].startsWith('--')) options.details.push(rest[++i]);
      if (options.details.length === start) fail('--상세 뒤에 파일이 필요하다');
    } else {
      if (!names[key] || !rest[i + 1] || rest[i + 1].startsWith('--') || Object.hasOwn(options, names[key])) fail(`잘못되거나 중복된 인자: ${key}`);
      options[names[key]] = rest[++i];
    }
  }
  if (!['준비', '대조'].includes(command)) fail('명령은 준비 또는 대조');
  const allowed = command === '준비' ? ['repository', 'background', 'details', 'output'] : ['input', 'before', 'after'];
  if (Object.keys(options).some(k => (k !== 'details' || options.details.length) && !allowed.includes(k))) fail('명령에 맞지 않는 옵션');
  return { command, options };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(command === '준비' ? prepareReviewInput(options) : compareReviewInputs(options), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
