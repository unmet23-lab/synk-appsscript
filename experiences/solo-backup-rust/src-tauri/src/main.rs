#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use backup_native::{bundle, host, native::{self,NativeHost}, notify, platform, protocol, schedule, update, worker::Worker};
use serde_json::{json,Value};
use std::{fs, io::Write, path::{Path,PathBuf}, sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}}};
use tauri::{Emitter,Manager};

struct AppState { worker:Arc<Worker>, current:Arc<Mutex<Value>>, closing:AtomicBool, opening:Mutex<Opening> }
/// A notice's topic word on its way to the screen (4.2 「알림」). Until the screen's first call the page may not be
/// listening yet, so the word waits here. A word that waited goes a moment after that first call, so the screen has
/// its first state when it picks the topic's screen (`move` picks by the state); until it has gone, a newer word
/// replaces it rather than overtaking it (GPT GA1), so the last click is the screen that stays.
#[derive(Default)] struct Opening { ready:bool, sending:bool, topic:Option<&'static str> }
impl Opening {
    /// A word taken from the file: the word to send now, or none when it is kept for later.
    fn arrive(&mut self,topic:&'static str)->Option<&'static str>{if self.ready{Some(topic)}else{self.topic=Some(topic);None}}
    /// The screen's call: true when a kept word is to go after the short wait.
    fn call(&mut self)->bool{if self.ready||self.sending{false}else if self.topic.is_some(){self.sending=true;true}else{self.ready=true;false}}
    /// After the wait: the newest kept word, and from now on words go at once.
    fn release(&mut self)->Option<&'static str>{self.ready=true;self.sending=false;self.topic.take()}
}
const OPEN_WAIT:std::time::Duration=std::time::Duration::from_millis(300);
/// A click on a notice while the window is already open: the second start leaves the topic word in the state folder
/// before it wakes the first window (platform::state_root), which takes it when it wakes. Only an exact word of the
/// fixed list is ever taken back, from a plain small file, and the file goes whatever was in it.
const OPEN_TOPIC:&str="open-topic";
fn leave_topic(root:&Path,topic:&str){let _=fs::write(root.join(OPEN_TOPIC),topic);}
fn take_topic(root:&Path)->Option<&'static str>{
    let path=root.join(OPEN_TOPIC);
    let meta=fs::symlink_metadata(&path).ok()?;
    let text=if meta.is_file()&&meta.len()<=16{fs::read_to_string(&path).ok()}else{None};
    let _=fs::remove_file(&path);
    let text=text?;
    notify::TOPICS.iter().copied().find(|topic|*topic==text)
}
/// Hands a topic word to the screen, or keeps it if the page is not listening yet. Every send happens with the lock
/// held, so words reach the screen in the order they were taken.
fn hand_topic(app:&tauri::AppHandle,topic:&'static str){
    let state=app.state::<AppState>();
    let mut opening=state.opening.lock().unwrap();
    if let Some(topic)=opening.arrive(topic){let _=app.emit("backup:open",json!({"topic":topic}));}
}
/// The screen's call (backup_call): a kept word goes after OPEN_WAIT, the newest one if another came meanwhile.
fn screen_called(app:&tauri::AppHandle){
    if !app.state::<AppState>().opening.lock().unwrap().call(){return;}
    let app=app.clone();
    std::thread::spawn(move||{
        std::thread::sleep(OPEN_WAIT);
        let state=app.state::<AppState>();
        let mut opening=state.opening.lock().unwrap();
        if let Some(topic)=opening.release(){let _=app.emit("backup:open",json!({"topic":topic}));}
    });
}
#[tauri::command]
async fn backup_call(window:tauri::WebviewWindow,state:tauri::State<'_,AppState>,method:String,args:Value)->Result<Value,String>{
    if window.label()!="main"||!window.url().is_ok_and(|u|protocol::local_url(&u))||!protocol::request_allowed(&method,&args){return Ok(json!({"ok":false,"error":"이 화면에서는 실행할 수 없습니다.","code":"INVALID_REQUEST"}));}
    if state.closing.load(Ordering::SeqCst){return Ok(json!({"ok":false,"error":"진행 중인 작업이 끝난 뒤 다시 눌러 주세요.","code":"JOB_BUSY"}));}
    let policy=&protocol::methods()[&method];
    let read_only={let value=state.current.lock().unwrap();value["readOnly"]==true||value["mode"]=="restore"};
    if read_only&&!policy.allowed_read_only{return Ok(json!({"ok":false,"error":"복구 전용 연결입니다.","code":"READ_ONLY"}));}
    let result=match state.worker.call(&method,args,policy.timeout_ms).await {Ok(value)=>value,Err(code)=>json!({"ok":false,"error":"진행 중인 작업이 끝난 뒤 다시 눌러 주세요.","code":code})};
    // The screen listens for `backup:open` before its first call (ui/app.js), so from here on a topic can go to it.
    screen_called(window.app_handle());
    Ok(result)
}

