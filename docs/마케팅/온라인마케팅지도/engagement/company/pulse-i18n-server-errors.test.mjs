// 다국어 판 2(2026-11-09, 기획 12-2 「서버 오류」 · Fable 설계 검토 C3) — 손님 길 서버 오류 문장의 영어를 정적으로 대조한다.
// 서버는 오류 문장을 한국어 그대로 던진다. 화면(api.mjs errorText)은 code가 표(ERROR_CODE_TEXT)에 있으면 그 고정 문장을, 아니면 받은 문장을 키로 번역한다.
// 그래서 ① 손님 길의 고정 문장은 영어 사전(public/pulse-app/i18n/en.mjs)에 빠짐 0, ② 손님 값 · 칸 이름이 끼는 동적 문장은 SYNK_PULSE_ code를 달고,
// ③ 서버가 붙이는 SYNK_PULSE_ code마다 화면 고정 문장과 그 영어가 있어야 한다. 런타임 패턴 매칭은 없다.
//
// 무엇을 세는가 — 아래 MODULES 한 줄이 모듈 하나:
//  scope: 손님 길 함수 이름(그 안의 모든 자리 — 안쪽 화살표 함수까지). '*'는 모듈 전체. blocks: 조건 글에 그 글자가 든 if 블록(server.mjs의 /pulse/api 길).
//  오류 자리: fail · httpError(첫 인자) · new Error, sites로 모듈마다 인자 자리를 바꾼다(web-push-service의 fail(status,message) · check). messageArgs: 문장을 인자로 받는 도우미의 그 인자.
//  codeHelpers: 칸 이름을 끼워 문장을 만드는 도우미(client-projects clean) — 손님 길에서 부르는 자리마다 고정 code를 넘겨야 한다.
// 빼는 것:
//  ① 직원 갈래 — if 조건이 액션 이름으로 갈릴 때(action==='…' · […].includes(action) · STAFF_ONLY.includes(action)) 그 갈래에 손님 액션이 없거나,
//     직원 표시(staffFlags: staff · user · isStaff)가 참인 갈래. 액션만으로 갈린 if의 else는 남은 액션으로 좁힌다. 액션은 customer · staff · legacy(옛 탭 손님)로
//     모두 나눠 둔다 — 나누지 않은 액션 이름이 손님 길에 나오면 실패한다. 손님 액션 목록은 고객 방 화면(app.mjs · views.mjs · film-*.mjs · room-view.mjs · request-*.mjs ·
//     feedback-rounds-view · deliverables-view · kickoff-view — 방 아래 준비 칸)이 실제로 부르는 이름이다.
//  ② 5xx — 운영에서는 publicRequestError가 「처리하지 못했습니다. 관리자에게 문의해 주세요.」 한 문장으로 가린다(그 문장은 extra로 센다).
//  ③ exclude — 위 규칙으로 못 가르는 몇 문장(까닭을 적고, 더는 그 자리가 없으면 실패한다).
//  scope 밖: 직원 함수, 옛 탭 손님 길(취향 · 참고자료 · 콘셉트 · 장면 의견 · 제작 설계 · 표현 비교 · 손님 자료 올리기 /pulse/api/studio/media), 화면이 글을 읽지 않는
//  미디어 GET(초안 사진 · 자료 · 납품 파일), 서버 안쪽(정리 예약 · 자동 안내), 앞에서 검사한 값만 받는 createFromRequest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import en from './public/pulse-app/i18n/en.mjs';

// acorn(저장소 devDependency)을 쓴다. 회사 판 시험은 예비 노드 Linux 격리 컨테이너(node_modules 없음)에서도 돌아야 하므로 이 시험은 회사 판에 싣지 않고 저장소에서만 돈다(11-09 회사 사슬 58 — pulse-i18n-dictionary.test.mjs와 같은 까닭).
const {parse}=createRequire(import.meta.url)('acorn');

