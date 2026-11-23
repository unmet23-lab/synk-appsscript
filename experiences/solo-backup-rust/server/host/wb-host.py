#!/usr/bin/env python3
"""Root-side installer for the work-backup services on the company writer node.

Sent by tools/host-install.mjs through the pinned SSH path as `sudo python3 -`, with one
leading line `REQUEST = {...}` (action, payload). Prints one JSON object. It never prints a
secret value, a bucket name or an address of a person. It never touches the company stack:
it reads the company, Caddy and spaceship container ids before and after `start` and fails
if any changed. Actions: plan, files, probe, secrets, start, status, stop.
"""
import base64, hashlib, json, os, pathlib, re, shutil, stat, subprocess, tempfile, time, urllib.request

ROOT = pathlib.Path('/opt/synk/workbackup')
SRV = pathlib.Path('/srv/synk/workbackup')
HA_NODE = pathlib.Path('/opt/synk/ha-runtime/node')
UNIT_DIR = pathlib.Path('/etc/systemd/system')
ROLES = {'api': 10771, 'keys': 10772, 'files': 10773}
SERVICES = ('synk-wb-keys.service', 'synk-wb-files.service', 'synk-wb-api.service')
OFFSITE = ('synk-wb-offsite.service', 'synk-wb-offsite.timer')
COMPANY = ('synk-company-company-1', 'synk-company-https-1', 'synk-spaceship-spaceship-1')
SUBDIRS = {'api': ('secrets', 'data', 'backups'), 'keys': ('secrets', 'state'), 'files': ('secrets', 'state')}
SECRET_NAMES = {'api': ('wb-keys-rpc', 'wb-files-rpc'), 'keys': ('wb-keys-b2', 'wb-keys-rpc'), 'files': ('wb-files-b2', 'wb-files-rpc')}
HEALTH = 'http://172.30.77.9:4210/backup-api/v1/health'
APP_NAME = re.compile(r'^[a-z0-9-]+\.mjs$')
# Properties systemd-run may not take, or that only make sense for the long-running unit.
RUN_SKIP = {'Type', 'ExecStart', 'Restart', 'RestartSec', 'TimeoutStopSec', 'KillMode', 'WorkingDirectory'}


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
    """A root-owned directory that only root can change. Created if missing, never chmod'ed in place."""
    if not path.exists():
        path.mkdir(mode=mode)
        os.chmod(path, mode)
    s = path.lstat()
    need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'UNSAFE_DIRECTORY:' + str(path))


def write_atomic(path, data, mode, uid=0):
    """Write next to the target, then rename; the directory decides who may replace it."""
    fd, tmp = tempfile.mkstemp(prefix='.wb-', dir=str(path.parent))
    try:
        os.fchmod(fd, mode)
        os.fchown(fd, uid, uid)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def payload_files(req, key):
    rows = {}
    for name, b64 in req['payload'][key].items():
        data = base64.b64decode(b64, validate=True)
        rows[name] = data
    return rows


def content_dir(parent, files, mode_file):
    """Install a set of files once, into a folder named by their content. An existing folder must match exactly."""
    manifest = ''.join(name + '\0' + sha(files[name]) + '\n' for name in sorted(files))
    digest = sha(manifest.encode())[:16]
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


def folders():
    """/srv/synk/workbackup (root 0711) and one 0700 folder per role owned by that role's uid."""
    made = []
    if not SRV.exists():
        SRV.mkdir(mode=0o711)
        os.chmod(SRV, 0o711)
        made.append(str(SRV))
    s = SRV.lstat()
    need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and stat.S_IMODE(s.st_mode) == 0o711, 'UNSAFE_DIRECTORY:' + str(SRV))
    for role, uid in ROLES.items():
        for p in [SRV / role, *[SRV / role / d for d in SUBDIRS[role]]]:
            if not p.exists():
                p.mkdir(mode=0o700)
                os.chown(p, uid, uid)
                os.chmod(p, 0o700)
                made.append(str(p))
            s = p.lstat()
            need(stat.S_ISDIR(s.st_mode) and s.st_uid == uid and s.st_gid == uid and stat.S_IMODE(s.st_mode) == 0o700, 'UNSAFE_DIRECTORY:' + str(p))
    return made


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
        if section == '[Service]':
            key = line.split('=', 1)[0]
            if key not in RUN_SKIP:
                out.append(line)
    return out


