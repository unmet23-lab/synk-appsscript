const fs=require('node:fs'),path=require('node:path');
const core=require('../클라이언트_발주서_20260930/src/core.js');
const here=__dirname;
(async()=>{
  const names=['미리보기.html','등록_붙여넣기.txt','고객_준비안내.txt','service.json','검증_기록.md','images/01_main.png','images/02_before_after.png','images/03_concepts.png','images/04_process.png','images/05_ppt.png','ppt/output/AI_프로필_소개자료_양식.pptx','ppt/output/유호_프로필_소개자료_예시.pptx','ppt/output/유호_프로필_소개자료_예시.pdf','ppt/output/PPT_사용안내.txt','ppt/output/fonts/SUIT-Variable.ttf','ppt/output/fonts/LICENSE_OFL.txt'];
  const entries=names.map(name=>({name,data:fs.readFileSync(path.join(here,name))}));
  entries.unshift({name:'먼저_읽어주세요.txt',data:'\uFEFF크몽 AI 프로필 서비스 등록 준비 자료 · 2026-10-01\n\n압축을 풀고 미리보기.html을 Chrome 또는 Edge로 열어주세요. 사진과 글꼴이 파일 안에 들어 있어 인터넷 없이 볼 수 있습니다.\n등록_붙여넣기.txt에는 제목·가격 제안·서비스 소개·수정 안내·FAQ·필수 요청이 있습니다.\n고객_준비안내.txt는 크몽 메시지에 붙일 원본 준비 안내입니다.\nimages 폴더의 메인 1장·상세 4장이 등록용 PNG입니다.\nppt/output 폴더에는 편집용 양식 7장, 유호 소개 예시 PPTX 5장과 공유용 PDF, 사용 안내와 SUIT 글꼴이 있습니다.\n\n이 자료는 준비 시안입니다. 크몽 사이트 임시저장·심사 제출·판매 시작은 하지 않았습니다. 가격·납기와 공개할 샘플, 고객용 AI 도구와 사진 처리/보관·삭제 안내는 판매 전에 확정합니다.\n샘플은 유호 인터뷰 원본으로 만든 내부 시안이며 고객 사례나 얼굴 동일성 승인이 아닙니다.\n\n이 ZIP은 검토·등록 준비용 자료만 포함합니다. 생성 PNG 원본·제작 코드·완료 작업 기록·상세 브라우저 증거는 SYNK 저장소 docs/마케팅/크몽_AI프로필_20261001에 있습니다.\n'});
  const zip=await core.zip(entries);
  fs.writeFileSync(path.join(here,'크몽_AI프로필_등록준비.zip'),Buffer.from(await zip.arrayBuffer()));
  console.log('Prepared '+entries.length+' ZIP entries, '+zip.size+' bytes');
})().catch(e=>{console.error(e);process.exitCode=1});
