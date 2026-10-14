import {receiveStudioMedia,commitStudioMedia,discardStudioMedia,serveStudioMedia} from './studio-media.mjs';
import {socialOnboarding} from './social-onboarding.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const parameter=value=>{try{return value===undefined?undefined:decodeURIComponent(value);}catch{throw fail('SNS 항목 주소를 확인해 주세요.');}};

// Requests that save nothing (previews, cost quotes, read-only insights, private recovery copies) do not tell every screen to refresh.
const QUIET_PATHS=new Set(['/api/social/ai/quote','/api/social/insights/variants']);
export function socialChangeNotifies(path){return !path.startsWith('/api/social/recovery/')&&!/[/-]preview$/.test(path)&&!QUIET_PATHS.has(path);}
export function createSocialRoutes({store,publishing,marketing,provider,distribution,inboxProvider,inboxRecovery,replies,capacity,copyInsights,followups,ai,recovery,tracking,workflows,review,publicationLinks,signal,session,origin,body,send,isStopped=()=>false,onChange=()=>{},runtime=()=>({})}){
  return async function handle(req,res,{url,demoRequest=false}){
    const path=url.pathname;if(!path.startsWith('/api/social/'))return false;
    const auth=session(req);if(!auth)throw fail('먼저 로그인해 주세요.',401);
    if(demoRequest)throw fail('SNS 게시 관리는 실제 워크스페이스에서 이용해 주세요.',403);
    function authorize(){const latest=session(req);if(isStopped()||!latest||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);return latest.user;}
    const user=authorize(),media=path.match(/^\/api\/social\/media\/([^/]+)$/);
    if(['GET','HEAD'].includes(req.method)&&media){await serveStudioMedia(req,res,store.directory,marketing.ownMedia(user,media[1]),()=>marketing.ownMedia(authorize(),media[1]));return true;}
    const handoffMedia=path.match(/^\/api\/social\/jobs\/([^/]+)\/media\/(\d+)\/download$/);
    if(['GET','HEAD'].includes(req.method)&&handoffMedia){
      const context=publishing.handoff(authorize(),parameter(handoffMedia[1])),ref=context.variant.media[Number(handoffMedia[2])];
      if(!ref)throw fail('이 게시 버전에서 파일을 찾을 수 없어요.',404);
      const file=await marketing.downloadHandoff(authorize(),ref,{...context,authorize,signal});authorize();
      res.writeHead(200,{'Content-Type':file.mimeType,'Content-Length':file.bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.fileName||'sns-media')});res.end(req.method==='HEAD'?undefined:file.bytes);return true;
    }
    if(req.method==='GET'){
      if(path==='/api/social/workspace'){send(res,200,store.readScope(()=>{
        const filters=Object.fromEntries(url.searchParams),social=publishing.workspace(user,filters),paged=!!social.pagination,complete=paged?publishing.summary(user,filters):social,extra=marketing.workspace(user,complete,paged?{includeInsights:filters.section==='results',includeNotifications:false}:{});
        const jobs=social.jobs.map(job=>{let linkCheck=null;if(job.performanceEntryId&&publicationLinks)try{linkCheck=publicationLinks.get(user,{kind:'post',id:job.performanceEntryId}).check;}catch(error){if(![403,404,409].includes(error.status))throw error;}return {...job,linkCheck};});
        const result={...social,...extra,jobs,...distribution?.workspace(user),provider:provider.settings(user),connectionHealth:provider.health?.(user),inboxProvider:inboxProvider?.settings(user),inboxHealth:replies?.health(user),replies:replies?.workspace(user),...(!paged||filters.section==='queue'?{capacity:capacity?.workspace(user,paged?{pageSize:50}:{})}:{}),followups:followups?.list(user),ai:ai?.state(user),recovery:recovery?.summary?recovery.summary(user):recovery?.list(user),tracking:tracking?.workspace(user),workflows:workflows?.workspace(user),runtime:runtime()};
        if(result.inboxProvider&&inboxRecovery){const recoveryByChannel=new Map(inboxRecovery.workspace(user).channels.map(row=>[row.channelId,row.recovery]));result.inboxProvider={...result.inboxProvider,channels:result.inboxProvider.channels.map(row=>({...row,recovery:recoveryByChannel.get(row.channelId)||null}))};}
        result.onboarding=socialOnboarding(paged?{...result,...publishing.summary(user)}:result,{origin});return result;
      }));return true;}
      if(path==='/api/social/capacity'){send(res,200,store.readScope(()=>capacity.workspace(user,{pageSize:50,...Object.fromEntries(url.searchParams)})));return true;}
      const followup=path.match(/^\/api\/social\/inbox\/([^/]+)\/followup$/);
      if(followup){send(res,200,followups.workspace(user,{inboxId:parameter(followup[1])}));return true;}
      if(path==='/api/social/copy-insights'){send(res,200,copyInsights.comparison(user,Object.fromEntries(url.searchParams)));return true;}
      if(path==='/api/social/recovery'){send(res,200,recovery.list(user));return true;}
      const reviewPost=path.match(/^\/api\/social\/posts\/([^/]+)\/review$/);
      if(reviewPost){send(res,200,review.workspace(user,{postId:parameter(reviewPost[1])}));return true;}
      const detailPost=path.match(/^\/api\/social\/posts\/([^/]+)$/);
      if(detailPost){send(res,200,store.readScope(()=>publishing.get(user,parameter(detailPost[1]))));return true;}
      throw fail('SNS 조회 주소를 찾을 수 없어요.',404);
    }
    if(req.method!=='POST')throw fail('SNS 요청 방식을 확인해 주세요.',405);
    if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw fail('워크스페이스 화면에서 요청해 주세요.',403);
    if(url.search)throw fail('SNS 변경 주소를 확인해 주세요.');
    if(path==='/api/social/media'){
      if(user.role==='viewer')throw fail('열람 계정으로는 업로드할 수 없어요.',403);
      let upload;try{upload=await receiveStudioMedia(req,store.directory);authorize();await commitStudioMedia(upload,store.directory);const result=await marketing.addMedia(authorize(),upload.metadata,{authorize});upload=null;send(res,201,result);return true;}finally{await discardStudioMedia(upload,store.directory);}
    }
    const input=await body(req,{maxBytes:2*1024*1024,maxChars:2*1024*1024});const actor=authorize();
    async function preparePost(row){
      const normalized=marketing.validatePostInput(authorize(),row),refs=[...(normalized.media||[]),...(normalized.variants||[]).flatMap(v=>v.media||[])],assetIds=[...new Set(refs.map(ref=>ref.assetId||ref.id).filter(Boolean))];
      if(assetIds.length)await marketing.prepareMedia(authorize(),assetIds,{authorize,signal});
      return marketing.validatePostInput(authorize(),normalized);
    }
    let result,match;
    if(path==='/api/social/recovery/save')result=recovery.save(actor,input);
    else if((match=path.match(/^\/api\/social\/inbox\/([^/]+)\/followup$/)))result=followups.create(actor,{...input,inboxId:parameter(match[1])},{authorize,signal});
    else if(path==='/api/social/capacity/preview')result=capacity.preview(actor,input);
    else if(path==='/api/social/capacity/apply')result=capacity.apply(actor,input);
    else if(path==='/api/social/copy-insights/template-preview')result=await copyInsights.templatePreview(actor,input,{authorize,signal});
    else if(path==='/api/social/provider/health')result=await provider.checkHealth(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/health')result=await replies.checkHealth(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/provider/recovery/verify')result=await inboxRecovery.verify(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/provider/recovery/resume')result=await inboxRecovery.resume(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/reply/preview')result=await replies.preview(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/reply/send')result=await replies.send(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/reply/reconcile')result=await replies.reconcile(actor,input,{authorize,signal});
    else if(path==='/api/social/inbox/reply/recheck')result=await replies.recheck(actor,input,{authorize,signal});
    else if(path==='/api/social/recovery/check')result=recovery.check(actor,input);
    else if(path==='/api/social/recovery/discard')result=recovery.discard(actor,input);
    else if(path==='/api/social/tracking/configure')result=tracking.configure(actor,input);
    else if(path==='/api/social/tracking/key')result=tracking.rotateKey(actor,input);
    else if(path==='/api/social/tracking/links')result=tracking.createLink(actor,input);
    else if((match=path.match(/^\/api\/social\/tracking\/links\/([^/]+)$/)))result=tracking.updateLink(actor,parameter(match[1]),input);
    else if(path==='/api/social/templates/preview')result=await workflows.templatePreview(actor,input,{authorize,signal});
    else if((match=path.match(/^\/api\/social\/templates(?:\/([^/]+))?$/)))result=await workflows.saveTemplate(actor,input,parameter(match[1]),{authorize,signal});
    else if(path==='/api/social/workflow/preview')result=await workflows.bulkPreview(actor,input,{authorize,signal});
    else if(path==='/api/social/workflow/apply')result=await workflows.apply(actor,input,{authorize,signal});
    else if(path==='/api/social/queue-policy')result=workflows.saveQueuePolicy(actor,input);
    else if(path==='/api/social/queue/preview')result=await workflows.queuePreview(actor,input,{authorize,signal});
    else if((match=path.match(/^\/api\/social\/posts\/([^/]+)\/review-links$/)))result=await review.create(actor,{...input,postId:parameter(match[1])},{authorize,signal});
    else if((match=path.match(/^\/api\/social\/review-links\/([^/]+)\/revoke$/)))result=review.revoke(actor,{...input,id:parameter(match[1])});
    else if(path==='/api/social/posts'){const prepared=await preparePost(input);result=publishing.savePost(authorize(),prepared);}
    else if((match=path.match(/^\/api\/social\/posts\/([^/]+)$/))){const prepared=await preparePost(input);result=publishing.savePost(authorize(),prepared,match[1]);}
    else if(path==='/api/social/media/prepare')result=await marketing.prepareMedia(actor,input.assetIds,{authorize,signal});
    else if((match=path.match(/^\/api\/social\/posts\/([^/]+)\/action$/)))result=await publishing.action(actor,match[1],input);
    else if((match=path.match(/^\/api\/social\/posts\/([^/]+)\/comments$/)))result=publishing.comment(actor,match[1],input);
    else if((match=path.match(/^\/api\/social\/jobs\/([^/]+)\/link-check$/))){
      const job=publishing.getJob?publishing.getJob(actor,parameter(match[1])):publishing.workspace(actor).jobs.find(row=>row.id===match[1]);
      if(!job?.performanceEntryId||job.status!=='published')throw fail('게시 주소가 기록된 작업을 선택해 주세요.',409);
      result=await publicationLinks.check(actor,{kind:'post',id:job.performanceEntryId},{authorize,signal});
    }
    else if((match=path.match(/^\/api\/social\/jobs\/([^/]+)\/action$/)))result=await publishing.jobAction(actor,match[1],input);
    else if(path==='/api/social/settings')result=publishing.saveSettings(actor,input);
    else if(path==='/api/social/slots')result=publishing.saveSlots(actor,input);
    else if(path==='/api/social/sources/ingest'){const prepared=await preparePost(input.post||{});result=publishing.ingestSource(authorize(),{...input,post:prepared});}
    else if(path==='/api/social/sources/scan')result=await distribution.scan({user:actor,ruleId:input.ruleId,signal,authorize});
    else if((match=path.match(/^\/api\/social\/rules(?:\/([^/]+))?$/))){
      if(input.sourceId&&input.enabled!==false)distribution?.validateRuleSource(actor,input.sourceId);
      result=store.transaction(()=>{const saved=publishing.saveRule(actor,input,match[1]);if(saved.rule.enabled)distribution?.initializeRule(actor,saved.rule.id);return saved;});
    }
    else if(path==='/api/social/bulk/preview'||path==='/api/social/bulk/import'){
      if(!Array.isArray(input.rows))throw fail('가져올 게시물 목록을 확인해 주세요.');
      // Preview keeps row errors visible. Import revalidates every reference.
      const rows=input.rows.map(row=>{try{return marketing.validatePostInput(actor,structuredClone(row));}catch(error){return {...row,__sourceError:error.message};}});
      if(path.endsWith('/import')&&rows.some(row=>row.__sourceError))throw fail('미디어·캠페인 접근 오류를 먼저 수정해 주세요.',409);
      if(path.endsWith('/import'))for(let i=0;i<rows.length;i++)rows[i]=await preparePost(rows[i]);
      result=path.endsWith('/preview')?publishing.bulkPreview(authorize(),{...input,rows}):publishing.bulkImport(authorize(),{...input,rows});
      if(path.endsWith('/preview')&&result.rows)result.rows=result.rows.map((row,i)=>rows[i]?.__sourceError?{...row,valid:false,errors:[...(row.errors||[]),rows[i].__sourceError]}:row);
    }
    else if(path==='/api/social/reschedule/preview')result=publishing.reschedulePreview(actor,input);
    else if(path==='/api/social/reschedule/apply')result=publishing.rescheduleApply(actor,input);
    else if((match=path.match(/^\/api\/social\/accounts\/([^/]+)$/)))result=marketing.saveAccount(actor,match[1],input);
    else if((match=path.match(/^\/api\/social\/campaigns(?:\/([^/]+))?$/)))result=marketing.saveCampaign(actor,input,match[1]);
    else if((match=path.match(/^\/api\/social\/inbox\/provider\/(configure|sync)$/)))result=await inboxProvider[match[1]](actor,input,{authorize,signal});
    else if((match=path.match(/^\/api\/social\/inbox(?:\/([^/]+))?$/)))result=marketing.saveInbox(actor,input,parameter(match[1]));
    else if(path==='/api/social/ai/quote')result=ai.quote(actor,input);
    else if(path==='/api/social/ai/generate')result=await ai.generate(actor,input,{authorize,signal});
    else if(path==='/api/social/insights/variants')result=marketing.variants(actor,input);
    else if(path==='/api/social/provider/reconcile'){
      await provider.reconcile(actor,input,{authorize});
      result=await publishing.jobAction(authorize(),input.jobId,{action:'reconcile'});
    }
    else if((match=path.match(/^\/api\/social\/provider\/(configure|refresh|connect|disconnect)$/))){result=await provider[match[1]](actor,input,{authorize});}
    else throw fail('SNS 변경 주소를 찾을 수 없어요.',404);
    authorize();if(socialChangeNotifies(path))onChange(actor);send(res,200,result??{ok:true});return true;
  };
}
