'use strict';
// Rebuild this dated, offline explanation from reviewed facts and current common code.
// This is a document builder, not a product deployment command.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const uri = (p, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;
const files = ['data-core-trail-temper.json','data-prism-strata.json','data-vellum-loom-reed.json'];
const engines = files.flatMap(p => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8').replace(/^\uFEFF/, ''))).sort((a,b)=>Number(a.number)-Number(b.number));
const expected = ['core','strata','trail','temper','prism','vellum','loom','reed'];
if (JSON.stringify(engines.map(e=>e.id)) !== JSON.stringify(expected)) throw Error('Eight reviewed engines required');
for (const e of engines) {
  for (const field of ['roles','built','connected','missing','sources']) if (!Array.isArray(e[field]) || !e[field].length) throw Error(`${e.id}: missing ${field}`);
  if (e.status.length!==3 || e.matrix.length!==3) throw Error(`${e.id}: three distinct status columns required`);
}
const compactRoles={core:'지금 필요한 다음 도움을 고릅니다.',strata:'배울 내용과 순서를 지도에 담습니다.',trail:'시간에 따라 이어지는 경험을 기록합니다.',temper:'제공한 도움이 통했는지 확인합니다.',prism:'여러 경험에서 출발 방법을 개선합니다.',vellum:'사람에게 맞는 말과 안내를 만듭니다.',loom:'재질·빛·움직임으로 장면을 표현합니다.',reed:'소리와 음악의 경험을 조절합니다.'};
for(const e of engines)e.mapRole=compactRoles[e.id];
const source = (label,p,lines,note)=>({label,path:path.join(root,p).replace(/\\/g,'/'),lines,note});
const data = {groups:[{id:'learning',label:'배울 내용과 다음 도움'},{id:'evidence',label:'기억과 효과 확인'},{id:'expression',label:'말·장면·소리'}],engines,sources:[
  source('Atlas 전체 설계와 8개 엔진 역할','docs/아틀라스_설계.md','§1-1 · §9–11','§11의 09-19 상태는 아래 09-21 첫 기억 기록과 함께 읽습니다.'),
  source('첫 지속 기억: 실제 구현·시험·배포 경계','docs/아틀라스_첫지속기억_20260921.md','전체','336개 로컬 시험 기록. 서버 배포·두 실기기 확인·두 번째 콘텐츠 연결 전입니다.'),
  source('SYNK ID와 장기 개인화, 승인한 플랫폼 3단계','docs/SYNK_플랫폼_계정과_연결_설계.md','§4','기존 앱의 홈·계정·기록·입구 → 두 콘텐츠 검증 → 필요할 때 런처 확장.'),
  source('구현 순서와 콘텐츠를 통한 엔진 발전','docs/아틀라스_구현명세.md','§9-1','각 기능의 담당 원본을 발전시키고 콘텐츠에서 실제 경험을 확인합니다.'),
  source('Core·Trail·Temper 현재 코드 감사','docs/엔진/지도_20260921/audit-core-trail-temper.md','전체','기존 구현, 새 연결, 과거 배포 기록을 분리한 상세 근거입니다.'),
  source('Prism·Strata 현재 코드 감사','docs/엔진/지도_20260921/audit-prism-strata.md','전체','관련 기반 시험 92개 통과. Strata 자체가 완성됐다는 의미는 아닙니다.'),
  source('Vellum·Loom·Reed 현재 코드 감사','docs/엔진/지도_20260921/audit-vellum-loom-reed.md','전체','실제 표현 기능과 새 Atlas 공동 조절의 차이를 확인했습니다.')
]};
for (const s of [...data.sources,...engines.flatMap(e=>e.sources)]) if (!fs.existsSync(s.path)) throw Error(`Source missing: ${s.path}`);
const tokens = JSON.parse(read('docs/디자인_토큰.json'));
const color = name => {const c=tokens.색.킷.find(c=>c.이름===name);if(!c)throw Error(name);return c.hex;};
const font = (family,file,format,weight)=>`@font-face{font-family:'${family}';src:url('${uri('docs/브랜드_폰트/'+file,format==='woff2'?'font/woff2':'font/ttf')}') format('${format}');font-weight:${weight};font-style:normal;font-display:swap}`;
const logoPath='docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png';
const logoHash=sha(fs.readFileSync(path.join(root,logoPath)));
if(logoHash!=='645a8ce5ca3f9c8b71b07a05a7436f4e5fcd59fcd6d7d4b6efb761b017d6a4fc')throw Error('Approved logo changed; review before rebuilding');
const codePaths=['atlas/engine.js','atlas/experiences.js','atlas/preferences.js'];
const script=p=>read(p).replace(/<\/script/gi,'<\\/script');
const replacements={
  FONTS:[font('SUIT','SUIT/SUIT-Variable.woff2','woff2','100 900'),font('Inter Tight','InterTight/InterTight-Medium.ttf','truetype','400 500'),font('Inter Tight','InterTight/InterTight-Bold.ttf','truetype','600 900'),font('DM Mono','DM_Mono/DMMono-Medium.ttf','truetype','400 700')].join('\n'),
  LOGO:uri(logoPath,'image/png'),LAPIS:color('Lapis Deep'),MEADOW:color('Meadow Deep'),POP:color('Pop Deep'),LAPIS_SOFT:color('Lapis Soft'),MEADOW_SOFT:color('Meadow Soft'),POP_SOFT:color('Pop Soft'),
  ENGINE_DATA:JSON.stringify(data).replace(/</g,'\\u003c'),ATLAS_ENGINE:script(codePaths[0]),ATLAS_EXPERIENCES:script(codePaths[1]),ATLAS_PREFERENCES:script(codePaths[2])
};
let html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
for(const [key,value] of Object.entries(replacements)){const token=`__${key}__`;if(!html.includes(token))throw Error(`Template missing ${token}`);html=html.replaceAll(token,value);}
if(/__(?:FONTS|LOGO|ENGINE_DATA|ATLAS_\w+|LAPIS\w*|MEADOW\w*|POP\w*)__/.test(html))throw Error('Unresolved template token');
const output=path.join(__dirname,'SYNK_Atlas_엔진지도_20260921.html');
fs.writeFileSync(output,html);
fs.writeFileSync(path.join(__dirname,'data.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'build-manifest.json'),JSON.stringify({asOf:'2026-09-21',file:path.basename(output),sha256:sha(html),bytes:Buffer.byteLength(html),engineCount:engines.length,sourceCount:data.sources.length+engines.reduce((sum,e)=>sum+e.sources.length,0),logoSha256:logoHash,embeddedCode:codePaths.map(p=>({path:p,sha256:sha(read(p))})),offline:true,productDeployment:false},null,2)+'\n');
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),engines:engines.length,sha256:sha(html)}));
