const fs=require('node:fs'),path=require('node:path');
const serviceDir=path.resolve(__dirname,'../..'),root=path.resolve(serviceDir,'../../..');
function edit(file,changes){let text=fs.readFileSync(file,'utf8');for(const [from,to] of changes){if(!text.includes(from))throw new Error('Missing text in '+file+': '+from);text=text.replace(from,to)}fs.writeFileSync(file,text)}
edit(path.join(serviceDir,'README.md'),[
 ['크몽 입력용 FAQ 5개와 필수 요청 3개','크몽 입력용 FAQ 6개와 필수 요청 4개'],
 ['메시지에 붙일 자료 준비 안내다.','메시지에 붙일 사진·PPT 자료 준비 안내다.'],
 ['이름·생년월일·신분증 같은 자료는 받지 않는다.','PPT에는 공개할 이름 또는 활동명과 소개 내용만 받으며 실명 확인은 요구하지 않는다. 생년월일·신분증은 받지 않는다. 연락처는 고객이 공개를 원할 때만 넣는다.'],
 ['상담·원본 확인·후보 생성·검수·수정 시간','상담·원본 확인·후보 생성·검수·소개글 정리·PPT 배치·수정 시간'],
 ['카드 4장을 PNG','카드 5장을 PNG'],
 ['상세 3장: 원본/결과·3가지 용도·진행과 제공 파일.','상세 4장: 원본/결과·3가지 용도·진행과 제공 파일·PPT 양식과 완성 작업.']
]);
edit(path.join(serviceDir,'검증_기록.md'),[
 ['FAQ 5개, 필수 요청 3개.','FAQ 6개, 필수 요청 4개.'],
 ['상세 PNG 3개','상세 PNG 4개'],
 ['최종 카드 4장도 직접 봤다.','PPT 추가 후 최종 카드 5장을 직접 봤다. PPT 카드도 이미지 크기와 하단 안내 간격을 조정해 최종 넘침·겹침 검사를 통과했다.'],
 ['textarea 3,860자를 확인했다. 전체 등록 카드 4장','textarea의 실제 원고를 확인했다. PPT 추가 후 최종 글자 수는 review/browser-check.json에 기록했다. 전체 등록 카드 5장'],
 ['완료: 신규 AI 시안 3장, 원본 비교 미리보기, 크몽용 메인 1장·상세 3장, 소개·제안 가격·수정 조건·FAQ·요청 문구, 고객 자료 준비 안내, 등록 준비 ZIP.','완료: 신규 AI 시안 3장, 원본 비교 미리보기, 크몽용 메인 1장·상세 4장, 소개·제안 가격·수정 조건·FAQ·요청 문구, 고객 자료 준비 안내, PPT 양식 7장·유호 예시 5장·공유 PDF·사용 안내·글꼴, 등록 준비 ZIP.']
]);
fs.appendFileSync(path.join(serviceDir,'검증_기록.md'),`\n## PPT 포함 후 확인 — 2026-10-01\n\n- 사용자 요청에 따라 모든 패키지에 편집용 양식 7가지를 포함하고, 제공된 사진·소개 내용을 배치하는 완성 작업 3/5/7장(표지 포함)을 제안 구성에 추가했다. 가격은 기존 제안 유지, PPT 제작 시간을 포함한 실제 원가 검증 전이다.\n- 번들 @oai/artifact-tool로 PPTX 2개 생성. 양식 7장, 유호 소개 예시 5장. 스킬 finalizer의 패키지 구조·슬라이드 크기·장수·글꼴 정책·heading fit·재가져오기 검사 통과. ppt/review/template-validation.json, example-validation.json.\n- 최종 PPTX를 다시 가져와 각 장을 렌더하고 12장 모두 개별 화면으로 확인했다. 1280×720, SUIT Variable. 의도하지 않은 잘림·겹침 없음. 양식의 대괄호 문구와 사진 자리는 의도된 편집 안내이며 예시에는 미완성 대괄호 문구가 없다.\n- PPTX 내부 XML에서 모든 장에 개별 네이티브 텍스트 상자와 그림이 있는지 확인했다. 양식 텍스트 상자 6~13개/장, 예시 6~13개/장. 각 장 발표자 노트 보존. 전체 슬라이드를 이미지 하나로 납품하지 않는다. ppt/review/delivery-check.json.\n- 공유용 PDF 5페이지, 960×540pt. 글꼴 설치 없이 읽도록 최종 슬라이드 이미지를 사용한 PDF다. Poppler로 PDF 5페이지를 다시 렌더해 전부 확인했다. PDF 자체의 텍스트 검색·편집은 제공하지 않으며 PPTX가 편집 원본이다.\n- SUIT Variable TTF와 SIL OFL 라이선스 동봉. PPTX 글꼴 내장은 확인하지 않았고, 실제 Microsoft PowerPoint/Google Slides에서 열기·편집·폰트 적용은 검증하지 않았다. 다른 기기에서는 PDF로 바로 보거나 동봉 글꼴 설치 후 PPT를 확인한다.\n- 미리보기의 PPT 링크 3개가 존재하는 로컬 PPTX/PDF를 가리키는지 확인하고, 최종 ZIP에도 동일한 경로로 넣는다. HTML만 따로 이동하면 상대 파일 링크는 작동하지 않는다는 안내를 표시했다.\n- 고객 준비 안내의 '이름 자료 불필요'를 PPT에 공개할 이름 또는 활동명을 받는 조건으로 갱신했다. 생년월일·신분증은 요구하지 않는다. 고객이 제공한 경력·성과·연락처만 배치한다.\n`);
edit(path.join(root,'docs/마케팅/PULSE.md'),[
 ['담당 원고·시안·크몽용 이미지·고객 준비 안내는 [AI 프로필 등록 준비]', '후속 요청에 따라 편집용 PPT 양식과 사진·소개글을 넣어 완성하는 작업도 서비스에 포함한다. 담당 원고·시안·크몽용 이미지·고객 준비 안내·PPT는 [AI 프로필 등록 준비]'],
 ['3/6/10컷, 39,000/79,000/149,000원과 납기는 제안이며 사용자 확정 전이다.','3/6/10컷 + 완성 PPT 3/5/7장(표지 포함), 공통 편집용 양식 7가지를 제안 구성으로 정리했다. 39,000/79,000/149,000원과 납기는 제안이며 실제 사진·PPT 원가 검증과 사용자 가격 확정 전이다.']
]);
edit(path.join(root,'docs/_ops/트랙.md'),[
 ['- 요청: 인터뷰 원본 사진 몇 장으로 현재 PULSE 유호 모델처럼 프로필 사진을 제작하는 크몽 서비스 추가 준비.','- 요청: 인터뷰 원본 사진 몇 장으로 현재 PULSE 유호 모델처럼 프로필 사진을 제작하는 크몽 서비스 추가 준비. 후속으로 사진 제작 후 바로 쓸 편집용 PPT 양식 제공과 소개 자료 완성 작업까지 포함.'],
 ['메인 1장·상세 3장, 등록 문구·FAQ 5개·필수 요청 3개·고객 안내·등록 준비 ZIP.','메인 1장·상세 4장, 등록 문구·FAQ 6개·필수 요청 4개·고객 안내·편집용 PPT 양식 7장·유호 소개 예시 5장 PPTX와 PDF·사용 안내/글꼴·등록 준비 ZIP.'],
 ['카드 실제 화면에서 잘림을 고쳐 재렌더했다. [검증 기록]','카드 실제 화면에서 잘림을 고쳐 재렌더했다. PPTX 2개의 finalizer 검사, 네이티브 글/그림 구조, 최종 12장 렌더와 공유 PDF 5페이지를 확인했다. PowerPoint/Google Slides 실제 편집은 미검증이다. [검증 기록]'],
 ['3/6/10컷 39,000/79,000/149,000원은 제안.','3/6/10컷 + 완성 PPT 3/5/7장 39,000/79,000/149,000원은 제안이며 사진·PPT 제작 원가 검증 전.']
]);
console.log('Updated current README, verification record, PULSE scope and matching operations track.');
