'use strict';
// node --test tests/작업방식.test.cjs — 평문으로 나가는 작업 방식 꾸러미가 비밀을 흘리지 않고, 한 방향으로 맞추고, 위험한 때 멈추는지 본다. 진짜 GitHub는 건드리지 않는다(가짜 맨 저장소).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const 도구 = require('../tools/복원/작업방식.cjs');
const 정책 = require('../tools/이어하기꾸러미.js');

function 판() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '작업방식시험-'));
  const 집 = path.join(뿌리, 'home');
  const 문서 = path.join(집, 'Documents');
  fs.mkdirSync(문서, { recursive: true });
  const 원격 = path.join(뿌리, 'remote.git');
  execFileSync('git', ['init', '--quiet', '--bare', '-b', 'master', 원격]);
  const 자리 = { 집, 문서, 창고: path.join(문서, 'SYNK_원본창고'), 상태: path.join(문서, 'SYNK_원본창고', '상태', '복원꾸러미') };
  const 표 = [
    { 곳: '메모/p', 뿌리: path.join(집, 'memory'), 고름: () => true, 안봄: new Set(), 검사: '설정', 필수: true },
    { 곳: '문서/repo', 뿌리: path.join(문서, 'repo'), 고름: (r) => /\.md$/.test(r), 안봄: new Set(['node_modules', '.tmp']), 검사: 'md' },
  ];
  const 쓰기 = (rel, 글) => {
    const f = path.join(집, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, 글);
    return f;
  };
  쓰기('memory/메모.md', '# 메모\n유호님 취향\n');
  const 의존 = (더 = {}) => ({ 자리, 표, 도구: 정책, 거울: path.join(뿌리, 'mirror'), 원격, 받기: false, 윈도우기록: () => new Map([['윈도우/winget.json', '{}']]), 드라이브끔: true, 코드뿌리: path.join(뿌리, '없음'), ...더 });
  const 맨파일 = (경로) => execFileSync('git', ['--git-dir', 원격, 'show', `master:${경로}`], { encoding: 'utf8' });
  const 맨목록 = () => execFileSync('git', ['-c', 'core.quotepath=false', '--git-dir', 원격, 'ls-tree', '-r', '--name-only', 'master'], { encoding: 'utf8' }).trim().split('\n');
  return { 뿌리, 집, 문서, 원격, 자리, 표, 쓰기, 의존, 맨파일, 맨목록, 끝: () => fs.rmSync(뿌리, { recursive: true, force: true }) };
}

test('평문 파일은 원격에 가고 비밀 서명 · 실제 열쇠 값이 든 글은 빠져 제외 목록에는 경로만 남는다', () => {
  const t = 판();
  try {
    t.쓰기('Documents/repo/정상.md', '평범한 작업 메모\n');
    t.쓰기('Documents/repo/서명.md', '토큰 ghp_abcdefghijklmnopqrstuvwxyz0123\n');
    const 진짜값 = 'Zx9fQ2kLm81TtYvB3nPw7RsHd5Ga0Ue';
    t.쓰기('SYNK_보안/어떤키.txt', `${진짜값}\n`);
    t.쓰기('Documents/repo/열쇠값.md', `규칙이 모르는 값: ${진짜값}\n`);
    t.쓰기('Documents/repo/구글.md', '새 토큰 ya29.a0AfB_abcdefghijklmnopqrstuvwxyz\n');
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.status, 'success', JSON.stringify(값));
    const 목록 = t.맨목록().join('\n');
    assert.match(t.맨파일('문서/repo/정상.md'), /평범한/);
    assert.ok(!목록.includes('서명.md'));
    assert.ok(!목록.includes('열쇠값.md'));
    assert.ok(!목록.includes('구글.md'));
    const 제외 = JSON.parse(fs.readFileSync(path.join(t.자리.상태, '작업방식_제외.json'), 'utf8'));
    assert.equal(제외.파일.filter((r) => r.갈곳 === '열쇠').length, 3);
    assert.ok(제외.파일.some((r) => r.까닭 === 'known-secret-value'));
    assert.ok(!JSON.stringify(제외).includes(진짜값), '제외 목록에 값이 없어야 한다');
    const 영수증 = JSON.parse(fs.readFileSync(path.join(t.자리.상태, '작업방식.json'), 'utf8'));
    assert.ok(!JSON.stringify(영수증).includes(진짜값));
    // 원격 이력 전체에도 없다
    const 전부 = execFileSync('git', ['--git-dir', t.원격, 'log', '--all', '-p', '--format=%H'], { encoding: 'utf8', maxBuffer: 16 << 20 });
    assert.ok(!전부.includes(진짜값));
  } finally { t.끝(); }
});

