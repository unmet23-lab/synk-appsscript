#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use backup_native::{platform, protocol, schedule, secret, worker::Worker};
use serde_json::{json,Value};
use std::{collections::VecDeque, fs, io::Write, path::{Path,PathBuf}, sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}}};
use tauri::{Emitter,Manager};

struct AppState { worker:Arc<Worker>, current:Arc<Mutex<Value>>, closing:AtomicBool }
struct NativeHost { root:PathBuf, exe:PathBuf, test:bool, packaged:bool, dialogs:Mutex<VecDeque<Value>>, dialog_busy:AtomicBool, engine:Mutex<Option<fs::File>> }
impl NativeHost {
    fn call(&self,method:&str,args:Value)->Result<Value,String> {
        let args=args.as_array().ok_or("HOST_REQUEST")?;
        let first=args.first().unwrap_or(&Value::Null);
        match method {
            "secret.encrypt"=>Ok(json!(secret::encrypt(first.as_str().ok_or("HOST_REQUEST")?)?)),
            "secret.decrypt"=>{let value=secret::decrypt(first.as_str().ok_or("HOST_REQUEST")?)?;Ok(json!(value.as_str()))},
            // The engine lock while one of the window's operations runs (STAGE1_DESIGN.md 4.1).
            "engine.lock"=>{let mut held=self.engine.lock().unwrap();if held.is_some(){return Ok(json!(true));}
                match platform::try_lock(&self.root,platform::ENGINE_LOCK)?{Some(file)=>{*held=Some(file);Ok(json!(true))},None=>Ok(json!(false))}},
            "engine.unlock"=>{*self.engine.lock().unwrap()=None;Ok(json!(true))},
            "run.progress"=>Ok(backup_native::runlog::live(&self.root)),
            // 「자동 실행 등록」 is now the four run tasks in Task Scheduler (STAGE1_DESIGN.md 4.1 · 4.2).
            "startup.read"=>Ok(json!(run_tasks_registered(&self.exe,self.test)?)),
            "startup.set"=>Ok(json!(set_run_tasks(&self.exe,first.as_bool().ok_or("HOST_REQUEST")?,self.test,self.packaged)?)),
            "openExternal"=>{let value=first.as_str().ok_or("HOST_REQUEST")?;if self.test||!platform::oauth_allowed(value){return Err("OPEN_FORBIDDEN".into());}shell_open(value)?;Ok(Value::Null)},
            "openPath"=>{let value=first.as_str().ok_or("HOST_REQUEST")?;if self.test||!platform::open_directory_allowed(Path::new(value),&self.root){return Err("OPEN_FORBIDDEN".into());}shell_open(value)?;Ok(Value::Null)},
            "dialog.open"|"dialog.save"|"dialog.message"=>{
                if self.dialog_busy.swap(true,Ordering::SeqCst){return Err("DIALOG_BUSY".into());}
                let result=self.dialog(method,first);self.dialog_busy.store(false,Ordering::SeqCst);result
            },
            _=>Err("HOST_METHOD".into())
        }
    }
    fn dialog(&self,method:&str,options:&Value)->Result<Value,String>{
        if self.test {
            let next=self.dialogs.lock().unwrap().pop_front().ok_or("TEST_DIALOG_MISSING")?;
            if next["method"]!=method{return Err("TEST_DIALOG_ORDER".into());}
            return Ok(next["value"].clone());
        }
        let title=options["title"].as_str().unwrap_or("업무 백업");
        let dialog=rfd::FileDialog::new().set_title(title);
        match method {
            "dialog.open"=>{
                let properties=options["properties"].as_array().ok_or("HOST_REQUEST")?;
                let directory=properties.contains(&json!("openDirectory"));let multi=properties.contains(&json!("multiSelections"));
                let paths=match(directory,multi){(true,true)=>dialog.pick_folders(),(true,false)=>dialog.pick_folder().map(|p|vec![p]),(false,_)=>dialog.add_filter("JSON",&["json"]).pick_file().map(|p|vec![p])};
                Ok(json!({"canceled":paths.is_none(),"filePaths":paths.unwrap_or_default().iter().map(|p|p.to_string_lossy().to_string()).collect::<Vec<_>>()}))
            },
            "dialog.save"=>{
                let picked=dialog.set_file_name(options["defaultPath"].as_str().unwrap_or("업무백업-복구키.json")).add_filter("JSON",&["json"]).save_file();
                Ok(json!({"canceled":picked.is_none(),"filePath":picked.map(|p|p.to_string_lossy().to_string())}))
            },
            "dialog.message"=>{
                let buttons=options["buttons"].as_array().ok_or("HOST_REQUEST")?;let cancel=buttons.first().and_then(Value::as_str).ok_or("HOST_REQUEST")?;
                let confirm=buttons.get(1).and_then(Value::as_str).ok_or("HOST_REQUEST")?;
                let text=format!("{}\n\n{}",options["message"].as_str().unwrap_or(""),options["detail"].as_str().unwrap_or(""));
                // Put Cancel first: rfd/TaskDialog's first button is the default.
                // Native Escape/close yields Cancel, never a confirmation.
                let result=rfd::MessageDialog::new().set_title("업무 백업").set_description(text).set_buttons(rfd::MessageButtons::OkCancelCustom(cancel.into(),confirm.into())).show();
                let accepted=matches!(result,rfd::MessageDialogResult::Custom(ref s) if s==confirm);
                Ok(json!({"response":if accepted{1}else{0}}))
            },_=>Err("HOST_METHOD".into())
        }
    }
}
fn run_exe(app:&Path)->PathBuf{app.with_file_name("WorkBackupRun.exe")}
fn task_user()->String{std::env::var("USERNAME").unwrap_or_default()}
fn run_tasks_registered(app:&Path,test:bool)->Result<bool,String>{
    if test{return Ok(false);}
    schedule::registered(&run_exe(app),&task_user(),&schedule::current_sid()?)
}
/// Registers or removes the run tasks. A test or unpackaged build never touches Task
/// Scheduler. Registering also removes the Windows Run entry earlier betas used.
fn set_run_tasks(app:&Path,enabled:bool,test:bool,packaged:bool)->Result<bool,String>{
    if test||!packaged{return Err("STARTUP_TEST_DISABLED".into());}
    let (run,user,sid)=(run_exe(app),task_user(),schedule::current_sid()?);
    if enabled{
        if !run.is_file(){return Err("RUN_EXE_MISSING".into());}
        schedule::register(&run,&user,&sid,&schedule::local_now())?;
        let _=platform::startup_set(app,false,false,true);
    }else{schedule::remove(&user,&sid)?;}
    let active=schedule::registered(&run,&user,&sid)?;
    if active!=enabled{return Err("SCHEDULE_NOT_APPLIED".into());}
    Ok(active)
}

