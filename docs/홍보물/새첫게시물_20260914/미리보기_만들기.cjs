'use strict';

// Read-only source collection, then generate a local review index only.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const tokens=JSON.parse(fs.readFileSync(path.join(root,'docs/디자인_토큰.json'),'utf8'));
const c=Object.fromEntries(tokens.색.킷.map(x=>[x.이름,x.hex]));
const groups=[
 ['SYNK','같은 사람, 달라진 질문','개인의 필요를 이해한다는 뜻을 7장으로 풀었습니다.','SYNK/01-비전.png','SYNK/index.html','7장 · 로컬 제작본'],
 ['SYNK SHIFT','배운 것을 펼칠 곳. 함께 성장할 사람.','기관 교육·기업 컨설팅·브랜딩과 광고·유학과 취업을 구체적인 예시로 연결합니다.','SHIFT/01-비전.png','SHIFT/index.html','7장 · 로컬 제작본'],
 ['SYNK LAB','아직 정하지 않았어요. 먼저 해보고 싶어요.','학생 6장과 보호자 4장. 한국어는 연습할 말, 몽골어는 뜻과 사용법을 맡습니다.','LAB/png/student-01.png','LAB/index.html','10장 · 원어민 감수 전'],
 ['LAB · 무음 연습 영상','아직 정하지 않았어요 — 읽고 바꿔 말하기','예문을 읽고 구절 전체를 바꾼 뒤, 자기 문장을 말해 보는 별도 읽기 연습입니다. 발음·듣기형 영상은 아닙니다.','LAB-영상/qa/1140-encoded-390.png','LAB-영상/index.html','65초 · 무음 문장 응용 · 원어민 감수 전'],
 ['LAB · 나나 음성 연습 영상','아직 정하지 않았어요 — 듣고 바꿔 말하기','공식 나나 한국어 음성을 담은 별도 편집본입니다. 예문과 전체 동사구 교체, 혼자 말할 시간을 이어갑니다. 기존 무음판은 그대로 보존했습니다.','LAB-발음영상/qa/0210-encoded-390.png','LAB-발음영상/index.html','65초 · 음성 포함 · 실제 청취·발음 미확인 · 미게시','LAB-발음영상/LAB-듣고-바꿔-말하기.mp4'],
 ['유호','움직일 눈, 남겨둘 털','이번에 새로 캡처한 실제 로컬 작업과, 그대로 두기로 한 부분을 살펴봅니다.','유호/01-털과눈.png','유호/index.html','6장 · 실제 작업 기록'],
 ['SYNK 브리핑','원본 · 움직일 곳 · 확인할 것','다른 작업에도 적용해볼 새 요청문 전문과 결과를 확인할 조건을 나눕니다.','브리핑/01-세가지.png','브리핑/index.html','6장 · 요청문 예시 포함'],
 ['새 세로 영상','움직임도, 새로 확인합니다','현재 Loom의 실제 장면을 새로 캡처해 유호의 제작 기록과 브리핑의 적용 안내로 나눴습니다.','영상/qa/yuho-0015-encoded-390.png','영상/index.html','유호 46초 · 브리핑 44초 · 로컬 영상 · 청취 확인 전'],
 ['글과 포트폴리오','각 매체에 맞는 기록','Tistory·Substack·네이버·Behance·Threads·X·LinkedIn·Pinterest를 각각 다른 읽기 경험으로 구성합니다. Substack LAB 편지는 학생 연습과 가족 대화를 함께 담았습니다.','글과포트폴리오/Pinterest-핀.png','글과포트폴리오/index.html','9개 원고 · 정지 핀'],
 ['카카오 · SYNK SHIFT','협업은 구체적인 일에서 시작합니다','기관·기업과 개인을 위한 첫 소식, 현재 준비 범위와 문의 안내를 한 편으로 정리했습니다.','카카오/대표.png','카카오/index.html','전용 첫 소식 · 문의 안내'],
 ['LAB · Telegram','내 문장으로 바꿔 말해요.','다시 찾아 쓸 질문과 답변, 바꿀 구절과 혼자 연습하는 방법을 한 글에 담았습니다.','LAB-텔레그램/qa/390-연습.png','LAB-텔레그램/index.html','텍스트 고정 안내 · 원어민 감수 전'],
 ['SYNK PULSE','마린의 작은 돌','새로 만든 두 장면에서 시작하는 이야기. 정지 시안과 실제 동작·소리 제작을 구분합니다.','PULSE/작은돌_장면01_후보.png','PULSE/index.html','정지 시안 · 영상 미완료'],
];
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cards=groups.filter(g=>fs.existsSync(path.join(__dirname,g[3]))).map(g=>{
 const ready=fs.existsSync(path.join(__dirname,g[4]));
 const link=ready?g[4]:g[3];
 const mediaLink=g[6]&&fs.existsSync(path.join(__dirname,g[6]))?`<p><a href="${encodeURI(g[6])}" style="display:inline-flex;align-items:center;min-height:44px">MP4 파일 열기</a></p>`:'';
 return `<article><a class="picture" href="${encodeURI(link)}"><img loading="lazy" src="${encodeURI(g[3])}" alt="${esc(g[0]+' 새 시안')}"/></a><div class="copy"><p class="brand">${esc(g[0])}</p><h2><a href="${encodeURI(link)}">${esc(g[1])}</a></h2><p>${esc(g[2])}</p><p class="status">${esc(g[5])}${ready?'':' · 이미지 먼저 보기'}</p>${mediaLink}</div></article>`;
}).join('');
const fontFaces=`@font-face{font-family:'SYNK Bracket';src:url('../../브랜드_폰트/SYNKBracket/SYNKBracket-Regular.ttf');unicode-range:U+300C-300D}@font-face{font-family:'SUIT Variable';src:url('../../브랜드_폰트/SUIT/SUIT-Variable.woff2');font-weight:100 900}${[['Regular',400],['Medium',500],['SemiBold',600],['Bold',700]].map(([face,weight])=>`@font-face{font-family:'Inter Tight';src:url('../../브랜드_폰트/InterTight/InterTight-${face}.ttf');font-weight:${weight}}`).join('')}`;
const css=`${fontFaces}*{box-sizing:border-box}body{margin:0;background:${c.Paper};color:${c.Ink};font:500 17px/1.65 'SYNK Bracket','Inter Tight','SUIT Variable',sans-serif;letter-spacing:-.02em;word-break:keep-all;overflow-wrap:anywhere;font-synthesis:none}a{color:inherit;text-underline-offset:.22em}main{width:min(1200px,100% - 48px);margin:0 auto;padding:72px 0}header{max-width:830px;margin-bottom:48px}.eyebrow{color:${c['Lapis Deep']};font-weight:600}h1,h2{font-family:'SUIT Variable',sans-serif;font-weight:800}h1{font-size:clamp(36px,5vw,62px);line-height:1.18;letter-spacing:-.04em;margin:18px 0 24px}h2{font-size:25px;line-height:1.35;letter-spacing:-.04em;margin:8px 0 14px}.lead{color:${c['Deep Wool']};font-size:20px}.notice{padding:22px 24px;border-left:3px solid ${c['Lapis Deep']};background:${c.Oat};margin:30px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 32px}article{border-bottom:1px solid ${c.Oat};padding-bottom:28px}.picture{display:flex;align-items:center;justify-content:center;background:${c.Oat};height:430px;overflow:hidden}.picture img{width:100%;height:100%;object-fit:contain;display:block}.copy{padding:20px 0 0}.brand{font-weight:600;margin:0}.status{color:${c['Deep Wool']};font-size:15px;font-weight:400}.links{margin:46px 0 0;display:flex;flex-wrap:wrap;gap:18px}.links a{padding:10px 16px;border:1px solid ${c['Deep Wool']};border-radius:5px}a:focus-visible{outline:3px solid ${c['Lapis Deep']};outline-offset:4px}@media(max-width:650px){main{width:calc(100% - 32px);padding-top:36px}.grid{grid-template-columns:1fr;gap:32px}.picture{height:420px}.lead{font-size:18px}.notice{padding:18px}.links{display:grid}}`;
fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SYNK · 새 첫 장면</title><style>${css}</style></head><body><main><header><p class="eyebrow">SYNK · 2026.09.14</p><h1>새로운 첫 장면.</h1><p class="lead">새 철학과 비전에서 출발해, 각 채널의 상대와 쓰임에 맞춰 만든 시안입니다.</p><div class="notice">게시물은 아직 발행하지 않았습니다. 프로필 변경의 공개 저장·원어민 감수·영상 동작과 음원은 별도 진행 상태입니다. 화면별 제작 상태를 확인하며 봐 주세요.</div></header><section class="grid" aria-label="새 게시물 시안">${cards}</section><nav class="links" aria-label="관련 자료"><a href="커버/index.html">새 커버 11종</a><a href="../../마케팅/전사새출발_20260914/진행과검증.md">실제 진행과 남은 일</a><a href="../../마케팅/전사새출발_20260914/제작선정.md">콘텐츠 선택의 이유</a></nav></main></body></html>`);
console.log(JSON.stringify({output:path.join(__dirname,'index.html'),groups:groups.length,status:'local-review-not-published'}));