test('예약 작업 XML · 설치 목록도 같은 검사를 받아, 걸리면 평문에 안 나가고 보호 폴더로 간다', () => {
  const t = 판();
  try {
    const 값 = 도구.돌리기({}, t.의존({ 윈도우기록: () => new Map([
      ['윈도우/예약작업/정상.xml', '<Task><Command>node.exe</Command></Task>'],
      ['윈도우/예약작업/토큰.xml', '<Task><Arguments>--token ghp_abcdefghijklmnopqrstuvwxyz0123</Arguments></Task>'],
    ]) }));
    assert.equal(값.status, 'success');
    const 목록 = t.맨목록().join('\n');
    assert.ok(목록.includes('정상.xml'));
    assert.ok(!목록.includes('토큰.xml'));
    assert.ok(fs.existsSync(path.join(t.자리.상태, '보호', '윈도우', '예약작업', '토큰.xml')));
    const 제외 = JSON.parse(fs.readFileSync(path.join(t.자리.상태, '작업방식_제외.json'), 'utf8'));
    assert.ok(제외.파일.some((r) => r.경로.endsWith('토큰.xml') && r.갈곳 === '열쇠'));
    const 전부 = execFileSync('git', ['--git-dir', t.원격, 'log', '--all', '-p', '--format=%H'], { encoding: 'utf8', maxBuffer: 16 << 20 });
    assert.ok(!전부.includes('ghp_abcdefghijklmnopqrstuvwxyz0123'));
  } finally { t.끝(); }
});

test('검사와 복사 사이에 파일에 비밀이 들어가도 검사한 뒤의 바이트만 나간다', () => {
  const t = 판();
  try {
    const 거울 = path.join(t.뿌리, 'm2');
    fs.mkdirSync(거울);
    const 소스 = t.쓰기('Documents/repo/늦은비밀.md', '처음에는 멀쩡\n');
    const st = fs.statSync(소스);
    // 고르기 뒤에 다른 세션이 비밀을 넣었다
    fs.writeFileSync(소스, '이제 토큰 ghp_abcdefghijklmnopqrstuvwxyz0123\n');
    const 줄 = { 곳: '문서/repo', 검사: 'md' };
    const 내보냄 = new Map([['문서/repo/늦은비밀.md', { rel: '늦은비밀.md', 절대: 소스, 크기: st.size, 수정: st.mtimeMs, 줄 }]]);
    const r = 도구.맞추기(거울, 내보냄, new Map(), (파일, 데이터) => 도구.판정(파일.줄, 파일, 정책, new Set(), 데이터));
    assert.equal(r.복사, 0);
    assert.equal(r.걸림.length, 1);
    assert.equal(r.걸림[0].갈곳, '열쇠');
    assert.ok(!fs.existsSync(path.join(거울, '문서', 'repo', '늦은비밀.md')));
  } finally { t.끝(); }
});

