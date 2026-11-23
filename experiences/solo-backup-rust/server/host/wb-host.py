#!/usr/bin/env python3
"""Root-side installer for the work-backup services on the company writer node.

Sent by tools/host-install.mjs through the pinned SSH path as `sudo python3 -`, after two
lines that set REQUEST (action, payload). Prints one JSON object. It never prints a secret
value, a bucket name or an address of a person. It never touches the company stack: it reads
the company, Caddy and spaceship container ids before and after `start` and fails if any
changed. Actions: plan, files, probe, secrets, start, status, stop.

The role folders under /srv/synk/workbackup belong to the role users. Inside them root works
only through directory descriptors opened with O_NOFOLLOW, so a role user cannot swap a name
for a link and make root change or write something outside its folder. Every action that
changes something holds one host lock, so two runs never interleave.
"""
import base64, hashlib, hmac, json, os, pathlib, re, shutil, signal, socket, stat, subprocess, tempfile, time, urllib.error, urllib.request

ROOT = pathlib.Path('/opt/synk/workbackup')
SRV = pathlib.Path('/srv/synk/workbackup')
HA_NODE = pathlib.Path('/opt/synk/ha-runtime/node')
UNIT_DIR = pathlib.Path('/etc/systemd/system')
ROLES = {'api': 10771, 'keys': 10772, 'files': 10773}
SERVICES = ('synk-wb-keys.service', 'synk-wb-files.service', 'synk-wb-api.service')
OFFSITE = ('synk-wb-offsite.service', 'synk-wb-offsite.timer')
UNIT_NAMES = (*SERVICES, *OFFSITE)
OFFSITE_STATE = pathlib.Path('/var/lib/synk-wb-offsite')
COMPANY_ENV = pathlib.Path('/etc/synk/company.env')
LOCK = '/run/lock/synk-wb-host.lock'
LISTEN = {'synk-wb-api.service': '172.30.77.9:4210', 'synk-wb-keys.service': '127.0.0.1:4211', 'synk-wb-files.service': '127.0.0.1:4212'}
COMPANY = ('synk-company-company-1', 'synk-company-https-1', 'synk-spaceship-spaceship-1')
SUBDIRS = {'api': ('secrets', 'data', 'backups'), 'keys': ('secrets', 'state'), 'files': ('secrets', 'state')}
SECRET_NAMES = {'api': ('wb-keys-rpc', 'wb-files-rpc'), 'keys': ('wb-keys-b2', 'wb-keys-rpc'), 'files': ('wb-files-b2', 'wb-files-rpc')}
RPC_PAIRS = {'wb-keys-rpc': ('api', 'keys'), 'wb-files-rpc': ('api', 'files')}
RPC_URLS = {'wb-keys-rpc': 'http://127.0.0.1:4211/rpc', 'wb-files-rpc': 'http://127.0.0.1:4212/rpc'}
HEALTH = 'http://172.30.77.9:4210/backup-api/v1/health'
APP_NAME = re.compile(r'^[a-z0-9-]+\.mjs$')
# A box connect counts as blocked only with one of these answers. The unit's address filter
# drops the SYN, so a blocked TCP connect most likely times out; EPERM is taken too. Anything
# else, a refusal included, is a reach.
BLOCKED = ('EPERM', 'EACCES', 'timeout')
# [Service] properties systemd-run may not take, or that only make sense for the long-running unit.
# TimeoutStopSec and KillMode stay: a transient run is PartOf the company stack, and its stop must fit
# node-host.py's 150-second budget the same way the services do.
RUN_SKIP = {'Type', 'ExecStart', 'Restart', 'RestartSec', 'WorkingDirectory'}
# [Unit] lines a transient run keeps, so it stops with the company stack. PartOf becomes
# StopPropagatedFrom and Requisite is left out: both PartOf and Requisite (through RequisiteOf)
# would carry a company restart into the run and start a wb-admin command again. wb-admin's own
# shell check keeps it to the node that runs the company stack.
UNIT_RUN_KEYS = {'PartOf', 'After', 'RequiresMountsFor'}
MIN_SYSTEMD = 249  # StopPropagatedFrom
DIRECT = urllib.request.build_opener(urllib.request.ProxyHandler({}))
DIR_FLAGS = os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0) | getattr(os, 'O_NOFOLLOW', 0)  # Linux only; the getattr lets the render tests load elsewhere


class Refused(Exception):
    pass


def need(ok, code):
    if not ok:
        raise Refused(code)


def run(args, timeout=60, input=None, check=True):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=input)
    if check:
        need(p.returncode == 0, 'COMMAND_FAILED:' + os.path.basename(args[0]) + (':' + args[1] if len(args) > 1 else ''))
    return p


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def writer_node():
    need(os.path.ismount('/srv/synk'), 'DATA_DISK_NOT_MOUNTED')
    need(run(['systemctl', 'is-active', '--quiet', 'synk-company.service'], check=False).returncode == 0, 'NOT_THE_WRITER_NODE')


def root_dir(path, mode=0o755):
    """A root-owned directory that only root can change (only under root-owned parents)."""
    if not path.exists():
        path.mkdir(mode=mode)
        os.chmod(path, mode)
    s = path.lstat()
    need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'UNSAFE_DIRECTORY:' + str(path))


def write_root_file(path, data, mode):
    """Atomic write into a root-only directory."""
    fd, tmp = tempfile.mkstemp(prefix='.wb-', dir=str(path.parent))
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


