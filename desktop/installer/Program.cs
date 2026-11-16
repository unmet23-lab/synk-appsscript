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
                    if (!created) { MessageBox.Show("이미 " + product.ShortName + " 설치 화면이 열려 있어요.", product.WindowTitle); return 1; }
                    bool released = false;
                    Action release = delegate { if (released) return; released = true; mutex.ReleaseMutex(); };
                    try
                    {
                        cache = InstallerEngine.CreatePrivateCache();
                        foreach (string resource in assembly.GetManifestResourceNames())
                            if (resource.StartsWith("font."))
                                using (Stream source = assembly.GetManifestResourceStream(resource))
                                using (FileStream target = new FileStream(Path.Combine(cache, resource.Substring(5)), FileMode.CreateNew, FileAccess.Write)) source.CopyTo(target);
                        InstallerEngine engine = new InstallerEngine(spec, delegate { return assembly.GetManifestResourceStream("backend.exe"); });
                        Application app = new Application();
                        // Platform은 검정 구 새 창으로 그린다(검정 구 1-가 ③). WORLD와 Workspace는 아래 지금 창 그대로다
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

        sealed class Flag { public volatile bool Value; }

        /// <summary>
        /// Platform 설치기(검정 구 1-가 ③과 ④). 처음 설치가 끝나면 묻지 않고 연다(4절). 자동 업데이트는 앱이 받은 절반 깎인 구에서 이어 깎고,
        /// 끝 상태마다 5절 설치기 표대로 창을 닫거나 남긴다. 새 앱을 켠 뒤에는 뮤텍스를 먼저 놓고, 그 앱의 창이 보일 때까지(20초까지) 창을 둔다.
        /// </summary>
        static void RunPlatform(Application app, InstallerEngine engine, InstallSpec spec, string cache, SignalProduct product, AutomaticArguments automatic, Assembly assembly, Action release)
        {
            OrbWindow window = new OrbWindow(cache, spec.Version, product);
            window.SetInstalled(Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)));
            Action<InstallProgress> report = delegate(InstallProgress progress) { window.Dispatcher.Invoke(delegate { window.ShowProgress(progress); }); };
            Func<Task> handOver = async delegate
            {
                release();
                await AppWindow.WaitAsync(engine.InstalledExecutable(), 20000);
                window.CloseNow();
            };
            if (automatic != null)
            {
                bool started = false;
                window.Loaded += async delegate
                {
                    if (started) return; started = true;
                    window.BeginAutomatic();
                    Flag ready = new Flag();
                    try
                    {
                        AutomaticUpdateResult result = await Task.Run(delegate
                        {
                            using (AutomaticUpdateSession request = engine.PrepareAutomaticUpdate(automatic.ParentId, automatic.Token, InstallerEngine.HashFile(assembly.Location)))
                            {
                                Console.WriteLine("SYNK_UPDATE_READY " + automatic.Token); Console.Out.Flush();
                                ready.Value = true;
                                return engine.InstallAutomaticUpdate(request, report);
                            }
                        });
                        if (result.Updated && result.Relaunched) { await window.FinishCut(); await handOver(); }
                        else if (result.Updated) window.ShowLaunchFailure(null);
                        // 되돌려 켠 쓰던 앱이 실패 장면을 보인다. 그 앱의 창이 보인 뒤 닫는다
                        else if (result.Restored && result.Relaunched) await handOver();
                        else window.ShowAutomaticResult(result);
                    }
                    catch (Exception error)
                    {
                        Console.WriteLine("SYNK_UPDATE_FAILED " + automatic.Token); Console.Out.Flush();
                        // Thrown before any file changed: the running app stays as it was.
                        engine.RecordUpdateFailure(null, "before-update", "unchanged", error, null);
                        InstallFailure blocked = error as InstallFailure;
                        // READY 전: 앱이 실패를 받아 창을 다시 만든다. 막힌 상태만 안내를 맨 위에 남기고 나머지는 닫는다(2절 가림막 7번)
                        if (!ready.Value) { if (blocked != null && !blocked.CanRetry) window.ShowBlocked(error); else window.CloseNow(); }
                        else window.ShowAutomaticError(error);
                    }
                };
            }
            else window.Loaded += delegate { window.SetReady(); };
            window.InstallRequested += async delegate
            {
                try
                {
                    await Task.Run(delegate { engine.Install(report); });
                    await window.FinishCut();
                }
                catch (Exception error) { window.ShowInstallFailure(error); return; }
                try { engine.Launch(); }
                catch (Exception error) { window.ShowLaunchFailure(error); return; }
                await handOver();
            };
            window.LaunchRequested += async delegate
            {
                try { engine.Launch(); }
                catch (Exception error) { window.ShowLaunchFailure(error); return; }
                await handOver();
            };
            app.Run(window);
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