const MODULES=[
  {file:'server.mjs',scope:['body'],blocks:["'/pulse/api/"]},
  {file:'pulse-requests.mjs',
    scope:['busy','text','link','one','many','markets','normalizeRequestAnswers','requestFileKind','inDraft','inMedia','count','assertDisk','draftOf','start','read','save','receive','removeFile','newNumber','submit','receiveProjectFile','receiveMessagePhoto','assertCasting','applyRequestAction','personaRequestOf','personaFileKind','receivePersonaFile'],
    actions:{customer:['request_save','request_submit','request_answer','answer_model','answer_direction','submit_draft_review','approve_draft'],staff:['request_note','request_ask','request_confirm','propose_model','send_draft','propose_direction','request_contact','settle_direction','payment_request','payment_confirm','payment_cancel','due_change','progress_save','progress_post','progress_withdraw']},
    staffFlags:['staff'],messageArgs:{link:2}},
  {file:'pulse-studio.mjs',
    scope:['customer','customerWrite','revision','studioOf','keys','capacity','commit','mutate','customerMutate','customerState','addRequestFile','removeRequestFile','addMessagePhoto','customerAction'],
    actions:{customer:['approve','confirm_delivery','submit_kickoff_source','request_submit'],staff:['save_translation','request_strategy_review','save_concept','save_scene','reorder_scenes'],legacy:['save_strategy','confirm_strategy','save_preferences','save_reference','remove_reference','select_concept','review_scene','comment']},
    staffFlags:['user'],indirect:{'approval.reason':'client-preview-approval.mjs'}},
  {file:'client-projects.mjs',
    scope:['object','revision','messageCapacity','requestOwner','reissueRequestInvite','open','session','read','customerAction','confirmDelivery','submitKickoffSource'],
    actions:{customer:['submit_kickoff_source','confirm_delivery','feedback','approve','support'],staff:[]},
    codeHelpers:{clean:{label:2,required:3,codes:4}}},
  {file:'pulse-live.mjs',scope:['customerRead','customerState','selection']},
  // 문의 사진(운영 조각 8-B): 손님 문의 보내기(support의 photos)와 사진 올리기가 부르는 확인 — 모두 손님 길이다.
  {file:'pulse-message-photos.mjs',scope:'*'},
  {file:'pulse-feedback-rounds.mjs',scope:['text','seconds','requiredId','currentPreview','findDraft','applyFeedbackRoundAction'],
    actions:{customer:['save_feedback_draft','remove_feedback_draft_item','submit_feedback_round'],staff:['classify_feedback_round']},staffFlags:['staff'],
    exclude:{'수정 범위는 담당자만 정리할 수 있어요.':'직원 액션(분류)을 부를 때의 역할 막음','의견 초안과 보내기는 고객 화면에서만 할 수 있어요.':'직원이 손님 액션을 부를 때'}},
  {file:'pulse-deliverables.mjs',scope:['text','keys','id','normalizeItems','applyDeliverableAction'],
    actions:{customer:['save_deliverables','confirm_deliverables'],staff:['request_deliverable_review','link_deliverable_version']},staffFlags:['isStaff']},
  {file:'client-kickoff.mjs',scope:['text','keys','applyClientKickoffAction'],
    actions:{customer:['submit_kickoff_source'],staff:['configure','link','review','waive','reset']}},
  {file:'client-preview-approval.mjs',scope:['buildCustomerPreviewApproval'],messageArgs:{decision:1},
    exclude:{'시안이 마음에 들면 승인해 주세요. 이 시안으로 최종본을 만들어요.':'승인할 수 있을 때의 안내 — 오류로 나가지 않는다'}},
  // 판 3: 의뢰서 보내기 · 고객 방 인물 카드(승인 · 사진 더 보내기)가 부르는 함수. 직원 경로(staffAction · addAsset · 동의)는 직원 화면이라 세지 않는다.
  {file:'pulse-personas.mjs',scope:['createPersonaGuard','text','assertRequest','create','afterProjectSubmit','session','stale','approve','addSource']},
  // 판 4(설계 5판 D19): 내 모델 회원 경로 · 증표 · 다시 쓰기 붙이기와 보내기 검사(attachedRequest). 직원 경로(decideClaim · workspaceAction · projectAction · personaAction · 삭제)는 직원 화면이라 세지 않는다.
  {file:'pulse-workspaces.mjs',scope:['keys','text','notFound','synkIdOf','personaOf','projectProof','draftProof','proofFail','takeProof','withProof','projectOfProof','draftOfProof','projectState','claim','withdrawClaim','models','model','asset','attach','adminMember','reuse','withdrawReuse','stop','deleteRequest','attachedRequest']},
  {file:'pulse-workspace-routes.mjs',scope:'*',sites:{failure:{message:2,status:0,code:1}}},
  {file:'pulse-devices.mjs',scope:'*'},
  // 메일 코드로 다시 열기(판 4): 세션 없는 손님 길이라 모든 문장이 손님에게 간다.
  {file:'pulse-mail-open.mjs',scope:'*'},
  {file:'client-scene-requests.mjs',scope:['recordSceneReview','append']},
  {file:'request-security.mjs',scope:['rateError'],extra:['처리하지 못했습니다. 관리자에게 문의해 주세요.']},
  {file:'../../../../../tools/company-messenger/web-push-service.mjs',scope:['state','register','remove','requireLive','validatePushEndpoint'],
    sites:{fail:{message:1,status:0},check:{message:2,status:1}}},
];

