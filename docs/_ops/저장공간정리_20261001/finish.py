import json, gzip, hashlib, shutil, time
from pathlib import Path
from audit import OUT,HOME_DIR,write,emit,Drive

def load(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def digest(stream):
    h=hashlib.sha256()
    while block:=stream.read(8*1024*1024):h.update(block)
    return h.hexdigest()

def main():
    before=load(OUT/'drive-before.json')
    downloads=load(OUT/'downloads-backup.json')
    local=load(OUT/'local-cleanup-result.json')
    local_manifest=load(OUT/'local-cleanup-plan.json')
    old=load(HOME_DIR/'Documents/PC_공간정리_20260930/복원_매니페스트.json')
    emit({'prior_manifest_keys':list(old)})
    retained=[]
    for key in ['retainLocally','retainedFinalAndProjectFiles','retained','keep']:
        values=old.get(key,[])
        if isinstance(values,list):
            for row in values:
                if isinstance(row,str):p=row
                elif isinstance(row,dict):p=row.get('localPath') or row.get('path')
                else:continue
                if p:
                    entry={'path':p,'exists':Path(p).exists()}
                    if isinstance(row,dict) and row.get('md5') and entry['exists']:
                        with Path(p).open('rb') as fh:
                            md5_hash=hashlib.md5()
                            while block:=fh.read(8*1024*1024):md5_hash.update(block)
                        entry['md5Verified']=md5_hash.hexdigest()==row['md5']
                    retained.append(entry)
    camera_backups=[]
    for f in load(OUT/'drive-files.json'):
        if f['name'] in ['MVI_2547.MP4','MVI_2548.MP4','MVI_2549.MP4','MVI_2550.MP4'] and f['path'].startswith('PC_백업_20260926/OneDrive/'):
            camera_backups.append({'id':f['id'],'name':f['name'],'bytes':f['size'],'trashed':f['trashed']})
    drive=Drive();account=drive.about()
    report={'checkedAt':time.time(),'newBackupUrl':'https://drive.google.com/drive/folders/'+downloads['root']['id'],
        'backupCheckedFiles':len(downloads['files']),'backupCheckedBytes':sum(r['bytes'] for r in downloads['files']),
        'newUploadedFiles':sum(r['method']=='uploaded' for r in downloads['files']),
        'newUploadedBytes':sum(r['bytes'] for r in downloads['files'] if r['method']=='uploaded'),
        'localCleanup':local,'retainedFinalsAndProjects':retained,'cameraServerBackups':camera_backups,
        'accountBefore':before,'accountAfter':account,'drivePermanentDeletion':'awaiting_user_confirmation',
        'driveTrashBytes':int(account['storageQuota']['usageInDriveTrash']),
        'preparedDriveCleanupBytes':762271056,'preparedDriveCleanupFiles':90,
        'restoreManifest':'local-cleanup-plan.json','downloadRestoreManifest':'downloads-backup.json',
        'localDiskNow':dict(zip(['total','used','free'],shutil.disk_usage('C:/')))}
    write('result.json',report)
    gzip_outputs=[]
    for name in ['local-files.json','drive-files.json','drive-summary.json']:
        source=OUT/name;dest=OUT/(name+'.gz')
        if not source.exists():continue
        with source.open('rb') as inp,gzip.open(dest,'wb',compresslevel=6) as out:shutil.copyfileobj(inp,out,length=8*1024*1024)
        with source.open('rb') as inp:original_hash=digest(inp)
        with gzip.open(dest,'rb') as inp:compressed_hash=digest(inp)
        if compressed_hash!=original_hash:raise RuntimeError('Audit compression verification failed')
        gzip_outputs.append({'source':str(source.resolve()),'compressed':str(dest.resolve()),'sha256':original_hash,'originalBytes':source.stat().st_size,'compressedBytes':dest.stat().st_size})
    write('audit-compression.json',gzip_outputs)
    emit({'localCleanup':local,'currentFreeBytes':report['localDiskNow']['free'],'uploadedFiles':report['newUploadedFiles'],
        'retainedFiles':retained,'driveTrashBytes':report['driveTrashBytes'],'compressedAudit':gzip_outputs})

if __name__=='__main__':main()
