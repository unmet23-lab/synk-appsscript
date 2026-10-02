from pathlib import Path
import hashlib
import json
import zipfile
base=Path(__file__).resolve().parent
data=json.loads((base/'상큼한_데이터.json').read_text(encoding='utf-8'))
target=base/'상큼한_음원_6개.zip'
items={}
for item in data['samples'][:6]:
    name=item['blindLabel'].replace(' ','_')+'.wav'
    items[name]=(base/item['file']).read_bytes()
items['안내.txt']=('새 A~F는 같은 대본으로 만든 합성 음성 비교본입니다. 체감 음량만 맞췄고 원래 출력 음질과 주파수 규격을 유지했습니다.\n'+
    'A/B는 새 음색, C는 기존 05 Sohee의 새 연기, D/E/F는 A를 참조해 다른 모델로 합성했습니다.\n'+
    'Humelo 나나와 Typecast 자인 음원은 이 ZIP에 없습니다.\n\n'+
    '\n'.join(x['label'] for x in data['samples'][:6])).encode('utf-8')
items['조사보고서.md']=(base/'상큼한_재조사.md').read_bytes()
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name,body in items.items():
        z.writestr(name,body)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert set(z.namelist())==set(items)
    for name,body in items.items():
        assert z.read(name)==body
record={'file':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'audioCount':6,'entries':list(items),'roundTripVerified':True}
(base/'검증/상큼한_ZIP검사.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=True))
