#!/usr/bin/env node
'use strict';
/**
 * PULSE 새 의뢰 텔레그램 알림 — 회사 주 노드에 깔고, 상태를 보고, 시험 한 줄을 보내고, 끈다(2026-11-14). 설명은 같은 폴더 README.md.
 *
 *   node tools/pulse-request-alert/install.cjs              미리 보기 — 깔 파일의 해시 · PC 장부 줄 수 · 헤르메스 열쇠가 있는지만 본다. 원격 0
 *   node tools/pulse-request-alert/install.cjs --상태        원격 읽기만 — 타이머 · 깔린 파일 해시 · 열쇠 파일 권한 · 마지막 회차 · 지금 알릴 번호
 *   node tools/pulse-request-alert/install.cjs --설치 --타이머끔   원격 쓰기 — 파일 · 단위 · 열쇠만 넣고 타이머는 끈 채로 둔다(장부는 열지 않는다).
 *                                                            처음 깔 때 이것 → --시험 → PC 작업의 옛 알림을 뺀 판이 운영 사본에 실린 뒤 --설치(검수 GA2)
 *   node tools/pulse-request-alert/install.cjs --설치        원격 쓰기 — 파일 · 단위를 넣고, 열쇠 파일은 없을 때만 쓰고, 서버 장부는 없을 때만
 *                                                            PC 장부(이미 알린 번호)로 열고, 알릴 번호를 미리 본 뒤 타이머를 켠다
 *   node tools/pulse-request-alert/install.cjs --시험        시험 한 줄을 서버에서 유호님 텔레그램으로 보낸다(의뢰 · 장부와 상관없음)
 *   node tools/pulse-request-alert/install.cjs --끄기        타이머만 끈다(파일 · 장부 · 열쇠는 남긴다). 다시 켜기는 --설치
 *   옵션: --열쇠바꿈(헤르메스 봇 열쇠가 바뀌었을 때 서버 열쇠 파일을 다시 쓴다) · --장부 <PC 장부 파일> · --타이머끔
 *
 * 열쇠(헤르메스 TELEGRAM_BOT_TOKEN)는 SSH 표준 입력으로만 넘기고 화면 · 인자 · 기록에 찍지 않는다. 서버에서는 root 전용 0600 파일이다.
 * 접속은 tools/lib/작업실읽기.cjs와 같은 고정 서버 신원(Compute 메타데이터 · 호스트 키 고정)이다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const 여기 = __dirname;
const PROJECT = 'synk-bake-unmet27';
const 대화방 = '6017495834'; // 유호님 텔레그램 — tools/크레딧실행.js의 텔레그램대상과 같다
const 헤르메스설정 = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'hermes', '.env');
const PC장부 = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', 'ops', 'SYNK-appsscript', 'output', '크레딧작업', 'PULSE의뢰확인', '알린의뢰.json');
const 번호꼴 = /^P-\d{4}-[0-9A-F]{4}$/;
const 열쇠꼴 = /^\d{5,20}:[A-Za-z0-9_-]{30,80}$/;
const 파일들 = [
  { 원격: '/opt/synk-pulse-request-alert/alert.py', 로컬: 'alert.py', mode: '644' },
  { 원격: '/etc/systemd/system/synk-pulse-request-alert.service', 로컬: 'synk-pulse-request-alert.service', mode: '644' },
  { 원격: '/etc/systemd/system/synk-pulse-request-alert.timer', 로컬: 'synk-pulse-request-alert.timer', mode: '644' },
];

function 깔파일() {
  return 파일들.map((f) => {
    const 바이트 = fs.readFileSync(path.join(여기, f.로컬));
    // 윈도우 체크아웃이 CRLF로 풀었으면 systemd · 파이썬이 서버에서 다르게 읽는다 — 올리지 않는다(.gitattributes가 LF로 받게 한다).
    if (바이트.includes(13)) throw new Error(`CRLF_IN_${f.로컬}`);
    return { path: f.원격, mode: f.mode, sha256: crypto.createHash('sha256').update(바이트).digest('hex'), b64: 바이트.toString('base64'), 로컬: f.로컬, 크기: 바이트.length };
  });
}

/** 헤르메스 .env에서 봇 열쇠와 허용 사용자만 꺼낸다. 값은 돌려줄 뿐 찍지 않는다. */
function 열쇠읽기(파일 = 헤르메스설정) {
  let 글;
  try { 글 = fs.readFileSync(파일, 'utf8'); } catch { throw new Error('HERMES_ENV_MISSING'); }
  const 값 = {};
  for (const 줄 of 글.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(줄);
    if (m) 값[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  const 열쇠 = 값.TELEGRAM_BOT_TOKEN || '';
  if (!열쇠꼴.test(열쇠)) throw new Error('HERMES_TOKEN_INVALID');
  const 허용 = String(값.TELEGRAM_ALLOWED_USERS || '').split(/[\s,]+/).filter(Boolean);
  if (!허용.includes(대화방)) throw new Error('CHAT_NOT_ALLOWED_IN_HERMES');
  return { 열쇠 };
}

function 설정글(열쇠, 방 = 대화방) {
  if (!열쇠꼴.test(열쇠) || !/^-?\d{5,20}$/.test(방)) throw new Error('CONFIG_INVALID');
  return `# SYNK PULSE 새 의뢰 알림 — tools/pulse-request-alert/install.cjs가 쓴다(헤르메스와 같은 봇)\nTELEGRAM_BOT_TOKEN=${열쇠}\nTELEGRAM_CHAT_ID=${방}\n`;
}

/** PC 장부 {"P-…": "시각"}에서 번호 꼴만 남긴다. 없거나 깨졌거나 번호가 하나도 없으면 null — 그때는 서버 장부를 PC 장부로 열지 않고
 *  「다시 열기」로 둔다(검수 A4 · b A1 — 빈 장부로 열면 옛 의뢰를 다시 보낼 수 있다). */
function 장부읽기(파일 = PC장부) {
  try {
    const 읽은 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    if (!읽은 || typeof 읽은 !== 'object' || Array.isArray(읽은)) return null;
    const 남길 = Object.fromEntries(Object.entries(읽은).filter(([번호, 때]) => 번호꼴.test(번호) && typeof 때 === 'string'));
    return Object.keys(남길).length ? 남길 : null;
  } catch { return null; }
}

const REMOTE = String.raw`import base64,hashlib,json,os,subprocess,tempfile,urllib.request
P=json.loads(base64.b64decode('__PAYLOAD__').decode('utf-8'))
OPT='/opt/synk-pulse-request-alert';ETC='/etc/synk-pulse-request-alert';CFG=ETC+'/telegram.env';VAR='/var/lib/synk-pulse-request-alert';UNIT='synk-pulse-request-alert'
def meta(p):
 try:return urllib.request.urlopen(urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+p,headers={'Metadata-Flavor':'Google'}),timeout=3).read(200).decode()
 except Exception:return None
def sh(a,stdin=None,t=120):
 try:
  r=subprocess.run(a,capture_output=True,text=True,timeout=t,input=stdin)
  return {'code':r.returncode,'out':r.stdout.strip()[-3000:],'err':r.stderr.strip()[-600:]}
 except Exception as e:return {'code':-1,'out':'','err':type(e).__name__}
def last_json(text):
 for line in reversed((text or '').splitlines()):
  try:return json.loads(line)
  except ValueError:pass
 return None
def sha(p):
 try:
  with open(p,'rb') as f:return hashlib.sha256(f.read()).hexdigest()
 except OSError:return None
def put(path,data,mode):
 fd,t=tempfile.mkstemp(prefix='.synk-',dir=os.path.dirname(path))
 try:
  with os.fdopen(fd,'wb') as f:
   f.write(data);f.flush();os.fsync(f.fileno())
  os.chown(t,0,0);os.chmod(t,mode);os.replace(t,path)
 except BaseException:
  try:os.unlink(t)
  except OSError:pass
  raise
def alert(*a,stdin=None):
 if not os.path.isfile(OPT+'/alert.py'):return None
 r=sh(['/usr/bin/python3','-I',OPT+'/alert.py',*a],stdin=stdin)
 return last_json(r['out']) or {'code':r['code'],'err':r['err'][-200:]}
def status():
 st=os.stat(CFG) if os.path.isfile(CFG) else None
 return {'timerEnabled':sh(['systemctl','is-enabled',UNIT+'.timer'])['out'],'timerActive':sh(['systemctl','is-active',UNIT+'.timer'])['out'],
  'service':sh(['systemctl','show',UNIT+'.service','-p','Result','-p','ExecMainStatus','-p','ActiveState'])['out'].splitlines(),
  'timer':sh(['systemctl','show',UNIT+'.timer','-p','LastTriggerUSec','-p','NextElapseUSecRealtime'])['out'].splitlines(),
  'files':{f['path']:sha(f['path'])==f['sha256'] for f in P['files']},
  'config':None if not st else {'mode':oct(st.st_mode&0o777),'uid':st.st_uid,'gid':st.st_gid},
  'statePresent':os.path.isfile(VAR+'/state.json'),'latest':alert('--status'),'dryRun':alert('--dry-run')}
out={'mode':P['mode'],'instanceId':meta('instance/id'),'project':meta('project/project-id')}
# 무엇이든 쓰거나 보내기 전에 이 서버가 그 노드인지 본다(검수 A5) — 메타데이터를 못 읽어도 멈춘다.
if out['instanceId']!=P['expect']['id'] or out['project']!=P['expect']['project']:raise SystemExit(json.dumps({'error':'REMOTE_IDENTITY'}))
if P['mode']=='install':
 for d,m in ((OPT,0o755),(ETC,0o700)):
  os.makedirs(d,exist_ok=True);os.chown(d,0,0);os.chmod(d,m)
 for f in P['files']:
  data=base64.b64decode(f['b64'])
  if hashlib.sha256(data).hexdigest()!=f['sha256']:raise SystemExit(json.dumps({'error':'PAYLOAD_HASH','path':f['path']}))
  put(f['path'],data,int(f['mode'],8))
 out['config']='kept'
 if not os.path.isfile(CFG) or P.get('replaceConfig'):
  if not P.get('config'):raise SystemExit(json.dumps({'error':'CONFIG_REQUIRED'}))
  put(CFG,base64.b64decode(P['config']),0o600);out['config']='written'
 out['daemonReload']=sh(['systemctl','daemon-reload'])['code']
 if P.get('holdTimer'):
  # 타이머를 끈 채로 둔다 — PC가 아직 「새 의뢰」를 보내는 동안 두 곳에서 알리지 않게(검수 GA2). 장부도 이때 열지 않는다.
  out['disable']=sh(['systemctl','disable','--now',UNIT+'.timer']);out['seed']='held';out['status']=status()
  print(json.dumps(out,ensure_ascii=False));raise SystemExit(0)
 out['seed']='kept' if os.path.isfile(VAR+'/state.json') else ('none' if P.get('seed') is None else alert('--seed','-',stdin=json.dumps(P['seed'])))
 # 장부 열기가 실패했으면 타이머를 켜지 않는다(검수 b A2) — 다시 부르면 그대로 잇는다.
 if out['seed'] not in ('kept','none') and (out['seed'] or {}).get('event')!='SYNK_PULSE_ALERT_SEEDED':raise SystemExit(json.dumps({'error':'SEED_FAILED','seed':out['seed']}))
 out['before']=alert('--dry-run')
 out['enable']=sh(['systemctl','enable','--now',UNIT+'.timer'])
 out['status']=status()
elif P['mode']=='test':
 out['test']=alert('--test')
elif P['mode']=='off':
 out['disable']=sh(['systemctl','disable','--now',UNIT+'.timer'])
 out['status']=status()
else:
 out['status']=status()
print(json.dumps(out,ensure_ascii=False))
`;

/** 원격 파이썬 원문 — 짐(파일 · 열쇠 · 장부)은 base64 JSON 한 덩어리로 넣는다. */
function 원격원문(짐) {
  const 넣을 = Buffer.from(JSON.stringify(짐), 'utf8').toString('base64');
  if (!/^[A-Za-z0-9+/=]+$/.test(넣을)) throw new Error('PAYLOAD_ENCODING');
  return REMOTE.replace('__PAYLOAD__', 넣을);
}

function 짐만들기(방식, { 열쇠바꿈 = false, 장부파일, 열쇠파일 = 헤르메스설정, 타이머끔 = false } = {}) {
  const files = 깔파일().map(({ path: p, mode, sha256, b64 }) => ({ path: p, mode, sha256, b64 }));
  const 짐 = { mode: 방식, files };
  if (방식 === 'install') {
    짐.config = Buffer.from(설정글(열쇠읽기(열쇠파일).열쇠), 'utf8').toString('base64');
    짐.replaceConfig = 열쇠바꿈 === true;
    if (타이머끔) { 짐.holdTimer = true; 짐.seed = null; return 짐; }
    짐.seed = 장부읽기(장부파일 || PC장부);
    // 손으로 준 장부를 못 읽으면 멈춘다(오타로 빈 장부를 열어 옛 의뢰를 다시 보내지 않게, 검수 A4). 기본 자리가 없으면 「다시 열기」로 둔다.
    if (장부파일 && 짐.seed === null) throw new Error('LEDGER_UNREADABLE');
  }
  return 짐;
}

async function 노드주소() {
  const { NODES } = require('../server-backup/read-status.cjs');
  const policy = require('../모델정책.js');
  const node = NODES.find((row) => row.role === 'company');
  if (!node || policy.벌텍스프로젝트() !== PROJECT) throw new Error('WORKSPACE_IDENTITY');
  const response = await fetch(`https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${node.zone}/instances/${node.name}`, {
    headers: { authorization: 'Bearer ' + await policy.벌텍스토큰() }, redirect: 'error', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('WORKSPACE_METADATA');
  const instance = await response.json();
  const nic = instance.networkInterfaces?.find((row) => row.name === 'nic0');
  const address = nic?.accessConfigs?.[0]?.natIP;
  if (instance.id !== node.id || instance.name !== node.name || instance.status !== 'RUNNING' || nic?.networkIP !== node.privateIp
    || nic.accessConfigs?.length !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address || '')) throw new Error('WORKSPACE_IDENTITY');
  return { node, address };
}

async function 원격실행(짐, { 시간제한ms = 180_000 } = {}) {
  const { node, address } = await 노드주소();
  짐 = { ...짐, expect: { id: node.id, project: PROJECT } };
  const known = path.join(os.tmpdir(), 'synk-pulse-alert-' + crypto.randomUUID());
  fs.writeFileSync(known, node.alias + ' ' + node.hostKey + '\n', { flag: 'wx', mode: 0o600 });
  try {
    const { code, stdout, stderr } = await new Promise((resolve) => {
      const child = execFile('ssh', ['-i', path.join(os.homedir(), '.ssh', node.key), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + known.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + node.alias, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=10',
        'synk@' + address, 'sudo -n python3 -'], { shell: false, windowsHide: true, timeout: 시간제한ms, maxBuffer: 4_000_000, encoding: 'utf8' },
      (error, out, err) => resolve({ code: error ? (error.code ?? 1) : 0, stdout: out || '', stderr: err || '' }));
      child.stdin.end(원격원문(짐));
    });
    const 줄 = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || '';
    let 결과 = null;
    try { 결과 = JSON.parse(줄); } catch { /* 아래에서 */ }
    if (!결과 || code !== 0) throw new Error(`REMOTE_FAILED(${code}) ${가리기(stderr).slice(-400)}`);
    if (결과.instanceId !== node.id || 결과.project !== PROJECT) throw new Error('REMOTE_IDENTITY');
    return 결과;
  } finally { try { fs.unlinkSync(known); } catch { /* 이미 없음 */ } }
}

/** 오류 글에 열쇠 꼴이 섞여도 찍지 않는다. */
function 가리기(글) {
  return String(글 || '').replace(/\d{5,20}:[A-Za-z0-9_-]{30,80}/g, '<열쇠>');
}

function 미리보기({ 장부파일 = PC장부, 열쇠파일 = 헤르메스설정 } = {}) {
  let 열쇠 = '있음';
  try { 열쇠읽기(열쇠파일); } catch (오류) { 열쇠 = `못 씀(${오류.message})`; }
  const 장부 = 장부읽기(장부파일);
  return {
    파일: 깔파일().map((f) => ({ 원격: f.path, 로컬: f.로컬, sha256: f.sha256, 크기: f.크기 })),
    PC장부: { 파일: 장부파일, 번호: 장부 ? Object.keys(장부).length : '못 읽음 — 서버 장부는 「다시 열기」로 연다' },
    헤르메스열쇠: 열쇠,
    대화방,
    다음: 'node tools/pulse-request-alert/install.cjs --설치 (원격 쓰기) → --시험 → --상태',
  };
}

const 방식들 = { '--설치': 'install', '--시험': 'test', '--끄기': 'off', '--상태': 'status' };

/** 인자를 엄격하게 읽는다 — 모르는 옵션 · 방식 둘 · 값 없는 --장부는 멈춘다(검수 A6). → { 방식, 옵션 } */
function 인자읽기(argv) {
  const 옵션 = {};
  const 고른 = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (Object.hasOwn(방식들, a)) 고른.push(방식들[a]); // constructor · toString 같은 이름이 방식으로 읽히지 않게(검수 b A5)
    else if (a === '--열쇠바꿈') 옵션.열쇠바꿈 = true;
    else if (a === '--타이머끔') 옵션.타이머끔 = true;
    else if (a === '--장부' && argv[i + 1] && !argv[i + 1].startsWith('--')) 옵션.장부파일 = path.resolve(argv[++i]);
    else throw new Error(`USAGE: 모르는 인자 ${a} — 쓰는 법은 이 파일 머리말`);
  }
  if (고른.length > 1) throw new Error('USAGE: 방식은 하나만(--설치 · --시험 · --끄기 · --상태)');
  if ((옵션.열쇠바꿈 || 옵션.장부파일 || 옵션.타이머끔) && 고른[0] !== 'install') throw new Error('USAGE: --열쇠바꿈 · --장부 · --타이머끔은 --설치와만 쓴다');
  if (옵션.타이머끔 && 옵션.장부파일) throw new Error('USAGE: --타이머끔은 장부를 열지 않는다 — --장부는 타이머를 켤 때 준다');
  return { 방식: 고른[0] || null, 옵션 };
}

/** 원격 결과가 그 방식대로 끝났나(검수 A6 — 기존 타이머가 살아 있다는 것만으로 설치 · 끄기를 성공으로 보지 않는다). */
function 판정(방식, 결과, 옵션 = {}) {
  const 상태 = 결과.status || {};
  const 파일됨 = Object.keys(상태.files || {}).length === 파일들.length && Object.values(상태.files).every(Boolean);
  if (방식 === 'install' && 옵션.타이머끔) {
    return 결과.daemonReload === 0 && 결과.seed === 'held' && 결과.disable?.code === 0 && 상태.timerActive !== 'active' && 상태.timerEnabled !== 'enabled'
      && 파일됨 && 상태.config?.mode === '0o600' && 상태.config?.uid === 0;
  }
  if (방식 === 'install') {
    return 결과.daemonReload === 0 && 결과.enable?.code === 0 && 상태.timerEnabled === 'enabled' && 상태.timerActive === 'active'
      && Object.keys(상태.files || {}).length === 파일들.length && Object.values(상태.files).every(Boolean)
      && 상태.config?.mode === '0o600' && 상태.config?.uid === 0 && (상태.statePresent || 결과.seed === 'none')
      && (결과.seed === 'kept' || 결과.seed === 'none' || 결과.seed?.event === 'SYNK_PULSE_ALERT_SEEDED');
  }
  if (방식 === 'off') return 결과.disable?.code === 0 && 상태.timerActive !== 'active';
  if (방식 === 'test') return 결과.test?.ok === true;
  return true;
}

async function main(argv) {
  const { 방식, 옵션 } = 인자읽기(argv);
  if (!방식) { console.log(JSON.stringify(미리보기(옵션), null, 2)); return 0; }
  const 결과 = await 원격실행(짐만들기(방식, 옵션));
  console.log(가리기(JSON.stringify(결과, null, 2)));
  const 됨 = 판정(방식, 결과, 옵션);
  if (방식 === 'install' && 옵션.타이머끔) console.log(됨 ? '\n깔았고 타이머는 꺼 두었다 — 다음: --시험 → PC 작업의 옛 알림을 뺀 판이 운영 사본에 실린 뒤 --설치' : '\n확인이 다 맞지 않았다 — 위 결과를 본다.');
  else if (방식 === 'install') console.log(됨 ? '\n설치됨 — 타이머가 켜졌다. --상태로 첫 회차를 본다.' : '\n설치 확인이 다 맞지 않았다 — 위 결과를 본다.');
  if (방식 === 'off' && !됨) console.log('\n타이머가 꺼지지 않았다 — 위 결과를 본다.');
  return 됨 ? 0 : 1;
}

module.exports = { 열쇠읽기, 설정글, 장부읽기, 원격원문, 짐만들기, 가리기, 미리보기, 깔파일, 인자읽기, 판정, 대화방 };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (오류) => { console.error(가리기(오류.message)); process.exitCode = /^USAGE/.test(오류.message) ? 2 : 1; });
}