const HANGUL=/[ㄱ-ㆎ가-힣]/;
const FUNCTIONS=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression']);
const SKIP=new Set(['type','start','end','loc']);
const DEFAULT_SITES={fail:{message:0,status:1,code:2},httpError:{message:0,status:1}};

// 한 모듈의 오류 문장 자리를 모은다. 자리마다 {text|dynamic|indirect, line, fn, status, code, inScope, excluded}.
function scan(src,cfg){
  const ast=parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true});
  const raw=node=>src.slice(node.start,node.end),literal=node=>node?.type==='Literal'?node.value:undefined;
  const arrays=new Map();
  for(const stmt of ast.body){
    const decl=stmt.type==='VariableDeclaration'?stmt:stmt.type==='ExportNamedDeclaration'&&stmt.declaration?.type==='VariableDeclaration'?stmt.declaration:null;
    for(const d of decl?.declarations||[])if(d.id.type==='Identifier'&&d.init?.type==='ArrayExpression'&&d.init.elements.every(e=>e?.type==='Literal'&&typeof e.value==='string'))arrays.set(d.id.name,d.init.elements.map(e=>e.value));
  }
  const kinds={...DEFAULT_SITES,...(cfg.sites||{})},scope=cfg.scope||[];
  const universe=cfg.actions?new Set([...cfg.actions.customer,...cfg.actions.staff,...(cfg.actions.legacy||[])]):null;
  const nonCustomer=new Set(cfg.actions?[...cfg.actions.staff,...(cfg.actions.legacy||[])]:[]);
  const isAction=node=>['action','input.action','input?.action'].includes(raw(node).replace(/\s+/g,''));
  const names=node=>node?.type==='ArrayExpression'&&node.elements.every(e=>e?.type==='Literal'&&typeof e.value==='string')?node.elements.map(e=>e.value):node?.type==='Identifier'&&arrays.has(node.name)?arrays.get(node.name):null;
  function actionSet(node){
    if(node.type==='LogicalExpression'&&node.operator==='||'){const a=actionSet(node.left),b=actionSet(node.right);return a&&b?new Set([...a,...b]):null;}
    if(node.type==='BinaryExpression'&&['===','=='].includes(node.operator)){
      const [act,lit]=isAction(node.left)?[node.left,node.right]:isAction(node.right)?[node.right,node.left]:[];
      if(act&&typeof literal(lit)==='string')return new Set([lit.value]);
    }
    const call=node.type==='ChainExpression'?node.expression:node;
    if(call.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.property?.name==='includes'&&call.arguments.length===1&&isAction(call.arguments[0])){const list=names(call.callee.object);if(list)return new Set(list);}
    return null;
  }
  const conjuncts=node=>node.type==='LogicalExpression'&&node.operator==='&&'?[...conjuncts(node.left),...conjuncts(node.right)]:[node];
  const roleOf=node=>{const flags=cfg.staffFlags||[];if(node.type==='Identifier'&&flags.includes(node.name))return 'staff';if(node.type==='UnaryExpression'&&node.operator==='!'&&node.argument.type==='Identifier'&&flags.includes(node.argument.name))return 'customer';return null;};
  const inScope=ctx=>scope==='*'||ctx.block||ctx.fn.some(name=>scope.includes(name));
  const excludedBy=ctx=>ctx.role==='staff'?'직원 갈래':ctx.actions&&[...ctx.actions].every(a=>nonCustomer.has(a))?'직원 · 옛 탭 액션 갈래':'';
  const sites=[],unknownActions=new Set(),functionNames=new Set(),callees=new Set(),forwarders=new Set(),wrapped=new Set();
  function messages(node,ctx){
    if(!node)return [];
    if(node.type==='Literal'&&typeof node.value==='string')return [{text:node.value}];
    if(node.type==='TemplateLiteral')return node.expressions.length?[{dynamic:raw(node)}]:[{text:node.quasis[0].value.cooked}];
    if(node.type==='ConditionalExpression')return [...messages(node.consequent,ctx),...messages(node.alternate,ctx)];
    if(node.type==='BinaryExpression'&&node.operator==='+')return [{dynamic:raw(node)}];
    if(node.type==='Identifier'&&ctx.params.has(node.name)){if(inScope(ctx))forwarders.add(ctx.fn.at(-1));return [];}
    return [{indirect:raw(node)}];
  }
  function add(node,ctx,{message,status,code}){
    for(const item of messages(message,ctx)){
      const shown=item.text??item.dynamic;if(shown!==undefined&&!HANGUL.test(shown))continue;
      const s=literal(status),c=literal(code);
      sites.push({...item,line:node.loc.start.line,fn:ctx.fn.join('>'),status:typeof s==='number'?s:null,code:typeof c==='string'?c:code?raw(code):'',inScope:inScope(ctx),excluded:typeof s==='number'&&s>=500?'5xx':excludedBy(ctx)});
    }
  }
  function onCall(node,ctx){
    const callee=node.callee;if(callee.type==='Identifier')callees.add(callee.name);
    if(callee.type==='Identifier'&&Object.hasOwn(kinds,callee.name)){const k=kinds[callee.name];add(node,ctx,{message:node.arguments[k.message],status:node.arguments[k.status],code:k.code===undefined?null:node.arguments[k.code]});}
    if(callee.type==='MemberExpression'&&raw(callee)==='Object.assign'&&node.arguments[0]?.type==='NewExpression'&&node.arguments[0].callee.name==='Error'){
      const props=node.arguments[1]?.type==='ObjectExpression'?node.arguments[1].properties:[],prop=name=>props.find(p=>p.key?.name===name)?.value;
      wrapped.add(node.arguments[0]);add(node,ctx,{message:node.arguments[0].arguments[0],status:prop('status'),code:prop('code')});
    }
    if(callee.type==='Identifier'&&Object.hasOwn(cfg.messageArgs||{},callee.name))add(node,ctx,{message:node.arguments[cfg.messageArgs[callee.name]]});
    if(callee.type==='Identifier'&&Object.hasOwn(cfg.codeHelpers||{},callee.name)&&inScope(ctx)){
      const h=cfg.codeHelpers[callee.name],codes=node.arguments[h.codes],required=literal(node.arguments[h.required])===true;
      const code=name=>codes?.type==='ObjectExpression'?literal(codes.properties.find(p=>p.key?.name===name)?.value):undefined;
      sites.push({helper:callee.name,label:literal(node.arguments[h.label]),line:node.loc.start.line,fn:ctx.fn.join('>'),codes:[code('invalid'),...(required?[code('required')]:[])],inScope:true,excluded:excludedBy(ctx)});
    }
  }
  function walk(node,ctx,parent=null,key=''){
    if(!node||typeof node.type!=='string')return;
    if(FUNCTIONS.has(node.type)){
      const name=node.id?.name||(parent?.type==='VariableDeclarator'&&key==='init'&&parent.id.type==='Identifier'?parent.id.name:parent?.type==='Property'&&key==='value'?parent.key.name||parent.key.value:parent?.type==='MethodDefinition'?parent.key.name:parent?.type==='AssignmentExpression'&&key==='right'?parent.left.name||parent.left.property?.name:'')||'';
      if(name)functionNames.add(name);
      const params=new Set();for(const p of node.params){if(p.type==='Identifier')params.add(p.name);if(p.type==='AssignmentPattern'&&p.left.type==='Identifier')params.add(p.left.name);}
      ctx={...ctx,fn:[...ctx.fn,name||'(이름 없음)'],params};
    }
    if(node.type==='CallExpression')onCall(node,ctx);
    if(node.type==='NewExpression'&&node.callee.name==='Error'&&!wrapped.has(node))add(node,ctx,{message:node.arguments[0]});
    if(node.type==='IfStatement'){
      let consequent=ctx,alternate=ctx;
      if(cfg.blocks?.some(text=>raw(node.test).includes(text)))consequent={...ctx,block:true};
      if(universe){
        let actions=null,role=null,other=false;
        for(const part of conjuncts(node.test)){const a=actionSet(part);if(a){actions=actions?new Set([...actions].filter(x=>a.has(x))):a;continue;}const r=roleOf(part);if(r){role=r;continue;}other=true;}
        if(actions&&inScope(ctx))for(const a of actions)if(!universe.has(a))unknownActions.add(a);
        if(actions||role)consequent={...consequent,actions:actions?(ctx.actions?new Set([...ctx.actions].filter(a=>actions.has(a))):actions):ctx.actions,role:role||ctx.role};
        if(actions&&!role&&!other)alternate={...ctx,actions:new Set([...(ctx.actions||universe)].filter(a=>!actions.has(a)))};
      }
      walk(node.test,ctx,node,'test');walk(node.consequent,consequent,node,'consequent');walk(node.alternate,alternate,node,'alternate');
      return;
    }
    for(const k of Object.keys(node)){
      if(SKIP.has(k))continue;const value=node[k];
      if(Array.isArray(value)){for(const item of value)if(item&&typeof item.type==='string')walk(item,ctx,node,k);}
      else if(value&&typeof value.type==='string')walk(value,ctx,node,k);
    }
  }
  walk(ast,{fn:[],params:new Set(),actions:null,role:null,block:false});
  return {sites,unknownActions:[...unknownActions],functionNames,callees,forwarders:[...forwarders]};
}

