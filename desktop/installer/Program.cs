using System;
using System.IO;
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
        static int Main()
        {
            string cache = null;
            try
            {
                bool created;
                using (Mutex mutex = new Mutex(true, @"Local\SYNK.Signal.Installer." + WindowsIdentity.GetCurrent().User.Value, out created))
                {
                    if (!created) { MessageBox.Show("이미 SYNK 설치 화면이 열려 있습니다.", "SYNK 설치"); return 1; }
                    try
                    {
                        Assembly assembly = Assembly.GetExecutingAssembly();
                        InstallSpec spec;
                        using (Stream stream = assembly.GetManifestResourceStream("install.json"))
                            spec = (InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
                        cache = InstallerEngine.CreatePrivateCache();
                        foreach (string resource in assembly.GetManifestResourceNames())
                            if (resource.StartsWith("font."))
                                using (Stream source = assembly.GetManifestResourceStream(resource))
                                using (FileStream target = new FileStream(Path.Combine(cache, resource.Substring(5)), FileMode.CreateNew, FileAccess.Write)) source.CopyTo(target);
                        InstallerEngine engine = new InstallerEngine(spec, delegate { return assembly.GetManifestResourceStream("backend.exe"); });
                        Application app = new Application();
                        SignalWindow window = new SignalWindow(cache, spec.Version);
                        window.SetInstalled(Directory.Exists(Environment.ExpandEnvironmentVariables(spec.InstallDirectory)));
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
    }
}
