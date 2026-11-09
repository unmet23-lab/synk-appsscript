#!/usr/bin/env node
'use strict';
/**
 * 복원점검 — 복원이 어디까지 됐는지 표로 낸다. 아무것도 바꾸지 않는다. 비밀 값은 읽지 않고 파일이 있는지만 본다.
 *   node 복원점검.cjs [--집 <폴더>] [--꾸러미 <풀어 둔 작업 방식 폴더>] [--차이보관 <폴더>] [--시험] [--json]
 * --차이보관: 꾸러미의 글 · 설정이 제자리 파일과 다르면 덮지 않고 이 폴더에 따로 모은다(받은 저장소보다 앞선 글일 수 있다, 11-09 GPT 설계 검토). 합치는 일은 Claude가 본다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function 인자(argv) {
  const 값 = { 집: os.homedir(), 꾸러미: path.join(__dirname, '..'), 시험: false, json: false, 차이보관: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--집') 값.집 = argv[++i];
    else if (a === '--꾸러미') 값.꾸러미 = argv[++i];
    else if (a === '--차이보관') 값.차이보관 = argv[++i];
    else if (a === '--시험') 값.시험 = true;
    else if (a === '--json') 값.json = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  return 값;
}

function 파일수(곳, 조건 = () => true) {
  let 수 = 0;
  const 더미 = [곳];
  while (더미.length) {
    const 여기 = 더미.pop();
    let 줄;
    try { 줄 = fs.readdirSync(여기, { withFileTypes: true }); } catch { continue; }
    for (const e of 줄) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (e.name !== '.git' && e.name !== 'node_modules') 더미.push(path.join(여기, e.name)); } else if (조건(e.name)) 수++;
    }
  }
  return 수;
}

function 돌려보기(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 45000, windowsHide: true });
  return { 됨: r.status === 0, 글: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n')[0] || '' };
}

function 점검(값, 돌림 = 돌려보기) {
  const { 집, 꾸러미, 시험 } = 값;
  const 문서 = path.join(집, 'Documents');
  const 줄 = [];
  const 칸 = (묶음, 항목, 됨, 내용 = '') => 줄.push({ 묶음, 항목, 상태: 됨 === null ? '참고' : 됨 ? '됨' : '안 됨', 내용 });
  for (const c of ['git', 'gh', 'node', 'python', 'rg', 'claude', 'codex', 'clasp', 'ffmpeg', 'agy']) {
    const r = 돌림(process.platform === 'win32' ? 'where.exe' : 'which', [c]);
    칸('프로그램', c, r.됨 ? true : ['git', 'gh', 'node', 'python'].includes(c) ? false : null, r.됨 ? '' : '없음');
  }
  for (const r of ['SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-policy', 'synk-tips', 'claude-session-share']) {
    칸('저장소', r, fs.existsSync(path.join(문서, r, '.git')));
  }
  const 프로젝트 = path.join(집, '.claude', 'projects');
  let 메모폴더 = 0, 메모파일 = 0;
  try {
    for (const e of fs.readdirSync(프로젝트, { withFileTypes: true })) {
      const m = path.join(프로젝트, e.name, 'memory');
      if (e.isDirectory() && fs.existsSync(m)) { 메모폴더++; 메모파일 += 파일수(m); }
    }
  } catch {}
  let 꾸러미메모 = 0;
  try { 꾸러미메모 = 파일수(path.join(꾸러미, '메모')); } catch {}
  칸('작업 방식', '메모', 메모파일 > 0 && 메모파일 >= 꾸러미메모, `프로젝트 ${메모폴더}곳 · 파일 ${메모파일}개(꾸러미 ${꾸러미메모}개)`);
  for (const [이름, 곳] of [['Claude 설정', '.claude/settings.json'], ['Claude 지침', '.claude/CLAUDE.md'], ['GPT 지침', '.codex/AGENTS.md'], ['창고 도구', 'Documents/SYNK_원본창고/창고.py'], ['복호화 도구', 'Documents/SYNK_원본창고/암호.js']]) {
    칸('작업 방식', 이름, fs.existsSync(path.join(집, 곳)));
  }
  칸('작업 방식', 'Claude 스킬', 파일수(path.join(집, '.claude', 'skills')) > 0, `${파일수(path.join(집, '.claude', 'skills'))}개`);
  const 보안 = 파일수(path.join(집, 'SYNK_보안'));
  칸('열쇠', 'SYNK_보안', 보안 > 0, `${보안}개`);
  칸('열쇠', 'SSH 키', fs.existsSync(path.join(집, '.ssh', 'id_ed25519')));
  칸('열쇠', '백업 비밀키(잠김)', fs.existsSync(path.join(집, '.synk-backup-key', '비밀키_잠금.json')));
  칸('열쇠', '77yuhbs 드라이브 자격', fs.existsSync(path.join(집, '.synk-drive-77yuhbs', '.clasprc.json')));
  칸('열쇠', 'unmet23 clasp 자격', fs.existsSync(path.join(집, '.clasprc.json')));
  칸('비공개 문서', 'SYNK-보관함', 파일수(path.join(문서, 'SYNK-보관함')) > 0, `${파일수(path.join(문서, 'SYNK-보관함'))}개`);
  칸('비공개 문서', '창고 장부', fs.existsSync(path.join(문서, 'SYNK_원본창고', '상태')));
  const 대화 = 파일수(프로젝트, (n) => n.endsWith('.jsonl'));
  칸('대화 기록', '.jsonl', 대화 > 0 ? true : null, 대화 ? `${대화}개` : '아직 안 받음(restore.ps1 -대화기록)');
  if (!시험) {
    칸('연결', 'GitHub SSH', /successfully authenticated/.test(돌림('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-T', 'git@github.com']).글));
    칸('연결', '구글 드라이브 G:', fs.existsSync('G:\\내 드라이브'));
    const 예약 = 돌림('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-ScheduledTask | Where-Object { $_.TaskName -match "SYNK" }).Count']);
    칸('연결', '예약 작업', Number(예약.글) > 0, `${예약.글}개`);
    칸('연결', '운영 사본', fs.existsSync(path.join(집, 'AppData', 'Local', 'synk', 'ops', 'SYNK-appsscript')));
    for (const 곳 of ['Claude 앱(계정 일곱은 필요할 때)', 'Codex 앱 · codex login', 'agy(아르곤)', 'ego 브라우저 · Aside 사이트들', '크롬 프로필 「유호」', '한컴 · Microsoft 365 · CapCut']) 칸('다시 로그인(유호님)', 곳, null, '옮길 수 없음');
  }
  return 줄;
}

/** 꾸러미 파일이 제자리와 다르면 보관 폴더에 복사한다. 제자리에 없는 파일은 복원이 이미 넣었다. 다른 수를 준다. */
function 차이모으기(값) {
  const { 집, 꾸러미, 차이보관 } = 값;
  const 짝 = [['claude', '.claude'], ['codex', '.codex']];
  for (const r of ['SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-tips', 'claude-session-share']) 짝.push([path.join('문서', r), path.join('Documents', r)]);
  짝.push([path.join('문서', 'SYNK-appsscript-설정'), path.join('Documents', 'SYNK-appsscript')]);
  const 해시 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  let 수 = 0;
  for (const [안, 밖] of 짝) {
    const 뿌리 = path.join(꾸러미, 안), 제자리 = path.join(집, 밖);
    if (!fs.existsSync(뿌리) || !fs.existsSync(제자리)) continue;
    const 더미 = [''];
    while (더미.length) {
      const 상대 = 더미.pop();
      let 줄;
      try { 줄 = fs.readdirSync(path.join(뿌리, 상대), { withFileTypes: true }); } catch { continue; }
      for (const e of 줄) {
        const rel = path.join(상대, e.name);
        if (e.isDirectory()) { 더미.push(rel); continue; }
        const 원 = path.join(제자리, rel), 꾸 = path.join(뿌리, rel);
        try {
          const a = fs.statSync(원), b = fs.statSync(꾸);
          if (a.size === b.size && 해시(원) === 해시(꾸)) continue;
        } catch { continue; }
        const 곳 = path.join(차이보관, 안, rel);
        fs.mkdirSync(path.dirname(곳), { recursive: true });
        fs.copyFileSync(꾸, 곳);
        수++;
      }
    }
  }
  return 수;
}

