using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace Synk.SignalInstaller
{
    /// <summary>
    /// 앱이 끝나기 전에 쓰는 넘김 쪽지(검정 구 1-가 구현 설계 6절). 가림막과 설치기가 읽는다.
    /// 자리는 화면 화소다. 쪽지는 모양만 바꾼다. 읽지 못하면 쪽지가 없을 때처럼 간다(설치기는 화면 가운데에 뜨고 가림막도 없다).
    /// </summary>
    [DataContract]
    public sealed class HandoffNote
    {
        [DataMember(Name = "schemaVersion")] public int SchemaVersion;
        [DataMember(Name = "token")] public string Token;
        [DataMember(Name = "appPid")] public int AppPid;
        /// <summary>넘길 새 판 번호(설치기의 판과 같아야 한다)</summary>
        [DataMember(Name = "version")] public string Version;
        /// <summary>가림막을 그 아래에 놓을 앱 창의 핸들. 0이면 없다(보이는 창이 없던 때)</summary>
        [DataMember(Name = "window")] public long Window;
        /// <summary>닫히면 가림막의 60초 상한이 돌기 시작하는 창(주 창). 0이면 Window를 쓴다. 덮는 창은 먼저 닫히고 주 창은 초안 물음에 머물 수 있다</summary>
        [DataMember(Name = "watchWindow")] public long WatchWindow;
        [DataMember(Name = "x")] public int X;
        [DataMember(Name = "y")] public int Y;
        [DataMember(Name = "width")] public int Width;
        [DataMember(Name = "height")] public int Height;
        [DataMember(Name = "maximized")] public bool Maximized;
        /// <summary>front(맨 앞), behind(다른 창 뒤), minimized, hidden</summary>
        [DataMember(Name = "visibility")] public string Visibility;
        [DataMember(Name = "quiet")] public bool Quiet;
        /// <summary>앱 창의 마지막 장에서 깎인 만큼(웅장한 판, 받기가 끝나면 0.5)</summary>
        [DataMember(Name = "cut")] public double Cut;
        /// <summary>설치기가 첫 장을 그린 뒤 가림막에 끝나라고 알리는 이름 있는 이벤트</summary>
        [DataMember(Name = "curtainEvent")] public string CurtainEvent;
        [DataMember(Name = "writtenAt")] public string WrittenAt;

        public bool HasBounds { get { return Width >= 200 && Height >= 200 && Width <= 32768 && Height <= 32768 && Math.Abs((long)X) < 100000 && Math.Abs((long)Y) < 100000; } }
        public bool Behind { get { return Visibility == "behind"; } }
    }

    /// <summary>설치기가 새 앱이나 되돌린 앱을 켜기 바로 앞에 쓰는 도착 쪽지(6절). 새 앱이 읽고 지운다</summary>
    [DataContract]
    public sealed class ArrivalNote
    {
        [DataMember(Name = "schemaVersion")] public int SchemaVersion = 1;
        /// <summary>updated(새 판으로 바꿈), installed(처음 설치, 다시 설치), restored(되돌려 쓰던 판을 켬)</summary>
        [DataMember(Name = "kind")] public string Kind;
        [DataMember(Name = "installerPid")] public int InstallerPid;
        /// <summary>켜질 앱의 판 번호. 앱은 자기 판과 다르면 버린다</summary>
        [DataMember(Name = "version")] public string Version;
        [DataMember(Name = "x")] public int X;
        [DataMember(Name = "y")] public int Y;
        [DataMember(Name = "width")] public int Width;
        [DataMember(Name = "height")] public int Height;
        [DataMember(Name = "maximized")] public bool Maximized;
        [DataMember(Name = "visibility")] public string Visibility;
        /// <summary>설치기 창의 마지막 장(깎인 만큼과 빛). 새 앱의 첫 구가 여기서 이어진다</summary>
        [DataMember(Name = "cut")] public double Cut;
        [DataMember(Name = "lit")] public double Lit;
        [DataMember(Name = "writtenAt")] public string WrittenAt;
    }

    /// <summary>성공한 설치와 업데이트의 단계 시각(1-가 구현 설계 3절). 몇 판 뒤 이 값으로 단계 몫을 다시 맞춘다</summary>
    [DataContract]
    public sealed class StageTiming
    {
        [DataMember(Name = "at")] public string At;
        /// <summary>install(처음 설치), reinstall(다시 설치), update(자동 업데이트)</summary>
        [DataMember(Name = "kind")] public string Kind;
        [DataMember(Name = "version")] public string Version;
        /// <summary>단계 이름과 시작 시각(설치기가 일을 시작한 때부터 밀리초). 같은 단계가 다시 오면 처음 온 때만 적는다</summary>
        [DataMember(Name = "stages")] public System.Collections.Generic.List<StageMark> Stages = new System.Collections.Generic.List<StageMark>();
        [DataMember(Name = "totalMs")] public long TotalMs;
    }
    [DataContract]
    public sealed class StageMark
    {
        [DataMember(Name = "stage")] public string Stage;
        [DataMember(Name = "ms")] public long Ms;
    }

    /// <summary>
    /// 「바꾸는 중」 표시(1-가 구현 설계 2절 장치 1). READY 뒤 앱이 꺼지기를 기다릴 때부터 앱을 켜도 되는 때까지 Handoff\<appId>.updating.json을 쥔다.
    /// 그 사이 사람이 켠 앱은 이 표시를 보고 창 없이 요청만 남기고 끝난다. 박동은 내용을 다시 쓰지 않고 2초마다 파일 시각만 고친다.
    /// 쓰거나 고치다 난 실패는 모두 삼킨다(표시를 쓰지 못하면 장치 1만 꺼지고 장치 2와 3은 그대로 돈다)
    /// </summary>
    public sealed class UpdatingMarker
    {
        public const int BeatMilliseconds = 2000, StaleMilliseconds = 10000;
        readonly string file; readonly int pid; readonly object gate = new object();
        System.Threading.Timer beat; bool released;
        UpdatingMarker(string file, int pid) { this.file = file; this.pid = pid; }
        public string File { get { return file; } }

        /// <summary>표시를 쓰고 박동을 시작한다. 쓰지 못하면 null이다</summary>
        public static UpdatingMarker Hold(string appId, string product)
        {
            string temporary = null;
            try
            {
                int pid; using (Process self = Process.GetCurrentProcess()) pid = self.Id;
                string file = Handoff.MarkerFile(appId);
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                temporary = file + "." + Guid.NewGuid().ToString("N") + ".partial";
                string text = "{\"pid\":" + pid + ",\"product\":\"" + Regex.Replace(product ?? "", "[^a-z]", "") + "\",\"at\":\"" + DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture) + "\"}";
                using (FileStream stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { byte[] bytes = Encoding.UTF8.GetBytes(text); stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (System.IO.File.Exists(file)) System.IO.File.Replace(temporary, file, null, true); else System.IO.File.Move(temporary, file);
                temporary = null;
                UpdatingMarker marker = new UpdatingMarker(file, pid);
                marker.beat = new System.Threading.Timer(marker.Beat, null, BeatMilliseconds, BeatMilliseconds);
                return marker;
            }
            catch (Exception) { return null; }
            finally { if (temporary != null) try { System.IO.File.Delete(temporary); } catch (Exception) { } }
        }
        /// <summary>표시에 적힌 설치기 번호(둘째 설치기가 창 보이기 요청에 적는다). 없거나 못 읽으면 0</summary>
        public static int ReadPid(string appId)
        {
            try { Match m = Regex.Match(ReadShared(Handoff.MarkerFile(appId)), "\"pid\":(\\d{1,10})"); int value; return m.Success && Int32.TryParse(m.Groups[1].Value, out value) ? value : 0; }
            catch (Exception) { return 0; }
        }
        internal static string ReadShared(string path)
        {
            using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (StreamReader reader = new StreamReader(stream, Encoding.UTF8)) { char[] buffer = new char[Handoff.MaxBytes]; int count = reader.Read(buffer, 0, buffer.Length); return new string(buffer, 0, count); }
        }
        // 박동은 파일을 만들지 않는다. 파일이 없거나 남의 표시면 박동을 그만둔다. 타이머의 예외로 설치기가 죽지 않게 모두 삼킨다
        void Beat(object state)
        {
            lock (gate)
            {
                if (released) return;
                try { if (!Owned()) { StopBeat(); return; } System.IO.File.SetLastWriteTimeUtc(file, DateTime.UtcNow); }
                catch (Exception) { }
            }
        }
        void StopBeat() { try { if (beat != null) beat.Dispose(); } catch (Exception) { } beat = null; }
        // 자기 프로세스 번호가 담긴 표시에만 박동하고 지운다. 보이는 방식은 새 앱을 기다리기 전에 뮤텍스를 놓으므로 다음 설치기가 같은 이름의 표시를 쓸 수 있다
        bool Owned()
        {
            if (!System.IO.File.Exists(file)) return false;
            return Regex.IsMatch(ReadShared(file), "\"pid\":" + pid + "[,}]");
        }
        /// <summary>
        /// 놓는다(앱을 켜거나 창을 보이기 앞). 박동을 멈추고 돌던 박동이 끝난 것을 확인한 뒤 지우고, 없어진 것을 확인한다.
        /// 지우지 못하면 0.2초 간격으로 다섯 번 다시 지우고, 그래도 남으면 파일 시각을 10초보다 앞으로 고친다. 그것도 못 하면 시각이 10초를 넘길 때까지 기다린다.
        /// 앱은 10초 넘은 표시를 낡은 것으로 보므로, 어느 길이든 설치기가 켠 앱은 표시를 보지 않는다
        /// </summary>
        public void Release()
        {
            lock (gate) { if (released) return; released = true; StopBeat(); }
            try { if (!Owned()) return; } catch (Exception) { }
            for (int attempt = 0; attempt < 6; attempt++)
            {
                try { System.IO.File.Delete(file); } catch (Exception) { }
                if (!System.IO.File.Exists(file)) return;
                if (attempt < 5) Thread.Sleep(200);
            }
            try { System.IO.File.SetLastWriteTimeUtc(file, DateTime.UtcNow.AddSeconds(-30)); return; } catch (Exception) { }
            try { TimeSpan age = DateTime.UtcNow - System.IO.File.GetLastWriteTimeUtc(file), wait = TimeSpan.FromMilliseconds(StaleMilliseconds + 1000) - age; if (wait > TimeSpan.Zero) Thread.Sleep(wait); } catch (Exception) { }
        }
    }

    /// <summary>
    /// 창 보이기 요청(Handoff\<appId>.show-request). 바꾸는 동안 사람이 켠 앱이나 둘째 설치기가 쓰고, 도는 설치기가 0.5초마다 보고 창을 보인다.
    /// 자기 번호가 담긴 요청이나, 번호 칸이 빈 채 자기가 시작한 뒤에 생긴 요청만 받는다
    /// </summary>
    public static class ShowRequest
    {
        public static string File(string appId) { return Path.Combine(Handoff.Folder, appId + ".show-request"); }
        public static void Clear(string appId) { try { System.IO.File.Delete(File(appId)); } catch (Exception) { } }
        public static bool Take(string appId, int pid, DateTime sinceUtc)
        {
            try
            {
                string path = File(appId);
                if (!System.IO.File.Exists(path)) return false;
                string text = UpdatingMarker.ReadShared(path);
                Match m = Regex.Match(text, "\"pid\":(\\d{1,10}|null)");
                bool mine = m.Success && (m.Groups[1].Value == pid.ToString(System.Globalization.CultureInfo.InvariantCulture) || (m.Groups[1].Value == "null" && System.IO.File.GetLastWriteTimeUtc(path) >= sinceUtc.AddSeconds(-1)));
                if (!mine) return false;
                System.IO.File.Delete(path);
                return true;
            }
            catch (Exception) { return false; }
        }
        public static bool Write(string appId, int pid)
        {
            for (int attempt = 0; attempt < 6; attempt++)
            {
                try
                {
                    Directory.CreateDirectory(Handoff.Folder);
                    System.IO.File.WriteAllText(File(appId), "{\"pid\":" + (pid > 0 ? pid.ToString(System.Globalization.CultureInfo.InvariantCulture) : "null") + ",\"at\":\"" + DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture) + "\"}");
                    return true;
                }
                catch (Exception) { if (attempt < 5) Thread.Sleep(200); }
            }
            return false;
        }
    }

    public static class Handoff
    {
        public const int MaxBytes = 4096;
        static readonly Regex TokenPattern = new Regex("^[a-f0-9]{64}$");
        static readonly Regex VersionPattern = new Regex(@"^\d{1,6}\.\d{1,6}\.\d{1,6}$");
        static readonly Regex EventPattern = new Regex(@"^Local\\SYNK\.Curtain\.[a-f0-9]{32}$");
        static readonly Regex AppIdPattern = new Regex("^[A-Za-z0-9][A-Za-z0-9.-]{1,127}$");
        /// <summary>가림막 캐시 폴더의 이름 꼴. 주인 없는 것을 지울 때 이 꼴과 꼭 맞는 것만 지운다(2절 가림막 8번)</summary>
        static readonly Regex CurtainCachePattern = new Regex("^curtain-([1-9][0-9]{0,9})-[a-f0-9]{32}$");

        /// <summary>시험이 바꿔 끼운다. 지정하지 않으면 %LOCALAPPDATA%\SYNK\Installer</summary>
        public static string InstallerRoot;
        static string Root { get { return InstallerRoot ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SYNK", "Installer"); } }
        public static string Folder { get { return Path.Combine(Root, "Handoff"); } }
        public static string HandoffFile(string appId) { return Path.Combine(Folder, appId + ".handoff.json"); }
        public static string ArrivalFile(string appId) { return Path.Combine(Folder, appId + ".arrival.json"); }
        public static string MarkerFile(string appId) { return Path.Combine(Folder, appId + ".updating.json"); }

        /// <summary>
        /// 넘김 쪽지를 읽는다. 시각으로는 버리지 않는다. 앱 프로세스 번호(--wait-pid), 판 번호, 넘김 토큰이 모두 맞을 때만 돌려준다.
        /// 읽다가 틀리면 null이다(쪽지가 없을 때처럼 간다)
        /// </summary>
        public static HandoffNote ReadHandoff(string appId, string token, int appPid, string version)
        {
            try
            {
                if (!AppIdPattern.IsMatch(appId ?? "") || !TokenPattern.IsMatch(token ?? "")) return null;
                string file = HandoffFile(appId);
                FileInfo info = new FileInfo(file);
                if (!info.Exists || info.Length > MaxBytes || (info.Attributes & FileAttributes.ReparsePoint) != 0) return null;
                HandoffNote note;
                using (FileStream stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                    note = (HandoffNote)new DataContractJsonSerializer(typeof(HandoffNote)).ReadObject(stream);
                if (note == null || note.SchemaVersion != 1 || note.Token != token || (appPid > 0 && note.AppPid != appPid) || note.AppPid <= 0) return null;
                if (version != null && note.Version != version) return null;
                if (!VersionPattern.IsMatch(note.Version ?? "")) return null;
                if (note.Visibility != "front" && note.Visibility != "behind" && note.Visibility != "minimized" && note.Visibility != "hidden") return null;
                if (note.CurtainEvent != null && !EventPattern.IsMatch(note.CurtainEvent)) return null;
                if (Double.IsNaN(note.Cut) || note.Cut < 0 || note.Cut > 1) return null;
                return note;
            }
            catch (Exception) { return null; }
        }

        /// <summary>
        /// 도착 쪽지를 쓴다. 쪽지는 업데이트 결과를 바꾸지 않는다: 쓰다 난 실패는 모두 삼키고 false를 돌려준다(6절).
        /// 임시 파일에 쓴 뒤 바꿔치기한다
        /// </summary>
        public static bool WriteArrival(string appId, ArrivalNote note)
        {
            string temporary = null;
            try
            {
                if (!AppIdPattern.IsMatch(appId ?? "") || note == null) return false;
                note.SchemaVersion = 1;
                if (note.InstallerPid <= 0) using (Process self = Process.GetCurrentProcess()) note.InstallerPid = self.Id;
                if (String.IsNullOrEmpty(note.WrittenAt)) note.WrittenAt = DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
                Directory.CreateDirectory(Folder);
                string file = ArrivalFile(appId);
                temporary = file + "." + Guid.NewGuid().ToString("N") + ".partial";
                using (MemoryStream buffer = new MemoryStream())
                {
                    new DataContractJsonSerializer(typeof(ArrivalNote)).WriteObject(buffer, note);
                    if (buffer.Length > MaxBytes) return false;
                    using (FileStream stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { buffer.WriteTo(stream); stream.Flush(true); }
                }
                if (File.Exists(file)) File.Replace(temporary, file, null, true); else File.Move(temporary, file);
                temporary = null;
                return true;
            }
            catch (Exception) { return false; }
            finally { if (temporary != null) try { File.Delete(temporary); } catch (Exception) { } }
        }

        public static string TimingFile(string appId) { return Path.Combine(Root, "Timings", appId + ".json"); }
        /// <summary>
        /// 성공한 설치의 단계 시각을 최근 20회까지 남긴다. 쪽지처럼 결과를 바꾸지 않는다: 쓰다 난 실패는 모두 삼키고 false를 돌려준다(6절)
        /// </summary>
        public static bool WriteStageTiming(string appId, StageTiming timing)
        {
            string temporary = null;
            try
            {
                if (!AppIdPattern.IsMatch(appId ?? "") || timing == null) return false;
                if (String.IsNullOrEmpty(timing.At)) timing.At = DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
                string file = TimingFile(appId);
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                var serializer = new DataContractJsonSerializer(typeof(System.Collections.Generic.List<StageTiming>));
                var rows = new System.Collections.Generic.List<StageTiming>();
                try
                {
                    FileInfo info = new FileInfo(file);
                    if (info.Exists && info.Length < 256 * 1024)
                        using (FileStream stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                            rows = (System.Collections.Generic.List<StageTiming>)serializer.ReadObject(stream) ?? rows;
                }
                catch (Exception) { rows = new System.Collections.Generic.List<StageTiming>(); }
                rows.Add(timing);
                while (rows.Count > 20) rows.RemoveAt(0);
                temporary = file + "." + Guid.NewGuid().ToString("N") + ".partial";
                using (FileStream stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { serializer.WriteObject(stream, rows); stream.Flush(true); }
                if (File.Exists(file)) File.Replace(temporary, file, null, true); else File.Move(temporary, file);
                temporary = null;
                return true;
            }
            catch (Exception) { return false; }
            finally { if (temporary != null) try { File.Delete(temporary); } catch (Exception) { } }
        }

        /// <summary>가림막의 개인 캐시. 이름에 가림막의 프로세스 번호를 넣어, 앱이 끝낸 가림막의 캐시를 다음 가림막이나 설치기가 지울 수 있게 한다</summary>
        public static string CreateCurtainCache()
        {
            string parent = Path.Combine(Root, "Cache");
            Directory.CreateDirectory(parent);
            if ((new DirectoryInfo(parent).Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("설치 캐시 폴더를 확인하지 못했어요.");
            int pid; using (Process self = Process.GetCurrentProcess()) pid = self.Id;
            string directory = Path.Combine(parent, "curtain-" + pid + "-" + Guid.NewGuid().ToString("N"));
            DirectorySecurity security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new FileSystemAccessRule(WindowsIdentity.GetCurrent().User, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            Directory.CreateDirectory(directory, security);
            return directory;
        }

        /// <summary>
        /// Installer\Cache 아래에서 주인 프로세스가 없는 가림막 캐시를 지운다. 이름 꼴(curtain-&lt;번호&gt;-&lt;무작위&gt;)과 꼭 맞는 폴더만 본다.
        /// 거래 폴더(끝나지 않은 표시가 가리키는 되돌릴 원본)는 이름 꼴이 달라 건드리지 않는다. 실패는 삼킨다. 지운 수를 돌려준다
        /// </summary>
        public static int CleanupOrphanCurtainCaches()
        {
            int removed = 0;
            try
            {
                string parent = Path.Combine(Root, "Cache");
                if (!Directory.Exists(parent) || (new DirectoryInfo(parent).Attributes & FileAttributes.ReparsePoint) != 0) return 0;
                foreach (string directory in Directory.GetDirectories(parent))
                {
                    try
                    {
                        Match match = CurtainCachePattern.Match(Path.GetFileName(directory));
                        if (!match.Success) continue;
                        if ((new DirectoryInfo(directory).Attributes & FileAttributes.ReparsePoint) != 0) continue;
                        int owner;
                        if (!Int32.TryParse(match.Groups[1].Value, out owner) || Alive(owner)) continue;
                        Directory.Delete(directory, true);
                        removed++;
                    }
                    catch (Exception) { }
                }
            }
            catch (Exception) { }
            return removed;
        }

        static bool Alive(int pid)
        {
            try { using (Process process = Process.GetProcessById(pid)) return !process.HasExited; }
            catch (ArgumentException) { return false; }
            catch (Exception) { return true; }
        }

        /// <summary>
        /// 가림막 방식의 인자. --curtain이 있으면 다른 인자가 무엇이든 설치하지 않고 가림막만 그린다(2절 「판 사이의 차례」).
        /// --handoff-token= 하나만 쓰고 그 밖의 인자는 버린다. 토큰이 없거나 틀리면 null 토큰이다(쪽지를 읽지 않는다)
        /// </summary>
        public static bool IsCurtain(string[] args, out string token)
        {
            token = null;
            if (args == null || Array.IndexOf(args, "--curtain") < 0) return false;
            foreach (string value in args)
                if (value != null && value.StartsWith("--handoff-token=", StringComparison.Ordinal))
                {
                    string candidate = value.Substring(16);
                    token = TokenPattern.IsMatch(candidate) ? candidate : null;
                    break;
                }
            return true;
        }
    }
}
