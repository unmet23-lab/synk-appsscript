const fs=require('node:fs'),path=require('node:path');
const here=path.resolve(__dirname,'../..');
const service=JSON.parse(fs.readFileSync(path.join(here,'service.json'),'utf8'));
service.schemaVersion=2;
service.title='AI 프로필 사진과 바로 쓰는 소개 PPT';
service.subtitle='원본 사진으로 프로필을 만들고, 사진과 소개글을 넣은 PPT까지 완성해드립니다.';
service.keywords=['AI프로필','프로필사진','자기소개PPT','강사프로필','개인브랜딩'];
service.ppt={templateLayouts:7,templateFile:'ppt/output/AI_프로필_소개자료_양식.pptx',exampleFile:'ppt/output/유호_프로필_소개자료_예시.pptx',sharePdf:'ppt/output/유호_프로필_소개자료_예시.pdf',aspectRatio:'16:9',deliveryFormats:['pptx','pdf'],editableText:true,replaceableImages:true,layouts:['표지','짧은 소개','주요 경력','제공 서비스','작업 사례','진행 방식','연락처'],scope:'고객 제공 소개글·확인된 경력·공개할 연락처를 짧게 다듬고 납품 사진과 함께 기존 양식에 배치. 표지 포함 3/5/7장.',exclusions:'장문 원고 신규 집필·자료 조사·성과/경력 발굴·별도 브랜드 디자인·발표 애니메이션·추가 장수는 별도 협의.'};
service.packages.forEach((p,i)=>{p.completedPptSlides=[3,5,7][i];p.templateLayouts=7;p.pptFormats=['pptx','pdf'];p.description=['프로필 최종 3컷과 표지·소개·연락처 PPT 3장 완성. 편집용 7가지 양식도 드립니다.','2개 콘셉트 최종 6컷과 표지·소개·서비스·작업 사례·연락처 PPT 5장 완성. 편집용 7가지 양식도 드립니다.','3개 콘셉트 최종 10컷과 경력·진행 방식을 더한 소개 PPT 7장 완성. 편집용 7가지 양식도 드립니다.'][i]});
service.serviceDescription=service.serviceDescription
 .replace('사진은 있지만, 나를 소개할 프로필로 쓰기에는 옷이나 배경이 아쉬우신가요?','프로필 사진과 나를 소개할 자료를 한 번에 준비하고 싶으신가요?')
 .replace('스튜디오에서 새로 촬영하는 서비스가 아니라, 보내주신 사진으로 새 장면을 만드는 이미지 제작 서비스입니다.','보내주신 사진으로 새 프로필 장면을 만드는 AI 이미지 제작 서비스입니다. 실제 사진 촬영은 포함하지 않습니다. 완성된 사진과 고객이 보내주신 소개글을 넣어 바로 활용할 소개 PPT까지 만들어드립니다.')
 .replace('[패키지]\n','[PPT 양식과 완성 작업 포함]\n모든 패키지에 16:9 편집용 PPT 양식 7가지를 드립니다. 표지·짧은 소개·주요 경력·제공 서비스·작업 사례·진행 방식·연락처로 구성되며, 필요한 장을 골라 다시 쓸 수 있습니다. 양식만 전달하는 데서 끝내지 않고, 납품 사진과 고객이 제공한 소개 내용을 배치해 패키지별 3/5/7장(표지 포함)을 완성합니다.\n텍스트를 수정하고 사진을 바꿀 수 있는 .pptx와 공유용 PDF를 함께 드립니다. 소개글은 고객 제공 자료를 바탕으로 짧게 다듬습니다. 경력·자격·성과 수치를 임의로 추가하지 않습니다. 공개할 이름 또는 활동명·직함, 짧은 소개글, 넣고 싶은 경력이나 서비스, 공개할 연락처를 보내주세요. 없는 항목은 용도에 맞게 다른 장으로 조정합니다.\n\n[패키지]\n')
 .replace('최종 3컷 / 대표 시안','최종 3컷 + 완성 PPT 3장 / 대표 시안')
 .replace('최종 6컷 / 대표 시안','최종 6컷 + 완성 PPT 5장 / 대표 시안')
 .replace('최종 10컷 / 대표 시안','최종 10컷 + 완성 PPT 7장 / 대표 시안')
 .replace('편집 프로젝트 원본은 포함하지 않습니다.','이미지 생성·보정 프로젝트 원본은 포함하지 않습니다. PPT 편집 원본은 포함합니다. 장문 발표 원고 신규 집필·자료 조사·별도 브랜드 디자인·애니메이션·추가 슬라이드는 별도 협의합니다.');