test('push가 거절되면 드라이브 · 열쇠를 부르지 않고 표식을 세우고, 다시 올라가면 표식을 지운다', () => {
  const t = 판();
  try {
    const 부름 = [];
    let 거절 = true;
    const 돌림 = (cmd, args) => {
      if (args.includes('push')) return 거절 ? { status: 1, stderr: '! [rejected] master -> master (non-fast-forward)' } : { status: 0, stderr: '' };
      부름.push(args.join(' '));
      return { status: 0 };
    };
    const 표식 = path.join(t.자리.상태, '다른PC가앞섬');
    const 값 = 도구.돌리기({}, t.의존({ 드라이브끔: false, 돌림 }));
    assert.equal(값.issues[0].code, 'WORKMETHOD_PUSH_REJECTED');
    assert.deepEqual(부름, []);
    assert.ok(fs.existsSync(표식));
    거절 = false;
    const 다음 = 도구.돌리기({}, t.의존({ 드라이브끔: false, 돌림 }));
    assert.equal(다음.status, 'success');
    assert.ok(!fs.existsSync(표식));
    assert.equal(부름.length, 2);
    assert.ok(부름[0].includes('작업방식'));
    assert.ok(부름[1].includes('열쇠'));
  } finally { t.끝(); }
});

test('그림 · svg 안의 토큰도 평문에 안 나간다', () => {
  const t = 판();
  try {
    const 토큰 = 'ghp_abcdefghijklmnopqrstuvwxyz0123';
    t.쓰기('memory/아이콘.svg', `<svg><metadata>${토큰}</metadata></svg>`);
    t.쓰기('memory/멀쩡.svg', '<svg><circle r="1"/></svg>');
    fs.writeFileSync(path.join(t.집, 'memory', '그림.png'), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(` tEXt ${토큰} `)]));
    fs.writeFileSync(path.join(t.집, 'memory', '멀쩡.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]));
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    const 목록 = t.맨목록().join('\n');
    assert.ok(!목록.includes('아이콘.svg'));
    assert.ok(!목록.includes('그림.png'));
    assert.ok(목록.includes('멀쩡.svg'));
    assert.ok(목록.includes('멀쩡.png'));
    const 전부 = execFileSync('git', ['--git-dir', t.원격, 'log', '--all', '-p', '--binary', '--format=%H'], { encoding: 'latin1', maxBuffer: 16 << 20 });
    assert.ok(!전부.includes(토큰));
  } finally { t.끝(); }
});

test('복원 입구 파일도 검사를 받아, 걸리면 평문에 안 나가고 알린다', () => {
  const t = 판();
  try {
    const 코드뿌리 = path.join(t.뿌리, '입구');
    fs.mkdirSync(코드뿌리);
    fs.writeFileSync(path.join(코드뿌리, 'restore.ps1'), '# 복원\n');
    fs.writeFileSync(path.join(코드뿌리, '복원풀기.cjs'), '// 시험 토큰 ghp_abcdefghijklmnopqrstuvwxyz0123\n');
    const 값 = 도구.돌리기({}, t.의존({ 코드뿌리 }));
    assert.equal(값.status, 'partial_failure');
    assert.ok(값.issues.some((i) => i.code === 'WORKMETHOD_RESTORE_TOOL_BLOCKED'));
    const 목록 = t.맨목록().join('\n');
    assert.ok(목록.includes('복원/restore.ps1'));
    assert.ok(!목록.includes('복원풀기.cjs'));
  } finally { t.끝(); }
});