const short=file=>file.split('/').pop();
const scanned=MODULES.map(cfg=>{const src=readFileSync(new URL(cfg.file,import.meta.url),'utf8');return {cfg,src,...scan(src,cfg)};});
const live=({sites})=>sites.filter(site=>site.inScope&&!site.excluded);

test('손님 길 서버 오류의 고정 문장은 영어 사전에 빠짐 0',()=>{
  const needed=new Map();
  for(const {cfg,src,sites}of scanned){
    for(const site of live({sites}))if(site.text!==undefined&&!Object.hasOwn(cfg.exclude||{},site.text)){if(!needed.has(site.text))needed.set(site.text,[]);needed.get(site.text).push(`${short(cfg.file)}:${site.line}`);}
    for(const text of cfg.extra||[]){assert.ok(src.includes(`'${text}'`),`${short(cfg.file)}: 덧붙여 세는 문장이 모듈에 없다 — ${text}`);if(!needed.has(text))needed.set(text,[]);needed.get(text).push(short(cfg.file));}
  }
  assert.ok(needed.size>=100,'손님 길 문장이 너무 적게 잡혔다 — 함수 이름 · 갈래 규칙을 확인 '+needed.size);
  const missing=[...needed].filter(([text])=>!Object.hasOwn(en,text)).map(([text,where])=>`${text}  — ${where.join(', ')}`);
  assert.deepEqual(missing,[],'영어 사전(i18n/en.mjs)에 없는 손님 길 서버 오류 문장');
  for(const [text]of needed)assert.ok(typeof en[text]==='string'&&en[text].trim()&&!HANGUL.test(en[text]),text+' — 영어가 비었거나 한글이 남았다');
});

