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
            self.assertIn('TemporaryFileSystem=/srv/synk:ro', u); self.assertIn('IPAddressDeny=169.254.0.0/16', u)
            self.assertIn('ExecStart=/opt/synk/workbackup/runtime/node-bbbb /opt/synk/workbackup/app/aaaa/main.mjs ' + role, u)
            for line in ('Requisite=synk-company.service', 'PartOf=synk-company.service', 'WantedBy=synk-company.service', 'TimeoutStopSec=10', 'KillMode=control-group', 'Restart=on-failure'):
                self.assertIn(line + '\n', u)
            self.assertNotIn('@', u.replace('@system-service', ''))
            for other in {'api', 'keys', 'files'} - {role}: self.assertNotIn(f'/srv/synk/workbackup/{other}', u)
        self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32 172.30.77.8/29\n', self.unit('synk-wb-api.service'))
        for role in ('keys', 'files'): self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32\n', self.unit(f'synk-wb-{role}.service'))
    def test_offsite_unit_and_timer(self):
        u = self.unit('synk-wb-offsite.service'); self.assertIn('ExecStart=/usr/bin/python3 -I -B /opt/synk/workbackup/offsite/cccc/wb-offsite.py', u)
        self.assertIn('CapabilityBoundingSet=CAP_DAC_READ_SEARCH', u)
        t = self.unit('synk-wb-offsite.timer'); self.assertIn('OnCalendar=*-*-* 20:40:00 UTC', t)
    def test_run_properties_match_the_unit(self):
        props = M.service_props(self.unit('synk-wb-api.service').encode())
        self.assertIn('User=10771', props); self.assertIn('IPAddressAllow=127.0.0.1/32 127.0.0.53/32 172.30.77.8/29', props)
        for skipped in M.RUN_SKIP: self.assertFalse(any(p.startswith(skipped + '=') for p in props), skipped)
        self.assertTrue(all('=' in p for p in props))
    def test_admin_wrapper_uses_the_api_box(self):
        w = M.wb_admin(self.req, pathlib.PurePosixPath('/opt/synk/workbackup/app/aaaa'), pathlib.PurePosixPath('/opt/synk/workbackup/runtime/node-bbbb')).decode()
        self.assertIn("-p 'User=10771'", w); self.assertIn("-p 'TemporaryFileSystem=/srv/synk:ro'", w)
        self.assertTrue(w.rstrip().endswith('/opt/synk/workbackup/app/aaaa/admin.mjs "$@"'))
        self.assertIn('--pipe', w)

if __name__ == '__main__': unittest.main()
