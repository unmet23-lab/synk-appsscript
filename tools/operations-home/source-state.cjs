'use strict';
// Source parsing and cache identity, shared by the view and read-only adapters.
const path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { panels } = require('./sources');

function trackItems(text){
  let heading='',context='',fence=null,current=null; const result=[];
  const lines=text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const line=lines[i],f=/^\s*(`{3,}|~{3,})/.exec(line);
    if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;continue;}if(fence)continue;
    const h=/^##\s+(.+)/.exec(line);if(h){heading=h[1];context='';current=null;continue;}
    if(line.startsWith('원문:')){context=line;current=null;continue;}
    const legacy=/^-\s+\[([^\]]+)\]\s+(.+)/.exec(line),modern=/^-\s+\*\*(.+?)\*\*\s*(.*)/.exec(line);
    if(legacy||modern){
      current=null;
      const owner=legacy?legacy[1]:/유호님 차례/.test(heading)?'유호':'작업';
      if(/완료/.test(owner)||/^(?:\d+\.\s*)?완료(?:한|된|\s|$)/.test(heading))continue;
      const body=legacy?legacy[2]:'**'+modern[1]+'** '+modern[2];
      current={owner,text:body,title:modern?modern[1].replace(/[:：]\s*$/,''):legacy[2].slice(0,150),heading,context,line:i+1,panelIds:[]};result.push(current);
    }else if(current&&/^\s+\S/.test(line)){current.text+='\n'+line;}
    else if(/^#|^<\/?details|^<summary/.test(line))current=null;
  }
  for(const item of result)item.panelIds=panels.filter(p=>new RegExp(p.match,'i').test(item.heading+' '+item.text)).map(p=>p.id);
  return result;
}
function cacheDirectory(root){return path.join(os.tmpdir(),'synk-operations-home',crypto.createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,12));}

module.exports = { trackItems, cacheDirectory };
