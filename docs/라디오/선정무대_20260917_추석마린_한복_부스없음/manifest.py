import hashlib, json
from pathlib import Path
root=Path(r'C:\Users\q1212\Documents\SYNK-appsscript')
dir=root/'docs/라디오/선정무대_20260917_추석마린_한복_부스없음'
old=json.loads((root/'docs/라디오/선정무대_20260916_추석마린/manifest.json').read_text(encoding='utf-8'))
sha=lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
html=dir/'after-마스코트.html'; stage=dir/'무대차례.txt'; asset=root/'docs/Loom_자산/옷층/옷_마린_한복.webp'; generated=dir/'생성원본_마린한복.png'
old['source']={'path':'docs/라디오/선정무대_20260916_추석마린/after-마스코트.html','sha256':old['candidate']['sha256']}
old['candidate']={'path':'docs/라디오/선정무대_20260917_추석마린_한복_부스없음/after-마스코트.html','sha256':sha(html)}
old['stage']['listPath']='docs/라디오/선정무대_20260917_추석마린_한복_부스없음/무대차례.txt'
old['remotePrecondition']={'overlaySha256':'91120a03007576e76818f75dcdd346f9bb0af885aff783de87332468d2e1ee68','stageListSha256':'5ea9dc8cff1729077a957e7e4bdc145ff7a45401a6e2fdc3381d29b15027d196'}
old['composition']['overlayQuery']='층=마스코트,전광판&크기=.32&자리=중하&바닥=2.5&부스=1'
old['sourceVisuals']['headset']='docs/Loom_자산/옷층/옷_마린_펠트헤드폰.webp'
old['changes']={
  'requestedAt':'2026-09-17',
  'summary':'추석 마린에 한복을 입히고 추석 결의 DJ 부스를 숨긴다. 배경 영상과 기존 오디오·표정·마린 본체는 유지한다.',
  'booth':'추석보름달마당은 부스결에서 제외되어 ?부스=1이어도 #부스가 숨겨진다.',
  'hanbok':"옷_마린_한복.webp를 추석 차림의 유일한 옷층으로 사용한다(헤드폰 제외).",
}
old['derivedAsset']={
  'path':'docs/Loom_자산/옷층/옷_마린_한복.webp',
  'sha256':sha(asset),
  'bytes':asset.stat().st_size,
  'size':[1024,1024],
  'alphaBbox':list(__import__('PIL').Image.open(asset).getchannel('A').getbbox()) if False else [284,527,755,896],
  'sourceGeneratedPath':str(generated).replace('\\','/'),
  'sourceGeneratedSha256':sha(generated),
  'sourceGeneratedSize':[1254,1254],
  'transform':{'resize':[540,410],'paste':[242,510],'resampling':'LANCZOS','encoding':'lossless WEBP'},
  'sourceApprovedReference':'docs/Loom_자산/옷층/옷_몽글_한복.webp',
}
old['newRemoteAsset']={'remotePath':'/opt/synk-radio/지면/docs/Loom_자산/옷층/옷_마린_한복.webp','sha256':sha(asset),'localPath':'docs/Loom_자산/옷층/옷_마린_한복.webp'}
old['protectedRemote'].pop('/opt/synk-radio/지면/docs/Loom_자산/옷층/옷_마린_펠트헤드폰.webp',None)
# Keep the old headset in an explicit preservation list because it remains on the server but is no longer requested.
old['preservedUnusedRemote']={'/opt/synk-radio/지면/docs/Loom_자산/옷층/옷_마린_펠트헤드폰.webp':'83ebff535f52449375973b08ff710f53f4605a9992c53a569434cdaba58a07b2','/opt/synk-radio/지면/docs/Loom_자산/라디오소품/부스.webp':'3beff72bd96adf9554d151874a14616e0585aaf57c720595dbbf846613c48d33','/opt/synk-radio/지면/docs/Loom_자산/라디오소품/디스크.webp':'05996b67558d1031c8578d4aa99e09857a2da9dd86a41e64730e25328a136839'}
# Clarify the previous tuning remains preserved after this follow-up.
old['runtimeTuning']['preservedByFollowup']=True
(dir/'manifest.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'candidateSha':sha(html),'assetSha':sha(asset),'assetBytes':asset.stat().st_size,'sourceGeneratedSha':sha(generated)},ensure_ascii=False))
