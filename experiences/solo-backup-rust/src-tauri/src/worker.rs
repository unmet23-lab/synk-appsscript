use crate::{platform::ProcessJob, protocol::{self, MAX_HOST, MAX_PENDING, MAX_REQUEST, MAX_RESPONSE}};
use serde_json::{json, Value};
use std::{collections::HashMap, fs::File, io::{BufReader, Write}, os::windows::process::CommandExt, path::Path,
    process::{Child, ChildStdin, Command, Stdio}, sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering}}, thread};
use tokio::sync::oneshot;

type Reply = Result<Value, String>;
type Host = dyn Fn(&str, Value) -> Reply + Send + Sync;
type Publish = dyn Fn(Value) + Send + Sync;
type Failure = dyn Fn(&str) + Send + Sync;

pub struct Worker {
    input: Mutex<ChildStdin>, child: Mutex<Child>, job: ProcessJob, _lock: File,
    pending: Mutex<HashMap<u64, oneshot::Sender<Reply>>>, next_id: AtomicU64,
    host_count: AtomicUsize, failed: AtomicBool, closing: AtomicBool,
    host: Arc<Host>, publish: Arc<Publish>, failure: Arc<Failure>,
}

impl Worker {
    /// `run` starts the worker in scheduled-run mode (SWB_MODE=run): profile
    /// engines only and a single `$run` (worker/runner.cjs, STAGE1_DESIGN.md 4.2).
    pub fn start(resources: &Path, root: &Path, lock: File, test: bool, run: bool, host: Arc<Host>, publish: Arc<Publish>, failure: Arc<Failure>) -> Result<Arc<Self>, String> {
        let job = ProcessJob::new()?;
        let mut command = Command::new(resources.join("node.exe"));
        command.arg(resources.join("worker/dispatcher.cjs")).current_dir(resources).env_clear();
        for name in ["SYSTEMROOT","WINDIR","USERPROFILE","APPDATA","LOCALAPPDATA","TEMP","TMP","USERDOMAIN","USERNAME"] {
            if let Some(value) = std::env::var_os(name) { command.env(name,value); }
        }
        command.env("SWB_ROOT",root).env("SWB_RESTIC",resources.join("restic.exe")).env("SWB_ENGINE_ROOT",resources.join("engine"))
            .env("SWB_TEST",if test {"1"}else{"0"}).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        let client = resources.join("recovery-client.json"); if client.is_file() { command.env("SWB_CLIENT",client); }
        if run { command.env("SWB_MODE","run"); }
        let mut child = command.spawn().map_err(|_| "WORKER_SPAWN")?;
        if let Err(error) = job.assign(&child) { let _=child.kill(); let _=child.wait(); return Err(error); }
        let input = child.stdin.take().ok_or("PIPE_FAILED")?;
        let output = child.stdout.take().ok_or("PIPE_FAILED")?;
        let worker=Arc::new(Self{input:Mutex::new(input),child:Mutex::new(child),job,_lock:lock,pending:Mutex::new(HashMap::new()),next_id:AtomicU64::new(1),host_count:AtomicUsize::new(0),failed:AtomicBool::new(false),closing:AtomicBool::new(false),host,publish,failure});
        let weak=Arc::downgrade(&worker);
        thread::spawn(move || {
            let mut reader=BufReader::new(output);
            loop {
                let frame=protocol::read_frame(&mut reader,MAX_RESPONSE);
                let Some(owner)=weak.upgrade() else {break};
                match frame {
                    Ok(Some(bytes)) => match serde_json::from_slice::<Value>(&bytes) { Ok(value)=>owner.receive(value), Err(_)=>{owner.fail("INVALID_FRAME");break;} },
                    Ok(None) => { if !owner.closing.load(Ordering::SeqCst) {owner.fail("WORKER_EXIT");} else {owner.reject_pending("WORKER_EXIT");} break; },
                    Err(code)=>{owner.fail(&code);break;}
                }
                if owner.failed.load(Ordering::SeqCst) {break;}
            }
        });
        Ok(worker)
    }
    fn send(&self, value: Value) -> Result<(),String> {
        let mut bytes=serde_json::to_vec(&value).map_err(|_| "INVALID_FRAME")?;bytes.push(b'\n');
        if bytes.len()>MAX_REQUEST {return Err("PAYLOAD_TOO_LARGE".into());}
        self.input.lock().map_err(|_| "PIPE_FAILED")?.write_all(&bytes).map_err(|_| "PIPE_FAILED".into())
    }
    fn receive(self: &Arc<Self>, value: Value) {
        if value["v"]!=1 {self.fail("INVALID_FRAME");return;}
        if value.get("fatal").is_some() {self.fail("WORKER_FAILED");return;}
        if let Some(call)=value["call"].as_u64() {
            if self.host_count.fetch_add(1,Ordering::SeqCst)>=MAX_HOST {
                self.host_count.fetch_sub(1,Ordering::SeqCst);
                if self.send(json!({"v":1,"callResult":call,"ok":false,"code":"HOST_BUSY"})).is_err(){self.fail("PIPE_FAILED");}
                return;
            }
            let method=value["method"].as_str().unwrap_or("").to_owned();let args=value["args"].clone();let owner=self.clone();
            thread::spawn(move||{
                let result=(owner.host)(&method,args);
                let response=match result {Ok(value)=>json!({"v":1,"callResult":call,"ok":true,"value":value}),Err(code)=>json!({"v":1,"callResult":call,"ok":false,"code":code})};
                owner.host_count.fetch_sub(1,Ordering::SeqCst);
                if owner.send(response).is_err(){owner.fail("PIPE_FAILED");}
            });return;
        }
        if value["event"]=="state" { (self.publish)(value["value"].clone());return; }
        if let Some(id)=value["id"].as_u64() {
            // An expired id is a tombstone: it is never reused or replayed.
            let sender=self.pending.lock().unwrap().remove(&id);
            if let Some(sender)=sender {let _=sender.send(if value["ok"]==true {Ok(value["value"].clone())}else{Err("WORKER_FAILED".into())});}
        } else {self.fail("INVALID_FRAME");}
    }
    fn reject_pending(&self, code: &str) {
        for (_,sender) in std::mem::take(&mut *self.pending.lock().unwrap()) {let _=sender.send(Err(code.into()));}
    }
    fn fail(&self, code:&str) {
        if self.failed.swap(true,Ordering::SeqCst){return;}
        self.reject_pending(code); self.job.terminate(); (self.failure)(code);
    }
    pub async fn call(&self, method:&str, args:Value, timeout_ms:u64)->Reply {
        if self.failed.load(Ordering::SeqCst) || self.closing.load(Ordering::SeqCst) && method!="$shutdown" {return Err("WORKER_UNAVAILABLE".into());}
        let id=self.next_id.fetch_add(1,Ordering::SeqCst);let (tx,rx)=oneshot::channel();
        {let mut pending=self.pending.lock().unwrap();if pending.len()>=MAX_PENDING{return Err("REQUEST_BUSY".into());}pending.insert(id,tx);}
        if let Err(e)=self.send(json!({"v":1,"id":id,"method":method,"args":args})) {self.pending.lock().unwrap().remove(&id);return Err(e);}
        if timeout_ms==0 {rx.await.map_err(|_|"WORKER_EXIT".to_owned())?}
        else {match tokio::time::timeout(std::time::Duration::from_millis(timeout_ms),rx).await {
            Ok(value)=>value.map_err(|_|"WORKER_EXIT".to_owned())?,
            Err(_)=>{self.pending.lock().unwrap().remove(&id);Err("REQUEST_TIMEOUT".into())}
        }}
    }
    pub async fn stop(&self) -> Result<(),String> {
        if self.closing.swap(true,Ordering::SeqCst){return Ok(());}
        self.call("$shutdown",json!([]),0).await?;
        Ok(())
    }
    pub fn terminate(&self){self.job.terminate();}
    pub fn usage(&self)->Option<crate::platform::JobUsage>{self.job.usage()}
    pub fn pid(&self)->u32 {self.child.lock().unwrap().id()}
}
impl Drop for Worker {fn drop(&mut self){self.job.terminate();let _=self.child.get_mut().unwrap().wait();}}
