'use strict';
const fs=require('fs'),path=require('path');
module.exports=function 라디오썸네일지면(){
 const root=path.resolve(__dirname,'..');
 const data=(p,mime)=>'data:'+mime+';base64,'+fs.readFileSync(path.join(root,p)).toString('base64');
 const scene=data('docs/라디오/눈깜빡임_정지마당_20260919/최종정지컷.png','image/png');
 const logo=data('docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png','image/png');
 const suit=data('docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf','font/otf');
 const inter=data('docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','font/ttf');
 return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK Radio</title>
 <style>@font-face{font-family:SUIT;src:url('${suit}')}@font-face{font-family:Inter;src:url('${inter}')}
 *{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#172334;color:#fbf7f0}
 .scene{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(12,20,27,.68),rgba(12,20,27,.16) 36%,transparent 63%)}
 .brand{position:absolute;top:70px;left:68px;display:flex;align-items:center;gap:22px}.brand img{width:126px;height:auto}.brand span{font:500 35px/1 Inter;letter-spacing:-.02em}
 h1{position:absolute;left:68px;top:220px;margin:0;font:600 51px/1.28 SUIT;letter-spacing:-.04em;text-shadow:0 2px 20px #10151c66}
 .genre{position:absolute;left:70px;bottom:69px;font:500 17px/1 Inter;letter-spacing:.15em;opacity:.84}
 </style><img class="scene" src="${scene}" alt="작은 연이 떠 있는 해 질 녘 마당의 세 친구"><div class="shade"></div>
 <div class="brand"><img src="${logo}" alt="SYNK"><span>radio</span></div><h1>음악은<br>켜 두고</h1><div class="genre">LOFI &amp; CHILL</div></html>`;
};
