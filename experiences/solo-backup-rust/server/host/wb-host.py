#!/usr/bin/env python3
"""Root-side installer for the work-backup services on the company writer node.

Sent by tools/host-install.mjs through the pinned SSH path as `sudo python3 -`, after two
lines that set REQUEST (action, payload). Prints one JSON object. It never prints a secret
value, a bucket name or an address of a person. It never touches the company stack: it reads
the company, Caddy and spaceship container ids before and after `start` and fails if any
changed. Actions: plan, files, probe, secrets, start, status, stop.

The role folders under /srv/synk/workbackup belong to the role users. Inside them root works
only through directory descriptors opened with O_NOFOLLOW, so a role user cannot swap a name
for a link and make root change or write something outside its folder.
"""
import base64, hashlib, json, os, pathlib, re, shutil, socket, stat, subprocess, tempfile, time, urllib.request

ROOT = pathlib.Path('/opt/synk/workbackup')
SRV = pathlib.Path('/srv/synk/workbackup')
HA_NODE = pathlib.Path('/opt/synk/ha-runtime/node')
UNIT_DIR = pathlib.Path('/etc/systemd/system')
ROLES = {'api': 10771, 'keys': 10772, 'files': 10773}
SERVICES = ('synk-wb-keys.service', 'synk-wb-files.service', 'synk-wb-api.service')
OFFSITE = ('synk-wb-offsite.service', 'synk-wb-offsite.timer')
LISTEN = {'synk-wb-api.service': '172.30.77.9:4210', 'synk-wb-keys.service': '127.0.0.1:4211', 'synk-wb-files.service': '127.0.0.1:4212'}
COMPANY = ('synk-company-company-1', 'synk-company-https-1', 'synk-spaceship-spaceship-1')
SUBDIRS = {'api': ('secrets', 'data', 'backups'), 'keys': ('secrets', 'state'), 'files': ('secrets', 'state')}
SECRET_NAMES = {'api': ('wb-keys-rpc', 'wb-files-rpc'), 'keys': ('wb-keys-b2', 'wb-keys-rpc'), 'files': ('wb-files-b2', 'wb-files-rpc')}
RPC_PAIRS = {'wb-keys-rpc': ('api', 'keys'), 'wb-files-rpc': ('api', 'files')}
HEALTH = 'http://172.30.77.9:4210/backup-api/v1/health'
APP_NAME = re.compile(r'^[a-z0-9-]+\.mjs$')
# Targets the box must not reach. Each is first reached from the host itself, so a closed port
# cannot pass for a working filter; a target the host cannot reach is reported as untested.
BLOCK_TARGETS = {'metadata': ('169.254.169.254', 80), 'company': ('172.30.77.2', 4191), 'vpc': ('10.77.0.3', 22)}
# Properties systemd-run may not take, or that only make sense for the long-running unit.
RUN_SKIP = {'Type', 'ExecStart', 'Restart', 'RestartSec', 'TimeoutStopSec', 'KillMode', 'WorkingDirectory'}
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
    """A regular file directly in dfd (no link), or None. Returns (bytes, stat)."""
    try:
        s = os.stat(name, dir_fd=dfd, follow_symlinks=False)
    except FileNotFoundError:
        return None, None
    need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, 'UNSAFE_FILE:' + name)
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=dfd)
    with os.fdopen(fd, 'rb') as f:
        return f.read(), s


def write_in(dfd, name, data, mode, uid):
    """Atomic write of one file directly in dfd, owner and mode set through the descriptor."""
    tmp = '.wb-' + os.urandom(8).hex()
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=dfd)
    try:
        os.fchown(fd, uid, uid)
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, name, src_dir_fd=dfd, dst_dir_fd=dfd)
    except BaseException:
        try:
            os.unlink(tmp, dir_fd=dfd)
        except FileNotFoundError:
            pass
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
    """The [Service] lines of a rendered unit as 'Key=Value' strings for systemd-run -p (minus RUN_SKIP)."""
    out, section = [], None
    for line in unit_text.decode().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            section = line
            continue
        if section == '[Service]' and line.split('=', 1)[0] not in RUN_SKIP:
            out.append(line)
    return out


PROBE_JS = r"""
const dns=require('node:dns').promises,net=require('node:net'),fs=require('node:fs');
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
 try{const p=own+'/.box-probe';fs.writeFileSync(p,'x');fs.unlinkSync(p);r.ownWritable=true;}catch{r.ownWritable=false;}
 try{fs.writeFileSync('/opt/synk/x','x');r.systemReadOnly=false;}catch{r.systemReadOnly=true;}
 console.log(JSON.stringify(r));})();
"""


def host_reaches(host, port):
    try:
        with socket.create_connection((host, port), timeout=4):
            return True
    except OSError:
        return False