fn shutdown(app:tauri::AppHandle){
    let state=app.state::<AppState>();if state.closing.swap(true,Ordering::SeqCst){return;}
    let worker=state.worker.clone();tauri::async_runtime::spawn(async move{let result=worker.stop().await;app.exit(if result.is_ok(){0}else{1});});
}
/// 「첫 백업이 끝남(한 번)」 (STAGE1_DESIGN.md 2.2). The first backup usually ends in the window's own job, often
/// after the window was closed to the tray or put aside: the notice shows unless the window is in front of the
/// person — shown, not minimized and focused (a minimized window is still 「visible」 to Windows — 끝판 b B1) — and a
/// window in front counts as having shown it, so a later run does not repeat it. One that could not be shown is
/// left to the next run, which judges it from the state (bin/run.rs `problems`).
struct FirstBackup{root:PathBuf,test:bool,app:tauri::AppHandle,had:Mutex<Option<bool>>}
impl FirstBackup{
    fn observe(&self,value:&Value){
        let has=value["profiles"].as_object().is_some_and(|p|p.values().any(|s|s["automatic"]==true&&s["lastBackup"]["id"].is_string()));
        let mut had=self.had.lock().unwrap();
        let new=*had==Some(false)&&has;
        if had.is_none()||has{*had=Some(has);}
        drop(had);
        if !new{return;}
        let seen=self.app.get_webview_window("main").is_some_and(|w|w.is_visible().unwrap_or(false)&&!w.is_minimized().unwrap_or(true)&&w.is_focused().unwrap_or(false));
        let (root,test)=(self.root.clone(),self.test);
        std::thread::spawn(move||{
            // Today read under the ledger's lock, as the run executable does (설치 세션이 넘긴 P2).
            notify::deliver_now(&root,&[notify::first_backup()],&[],||schedule::local_now().chars().take(10).collect(),|n|if test||seen{Ok(())}else{notify::show(n)});
        });
    }
}
fn show(app:&tauri::AppHandle){if let Some(window)=app.get_webview_window("main"){let _=window.unminimize();let _=window.show();let _=window.set_focus();}}
// 화면 세션 E20: programs being installed (다시 깔기) keep the app when its window closes, as a job does.
fn active(value:&Value)->bool{value["profiles"].as_object().is_some_and(|p|p.values().any(|s|s["automatic"]==true||!s["job"].is_null()))||value["move"]["reinstall"]["running"]==true}

async fn smoke(app:tauri::AppHandle,report:PathBuf)->Result<(),String>{
    let state=app.state::<AppState>();let worker=state.worker.clone();drop(state);
    async fn call(worker:&Worker,name:&str,args:Value)->Result<Value,String>{let result=worker.call(name,args,120000).await?;if result["ok"]!=true{return Err(format!("SMOKE_{}",name));}Ok(result["value"].clone())}
    async fn idle(worker:&Worker)->Result<Value,String>{for _ in 0..1200{let value=call(worker,"getState",json!([])).await?;if value["job"].is_null(){return Ok(value);}tokio::time::sleep(std::time::Duration::from_millis(100)).await;}Err("SMOKE_TIMEOUT".into())}
    call(&worker,"chooseSources",json!([])).await?;call(&worker,"chooseTarget",json!([])).await?;
    call(&worker,"setup",json!([])).await?;call(&worker,"saveRecoveryKit",json!([])).await?;
    call(&worker,"protectNow",json!([])).await?;let backup=idle(&worker).await?;
    if backup["lastBackup"]["id"].as_str().is_none(){return Err("SMOKE_BACKUP".into());}
    let catalog=call(&worker,"openFileCatalog",json!([{"profile":"local"}])).await?;
    let token=catalog["token"].clone();let page=call(&worker,"queryFileCatalog",json!([{"profile":"local","token":token,"query":"","offset":0}])).await?;
    let row=page["rows"].as_array().and_then(|rows|rows.first()).ok_or("SMOKE_CATALOG")?;
    let selection=call(&worker,"setFileSelection",json!([{"profile":"local","token":token,"revision":page["selection"]["revision"],"action":"add","ids":[row["id"]]}])).await?;
    call(&worker,"restoreSelected",json!([{"profile":"local","token":token,"revision":selection["selection"]["revision"]}])).await?;
    let selected=idle(&worker).await?;
    if selected["lastSelectedRestore"]["path"].as_str().is_none(){return Err("SMOKE_SELECTION".into());}
    call(&worker,"restoreLatest",json!([])).await?;let restored=idle(&worker).await?;
    if restored["lastRestore"]["path"].as_str().is_none(){return Err("SMOKE_RESTORE".into());}
    call(&worker,"setAutomatic",json!([false])).await?;
    let result=json!({"backup":backup["lastBackup"],"selected":selected["lastSelectedRestore"],"restore":restored["lastRestore"],"startupRegistered":restored["launchAtLogin"],"startupWarning":backup["startupWarning"],"workerPid":worker.pid(),"productionTouched":false});
    let mut output=fs::OpenOptions::new().create_new(true).write(true).open(report).map_err(|_|"SMOKE_REPORT")?;
    output.write_all(serde_json::to_string_pretty(&result).unwrap().as_bytes()).map_err(|_|"SMOKE_REPORT")?;Ok(())
}

fn context()->tauri::Context<tauri::Wry>{tauri::generate_context!()}
fn epoch_ms()->u64{std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis() as u64).unwrap_or(0)}

