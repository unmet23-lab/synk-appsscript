from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from hashlib import sha256
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
ASSETS = OUT / 'assets'
ASSETS.mkdir(exist_ok=True)
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
definitions = [
    ('kkamong-base', '기본 까몽', '본체', 'base', None),
    ('kkamong-scarf', '포근한 목도리', '목도리', 'accessory', '목도리'),
    ('kkamong-apron', '작은 앞치마', '앞치마', 'clothing', '앞치마'),
    ('kkamong-summer-deel', '하늘빛 여름 델', '여름델', 'clothing', '여름 델'),
    ('kkamong-winter-deel', '따뜻한 겨울 델', '겨울델', 'clothing', '겨울 델'),
    ('kkamong-headphones', '펠트 헤드폰', '펠트헤드폰', 'accessory', '펠트 헤드폰'),
]
records = []
sheet = Image.new('RGB', (6*300,2*350),'#eee6d8')
draw = ImageDraw.Draw(sheet)
for col,(id,name,stem,kind,item) in enumerate(definitions):
    src = ROOT / ('docs/캐릭터/정본_4K/까몽_본체.png' if kind=='base' else f'docs/Loom_자산/옷/GPT_누끼_틀_avif/까몽_{stem}.avif')
    original = Image.open(src).convert('RGBA')
    derived = original.resize((768,768), Image.Resampling.LANCZOS)
    dest = ASSETS / f'{id}.webp'
    derived.save(dest, 'WEBP', lossless=True, method=6)
    box=original.getchannel('A').getbbox()
    row = {
        'id':id,'characterId':'kkamong','characterName':'까몽','name':name,
        'kind':kind,'itemNames':[] if item is None else [item],
        'sourcePath':str(src),'sourceSha256':sha256(src.read_bytes()).hexdigest(),
        'sourceSize':list(original.size),'alphaBoundingBox':list(box),
        'touchesCanvasBoundary':box[0]<=0 or box[1]<=0 or box[2]>=original.width or box[3]>=original.height,
        'imagePath':str(dest),'imageRelativePath':f'assets/{id}.webp','imageSize':[768,768],
        'imageBytes':dest.stat().st_size,'imageSha256':sha256(dest.read_bytes()).hexdigest(),
        'pose':'기존 정본 정면','reviewedExpressions':['기본'], 'expressionVariants':[],
        'allowedReaction':'동일 이미지 전체의 translate/rotate/scale와 글 반응',
        'allowedBackground':'밝은 크림 계열. 짙은 배경은 밝은 누끼 테가 드러나므로 직접 배치 제외.',
        'reviewStatus':'static-use-reviewed',
        'reviewLimit':'수동 기본 이미지 검수. 표정 전환, 임의 조합, 염색, 공개 배포 검수는 포함하지 않음.'
    }
    records.append(row)
    for r,bg in enumerate(['#eee6d8','#202b38']):
        x,y=col*300,r*350
        draw.rectangle((x,y,x+299,y+349),fill=bg)
        thumb=derived.resize((288,288),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+6,y+3),thumb)
        draw.text((x+8,y+303),name,font=FONT,fill='#202730' if r==0 else '#f5f0e8')
sheet.save(OUT/'selected-light-dark.png')
manifest={
    'version':1,'reviewDate':'2026-10-08','character':'까몽','costumeCount':5,'includesUncostumedBaseline':True,
    'transformation':'기존 정본 및 기존 통합 착용 AVIF를 RGBA로 읽고 768x768 Lanczos 축소 후 lossless WebP 저장. 원본 수정, 새 이미지 생성, 크롭, 얼굴 합성 없음.',
    'reviewEvidence':['costume-candidates-contact.png','expressions-contact.png','selected-light-dark.png','asset-inventory.json','expression-check.json'],
    'excludedCandidate':{'name':'털모자','reason':'단품 시트에서 꼬리 끝이 하단 경계에 잘린 모양으로 보여 제외'},
    'expressionDecision':'기존 표정판에서 미간과 얼굴 털의 넓은 차이를 확인해 사용 대상에서 제외. 기본 원본만 채택.',
    'backgroundDecision':'288px 밝은 크림 배경에서 기본 정면 사용을 확인. 짙은 남색 배경은 기존 누끼 가장자리에 밝은 테가 드러나므로 사진 배경으로 직접 적용하지 않음.',
    'assets':records
}
(OUT/'costume-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'count':len(records),'totalBytes':sum(x['imageBytes'] for x in records),'allCanvasMargins':all(not x['touchesCanvasBoundary'] for x in records)},ensure_ascii=True))
