import os, json, time, ctypes, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from collections import defaultdict

OUT = Path(__file__).resolve().parent
HOME_DIR = Path('C:/Users/q1212')
REPO = HOME_DIR / 'Documents/SYNK-appsscript'

def emit(value):
    print(json.dumps(value, ensure_ascii=True), flush=True)

def write(name, value):
    (OUT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def credentials():
    reg_path = REPO/'tools/company-messenger/data/drive-storage.json'
    if reg_path.exists():
        reg=json.loads(reg_path.read_text(encoding='utf-8'))
        for c in reg.get('connections', []):
            if c['id']==reg.get('activeConnectionId'):
                return c['credentials']
    reg=json.loads((HOME_DIR/'.clasprc.json').read_text(encoding='utf-8'))
    return reg.get('tokens', {}).get('default', reg)

class Drive:
    def __init__(self):
        self.auth=credentials()
        self.access=None
        self.expires=0
    def refresh(self):
        data=urllib.parse.urlencode({k:self.auth[k] for k in ['client_id','client_secret','refresh_token']} | {'grant_type':'refresh_token'}).encode()
        with urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=data), timeout=30) as r:
            token=json.load(r)
        self.access=token['access_token']
        self.expires=time.time()+int(token.get('expires_in',3600))-120
    def request(self, path, params=None, method='GET', body=None):
        if not self.access or time.time()>self.expires:
            self.refresh()
        url='https://www.googleapis.com/drive/v3/'+path
        if params:
            url+='?'+urllib.parse.urlencode(params)
        hdr={'Authorization':'Bearer '+self.access}
        if body is not None:
            hdr['Content-Type']='application/json'
        req=urllib.request.Request(url, headers=hdr, method=method, data=json.dumps(body).encode() if body is not None else None)
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data=r.read()
                    return json.loads(data) if data else None
            except urllib.error.HTTPError as e:
                if e.code==429 or e.code>=500:
                    time.sleep(2**attempt)
                    continue
                error=json.loads(e.read())
                raise RuntimeError(json.dumps({'http':e.code,'error':error.get('error',{}).get('message')},ensure_ascii=True)) from None
        raise RuntimeError('Drive request failed after retries')
    def about(self):
        return self.request('about', {'fields':'user(emailAddress,displayName),storageQuota'})
    def list(self, q="'me' in owners"):
        files=[]; page=None
        while True:
            params={'q':q,'pageSize':1000,'fields':'nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,sha256Checksum,parents,ownedByMe,quotaBytesUsed,trashed,createdTime,modifiedTime,description,appProperties,capabilities(canDelete,canTrash))'}
            if page:params['pageToken']=page
            data=self.request('files',params)
            if data.get('incompleteSearch'):raise RuntimeError('Drive inventory incomplete')
            files.extend(data.get('files',[]))
            page=data.get('nextPageToken')
            emit({'drive_files':len(files),'has_next':bool(page)})
            if not page:return files

def remote_audit():
    drive=Drive()
    about=drive.about()
    write('drive-before.json',about)
    emit({'about':about})
    files=drive.list()
    write('drive-files.json',files)
    byid={f['id']:f for f in files}
    def file_path(f,seen=None):
        seen=seen or set()
        if f['id'] in seen:return '[cycle]'
        seen.add(f['id'])
        parent=next(iter(f.get('parents',[])),None)
        return (file_path(byid[parent],seen)+'/' if parent in byid else '')+f['name']
    groups=defaultdict(list)
    for f in files:
        f['path']=file_path(f)
        if not f.get('trashed') and f.get('md5Checksum') and int(f.get('size',0))>0:
            groups[(f['md5Checksum'],f['size'])].append(f)
    dups=[g for g in groups.values() if len(g)>1]
    dups.sort(key=lambda g:int(g[0]['size'])*(len(g)-1), reverse=True)
    summary={'count':len(files),'trash_count':sum(bool(f.get('trashed')) for f in files),
        'trash_bytes':sum(int(f.get('quotaBytesUsed',f.get('size',0))) for f in files if f.get('trashed')),
        'largest':sorted(files,key=lambda f:int(f.get('size',0)),reverse=True)[:40],
        'duplicate_groups':dups,'root_folders':[f for f in files if f['mimeType']=='application/vnd.google-apps.folder' and len(f.get('parents',[]))==0]}
    write('drive-summary.json',summary)
    write('drive-files.json',files)
    emit({'drive_complete':True,'count':len(files),'trash_count':summary['trash_count'],'trash_bytes':summary['trash_bytes'],
        'duplicate_groups':len(dups),'duplicate_bytes':sum(int(g[0]['size'])*(len(g)-1) for g in dups),
        'largest':[{'path':f['path'],'bytes':f.get('size'),'trash':f.get('trashed')} for f in summary['largest'][:20]]})

kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.GetCompressedFileSizeW.argtypes=[ctypes.c_wchar_p,ctypes.POINTER(ctypes.c_ulong)]
kernel.GetCompressedFileSizeW.restype=ctypes.c_ulong
def allocated(path,size,attrs):
    if size<16*1024*1024 and not (attrs & (0x1000|0x40000|0x400000|0x200|0x800)):
        return ((size+4095)//4096)*4096
    high=ctypes.c_ulong()
    ctypes.set_last_error(0)
    low=kernel.GetCompressedFileSizeW(str(path),ctypes.byref(high))
    if low==0xffffffff and ctypes.get_last_error():return None
    return (high.value<<32)+low

def local_audit():
    roots=['Downloads','Videos','Pictures','Documents','OneDrive','DaVinci Resolve Media','.cache','.codex','.claude','.hyperframes','.media','.gradle','.android','AppData/Local','AppData/Roaming','hfup','UnityEditors','synk-night-bake']
    errors=[]; records=[]; summaries=[]
    for rel in roots:
        root=HOME_DIR/rel
        if not root.exists():continue
        stack=[root]; subtotal=0; bytes_sum=0; count=0
        groups=defaultdict(lambda:{'count':0,'bytes':0,'allocated':0})
        while stack:
            parent=stack.pop()
            try:
                entries=list(os.scandir(parent))
            except OSError as e:
                errors.append({'path':str(parent),'error':type(e).__name__});continue
            for entry in entries:
                try:
                    st=entry.stat(follow_symlinks=False)
                    attrs=st.st_file_attributes
                    if getattr(st,'st_reparse_tag',0) in [0xA0000003,0xA000000C]:continue
                    if entry.is_dir(follow_symlinks=False):
                        stack.append(Path(entry.path));continue
                    if not entry.is_file(follow_symlinks=False):continue
                    actual=allocated(entry.path,st.st_size,attrs)
                    row={'path':entry.path,'root':rel,'bytes':st.st_size,'allocated':actual,'mtime_ns':st.st_mtime_ns,'attributes':attrs}
                    records.append(row);count+=1;bytes_sum+=st.st_size;subtotal+=actual or 0
                    part=Path(entry.path).relative_to(root)
                    key='/'.join(part.parts[:2]) if len(part.parts)>2 else part.parts[0]
                    groups[key]['count']+=1;groups[key]['bytes']+=st.st_size;groups[key]['allocated']+=actual or 0
                except OSError as e:
                    errors.append({'path':entry.path,'error':type(e).__name__})
        summary={'root':str(root),'files':count,'bytes':bytes_sum,'allocated_estimate':subtotal,
            'groups':sorted([{'path':k,**v} for k,v in groups.items()],key=lambda v:v['allocated'],reverse=True)[:30]}
        summaries.append(summary)
        emit({k:v for k,v in summary.items() if k!='groups'})
    write('local-files.json',records)
    write('local-summary.json',{'roots':summaries,'errors':errors,'largest':sorted(records,key=lambda f:f['allocated'] or 0,reverse=True)[:80]})
    emit({'local_complete':True,'files':len(records),'errors':len(errors),'largest':sorted(records,key=lambda f:f['allocated'] or 0,reverse=True)[:15]})

if __name__=='__main__':
    import sys
    if sys.argv[1]=='remote':remote_audit()
    elif sys.argv[1]=='local':local_audit()
