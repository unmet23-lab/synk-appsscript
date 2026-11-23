// A transport-independent client shared by the browser rehearsal and its contract tests.
// Credentials are supplied by the transport; none are stored in localStorage.
export class WorldClient {
  constructor({fetcher=(...args)=>globalThis.fetch(...args),storage=globalThis.localStorage,tabStorage=globalThis.sessionStorage,onChange=()=>{},broadcastAppearance=true,account=null}={}) {
    this.account=account;this.mode=account?'account':'rehearsal';this.fetcher=fetcher;this.storage=storage;this.tabStorage=tabStorage;this.onChange=onChange;
    let tabId;try{tabId=tabStorage?.getItem('synk-world-v1-tab');}catch{}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tabId||'')){
      tabId=crypto.randomUUID();try{tabStorage?.setItem('synk-world-v1-tab',tabId);}catch{}
    }
    this.tabId=tabId.toLowerCase();
    this.snapshot=null;this.generation=0;this.pending=null;this.status='welcome';this.busy=false;this.accessToken=null;this.appearanceNotice=null;this.broadcastAppearance=broadcastAppearance;
  }
  invalidate(){this.generation++;this.snapshot=null;this.pending=null;this.accessToken=null;this.status='welcome';this.rotateTab();this.emit();}
  rotateTab(){this.tabId=crypto.randomUUID();try{this.tabStorage?.setItem('synk-world-v1-tab',this.tabId);}catch{}}
  emit(){
    this.onChange(this);
    if(typeof Event==='function')globalThis.dispatchEvent?.(new Event('synk-world-session'));
    const notice=this.snapshot?`${this.snapshot.accountId}:${this.snapshot.revision}`:null;
    if(notice!==this.appearanceNotice){
      this.appearanceNotice=notice;
      // Only request a fresh server read. A broadcast never carries trusted inventory.
      if(this.broadcastAppearance&&typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'){
        const channel=new BroadcastChannel('synk-world-appearance-v1');channel.postMessage({type:'refresh'});channel.close();
      }
    }
  }
  pendingKey(){return this.snapshot?`synk-world-v1-pending:${this.snapshot.accountId}`:null;}
  loadPending(){try{this.pending=JSON.parse(this.storage?.getItem(this.pendingKey())||'null');}catch{this.pending=null;}}
  persistPending(){const key=this.pendingKey();if(!key)return;try{this.pending?this.storage?.setItem(key,JSON.stringify(this.pending)):this.storage?.removeItem(key);}catch{/* Keep in memory and show unsaved state. */}}
  async request(path,{method='GET',body}={},generation=this.generation){
    let response;
    try{response=this.account?await this.account.request(path,{method,...(body?{body:JSON.stringify(body)}:{})}):await this.fetcher(`/api/world/${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Synk-Product':'world','X-Synk-Contract':'1','X-Synk-Rehearsal':'1','X-Synk-Rehearsal-Tab':this.tabId,...(this.accessToken?{Authorization:`Bearer ${this.accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}
    catch(error){if(generation!==this.generation)throw Object.assign(Error('STALE_RESPONSE'),{code:'STALE_RESPONSE'});if(this.account&&error.code)throw error;this.status='offline';this.emit();throw Object.assign(Error('NETWORK_UNAVAILABLE'),{code:'NETWORK_UNAVAILABLE'});}
    if(generation!==this.generation)throw Object.assign(Error('STALE_RESPONSE'),{code:'STALE_RESPONSE'});
    const data=await response.json();
    if(generation!==this.generation)throw Object.assign(Error('STALE_RESPONSE'),{code:'STALE_RESPONSE'});
    if(!response.ok){const code=(typeof data.error==='string'?data.error:data.error?.code)||'SERVER_UNAVAILABLE';if(response.status===401){this.status='sign-in';this.snapshot=null;this.pending=null;this.accessToken=null;this.generation++;this.emit();}throw Object.assign(Error(data.message||code),{code,status:response.status,revision:data.revision});}
    return data;
  }
  adopt(data){
    if(!data?.accountId)return data;
    if(this.snapshot&&data.accountId!==this.snapshot.accountId)throw Object.assign(Error('ACCOUNT_MISMATCH'),{code:'ACCOUNT_MISMATCH'});
    if(!this.snapshot||data.revision>=this.snapshot.revision)this.snapshot=data;
    this.status='ready';this.emit();return data;
  }
  async restore(){if(this.account){if(!await this.account.restore()){this.status='welcome';this.emit();return false;}await this.refresh();try{this.tabStorage?.removeItem('synk-world-v1-signed-out');}catch{}this.loadPending();this.emit();return true;}try{if(this.tabStorage?.getItem('synk-world-v1-signed-out'))return false;}catch{}const status=await this.request('rehearsal/status');if(!status.authenticated){this.status='welcome';this.emit();return false;}this.accessToken=status.accessToken;await this.refresh();this.loadPending();this.emit();return true;}
  async signIn(accountKey){
    if(this.account){this.invalidate();await this.account.signIn();return;}
    const generation=++this.generation;this.snapshot=null;this.pending=null;this.accessToken=null;this.status='loading';this.emit();
    // A superseded login response can still set a browser cookie. Give each explicit
    // sign-in a new namespace so that stale cookies cannot return after a reload.
    this.rotateTab();
    const session=await this.request('rehearsal/session',{method:'POST',body:{accountKey}},generation);
    this.accessToken=session.accessToken;
    try{this.tabStorage?.removeItem('synk-world-v1-signed-out');}catch{}
    await this.refresh();this.loadPending();this.emit();
  }
  async refresh(){return this.adopt(await this.request('bootstrap'));}
  async command(path,body,method='POST'){
    if(this.busy)throw Object.assign(Error('BUSY'),{code:'BUSY'});this.busy=true;this.emit();
    try{return this.adopt(await this.request(path,{method,body}));}finally{this.busy=false;this.emit();}
  }
  async start(){return this.command('play/start',{requestId:crypto.randomUUID()});}
  async complete(runId,answers,requestId=crypto.randomUUID()){return this.command('play/complete',{runId,answers,requestId});}
  async equip(slots,dyes){
    if(!this.snapshot)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
    if(this.busy||this.pending)throw Object.assign(Error('BUSY'),{code:'BUSY'});
    this.pending={slots:{body:slots.body||'',neck:slots.neck||''},...(dyes===undefined?{}:{dyes:structuredClone(dyes)}),expectedRevision:this.snapshot.revision,requestId:crypto.randomUUID()};this.persistPending();
    return this.sendPending();
  }
  async saveLooks(looks){
    if(!this.snapshot)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
    if(this.busy||this.pending)throw Object.assign(Error('BUSY'),{code:'BUSY'});
    this.pending={looks:looks.map(({id,name,slots,dyes})=>({id,name,slots:{body:slots.body||'',neck:slots.neck||''},...(dyes===undefined?{}:{dyes:structuredClone(dyes)})})),expectedRevision:this.snapshot.revision,requestId:crypto.randomUUID()};this.persistPending();
    return this.sendPending();
  }
  async sendPending(){
    if(!this.pending)return;const command=this.pending;
    try{const result=await this.command(Array.isArray(command.looks)?'wardrobe/looks':'avatar/outfit',command,'PUT');if(this.pending===command){this.pending=null;this.persistPending();this.emit();}return result;}
    catch(error){if(error.status===409){this.status='conflict';this.emit();}throw error;}
  }
  async discardPending(){this.pending=null;this.persistPending();await this.refresh();}
  async logout(){
    // Invalidate all in-flight results before sending logout. Do not replay old account commands.
    const generation=++this.generation;this.snapshot=null;this.pending=null;this.status='welcome';this.emit();
    try{if(this.account)this.tabStorage?.removeItem('synk-world-v1-signed-out');else this.tabStorage?.setItem('synk-world-v1-signed-out','1');}catch{}
    try{if(this.account)await this.account.logout();else await this.request('rehearsal/logout',{method:'POST',body:{}});}finally{if(this.generation===generation)this.accessToken=null;}
  }
}