service.procedure='1. 자료 확인: 원본 사진 3~5장, 사용할 곳과 PPT에 넣을 소개 내용을 확인합니다.\n2. 방향 합의: 콘셉트와 컷 배분, PPT 장수·목차·색감, 가격·착수일과 AI 도구의 사진 처리 조건을 정합니다.\n3. 대표 시안: 콘셉트당 후보 2개를 공유해 본인 인상과 제작 방향을 확인합니다.\n4. 사진과 PPT 제작: 선택한 사진을 완성하고, 제공된 소개 내용을 정리해 양식에 배치합니다.\n5. 수정과 전달: 사진·PPT 의견을 한 번에 모아 패키지별 수정 후 최종 JPG·크롭·완성 PPTX·PDF·편집용 양식을 전달합니다.';
service.modificationPolicy=service.modificationPolicy.replace('확정한 콘셉트 안의 색감,','PPT는 합의한 장수 안에서 제공 문구의 오탈자·사진 배치·색감·간격을 조정합니다. 사진과 PPT 피드백을 함께 취합해 같은 수정 회차로 처리합니다. 확정한 콘셉트 안의 색감,').replace('새 콘셉트, 추가 컷,','새 콘셉트, 추가 컷·슬라이드, PPT 목차 전면 변경이나 새 자료를 넣는 재구성,');
service.scheduleNote=service.scheduleNote.replace('사진 처리 안내가','PPT 소개 내용·사진 처리 안내가');
service.faqs[3].answer='긴 변 2,048px 이상의 최종 JPG와 정사각형 크롭, 7가지 편집용 PPT 양식, 사진·소개글을 넣어 완성한 PPTX와 PDF를 드립니다. 완성 PPT는 패키지별 표지 포함 3/5/7장입니다. 신분증·여권·신원 인증용 사진은 제공 범위가 아닙니다.';
service.faqs.push({question:'PPT에는 어떤 내용을 넣어주나요?',answer:'이름 또는 활동명·직함, 짧은 소개, 제공해주신 경력·서비스·작업 사례와 공개할 연락처를 사진과 함께 배치합니다. 없는 항목은 용도에 맞게 조정합니다. 장문 원고 신규 집필이나 자료 조사, 추가 장수는 별도 협의합니다.'});
service.requirements.push({title:'소개 PPT에 넣을 내용',type:'서술형/파일첨부',required:true,description:'공개할 이름 또는 활동명·직함, 짧은 소개글, 넣고 싶은 경력·서비스·작업 사례를 보내주세요. 공개 연락처·로고·기존 소개 자료는 원할 때 첨부해주세요. 없는 항목은 비워두고 PPT 용도와 기타 메모를 남겨주세요. 신분증·생년월일은 필요하지 않습니다.'});
service.assets.detailImages.push('images/05_ppt.png');
fs.writeFileSync(path.join(here,'service.json'),JSON.stringify(service,null,2)+'\n');
let guide=fs.readFileSync(path.join(here,'고객_준비안내.txt'),'utf8');
guide=guide.replace('이름·생년월일·신분증 자료는 필요하지 않습니다.','신분증과 생년월일은 필요하지 않습니다. PPT에는 공개할 이름 또는 활동명을 사용합니다.');
guide=guide.replace('외부 AI 도구에 사진을 입력해','4. 소개 PPT에 넣을 내용\n공개할 이름 또는 활동명·직함, 짧은 소개글, 넣고 싶은 경력·서비스·작업 사례를 보내주세요. 공개 연락처·로고·기존 소개 자료는 원할 때 함께 보내주세요. 없는 항목은 비워두고 PPT 용도와 기타 메모를 남겨주세요.\n\n모든 패키지에 편집용 PPT 양식 7가지를 제공하며, 사진과 제공 내용을 배치한 3/5/7장 완성본을 PPTX와 공유용 PDF로 드립니다. 표지가 장수에 포함됩니다. 경력이나 성과는 전달하신 사실만 사용합니다.\n\n외부 AI 도구에 사진을 입력해');
guide=guide.replace('나머지 컷 제작 → 취합 수정 → 최종 파일 전달','나머지 컷과 소개 PPT 제작 → 사진·PPT 취합 수정 → 최종 사진·완성 PPTX/PDF·양식 전달');
fs.writeFileSync(path.join(here,'고객_준비안내.txt'),guide);
let build=fs.readFileSync(path.join(here,'build.cjs'),'utf8');
function change(a,b){if(!build.includes(a))throw new Error('Missing build target: '+a.slice(0,70));build=build.replace(a,b)}
change("  const img=(src,alt,cls='')", "  const deckImages=[];\n  for(const number of ['01','03']){const filename='ppt-example-'+number+'.jpg';await sharp(path.join(here,'ppt','review','example-'+number+'.png')).resize({width:1100}).jpeg({quality:92}).toFile(path.join(here,'images',filename));deckImages.push(data(path.join(here,'images',filename),'image/jpeg'));}\n  const img=(src,alt,cls='')");
change('새 촬영 없이,<br>나를 소개할 사진.','사진 + 소개 PPT,<br>바로 쓸 수 있게.');
change('원본 사진으로 제작한 AI 프로필 시안','AI 프로필 제작 + PPT 양식·완성 작업 포함');
change('나머지 컷 제작·검수<br>취합 수정 후 최종 파일','사진 + 소개 PPT 제작<br>취합 수정 후 최종 파일');
change('<strong>최종 JPG + SNS용 크롭</strong>긴 변 2,048px 이상 · 기본 세로 3:4<br>같은 사진의 정사각형 크롭은 추가 컷으로 세지 않아요.','<strong>사진 + 바로 쓰는 소개 PPT</strong>최종 JPG·SNS 크롭 + 편집용 PPT 양식 7가지<br>사진·소개글을 넣은 PPT 3/5/7장 · PPTX + PDF');
change("  for(const [name,html]", "  const pptCard=`<main class=\"detail\">${head('사진을 받은 뒤,<br>소개 자료까지 완성.','PPT 포함')}<p class=\"intro\">양식 제공 + 사진·소개글 배치까지 함께 합니다.</p><div style=\"display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:46px\">${deckImages.map((src,i)=>'<figure>'+img(src,'편집 가능한 유호 소개 PPT 예시 '+(i+1))+'<figcaption>'+['프로필 표지 예시','제공 서비스 소개 예시'][i]+'</figcaption></figure>').join('')}</div><div class=\"deliver\" style=\"margin-top:55px\"><strong>편집용 7가지 양식 + 완성 PPT</strong>STANDARD 3장 / DELUXE 5장 / PREMIUM 7장<br>표지 포함 · 수정 가능한 PPTX + 공유용 PDF<br>사진·소개글·제공된 경력과 공개 연락처를 배치합니다.</div><p class=\"foot\">PPT 예시는 내부 시안 · 고객 제공 내용을 짧게 다듬어 배치하는 범위<br>장문 원고·자료 조사·별도 브랜드 디자인·추가 장수는 별도 협의</p></main>`;\n  for(const [name,html]");
change("['04_process',process]])", "['04_process',process],['05_ppt',pptCard]])");
change("+'컷 · '+p.deliveryDays", "+'컷 + 완성 PPT '+p.completedPptSlides+'장 · '+p.deliveryDays");
change('옷과 배경, 조명과 구도를 맞춥니다.','옷과 배경, 조명과 구도를 맞춥니다.<br>사진과 소개글을 넣은 PPT도 완성해드려요.');
change("+'일 · 수정 '+p.revisions+'회</p><p>'", "+'일 · 수정 '+p.revisions+'회<br>완성 PPT '+p.completedPptSlides+'장 + 7가지 양식</p><p>'");
change("['완성과 전달','나머지 컷 제작·검수와 취합 수정 후 파일을 드려요.']", "['완성과 전달','사진과 소개 PPT를 제작하고 취합 수정 후 파일을 드려요.']");
change('유지할 얼굴·헤어 특징과 피하고 싶은 보정을 알려주세요.</p>','유지할 얼굴·헤어 특징과 피하고 싶은 보정을 알려주세요.<br>PPT에 넣을 활동명·직함·짧은 소개와 공개할 자료도 함께 보내주세요.</p>');
change('<section class="section"><h2>대표 시안에서 먼저 맞춥니다.</h2>', '<section class="section"><h2>소개 PPT까지 바로 쓸 수 있게.</h2><p class="sub">편집용 양식 7가지를 드리고, 사진과 제공하신 소개 내용을 넣어 완성합니다.<br>표지 포함 3/5/7장 · 수정 가능한 PPTX와 공유용 PDF.</p><div class="ppt-preview">${deckImages.map((src,i)=>\'<figure style="margin:0">\'+img(src,\'유호 소개 PPT 예시 \'+(i+1))+\'<figcaption class="note">\'+[\'프로필 표지\',\'제공 서비스 소개\'][i]+\'</figcaption></figure>\').join(\'\')}</div><p class="note">유호 내부 예시입니다. 고객의 경력·성과를 임의로 만들지 않고 전달받은 사실만 사용합니다.<br>양식 구성: 표지 / 짧은 소개 / 주요 경력 / 제공 서비스 / 작업 사례 / 진행 방식 / 연락처</p><p><a href="ppt/output/AI_프로필_소개자료_양식.pptx" download>편집용 양식 PPTX</a> · <a href="ppt/output/유호_프로필_소개자료_예시.pptx" download>유호 완성 예시 PPTX</a> · <a href="ppt/output/유호_프로필_소개자료_예시.pdf" download>예시 PDF</a></p><p class="note">PPTX·PDF 링크는 압축을 푼 자료 폴더에서 열 수 있습니다. HTML만 따로 옮기면 이미지 미리보기는 보이지만 파일 링크는 열리지 않습니다.</p></section><section class="section"><h2>대표 시안에서 먼저 맞춥니다.</h2>');
change('FAQ 5개·필수 작업 전 요청 3개','FAQ 6개·필수 작업 전 요청 4개');
change('등록용 이미지 4장 보기','등록용 이미지 5장 보기');
change('상세 3장 1304×1280','상세 4장 1304×1280');
change('등록용 카드·고객 안내.','등록용 카드·고객 안내·편집용 PPT 양식과 완성 예시.');
change('previewStyle+`.stitch','previewStyle+`.ppt-preview{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:30px}.ppt-preview img{width:100%;border:1px solid #e9e2e8}@media(max-width:700px){.ppt-preview{grid-template-columns:1fr}}.stitch');
change('Built standalone preview, 4 card sources','Built standalone preview, 5 card sources');
fs.writeFileSync(path.join(here,'build.cjs'),build);
let render=fs.readFileSync(path.join(here,'render.cjs'),'utf8').replaceAll("'03_concepts','04_process'", "'03_concepts','04_process','05_ppt'").replace('4 cards rendered','5 cards rendered');
fs.writeFileSync(path.join(here,'render.cjs'),render);
let pack=fs.readFileSync(path.join(here,'package.cjs'),'utf8').replace("'images/04_process.png'", "'images/04_process.png','images/05_ppt.png','ppt/output/AI_프로필_소개자료_양식.pptx','ppt/output/유호_프로필_소개자료_예시.pptx','ppt/output/유호_프로필_소개자료_예시.pdf','ppt/output/PPT_사용안내.txt','ppt/output/fonts/SUIT-Variable.ttf','ppt/output/fonts/LICENSE_OFL.txt'").replace('상세 3장이 등록용 PNG입니다.', '상세 4장이 등록용 PNG입니다.\\nppt/output 폴더에는 편집용 양식 7장, 유호 소개 예시 PPTX 5장과 공유용 PDF, 사용 안내와 SUIT 글꼴이 있습니다.');
fs.writeFileSync(path.join(here,'package.cjs'),pack);
console.log('Added editable PPT template and completed PPT 3/5/7 slides to service, intake, preview, cards and ZIP source.');
