using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Serialization.Json;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Text.RegularExpressions;

namespace Synk.SignalInstaller
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            string cache = null;
            try
            {
                Assembly assembly = Assembly.GetExecutingAssembly();
                InstallSpec spec;
                using (Stream stream = assembly.GetManifestResourceStream("install.json"))
                    spec = (InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
                // 가림막 방식: 다른 인자가 무엇이든 설치하지 않고 가림막만 그린다. 설치 엔진과 뮤텍스를 쓰지 않는다(1-가 구현 설계 2절)
                string curtainToken;
                if (Handoff.IsCurtain(args, out curtainToken)) return Curtain.Run(assembly, spec, curtainToken);
                AutomaticArguments automatic = ParseAutomaticArguments(args);
                if (automatic == null) WaitForUpdatingApplication(args, spec.ExecutableName);
                SignalProduct product = SignalProduct.ById(spec.Product);
                // 제품마다 설치 화면 하나만(플랫폼 안에서 WORLD와 워크스페이스 설치 창을 함께 열 수 있다)
                bool created;
                using (Mutex mutex = new Mutex(true, @"Local\SYNK.Signal.Installer." + product.Id + "." + WindowsIdentity.GetCurrent().User.Value, out created))
                {
                    // A restored app can request a retry while the prior
                    // installer is finishing its short relaunch verification.
                    // Wait normally in auto mode; never kill or overlap installs.
                    if (!created && automatic != null)
                    {
                        try { created = mutex.WaitOne(10000); }
                        catch (AbandonedMutexException) { created = true; }
                    }
                    // Platform: 도는 설치기(조용히 도는 것 포함)에 창을 보이라고 청하고 끝난다(5절 「설치 화면이 이미 열려 있음」). 청하지 못하면 지금처럼 알린다
                    if (!created && product.Id == "platform" && ShowRequest.Write(spec.AppId, UpdatingMarker.ReadPid(spec.AppId))) return 0;
                    if (!created) { MessageBox.Show("이미 " + product.ShortName + " 설치 화면이 열려 있어요.", product.WindowTitle); return 1; }
                    bool released = false;
                    Action release = delegate { if (released) return; released = true; mutex.ReleaseMutex(); };
                    try
                    {
                        cache = InstallerEngine.CreatePrivateCache();
                        ExtractFonts(assembly, cache);
                        InstallerEngine engine = new InstallerEngine(spec, delegate { return assembly.GetManifestResourceStream("backend.exe"); });
                        Application app = new Application();
                        // Platform은 검정 구 새 창으로 그린다(검정 구 1-가 ③). WORLD와 Workspace는 아래 지금 창 그대로다
                        // 설치기 창이 작업 표시줄에서 앱과 같은 단추로 묶이게 앱의 AppUserModelID를 쓴다(1-가 구현 설계 2절 「창의 종류와 닫기」)
                        if (product.Id == "platform") { try { SetCurrentProcessExplicitAppUserModelID(spec.AppId); } catch (Exception) { } }
                        if (product.Id == "platform") { RunPlatform(app, engine, spec, cache, product, automatic, assembly, release); return 0; }
                        SignalWindow window = new SignalWindow(cache, spec.Version, product);
                        window.SetInstalled(Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)));
                        window.SetInstallLocation(PreviewDirectory(engine, spec), spec.MinFreeBytes);
                        if (automatic != null)
                        {
                            bool started = false;
                            window.Loaded += async delegate
                            {
                                if (started) return; started = true;
                                window.ShowProgress(new InstallProgress(InstallStage.AutomaticPreparation, "자동 업데이트를 준비해요", "설치된 앱을 확인해요.", null));
                                try
                                {
                                    AutomaticUpdateResult result = await Task.Run(delegate
                                    {
                                        using (AutomaticUpdateSession request = engine.PrepareAutomaticUpdate(automatic.ParentId, automatic.Token, InstallerEngine.HashFile(assembly.Location)))
                                        {
                                            Console.WriteLine("SYNK_UPDATE_READY " + automatic.Token); Console.Out.Flush();
                                            return engine.InstallAutomaticUpdate(request, delegate(InstallProgress progress) { window.Dispatcher.Invoke(delegate { window.ShowProgress(progress); }); });
                                        }
                                    });
                                    // Updated but not reopened: keep the finished window so its
                                    // open button can start the new version.
                                    if (result.Updated) { window.ShowComplete(); if (result.Relaunched) window.Close(); }
                                    else
                                    {
                                        // Not updated. Unless restored and relaunched (closed
                                        // below), the files may have changed, so the window
                                        // must not promise a retry.
                                        // Restored: the previous version is in place, so the window says the app is unchanged.
                                        window.ShowAutomaticFailure(result.Message, result.Restored);
                                        // The restored app owns the failure/retry
                                        // gate. Release this installer's mutex so
                                        // retry does not require closing two UIs.
                                        if (result.Restored && result.Relaunched) window.Close();
                                    }
                                }
                                catch (Exception error)
                                {
                                    Console.WriteLine("SYNK_UPDATE_FAILED " + automatic.Token); Console.Out.Flush();
                                    // Thrown before any file changed: the running app stays as it was.
                                    engine.RecordUpdateFailure(null, "before-update", "unchanged", error, null);
                                    window.ShowAutomaticFailure(error.Message, true);
                                }
                            };
                        }
                        window.InstallRequested += async delegate
                        {
                            window.ShowProgress(new InstallProgress(InstallStage.Preparing, "설치를 준비해요", "설치할 수 있는지 확인해요.", null));
                            try
                            {
                                await Task.Run(delegate
                                {
                                    engine.Install(delegate(InstallProgress progress)
                                    { window.Dispatcher.Invoke(delegate { window.ShowProgress(progress); }); });
                                });
                                window.ShowComplete();
                            }
                            catch (Exception error) { var failure=error as InstallFailure;window.ShowFailure(error.Message,failure==null||failure.CanRetry); }
                        };
                        window.LaunchRequested += delegate
                        {
                            try { engine.Launch(); window.Close(); }
                            catch (Exception error) { window.ShowFailure(error.Message); }
                        };
                        app.Run(window);
                        return 0;
                    }
                    finally { release(); }
                }
            }
            catch (Exception error) { MessageBox.Show("설치 화면을 열지 못했어요.\n" + error.Message, "SYNK 설치", MessageBoxButton.OK, MessageBoxImage.Error); return 1; }
            finally { if (cache != null) try { Directory.Delete(cache, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
        }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

        internal static void ExtractFonts(Assembly assembly, string cache)
        {
            foreach (string resource in assembly.GetManifestResourceNames())
                if (resource.StartsWith("font."))
                    using (Stream source = assembly.GetManifestResourceStream(resource))
                    using (FileStream target = new FileStream(Path.Combine(cache, resource.Substring(5)), FileMode.CreateNew, FileAccess.Write)) source.CopyTo(target);
        }

        sealed class Flag { public volatile bool Value; }

        /// <summary>
        /// Platform 설치기(검정 구 1-가 ③과 ④). 처음 설치가 끝나면 묻지 않고 연다(4절). 자동 업데이트는 앱이 받은 절반 깎인 구에서 이어 깎고,
        /// 끝 상태마다 5절 설치기 표대로 창을 닫거나 남긴다. 새 앱을 켠 뒤에는 뮤텍스를 먼저 놓고, 그 앱의 창이 보일 때까지(20초까지) 창을 둔다.
        /// </summary>
        static void RunPlatform(Application app, InstallerEngine engine, InstallSpec spec, string cache, SignalProduct product, AutomaticArguments automatic, Assembly assembly, Action release)
        {
            // 앱이 끝낸 가림막은 캐시를 지우지 못한다. 주인 없는 가림막 캐시를 지운다(2절 가림막 8번)
            Handoff.CleanupOrphanCurtainCaches();
            OrbWindow window = new OrbWindow(cache, spec.Version, product);
            window.SetInstalled(Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)));
            // 성공한 설치와 업데이트의 단계 시각(3절). 설치기가 일을 시작한 때부터 잰다
            Stopwatch workClock = new Stopwatch();
            StageTiming timing = new StageTiming { Version = spec.Version };
            Action<InstallProgress> report = delegate(InstallProgress progress)
            {
                try { string name = progress.Stage.ToString(); lock (timing) if (!timing.Stages.Exists(mark => mark.Stage == name)) timing.Stages.Add(new StageMark { Stage = name, Ms = workClock.ElapsedMilliseconds }); } catch (Exception) { }
                window.Dispatcher.Invoke(delegate { window.ShowProgress(progress); });
            };
            Action<string> timed = delegate(string kind) { try { timing.Kind = kind; timing.TotalMs = workClock.ElapsedMilliseconds; Handoff.WriteStageTiming(spec.AppId, timing); } catch (Exception) { } };
            // 넘김 쪽지(6절): 앱 창의 자리와 보이는 상태, 가림막에 알릴 이벤트. 토큰, 앱 프로세스 번호, 판 번호가 모두 맞을 때만 읽는다
            HandoffNote note = automatic != null ? Handoff.ReadHandoff(spec.AppId, automatic.Token, automatic.ParentId, spec.Version) : null;
            IntPtr curtainWindow = note != null && note.CurtainEvent != null ? CurtainWindow.Find(assembly.Location) : IntPtr.Zero;
            // 조용한 업데이트(2절): 앱의 모든 창이 숨었거나 최소화였고 쓰다 만 초안이 없었다. 창을 만들되 보이지 않고, 사람이 알아야 할 끝에서만 보인다
            bool quiet = note != null && note.Quiet;
            bool revealed = !quiet;
            // 새 앱의 첫 창이 설치기 창의 자리와 모습을 이어받는다. 다른 창 뒤에서 넘어온 업데이트는 「뒤」, 조용히 바꾼 업데이트는 숨음이나 최소화로 남긴다
            string arrivalVisibility = note == null ? "front" : quiet ? note.Visibility : note.Behind ? "behind" : "front";
            Action<string, string> arrive = delegate(string kind, string appVersion)
            {
                ArrivalNote arrival = null;
                try { arrival = (ArrivalNote)window.Dispatcher.Invoke(new Func<ArrivalNote>(delegate { return window.Arrival(kind, arrivalVisibility, appVersion); })); }
                catch (Exception) { }
                // 창을 보이지 않은 조용한 설치기는 쪽지의 자리를 그대로 넘긴다
                if (arrival != null && !revealed && note != null && note.HasBounds) { arrival.X = note.X; arrival.Y = note.Y; arrival.Width = note.Width; arrival.Height = note.Height; arrival.Maximized = note.Maximized; }
                if (arrival != null) Handoff.WriteArrival(spec.AppId, arrival);
            };
            // 「바꾸는 중」 표시(장치 1): READY 뒤에 쥐고, 앱을 켜거나 창을 보이기 앞에 놓는다
            UpdatingMarker marker = null;
            Action releaseMarker = delegate { UpdatingMarker held = Interlocked.Exchange(ref marker, null); if (held != null) held.Release(); };
            // 창 보이기 요청: 바꾸는 동안 사람이 켠 앱이나 둘째 설치기가 쓴다. 남은 요청은 지우고 0.5초마다 본다
            int myPid; using (Process self = Process.GetCurrentProcess()) myPid = self.Id;
            DateTime startedUtc = DateTime.UtcNow;
            ShowRequest.Clear(spec.AppId);
            Action reveal = delegate
            {
                arrivalVisibility = "front";
                if (revealed) { try { if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal; window.Activate(); } catch (InvalidOperationException) { } return; }
                revealed = true;
                window.ShowActivated = true;
                window.Show();
                try { window.Activate(); } catch (InvalidOperationException) { }
            };
            // 앱을 켜기 시작한 뒤에 받은 요청은 끝에서 앱을 한 번 더 켜서 창을 부른다(도착 쪽지는 이미 숨음이나 최소화로 썼다, GPT 검수 GA1)
            ShowRequestGate gate = new ShowRequestGate(delegate { return ShowRequest.Take(spec.AppId, myPid, startedUtc); }, reveal);
            engine.BeforeLaunch = delegate(string kind, string appVersion)
            {
                releaseMarker();
                try { window.Dispatcher.Invoke(new Action(gate.BeforeLaunch)); } catch (Exception) { }
                arrive(kind, appVersion);
            };
            System.Windows.Threading.DispatcherTimer requests = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            requests.Tick += delegate { gate.Tick(); };
            requests.Start();
            // 끝내기: 보인 창은 닫고, 보이지 않은 조용한 설치기는 창 없이 끝낸다
            app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
            window.Closed += delegate { app.Shutdown(); };
            Action finish = delegate { if (revealed) window.CloseNow(); else app.Shutdown(); };
            if (note != null)
            {
                // 가림막 아래에 같은 모습으로 뜬다. 앞으로 나서지 않는다. 가림막이 끝나면 그 자리가 그대로 드러난다.
                // 가림막이 없으면(모든 창이 숨었거나 최소화) 앱 창이 기억한 자리에 지금처럼 앞으로 뜬다
                if (note.CurtainEvent != null || note.Behind) window.ShowActivated = false;
                window.SourceInitialized += delegate { window.PlacePhysical(note, curtainWindow); };
            }
            bool rendered = false, readySeen = false, curtainReleased = false;
            Action releaseCurtain = delegate
            {
                if (curtainReleased || !rendered || !readySeen) return;
                curtainReleased = true;
                if (note == null || note.CurtainEvent == null) return;
                try { using (EventWaitHandle done = EventWaitHandle.OpenExisting(note.CurtainEvent)) done.Set(); } catch (Exception) { }
                if (!note.Behind) { try { window.Activate(); } catch (InvalidOperationException) { } }
            };
            window.ContentRendered += delegate { rendered = true; if (note != null) window.StackBelow(curtainWindow); releaseCurtain(); };
            Func<Task> handOver = async delegate
            {
                release();
                // 조용한 업데이트에서는 새 앱도 숨은 채 켜지므로 그 창을 기다리지 않는다
                if (revealed) await AppWindow.WaitAsync(engine.InstalledExecutable(), 20000);
                finish();
            };
            // 「쓰던 판 열기」가 다시 켤 쓰던 판(되돌린 뒤 켜지 못한 때만 있다)
            AutomaticUpdateSession kept = null, restored = null; string restoredStatus = null;
            // 「잠시 뒤 한 번 더 켜 본다」(5절 설치기 표): 한 번만, 사람이 이미 누르지 않았을 때만
            bool againScheduled = false;
            Action openAgainLater = delegate
            {
                if (againScheduled) return; againScheduled = true;
                System.Windows.Threading.DispatcherTimer again = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(OpenAgainMilliseconds) };
                again.Tick += delegate { again.Stop(); window.OpenAgain(); };
                again.Start();
            };
            if (automatic != null)
            {
                bool started = false;
                Func<Task> automaticWork = async delegate
                {
                    if (started) return; started = true;
                    window.BeginAutomatic(note != null, note != null ? note.Cut : 0.5);
                    workClock.Start();
                    Flag ready = new Flag();
                    try
                    {
                        AutomaticUpdateResult result = await Task.Run(delegate
                        {
                            using (AutomaticUpdateSession request = engine.PrepareAutomaticUpdate(automatic.ParentId, automatic.Token, InstallerEngine.HashFile(assembly.Location)))
                            {
                                Console.WriteLine("SYNK_UPDATE_READY " + automatic.Token); Console.Out.Flush();
                                ready.Value = true;
                                kept = request;
                                marker = UpdatingMarker.Hold(spec.AppId, product.Id);
                                // 첫 장을 그린 뒤 READY를 썼으면 가림막에 끝나라고 알린다(2절 가림막 6번)
                                window.Dispatcher.BeginInvoke(new Action(delegate { readySeen = true; releaseCurtain(); }));
                                return engine.InstallAutomaticUpdate(request, report);
                            }
                        });
                        // 엔진이 끝 상태에 이르렀다. 표시는 어느 끝에서도 쥐지 않는다(사람을 기다리는 끝에서도 창을 보이기 전에 놓는다)
                        releaseMarker();
                        if (result.Updated && result.Relaunched) { timed("update"); if (revealed) await window.FinishCut(); await handOver(); }
                        // 끝났는데 새 앱을 켜지 못했다: 「열기」를 두고 잠시 뒤 한 번 더 켜 본다
                        else if (result.Updated) { timed("update"); reveal(); window.ShowLaunchFailure(null); openAgainLater(); }
                        // 장치 2: 사람이 켠 앱이 이미 앞에 있다. 알릴 것이 없어 창을 닫는다(보이는 업데이트에서도 닫는다)
                        else if (result.UserAppRunning) { release(); finish(); }
                        // 되돌려 켠 쓰던 앱이 실패 장면을 보인다. 그 앱의 창이 보인 뒤 닫는다(조용히 바꾼 때는 쓰던 앱이 숨은 채 있다가 다음에 열 때 보인다)
                        else if (result.Restored && result.Relaunched) await handOver();
                        // 되돌렸는데 쓰던 앱을 켜지 못했다: 「쓰던 판 열기」를 두고 잠시 뒤 한 번 더 켜 본다
                        else if (result.Restored && kept != null && result.RestoredStatus != null) { restored = kept; restoredStatus = result.RestoredStatus; reveal(); window.ShowRestoredLaunchFailure(); openAgainLater(); }
                        else { reveal(); window.ShowAutomaticResult(result); }
                    }
                    catch (Exception error)
                    {
                        Console.WriteLine("SYNK_UPDATE_FAILED " + automatic.Token); Console.Out.Flush();
                        // Thrown before any file changed: the running app stays as it was.
                        engine.RecordUpdateFailure(null, "before-update", "unchanged", error, null);
                        InstallFailure blocked = error as InstallFailure;
                        // READY 전: 앱이 실패를 받아 창을 다시 만든다. 막힌 상태만 안내를 맨 위에 남기고 나머지는 닫는다(2절 가림막 7번)
                        releaseMarker();
                        if (!ready.Value) { if (blocked != null && !blocked.CanRetry) { reveal(); window.ShowBlocked(error); } else finish(); }
                        else { reveal(); window.ShowAutomaticError(error); }
                    }
                };
                // 보이는 방식은 창이 뜬 뒤에, 조용한 방식은 창 없이 바로 일을 시작한다
                if (quiet) window.Dispatcher.BeginInvoke(new Action(async delegate { await automaticWork(); }));
                else window.Loaded += async delegate { await automaticWork(); };
            }
            else window.Loaded += delegate { window.SetReady(); };
            window.InstallRequested += async delegate
            {
                bool reinstall = Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory));
                workClock.Restart(); lock (timing) timing.Stages.Clear();
                try
                {
                    await Task.Run(delegate { engine.Install(report); });
                    timed(reinstall ? "reinstall" : "install");
                    await window.FinishCut();
                }
                catch (Exception error) { window.ShowInstallFailure(error); return; }
                arrive("installed", spec.Version);
                try { engine.Launch(); }
                catch (Exception error) { window.ShowLaunchFailure(error); return; }
                await handOver();
            };
            window.LaunchRequested += async delegate
            {
                // 실패 뒤 「열기」: 사람이 설치기 창을 보고 눌렀으므로 새 앱은 앞으로 연다
                arrivalVisibility = "front";
                if (restored != null)
                {
                    // 쓰던 판 열기: 옛 판 해시를 다시 맞추고 되돌림 표시를 새로 써서 쓰던 앱이 실패 장면을 보이게 한다(도착 쪽지는 엔진이 쓴다)
                    try { AutomaticUpdateSession again = restored; string status = restoredStatus; await Task.Run(delegate { engine.RelaunchPrevious(again, status); }); }
                    catch (Exception) { window.ShowRestoredLaunchFailure(); return; }
                    await handOver();
                    return;
                }
                arrive(automatic != null ? "updated" : "installed", spec.Version);
                try { engine.Launch(); }
                catch (Exception error) { window.ShowLaunchFailure(error); return; }
                await handOver();
            };
            if (revealed) window.Show();
            app.Run();
            requests.Stop();
            releaseMarker();
            // 끝나기 직전에 요청을 한 번 더 본다. 표시를 놓는 순간이나 앱을 켜기 시작한 뒤에 사람이 켠 앱의 요청이 버려지지 않게, 앱을 한 번 더 켜서 창을 부르게 한다
            if (automatic != null && gate.OpenAgainAtEnd())
                try { using (Process.Start(new ProcessStartInfo(engine.InstalledExecutable()) { UseShellExecute = false })) { } } catch (Exception) { }
        }

        /// <summary>앱을 켜지 못한 뒤 한 번 더 켜 보기까지(Claude가 정한 값: 실패 문장 두 줄을 읽을 틈)</summary>
        internal const int OpenAgainMilliseconds = 3000;

        /// <summary>
        /// 가림막(1-가 구현 설계 2절). 앱이 끝나며 창을 닫는 동안 화면을 지킨다. 앱 창 바로 아래에 같은 구와 같은 글을 그리고,
        /// 첫 장을 그리면 표준 출력에 SYNK_CURTAIN_READY를 쓴다. 앱이 표준 입력으로 보내는 「cancel」이면 바로 끝나고, 「closing」이면 설치기의 알림을 기다린다.
        /// 스스로 끝나는 상한은 둘이다: 앱 창이 닫힌 뒤 60초, 「closing」 없이 입력이 닫힌 뒤 10초.
        /// 설치 엔진, 설치 등록, 바로가기, 설치기의 뮤텍스를 건드리지 않고, 만드는 파일은 개인 캐시뿐이다
        /// </summary>
        internal static class Curtain
        {
            internal const int AppGoneMilliseconds = 60000, InputGoneMilliseconds = 10000;
            [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);

            internal static int Run(Assembly assembly, InstallSpec spec, string token)
            {
                string cache = null;
                EventWaitHandle done = null;
                try
                {
                    Handoff.CleanupOrphanCurtainCaches();
                    SignalProduct product = SignalProduct.ById(spec.Product);
                    if (product.Id != "platform" || token == null) return 2;
                    // 쪽지를 읽지 못하면 앉을 자리를 모른다. READY를 쓰지 않고 끝나, 앱이 가림막 없이 넘긴다(2절 가림막 8번)
                    HandoffNote note = Handoff.ReadHandoff(spec.AppId, token, 0, spec.Version);
                    if (note == null || note.CurtainEvent == null || !note.HasBounds) return 3;
                    bool created;
                    done = new EventWaitHandle(false, EventResetMode.ManualReset, note.CurtainEvent, out created);
                    cache = Handoff.CreateCurtainCache();
                    ExtractFonts(assembly, cache);
                    Application app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
                    OrbWindow window = new OrbWindow(cache, spec.Version, product);
                    window.BeginCurtain(note.Cut);
                    IntPtr appWindow = new IntPtr(note.Window), watchWindow = new IntPtr(note.WatchWindow != 0 ? note.WatchWindow : note.Window);
                    window.SourceInitialized += delegate { window.MakeInert(); window.PlacePhysical(note, appWindow); };
                    bool announced = false, finished = false;
                    Action finish = delegate
                    {
                        if (finished) return; finished = true;
                        window.CloseNow(); app.Shutdown();
                    };
                    window.ContentRendered += delegate
                    {
                        if (announced) return; announced = true;
                        window.StackBelow(appWindow);
                        Console.WriteLine("SYNK_CURTAIN_READY"); Console.Out.Flush();
                    };
                    // 앱이 보내는 두 말. 입력이 닫히는 것만으로는 앱이 끝났는지 취소했는지 가를 수 없어 닫힘이 아니라 이 두 말로 가른다
                    Flag closing = new Flag(), cancelled = new Flag(), inputGone = new Flag();
                    Thread reader = new Thread(delegate()
                    {
                        try
                        {
                            string line;
                            while ((line = Console.In.ReadLine()) != null)
                            {
                                line = line.Trim();
                                if (line == "cancel") { cancelled.Value = true; break; }
                                if (line == "closing") closing.Value = true;
                            }
                        }
                        catch (Exception) { }
                        inputGone.Value = true;
                    }) { IsBackground = true };
                    reader.Start();
                    Stopwatch clock = Stopwatch.StartNew();
                    long appGoneAt = -1, inputGoneAt = -1;
                    System.Windows.Threading.DispatcherTimer watch = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
                    watch.Tick += delegate
                    {
                        long now = clock.ElapsedMilliseconds;
                        if (cancelled.Value) { finish(); return; }
                        try { if (done.WaitOne(0)) { finish(); return; } } catch (Exception) { finish(); return; }
                        if (inputGone.Value && !closing.Value) { if (inputGoneAt < 0) inputGoneAt = now; else if (now - inputGoneAt > InputGoneMilliseconds) { finish(); return; } }
                        if (!IsWindow(watchWindow)) { if (appGoneAt < 0) appGoneAt = now; else if (now - appGoneAt > AppGoneMilliseconds) { finish(); return; } }
                    };
                    watch.Start();
                    window.Show();
                    app.Run();
                    return 0;
                }
                catch (Exception) { return 1; }
                finally
                {
                    if (done != null) done.Dispose();
                    if (cache != null) try { Directory.Delete(cache, true); } catch (Exception) { }
                }
            }
        }

        /// <summary>가림막 창 찾기: 설치기와 같은 실행 파일(앱이 받은 새 판 설치 파일)로 켜진 다른 프로세스의 보이는 창</summary>
        internal static class CurtainWindow
        {
            delegate bool EnumProc(IntPtr window, IntPtr parameter);
            [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
            [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
            [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
            internal static IntPtr Find(string executable)
            {
                try
                {
                    var owners = new System.Collections.Generic.HashSet<uint>();
                    int self = Process.GetCurrentProcess().Id;
                    foreach (Process process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(executable)))
                        using (process)
                        {
                            try { if (process.Id != self && String.Equals(Path.GetFullPath(process.MainModule.FileName), Path.GetFullPath(executable), StringComparison.OrdinalIgnoreCase)) owners.Add((uint)process.Id); }
                            catch (Exception) { }
                        }
                    if (owners.Count == 0) return IntPtr.Zero;
                    IntPtr found = IntPtr.Zero;
                    EnumWindows(delegate(IntPtr window, IntPtr parameter)
                    {
                        if (!IsWindowVisible(window)) return true;
                        uint owner; GetWindowThreadProcessId(window, out owner);
                        if (owners.Contains(owner)) { found = window; return false; }
                        return true;
                    }, IntPtr.Zero);
                    return found;
                }
                catch (Exception) { return IntPtr.Zero; }
            }
        }

        internal sealed class AutomaticArguments { internal int ParentId; internal string Token; }
        internal static AutomaticArguments ParseAutomaticArguments(string[] args)
        {
            if (Array.IndexOf(args,"--auto-update") < 0) return null;
            if (args.Length != 3) throw new ArgumentException("자동 업데이트 실행 정보를 확인하지 못했어요.");
            var result = new AutomaticArguments();
            bool mode=false,pid=false,token=false;
            foreach(string value in args)
            {
                if(value=="--auto-update"&&!mode)mode=true;
                else if(value.StartsWith("--wait-pid=",StringComparison.Ordinal)&&!pid) { pid=true;if(!Int32.TryParse(value.Substring(11),out result.ParentId)||result.ParentId<=0||result.ParentId==Process.GetCurrentProcess().Id)throw new ArgumentException("업데이트할 앱을 확인하지 못했어요."); }
                else if(value.StartsWith("--handoff-token=",StringComparison.Ordinal)&&!token) { token=true;result.Token=value.Substring(16);if(!Regex.IsMatch(result.Token,"^[a-f0-9]{64}$"))throw new ArgumentException("업데이트 요청을 확인하지 못했어요."); }
                else throw new ArgumentException("자동 업데이트 실행 정보를 확인하지 못했어요.");
            }
            if(!mode||!pid||!token)throw new ArgumentException("자동 업데이트 실행 정보를 확인하지 못했어요.");
            return result;
        }

        // Called only after the running app has accepted its normal quit guard.
        // Never kills the app, skips installation checks, or starts an installation.
        static void WaitForUpdatingApplication(string[] args, string executableName)
        {
            if (args.Length == 0) return;
            int pid;
            if (args.Length != 1 || !args[0].StartsWith("--wait-pid=", StringComparison.Ordinal) ||
                !Int32.TryParse(args[0].Substring(11), out pid) || pid <= 0 || pid == Process.GetCurrentProcess().Id)
                throw new ArgumentException("설치 실행 정보를 확인하지 못했어요.");
            Process previous;
            try { previous = Process.GetProcessById(pid); }
            catch (ArgumentException) { return; }
            using (previous)
            {
                string previousName;
                try { previousName = previous.ProcessName; }
                catch (InvalidOperationException) { if (previous.HasExited) return; throw; }
                if (!String.Equals(previousName, Path.GetFileNameWithoutExtension(executableName), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("업데이트할 SYNK 앱을 찾지 못했어요.");
                if (!previous.WaitForExit(60000))
                    throw new InvalidOperationException("SYNK가 아직 켜져 있어요.\n작업을 저장하고 앱을 끈 뒤 설치 파일을 다시 열어 주세요.");
            }
        }

        /// <summary>앱 실행 파일(경로로 맞춘다)의 프로세스 가운데 하나에 보이는 최상위 창이 생겼는지 본다. 켠 그 프로세스로 한정하지 않는다(2절)</summary>
        internal static class AppWindow
        {
            delegate bool EnumProc(IntPtr window, IntPtr parameter);
            [StructLayout(LayoutKind.Sequential)] struct Bounds { public int Left, Top, Right, Bottom; }
            [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
            [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
            [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
            [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Bounds bounds);
            /// <summary>1: 보이는 창이 있다 · 0: 프로세스는 있는데 아직 창이 없다 · -1: 그 실행 파일의 프로세스가 하나도 없다</summary>
            internal static int State(string executable)
            {
                var owners = new System.Collections.Generic.HashSet<uint>();
                foreach (Process process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(executable)))
                    using (process)
                    {
                        try { if (String.Equals(Path.GetFullPath(process.MainModule.FileName), Path.GetFullPath(executable), StringComparison.OrdinalIgnoreCase)) owners.Add((uint)process.Id); }
                        catch (Exception) { }
                    }
                if (owners.Count == 0) return -1;
                bool found = false;
                EnumWindows(delegate(IntPtr window, IntPtr parameter)
                {
                    if (!IsWindowVisible(window)) return true;
                    uint owner; GetWindowThreadProcessId(window, out owner);
                    Bounds bounds;
                    if (owners.Contains(owner) && GetWindowRect(window, out bounds) && bounds.Right > bounds.Left && bounds.Bottom > bounds.Top) { found = true; return false; }
                    return true;
                }, IntPtr.Zero);
                return found ? 1 : 0;
            }
            /// <summary>
            /// 보일 때까지 기다린다. 시간이 지나면 그냥 돌아온다(새 앱 스크립트가 멈춰도 설치기가 남지 않게).
            /// 그 실행 파일의 프로세스가 1초 넘게 하나도 없으면 기다리지 않는다(앱이 이미 끝났으면 기다릴 창이 없다)
            /// </summary>
            internal static Task<bool> WaitAsync(string executable, int milliseconds)
            {
                return Task.Run(delegate
                {
                    var clock = Stopwatch.StartNew();
                    long gone = -1;
                    while (clock.ElapsedMilliseconds < milliseconds)
                    {
                        int state = 0;
                        try { state = State(executable); } catch (Exception) { }
                        if (state == 1) return true;
                        if (state == -1) { if (gone < 0) gone = clock.ElapsedMilliseconds; else if (clock.ElapsedMilliseconds - gone > 1000) return false; }
                        else gone = -1;
                        Thread.Sleep(100);
                    }
                    return false;
                });
            }
        }

        // 준비 화면에 보일 설치 위치. 읽기 전용 확인만 하고, 확인이 막히면(예: SYNK 실행 중) 기본 위치를 보인다.
        // 실제 설치 때는 엔진이 같은 확인을 다시 하고, 막힌 이유는 그때 실패 화면으로 알린다.
        static string PreviewDirectory(InstallerEngine engine, InstallSpec spec)
        {
            try { return engine.Preflight(); }
            catch (Exception)
            {
                try { return Path.GetFullPath(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)).TrimEnd('\\'); }
                catch (Exception) { return null; }
            }
        }
    }
}
