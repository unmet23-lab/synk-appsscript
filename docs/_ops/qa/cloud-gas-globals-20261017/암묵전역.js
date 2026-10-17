const fs=require('fs'),acorn=require('acorn'),walk=require('acorn-walk');
const [repo,...files]=process.argv.slice(2);const declared=new Set(),refs=[],assigns=[];
for(const f of files){const ast=acorn.parse(fs.readFileSync(repo+'/'+f,'utf8'),{ecmaVersion:'latest',locations:true});
walk.full(ast,n=>{const id=x=>x&&x.type==='Identifier'&&declared.add(x.name);
 if(/Function/.test(n.type)){id(n.id);n.params.forEach(p=>{if(p.type==='Identifier')id(p);else walk.full(p,q=>q.type==='Identifier'&&declared.add(q.name))})}
 if(n.type==='VariableDeclarator')walk.full(n.id,q=>q.type==='Identifier'&&declared.add(q.name));
 if(n.type==='CatchClause'&&n.param)id(n.param);
 if(n.type==='AssignmentExpression'&&n.left.type==='Identifier')assigns.push({f,line:n.loc.start.line,name:n.left.name});});
walk.fullAncestor(ast,(n,s,a)=>{if(n.type!=='Identifier')return;const p=a[a.length-2];
 if(p.type==='MemberExpression'&&p.property===n&&!p.computed)return;if(p.type==='Property'&&p.key===n&&!p.computed&&!p.shorthand)return;refs.push({f,line:n.loc.start.line,name:n.name})});}
const builtin=new Set(Object.getOwnPropertyNames(globalThis).concat(['SpreadsheetApp','PropertiesService','ScriptApp','LockService','UrlFetchApp','Utilities','MailApp','HtmlService','ContentService','Session','Logger','undefined']));
const und=refs.filter(r=>!declared.has(r.name)&&!builtin.has(r.name));
console.log('undeclared refs:',JSON.stringify(und));console.log('assign to globals:',JSON.stringify(assigns));
