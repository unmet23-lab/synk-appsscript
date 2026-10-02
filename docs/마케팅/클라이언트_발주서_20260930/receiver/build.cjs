'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');

// Apps Script V8 has no WHATWG URL global. Core only uses protocol/hostname for
// HTTP(S) link validation. This scoped adapter rejects controls, credentials,
// malformed authorities and invalid ports; it never fetches a customer URL.
const gasUrlAdapter=`var URL = function(value) {
  if (typeof value !== 'string' || /[\\x00-\\x20\\x7f\\\\]/.test(value)) throw new Error('Invalid URL');
  var m = /^(https?):\\/\\/([^/?#]+)(?:[/?#].*)?$/i.exec(value);
  if (!m || /[@%]/.test(m[2])) throw new Error('Invalid URL');
  var host = m[2], port = '', bracket = /^\\[[a-fA-F0-9:.]+\\](?::([0-9]+))?$/.exec(host);
  if (host.charAt(0) === '[') { if (!bracket) throw new Error('Invalid host'); port = bracket[1] || ''; }
  else { var parts = host.split(':'); if (parts.length > 2) throw new Error('Invalid host'); host = parts[0]; port = parts[1] || ''; if (!host || /[^a-zA-Z0-9.\\-\\u0080-\\uffff]/.test(host) || (parts.length === 2 && !port)) throw new Error('Invalid host'); }
  if (port && (!/^[0-9]+$/.test(port) || Number(port) > 65535)) throw new Error('Invalid port');
  this.protocol = m[1].toLowerCase() + ':'; this.hostname = host;
};`;
function serverSources(){
  const core=fs.readFileSync(path.join(base,'src/core.js'),'utf8');
  const handoff=fs.readFileSync(path.join(base,'src/handoff.js'),'utf8');
  const wrappedCore=`var PULSE_BRIEF_CORE_ = (function(){\nvar module={exports:{}};\n${gasUrlAdapter}\n${core}\nreturn module.exports;\n})();\n`;
  const wrappedHandoff=`var PULSE_BRIEF_HANDOFF_ = (function(){\nvar module={exports:{}};\nfunction require(name){if(name==='./core.js')return PULSE_BRIEF_CORE_;throw new Error('Unsupported module');}\n${handoff}\nreturn module.exports;\n})();\n`;
  return {'Libraries.gs':wrappedCore+'\n'+wrappedHandoff};
}
function htmlServiceClientHtml(html){
  // HtmlService altered a // sequence inside our nested-template client source.
  // Transport only this build-owned script as UTF-8 data; do not encode customer data.
  const pattern=/<script>([\s\S]*?)<\/script>/gi;
  const blocks=[...html.matchAll(pattern)];
  if(blocks.length!==1)throw new Error('Expected one inline client script in the standalone HTML');
  const source=blocks[0][1];
  new vm.Script(source,{filename:'PULSE-client.js'});
  const encoded=Buffer.from(source,'utf8').toString('base64url');
  const bootstrap='(function(){var binary=atob("'+encoded+'".replace(/-/g,"+").replace(/_/g,"/"));var bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++){bytes[i]=binary.charCodeAt(i);}var script=document.createElement("script");script.textContent=new TextDecoder("utf-8",{fatal:true}).decode(bytes);var anchor=document.currentScript;anchor.parentNode.insertBefore(script,anchor);}());';
  return html.replace(pattern,()=>'<script data-pulse-client="utf8-base64">'+bootstrap+'</script>');
}
function build(){
  const target=path.join(__dirname,'dist');
  const html=fs.readFileSync(path.join(base,'dist/SYNK_영상제작_발주서.html'),'utf8');
  if(!html.includes('SYNK_INTAKE')||!html.includes('getIntakeConfig'))throw new Error('고객 HTML에 접수 연동이 없습니다. 상위 build.cjs를 먼저 실행해주세요.');
  fs.mkdirSync(target,{recursive:true});
  // Remove only our two superseded generated files, never an entire directory.
  for(const name of ['Core.gs','Handoff.gs']){const old=path.join(target,name);if(fs.existsSync(old))fs.unlinkSync(old);}
  for(const [name,source] of Object.entries(serverSources()))fs.writeFileSync(path.join(target,name),source);
  fs.writeFileSync(path.join(target,'Index.html'),htmlServiceClientHtml(html));
  for(const name of ['Code.gs','appsscript.json'])fs.copyFileSync(path.join(__dirname,name),path.join(target,name));
  console.log(JSON.stringify({prepared:true,deployed:false,directory:target,files:['Code.gs','Libraries.gs','Index.html','appsscript.json']},null,2));
  return target;
}
module.exports={serverSources,htmlServiceClientHtml,build};
if(require.main===module)build();