# ── role folders, through directory descriptors only

def open_dir(parent_fd, name, uid, mode, create):
    """Open (and on request create) one directory below parent_fd without following links,
    give it its owner and mode through the descriptor, and check what was opened."""
    made = False
    if create:
        try:
            os.mkdir(name, mode=0o700, dir_fd=parent_fd)
            made = True
        except FileExistsError:
            pass
    try:
        fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
    except OSError:
        raise Refused('UNSAFE_DIRECTORY:' + name)
    if made:
        os.fchown(fd, uid, uid)
        os.fchmod(fd, mode)
    s = os.fstat(fd)
    if not (stat.S_ISDIR(s.st_mode) and s.st_uid == uid and s.st_gid == uid and stat.S_IMODE(s.st_mode) == mode):
        os.close(fd)
        raise Refused('UNSAFE_DIRECTORY:' + name)
    return fd, made


def srv_fd(create=False):
    """/srv/synk/workbackup: root 0711 on the mounted data disk (its parent is root-owned)."""
    top = os.open('/srv/synk', DIR_FLAGS)
    try:
        s = os.fstat(top)
        need(s.st_uid == 0 and not s.st_mode & 0o022, 'UNSAFE_DIRECTORY:/srv/synk')
        fd, made = open_dir(top, 'workbackup', 0, 0o711, create)
        return fd, made
    finally:
        os.close(top)


def role_fd(role, sub=None, create=False):
    """The role folder (or one of its sub-folders), opened through descriptors only."""
    made = []
    base, m = srv_fd(create)
    if m:
        made.append(str(SRV))
    try:
        fd, m = open_dir(base, role, ROLES[role], 0o700, create)
        if m:
            made.append(str(SRV / role))
    finally:
        os.close(base)
    if sub is None:
        return fd, made
    try:
        child, m = open_dir(fd, sub, ROLES[role], 0o700, create)
        if m:
            made.append(str(SRV / role / sub))
        return child, made
    finally:
        os.close(fd)


def folders():
    made = []
    for role in ROLES:
        fd, m = role_fd(role, create=True)
        os.close(fd)
        made += m
        for sub in SUBDIRS[role]:
            fd, m = role_fd(role, sub, create=True)
            os.close(fd)
            made += m
    return sorted(set(made))


def read_in(dfd, name):
    """A regular file directly in dfd (no link), or None. Returns (bytes, stat). Opened first
    (no-follow, non-blocking, so a FIFO cannot hold the run), then checked by its descriptor."""
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=dfd)
    except FileNotFoundError:
        return None, None
    except OSError:
        raise Refused('UNSAFE_FILE:' + name)
    with os.fdopen(fd, 'rb') as f:
        s = os.fstat(f.fileno())
        need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, 'UNSAFE_FILE:' + name)
        return f.read(), s


def stage_in(dfd, data, mode, uid):
    """A new file in dfd under a temporary name, owner and mode set through its descriptor, synced."""
    tmp = '.wb-' + os.urandom(8).hex()
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=dfd)
    try:
        os.fchown(fd, uid, uid)
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
    except BaseException:
        drop_in(dfd, tmp)
        raise
    return tmp


def drop_in(dfd, tmp):
    try:
        os.unlink(tmp, dir_fd=dfd)
    except FileNotFoundError:
        pass


def write_in(dfd, name, data, mode, uid):
    """Atomic write of one file directly in dfd."""
    tmp = stage_in(dfd, data, mode, uid)
    try:
        os.replace(tmp, name, src_dir_fd=dfd, dst_dir_fd=dfd)
    except BaseException:
        drop_in(dfd, tmp)
        raise


# ── payload, units and the box

def payload_files(req, key):
    return {name: base64.b64decode(b64, validate=True) for name, b64 in req['payload'][key].items()}


def manifest_digest(files):
    return sha(''.join(name + '\0' + sha(files[name]) + '\n' for name in sorted(files)).encode())[:16]


def content_dir(parent, files, mode_file):
    """Install a set of files once, into a folder named by their content. An existing folder must match exactly."""
    digest = manifest_digest(files)
    root_dir(parent)
    target = parent / digest
    if target.exists():
        need(sorted(os.listdir(target)) == sorted(files), 'CONTENT_FOLDER_SET:' + digest)
        for name, data in files.items():
            need(file_sha(target / name) == sha(data), 'CONTENT_FOLDER_BYTES:' + digest)
        return target, False
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='.wb-', dir=str(parent)))
    try:
        for name, data in files.items():
            p = tmp / name
            p.write_bytes(data)
            os.chmod(p, mode_file)
        os.chmod(tmp, 0o755)
        os.rename(tmp, target)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return target, True


def runtime_copy():
    """A fixed copy of the HA runtime's Node binary, so an HA runtime change never moves under the services."""
    digest = file_sha(HA_NODE)
    parent = ROOT / 'runtime'
    root_dir(parent)
    target = parent / ('node-' + digest[:16])
    if not target.exists():
        fd, tmp = tempfile.mkstemp(prefix='.wb-', dir=str(parent))
        os.close(fd)
        shutil.copyfile(HA_NODE, tmp)
        os.chmod(tmp, 0o755)
        need(file_sha(tmp) == digest, 'RUNTIME_COPY_CHANGED')
        os.rename(tmp, target)
    need(file_sha(target) == digest, 'RUNTIME_COPY_BYTES')
    version = run([str(target), '-p', 'process.version + " " + (require("node:sqlite") ? "sqlite" : "")']).stdout.strip()
    need(re.fullmatch(r'v24\.\d+\.\d+ sqlite', version), 'RUNTIME_VERSION:' + version)
    return target, version