fn shell_open(value:&str)->Result<(),String>{
    use windows_sys::Win32::{UI::{Shell::ShellExecuteW,WindowsAndMessaging::SW_SHOWNORMAL}};
    let wide:Vec<u16>=value.encode_utf16().chain([0]).collect();let verb:Vec<u16>="open".encode_utf16().chain([0]).collect();
    let result=unsafe{ShellExecuteW(std::ptr::null_mut(),verb.as_ptr(),wide.as_ptr(),std::ptr::null(),std::ptr::null(),SW_SHOWNORMAL)};
    if result as isize<=32{Err("OPEN_FAILED".into())}else{Ok(())}
}

#[tauri::command]
async fn backup_call(window:tauri::WebviewWindow,state:tauri::State<'_,AppState>,method:String,args:Value)->Result<Value,String>{
    if window.label()!="main"||!window.url().is_ok_and(|u|protocol::local_url(&u))||!protocol::request_allowed(&method,&args){return Ok(json!({"ok":false,"error":"이 화면에서는 실행할 수 없습니다.","code":"INVALID_REQUEST"}));}
    if state.closing.load(Ordering::SeqCst){return Ok(json!({"ok":false,"error":"진행 중인 작업이 끝난 뒤 다시 눌러 주세요.","code":"JOB_BUSY"}));}
    let policy=&protocol::methods()[&method];
    let read_only={let value=state.current.lock().unwrap();value["readOnly"]==true||value["mode"]=="restore"};
    if read_only&&!policy.allowed_read_only{return Ok(json!({"ok":false,"error":"복구 전용 연결입니다.","code":"READ_ONLY"}));}
    Ok(match state.worker.call(&method,args,policy.timeout_ms).await {Ok(value)=>value,Err(code)=>json!({"ok":false,"error":"진행 중인 작업이 끝난 뒤 다시 눌러 주세요.","code":code})})
}

fn shutdown(app:tauri::AppHandle){
    let state=app.state::<AppState>();if state.closing.swap(true,Ordering::SeqCst){return;}
    let worker=state.worker.clone();tauri::async_runtime::spawn(async move{let result=worker.stop().await;app.exit(if result.is_ok(){0}else{1});});
}
fn show(app:&tauri::AppHandle){if let Some(window)=app.get_webview_window("main"){let _=window.unminimize();let _=window.show();let _=window.set_focus();}}
fn active(value:&Value)->bool{value["profiles"].as_object().is_some_and(|p|p.values().any(|s|s["automatic"]==true||!s["job"].is_null()))}

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

