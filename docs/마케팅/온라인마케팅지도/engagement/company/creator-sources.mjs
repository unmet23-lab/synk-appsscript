import {realpath,stat} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspaceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const logoGuide='docs/로고_중립색_정본_v1.md';
const fontGuide='docs/브랜드_폰트_정본.md';
const kitGuide='docs/디자인/SNS키트/README.md';
const feltGuide='docs/디자인/펠트부품/README.md';
const kitAssets='docs/디자인/SNS키트/assets/';
const fontRoot='docs/브랜드_폰트/';
const brandUsage='SYNK 콘텐츠 제작용 승인 자산입니다. 비율·색·표면을 보존하고 별도 스톡 자료로 재배포하지 마세요.';
const oflUsage='SIL Open Font License 1.1. 문서·영상·웹에 사용할 수 있습니다. 폰트 파일을 외부에 전달할 때 해당 저작권·라이선스 원문을 함께 전달하세요. 폰트 단독 판매·수정 이름 조건은 원문을 확인하세요.';

// Only these fixed files can be served. Source documents are provenance, not file-system input.
export const CREATOR_SOURCE_FILES=Object.freeze([
  {id:'synk-ink-vector',title:'SYNK · 밝은 바탕용 SVG',category:'logo',path:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg',mimeType:'image/svg+xml',fileName:'SYNK-Ink.svg',preview:'image',background:'light',variant:'정밀 벡터',sourcePath:logoGuide,usage:brandUsage+' 작은 인쇄·정확한 단색 도형에 사용하세요.'},
  {id:'synk-paper-vector',title:'SYNK · 어두운 바탕용 SVG',category:'logo',path:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Paper-정밀.svg',mimeType:'image/svg+xml',fileName:'SYNK-Paper.svg',preview:'image',background:'dark',variant:'정밀 벡터',sourcePath:logoGuide,usage:brandUsage+' 어두운 면 위에서 읽힘을 확인하세요.'},
  {id:'synk-paper-felt',title:'SYNK · 흰 펠트 로고',category:'logo',path:kitAssets+'logo-synk-paper.webp',mimeType:'image/webp',fileName:'SYNK-Paper-felt.webp',preview:'image',background:'dark',variant:'SNS 웹 파생',sourcePath:kitGuide,originPath:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png',usage:brandUsage+' 검정 면에 사용하고 승인된 무실땀 SYNK 표면을 유지하세요.'},
  ...[['lab','LAB','코랄'],['shift','SHIFT','청금석'],['pulse','PULSE','베리']].map(([id,name,color])=>({id:name.toLowerCase()+'-felt',title:'SYNK '+name+' · 펠트 로고',category:'logo',path:kitAssets+'logo-'+id+'.webp',mimeType:'image/webp',fileName:'SYNK-'+name+'-felt.webp',preview:'image',background:'light',variant:'SNS 웹 파생',sourcePath:kitGuide,originPath:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-'+name+'-Ink.png',usage:brandUsage+' '+name+'의 '+color+' 색과 사업명 실땀을 유지하세요. 조합을 일반 글자로 다시 만들지 마세요.'})),
  ...[['mongle','몽글'],['kkamong','까몽'],['marin','마린']].map(([id,name])=>({id:'mascot-'+id,title:name+' · 기본 표정',category:'mascot',path:kitAssets+'mascot-'+name+'_본체.webp',mimeType:'image/webp',fileName:'SYNK-'+id+'-web.webp',preview:'image',background:'light',variant:'1400px 이내 웹 파생',sourcePath:kitGuide,originPath:'docs/캐릭터/정본_4K/'+name+'_본체.png',usage:brandUsage+' 4K 정본에서 투명 가장자리를 잘라 축소한 웹 파생입니다. 실사 생활 상황극은 승인 인물, 표현·슬랭 소개는 마스코트 형식을 확인하세요.'})),
  {id:'suit-variable',title:'SUIT Variable',category:'font',path:fontRoot+'SUIT/SUIT-Variable.woff2',mimeType:'font/woff2',fileName:'SUIT-Variable.woff2',preview:'font',sample:'각자의 목표에 맞는 도움',sampleRole:'hangul',variant:'한글 · 가변 웹 폰트',sourcePath:fontGuide,usage:'한글 본문 500·헤드 800. 라틴·키릴은 Inter Tight를 앞에 둔 스택을 사용합니다.',license:{label:'SIL OFL 1.1',assetId:'suit-license',notice:oflUsage}},
  {id:'inter-tight-medium',title:'Inter Tight Medium',category:'font',path:fontRoot+'InterTight/InterTight-Medium.ttf',mimeType:'font/ttf',fileName:'InterTight-Medium.ttf',preview:'font',sample:'Create for each person',sampleRole:'latin',variant:'라틴·키릴 · 본문 500',sourcePath:fontGuide,usage:'라틴·키릴·몽골어 본문용 승인 정적 500 파일입니다. 다른 언어의 글리프가 없으면 해당 언어 서체를 확인하세요.',license:{label:'SIL OFL 1.1',assetId:'inter-tight-license',notice:oflUsage}},
  {id:'dm-mono-medium',title:'DM Mono Medium',category:'font',path:fontRoot+'DM_Mono/DMMono-Medium.ttf',mimeType:'font/ttf',fileName:'DMMono-Medium.ttf',preview:'font',sample:'EP 01 / 2026 / 1080',sampleRole:'mono',variant:'숫자·코드 · 500',sourcePath:fontGuide,usage:'숫자·코드·시스템 라벨 전용입니다. 한글·키릴·₮·№와 일반 본문에는 쓰지 마세요.',license:{label:'SIL OFL 1.1',assetId:'dm-mono-license',notice:oflUsage}},
  {id:'felt-coral-action',title:'코랄 · 주 행동 펠트 판',category:'felt',path:'docs/디자인/펠트부품/assets/ui/slab-coral-long.webp',mimeType:'image/webp',fileName:'SYNK-felt-coral-action.webp',preview:'image',background:'light',variant:'실제 펠트 부품',sourcePath:feltGuide,usage:brandUsage+' 누르는 행동에 쓰고 문구는 화면 글자로 얹습니다. 길게 읽는 본문은 흰 종이 면을 사용하세요.'},
  {id:'felt-check',title:'펠트 · 확인 배지',category:'felt',path:'docs/디자인/펠트부품/assets/ui/badge-check.webp',mimeType:'image/webp',fileName:'SYNK-felt-check.webp',preview:'image',background:'light',variant:'실제 펠트 부품',sourcePath:feltGuide,usage:brandUsage+' 확인 행동·완료 표시용 부품입니다. 사람의 검토가 자동 품질 인증으로 보이지 않게 문구를 함께 씁니다.'},
  {id:'felt-laptop',title:'펠트 · 노트북',category:'felt',path:kitAssets+'felt-laptop.webp',mimeType:'image/webp',fileName:'SYNK-felt-laptop.webp',preview:'image',background:'light',variant:'SNS 소품',sourcePath:kitGuide,originPath:'docs/마케팅/맞춤도구/assets/laptop-felt.webp',usage:brandUsage+' 의미를 돕는 주인공·소품으로 사용하고 본문과 겹치지 마세요. SNS 장식 수는 키트 기준을 확인하세요.'},
  {id:'suit-license',title:'SUIT · OFL 원문',category:'license',path:fontRoot+'SUIT/LICENSE_OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'SUIT-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
  {id:'inter-tight-license',title:'Inter Tight · OFL 원문',category:'license',path:fontRoot+'InterTight/OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'InterTight-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
  {id:'dm-mono-license',title:'DM Mono · OFL 원문',category:'license',path:fontRoot+'DM_Mono/OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'DMMono-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
].map(row=>Object.freeze({...row,license:row.license?Object.freeze({...row.license}):undefined})));

export const CREATOR_SOURCE_GUIDES=Object.freeze([
  {id:'pexels',title:'Pexels · 사진과 영상',url:'https://www.pexels.com/',licenseUrl:'https://www.pexels.com/license/',note:'무료 상업 사용·출처 표기 선택. 원본 단독 판매·스톡 재배포·인물이나 브랜드가 보증한 듯한 표현은 금지합니다. 초상·상표 등 별도 권리는 확인하세요.',extraUrl:'https://help.pexels.com/hc/en-us/articles/360042295214'},
  {id:'unsplash',title:'Unsplash · 사진',url:'https://unsplash.com/',licenseUrl:'https://unsplash.com/license',note:'무료 이미지의 상업 사용·출처 표기 권장. 유의미한 수정 없이 판매하거나 경쟁 스톡 서비스를 복제하면 안 됩니다. Unsplash+ 자료는 해당 조건을 별도로 확인하세요.'},
  {id:'pixabay',title:'Pixabay · 사진·영상·음악',url:'https://pixabay.com/',licenseUrl:'https://pixabay.com/service/license-summary/',note:'Content License 대상 자료의 무료 사용·출처 표기 선택. 원본만 재배포·판매하지 마세요. 상표·인물·음악 등 제3자 권리와 개별 자료의 조건을 확인하세요.'},
  {id:'youtube-audio',title:'YouTube Audio Library · 음악과 효과음',url:'https://studio.youtube.com/',licenseUrl:'https://support.google.com/youtube/answer/3376882?hl=en-uk',note:'Studio에서 곡별 Creative Commons 여부와 크레딧 조건을 확인하세요. 필수 크레딧은 그대로 복사합니다. YouTube 밖에서의 이용은 별도로 확인해야 합니다.'},
].map(row=>Object.freeze(row)));

const files=new Map(CREATOR_SOURCE_FILES.map(row=>[row.id,row]));
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export function createCreatorSourcesService({store,root=workspaceRoot}){
  const assetRoot=resolve(root);
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  async function fixedFile(row){
    const expected=resolve(assetRoot,row.path);
    if(!expected.startsWith(assetRoot+'/')&&!expected.startsWith(assetRoot+'\\'))throw fail('자료 경로를 확인해 주세요.',404);
    try{
      const actual=await realpath(expected);
      // Reject redirected files, including links to credentials elsewhere in the workspace.
      if(!samePath(actual,expected))throw fail('자료 경로를 확인해 주세요.',404);
      const info=await stat(actual);if(!info.isFile()||info.size===0)throw fail('자료 파일을 확인해 주세요.',404);
      return {path:actual,mimeType:row.mimeType,fileName:row.fileName,byteSize:info.size,updatedAt:info.mtime.toISOString(),cacheControl:'private, no-store'};
    }catch(error){if(error?.status)throw error;throw fail('자료 파일을 확인해 주세요.',404);}
  }
  async function file(user,id){
    current(user);if(typeof id!=='string'||!files.has(id))throw fail('자료를 찾을 수 없습니다.',404);
    const row=files.get(id);if(basename(row.fileName)!==row.fileName||/[\r\n"\\/\x00-\x1f]/.test(row.fileName))throw fail('자료 이름을 확인해 주세요.',404);
    const result=await fixedFile(row);current(user);return result;
  }
  async function workspace(user){
    current(user);
    const assets=await Promise.all(CREATOR_SOURCE_FILES.filter(row=>row.category!=='license').map(async row=>{
      let metadata;try{metadata=await fixedFile(row);}catch{}
      const url='/api/creator-sources/assets/'+row.id;
      const {path,...visible}=row;
      const license=row.license?{label:row.license.label,notice:row.license.notice,url:'/api/creator-sources/assets/'+row.license.assetId,downloadUrl:'/api/creator-sources/assets/'+row.license.assetId+'?download=1'}:null;
      return {...visible,assetPath:path,license,available:!!metadata,byteSize:metadata?.byteSize??null,updatedAt:metadata?.updatedAt??null,previewUrl:metadata&&row.preview==='image'?url:null,downloadUrl:metadata?url+'?download=1':null};
    }));
    current(user);return {assets,guides:CREATOR_SOURCE_GUIDES.map(row=>({...row})),notice:'승인 원본과 사용 기준을 연결한 자료함입니다. 웹 파생·정밀 벡터·폰트 파일을 구분해 사용하세요. 외부 자료의 사용권은 해당 원문과 사용 목적을 직접 확인합니다.',rightsTemplate:'자료 제목:\n작성자·제공자:\n원문 URL:\n라이선스 이름·URL:\n허용한 사용 범위:\n확인 날짜:\n필수 크레딧:\n초상·상표·음원 확인 또는 남은 조건:'};
  }
  return {workspace,file};
}