def box_lines(req, role):
    text = base64.b64decode(req['payload']['host']['box.conf.in']).decode()
    return [line for line in text.replace('@ROLE@', role).splitlines() if line and not line.startswith('#')]


def render_unit(req, name, app, node, offsite=None):
    text = base64.b64decode(req['payload']['host'][name + ('.in' if name.endswith('.service') else '')]).decode()
    role = {'synk-wb-api.service': 'api', 'synk-wb-keys.service': 'keys', 'synk-wb-files.service': 'files'}.get(name)
    if role:
        text = text.replace('@BOX@', '\n'.join(box_lines(req, role)))
    text = text.replace('@APP@', str(app)).replace('@NODE@', str(node)).replace('@OFFSITE@', str(offsite or ''))
    need('@' not in re.sub(r'#.*', '', text).replace('@system-service', ''), 'UNIT_PLACEHOLDER_LEFT:' + name)
    return text.encode()


def service_props(unit_text):
    """A rendered unit as 'Key=Value' strings for systemd-run -p: its company dependencies
    (UNIT_RUN_KEYS, PartOf as StopPropagatedFrom) and its [Service] lines minus RUN_SKIP."""
    out, section = [], None
    for line in unit_text.decode().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            section = line
            continue
        key, _, value = line.partition('=')
        if section == '[Service]' and key not in RUN_SKIP:
            out.append(line)
        elif section == '[Unit]' and key in UNIT_RUN_KEYS:
            out.append('StopPropagatedFrom=' + value if key == 'PartOf' else line)
    return out


PROBE_JS = r"""
const dns=require('node:dns').promises,net=require('node:net'),fs=require('node:fs'),crypto=require('node:crypto');
const role=process.argv[1],own='/srv/synk/workbackup/'+role,targets=JSON.parse(process.argv[2]);
const reach=(host,port)=>new Promise(ok=>{const s=net.connect({host,port,timeout:4000});s.on('connect',()=>{s.destroy();ok('connected');});s.on('timeout',()=>{s.destroy();ok('timeout');});s.on('error',e=>ok(e.code||'error'));});
const hidden=p=>{try{fs.readdirSync(p);return false;}catch{return true;}};
(async()=>{const r={uid:process.getuid(),reach:{}};
 try{r.dnsB2=!!(await dns.lookup('api.backblazeb2.com')).address;}catch{r.dnsB2=false;}
 try{r.dnsGoogle=!!(await dns.lookup('www.googleapis.com')).address;}catch{r.dnsGoogle=false;}
 try{const res=await fetch('https://api.backblazeb2.com/',{signal:AbortSignal.timeout(8000)});r.internet=res.status>0;}catch{r.internet=false;}
 for(const [k,[h,p]] of Object.entries(targets))r.reach[k]=await reach(h,p);
 r.companyDataHidden=hidden('/srv/synk/company');
 r.othersHidden=['api','keys','files'].filter(x=>x!==role).every(x=>hidden('/srv/synk/workbackup/'+x));
 r.etcSynkHidden=hidden('/etc/synk');
 try{const p=own+'/.box-probe-'+crypto.randomBytes(8).toString('hex');fs.writeFileSync(p,'x',{flag:'wx'});fs.unlinkSync(p);r.ownWritable=true;}catch{r.ownWritable=false;}
 try{fs.writeFileSync('/opt/synk/x','x');r.systemReadOnly=false;}catch{r.systemReadOnly=true;}
 console.log(JSON.stringify(r));})();
"""


def host_reaches(host, port):
    try:
        with socket.create_connection((host, port), timeout=4):
            return True
    except OSError:
        return False


def block_targets():
    """What the box must not reach: the metadata server, the company container, and this
    node's own VPC address on its SSH port (the host always reaches that one)."""
    vpc = re.findall(r'\binet (10\.\d{1,3}\.\d{1,3}\.\d{1,3})/', run(['ip', '-4', '-o', 'addr', 'show', 'scope', 'global']).stdout)
    need(vpc, 'NO_VPC_ADDRESS')
    return {'metadata': ('169.254.169.254', 80), 'company': ('172.30.77.2', 4191), 'vpc': (vpc[0], 22)}


def systemd_version():
    m = re.match(r'systemd (\d+)', run(['systemctl', '--version']).stdout)
    return int(m.group(1)) if m else 0


