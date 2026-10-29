'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {토큰고치기}=require('../tools/공개.js')._시험;
const digest=body=>crypto.createHash('sha256').update(body).digest('base64');
function fixture({hashPresent=true}={}){
 const old=Buffer.from('old'),next=Buffer.from('new'),token=crypto.createHash('sha256').update(old).digest('hex');
 const map=JSON.stringify({imports:{'./한글.js':'./한글.js?v='+token}}),oldHash=`'sha256-${digest(map)}'`,styleHash="'sha256-other-style'";
 const html=Buffer.from(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${hashPresent?oldHash:"'sha256-unrelated'"}; style-src 'self' ${styleHash}; object-src 'none'">\n<script type="importmap">${map}</script>`);
 const result=토큰고치기({훑을:['care/index.html'],원래:()=>html,공개:()=>html,처음바뀜:new Map([['care/한글.js',next]]),지움:new Set(),있나:p=>p==='care/한글.js',꼬리들:()=>[],호스트들:new Set(['synk.im'])});
 return {oldHash,styleHash,html,output:result.get('care/index.html').버퍼.toString('utf8')};
}
test('토큰이 바뀐 import map의 허용 CSP 해시도 정확한 UTF-8 본문으로 갱신한다',()=>{
 const {oldHash,styleHash,output}=fixture(),body=/<script type="importmap">([\s\S]*?)<\/script>/.exec(output)[1];
 assert.ok(output.includes(`'sha256-${digest(body)}'`));assert.ok(!output.includes(oldHash));
 assert.ok(output.includes(styleHash));assert.ok(output.includes("object-src 'none'"));assert.ok(!output.includes('unsafe-inline'));
});
test('원래 허용하지 않은 import map에 새 CSP 권한을 추가하지 않는다',()=>{
 const {output}=fixture({hashPresent:false}),body=/<script type="importmap">([\s\S]*?)<\/script>/.exec(output)[1];
 assert.ok(output.includes("'sha256-unrelated'"));assert.ok(!output.includes(`'sha256-${digest(body)}'`));
});
test('지원하지 않는 일반 script 또는 default-src의 허용 해시는 조용히 깨뜨리지 않고 중단한다',()=>{
 for(const type of ['type="module"','type="importmap"']){
  const old=Buffer.from('old'),next=Buffer.from('new'),token=crypto.createHash('sha256').update(old).digest('hex');
  const body=`import './a.js?v=${token}';`,directive=type.includes('module')?'script-src':'default-src';
  const html=Buffer.from(`<meta http-equiv="Content-Security-Policy" content="${directive} 'self' 'sha256-${digest(body)}'"><script ${type}>${body}</script>`);
  assert.throws(()=>토큰고치기({훑을:['index.html'],원래:()=>html,공개:()=>html,처음바뀜:new Map([['a.js',next]]),지움:new Set(),있나:p=>p==='a.js',꼬리들:()=>[],호스트들:new Set()}),/CSP 해시가 맞지/);
 }
});
