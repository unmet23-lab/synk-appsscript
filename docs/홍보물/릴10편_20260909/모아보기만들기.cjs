'use strict';
const fs=require('fs'),path=require('path');
const base=path.resolve(__dirname,'../../..');
const {createRequire}=require('module');
const runtime=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const sharp=runtime('sharp');
const loom=require(path.join(base,'tools/lib/loom.js'));
const tokens=require(path.join(base,'docs/디자인_토큰.json'));
const palette=Object.fromEntries(tokens.색.킷.map(x=>[x.이름,x.hex]));
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'대본.json')));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)};
async function main(){
  const all=[],sceneSheets=[];
  for(const r of data.reels){
    const files=fs.existsSync(path.join(__dirname,'제공자료'))?fs.readdirSync(path.join(__dirname,'제공자료')).filter(f=>f.startsWith(r.id+'-resource-')&&f.endsWith('.png')):[];
    write(path.join(__dirname,'게시문안',r.id+'.txt'),r.captionMn+'\n\n--- 자료를 실제 첨부하며 보내는 답글 ---\n'+r.replyMn+'\n');
    const sceneFiles=[1,2,3,4,5].map(i=>path.join(__dirname,'검사',`${r.id}-scene-${i}.png`));
    if(sceneFiles.every(f=>fs.existsSync(f))){
      const shots=[];for(const [i,f]of sceneFiles.entries())shots.push({input:await sharp(f).resize(270,480).png().toBuffer(),left:i*286,top:0});
      const f=path.join(__dirname,'검사',r.id+'-전체장면.png');
      await sharp({create:{width:1414,height:480,channels:3,background:palette.Oat}}).composite(shots).png().toFile(f);sceneSheets.push(f);
    }
    const cover=path.join(__dirname,'표지',r.id+'-cover.png');
    if(fs.existsSync(cover))all.push({input:await sharp(cover).resize(216,384).png().toBuffer(),left:(Number(r.id.slice(-2))-1)%5*232,top:Math.floor((Number(r.id.slice(-2))-1)/5)*400});
    r.resourceFiles=files;
  }
  if(all.length)await sharp({create:{width:1144,height:784,channels:3,background:palette.Oat}}).composite(all).png().toFile(path.join(__dirname,'10편-모아보기.png'));
  const cards=data.reels.map(r=>`<article id="${r.id}"><div class="media"><video controls preload="none" poster="표지/${r.id}-cover.png" src="영상/${r.id}.mp4" playsinline></video></div><div class="copy"><span class="eyebrow">${r.id.slice(-2)} / 10 · 댓글 키워드 ${escape(r.keywordMn)}</span><h2>${escape(r.titleKo)}</h2><p class="hook">${escape(r.hookMn)}</p><p>${escape(r.gift.titleKo)}</p><nav><a href="영상/${r.id}.mp4" download>영상</a><a href="표지/${r.id}-cover.png" download>표지</a>${r.resourceFiles.map((f,i)=>`<a href="제공자료/${f}" download>제공 카드 ${i+1}</a>`).join('')}<a href="게시문안/${r.id}.txt" download>설명글·답글</a></nav><details><summary>게시할 몽골어 설명글</summary><pre>${escape(r.captionMn)}</pre><button type="button" data-copy="${r.id}">설명글 복사</button><span class="status" role="status"></span></details><details><summary>실제 카드와 함께 보낼 답글</summary><pre>${escape(r.replyMn)}</pre></details><details><summary>한국어 장면 구성</summary>${r.beats.map(b=>`<p><b>${b.start}–${b.start+b.seconds}초</b> ${escape(b.ko)}<br><span>${escape(b.mn)}</span></p>`).join('')}</details></div></article>`).join('');
  const css=`${loom.css({지면:'부품만',구움:false})}
@font-face{font-family:InterTight;src:url('../../브랜드_폰트/InterTight/InterTight-Regular.ttf')}@font-face{font-family:SUIT;src:url('../../브랜드_폰트/SUIT/SUIT-Regular.otf')}
body{word-break:keep-all;overflow-wrap:break-word}
*{box-sizing:border-box}html{background:${palette.Paper};color-scheme:light}body{margin:0;background:${palette.Paper};color:${palette.Ink};font-family:InterTight,SUIT,sans-serif;line-height:1.55}main{max-width:1280px;margin:auto;padding:64px 40px}header{max-width:840px;margin:0 0 64px}header img{width:200px;margin-bottom:38px}h1{font-size:44px;line-height:1.15;letter-spacing:-.04em;margin:16px 0 24px}p{color:inherit}a{color:${palette['Coral 3']};text-underline-offset:4px}header .note{color:${palette['Ash Wool']||palette.Ink};font-size:15px}article{display:grid;grid-template-columns:340px 1fr;gap:48px;padding:48px 0;border-top:1px solid ${palette.Stitch}}video{display:block;width:100%;aspect-ratio:9/16;background:${palette.Oat};border-radius:20px}.eyebrow{font-size:14px;font-weight:600;color:${palette['Coral 3']}}h2{font-size:31px;line-height:1.2;margin:16px 0}.hook{font-size:24px;line-height:1.25}nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:30px 0}details{border-top:1px solid ${palette.Stitch};padding:16px 0}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:16px}button{background:${palette.Ink};color:${palette.Paper};border:0;border-radius:10px;font:inherit;padding:10px 18px;cursor:pointer}.status{margin-left:12px;font-size:14px}@media(max-width:760px){main{padding:32px 22px}h1{font-size:32px}article{grid-template-columns:1fr;gap:28px}.media{max-width:380px;margin:auto;width:100%}h2{font-size:27px}}`;
  const index=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK LAB · 도움을 주는 릴 10편</title><style>${css}</style></head><body><main><header><img src="../브랜드소개_20260909/로고디테일/로고_투명/SYNK-LAB-기본형-4K.png" alt="SYNK LAB"><p class="eyebrow">2026.09.09 · 10 REELS / 10 USEFUL NOTES</p><h1>재밌게 이해하고,<br>필요할 때 꺼내 쓰는 한국어.</h1><p>영상에서 답 하나를 먼저 줍니다. 더 필요한 학생에게는 상황별 카드를 제공합니다. 댓글이 없어도 설명글의 문장 전체를 읽고 사용할 수 있습니다.</p><p class="note">파일 검토·전달용 모아보기입니다. 아직 공개 게시하지 않았고, 자동 메시지 발송도 연결하지 않았습니다. 음성 강의가 아닌 자막·배경음악 영상입니다.</p><p><a href="읽어주세요.md">제작 범위·운영 안내</a> · <a href="독립검토.md">기획 검토</a> · <a href="번역검수.md">번역 검토</a></p></header>${cards}<footer>10편의 실제 반응을 본 뒤 후속 주제·자료를 조정합니다. 옛 45편 원본은 보관하며 이번 제작 대상에 포함하지 않았습니다.</footer></main><script>document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const box=button.closest('details'),status=box.querySelector('.status');try{await navigator.clipboard.writeText(box.querySelector('pre').textContent);status.textContent='복사했습니다.'}catch{status.textContent='브라우저가 복사를 허용하지 않았습니다. 문안을 선택해 복사해 주세요.'}}));</script></body></html>`;
  write(path.join(__dirname,'index.html'),index);console.log(`모아보기 · 게시문안10 · 표지개요${all.length} · 장면접촉판${sceneSheets.length}`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