/// The updater without a window (STAGE1_DESIGN.md 4.10). It takes no window lock, so it also runs while the
/// window is open; installing takes the engine lock instead (update::install).
fn updater_app()->Result<tauri::App,String>{
    tauri::Builder::default().plugin(tauri_plugin_updater::Builder::new().build()).build(context()).map_err(|e|format!("APP_BUILD: {e}"))
}
fn updating_folder()->Result<PathBuf,&'static str>{
    let exe=std::env::current_exe().map_err(|_|"EXECUTABLE")?;
    if exe.parent().is_some_and(platform::installing){return Err("INSTALLING");}
    platform::state_dir(false).map_err(|_|"STATE_ROOT")
}
/// `--update-check` (a person, SYNK 솔리오 — the result goes to `update.json`), `--update-check-due` (what the run
/// executable starts: the same, only if it is still due once the check lock is held) and `--update-install` (also what
/// SYNK 솔리오 can start). JSON lines out: a check writes one;
/// `--update-install` writes `{"ok":true,"installing":<version>}` just before the installer is started and then one
/// closing line, `{"ok":true,…}` or `{"ok":false,"error":<code>}` (카본 끝판 A2). Exit 0: checked, already the
/// newest, or the installer started and took over (its marker is in the install folder); 3: a package whose signature
/// or signed version is wrong, nothing installed; 75: this user's backup or restore holds the engine, or another update check is going (CHECK_BUSY), try
/// later; 78: this build has no public key yet; 1: anything else (the line says which). `quiet`: `--update-install --quiet`,
/// what SYNK 솔리오's 「할 일」 starts (SOLIO_ONE_CLIENT.md 3.2) — the installer without its window (`/S`), and nothing is
/// opened when it is done.
fn update_mode(mode:&str,quiet:bool)->i32{
    let outcome=(||->Result<Value,&'static str>{
        let root=updating_folder()?;
        // One check at a time, whoever starts it (a run, a person, SYNK 솔리오): the lock comes first and is held until
        // update.json is written, so it is the one writer there (11-20 설계 검토). Held by another check, or not to be had
        // (update::check_lock): nothing is written, and the next run tries again (11-20 저녁 설계 검토).
        let checking=mode!="--update-install";
        let _lock=if checking{match update::check_lock(&root){Ok(Some(lock))=>{update::clear_temps(&root);Some(lock)},Ok(None)=>return Err("CHECK_BUSY"),Err(())=>return Err("CHECK_LOCK")}}else{None};
        // The run executable's check (`--update-check-due`) looks again once it holds the lock: one that waited behind
        // another finds the fresh record and asks the feed no second time (GPT -d GA4). This app's own file version
        // counts as in the run (update::due_for).
        let own=std::env::current_exe().ok().and_then(|exe|update::installed_version(&exe));
        // Not due after all ends with its own code, so the run's record tells it from a check (GPT run-check GA2).
        if mode=="--update-check-due"&&!update::due_for(&update::read(&root),epoch_ms(),own.as_deref()){return Err("NOT_DUE");}
        let app=updater_app().map_err(|_|"APP_BUILD")?;let handle=app.handle().clone();
        let current=handle.package_info().version.to_string();
        tauri::async_runtime::block_on(async{
            if checking{
                // The try is written before the feed is asked, so one ended part way still counts.
                update::write(&root,&update::tried(&update::read(&root),&current,epoch_ms())).map_err(|_|"UPDATE_RECORD")?;
                let found=update::check(&handle).await;
                let available=found.as_ref().ok().and_then(|u|u.as_ref()).map(|u|u.version.clone());
                // The version's 14 days count from the feed's date for it (update::checked_at), not from this check.
                let published=found.as_ref().ok().and_then(|u|u.as_ref()).and_then(update::published_ms);
                let record=update::checked_at(&update::read(&root),&current,found.as_ref().map(|_|available.as_deref()).map_err(|code|*code),published,epoch_ms());
                update::write(&root,&record).map_err(|_|"UPDATE_RECORD")?;
                found.map(|_|record)
            }else{
                update::install(&handle,&root,quiet,|version|println!("{}",json!({"ok":true,"installing":version}))).await.map(|()|json!({}))
            }
        })
    })();
    match outcome{
        Ok(value)=>{println!("{}",json!({"ok":true,"result":value}));0},
        Err("UP_TO_DATE")=>{println!("{}",json!({"ok":true,"result":{"available":null}}));0},
        Err("NOT_DUE")=>{println!("{}",json!({"ok":true,"result":{"due":false}}));update::NOT_DUE_EXIT},
        Err(code)=>{println!("{}",json!({"ok":false,"error":code}));match code{"UPDATE_SIGNATURE"=>3,"RUN_ACTIVE"|"CHECK_BUSY"=>75,"UPDATE_NOT_CONFIGURED"=>78,_=>1}}
    }
}
fn update_message(code:&str)->&'static str{match code{
    "RUN_ACTIVE"=>"지금 백업이나 복구가 진행 중입니다. 끝난 뒤 알림을 다시 눌러 주세요.",
    "UPDATE_START"=>"관리자 확인을 받지 못해 업데이트하지 않았습니다. 이 컴퓨터의 관리자에게 업데이트를 부탁해 주세요.",
    "UPDATE_SIGNATURE"=>"받은 파일이 SYNK가 서명한 업데이트와 달라 설치하지 않았습니다. 지금 판을 그대로 씁니다.",
    "UPDATE_FEED"=>"업데이트를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 해 주세요.",
    "INSTALLING"=>"다른 설치나 업데이트가 이미 진행 중입니다. 끝난 뒤 다시 해 주세요.",
    "UPDATE_STOPPED"=>"업데이트 설치기가 설치를 시작하지 않고 끝났습니다. 앱은 지금 판 그대로입니다. 잠시 뒤 다시 해 주세요.",
    "UPDATE_UNCONFIRMED"=>"업데이트 설치가 시작됐는지 확인하지 못했습니다. 잠시 뒤 앱을 다시 열어 판을 확인해 주세요.",
    _=>"업데이트하지 못했습니다. 잠시 뒤 다시 해 주세요.",
}}
/// On the start that opens the window after one already asked about an update, so it is not asked again.
const UPDATE_ASKED:&str="SWB_UPDATE_ASKED";
/// Asks once about a newer version and installs it if the person says so. True when an installer was started and took
/// over: it opens the window itself when it is done. `before_runs`: the window is opening while no run task is
/// registered (before protection starts, or with automatic backup off) — nobody asked to check, so a check that did not
/// reach the feed says nothing, and no automatic backup is there to pause.
fn ask_update(before_runs:bool)->Result<bool,String>{
    let root=updating_folder()?;
    let app=updater_app()?;let handle=app.handle().clone();
    let say=|text:&str|{rfd::MessageDialog::new().set_title("업무 백업 업데이트").set_description(text).show();};
    let found=tauri::async_runtime::block_on(update::check_for_click(&handle));
    // The click only reads the feed: update.json is written by checks holding the check lock alone, each asking the feed
    // and writing under it (11-20 설계 검토 조건 2). A version taken off the feed stops being told at the next check,
    // which comes every 3 hours while a newer version is announced (update::due_for, 11-20 밤 설계 검토).
    match found{
        Ok(Some(next))=>{
            let version=update::version_text(&next.version).unwrap_or_default();
            let pause=if before_runs{""}else{"업데이트하는 동안 자동 백업이 잠시 멈추고, "};
            // An account that cannot approve the prompt itself (the weekly 「관리자에게 부탁」 notice) is told the administrator
            // types their password here — the one way such a PC is updated (GPT workbackup-update-notice GA2 · -b GA5).
            let text=if update::can_approve(){format!("새 판 {version}이 나왔습니다. 지금 업데이트할까요?\n\n관리자 확인이 한 번 뜹니다. {pause}끝나면 앱이 다시 열립니다.")}
                else{format!("새 판 {version}이 나왔습니다. 설치에는 이 컴퓨터 관리자 계정의 비밀번호가 필요합니다.\n\n관리자가 함께 있으면 「업데이트」를 누르고, 뜨는 Windows 확인 창에 관리자 비밀번호를 넣어 주세요. {pause}끝나면 앱이 다시 열립니다.")};
            // Cancel first, as in every dialog here: Escape or closing it is 「나중에」.
            let answer=rfd::MessageDialog::new().set_title("업무 백업 업데이트").set_description(text).set_buttons(rfd::MessageButtons::OkCancelCustom("나중에".into(),"업데이트".into())).show();
            if matches!(answer,rfd::MessageDialogResult::Custom(ref s) if s=="업데이트"){
                // A started installer opens the window itself when it is done.
                match tauri::async_runtime::block_on(update::install(&handle,&root,false,|_|{})){Ok(())=>return Ok(true),Err("UP_TO_DATE")=>{},Err(code)=>say(update_message(code))}
            }
        },
        Ok(None)|Err("UPDATE_NOT_CONFIGURED")=>{},
        Err(_) if before_runs=>{},
        Err(code)=>say(update_message(code)),
    }
    Ok(false)
}
/// Opens the window in a new start of this app, on this topic's screen if one is given, marked as asked. The check needs a
/// Tauri app of its own, and a process makes only one, so the window cannot open in the start that asked.
fn open_asked(topic:Option<&str>)->Result<(),String>{
    let exe=std::env::current_exe().map_err(|_|"EXECUTABLE")?;
    std::process::Command::new(exe).args(topic.map(notify::open_url)).env(UPDATE_ASKED,"1").spawn().map(|_|()).map_err(|_|"OPEN_FAILED".into())
}
/// A click on the 「업데이트 준비됨」 notice (`synk-workbackup:open?topic=update`): ask once, and update. If
/// there is nothing to install, the person says later, or it cannot go ahead, the window opens as for any
/// other notice (a started installer opens it itself when it is done).
fn offer_update()->Result<(),String>{
    if ask_update(false)?{return Ok(());}
    open_asked(None)
}
/// Whether a start that opens the window asks about a newer version first (4.10, 11-25): only the run tasks check the feed
/// each day, so with none registered (before protection starts, or with automatic backup off) an installed version
/// would stay as it is — 0.7.0, installed 11-23 and not set up, never heard of 0.7.2. A person's start of the release
/// app only: not the start at sign-in, a test, or the start opened after asking. Not knowing whether the tasks are there
/// (Task Scheduler did not answer) asks nothing.
fn asks_before_open(test:bool,debug:bool,background:bool,asked:bool,registered:impl FnOnce()->Result<bool,String>)->bool{
    !test&&!debug&&!background&&!asked&&matches!(registered(),Ok(false))
}

