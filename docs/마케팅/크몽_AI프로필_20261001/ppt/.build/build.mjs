import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';
import {GlobalFonts} from '@napi-rs/canvas';

const build=path.dirname(fileURLToPath(import.meta.url));
const workspaceDir=path.resolve(build,'..');
const serviceDir=path.resolve(workspaceDir,'..');
const SKILL_DIR='C:/Users/q1212/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const RUNTIME_PYTHON='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {finalizePresentation,resolvePresentationFont}=await import(pathToFileURL(path.join(SKILL_DIR,'container_tools/artifact_tool_utils.mjs')).href);
if(!GlobalFonts.families.some(x=>x.family==='SUIT Variable'))throw new Error('SUIT Variable unavailable');
const font=resolvePresentationFont({fontFamily:'SUIT Variable'});
const fontPolicy={basis:'design',families:[font]};
const ink='#251F29',muted='#675C6A',accent='#9D3D6D',wash='#F8F1F5';
const bytes={};
for(const file of ['pulse-logo.png','thread-line.png','01_studio.jpg','02_business.jpg','03_editorial.jpg','yuho-ref-0048.jpg'])bytes[file]=new Uint8Array(await fs.readFile(path.join(serviceDir,'images',file)));
const used=[];
function text(slide,name,value,x,y,w,h,size=28,color=ink,bold=false,fill='none'){
 const shape=slide.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});
 shape.text=value;shape.text.style={typeface:font,fontSize:size,color,bold,alignment:'left',verticalAlignment:'top',wrap:'square',autoFit:'none',insets:{top:0,right:0,bottom:0,left:0}};
 return shape;
}
function photo(slide,file,x,y,w,h,alt){return slide.images.add({blob:bytes[file],contentType:file.endsWith('.jpg')?'image/jpeg':'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}})}
function slot(slide,label,x,y,w,h){const shape=text(slide,'사진 교체 자리',label,x,y,w,h,27,muted,false,wash);shape.text.style={typeface:font,fontSize:27,color:muted,alignment:'center',verticalAlignment:'middle',autoFit:'none',insets:{top:20,right:20,bottom:20,left:20}};return shape}
function page(p,n,total,label,{template=false}={}){
 const s=p.slides.add();s.background.fill='#FFFFFF';
 photo(s,'pulse-logo.png',72,38,142,38,'승인된 SYNK PULSE 로고');
 text(s,'페이지 분류',label,760,45,448,34,19,muted);
 photo(s,'thread-line.png',72,661,236,20,'PULSE 실땀 장식');
 text(s,'하단 설명',template?'편집용 양식 · 대괄호 안 문구와 사진을 바꿔주세요':'유호 프로필 · AI 사진을 활용한 소개 자료 예시',332,664,740,26,17,muted);
 text(s,'페이지 번호',String(n).padStart(2,'0')+' / '+String(total).padStart(2,'0'),1120,663,90,26,17,muted);
 return s;
}
function notes(s,body,template=false){s.speakerNotes.textFrame.setText(body+'\n\n서체: SUIT Variable. 텍스트는 개별 편집 가능한 PowerPoint 텍스트 상자입니다. 사진은 삽입된 그림이며 교체할 수 있습니다.\n디자인 자산: images/pulse-logo.png (승인 PULSE Ink 로고), images/thread-line.png (기존 실제 실땀 이미지).\n'+(template?'양식 사용: 대괄호 안 예시 문구를 바꾸고 필요 없는 슬라이드를 삭제하세요. 사진 자리 상자를 삭제한 뒤 삽입 > 그림으로 납품 사진을 넣으세요. 표준 3장은 1/2/7, 디럭스 5장은 1/2/4/5/7, 프리미엄 7장은 전체를 사용합니다. 경력과 성과는 제공자가 확인한 사실만 작성하세요.':'이 자료는 유호 내부 시안이며 고객 납품 사례나 얼굴 동일성 승인 자료가 아닙니다. 프로필 사진은 인터뷰 원본 프레임 3장을 참조한 AI 생성 이미지입니다. 샘플 설명은 이번 요청과 docs/비전_정본.md의 PULSE 역할을 바탕으로 작성했습니다. 공개 사용 전 문구와 본인 인상을 확인하세요.'))}

function template(){
 const p=Presentation.create({slideSize:{width:1280,height:720}});let s;
 s=page(p,1,7,'PROFILE',{template:true});
 text(s,'표지 이름','[이름]',72,166,610,110,82,ink,true);
 text(s,'표지 직함','[직함 또는 활동 분야]',76,282,600,68,32,accent,true);
 text(s,'한 줄 소개','[내가 누구를 어떻게 돕는지\n두 줄 안으로 소개합니다.]',76,406,600,132,31);
 slot(s,'프로필 사진\n세로 3:4',792,118,386,514);
 notes(s,'표지: 이름, 직함, 핵심 소개 한 문장을 제공합니다. 사진 비율 3:4. 이름 권장 10자 이내, 직함 20자 이내, 소개 45자 이내.',true);
 s=page(p,2,7,'ABOUT',{template:true});
 text(s,'소개 제목','[나를 소개하는 한 문장]',72,136,1100,82,47,ink,true);
 text(s,'소개 본문','[누구와 어떤 일을 하는지 씁니다.]\n[어떤 경험을 바탕으로 일하는지 씁니다.]\n[이 자료를 읽는 사람에게 무엇을 제안하는지 씁니다.]',72,260,740,186,30);
 text(s,'소개 키워드','[활동 분야]    [주요 대상]',72,513,730,55,25,accent,true);
 slot(s,'보조 프로필 사진\n세로 3:4',887,237,290,387);
 notes(s,'짧은 소개: 제공한 소개글을 독자가 이해하기 쉬운 세 문장으로 정리합니다. 문장당 40자 이내를 권장합니다.',true);
 s=page(p,3,7,'EXPERIENCE',{template:true});
 text(s,'경력 제목','주요 경력',72,132,1136,84,49,ink,true);
 for(let i=0;i<3;i++){
  const y=255+i*118;
  text(s,'기간 '+i,'[기간]',72,y,180,54,30,accent,true);
  text(s,'경력 '+i,'[소속 또는 프로젝트 / 맡은 역할]',298,y,850,46,30,ink,true);
  text(s,'경력 설명 '+i,'[담당한 일이나 확인된 결과를 한 문장으로 적습니다.]',298,y+48,870,52,25,muted);
 }
 notes(s,'경력: 3개 항목. 기간, 소속/프로젝트, 역할, 한 줄 설명을 받습니다. 근거 없는 수치·자격·경력을 추가하지 않습니다.',true);
 s=page(p,4,7,'SERVICES',{template:true});
 text(s,'서비스 제목','[제공하는 서비스]',72,130,1120,84,49,ink,true);
 for(let i=0;i<3;i++){
  const y=252+i*122;
  text(s,'서비스 번호 '+i,'0'+(i+1),72,y,100,52,36,accent,true);
  text(s,'서비스 이름 '+i,'[서비스 이름]',224,y,930,52,32,ink,true);
  text(s,'서비스 설명 '+i,'[대상과 제공 결과를 한 문장으로 적습니다.]',224,y+51,930,52,26,muted);
 }
 notes(s,'서비스: 최대 3개 항목. 누가 무엇을 받는지 중심으로 짧게 적습니다. 가격표나 긴 제안서 작성은 별도 범위입니다.',true);
 s=page(p,5,7,'SELECTED WORK',{template:true});
 text(s,'사례 제목','[대표 작업 또는 프로젝트]',72,132,1100,78,47,ink,true);
 slot(s,'작업 이미지\n가로 4:3 권장',72,260,580,352);
 text(s,'작업 설명 제목','[작업 이름]',724,275,450,62,35,ink,true);
 text(s,'작업 설명','[프로젝트의 목적]\n\n[내가 맡은 역할]\n\n[확인된 결과 또는 산출물]',724,365,450,244,26);
 notes(s,'작업 사례: 이미지 1장과 목적/역할/결과를 제공합니다. 성과 수치가 없다면 실제 산출물로 설명합니다. 공개 권한이 있는 자료만 넣습니다.',true);
 s=page(p,6,7,'HOW I WORK',{template:true});
 text(s,'진행 제목','[함께 일하는 방식]',72,130,1120,84,49,ink,true);
 for(let i=0;i<3;i++){
  const y=258+i*120;
  text(s,'진행 번호 '+i,'0'+(i+1),72,y,100,52,36,accent,true);
  text(s,'진행 단계 '+i,['[요청 확인]','[제작과 확인]','[전달과 활용]'][i],224,y,930,50,32,ink,true);
  text(s,'진행 설명 '+i,'[이 단계에서 고객과 확인할 내용을 적습니다.]',224,y+52,930,50,26,muted);
 }
 notes(s,'진행: 실제 고객과 확인하는 순서를 세 단계로 씁니다. 일정이나 수정 횟수는 실제 합의한 범위만 적습니다.',true);
 s=page(p,7,7,'CONTACT',{template:true});
 text(s,'연락 제목','[함께할 일을 한 문장으로]',72,175,1120,114,54,ink,true);
 text(s,'마무리 소개','[이름 / 직함]',76,337,1000,66,34,accent,true);
 text(s,'공개 연락처','[공개할 홈페이지 또는 포트폴리오 주소]\n[공개할 연락처 · 원할 때만 입력]',76,443,1100,123,29);
 notes(s,'연락처: 공개할 자료만 받습니다. 크몽 상품 이미지나 설명에 이 고객용 예시의 외부 연락처를 넣지 않습니다. 표시 이름은 실명이 아니어도 됩니다.',true);
 return p;
}
function example(){
 const p=Presentation.create({slideSize:{width:1280,height:720}});let s;
 s=page(p,1,5,'PROFILE');
 text(s,'표지 이름','유호',72,174,620,108,82,ink,true);
 text(s,'표지 직함','SYNK 창업자',76,292,590,66,33,accent,true);
 text(s,'한 줄 소개','AI로 콘텐츠를 만들고,\n실제로 쓸 수 있는 도구를 만듭니다.',76,418,636,133,32);
 photo(s,'02_business.jpg',792,118,386,514,'유호 비즈니스 AI 프로필 내부 시안');
 notes(s,'표지 사진: images/02_business.jpg. 자료 근거: 이번 사용자 요청과 PULSE_AI모델_캐스팅_20260930/roster-v2.json의 실존 창업자 기반 유호 모델. 소개 문장은 검토용 초안입니다.');
 s=page(p,2,5,'ABOUT');
 text(s,'소개 제목','만들고, 직접 확인합니다.',72,134,1100,80,49,ink,true);
 text(s,'소개 본문','SYNK의 교육과 콘텐츠, AI 활용 도구를 만듭니다.\n\n보는 사람이 이해하고 바로 활용할 수 있도록\n원고부터 결과물까지 이어서 작업합니다.',72,263,760,243,30);
 text(s,'활동 분야','콘텐츠 제작    AI 활용    소개 자료',72,551,760,48,25,accent,true);
 photo(s,'01_studio.jpg',887,237,290,387,'유호 스튜디오 AI 프로필 내부 시안');
 notes(s,'사진: images/01_studio.jpg. 소개글은 이번 요청과 docs/비전_정본.md의 SYNK 역할, docs/AI_운영원칙.md의 실제 결과 확인 방향에 맞춘 초안입니다. 경력·고객 수·매출 등 검증되지 않은 수치를 넣지 않았습니다.');
 s=page(p,3,5,'SERVICES');
 text(s,'서비스 제목','PULSE에서 만드는 콘텐츠',72,134,1120,82,49,ink,true);
 const rows=[['광고와 브랜드필름','브랜드의 이야기를 영상으로 제작합니다.'],['AI 모델과 룩북','콘셉트에 맞는 모델 이미지와 룩북을 제작합니다.'],['AI 프로필과 소개 자료','원본 사진으로 프로필을 만들고 소개 PPT까지 완성합니다.']];
 rows.forEach((r,i)=>{const y=256+i*121;text(s,'서비스 번호 '+i,'0'+(i+1),72,y,100,51,36,accent,true);text(s,'서비스 이름 '+i,r[0],224,y,930,52,32,ink,true);text(s,'서비스 설명 '+i,r[1],224,y+52,930,53,26,muted)});
 notes(s,'역할 근거: docs/비전_정본.md의 2026-09-30 및 2026-10-01 PULSE 역할 확정, 이번 사용자 AI 프로필/PPT 서비스 추가 요청. 실제 고객 납품 실적이나 출시 완료를 주장하지 않습니다.');
 s=page(p,4,5,'PROFILE EXAMPLE');
 text(s,'사례 제목','인터뷰 사진으로 만든 프로필',72,128,1100,78,47,ink,true);
 photo(s,'yuho-ref-0048.jpg',72,247,344,344,'유호 인터뷰 원본 프레임');
 photo(s,'03_editorial.jpg',493,229,278,371,'원본을 참조한 에디토리얼 AI 프로필 내부 시안');
 text(s,'원본 표기','인터뷰 원본',72,597,340,35,23,muted);
 text(s,'AI 표기','AI 제작 시안',493,597,300,35,23,accent,true);
 text(s,'작업 설명 제목','원본 사진 3장 참조',835,276,380,57,31,ink,true);
 text(s,'작업 설명','의상과 배경을 바꾸고\n소개에 맞는 분위기를 만듭니다.\n\n본인 인상은 시안에서\n먼저 확인합니다.',835,364,365,225,25);
 notes(s,'원본: PULSE_AI모델_캐스팅_20260930/raw/yuho-ref-0048.png. 생성 결과: samples/03_editorial.png, Nano Banana Pro 2K 3:4, 2026-10-01. 참조 3장과 출력 지문은 samples/manifest.json. 이 사례는 내부 시안이며 고객 납품/후기/본인 얼굴 승인 사례가 아닙니다.');
 s=page(p,5,5,'CONTACT');
 text(s,'연락 제목','소개할 사진부터\n함께 쓸 자료까지.',72,159,1100,169,63,ink,true);
 text(s,'마무리 소개','유호 / SYNK',76,406,1000,61,35,accent,true);
 text(s,'홈페이지','synk.im',76,516,1000,63,31);
 notes(s,'브랜드 웹주소: SYNK 홈페이지용 주소. 예시 소개 자료이며 웹 운영 상태 검증을 뜻하지 않습니다. 실제 고객의 완성본에는 고객이 제공한 공개 연락처만 넣습니다. 크몽 등록 카드에는 이 예시의 외부 주소를 노출하지 않습니다.');
 return p;
}
for(const item of [{id:'template',filename:'AI_프로필_소개자료_양식.pptx',slides:7,presentation:template()},{id:'example',filename:'유호_프로필_소개자료_예시.pptx',slides:5,presentation:example()}]){
 const candidatePath=path.join(build,item.id+'-candidate.pptx');
 await (await PresentationFile.exportPptx(item.presentation)).save(candidatePath);
 const finalPath=path.join(workspaceDir,'output',item.filename);
 const result=await finalizePresentation({workspaceDir,candidatePath,finalPath,explicitTotalSlideCount:item.slides,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],pythonExecutable:RUNTIME_PYTHON,integrityValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy,verifyArtifactToolImport:true,receiptPath:path.join(workspaceDir,'review',item.id+'-validation.json')});
 // Render the checked final file, not the source object.
 const final=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 const slideItems=final.slides.items;
 for(let i=0;i<slideItems.length;i++){
  const slide=slideItems[i];const rendered=await final.export({slide,format:'png',scale:1});
  await fs.writeFile(path.join(workspaceDir,'review',item.id+'-'+String(i+1).padStart(2,'0')+'.png'),new Uint8Array(await rendered.arrayBuffer()));
  const layout=await slide.export({format:'layout'});await fs.writeFile(path.join(workspaceDir,'review',item.id+'-'+String(i+1).padStart(2,'0')+'.layout.json'),await layout.text());
 }
 used.push({id:item.id,file:item.filename,slides:item.slides,finalizer:result});
 console.log('Finalized and rendered '+item.filename+' ('+item.slides+' slides)');
}
await fs.writeFile(path.join(workspaceDir,'review','build-summary.json'),JSON.stringify({createdAt:'2026-10-01',font,fontAvailable:true,canvas:{width:1280,height:720},outputs:used},null,2));