test('못 읽은 파일은 거울의 옛 판을 지우지 않고, 폴더를 못 걸은 회차는 아무것도 지우지 않는다', () => {
  const t = 판();
  try {
    const 거울 = path.join(t.뿌리, 'm3');
    fs.mkdirSync(path.join(거울, '문서'), { recursive: true });
    fs.writeFileSync(path.join(거울, '문서', '옛판.md'), '옛 판');
    fs.writeFileSync(path.join(거울, '문서', '고른것아님.md'), '남아야 함');
    const 내보냄 = new Map([['문서/옛판.md', { rel: '옛판.md', 절대: path.join(t.뿌리, '사라진파일.md'), 크기: 99, 수정: 1, 줄: {} }]]);
    const r = 도구.맞추기(거울, 내보냄, new Map(), () => null, false);
    assert.equal(r.읽기실패, 1);
    assert.equal(r.지움, 0);
    assert.equal(fs.readFileSync(path.join(거울, '문서', '옛판.md'), 'utf8'), '옛 판');
    assert.ok(fs.existsSync(path.join(거울, '문서', '고른것아님.md')));
    const r2 = 도구.맞추기(거울, 내보냄, new Map(), () => null, true);
    assert.equal(r2.읽기실패, 1);
    assert.equal(r2.지움, 1);
    assert.ok(fs.existsSync(path.join(거울, '문서', '옛판.md')));
    assert.ok(!fs.existsSync(path.join(거울, '문서', '고른것아님.md')));
  } finally { t.끝(); }
});

test('처음 받은 거울 · 캐시가 없어도 크게 줄어드는 커밋은 막는다', () => {
  const t = 판();
  try {
    const 파일들 = [];
    for (let i = 0; i < 20; i++) 파일들.push(t.쓰기(`Documents/repo/글${i}.md`, `글 ${i}\n`));
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    const 앞 = execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim();
    // 새 노트북: 원격에서 거울을 새로 받고 캐시도 없고, 원본은 일부만 돌아와 있다
    for (const f of 파일들.slice(0, 15)) fs.rmSync(f);
    fs.rmSync(path.join(t.자리.상태, '작업방식_캐시.json'), { force: true });
    const 새거울 = path.join(t.뿌리, 'new-mirror');
    const 값 = 도구.돌리기({}, t.의존({ 거울: 새거울, 받기: true }));
    assert.equal(값.status, 'failed');
    assert.equal(값.issues[0].code, 'WORKMETHOD_SHRINK_GUARD');
    assert.equal(execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim(), 앞);
  } finally { t.끝(); }
});

test('메모 묶음만 크게 줄어도 전체가 커서 넘어가지 않고 막힌다, --줄어듦허용이면 지나간다', () => {
  const t = 판();
  try {
    const 메모들 = [];
    for (let i = 0; i < 12; i++) 메모들.push(t.쓰기(`memory/메모${i}.md`, `메모 ${i}\n`));
    for (let i = 0; i < 100; i++) t.쓰기(`Documents/repo/글${i}.md`, `글 ${i}\n`);
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    for (const f of 메모들.slice(0, 10)) fs.rmSync(f);
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.status, 'failed');
    assert.ok(값.걸린묶음.some((s) => s.startsWith('메모/p')));
    assert.ok(t.맨목록().join('\n').includes('메모0.md'));
    const 허용 = 도구.돌리기({ 줄어듦허용: true }, t.의존());
    assert.equal(허용.status, 'success');
    assert.ok(!t.맨목록().join('\n').includes('메모0.md'));
  } finally { t.끝(); }
});

test('줄어듦으로 막힌 뒤 원본이 돌아오면 다음 회차가 정상으로 돌아간다', () => {
  const t = 판();
  try {
    const 파일들 = [];
    for (let i = 0; i < 10; i++) 파일들.push(t.쓰기(`Documents/repo/글${i}.md`, `글 ${i}\n`));
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    const 내용 = 파일들.map((f) => fs.readFileSync(f));
    파일들.slice(0, 6).forEach((f) => fs.rmSync(f));
    assert.equal(도구.돌리기({}, t.의존()).status, 'failed');
    파일들.slice(0, 6).forEach((f, i) => fs.writeFileSync(f, 내용[i]));
    const 다음 = 도구.돌리기({}, t.의존());
    assert.equal(다음.status, 'success');
    assert.equal(다음.커밋, false);
  } finally { t.끝(); }
});

