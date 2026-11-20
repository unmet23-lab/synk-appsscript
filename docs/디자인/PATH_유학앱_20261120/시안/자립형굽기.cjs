/* 시안을 파일 하나로 굽는다: app.js와 assets의 그림을 index.html 안에 심는다. 결과는 저장소 뿌리의 .tmp/path-study-app/PATH_유학앱_시안.html(git 밖)이다.
   쓰기: node docs/디자인/PATH_유학앱_20261120/시안/자립형굽기.cjs */
const fs=require('fs'),path=require('path');const d=__dirname;
let h=fs.readFileSync(path.join(d,'index.html'),'utf8');
const js=fs.readFileSync(path.join(d,'app.js'),'utf8');
const map={};for(const f of fs.readdirSync(path.join(d,'assets')))if(/\.webp$/.test(f))map[f]='data:image/webp;base64,'+fs.readFileSync(path.join(d,'assets',f)).toString('base64');
const tag='<script src="app.js"></script>';if(!h.includes(tag))throw new Error('app.js 자리를 못 찾음');
h=h.replace(tag,()=>'<script>window.PATH_ASSETS='+JSON.stringify(map)+';</script>\n<script>\n'+js+'\n</script>');
const out=path.resolve(d,'../../../../.tmp/path-study-app');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'PATH_유학앱_시안.html'),h);
console.log('그림',Object.keys(map).length,'장 ·',(h.length/1048576).toFixed(1)+'MB');
