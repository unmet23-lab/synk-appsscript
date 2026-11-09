'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const font=require(path.join(root,'tools/lib/브랜드폰트.js'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dataJS=(name,p)=>'window.'+name+'='+JSON.stringify(JSON.parse(read(p))).replace(/</g,'\\u003c')+';';
function build(output) {
  if(!output||!path.isAbsolute(output))throw Error('생성할 HTML의 절대 경로를 지정해 주세요.');
  const values={
    '<!-- BRAND_FONT -->':font.블록(),
    '/* APP_CSS */':read('experiences/ai-market-prep/style.css'),
    '/* DATA_JS */':[
      dataJS('MARKET_DATA','experiences/ai-market-prep/demo.json'),
      dataJS('MARKET_SCHEMA','docs/AI_커뮤니티마켓/양식.json'),
      dataJS('MARKET_POSTS','docs/AI_커뮤니티마켓/콘텐츠.json')
    ].join('\n'),
    '/* CORE_JS */':read('experiences/ai-market-prep/core.js'),
    '/* APP_JS */':read('experiences/ai-market-prep/app.js')
  };
  let html=read('experiences/ai-market-prep/_src_index.html');
  for(const [marker,value] of Object.entries(values)){
    if(html.split(marker).length!==2)throw Error('원고 표식 오류: '+marker);
    html=html.replace(marker,()=>value);
  }
  if(!font.심겼나(html))throw Error('브랜드 서체가 들어가지 않았습니다.');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const tmp=output+'.tmp';
  fs.writeFileSync(tmp,html,'utf8');fs.renameSync(tmp,output);
  console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),standalone:true,networkSubmission:false}));
}
if(require.main===module)build(process.argv[2]);
module.exports={build};

