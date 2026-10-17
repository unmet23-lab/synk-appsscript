const fs=require('fs'),acorn=require('acorn'),walk=require('acorn-walk');
const [repo,...files]=process.argv.slice(2);const fns={};const top=new Set();const unusedLocals=[];
for(const f of files){const ast=acorn.parse(fs.readFileSync(repo+'/'+f,'utf8'),{ecmaVersion:'latest',locations:true});
 for(const n of ast.body){if(n.type==='FunctionDeclaration'){top.add(n.id.name);const ids=new Set();walk.full(n.body,x=>{if(x.type==='Identifier')ids.add(x.name);if(x.type==='Literal'&&typeof x.value==='string')ids.add('STR:'+x.value)});fns[n.id.name]={f,line:n.loc.start.line,ids};
  // 지역 선언 중 한 번도 안 읽히는 것
  const decl=[];walk.full(n,x=>{if(x.type==='VariableDeclarator'&&x.id.type==='Identifier')decl.push(x.id);if(/Function/.test(x.type))x.params.forEach(p=>p.type==='Identifier'&&decl.push(p))});
  const cnt={};walk.full(n,x=>{if(x.type==='Identifier')cnt[x.name]=(cnt[x.name]||0)+1});
  decl.forEach(d=>{if(cnt[d.name]===1&&!d.name.startsWith('_'))unusedLocals.push(f+':'+d.loc.start.line+' '+d.name+' (in '+n.id.name+')')});}}}
const reach=(start)=>{const seen=new Set([start]),q=[start];while(q.length){const c=q.pop();for(const id of fns[c].ids){const nm=id.startsWith('STR:')?null:id;if(nm&&fns[nm]&&!seen.has(nm)){seen.add(nm);q.push(nm)}}}return seen};
for(const s of ['doGet','doPost']){const r=reach(s);console.log(s,'→',[...r].join(', '),'| HtmlService:',[...r].some(x=>fns[x].ids.has('HtmlService')),'| google.script.run 문자열:',[...r].some(x=>[...fns[x].ids].some(i=>i.includes('google.script.run'))));}
console.log('HtmlService 쓰는 함수:',Object.keys(fns).filter(k=>fns[k].ids.has('HtmlService')));
console.log('unused locals/params:',unusedLocals);
