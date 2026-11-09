// 시험 도우미(서버가 읽지 않는다): 손님 화면 모듈에서 번역 키와 「번역 틀 밖 한글」을 찾는다(다국어 판 2, 기획 12-2 「사전 검사」).
// 정규식이 아니라 구문 트리로 본다 — 주석의 한글은 세지 않고, t('…') · k('…') · tl(loc,'…')의 첫 문장은 키로, 그 밖의 한글 문자열은 「틀 밖」으로 센다.
// 직원 전용 · 저장값처럼 번역하지 않는 한글은 줄 끝 `// i18n-skip`(그 줄) 또는 `// i18n-skip-start` … `// i18n-skip-end`(그 구간)로 표시한다.
import {parse} from 'acorn';

const HANGUL=/[ㄱ-ㆎ가-힣]/;
const CALLS={t:0,k:0,tl:1};
// 한국어 문장 키: ctx가 있으면 「ctx\u0004문장」(i18n.mjs keyOf와 같다).
const keyOf=(text,ctx)=>ctx?`${ctx}\u0004${text}`:text;
const staticText=node=>node?.type==='Literal'&&typeof node.value==='string'?node.value:node?.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:null;

function walk(node,visit,parent=null){
  if(!node||typeof node.type!=='string')return;
  visit(node,parent);
  for(const key of Object.keys(node)){
    if(key==='type'||key==='start'||key==='end'||key==='loc')continue;
    const value=node[key];
    if(Array.isArray(value)){for(const item of value)if(item&&typeof item.type==='string')walk(item,visit,node);}
    else if(value&&typeof value.type==='string')walk(value,visit,node);
  }
}
function skippedLines(src,comments){
  const lines=new Set(),lineOf=offset=>src.slice(0,offset).split('\n').length;
  let open=null;
  for(const comment of comments){
    const text=comment.value.trim(),line=lineOf(comment.start);
    if(text==='i18n-skip-start')open=line;
    else if(text==='i18n-skip-end'&&open!==null){for(let i=open;i<=line;i++)lines.add(i);open=null;}
    else if(text==='i18n-skip')lines.add(line);
  }
  if(open!==null)throw new Error(`i18n-skip-start가 닫히지 않았어요(${open}줄)`);
  return lines;
}
// 한 모듈을 훑는다. keys: Map(키 → 부른 자리의 둘째 인자 글자 목록), loose: 틀 밖 한글 [{line,text}], dynamic: 키가 정적 문장이 아닌 t(`…${}…`) 자리.
export function scanModule(src){
  const comments=[],ast=parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true,onComment:comments});
  const skip=skippedLines(src,comments),keys=new Map(),loose=[],dynamic=[],marked=new Set();
  walk(ast,node=>{
    if(node.type!=='CallExpression'||node.callee.type!=='Identifier'||!Object.hasOwn(CALLS,node.callee.name))return;
    const name=node.callee.name,arg=node.arguments[CALLS[name]];if(!arg)return;
    const text=staticText(arg);
    if(text===null){if(arg.type==='TemplateLiteral'&&arg.quasis.some(q=>HANGUL.test(q.value.cooked||'')))dynamic.push({line:arg.loc.start.line,text:src.slice(arg.start,arg.end)});return;}
    marked.add(arg);
    const ctxNode=name==='k'?null:node.arguments[CALLS[name]+2],ctx=ctxNode?staticText(ctxNode)||'':'';
    const vars=node.arguments[CALLS[name]+1],key=keyOf(text,ctx);
    if(!keys.has(key))keys.set(key,[]);
    keys.get(key).push(vars?src.slice(vars.start,vars.end):'');
  });
  walk(ast,node=>{
    if(marked.has(node))return;
    const line=node.loc.start.line;if(skip.has(line))return;
    if(node.type==='Literal'&&typeof node.value==='string'&&HANGUL.test(node.value))loose.push({line,text:node.value});
    else if(node.type==='TemplateLiteral'&&!marked.has(node))for(const quasi of node.quasis)if(HANGUL.test(quasi.value.cooked||'')){loose.push({line:quasi.loc.start.line,text:quasi.value.cooked});}
  });
  return {keys,loose,dynamic};
}
