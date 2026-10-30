// 검수 입력·배포 후보의 내용 계약. 모델 호출이나 배포는 하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
export const 정규해시 = v => sha256(JSON.stringify(sort(v)));
export function 안전경로(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..') || relative.includes(':')) throw new Error(`검수 상대 경로가 아니다: ${relative}`);
  const f = path.resolve(root, relative);
  // 후보 안의 symlink/junction을 따라 저장소 밖 파일을 읽지 않는다.
  for (let p = f; p !== path.resolve(root); p = path.dirname(p)) if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error(`검수 경로에 연결 파일이 있다: ${relative}`);
  return f;
}
function git(cwd, args, buffer = false) {
  const r = spawnSync('git', args, { cwd, windowsHide: true, maxBuffer: 1 << 28, ...(buffer ? {} : { encoding: 'utf8' }) });
  if (r.status !== 0) throw new Error(`검수 git 읽기 실패: ${args[0]}`);
  return r.stdout;
}
/** 파일상태와 같은 꼴로 바이트를 맞춘다 — 글(utf8)은 CRLF → LF, 이진은 그대로. 해시는 맞춘 바이트의 sha256이다. */
export function 맞춘내용(b) {
  const text = !b.subarray(0, 8000).includes(0) && Buffer.from(b.toString('utf8')).equals(b);
  return text ? { 바이트: Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'), 해시꼴: 'utf8-lf' } : { 바이트: b, 해시꼴: 'bytes' };
}
/** 내용(Map)을 주면 맞춘 바이트를 해시 이름으로 담는다 — 다시 검수가 앞 판과 지금 판의 diff를 만든다. */
export function 파일상태(root, relative, { rev = null, 역할 = '소스', 내용 = null } = {}) {
  let b, mode;
  if (rev) {
    const tree = git(root, ['ls-tree', rev, '--', relative]).trim();
    if (!tree) return { 경로: relative, sha256: null, 모드: null, 역할 };
    mode = tree.split(' ')[0];
    if (!['100644', '100755'].includes(mode)) throw new Error(`검수할 수 없는 git 모드: ${relative} ${mode}`);
    b = git(root, ['show', `${rev}:${relative}`], true);
  } else {
    const f = 안전경로(root, relative);
    if (!fs.existsSync(f)) return { 경로: relative, sha256: null, 모드: null, 역할 };
    if (!fs.statSync(f).isFile()) throw new Error(`검수 대상이 파일이 아니다: ${relative}`);
    b = fs.readFileSync(f);
    const stage = git(root, ['ls-files', '--stage', '--', relative]).trim();
    mode = stage ? stage.split(' ')[0] : process.platform !== 'win32' && (fs.statSync(f).mode & 0o111) ? '100755' : '100644';
    if (process.platform !== 'win32') mode = fs.statSync(f).mode & 0o111 ? '100755' : '100644';
  }
  const m = 맞춘내용(b), h = sha256(m.바이트);
  if (내용) 내용.set(h, m.바이트);
  return { 경로: relative, sha256: h, 모드: mode, 역할, 해시꼴: m.해시꼴 };
}
export function 소스스냅샷(설정, files, { 내용 = null } = {}) {
  const paths = new Map();
  for (const f of files) { paths.set(f.경로, '소스'); if (f.옛경로) paths.set(f.옛경로, '소스'); }
  for (const p of 설정.곁 || []) paths.set(p.replace(/:\d+-\d+$/, '').replace(/\\/g, '/'), '의존');
  for (const p of 설정.시험 || []) if (!/[*?]/.test(p)) paths.set(p.replace(/\\/g, '/'), '시험');
  return [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([p, 역할]) => 파일상태(설정.저장소, p, { rev: 설정.끝 === '작업본' ? null : 설정.끝.커밋, 역할, 내용 }));
}
export function 후보읽기(folder) {
  if (!folder) return null;
  const root = path.resolve(folder), raw = JSON.parse(fs.readFileSync(path.join(root, '후보.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (raw.판 !== 1 || !['synk.im', 'apps-script'].includes(raw.종류) || !Array.isArray(raw.항목) || !raw.항목.length) throw new Error('배포 후보 manifest 판·종류·항목이 잘못됐다');
  const seen = new Set();
  const 항목 = raw.항목.map(x => {
    const f = 안전경로(root, x.경로);
    if (seen.has(x.경로)) throw new Error(`배포 후보 경로 중복: ${x.경로}`);
    seen.add(x.경로);
    if (!['새', '바꿈', '토큰', '지움'].includes(x.종류)) throw new Error(`배포 후보 종류 오류: ${x.경로}`);
    if (x.종류 === '지움') {
      if (x.sha256 !== null || x.모드 !== null || fs.existsSync(f)) throw new Error(`삭제 후보에 내용이 남았다: ${x.경로}`);
    } else {
      if (!/^[a-f0-9]{64}$/.test(x.sha256 || '') || !['100644', '100755'].includes(x.모드)) throw new Error(`배포 후보 해시·모드 오류: ${x.경로}`);
      if (sha256(fs.readFileSync(f)) !== x.sha256) throw new Error(`배포 후보 내용 불일치: ${x.경로}`);
    }
    return { 경로: x.경로, sha256: x.sha256, 모드: x.모드, 종류: x.종류 };
  }).sort((a, b) => a.경로.localeCompare(b.경로));
  const manifest = { 판: 1, 종류: raw.종류, 항목 };
  return { ...manifest, manifestSha256: 정규해시(manifest) };
}
// 검수 정책 판. 2(2026-10-24 다섯 가지 ①)부터 Claude 백엔드의 필수 검수는 GPT 하나다. 1(10-22~24)은 아르곤·GPT 둘을 적었다 —
// 옛 판 묶음도 판정은 아래 대체순서(지금 규칙)로 하므로, 둘 다 받은 옛 증거와 GPT만 받은 옛 증거가 그대로 통과한다.
export const 정책판 = 2;
// 일회 작업의 직접 사용자 지정. 기본 정책/과거 증명에는 적용하지 않는다.
export const 사용자지정원문 = Object.freeze({
  implementation: '이번 4건은 GPT 구현 허용',
  c05: 'C05도 GPT 수정 허용',
  review: '한번 니가 직접 검수해봐, 그리고 페이블 검수 대신에 아르곤 검수만 해봐',
  deployment: '그리고 배포직전에 지금 작업한거 클로드에게 배포해도되냐고 물어보고 괜찮다고하면 배포하자',
});
export const 단독검수원문 = Object.freeze({
  implementationReviewDeployment: '검증을 일단 니가 단독으로 진행하고 남은거 전부 마무리 및 최적화 하고 배포까지 진행해',
});
// 10-28의 네 최적화 작업에 한한 직접 승인. 기존 작업의 원문/범위와 기본 검수 정책은 유지한다.
export const 최적화검수원문 = Object.freeze({
  implementation: '1,2,3,4 전부 지금 최적화 및 보안 진행하자.',
  independentReview: '이번 작업은 GPT 구현·독립 GPT 검수로 계속 진행',
});
// 별도 후속 요청: 플랫폼 목록·검색의 PATH 표시만 숨긴다. 기존 작업의 권한에는 합치지 않는다.
export const PATH비공개작업ID = 'platform-path-private-20261028';
export const PATH비공개원문 = Object.freeze({
  implementation: '아 그리고 지금 synk 플렛폼 왼쪽 목록에 synk path도 있잖아.  이거는 일단 비공개처리하자.',
  independentReview: '이번 작업은 GPT 구현·독립 GPT 검수로 계속 진행',
  visibilityScope: '플랫폼 목록·검색에서만 숨김',
});
export const Atlas작업원문 = Object.freeze({ implementationReview: '이번 작업은 GPT 구현·독립 GPT 검수로 진행' });
export const Atlas작업ID = 'atlas-world-learning-20261028';
export function 사용자지정판(file) {
  const record = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return record.version === 2 ? 4 : 3;
}
const 지정작업 = 'spaghetti-refactor-20261023';
const 지정검수자 = ['GPT', '아르곤'];
const GPT화면경로 = {
  E01: /^(?:experiences\/synk-world-app\/|world\/)(?:app-shell|world-session)\.mjs$/,
  E06: /^(?:(?:experiences\/path-travel|try\/travel)\/planner-account\.mjs|(?:experiences\/synk-account|try\/travel\/synk-account)\/src\/(?:account-notebook(?:-resource)?|personal-state)\.mjs)$/,
  E07: /^(?:(?:experiences\/relationship-care|care)\/(?:app\.mjs|care-transient-session\.mjs|index\.html|build-manifest\.json))$/,
  E09: /^experiences\/synk-teacher-world\/(?:app|teacher-host|selection-session)\.mjs$/,
  C05: /^tools\/company-messenger\/public\/messenger-state\.js$/,
};
// 이 작업의 공개 소비처 19개와 공식 공개 도구가 토큰만 바꾸는 9개 HTML.
const 공개소비처경로 = new Set([
  'id/vendor/atlas-learning.js', 'id-rehearsal/vendor/atlas-learning.js', 'synk-town/atlas-learning.js',
  ...['blank-slice', 'entry-check', 'learning-hub', 'order-rush', 'racing', 'rhythm', 'runner', 'story-classroom', 'talk-rally', 'word-magic'].map(x => `try/${x}/atlas-learning.js`),
  'try/order-rush/beginner-atlas-learning.js',
  ...['blank-slice', 'entry-check', 'order-rush', 'rhythm', 'runner', 'talk-rally'].map(x => `try/${x}/index.html`),
  ...['korean-rhythm', 'korean-runner', 'hangul-stage'].flatMap(x => [`world/${x}/atlas-learning.js`, `world/${x}/index.html`]),
  'world/brand-opening/content/life-standalone.mjs', 'world/world-account.bundle.mjs',
]);
function 지정범위맞나(scope, p) {
  if (GPT화면경로[scope]?.test(p)) return true;
  if (scope === 'E01') return /^world\/(?:index|desktop|mobile)\.html$/.test(p);
  if (scope === 'E09') return /^teacher-world\/(?:app|teacher-host|selection-session)\.mjs$/.test(p);
  if (scope === 'E10') return /^(?:(?:experiences\/synk-town|world\/town)\/(?:day-app|day-observation|walk-packets)\.mjs|world\/town\/day\.html)$/.test(p);
  if (['E11', 'E12'].includes(scope)) return 공개소비처경로.has(p);
  return false;
}
const 단독원천추가 = new Set([
  ...['korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'learning-hub', 'entry-check', 'story-classroom', 'blank-slice', 'talk-rally', 'word-magic', 'hangul-stage'].map(game => `experiences/${game}/atlas-learning.js`),
  'experiences/brand-opening/content/life-standalone.mjs',
  ...['cafe-visit-soldout-2.mp3', 'cafe-compose-2.mp3', 'manifest.json'].map(file => `experiences/brand-opening/assets/cafe-voice/${file}`),
  ...['entry-check', 'order-rush', 'talk-rally'].map(game => `experiences/${game}/index.html`),
  'desktop/renderer/platform-continuity.mjs', 'desktop/renderer/platform-continuity.css',
  'docs/마케팅/온라인마케팅지도/engagement/company/public/teaching-host.js',
]);
// 같은 단독 마감의 10-27 후속: 사용자가 남은 경고 정리를 직접 요청한 여섯 공개 쪽.
// 기본 정책·원천 범위·검수자·해시/최종 판정 조건은 넓히지 않는다.
const 단독경고공개 = new Set([
  'name/index.html', 'name/family/index.html', 'nombre/index.html',
  'rl/index.html', 'privacy/index.html', 'lab/topik4/index.html',
]);
const 단독경고기준 = /^\.github\/site-check\/baseline\/(?:axe\.json|manifest\.json|(?:desktop|mobile)\/(?:name(?:~family)?|nombre|rl|privacy|lab~topik4|world~hangul-stage)\.(?:jpg|png))$/;
function 단독범위맞나(scope, p, role) {
  if (scope !== 'spaghetti-followup-20261026') return false;
  if (role === '배포 후보') return !/(?:^|\/)(?:qa|tests|_ops)(?:\/|$)/.test(p) &&
    (단독경고공개.has(p) || 단독경고기준.test(p) || ['account/dist/client.js', 'account/dist/platform.js', 'account/client.html', 'account/platform.html'].includes(p) || /^(?:id(?:-rehearsal)?\/|try\/|world\/|care\/|synk-town\/|teacher-world\/)/.test(p));
  return 단독원천추가.has(p) || /^(?:atlas\/|account\/|experiences\/(?:synk-account|synk-world-app|synk-town|synk-teacher-world|relationship-care|play-common|path-travel)\/|tests\/|tools\/(?:lib\/|company-messenger\/|(?:build-|check-|sync-atlas|검수|짝검사)[^/]*$)|package(?:-lock)?\.json$)/.test(p);
}
const Atlas원천파일 = new Set([
  '엔진_콘텐츠AI.js', 'experiences/brand-opening/world-strings.mjs', 'experiences/brand-opening/content/life-standalone.mjs', 'experiences/brand-opening/content/life-ui.css',
  'tools/lib/검수증명.mjs', 'tools/검수묶음.mjs', 'tools/lib/topik-review-atlas-20261028.mjs', 'tools/lib/topik-review-atlas-tea-20261028.mjs',
  'tools/lib/town-tea-review-unit.mjs',
  ...['build-game-learning.js', 'build-world-app-public.mjs', 'build-world-topik-items.mjs', 'topik-review.mjs',
    'check-atlas-content-supply.mjs', 'town-data-build.mjs', 'build-study-public.mjs', 'check-account-bundles.js',
    'sync-atlas-copies.js', 'synk-town-build.js', 'town-source-loader.mjs', 'town-source-path.js', '마이그레이션_합본.js'].map(p => `tools/${p}`),
  ...['modern-town-domain.mjs', 'modern-town-server.js', 'modern-town-store.js', 'synk-server.js', 'synk-store.js',
    'town-scope.js', 'study-progress-rules.js', 'town-learning.js'].map(p => `lib/${p}`),
  'supabase/migrations/20261028180000_study_progress_c18.sql',
  'supabase/functions/_shared/synk-atlas-summary.js',
  'supabase/functions/_shared/synk-personal-runtime.js', 'tools/synk-personal-source-manifest.json',
  'tests/lib/migration-branches.js', 'tests/backend-followup-runtime.test.js', 'tools/backend-runtime-manifest.json',
  'supabase/L0_스키마.sql', 'supabase/확인_적용후상태.sql',
  'docs/Temper_개입로그_규격_v1.md', 'docs/맞춤학습_로컬연결.md',
  'docs/디자인/싱크타운_학습개인화다리_설계_20261022.md',
  'docs/_ops/배포장부.jsonl', 'docs/_ops/qa/atlas-world-learning-20261028/README.md',
  ...['결정.md', '트랙.md', '관문_자동화.md'].map(p => `docs/_ops/${p}`),
]);
// 이번 학습 묶음의 참조 토큰을 공개 도구가 바꾸는 HTML만 추가한다.
const Atlas토큰HTML = new Set([
  'id/index.html', 'id-rehearsal/index.html', 'synk-town/linked.html',
  ...['learning-hub', 'racing', 'story-classroom', 'word-magic'].map(p => `try/${p}/index.html`),
]);
function Atlas범위맞나(scope, p, role) {
  if (scope !== Atlas작업ID) return false;
  if (role === '배포 후보') return !/(?:^|\/)(?:qa|tests|_ops)(?:\/|$)/.test(p)
    && (/^(?:world\/|try\/(?:order-rush|rhythm)\/|study\/|account\/)/.test(p) || 공개소비처경로.has(p) || Atlas토큰HTML.has(p));
  return Atlas원천파일.has(p) || 단독원천추가.has(p) && /atlas-learning\.js$/.test(p)
    || /^(?:atlas\/|strata\/|account\/|lib\/atlas\/|experiences\/(?:synk-account|synk-world-app|synk-town|korean-study|korean-rhythm|order-rush|topik-items)\/)/.test(p)
    || /^tools\/lib\/(?:loom|vellum|trail|prism|temper|reed)(?:[-.][a-zA-Z0-9_.-]+)\.(?:[cm]?js|json)$/.test(p)
    || /^supabase\/functions\/(?:synk-account|synk-learning|synk-town)\//.test(p)
    || /^tests\/(?:atlas-|strata-|world-|town-|study-|검수)[^/]+\.test\.(?:[cm]?js)$/.test(p)
    || /^docs\/(?:엔진8종_상향설계_v3|아틀라스_설계|코어엔진_설계|Strata_설계|미니게임_TOPIK_I_학습기준)\.md$/.test(p);
}
function 최적화범위맞나(scope, p, role, kind) {
  if (scope === 'optimization-pc-publication-20261028') return role === '배포 후보' &&
    (/^(?:(?:en\/)?(?:index\.html|knowledge\.json|llms\.txt|docs\/platform\.md|(?:lab|shift|pulse|path|atlas|founder)\/index\.html)|desktop\/releases\/(?:preview\.json|client\.js))$/.test(p) || (kind === '토큰' && /^(?:en\/)?app\.js$/.test(p)));
  if (scope !== 'optimization-security-20261028') return false;
  if (role === '배포 후보') return /^(?:world\/(?:world-account\.bundle\.mjs|life-content\.mjs|(?:index|desktop|mobile)\.html)|account\/(?:dist\/(?:client|platform)\.js|(?:client|platform)\.html)|desktop\/releases\/(?:preview\.json|client\.js))$/.test(p) ||
    /^\.github\/desktop-preview\/(?:package(?:-lock)?\.json|unified\/(?:release-input\.json|source\/renderer\/generated\/(?:member-[a-z-]+\.(?:mjs|manifest\.json)|member-shared\/chunk-[A-Z0-9]{8}\.mjs)|tools\/(?:freeze-platform-release|build-child-release)\.cjs|installer\/(?:build-signal|tests\/test)\.cjs))$/.test(p);
  return p === '.github/workflows/wide-tests.yml' ||
    /^tools\/(?:ci(?:넓은시험\.js|읽기대조\.cjs|읽기기록\.cjs)|(?:build-member-activity|check-account-bundles)\.js|build-world-account\.mjs|검수묶음\.mjs|lib\/(?:검수증명\.mjs|member-[a-z-]+\.cjs)|company-release\/[a-z-]+\.cjs)$/.test(p) ||
    /^docs\/마케팅\/온라인마케팅지도\/engagement\/company\/post-performance(?:[a-z-]*|[a-z-]*\.test)\.mjs$/.test(p) ||
    /^desktop\/(?:package(?:-lock)?\.json|renderer\/generated\/(?:member-[a-z-]+\.(?:mjs|manifest\.json)|member-shared\/[A-Za-z0-9_-]+\.mjs)|tools\/(?:package|freeze-platform-release|build-platform-release|build-child-release)\.cjs|installer\/(?:build-signal|build-platform-children|tests\/(?:measure|test))\.cjs|mac-dmg\/(?:build-platform-children-mac|repackage)\.cjs|tests\/[a-z-]+\.test\.cjs)$/.test(p) ||
    /^experiences\/synk-world-app\/world-account\.bundle\.mjs$/.test(p) ||
    /^(?:account|experiences\/synk-account)\/dist\/[a-z-]+\.(?:js|json)$/.test(p) || p === 'experiences/synk-account/build-manifest.json' ||
    /^tests\/(?:ci[^/]*|build-member-activity|build-world-account|account-bundle-scope|member-understanding[^/]*|world-[a-z-]+|검수[^/]*|desktop-[a-z-]+)\.test\.(?:js|mjs|cjs)$/.test(p);
}
const PATH비공개원천 = new Set([
  ...['library', 'launcher', 'member-home'].map(name => `desktop/renderer/${name}.mjs`),
  'desktop/tests/development-catalog.test.cjs', 'desktop/tests/path-visibility.test.mjs',
  'tools/lib/검수증명.mjs', 'tests/검수PATH비공개.test.mjs',
]);
const PATH비공개빌드 = new Set([
  '.github/desktop-preview/unified/release-input.json',
  ...['library', 'launcher', 'member-home'].map(name => `.github/desktop-preview/unified/source/renderer/${name}.mjs`),
]);
function PATH비공개범위맞나(scope, p, role, kind) {
  if (scope === 'platform-path-private-publication-20261028') return 최적화범위맞나('optimization-pc-publication-20261028', p, role, kind);
  if (scope !== PATH비공개작업ID) return false;
  return (role === '배포 후보' ? PATH비공개빌드 : PATH비공개원천).has(p);
}
function 사용자지정정책(o, files, candidate, 판 = 3) {
  const 단독 = 판 === 4, 검수자 = 단독 ? ['GPT'] : 지정검수자, 최종 = 단독 ? 'GPT' : 'Claude';
  if (o.종류 !== '화면' && !단독) throw new Error('사용자지정은 승인된 화면만 지원한다 — 백엔드의 기존 GPT·Claude 정책을 바꾸지 않는다');
  if (단독 && !['화면', '백엔드'].includes(o.종류)) throw new Error('사용자지정 검수 종류가 잘못됐다');
  if (o.예외 || o.페이블생략 != null || (o.GPT구독 && o.GPT구독 !== '유지') || o.끝 !== '작업본') throw new Error('사용자지정은 현재 작업본의 독립 새 묶음으로만 준비하며 기존 예외와 섞지 않는다');
  const raw = fs.readFileSync(o.사용자지정), 지정 = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  if (!지정 || typeof 지정 !== 'object' || Array.isArray(지정) || Object.keys(지정).sort().join(',') !== ['version', 'taskId', 'userStatements', 'requiredReviewers', 'finalReviewer', 'allowFallback', 'sources', 'candidate'].sort().join(',')) throw new Error('사용자지정 JSON 필드가 잘못됐다');
  const atlas = 단독 && 지정.taskId === Atlas작업ID;
  const 최적화 = 단독 && 지정.taskId === 'optimization-security-20261028';
  const PATH비공개 = 단독 && 지정.taskId === PATH비공개작업ID;
  if (지정.version !== (단독 ? 2 : 1) || 지정.taskId !== (atlas ? Atlas작업ID : 최적화 ? 'optimization-security-20261028' : PATH비공개 ? PATH비공개작업ID : 단독 ? 'spaghetti-finish-20261026' : 지정작업)
    || 정규해시(지정.userStatements) !== 정규해시(atlas ? Atlas작업원문 : 최적화 ? 최적화검수원문 : PATH비공개 ? PATH비공개원문 : 단독 ? 단독검수원문 : 사용자지정원문)) throw new Error('사용자지정 작업 ID·직접 사용자 원문이 승인 범위와 다르다');
  if (atlas && files.some(f => f.옛경로 || /^[DR]/.test(f.상태 || ''))) throw new Error('Atlas 사용자지정은 원천 삭제·이름 변경을 허용하지 않는다');
  if (PATH비공개 && files.some(f => f.옛경로 || /^[DR]/.test(f.상태 || ''))) throw new Error('PATH 비공개 사용자지정은 원천 삭제·이름 변경을 허용하지 않는다');
  if (정규해시(지정.requiredReviewers) !== 정규해시(검수자) || 지정.finalReviewer !== 최종 || 지정.allowFallback !== false) throw new Error(`사용자지정은 묶음별 ${검수자.join('·')}와 최종 전체 ${최종} 판정이 필요하며 대체를 허용하지 않는다`);
  const checkRows = (rows, expected, role) => {
    if (!Array.isArray(rows) || rows.length !== expected.length) throw new Error(`사용자지정 ${role} 경로 전체가 맞지 않는다`);
    const seen = new Set();
    for (const row of rows) {
      안전경로(o.저장소, row.path);
      const match = expected.find(f => f.path === row.path);
      if (seen.has(row.path) || !['GPT', 'Claude', 'GPT+Claude', '기계생성'].includes(row.author)
        || !(atlas ? Atlas범위맞나(row.scope, row.path, role) : 최적화 ? 최적화범위맞나(row.scope, row.path, role, match?.kind) : PATH비공개 ? PATH비공개범위맞나(row.scope, row.path, role, match?.kind) : 단독 ? 단독범위맞나(row.scope, row.path, role) : 지정범위맞나(row.scope, row.path))) throw new Error(`사용자지정 범위·작성자 오류: ${row.path}`);
      seen.add(row.path);
      if (!단독 && row.author.includes('GPT') && !GPT화면경로[row.scope]?.test(row.path)) throw new Error(`GPT 화면 사용자 승인 밖 경로: ${row.path}`);
      if (!match || !/^[a-f0-9]{64}$/.test(row.sha256 || '') || row.sha256 !== match.sha256) throw new Error(`사용자지정 ${role} SHA 불일치: ${row.path}`);
    }
  };
  const sourcePaths = [...new Set(files.flatMap(f => [f.경로, ...(f.옛경로 ? [f.옛경로] : [])]))].sort();
  const source = sourcePaths.map(p => ({ path: p, sha256: sha256(fs.readFileSync(안전경로(o.저장소, p))) }));
  checkRows(지정.sources, source, '소스');
  if (candidate) {
    if (!candidate.항목.length) throw new Error('사용자지정의 배포 후보가 비었다');
    if (!지정.candidate || 지정.candidate.manifestSha256 !== candidate.manifestSha256 || 지정.candidate.rawManifestSha256 !== sha256(fs.readFileSync(path.join(o.배포후보, '후보.json')))) throw new Error('사용자지정 배포 후보 manifest SHA 불일치');
    if (candidate.항목.some(f => f.종류 === '지움')) throw new Error('사용자지정은 삭제 후보를 허용하지 않는다');
    checkRows(지정.candidate.files, candidate.항목.map(f => ({ path: f.경로, sha256: f.sha256, kind: f.종류 })), '배포 후보');
  } else if (지정.candidate !== null || !source.length) throw new Error('사용자지정의 검수 대상이 없다');
  return { 판, 작성자: '혼합', 종류: o.종류, GPT구독: '유지', 필수: [...검수자], 예외: null,
    사용자지정: { ...지정, 파일sha256: sha256(raw) } };
}

// 2026-10-29 이번 Atlas 엔진 생성물의 GPT·Claude 공동 검수만 승인했다.
export const 개인화생성물작업ID = 'atlas-personalization-20261029';
const 개인화웹저장소호스트 = new Set(['account/dist/client.js','care/vendor/account/core.mjs','id-rehearsal/dist/app.js','id/dist/app.js','try/travel/synk-account/src/core.mjs']);
const 개인화웹경로 = new Set([
  ...개인화웹저장소호스트,
  "account/client.html",
  "account/dist/platform.js",
  "account/platform.html",
  "brief/computer/atlas-engine.js",
  "brief/katana/atlas-engine.js",
  "brief/meeting/atlas-engine.js",
  "brief/skills/atlas-engine.js",
  "builds/manual/atlas-engine.js",
  "builds/move/atlas-engine.js",
  "care/index.html",
  "care/vendor/atlas/ask.js",
  "id-rehearsal/index.html",
  "id-rehearsal/vendor/atlas-learning.js",
  "id/index.html",
  "id/vendor/atlas-learning.js",
  "study/app.js",
  "study/index.html",
  "synk-town/atlas-learning.js",
  "synk-town/linked.html",
  "try/blank-slice/atlas-learning.js",
  "try/blank-slice/index.html",
  "try/entry-check/atlas-learning.js",
  "try/entry-check/index.html",
  "try/learning-hub/atlas-learning.js",
  "try/learning-hub/index.html",
  "try/order-rush/atlas-learning.js",
  "try/order-rush/beginner-atlas-learning.js",
  "try/order-rush/beginner.html",
  "try/order-rush/index.html",
  "try/racing/atlas-learning.js",
  "try/racing/index.html",
  "try/rhythm/atlas-learning.js",
  "try/rhythm/index.html",
  "try/runner/atlas-learning.js",
  "try/runner/index.html",
  "try/story-classroom/atlas-learning.js",
  "try/story-classroom/index.html",
  "try/talk-rally/atlas-learning.js",
  "try/talk-rally/index.html",
  "try/travel/atlas/ask.js",
  "try/travel/atlas/engine.js",
  "try/travel/atlas/trail-life.js",
  "try/word-magic/atlas-learning.js",
  "try/word-magic/index.html",
  "world/brand-opening/content/life-standalone.mjs",
  "world/hangul-stage/atlas-learning.js",
  "world/hangul-stage/index.html",
  "world/korean-rhythm/atlas-learning.js",
  "world/korean-rhythm/index.html",
  "world/korean-runner/atlas-learning.js",
  "world/korean-runner/index.html",
  "world/world-account.bundle.mjs",
  "world/world-learning-profile-core.mjs"
]);
function 개인화생성물정책(o, files, candidate, 판) {
  const safe = p => typeof p === 'string' && !p.includes('\\') && !p.includes(':') && !p.split('/').some(x => !x || x === '.' || x === '..');
  const storageHost = p => /^(?:desktop\/|\.github\/desktop-preview\/unified\/source\/)renderer\/platform-continuity\.mjs$/.test(p);
  const fixedCopy = p => storageHost(p) || ['.github/desktop-preview/unified/source/renderer/member-insight-view.mjs','.github/desktop-preview/unified/source/renderer/member-insight-model.mjs'].includes(p);
  const pc = p => fixedCopy(p) || /^(?:desktop\/|\.github\/desktop-preview\/unified\/source\/)(?:assets\/launcher\/(?:engine\.js|sources\.json)|renderer\/generated\/(?:member-(?:activity|understanding)(?:-data)?\.(?:mjs|manifest\.json)|member-shared\/chunk-[A-Z0-9]{8}\.mjs))$/.test(p);
  // 표준 게시의 버전 메타데이터 18개 + PC 빌드 메타데이터 3개. 읽기만 하는 client.js는 제외한다.
  const metadata = new Set(['desktop/releases/preview.json','knowledge.json','en/knowledge.json','index.html','en/index.html',
    ...['lab','shift','pulse','path','atlas','founder'].flatMap(p => [p+'/index.html','en/'+p+'/index.html']),'llms.txt',
    '.github/desktop-preview/package.json','.github/desktop-preview/package-lock.json','.github/desktop-preview/unified/release-input.json']);
  const meta = p => metadata.has(p);
  // 공개 도구가 knowledge.json의 참조를 갱신하는 두 파일: 캐시 토큰만 허용한다.
  const metadataToken = p => p === 'app.js' || p === 'en/app.js';
  const records = p => /^(?:tools\/(?:검수묶음\.mjs|lib\/검수증명\.mjs)|tests\/검수Atlas개인화예외\.test\.mjs|docs\/_ops\/(?:결정\.md|트랙\.md|관문_자동화\.md))$/.test(p);
  if (판 !== 2 || o.작성자 !== 'GPT' || o.종류 !== '백엔드' || o.사용자지정 || o.예외 || o.페이블생략 || o.GPT구독 && o.GPT구독 !== '유지'
    || !candidate && !files.length
    || files.some(f => !safe(f.경로) || !(pc(f.경로) || records(f.경로))
      || fixedCopy(f.경로) && f.상태 !== 'M'
      || f.옛경로 && (!safe(f.옛경로) || !pc(f.옛경로) || !/member-shared\/chunk-[A-Z0-9]{8}\.mjs$/.test(f.옛경로))
      || /^[DR]/.test(f.상태 || '') && !/member-shared\/chunk-[A-Z0-9]{8}\.mjs$/.test(f.경로))
    || candidate && (candidate.종류 !== 'synk.im' || candidate.항목.some(f => !safe(f.경로) || !(개인화웹경로.has(f.경로) || pc(f.경로) || meta(f.경로) || metadataToken(f.경로))
      || (fixedCopy(f.경로) || 개인화웹저장소호스트.has(f.경로)) && f.종류 !== '바꿈'
      || 개인화웹경로.has(f.경로) && /\.html?$/.test(f.경로) && f.종류 !== '토큰'
      || meta(f.경로) && !['바꿈','토큰'].includes(f.종류)
      || metadataToken(f.경로) && f.종류 !== '토큰'
      || f.종류 === '지움' && !/member-shared\/chunk-[A-Z0-9]{8}\.mjs$/.test(f.경로))))
    throw new Error('이번 Atlas 개인화 생성물의 직접 승인 범위를 벗어난 담당 예외');
  return {판,작성자:'GPT',종류:'백엔드',GPT구독:'유지',필수:['GPT','Claude'],예외:null,
    담당예외:{taskId:개인화생성물작업ID,userStatement:'웅 이번에는 예외 적용해서 진행해',scope:'이번 Atlas 엔진 생성물·캐시 토큰의 웹·PC 반영. GPT·Claude 공동 검수, 기존 바이트·해시·P0/P1 관문 유지.'}};
}

export function 정책만들기(o, files, { 판 = 정책판 } = {}) {
  if (![1, 2, 3, 4].includes(판) || ([3, 4].includes(판)) !== Boolean(o.사용자지정)) throw new Error(`모르는 검수 정책 판 또는 사용자지정 누락: ${판}`);
  const candidate = 후보읽기(o.배포후보);
  const 기준이미지만 = candidate?.종류 === 'synk.im' && candidate.항목.every(f => /^\.github\/site-check\/baseline\/.+\.(?:json|png|jpe?g|webp)$/i.test(f.경로));
  if (o.담당예외 === 개인화생성물작업ID) return 개인화생성물정책(o, files, candidate, 판);
  if (candidate && o.종류 !== (candidate.종류 === 'synk.im' && !기준이미지만 ? '화면' : '백엔드')) throw new Error(`배포 후보 ${candidate.종류}에 맞는 검수 종류가 아니다`);
  if ([3, 4].includes(판)) return 사용자지정정책(o, files, candidate, 판);
  // 2026-10-28 직접 사용자 승인: 이 학습 흐름에 한해 담당과 Fable을 대체한다.
  // 일반 정책·검수 원문·SHA 사슬·P0/P1 처리·배포 바이트 검사는 그대로다.
  if (o.담당예외 != null) {
    const source = p => /^experiences\/korean-study\//.test(p)
      || /^experiences\/synk-account\/qa\/study-town-style-20261028\/[a-z0-9-]+\.mjs$/.test(p)
      || /^experiences\/synk-account\/(?:src\/(?:client|study-login)\.mjs|dist\/client\.js|build-manifest\.json|style\.css|client\.html)$/.test(p)
      || /^(?:atlas\/learning\.js|experiences\/[^/]+\/atlas-learning\.js|experiences\/synk-world-app\/world-account\.bundle\.mjs|experiences\/brand-opening\/content\/life-standalone\.mjs)$/.test(p)
      || /^(?:docs\/(?:_ops\/(?:결정\.md|트랙\.md|몽골어검문\.jsonl|관문_자동화\.md)|아틀라스_설계\.md|아틀라스_구현명세\.md|미니게임_TOPIK_I_학습기준\.md)|tests\/(?:atlas-learning\.test\.js|atlas-size-budget\.test\.js|검수담당예외\.test\.mjs)|tools\/(?:검수묶음\.mjs|lib\/검수증명\.mjs))$/.test(p)
      || /^(?:lib\/(?:study-writing-feedback|world-writing-runtime)\.js|tests\/(?:study-writing|world-writing)\.test\.js|supabase\/functions\/world-writing\/동봉\.json|docs\/study-semantic\.md)$/.test(p);
    const validPath=p=>typeof p==='string'&&!p.includes('\\')&&!p.includes(':')&&!p.split('/').some(x=>!x||x==='.'||x==='..');
    const publish = p => /^study\//.test(p) || ['account/client.js','account/dist/client.js','account/client.html','account/style.css'].includes(p);
    if (o.담당예외 !== 'topik-writing-semantic-20261028' || o.작성자 !== 'GPT' || !['화면','백엔드'].includes(o.종류)
      || o.사용자지정 || o.예외 || o.페이블생략 || o.GPT구독 && o.GPT구독 !== '유지'
      || !files.length || files.some(f => f.상태 === 'D' || !validPath(f.경로) || !source(f.경로))
      || candidate && (candidate.종류 !== 'synk.im' || candidate.항목.some(f => f.종류 === '지움' || !validPath(f.경로) || !publish(f.경로)))) throw new Error('TOPIK 의미 튜터의 직접 승인 범위를 벗어난 담당 예외');
    return {판,작성자:'GPT',종류:o.종류,GPT구독:'유지',필수:['아르곤'],예외:null,
      담당예외:{taskId:o.담당예외,userStatement:'이번 작업만 GPT 구현·아르곤 검수로 진행',scope:'의미 분석·엔진·화면 구현과 자동·화면 시험. 추가 결제·보안 설정 변경 제외.'},
      ...(o.종류==='화면'?{페이블생략:'2026-10-28 이번 작업에 한한 직접 사용자 승인; 아르곤 재검수도 필수'}:{})};
  }
  const 작성자 = o.작성자 || 'Claude', 구독 = o.GPT구독 || '유지';
  if (!['Claude', 'GPT'].includes(작성자)) throw new Error('--작성자는 Claude|GPT');
  if (작성자 === 'GPT' && o.종류 === '화면') throw new Error('화면 구현은 Claude 담당이다 — GPT 작성 화면 정책은 없다');
  if (!['유지', '종료'].includes(구독)) throw new Error('--GPT구독은 유지|종료');
  if (구독 === '종료' && (!o.사유?.trim() || 작성자 === 'GPT')) throw new Error('GPT 구독 종료는 Claude 작업에서 --사유와 함께 명시한다');
  // 화면 Fable 생략(2026-10-24 유호님): 그림·글·색만 바꾼 화면처럼 Fable이 볼 것이 적은 일은 아르곤만 받는다 — 까닭을 정책에 남긴다.
  // 아르곤이 한도·로그인으로 막히거나 아르곤 P0·P1을 고치면 Fable이 다시 들어온다(검수묶음.mjs 처음고리판정·사슬판정·집계하기).
  const 페이블생략 = o.페이블생략 == null ? null : String(o.페이블생략).trim();
  if (페이블생략 !== null && (o.종류 !== '화면' || !페이블생략)) throw new Error('--페이블생략은 화면 검수에서 까닭과 함께만 쓴다');
  const 필수 = o.종류 === '화면' ? (페이블생략 ? ['아르곤'] : ['아르곤', 'Fable']) : 작성자 === 'GPT' ? ['GPT', 'Claude'] : 구독 === '종료' ? ['아르곤'] : 판 === 1 ? ['아르곤', 'GPT'] : ['GPT'];
  let 예외 = null;
  if (o.예외) {
    if (!['내부', '아주작은수정', '콘텐츠'].includes(o.예외) || !o.대상?.trim() || !o.사유?.trim()) throw new Error('검수 예외에는 --예외 내부|아주작은수정|콘텐츠 --대상 --사유가 필요하다');
    const candidates = candidate?.항목 || [];
    const targets = o.대상.split(',').map(s => s.trim().replace(/\\/g, '/').replace(/\/$/, ''));
    const all = [...files, ...candidates];
    if (!all.length || targets.some(p => !p || !all.some(f => f.경로 === p || f.경로.startsWith(p + '/'))) || !all.every(f => targets.some(p => f.경로 === p || f.경로.startsWith(p + '/')))) throw new Error('검수 예외 대상이 실제 변경·배포 후보 경로 전체와 맞지 않는다');
    if (o.예외 === '내부' && o.종류 !== '화면') throw new Error('내부 예외는 유호·운영자만 보는 내부 화면에만 쓴다');
    if (o.예외 === '콘텐츠' && all.some(f => /\.(?:[cm]?js|jsx|tsx?|css|html?|json|ya?ml|py|sql|sh|ps1)$/i.test(f.경로))) throw new Error('콘텐츠 예외에 코드·설정 파일이 섞였다');
    if (o.예외 === '아주작은수정' && (files.length !== 1 || files.some(f => f.상태 !== 'M' || (f.더함 || 0) + (f.뺌 || 0) > 4))) throw new Error('아주 작은 수정 예외는 기존 파일 하나의 변경 네 줄 이내만 지원한다');
    if (o.예외 === '아주작은수정' && candidates.some(f => f.종류 === '지움' || f.경로 !== files[0].경로 || sha256(fs.readFileSync(안전경로(o.저장소, f.경로))) !== f.sha256)) throw new Error('아주 작은 수정의 배포 후보는 검토 대상 원천 파일 그대로여야 한다');
    예외 = { 종류: o.예외, 대상: o.대상.trim(), 사유: o.사유.trim() };
  }
  return { 판, 작성자, 종류: o.종류, GPT구독: 구독, ...(구독 === '종료' ? { 구독사유: o.사유.trim() } : {}), 필수, 예외, ...(페이블생략 ? { 페이블생략 } : {}) };
}
/** Claude 백엔드의 다른 회사 검수 순서 — 앞 검수자가 한도·로그인으로 막혔을 때만 다음으로 넘어간다(2026-10-24 다섯 가지 ①).
 *  화면(아르곤 → Fable 최종)과 GPT 작성(GPT·Claude 둘 다, 대체 없음)은 null. 정책 판과 상관없이 지금 규칙이다. */
export function 대체순서(정책) {
  if (정책.사용자지정) return null;
  if (정책.종류 === '화면' || 정책.작성자 === 'GPT') return null;
  return 정책.GPT구독 === '종료' ? ['아르곤', 'Fable'] : ['GPT', '아르곤', 'Fable'];
}
/** 지금 규칙으로 꼭 받아야 하는 검수자(대체는 빼고). 옛 판 1의 [아르곤, GPT]도 [GPT]로 본다. */
export const 실제필수 = 정책 => (대체순서(정책) ? [대체순서(정책)[0]] : 정책.필수);
export const 필수글 = 정책 => {
  if (정책.담당예외?.taskId === 개인화생성물작업ID) return 'GPT · Claude(이번 Atlas 엔진 생성물의 직접 사용자 승인; 대체 없음)';
  if (정책.담당예외) return '아르곤(이번 TOPIK 의미 튜터 작업의 직접 사용자 승인; 대체 없음)';
  if (정책.사용자지정) return `묶음별 ${정책.필수.join(' · ')} + 전체 후보에 대한 최종 ${정책.사용자지정.finalReviewer} 배포 판정(대체 없음)`;
  const 순서 = 대체순서(정책);
  if (정책.페이블생략) return `아르곤(Fable 생략 — ${정책.페이블생략} · 아르곤이 한도·로그인으로 막히거나 아르곤 P0·P1을 고치면 Fable)`;
  return 순서 ? `${순서[0]}(한도·로그인으로 막히면 ${순서.slice(1).join(' → ')})` : 정책.필수.join(' · ');
};
/** 정책 3의 candidate-only 고침: 권한·경로·작성자는 그대로이고 바이트만 바뀔 수 있다. */
export function 사용자지정사슬검사(before, after, beforeCandidate, afterCandidate) {
  if (!before?.사용자지정 || !after?.사용자지정 || ![3, 4].includes(before.판) || before.판 !== after.판) throw new Error('사용자지정은 기존 정책 사슬에 추가하지 않는다');
  if (before.사용자지정.sources.length || after.사용자지정.sources.length || !beforeCandidate || !afterCandidate) throw new Error('사용자지정 다시는 원천 없는 배포 후보만 지원한다 — 원천은 새 묶음으로 준비한다');
  const identity = policy => {
    const { 파일sha256, candidate, ...authority } = policy.사용자지정;
    return { ...policy, 사용자지정: { ...authority, candidate: { files: candidate.files.map(({ sha256, ...row }) => row).sort((a,b)=>a.path.localeCompare(b.path)) } } };
  };
  if (정규해시(identity(before)) !== 정규해시(identity(after))) throw new Error('사용자지정 다시에서 작업·원문·필수 검수·작성자·범위가 바뀌었다');
  const surface = candidate => ({ 종류: candidate.종류, 항목: candidate.항목.map(({ sha256, ...row }) => row) });
  if (정규해시(surface(beforeCandidate)) !== 정규해시(surface(afterCandidate))) throw new Error('사용자지정 다시의 후보 경로·종류·모드는 처음 범위 그대로여야 한다');
  return true;
}
export function 응답검사(answer, expected, { final = false } = {}) {
  const errors = [];
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return ['응답이 객체가 아니다'];
  if (!Array.isArray(answer.findings)) errors.push('findings 목록 없음');
  else for (const f of answer.findings) if (!f || !['P0', 'P1', 'P2', 'P3'].includes(f.grade) || ['location', 'quote', 'problem', 'fix'].some(k => typeof f[k] !== 'string') || !f.location?.trim() || !f.problem?.trim()) errors.push('지적 schema 오류');
  const c = answer.coverage;
  if (!c || typeof c.reviewed !== 'string' || !c.reviewed.trim() || typeof c.limitations !== 'string' || typeof c.complete !== 'boolean' || !Array.isArray(c.missing) || c.missing.some(x => typeof x !== 'string')) errors.push('coverage schema 오류');
  else if (!c.complete || c.missing.length) errors.push(`검토 누락: ${c.missing.join(', ') || c.limitations || '미완료'}`);
  if (!Array.isArray(answer.seen) || answer.seen.some(x => typeof x !== 'string')) errors.push('seen 목록 없음');
  else if (expected) {
    const norm = s => s.trim().replace(/^\[|\]$/g, '').toLowerCase();
    const got = answer.seen.map(norm), want = expected.항목.map(norm);
    if (new Set(got).size !== got.length || got.length !== want.length || want.some(x => !got.includes(x))) errors.push('seen이 요구 항목 집합과 다르다');
  }
  // 다시 검수 묶음: 다시 볼 지적([Q…])마다 풀었는지를 한 번씩 답한다
  if (expected?.대상) {
    const t = answer.targets;
    if (!Array.isArray(t) || t.some(x => !x || typeof x.id !== 'string' || typeof x.resolved !== 'boolean' || typeof x.note !== 'string')) errors.push('targets schema 오류');
    else {
      const got = t.map(x => x.id.trim().replace(/^\[|\]$/g, ''));
      if (new Set(got).size !== got.length || got.length !== expected.대상.length || expected.대상.some(x => !got.includes(x))) errors.push('targets가 다시 볼 지적 집합과 다르다');
    }
  }
  if (expected && answer.endMarker !== expected.표식) errors.push('끝 표식 불일치');
  if (final && (!expected?.검토입력해시 || answer.reviewInputHash !== expected.검토입력해시)) errors.push('최종 검토 입력 해시 불일치');
  return errors;
}
// 일반 오류·응답 속 단어는 막힘으로 간주하지 않는다. 실행기가 받은 실패 원문을 보존한다.
export function 막힘증거(누구, raw, usage = null) {
  if (usage?.주간 === 0) return { 종류: '한도', 도구: 누구 === 'GPT' ? 'codex' : 'agy', 원문: JSON.stringify(usage) };
  const text = String(raw || '');
  const quota = 누구 === 'GPT' ? /(?:hit your usage limit|usage limit.*(?:reached|exceeded)|no Pro account.*(?:available|remaining)|Pro 계정.*(?:없|한도)|주간.*한계)/i : /(?:RESOURCE_EXHAUSTED|QUOTA_EXHAUSTED|quota.*(?:exceeded|exhausted)|limit remaining 0|429.*(?:quota|rate))/i;
  const login = /(?:not logged in|login required|authentication (?:failed|required)|unauthenticated|invalid credential|로그인이 필요)/i;
  return quota.test(text) || login.test(text) ? { 종류: quota.test(text) ? '한도' : '로그인', 도구: 누구 === 'GPT' ? 'codex' : 'agy', 원문: text } : null;
}
/** 다시 검수(고친 diff만) 증명 — 앞 고리 후보 해시·지금 후보 해시·diff 해시·대상 지적·묶음 입력 SHA를 한 해시에 묶는다. */
export function 다시증명(body) {
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}` };
}
/** 앞 판과 지금 판(파일 스냅샷·배포 후보)에서 내용·모드가 달라진 경로. */
export function 바뀐경로들(앞판, 지금판, 앞후보 = null, 지금후보 = null) {
  const 앞 = new Map(앞판.map(f => [f.경로, f]));
  const 소스 = 지금판.filter(f => { const a = 앞.get(f.경로); return !a || a.sha256 !== f.sha256 || a.모드 !== f.모드; }).map(f => f.경로).sort();
  const 후보앞 = new Map((앞후보?.항목 || []).map(x => [x.경로, x])), 후보지금 = new Map((지금후보?.항목 || []).map(x => [x.경로, x]));
  const 후보 = [...new Set([...후보앞.keys(), ...후보지금.keys()])].filter(k => 정규해시(후보앞.get(k) ?? null) !== 정규해시(후보지금.get(k) ?? null)).sort();
  return { 소스, 후보 };
}
/** 다시 검수자: 그 지적을 낸 검수자. GPT 작성은 GPT·Claude 둘 다, 화면은 Fable이 끝 상태를 본다, 대상이 없으면 정책의 첫 검수자.
 *  화면 Fable 생략 묶음은 다시 볼 지적이 없으면 아르곤만 — 고친 P0·P1이 있으면 화면을 보는 Fable이 함께 본다. */
export function 다시검수자들(정책, 대상) {
  if (정책.사용자지정) return [...정책.필수];
  if (정책.작성자 === 'GPT') return [...정책.필수];
  const 낸 = ['아르곤', 'GPT', 'Fable'].filter(w => 대상.some(t => t.출처 === w));
  if (정책.종류 === '화면') return 정책.페이블생략 && !낸.length ? ['아르곤'] : [...new Set([...낸, 'Fable'])];
  return 낸.length ? 낸 : [대체순서(정책)[0]];
}
/** 그 검수자가 한도·로그인으로 막혔을 때 대신하는 차례(자신 포함). GPT 작성은 대신이 없다. */
export function 대신할검수자(정책, 누구) {
  if (정책.사용자지정) return [누구];
  if (정책.작성자 === 'GPT') return [누구];
  const 차례 = ['GPT', '아르곤', 'Fable'], i = 차례.indexOf(누구);
  return i < 0 ? [누구] : 차례.slice(i);
}
export function 입력증명({ 정책, 파일, 배포후보 = null, 항목 = [], 자료해시 = null, 보조파일 = [] }) {
  const body = { 정책, 파일, 배포후보, 항목, 자료해시, 보조파일 };
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}`, 항목 };
}