test('손님 길 동적 문장은 SYNK_PULSE_ code를 달고, 서버가 붙이는 code마다 화면 고정 문장과 그 영어가 있다',async()=>{
  const {ERROR_CODE_TEXT}=await import('./public/pulse-app/api.mjs');
  const codes=new Map(),problems=[];
  for(const {cfg,src,sites}of scanned){
    for(const site of live({sites})){
      const at=`${short(cfg.file)}:${site.line}`;
      if(site.helper){for(const code of site.codes)if(typeof code!=='string'||!/^SYNK_PULSE_[A-Z0-9_]+$/.test(code))problems.push(`${at} ${site.helper}(「${site.label}」) — 손님 길에서 부르면 고정 code를 넘겨야 한다`);continue;}
      if(site.dynamic!==undefined&&!/^SYNK_PULSE_[A-Z0-9_]+$/.test(site.code))problems.push(`${at} 손님 값이 끼는 문장에 SYNK_PULSE_ code가 없다 — ${site.dynamic}`);
      if(site.indirect!==undefined&&!Object.hasOwn(cfg.indirect||{},site.indirect))problems.push(`${at} 어디서 온 문장인지 모른다 — ${site.indirect}`);
    }
    // 모듈에 적힌 SYNK_PULSE_ code는 손님 길 밖이어도 화면 표가 있어야 한다(서버 응답은 SYNK_ 접두 code를 그대로 내린다 — server.mjs 오류 직렬화).
    for(const m of src.matchAll(/'(SYNK_PULSE_[A-Z0-9_]+)'/g))codes.set(m[1],short(cfg.file));
  }
  assert.deepEqual(problems,[]);
  assert.ok(codes.has('SYNK_PULSE_FILE_MISSING'),[...codes.keys()].join(','));
  for(const [code,file]of codes){
    assert.ok(Object.hasOwn(ERROR_CODE_TEXT,code),`${file}의 ${code} — api.mjs ERROR_CODE_TEXT에 화면 고정 문장이 없다`);
    assert.ok(typeof en[ERROR_CODE_TEXT[code]]==='string'&&en[ERROR_CODE_TEXT[code]].trim(),`${code} — 고정 문장 「${ERROR_CODE_TEXT[code]}」의 영어가 없다`);
  }
});