def probe(req, app, node):
    """Run each role's box (the unit's own properties) once with a check script. Every target
    is first reached from the host, so a closed port cannot pass for a working filter."""
    need(systemd_version() >= MIN_SYSTEMD, 'SYSTEMD_TOO_OLD')
    targets = block_targets()
    control = {k: host_reaches(*v) for k, v in targets.items()}
    need(all(control.values()), 'PROBE_CONTROL_UNREACHABLE:' + ','.join(k for k, ok in control.items() if not ok))
    results = {}
    for name in SERVICES:
        role = name[len('synk-wb-'):-len('.service')]
        args = ['systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec']
        for prop in service_props(render_unit(req, name, app, node)):
            args += ['-p', prop]
        args += ['--', str(node), '-e', PROBE_JS, role, json.dumps(targets)]
        p = run(args, timeout=120, check=False)
        try:
            r = json.loads(p.stdout.strip().splitlines()[-1])
        except Exception:
            raise Refused('BOX_PROBE_NO_ANSWER:' + role + ':' + str(p.returncode) + ':' + p.stderr.strip()[-300:])
        flags = {'uid': r.get('uid') == ROLES[role]}
        for k in ('dnsB2', 'dnsGoogle', 'internet', 'companyDataHidden', 'othersHidden', 'etcSynkHidden', 'ownWritable', 'systemReadOnly'):
            flags[k] = r.get(k) is True
        for k in targets:
            flags[k + 'Blocked'] = r['reach'].get(k) in BLOCKED
        results[role] = {'checks': flags, 'reach': r['reach']}
        need(all(flags.values()), 'BOX_PROBE_FAILED:' + role + ':' + ','.join(k for k, v in flags.items() if not v))
    return {'control': control, 'roles': results}


def company_identity():
    out = run(['docker', 'inspect', '--format', '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.State.Running}}', *COMPANY]).stdout.split('\n')
    return sorted(line for line in out if line)


def health(timeout=45):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with DIRECT.open(HEALTH, timeout=5) as r:
                body = json.load(r)
                if r.status == 200:
                    return body
        except Exception as e:
            last = type(e).__name__
        time.sleep(2)
    raise Refused('HEALTH_NOT_READY:' + str(last))


def service_show(name):
    return dict(line.split('=', 1) for line in run(['systemctl', 'show', name, '-p', 'ActiveState,SubState,NRestarts,MainPID']).stdout.split('\n') if '=' in line)


def services_steady(watch=10):
    """Each service running as the same process through the watch, and listening where its
    unit says. Restarts from before the watch (an old crash) do not count."""
    first = {}
    for name in SERVICES:
        p = service_show(name)
        need(p.get('ActiveState') == 'active' and p.get('SubState') == 'running' and p.get('MainPID', '0') != '0', 'SERVICE_NOT_RUNNING:' + name)
        first[name] = p
    time.sleep(watch)
    for name in SERVICES:
        p = service_show(name)
        need(p.get('SubState') == 'running' and p.get('MainPID') == first[name]['MainPID'] and p.get('NRestarts') == first[name]['NRestarts'], 'SERVICE_NOT_STEADY:' + name)
    listening = run(['ss', '-ltnH']).stdout
    for name, where in LISTEN.items():
        need(re.search(r'\s' + re.escape(where) + r'\s', listening), 'NOT_LISTENING:' + name)
    return {name: {'restartsBefore': p.get('NRestarts')} for name, p in first.items()}


