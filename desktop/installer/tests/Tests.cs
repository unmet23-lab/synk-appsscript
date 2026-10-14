using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using Synk.SignalInstaller;

// Tests use the production engine and production NSIS guard with a different
// GUID, process name, application ID, install directory and shortcut name.
internal static class SignalInstallerTests
{
    private static readonly List<object> Checks = new List<object>();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static string Root;
    private static string FixtureJson;
    private static string Backend;
    private static InstallSpec Spec;
    private static int ProductionRegistryFields;
    private static Dictionary<string, object> Fixture;

    [STAThread]
    private static int Main(string[] args)
    {
        Process held = null;
        string holdDirectory = null;
        string productionBefore = null;
        try
        {
            Assert(args.Length == 1, "Fixture manifest argument required.");
            FixtureJson = Path.GetFullPath(args[0]);
            var metadata = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(FixtureJson));
            Fixture = metadata;
            Root = Path.GetFullPath((string)metadata["directory"]);
            Backend = Path.GetFullPath((string)metadata["backend"]);
            Spec = ReadSpec();
            Assert(metadata.ContainsKey("fixture") && (bool)metadata["fixture"], "Fixture flag required.");
            Assert(Spec.AppId.StartsWith("im.synk.signal.fixture.", StringComparison.Ordinal), "Production AppId prohibited.");
            Assert(Spec.ExecutableName.StartsWith("SYNKSignalFixture", StringComparison.Ordinal), "Production executable prohibited.");
            Assert(Spec.ShortcutName.StartsWith("SYNKSignalFixture", StringComparison.Ordinal), "Production shortcuts prohibited.");
            Assert(System.Guid.Parse(Spec.Guid) != System.Guid.Empty, "Unique fixture GUID required.");
            Assert(Path.GetFileName(Root).StartsWith("signal-installer-test-", StringComparison.Ordinal), "Unexpected fixture root.");
            Assert(Path.GetFileName(Path.GetDirectoryName(Root)) == ".tmp", "Fixture must be inside a .tmp directory.");
            Assert(IsInside(Spec.InstallDirectory, Root), "Fixture install path escaped its root.");
            Assert(IsInside(Backend, Root), "Fixture backend escaped its root.");
            Assert(!Directory.Exists(Spec.InstallDirectory), "Preserve previous test installation.");
            using (var hive = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Registry64))
            {
                Assert(hive.OpenSubKey(InstallKey()) == null && hive.OpenSubKey(UninstallKey()) == null, "Fixture registration already exists.");
            }
            productionBefore = SnapshotProductionRegistration();
            // The production engine intentionally supplies no /D switch. Seed
            // only this new test GUID's path to keep the real NSIS install in
            // the disposable workspace instead of the user's Programs folder.
            using (var hive = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Registry64))
            using (var key = hive.CreateSubKey(InstallKey()))
                key.SetValue("InstallLocation", Spec.InstallDirectory, RegistryValueKind.String);
            var external = Path.Combine(Root, "account-data-sentinel");
            Directory.CreateDirectory(external);
            var sentinel = Path.Combine(external, "notes.json");
            File.WriteAllText(sentinel, "{\"syntheticTestData\":true,\"preserve\":\"" + System.Guid.NewGuid() + "\"}");
            var sentinelHash = Hash(sentinel);

            var engine = Engine(Spec);
            Check("known-folder shortcut guard accepts Cloud variants but rejects symlinks, junctions and unknown reparse tags", delegate
            {
                for(uint variant=0;variant<16;variant++)
                {
                    uint tag=0x9000001au|(variant<<12);
                    Assert(InstallerEngine.IsCloudPlaceholderTag(tag),"Cloud placeholder variant was rejected.");
                    InstallerEngine.ValidateShortcutEntryAttributes(FileAttributes.ReparsePoint|FileAttributes.Directory,tag);
                    InstallerEngine.ValidateShortcutEntryAttributes(FileAttributes.ReparsePoint|FileAttributes.Archive,tag);
                }
                foreach(uint tag in new uint[]{0xa000000cu,0xa0000003u,0x9000001bu,0x8000001au,0u})
                {
                    Assert(!InstallerEngine.IsCloudPlaceholderTag(tag),"Unsafe reparse tag was accepted as Cloud.");
                    ExpectFailure(delegate { InstallerEngine.ValidateShortcutEntryAttributes(FileAttributes.ReparsePoint,tag); });
                }
                InstallerEngine.ValidateShortcutEntryAttributes(FileAttributes.Normal,0);
            });
            Check("only exact current-user known-folder shortcut paths get the Cloud exception", delegate
            {
                engine.ValidateShortcutPath(StartMenuShortcut());engine.ValidateShortcutPath(DesktopShortcut());
                ExpectFailure(delegate { engine.ValidateShortcutPath(Path.Combine(Root,Spec.ShortcutName+".lnk")); });
                ExpectFailure(delegate { engine.ValidateShortcutPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"other-shortcut.lnk")); });
                foreach(string known in new [] { Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Environment.GetFolderPath(Environment.SpecialFolder.Programs) })
                    if((File.GetAttributes(known)&FileAttributes.ReparsePoint)!=0)ExpectFailure(delegate { InstallerEngine.RejectReparsePoints(known); });
            });
            Check("read-only preflight", delegate
            {
                Assert(Same(engine.Preflight(), Spec.InstallDirectory), "Preflight chose another folder.");
                Assert(!Directory.Exists(Spec.InstallDirectory), "Preflight created the install directory.");
                Assert(SnapshotProductionRegistration() == productionBefore, "Preflight changed production registration.");
            });
            Check("incorrect backend digest is rejected before install", delegate
            {
                var bad = ReadSpec(); bad.BackendSHA256 = new string('0', 64);
                ExpectFailure(delegate { InstallOnWorker(Engine(bad)); });
                Assert(!Directory.Exists(Spec.InstallDirectory), "Rejected backend wrote application files.");
            });
            Check("manifest traversal is rejected", delegate
            {
                var bad = ReadSpec(); bad.Files[0].Path = "../outside-fixture.exe";
                ExpectFailure(delegate { Engine(bad).Preflight(); });
            });
            Check("impossible disk requirement is rejected", delegate
            {
                var bad = ReadSpec(); bad.MinFreeBytes = long.MaxValue;
                ExpectFailure(delegate { Engine(bad).Preflight(); });
            });
            Check("real NSIS install through production engine", delegate
            {
                Assert(Same(InstallOnWorker(engine), Spec.InstallDirectory), "Installation returned another directory.");
                Assert(Same(engine.VerifyInstalled(), Spec.InstallDirectory), "Installed verification returned another directory.");
                VerifyRegistrationAndShortcuts();
            });
            Check("launch uses the verified installed executable", delegate
            {
                engine.Launch();
                WaitFor(delegate { return File.Exists(Path.Combine(Spec.InstallDirectory, "fixture-launched")); }, "Installed fixture was not launched.");
            });
            Check("installed archive tampering is detected", delegate
            {
                var archive = Path.Combine(Spec.InstallDirectory, "resources", "app.asar");
                var bytes = File.ReadAllBytes(archive);
                try { File.WriteAllText(archive, "corrupted"); ExpectFailure(delegate { engine.VerifyInstalled(); }); }
                finally { File.WriteAllBytes(archive, bytes); }
            });
            holdDirectory = Path.Combine(Root, "held-process");
            held = Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory, Spec.ExecutableName), "--hold \"" + holdDirectory + "\"")
            { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
            WaitFor(delegate { return File.Exists(Path.Combine(holdDirectory, "ready")); }, "Fixture process did not become ready.");
            Check("engine blocks a running application without stopping it", delegate
            {
                ExpectFailure(delegate { InstallOnWorker(engine); });
                Assert(!held.HasExited, "Engine stopped the fixture process.");
            });
            Check("automatic update rejects the same installed version while preserving its live process", delegate
            {
                ExpectFailure(delegate { engine.PrepareAutomaticUpdate(held.Id,new string('a',64),new string('b',64)); });
                Assert(!held.HasExited,"Rejected automatic update stopped the installed fixture.");
            });
            Check("NSIS race guard returns 20 and preserves the running process", delegate
            {
                Assert(Run(Backend, "/S /currentuser") == 20, "NSIS did not return the blocked-process code.");
                Assert(!held.HasExited, "NSIS stopped the fixture process.");
                engine.VerifyInstalled();
            });
            File.WriteAllText(Path.Combine(holdDirectory, "stop"), "stop only our fixture");
            Assert(held.WaitForExit(5000), "Fixture did not exit voluntarily.");
            held.Dispose(); held = null;
            Check("real reinstall preserves external synthetic account data", delegate
            {
                InstallOnWorker(engine);
                engine.VerifyInstalled();
                VerifyRegistrationAndShortcuts();
                Assert(Hash(sentinel) == sentinelHash, "External synthetic account data changed.");
            });
            Check("automatic update rejects wrong parent and invalid handoff without mutations", delegate
            {
                ExpectFailure(delegate { Engine(Spec).PrepareAutomaticUpdate(Process.GetCurrentProcess().Id,new string('a',64),new string('b',64)); });
                ExpectFailure(delegate { Engine(Spec).PrepareAutomaticUpdate(2147483647,"invalid",new string('b',64)); });
                Assert(SnapshotProductionRegistration()==productionBefore,"Automatic rejection touched production registration.");
                engine.VerifyInstalled();
            });
            if (Fixture.ContainsKey("autoFailure"))
            {
                Check("real automatic installer READY then normal parent exit rolls failed NSIS verification back and relaunches once", delegate
                {
                    using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))
                    using(var key=hive.CreateSubKey(AppModelKey()))
                    { key.SetValue("DisplayName","fixture previous registration");key.SetValue("FixtureInteger",42,RegistryValueKind.DWord); }
                    RunAutomaticFixture((string)Fixture["autoFailure"],false);
                    engine.VerifyInstalled(); VerifyRegistrationAndShortcuts();
                    using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))
                    using(var key=hive.OpenSubKey(AppModelKey()))
                        Assert(key!=null&&(string)key.GetValue("DisplayName")=="fixture previous registration"&&(int)key.GetValue("FixtureInteger")==42,"AppUserModelId registration was not restored.");
                    Assert(!File.Exists(Path.Combine(Spec.InstallDirectory,"update-only.txt")),"Failed update left new payload files.");
                    Assert(Hash(sentinel)==sentinelHash,"Automatic rollback changed external synthetic account data.");
                });
                Check("real automatic installer READY then normal parent exit installs verified upgrade and relaunches without bypass", delegate
                {
                    RunAutomaticFixture((string)Fixture["autoSuccess"],true);
                    using(var stream=File.OpenRead((string)Fixture["upgradeSpec"]))
                    {
                        var upgrade=(InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
                        new InstallerEngine(upgrade,delegate { return File.OpenRead(Backend); }).VerifyInstalled();
                    }
                    Assert(File.Exists(Path.Combine(Spec.InstallDirectory,"update-only.txt")),"Verified upgrade is missing its new payload.");
                    Assert(Hash(sentinel)==sentinelHash,"Automatic upgrade changed external synthetic account data.");
                });
            }
            Check("fixture uninstall preserves external data and removes its registration", delegate
            {
                var uninstaller = Path.Combine(Spec.InstallDirectory, "Uninstall " + Path.GetFileNameWithoutExtension(Spec.ExecutableName) + ".exe");
                Assert(File.Exists(uninstaller) && IsInside(uninstaller, Root), "Fixture uninstaller missing.");
                Assert(Run(uninstaller, "/S /currentuser /KEEP_APP_DATA _?=" + Spec.InstallDirectory) == 0, "Fixture uninstall failed.");
                WaitFor(delegate { using (var hive = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Registry64)) return hive.OpenSubKey(UninstallKey()) == null; }, "Fixture uninstall registration remains.");
                Assert(Hash(sentinel) == sentinelHash, "Uninstall changed external synthetic data.");
                Assert(!File.Exists(StartMenuShortcut()) && !File.Exists(DesktopShortcut()), "Fixture shortcuts remain after uninstall.");
            });
            Check("real SYNK Platform registration remains unchanged", delegate
            {
                Assert(SnapshotProductionRegistration() == productionBefore, "Production registration changed.");
            });
            WriteReport(true, null);
            Console.WriteLine(Json.Serialize(new { ok = true, checks = Checks, fixtureRoot = Root, realPlatformMutated = false, productionRegistryFields = ProductionRegistryFields, installWorkerApartment = "MTA" }));
            return 0;
        }
        catch (Exception error)
        {
            WriteReport(false, error.ToString());
            Console.Error.WriteLine(error);
            return 1;
        }
        finally
        {
            if (held != null)
            {
                if (holdDirectory != null) File.WriteAllText(Path.Combine(holdDirectory, "stop"), "stop only our fixture");
                held.WaitForExit(5000);
                held.Dispose();
            }
            // Clean only this randomly named fixture, including an early-failure
            // InstallLocation seed. Preserve build files and the test receipt.
            if (Root != null && Spec != null && Spec.AppId.StartsWith("im.synk.signal.fixture.", StringComparison.Ordinal) && IsInside(Spec.InstallDirectory, Root))
            {
                var fixtureUninstaller = Path.Combine(Spec.InstallDirectory, "Uninstall " + Path.GetFileNameWithoutExtension(Spec.ExecutableName) + ".exe");
                if (File.Exists(fixtureUninstaller))
                {
                    try { Run(fixtureUninstaller, "/S /currentuser /KEEP_APP_DATA _?=" + Spec.InstallDirectory); }
                    catch (Exception cleanupError) { Console.Error.WriteLine("Fixture cleanup: " + cleanupError.Message); }
                }
                using (var hive = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Registry64))
                using (var uninstall = hive.OpenSubKey(UninstallKey()))
                    if (uninstall == null) hive.DeleteSubKeyTree(InstallKey(), false);
                using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))hive.DeleteSubKeyTree(AppModelKey(),false);
            }
        }
    }

    private static InstallSpec ReadSpec()
    {
        using (var stream = File.OpenRead(FixtureJson))
            return (InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
    }
    private static void RunAutomaticFixture(string wrapper,bool success)
    {
        Assert(IsInside(wrapper,Root),"Automatic wrapper escaped fixture root.");
        string nonce=System.Guid.NewGuid().ToString("N")+System.Guid.NewGuid().ToString("N"),hold=Path.Combine(Root,"auto-parent-"+nonce),launched=Path.Combine(Spec.InstallDirectory,"fixture-launched");
        if(File.Exists(launched))File.Delete(launched);
        using(var parent=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName),"--hold \""+hold+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden}))
        {
            WaitFor(delegate{return File.Exists(Path.Combine(hold,"ready"));},"Automatic parent did not become ready.");
            var start=new ProcessStartInfo(wrapper,"--auto-update --wait-pid="+parent.Id+" --handoff-token="+nonce){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
            using(var child=Process.Start(start))
            {
                try
                {
                    var ready=child.StandardOutput.ReadLineAsync();
                    Assert(ready.Wait(30000)&&ready.Result=="SYNK_UPDATE_READY "+nonce,"Production installer did not acknowledge the live verified parent.");
                    Assert(!parent.HasExited,"Installer terminated the parent before normal exit.");
                    File.WriteAllText(Path.Combine(hold,"stop"),"fixture parent exits normally after READY");
                    Assert(parent.WaitForExit(5000),"Parent did not exit normally.");
                    WaitFor(delegate{return File.Exists(launched);},"Automatic installer did not relaunch the application.",30000);
                    string arguments=File.ReadAllText(launched);
                    if(success) { Assert(arguments=="","Successful update used a startup bypass.");Assert(child.WaitForExit(10000),"Successful installer did not close itself.");Assert(child.ExitCode==0,"Successful installer failed."); }
                    else
                    {
                        Assert(arguments=="--synk-update-recovery="+nonce,"Restored app did not receive its exact one-use nonce.");
                        string marker=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Recovery",Spec.AppId+".json");
                        var data=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(marker));
                        Assert((string)data["nonce"]==nonce&&(string)data["status"]=="rolled-back"&&(string)data["fromVersion"]=="0.0.1"&&(string)data["toVersion"]=="0.0.2","Recovery marker binding mismatch.");
                        Assert((string)data["installerSHA256"]==Hash(wrapper),"Recovery marker used another installer.");
                        Assert((string)data["executableSHA256"]==Hash(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName))&&(string)data["asarSHA256"]==Hash(Path.Combine(Spec.InstallDirectory,"resources","app.asar")),"Recovery marker does not bind restored bytes.");
                        File.Delete(marker);
                        Assert(child.WaitForExit(10000),"Restored installer did not close itself and release the retry mutex.");
                        Assert(child.ExitCode==0,"Restored installer failed to close normally.");
                    }
                }
                finally
                {
                    if(!parent.HasExited){File.WriteAllText(Path.Combine(hold,"stop"),"normal fixture cleanup");parent.WaitForExit(5000);}
                    if(!child.HasExited){child.CloseMainWindow();child.WaitForExit(5000);}
                }
            }
        }
    }
    private static InstallerEngine Engine(InstallSpec spec) { return new InstallerEngine(spec, delegate { return File.OpenRead(Backend); }); }
    private static string InstallOnWorker(InstallerEngine engine)
    {
        return Task.Run(delegate { return engine.Install(Progress); }).GetAwaiter().GetResult();
    }
    private static void Progress(string phase, string message, int? percent)
    {
        Assert(Thread.CurrentThread.GetApartmentState() == ApartmentState.MTA, "Installation must use the same MTA worker context as Program.cs.");
    }
    private static string InstallKey() { return "Software\\" + Spec.Guid; }
    private static string UninstallKey() { return "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + Spec.Guid; }
    private static string AppModelKey() { return "Software\\Classes\\AppUserModelId\\" + Spec.AppId; }
    private static string StartMenuShortcut() { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Spec.ShortcutName + ".lnk"); }
    private static string DesktopShortcut() { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Spec.ShortcutName + ".lnk"); }
    private static bool Same(string first, string second) { return string.Equals(Path.GetFullPath(first).TrimEnd('\\'), Path.GetFullPath(second).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase); }
    private static bool IsInside(string file, string parent) { return Path.GetFullPath(file).StartsWith(Path.GetFullPath(parent).TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase); }
    private static string Hash(string file) { using (var hash = SHA256.Create()) using (var stream = File.OpenRead(file)) return BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    private static void Assert(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    private static void ExpectFailure(Action action)
    {
        bool failed = false;
        try { action(); } catch (InvalidOperationException) { failed = true; } catch (IOException) { failed = true; } catch (ArgumentException) { failed = true; }
        Assert(failed, "Operation unexpectedly succeeded.");
    }
    private static void Check(string name, Action action)
    {
        try { action(); Checks.Add(new { name = name, ok = true }); }
        catch (Exception error) { Checks.Add(new { name = name, ok = false, error = error.Message }); throw; }
    }
    private static void WaitFor(Func<bool> ready, string error, int timeout = 7000)
    {
        var watch = Stopwatch.StartNew();
        while (!ready()) { Assert(watch.ElapsedMilliseconds < timeout, error); Thread.Sleep(40); }
    }
    private static int Run(string executable, string arguments)
    {
        using (var process = Process.Start(new ProcessStartInfo(executable, arguments) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden }))
        {
            Assert(process.WaitForExit(90000), "Fixture backend timed out; it was not forcibly stopped.");
            return process.ExitCode;
        }
    }
    private static string ShortcutTarget(string file)
    {
        Assert(File.Exists(file), "Expected fixture shortcut missing: " + file);
        object shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        object shortcut = null;
        try
        {
            shortcut = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { file });
            return (string)shortcut.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, shortcut, null);
        }
        finally { if (shortcut != null) Marshal.FinalReleaseComObject(shortcut); Marshal.FinalReleaseComObject(shell); }
    }
    private static void VerifyRegistrationAndShortcuts()
    {
        using (var hive = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Registry64))
        using (var install = hive.OpenSubKey(InstallKey()))
        using (var uninstall = hive.OpenSubKey(UninstallKey()))
        {
            Assert(install != null && uninstall != null, "Fixture registration missing.");
            Assert(Same((string)install.GetValue("InstallLocation"), Spec.InstallDirectory), "Registered install location differs.");
            Assert((string)uninstall.GetValue("DisplayVersion") == Spec.Version, "Registered version differs.");
            Assert(((string)uninstall.GetValue("UninstallString")).Contains(Spec.InstallDirectory), "Uninstaller points outside the fixture.");
        }
        var executable = Path.Combine(Spec.InstallDirectory, Spec.ExecutableName);
        Assert(Same(ShortcutTarget(StartMenuShortcut()), executable), "Start menu shortcut target differs.");
        Assert(Same(ShortcutTarget(DesktopShortcut()), executable), "Desktop shortcut target differs.");
    }
    private static string SnapshotProductionRegistration()
    {
        var result = new SortedDictionary<string, string>();
        foreach (var scope in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        foreach (var view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
        using (var hive = RegistryKey.OpenBaseKey(scope, view))
        using (var parent = hive.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"))
        {
            if (parent == null) continue;
            foreach (var name in parent.GetSubKeyNames())
            using (var key = parent.OpenSubKey(name))
            {
                var displayName = key == null ? null : key.GetValue("DisplayName") as string;
                if (displayName == null || !(displayName == "SYNK Platform Preview" || displayName.StartsWith("SYNK Platform Preview ", StringComparison.Ordinal))) continue;
                foreach (var property in new[] { "DisplayName", "DisplayVersion", "InstallLocation", "UninstallString", "QuietUninstallString" })
                    result[scope + ":" + view + ":" + name + ":" + property] = Convert.ToString(key.GetValue(property));
            }
        }
        ProductionRegistryFields = result.Count;
        return Json.Serialize(result);
    }
    private static void WriteReport(bool ok, string error)
    {
        if (Root == null || !Directory.Exists(Root)) return;
        File.WriteAllText(Path.Combine(Root, "test-results.json"), Json.Serialize(new { ok = ok, checkedAt = DateTime.UtcNow.ToString("o"), checks = Checks, error = error, realPlatformInstallationAttempted = false, productionRegistryFields = ProductionRegistryFields, installWorkerApartment = "MTA" }));
    }
}