test('세는 기준이 낡지 않았다(함수 이름 · 액션 나눔 · 빼는 문장 · 출처)',()=>{
  const problems=[];
  for(const {cfg,sites,unknownActions,functionNames,callees,forwarders}of scanned){
    const file=short(cfg.file);
    if(Array.isArray(cfg.scope))for(const name of cfg.scope)if(!functionNames.has(name))problems.push(`${file}: scope의 함수 ${name}가 없다(이름이 바뀌었으면 고친다)`);
    for(const name of [...Object.keys(cfg.messageArgs||{}),...Object.keys(cfg.codeHelpers||{})])if(!callees.has(name))problems.push(`${file}: 도우미 ${name}를 부르는 자리가 없다`);
    for(const action of unknownActions)problems.push(`${file}: 손님 길에서 갈리는 액션 「${action}」을 customer · staff · legacy 중 하나로 나눠 주세요`);
    for(const name of forwarders)if(!Object.hasOwn({...DEFAULT_SITES,...(cfg.sites||{})},name)&&!Object.hasOwn(cfg.messageArgs||{},name))problems.push(`${file}: ${name}가 문장을 넘겨받아 던진다 — sites나 messageArgs에 적어 그 인자를 센다`);
    const inScope=sites.filter(site=>site.inScope&&!site.excluded);
    for(const text of Object.keys(cfg.exclude||{}))if(!inScope.some(site=>site.text===text))problems.push(`${file}: exclude의 「${text}」 자리가 더는 없다`);
    for(const source of Object.keys(cfg.indirect||{})){
      if(!inScope.some(site=>site.indirect===source))problems.push(`${file}: indirect ${source} 자리가 더는 없다`);
      if(!scanned.some(other=>short(other.cfg.file)===cfg.indirect[source]))problems.push(`${file}: ${source}의 문장을 내는 ${cfg.indirect[source]}를 MODULES에 넣는다`);
    }
  }
  assert.deepEqual(problems,[]);
  // 갈래 규칙이 직원 문장을 실제로 가른다(규칙이 조용히 꺼지면 사전 대조가 직원 문장까지 요구하거나, 거꾸로 손님 문장을 놓친다).
  const pick=(file,text)=>scanned.find(item=>short(item.cfg.file)===file).sites.filter(site=>site.text===text);
  assert.ok(pick('pulse-requests.mjs','방향은 두 안이나 세 안으로 보내 주세요.').every(site=>!site.inScope),'직원 함수 directionOptions는 scope 밖');
  assert.ok(pick('pulse-requests.mjs','제안할 모델을 골라 주세요.').every(site=>site.excluded),'propose_model 갈래는 직원');
  assert.ok(pick('pulse-requests.mjs','진행할 모델을 고르거나 바라는 점을 적어 주세요.').some(site=>site.inScope&&!site.excluded),'answer_model 갈래는 손님');
  assert.ok(pick('pulse-feedback-rounds.mjs','수정 종류를 골라 주세요.').every(site=>site.excluded),'else로 좁힌 분류 갈래는 직원');
  assert.ok(pick('pulse-deliverables.mjs','납품 규격 확인은 고객 화면에서만 남길 수 있어요.').every(site=>site.excluded),'isStaff 갈래는 직원');
  assert.ok(pick('web-push-service.mjs','기기 알림 서버가 아직 준비되지 않았어요. 잠시 뒤 다시 켜 주세요.').every(site=>site.excluded==='5xx'),'5xx는 운영에서 가려진다');
});