def rpc_sign(secret, ts, rid, method, body):
    """rpc.mjs sign(): HMAC-SHA256 over the version, time, id, method and body hash, base64url."""
    text = 'wb-rpc/v1\n' + ts + '\n' + rid + '\n' + method + '\n' + hashlib.sha256(body).hexdigest()
    return base64.urlsafe_b64encode(hmac.new(secret.encode(), text.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def rpc_handshake():
    """One signed call per worker with the api's own copy of the secret and a method no worker
    has: a matching secret answers NO_METHOD (nothing runs), a split pair RPC_AUTH."""
    fd, _ = role_fd('api', 'secrets')
    try:
        secrets = {name: read_in(fd, name)[0] for name in RPC_URLS}
    finally:
        os.close(fd)
    out = {}
    for name, url in RPC_URLS.items():
        need(secrets[name], 'NOT_PROVISIONED:api:' + name)
        body = b'{"method":"wb.handshake","params":{}}'
        ts, rid = str(int(time.time() * 1000)), base64.urlsafe_b64encode(os.urandom(18)).decode()
        sig = rpc_sign(secrets[name].decode().strip(), ts, rid, 'wb.handshake', body)
        request = urllib.request.Request(url, data=body, method='POST', headers={'content-type': 'application/json', 'x-wb-ts': ts, 'x-wb-id': rid, 'x-wb-sig': sig})
        try:
            with DIRECT.open(request, timeout=10) as r:
                status, code = r.status, json.load(r).get('code')
        except urllib.error.HTTPError as e:
            status, code = e.code, (json.loads(e.read() or b'{}') or {}).get('code')
        except OSError as e:
            status, code = None, type(e).__name__
        out[name] = code
        need(status == 404 and code == 'NO_METHOD', 'RPC_HANDSHAKE:' + name + ':' + str(code) + (' (secrets changed since the start? start --다시)' if code == 'RPC_AUTH' else ''))
    return out


def reachability():
    """Caddy (wb-front) must reach the api; the company container (edge) must not."""
    caddy = run(['docker', 'exec', 'synk-company-https-1', 'wget', '-q', '-T', '5', '-O', '-', HEALTH], timeout=20, check=False)
    company = run(['docker', 'exec', 'synk-company-company-1', 'node', '-e',
                   "fetch(process.argv[1],{signal:AbortSignal.timeout(5000)}).then(()=>process.exit(0),()=>process.exit(3))", HEALTH], timeout=20, check=False)
    r = {'caddyReaches': caddy.returncode == 0 and '"ok"' in caddy.stdout.replace(' ', ''), 'companyBlocked': company.returncode == 3}
    need(r == {'caddyReaches': True, 'companyBlocked': True}, 'REACHABILITY:' + json.dumps(r))
    return r


def installed(req):
    """The content folders this payload maps to (they must already exist for probe/start)."""
    app = ROOT / 'app' / manifest_digest(payload_files(req, 'app'))
    off = ROOT / 'offsite' / manifest_digest(payload_files(req, 'offsite'))
    node = ROOT / 'runtime' / ('node-' + file_sha(HA_NODE)[:16])
    for p in (app, node, off):
        need(p.exists(), 'NOT_INSTALLED:' + str(p))
    return app, node, off


def wb_admin(req, app, node):
    """bin/wb-admin: admin.mjs as the api user inside the api's box, stdin passed through.
    It starts only while this node runs the company stack (the shell check), and the company's
    stop stops it (StopPropagatedFrom); a company restart never runs the command again."""
    props = service_props(render_unit(req, 'synk-wb-api.service', app, node))
    lines = ['#!/bin/sh', '# Generated by wb-host.py: admin.mjs as uid 10771 in the api box (server/README.md 「운영 명령」).', 'set -eu',
             "mountpoint -q /srv/synk || { echo 'wb-admin: the data disk is not mounted on this node' >&2; exit 3; }",
             "systemctl is-active --quiet synk-company.service || { echo 'wb-admin: the company stack is not running on this node' >&2; exit 3; }",
             'exec systemd-run --quiet --wait --pipe --collect --service-type=exec \\']
    lines += ["  -p '" + p.replace("'", "'\\''") + "' \\" for p in props]
    lines += ['  -- ' + str(node) + ' ' + str(app) + '/admin.mjs "$@"', '']
    return '\n'.join(lines).encode()


def active_states():
    return {n: run(['systemctl', 'is-active', n], check=False).stdout.strip() for n in (*SERVICES, *OFFSITE)}


def sudo_logs_input():
    """True when a sudoers Defaults line turns on log_input or log_stdin (a '!' turns it off,
    later lines win). host-install reads this with plan before it sends any secret."""
    files = [pathlib.Path('/etc/sudoers')] + sorted(f for f in pathlib.Path('/etc/sudoers.d').glob('*') if '.' not in f.name and not f.name.endswith('~'))
    on = False
    for f in files:
        try:
            text = f.read_text(errors='replace')
        except OSError:
            continue
        for line in text.splitlines():
            line = line.split('#', 1)[0].strip()
            if not line.startswith('Defaults'):
                continue
            for token in re.split(r'[\s,]+', line):
                if token in ('log_input', 'log_stdin'):
                    on = True
                elif token in ('!log_input', '!log_stdin'):
                    on = False
    return on


# ── actions

def act_plan(req):
    return {'mounted': os.path.ismount('/srv/synk'), 'companyActive': run(['systemctl', 'is-active', 'synk-company.service'], check=False).stdout.strip(),
            'haNodeSha': file_sha(HA_NODE), 'root': sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob('*')) if ROOT.exists() else None,
            'units': {n: run(['systemctl', 'show', n, '-p', 'LoadState,ActiveState,UnitFileState'], check=False).stdout.split() for n in (*SERVICES, *OFFSITE)},
            'company': company_identity(), 'mta': run(['ss', '-ltnpH', 'sport = :25'], check=False).stdout.strip(),
            'exim': run(['sh', '-c', "grep -h '^dc_eximconfig_configtype\\|^dc_local_interfaces\\|^dc_relay' /etc/exim4/update-exim4.conf.conf"], check=False).stdout.strip(),
            'sudoInputLog': sudo_logs_input()}


def act_files(req):
    writer_node()
    root_dir(pathlib.Path('/opt/synk'))
    root_dir(ROOT)
    node, version = runtime_copy()
    app_files = payload_files(req, 'app')
    need(app_files and all(APP_NAME.match(n) for n in app_files) and 'main.mjs' in app_files and 'admin.mjs' in app_files, 'APP_SET')
    app, app_new = content_dir(ROOT / 'app', app_files, 0o444)
    off_files = payload_files(req, 'offsite')
    need(sorted(off_files) == ['wb-offsite.py'], 'OFFSITE_SET')
    off, off_new = content_dir(ROOT / 'offsite', off_files, 0o444)
    resolv = base64.b64decode(req['payload']['host']['resolv.conf'])
    need(resolv == b'nameserver 127.0.0.53\noptions edns0 trust-ad\n', 'RESOLV_CONTENT')
    write_root_file(ROOT / 'resolv.conf', resolv, 0o644)
    root_dir(ROOT / 'bin')
    made = folders()
    return {'node': str(node), 'nodeVersion': version, 'app': str(app), 'appNew': app_new, 'offsite': str(off), 'offsiteNew': off_new, 'madeFolders': made}


def act_probe(req):
    writer_node()
    app, node, off = installed(req)
    return {'probe': probe(req, app, node)}


def act_secrets(req):
    """Secret files 0600 owned by the role's uid, and each role's settings.env. Every value and
    every existing file is checked before anything is written. An existing different value is
    replaced only with --바꿈. An RPC pair that agrees is kept; a split or half-written pair
    needs --바꿈, which writes a new pair: the workers' halves first, the api's last. Services
    already running keep their old values until the next start, which restarts them."""
    writer_node()
    need(not sudo_logs_input(), 'SUDO_LOGS_INPUT (the secrets would stay in the sudo I/O log)')
    folders()
    sent = req['secrets']
    for role, names in SECRET_NAMES.items():
        need(sorted(sent.get(role, {})) == sorted(names), 'SECRET_SET:' + role)
    for role in ROLES:
        settings = req['settings'][role]
        need(all(re.fullmatch(r'WB_[A-Z0-9_]+=[^\n]*', line) and not line.startswith('WB_SECRET') for line in settings.splitlines() if line and not line.startswith('#')), 'SETTINGS_SHAPE:' + role)
    replace = bool(req.get('replace'))
    fds = {role: role_fd(role, 'secrets')[0] for role in ROLES}
    try:
        old = {}
        for role, names in SECRET_NAMES.items():
            for name in names:
                data, s = read_in(fds[role], name)
                if data is not None:
                    need(s.st_uid == ROLES[role] and stat.S_IMODE(s.st_mode) == 0o600, 'SECRET_FILE_UNSAFE:' + role + ':' + name)
                old[role, name] = data
        for pair, (a, b) in RPC_PAIRS.items():
            va, vb = old[a, pair], old[b, pair]
            if va is not None and va == vb and not replace:
                sent[a][pair] = sent[b][pair] = va.decode()
            elif (va is not None or vb is not None) and not replace:
                raise Refused('RPC_SECRET_SPLIT:' + pair + ' (--바꿈 writes a new pair)')
        plan = []
        for role, names in SECRET_NAMES.items():
            for name in names:
                value = sent[role][name].encode()
                need(len(value) >= 32 and b'\n' not in value.strip(), 'SECRET_SHAPE:' + role + ':' + name)
                if old[role, name] == value:
                    continue
                need(old[role, name] is None or replace, 'SECRET_DIFFERS:' + role + ':' + name)
                plan.append((role, name, value))
        result = {role + '/' + name: 'kept' for role, names in SECRET_NAMES.items() for name in names}
        # Every new file is written and synced under a temporary name first; only then are they
        # renamed, the workers' halves before the api's, so a stop mid-way leaves at most a split
        # between two renames (start then refuses it, and secrets --바꿈 writes a new pair).
        staged = []
        try:
            for role, name, value in sorted(plan, key=lambda x: x[0] == 'api'):
                staged.append((role, name, stage_in(fds[role], value, 0o600, ROLES[role])))
            for role, name, tmp in staged:
                os.replace(tmp, name, src_dir_fd=fds[role], dst_dir_fd=fds[role])
                result[role + '/' + name] = 'written'
        except BaseException:
            for role, name, tmp in staged:
                drop_in(fds[role], tmp)
            raise
    finally:
        for fd in fds.values():
            os.close(fd)
    for role in ROLES:
        fd, _ = role_fd(role)
        try:
            data = req['settings'][role].encode()
            if read_in(fd, 'settings.env')[0] == data:
                result[role + '/settings.env'] = 'kept'
            else:
                write_in(fd, 'settings.env', data, 0o600, ROLES[role])
                result[role + '/settings.env'] = 'written'
        finally:
            os.close(fd)
    running = [n for n in SERVICES if run(['systemctl', 'is-active', n], check=False).stdout.strip() == 'active']
    written = any(v == 'written' for v in result.values())
    return {'files': result, 'note': ('running services keep their old values until the next start restarts them: ' + ','.join(running)) if running and written else None}


def provisioned():
    """Every secret file in place with its owner and mode, both halves of each RPC pair equal, settings written."""
    values = {}
    for role in ROLES:
        fd, _ = role_fd(role, 'secrets')
        try:
            for name in SECRET_NAMES[role]:
                data, s = read_in(fd, name)
                need(data is not None and s.st_uid == ROLES[role] and stat.S_IMODE(s.st_mode) == 0o600, 'NOT_PROVISIONED:' + role + ':' + name)
                values[role, name] = data
        finally:
            os.close(fd)
        fd, _ = role_fd(role)
        try:
            data, s = read_in(fd, 'settings.env')
            need(data is not None and s.st_uid == ROLES[role], 'NOT_PROVISIONED:' + role + ':settings.env')
        finally:
            os.close(fd)
    for pair, (a, b) in RPC_PAIRS.items():
        need(values[a, pair] == values[b, pair], 'RPC_SECRET_SPLIT:' + pair + ' (secrets --바꿈 writes a new pair)')


def bucket_sha(env_text):
    """SHA-256 of the bucket in SYNK_BACKUP_GCS_DESTINATION (gs://bucket/prefix) — where the daily copy goes."""
    values = [line.split('=', 1)[1].strip().strip('"\'') for line in env_text.splitlines() if line.startswith('SYNK_BACKUP_GCS_DESTINATION=')]
    need(len(values) == 1, 'DESTINATION_NOT_ONE')
    m = re.fullmatch(r'gs://([a-z0-9][a-z0-9._-]{1,61}[a-z0-9])/[A-Za-z0-9._/-]+', values[0])
    need(m, 'DESTINATION_INVALID')
    return sha(m.group(1).encode())


def mark_checked_bucket(digest):
    """wb-offsite.py sends only to the bucket whose rule was checked (it compares this hash first)."""
    root_dir(OFFSITE_STATE, 0o700)
    need(stat.S_IMODE(OFFSITE_STATE.lstat().st_mode) == 0o700, 'UNSAFE_DIRECTORY:' + str(OFFSITE_STATE))
    write_root_file(OFFSITE_STATE / 'checked-bucket', (digest + '\n').encode(), 0o600)


ADMIN = ROOT / 'bin' / 'wb-admin'
TIMER = 'synk-wb-offsite.timer'
CHECKED = OFFSITE_STATE / 'checked-bucket'


def unit_state():
    files = {n: (UNIT_DIR / n).read_bytes() if (UNIT_DIR / n).exists() else None for n in UNIT_NAMES}
    active = {n: run(['systemctl', 'is-active', n], check=False).stdout.strip() for n in UNIT_NAMES}
    enabled = {n: run(['systemctl', 'is-enabled', n], check=False).stdout.strip() for n in UNIT_NAMES}
    admin = ADMIN.read_bytes() if ADMIN.exists() else None
    checked = CHECKED.read_bytes() if CHECKED.exists() else None
    return {'files': files, 'active': active, 'enabled': enabled, 'admin': admin, 'checked': checked}


def put_back(path, data, mode):
    if data is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    else:
        write_root_file(path, data, mode)


def restore(before, done):
    """Undo what this start did, and only that: unit files it wrote, services it restarted, the
    enabling, wb-admin, the checked-bucket record and the timer. Units it did not touch keep
    running. A daily copy already running is left alone. Then read what is really there."""
    stop = list(done['restarted']) + ([TIMER] if done['timer'] else [])
    if stop:
        run(['systemctl', 'stop', *stop], timeout=120, check=False)
    for n in done['files']:
        if before['files'][n] is None:
            run(['systemctl', 'disable', n], check=False)
        put_back(UNIT_DIR / n, before['files'][n], 0o644)
    if done['admin']:
        put_back(ADMIN, before['admin'], 0o755)
    if done['checked']:
        put_back(CHECKED, before['checked'], 0o600)
    if done['files']:
        run(['systemctl', 'daemon-reload'], check=False)
    if done['enabled']:
        for n in SERVICES:
            if before['files'][n] is not None and before['enabled'][n] != 'enabled':
                run(['systemctl', 'disable', n], check=False)
    if done['timer'] and before['files'][TIMER] is not None and before['enabled'][TIMER] != 'enabled':
        run(['systemctl', 'disable', TIMER], check=False)
    again = [n for n in stop if before['active'][n] == 'active' and before['files'][n] is not None]
    if again:
        run(['systemctl', 'start', *again], timeout=120, check=False)
    now = unit_state()
    managed = (*SERVICES, TIMER)
    off = [n for n in managed if before['files'][n] is not None and ((now['active'][n] == 'active') != (before['active'][n] == 'active') or (now['enabled'][n] == 'enabled') != (before['enabled'][n] == 'enabled'))]
    said = 'units removed' if all(before['files'][n] is None for n in done['files']) and done['files'] else 'put back what this start changed'
    return said + ('' if not off else ' · RESTORE_INCOMPLETE:' + ','.join(n + '=' + now['active'][n] + '/' + now['enabled'][n] for n in off))


def process_info(pid):
    """The argv of a running process and when it started (unix seconds, to 10 ms), from /proc."""
    argv = [a.decode() for a in pathlib.Path('/proc/%d/cmdline' % pid).read_bytes().rstrip(b'\0').split(b'\0')]
    ticks = int(pathlib.Path('/proc/%d/stat' % pid).read_text().rsplit(')', 1)[1].split()[19])
    uptime = float(pathlib.Path('/proc/uptime').read_text().split()[0])
    return argv, time.time() - (uptime - ticks / os.sysconf('SC_CLK_TCK'))


def config_changed():
    """Per role, the newest change time (ctime: a copy that keeps old times still counts) of its
    secret files and settings.env."""
    out = {}
    for role in ROLES:
        times = []
        fd, _ = role_fd(role, 'secrets')
        try:
            times += [read_in(fd, name)[1].st_ctime for name in SECRET_NAMES[role]]
        finally:
            os.close(fd)
        fd, _ = role_fd(role)
        try:
            times.append(read_in(fd, 'settings.env')[1].st_ctime)
        finally:
            os.close(fd)
        out[role] = max(times)
    return out


def stale_services(before, app, node):
    """Services to restart: not running, running another app or runtime than this payload's, or
    started before its current secrets or settings changed (a process keeps what it read at start)."""
    changed = config_changed()
    out = []
    for role in ROLES:
        name = 'synk-wb-' + role + '.service'
        pid = int(service_show(name).get('MainPID') or 0) if before['active'][name] == 'active' else 0
        if not pid:
            out.append(name)
            continue
        try:
            argv, started = process_info(pid)
        except (OSError, ValueError, IndexError):
            out.append(name)
            continue
        if argv != [str(node), str(app) + '/main.mjs', role] or started <= changed[role]:
            out.append(name)
    return out


def verify(company):
    checks = {'health': health(), 'steady': services_steady(), 'rpc': rpc_handshake(), 'reach': reachability()}
    need(company_identity() == company, 'COMPANY_CONTAINERS_CHANGED')
    return checks


def act_start(req):
    """Every check that needs nothing new comes first: files, secrets, the bucket, the box.
    Then only what differs changes: unit files that differ are written; a service restarts when
    it is not running, runs another app or runtime, started before its secrets or settings
    changed, or with --다시. The checks run on the result; then the services are enabled,
    wb-admin written, the checked bucket recorded, and the timer started last. Any failure undoes
    what this run did and nothing else. The company containers stay the same throughout."""
    writer_node()
    app, node, off = installed(req)
    provisioned()
    bucket = bucket_sha(COMPANY_ENV.read_text())
    need(req.get('checkedBucketSha256') == bucket, 'BUCKET_NOT_CHECKED (host-install checks the rule on the bucket company.env sends to)')
    box = probe(req, app, node)
    company = company_identity()
    units = {n: render_unit(req, n, app, node, off) for n in UNIT_NAMES}
    admin = wb_admin(req, app, node)
    marked = (bucket + '\n').encode()
    before = unit_state()
    changed = [n for n in UNIT_NAMES if before['files'][n] != units[n]]
    restart = list(SERVICES) if req.get('restart') else sorted(set(n for n in SERVICES if n in changed) | set(stale_services(before, app, node)), key=SERVICES.index)
    enable = [n for n in SERVICES if before['enabled'][n] != 'enabled']
    timer = TIMER in changed or before['active'][TIMER] != 'active' or before['enabled'][TIMER] != 'enabled'
    rest = [x for x, same in (('wb-admin', before['admin'] == admin), ('checked-bucket', before['checked'] == marked)) if not same]
    if not changed and not restart and not enable and not timer and not rest:
        return {'box': box, 'alreadyRunning': True, **verify(company), 'active': active_states(), 'companyUnchanged': True}
    done = {'files': [], 'restarted': [], 'enabled': False, 'admin': False, 'checked': False, 'timer': False}
    try:
        for n in changed:
            done['files'].append(n)
            write_root_file(UNIT_DIR / n, units[n], 0o644)
        if changed:
            run(['systemctl', 'daemon-reload'])
        if restart:
            done['restarted'] = restart
            run(['systemctl', 'restart', *restart], timeout=120)
        checks = verify(company)
        if enable:
            done['enabled'] = True
            run(['systemctl', 'enable', *SERVICES])
        if 'wb-admin' in rest:
            done['admin'] = True
            root_dir(ROOT / 'bin')
            write_root_file(ADMIN, admin, 0o755)
        if 'checked-bucket' in rest:
            done['checked'] = True
            mark_checked_bucket(bucket)
        need(company_identity() == company, 'COMPANY_CONTAINERS_CHANGED')
        if timer:
            done['timer'] = True
            run(['systemctl', 'enable', '--now', TIMER])
            if TIMER in changed:
                run(['systemctl', 'restart', TIMER])
    except BaseException as e:
        undone = restore(before, done)
        raise Refused((str(e) if isinstance(e, Refused) else 'UNEXPECTED_' + type(e).__name__) + ' · ' + undone)
    return {'box': box, 'changedUnits': changed, 'restarted': restart, 'enabled': enable, 'timerStarted': timer, 'alsoChanged': rest, **checks,
            'active': active_states(), 'companyUnchanged': True, 'company': company}


def act_status(req):
    r = {'active': active_states(), 'company': company_identity(),
         'listen': run(['ss', '-ltnH', '( sport = :4210 or sport = :4211 or sport = :4212 )'], check=False).stdout.strip().splitlines()}
    try:
        r['health'] = health(timeout=5)
    except Refused as e:
        r['health'] = str(e)
    marker = pathlib.Path('/var/lib/synk-wb-offsite/last.json')
    r['offsite'] = json.loads(marker.read_text()) if marker.exists() else None
    r['offsiteLast'] = run(['journalctl', '-u', 'synk-wb-offsite.service', '-o', 'cat', '-n', '3', '--no-pager'], check=False).stdout.strip().splitlines()
    r['services'] = {n: run(['systemctl', 'show', n, '-p', 'MemoryCurrent,NRestarts,ActiveEnterTimestamp'], check=False).stdout.split('\n') for n in SERVICES}
    return r


def act_stop(req):
    run(['systemctl', 'disable', '--now', 'synk-wb-offsite.timer', *SERVICES], timeout=120)
    run(['systemctl', 'stop', 'synk-wb-offsite.service'], timeout=60)
    return {'active': active_states()}


ACTIONS = {'plan': act_plan, 'files': act_files, 'probe': act_probe, 'secrets': act_secrets, 'start': act_start, 'status': act_status, 'stop': act_stop}


def host_lock():
    """One run at a time for everything that changes the host (files, secrets, units, the box runs)."""
    import fcntl
    fd = os.open(LOCK, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise Refused('ANOTHER_RUN_HOLDS_THE_LOCK')
    return fd


def main():
    need(os.geteuid() == 0, 'ROOT_REQUIRED')
    need(hasattr(os, 'O_DIRECTORY') and hasattr(os, 'O_NOFOLLOW'), 'LINUX_REQUIRED')
    req = globals().get('REQUEST')
    need(isinstance(req, dict) and req.get('action') in ACTIONS, 'REQUEST_INVALID')
    lock = None
    if req['action'] not in ('plan', 'status'):
        # A dropped SSH session (SIGHUP), Ctrl-C or a terminate waits until the run is done, so
        # files, secret pairs and units are never left half-changed by them (SIGKILL still can).
        signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGHUP, signal.SIGINT, signal.SIGTERM, signal.SIGPIPE})
        lock = host_lock()
    try:
        return {'action': req['action'], 'result': ACTIONS[req['action']](req)}
    finally:
        if lock is not None:
            os.close(lock)


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Refused as e:
        print(json.dumps({'error': str(e)}))
    except Exception as e:
        # Only an OSError's text (a path) is shown; other errors could carry request values.
        print(json.dumps({'error': 'UNEXPECTED_' + type(e).__name__ + (':' + str(e)[:200] if isinstance(e, OSError) else '')}))
