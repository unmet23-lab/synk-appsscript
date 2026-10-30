'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {토큰맞춤,토큰고치기}=require('../tools/공개.js')._시험;
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

test('참조 파일이 바뀌지 않아 공개 토큰만 복원해도 import map CSP 해시를 함께 맞춘다',()=>{
 const map=token=>JSON.stringify({imports:{'한글':'./한글.js?v='+token}}),html=token=>`<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'sha256-${digest(map(token))}'; style-src 'self' 'sha256-style-preserved'; object-src 'none'"><script type="importmap">${map(token)}</script>`;
 const result=토큰맞춤(Buffer.from(html('candidate')),Buffer.from(html('public')),new Set(['synk.im'])),output=result.버퍼.toString('utf8'),body=/<script type="importmap">([\s\S]*?)<\/script>/u.exec(output)[1];
 assert.equal(result.맞춤,1);assert.equal(body,map('public'));assert.ok(output.includes(`'sha256-${digest(body)}'`));assert.ok(!output.includes(`'sha256-${digest(map('candidate'))}'`));assert.ok(output.includes("style-src 'self' 'sha256-style-preserved'"));assert.ok(output.includes("object-src 'none'"));assert.ok(!output.includes('unsafe-inline'));
});
test('지원하지 않는 일반 script의 허용 해시는 조용히 깨뜨리지 않고 중단한다',()=>{
 for(const type of ['type="module"']){
  const old=Buffer.from('old'),next=Buffer.from('new'),token=crypto.createHash('sha256').update(old).digest('hex');
  const body=`import './a.js?v=${token}';`,directive=type.includes('module')?'script-src':'default-src';
  const html=Buffer.from(`<meta http-equiv="Content-Security-Policy" content="${directive} 'self' 'sha256-${digest(body)}'"><script ${type}>${body}</script>`);
  assert.throws(()=>토큰고치기({훑을:['index.html'],원래:()=>html,공개:()=>html,처음바뀜:new Map([['a.js',next]]),지움:new Set(),있나:p=>p==='a.js',꼬리들:()=>[],호스트들:new Set()}),/CSP 해시가 맞지/);
 }
});

test('sha384·sha512와 문자 참조·홑따옴표·비인용 http-equiv를 실제 HTML 속성으로 읽는다',()=>{
 for(const algorithm of ['sha256','sha384','sha512'])for(const encoded of [false,true]){
  const map=token=>JSON.stringify({imports:{'한글':'./한글.js?v='+token}}),hash=body=>crypto.createHash(algorithm).update(body).digest('base64');
  const html=token=>{const policy=`script-src 'self' '${algorithm}-${hash(map(token))}'; style-src 'self'`;return `<meta http-equiv=Content-Security-Policy content="${encoded?policy.replace(/'/g,'&#39;'):policy}"><script type=importmap>${map(token)}</script>`;};
  const result=토큰맞춤(Buffer.from(html('new')),Buffer.from(html('old')),new Set()),out=result.버퍼.toString('utf8'),{parse}=require('parse5'),stack=[parse(out)];let policy;
  while(stack.length){const n=stack.pop();if(n.tagName==='meta')policy=n.attrs.find(a=>a.name==='content')?.value;if(n.childNodes)stack.push(...n.childNodes);}
  assert.ok(policy.includes(`'${algorithm}-${hash(map('old'))}'`));assert.ok(!policy.includes(`'${algorithm}-${hash(map('new'))}'`));assert.ok(policy.includes("style-src 'self'"));
 }
});

test('script 문자열 속 가짜 meta는 정책으로 읽지 않고 따옴표 안의 >와 문자 참조는 보존한다',()=>{
 const map=token=>JSON.stringify({imports:{x:'./x.js?v='+token}}),html=token=>`<meta data-note="a>b" http-equiv="Content-Security-Policy" content="script-src &#39;sha256-${digest(map(token))}&#39;; report-uri https://example.invalid/a&gt;b"><script type="importmap">${map(token)}</script><script>const sample='<meta http-equiv="Content-Security-Policy" content="script-src &quot;fake&quot;">';</script>`;
 const out=토큰맞춤(Buffer.from(html('new')),Buffer.from(html('old')),new Set()).버퍼.toString('utf8');assert.ok(out.includes(`'sha256-${digest(map('old'))}'`));assert.ok(out.includes('data-note="a>b"'));assert.ok(out.includes("const sample='<meta"));
});

