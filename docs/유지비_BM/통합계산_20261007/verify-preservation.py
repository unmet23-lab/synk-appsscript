import json, re, zipfile, hashlib
from pathlib import Path
from xml.etree import ElementTree as ET

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OLD=HERE.parent/'통합계산_20261006'
manifest=json.loads((HERE/'qa/manifest.json').read_text(encoding='utf-8'))
before=json.loads((OLD/'products.json').read_text(encoding='utf-8'))
after=json.loads((HERE/'products.json').read_text(encoding='utf-8'))
prior_manifest=json.loads((OLD/'qa/manifest.json').read_text(encoding='utf-8'))
prior_path=Path(prior_manifest['output'])
new_path=Path(manifest['output'])
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
issues=[];checks=[]
def assert_equal(label,a,b):
    if a!=b: issues.append({'name':label,'old':a,'new':b})
    checks.append({'name':label,'passed':a==b})
def read_book(file):
    with zipfile.ZipFile(file) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared=[''.join(n.itertext()) for n in root.findall('s:si',NS)]
        rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        targets={n.attrib['Id']:n.attrib['Target'].lstrip('/') for n in rel}
        book=ET.fromstring(z.read('xl/workbook.xml'))
        result={}
        for sh in book.findall('s:sheets/s:sheet',NS):
            target=targets[sh.attrib['{'+NS['r']+'}id']]
            if not target.startswith('xl/'):target='xl/'+target
            root=ET.fromstring(z.read(target));cells={}
            for c in root.findall('.//s:sheetData/s:row/s:c',NS):
                text=c.findtext('s:v',default='',namespaces=NS)
                if c.attrib.get('t')=='s':text=shared[int(text)] if text else ''
                elif c.attrib.get('t')=='inlineStr':text=''.join(c.find('s:is',NS).itertext())
                cells[c.attrib['r']]={'value':text,'formula':c.findtext('s:f',default='',namespaces=NS)}
            result[sh.attrib['name']]=cells
        return result
oldbook=read_book(prior_path);newbook=read_book(new_path)
oldby={p['id']:p for p in before['products']};newby={p['id']:p for p in after['products']}
assert_equal('ten sheet names and order',list(oldbook),list(newbook))
assert_equal('existing cost-source bytes', (OLD/'costs.json').read_bytes().hex(), (HERE/'costs.json').read_bytes().hex())
get=lambda book,sheet,cell:book[sheet].get(cell,{'value':'','formula':''})
old_rows={p['id']:{'input':prior_manifest['productInputRows'][i],'calculation':prior_manifest['productCalcRows'][i],'catalog':7+i} for i,p in enumerate(before['products'])}
for id,p in oldby.items():
    q=newby[id];o=old_rows[id];n=manifest['productRowsById'][id]
    if p['brand']!='SHIFT': assert_equal(id+' complete source preservation',p,q)
    else:
        for field in ('unit','currency','price_reference','assumed_hours','assumed_direct_cash_native','teaching_hours_reference','price_reference_min','price_reference_max','hours_reference_min','hours_reference_max'):
            assert_equal(id+'.'+field+' historical value',p.get(field),q.get(field))
    for col in 'FGHIJKLMNOPQ':
        for offset in range(1,8):
            assert_equal(f'{id} {col} input {offset}',get(oldbook,'월별상품',f'{col}{o["input"]+offset}'),get(newbook,'월별상품',f'{col}{n["input"]+offset}'))
        for offset in range(1,10):
            a=get(oldbook,'상품계산',f'{col}{o["calculation"]+offset}')['formula']
            b=get(newbook,'상품계산',f'{col}{n["calculation"]+offset}')['formula']
            for j in range(1,8):b=b.replace(f"'월별상품'!{col}{n['input']+j}",f"'월별상품'!{col}{o['input']+j}")
            b=re.sub(r"(?<!!)\b([F-Q])(\d+)\b",lambda m:f'{m[1]}{int(m[2])-n["calculation"]+o["calculation"]}' if n['calculation']+1<=int(m[2])<=n['calculation']+9 else m[0],b)
            assert_equal(f'{id} {col} calculation {offset}',a,b)
for sheet in ('운영비','현금입력'):
    assert_equal(sheet+' all existing input and formula cells',oldbook[sheet],newbook[sheet])
for id in manifest['currentShift']:
    n=manifest['productRowsById'][id]
    for col in 'FGHIJKLMNOPQ':
        for offset in range(1,8): assert_equal(f'{id} {col} current input blank {offset}',get(newbook,'월별상품',f'{col}{n["input"]+offset}')['value'],'')
        for offset in (1,2,3,4,5,6,9): assert_equal(f'{id} {col} current result unavailable {offset}',get(newbook,'상품계산',f'{col}{n["calculation"]+offset}')['value'],'')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'checked':len(checks),'passed':sum(c['passed'] for c in checks),'issues':issues,'preserved':{'originalWorkbook':{'path':str(prior_path),'sha256':sha(prior_path)},'costSource':sha(OLD/'costs.json')},'output':{'path':str(new_path),'sha256':sha(new_path)},'boundaries':{'existingNonShiftProductSources':12,'legacyShiftPricesAndHours':8,'currentShiftUnits':3,'sheets':10,'deskCopyOverwritten':False},'checks':checks}
(HERE/'qa/preservation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checked':report['checked'],'passed':report['passed'],'issues':issues[:10]},ensure_ascii=False))
if issues: raise SystemExit(1)