def probe(req, app, node):
    """Run each role's box (the unit's own [Service] lines) once with a check script.
    A target counts as blocked only when the host reaches it and the box does not connect."""
    control = {k: host_reaches(*v) for k, v in BLOCK_TARGETS.items()}
    need(control['metadata'] and control['company'], 'PROBE_CONTROL_UNREACHABLE:' + json.dumps(control))
    results = {}
    for name in SERVICES:
        role = name[len('synk-wb-'):-len('.service')]
        args = ['systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec']
        for prop in service_props(render_unit(req, name, app, node)):
            args += ['-p', prop]
        args += ['--', str(node), '-e', PROBE_JS, role, json.dumps(BLOCK_TARGETS)]
        p = run(args, timeout=120, check=False)
        try:
            r = json.loads(p.stdout.strip().splitlines()[-1])
        except Exception:
            raise Refused('BOX_PROBE_NO_ANSWER:' + role + ':' + str(p.returncode))
        flags = {'uid': r.get('uid') == ROLES[role]}
        for k in ('dnsB2', 'dnsGoogle', 'internet', 'companyDataHidden', 'othersHidden', 'etcSynkHidden', 'ownWritable', 'systemReadOnly'):
            flags[k] = r.get(k) is True
        untested = []
        for k, ok in control.items():
            if ok:
                flags[k + 'Blocked'] = r['reach'].get(k) not in ('connected', 'ECONNREFUSED')
            else:
                untested.append(k)
        results[role] = {'checks': flags, 'reach': r['reach'], 'untested': untested}
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
            with urllib.request.urlopen(HEALTH, timeout=5) as r:
                body = json.load(r)
                if r.status == 200:
                    return body
        except Exception as e:
            last = type(e).__name__
        time.sleep(2)
    raise Refused('HEALTH_NOT_READY:' + str(last))


def services_steady():
    """Each service active and running with no restart, and listening where its unit says."""
    time.sleep(5)
    state = {}
    for name in SERVICES:
        props = dict(line.split('=', 1) for line in run(['systemctl', 'show', name, '-p', 'ActiveState,SubState,NRestarts']).stdout.split('\n') if '=' in line)
        state[name] = props
        need(props.get('ActiveState') == 'active' and props.get('SubState') == 'running' and props.get('NRestarts') == '0', 'SERVICE_NOT_STEADY:' + name)
    listening = run(['ss', '-ltnH']).stdout
    for name, where in LISTEN.items():
        need(re.search(r'\s' + re.escape(where) + r'\s', listening), 'NOT_LISTENING:' + name)
    return state


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
    """bin/wb-admin: admin.mjs as the api user inside the api's box, stdin passed through,
    and only while this node runs the company stack (the api's own start condition)."""
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


# ── actions

def act_plan(req):
    return {'mounted': os.path.ismount('/srv/synk'), 'companyActive': run(['systemctl', 'is-active', 'synk-company.service'], check=False).stdout.strip(),
            'haNodeSha': file_sha(HA_NODE), 'root': sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob('*')) if ROOT.exists() else None,
            'units': {n: run(['systemctl', 'show', n, '-p', 'LoadState,ActiveState,UnitFileState'], check=False).stdout.split() for n in (*SERVICES, *OFFSITE)},
            'company': company_identity(), 'mta': run(['ss', '-ltnpH', 'sport = :25'], check=False).stdout.strip(),
            'exim': run(['sh', '-c', "grep -h '^dc_eximconfig_configtype\\|^dc_local_interfaces\\|^dc_relay' /etc/exim4/update-exim4.conf.conf"], check=False).stdout.strip()}


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
    write_root_file(ROOT / 'bin' / 'wb-admin', wb_admin(req, app, node), 0o755)
    made = folders()
    return {'node': str(node), 'nodeVersion': version, 'app': str(app), 'appNew': app_new, 'offsite': str(off), 'offsiteNew': off_new, 'madeFolders': made}


def act_probe(req):
    writer_node()
    app, node, off = installed(req)
    return {'probe': probe(req, app, node)}