PROBE_JS = r"""
const dns=require('node:dns').promises,net=require('node:net'),fs=require('node:fs');
const role=process.argv[1],own='/srv/synk/workbackup/'+role;
const blocked=(host,port)=>new Promise(ok=>{const s=net.connect({host,port,timeout:3000});s.on('connect',()=>{s.destroy();ok(false);});s.on('timeout',()=>{s.destroy();ok(true);});s.on('error',()=>ok(true));});
const hidden=p=>{try{fs.readdirSync(p);return false;}catch{return true;}};
(async()=>{const r={uid:process.getuid()};
 try{r.dnsB2=(await dns.lookup('api.backblazeb2.com')).address?true:false;}catch{r.dnsB2=false;}
 try{r.dnsGoogle=(await dns.lookup('www.googleapis.com')).address?true:false;}catch{r.dnsGoogle=false;}
 try{const res=await fetch('https://api.backblazeb2.com/',{signal:AbortSignal.timeout(8000)});r.internet=res.status>0;}catch{r.internet=false;}
 r.metadataBlocked=await blocked('169.254.169.254',80);
 r.companyBlocked=await blocked('172.30.77.2',4191);
 r.vpcBlocked=await blocked('10.77.0.3',22);
 r.companyDataHidden=hidden('/srv/synk/company');
 r.othersHidden=['api','keys','files'].filter(x=>x!==role).every(x=>hidden('/srv/synk/workbackup/'+x));
 r.etcSynkHidden=hidden('/etc/synk');
 try{const p=own+'/.box-probe';fs.writeFileSync(p,'x');fs.unlinkSync(p);r.ownWritable=true;}catch{r.ownWritable=false;}
 try{fs.writeFileSync('/opt/synk/x','x');r.systemReadOnly=false;}catch{r.systemReadOnly=true;}
 console.log(JSON.stringify(r));})();
"""


def probe(req, node):
    results = {}
    for name in SERVICES:
        role = name[len('synk-wb-'):-len('.service')]
        unit = render_unit(req, name, ROOT / 'app' / 'probe', node)
        args = ['systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec']
        for prop in service_props(unit):
            args += ['-p', prop]
        args += ['--', str(node), '-e', PROBE_JS, role]
        p = run(args, timeout=90, check=False)
        try:
            r = json.loads(p.stdout.strip().splitlines()[-1])
        except Exception:
            raise Refused('BOX_PROBE_NO_ANSWER:' + role + ':' + str(p.returncode))
        expected = {'uid': ROLES[role], 'dnsB2': True, 'dnsGoogle': True, 'internet': True, 'metadataBlocked': True, 'companyBlocked': True,
                    'vpcBlocked': True, 'companyDataHidden': True, 'othersHidden': True, 'etcSynkHidden': True, 'ownWritable': True, 'systemReadOnly': True}
        results[role] = r
        need(r == expected, 'BOX_PROBE_FAILED:' + role + ':' + ','.join(k for k in expected if r.get(k) != expected[k]))
    return results


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
    app = payload_files(req, 'app')
    manifest = ''.join(name + '\0' + sha(app[name]) + '\n' for name in sorted(app))
    off = payload_files(req, 'offsite')
    off_manifest = ''.join(name + '\0' + sha(off[name]) + '\n' for name in sorted(off))
    node = ROOT / 'runtime' / ('node-' + file_sha(HA_NODE)[:16])
    paths = ROOT / 'app' / sha(manifest.encode())[:16], node, ROOT / 'offsite' / sha(off_manifest.encode())[:16]
    for p in paths:
        need(p.exists(), 'NOT_INSTALLED:' + str(p))
    return paths


def wb_admin(req, app, node):
    """bin/wb-admin: admin.mjs as the api user inside the api's box, stdin passed through."""
    unit = render_unit(req, 'synk-wb-api.service', app, node)
    props = service_props(unit)
    lines = ['#!/bin/sh', '# Generated by wb-host.py: admin.mjs as uid 10771 in the api box (server/README.md 「운영 명령」).', 'set -eu',
             'exec systemd-run --quiet --wait --pipe --collect --service-type=exec \\']
    lines += ["  -p '" + p.replace("'", "'\\''") + "' \\" for p in props]
    lines += ['  -- ' + str(node) + ' ' + str(app) + '/admin.mjs "$@"', '']
    return '\n'.join(lines).encode()


def act_plan(req):
    r = {'mounted': os.path.ismount('/srv/synk'), 'companyActive': run(['systemctl', 'is-active', 'synk-company.service'], check=False).stdout.strip(),
         'haNodeSha': file_sha(HA_NODE), 'root': sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob('*')) if ROOT.exists() else None,
         'srv': sorted(str(p) for p in SRV.rglob('*') if 'secrets' not in p.parts or p.name == 'secrets') if SRV.exists() else None,
         'units': {n: run(['systemctl', 'show', n, '-p', 'LoadState,ActiveState,UnitFileState'], check=False).stdout.split() for n in (*SERVICES, *OFFSITE)},
         'company': company_identity(), 'mta': run(['ss', '-ltnpH', 'sport = :25'], check=False).stdout.strip()}
    return r


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
    write_atomic(ROOT / 'resolv.conf', resolv, 0o644)
    root_dir(ROOT / 'bin')
    write_atomic(ROOT / 'bin' / 'wb-admin', wb_admin(req, app, node), 0o755)
    made = folders()
    return {'node': str(node), 'nodeVersion': version, 'app': str(app), 'appNew': app_new, 'offsite': str(off), 'offsiteNew': off_new, 'madeFolders': made}


def act_probe(req):
    writer_node()
    app, node, off = installed(req)
    return {'probe': probe(req, node)}


