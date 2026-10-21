"""Mock command responses only: no cloud, Docker, mounts, or systemd operations."""
import contextlib,copy,importlib.util,json,pathlib,sys,unittest
from collections import Counter
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
host=load('optimized_host',HERE/'node-host.py')
def configuration(h):
    return {'activationAllowed':True,'units':list(h.UNITS),'guardFiles':[{'path':'fixture','sha256':'fixture'}]*3,'containers':[{'name':name,'imageId':'sha256:'+str(i+1)*64} for i,name in enumerate(h.CONTAINERS)]}
def containers(c,running=True):
    return [{'Name':'/'+x['name'],'Image':x['imageId'],'State':{'Running':running,'Paused':False,'Restarting':False,'Dead':False,'Health':{'Status':'healthy'}},'HostConfig':{'RestartPolicy':{'Name':'no'}}} for x in c['containers']]
def guard(h):return '{ path='+h.NODE+' ; argv[]='+' '.join((h.NODE,h.AGENT,'--check-start',h.CONFIG))+' ; ignore_errors=no ; }'
def unit_output(h,units,properties,active='inactive'):
    return '\n\n'.join('\n'.join(k+'='+{'Id':u,'LoadState':'loaded','ExecStartPre':guard(h),'ActiveState':active}[k] for k in properties) for u in units)
class BatchTests(unittest.TestCase):
    def query(self,raw):
        with patch.object(host,'run',return_value=raw):return host.unit_properties(host.GUARDED_UNITS,('ExecStartPre',))
    def valid(self):return unit_output(host,host.GUARDED_UNITS,('Id','LoadState','ExecStartPre'))
    def test_exact_ids_are_mapped_without_trusting_order(self):
        raw='\n\n'.join(reversed(self.valid().split('\n\n')))
        self.assertEqual(set(self.query(raw)),set(host.GUARDED_UNITS))
    def test_missing_duplicate_unknown_and_partial_records_rejected(self):
        valid=self.valid();blocks=valid.split('\n\n')
        cases=[valid.rsplit('\n\n',1)[0],valid+'\n\n'+blocks[0],valid.replace('Id='+host.GUARDED_UNITS[0],'Id=other.service',1),valid.replace('LoadState=loaded\n','',1),'',valid+'\nId=another.service',valid.replace('LoadState=loaded','LoadState=loaded\nLoadState=loaded',1)]
        for raw in cases:
            with self.subTest(raw=raw[:70]),self.assertRaises(host.Rejected):self.query(raw)
    def test_any_unit_load_failure_rejected(self):
        for state in ['not-found','error','masked','']:
            with self.subTest(state=state),self.assertRaisesRegex(host.Rejected,'UNIT_NOT_LOADED'):self.query(self.valid().replace('LoadState=loaded','LoadState='+state,1))
    def test_repeated_exec_start_pre_preserves_all_commands_in_order(self):
        setup='{ path=/usr/bin/test ; argv[]=/usr/bin/test -e /run/fixture ; ignore_errors=no ; }'
        c=configuration(host)
        for commands in ([setup,guard(host)],[guard(host),setup]):
            raw=self.valid().replace('Id=synk-spaceship.service\nLoadState=loaded\nExecStartPre='+guard(host),'Id=synk-spaceship.service\nLoadState=loaded\n'+'\n'.join('ExecStartPre='+x for x in commands),1)
            self.assertEqual(self.query(raw)['synk-spaceship.service']['ExecStartPre'],commands)
            with patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',return_value=raw),patch.object(host,'inspect_containers',return_value=[]):host.check_guards(c)
    def test_repeated_command_cannot_hide_ignored_guard_or_missing_exact_argv(self):
        c=configuration(host)
        setup='{ path=/usr/bin/test ; argv[]=/usr/bin/test -e /run/fixture ; ignore_errors=no ; }'
        bad=[setup+'\nExecStartPre='+guard(host).replace('ignore_errors=no','ignore_errors=yes'),guard(host)+'\nExecStartPre='+setup.replace('ignore_errors=no','ignore_errors=yes'),setup+'\nExecStartPre='+guard(host).replace('argv[]=','argv[]=prefix ')]
        for commands in bad:
            raw=self.valid().replace('ExecStartPre='+guard(host),'ExecStartPre='+commands,1)
            with self.subTest(commands=commands),patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',return_value=raw),self.assertRaises(host.Rejected):host.check_guards(c)
    def test_array_exception_never_allows_duplicate_scalar_properties(self):
        for prop,value in [('Id',host.GUARDED_UNITS[0]),('LoadState','loaded')]:
            raw=self.valid().replace(prop+'='+value,prop+'='+value+'\n'+prop+'='+value,1)
            with self.subTest(prop=prop),self.assertRaisesRegex(host.Rejected,'UNIT_PROPERTIES_SHAPE'):self.query(raw)
        raw=unit_output(host,host.GUARDED_UNITS,('Id','LoadState','ActiveState')).replace('ActiveState=inactive','ActiveState=inactive\nActiveState=inactive',1)
        with patch.object(host,'run',return_value=raw),self.assertRaisesRegex(host.Rejected,'UNIT_PROPERTIES_SHAPE'):host.unit_properties(host.GUARDED_UNITS,('ActiveState',))
    def test_one_missing_or_ignored_guard_cannot_hide_in_good_units(self):
        c=configuration(host)
        for change in [lambda s:s.replace(guard(host),'',1),lambda s:s.replace('ignore_errors=no','ignore_errors=yes',1)]:
            with patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',return_value=change(self.valid())),self.assertRaises(host.Rejected):host.check_guards(c)
    def test_one_docker_snapshot_checks_health_and_restart_policy(self):
        c=configuration(host);seen=[]
        def run(args,*a,**kw):
            seen.append(args)
            if args[:2]==['systemctl','show']:return self.valid()
            if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS)
            if args[:2]==['docker','inspect']:return json.dumps(containers(c))
            if args[:2]==['docker','exec']:return '{"ready":true}'
            raise AssertionError(args)
        with patch.object(host,'check_mount'),patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',run),patch.object(host,'durable_probe'),patch.object(host,'database_writable'):
            self.assertTrue(host.durable_health(c)['durableHealthOk'])
        self.assertEqual(sum(a[:2]==['docker','inspect'] for a in seen),1)
        self.assertEqual(sum(a[:2]==['systemctl','show'] for a in seen),1)
    def test_health_snapshot_preserves_missing_and_restart_rejections(self):
        c=configuration(host)
        for missing in [True,False]:
            def run(args,*a,**kw):
                if args[:2]==['systemctl','show']:return self.valid()
                if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS[:-1] if missing else host.CONTAINERS)
                if args[:2]==['docker','inspect']:
                    v=containers(c);v[0]['HostConfig']['RestartPolicy']['Name']='always';return json.dumps(v)
                raise AssertionError(args)
            with self.subTest(missing=missing),patch.object(host,'check_mount'),patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',run),self.assertRaisesRegex(host.Rejected,'CONTAINER_MISSING' if missing else 'DOCKER_RESTART_BYPASS'):host.durable_health(c)
    def test_stop_reads_fresh_all_unit_states_after_mutation_boundary(self):
        c=configuration(host);seen=[]
        def run(args,*a,**kw):
            seen.append(args)
            if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS)
            if args[:2]==['docker','inspect']:return json.dumps(containers(c,False))
            if args[:2]==['systemctl','show']:
                self.assertIn(['docker','stop','--time','60',*host.CONTAINERS],seen)
                units=[x for x in args[2:] if not x.startswith('--')]
                return unit_output(host,units,('Id','LoadState','ActiveState')).replace('ActiveState=inactive','ActiveState=activating',1)
            return ''
        with patch.object(host,'run',run),self.assertRaisesRegex(host.Rejected,'UNIT_STOP_NOT_CONFIRMED'):host.stop_stack(c)
        self.assertEqual(sum(a[:2]==['systemctl','show'] for a in seen),1)