def act_secrets(req):
    """Secret files 0600 owned by the role's uid. An existing different value is replaced only
    with --바꿈. The two RPC values are written to both sides together: an existing pair that
    agrees is kept; a split or half-written pair needs --바꿈, which writes a new pair."""
    writer_node()
    folders()
    sent = req['secrets']
    for role, names in SECRET_NAMES.items():
        need(sorted(sent.get(role, {})) == sorted(names), 'SECRET_SET:' + role)
    result = {}
    fds = {role: role_fd(role, 'secrets')[0] for role in ROLES}
    try:
        for pair, (a, b) in RPC_PAIRS.items():
            va, _ = read_in(fds[a], pair)
            vb, _ = read_in(fds[b], pair)
            if va is not None and va == vb and not req.get('replace'):
                sent[a][pair] = sent[b][pair] = va.decode()
            elif (va is not None or vb is not None) and not req.get('replace'):
                raise Refused('RPC_SECRET_SPLIT:' + pair + ' (--바꿈 writes a new pair)')
        for role, names in SECRET_NAMES.items():
            for name in names:
                value = sent[role][name].encode()
                need(len(value) >= 32 and b'\n' not in value.strip(), 'SECRET_SHAPE:' + role + ':' + name)
                old, s = read_in(fds[role], name)
                if old is not None:
                    need(s.st_uid == ROLES[role] and stat.S_IMODE(s.st_mode) == 0o600, 'SECRET_FILE_UNSAFE:' + role + ':' + name)
                    if old == value:
                        result[role + '/' + name] = 'kept'
                        continue
                    need(req.get('replace') or name in RPC_PAIRS, 'SECRET_DIFFERS:' + role + ':' + name)
                write_in(fds[role], name, value, 0o600, ROLES[role])
                result[role + '/' + name] = 'written'
    finally:
        for fd in fds.values():
            os.close(fd)
    for role in ROLES:
        settings = req['settings'][role].encode()
        need(all(re.fullmatch(r'WB_[A-Z0-9_]+=[^\n]*', line) and not line.startswith('WB_SECRET') for line in settings.decode().splitlines() if line and not line.startswith('#')), 'SETTINGS_SHAPE:' + role)
        fd, _ = role_fd(role)
        try:
            write_in(fd, 'settings.env', settings, 0o600, ROLES[role])
        finally:
            os.close(fd)
        result[role + '/settings.env'] = 'written'
    return {'files': result}


def provisioned():
    for role in ROLES:
        fd, _ = role_fd(role, 'secrets')
        try:
            for name in SECRET_NAMES[role]:
                data, s = read_in(fd, name)
                need(data is not None and s.st_uid == ROLES[role] and stat.S_IMODE(s.st_mode) == 0o600, 'NOT_PROVISIONED:' + role + ':' + name)
        finally:
            os.close(fd)
        fd, _ = role_fd(role)
        try:
            data, s = read_in(fd, 'settings.env')
            need(data is not None and s.st_uid == ROLES[role], 'NOT_PROVISIONED:' + role + ':settings.env')
        finally:
            os.close(fd)


def act_start(req):
    """Box check first, then units, then start; any failure after the units are enabled takes
    them down again (files stay). The company containers must be the same before and after."""
    writer_node()
    app, node, off = installed(req)
    provisioned()
    need(req.get('bucketRuleChecked') is True, 'BUCKET_RULE_NOT_CHECKED')
    box = probe(req, app, node)
    before = company_identity()
    units = {n: render_unit(req, n, app, node, off) for n in (*SERVICES, *OFFSITE)}
    changed = []
    for name, text in units.items():
        p = UNIT_DIR / name
        if not p.exists() or p.read_bytes() != text:
            write_root_file(p, text, 0o644)
            changed.append(name)
    run(['systemctl', 'daemon-reload'])
    try:
        run(['systemctl', 'enable', *SERVICES])
        run(['systemctl', 'restart' if req.get('restart') else 'start', *SERVICES], timeout=120)
        body = health()
        steady = services_steady()
        reach = reachability()
        run(['systemctl', 'enable', '--now', 'synk-wb-offsite.timer'])
    except BaseException:
        run(['systemctl', 'disable', '--now', 'synk-wb-offsite.timer', *SERVICES], timeout=120, check=False)
        raise
    after = company_identity()
    need(before == after, 'COMPANY_CONTAINERS_CHANGED')
    return {'box': box, 'changedUnits': changed, 'health': body, 'steady': steady, 'reach': reach, 'active': active_states(),
            'companyUnchanged': True, 'company': after}


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


def main():
    need(os.geteuid() == 0, 'ROOT_REQUIRED')
    need(hasattr(os, 'O_DIRECTORY') and hasattr(os, 'O_NOFOLLOW'), 'LINUX_REQUIRED')
    req = globals().get('REQUEST')
    need(isinstance(req, dict) and req.get('action') in ACTIONS, 'REQUEST_INVALID')
    return {'action': req['action'], 'result': ACTIONS[req['action']](req)}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Refused as e:
        print(json.dumps({'error': str(e)}))
    except Exception as e:
        # Only an OSError's text (a path) is shown; other errors could carry request values.
        print(json.dumps({'error': 'UNEXPECTED_' + type(e).__name__ + (':' + str(e)[:200] if isinstance(e, OSError) else '')}))
