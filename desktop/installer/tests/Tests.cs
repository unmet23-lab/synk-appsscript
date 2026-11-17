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
using System.Security.Principal;
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
    private static readonly List<InstallStage> ProgressStages = new List<InstallStage>();
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
            // 넘김 쪽지, 도착 쪽지, 가림막 캐시(검정 구 1-가 구현 설계 2절과 6절). 시험 폴더 안의 설치기 자리로 바꿔 끼운다
            Check("handoff note is read only when token, app process and version all match", delegate
            {
                Handoff.InstallerRoot = Path.Combine(Root, "handoff-installer");
                string token = new string('a', 64), appId = "im.synk.signal.fixture.handoff";
                Directory.CreateDirectory(Handoff.Folder);
                Func<string, string> note = delegate(string extra) { return "{\"schemaVersion\":1,\"token\":\"" + token + "\",\"appPid\":4242,\"version\":\"0.4.97\",\"window\":131072,\"x\":10,\"y\":20,\"width\":1440,\"height\":940,\"maximized\":false,\"visibility\":\"behind\",\"quiet\":false,\"cut\":0.5,\"curtainEvent\":\"Local\\\\SYNK.Curtain.0123456789abcdef0123456789abcdef\",\"writtenAt\":\"2026-11-17T00:00:00.000Z\"" + extra + "}"; };
                File.WriteAllText(Handoff.HandoffFile(appId), note(""));
                HandoffNote read = Handoff.ReadHandoff(appId, token, 4242, "0.4.97");
                Assert(read != null && read.Behind && read.HasBounds && read.Width == 1440 && read.Window == 131072 && read.CurtainEvent.EndsWith("abcdef", StringComparison.Ordinal), "A matching handoff note was not read.");
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.97") != null, "Reading a handoff note must not consume it.");
                Assert(Handoff.ReadHandoff(appId, new string('b', 64), 4242, "0.4.97") == null, "A note for another token was read.");
                Assert(Handoff.ReadHandoff(appId, token, 4243, "0.4.97") == null, "A note for another app process was read.");
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.98") == null, "A note for another version was read.");
                Assert(Handoff.ReadHandoff(appId, token, 0, "0.4.97") != null, "The curtain (no wait pid) could not read its note.");
                File.WriteAllText(Handoff.HandoffFile(appId), note("").Replace("behind", "sideways"));
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.97") == null, "An unknown visibility was accepted.");
                File.WriteAllText(Handoff.HandoffFile(appId), note("").Replace("SYNK.Curtain.", "Other."));
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.97") == null, "A foreign event name was accepted.");
                File.WriteAllText(Handoff.HandoffFile(appId), "{not json");
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.97") == null, "A broken note was accepted.");
                File.WriteAllText(Handoff.HandoffFile(appId), note(",\"pad\":\"" + new string('x', 5000) + "\""));
                Assert(Handoff.ReadHandoff(appId, token, 4242, "0.4.97") == null, "An oversized note was accepted.");
                string curtainToken;
                Assert(Handoff.IsCurtain(new[] { "--auto-update", "--curtain", "--wait-pid=1", "--handoff-token=" + token }, out curtainToken) && curtainToken == token, "The curtain mode did not win over other arguments.");
                Assert(Handoff.IsCurtain(new[] { "--curtain", "--handoff-token=XYZ" }, out curtainToken) && curtainToken == null, "A malformed curtain token was accepted.");
                Assert(!Handoff.IsCurtain(new[] { "--auto-update", "--wait-pid=1", "--handoff-token=" + token }, out curtainToken), "Automatic update was taken as the curtain.");
            });
            Check("arrival note is written atomically and an unwritable arrival note is swallowed", delegate
            {
                string appId = "im.synk.signal.fixture.handoff";
                Assert(Handoff.WriteArrival(appId, new ArrivalNote { Kind = "updated", Version = "0.4.97", X = 1, Y = 2, Width = 1440, Height = 940, Visibility = "front", Cut = 1, Lit = 0.58 }), "Arrival note was not written.");
                string text = File.ReadAllText(Handoff.ArrivalFile(appId));
                Assert(text.Contains("\"kind\":\"updated\"") && text.Contains("\"installerPid\":" + Process.GetCurrentProcess().Id) && text.Contains("\"writtenAt\""), "Arrival note content: " + text);
                Assert(Directory.GetFiles(Handoff.Folder, "*.partial").Length == 0, "Arrival note left a temporary file.");
                File.Delete(Handoff.ArrivalFile(appId));
                Directory.CreateDirectory(Handoff.ArrivalFile(appId));
                try { Assert(!Handoff.WriteArrival(appId, new ArrivalNote { Kind = "updated", Version = "0.4.97", Visibility = "front" }), "An unwritable arrival note reported success."); }
                finally { Directory.Delete(Handoff.ArrivalFile(appId)); }
                Assert(Directory.GetFiles(Handoff.Folder, "*.partial").Length == 0, "A failed arrival note left a temporary file.");
            });
            Check("orphan curtain caches are removed while live owners and transaction folders stay", delegate
            {
                string cache = Path.Combine(Handoff.InstallerRoot, "Cache");
                Directory.CreateDirectory(cache);
                int dead = 999999;
                while (true) { try { using (Process.GetProcessById(dead)) { } dead--; } catch (ArgumentException) { break; } }
                string orphan = Path.Combine(cache, "curtain-" + dead + "-" + new string('c', 32));
                string live = Path.Combine(cache, "curtain-" + Process.GetCurrentProcess().Id + "-" + new string('d', 32));
                string transaction = Path.Combine(cache, System.Guid.NewGuid().ToString("N"));
                string lookalike = Path.Combine(cache, "curtain-" + dead + "-short");
                foreach (string directory in new[] { orphan, live, transaction, lookalike }) { Directory.CreateDirectory(directory); File.WriteAllText(Path.Combine(directory, "x"), "x"); }
                Assert(Handoff.CleanupOrphanCurtainCaches() == 1, "Expected exactly one orphan curtain cache to be removed.");
                Assert(!Directory.Exists(orphan) && Directory.Exists(live) && Directory.Exists(transaction) && Directory.Exists(lookalike), "Curtain cache cleanup touched the wrong folders.");
                // 성공한 설치의 단계 시각: 최근 20회만 남기고, 쓰지 못해도 삼킨다(1-가 구현 설계 3절)
                string timingApp = "im.synk.signal.fixture.timing";
                for (int i = 0; i < 21; i++) Assert(Handoff.WriteStageTiming(timingApp, new StageTiming { Kind = "update", Version = "0.0." + i, TotalMs = i, Stages = { new StageMark { Stage = "BackingUp", Ms = i } } }), "Stage timing was not written.");
                string timings = File.ReadAllText(Handoff.TimingFile(timingApp));
                Assert(!timings.Contains("\"0.0.0\"") && timings.Contains("\"0.0.20\"") && timings.Contains("\"stage\":\"BackingUp\""), "Stage timing kept the wrong runs: " + timings);
                File.Delete(Handoff.TimingFile(timingApp)); Directory.CreateDirectory(Handoff.TimingFile(timingApp));
                Assert(!Handoff.WriteStageTiming(timingApp, new StageTiming { Kind = "update" }), "An unwritable stage timing reported success.");
                Directory.Delete(Handoff.TimingFile(timingApp));
                // 「바꾸는 중」 표시(장치 1): 자기 번호를 적고, 박동으로 시각을 고치고, 놓을 때 지운다. 남의 표시는 지우지 않는다
                string markerApp = "im.synk.signal.fixture.marker";
                UpdatingMarker heldMarker = UpdatingMarker.Hold(markerApp, "platform");
                Assert(heldMarker != null && File.Exists(Handoff.MarkerFile(markerApp)) && UpdatingMarker.ReadPid(markerApp) == Process.GetCurrentProcess().Id, "Updating marker was not written with this process.");
                File.SetLastWriteTimeUtc(Handoff.MarkerFile(markerApp), DateTime.UtcNow.AddSeconds(-30));
                Thread.Sleep(UpdatingMarker.BeatMilliseconds + 600);
                Assert(DateTime.UtcNow - File.GetLastWriteTimeUtc(Handoff.MarkerFile(markerApp)) < TimeSpan.FromSeconds(5), "Heartbeat did not refresh the marker time.");
                heldMarker.Release();
                Assert(!File.Exists(Handoff.MarkerFile(markerApp)), "Released marker was not removed.");
                Thread.Sleep(UpdatingMarker.BeatMilliseconds + 300);
                Assert(!File.Exists(Handoff.MarkerFile(markerApp)), "A heartbeat recreated a released marker.");
                UpdatingMarker other = UpdatingMarker.Hold(markerApp, "platform");
                File.WriteAllText(Handoff.MarkerFile(markerApp), "{\"pid\":1,\"product\":\"platform\"}");
                other.Release();
                Assert(File.Exists(Handoff.MarkerFile(markerApp)), "A marker of another installer was removed.");
                File.Delete(Handoff.MarkerFile(markerApp));
                // 지우지 못하면 시각을 10초보다 앞으로 고친다(앱은 낡은 표시로 본다)
                UpdatingMarker locked = UpdatingMarker.Hold(markerApp, "platform");
                using (new FileStream(Handoff.MarkerFile(markerApp), FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    var releasing = Stopwatch.StartNew(); locked.Release();
                    Assert(releasing.ElapsedMilliseconds >= 900, "Release did not retry deleting a held marker.");
                    Assert(DateTime.UtcNow - File.GetLastWriteTimeUtc(Handoff.MarkerFile(markerApp)) > TimeSpan.FromSeconds(10), "An undeletable marker was not made stale.");
                }
                File.Delete(Handoff.MarkerFile(markerApp));
                // 창 보이기 요청: 자기 번호이거나, 번호 칸이 빈 채 자기가 시작한 뒤에 생긴 요청만 받는다
                DateTime since = DateTime.UtcNow; int me = Process.GetCurrentProcess().Id;
                Assert(ShowRequest.Write(markerApp, 0) && ShowRequest.Take(markerApp, me, since) && !File.Exists(ShowRequest.File(markerApp)), "An empty-number request after the start was not taken.");
                Assert(ShowRequest.Write(markerApp, me + 1) && !ShowRequest.Take(markerApp, me, since) && File.Exists(ShowRequest.File(markerApp)), "A request for another installer was taken.");
                Assert(ShowRequest.Write(markerApp, me) && ShowRequest.Take(markerApp, me, since), "A request for this installer was not taken.");
                Assert(ShowRequest.Write(markerApp, 0), "Request was not written."); File.SetLastWriteTimeUtc(ShowRequest.File(markerApp), since.AddMinutes(-5));
                Assert(!ShowRequest.Take(markerApp, me, since), "A leftover empty-number request from before the start was taken.");
                ShowRequest.Clear(markerApp); Assert(!File.Exists(ShowRequest.File(markerApp)), "Clear left the request.");
                string mine = Handoff.CreateCurtainCache();
                Assert(Path.GetFileName(mine).StartsWith("curtain-" + Process.GetCurrentProcess().Id + "-", StringComparison.Ordinal), "Curtain cache name does not carry its owner: " + mine);
                Directory.Delete(Handoff.InstallerRoot, true);
                Handoff.InstallerRoot = null;
            });
            // 조용한 업데이트가 끝날 무렵 사람이 켠 앱의 요청이 사라지지 않는다(0.4.96 검수 GA1)
            Check("a show request before the launch reveals the installer, one after the launch opens the app again at the end", delegate
            {
                var pending = new Queue<bool>(); int reveals = 0;
                Func<bool> take = delegate { return pending.Count > 0 && pending.Dequeue(); };
                var before = new ShowRequestGate(take, delegate { reveals++; });
                pending.Enqueue(true); before.Tick();
                Assert(reveals == 1, "A request before the launch did not reveal the installer.");
                before.BeforeLaunch(); before.Launched(); Assert(!before.OpenAgainAtEnd(), "A request already answered before the launch opened the app again.");
                // 마지막 Tick과 BeforeLaunch 사이에 생긴 요청: 도착 쪽지를 쓰기 전에 받아 창을 보인다
                reveals = 0; var edge = new ShowRequestGate(take, delegate { reveals++; });
                pending.Enqueue(true); edge.BeforeLaunch(); edge.Launched();
                Assert(reveals == 1 && !edge.OpenAgainAtEnd(), "A request waiting at the launch was not answered before the arrival note.");
                // 켜기 시작한 뒤의 요청: 설치기 창만 보이면 새 앱이 숨은 채 남는다. 끝에서 앱을 한 번 더 켠다
                reveals = 0; var after = new ShowRequestGate(take, delegate { reveals++; });
                after.BeforeLaunch(); pending.Enqueue(true); after.Tick();
                Assert(reveals == 0, "A request after the launch revealed only the installer window.");
                after.Launched();
                Assert(after.OpenAgainAtEnd(), "A request after the launch was lost.");
                // 끝나기 직전에 막 생긴 요청도 받는다
                var late = new ShowRequestGate(take, delegate { reveals++; });
                late.BeforeLaunch(); late.Launched(); pending.Enqueue(true);
                Assert(late.OpenAgainAtEnd() && pending.Count == 0, "A request at the very end was not taken.");
                var none = new ShowRequestGate(take, delegate { reveals++; });
                none.Tick(); none.BeforeLaunch(); none.Launched(); Assert(!none.OpenAgainAtEnd() && reveals == 0, "No request still opened something.");
            });
            // 앱을 켜지 못해 실패 장면에 머문 설치기: 요청이 창을 다시 앞으로 가져오고, 사람이 그 창을 닫아도 끝에서 앱을 켜지 않는다(0.4.96 검수 B2)
            Check("after a failed launch a show request brings the failure window forward and the end never opens the app", delegate
            {
                var pending = new Queue<bool>(); int reveals = 0;
                Func<bool> take = delegate { return pending.Count > 0 && pending.Dequeue(); };
                // 켜기를 넘기지 않은 끝에서는 요청이 있어도 앱을 켜지 않는다(고치기 전 판은 여기서 앱을 켰다)
                var unlaunched = new ShowRequestGate(take, delegate { reveals++; });
                unlaunched.BeforeLaunch(); pending.Enqueue(true); unlaunched.Tick();
                Assert(!unlaunched.OpenAgainAtEnd(), "An installer whose launch never went through opened the app at the end.");
                pending.Enqueue(true);
                Assert(!unlaunched.OpenAgainAtEnd(), "A request at the end opened the app although no launch went through.");
                pending.Clear();
                // 켜지 못한 뒤의 요청은 실패 장면의 창을 앞으로 가져온다
                reveals = 0; var failed = new ShowRequestGate(take, delegate { reveals++; });
                failed.BeforeLaunch(); pending.Enqueue(true); failed.Tick();
                Assert(reveals == 0, "A request during the launch revealed the installer before the launch failed.");
                failed.LaunchFailed(); pending.Enqueue(true); failed.Tick();
                Assert(reveals == 1, "A request after the failed launch did not bring the failure window forward.");
                Assert(!failed.OpenAgainAtEnd(), "Closing the failure window opened the app.");
                // 실패 뒤 「쓰던 판 열기」로 다시 켜 넘긴 뒤의 요청은 끝에서 앱을 부른다
                failed.BeforeLaunch(); failed.Launched(); pending.Enqueue(true); failed.Tick();
                Assert(reveals == 1 && failed.OpenAgainAtEnd(), "A request after the second, handed-over launch was lost.");
            });
            // Platform 새 창의 기록 칸은 엔진의 해요체 문장을 옮기지 않고 값만 옮긴다(0.4.96 검수 F4). 엔진 글의 꼴은 아래 실제 엔진 실패에서도 본다
            Check("the Platform window record keeps engine values and never the engine's sentences", delegate
            {
                AssertRecord("설치를 마치지 못했어요. 다시 해 주세요. (코드 2)", new[] { "설치 엔진 코드: 2" });
                AssertRecord("설치된 파일을 확인하지 못했어요: resources/app.asar. 다시 설치해 주세요.", new[] { "확인하지 못한 파일: resources/app.asar" });
                AssertRecord("설치가 끝났는지 확인하지 못해 되돌리기와 재시도를 멈췄어요.\n액세스가 거부되었습니다.", new[] { "액세스가 거부되었습니다." });
                AssertRecord("Access is denied", new[] { "Access is denied" });
                AssertRecord("설치가 끝나지 않았어요. 되돌릴 원본: C:\\x\\Cache\\a\nSYNK에 이 내용을 알려 주세요.\n되돌릴 원본: C:\\x\\Cache\\a", new[] { "되돌릴 원본: C:\\x\\Cache\\a" });
                AssertRecord("SYNK가 아직 켜져 있어요.\n작업을 저장하고 앱을 끈 뒤 다시 해 주세요.", new string[0]);
                var bad = ReadSpec(); bad.MinFreeBytes = long.MaxValue;
                Exception space = Caught(delegate { Engine(bad).Preflight(); });
                Assert(FailureKind.Of(space) == FailureKind.Space && FailureValues.Gigabytes(space.Message) != null, "The space failure lost its size: " + space.Message);
                AssertRecord(space.Message, new string[0]);
            });
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
            if(Fixture.ContainsKey("timeoutBackend"))Check("fresh partial install timeout removes only its new files registration and shortcuts",delegate
            {
                string backend=(string)Fixture["timeoutBackend"];var limited=ReadSpec();limited.BackendSHA256=Hash(backend);limited.BackendBytes=new FileInfo(backend).Length;
                limited.Files.Add(new InstallFile { Path="update-only.txt",Bytes=0,SHA256=new string('0',64) });
                var timed=new InstallerEngine(limited,delegate { return File.OpenRead(backend); });InstallFailure failure=null;
                try { Task.Run(delegate { return timed.InstallWithDeadline(Progress,1500); }).GetAwaiter().GetResult(); }catch(InstallFailure error){failure=error;}
                Assert(failure!=null&&failure.CanRetry&&failure.BackendStopped&&failure.Message.Contains("덜 설치된"),"Fresh timeout state was not safely explained.");
                Assert(!Directory.Exists(Spec.InstallDirectory),"Fresh partial installation remains.");
                Assert(!File.Exists(StartMenuShortcut())&&!File.Exists(DesktopShortcut()),"Fresh partial shortcuts remain.");
                using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))Assert(hive.OpenSubKey(UninstallKey())==null,"Fresh partial uninstall registration remains.");
                Assert(Hash(sentinel)==sentinelHash,"Fresh timeout changed external account data.");
                Assert(Same(timed.Preflight(),Spec.InstallDirectory),"Fresh timeout did not release retry.");
            });
            Check("real NSIS install through production engine", delegate
            {
                ProgressStages.Clear();
                Assert(Same(InstallOnWorker(engine), Spec.InstallDirectory), "Installation returned another directory.");
                int preparing=ProgressStages.IndexOf(InstallStage.Preparing),installing=ProgressStages.IndexOf(InstallStage.Installing),verifying=ProgressStages.IndexOf(InstallStage.Verifying);
                Assert(preparing>=0&&installing>preparing&&verifying>installing,"Typed install phases are missing or out of order.");
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
                try
                {
                    File.WriteAllText(archive, "corrupted"); ExpectFailure(delegate { engine.VerifyInstalled(); });
                    // 새 창의 기록 칸에는 그 파일 이름만 옮긴다(0.4.96 검수 F4)
                    AssertRecord(Caught(delegate { engine.VerifyInstalled(); }).Message, new[] { "확인하지 못한 파일: resources/app.asar" });
                }
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
            Check("only this Windows session's copies count as running", delegate
            {
                int own = InstallerEngine.CurrentSessionId();
                var mine = engine.ApplicationProcessesInSession(own);
                try { Assert(mine.Any(process => process.Id == held.Id), "The running fixture in this session was not counted."); }
                finally { foreach (Process process in mine) process.Dispose(); }
                // A session no process here can be in stands for another Windows account's session.
                var other = engine.ApplicationProcessesInSession(own + 4096);
                try { Assert(other.Count == 0, "A copy outside the inspected session was counted."); }
                finally { foreach (Process process in other) process.Dispose(); }
                Assert(engine.ApplicationProcessCount() >= 1 && !held.HasExited, "Session count missed or stopped the fixture.");
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
            if(Fixture.ContainsKey("timeoutBackend"))
            {
                Check("deadline stops descendants after parent exit then restores files registry shortcuts and preserves external data",delegate
                {
                    ProgressStages.Clear();
                    string backend=(string)Fixture["timeoutBackend"],pulse=Path.Combine(Root,"timeout-pulse.txt");
                    var limited=ReadSpec();limited.BackendSHA256=Hash(backend);limited.BackendBytes=new FileInfo(backend).Length;
                    limited.Files.Add(new InstallFile { Path="update-only.txt",Bytes=0,SHA256=new string('0',64) });
                    var timed=new InstallerEngine(limited,delegate { return File.OpenRead(backend); });
                    InstallFailure failure=null;var elapsed=Stopwatch.StartNew();
                    try { Task.Run(delegate { return timed.InstallWithDeadline(Progress,1500); }).GetAwaiter().GetResult(); }
                    catch(InstallFailure error) { failure=error; }
                    Assert(failure!=null&&failure.CanRetry&&failure.BackendStopped,"Timed-out partial install was not safely retryable.");
                    AssertRollbackStages(false);
                    Assert(failure.Message.Contains("되돌렸어요"),"Failure did not disclose rollback status.");
                    Assert(elapsed.ElapsedMilliseconds<20000,"Timeout did not return within the bounded stop grace.");
                    Assert(File.Exists(pulse),"Fixture descendant did not run.");
                    string prior=File.ReadAllText(pulse);Thread.Sleep(400);
                    Assert(prior==File.ReadAllText(pulse),"Descendant continued writing after rollback.");
                    Assert(!File.Exists(Path.Combine(Spec.InstallDirectory,"update-only.txt")),"Partial new payload remains.");
                    engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    Assert(Hash(sentinel)==sentinelHash,"Timeout rollback changed external account data.");
                    Assert(Same(timed.Preflight(),Spec.InstallDirectory),"Safe rollback did not release the retry barrier.");
                });
                Check("unconfirmed backend stop never rolls back or relaunches and blocks reopening the installer",delegate
                {
                    using(var parent=Process.GetCurrentProcess())
                    {
                        // A terminated disposable process satisfies the same parent-exit precondition.
                        using(var exited=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)){UseShellExecute=false,CreateNoWindow=true}))
                        {
                            Assert(exited.WaitForExit(5000),"Fixture parent did not exit.");
                            var session=new AutomaticUpdateSession { Parent=exited,Directory=Spec.InstallDirectory,Version=Spec.Version,ExecutableSHA256=Hash(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)),AsarSHA256=Hash(Path.Combine(Spec.InstallDirectory,"resources","app.asar")),Nonce=new string('a',64),InstallerSHA256=new string('b',64) };
                            bool relaunched=false;var blocked=Engine(ReadSpec());
                            var result=Task.Run(delegate { return blocked.InstallAutomaticUpdateCore(session,Progress,delegate(Action<InstallProgress> progress) { throw new InstallFailure("Synthetic stop confirmation failure",false,false); },delegate(string executable,string arguments){relaunched=true;}); }).GetAwaiter().GetResult();
                            Assert(!result.Restored&&!result.Updated&&!relaunched,"Unconfirmed stop attempted recovery or launch.");
                            Assert(result.Message.Contains("일부 바뀌었을 수")&&result.Message.Contains("되돌릴 원본"),"Uncertain state not disclosed.");
                            // 새 창의 기록 칸: 엔진 문장은 옮기지 않고, 되돌릴 원본의 실제 경로와 감싼 예외의 글만 옮긴다(0.4.96 검수 F4)
                            List<string> kept=FailureValues.Of(result.Message);string label="되돌릴 원본: ";
                            Assert(kept.Count==2&&kept[0].StartsWith(label,StringComparison.Ordinal)&&Directory.Exists(kept[0].Substring(label.Length))&&kept[1]=="Synthetic stop confirmation failure","The record lost the backup folder: "+String.Join(" | ",kept));
                            AssertRecord(result.Message,kept.ToArray());
                            InstallFailure failure=null;try { Engine(ReadSpec()).Preflight(); }catch(InstallFailure error){failure=error;}
                            Assert(failure!=null&&!failure.CanRetry,"New installer did not respect unresolved transaction barrier.");
                            // 지난 설치가 끝나지 않은 표시: 종류는 「pending」이고 기록 칸에는 되돌리기 안내의 경로만 옮긴다(0.4.96 검수 F4)
                            Assert(FailureKind.Of(failure)==FailureKind.Pending,"The unfinished-install barrier carries no kind.");
                            AssertRecord(failure.Message,new[] { "되돌리기 안내: "+Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt") });
                            failure=null;try { Engine(ReadSpec()).PrepareAutomaticUpdate(exited.Id,new string('a',64),new string('b',64)); }catch(InstallFailure error){failure=error;}
                            Assert(failure!=null&&!failure.CanRetry,"Automatic update did not reject the unresolved transaction before READY.");
                            string pending=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt");
                            Assert(File.Exists(pending),"Recovery marker missing.");
                            // Injected failure launched no backend, so this fixture alone can clear its barrier.
                            File.Delete(pending);engine.VerifyInstalled();Assert(Hash(sentinel)==sentinelHash,"Uncertain branch changed account data.");
                        }
                    }
                });
                Check("automatic update timeout uses the same bounded backend and restores previous application before recovery launch",delegate
                {
                    ProgressStages.Clear();
                    string backend=(string)Fixture["timeoutBackend"];var limited=ReadSpec();limited.Version="0.0.2";limited.BackendSHA256=Hash(backend);limited.BackendBytes=new FileInfo(backend).Length;
                    limited.Files.Add(new InstallFile { Path="update-only.txt",Bytes=0,SHA256=new string('0',64) });
                    var timed=new InstallerEngine(limited,delegate { return File.OpenRead(backend); });
                    using(var exited=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)){UseShellExecute=false,CreateNoWindow=true}))
                    {
                        Assert(exited.WaitForExit(5000),"Automatic timeout fixture parent did not exit.");
                        string nonce=System.Guid.NewGuid().ToString("N")+System.Guid.NewGuid().ToString("N");
                        var session=new AutomaticUpdateSession { Parent=exited,Directory=Spec.InstallDirectory,Version=Spec.Version,ExecutableSHA256=Hash(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)),AsarSHA256=Hash(Path.Combine(Spec.InstallDirectory,"resources","app.asar")),Nonce=nonce,InstallerSHA256=new string('b',64) };
                        int launches=0;
                        var result=Task.Run(delegate { return timed.InstallAutomaticUpdateCore(session,Progress,delegate(Action<InstallProgress> progress){return timed.InstallPayload(progress,1500);},delegate(string executable,string arguments){engine.VerifyInstalled();VerifyRegistrationAndShortcuts();Assert(arguments=="--synk-update-recovery="+nonce,"Timeout recovery token differs");launches++;}); }).GetAwaiter().GetResult();
                        Assert(result.Restored&&result.Relaunched&&!result.Updated&&launches==1,"Automatic timeout did not recover exactly once: "+result.Message);
                        AssertRollbackStages(true);
                        Assert(!File.Exists(Path.Combine(Spec.InstallDirectory,"update-only.txt")),"Automatic timeout left partial payload.");
                        Assert(Hash(sentinel)==sentinelHash,"Automatic timeout changed external account data.");
                        Assert(result.RecoveryFile.EndsWith(Spec.AppId+".json",StringComparison.Ordinal),"Fixture recovery file differs");File.Delete(result.RecoveryFile);
                    }
                });
                Func<Process> exitedParent=delegate
                {
                    var exited=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)){UseShellExecute=false,CreateNoWindow=true});
                    Assert(exited.WaitForExit(5000),"Failure-record fixture parent did not exit.");
                    return exited;
                };
                Func<string,Process> holdingProcess=delegate(string name)
                {
                    string folder=Path.Combine(Root,name);
                    var holder=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName),"--hold \""+folder+"\""){UseShellExecute=false,CreateNoWindow=true});
                    for(var clock=Stopwatch.StartNew();!File.Exists(Path.Combine(folder,"ready"));Thread.Sleep(20))Assert(clock.ElapsedMilliseconds<5000,"Held fixture did not start.");
                    return holder;
                };
                Func<Process,AutomaticUpdateSession> sessionFor=delegate(Process exited)
                {
                    return new AutomaticUpdateSession { Parent=exited,Directory=Spec.InstallDirectory,Version=Spec.Version,ExecutableSHA256=Hash(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName)),AsarSHA256=Hash(Path.Combine(Spec.InstallDirectory,"resources","app.asar")),Nonce=System.Guid.NewGuid().ToString("N")+System.Guid.NewGuid().ToString("N"),InstallerSHA256=new string('b',64) };
                };
                string failureRecord=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Diagnostics",Spec.AppId+".last-update-failure.json");
                Check("automatic update waits for a lingering app process instead of failing preflight",delegate
                {
                    using(Process holder=holdingProcess("linger-short"))
                    using(Process exited=exitedParent())
                    {
                        Task release=Task.Run(delegate { Thread.Sleep(1200);File.WriteAllText(Path.Combine(Root,"linger-short","stop"),"stop"); });
                        int launches=0;var waiting=Engine(ReadSpec());
                        var result=Task.Run(delegate { return waiting.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress) { Assert(holder.HasExited,"Install started while an app process was running.");throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                        release.GetAwaiter().GetResult();
                        Assert(result.Restored&&result.Relaunched&&!result.Updated&&launches==1,"Lingering process was not awaited: "+result.Message);
                        string record=File.ReadAllText(failureRecord);
                        Assert(record.Contains("\"stage\":\"install\"")&&record.Contains("\"outcome\":\"rolling-back\"")&&record.Contains("Synthetic payload failure"),"Failure record lost the install stage: "+record);
                        File.Delete(failureRecord);File.Delete(result.RecoveryFile);
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                Check("a process that outlives the wait is reported with its id and leaves the app unchanged",delegate
                {
                    using(Process holder=holdingProcess("linger-long"))
                    using(Process exited=exitedParent())
                    {
                        int launches=0;var bounded=Engine(ReadSpec());bounded.ProcessExitGraceMilliseconds=300;
                        var elapsed=Stopwatch.StartNew();
                        var result=Task.Run(delegate { return bounded.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress) { throw new InvalidOperationException("Install must not start."); },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                        Assert(elapsed.ElapsedMilliseconds<15000,"Process wait was not bounded.");
                        Assert(result.Restored&&result.Relaunched&&!result.Updated&&launches==1,"Blocked preflight did not reopen the app once: "+result.Message);
                        string record=File.ReadAllText(failureRecord);
                        Assert(record.Contains("\"stage\":\"preflight\"")&&record.Contains("\"outcome\":\"unchanged\"")&&record.Contains("\"runningProcesses\":[\""+holder.Id+" "),"Failure record did not name the running process: "+record);
                        Assert(!holder.HasExited,"The installer stopped a running app process.");
                        File.WriteAllText(Path.Combine(Root,"linger-long","stop"),"stop");Assert(holder.WaitForExit(5000),"Held fixture did not stop.");
                        File.Delete(failureRecord);File.Delete(result.RecoveryFile);
                    }
                });
                Check("a verified update whose relaunch fails stays updated and leaves no rollback barrier",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        var committed=Engine(ReadSpec());
                        var result=Task.Run(delegate { return committed.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress){return committed.InstallPayload(progress,BackendProcess.DeadlineMilliseconds);},delegate(string executable,string arguments){throw new IOException("Synthetic relaunch failure");}); }).GetAwaiter().GetResult();
                        Assert(result.Updated&&!result.Relaunched&&!result.Restored,"Relaunch failure undid a verified update: "+result.Message);
                        string pending=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt");
                        Assert(!File.Exists(pending),"A committed update left the recovery barrier.");
                        string record=File.ReadAllText(failureRecord);
                        Assert(record.Contains("\"stage\":\"relaunch\"")&&record.Contains("\"outcome\":\"updated\"")&&record.Contains("Synthetic relaunch failure"),"Relaunch failure was not recorded: "+record);
                        File.Delete(failureRecord);
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                Check("a verified rollback whose relaunch fails stays restored and leaves no rollback barrier",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        var restoring=Engine(ReadSpec());
                        var result=Task.Run(delegate { return restoring.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress) { throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){throw new IOException("Synthetic recovery launch failure");}); }).GetAwaiter().GetResult();
                        Assert(result.Restored&&!result.Relaunched&&!result.Updated,"Recovery launch failure was not reported as a settled restore: "+result.Message);
                        string pending=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt");
                        Assert(!File.Exists(pending),"A verified restore left the recovery barrier.");
                        string record=File.ReadAllText(failureRecord);
                        Assert(record.Contains("\"stage\":\"relaunch\"")&&record.Contains("\"outcome\":\"rolled-back\"")&&record.Contains("Synthetic recovery launch failure"),"Recovery launch failure was not recorded: "+record);
                        File.Delete(failureRecord);if(result.RecoveryFile!=null&&File.Exists(result.RecoveryFile))File.Delete(result.RecoveryFile);
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                Check("a throwing arrival note hook never changes the update outcome and hears the restored version",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        int launches=0;var arriving=Engine(ReadSpec());var heard=new List<string>();
                        arriving.BeforeLaunch=delegate(string kind,string version){heard.Add(kind+" "+version);throw new IOException("Synthetic arrival note failure");};
                        var session=sessionFor(exited);
                        var result=Task.Run(delegate { return arriving.InstallAutomaticUpdateCore(session,Progress,delegate(Action<InstallProgress> progress) { throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                        Assert(result.Restored&&result.Relaunched&&launches==1,"Arrival note failure changed recovery: "+result.Message);
                        Assert(heard.Count==1&&heard[0]=="restored "+session.Version,"Arrival hook heard: "+String.Join(",",heard));
                        if(result.RecoveryFile!=null&&File.Exists(result.RecoveryFile))File.Delete(result.RecoveryFile);
                        if(File.Exists(failureRecord))File.Delete(failureRecord);
                    }
                });
                // 장치 2(1-가 구현 설계 2절): 백업하는 동안 사람이 앱을 켰으면 파일을 바꾸기 전에 끝낸다. 여유 시간 안에 꺼지면 그대로 간다
                Func<string,int,Action<InstallProgress>> startDuringBackup=delegate(string name,int stopAfter)
                {
                    bool started=false;
                    return delegate(InstallProgress p)
                    {
                        Progress(p);
                        if(p.Stage!=InstallStage.BackingUp||started)return;started=true;
                        holdingProcess(name).Dispose();
                        if(stopAfter>=0){string stop=Path.Combine(Root,name,"stop");new Thread(delegate(){Thread.Sleep(stopAfter);File.WriteAllText(stop,"stop");}){IsBackground=true}.Start();}
                    };
                };
                Action<string> releaseHeld=delegate(string name){string folder=Path.Combine(Root,name);if(Directory.Exists(folder))File.WriteAllText(Path.Combine(folder,"stop"),"stop");Thread.Sleep(300);};
                Check("an app opened during backup ends the automatic update unchanged, without a rollback barrier or relaunch",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        int launches=0,installs=0;var checking=Engine(ReadSpec());checking.ProcessExitGraceMilliseconds=400;
                        try
                        {
                            var result=Task.Run(delegate { return checking.InstallAutomaticUpdateCore(sessionFor(exited),startDuringBackup("second-check-stay",-1),delegate(Action<InstallProgress> progress){installs++;return "";},delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                            Assert(result.UserAppRunning&&!result.Updated&&!result.Restored&&!result.Relaunched&&launches==0&&installs==0,"Second check did not stop before changing files: "+result.Message);
                            string pending=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt");
                            Assert(!File.Exists(pending),"Second check left a rollback barrier.");
                            string record=File.ReadAllText(failureRecord);
                            Assert(record.Contains("\"stage\":\"second-check\"")&&record.Contains("\"outcome\":\"unchanged\""),"Second check was not recorded as unchanged: "+record);
                        }
                        finally { releaseHeld("second-check-stay"); if(File.Exists(failureRecord))File.Delete(failureRecord); }
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                Check("an app that quits within the grace time lets the update go on",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        int launches=0;var checking=Engine(ReadSpec());checking.ProcessExitGraceMilliseconds=4000;
                        try
                        {
                            var result=Task.Run(delegate { return checking.InstallAutomaticUpdateCore(sessionFor(exited),startDuringBackup("second-check-leave",300),delegate(Action<InstallProgress> progress) { throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                            Assert(!result.UserAppRunning&&result.Restored&&result.Relaunched&&launches==1&&result.RestoredStatus=="rolled-back","An app that quit in time still stopped the update: "+result.Message);
                            if(result.RecoveryFile!=null&&File.Exists(result.RecoveryFile))File.Delete(result.RecoveryFile);
                        }
                        finally { releaseHeld("second-check-leave"); if(File.Exists(failureRecord))File.Delete(failureRecord); }
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                // 장치 3: 파일을 바꾸는 중에 켜진 앱이 스스로 끝나는 사이를 기다린 뒤 되돌린다(전에는 바로 거절해 막힌 상태가 됐다)
                Check("restore waits for an app that quits within the grace time instead of blocking recovery",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        int launches=0;var restoring=Engine(ReadSpec());restoring.ProcessExitGraceMilliseconds=4000;
                        try
                        {
                            var result=Task.Run(delegate { return restoring.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress)
                            {
                                holdingProcess("restore-wait").Dispose();
                                string stop=Path.Combine(Root,"restore-wait","stop");new Thread(delegate(){Thread.Sleep(500);File.WriteAllText(stop,"stop");}){IsBackground=true}.Start();
                                throw new IOException("Synthetic payload failure while the app was opened");
                            },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                            Assert(result.Restored&&result.Relaunched&&launches==1,"Restore did not wait for the app: "+result.Message);
                            if(result.RecoveryFile!=null&&File.Exists(result.RecoveryFile))File.Delete(result.RecoveryFile);
                        }
                        finally { releaseHeld("restore-wait"); if(File.Exists(failureRecord))File.Delete(failureRecord); }
                        string pending=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",Spec.Guid+".txt");
                        Assert(!File.Exists(pending),"A waited restore left the recovery barrier.");
                        engine.VerifyInstalled();VerifyRegistrationAndShortcuts();
                    }
                });
                // 「쓰던 판 열기」: 되돌린 뒤 켜지 못한 쓰던 판을 옛 판 해시를 다시 맞추고 되돌림 표시를 새로 써서 켠다
                Check("open the previous version again rewrites the recovery marker and starts the verified old executable",delegate
                {
                    using(Process exited=exitedParent())
                    {
                        var reopening=Engine(ReadSpec());var session=sessionFor(exited);var heard=new List<string>();
                        reopening.BeforeLaunch=delegate(string kind,string version){heard.Add(kind);};
                        var result=Task.Run(delegate { return reopening.InstallAutomaticUpdateCore(session,Progress,delegate(Action<InstallProgress> progress) { throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){throw new IOException("Synthetic recovery launch failure");}); }).GetAwaiter().GetResult();
                        Assert(result.Restored&&!result.Relaunched&&result.RestoredStatus=="rolled-back","Restored launch failure was not reported: "+result.Message);
                        File.Delete(result.RecoveryFile);
                        string launched=Path.Combine(Spec.InstallDirectory,"fixture-launched");if(File.Exists(launched))File.Delete(launched);
                        reopening.RelaunchPrevious(session,result.RestoredStatus);
                        for(var clock=Stopwatch.StartNew();!File.Exists(launched)&&clock.ElapsedMilliseconds<5000;Thread.Sleep(40)){}
                        Assert(File.Exists(launched)&&File.ReadAllText(launched)=="--synk-update-recovery="+session.Nonce,"Previous version was not opened with its recovery nonce.");
                        Assert(File.Exists(result.RecoveryFile)&&File.ReadAllText(result.RecoveryFile).Contains(session.Nonce),"Recovery marker was not written again.");
                        Assert(heard.Count==2&&heard[1]=="restored","Arrival note hook was not called before reopening: "+String.Join(",",heard));
                        ExpectFailure(delegate { reopening.RelaunchPrevious(session,"updated"); });
                        File.Delete(result.RecoveryFile);File.Delete(launched);if(File.Exists(failureRecord))File.Delete(failureRecord);
                        engine.VerifyInstalled();
                    }
                });
                Check("an unwritable failure record never changes the update outcome",delegate
                {
                    Directory.CreateDirectory(failureRecord);
                    try
                    {
                        using(Process exited=exitedParent())
                        {
                            int launches=0;var blocked=Engine(ReadSpec());
                            var result=Task.Run(delegate { return blocked.InstallAutomaticUpdateCore(sessionFor(exited),Progress,delegate(Action<InstallProgress> progress) { throw new IOException("Synthetic payload failure"); },delegate(string executable,string arguments){launches++;}); }).GetAwaiter().GetResult();
                            Assert(result.Restored&&result.Relaunched&&launches==1,"Failed record changed recovery: "+result.Message);
                            File.Delete(result.RecoveryFile);
                            Assert(Directory.GetFiles(Path.GetDirectoryName(failureRecord),"*.tmp").Length==0,"Failed record left a temporary file.");
                        }
                    }
                    finally { Directory.Delete(failureRecord); }
                });
            }
            if (Fixture.ContainsKey("autoFailure"))
            {
                // 앱이 뒤에서 띄운 자동 업데이트가 설치기 뮤텍스를 얻지 못하면, 도는 설치기의 창을 부르거나 대화 상자를 띄우지 않고 실패로 끝난다(0.4.96 검수 B2).
                // 고치기 전 판은 창 보이기 요청을 쓰고 0으로 끝났다
                Check("an automatic installer that cannot take the installer lock ends without a show request or a dialog", delegate
                {
                    string wrapper=(string)Fixture["autoFailure"];Assert(IsInside(wrapper,Root),"Automatic wrapper escaped fixture root.");
                    string request=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Handoff",Spec.AppId+".show-request");
                    if(File.Exists(request))File.Delete(request);
                    bool created;
                    using(var mutex=new Mutex(true,@"Local\SYNK.Signal.Installer.platform."+WindowsIdentity.GetCurrent().User.Value,out created))
                    {
                        Assert(created,"Another Platform installer is open now; run the test again after it closes.");
                        try
                        {
                            string nonce=System.Guid.NewGuid().ToString("N")+System.Guid.NewGuid().ToString("N");
                            using(var child=Process.Start(new ProcessStartInfo(wrapper,"--auto-update --wait-pid="+Process.GetCurrentProcess().Id+" --handoff-token="+nonce){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true}))
                            {
                                bool ended=child.WaitForExit(30000);
                                if(!ended){try{child.Kill();child.WaitForExit(5000);}catch(Exception){}}
                                Assert(ended,"The automatic installer stayed open (a dialog) instead of ending.");
                                Assert(child.ExitCode!=0,"The automatic installer reported success without the installer lock.");
                                Assert(!File.Exists(request),"The automatic installer asked the running installer to show its window.");
                            }
                        }
                        finally { mutex.ReleaseMutex(); if(File.Exists(request))File.Delete(request); }
                    }
                });
                Check("real automatic installer READY then normal parent exit rolls failed NSIS verification back and relaunches once", delegate
                {
                    using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))
                    using(var key=hive.CreateSubKey(AppModelKey()))
                    { key.SetValue("DisplayName","fixture previous registration");key.SetValue("FixtureInteger",42,RegistryValueKind.DWord); }
                    RunAutomaticFixture((string)Fixture["autoFailure"],false);
                    // 조용한 업데이트: 넘김 쪽지가 「조용히」이면 창을 보이지 않고 되돌린 쓰던 앱을 켜며, 그 앱이 숨은 채 켜지도록 도착 쪽지에 숨음을 적는다
                    RunAutomaticFixture((string)Fixture["autoFailure"],false,true);
                    // 앱 쪽 넘김이 반쯤 깨진 두 모습: 읽을 수 없는 쪽지, 가림막이 뜨지 못한 쪽지. 설치기는 쪽지 없는 옛 길처럼 창을 보이며 끝까지 간다
                    RunAutomaticFixture((string)Fixture["autoFailure"],false,false,"broken");
                    RunAutomaticFixture((string)Fixture["autoFailure"],false,false,"stale-curtain");
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
                // Every failing automatic-update check now writes a record named by
                // this fixture's AppId; remove only that file from the shared folder.
                string fixtureFailureRecord=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Diagnostics",Spec.AppId+".last-update-failure.json");
                try { if(File.Exists(fixtureFailureRecord))File.Delete(fixtureFailureRecord); }
                catch (Exception cleanupError) { Console.Error.WriteLine("Fixture cleanup: " + cleanupError.Message); }
            }
        }
    }

    private static InstallSpec ReadSpec()
    {
        using (var stream = File.OpenRead(FixtureJson))
            return (InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
    }
    // noteKind: null(쪽지 없음, 0.4.95 앱이 넘기는 길), "broken"(읽을 수 없는 쪽지), "stale-curtain"(가림막을 가리키지만 가림막이 뜨지 못한 쪽지).
    // 앱 쪽 넘김이 반쯤 깨져도 설치기는 창을 보이며 끝까지 간다(맡긴 세션 11-17 조건 1의 설치기 쪽)
    private static void RunAutomaticFixture(string wrapper,bool success,bool quiet=false,string noteKind=null)
    {
        Assert(IsInside(wrapper,Root),"Automatic wrapper escaped fixture root.");
        string nonce=System.Guid.NewGuid().ToString("N")+System.Guid.NewGuid().ToString("N"),hold=Path.Combine(Root,"auto-parent-"+nonce),launched=Path.Combine(Spec.InstallDirectory,"fixture-launched");
        if(File.Exists(launched))File.Delete(launched);
        using(var parent=Process.Start(new ProcessStartInfo(Path.Combine(Spec.InstallDirectory,Spec.ExecutableName),"--hold \""+hold+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden}))
        {
            WaitFor(delegate{return File.Exists(Path.Combine(hold,"ready"));},"Automatic parent did not become ready.");
            string handoffFolder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Handoff");
            string note=Path.Combine(handoffFolder,Spec.AppId+".handoff.json"),arrival=Path.Combine(handoffFolder,Spec.AppId+".arrival.json"),updating=Path.Combine(handoffFolder,Spec.AppId+".updating.json");
            if(File.Exists(arrival))File.Delete(arrival);
            if(quiet){Directory.CreateDirectory(handoffFolder);File.WriteAllText(note,"{\"schemaVersion\":1,\"token\":\""+nonce+"\",\"appPid\":"+parent.Id+",\"version\":\"0.0.2\",\"window\":0,\"x\":100,\"y\":100,\"width\":1440,\"height\":940,\"maximized\":false,\"visibility\":\"hidden\",\"quiet\":true,\"cut\":0.5,\"curtainEvent\":null,\"writtenAt\":\"2026-11-17T00:00:00.000Z\"}");}
            else if(noteKind=="broken"){Directory.CreateDirectory(handoffFolder);File.WriteAllText(note,"{\"schemaVersion\":1,\"token\":\""+nonce+"\",\"appPid\":"+parent.Id+",\"vers");}
            else if(noteKind=="stale-curtain"){Directory.CreateDirectory(handoffFolder);File.WriteAllText(note,"{\"schemaVersion\":1,\"token\":\""+nonce+"\",\"appPid\":"+parent.Id+",\"version\":\"0.0.2\",\"window\":0,\"watchWindow\":0,\"x\":100,\"y\":100,\"width\":1440,\"height\":940,\"maximized\":false,\"visibility\":\"front\",\"quiet\":false,\"cut\":0.5,\"curtainEvent\":\"Local\\\\SYNK.Curtain."+nonce.Substring(0,32)+"\",\"writtenAt\":\"2026-11-17T00:00:00.000Z\"}");}
            else Assert(noteKind==null,"Unknown handoff note kind: "+noteKind);
            var start=new ProcessStartInfo(wrapper,"--auto-update --wait-pid="+parent.Id+" --handoff-token="+nonce){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
            using(var child=Process.Start(start))
            {
                bool sawWindow=false;var watching=true;
                var watcher=new Thread(delegate(){while(watching){try{child.Refresh();if(!child.HasExited&&child.MainWindowHandle!=IntPtr.Zero)sawWindow=true;}catch(Exception){}Thread.Sleep(40);}}){IsBackground=true};
                watcher.Start();
                try
                {
                    var ready=child.StandardOutput.ReadLineAsync();
                    Assert(ready.Wait(30000)&&ready.Result=="SYNK_UPDATE_READY "+nonce,"Production installer did not acknowledge the live verified parent.");
                    Assert(!parent.HasExited,"Installer terminated the parent before normal exit.");
                    File.WriteAllText(Path.Combine(hold,"stop"),"fixture parent exits normally after READY");
                    Assert(parent.WaitForExit(5000),"Parent did not exit normally.");
                    string arguments=null;
                    WaitFor(delegate{try { if(!File.Exists(launched))return false;arguments=File.ReadAllText(launched);return true; }catch(IOException){return false;}},"Automatic installer did not finish its fixture launch receipt.",30000);
                    if(success) { Assert(arguments=="","Successful update used a startup bypass.");Assert(child.WaitForExit(10000),"Successful installer did not close itself.");Assert(child.ExitCode==0,"Successful installer failed.");
                        Assert(!File.Exists(updating),"The updating marker was left after the update.");
                        // 새 판을 켜기 전에 다 깎는다(0.4.96 검수 B1). 고치기 전에는 엔진이 끝나기 전에 쪽지를 써서 0.99 아래로 적혔다
                        double cut=ArrivalCut(arrival);Assert(cut>=0.999,"The arrival note was written before the carving finished: "+cut);
                        if(quiet){watching=false;Assert(!sawWindow,"Quiet update showed an installer window.");string text=File.ReadAllText(arrival);Assert(text.Contains("\"visibility\":\"hidden\"")&&text.Contains("\"kind\":\"updated\"")&&text.Contains("\"x\":100"),"Quiet arrival note: "+text);}
                        else Assert(sawWindow,"Visible update never showed its window."); }
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
                        Assert(!File.Exists(updating),"The updating marker was left after the restore.");
                        if(quiet){watching=false;Assert(!sawWindow,"Quiet restore showed an installer window.");string text=File.ReadAllText(arrival);Assert(text.Contains("\"visibility\":\"hidden\"")&&text.Contains("\"kind\":\"restored\"")&&text.Contains("\"version\":\"0.0.1\""),"Quiet restore arrival note: "+text);}
                        else Assert(sawWindow,"Visible restore never showed its window.");
                    }
                }
                finally
                {
                    watching=false;
                    if(File.Exists(note))File.Delete(note);if(File.Exists(arrival))File.Delete(arrival);
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
    private static void Progress(InstallProgress progress)
    {
        ProgressStages.Add(progress.Stage);
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
    private static void AssertRollbackStages(bool automatic)
    {
        var expected = automatic
            ? new [] { InstallStage.WaitingForApp, InstallStage.BackingUp, InstallStage.Preparing, InstallStage.Installing, InstallStage.Stopping, InstallStage.Restoring }
            : new [] { InstallStage.BackingUp, InstallStage.Preparing, InstallStage.Installing, InstallStage.Stopping, InstallStage.Restoring };
        int previous = -1;
        foreach (var stage in expected)
        {
            int index = ProgressStages.IndexOf(stage);
            Assert(index > previous, "Rollback progress phase missing or out of order: " + stage);
            previous = index;
        }
    }
    private static void Assert(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    private static Exception Caught(Action action)
    {
        try { action(); } catch (Exception error) { return error; }
        throw new InvalidOperationException("Operation unexpectedly succeeded.");
    }
    // 해요체로 끝나는 문장(「~해 주세요」는 창 문장도 쓰므로 뺀다)
    private static bool Haeyo(string text) { return System.Text.RegularExpressions.Regex.IsMatch(text ?? "", @"(?<!세)요(?=[.!?]?(\s|$))"); }
    // Platform 새 창의 기록 칸에 옮길 값이 꼭 이것뿐이고, 엔진의 해요체 문장이 하나도 없다(0.4.96 검수 F4)
    private static void AssertRecord(string engineMessage, string[] expected)
    {
        List<string> values = FailureValues.Of(engineMessage);
        Assert(values.SequenceEqual(expected), "Record values «" + String.Join(" | ", values) + "» expected «" + String.Join(" | ", expected) + "» from: " + engineMessage);
        Assert(!values.Any(Haeyo), "Record copied an engine sentence: " + String.Join(" | ", values));
    }
    private static double ArrivalCut(string file)
    {
        var data = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file));
        return Convert.ToDouble(data["cut"], System.Globalization.CultureInfo.InvariantCulture);
    }
    private static void ExpectFailure(Action action)
    {
        bool failed = false;
        try { action(); } catch (InvalidOperationException) { failed = true; } catch (IOException) { failed = true; } catch (ArgumentException) { failed = true; }
        Assert(failed, "Operation unexpectedly succeeded.");
    }
    private static void Check(string name, Action action)
    {
        // 검사마다 걸린 시간을 진행 파일에 적는다. 실행기가 시간 제한으로 이 시험을 끊어도 어디까지 왔는지 남는다
        var watch = Stopwatch.StartNew();
        try { action(); Checks.Add(new { name = name, ok = true, ms = watch.ElapsedMilliseconds }); }
        catch (Exception error) { Checks.Add(new { name = name, ok = false, ms = watch.ElapsedMilliseconds, error = error.Message }); Progress(name, watch, "FAIL"); throw; }
        Progress(name, watch, "ok");
    }
    private static void Progress(string name, Stopwatch watch, string result)
    {
        try { File.AppendAllText(Path.Combine(Root, "test-progress.txt"), result + "\t" + watch.ElapsedMilliseconds + "ms\t" + name + Environment.NewLine); } catch (Exception) { }
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