test('지운 파일은 다음 판에서 지워지고 이력에는 남는다, 바뀐 것이 없으면 커밋하지 않는다', () => {
  const t = 판();
  try {
    const f = t.쓰기('Documents/repo/지울것.md', '곧 지움\n');
    t.쓰기('Documents/repo/남을것.md', '남음\n');
    for (let i = 0; i < 8; i++) t.쓰기(`Documents/repo/더${i}.md`, `더 ${i}\n`);
    assert.equal(도구.돌리기({}, t.의존()).커밋, true);
    assert.equal(도구.돌리기({}, t.의존()).커밋, false);
    fs.rmSync(f);
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.커밋, true);
    const 목록 = t.맨목록().join('\n');
    assert.ok(!목록.includes('지울것.md'));
    assert.ok(목록.includes('남을것.md'));
    const 이력 = execFileSync('git', ['--git-dir', t.원격, 'log', '--all', '--name-only', '--format='], { encoding: 'utf8' });
    assert.ok(이력.includes('.md'));
  } finally { t.끝(); }
});

test('줄어듦 멈춤: 파일이 20% 넘게 줄면 커밋하지 않고 실패를 남긴다', () => {
  const t = 판();
  try {
    const 파일들 = [];
    for (let i = 0; i < 10; i++) 파일들.push(t.쓰기(`Documents/repo/글${i}.md`, `글 ${i}\n`));
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    const 앞 = execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim();
    for (const f of 파일들.slice(0, 5)) fs.rmSync(f);
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.status, 'failed');
    assert.equal(값.issues[0].code, 'WORKMETHOD_SHRINK_GUARD');
    assert.equal(execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim(), 앞);
  } finally { t.끝(); }
});

test('필수 뿌리가 비면 아무것도 지우지 않고 멈춘다', () => {
  const t = 판();
  try {
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    fs.rmSync(path.join(t.집, 'memory'), { recursive: true });
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.status, 'failed');
    assert.equal(값.issues[0].code, 'WORKMETHOD_REQUIRED_ROOT_EMPTY');
    assert.ok(t.맨목록().join('\n').includes('메모.md'));
  } finally { t.끝(); }
});

