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
export function 파일상태(root, relative, { rev = null, 역할 = '소스' } = {}) {
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
  const text = !b.subarray(0, 8000).includes(0) && Buffer.from(b.toString('utf8')).equals(b);
  return { 경로: relative, sha256: sha256(text ? b.toString('utf8').replace(/\r\n/g, '\n') : b), 모드: mode, 역할, 해시꼴: text ? 'utf8-lf' : 'bytes' };
}
export function 소스스냅샷(설정, files) {
  const paths = new Map();
  for (const f of files) { paths.set(f.경로, '소스'); if (f.옛경로) paths.set(f.옛경로, '소스'); }
  for (const p of 설정.곁 || []) paths.set(p.replace(/:\d+-\d+$/, '').replace(/\\/g, '/'), '의존');
  for (const p of 설정.시험 || []) if (!/[*?]/.test(p)) paths.set(p.replace(/\\/g, '/'), '시험');
  return [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([p, 역할]) => 파일상태(설정.저장소, p, { rev: 설정.끝 === '작업본' ? null : 설정.끝.커밋, 역할 }));
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
export function 정책만들기(o, files, { 판 = 정책판 } = {}) {
  if (![1, 2].includes(판)) throw new Error(`모르는 검수 정책 판: ${판}`);
  const candidate = 후보읽기(o.배포후보);
  const 기준이미지만 = candidate?.종류 === 'synk.im' && candidate.항목.every(f => /^\.github\/site-check\/baseline\/.+\.(?:json|png|jpe?g|webp)$/i.test(f.경로));
  if (candidate && o.종류 !== (candidate.종류 === 'synk.im' && !기준이미지만 ? '화면' : '백엔드')) throw new Error(`배포 후보 ${candidate.종류}에 맞는 검수 종류가 아니다`);
  const 작성자 = o.작성자 || 'Claude', 구독 = o.GPT구독 || '유지';
  if (!['Claude', 'GPT'].includes(작성자)) throw new Error('--작성자는 Claude|GPT');
  if (작성자 === 'GPT' && o.종류 === '화면') throw new Error('화면 구현은 Claude 담당이다 — GPT 작성 화면 정책은 없다');
  if (!['유지', '종료'].includes(구독)) throw new Error('--GPT구독은 유지|종료');
  if (구독 === '종료' && (!o.사유?.trim() || 작성자 === 'GPT')) throw new Error('GPT 구독 종료는 Claude 작업에서 --사유와 함께 명시한다');
  const 필수 = o.종류 === '화면' ? ['아르곤', 'Fable'] : 작성자 === 'GPT' ? ['GPT', 'Claude'] : 구독 === '종료' ? ['아르곤'] : 판 === 1 ? ['아르곤', 'GPT'] : ['GPT'];
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
  return { 판, 작성자, 종류: o.종류, GPT구독: 구독, ...(구독 === '종료' ? { 구독사유: o.사유.trim() } : {}), 필수, 예외 };
}
/** Claude 백엔드의 다른 회사 검수 순서 — 앞 검수자가 한도·로그인으로 막혔을 때만 다음으로 넘어간다(2026-10-24 다섯 가지 ①).
 *  화면(아르곤 → Fable 최종)과 GPT 작성(GPT·Claude 둘 다, 대체 없음)은 null. 정책 판과 상관없이 지금 규칙이다. */
export function 대체순서(정책) {
  if (정책.종류 === '화면' || 정책.작성자 === 'GPT') return null;
  return 정책.GPT구독 === '종료' ? ['아르곤', 'Fable'] : ['GPT', '아르곤', 'Fable'];
}
/** 지금 규칙으로 꼭 받아야 하는 검수자(대체는 빼고). 옛 판 1의 [아르곤, GPT]도 [GPT]로 본다. */
export const 실제필수 = 정책 => (대체순서(정책) ? [대체순서(정책)[0]] : 정책.필수);
export const 필수글 = 정책 => {
  const 순서 = 대체순서(정책);
  return 순서 ? `${순서[0]}(한도·로그인으로 막히면 ${순서.slice(1).join(' → ')})` : 정책.필수.join(' · ');
};
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
export function 입력증명({ 정책, 파일, 배포후보 = null, 항목 = [], 자료해시 = null, 보조파일 = [] }) {
  const body = { 정책, 파일, 배포후보, 항목, 자료해시, 보조파일 };
  const 검토입력해시 = 정규해시(body);
  return { ...body, 검토입력해시, 표식: `END_OF_FINAL_REVIEW_${검토입력해시}`, 항목 };
}