function 표(줄) {
  const 나 = [];
  let 앞 = '';
  for (const r of 줄) {
    if (r.묶음 !== 앞) { 나.push(`\n[${r.묶음}]`); 앞 = r.묶음; }
    const 표시 = r.상태 === '됨' ? 'O' : r.상태 === '안 됨' ? 'X' : '-';
    나.push(`  ${표시} ${r.항목}${r.내용 ? `  ${r.내용}` : ''}`);
  }
  const 안됨 = 줄.filter((r) => r.상태 === '안 됨');
  나.push('', 안됨.length ? `안 된 곳 ${안됨.length}개: ${안됨.map((r) => r.항목).join(' · ')}` : '빠진 곳 없음');
  return 나.join('\n');
}

if (require.main === module) {
  const 값 = 인자(process.argv.slice(2));
  const 줄 = 점검(값);
  if (값.차이보관) {
    const 수 = 차이모으기(값);
    줄.push({ 묶음: '살펴볼 것', 항목: '꾸러미와 다른 글 · 설정', 상태: 수 ? '참고' : '됨', 내용: 수 ? `${수}개를 ${값.차이보관}에 모아 둠 — 안 올린 고침일 수 있으니 Claude에게 합쳐 달라고 하세요` : '없음' });
  }
  console.log(값.json ? JSON.stringify(줄, null, 1) : 표(줄));
}

module.exports = { 점검, 표, 차이모으기 };
