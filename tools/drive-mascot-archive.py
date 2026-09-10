"""SYNK original asset archive: pack, remotely verify, reclaim, restore.

Only the explicitly inventoried clothing originals are in scope. AVIF runtime
assets and JSON metadata stay local. Archives are uploaded through Drive's UI.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import zipfile

REPO = Path(__file__).resolve().parents[1]
OPS = REPO / 'docs/_ops/마스코트_Drive이관_20260910'
SOURCE = REPO / 'docs/Loom_자산/옷'
STAGE = OPS / 'transfer'
REMOTE = Path('G:/내 드라이브/SYNK/대용량 자산/마스코트/20260910')

def read(p):
    return json.loads(p.read_text(encoding='utf-8'))

def write_new(p, data):
    with p.open('x', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())

def digest(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def source_path(relative):
    p = SOURCE / relative
    if p.resolve().parent != SOURCE.resolve() and SOURCE.resolve() not in p.resolve().parents:
        raise ValueError('Source escapes original asset directory')
    if '..' in Path(relative).parts or Path(relative).is_absolute():
        raise ValueError('Unsafe member path')
    for ancestor in [p, *p.parents]:
        if ancestor == SOURCE.parent:
            break
        if ancestor.exists() and ancestor.lstat().st_file_attributes & 1024:
            raise ValueError('Reparse point in local source path')
    return p

def plan():
    p = OPS / 'pack-plan.json'
    if p.exists():
        return read(p)
    m = read(OPS / '옷_manifest.json')
    first = read(OPS / 'mascot-0001.json')
    used = {r['path'] for r in first['files']}
    keep = [r for r in m['files'] if '_avif/' in r['path'] or not r['path'].lower().endswith(('.png','.jpg','.jpeg','.webp'))]
    excluded = {r['path'] for r in keep} | used
    order = {'GPT_표정_누끼_틀': 0, 'GPT_표정_누끼': 1, 'GPT_표정': 2}
    rows = sorted((r for r in m['files'] if r['path'] not in excluded),
                  key=lambda r: (order.get(r['path'].split('/')[0],3),r['path']))
    packs = [dict(number=1, files=first['files'])]
    batch=[]; size=0
    for r in rows:
        if batch and size+r['bytes'] > 384*1024*1024:
            packs.append(dict(number=len(packs)+1,files=batch));batch=[];size=0
        batch.append(r);size+=r['bytes']
    if batch:
        packs.append(dict(number=len(packs)+1,files=batch))
    data = dict(source=str(SOURCE),remote=str(REMOTE),packs=packs,keep_local=keep)
    write_new(p,data)
    return data

def pack(number):
    data=plan(); rows=data['packs'][number-1]['files']
    name=f'mascot-{number:04}.zip'; output=STAGE/name
    receipt=OPS/f'mascot-{number:04}.json'
    if receipt.exists():
        print(json.dumps(dict(number=number,status='already-packed')),flush=True);return
    needed=sum(r['bytes'] for r in rows)+512*1024*1024
    if shutil.disk_usage(REPO).free < needed:
        raise RuntimeError('Insufficient staging headroom; verify/reclaim uploaded packs first')
    STAGE.mkdir(exist_ok=True)
    if output.exists():
        raise RuntimeError('Unreceipted staging archive already exists: '+name)
    temporary=output.with_name(output.name+f'.pack-{os.getpid()}.part')
    try:
        with zipfile.ZipFile(temporary,'x',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
            for r in rows:
                src=source_path(r['path'])
                if src.stat().st_mtime_ns != r['mtime_ns'] or src.stat().st_size != r['bytes']:
                    raise RuntimeError('Source changed before archive: '+r['path'])
                z.write(src,r['path'])
            z.writestr('MANIFEST.json',json.dumps(dict(source=str(SOURCE),files=rows),ensure_ascii=False))
        with zipfile.ZipFile(temporary) as z:
            for r in rows:
                with z.open(r['path']) as f:
                    if hashlib.file_digest(f,'sha256').hexdigest()!=r['sha256']:
                        raise RuntimeError('Archive member hash mismatch')
        os.link(temporary,output)
    finally:
        if temporary.exists():temporary.unlink()
    result=dict(archive=name,bytes=output.stat().st_size,sha256=digest(output),files=rows)
    write_new(receipt,result)
    print(json.dumps(dict(number=number,status='packed',files=len(rows),bytes=result['bytes'])),flush=True)

def reclaim(number):
    receipt=read(OPS/f'mascot-{number:04}.json')
    remote=REMOTE/receipt['archive']
    if not remote.exists() or remote.stat().st_size!=receipt['bytes']:
        raise RuntimeError('Cloud archive absent or size incomplete')
    # This archive was sent by browser, never copied into the local Drive cache.
    # Reading G: therefore verifies the server-returned archive bytes.
    if digest(remote)!=receipt['sha256']:
        raise RuntimeError('Remote archive hash mismatch; preserve all sources')
    audit=OPS/f'mascot-{number:04}-reclaimed.jsonl'
    freed=0; changed=[]
    with audit.open('a',encoding='utf-8') as f:
        f.write(json.dumps(dict(event='remote-sha256-verified',archive=receipt['archive'],sha256=receipt['sha256']))+'\n');f.flush();os.fsync(f.fileno())
        for r in receipt['files']:
            src=source_path(r['path'])
            if not src.exists():
                continue
            before=src.stat()
            if before.st_size!=r['bytes'] or before.st_mtime_ns!=r['mtime_ns'] or digest(src)!=r['sha256']:
                changed.append(r['path'])
                f.write(json.dumps(dict(event='changed-preserved',path=r['path']),ensure_ascii=False)+'\n');f.flush()
                continue
            after=src.stat()
            if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
                changed.append(r['path'])
                f.write(json.dumps(dict(event='changed-preserved',path=r['path']),ensure_ascii=False)+'\n');f.flush()
                continue
            # Commit the recovery location before removing the validated local copy.
            f.write(json.dumps(dict(event='source-verified',path=r['path'],sha256=r['sha256']),ensure_ascii=False)+'\n');f.flush();os.fsync(f.fileno())
            src.unlink()
            freed+=r['bytes']
            f.write(json.dumps(dict(event='reclaimed',path=r['path'],bytes=r['bytes']),ensure_ascii=False)+'\n');f.flush()
        f.write(json.dumps(dict(event='reclaim-complete',reclaimed_bytes=freed,
                                changed_preserved=changed),ensure_ascii=False)+'\n');f.flush()
        os.fsync(f.fileno())
    local=STAGE/receipt['archive']
    if local.exists() and digest(local)==receipt['sha256']:
        local.unlink()
    print(json.dumps(dict(number=number,remote_verified=True,reclaimed_bytes=freed,changed_preserved=changed,free_bytes=shutil.disk_usage(REPO).free),ensure_ascii=True),flush=True)

def reclaim_complete(number):
    """Accept sealed audits, or prove a legacy audit has no exact source left."""
    audit=OPS/f'mascot-{number:04}-reclaimed.jsonl'
    receipt_path=OPS/f'mascot-{number:04}.json'
    if not audit.exists() or not receipt_path.exists():
        return False
    events=[json.loads(line) for line in audit.read_text(encoding='utf-8').splitlines() if line.strip()]
    if any(event.get('event')=='reclaim-complete' for event in events):
        return True
    if not any(event.get('event')=='remote-sha256-verified' for event in events):
        return False
    for row in read(receipt_path)['files']:
        src=source_path(row['path'])
        if not src.exists():
            continue
        before=src.stat()
        if before.st_size!=row['bytes'] or before.st_mtime_ns!=row['mtime_ns']:
            continue
        if digest(src)==row['sha256']:
            return False
    return True

def archive_rows():
    """Yield each archived source row together with its numbered ZIP."""
    for item in plan()['packs']:
        for row in item['files']:
            yield item['number'], row

def restore_rows(rows):
    """Restore missing rows without overwriting any current local work."""
    missing=[]
    for number,row in rows:
        target=source_path(row['path'])
        if not target.exists():
            missing.append((number,row))
    needed=sum(row['bytes'] for _,row in missing)
    if needed and shutil.disk_usage(REPO).free < needed+512*1024*1024:
        raise RuntimeError('Insufficient local space to restore requested originals')
    by_archive={}
    for number,row in missing:
        by_archive.setdefault(number,[]).append(row)
    restored=0;restored_files=0
    for number in sorted(by_archive):
        receipt=read(OPS/f'mascot-{number:04}.json')
        remote=REMOTE/receipt['archive']
        if not remote.exists() or remote.stat().st_size!=receipt['bytes']:
            raise RuntimeError('Cloud archive absent or size incomplete')
        with zipfile.ZipFile(remote) as z:
            for row in by_archive[number]:
                target=source_path(row['path'])
                if target.exists():
                    continue
                target.parent.mkdir(parents=True,exist_ok=True)
                temporary=target.with_name(target.name+f'.restore-{os.getpid()}.part')
                hasher=hashlib.sha256()
                try:
                    with z.open(row['path']) as source, temporary.open('xb') as output:
                        for block in iter(lambda:source.read(4*1024*1024),b''):
                            output.write(block);hasher.update(block)
                        output.flush();os.fsync(output.fileno())
                    if hasher.hexdigest()!=row['sha256'] or temporary.stat().st_size!=row['bytes']:
                        raise RuntimeError('Remote member hash mismatch: '+row['path'])
                    os.utime(temporary,ns=(row['mtime_ns'],row['mtime_ns']))
                    # An exclusive hard link preserves a file another process created meanwhile.
                    os.link(temporary,target)
                    restored+=row['bytes']
                    restored_files+=1
                except FileExistsError:
                    pass
                finally:
                    if temporary.exists():temporary.unlink()
    return dict(restored_files=restored_files,restored_bytes=restored,requested_files=len(rows))

def restore(relative):
    match=next(((number,row) for number,row in archive_rows() if row['path']==relative),None)
    if match is None:
        raise ValueError('Asset not in archive plan')
    target=source_path(relative)
    if target.exists():
        print(json.dumps(dict(status='local-exists',matches=digest(target)==match[1]['sha256'])));return
    result=restore_rows([match])
    print(json.dumps(dict(status='restored',path=str(target),sha256=match[1]['sha256'],
                               bytes=result['restored_bytes']),ensure_ascii=True))

def restore_many(relatives):
    wanted=set(relatives)
    matches=[(number,row) for number,row in archive_rows() if row['path'] in wanted]
    missing=sorted(wanted-{row['path'] for _,row in matches})
    if missing:
        raise ValueError('Assets not in archive plan: '+', '.join(missing))
    result=restore_rows(matches)
    print(json.dumps(dict(status='ready',**result),ensure_ascii=True),flush=True)

def restore_prefix(prefix):
    clean=Path(prefix).as_posix().strip('/')
    if not clean or '..' in Path(clean).parts or Path(clean).is_absolute():
        raise ValueError('Unsafe restore prefix')
    rows=[(number,row) for number,row in archive_rows()
          if row['path']==clean or row['path'].startswith(clean+'/')]
    if not rows:
        raise ValueError('No archived assets under prefix: '+clean)
    result=restore_rows(rows)
    print(json.dumps(dict(status='ready',prefix=clean,**result),ensure_ascii=True),flush=True)

if __name__=='__main__':
    command=sys.argv[1]
    if command=='plan':
        data=plan();print(json.dumps(dict(packs=len(data['packs']),files=sum(len(p['files']) for p in data['packs']),bytes=sum(r['bytes'] for p in data['packs'] for r in p['files']),kept_files=len(data['keep_local'])),ensure_ascii=True))
    elif command in ('pack','reclaim'):
        for number in map(int,sys.argv[2:]):
            if number<1 or number>len(plan()['packs']):raise ValueError('Invalid pack number')
            (pack if command=='pack' else reclaim)(number)
    elif command=='restore':
        restore(sys.argv[2])
    elif command=='restore-many':
        restore_many(sys.argv[2:])
    elif command=='restore-prefix':
        restore_prefix(sys.argv[2])
    else:
        raise ValueError('Use plan, pack N..., reclaim N..., restore PATH, restore-many PATH..., restore-prefix PREFIX')
