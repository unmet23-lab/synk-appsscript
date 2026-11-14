// 검수 입력·배포 후보의 내용 계약. 모델 호출이나 배포는 하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
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
const 블롭번호 = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
/** 공개 도구가 후보 곁에 남긴 앞 공개본(`.앞판/<경로>`, 후보.json의 앞판 = 경로 → git blob 번호). 번호가 맞는 것만 돌려준다 — 없거나 어긋나면 그 파일은 통째로 검수한다.
 *  증명 칸(위 · 항목)은 배포 증명에 묶여, 공개 도구가 그 공개 커밋에 정말 그 판이 있는지 대조한다. */
export function 후보앞판읽기(folder) {
  const 판 = new Map(), 항목 = {};
  if (!folder) return { 판, 증명: null };
  const root = path.resolve(folder), raw = JSON.parse(fs.readFileSync(path.join(root, '후보.json'), 'utf8').replace(/^﻿/, ''));
  for (const [경로, 번호] of Object.entries(raw.앞판 || {})) {
    let b;
    try { b = fs.readFileSync(안전경로(root, `.앞판/${경로}`)); } catch { continue; }
    if (블롭번호(b) === 번호) { 판.set(경로, b); 항목[경로] = 번호; }
  }
  return { 판, 증명: 판.size ? { 위: raw.위 ?? null, 항목 } : null };
}
// 검수 정책 판. 2(2026-10-24 다섯 가지 ①)부터 Claude 백엔드의 필수 검수는 GPT 하나다. 1(10-22~24)은 아르곤·GPT 둘을 적었다 —
// 옛 판 묶음도 필수는 GPT 하나로 보므로(실제필수), 둘 다 받은 옛 증거와 GPT만 받은 옛 증거가 그대로 통과한다.
// 5(2026-10-31 검수 효율 여섯 가지)부터 GPT 작성의 다시 검수는 GPT만 보고, Claude는 첫 판·끝 판과 자기가 낸 지적만 본다. 3·4는 사용자지정 판이다.
// 6(2026-11-08 그록 눈가림 시험 뒤 유호님과 정함)부터 Claude 백엔드의 대체 순서는 GPT → 아르곤 → 그록 → Fable이다 — 그록은 GPT·아르곤이 둘 다
// 한도·로그인으로 막힌 증거가 있을 때만 차례가 오고, 그록이 대신 본 사슬은 그록 P2도 처리를 적어야 닫힌다(그록이 진짜 P1을 P2로 낮춰 매긴 적이 있다).
// 판은 정책과 함께 입력 해시에 봉인되므로 판 5까지 만든 묶음은 그 판의 순서(GPT → 아르곤 → Fable)로 판정한다. 화면·GPT 작성은 판 5와 같다.
// 7(2026-11-14 유호님 「웅 만약에 한도에 차면 카본이 대시 봐도 돼」)부터 GPT 작성 백엔드는 필수 둘(GPT · Claude) 가운데 GPT 자리만,
// GPT가 한도·로그인(주간 문턱에 걸려 고를 계정이 없는 것도 한도다)으로 막힌 증거가 있을 때 아르곤(카본)이 대신한다(GPT자리대체정책).
// Claude 자리는 대신이 없고, 아르곤도 막히면 더 내려가지 않는다. 그 밖의 묶음은 판 6과 같고, 판 6까지 만든 GPT 작성 묶음은 그대로 대신이 없다.
export const 정책판 = 7;
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
// 11-09 이번 Workspace 다음 할 일 연결만 GPT 구현·독립 GPT 검수로 진행한다.
export const Workspace다음할일작업ID = 'workspace-next-action-20261109';
export const Workspace다음할일원문 = Object.freeze({ implementationReview: '구현과 검토는 이번 세션에서는 니가 다 해. 허용할게' });
// 11-13 직원 조직 기능 한정 사용자 승인. 다른 작업의 작성·검수 정책은 유지한다.
export const Workspace조직작업ID = 'workspace-organization-20261113';
export const Workspace조직원문 = Object.freeze({ implementationReview: '이번 작업은 GPT가 설계·구현·검토 진행' });
// 2026-11-14 직접 승인. 원 정책·packet을 바꾸지 않고 이 작업의 남은 GPT 검수만 카본으로 대체한다.
export const Workspace검수대체 = Object.freeze({
  taskId: 'workspace-repair-20261114-gpt-quota-fallback',
  authorizationSha256: '90b2f01abcd9a1031f4c25d9ec6fe6ee330e4c09e8ebcdaccfe401b9e30385a2',
  quotaSha256: 'efb6436d0af2054ace6b38320b086ff2cf8aeca2540f6fd018137868ff594449',
});
const Workspace회사경로 = 'docs/마케팅/온라인마케팅지도/engagement/company/';
const Workspace공용작업본 = path.join(os.homedir(), 'Documents/SYNK-appsscript');
// 최초 입력은 이미 봉인된 이번 작업의 원문이다. 이름만 바꾼 다른 작업은 받지 않는다.
const Workspace대체범위 = {
  'workspace-repair-qa-inputs-20261114': {
    first: 'workspace-repair-qa-inputs-20261114', input: '78629ee9fff8e7c8f1ae8900f3998411fbb1651a68b7f231cd0fc4757085b258',
    rounds: ['-r2', '-r3', '-r4'], // 같은 QA 원천의 세 번째 재현 뒤 설계 검수·수정 확인 한 회차만 명시 허용.
    paths: ['.github/workflows/syntax-check.yml', 'tests/conditional-qa-reregister.test.cjs', 'tests/conditional-qa.test.cjs', 'tools/conditional-qa/cases.json', 'tools/conditional-qa/reregister.cjs'],
  },
  'workspace-repair-access-final-20261114': {
    first: 'workspace-repair-access-r2-20261114', input: 'ed38802262b8932090811fe7b5e9b17b6775a27e11829cf38d189005e128b01d',
    paths: ['client-projects.mjs', 'company-work.mjs', 'company-work.test.mjs', 'content-service.mjs', 'member-organization.mjs', 'member-organization.test.mjs', 'organization.mjs', 'organization.test.mjs', 'server-channel-collection.test.mjs', 'server-member-organization.test.mjs', 'server-organization.test.mjs', 'server.mjs', 'server.test.mjs', 'social-marketing-edge.test.mjs', 'social-marketing.test.mjs', 'social-publishing.test.mjs', 'store.mjs', 'workspace-access-service.mjs', 'workspace-access.mjs', 'workspace-access.test.mjs'].map(p => Workspace회사경로 + p),
  },
  'workspace-repair-review-substitution-20261114': {
    first: 'workspace-repair-review-substitution-20261114', input: '4e2d4fd43d89b725d8ccd4be98be10946e1aed4ead586e65ab0500d5de5037a1',
    rounds: ['-r2', '-r3', '-r4'], // 같은 도구 사슬의 원격 6줄 합침을 실제 검수하는 끝판 한 회차만 허용.
    paths: ['tests/검수Workspace대체.test.mjs', 'tools/검수묶음.mjs', 'tools/lib/검수증명.mjs'],
  },
  'company-workspace67-local-tools-20261114': {
    first: 'company-workspace67-local-tools-20261114', input: '11439785c7a534daa97c3edc6149f58e11df24760ab86d181c315fa32d326dca',
    paths: ['carry-local.cjs', 'carry-local.test.cjs', 'preparation-input.pending.json', 'prepare-local.cjs', 'prepare-local.test.cjs', 'release-contract.cjs', 'release-contract.test.cjs'],
  },
  'company-workspace67-product-20261114': {
    first: 'company-workspace67-product-20261114', repo: '.tmp/company-workspace67-final-20261114',
    paths: ['Dockerfile.dockerignore', 'client-projects.mjs', 'client-search-client.test.mjs', 'company-work.mjs', 'company-work.test.mjs', 'content-service.mjs', 'demo-messenger-navigation.test.mjs', 'direct-tab-role-client.test.mjs', 'growth-home-client.test.mjs', 'login-recovery-client.test.mjs', 'marin-home-client.test.mjs', 'member-organization-qa.test.mjs', 'member-organization.mjs', 'member-organization.test.mjs', 'organization.mjs', 'organization.test.mjs', 'public/app.js', 'public/index.html', 'public/marin-home.js', 'public/member-organization.css', 'public/member-organization.js', 'public/workroom.js', 'public/workspace-access.css', 'public/workspace-access.js', 'public/workspace.js', 'qa/member-organization-support.mjs', 'qa/verify-member-organization.mjs', 'server-channel-collection.test.mjs', 'server-member-organization.test.mjs', 'server-organization.test.mjs', 'server.mjs', 'server.test.mjs', 'social-publishing.test.mjs', 'store.mjs', 'synk-native-entry-client.test.mjs', 'workroom-client.test.mjs', 'workspace-access-service.mjs', 'workspace-access-test-context.mjs', 'workspace-access.mjs', 'workspace-access.test.mjs', 'workspace-navigation.test.mjs', 'workspace-restore-acceptance.mjs', 'workspace-restore-acceptance.test.mjs', 'workspace-review-client.test.mjs'].map(p => 'candidate/' + Workspace회사경로 + p),
  },
  'company-workspace67-operators-20261114': {
    first: 'company-workspace67-operators-20261114', repo: '.tmp/company-workspace67-carry-20261114',
    paths: ['lineage-ha-rest-67.cjs', 'port67/admission67.cjs', 'port67/admission67.test.cjs', 'port67/lib67.cjs', 'port67/make-final-pins.cjs', 'port67/p67-operators.cjs', 'port67/port-root67.cjs', 'port67/run-local-67.cjs', 'port67/run67.cjs', 'public-health-release67-watch.cjs', 'read-inert-artifacts-67.cjs', 'read-inert-progress-67.cjs', 'run-deploy-67.sh', 'run-stage-relay-67.sh', 'seal67.cjs'],
  },
};
const 대체폴더 = '대체승인';
const Workspace범위찾기 = 목록 => Workspace대체범위[(목록?.이름 || '').replace(/-r[234]$/, '')];
const 같은대체경로 = (a, b) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);
/** 현재 폴더에서 해시로 이어진 실제 조상만 읽는다. 다른 작업 이름·순환·합침은 허용하지 않는다. */
export function Workspace대체사슬(폴더, 목록) {
  const chain = [목록], seen = new Set([path.resolve(폴더)]);
  const scope = Workspace범위찾기(목록);
  // 아직 만들지 않은 67 두 묶음은 지정 저장소·정확한 파일 집합·공용 검수 폴더 하나만 허용한다.
  // 첫 결속은 wx로 한 번만 쓰며, 뒤 고리는 그 첫 결속이 여전히 유효해야 한다.
  const 위치검사 = (folder, meta) => {
    if (scope?.repo && !같은대체경로(folder, 안전경로(Workspace공용작업본, `.tmp/검수/${meta.이름}`))) throw new Error('Workspace 대체 승인 최초 검수의 고정 폴더가 아니다');
  };
  위치검사(폴더, 목록);
  while (Object.hasOwn(chain[0].증명, '앞')) {
    const current = chain[0], previous = current.앞?.폴더;
    if (!previous || seen.has(path.resolve(previous)) || seen.size >= 4) throw new Error('Workspace 대체 승인 사슬 경로가 잘못됐다');
    seen.add(path.resolve(previous));
    const parent = JSON.parse(fs.readFileSync(path.join(previous, '묶음.json'), 'utf8'));
    위치검사(previous, parent);
    if (parent.이름 !== current.증명.앞.이름 || parent.증명?.검토입력해시 !== current.증명.앞.검토입력해시) throw new Error('Workspace 대체 승인 앞 사슬 결속 불일치');
    chain.unshift(parent);
  }
  if (scope?.repo && chain.length > 1) {
    const first = chain[0], receipt = Workspace대체읽기(안전경로(Workspace공용작업본, `.tmp/검수/${first.이름}`), first);
    if (!receipt) throw new Error('Workspace 대체 승인 최초 결속이 없다 — 새 사슬에 자동 승계하지 않는다');
  }
  return chain;
}
/** 순수 결속 계약. 파일을 쓰거나 일반 정책·검수자 목록을 바꾸지 않는다. */
export function Workspace대체결속(목록, 원GPT = [], 사슬 = [목록]) {
  const p = 목록?.증명, 정책 = 목록?.정책, base = (목록?.이름 || '').replace(/-r[234]$/, ''), scope = Workspace대체범위[base];
  if (목록?.판 !== 2 || !scope || 목록.갈래 === '합침'
      || !(정책?.판 >= 6) || 정책.종류 !== '백엔드' || 정책.작성자 !== 'GPT' || !정책.필수?.includes('GPT')
      || 정책.예외 || 정책.사용자지정 || 정책.담당예외 || !Array.isArray(p?.파일) || !p.파일.length
      || !Array.isArray(목록.묶음) || !목록.묶음.length || !/^[a-f0-9]{64}$/.test(p.검토입력해시 || '')
      || 정규해시(정책) !== 정규해시(p.정책)) throw new Error('이번 Workspace 작업의 GPT 대체 승인 범위가 아니다');
  const first = 사슬[0], names = [scope.first, base, ...(scope.rounds || ['-r2', '-r3']).map(s => base + s)].filter((x, i, a) => a.indexOf(x) === i);
  if (first?.이름 !== scope.first || (scope.input && first?.증명?.검토입력해시 !== scope.input) || first.증명.앞
      || 사슬.at(-1) !== 목록 || new Set(사슬.map(m => m.이름)).size !== 사슬.length
      || 사슬.some((m, i) => !names.includes(m.이름) || (i && names.indexOf(m.이름) <= names.indexOf(사슬[i - 1].이름))
        || m.갈래 === '합침' || m.저장소 !== first.저장소 || m.바탕?.커밋 !== first.바탕?.커밋
        || !Array.isArray(m.증명?.파일) || !m.증명.파일.length || m.증명.파일.some(f => !scope.paths.includes(f.경로))
        || (scope.repo && (!같은대체경로(m.저장소, 안전경로(Workspace공용작업본, scope.repo)) || 정규해시(m.증명.파일.map(f => f.경로).sort()) !== 정규해시([...scope.paths].sort())))
        || m.증명.배포후보 // 회사 67은 정확한 source proof와 회사 핀 문맥만 쓴다.
        || (i && (m.증명.앞?.이름 !== 사슬[i - 1].이름 || m.증명.앞?.검토입력해시 !== 사슬[i - 1].증명.검토입력해시)))) throw new Error('이번 Workspace 승인 원천·최초 검수 사슬 범위가 아니다');
  for (const m of 사슬) {
    const { 검토입력해시, 표식, ...body } = m.증명;
    if (정규해시(body) !== 검토입력해시 || 표식 !== `END_OF_FINAL_REVIEW_${검토입력해시}`) throw new Error('Workspace 대체 승인 사슬 입력 증명 불일치');
  }
  return { version: 1, ...Workspace검수대체, review: 목록.이름, reviewInputHash: p.검토입력해시,
    policySha256: 정규해시(정책), sourcesSha256: 정규해시(p.파일), candidateSha256: 정규해시(p.배포후보 ?? null),
    previousInputHash: p.앞?.검토입력해시 ?? null,
    packets: 목록.묶음.map(b => ({ name: b.이름, sha256: b.sha256 })),
    chain: 사슬.map(m => ({ review: m.이름, inputHash: m.증명.검토입력해시 })),
    originalGPT: 원GPT, requiredReviewers: ['아르곤', 'Claude'] };
}
export function Workspace원GPT지문(폴더, 목록) {
  return 목록.묶음.flatMap(b => {
    const 경로 = `GPT-${b.이름}.json`, f = 안전경로(폴더, 경로);
    return fs.existsSync(f) ? [{ path: 경로, sha256: sha256(fs.readFileSync(f)) }] : [];
  });
}
/** 승인·실제 한도 원문·기존 GPT 응답·정확한 packet/원천을 매번 다시 대조한다. 새 후보에는 승계하지 않는다. */
export function Workspace대체읽기(폴더, 목록) {
  const record = 안전경로(폴더, `${대체폴더}/결속.json`);
  if (!fs.existsSync(record)) {
    if (fs.existsSync(안전경로(폴더, 대체폴더))) throw new Error('Workspace 대체 승인 부분 기록·결속 누락');
    return null;
  }
  const saved = JSON.parse(fs.readFileSync(record, 'utf8'));
  for (const [file, expected] of [['사용자.json', Workspace검수대체.authorizationSha256], ['GPT막힘.json', Workspace검수대체.quotaSha256]]) {
    if (sha256(fs.readFileSync(안전경로(폴더, `${대체폴더}/${file}`))) !== expected) throw new Error('Workspace 대체 승인·한도 원문 SHA 불일치');
  }
  const expected = Workspace대체결속(목록, Workspace원GPT지문(폴더, 목록), Workspace대체사슬(폴더, 목록));
  if (정규해시(saved) !== 정규해시(expected)) throw new Error('Workspace 대체 승인 packet·원천·기존 GPT 응답 결속 불일치');
  return { ...saved, receiptSha256: sha256(fs.readFileSync(record)) };
}
// 같은 날 후속 지시: 구현뿐 아니라 현재 Codex의 직접 검수와 마감도 승인했다.
export const 사이트점검단독작업ID = 'site-audit-self-review-20261110';
export const 사이트점검단독원문 = Object.freeze({ implementation: '이번 수정은 GPT가 직접 진행', review: '너 혼자 직접 검수하고 진행해' });

