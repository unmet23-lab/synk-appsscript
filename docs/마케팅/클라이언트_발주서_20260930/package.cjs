const fs=require('node:fs'),path=require('node:path'),C=require('./src/core.js');
require('./build.cjs');
(async()=>{
  const dist=path.join(__dirname,'dist');
  const instructions='이 ZIP은 오프라인 보관용입니다. 먼저 압축을 풀고 SYNK_영상제작_발주서.html을 Chrome 또는 Edge로 열어주세요.\n자동 접수는 PULSE가 보내드린 온라인 접수 링크에서 사용할 수 있습니다. 이 파일만으로는 자동 전송되지 않습니다.\n\n'+fs.readFileSync(path.join(__dirname,'사용안내.md'),'utf8');
  const zip=await C.zip([{name:'SYNK_영상제작_발주서.html',data:fs.readFileSync(path.join(dist,'SYNK_영상제작_발주서.html'))},{name:'먼저_읽어주세요.txt',data:'\uFEFF'+instructions}]);
  fs.writeFileSync(path.join(dist,'클라이언트_전달용.zip'),Buffer.from(await zip.arrayBuffer()));
  console.log('Client package ready: '+zip.size+' bytes');
})().catch(e=>{console.error(e);process.exitCode=1;});
