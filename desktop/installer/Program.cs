using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.Serialization.Json;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

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
                WaitForUpdatingApplication(args, spec.ExecutableName);
                SignalProduct product = SignalProduct.ById(spec.Product);
                // 제품마다 설치 화면 하나만(플랫폼 안에서 WORLD와 워크스페이스 설치 창을 함께 열 수 있다)
                bool created;
                using (Mutex mutex = new Mutex(true, @"Local\SYNK.Signal.Installer." + product.Id + "." + WindowsIdentity.GetCurrent().User.Value, out created))
                {
                    if (!created) { MessageBox.Show("이미 " + product.ShortName + " 설치 화면이 열려 있습니다.", product.WindowTitle); return 1; }
                    try
                    {
                        cache = InstallerEngine.CreatePrivateCache();
                        foreach (string resource in assembly.GetManifestResourceNames())
                            if (resource.StartsWith("font."))
                                using (Stream source = assembly.GetManifestResourceStream(resource))
                                using (FileStream target = new FileStream(Path.Combine(cache, resource.Substring(5)), FileMode.CreateNew, FileAccess.Write)) source.CopyTo(target);
                        InstallerEngine engine = new InstallerEngine(spec, delegate { return assembly.GetManifestResourceStream("backend.exe"); });
                        Application app = new Application();
                        SignalWindow window = new SignalWindow(cache, spec.Version, product);
                        window.SetInstalled(Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)));
                        window.SetInstallLocation(PreviewDirectory(engine, spec), spec.MinFreeBytes);
                        window.InstallRequested += async delegate
                        {
                            window.ShowProgress("설치를 준비합니다", "설치할 수 있는지 확인합니다.", null);
                            try
                            {
                                await Task.Run(delegate
                                {
                                    engine.Install(delegate(string title, string detail, int? percent)
                                    { window.Dispatcher.Invoke(delegate { window.ShowProgress(title, detail, percent); }); });
                                });
                                window.ShowComplete();
                            }
                            catch (Exception error) { window.ShowFailure(error.Message); }
                        };
                        window.LaunchRequested += delegate
                        {
                            try { engine.Launch(); window.Close(); }
                            catch (Exception error) { window.ShowFailure(error.Message); }
                        };
                        app.Run(window);
                        return 0;
                    }
                    finally { mutex.ReleaseMutex(); }
                }
            }
            catch (Exception error) { MessageBox.Show("설치 화면을 열 수 없습니다.\n" + error.Message, "SYNK 설치", MessageBoxButton.OK, MessageBoxImage.Error); return 1; }
            finally { if (cache != null) try { Directory.Delete(cache, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
        }

        // Called only after the running app has accepted its normal quit guard.
        // Never kills the app, skips installation checks, or starts an installation.
        static void WaitForUpdatingApplication(string[] args, string executableName)
        {
            if (args.Length == 0) return;
            int pid;
            if (args.Length != 1 || !args[0].StartsWith("--wait-pid=", StringComparison.Ordinal) ||
                !Int32.TryParse(args[0].Substring(11), out pid) || pid <= 0 || pid == Process.GetCurrentProcess().Id)
                throw new ArgumentException("설치 실행 정보를 확인할 수 없습니다.");
            Process previous;
            try { previous = Process.GetProcessById(pid); }
            catch (ArgumentException) { return; }
            using (previous)
            {
                string previousName;
                try { previousName = previous.ProcessName; }
                catch (InvalidOperationException) { if (previous.HasExited) return; throw; }
                if (!String.Equals(previousName, Path.GetFileNameWithoutExtension(executableName), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("업데이트할 SYNK 앱을 확인할 수 없습니다.");
                if (!previous.WaitForExit(60000))
                    throw new InvalidOperationException("SYNK가 아직 실행 중입니다. 작업을 저장하고 앱을 종료한 뒤 설치 파일을 다시 열어 주세요.");
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
