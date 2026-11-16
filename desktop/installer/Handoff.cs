using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

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