test('거절된 push는 실패로 남고 강제로 덮지 않는다(되살아난 옛 노트북이 새 쪽을 못 덮는다)', () => {
  const t = 판();
  try {
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    // 다른 곳(새 노트북)이 먼저 올렸다
    const 다른 = path.join(t.뿌리, 'other');
    execFileSync('git', ['clone', '--quiet', t.원격, 다른]);
    fs.writeFileSync(path.join(다른, '새쪽.md'), '새 노트북\n');
    execFileSync('git', ['-C', 다른, 'add', '-A']);
    execFileSync('git', ['-C', 다른, '-c', 'user.name=t', '-c', 'user.email=t@e.st', 'commit', '-qm', 'new']);
    execFileSync('git', ['-C', 다른, 'push', '-q', 'origin', 'master']);
    const 앞 = execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim();
    t.쓰기('Documents/repo/옛쪽.md', '옛 노트북\n');
    const 값 = 도구.돌리기({}, t.의존());
    assert.equal(값.status, 'partial_failure');
    assert.equal(값.issues[0].code, 'WORKMETHOD_PUSH_REJECTED');
    assert.equal(execFileSync('git', ['--git-dir', t.원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim(), 앞);
  } finally { t.끝(); }
});

test('junction · 심볼릭 링크 · .tmp · node_modules는 따라가지 않는다', () => {
  const t = 판();
  try {
    t.쓰기('Documents/repo/정상.md', '정상\n');
    t.쓰기('Documents/repo/.tmp/임시.md', '임시\n');
    t.쓰기('Documents/repo/node_modules/x/README.md', 'x\n');
    const 바깥 = path.join(t.뿌리, '바깥');
    fs.mkdirSync(바깥);
    fs.writeFileSync(path.join(바깥, '바깥글.md'), '바깥\n');
    // CI(Linux)에서도 돌도록 — 조건부로 건너뛰면 「등록되지 않은 조건부 제외」로 wide 시험이 빨개진다(11-09)
    if (process.platform === 'win32') spawnSync('cmd', ['/c', 'mklink', '/J', path.join(t.문서, 'repo', '연결'), 바깥]);
    else fs.symlinkSync(바깥, path.join(t.문서, 'repo', '연결'));
    assert.equal(도구.돌리기({}, t.의존()).status, 'success');
    const 목록 = t.맨목록().join('\n');
    assert.ok(목록.includes('정상.md'));
    assert.ok(!목록.includes('임시.md'));
    assert.ok(!목록.includes('README.md'));
    assert.ok(!목록.includes('바깥글.md'));
  } finally { t.끝(); }
});

test('열쇠 토큰 판단: 공개 값 · 경로는 빼고 섞인 값만 본다', () => {
  assert.equal(도구.열쇠토큰인가('Zx9fQ2kLm81TtYvB3nPw7RsHd5Ga0Ue'), true);
  assert.equal(도구.열쇠토큰인가('12345-abcdefg.apps.googleusercontent.com'), false);
  assert.equal(도구.열쇠토큰인가('C/Users/q1212/Documents/SYNK/abc123'), false);
  assert.equal(도구.열쇠토큰인가('abcdefghijklmnopqrstuvwxyzabcdef'), false);
});

test('더한 서명이 구글 · 허깅페이스 · 슈파베이스 · 클로드 키를 잡는다', () => {
  for (const 값 of ['ya29.a0AfB_abcdefghijklmnopqrstuvwxyz', '1//0gabcdefghijklmnopqrstuvwxyz012345', 'GOCSPX-abcdefghijklmnopqrstuvw', 'hf_abcdefghijklmnopqrstuvwxyzabcdef',
    'sbp_0123456789abcdef0123456789abcdef', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', '-----BEGIN OPENSSH PRIVATE KEY-----']) {
    assert.match(값, 도구.더한서명, 값);
  }
  assert.doesNotMatch('평범한 글 sk-ant 라는 낱말과 ya29 이야기', 도구.더한서명);
});

test('본 저장소 메모는 폴더가 없어도 필수 줄에 남는다', () => {
  const 집 = path.join(os.tmpdir(), '없는집');
  const 자리 = 도구.집자리({ SYNK_복원_집: 집 });
  const 이름 = path.join(자리.문서, 'SYNK-appsscript').replace(/[^A-Za-z0-9]/g, '-');
  const 줄 = 도구.범위표(자리).find((r) => r.곳 === `메모/${이름}`);
  assert.ok(줄);
  assert.equal(줄.필수, true);
});

test('실제 범위표: 공개 저장소에서 온 파일 경로가 .tmp · worktrees를 지나지 않는다', () => {
  const 자리 = 도구.집자리({ SYNK_복원_집: path.join(os.tmpdir(), '없는집') });
  const 표 = 도구.범위표(자리);
  const 저장소 = 표.find((r) => r.곳 === '문서/SYNK-appsscript');
  for (const 이름 of ['.tmp', 'worktrees', 'node_modules', '.git', 'output']) assert.ok(저장소.안봄.has(이름), 이름);
  assert.ok(!표.find((r) => r.곳 === '문서/SYNK-보관함'), '보관함은 평문 층에 안 둔다');
  assert.ok(표.find((r) => r.곳 === 'claude').고름('skills/x/SKILL.md'));
  assert.ok(!표.find((r) => r.곳 === 'claude').고름('.credentials.json'));
  assert.ok(!표.find((r) => r.곳 === 'codex').고름('auth.json'));
  assert.ok(!표.find((r) => r.곳 === 'ai-accounts').고름('codex-synk.yuh/auth.json'));
});
