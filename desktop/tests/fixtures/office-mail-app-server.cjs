'use strict';
const {randomUUID}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');

function mailAppServer(options={}){
  const sessions=[];
  const spawn=(file,args,launch)=>{
    const child=new EventEmitter(), threadId=randomUUID(), turnId=randomUUID();
    const proc={args,launch,threadId,turnId,requests:[],reads:0,closed:false};
    sessions.push(proc);
    child.stdout=new PassThrough();child.stderr=new PassThrough();
    const emit=value=>child.stdout.write(JSON.stringify(value)+'\n');
    const close=()=>{if(proc.closed)return;proc.closed=true;setImmediate(()=>{child.emit('exit',0);child.emit('close',0);});};
    child.kill=close;child.unref=()=>{};
    let tail='';
    child.stdin=new Writable({write(chunk,enc,done){
      tail+=chunk.toString();let index;
      while((index=tail.indexOf('\n'))>=0){
        const msg=JSON.parse(tail.slice(0,index));tail=tail.slice(index+1);
        if(!Number.isInteger(msg.id))continue;
        const {method,params}=msg;proc.requests.push({method,params});
        const reply=result=>emit({id:msg.id,result});
        if(method==='initialize')reply({});
        else if(method==='account/read'){
          const who=options.account?.(++proc.reads,proc)||'listener';
          reply({account:{type:'chatgpt',email:who+'@example.test'},userId:who,workspaceRouting:{chatgptAccountId:'workspace-'+who}});
        }else if(method==='mcpServerStatus/list'){
          const on=!params.threadId||options.keepMcp===true;
          reply({data:[{name:'sampleMcp',runtimeStatus:on?'connected':'disabled',tools:on?{ordinary:{}}:{}}],nextCursor:null});
        }else if(method==='thread/start'){
          reply({thread:{id:threadId,ephemeral:true,path:null,turns:[]},modelProvider:'openai',approvalPolicy:'never',
            sandbox:{type:'readOnly',networkAccess:false}});
        }else if(method==='turn/start'){
          const output=options.result?.(params,proc)||{};
          const item={type:options.itemType||'agentMessage',phase:'final_answer',text:JSON.stringify(output)};
          emit({method:'item/completed',params:{threadId,turnId,item}});
          emit({method:'turn/completed',params:{threadId,turn:{id:turnId,status:'completed',items:[item]}}});
          reply({turn:{id:turnId}});
        }else if(method==='turn/interrupt')reply({});
        else emit({id:msg.id,error:{code:-32601,message:'Unexpected '+method}});
      }
      done();
    },final(done){done();close();}});
    return child;
  };
  return {sessions,spawn};
}
module.exports={mailAppServer};

