'use strict';
const crypto=require('node:crypto'),{parse}=require('parse5');
const algorithms=['sha256','sha384','sha512'];
const trimASCII=value=>value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g,'');
// CSP base64-value permits omitted padding and URL-safe digits; compare digest bytes.
const canonical=token=>token.replace(/^'(sha256|sha384|sha512)-([A-Za-z0-9+/_-]+={0,2})'$/i,(_,algorithm,digest)=>"'"+algorithm.toLowerCase()+'-'+Buffer.from(digest,'base64').toString('base64')+"'");
const hash=(body,algorithm)=>"'"+algorithm+'-'+crypto.createHash(algorithm).update(body,'utf8').digest('base64')+"'";
function inspect(text){
 const document=parse(text,{sourceCodeLocationInfo:true}),scripts=[],policies=[],stack=[document];
 while(stack.length){const node=stack.pop(),location=node.sourceCodeLocation,attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(node.tagName==='script'&&location?.startTag){const body=(node.childNodes||[]).filter(n=>n.nodeName==='#text').map(n=>n.value).join('');scripts.push({body,importmap:(attrs.type||'').trim().toLowerCase()==='importmap',at:location.startOffset});}
  if(node.tagName==='meta'&&(attrs['http-equiv']||'').trim().toLowerCase()==='content-security-policy'){
   const content=attrs.content||'',directives=new Map();
   // The first occurrence wins, including an empty first directive.
   // CSP3 parse-serialized-policy: discard non-ASCII directives; first name wins.
   for(const part of content.split(';')){const token=trimASCII(part);if(!token||/[^\x00-\x7f]/u.test(token))continue;const [name,...values]=token.split(/[\t\n\f\r ]+/u),key=name.toLowerCase();if(!directives.has(key))directives.set(key,values.map(canonical));}
   policies.push({content,location:location?.attrs?.content,scriptExplicit:directives.has('script-src-elem')||directives.has('script-src'),allowed:directives.get('script-src-elem')||directives.get('script-src')||directives.get('default-src')||[]});
  }
  if(node.content)stack.push(node.content);if(node.childNodes)stack.push(...node.childNodes);
 }scripts.sort((a,b)=>a.at-b.at);return{scripts,policies};
}
function 맞춤(beforeLatin1,afterLatin1,Failure=Error){
 if(beforeLatin1===afterLatin1||!/<script\b/iu.test(afterLatin1)||!/http-equiv/iu.test(beforeLatin1))return afterLatin1;
 const decode=value=>{try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(value,'latin1'));}catch{throw new Failure('토큰 변경 HTML이 UTF-8이 아니다');}};
 const beforeText=decode(beforeLatin1),afterText=decode(afterLatin1),before=inspect(beforeText),after=inspect(afterText);
 if(before.scripts.length!==after.scripts.length)throw new Failure('토큰 변경 중 script 구조가 바뀌었다');
 const replacements=new Map();
 for(const [index,script]of before.scripts.entries()){
  const next=after.scripts[index];if(script.importmap!==next.importmap)throw new Failure('토큰 변경 중 import map 구조가 바뀌었다');
  if(script.importmap&&script.body!==next.body)for(const algorithm of algorithms){const old=hash(script.body,algorithm),value=hash(next.body,algorithm);if(replacements.has(old)&&replacements.get(old)!==value)throw new Failure('같은 이전 import map의 새 해시가 충돌한다');replacements.set(old,value);}
 }
 const edits=[];for(const policy of after.policies){
  const next=policy.content.replace(/(?:^|;)[\t\n\f\r ]*(script-src(?:-elem)?|default-src)[\t\n\f\r ]+[^;]*/gi,(directive,name)=>name.toLowerCase()==='default-src'&&policy.scriptExplicit?directive:directive.replace(/'(?:sha256|sha384|sha512)-[A-Za-z0-9+/_-]+={0,2}'/gi,token=>replacements.get(canonical(token))||token));
  if(next===policy.content)continue;if(!policy.location)throw new Failure('CSP 속성의 원래 위치를 확인하지 못했다');
  const original=afterText.slice(policy.location.startOffset,policy.location.endOffset),prefix=/^([^=]+\s*=\s*)/u.exec(original);if(!prefix)throw new Failure('CSP 속성 구조를 확인하지 못했다');
  const quote=/^[^=]+=\s*'/u.test(original)?"'":'"',escaped=next.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(quote==="'"?/'/gu:/"/gu,quote==="'"?'&#39;':'&quot;');
  edits.push({start:policy.location.startOffset,end:policy.location.endOffset,text:prefix[0]+quote+escaped+quote});
 }
 let result=afterText;for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
 const final=inspect(result);if(before.policies.length!==final.policies.length)throw new Failure('토큰 변경 중 CSP 구조가 바뀌었다');
 for(const [index,script]of before.scripts.entries())if(script.body!==final.scripts[index].body)for(const algorithm of algorithms){const old=hash(script.body,algorithm),next=hash(final.scripts[index].body,algorithm);for(const [j,policy]of before.policies.entries())if(policy.allowed.includes(old)&&!final.policies[j].allowed.includes(next))throw new Failure('토큰 변경 뒤 인라인 script CSP 해시가 맞지 않는다 — 해당 HTML의 해시를 함께 고친다');}
 return Buffer.from(result,'utf8').toString('latin1');
}
module.exports={맞춤};
