#!/usr/bin/env python3
"""Run pinned, signature-verified PostgreSQL clients without a Docker container."""
import hashlib,json,os,pathlib,sys
try:
 name=sys.argv[1]
 assert name in ('pg_dump','pg_restore','psql')
 manifest=json.loads(pathlib.Path('/etc/synk-server-backup/pg17-client-manifest.json').read_text())
 root=pathlib.Path('/opt/synk-server-backup/pg17')
 assert manifest['root']==str(root) and manifest['signatureVerified']
 binary=root/'usr/lib/postgresql/17/bin'/name
 entry=next(x for x in manifest['binaries'] if x['name']==name)
 assert hashlib.sha256(binary.read_bytes()).hexdigest()==entry['sha256']
 env=dict(os.environ,LD_LIBRARY_PATH=str(root/'usr/lib/x86_64-linux-gnu'),PGPASSFILE='/etc/synk-server-backup/pgpass',PGSSLMODE='require',PGCONNECT_TIMEOUT='20',PGAPPNAME='synk-server-backup-readonly',PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=900000')
 os.execve(str(binary),[str(binary)]+sys.argv[2:],env)
except Exception:
 print('NATIVE_PG_CLIENT_FAILED',file=sys.stderr)
 sys.exit(1)
