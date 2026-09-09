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
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
        for r in rows:
            src=source_path(r['path'])
            if src.stat().st_mtime_ns != r['mtime_ns'] or src.stat().st_size != r['bytes']:
                raise RuntimeError('Source changed before archive: '+r['path'])
            z.write(src,r['path'])
        z.writestr('MANIFEST.json',json.dumps(dict(source=str(SOURCE),files=rows),ensure_ascii=False))
    with zipfile.ZipFile(output) as z:
        for r in rows:
            with z.open(r['path']) as f:
                if hashlib.file_digest(f,'sha256').hexdigest()!=r['sha256']:
                    raise RuntimeError('Archive member hash mismatch')
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
                changed.append(r['path']);continue
            after=src.stat()
            if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
                changed.append(r['path']);continue
            # Commit the recovery location before removing the validated local copy.
            f.write(json.dumps(dict(event='source-verified',path=r['path'],sha256=r['sha256']),ensure_ascii=False)+'\n');f.flush();os.fsync(f.fileno())
            src.unlink()
            freed+=r['bytes']
            f.write(json.dumps(dict(event='reclaimed',path=r['path'],bytes=r['bytes']),ensure_ascii=False)+'\n');f.flush()
        os.fsync(f.fileno())
    local=STAGE/receipt['archive']
    if local.exists() and digest(local)==receipt['sha256']:
        local.unlink()
    print(json.dumps(dict(number=number,remote_verified=True,reclaimed_bytes=freed,changed_preserved=changed,free_bytes=shutil.disk_usage(REPO).free),ensure_ascii=True),flush=True)

def restore(relative):
    target=source_path(relative)
    for item in plan()['packs']:
        match=next((r for r in item['files'] if r['path']==relative),None)
        if match is None:
            continue
        if target.exists():
            print(json.dumps(dict(status='local-exists',matches=digest(target)==match['sha256'])));return
        receipt=read(OPS/f"mascot-{item['number']:04}.json")
        with zipfile.ZipFile(REMOTE/receipt['archive']) as z:
            payload=z.read(relative)
        if hashlib.sha256(payload).hexdigest()!=match['sha256']:
            raise RuntimeError('Remote member hash mismatch')
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as f:
            f.write(payload)
        print(json.dumps(dict(status='restored',path=str(target),sha256=match['sha256']),ensure_ascii=True));return
    raise ValueError('Asset not in archive plan')

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
    else:
        raise ValueError('Use plan, pack N..., reclaim N..., restore RELATIVE_PATH')
