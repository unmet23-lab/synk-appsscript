'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,shots=require('./video/shot-map.json'),script=require('./narration-script.json');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const images=fs.readdirSync(path.join(root,'video/review-frames')).filter(s=>s.endsWith('.png')).sort();
const fixes=fs.existsSync(path.join(root,'video/review-fixes'))?fs.readdirSync(path.join(root,'video/review-fixes')).filter(s=>s.endsWith('.png')).sort():[];
const changed=[29,31,32];
fs.writeFileSync(path.join(root,'scene-review.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yuhobuilds 2편 · 수정 장면 시안</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f3f8;color:#101827;font:17px/1.65 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:32px 22px}header{max-width:850px;margin-bottom:30px}h1{font-size:34px;line-height:1.25}.badge{display:inline-block;background:#3d6bc9;color:#fff;padding:5px 12px;border-radius:30px;font-size:14px}a{color:#2857b7}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}figure{margin:0}img{width:100%;height:auto;border-radius:12px;box-shadow:0 8px 25px #17244520}figcaption{font-size:15px;font-weight:700;padding:8px 0}details{max-width:900px;margin:35px 0;padding:20px;background:white;border-radius:12px}summary{cursor:pointer;font-weight:700}li{margin:12px 0}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:27px}}@media(max-width:450px){.grid{grid-template-columns:1fr}}</style><main><header><span class="badge">장면 시안 · 새 음성 연결 대기</span><h1>AI 추천이 다를 때,<br>선택은 내가</h1><p>‘두 AI 모델’과 추천받았다는 회고형 문장으로 바꾸고, 다른 모델에 두 방법을 비교해 달라고 묻는 예시를 넣었습니다. 무료 이용 한도와 자신의 판단까지 이어집니다.</p><p>아래는 수정한 36개 장면입니다. 새 내레이션 합성 전이라 자막과 전환 시점은 임시 배치이며, 최종 영상은 아직 출력하지 않았습니다.</p><a href="따라_물어볼_질문.md">복사해서 물어볼 질문 보기</a></header><div class="grid">${shots.map((s,i)=>{const fi=changed.indexOf(i),src=fi>=0&&fixes[fi]?'video/review-fixes/'+fixes[fi]:'video/review-frames/'+images[i];return`<figure><img src="${encodeURI(src)}" alt="${esc(s.name)}" loading="lazy"><figcaption>${String(i+1).padStart(2,'0')} · ${esc(s.name)}</figcaption></figure>`;}).join('')}</div><details><summary>수정한 내레이션 전체</summary><ol>${script.segments.map(s=>`<li>${esc(s.text)}</li>`).join('')}</ol></details></main></html>`);
if(fs.existsSync(path.resolve(root,'../preview-v3.html'))&&fs.existsSync(path.join(root,'video/final-validation.json'))){
  const target=path.join(root,'scene-review.html');
  let page=fs.readFileSync(target,'utf8'),index=0;
  page=page.replace('장면 시안 · 새 음성 연결 대기','V3 영상 완성 · 최종 출력 장면');
  page=page.replace('아래는 수정한 36개 장면입니다. 새 내레이션 합성 전이라 자막과 전환 시점은 임시 배치이며, 최종 영상은 아직 출력하지 않았습니다.','정의로 내레이션과 BGM을 넣은 75초 영상을 완성했습니다. 아래는 완성 MP4에서 추출한 36개 장면입니다.');
  page=page.replace('<a href="따라_물어볼_질문.md">','<p><a href="../preview-v3.html"><strong>▶ 완성 영상 재생하기</strong></a> · <a href="../yuhobuilds_EP02_v3.mp4" download>MP4 저장</a></p><a href="따라_물어볼_질문.md">');
  page=page.replace(/<img src="[^"]+"/g,()=>`<img src="video/final-review/shot-${String(++index).padStart(2,'0')}.jpg"`);
  fs.writeFileSync(target,page);
}
console.log('Scene review ready');
