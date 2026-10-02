import json
from concurrent.futures import ThreadPoolExecutor
from audit import Drive,OUT,write,emit

drive=Drive();drive.refresh()
plan=json.loads((OUT/'drive-cleanup-plan.json').read_text(encoding='utf-8'))
def check(row):
    fresh=drive.request('files/'+row['id'],{'fields':'id,name,size,md5Checksum,trashed,explicitlyTrashed,parents'})
    return {**row,'fresh':fresh,'trashedVerified':fresh.get('trashed',False)}
with ThreadPoolExecutor(max_workers=8) as pool:
    results=list(pool.map(check,plan))
write('drive-trash-verification.json',results)
emit({'verifiedTrashFiles':sum(bool(r['trashedVerified']) for r in results),'verifiedTrashBytes':sum(r['bytes'] for r in results if r['trashedVerified']),
    'remaining':[r['path'] for r in results if not r['trashedVerified']], 'about':drive.about()})
