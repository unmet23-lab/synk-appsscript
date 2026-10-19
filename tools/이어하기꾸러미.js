#!/usr/bin/env node
'use strict';
// OneDrive는 문서·현재 저장소 소스, Google Drive는 기존 브랜드 자료를 갱신한다.
// Claude 기억·미확정 후보·전체 git bundle을 자동 복제하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const reviewedSourceLiterals = require('./github-backup-reviewed-literals.json').entries;
const reviewedExactSources = require('./onedrive-reviewed-literals.json').entries;
let preservedReviewPaths;
function originalReviewPaths(source, data) {
  const match = source.replace(/\\/g, '/').match(/^작업문서_미통합_자동\/(files\/([a-f0-9]{64})\.[a-z0-9]+)$/);
  if (!match || crypto.createHash('sha256').update(data).digest('hex') !== match[2]) return [];
  if (!preservedReviewPaths) {
    preservedReviewPaths = new Map();
    const base = path.resolve(ROOT, '../SYNK_원본창고/작업문서_미통합_자동');
    try {
      const index = JSON.parse(fs.readFileSync(path.join(base, 'index.json'), 'utf8'));
      for (const shard of index.manifests || []) {
        if (!/^manifests\/[a-f0-9]+-\d+\.json$/.test(shard.file)) continue;
        for (const row of JSON.parse(fs.readFileSync(path.join(base, shard.file), 'utf8')).entries || []) {
          if (!row.preservedFile || row.preservedFile !== 'files/' + row.sha256 + (path.extname(row.relativePath).toLowerCase() || '.txt')) continue;
          if (!preservedReviewPaths.has(row.preservedFile)) preservedReviewPaths.set(row.preservedFile, new Set());
          preservedReviewPaths.get(row.preservedFile).add(row.relativePath);
        }
      }
      const sourceDirectory = path.join(base, 'sources');
      if (fs.existsSync(sourceDirectory)) for (const name of fs.readdirSync(sourceDirectory).filter(name => /^[a-f0-9]{2}\.json$/.test(name))) {
        const identities = JSON.parse(fs.readFileSync(path.join(sourceDirectory, name), 'utf8')).files || {};
        for (const [file, paths] of Object.entries(identities)) {
          if (!/^files\/[a-f0-9]{64}\.[a-z0-9]+$/.test(file)) continue;
          if (!preservedReviewPaths.has(file)) preservedReviewPaths.set(file, new Set());
          for (const row of paths) preservedReviewPaths.get(file).add(row.relativePath);
        }
      }
    } catch { preservedReviewPaths = new Map(); /* 인덱스 오류 때 예외를 허용하지 않는다. */ }
  }
  return [...(preservedReviewPaths.get(match[1]) || [])];
}
const brands = ['SYNK', 'SYNK LAB', 'SYNK SHIFT', 'SYNK PULSE'];
const forbidden = [/SYNK_보안/i,
  /(^|[\\/])\.env(?:[./\\]|$)/i, /\.clasprc(?:\.|$)/i,
  /\.(?:pem|p12|pfx|key|keystore)$/i];
const sourceCode = /\.(?:js|cjs|mjs|jsx|ts|tsx|gs|cs|lua|nsh|shader|hlsl|uss|uxml|css|scss|sass|less|html?|py|ps1|sh|bat|cmd|sql|graphql|gql|vue|svelte)$/i;
const credentialName = /로그인\.txt|비밀번호|password|백업코드|(?:^|[\\/_.-])(?:auth|secrets?|credentials?|tokens?|keys?)(?:[\\/_.-]|$)/i;
// 인증 설계·DB key 설명도 작업 문서다. 실제 비밀 보관 이름/폴더는 계속 막는다.
const descriptiveMarkdown = p => /\.md$/i.test(p) && !/비밀번호|password|백업코드|(?:^|[\\/])(?:secrets?|credentials?|tokens?|keys?)(?:[\\/]|\.md$)/i.test(p);
// auth.js/key-management.ts 같은 구현 코드는 내용 검사로 판단한다. 실제 키 파일은 항상 차단한다.
const 금지인가 = p => forbidden.some(re => re.test(p)) || (!sourceCode.test(p) && !descriptiveMarkdown(p) && credentialName.test(p));
const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const 문서인가 = p => /\.(?:md|txt|js|cjs|mjs|jsx|ts|tsx|gs|cs|csproj|sln|xaml|asmdef|asmref|unity|prefab|meta|lua|nsh|manifest|webmanifest|uss|uxml|uproject|shader|hlsl|patch|srt|vtt|ass|ffconcat|ipynb|css|scss|sass|less|html?|jsonl?|ya?ml|toml|ini|conf|cfg|service|timer|slice|logrotate|xml|csv|tsv|py|ps1|sh|bat|cmd|sql|graphql|gql|vue|svelte|gitignore|gitattributes|editorconfig)$/i.test(p) ||
  /(?:^|[\\/])(?:Dockerfile|Makefile|Caddyfile|CNAME|LICENSE|NOTICE|\.prettierrc|\.dockerignore|\.claspignore)$/i.test(p) ||
  /(?:^|[\\/])\.githooks[\\/]pre-commit$/i.test(p) ||
  /(?:^|[\\/])ProjectSettings[\\/][^\\/]+\.asset$/i.test(p);