def act_secrets(req):
    """Secret files 0600 owned by the role's uid. An existing different value is never replaced
    unless the request says so; the two RPC values must agree between the api and its worker."""
    writer_node()
    folders()
    sent = req['secrets']
    result = {}
    for pair, (a, b) in {'wb-keys-rpc': ('api', 'keys'), 'wb-files-rpc': ('api', 'files')}.items():
        pa, pb = SRV / a / 'secrets' / pair, SRV / b / 'secrets' / pair
        if pa.exists() or pb.exists():
            need(pa.exists() and pb.exists() and pa.read_bytes() == pb.read_bytes(), 'RPC_SECRET_SPLIT:' + pair)
            if not req.get('replace'):
                sent[a][pair] = sent[b][pair] = pa.read_text()
    for role, names in SECRET_NAMES.items():
        need(sorted(sent[role]) == sorted(names), 'SECRET_SET:' + role)
        for name in names:
            value = sent[role][name].encode()
            need(len(value) >= 32 and b'\n' not in value.strip(), 'SECRET_SHAPE:' + role + ':' + name)
            p = SRV / role / 'secrets' / name
            if p.exists():
                s = p.lstat()
                need(stat.S_ISREG(s.st_mode) and s.st_uid == ROLES[role] and stat.S_IMODE(s.st_mode) == 0o600, 'SECRET_FILE_UNSAFE:' + role + ':' + name)
                if p.read_bytes() == value:
                    result[role + '/' + name] = 'kept'
                    continue
                need(req.get('replace'), 'SECRET_DIFFERS:' + role + ':' + name)
            write_atomic(p, value, 0o600, ROLES[role])
            result[role + '/' + name] = 'written'
        settings = req['settings'][role].encode()
        need(all(re.fullmatch(r'WB_[A-Z0-9_]+=[^\n]*', line) and not line.startswith('WB_SECRET') for line in settings.decode().splitlines() if line and not line.startswith('#')), 'SETTINGS_SHAPE:' + role)
        write_atomic(SRV / role / 'settings.env', settings, 0o600, ROLES[role])
        result[role + '/settings.env'] = 'written'
    return {'files': result}


def act_start(req):
    writer_node()
    app, node, off = installed(req)
    for role in ROLES:
        for name in SECRET_NAMES[role] + ('settings.env',):
            p = SRV / role / ('secrets/' + name if name != 'settings.env' else name)
            need(p.exists() and p.lstat().st_uid == ROLES[role], 'NOT_PROVISIONED:' + role + ':' + name)
    before = company_identity()
    units = {n: render_unit(req, n, app, node, off) for n in (*SERVICES, *OFFSITE)}
    changed = []
    for name, text in units.items():
        p = UNIT_DIR / name
        if not p.exists() or p.read_bytes() != text:
            write_atomic(p, text, 0o644)
            changed.append(name)
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'enable', *SERVICES, 'synk-wb-offsite.timer'])
    run(['systemctl', 'restart' if req.get('restart') else 'start', *SERVICES], timeout=120)
    body = health()
    run(['systemctl', 'start', 'synk-wb-offsite.timer'])
    reach = reachability()
    after = company_identity()
    need(before == after, 'COMPANY_CONTAINERS_CHANGED')
    return {'changedUnits': changed, 'health': body, 'active': {n: run(['systemctl', 'is-active', n], check=False).stdout.strip() for n in (*SERVICES, *OFFSITE)},
            'companyUnchanged': True, 'company': after, 'reach': reach}


def act_status(req):
    r = {'active': {n: run(['systemctl', 'is-active', n], check=False).stdout.strip() for n in (*SERVICES, *OFFSITE)},
         'listen': run(['ss', '-ltnH', '( sport = :4210 or sport = :4211 or sport = :4212 )'], check=False).stdout.strip().splitlines(),
         'company': company_identity()}
    try:
        r['health'] = health(timeout=5)
    except Refused as e:
        r['health'] = str(e)
    marker = pathlib.Path('/var/lib/synk-wb-offsite/last.json')
    r['offsite'] = json.loads(marker.read_text()) if marker.exists() else None
    for name in SERVICES:
        r.setdefault('memory', {})[name] = run(['systemctl', 'show', name, '-p', 'MemoryCurrent,NRestarts,ActiveEnterTimestamp'], check=False).stdout.split('\n')
    return r


def act_stop(req):
    run(['systemctl', 'disable', '--now', 'synk-wb-offsite.timer', *SERVICES], timeout=120)
    return {'active': {n: run(['systemctl', 'is-active', n], check=False).stdout.strip() for n in (*SERVICES, *OFFSITE)}}


ACTIONS = {'plan': act_plan, 'files': act_files, 'probe': act_probe, 'secrets': act_secrets, 'start': act_start, 'status': act_status, 'stop': act_stop}


def main():
    need(os.geteuid() == 0, 'ROOT_REQUIRED')
    req = globals().get('REQUEST')
    need(isinstance(req, dict) and req.get('action') in ACTIONS, 'REQUEST_INVALID')
    return {'action': req['action'], 'result': ACTIONS[req['action']](req)}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Refused as e:
        print(json.dumps({'error': str(e)}))
    except Exception as e:
        print(json.dumps({'error': 'UNEXPECTED_' + type(e).__name__}))