/// What a start of this app is for (SOLIO_ONE_CLIENT.md 2.5). A release build hands a person's start — none of its own
/// arguments (an old shortcut, Explorer, the installer's end), or one notice's open address — to SYNK 솔리오's backup room,
/// and opens its own window (the emergency window) only when SYNK 솔리오 is not there, for `--window` (SYNK 솔리오's
/// 「백업 창 따로 열기」), or in the start opened after an update question (`asked`, open_asked). `--background`, the
/// window's start at sign-in in earlier versions, does nothing. A debug build keeps its window and its test switches.
/// Both take `--solio`, the host; only a debug build takes it with `--test-mode`.
#[derive(Debug,PartialEq,Eq)]
enum Start{ Solio(&'static str), Window, Host{test:bool}, Nothing }
fn start_of(args:&[String],debug:bool,asked:bool)->Result<Start,&'static str>{
    let all:Vec<&str>=args.iter().map(String::as_str).collect();
    if all.contains(&"--solio"){
        return match all.as_slice(){
            ["--solio"]=>Ok(Start::Host{test:false}),
            ["--solio","--test-mode"]|["--test-mode","--solio"] if debug=>Ok(Start::Host{test:true}),
            _=>Err("INVALID_ARGUMENT"),
        };
    }
    if debug{return Ok(Start::Window);}
    let topic=match all.as_slice(){[]=>Some("status"),[one]=>notify::topic_of(one),_=>None};
    match (all.as_slice(),topic){
        (_,Some(topic))=>Ok(if asked{Start::Window}else{Start::Solio(topic)}),
        (["--window"],_)=>Ok(Start::Window),
        (["--background"],_)=>Ok(Start::Nothing),
        _=>Err("INVALID_ARGUMENT"),
    }
}
/// Hands this start to SYNK 솔리오's backup room on `topic`'s screen (2.5). False — the window opens instead — when SYNK
/// 솔리오 is not there, the address could not be opened, or this folder is mid-install (the window code says so, or opens
/// nothing while an install runs).
fn to_solio(topic:&str)->bool{
    let Some(folder)=std::env::current_exe().ok().and_then(|exe|exe.parent().map(Path::to_path_buf)) else{return false};
    if platform::installing(&folder)||(!folder.join("WorkBackupRun.exe").is_file()&&folder.join("WorkBackupRun.exe.old").is_file()){return false;}
    host::solio_present()&&host::open_solio(topic).is_ok()
}

fn run()->Result<(),String>{
    let args:Vec<String>=std::env::args().skip(1).collect();
    match start_of(&args,cfg!(debug_assertions),std::env::var_os(UPDATE_ASKED).is_some())?{
        Start::Nothing=>return Ok(()),
        // The host writes its own lines and ends with its own code; it never shows a dialog.
        Start::Host{test}=>std::process::exit(host::serve(test)),
        Start::Solio(topic)=>if to_solio(topic){return Ok(());},
        Start::Window=>{},
    }
    // `--window` opens the window as a start with none of its own arguments did.
    let args:Vec<String>=args.into_iter().filter(|a|a!="--window").collect();
    if matches!(args.as_slice(),[one] if notify::topic_of(one)==Some("update")){return offer_update();}
    // The test, smoke and 0.5.0 preview switches exist in debug builds only (STAGE1_DESIGN.md 4.2 「알림」);
    // a release build's window takes nothing but --background, or one open address (start_of).
    #[cfg(debug_assertions)]
    if args.len()==2&&args[0]=="--migration-preview" {
        let source=PathBuf::from(std::env::var_os("APPDATA").ok_or("STATE_ROOT")?).join("SoloWorkBackup");
        backup_native::migration::cloud_preview(&source,Path::new(&args[1]))?;
        return Ok(());
    }
    let switches:&[&str]=if cfg!(debug_assertions){&["--background","--test-mode","--smoke"]}else{&["--background"]};
    // A notification's click is exactly one open address and nothing else (4.2 「알림」). Its topic word goes to the
    // screen as `backup:open`, which opens that screen (ui/app.js openTopic); no topic acts on being opened.
    let topic=match args.as_slice(){[one]=>notify::topic_of(one),_=>None};
    if topic.is_none()&&args.iter().any(|a|!switches.contains(&a.as_str())){return Err("INVALID_ARGUMENT".into());}
    let test=args.contains(&"--test-mode".into());let smoke_mode=args.contains(&"--smoke".into());
    if smoke_mode&&!test{return Err("TEST_MODE_REQUIRED".into());}
    let exe=std::env::current_exe().map_err(|_|"EXECUTABLE")?;
    // An install or uninstall replacing this folder's files opens nothing (the installer opens the app itself once it is
    // done); one that stopped part way is told as such (bundle::start_check, shared with the host).
    let resources=bundle::resources_dir(&exe);
    bundle::start_check(&exe,&resources)?;
    // The word is left before the window lock is tried: if a window is already open, state_root wakes it and it takes
    // the word; if this start is the window, it takes its own word back (and clears one a crashed start left).
    if let Some(topic)=topic{if let Ok(dir)=platform::state_dir(test){leave_topic(&dir,topic);}}
    let (root,lock)=platform::state_root(test)?;
    let launch_topic=take_topic(&root).filter(|_|topic.is_some());
    if root.join("migration-incomplete").exists(){return Err("MIGRATION_INCOMPLETE".into());}
    let background=args.contains(&"--background".into());
    // Asked with the window lock held, so a second start meanwhile (another press in SYNK 솔리오) opens no second question.
    // Task Scheduler is asked on a thread of its own: its COM apartment stays off this thread, where the window's is made.
    let registered=||{let app=exe.clone();std::thread::spawn(move||native::run_tasks_registered(&app,false)).join().unwrap_or_else(|_|Err("SCHEDULE_THREAD".into()))};
    if asks_before_open(test,cfg!(debug_assertions),background,std::env::var_os(UPDATE_ASKED).is_some(),registered){
        let installing=matches!(ask_update(true),Ok(true));
        // A start meanwhile (another press in SYNK 솔리오, a notice) left its word and ended at the held lock, with no
        // window yet to wake: the newest word is the screen the new start opens, as with a window already open (카본 끝판 A1).
        let topic=take_topic(&root).or(launch_topic);
        drop(lock);
        return if installing{Ok(())}else{open_asked(topic)};
    }
    let signal=Arc::new(platform::InstanceSignal::new(&root)?);
    let scripted=native::scripted_dialogs(test)?;
    let native=Arc::new(NativeHost::window(root.clone(),exe,test,!cfg!(debug_assertions),scripted));
    let current=Arc::new(Mutex::new(Value::Null));
    let app=tauri::Builder::default().invoke_handler(tauri::generate_handler![backup_call]).setup(move|app|{
        let handle=app.handle().clone();let publish_handle=handle.clone();let published=current.clone();
        let failure_handle=handle.clone();let failure_root=root.clone();
        let first=Arc::new(FirstBackup{root:root.clone(),test,app:handle.clone(),had:Mutex::new(None)});let first_seen=first.clone();
        let worker=Worker::start(&resources,&root,lock,test,false,Arc::new(move|name,args|native.call(name,args)),Arc::new(move|value|{
            first_seen.observe(&value);
            *published.lock().unwrap()=value.clone();let _=publish_handle.emit("backup:state",value);
        }),Arc::new(move|code|{
            let _=fs::write(failure_root.join("native-error.txt"),code);
            if !test{rfd::MessageDialog::new().set_title("업무 백업을 시작하지 못했습니다").set_description(code).show();}
            failure_handle.exit(1);
        })).map_err(std::io::Error::other)?;
        let initial=tauri::async_runtime::block_on(worker.call("$boot",json!([]),120000)).map_err(std::io::Error::other)?;
        first.observe(&initial);
        *current.lock().unwrap()=initial.clone();
        app.manage(AppState{worker,current:current.clone(),closing:AtomicBool::new(false),opening:Mutex::new(Opening{topic:launch_topic,..Opening::default()})});
        tauri::WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::App("index.html".into()))
            .data_directory(root.join("webview"))
            // The screen is black (11-13 시안 A): no white flash before the web page is drawn (화면 세션 11-16).
            .background_color(tauri::window::Color(0,0,0,255))
            .title("업무 백업").inner_size(1080.0,820.0).min_inner_size(760.0,640.0).visible(!test&&!(background&&active(&initial)))
            .on_navigation(protocol::local_url).on_new_window(|_,_|tauri::webview::NewWindowResponse::Deny).build()?;
        if !test{
            let focus_handle=handle.clone();let topic_root=root.clone();
            std::thread::spawn(move||loop{if signal.wait(){show(&focus_handle);if let Some(topic)=take_topic(&topic_root){hand_topic(&focus_handle,topic);}}});
        }
        if !test{
            let open=tauri::menu::MenuItem::with_id(app,"open","업무 백업 열기",true,None::<&str>)?;
            let exit=tauri::menu::MenuItem::with_id(app,"exit","앱 종료 (자동 백업 중지)",true,None::<&str>)?;
            let menu=tauri::menu::Menu::with_items(app,&[&open,&exit])?;
            let icon=tauri::image::Image::from_bytes(include_bytes!("../../dist/tray.png"))?;
            tauri::tray::TrayIconBuilder::new().icon(icon).tooltip("업무 백업").menu(&menu)
                .on_menu_event(|app,event|{if event.id.as_ref()=="open"{show(app);}else if event.id.as_ref()=="exit"{shutdown(app.clone());}})
                .on_tray_icon_event(|tray,event|{if matches!(event,tauri::tray::TrayIconEvent::DoubleClick{..}){show(tray.app_handle());}}).build(app)?;
        }
        if smoke_mode{
            let smoke_handle=handle.clone();let report=PathBuf::from(std::env::var_os("SOLO_BACKUP_SMOKE_REPORT").ok_or_else(||std::io::Error::other("SMOKE_REPORT"))?);
            tauri::async_runtime::spawn(async move{if let Err(code)=smoke(smoke_handle.clone(),report.clone()).await{let _=fs::write(report.with_extension("error.txt"),code);smoke_handle.exit(1);}else{shutdown(smoke_handle);}});
        }
        Ok(())
    }).on_window_event(|window,event|{
        if let tauri::WindowEvent::CloseRequested{api,..}=event{
            api.prevent_close();let state=window.state::<AppState>();
            if active(&state.current.lock().unwrap()){let _=window.hide();}else{shutdown(window.app_handle().clone());}
        }
    }).build(context()).map_err(|e|format!("APP_BUILD: {e}"))?;
    app.run(|app,event|{if let tauri::RunEvent::ExitRequested{api,code,..}=event{if code.is_none(){api.prevent_exit();shutdown(app.clone());}}});
    Ok(())
}
/// The update starts of the command line (4.10): `--update-check`, `--update-check-due` or `--update-install` alone, or
/// `--update-install --quiet` — SYNK 솔리오's 「할 일」 (SOLIO_ONE_CLIENT.md 3.2), the same install with its installer
/// windowless. The mode and that `quiet`, which update_mode hands to update::install as it is; None for any other start.
fn update_start(args:&[String])->Option<(&'static str,bool)>{
    match args{
        [mode]=>["--update-check","--update-check-due","--update-install"].into_iter().find(|m|*m==mode.as_str()).map(|m|(m,false)),
        [mode,quiet] if mode=="--update-install"&&quiet=="--quiet"=>Some(("--update-install",true)),
        _=>None,
    }
}
/// The exit of a start that found the window lock held with no window to wake: 75 (try later), in test mode too. An install
/// going is 75 too for `--window` (SYNK 솔리오's 「백업 창 따로 열기」), so its 0 is only ever a woken window (GPT
/// workbackup-solio-one-be-20261127-r5 GA3); other starts of an install going end 0 as before (test-support/installer-check.ps1).
/// None for the rest.
const WINDOW_HELD_EXIT:i32=75;
fn window_exit(code:&str,window:bool)->Option<i32>{(code=="WINDOW_HELD"||window&&code=="INSTALLING").then_some(WINDOW_HELD_EXIT)}
fn main(){
    if let Some((mode,quiet))=update_start(&std::env::args().skip(1).collect::<Vec<_>>()){std::process::exit(update_mode(mode,quiet));}
    if let Err(code)=run(){
    // No window to wake while the lock is held: 75, 「try again」, never shown (SYNK 솔리오's 「백업 창 따로 열기」 tries again
    // on it, SOLIO_ONE_CLIENT.md 8.1), and for `--window` an install going too. A woken window, and an install going for
    // the other starts, end 0 as before.
    if let Some(exit)=window_exit(&code,std::env::args().any(|a|a=="--window")){std::process::exit(exit);}
    if (code=="ALREADY_RUNNING"||code=="INSTALLING")&&!std::env::args().any(|a|a=="--test-mode"||a=="--smoke"){return;}
    if code=="INSTALL_INCOMPLETE"{
        eprintln!("{code}");
        rfd::MessageDialog::new().set_title("업무 백업 설치가 끝나지 않았습니다").set_description("설치가 중간에 멈춰서 자동 백업이 돌지 않습니다. SYNK 업무 백업 설치 파일을 다시 실행해 주세요. 백업해 둔 자료와 설정은 그대로 있습니다.").show();
        std::process::exit(1);
    }
    eprintln!("{code}");
    if !std::env::args().any(|a|a=="--test-mode"||a=="--migration-preview") {rfd::MessageDialog::new().set_title("업무 백업을 시작하지 못했습니다").set_description(code).show();}
    std::process::exit(1);
}}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn a_window_kept_out_by_the_host_ends_75_and_a_woken_one_0(){
        // SYNK 솔리오's 「백업 창 따로 열기」 tries again on 75 only (GPT workbackup-solio-one-be-20261127-r3 GA1).
        assert_eq!(window_exit(platform::held_code(false),true),Some(75));
        assert_eq!(window_exit(platform::held_code(false),false),Some(75));
        assert_eq!(window_exit(platform::held_code(true),true),None);
        assert_eq!(window_exit("INSTALLING",true),Some(75),"--window: an install going is 「try later」, never a woken window (r5 GA3)");
        assert_eq!(window_exit("INSTALLING",false),None,"other starts of an install going end 0 as before (installer-check.ps1)");
    }
    #[test] fn an_update_start_reaches_the_installer_with_its_own_arguments(){
        // GPT workbackup-solio-one-be-20261127 GD4: the command line to the installer's arguments in one line of travel —
        // update_start's `quiet` is what update_mode hands update::install, which starts the installer with installer_args.
        let args=|a:&[&str]|a.iter().map(|s|s.to_string()).collect::<Vec<_>>();
        let installer=|a:&[&str]|update_start(&args(a)).filter(|(mode,_)|*mode=="--update-install").map(|(_,quiet)|update::installer_args(quiet));
        assert_eq!(installer(&["--update-install","--quiet"]),Some("/S /UPDATE"),"SYNK 솔리오's 「할 일」: windowless");
        assert_eq!(installer(&["--update-install"]),Some("/P /UPDATE"),"the notice's click: the progress window");
        assert_eq!(update_start(&args(&["--update-check"])),Some(("--update-check",false)));
        assert_eq!(update_start(&args(&["--update-check-due"])),Some(("--update-check-due",false)));
        for other in [&["--update-check","--quiet"][..],&["--quiet","--update-install"],&["--update-install","--Quiet"],&["--update-install","--quiet","x"],&["--update"],&["--window"],&[]]{
            assert_eq!(update_start(&args(other)),None,"{other:?}");
        }
    }
    #[test] fn a_window_start_asks_about_an_update_only_while_no_run_task_checks(){
        let none=||Ok::<bool,String>(false);let there=||Ok::<bool,String>(true);let unknown=||Err::<bool,String>("SCHEDULE_COM:0x1".into());
        assert!(asks_before_open(false,false,false,false,none));
        assert!(!asks_before_open(false,false,false,false,there));
        assert!(!asks_before_open(false,false,false,false,unknown));
        // A test, a debug build, the start at sign-in and the start opened after asking never ask.
        for (test,debug,background,asked) in [(true,false,false,false),(false,true,false,false),(false,false,true,false),(false,false,false,true)]{
            let mut looked=false;
            assert!(!asks_before_open(test,debug,background,asked,||{looked=true;Ok(false)}));
            assert!(!looked,"Task Scheduler is not asked for {test} {debug} {background} {asked}");
        }
    }
    #[test] fn a_topic_word_is_taken_back_once_and_only_from_the_fixed_list(){
        let dir=std::env::temp_dir().join(format!("swb-open-topic-{}",std::process::id()));
        let _=fs::remove_dir_all(&dir);fs::create_dir_all(&dir).unwrap();
        assert_eq!(take_topic(&dir),None);
        for topic in notify::TOPICS{leave_topic(&dir,topic);assert_eq!(take_topic(&dir),Some(topic));assert_eq!(take_topic(&dir),None);}
        for bad in ["STATUS","status\n"," restore","../status","status?x=1","","statusstatusstatus"]{
            fs::write(dir.join(OPEN_TOPIC),bad).unwrap();
            assert_eq!(take_topic(&dir),None,"{bad:?}");
            assert!(!dir.join(OPEN_TOPIC).exists(),"{bad:?} is left");
        }
        // Not a plain file: nothing is read from it.
        fs::create_dir(dir.join(OPEN_TOPIC)).unwrap();fs::write(dir.join(OPEN_TOPIC).join("x"),"status").unwrap();
        assert_eq!(take_topic(&dir),None);
        fs::remove_dir_all(&dir).unwrap();
    }
    #[test] fn the_last_word_clicked_is_the_screen_that_stays(){
        // A start with a word: it waits for the screen's first call, a newer click meanwhile replaces it (GPT GA1),
        // only one wait is started, and afterwards words go at once.
        let mut opening=Opening{topic:Some("restore"),..Opening::default()};
        assert_eq!(opening.arrive("move"),None);
        assert!(opening.call());
        assert!(!opening.call(),"a second call while the word waits starts no second wait");
        assert_eq!(opening.arrive("status"),None,"a click during the wait does not overtake the waiting word");
        assert_eq!(opening.release(),Some("status"));
        assert_eq!(opening.arrive("space"),Some("space"));
        assert!(!opening.call());
        // A start without a word: the first call makes the screen ready, and words go at once.
        let mut opening=Opening::default();
        assert_eq!(opening.arrive("devices"),None,"a click before the screen's first call waits for it");
        assert!(opening.call());
        assert_eq!(opening.release(),Some("devices"));
        let mut opening=Opening::default();
        assert!(!opening.call());
        assert_eq!(opening.arrive("changes"),Some("changes"));
    }
    #[test] fn a_release_start_goes_to_solio_and_its_window_is_the_emergency_one(){
        let args=|list:&[&str]|list.iter().map(|s|s.to_string()).collect::<Vec<_>>();
        let release=|list:&[&str]|start_of(&args(list),false,false);
        // SOLIO_ONE_CLIENT.md 2.5: none of its own arguments and a notice's address go to SYNK 솔리오's backup room.
        assert_eq!(release(&[]),Ok(Start::Solio("status")));
        for topic in notify::TOPICS{assert_eq!(release(&[&notify::open_url(topic)]),Ok(Start::Solio(topic)),"{topic}");}
        assert_eq!(release(&["--window"]),Ok(Start::Window));
        assert_eq!(release(&["--background"]),Ok(Start::Nothing));
        assert_eq!(release(&["--solio"]),Ok(Start::Host{test:false}));
        // The start opened after an update question is the window itself, never handed on again.
        assert_eq!(start_of(&args(&[]),false,true),Ok(Start::Window));
        assert_eq!(start_of(&args(&[&notify::open_url("restore")]),false,true),Ok(Start::Window));
        // A release takes nothing else: no test switches, no two at once, no word that is not exactly an open address.
        for bad in [&["--test-mode"][..],&["--smoke"],&["--solio","--test-mode"],&["--test-mode","--solio"],&["--solio","--window"],&["--window","--background"],
                    &["--window",&notify::open_url("status")],&["synk-workbackup:open?topic=settings"],&["synk-solio:backup?topic=status"],&["--migration-preview","x"],
                    &["--update-install","--quiet"],&[""]]{
            assert_eq!(release(bad),Err("INVALID_ARGUMENT"),"{bad:?}");
        }
        // A debug build keeps its window for everything else and takes the host's test mode.
        let debug=|list:&[&str]|start_of(&args(list),true,false);
        for window in [&[][..],&["--test-mode"],&["--test-mode","--smoke"],&["--background"],&["--window"],&["--window","--test-mode"],&["--migration-preview","x"],&[&notify::open_url("move")]]{
            assert_eq!(debug(window),Ok(Start::Window),"{window:?}");
        }
        assert_eq!(debug(&["--solio","--test-mode"]),Ok(Start::Host{test:true}));
        assert_eq!(debug(&["--test-mode","--solio"]),Ok(Start::Host{test:true}));
        assert_eq!(debug(&["--solio"]),Ok(Start::Host{test:false}));
        for bad in [&["--solio","--smoke"][..],&["--solio","--test-mode","--smoke"],&["--solio","--solio"]]{assert_eq!(debug(bad),Err("INVALID_ARGUMENT"),"{bad:?}");}
    }
}
