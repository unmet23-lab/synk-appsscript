import json, hashlib, os, zipfile, csv, re, time
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from audit import OUT, HOME_DIR, write, emit, allocated

files=json.loads((OUT/'drive-files.json').read_text(encoding='utf-8'))
remote={f['id']:f for f in files}
index=defaultdict(list)
for f in files:
    if not f.get('trashed') and f.get('md5Checksum'):
        index[(f['md5Checksum'],int(f.get('size',0)))].append(f)

def digest(path):
    md5=hashlib.md5();sha=hashlib.sha256()
    with Path(path).open('rb') as fh:
        while data:=fh.read(8*1024*1024):
            md5.update(data);sha.update(data)
    return md5.hexdigest(),sha.hexdigest()

def remote_plan():
    # Only remove redundant test uploads, redundant numbered downloads, and
    # regeneration-only browser cache files copied into a historical PC backup.
    deletions=[]
    for f in files:
        p=f['path'];md5=f.get('md5Checksum');size=int(f.get('size',0))
        if f.get('trashed') or not md5:continue
        matches=[g for g in index[(md5,size)] if g['id']!=f['id']]
        test='_업로드시험/' in p
        numbered=p.startswith('PC_백업_20260926/Downloads/') and bool(re.search(r' \([2-9]\)\.[^.]+$',f['name']))
        cache=p.startswith('PC_백업_20260926/Documents/') and bool(re.search(r'/profile/(?:Default/(?:Cache|Code Cache|GPUCache)|(?:GPUCache|ShaderCache|GrShaderCache|DawnWebGPUCache|DawnGraphiteCache|GPUPersistentCache))/',p))
        if test or numbered:
            keep=[g for g in matches if '_업로드시험/' not in g['path'] and not re.search(r' \([2-9]\)\.[^.]+$',g['name'])]
            if not keep:continue
            keeper=keep[0]
            deletions.append({'id':f['id'],'path':p,'bytes':size,'md5':md5,'keepId':keeper['id'],'keepPath':keeper['path'],'reason':'identical_test_or_numbered_copy'})
        elif cache:
            deletions.append({'id':f['id'],'path':p,'bytes':size,'md5':md5,'reason':'regenerable_browser_cache_in_old_backup'})
    write('drive-cleanup-plan.json',deletions)
    trash=[f for f in files if f.get('trashed')]
    trash_roots=defaultdict(lambda:{'count':0,'bytes':0})
    for f in trash:
        k=f['path'].split('/')[0]
        trash_roots[k]['count']+=1;trash_roots[k]['bytes']+=int(f.get('quotaBytesUsed',f.get('size',0)))
    write('drive-trash-review.json',{'count':len(trash),'bytes':sum(v['bytes'] for v in trash_roots.values()),'groups':dict(trash_roots),'largest':sorted(trash,key=lambda f:int(f.get('size',0)),reverse=True)[:10]})
    emit({'drive_cleanup_files':len(deletions),'drive_cleanup_bytes':sum(r['bytes'] for r in deletions),'trash_groups':dict(trash_roots)})

def local_plan():
    prior=HOME_DIR/'Documents/PC_공간정리_20260930'
    old=json.loads((prior/'복원_매니페스트.json').read_text(encoding='utf-8'))
    archive=prior/'Videos_추가백업_20260930.zip'
    archive_remote=remote['167OWGxhpyW6-wXDAHhfpMgUDPk3-o6jk']
    archive_ok=False
    if archive.exists():
        md5,sha=digest(archive)
        archive_ok=not archive_remote.get('trashed') and archive.stat().st_size==int(archive_remote['size']) and md5==archive_remote['md5Checksum']
        if archive_ok:
            with zipfile.ZipFile(archive) as zf:
                failed=zf.testzip()
                if failed:raise RuntimeError('ZIP CRC failed: '+failed)
            write('archive-fresh-verification.json',{'path':str(archive),'remoteId':archive_remote['id'],'bytes':archive.stat().st_size,'md5':md5,'sha256':sha,'crcVerified':True})
        emit({'archive_verified':archive_ok})
    allowed=HOME_DIR/'Videos'
    candidates=[]
    for row in old['eligibleForLocalDeletion']:
        p=Path(row['localPath'])
        if not p.exists():continue
        if p==archive:
            if archive_ok:candidates.append(row)
            continue
        if not p.is_relative_to(allowed):continue
        if p.suffix.lower() not in ['.mov','.mp4','.wav','.png','.jpg','.jpeg','.webm','.m4a'] or p.stat().st_size<1024*1024:continue
        # Leave camera originals, latest delivery files, projects, and recent edits.
        if re.search(r'/revision9/',p.as_posix()) or re.search(r'(?:FINAL|final|완성)',p.name):continue
        if row.get('keep'):continue
        candidates.append(row)
    def verify(row):
        p=Path(row['localPath']);st=p.stat()
        r=remote.get(row['remoteId'])
        if not r or r.get('trashed'):return {'skipped':str(p),'reason':'remote missing or trashed'}
        if row.get('zipMember'):
            if not archive_ok:return {'skipped':str(p),'reason':'archive not verified'}
        elif int(r.get('size',-1))!=row['bytes'] or r.get('md5Checksum')!=row['md5']:
            return {'skipped':str(p),'reason':'remote bytes or hash changed'}
        md5,sha=digest(p);after=p.stat()
        if st.st_size!=row['bytes'] or md5!=row['md5'] or (st.st_size,st.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
            return {'skipped':str(p),'reason':'local changed'}
        if row.get('zipMember'):
            with zipfile.ZipFile(archive) as zf:
                if zf.getinfo(row['zipMember']).file_size!=st.st_size:return {'skipped':str(p),'reason':'member size differs'}
                member_hash=hashlib.md5()
                with zf.open(row['zipMember']) as fh:
                    while data:=fh.read(8*1024*1024):member_hash.update(data)
                if member_hash.hexdigest()!=md5:return {'skipped':str(p),'reason':'archive member differs'}
        return {**row,'localPath':str(p.resolve()),'mtime_ns':st.st_mtime_ns,'sha256':sha,'allocated':allocated(p,st.st_size,st.st_file_attributes),'verifiedAt':time.time()}
    verified=[];skipped=[]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for i,row in enumerate(pool.map(verify,candidates),1):
            if 'skipped' in row:skipped.append(row)
            else:verified.append(row)
            if i%200==0:emit({'local_hash_verified':i,'total':len(candidates)})
    write('local-cleanup-plan.json',verified)
    write('local-cleanup-skipped.json',skipped)
    emit({'local_cleanup_files':len(verified),'local_cleanup_bytes':sum(r['bytes'] for r in verified),'allocated_estimate':sum(r.get('allocated') or 0 for r in verified),'skipped':len(skipped)})

if __name__=='__main__':
    import sys
    if sys.argv[1]=='remote':remote_plan()
    elif sys.argv[1]=='local':local_plan()
