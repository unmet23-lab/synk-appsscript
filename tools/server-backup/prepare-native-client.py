import pathlib,subprocess,urllib.request,tempfile,hashlib,json,gzip,os,re,shutil
base='https://apt.postgresql.org/pub/repos/apt/'
work=pathlib.Path(tempfile.mkdtemp(prefix='pg17-client-',dir='/var/lib/synk-server-backup'))
def fetch(url):
 with urllib.request.urlopen(url,timeout=60) as r:return r.read(20*1024*1024)
def run(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=60)
 assert p.returncode==0,'CLIENT_COMMAND_FAILED '+args[0]
 return p.stdout
try:
 key=work/'repo.asc';key.write_bytes(fetch('https://www.postgresql.org/media/keys/ACCC4CF8.asc'))
 ring=work/'repo.gpg';run(['gpg','--batch','--dearmor','--output',str(ring),str(key)])
 release=work/'InRelease';release.write_bytes(fetch(base+'dists/bookworm-pgdg/InRelease'))
 run(['gpgv','--keyring',str(ring),str(release)])
 fields=release.read_text();entry='main/binary-amd64/Packages.gz';section=fields.split('SHA256:\n',1)[1].split('\n\n',1)[0];match=re.search(r'^ ([a-f0-9]{64})\s+(\d+)\s+'+re.escape(entry)+r'$',section,re.M);assert match,'SIGNED_INDEX_MISSING'
 packed=fetch(base+'dists/bookworm-pgdg/'+entry);assert len(packed)==int(match[2]) and hashlib.sha256(packed).hexdigest()==match[1],'INDEX_HASH_MISMATCH'
 rows=[]
 for paragraph in gzip.decompress(packed).decode().split('\n\n'):
  row=dict(line.split(': ',1) for line in paragraph.splitlines() if ': ' in line and not line.startswith(' '))
  if row.get('Package') in ('postgresql-client-17','libpq5') and row.get('Architecture')=='amd64':rows.append(row)
 chosen=[]
 for package in ('postgresql-client-17','libpq5'):
  found=[r for r in rows if r['Package']==package];assert found,'PACKAGE_MISSING';chosen.append(found[0])
 root=work/'root';root.mkdir()
 for row in chosen:
  body=fetch(base+row['Filename']);assert len(body)==int(row['Size']) and hashlib.sha256(body).hexdigest()==row['SHA256'],'PACKAGE_HASH_MISMATCH';f=work/(row['Package']+'.deb');f.write_bytes(body);run(['dpkg-deb','-x',str(f),str(root)])
 lib=root/'usr/lib/x86_64-linux-gnu';env=dict(os.environ,LD_LIBRARY_PATH=str(lib));missing=set()
 for executable in ('pg_dump','pg_restore','psql'):
  r=subprocess.run(['ldd',str(root/'usr/lib/postgresql/17/bin'/executable)],env=env,capture_output=True,text=True,timeout=20)
  missing.update(re.findall(r'^\s*(\S+) => not found',r.stdout,re.M))
 assert not missing,'CLIENT_LIBS_MISSING '+','.join(sorted(missing))
 dest=pathlib.Path('/opt/synk-server-backup/pg17');assert not dest.exists(),'CLIENT_ALREADY_EXISTS';root.rename(dest)
 proof={'source':'https://apt.postgresql.org/pub/repos/apt/','distribution':'bookworm-pgdg','signatureVerified':True,'signedIndexSha256':match[1],'packages':[{'name':r['Package'],'version':r['Version'],'sha256':r['SHA256'],'bytes':int(r['Size'])} for r in chosen],'root':str(dest),'noDatabaseServerInstalled':True,'noContainerCreated':True,'noGlobalPackageSourceChanged':True,'binaries':[]}
 for executable in ('pg_dump','pg_restore','psql'):
  p=dest/'usr/lib/postgresql/17/bin'/executable;r=subprocess.run([str(p),'--version'],env=dict(os.environ,LD_LIBRARY_PATH=str(dest/'usr/lib/x86_64-linux-gnu')),capture_output=True,text=True,timeout=10);assert r.returncode==0,'CLIENT_VERSION_FAILED';proof['binaries'].append({'name':executable,'version':r.stdout.strip(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 pathlib.Path('/etc/synk-server-backup/pg17-client-manifest.json').write_text(json.dumps(proof,indent=2));os.chmod('/etc/synk-server-backup/pg17-client-manifest.json',0o600)
 print(json.dumps(proof))
finally:
 assert work.parent==pathlib.Path('/var/lib/synk-server-backup') and work.name.startswith('pg17-client-')
 shutil.rmtree(work)