test('CSP digest의 생략한 padding과 URL-safe 표기도 같은 해시로 비교한다',()=>{
 for(const algorithm of ['sha256','sha384','sha512'])for(const format of ['base64','base64url']){
  const map=token=>JSON.stringify({imports:{x:'./x.js?v='+token}}),h=body=>crypto.createHash(algorithm).update(body).digest(format).replace(/=+$/u,''),html=token=>`<meta http-equiv=Content-Security-Policy content="script-src '${algorithm}-${h(map(token))}'"><script type=importmap>${map(token)}</script>`;
  const output=토큰맞춤(Buffer.from(html('candidate')),Buffer.from(html('public')),new Set()).버퍼.toString('utf8');
  assert.ok(output.includes(`'${algorithm}-${crypto.createHash(algorithm).update(map('public')).digest('base64')}'`));
 }
});

test('default-src의 허용 해시를 고치며 중복·비 ASCII 지시문은 첫 유효 지시문을 따른다',()=>{
 const map=token=>JSON.stringify({imports:{x:'./x.js?v='+token}}),html=(token,policy)=>`<meta http-equiv=Content-Security-Policy content="${policy(token)}"><script type=importmap>${map(token)}</script>`;
 for(const suffix of ["default-src 'none'",'default-src',"\u00a0script-src 'none'","\u017fcript-src 'none'"]){
  const policy=token=>`default-src 'sha256-${digest(map(token))}'; ${suffix}`;
  const output=토큰맞춤(Buffer.from(html('candidate',policy)),Buffer.from(html('public',policy)),new Set()).버퍼.toString('utf8');assert.ok(output.includes(`default-src 'sha256-${digest(map('public'))}'`));assert.ok(output.includes(suffix));
 }
 const policy=token=>`script-src 'sha256-${digest(map(token))}'; script-src 'none'`,out=토큰맞춤(Buffer.from(html('candidate',policy)),Buffer.from(html('public',policy)),new Set()).버퍼.toString('utf8');assert.ok(out.includes(`'sha256-${digest(map('public'))}'`));assert.ok(out.includes("; script-src 'none'"));
});

test('UTF-8 BOM은 보존하고 UTF-8이 아닌 입력은 공개 실패로 알린다',()=>{
 const {맞춤}=require('../tools/lib/importmap-csp.cjs'),bom=Buffer.from([0xef,0xbb,0xbf]),a=Buffer.concat([bom,Buffer.from('<meta http-equiv=Content-Security-Policy content="script-src self"><script type=importmap>{"x":"old"}</script>')]),b=Buffer.from(a.toString('utf8').replace('old','new'));
 assert.deepEqual(Buffer.from(맞춤(a.toString('latin1'),b.toString('latin1')),'latin1').subarray(0,3),bom);
 class Failure extends Error{};const invalid=Buffer.concat([Buffer.from([0xff]),a]);assert.throws(()=>맞춤(invalid.toString('latin1'),b.toString('latin1'),Failure),Failure);
});

test('다른 사이트 영상 v는 보존하고 같은 사이트·상대 파일의 캐시 v만 복원한다',()=>{
 const html=token=>Buffer.from(`<a href="https://www.youtube.com/watch?v=video-${token}">video</a><a href="https://example.invalid/a.js?v=external-${token}">other</a><script src="https://synk.im/a.js?v=local-${token}"></script><script src="./a.js?v=relative-${token}"></script>`),out=토큰맞춤(html('candidate'),html('public'),new Set(['synk.im'])).버퍼.toString('utf8');
 assert.ok(out.includes('watch?v=video-candidate'));assert.ok(out.includes('a.js?v=external-candidate'));assert.ok(out.includes('https://synk.im/a.js?v=local-public'));assert.ok(out.includes('./a.js?v=relative-public'));
});