const excluded = /(?:^|\/)(?:\.git|node_modules|build|dist|\.tmp|qa|coverage|\.cache|__pycache__|\.next|\.venv|venv|media|미디어)(?:\/|$)/i;
const generatedDirectory = /^(?:\.git|node_modules|build|builds|dist(?:-.+)?|\.tmp|coverage|\.cache|__pycache__|\.next|\.venv|venv|\.expo|\.turbo|\.svelte-kit|Library|Obj|CacheClip|\.gallery)$/i;
function excludedPath(source) {
  const parts = source.replace(/\\/g, '/').split('/');
  if (!/\.md$/i.test(source)) return excluded.test(parts.join('/')) || parts.slice(0, -1).some(part => generatedDirectory.test(part));
  // QA의 원문·미디어 폴더의 콘티는 포함한다. worktree는 별도 중복 대조 보존 대상이다.
  return parts.slice(0, -1).some(part => generatedDirectory.test(part) || part === 'worktrees');
}
function workTextFiles(root, accept = source => /\.md$/i.test(source)) {
  const files = [];
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const source = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (!generatedDirectory.test(entry.name) && entry.name !== 'worktrees' && !금지인가(source + '/문서.md'))
          walk(path.join(dir, entry.name), source);
      } else if (entry.isFile() && accept(source)) files.push(source);
    }
  };
  walk(root);
  return files;
}
function creationSources(root) {
  const files = [];
  const excludedCreation = /^(?:models|hf-cache)(?:\/|$)|^tools\/(?:ai-toolkit|ComfyUI|seedvr2-extra)(?:\/|$)/i;
  const runtimeFile = /(?:^|\/)(?:logs?(?:\.[^/]+)?|pid(?:\.[^/]+)?|job_id[^/]*\.txt|\.aitk_size\.json)$/i;
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const source = path.posix.join(rel, entry.name);
      if (excludedCreation.test(source) || 금지인가(source)) continue;
      if (entry.isDirectory()) {
        if (!generatedDirectory.test(entry.name) && !/^(?:logs?|worktrees)$/i.test(entry.name)) walk(path.join(dir, entry.name), source);
      } else if (entry.isFile() && 문서인가(source) && !runtimeFile.test(source) && !excludedPath(source)) files.push(source);
    }
  };
  walk(root);
  return files;
}
// 10-18 원문 검토: 예제 문자열만 있는 고정 문서. 경로와 전체 SHA가 둘 다 맞을 때만
// 해당 한 줄의 예제를 검사 중 중화한다. 사본은 원문 그대로이며 변경된 문서는 다시 검사한다.
const reviewedDocumentExamples = [
  { suffix: 'higgsfield-websites/references/security.md', sha256: '3c56006b1665d9968fb94a35c60f5e1f66c616ac70f2ba9e62c370b9fa412c77', line: 354, kind: 'secret-example' },
  { suffix: 'higgsfield-websites/references/fnf-sdk.md', sha256: 'd1c8dcf592ebda982df344bb0c02f06b819bb276b3c45164a82b45a97b5b4c93', line: 520, kind: 'data-format' },
  { suffix: 'docs/_ops/qa/cloud-secret-scan-20261017/README.md', sha256: 'f16a6583a5d2724774137dfb9ffe05bbd6d83a161db37135fb1f02e283250bd1', line: 10, kind: 'secret-example' },
];
function documentExampleText(source, data, text) {
  if (!/\.md$/i.test(source)) return text;
  const normalized = source.replace(/\\/g, '/');
  const candidates = reviewedDocumentExamples.filter(rule => normalized === rule.suffix || normalized.endsWith('/' + rule.suffix) ||
    normalized.endsWith('작업문서_미통합_20261018/files/' + rule.sha256 + '.md') ||
    normalized.endsWith('작업문서_미통합_자동/files/' + rule.sha256 + '.md'));
  if (!candidates.length) return text;
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  const rule = candidates.find(candidate => candidate.sha256 === digest);
  if (!rule) return text;
  const lines = text.split('\n');
  if (rule.kind === 'data-format') lines[rule.line - 1] = lines[rule.line - 1].replace(/data:[i]mage\/(?:\.{3}|…)/g, 'example-image-reference');
  else lines[rule.line - 1] = lines[rule.line - 1].replace(/(api[_-]?key|password)(\s*[:=]\s*)(["'])(.*?)\3/gi,
    (_, key, assignment, quote) => key + assignment + quote + 'example' + quote);
  return lines.join('\n');
}
// 이름만으로 TypeScript와 MPEG-TS를 구분하지 않는다. 실제 바이트도 검사한다.
// info를 주면 분류가 창고 색인(보존 사본의 원래 경로)에 기댔는지 info.dependsOnIndex로 알린다. 그런 결과는 읽기 기록에 남기지 않는다.
function textPolicy(source, data, info) {
  if (금지인가(source)) return 'credential-path';
  if (excludedPath(source)) return 'generated-or-excluded-path';
  if (!문서인가(source)) return 'non-text-extension';
  if (data.length > MAX_TEXT_BYTES) return 'over-10MiB';
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { return 'not-utf8-text'; }
  if (/(?:^|[\\/])\.githooks[\\/]pre-commit$/i.test(source) && !/^#![^\r\n]*(?:sh|python|node)(?:\s|$)/.test(text)) return 'not-managed-source-hook';
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return 'binary-control-bytes';
  const normalized = documentExampleText(source, data, text).replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\//g, '/');
  // 형식 이름만 적은 설명(`data:image/png`)이나 실행 중에 붙이는 값(`;base64,${…}`, `;base64,' + b64`)은 담긴 자료가 없다.
  // 쉼표 뒤에 실제 내용이 바로 이어질 때만 내장 자료로 본다(10-19).
  if (/data:\s*(?:image|audio|video|font)\/[\w.+-]+(?:;[\w.+-]+(?:=[\w.+-]+)?)*\s*,\s*(?!\$\{)[^\s"'`)]/i.test(normalized) ||
      /data:[^,\r\n]{0,160};base64\s*,\s*[A-Za-z0-9+/]{16}/i.test(normalized) ||
      /[A-Za-z0-9+/]{256,}={0,2}/.test(normalized) ||
      /(?:iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|T2dnUw|SUQz|UEsDB|JVBERi0)[A-Za-z0-9+/=]{16,}/.test(normalized)) return 'embedded-media-or-base64';
  if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bAIza[\w-]{30,}|\b(?:gh[pousr]_|github_pat_|xox[baprs]-|sk-(?:proj-)?)\w[\w-]{18,}|\beyJ[\w-]{12,}\.[\w-]{12,}\.[\w-]{12,}/.test(normalized)) return 'secret-signature';
  // 따옴표 안 상태 문구(API_KEY: ...)와 실제 키 대입을 구별한다. 접두사가 붙은 환경 키 이름도 검사한다.
  const literals = [...normalized.matchAll(/(?<![\w"'`])(["']?)(?:[A-Za-z_$][\w$-]*)?(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key|authorization)\1\s*[:=]\s*(["'])((?:\\.|(?!\2)[^\r\n])+)\2/gi)]
    .map(m => ({ value: m[3], end: m.index + m[0].length }));
  if (/\.(?:ya?ml|ini|conf|cfg)$/i.test(source)) literals.push(...[...normalized.matchAll(/^\s*(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s#"'{}\[\],]+)/gmi)]
    .map(m => ({ value: m[1], end: m.index + m[0].length })));
  // systemd의 Environment="NAME=value" 안쪽과 따옴표 없는 설정값도 검사한다.
  if (/\.(?:service|timer|slice|logrotate)$/i.test(source)) literals.push(...[...normalized.matchAll(/(?:^|\s|["'=])(?:[A-Za-z_][\w-]*)?(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*=\s*(["']?)([^\s"']+)\1/gmi)]
    .map(m => ({ value: m[2], end: m.index + m[0].length })));
  for (const { value, end } of literals) {
    // 고정 Bearer 접두사 + 런타임 식별자는 비밀 리터럴이 아니다. 문자열을 이어 붙인 실제 키는 계속 차단한다.
    const dynamicValue = /^\s*\+\s*(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\s*\))?|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.getProperty\(\s*(["'])[A-Za-z_][\w.-]*\1\s*\))\s*(?:[,;}\]\r\n]|$)/.test(normalized.slice(end));
    if (/^Bearer\s*$/i.test(value) && (dynamicValue || /^\.concat\(\s*[A-Za-z_$][\w$]*\s*\)\s*(?:[,;}\]\r\n]|$)/.test(normalized.slice(end)))) continue;
    if ((/(?:^|[\\/])tests[\\/]/.test(source) || /^작업문서_미통합_자동\/files\/[a-f0-9]{64}\.(?:[cm]?js|tsx?)$/i.test(source)) &&
      /^synthetic-(?:public|service|management-token)$/.test(value)) continue;
    // GitHub 감사에서 확인한 동일 경로·동일 값만 허용한다. 서명 검사는 위에서 먼저 끝난다.
    const literalHash = crypto.createHash('sha256').update(value).digest('hex');
    if (info && /^작업문서_미통합_자동\//.test(source.replace(/\\/g, '/'))) info.dependsOnIndex = true;
    const reviewedPaths = [source.replace(/\\/g, '/'), ...originalReviewPaths(source, data)];
    if (reviewedSourceLiterals.some(row => reviewedPaths.includes(row.path) && row.sha256 === literalHash)) continue;
    const exactCandidates = reviewedExactSources.filter(row => row.literalSha256.includes(literalHash) &&
      (row.path === source.replace(/\\/g, '/') || source.replace(/\\/g, '/').endsWith('작업문서_미통합_자동/files/' + row.fileSha256 + path.extname(row.path))));
    if (exactCandidates.length && exactCandidates.some(row => row.fileSha256 === crypto.createHash('sha256').update(data).digest('hex'))) continue;
    if (!/^(?:\$\{|<|process\.env\.|env\.|your[_ -]|example|placeholder|dummy|test[_-]|change[_-]?me|\*{3})/i.test(value)) return 'secret-literal';
  }
  return null;
}
function ancestors(file) {
  const paths = [];
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    paths.push(p);
    if (p === path.dirname(p)) return paths;
  }
}
function cloudDestinationAllows(file, root, tag) {
  if (!root || !Number.isInteger(tag)) return false;
  const rel = path.relative(path.resolve(root), path.resolve(file));
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return false;
  // Windows SDK winnt.h: IO_REPARSE_TAG_CLOUD, CLOUD_1 ... CLOUD_F only.
  return tag >= 0x9000001A && tag <= 0x9000F01A && (tag - 0x9000001A) % 0x1000 === 0;
}
// 경로가 이만큼 넘으면 경로마다 파일을 여는 대신 부모 폴더를 한 번씩 나열해 같은 속성·reparse 태그를 읽는다(10-19).
// 다른 무거운 작업이 돌 때 6만여 경로를 하나씩 확인하는 데 5분 넘게 걸렸다. 적은 묶음은 준비 비용 때문에 예전 길이 빠르다.
const FOLDER_LISTING_MIN_PATHS = 1000;
function linkPaths(files, { cloudDestinationRoot = null } = {}) {
  const paths = [...new Set(files.flatMap(ancestors))];
  const cloudPaths = new Set();
  const cloudOnlineOnly = new Set();
  // Windows의 폴더 나열은 심볼릭 링크·junction을 포함한 모든 reparse를 같은 속성으로 보여 주므로 그때는 경로별 lstat를 따로 하지 않는다.
  const listing = process.platform === 'win32' && paths.length > 0 && (!!cloudDestinationRoot || paths.length >= FOLDER_LISTING_MIN_PATHS);
  const blocked = new Set(listing ? [] : paths.filter(p => {
    try { return fs.lstatSync(p).isSymbolicLink(); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
  }));
  // NTFS cloud placeholders can be reparse points without being Node symbolic links.
  if (process.platform === 'win32' && paths.length) {
    if (listing) {
      // 파일마다 fsutil 프로세스를 띄우면 2만 사본 갱신이 수십 분 걸린다.
      // FindFirstFile의 reparse tag를 한 프로세스에서 읽는다. 본문은 열지 않는다.
      const result = execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'onedrive-reparse-metadata.ps1')],
        { input: JSON.stringify(paths), encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20 });
      for (const row of JSON.parse(result.replace(/^\uFEFF/, ''))) {
        if (!blocked.has(row.path) && cloudDestinationAllows(row.path, cloudDestinationRoot, row.tag)) {
          cloudPaths.add(row.path);
          // OFFLINE, RECALL_ON_OPEN, RECALL_ON_DATA_ACCESS: 본문 비교로 가져오지 않는다.
          if (!Number.isInteger(row.attributes) || (row.attributes & (0x1000 | 0x40000 | 0x400000))) cloudOnlineOnly.add(row.path);
        }
        else blocked.add(row.path);
      }
      return Object.assign(file => ancestors(file).some(p => blocked.has(p)), { cloudPaths, cloudOnlineOnly });
    }
    const script = '$ErrorActionPreference="Stop"; [Console]::InputEncoding=[Text.UTF8Encoding]::new(); [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $items=ConvertFrom-Json ([Console]::In.ReadToEnd()); $bad=@(foreach($p in $items){ if([IO.File]::Exists($p) -or [IO.Directory]::Exists($p)){ if(([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint) -ne 0){$p} } }); ConvertTo-Json -Compress -InputObject $bad';
    const result = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { input: JSON.stringify(paths), encoding: 'utf8', windowsHide: true, maxBuffer: 16 << 20 });
    for (const p of JSON.parse(result.replace(/^\uFEFF/, ''))) {
      let tag = null;
      if (cloudDestinationRoot && !blocked.has(p)) {
        try {
          const info = execFileSync('fsutil.exe', ['reparsepoint', 'query', p],
            { encoding: 'utf8', windowsHide: true, maxBuffer: 128 << 10 });
          const match = info.match(/0x([0-9a-f]{8})/i);
          if (match) tag = parseInt(match[1], 16);
        } catch { /* 조회 실패·알 수 없는 태그는 허용하지 않는다. */ }
      }
      if (cloudDestinationAllows(p, cloudDestinationRoot, tag)) cloudPaths.add(p);
      else blocked.add(p);
    }
  }
  return Object.assign(file => ancestors(file).some(p => blocked.has(p)), { cloudPaths, cloudOnlineOnly });
}
const docs = {
  SYNK: ['DESIGN.md', 'docs/AI_운영원칙.md', 'docs/SYNK_철학.md', 'docs/비전_정본.md',
    'docs/마케팅_정본.md', 'docs/제품방향.md', 'docs/엔진8종_상향설계_v3.md',
    'docs/로고_중립색_정본_v1.md', 'docs/브랜드_폰트_정본.md', 'docs/디자인_토큰.json'],
  'SYNK LAB': ['docs/커리큘럼_정본_v1.md', 'docs/반편성_정본_v2.md', 'docs/1기_제안문안_v1.md'],
  'SYNK SHIFT': ['docs/마케팅_정본.md'],
  'SYNK PULSE': ['docs/음악자산_장부.md'],
};
function within(root, rel) {
  if (path.isAbsolute(rel) || rel.includes(':') || 금지인가(rel)) throw new Error('허용하지 않는 자료 경로');
  const target = path.resolve(root, rel);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('자료 경로 범위 오류');
  return target;
}
function 목록(root = ROOT) {
  const rows = new Map();
  function add(brand, source, target, googleOnly = !문서인가(source)) {
    if (금지인가(source) || excludedPath(source)) return;
    const file = within(root, source);
    if (!fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('일반 파일 필요: ' + source);
    const key = brand + '/' + target;
    within(root, key);
    if (rows.has(key) && rows.get(key).source !== source) throw new Error('자료 이름 중복');
    rows.set(key, { brand, source, target, googleOnly, bytes: fs.statSync(file).size });
  }
  function folder(brand, source, target, test = () => true) {
    const walk = (dir, rel = '') => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const tail = path.posix.join(rel, entry.name);
        if (금지인가(source + '/' + tail) || excluded.test(source + '/' + tail)) continue;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), tail);
        else if (test(tail)) add(brand, source + '/' + tail, target + '/' + tail);
      }
    };
    walk(within(root, source));
  }
  for (const brand of brands) {
    add(brand, 'docs/문서_지도.md', '먼저 읽기.md');
    for (const source of docs[brand]) add(brand, source, '정본/' + path.basename(source));
    const slug = { SYNK: 'synk', 'SYNK LAB': 'lab', 'SYNK SHIFT': 'shift', 'SYNK PULSE': 'pulse' }[brand];
    add(brand, 'docs/홍보물/브랜드소개_20260909/' + slug + '.pdf', '소개서.pdf');
  }
  add('SYNK', 'docs/컴퓨터를 잃어버렸을 때.md', '복원 시작.md');
  // 회사별 전략과 실행 기준은 현행 분리 원문에서 가져온다.
  folder('SYNK', 'docs/마케팅', '정본/마케팅', p => p.endsWith('.md'));
  add('SYNK', 'docs/브랜드킷.html', '브랜드 킷.html');
  folder('SYNK', 'docs/엔진', '엔진 8종', p => !p.includes('/') && p.endsWith('.html'));
  folder('SYNK', 'docs/캐릭터/정본_4K', '확정 자산/마스코트');
  folder('SYNK', 'docs/브랜드_폰트', '확정 자산/폰트');
  // 배포 요소와 대응 원본. 추적된 시험판은 포함하지 않는다.
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'docs/Loom_자산/구움'],
    { cwd: root, maxBuffer: 8 << 20 }).toString('utf8').split('\0').filter(Boolean);
  for (const source of tracked) {
    const name = path.basename(source);
    if (!/\.(avif|webp|png)$/.test(name) || /^(시험_|_)/.test(name)) continue;
    add('SYNK', source, '확정 자산/요소/' + name, true);
    const original = source.replace(/\.(avif|webp)$/, '.png');
    if (original !== source && fs.existsSync(within(root, original)))
      add('SYNK', original, '확정 자산/요소/' + path.basename(original), true);
  }
  // 고해상도 PNG 원본은 검증된 Drive 묶음이 보관한다. 여기서는 앱이 바로 쓰는 작은 AVIF만 갱신한다.
  folder('SYNK', 'docs/_ops/마스코트_Drive이관_20260910',
    '보관 기록/마스코트 의상 원본',
    p => !p.startsWith('transfer/') && /\.(?:md|json|jsonl)$/.test(p));
  for (const stage of ['GPT_표정_누끼_틀_avif', 'GPT_누끼_틀_avif'])
    folder('SYNK', 'docs/Loom_자산/옷/' + stage, '확정 자산/마스코트 의상/' + stage, p => /\.(png|avif)$/.test(p));
  const system = 시스템목록(root);
  return Object.assign([...rows.values(), ...system], { scopes: system.scopes });
}
const sourceScopeCache = new Map();
function systemScopes(root) {
  const parent = path.dirname(path.resolve(root));
  const home = path.basename(parent).toLowerCase() === 'documents' ? path.dirname(parent) : parent;
  const names = new Set(['SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-policy', 'synk-tips', 'claude-session-share']);
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') ||
      generatedDirectory.test(entry.name) || 금지인가(entry.name + '/README.md') ||
      /(?:^|[-_. ])(?:archive[ds]?|backup|backups|백업|cache|캐시|old|이전)(?:[-_. ]|$)/i.test(entry.name)) continue;
    if (fs.existsSync(path.join(parent, entry.name, '.git'))) names.add(entry.name);
  }
  const scopes = [
    ...[...names].map(name => ({ name, mode: 'repository',
      root: name === 'SYNK-appsscript' ? path.resolve(root) : path.resolve(root, '..', name) })),
    { name: 'SYNK_원본창고', mode: 'vault', root: path.resolve(root, '..', 'SYNK_원본창고') },
    { name: 'Videos', mode: 'markdown', root: path.join(home, 'Videos') },
    { name: '개인작업규칙', mode: 'markdown', root: path.join(home, '.agents/skills') },
    ...(path.basename(parent).toLowerCase() === 'documents' ? [{ name: 'SYNK-LoRA', mode: 'creation-source',
      root: path.join(path.parse(parent).root, 'SYNK-LoRA') }] : []),
    ...['PC_백업_20261003', 'PC_백업_20261014_HappyGangster'].map(name => ({ name, mode: 'restore-tools',
      root: path.resolve(root, '..', name) })),
  ];
  sourceScopeCache.set(path.resolve(root), scopes);
  return scopes;
}
// 복원 상태의 원문은 비밀·개인정보 필드를 가질 수 있으므로 통째로 복사하지 않는다.
// 아래 명시 필드만 새 PC의 복원 입구로 만든다. 원키/개인키/본문/임의 중첩 필드는 버린다.
function writeSafeRecoveryIndex(vault) {
  if (!fs.existsSync(vault)) return null;
  const name = '백업_복원안전목록.json', target = path.join(vault, name);
  const specs = ['legacy-workspace-status.json', 'workspace-백업/legacy/priority-selection.json',
    'supabase-vault-key-backup-status.json', 'supabase-restore-test-status.json', 'restore-drill-status.json', 'server-independent-status.json'];
  const linked = linkPaths([...specs.map(source => path.join(vault, source)), target]);
  if (linked(target)) throw new Error('unsafe-recovery-index-link');
  const sources = [], records = {};
  for (const source of specs) {
    const file = path.join(vault, source);
    if (!fs.existsSync(file)) { records[source] = {}; sources.push({ path: source, status: 'missing' }); continue; }
    if (linked(file) || fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > MAX_TEXT_BYTES) throw new Error('unsafe-recovery-status-source');
    const bytes = fs.readFileSync(file);
    records[source] = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    sources.push({ path: source, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  const str = (v, max = 400) => typeof v === 'string' && v.length <= max && !/[\x00-\x1f]/.test(v) ? v : null;
  const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(v) ? v : null;
  const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v) ? v : null;
  const keyId = v => typeof v === 'string' && /^[a-f0-9]{16}$/i.test(v) ? v : null;
  const number = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
  const bool = v => typeof v === 'boolean' ? v : null;
  const account = v => ['unmet23@gmail.com', '77yuhbs@gmail.com'].includes(v) ? v : null;
  const status = v => ['success', 'healthy', 'unhealthy', 'pending', 'running', 'failed', 'verified_with_limitations', 'success_with_managed_role_difference',
    'retained_policy_blocked', 'cleaned', 'installed_and_remote_verified', 'isolated-restore-startup-passed'].includes(v) ? v : 'unknown';
  const relative = v => typeof v === 'string' && v.length < 600 && !path.isAbsolute(v) && !v.includes(':') &&
    !v.replace(/\\/g, '/').split('/').includes('..') ? v : null;
  const scopedRelative = (prefix, v) => relative(v) ? relative(prefix + v) : null;
  const list = v => Array.isArray(v) ? v : [];
  const remote = r => ({ id: id(r.driveFileId || r.remoteId), path: relative(r.path), bytes: number(r.bytes), sha256: digest(r.sha256),
    ownerMatched: bool(r.ownerMatched ?? r.ownedByMe), notTrashed: bool(r.notTrashed ?? (r.trashed === undefined ? undefined : !r.trashed)),
    actualDownloadVerified: bool(r.actualDownloadVerified) });
  const legacy = records[specs[0]], selection = records[specs[1]], capsule = records[specs[2]], db = records[specs[3]], drill = records[specs[4]];
  const artifact = r => !r ? null : ({ id: id(r.remoteId), sourceKey: str(r.sourceKey), sourceAccount: account(r.sourceAccount), originalId: id(r.fileId),
    version: str(r.version), encryptionKeyId: keyId(r.keyId), bytes: number(r.encryptedBytes), sha256: digest(r.encryptedSha256),
    plaintextBytes: number(r.plaintextBytes), plaintextSha256: digest(r.plaintextSha256), remoteVerifiedAt: str(r.remoteVerifiedAt) });
  const mainRun = r => !r ? null : ({ status: status(r.status), runId: str(r.runId), startedAt: str(r.startedAt), completedAt: str(r.completedAt),
    encryptionKeyId: keyId(r.keyId), folderId: id(r.folderId), receipt: artifact(r.receipt), items: list(r.items).map(artifact) });
  const actual = drill.actualUserKeyDecrypt || {}, company = drill.company || {}, companyTest = company.test || {}, local = drill.cleanup?.local || {};
  const content = {
    schemaVersion: 1, purpose: '노트북 분실 시 복원 위치와 확인 범위를 찾는 비밀값 없는 목록', sources,
    legacy: { status: status(legacy.status), sourceAccount: account(legacy.sourceAccount), destinationAccount: account(legacy.destinationAccount),
      expected: number(legacy.expected), collected: number(legacy.collected), ciphertextDownloadsVerified: number(legacy.ciphertextDownloadsVerified),
      originals: list(legacy.results).map(r => {
        const selected = list(selection.items).find(item => item.id === r.source?.id) || {};
        return { originalId: id(r.source?.id), sourceAccount: account(r.source?.account), mimeType: str(r.source?.mimeType),
          role: str(selected.role), selectionReason: str(selected.reason || r.selectionReason, 1000), sourceVersion: str(r.source?.version),
          cipherPath: scopedRelative('workspace-백업/', r.relativePath), encryptionKeyId: keyId(r.keyId),
          plaintextBytes: number(r.plaintext?.bytes), plaintextSha256: digest(r.plaintext?.sha256),
          cipherBytes: number(r.encrypted?.bytes), cipherSha256: digest(r.encrypted?.sha256),
          remote: list(legacy.remote).filter(item => item.sourceId === r.source?.id).map(remote) };
      }),
      limitations: ['옛 문서 우선 9개 현재 내용만 보존. 전체 수정 이력·댓글은 포함하지 않음.',
        'Apps Script 소스와 manifest만 보존. 속성·트리거·배포는 포함하지 않음.', '나머지 옛 문서의 필요성별 후속 선별은 별도 범위.'] },
    vault: { status: status(capsule.status), projectRef: id(capsule.projectRef), destinationAccount: account(capsule.remoteAccount),
      cipherPath: scopedRelative('talk-백업/', capsule.relativePath), sourceKeySha256: digest(capsule.sourceKeySha256),
      sourceKeyHashInput: 'decoded 32-byte root key', encryptionKeyId: keyId(capsule.encryptionKeyId),
      remote: list(capsule.remote).map(remote), dumpDependencies: list(capsule.dumpDependencies).map(r => ({ bytes: number(r.bytes), sha256: digest(r.sha256) })),
      dailyDependencyStatus: status(db.vaultKeyCapsule?.serverDailyDumpDependency?.status),
      limitations: ['원키 자체는 암호문 안에만 있음. 사용자 암호와 잠긴 개인키가 필요함.',
        '수동 원키 회전 후 캡슐 재수집·원격 검증·서버 dependency 갱신 필수.', '일일 검증은 캡슐 보존 검증이며 운영 원키의 변경을 자동 조회하지 않음.'] },
    servers: { status: status(records[specs[5]].status), checkedAt: str(records[specs[5]].checkedAt), destinationAccount: '77yuhbs@gmail.com',
      nodes: list(records[specs[5]].nodes).filter(n => ['company', 'research', 'radio'].includes(n.role)).map(n => ({ role: n.role,
        current: mainRun(n.current), lastSuccess: mainRun(n.lastSuccess),
        runtimeSupplement: !n.runtimeRefresh ? null : { status: status(n.runtimeRefresh.status), checkedAt: str(n.runtimeRefresh.checkedAt),
          previousScheduledRunId: str(n.runtimeRefresh.previousScheduledRunId), noSuccessLedgerChanged: bool(n.runtimeRefresh.noSuccessLedgerChanged),
          manifestSourceFingerprint: digest(n.runtimeRefresh.manifest?.sourceFingerprint), ciphertext: artifact(n.runtimeRefresh.ciphertext) },
        nativeClientSupplement: !n.nativeClient ? null : { status: status(n.nativeClient.status), checkedAt: str(n.nativeClient.checkedAt), ciphertext: artifact(n.nativeClient.ciphertext) } })),
      limitations: ['main 완료 시각과 runtime/native 보완 시각을 별도로 유지함. 보완 시각은 전체 DB·자료의 백업 시각이 아님.',
        '암호문을 풀어 기존 계정·설정·공개키를 확인한 뒤 예약은 비활성 상태에서 복원. 서버에 사용자 개인키를 두지 않음.'] },
    restoreDrill: { status: status(drill.status), checkedAt: str(drill.checkedAt), evidenceDirectory: relative(drill.evidenceDirectory),
      actualUserKeyDecrypt: { files: number(actual.files), keyFromOneDrive: bool(actual.keyFromOneDrive), authenticatedDecrypt: bool(actual.authenticatedDecrypt),
        bytesAndSha256Matched: bool(actual.bytesAndSha256Matched), passwordSaved: bool(actual.passwordSaved), unlockedPrivateKeySaved: bool(actual.unlockedPrivateKeySaved) },
      workspaceFiles: number(drill.workspaceFiles), argonSourceFiles: number(drill.argonSourceFiles),
      git: { heads: number(drill.git?.heads), connectivityPassed: bool(drill.git?.connectivityPassed), actualSourceSamples: number(drill.git?.actualSourceSamples), remoteWrites: number(drill.git?.remoteWrites) },
      company: { status: status(companyTest.status), databaseLogicalCopiesMatch: bool(companyTest.databaseLogicalCopiesMatch), credentialRecordsDecrypted: number(companyTest.credentialRecordsDecrypted),
        referencedFilesVerified: number(companyTest.referencedFilesVerified), sourceSnapshotUnchanged: bool(companyTest.sourceSnapshotUnchanged), healthReady: bool(companyTest.healthReady),
        network: company.network === 'none' ? 'none' : 'unknown', publishedPorts: number(company.publishedPorts), containerRemoved: bool(company.containerRemoved), realUserLoginTest: bool(companyTest.realUserLoginTest) },
      supabase: { tables: number(drill.supabase?.tables), rows: number(drill.supabase?.rows), missingOrMismatch: number(drill.supabase?.missingOrMismatch),
        vaultRowsDecrypted: number(drill.supabase?.vaultRowsDecrypted), schemaObjects: number(drill.supabase?.schemaObjects), managedOwnerAclDifferences: number(drill.supabase?.managedOwnerAclDifferences) },
      cleanup: { companyServerStatus: status(drill.cleanup?.companyServer?.status), postgresContainerRemoved: bool(drill.cleanup?.postgresServer?.containerRemoved),
        postgresTestDirectoryRemoved: bool(drill.cleanup?.postgresServer?.testDirectoryRemoved), temporaryRootKeyRemoved: bool(drill.cleanup?.postgresServer?.temporaryRootKeyRemoved),
        local: { status: status(local.status), exactPath: str(local.exactPath, 600), retainedLogicalBytes: number(local.retainedLogicalBytes), isProtected: bool(local.isProtected),
          originalBackupsDeleted: number(local.originalBackupsDeleted), passwordOrPrivateKeySaved: bool(local.passwordOrPrivateKeySaved) } },
      limitations: ['실제 사용자 키 복호화 11개 표본에 옛 문서 9개와 신규 Vault 캡슐은 포함되지 않음.',
        '운영 트래픽 전환·실사용자 로그인은 시험하지 않음. 스냅샷 이후 삭제·동의 철회는 실제 전환 전에 반영해야 함.',
        'Supabase 관리 확장 ACL 소유자 17곳의 차이를 보존함.', '로컬 시험 평문은 자동 승인 차단으로 제한된 권한 아래 보존 중일 수 있음. cleanup.local의 현재 판정을 확인.'] }
  };
  const bytes = Buffer.from(JSON.stringify(content, null, 2) + '\n'), reason = textPolicy(name, bytes);
  if (reason) throw new Error('unsafe-recovery-index-' + reason);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('unsafe-recovery-index-link');
  const changed = !fs.existsSync(target) || !fs.readFileSync(target).equals(bytes);
  if (changed) { const temp = target + '.' + process.pid + '.tmp'; fs.writeFileSync(temp, bytes, { flag: 'wx' }); fs.renameSync(temp, target); }
  return { file: target, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), changed, missingSources: sources.filter(r => r.status === 'missing').map(r => r.path) };
}
function rowRoot(root, row) {
  if (!row.sourceScope) return root;
  const scope = (sourceScopeCache.get(path.resolve(root)) || systemScopes(root)).find(scope => scope.name === row.sourceScope);
  if (row.kind !== 'system' || !scope) throw new Error('허용하지 않는 시스템 범위');
  return scope.root;
}
function 시스템목록(root = ROOT) {
  const rows = [], scopes = systemScopes(root), linked = linkPaths(scopes.map(scope => scope.root));
  for (const scope of scopes) {
    if (!fs.existsSync(scope.root) || linked(scope.root)) { scope.status = 'missing-or-linked'; continue; }
    let sources;
    if (scope.mode === 'vault' || scope.mode === 'restore-tools') {
      sources = fs.readdirSync(scope.root).filter(name => /\.(?:py|ps1|sh|js|cjs|mjs)$|^README\.md$/i.test(name));
      sources.push(...workTextFiles(scope.root, source => /\.md$/i.test(source) ||
        (scope.mode === 'vault' && /^(?:(?:원본|서버)_복원목록(?:-\d+)?\.json|백업_복원안전목록\.json|backup-health-config\.json|protected-source-backup-status\.json|문서_안전사본_자동\/index\.json|작업문서_미통합_자동\/files\/[a-f0-9]{64}\.[a-z0-9]+)$/i.test(source)) ||
        // 공간 지킴이 장부는 Drive에만 남긴 원본을 되살리는 근거다(원래 경로·크기·sha256·Drive 계정과 ID, 10-19).
        // 10MiB 한도 전에 4MiB마다 내려놓은목록-002.jsonl, -003…으로 이어 쓰므로 조각도 모두 담는다.
        (scope.mode === 'vault' && /^상태\/공간지킴이\/(?:내려놓은목록(?:-[0-9]{3,})?\.jsonl|latest\.json|[^/]+_Drive에없음\.json)$/i.test(source)) ||
        (scope.mode === 'vault' && /^(?:상태\/.*\/(?:upload-dirs\.json|upload-done\.jsonl|같은파일\.json|목록\.json)|복원검증_[^/]+\/.*\.(?:json|jsonl|txt)|OneDrive_이관_\d{8}\/복원목록\.json|작업문서_미통합_(?:\d{8}|자동)\/(?:index|excluded-protected-manifest)\.json|작업문서_미통합_자동\/manifests\/[a-f0-9]+-\d+\.json|작업문서_미통합_자동\/sources\/[a-f0-9]{2}\.json|문서_안전사본_20261018\/(?:원본복원목록|변환manifest)\.json|backup-monitor-config\.json|(?:서버백업|talk-백업|헤르메스-백업|라디오-백업)\/(?:_받은목록\.jsonl|_목록사본\/[^/]+\.jsonl))$/i.test(source)) ||
        (scope.mode === 'restore-tools' && /^(?:복원목록(?:_최소)?\.json|(?:media-)?upload-(?:dirs\.json|done\.jsonl)|backup-manifest\.json)$/i.test(source))));
    } else if (scope.mode === 'markdown') {
      sources = workTextFiles(scope.root);
    } else if (scope.mode === 'creation-source') {
      sources = creationSources(scope.root);
    } else {
      const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: scope.root, encoding: 'utf8' }).trim();
      if (fs.realpathSync(top) !== fs.realpathSync(scope.root)) throw new Error('시스템 저장소 경계 불일치');
      sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: scope.root, maxBuffer: 32 << 20 }).toString('utf8').split('\0').filter(Boolean);
      // Git 무시 규칙은 대용량 자산용일 수 있다. 그 안의 작업 MD는 별도로 보존한다.
      sources.push(...workTextFiles(scope.root));
    }
    scope.status = 'available';
    for (const source of new Set(sources)) rows.push({ brand: 'SYNK', source, sourceScope: scope.name,
      target: '시스템/' + scope.name + '/' + source, kind: 'system', oneDriveOnly: true });
  }
  return Object.assign(rows, { scopes });
}
// cache: 읽기 기록(onedrive-read-cache.cjs). stat가 지난번에 읽어 분류한 그대로인 파일은 다시 읽지 않고 그 분류를 쓴다.
function oneDrivePlan(root, rows, { cache = null } = {}) {
  const selected = [], rejected = [];
  const candidates = rows.filter(row => !금지인가(row.source) && !excludedPath(row.source) && 문서인가(row.source));
  const linked = linkPaths(candidates.map(row => within(rowRoot(root, row), row.source)));
  for (const row of rows) {
    let reason = 금지인가(row.source) ? 'credential-path' :
      excludedPath(row.source) ? 'generated-or-excluded-path' :
      !문서인가(row.source) ? 'non-text-extension' : row.googleOnly ? 'google-only' : null;
    if (!reason) {
      const file = within(rowRoot(root, row), row.source);
      if (linked(file)) reason = 'link-or-reparse-point';
      else {
        try {
          const stat = fs.lstatSync(file, { bigint: true });
          reason = !stat.isFile() ? 'not-regular-file' : stat.size > BigInt(MAX_TEXT_BYTES) ? 'over-10MiB' : null;
          if (!reason) {
            const known = cache && cache.lookup(file, stat, row.source);
            if (known) reason = known.reason;
            else {
              const data = fs.readFileSync(file), info = {};
              reason = textPolicy(row.source, data, info);
              if (cache) cache.remember(file, stat, fs.lstatSync(file, { bigint: true }), hash(data), data.length, row.source, reason, info);
            }
          }
          if (!reason) selected.push({ ...row, bytes: Number(stat.size) });
        } catch (error) {
          if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error;
          reason = 'missing-or-unreadable';
        }
      }
    }
    if (reason) rejected.push({ source: row.source, sourceScope: row.sourceScope || 'SYNK-appsscript', reason });
  }
  return { selected, rejected };
}
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function payload(root, row, data = fs.readFileSync(within(rowRoot(root, row), row.source))) {
  if (row.kind === 'system' || !row.source.endsWith('.md')) return data;
  if (row.brand === 'SYNK' && row.target === '복원 시작.md' && row.source === 'docs/컴퓨터를 잃어버렸을 때.md') {
    // 새 PC의 사용자 이름·OneDrive 위치에 기대지 않는 복구 입구다.
    return Buffer.from(data.toString('utf8').replace(/(\]\()([^\s)]+)(\))/g, (all, left, url, right) => {
      if (/^(?:[a-z]+:|#|\/\/)/i.test(url)) return all;
      const [file, anchor] = url.split('#');
      const rel = path.posix.normalize(path.posix.join('SYNK-appsscript', path.posix.dirname(row.source), decodeURIComponent(file)));
      if (rel.startsWith('../') || path.posix.isAbsolute(rel)) return all;
      return left + '시스템/' + rel + (anchor ? '#' + anchor : '') + right;
    }), 'utf8');
  }
  // 사본을 만든 바로 그 작업 파일로 연결한다. 원격 master는 아직 옛 판이거나 파일이 없을 수 있다.
  const localPath = source => path.resolve(root, source).replace(/\\/g, '/');
  const body = data.toString('utf8').replace(/(\]\()([^\s)]+)(\))/g, (all, left, url, right) => {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(url)) return all;
    const [file, anchor] = url.split('#');
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(row.source), decodeURIComponent(file)));
    if (resolved.startsWith('../')) return all;
    return left + '<' + localPath(resolved) + (anchor ? '#' + anchor : '') + '>' + right;
  });
  const original = 'https://github.com/unmet23-lab/synk-appsscript/blob/master/' +
    row.source.split('/').map(encodeURIComponent).join('/');
  const policy = localPath('docs/AI_운영원칙.md');
  const banner = `> **공유 사본** · [이 컴퓨터의 작업 원문](<${localPath(row.source)}>)\n` +
    `> 실제 원본 경로: \`${localPath(row.source)}\`\n` +
    `> 원본 파일 수정 시각: ${fs.statSync(within(root, row.source)).mtime.toISOString()} · SHA256 \`${hash(data)}\`\n` +
    `> 작업 전에 [공통 운영 원칙](<${policy}>)과 관련 정본·최근 변경을 실제로 다시 읽는다. 이 파일은 실시간으로 갱신되지 않는다.\n` +
    `> 보조: [GitHub 게시본](${original})은 현재 작업 파일과의 일치를 확인하지 않았으며, 아직 없거나 이전 내용일 수 있다. 다른 기기에서 로컬 원본에 접근하지 못하면 최신 여부는 미확인이다.\n\n`;
  return Buffer.from(banner + body, 'utf8');
}
// cache: 읽기 기록(onedrive-read-cache.cjs). 주면 stat가 지난번에 읽어 확인한 그대로인 시스템 원본은 다시 읽지 않고,
//   직전 SHA 확인 영수증과 크기·수정 시각이 같은 로컬 사본도 온라인 전용 사본처럼 다시 읽지 않는다. 단 30분마다 1/48씩은
//   그래도 사본을 다시 읽어 SHA를 대조한다(하루 한 바퀴). 원본이 실제로 바뀌었으면 예전처럼 읽고 분류하고 대조한다(10-19).
// prePlanned: 부르는 쪽이 같은 줄로 방금 oneDrivePlan을 만들었다. 복사 안에서 목록 전체를 다시 읽어 만들지 않고,
//   그 사이 분류가 바뀐 파일은 다시 만든 목록이 그랬듯 건너뛴 수(skipped)로 센다.
function copy(root, destination, rows, { google = false, previousFiles = [], recordFiles = false, onProgress = () => {}, cache = null, prePlanned = false } = {}) {
  // 사용자 파일은 자동 삭제하지 않는다. 선택된 파일만 검증해서 갱신한다.
  for (const row of rows) { within(rowRoot(root, row), row.source); within(destination, row.brand + '/' + row.target); }
  const plan = google ? { selected: rows.filter(row => !row.oneDriveOnly), rejected: [] } : prePlanned ? { selected: rows, rejected: [] } : oneDrivePlan(root, rows, { cache });
  const linkedSource = linkPaths(plan.selected.map(row => within(rowRoot(root, row), row.source)));
  const linkedTarget = linkPaths(plan.selected.map(row => within(destination, row.brand + '/' + row.target)),
    { cloudDestinationRoot: google ? null : destination });
  let written = 0, unchanged = 0;
  const previous = new Map(previousFiles.map(row => [path.resolve(row.target), row]));
  const files = [], sourceDrift = [], disappeared = [], lateRejected = [], directories = new Set();
  const lateReject = (row, reason) => { lateRejected.push({ source: row.source, sourceScope: row.sourceScope || 'SYNK-appsscript', reason }); };
  for (const row of plan.selected) {
    onProgress();
    const source = within(rowRoot(root, row), row.source);
    const target = within(destination, row.brand + '/' + row.target);
    if (prePlanned && linkedSource(source)) { lateReject(row, 'link-or-reparse-point'); continue; }
    if (linkedSource(source) || linkedTarget(target)) throw new Error('링크·reparse 경로는 복사하지 않습니다');
    const useCache = cache && !google && row.kind === 'system';
    let sourceBefore, original = null, known = null;
    try {
      // 링크는 위에서 이미 막았으니 lstat 한 번으로 종류·크기·시각을 함께 본다(예전 lstat + stat 두 번).
      sourceBefore = fs.lstatSync(source, { bigint: true });
      if (!sourceBefore.isFile()) { if (prePlanned) { lateReject(row, 'not-regular-file'); continue; } throw new Error('일반 파일 필요'); }
      if (!google && sourceBefore.size > BigInt(MAX_TEXT_BYTES)) { if (prePlanned) { lateReject(row, 'over-10MiB'); continue; } throw new Error('복사 직전 파일 크기 초과'); }
      known = useCache ? cache.lookup(source, sourceBefore, row.source) : null;
      if (!known) original = fs.readFileSync(source);
    } catch (error) {
      // 목록을 만든 뒤 지워진 원본은 더 이상 원본이 아니다. 목록 단계의 missing-or-unreadable과 같게 건너뛰고 수만 남긴다(10-19).
      if (error.code !== 'ENOENT') throw error;
      disappeared.push({ source, reason: 'source-disappeared-before-copy' });
      continue;
    }
    // 시스템 원본의 공유 사본은 원문 바이트 그대로다(payload). 읽기 기록이 있으면 그 SHA가 곧 사본 SHA다.
    let data = null, digest, bytes, info = {}, reason = null;
    const load = () => {
      original ||= fs.readFileSync(source);
      reason = google ? null : textPolicy(row.source, original, info);
      if (!reason) { data = payload(root, row, original); digest = hash(data); bytes = data.length; }
    };
    if (known) { reason = known.reason; digest = known.sha256; bytes = known.bytes; }
    else load();
    if (reason) { if (prePlanned) { lateReject(row, reason); continue; } throw new Error('복사 직전 안전 분류가 달라졌습니다'); }
    if (!google && bytes > MAX_TEXT_BYTES) throw new Error('공유 사본이 파일 크기 한도를 넘습니다');
    const directory = path.dirname(target);
    if (!directories.has(directory)) { fs.mkdirSync(directory, { recursive: true }); directories.add(directory); }
    let b = null;
    try { b = fs.statSync(target); } catch { b = null; }
    // 온라인 전용 Cloud 파일은 비교하려고 내려받지 않는다. 로컬 상주 사본은 SHA로 대조한다.
    const prior = previous.get(path.resolve(target)), onlineOnly = linkedTarget.cloudOnlineOnly.has(target);
    // 직전 실제 SHA 검증 영수증과 목적 파일의 크기·수정 시각이 모두 같을 때만 사본을 읽거나 다시 쓰지 않는다.
    // 원문 SHA는 매번 확인한다(stat가 지난번에 읽은 그대로면 그때 읽은 SHA). 로컬 사본은 읽기 기록을 쓰는 실행에서만, 1/48은 다시 읽는다.
    const receiptUnchanged = b && prior && prior.sha256 === digest && prior.expectedBytes === b.size && prior.targetModifiedMs === b.mtimeMs &&
      prior.verifiedAt && (onlineOnly || (cache && !google && !cache.inSlot(target)));
    let verifiedAt = new Date().toISOString(), verification = 'sha256-readback', targetAfter = null;
    if (receiptUnchanged) {
      unchanged++; verifiedAt = prior.verifiedAt; verification = 'prior-sha256-and-current-metadata'; targetAfter = b;
    } else if (b && !onlineOnly && bytes === b.size && digest === hash(fs.readFileSync(target))) {
      unchanged++;
    } else {
      if (!data) {
        // 기록으로 넘긴 원본을 쓰려면 지금 읽는다. 그 사이 바뀌었으면 새 내용으로 다시 분류한다(아래 stat 비교가 변경을 실패로 잡는다).
        load();
        if (reason) { if (prePlanned) { lateReject(row, reason); continue; } throw new Error('복사 직전 안전 분류가 달라졌습니다'); }
        if (!google && bytes > MAX_TEXT_BYTES) throw new Error('공유 사본이 파일 크기 한도를 넘습니다');
      }
      fs.writeFileSync(target, data);
      if (digest !== hash(fs.readFileSync(target))) throw new Error('복사 검증 실패: ' + row.target);
      written++;
    }
    const sourceAfter = fs.statSync(source, { bigint: true });
    targetAfter ||= fs.statSync(target);
    const drifted = sourceAfter.size !== sourceBefore.size || sourceAfter.mtimeNs !== sourceBefore.mtimeNs;
    if (drifted) sourceDrift.push({ source, reason: 'source-changed-during-copy' });
    else if (useCache && original) cache.remember(source, sourceBefore, sourceAfter, hash(original), original.length, row.source, null, info);
    if (recordFiles) files.push({ source, sourceScope: row.sourceScope || 'SYNK-appsscript', target,
      expectedBytes: bytes, sha256: digest, targetModifiedMs: targetAfter.mtimeMs, targetChangedMs: targetAfter.ctimeMs,
      verifiedAt, verification, sourceModifiedAt: sourceAfter.mtime.toISOString() });
  }
  const rejected = [...plan.rejected, ...lateRejected];
  return { total: plan.selected.length, written, unchanged, skipped: rejected.length,
    bytes: plan.selected.reduce((n, x) => n + x.bytes, 0), ...(disappeared.length ? { disappeared: disappeared.length } : {}),
    ...(recordFiles ? { files, sourceDrift, rejected } : {}) };
}
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('사용: node tools/이어하기꾸러미.js [--재기] [--원드라이브|--구글]\n--재기: 복사 없이 목록만 확인\nOneDrive: 저장소 소스 + 작업 MD(QA·미디어 폴더 포함) + Videos MD + 개인 작업규칙 + 창고·기존 백업의 복원 도구/목록(10MiB 이하). 이력·미디어·비밀·의존성·임시/빌드·링크 제외. worktree MD는 별도 중복 대조 보존. 전체 PC 백업이나 클라우드 동기화 완료를 뜻하지 않습니다.');
    return;
  }
  const unknown = args.filter(arg => !['--재기', '--원드라이브', '--구글', '--저장소'].includes(arg));
  if (unknown.length) throw new Error('알 수 없는 옵션: ' + unknown.join(', '));
  if (args.includes('--저장소')) throw new Error('전체 이력 복제는 종료했습니다. 일반 핵심 자료 갱신을 사용하세요.');
  if (args.includes('--원드라이브') && args.includes('--구글')) throw new Error('목적지는 한 옵션만 지정하세요.');
  if (!args.includes('--재기')) require('./비전동기화.js').syncVisionSources();
  const rows = 목록();
  if (args.includes('--재기')) {
    if (!args.includes('--구글')) {
      const plan = oneDrivePlan(ROOT, rows);
      const reasons = {};
      for (const row of plan.rejected) reasons[row.reason] = (reasons[row.reason] || 0) + 1;
      console.log(JSON.stringify({ location: 'OneDrive', dryRun: true, files: plan.selected.length,
        systemFiles: plan.selected.filter(row => row.kind === 'system').length,
        bytes: plan.selected.reduce((n, row) => n + row.bytes, 0), excluded: reasons,
        scopes: rows.scopes.map(({ name, status }) => ({ name, status,
          files: plan.selected.filter(row => row.sourceScope === name).length })),
        scope: 'three-repositories-and-vault-top-level-scripts', cloudVerified: false }));
    }
    if (!args.includes('--원드라이브')) {
      const selected = rows.filter(row => !row.oneDriveOnly);
      console.log(JSON.stringify({ location: 'Google Drive', dryRun: true, files: selected.length,
        bytes: selected.reduce((n, row) => n + row.bytes, 0), cloudVerified: false }));
    }
    return;
  }
  const destinations = [];
  if (!args.includes('--구글')) destinations.push({
    base: process.env.OneDrive || 'C:\\Users\\q1212\\OneDrive', google: false });
  if (!args.includes('--원드라이브')) destinations.push({ base: 'G:\\내 드라이브', google: true });
  let errors = 0;
  for (const dest of destinations) {
    if (!fs.existsSync(dest.base)) { console.error('연결 없음: ' + (dest.google ? 'Google Drive' : 'OneDrive')); errors++; continue; }
    const result = copy(ROOT, dest.base, rows.filter(r => dest.google ? !r.oneDriveOnly : !금지인가(r.source)), { google: dest.google });
    console.log(JSON.stringify({ location: dest.google ? 'Google Drive' : 'OneDrive', ...result }));
  }
  if (errors) process.exitCode = 1;
}
if (require.main === module) main();
// 읽기 기록(onedrive-read-cache.cjs)은 분류(textPolicy)와 시스템 원본의 사본 바이트(payload)를 정하는 코드·규칙·검토 목록이
// 그대로일 때만 쓴다. 파일 전체가 아니라 그 함수·규칙의 실제 불러온 판으로 지문을 만든다. 범위·목록 규칙처럼 분류와 무관한
// 수정에 기록 전체를 버리지 않고, 파일을 다시 읽는 사이 바뀌는 틈도 없다(10-19).
const policyFingerprint = () => crypto.createHash('sha256').update(JSON.stringify([
  [textPolicy, 금지인가, 문서인가, excludedPath, descriptiveMarkdown, documentExampleText, originalReviewPaths, payload].map(String),
  [...forbidden, sourceCode, credentialName, excluded, generatedDirectory].map(String), MAX_TEXT_BYTES,
  reviewedDocumentExamples, reviewedSourceLiterals, reviewedExactSources])).digest('hex');
const POLICY_FINGERPRINT = policyFingerprint();
module.exports = { 금지인가, 문서인가, within, 목록, 시스템목록, systemScopes, writeSafeRecoveryIndex, workTextFiles, creationSources, excludedPath, oneDrivePlan, textPolicy, linkPaths, cloudDestinationAllows, copy, payload, MAX_TEXT_BYTES, POLICY_FINGERPRINT, policyFingerprint, GENERATED_DIRECTORY: generatedDirectory };
