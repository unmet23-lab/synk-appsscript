'use strict';
// 이번 소개서의 사업명 조합. SYNK 워드마크 원본은 그대로 소비한다.
const path=require('path');
const root=path.resolve(__dirname,'../../..');
const tokens=require(path.join(root,'tools/lib/loom.js')).정본();
const ink={LAB:'Coral 3',SHIFT:'Lapis Deep',PULSE:'Pop Deep'};
const logo=require(path.join(root,'tools/lib/로고정본.js'));
function 이름(brand,{large=false,assetBase='assets/'}={}){
 const name=brand.replace(/^SYNK\s*/, '');
 if(!name)return '';
 if(!ink[name])throw new Error('알 수 없는 사업명');
 const stitch=`<img src="${assetBase}stitch.webp" alt="" aria-hidden="true" data-asset="stitch">`;
 return `<span class="division" data-division="${name}" style="--division-ink:${tokens.색[ink[name]]}"><span class="division-name">${name}</span>${large?`<span class="division-stitch" aria-hidden="true">${stitch}${stitch}</span>`:''}</span>`;
}
function 조합(brand,options={}){
 return `<div class="brand ${options.large?'brand--cover':''}" data-lockup="${brand}">${logo.워드마크({판:'라이트',표현:'민',신호:'k',색갈래:'단색'})}${이름(brand,options)}</div>`;
}
const css=`.brand>.division{position:relative;display:block;color:var(--division-ink);white-space:nowrap;line-height:1;font-synthesis:none}.brand .division-name{font:inherit;letter-spacing:inherit;color:inherit}.brand--cover{top:16px!important;height:96px!important;gap:16px!important}.brand--cover>svg{width:140px!important;height:96px!important}.brand--cover>.division{font-size:32px!important;font-weight:600!important;letter-spacing:.02em!important;transform:translateY(2px)}.brand .division-stitch{display:flex;position:absolute;left:0;top:calc(100% + 7px);width:100%;height:9px;overflow:hidden;gap:0;pointer-events:none}.division-stitch img{display:block;flex:none;width:auto;height:9px;max-width:none}.brand:not(.brand--cover) .division-stitch{display:none}`;
module.exports={이름,조합,css,ink};