// 11-10 AI 마켓 첫 묶음만: 작성 승인은 그대로, Fable·Claude 검수는 독립 GPT로 대체한다.
export const AI마켓작업ID = 'ai-market-first-bundle-20261110';
export const AI마켓원문 = Object.freeze({
  implementation: '이번 작업은 GPT가 기획·화면까지 진행해',
  firstBundle: '오케이 그럼 첫 개발 묶음부터 실제로 만들어줘. 회원가입, 글 작성·저장, 댓글·관심 글, 판매자 프로필, 서비스 등록까지. idk랑 겹치는 기능이랑 외부 모집 발송은 계속 보류하고.',
  independentReview: '이번 작업은 독립 GPT 검수로 진행',
});
const AI마켓회사 = 'docs/마케팅/온라인마케팅지도/engagement/company/';
const AI마켓화면파일 = new Set(['index.html', 'app.mjs', 'style.css'].map(p => `experiences/ai-market/${p}`));
const AI마켓서버파일 = new Set([
  'ai-market-store.mjs', 'ai-market-routes.mjs', 'ai-market-store.test.mjs', 'ai-market-routes.test.mjs',
  'customer-identity.mjs', 'customer-routes.mjs', 'server.mjs', 'customer-identity.test.mjs', 'server-customer.test.mjs',
  'Dockerfile', 'Dockerfile.dockerignore', 'deploy/static/policy.json',
].map(p => AI마켓회사 + p));
const AI마켓검수파일 = new Set(['tools/lib/검수증명.mjs', 'tools/검수묶음.mjs', 'tests/검수AI마켓지정.test.mjs']);
const AI마켓문서 = new Set([
  'experiences/ai-market/README.md', 'docs/AI_커뮤니티마켓/첫개발_설계.md', 'docs/AI_커뮤니티마켓/README.md',
  'docs/AI_커뮤니티마켓/검증.md', 'docs/_ops/결정.md', 'docs/_ops/트랙.md', 'docs/_ops/관문_자동화.md',
]);
function AI마켓범위맞나(scope, p, role, kind) {
  if (scope !== AI마켓작업ID || !['화면', '백엔드'].includes(kind)) return false;
  if (AI마켓화면파일.has(p)) return kind === '화면';
  if (AI마켓서버파일.has(p)) return kind === '백엔드';
  return role === '소스' && (AI마켓문서.has(p) || kind === '백엔드' && AI마켓검수파일.has(p));
}
// 다른 사용자지정 사슬에는 적용하지 않는다. 이 판정 자체도 봉인된 정책에 결속된다.
export const AI마켓아르곤대체 = 정책 => 정책?.판 === 4 && 정책?.종류 === '화면'
  && 정책?.사용자지정?.taskId === AI마켓작업ID && 정책.사용자지정.allowFallback === true;
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
const Workspace다음할일회사 = 'docs/마케팅/온라인마케팅지도/engagement/company/';
const Workspace다음할일원천 = {
  화면: new Set(['public/marin-home.js', 'public/marin-home.css', 'public/app.js', 'marin-home-client.test.mjs'].map(p => Workspace다음할일회사 + p)),
  백엔드: new Set([
    ...['assistant-next-action.mjs', 'assistant-service.mjs', 'server.mjs', 'assistant-next-action.test.mjs', 'server-assistant-next-action.test.mjs'].map(p => Workspace다음할일회사 + p),
    'tools/lib/검수증명.mjs', 'tests/검수Workspace다음할일.test.mjs',
  ]),
};
function Workspace다음할일범위맞나(scope, p, role, 종류, author) {
  return scope === Workspace다음할일작업ID && role === '소스' && author === 'GPT'
    && Workspace다음할일원천[종류]?.has(p);
}
const Workspace조직원천 = {
  화면: new Set(['public/member-organization.js', 'public/member-organization.css', 'public/workspace-access.js', 'public/app.js', 'public/workspace.js', 'public/index.html', 'workspace-navigation.test.mjs', 'qa/verify-member-organization.mjs'].map(p => Workspace다음할일회사 + p)),
  백엔드: new Set([
    ...['member-organization.mjs', 'organization.mjs', 'server.mjs', 'server-member-organization.test.mjs'].map(p => Workspace다음할일회사 + p),
    'tools/lib/검수증명.mjs', 'tests/검수Workspace조직.test.mjs',
  ]),
};
function Workspace조직범위맞나(scope, p, role, 종류, author) {
  return scope === Workspace조직작업ID && role === '소스' && author === 'GPT'
    && Workspace조직원천[종류]?.has(p);
}
const 사이트점검경로계약 = new Set([
  '.github/site-check/check.mjs', '.github/site-check/redirect-contract.mjs', '.github/site-check/redirect-contract.test.mjs',
]);
function 사이트점검단독범위맞나(scope, p, role, 종류, author) {
  if (scope !== 사이트점검단독작업ID || author !== 'GPT') return false;
  if (role === '배포 후보') return 종류 === '화면' && (사이트점검공개.has(p) || 사이트점검경로계약.has(p));
  if (종류 === '화면') return 사이트점검원천.has(p) || 사이트점검보조.has(p) || 사이트점검경로계약.has(p);
  return 종류 === '백엔드' && new Set([
    'tools/lib/검수증명.mjs', 'tools/검수묶음.mjs', 'tests/검수사이트점검예외.test.mjs', 'tests/검수사이트점검단독.test.mjs',
    'docs/_ops/관문_자동화.md', 'docs/_ops/결정.md', 'docs/_ops/트랙.md',
  ]).has(p);
}
function 사용자지정정책(o, files, candidate, 판 = 3) {
  const 단독 = 판 === 4;
  if (o.종류 !== '화면' && !단독) throw new Error('사용자지정은 승인된 화면만 지원한다 — 백엔드의 기존 GPT·Claude 정책을 바꾸지 않는다');
  if (단독 && !['화면', '백엔드'].includes(o.종류)) throw new Error('사용자지정 검수 종류가 잘못됐다');
  if (o.예외 || o.페이블생략 != null || (o.GPT구독 && o.GPT구독 !== '유지') || o.끝 !== '작업본') throw new Error('사용자지정은 현재 작업본의 독립 새 묶음으로만 준비하며 기존 예외와 섞지 않는다');
  const raw = fs.readFileSync(o.사용자지정), 지정 = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  if (!지정 || typeof 지정 !== 'object' || Array.isArray(지정) || Object.keys(지정).sort().join(',') !== ['version', 'taskId', 'userStatements', 'requiredReviewers', 'finalReviewer', 'allowFallback', 'sources', 'candidate'].sort().join(',')) throw new Error('사용자지정 JSON 필드가 잘못됐다');
  const atlas = 단독 && 지정.taskId === Atlas작업ID;
  const 최적화 = 단독 && 지정.taskId === 'optimization-security-20261028';
  const PATH비공개 = 단독 && 지정.taskId === PATH비공개작업ID;
  const Workspace다음할일 = 단독 && 지정.taskId === Workspace다음할일작업ID;
  const Workspace조직 = 단독 && 지정.taskId === Workspace조직작업ID;
  const 사이트점검단독 = 단독 && 지정.taskId === 사이트점검단독작업ID;
  const AI마켓 = 단독 && 지정.taskId === AI마켓작업ID;
  const 검수자 = AI마켓 && o.종류 === '화면' ? ['아르곤'] : 단독 ? ['GPT'] : 지정검수자, 최종 = 단독 ? 'GPT' : 'Claude';
  if (지정.version !== (단독 ? 2 : 1) || 지정.taskId !== (AI마켓 ? AI마켓작업ID : atlas ? Atlas작업ID : 최적화 ? 'optimization-security-20261028' : PATH비공개 ? PATH비공개작업ID : Workspace다음할일 ? Workspace다음할일작업ID : Workspace조직 ? Workspace조직작업ID : 사이트점검단독 ? 사이트점검단독작업ID : 단독 ? 'spaghetti-finish-20261026' : 지정작업)
    || 정규해시(지정.userStatements) !== 정규해시(AI마켓 ? AI마켓원문 : atlas ? Atlas작업원문 : 최적화 ? 최적화검수원문 : PATH비공개 ? PATH비공개원문 : Workspace다음할일 ? Workspace다음할일원문 : Workspace조직 ? Workspace조직원문 : 사이트점검단독 ? 사이트점검단독원문 : 단독 ? 단독검수원문 : 사용자지정원문)) throw new Error('사용자지정 작업 ID·직접 사용자 원문이 승인 범위와 다르다');
  if (사이트점검단독 && (!files.length || files.some(f => f.옛경로 || !['A', 'M'].includes(f.상태)) || candidate && candidate.종류 !== 'synk.im')) throw new Error('사이트 점검 단독 검수는 정확한 추가·수정 원천과 synk.im 후보만 지원한다 — 삭제·이름 변경·후보 단독 불가');
  if (atlas && files.some(f => f.옛경로 || /^[DR]/.test(f.상태 || ''))) throw new Error('Atlas 사용자지정은 원천 삭제·이름 변경을 허용하지 않는다');
  if (PATH비공개 && files.some(f => f.옛경로 || /^[DR]/.test(f.상태 || ''))) throw new Error('PATH 비공개 사용자지정은 원천 삭제·이름 변경을 허용하지 않는다');
  // 회사 배포는 이 원천 증명을 기존 릴리스 결속으로 잇는다. 다른 공개 후보 권한은 열지 않는다.
  if (Workspace다음할일 && (candidate || 지정.candidate !== null || files.some(f => f.옛경로 || !['A', 'M'].includes(f.상태)))) throw new Error('Workspace 다음 할 일 사용자지정은 추가·수정 원천만 지원한다 — 배포 후보·삭제·이름 변경 불가');
  if (Workspace조직 && (candidate || 지정.candidate !== null || files.some(f => f.옛경로 || !['A', 'M'].includes(f.상태)))) throw new Error('Workspace 조직 사용자지정은 추가·수정 원천만 지원한다 — 배포 후보·삭제·이름 변경 불가');
  if (AI마켓 && files.some(f => f.옛경로 || /^[DR]/.test(f.상태 || ''))) throw new Error('AI 마켓 사용자지정은 원천 삭제·이름 변경을 허용하지 않는다');
  const 아르곤대체 = AI마켓 && o.종류 === '화면';
  if (정규해시(지정.requiredReviewers) !== 정규해시(검수자) || 지정.finalReviewer !== 최종 || 지정.allowFallback !== 아르곤대체) throw new Error(`사용자지정은 묶음별 ${검수자.join('·')}와 최종 전체 ${최종} 판정이 필요하며 ${아르곤대체 ? '실제 아르곤 한도·로그인 막힘만 독립 GPT가 대신한다' : '대체를 허용하지 않는다'}`);
  const checkRows = (rows, expected, role) => {
    if (!Array.isArray(rows) || rows.length !== expected.length) throw new Error(`사용자지정 ${role} 경로 전체가 맞지 않는다`);
    const seen = new Set();
    for (const row of rows) {
      안전경로(o.저장소, row.path);
      const match = expected.find(f => f.path === row.path);
      if (seen.has(row.path) || !['GPT', 'Claude', 'GPT+Claude', '기계생성'].includes(row.author)
        || AI마켓 && !['GPT', ...(role === '배포 후보' ? ['기계생성'] : [])].includes(row.author)
        || !(AI마켓 ? AI마켓범위맞나(row.scope, row.path, role, o.종류) : atlas ? Atlas범위맞나(row.scope, row.path, role) : 최적화 ? 최적화범위맞나(row.scope, row.path, role, match?.kind) : PATH비공개 ? PATH비공개범위맞나(row.scope, row.path, role, match?.kind) : Workspace다음할일 ? Workspace다음할일범위맞나(row.scope, row.path, role, o.종류, row.author) : Workspace조직 ? Workspace조직범위맞나(row.scope, row.path, role, o.종류, row.author) : 사이트점검단독 ? 사이트점검단독범위맞나(row.scope, row.path, role, o.종류, row.author) : 단독 ? 단독범위맞나(row.scope, row.path, role) : 지정범위맞나(row.scope, row.path))) throw new Error(`사용자지정 범위·작성자 오류: ${row.path}`);
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
  return { 판, 작성자: AI마켓 ? 'GPT' : '혼합', 종류: o.종류, GPT구독: '유지', 필수: [...검수자], 예외: null,
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

// 2026-11-10 사이트 점검: 구현 담당만 직접 승인했다. 검수자·재검수·배포 증명은 일반 화면 정책 그대로다.
export const 사이트점검작업ID = 'site-audit-20261110';
export const 사이트점검화면정책 = p => p?.담당예외?.taskId === 사이트점검작업ID && p.작성자 === 'GPT' && p.종류 === '화면';
const 사이트점검원천 = new Set([
  'site-v10/build.mjs', 'site-v10/drama.css', 'site-v10/drama.js', 'site-v10/content/ko.mjs', 'site-v10/content/en.mjs', 'site-v10/public-index.mjs',
  'experiences/path-travel/planner-ui.mjs', 'experiences/path-travel/index.html', 'experiences/brand-opening/home.html',
  'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/index.html',
]);
const 사이트점검공개 = new Set([
  'index.html', 'en/index.html', 'lab/index.html', 'en/lab/index.html', 'shift/index.html', 'en/shift/index.html',
  'assets/v10/drama.css', 'assets/v10/drama.js', 'assets/v10/pulse-redirect.js', 'robots.txt', 'sitemap.xml',
  'pulse-app/index.html', 'llms.txt', 'try/travel/index.html', 'try/travel/planner-ui.mjs', 'world/index.html', 'world/mobile.html', 'world/desktop.html',
]);
const 사이트점검보조 = new Set([
  'qa/drama.test.mjs', 'qa/shift-lectures.test.mjs', 'qa/v11-site.test.mjs', 'qa/public-index.test.mjs', 'qa/RESULTS.md', 'package.json',
  'docs/_ops/결정.md', 'docs/_ops/트랙.md',
  ...[...사이트점검공개].filter(p => !p.startsWith('world/')).map(p => `dist/${p}`),
]);
function 사이트점검범위검사(o, files, candidate, 판) {
  if (판 < 6 || o.작성자 !== 'GPT' || o.종류 !== '화면' || o.사용자지정 || o.예외 || o.GPT구독 && o.GPT구독 !== '유지'
    || !files.some(f => 사이트점검원천.has(f.경로))
    || files.some(f => !['A', 'M'].includes(f.상태) || f.옛경로 || !사이트점검원천.has(f.경로) && !사이트점검보조.has(f.경로))
    || candidate && (candidate.종류 !== 'synk.im' || candidate.항목.some(f => f.종류 === '지움' || !사이트점검공개.has(f.경로)))) {
    throw new Error('사이트 점검의 직접 승인 범위를 벗어난 담당 예외 — GPT 화면 구현만, 정확한 원천·공개 경로와 일반 화면 검수 필수');
  }
}
export function 정책만들기(o, files, { 판 = 정책판 } = {}) {
  if (![1, 2, 3, 4, 5, 6, 7].includes(판) || ([3, 4].includes(판)) !== Boolean(o.사용자지정)) throw new Error(`모르는 검수 정책 판 또는 사용자지정 누락: ${판}`);
  const candidate = 후보읽기(o.배포후보);
  const 기준이미지만 = candidate?.종류 === 'synk.im' && candidate.항목.every(f => /^\.github\/site-check\/baseline\/.+\.(?:json|png|jpe?g|webp)$/i.test(f.경로));
  if (o.담당예외 === 개인화생성물작업ID) return 개인화생성물정책(o, files, candidate, 판);
  if (candidate && o.종류 !== (candidate.종류 === 'synk.im' && !기준이미지만 ? '화면' : '백엔드')) throw new Error(`배포 후보 ${candidate.종류}에 맞는 검수 종류가 아니다`);
  const 사이트점검 = o.담당예외 === 사이트점검작업ID;
  if (사이트점검) 사이트점검범위검사(o, files, candidate, 판);
  if ([3, 4].includes(판)) return 사용자지정정책(o, files, candidate, 판);
  // 2026-10-28 직접 사용자 승인: 이 학습 흐름에 한해 담당과 Fable을 대체한다.
  // 일반 정책·검수 원문·SHA 사슬·P0/P1 처리·배포 바이트 검사는 그대로다.
  if (o.담당예외 != null && !사이트점검) {
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
  if (!['Claude', 'GPT', '카본'].includes(작성자)) throw new Error('--작성자는 Claude|GPT|카본');
  if (작성자 === '카본' && (판 < 6 || o.종류 !== '화면')) throw new Error('카본 작성자는 현재 판의 화면 구현에만 쓴다');
  if (작성자 === 'GPT' && o.종류 === '화면' && !사이트점검) throw new Error('GPT 세션의 화면 구현은 카본, Claude 세션은 Claude 담당이다 — GPT 작성 화면 정책은 없다');
  if (!['유지', '종료'].includes(구독)) throw new Error('--GPT구독은 유지|종료');
  if (구독 === '종료' && (!o.사유?.trim() || 작성자 !== 'Claude')) throw new Error('GPT 구독 종료는 Claude 작업에서 --사유와 함께 명시한다');
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
  return { 판, 작성자, 종류: o.종류, GPT구독: 구독, ...(구독 === '종료' ? { 구독사유: o.사유.trim() } : {}), 필수, 예외, ...(페이블생략 ? { 페이블생략 } : {}),
    ...(사이트점검 ? { 담당예외: { taskId: 사이트점검작업ID, userStatement: '이번 수정은 GPT가 직접 진행', scope: '2026-11-10 사이트 점검의 GPT 화면 구현만 승인. 일반 화면 검수·재검수·앞판·SHA·배포 조건 유지.' } } : {}) };
}
/** Claude 백엔드의 다른 회사 검수 순서 — 앞 검수자가 한도·로그인으로 막혔을 때만 다음으로 넘어간다(2026-10-24 다섯 가지 ①).
 *  화면(아르곤 → Fable 최종)과 GPT 작성(GPT·Claude 둘 다 필수)은 null. 봉인된 정책 판의 순서다 —
 *  판 5까지 GPT → 아르곤 → Fable, 판 6(2026-11-08)부터 아르곤 다음에 그록(GPT 구독 종료면 아르곤 → 그록 → Fable).
 *  GPT 작성은 한 자리의 사슬이 아니라 두 자리라서 여기 들지 않는다 — 판 7의 GPT 자리 대신은 GPT자리대체정책 · 대신할검수자가 맡는다. */
export function 대체순서(정책) {
  if (정책.사용자지정) return null;
  if (정책.종류 === '화면' || 정책.작성자 === 'GPT') return null;
  const 그록 = 정책.판 >= 6 ? ['그록'] : [];
  return 정책.GPT구독 === '종료' ? ['아르곤', ...그록, 'Fable'] : ['GPT', '아르곤', ...그록, 'Fable'];
}
/** 그록이 대체 순서에 든 정책인가(판 6 Claude 백엔드) — 그록 결과를 막힘·대신 판정에 넣고, 그록이 대신 본 사슬의 그록 P2를 처리하게 한다. */
export const 그록대체정책 = 정책 => Boolean(정책 && 대체순서(정책)?.includes('그록'));
/** GPT 작성 백엔드의 GPT 자리를 아르곤(카본)이 대신할 수 있는 정책인가(판 7, 2026-11-14 유호님 「웅 만약에 한도에 차면 카본이 대시 봐도 돼」).
 *  GPT가 한도·로그인으로 막힌 증거(막힘증거 — 주간 문턱에 걸려 고를 계정이 없는 것도 한도)가 있을 때만 아르곤이 그 자리를 채운다.
 *  Claude 자리는 대신이 없고 아르곤 다음 차례도 없다. 직접 승인한 담당예외 · 사용자지정은 그 승인 그대로라 들지 않는다. */
export const GPT자리대체정책 = 정책 => Boolean(정책 && 정책.판 >= 7 && 정책.작성자 === 'GPT' && 정책.종류 === '백엔드' && !정책.담당예외 && !정책.사용자지정);
/** 지금 규칙으로 꼭 받아야 하는 검수자(대체는 빼고). 옛 판 1의 [아르곤, GPT]도 [GPT]로 본다. */
export const 실제필수 = 정책 => (대체순서(정책) ? [대체순서(정책)[0]] : 정책.필수);
export const 필수글 = 정책 => {
  if (AI마켓아르곤대체(정책)) return '아르곤(실제 한도·로그인 실패 증거가 있을 때만 독립 GPT가 대신) + 전체 후보에 대한 독립 GPT 최종 판정';
  if (정책.담당예외?.taskId === 개인화생성물작업ID) return 'GPT · Claude(이번 Atlas 엔진 생성물의 직접 사용자 승인; 대체 없음)';
  if (정책.담당예외?.taskId === 'topik-writing-semantic-20261028') return '아르곤(이번 TOPIK 의미 튜터 작업의 직접 사용자 승인; 대체 없음)';
  if (정책.사용자지정) return `묶음별 ${정책.필수.join(' · ')} + 전체 후보에 대한 최종 ${정책.사용자지정.finalReviewer} 배포 판정(대체 없음)`;
  const 순서 = 대체순서(정책);
  if (정책.페이블생략) return `아르곤(Fable 생략 — ${정책.페이블생략} · 아르곤이 한도·로그인으로 막히거나 아르곤 P0·P1을 고치면 Fable)`;
  if (GPT자리대체정책(정책)) return 'GPT · Claude(GPT가 한도·로그인 · 주간 문턱으로 막힌 증거가 있을 때만 카본(아르곤)이 GPT 자리를 대신 · Claude 자리는 대신 없음)';
  return 순서 ? `${순서[0]}(한도·로그인으로 막히면 ${순서.slice(1).join(' → ')}${순서.includes('그록') ? ' · 그록이 대신 본 사슬은 그록 P2도 처리를 적는다' : ''})` : 정책.필수.join(' · ');
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
  const 도구 = 누구 === 'GPT' ? 'codex' : 누구 === '그록' ? 'grok' : 'agy';
  if (usage?.주간 === 0) return { 종류: '한도', 도구, 원문: JSON.stringify(usage) };
  const text = String(raw || '');
  // 그록(11-07): tools/lib/그록호출.js가 한도는 「그록 사용량 한도 — …」, 로그인은 「그록 로그인이 필요하다 — grok login …」으로 던진다
  const quota = 누구 === 'GPT' ? /(?:hit your usage limit|usage limit.*(?:reached|exceeded)|no Pro account.*(?:available|remaining)|Pro 계정.*(?:없|한도)|주간.*한계)/i
    : 누구 === '그록' ? /(?:그록 사용량 한도|usage limit|rate.?limit|429|quota.*(?:exceeded|exhausted))/i
    : /(?:RESOURCE_EXHAUSTED|QUOTA_EXHAUSTED|quota.*(?:exceeded|exhausted)|limit remaining 0|429.*(?:quota|rate))/i;
  const login = /(?:not logged in|login required|authentication (?:failed|required)|unauthenticated|invalid credential|로그인이 필요)/i;
  return quota.test(text) || login.test(text) ? { 종류: quota.test(text) ? '한도' : '로그인', 도구, 원문: text } : null;
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
/** GPT 작성 작업의 Claude를 첫 판·끝 판과 자기 지적으로 줄인 정책인가(판 5부터). 담당예외는 직접 승인한 검수자 그대로다. */
export const 끝판정책 = 정책 => 정책.판 >= 5 && 정책.작성자 === 'GPT' && !정책.담당예외 && !정책.사용자지정;
/** 다시 검수자: 그 지적을 낸 검수자. GPT 작성은 GPT(판 5부터 Claude는 끝 판과 자기 지적만, 옛 판은 둘 다), 화면은 Fable이 끝 상태를 본다, 대상이 없으면 정책의 첫 검수자.
 *  화면 Fable 생략 묶음은 다시 볼 지적이 없으면 아르곤만 — 고친 P0·P1이 있으면 화면을 보는 Fable이 함께 본다.
 *  그록이 낸 지적은 그록에게 바로 묻지 않는다 — 함께 다시 보는 검수자(없으면 정책의 첫 검수자)가 보고, 판 6 백엔드는 그 검수자가
 *  한도·로그인으로 막혔을 때만 차례대로 그록까지 온다(2026-11-08 「그록은 GPT·아르곤이 둘 다 막혔을 때만」).
 *  판 7 GPT 작성도 다시 검수자는 그대로 GPT(끝 판과 Claude 지적이면 Claude도)다 — GPT가 막혔을 때만 대신할검수자가 아르곤을 부르고,
 *  아르곤이 낸 지적은 판 6까지처럼 아르곤의 재확인 답으로 판정한다(다시고리판정의 판정자). */
export function 다시검수자들(정책, 대상, { 끝판 = false } = {}) {
  if (정책.사용자지정) return [...정책.필수];
  if (끝판정책(정책)) return 끝판 || 대상.some(t => t.출처 === 'Claude') ? ['GPT', 'Claude'] : ['GPT'];
  if (정책.작성자 === 'GPT' && !사이트점검화면정책(정책)) return [...정책.필수];
  const 낸 = ['아르곤', 'GPT', 'Fable'].filter(w => 대상.some(t => t.출처 === w));
  if (정책.종류 === '화면') return 정책.페이블생략 && !낸.length ? ['아르곤'] : [...new Set([...낸, 'Fable'])];
  return 낸.length ? 낸 : [대체순서(정책)[0]];
}
/** 그 검수자가 한도·로그인으로 막혔을 때 대신하는 차례(자신 포함). GPT 작성은 판 6까지 대신이 없고, 판 7부터는 GPT만 아르곤이 대신한다 —
 *  Claude는 대신이 없고 아르곤 다음 차례도 없다(2026-11-14 유호님 「웅 만약에 한도에 차면 카본이 대시 봐도 돼」).
 *  화면과 판 5까지는 GPT → 아르곤 → Fable의 자기 뒤 차례다(그록은 화면 대체에 들지 않는다).
 *  판 6 Claude 백엔드는 그 대체 순서(GPT → 아르곤 → 그록 → Fable)를 따르되, 그록은 그 앞 검수자(GPT·아르곤)가 모두 막힌 뒤에만 온다 —
 *  아르곤이 낸 지적을 다시 볼 때 아르곤이 막히면 GPT가 먼저다(아르곤 → GPT → 그록 → Fable, 2026-11-08 「그록은 GPT·아르곤이 둘 다 막혔을 때만」). */
export function 대신할검수자(정책, 누구) {
  if (AI마켓아르곤대체(정책) && 누구 === '아르곤') return ['아르곤', 'GPT'];
  if (정책.사용자지정) return [누구];
  if (GPT자리대체정책(정책)) return 누구 === 'GPT' ? ['GPT', '아르곤'] : [누구];
  if (정책.작성자 === 'GPT' && !사이트점검화면정책(정책)) return [누구];
  if (그록대체정책(정책)) {
    const 순서 = 대체순서(정책), i = 순서.indexOf(누구), k = 순서.indexOf('그록');
    if (i < 0) return [누구];
    return i < k ? [누구, ...순서.slice(0, k).filter(w => w !== 누구), ...순서.slice(k)] : 순서.slice(i);
  }
  const 차례 = ['GPT', '아르곤', 'Fable'], i = 차례.indexOf(누구);
  return i < 0 ? [누구] : 차례.slice(i);
}
/** 머리(2026-11-12): 그 스냅샷이 선 커밋(끝 커밋, 작업본이면 그때 HEAD) — 증명에 묶어 합침 고리가 둘의 바탕을 증명 밖 칸에서 읽지 않게 한다(GPT 검수 GA2). 옛 증명에는 없다. */
export function 입력증명({ 정책, 파일, 배포후보 = null, 항목 = [], 자료해시 = null, 보조파일 = [], 후보앞판 = null, 머리 = null }) {
  const body = { 정책, 파일, 배포후보, 항목, 자료해시, 보조파일, ...(후보앞판 ? { 후보앞판 } : {}), ...(머리 ? { 머리 } : {}) };
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}`, 항목 };
}

// ── 합침 고리(2026-11-12) ─────────────────────────────────────────────
// 앞 검수 뒤 이 세션의 고침 없이 origin/master에 먼저 오른 커밋을 합쳐 바이트만 바뀐 판은 검수자를 다시 부르지 않고
// 기계 대조로 사슬을 잇는다(검수묶음.mjs 다시 --합침만). 경계: 배포 바이트 = (origin/master에 있는 커밋들) ⊕ (이 사슬이 검수한 고침) —
// 첫 준비의 바탕 아래 남의 변경을 이 사슬 검수자가 보지 않는 것과 같은 경계를 사슬 중간에 오른 origin 커밋까지 넓힌다.
// 이 세션의 손 고침(작업본 · 안 올린 커밋 · 충돌 풀이 · 검수한 고침과 같은 커밋에 섞여 올라간 덧고침)은 한 줄이라도 거절한다.
export const 원격참조 = 'refs/remotes/origin/master';
const 판열쇠 = x => (x?.sha256 == null ? null : `${x.모드}\u0000${x.sha256}`);
const 글바이트 = b => !b.subarray(0, 8000).includes(0);
/** git merge-file -p <a> <y> <t> — 종료 0만 깨끗한 합침, 1~127은 충돌 수, 그 밖은 실행 오류. */
export function git합침(a, y, t) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-merge-'));
  try {
    for (const [n, b] of [['a', a], ['y', y], ['t', t]]) fs.writeFileSync(path.join(임시, n), b);
    const r = spawnSync('git', ['merge-file', '-p', 'a', 'y', 't'], { cwd: 임시, windowsHide: true, maxBuffer: 1 << 28 });
    if (r.error) throw r.error;
    if (r.status === 0) return { 결과: r.stdout, 충돌: false };
    if (r.status > 0 && r.status < 128) return { 결과: null, 충돌: true };
    throw new Error(`git merge-file 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 300)}`);
  } finally { fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 }); }
}
/** 세 방향 합침 ⊕(a, y, t) — 판은 { sha256, 모드, 바이트 }(없는 판은 sha256 null). 같은 쪽 규칙이 먼저고, 셋 다 있는 글(NUL 없음)만 git merge-file로 바이트를 합친다.
 *  이진 · 있음/없음이 엇갈린 셋 · 모드 셋이 다 다름 · 줄 충돌은 충돌이다. 돌려주는 판에는 바이트가 있다(없는 판은 null). */
export function 판합침(a, y, t, { 합치기 = git합침 } = {}) {
  const ka = 판열쇠(a), ky = 판열쇠(y), kt = 판열쇠(t);
  if (ka === kt) return { 판: a, 충돌: false };
  if (ka === ky) return { 판: t, 충돌: false };
  if (kt === ky) return { 판: a, 충돌: false };
  if (!a.바이트 || !y.바이트 || !t.바이트 || ![a, y, t].every(x => 글바이트(x.바이트))) return { 판: null, 충돌: true };
  const 모드 = a.모드 === t.모드 ? a.모드 : a.모드 === y.모드 ? t.모드 : t.모드 === y.모드 ? a.모드 : null;
  if (!모드) return { 판: null, 충돌: true };
  const 바이트 = a.바이트.equals(t.바이트) ? a.바이트 : a.바이트.equals(y.바이트) ? t.바이트 : t.바이트.equals(y.바이트) ? a.바이트 : null;
  if (바이트) return { 판: { sha256: sha256(바이트), 모드, 바이트 }, 충돌: false };
  const r = 합치기(a.바이트, y.바이트, t.바이트);
  return r.충돌 ? { 판: null, 충돌: true } : { 판: { sha256: sha256(r.결과), 모드, 바이트: r.결과 }, 충돌: false };
}
function 깃(cwd, args, { buffer = false, input = undefined, 허용 = [0] } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, windowsHide: true, maxBuffer: 1 << 29, input, ...(buffer ? {} : { encoding: 'utf8' }) });
  if (r.error) throw r.error;
  if (!허용.includes(r.status)) throw new Error(`합침 대조 git ${args[0]} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 300)}`);
  return r;
}
const 줄들 = s => String(s).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// 사슬 중간의 합침은 몇 시간 · 며칠 안의 origin 커밋이다 — 바탕이 너무 멀면 새로 준비하는 편이 맞고, 기록도 커진다
export const 합침커밋상한 = 3000;
/** 날 바이트를 맞춘 꼴 판으로 — 소스 스냅샷 해시와 같은 꼴(utf8 글은 CRLF → LF). 배포 후보도 이 꼴로 견준다: 날 바이트는 배포 도구가 따로 origin/master와 대조한다. */
export const 맞춘판 = (b, 모드) => { if (b == null) return { sha256: null, 모드: null, 바이트: null }; const m = 맞춘내용(b).바이트; return { sha256: sha256(m), 모드, 바이트: m }; };
/** 여러 rev의 항목 판을 `git cat-file --batch` 한 번으로 — Map(rev → Map(열쇠 → 판)). 모드는 그 트리 항목의 모드(%(objectmode)), 없는 경로는 빈 판. */
function 판들읽기(cwd, revs, 항목) {
  const 결과 = new Map(revs.map(rev => [rev, new Map(항목.map(x => [x.열쇠, 맞춘판(null)]))]));
  const 줄 = revs.flatMap(rev => 항목.map(x => ({ rev, x })));
  if (!줄.length) return 결과;
  if (줄.some(({ x }) => /[\r\n]/.test(x.경로))) throw new Error('합침 대조할 수 없는 경로(줄바꿈)');
  const out = 깃(cwd, ['cat-file', '--batch=%(objectmode) %(objectname) %(objecttype) %(objectsize)'], { buffer: true, input: 줄.map(({ rev, x }) => `${rev}:${x.경로}`).join('\n') + '\n' }).stdout;
  let i = 0;
  for (const { rev, x } of 줄) {
    const 끝 = out.indexOf(10, i);
    if (끝 < 0) throw new Error(`합침 대조 blob 읽기가 끊겼다: ${x.경로}`);
    const 머리 = out.subarray(i, 끝).toString('utf8');
    if (머리 === `${rev}:${x.경로} missing`) { i = 끝 + 1; continue; }
    const m = /^(\d{6}) ([0-9a-f]+) (\w+) (\d+)$/.exec(머리);
    if (!m) throw new Error(`합침 대조 blob 읽기 실패: ${x.경로} (${rev.slice(0, 9)}) — ${머리.slice(0, 80)}`);
    if (m[3] !== 'blob' || !['100644', '100755'].includes(m[1])) throw new Error(`합침 대조할 수 없는 git 모드: ${x.경로} ${m[1]} ${m[3]} (${rev.slice(0, 9)})`);
    const n = Number(m[4]);
    결과.get(rev).set(x.열쇠, 맞춘판(Buffer.from(out.subarray(끝 + 1, 끝 + 1 + n)), m[1]));
    i = 끝 + 1 + n + 1;
  }
  return 결과;
}
const 덩이로 = (xs, n = 60) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const 커밋이름 = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
/** git rev-list 출력(커밋 이름만 — 자유 글 없음)을 줄마다 읽어 꼴을 본다. */
const 커밋줄들 = (cwd, args) => 줄들(깃(cwd, ['rev-list', ...args]).stdout).map(줄 => {
  const xs = 줄.split(' ');
  if (!xs.every(x => 커밋이름.test(x))) throw new Error(`합침 대조 커밋 목록을 읽지 못했다: ${줄.slice(0, 90)}`);
  return xs;
});
/** Y..O 커밋을 오래된 것부터 — [{ 커밋, 부모[] }]와, 경로 묶음을 바꾼 커밋 집합을 주는 닿음(경로들). 모두 `rev-list` 출력(커밋 이름뿐)에서만 읽는다 —
 *  커밋 제목의 제어 문자(GPT 검수 GA3)나 다음 커밋 이름과 같은 파일 이름(GPT 다시 검수 GA2)으로 경계를 속이지 못하게, 경로는 git의 경로 거름(pathspec)이 고른다. */
function 범위커밋들(cwd, Y, O) {
  const 차례 = 커밋줄들(cwd, ['--topo-order', '--reverse', '--parents', `${Y}..${O}`]).map(([커밋, ...부모]) => ({ 커밋, 부모 }));
  const 닿음 = 경로묶음 => {
    const s = new Set();
    for (const 덩이 of 덩이로([...new Set(경로묶음)])) for (const [c] of 커밋줄들(cwd, ['--full-history', `${Y}..${O}`, '--', ...덩이.map(p => `:(literal)${p}`)])) s.add(c);
    return s;
  };
  return { 차례, 닿음 };
}
/** 보이는 기록용 커밋 제목 — 판정에는 쓰지 않는다. 제어 문자는 빈칸으로. */
function 커밋제목들(cwd, 커밋들) {
  const 제목 = new Map();
  for (const 덩이 of 덩이로(커밋들, 100)) for (const 줄 of 깃(cwd, ['log', '-z', '--no-walk=unsorted', '--format=%H %s', ...덩이]).stdout.split('\0')) {
    const m = /^([0-9a-f]{40}(?:[0-9a-f]{24})?) ([\s\S]*)$/.exec(줄);
    if (m) 제목.set(m[1], m[2].replace(/[\u0000-\u001f\u007f]/g, ' ').trim());
  }
  return 제목;
}
/** 합침 대조 — 앞 검수 판 A(항목마다 앞 = { sha256, 모드, 바이트 }), 지금 판 S(지금 = { sha256, 모드 }), 앞 고리 머리 H, origin 판 O로
 *  둘의 바탕 Y = merge-base(H, O)를 잡고 세 모양 가운데 하나로 기대 판 E를 정해 S와 견준다. 항목 = [{ 열쇠, 갈래: '소스', 경로, 앞, 지금 }] — 배포 후보는 바이트가 바뀌면 합침만을 받지 않아 항목에 없다.
 *  O는 만들 때 merge-base(지금 머리, origin/master), 다시 대조할 때는 기록한 값(origin/master의 조상인지 본다).
 *   · 앞 판 그대로 — A = Y(이 사슬 고침이 이미 Y 아래): E = O
 *   · 안 올림 — O에 이 사슬 고침이 한 줄도 없다(M = A⊕O가 깨끗하고, 고침이 있는 항목마다 M에서 고침을 되돌리면 정확히 O): E = M
 *   · 올림 — O에 이 사슬 고침이 있다: Y..O에서 그 고침을 처음 들인, 그 고침만 담은 부모 하나인 커밋(나르개)이 있어야 한다 —
 *     부모 C^에는 이 사슬 고침이 한 줄도 없고(안 올림과 같은 되돌리기 대조) 모든 항목에서 C = A⊕C^. 고침 일부를 덧고침과 함께 먼저 올리고
 *     나머지를 따로 올린 꼴은 나르개가 없다(GPT 검수 GA1). E = O
 *  구조 문제(H · O · Y를 못 읽음, O가 origin/master에 없음, 바탕이 여럿 · 없음)는 던지고, 판정은 { 모양, 다름, 충돌, 나르개 }로 돌려준다. */
export function 합침대조({ 저장소, 앞머리, 지금머리 = null, origin = null, 항목, 합치기 = git합침 }) {
  const 바탕하나 = (a, b, 말) => {
    if (!a || !b) throw new Error(`${말}을 git에서 읽지 못했다: 기록 없음`);
    const r = 깃(저장소, ['merge-base', '--all', a, b], { 허용: [0, 1, 128] }), xs = 줄들(r.stdout);
    if (r.status === 128) throw new Error(`${말}을 git에서 읽지 못했다: ${String(r.stderr || '').trim().split('\n')[0].slice(0, 160)}`);
    if (xs.length !== 1) throw new Error(`${말}의 바탕이 ${xs.length ? '여럿이다(교차 합침)' : '없다'} — 합침만으로 잇지 못한다`);
    return xs[0];
  };
  // O: 만들 때는 지금 머리가 서 있는 가장 새 origin 커밋, 다시 대조할 때는 기록한 값이 아직 origin/master의 조상인지
  let O;
  if (origin) {
    const r = 깃(저장소, ['merge-base', '--is-ancestor', origin, 원격참조], { 허용: [0, 1, 128] });
    if (r.status !== 0) throw new Error(r.status === 1 ? `origin 판 ${String(origin).slice(0, 9)}가 origin/master에 없다` : `기록한 origin 판 · origin/master 원격 참조를 git에서 읽지 못했다: ${String(r.stderr || '').trim().split('\n')[0].slice(0, 160)}`);
    O = origin;
  } else O = 바탕하나(지금머리, 원격참조, '지금 머리와 origin/master');
  const Y = 바탕하나(앞머리, O, '앞 고리 머리와 origin 판');
  const 범위 = 범위커밋들(저장소, Y, O);
  if (범위.차례.length > 합침커밋상한) throw new Error(`앞 고리 머리와 origin 판 사이 커밋이 ${범위.차례.length}개라 합침 대조를 하지 않는다 — 새로 준비한다`);
  // 감사용 기록: 항목 경로를 바꾼 Y..O 커밋, 오래된 것부터 — 나르개 후보도 여기서 고른다. 제목은 보이기만 하고 판정에는 쓰지 않는다
  const 항목닿음 = 항목.length ? 범위.닿음(항목.map(x => x.경로)) : new Set();
  const 고른 = 범위.차례.filter(c => 항목닿음.has(c.커밋));
  const 제목 = 고른.length ? 커밋제목들(저장소, 고른.map(c => c.커밋)) : new Map();
  const 커밋들 = 고른.map(c => ({ 커밋: c.커밋, 제목: 제목.get(c.커밋) ?? '' }));
  const 판 = 판들읽기(저장소, [Y, O], 항목), Y판 = 판.get(Y), O판 = 판.get(O);
  const 고침 = 항목.filter(x => 판열쇠(x.앞) !== 판열쇠(Y판.get(x.열쇠)));
  // X에 이 사슬 고침이 한 줄도 없는가 — A⊕X가 모든 항목에서 깨끗하고, 고침이 있는 항목마다 그 합침에서 고침을 되돌리면 정확히 X.
  // 같은 고침이 X에 이미 있으면 합침은 깨끗해도 되돌린 결과가 X와 달라 드러난다.
  const 고침없는판 = X판 => {
    const M = new Map(), 충돌 = [];
    for (const x of 항목) { const r = 판합침(x.앞, Y판.get(x.열쇠), X판.get(x.열쇠), { 합치기 }); if (r.충돌) 충돌.push(x.열쇠); else M.set(x.열쇠, r.판); }
    const 없음 = !충돌.length && 고침.every(x => { const r = 판합침(M.get(x.열쇠), x.앞, Y판.get(x.열쇠), { 합치기 }); return !r.충돌 && 판열쇠(r.판) === 판열쇠(X판.get(x.열쇠)); });
    return { 없음, M, 충돌 };
  };
  let 모양, 기대, 나르개 = null, 충돌 = [];
  if (!고침.length) { 모양 = '앞 판 그대로'; 기대 = O판; }
  else {
    const o = 고침없는판(O판);
    충돌 = o.충돌;
    if (o.없음) { 모양 = '안 올림'; 기대 = o.M; }
    else {
      모양 = '올림'; 기대 = O판;
      // 나르개 후보: 이 사슬 고침이 있는 경로를 바꾼, 부모가 하나인 Y..O 커밋 — 그 커밋과 부모 판을 한 번에 읽는다.
      // 부모에 이 사슬 고침이 한 줄도 없고(처음 들인 커밋) 모든 항목에서 C = A⊕C^여야 한다(덧고침 · 나눠 올림이면 없다).
      const 고침닿음 = 범위.닿음(고침.map(x => x.경로));
      const 후보들 = 고른.filter(c => c.부모.length === 1 && 고침닿음.has(c.커밋));
      const 후보판 = 후보들.length ? 판들읽기(저장소, [...new Set(후보들.flatMap(c => [c.커밋, c.부모[0]]))], 항목) : new Map();
      for (const c of 후보들) {
        const C판 = 후보판.get(c.커밋), P판 = 후보판.get(c.부모[0]), p = 고침없는판(P판);
        if (p.없음 && 항목.every(x => 판열쇠(p.M.get(x.열쇠)) === 판열쇠(C판.get(x.열쇠)))) { 나르개 = c.커밋; break; }
      }
    }
  }
  const 다름 = 항목.filter(x => 판열쇠(x.지금) !== 판열쇠(기대.get(x.열쇠))).map(x => x.열쇠);
  const 짧게 = x => (x?.sha256 == null ? null : { sha256: x.sha256, 모드: x.모드 });
  const 경로 = 항목.filter(x => 판열쇠(x.앞) !== 판열쇠(x.지금) || 고침.includes(x)).map(x => ({ 열쇠: x.열쇠, 앞: 짧게(x.앞), 바탕: 짧게(Y판.get(x.열쇠)), origin: 짧게(O판.get(x.열쇠)), 기대: 짧게(기대.get(x.열쇠)), 지금: 짧게(x.지금) }));
  return { 모양, origin: O, 바탕: Y, 앞머리, 나르개, 다름, 충돌: 모양 === '안 올림' ? [] : 충돌, 고침: 고침.map(x => x.열쇠), 경로, 커밋들 };
}
/** 합침 대조가 통과인지 — 거절 까닭 목록(빈 목록이면 통과). */
export function 합침거절(r) {
  const 까닭 = [];
  const 말 = 열쇠들 => 열쇠들.map(k => k.replace(/^소스:/, '').replace(/^후보:/, '배포 후보 ')).join(', ');
  if (r.모양 === '올림' && !r.나르개) 까닭.push(`앞 검수 판의 고침이 origin에 있는데 그 고침만 담은 커밋을 찾지 못했다 — 덧고침이 같이 올라갔거나 나눠 올렸다${r.충돌.length ? `(origin과 합치면 충돌: ${말(r.충돌)})` : ''}`);
  if (r.다름.length) 까닭.push(`지금 판이 ${r.모양 === '안 올림' ? '앞 검수 판 ⊕ origin 판의 깨끗한 합침' : 'origin 판'}과 다르다(손 고침 · 충돌 풀이 · 앞 검수에 없던 고침): ${말(r.다름)}`);
  return 까닭;
}
/** 합침 고리 증명 — 다시증명과 같은 꼴에 합침 기록을 묶는다(검수자 · 대상 · 묶음 없음). */
export function 합침증명(body) {
  if (!body?.합침 || body.대상?.length || body.검수자들?.length || body.항목?.length) throw new Error('합침 고리 증명에는 합침 기록만 있고 검수자 · 대상 · 묶음이 없다');
  return 다시증명(body);
}
