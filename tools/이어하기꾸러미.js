#!/usr/bin/env node
'use strict';
// 네 브랜드의 핵심 자료만 갱신한다. 코드·이력은 GitHub에서 받는다.
// Claude 기억·미확정 후보·전체 git bundle을 자동 복제하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const brands = ['SYNK', 'SYNK LAB', 'SYNK SHIFT', 'SYNK PULSE'];
const forbidden = [/SYNK_보안/i, /로그인\.txt/, /비밀번호/, /password/i,
  /\.env(\.|$)/, /\.clasprc\.json$/, /(^|[\\/])secrets[\\/]/i, /백업코드/];
const 금지인가 = p => forbidden.some(re => re.test(p));
const 문서인가 = p => p.endsWith('.md') || p.startsWith('docs/_ops/') ||
  (p.startsWith('docs/') && p.endsWith('.json'));
const docs = {
  SYNK: ['DESIGN.md', 'docs/AI_운영원칙.md', 'docs/SYNK_철학.md', 'docs/제품방향.md',
    'docs/엔진7종_상향설계_v3.md', 'docs/명품_기준_v1.md',
    'docs/명품브랜딩_v2.md', 'docs/명품브랜딩_조사_2026-09-09.md',
    'docs/마케팅_정본.md', 'docs/명품마케팅_회사별_v1.md', 'docs/명품눈금_v1.md',
    'docs/디자인_컨셉_정본_v1.md', 'docs/디자인_토큰.json',
    'docs/브랜드_폰트_정본.md', 'docs/양모공방_요소사전.md', 'docs/캐릭터/의상제작_정본.md'],
  'SYNK LAB': ['docs/커리큘럼_정본_v1.md', 'docs/반편성_정본_v2.md',
    'docs/강사_교수법_매뉴얼_v1.md', 'docs/자주묻는질문_정본.md'],
  'SYNK SHIFT': ['docs/SHIFT/콘텐츠_배분_v1.md', 'docs/SHIFT/영상_공개선.md'],
  'SYNK PULSE': ['docs/음악자산_장부.md'],
};
function within(root, rel) {
  if (path.isAbsolute(rel) || 금지인가(rel)) throw new Error('허용하지 않는 자료 경로');
  const target = path.resolve(root, rel);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('자료 경로 범위 오류');
  return target;
}
function 목록(root = ROOT) {
  const rows = new Map();
  function add(brand, source, target, googleOnly = false) {
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
        if (entry.isSymbolicLink()) throw new Error('자산 폴더에 링크가 있습니다');
        const tail = path.posix.join(rel, entry.name);
        if (entry.isDirectory()) walk(path.join(dir, entry.name), tail);
        else if (test(tail)) add(brand, source + '/' + tail, target + '/' + tail, true);
      }
    };
    walk(within(root, source));
  }
  for (const brand of brands) {
    add(brand, 'docs/자료안내/' + brand + '.md', '먼저 읽기.md');
    for (const source of docs[brand]) add(brand, source, '정본/' + path.basename(source));
    const slug = { SYNK: 'synk', 'SYNK LAB': 'lab', 'SYNK SHIFT': 'shift', 'SYNK PULSE': 'pulse' }[brand];
    add(brand, 'docs/홍보물/브랜드소개_20260909/' + slug + '.pdf', '소개서.pdf');
  }
  add('SYNK', 'docs/브랜드킷.html', '브랜드 킷.html');
  folder('SYNK', 'docs/엔진', '엔진 7종', p => !p.includes('/') && p.endsWith('.html'));
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
  for (const stage of ['GPT', 'GPT정액시험', 'GPT_표정_누끼_틀', 'GPT_표정_누끼_틀_avif', 'GPT_누끼_틀', 'GPT_누끼_틀_avif'])
    folder('SYNK', 'docs/Loom_자산/옷/' + stage, '확정 자산/마스코트 의상/' + stage, p => /\.(png|avif)$/.test(p));
  return [...rows.values()];
}
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function payload(root, row) {
  const data = fs.readFileSync(within(root, row.source));
  if (!row.source.endsWith('.md')) return data;
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
function copy(root, destination, rows) {
  // 사용자 파일은 자동 삭제하지 않는다. 선택된 파일만 검증해서 갱신한다.
  let written = 0, unchanged = 0;
  for (const row of rows) {
    const source = within(root, row.source);
    const target = within(destination, row.brand + '/' + row.target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const data = payload(root, row);
    const b = fs.existsSync(target) ? fs.statSync(target) : null;
    if (b && data.length === b.size && hash(data) === hash(fs.readFileSync(target))) { unchanged++; continue; }
    fs.writeFileSync(target, data);
    if (hash(data) !== hash(fs.readFileSync(target))) throw new Error('복사 검증 실패: ' + row.target);
    written++;
  }
  return { total: rows.length, written, unchanged, bytes: rows.reduce((n, x) => n + x.bytes, 0) };
}
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--저장소')) throw new Error('전체 이력 복제는 종료했습니다. 일반 핵심 자료 갱신을 사용하세요.');
  const rows = 목록();
  if (args.includes('--재기')) {
    for (const brand of brands) {
      const selected = rows.filter(r => r.brand === brand);
      console.log(JSON.stringify({ brand, files: selected.length, bytes: selected.reduce((n,r)=>n+r.bytes,0) }));
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
    const result = copy(ROOT, dest.base, rows.filter(r => dest.google || !r.googleOnly));
    console.log(JSON.stringify({ location: dest.google ? 'Google Drive' : 'OneDrive', ...result }));
  }
  if (errors) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { 금지인가, 문서인가, within, 목록, copy, payload };