fn run()->Result<(),String>{
    let args:Vec<String>=std::env::args().skip(1).collect();
    if args.len()==2&&args[0]=="--migration-preview" {
        let source=PathBuf::from(std::env::var_os("APPDATA").ok_or("STATE_ROOT")?).join("SoloWorkBackup");
        backup_native::migration::cloud_preview(&source,Path::new(&args[1]))?;
        return Ok(());
    }
    if args.iter().any(|a|!["--background","--test-mode","--smoke"].contains(&a.as_str())){return Err("INVALID_ARGUMENT".into());}
    let test=args.contains(&"--test-mode".into());let smoke_mode=args.contains(&"--smoke".into());
    if smoke_mode&&!test{return Err("TEST_MODE_REQUIRED".into());}
    let exe=std::env::current_exe().map_err(|_|"EXECUTABLE")?;
    let resources=if cfg!(debug_assertions){std::env::var_os("SWB_RESOURCES").map(PathBuf::from).unwrap_or(exe.parent().unwrap().join("resources"))}else{exe.parent().unwrap().join("resources")};
    backup_native::bundle::verify(&resources,&[])?;
    let (root,lock)=platform::state_root(test)?;
    if root.join("migration-incomplete").exists(){return Err("MIGRATION_INCOMPLETE".into());}
    let signal=Arc::new(platform::InstanceSignal::new(&root)?);
    let scripted=if test{match std::env::var_os("SOLO_BACKUP_TEST_DIALOGS"){Some(path)=>{let data=fs::read(path).map_err(|_|"TEST_DIALOGS")?;if data.len()>131072{return Err("TEST_DIALOGS".into());}serde_json::from_slice::<VecDeque<Value>>(&data).map_err(|_|"TEST_DIALOGS")?},None=>VecDeque::new()}}else{VecDeque::new()};
    let native=Arc::new(NativeHost{root:root.clone(),exe,test,packaged:!cfg!(debug_assertions),dialogs:Mutex::new(scripted),dialog_busy:AtomicBool::new(false),engine:Mutex::new(None)});
    let current=Arc::new(Mutex::new(Value::Null));
    let background=args.contains(&"--background".into());
    let app=tauri::Builder::default().invoke_handler(tauri::generate_handler![backup_call]).setup(move|app|{
        let handle=app.handle().clone();let publish_handle=handle.clone();let published=current.clone();
        let failure_handle=handle.clone();let failure_root=root.clone();
        let worker=Worker::start(&resources,&root,lock,test,false,Arc::new(move|name,args|native.call(name,args)),Arc::new(move|value|{
            *published.lock().unwrap()=value.clone();let _=publish_handle.emit("backup:state",value);
        }),Arc::new(move|code|{
            let _=fs::write(failure_root.join("native-error.txt"),code);
            if !test{rfd::MessageDialog::new().set_title("업무 백업을 시작하지 못했습니다").set_description(code).show();}
            failure_handle.exit(1);
        })).map_err(std::io::Error::other)?;
        let initial=tauri::async_runtime::block_on(worker.call("$boot",json!([]),120000)).map_err(std::io::Error::other)?;
        *current.lock().unwrap()=initial.clone();
        app.manage(AppState{worker,current:current.clone(),closing:AtomicBool::new(false)});
        tauri::WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::App("index.html".into()))
            .data_directory(root.join("webview"))
            .title("업무 백업").inner_size(1080.0,820.0).min_inner_size(760.0,640.0).visible(!test&&!(background&&active(&initial)))
            .on_navigation(protocol::local_url).on_new_window(|_,_|tauri::webview::NewWindowResponse::Deny).build()?;
        if !test{let focus_handle=handle.clone();std::thread::spawn(move||loop{if signal.wait(){show(&focus_handle);}});}
        if !test{
            let open=tauri::menu::MenuItem::with_id(app,"open","업무 백업 열기",true,None::<&str>)?;
            let exit=tauri::menu::MenuItem::with_id(app,"exit","앱 종료 (자동 백업 중지)",true,None::<&str>)?;
            let menu=tauri::menu::Menu::with_items(app,&[&open,&exit])?;
            let icon=tauri::image::Image::from_bytes(include_bytes!("../../dist/tray.png"))?;
            tauri::tray::TrayIconBuilder::new().icon(icon).tooltip("업무 백업 · 시험판").menu(&menu)
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
    }).build(tauri::generate_context!()).map_err(|e|format!("APP_BUILD: {e}"))?;
    app.run(|app,event|{if let tauri::RunEvent::ExitRequested{api,code,..}=event{if code.is_none(){api.prevent_exit();shutdown(app.clone());}}});
    Ok(())
}
fn main(){if let Err(code)=run(){
    if code=="ALREADY_RUNNING"&&!std::env::args().any(|a|a=="--test-mode"||a=="--smoke"){return;}
    eprintln!("{code}");
    if !std::env::args().any(|a|a=="--test-mode"||a=="--migration-preview") {rfd::MessageDialog::new().set_title("업무 백업을 시작하지 못했습니다").set_description(code).show();}
    std::process::exit(1);
}}