def count_commands(h,role,has_retained_containers=True):
    c=configuration(h);seen=[]
    def run(args,*a,**kw):
        seen.append(args)
        if args[:2]==['systemctl','show']:
            fields=next(x.split('=',1)[1].split(',') for x in args if x.startswith('--property='))
            units=[x for x in args[2:] if not x.startswith('--')]
            if '--value' in args:return 'inactive'
            return unit_output(h,units,fields)
        if args[:2]==['docker','ps']:return '\n'.join(h.CONTAINERS) if has_retained_containers else ''
        if args[:2]==['docker','inspect']:return json.dumps(containers(c,role=='owner'))
        if args[:2]==['docker','exec']:return '{"ready":true}'
        return ''
    with patch.object(h,'run',run),patch.object(h,'protected'),patch.object(h,'digest',return_value='fixture'),patch.object(h,'check_mount',side_effect=lambda c:run(['findmnt','mock-current-mount'])),patch.object(h,'durable_probe'),patch.object(h,'database_writable'):
        h.check_guards(c)
        if role=='owner':h.durable_health(c)
        else:h.stop_stack(c)
    return {'total':len(seen),'commands':dict(Counter(' '.join(x[:2]) for x in seen))}

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--measure':
        original=load('original_host',pathlib.Path(sys.argv[2]).resolve())
        cases={name:{'before':count_commands(original,role,retained),'candidate':count_commands(host,role,retained)} for name,role,retained in [('owner-normal-tick','owner',True),('standby-retained-stopped','standby',True),('standby-no-containers','standby',False)]}
        print(json.dumps({'scope':'synthetic subprocess call count; no CPU or remote performance claim','cases':cases},indent=2))
    else:unittest.main(verbosity=2)
