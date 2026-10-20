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
const brandUsage='SYNK 콘텐츠를 만들 때 쓰는 승인 자산이에요. 비율·색·표면은 바꾸지 말고, 파일만 따로 떼어 스톡 자료처럼 다시 배포하지 마세요.';
const oflUsage='SIL Open Font License 1.1 폰트예요. 문서·영상·웹에 써도 돼요. 폰트 파일을 밖으로 넘길 때는 저작권 표시와 라이선스 전문을 같이 넘겨 주세요. 폰트만 따로 팔거나 고친 폰트에 이름을 붙이는 조건은 라이선스 전문을 읽어 봐 주세요.';

// Only these fixed files can be served. Source documents are provenance, not file-system input.
export const CREATOR_SOURCE_FILES=Object.freeze([
  {id:'synk-ink-vector',title:'SYNK · 밝은 바탕용 SVG',category:'logo',path:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg',mimeType:'image/svg+xml',fileName:'SYNK-Ink.svg',preview:'image',background:'light',variant:'정밀 벡터',sourcePath:logoGuide,usage:brandUsage+' 작은 인쇄물이나 정확한 도형·단색이 필요한 자리에 써요.'},
  {id:'synk-paper-vector',title:'SYNK · 어두운 바탕용 SVG',category:'logo',path:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Paper-정밀.svg',mimeType:'image/svg+xml',fileName:'SYNK-Paper.svg',preview:'image',background:'dark',variant:'정밀 벡터',sourcePath:logoGuide,usage:brandUsage+' 어두운 바탕에 얹은 뒤 잘 읽히는지 봐 주세요.'},
  {id:'synk-paper-felt',title:'SYNK · 흰 펠트 로고',category:'logo',path:kitAssets+'logo-synk-paper.webp',mimeType:'image/webp',fileName:'SYNK-Paper-felt.webp',preview:'image',background:'dark',variant:'SNS 웹용',sourcePath:kitGuide,originPath:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png',usage:brandUsage+' 검정 바탕에 쓰고, 실땀 없는 승인 SYNK 표면은 그대로 두세요.'},
  ...[['lab','LAB','코랄'],['shift','SHIFT','청금석'],['pulse','PULSE','베리']].map(([id,name,color])=>({id:name.toLowerCase()+'-felt',title:'SYNK '+name+' · 펠트 로고',category:'logo',path:kitAssets+'logo-'+id+'.webp',mimeType:'image/webp',fileName:'SYNK-'+name+'-felt.webp',preview:'image',background:'light',variant:'SNS 웹용',sourcePath:kitGuide,originPath:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-'+name+'-Ink.png',usage:brandUsage+' '+name+'의 '+color+' 색과 사업명 실땀은 그대로 두세요. SYNK와 사업명 조합을 보통 글자로 다시 만들지 마세요.'})),
  ...[['mongle','몽글'],['kkamong','까몽'],['marin','마린']].map(([id,name])=>({id:'mascot-'+id,title:name+' · 기본 표정',category:'mascot',path:kitAssets+'mascot-'+name+'_본체.webp',mimeType:'image/webp',fileName:'SYNK-'+id+'-web.webp',preview:'image',background:'light',variant:'웹용 1400px 이하',sourcePath:kitGuide,originPath:'docs/캐릭터/정본_4K/'+name+'_본체.png',usage:brandUsage+' 4K 정본에서 투명한 가장자리를 잘라 내고 줄인 웹용 파일이에요. 실사 생활 상황극은 승인된 인물로, 표현·슬랭 소개는 마스코트 형식으로 만드는지 봐 주세요.'})),
  {id:'suit-variable',title:'SUIT Variable',category:'font',path:fontRoot+'SUIT/SUIT-Variable.woff2',mimeType:'font/woff2',fileName:'SUIT-Variable.woff2',preview:'font',sample:'각자의 목표에 맞는 도움',sampleRole:'hangul',variant:'한글 · 가변 웹 폰트',sourcePath:fontGuide,usage:'한글 본문은 500, 제목은 800 굵기로 써요. 글꼴 순서는 Inter Tight를 SUIT 앞에 둬서 라틴·키릴은 Inter Tight가 맡게 해요.',license:{label:'SIL OFL 1.1',assetId:'suit-license',notice:oflUsage}},
  {id:'inter-tight-medium',title:'Inter Tight Medium',category:'font',path:fontRoot+'InterTight/InterTight-Medium.ttf',mimeType:'font/ttf',fileName:'InterTight-Medium.ttf',preview:'font',sample:'Create for each person',sampleRole:'latin',variant:'라틴·키릴 · 본문 500',sourcePath:fontGuide,usage:'라틴·키릴·몽골어 본문에 쓰는 승인 파일로, 굵기 500 하나만 들어 있어요. 다른 언어 글자가 없으면 그 언어에 맞는 서체를 따로 알아봐 주세요.',license:{label:'SIL OFL 1.1',assetId:'inter-tight-license',notice:oflUsage}},
  {id:'dm-mono-medium',title:'DM Mono Medium',category:'font',path:fontRoot+'DM_Mono/DMMono-Medium.ttf',mimeType:'font/ttf',fileName:'DMMono-Medium.ttf',preview:'font',sample:'EP 01 / 2026 / 1080',sampleRole:'mono',variant:'숫자·코드 · 500',sourcePath:fontGuide,usage:'숫자·코드·시스템 라벨에만 써요. 한글·키릴·₮·№와 일반 본문에는 쓰지 마세요.',license:{label:'SIL OFL 1.1',assetId:'dm-mono-license',notice:oflUsage}},
  {id:'felt-coral-action',title:'코랄 · 주 행동 펠트 판',category:'felt',path:'docs/디자인/펠트부품/assets/ui/slab-coral-long.webp',mimeType:'image/webp',fileName:'SYNK-felt-coral-action.webp',preview:'image',background:'light',variant:'실제 펠트 부품',sourcePath:feltGuide,usage:brandUsage+' 누르는 단추에 쓰고, 단추 글자는 화면 글자로 얹어요. 길게 읽는 본문은 흰 종이 면에 두세요.'},
  {id:'felt-check',title:'펠트 · 확인 배지',category:'felt',path:'docs/디자인/펠트부품/assets/ui/badge-check.webp',mimeType:'image/webp',fileName:'SYNK-felt-check.webp',preview:'image',background:'light',variant:'실제 펠트 부품',sourcePath:feltGuide,usage:brandUsage+' 확인 단추나 다 됐다는 표시에 쓰는 부품이에요. 사람이 검토한 것이 자동 품질 인증처럼 보이지 않게 설명 글을 같이 붙여요.'},
  {id:'felt-laptop',title:'펠트 · 노트북',category:'felt',path:kitAssets+'felt-laptop.webp',mimeType:'image/webp',fileName:'SYNK-felt-laptop.webp',preview:'image',background:'light',variant:'SNS 소품',sourcePath:kitGuide,originPath:'docs/마케팅/맞춤도구/assets/laptop-felt.webp',usage:brandUsage+' 내용을 돕는 주인공이나 소품으로 쓰고, 본문 글자와 겹치지 않게 두세요. SNS 장식 개수는 키트 기준에 맞춰 주세요.'},
  {id:'suit-license',title:'SUIT · OFL 원문',category:'license',path:fontRoot+'SUIT/LICENSE_OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'SUIT-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
  {id:'inter-tight-license',title:'Inter Tight · OFL 원문',category:'license',path:fontRoot+'InterTight/OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'InterTight-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
  {id:'dm-mono-license',title:'DM Mono · OFL 원문',category:'license',path:fontRoot+'DM_Mono/OFL.txt',mimeType:'text/plain; charset=utf-8',fileName:'DMMono-LICENSE-OFL.txt',sourcePath:fontGuide,usage:oflUsage},
].map(row=>Object.freeze({...row,license:row.license?Object.freeze({...row.license}):undefined})));

export const CREATOR_SOURCE_GUIDES=Object.freeze([
  {id:'pexels',title:'Pexels · 사진과 영상',url:'https://www.pexels.com/',licenseUrl:'https://www.pexels.com/license/',note:'상업용으로도 무료로 쓸 수 있고, 출처 표기는 해도 되고 안 해도 돼요. 원본을 그대로 따로 팔거나, 스톡 자료로 다시 배포하거나, 나온 사람·브랜드가 보증하는 것처럼 쓰면 안 돼요. 초상권·상표권 같은 다른 권리는 따로 살펴 주세요.',extraUrl:'https://help.pexels.com/hc/en-us/articles/360042295214'},
  {id:'unsplash',title:'Unsplash · 사진',url:'https://unsplash.com/',licenseUrl:'https://unsplash.com/license',note:'무료 이미지는 상업용으로 쓸 수 있고, 출처 표기는 하는 게 좋아요. 크게 손대지 않은 채 팔거나, 경쟁하는 스톡 서비스를 따라 만드는 데 쓰면 안 돼요. Unsplash+ 자료는 그 조건을 따로 읽어 봐 주세요.'},
  {id:'pixabay',title:'Pixabay · 사진·영상·음악',url:'https://pixabay.com/',licenseUrl:'https://pixabay.com/service/license-summary/',note:'Content License가 붙은 자료는 무료로 쓸 수 있고, 출처 표기는 해도 되고 안 해도 돼요. 손대지 않은 원본만 다시 배포하거나 팔지 마세요. 상표·인물·음악 같은 다른 사람의 권리와 자료마다 붙은 조건은 따로 살펴 주세요.'},
  {id:'youtube-audio',title:'YouTube Audio Library · 음악과 효과음',url:'https://studio.youtube.com/',licenseUrl:'https://support.google.com/youtube/answer/3376882?hl=en-uk',note:'YouTube Studio에서 곡마다 Creative Commons인지, 크레딧을 어떻게 달아야 하는지 봐 주세요. 꼭 넣어야 하는 크레딧은 글자 그대로 복사해 넣어요. YouTube 밖에서 쓰려면 조건을 따로 알아봐야 해요.'},
].map(row=>Object.freeze(row)));

const files=new Map(CREATOR_SOURCE_FILES.map(row=>[row.id,row]));
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export function createCreatorSourcesService({store,root=workspaceRoot}){
  const assetRoot=resolve(root);
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  async function fixedFile(row){
    const expected=resolve(assetRoot,row.path);
    if(!expected.startsWith(assetRoot+'/')&&!expected.startsWith(assetRoot+'\\'))throw fail('자료 파일이 정해진 자리에 없어요. 관리자에게 알려 주세요.',404);
    try{
      const actual=await realpath(expected);
      // Reject redirected files, including links to credentials elsewhere in the workspace.
      if(!samePath(actual,expected))throw fail('자료 파일이 정해진 자리에 없어요. 관리자에게 알려 주세요.',404);
      const info=await stat(actual);if(!info.isFile()||info.size===0)throw fail('자료 파일이 없거나 비어 있어요. 관리자에게 알려 주세요.',404);
      return {path:actual,mimeType:row.mimeType,fileName:row.fileName,byteSize:info.size,updatedAt:info.mtime.toISOString(),cacheControl:'private, no-store'};
    }catch(error){if(error?.status)throw error;throw fail('자료 파일이 없거나 비어 있어요. 관리자에게 알려 주세요.',404);}
  }
  async function file(user,id){
    current(user);if(typeof id!=='string'||!files.has(id))throw fail('그 자료를 찾지 못했어요.',404);
    const row=files.get(id);if(basename(row.fileName)!==row.fileName||/[\r\n"\\/\x00-\x1f]/.test(row.fileName))throw fail('자료 파일 이름이 잘못돼 있어요. 관리자에게 알려 주세요.',404);
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
    current(user);return {assets,guides:CREATOR_SOURCE_GUIDES.map(row=>({...row})),notice:'승인 원본과 사용 기준을 한데 묶은 자료함이에요. 웹용 파일·정밀 벡터·폰트 파일은 쓰임이 다르니 골라 쓰세요. 바깥 자료는 라이선스 전문과 쓰려는 목적을 직접 맞춰 봐 주세요.',rightsTemplate:'자료 제목:\n작성자·제공자:\n자료 주소:\n라이선스 이름·주소:\n쓸 수 있는 범위:\n확인한 날:\n꼭 넣을 크레딧:\n초상·상표·음원 확인과 남은 조건:'};
  }
  return {workspace,file};
}
