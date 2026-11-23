"""python host/wb-host.test.py — the unit rendering and box arguments, no root, no systemd."""
import base64, importlib.util, json, pathlib, subprocess, unittest

here = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('wb_host', here / 'wb-host.py')
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)

def request():
    out = subprocess.run(['node', '--input-type=module', '-e', "import {payload} from './tools/host-install.mjs'; console.log(JSON.stringify({action:'plan',payload:payload()}))"],
                         cwd=here.parent, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

class Units(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.req = request()
    def unit(self, name): return M.render_unit(self.req, name, pathlib.PurePosixPath('/opt/synk/workbackup/app/aaaa'), pathlib.PurePosixPath('/opt/synk/workbackup/runtime/node-bbbb'), pathlib.PurePosixPath('/opt/synk/workbackup/offsite/cccc')).decode()
    def test_services_carry_the_box_and_their_own_place(self):
        for role, uid, port, host in (('api', 10771, 4210, '172.30.77.9'), ('keys', 10772, 4211, '127.0.0.1'), ('files', 10773, 4212, '127.0.0.1')):
            u = self.unit(f'synk-wb-{role}.service')
            self.assertIn(f'User={uid}\n', u); self.assertIn(f'Group={uid}\n', u)
            self.assertIn(f'WB_PORT={port} WB_HOST={host}', u)
            self.assertIn(f'BindPaths=/srv/synk/workbackup/{role}\n', u); self.assertIn(f'ReadWritePaths=/srv/synk/workbackup/{role}\n', u)
            self.assertIn('TemporaryFileSystem=/srv/synk:ro', u); self.assertIn('IPAddressDeny=127.0.0.0/8 ::1/128 169.254.0.0/16', u)
            self.assertIn('ExecStart=/opt/synk/workbackup/runtime/node-bbbb /opt/synk/workbackup/app/aaaa/main.mjs ' + role, u)
            for line in ('Requisite=synk-company.service', 'PartOf=synk-company.service', 'WantedBy=synk-company.service', 'TimeoutStopSec=10', 'KillMode=control-group', 'Restart=on-failure'):
                self.assertIn(line + '\n', u)
            self.assertNotIn('@', u.replace('@system-service', ''))
            for other in {'api', 'keys', 'files'} - {role}: self.assertNotIn(f'/srv/synk/workbackup/{other}', u)
        self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32 172.30.77.8/29\n', self.unit('synk-wb-api.service'))
        for role in ('keys', 'files'): self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32\n', self.unit(f'synk-wb-{role}.service'))
    def test_offsite_unit_and_timer(self):
        u = self.unit('synk-wb-offsite.service'); self.assertIn('ExecStart=/usr/bin/python3 -I -B /opt/synk/workbackup/offsite/cccc/wb-offsite.py', u)
        self.assertIn('CapabilityBoundingSet=CAP_DAC_READ_SEARCH', u); self.assertIn('TimeoutStopSec=10' + chr(10), u)
        t = self.unit('synk-wb-offsite.timer'); self.assertIn('OnCalendar=*-*-* 20:40:00 UTC', t)
    def test_run_properties_match_the_unit(self):
        props = M.service_props(self.unit('synk-wb-api.service').encode())
        self.assertIn('User=10771', props); self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32 172.30.77.8/29', props)
        for skipped in M.RUN_SKIP: self.assertFalse(any(p.startswith(skipped + '=') for p in props), skipped)
        self.assertTrue(all('=' in p for p in props))
        # The transient runs keep the company dependencies, so wb-admin starts only beside the company and stops with it.
        for line in ('StopPropagatedFrom=synk-company.service', 'RequiresMountsFor=/srv/synk'): self.assertIn(line, props)
        self.assertFalse(any(p.startswith(('PartOf=', 'Requisite=')) for p in props))
        self.assertTrue(any(p.startswith('After=synk-company.service') for p in props))
        for line in ('TimeoutStopSec=10', 'KillMode=control-group'): self.assertIn(line, props)
        for absent in ('WantedBy=', 'ConditionPathIsMountPoint=', 'StartLimitBurst=', 'Description='): self.assertFalse(any(p.startswith(absent) for p in props), absent)
    def test_rpc_signature_is_the_workers(self):
        js = "import crypto from 'node:crypto'; const [s,ts,id,m,b]=process.argv.slice(1); const sha=crypto.createHash('sha256').update(b).digest('hex'); console.log(crypto.createHmac('sha256', s).update(`wb-rpc/v1\n${ts}\n${id}\n${m}\n${sha}`).digest('base64url'))"
        body = '{"method":"wb.handshake","params":{}}'
        want = subprocess.run(['node', '--input-type=module', '-e', js, 'a' * 64, '1795400000000', 'AbCdEfGhIjKlMnOpQrStUvWx', 'wb.handshake', body], capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(M.rpc_sign('a' * 64, '1795400000000', 'AbCdEfGhIjKlMnOpQrStUvWx', 'wb.handshake', body.encode()), want)
    def test_destination_bucket(self):
        import hashlib
        self.assertEqual(M.bucket_sha('A=1\nSYNK_BACKUP_GCS_DESTINATION="gs://abc-def/company/production"\n'), hashlib.sha256(b'abc-def').hexdigest())
        for bad in ('', 'SYNK_BACKUP_GCS_DESTINATION=gs://a/x\nSYNK_BACKUP_GCS_DESTINATION=gs://b/x\n', 'SYNK_BACKUP_GCS_DESTINATION=s3://abc/x\n'):
            with self.assertRaises(M.Refused): M.bucket_sha(bad)
    def test_api_checks_its_pairs_before_every_start(self):
        u = self.unit('synk-wb-api.service')
        self.assertIn('ExecStartPre=+/usr/bin/python3 -I -B /opt/synk/workbackup/offsite/cccc/wb-pair-check.py' + chr(10), u)
        self.assertEqual(sorted(self.req['payload']['offsite']), sorted(M.ROOT_TOOLS))
    def test_sudo_input_logging_is_read_conservatively(self):
        self.assertFalse(M.sudoers_log_input('Defaults env_reset\nDefaults !log_input\n# Defaults log_input\n'))
        for on in ('Defaults log_input', 'Defaults:synk log_input', 'Defaults>root log_stdin', 'Defaults!/usr/bin/python3 log_input',
                   'Defaults log_input\nDefaults:root !log_input', 'Defaults   env_reset,log_input'):
            self.assertTrue(M.sudoers_log_input(on), on)
    def test_admin_wrapper_uses_the_api_box(self):
        w = M.wb_admin(self.req, pathlib.PurePosixPath('/opt/synk/workbackup/app/aaaa'), pathlib.PurePosixPath('/opt/synk/workbackup/runtime/node-bbbb')).decode()
        self.assertIn("-p 'User=10771'", w); self.assertIn("-p 'TemporaryFileSystem=/srv/synk:ro'", w)
        self.assertNotIn('Requisite=', w); self.assertIn("-p 'StopPropagatedFrom=synk-company.service'", w); self.assertNotIn('PartOf=', w)
        self.assertTrue(w.rstrip().endswith('/opt/synk/workbackup/app/aaaa/admin.mjs "$@"'))
        self.assertIn('--pipe', w)
        self.assertIn("-p 'ExecStartPre=+/usr/bin/systemctl is-active --quiet synk-company.service'", w)
        self.assertIn("-p 'ExecStartPre=+/usr/bin/mountpoint -q /srv/synk'", w)

if __name__ == '__main__': unittest.main()
