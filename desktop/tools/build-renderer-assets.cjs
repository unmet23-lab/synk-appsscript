'use strict';
// Copy approved source assets without recolouring or rebuilding the SYNK mark.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),target=path.join(root,'desktop/assets/launcher');
const account='experiences/synk-account/assets/';
// PC 0.5.0부터 남은 화면은 검정 구 얼굴, 옛 내 계정, 연결 실패 화면이다(PC 0.5.0 설계 4.2-6). 그 화면이 쓰는 글꼴 · 로고 · 단추 펠트와 Atlas 사본만 싣는다.
// 옛 런처의 앱 표지 · 펠트 물건 · 혜택 포스터 · 넓은 펠트 바탕은 옛 보기와 함께 거뒀다. 설치기 포스터의 두 그림은 desktop/installer/art에 있다.
const sources={
  'synk.svg':account+'synk-logo.svg','SUIT.woff2':account+'SUIT-Variable.woff2',
  'InterTight.woff2':account+'InterTight-700.woff2','DMMono.ttf':account+'DMMono-Medium.ttf',
  'button.webp':account+'slab-coral-long.webp',
  // 숫자 글꼴 Inter Tight: 700 하나뿐이라 작은 회색 숫자까지 굵게 나왔다. 웹 플랫폼과 같은 400 · 600 조각을 더한다.
  'InterTight-Regular.woff2':'docs/브랜드_폰트/플랫폼_웹/InterTight-Regular.woff2','InterTight-SemiBold.woff2':'docs/브랜드_폰트/플랫폼_웹/InterTight-SemiBold.woff2',
  // 솔리오 로비의 라틴 한 낱말 「Solio」(유호님 11-26 「두 화면만 바꿔」). PULSE 앱과 같은 승인 사본이다(OFL).
  'NotoSerifDisplay-Light-latin.woff2':'docs/브랜드_폰트/NotoSerifDisplay/NotoSerifDisplay-Light-latin.woff2',
  'engine.js':'atlas/engine.js','personalization.js':'atlas/personalization.js',
};
fs.mkdirSync(target,{recursive:true});
// 원본이 저장소에 없는 그림(공방_책.avif 등)은 앞서 승인해 복사해 둔 사본이 기록된 해시와 같을 때만 그대로 쓴다.
const recorded=(()=>{try{return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(target,'sources.json'),'utf8')).assets.map(a=>[a.name,a]));}catch{return {};}})();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assets=Object.entries(sources).map(([name,source])=>{
  const from=path.join(root,source),copy=path.join(target,name);
  if(!fs.existsSync(from)&&fs.existsSync(copy)&&recorded[name]?.source===source&&sha(fs.readFileSync(copy))===recorded[name].sha256)return recorded[name];
  // 글 파일은 줄끝을 LF로 맞춰 윈도 작업본(core.autocrlf)에서도 같은 해시가 나오게 한다.
  let bytes=fs.readFileSync(from);if(/\.(svg|js|json)$/i.test(name))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  fs.writeFileSync(copy,bytes);return {name,source,bytes:bytes.length,sha256:sha(bytes)};
});
fs.writeFileSync(path.join(target,'sources.json'),JSON.stringify({note:'Approved assets copied unchanged. Screenshots show existing development content, not released content or learning-effect evidence.',assets},null,2)+'\n');
console.log('Launcher assets:',assets.length);
