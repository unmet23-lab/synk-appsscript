using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace Synk.SignalInstaller
{
    [DataContract]
    internal sealed class InstalledIdentity
    {
        [DataMember(Name="clientId")] public string ClientId;
        [DataMember(Name="mode")] public string Mode;
        [DataMember(Name="appId")] public string AppId;
        [DataMember(Name="version")] public string Version;
        [DataMember(Name="platform")] public string Platform;
        [DataMember(Name="arch")] public string Arch;
    }

    public sealed class AutomaticUpdateSession : IDisposable
    {
        internal Process Parent;
        internal string Directory, Version, ExecutableSHA256, AsarSHA256, Nonce, InstallerSHA256;
        internal bool Used;
        public void Dispose() { if (Parent != null) { Parent.Dispose(); Parent = null; } }
    }

    public sealed class AutomaticUpdateResult
    {
        public bool Updated, Restored, Relaunched;
        public string Message, RecoveryFile;
    }

    [DataContract]
    internal sealed class BackupFile
    {
        [DataMember] public string RelativePath, SHA256;
        [DataMember] public long Bytes, LastWriteTicks;
        [DataMember] public int Attributes;
    }
    [DataContract]
    internal sealed class RegistryValueSnapshot
    {
        [DataMember] public string Name, Text;
        [DataMember] public int Kind, Integer;
        [DataMember] public long Long;
        [DataMember] public byte[] Binary;
        [DataMember] public string[] Strings;
    }
    [DataContract]
    internal sealed class RegistrySnapshot
    {
        [DataMember] public string Name;
        [DataMember] public bool Exists;
        [DataMember] public List<RegistryValueSnapshot> Values = new List<RegistryValueSnapshot>();
        [DataMember] public List<RegistrySnapshot> Children = new List<RegistrySnapshot>();
    }
    [DataContract]
    internal sealed class ShortcutSnapshot
    {
        [DataMember] public string Path, BackupPath, SHA256;
        [DataMember] public bool Exists;
    }
    [DataContract]
    internal sealed class UpdateBackup
    {
        [DataMember] public string Directory, OriginalDirectory, State;
        [DataMember] public bool DirectoryExisted;
        [DataMember] public List<BackupFile> Files;
        [DataMember] public List<RegistrySnapshot> Registry;
        [DataMember] public List<ShortcutSnapshot> Shortcuts;
    }
    [DataContract]
    internal sealed class RecoveryMarker
    {
        [DataMember(Name="schemaVersion")] public int SchemaVersion = 1;
        [DataMember(Name="appId")] public string AppId;
        [DataMember(Name="nonce")] public string Nonce;
        [DataMember(Name="fromVersion")] public string FromVersion;
        [DataMember(Name="toVersion")] public string ToVersion;
        [DataMember(Name="executablePath")] public string ExecutablePath;
        [DataMember(Name="executableSHA256")] public string ExecutableSHA256;
        [DataMember(Name="asarSHA256")] public string AsarSHA256;
        [DataMember(Name="installerSHA256")] public string InstallerSHA256;
        [DataMember(Name="createdAt")] public string CreatedAt;
        [DataMember(Name="expiresAt")] public string ExpiresAt;
        [DataMember(Name="status")] public string Status;
    }

    public sealed partial class InstallerEngine
    {
        [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
        struct ShortcutFindData
        {
            public uint Attributes;
            public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
            public uint SizeHigh, SizeLow, ReparseTag, Reserved;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string Name;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst=14)] public string AlternateName;
        }
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        static extern IntPtr FindFirstFileW(string path, out ShortcutFindData data);
        [DllImport("kernel32.dll")]
        static extern bool FindClose(IntPtr handle);

        // Cloud placeholders do not redirect a path like symlinks/junctions.
        // This exception is used only for this product's two known-folder links;
        // installation, backup, cache and recovery roots keep the strict guard.
        internal static bool IsCloudPlaceholderTag(uint tag) { return (tag & 0xffff0fffu) == 0x9000001au; }
        internal static void ValidateShortcutEntryAttributes(FileAttributes attributes, uint tag)
        {
            if ((attributes & FileAttributes.ReparsePoint) != 0 && !IsCloudPlaceholderTag(tag)) throw new IOException("바로가기 경로의 연결을 확인할 수 없습니다.");
        }
        string[] KnownShortcutPaths()
        {
            if (String.IsNullOrWhiteSpace(spec.ShortcutName) || Path.GetFileName(spec.ShortcutName) != spec.ShortcutName) throw new IOException("바로가기 이름이 올바르지 않습니다.");
            return new [] { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),spec.ShortcutName+".lnk"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),spec.ShortcutName+".lnk") };
        }
        internal void ValidateShortcutPath(string shortcut)
        {
            if (!KnownShortcutPaths().Any(known=>SamePath(known,shortcut))) throw new IOException("바로가기 위치가 올바르지 않습니다.");
            for (string current=Path.GetFullPath(shortcut); current!=null; )
            {
                FileAttributes attributes=0;
                try { attributes=File.GetAttributes(current); }
                catch (FileNotFoundException) { }
                catch (DirectoryNotFoundException) { }
                uint tag=0;
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                {
                    ShortcutFindData data; IntPtr handle=FindFirstFileW(current,out data);
                    if (handle == new IntPtr(-1)) throw new IOException("바로가기 경로의 연결 정보를 확인할 수 없습니다.");
                    try { tag=data.ReparseTag; }
                    finally { FindClose(handle); }
                }
                ValidateShortcutEntryAttributes(attributes,tag);
                DirectoryInfo parent=Directory.GetParent(current);current=parent==null?null:parent.FullName;
            }
        }
        static bool SamePath(string left, string right) { return String.Equals(Path.GetFullPath(left).TrimEnd('\\'), Path.GetFullPath(right).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase); }
        static T ReadJson<T>(string file) { using (var stream = File.OpenRead(file)) return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(stream); }
        static void WriteJson<T>(string file, T value) { using (var stream = new FileStream(file, FileMode.Create, FileAccess.Write, FileShare.None)) { new DataContractJsonSerializer(typeof(T)).WriteObject(stream, value); stream.Flush(true); } }
        static Version StrictVersion(string text)
        {
            Version version;
            if (text == null || !Regex.IsMatch(text, @"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$") || !Version.TryParse(text, out version)) throw new InvalidOperationException("앱 버전을 확인할 수 없습니다.");
            return version;
        }
        static string Inside(string root, string relative)
        {
            if (String.IsNullOrWhiteSpace(relative) || Path.IsPathRooted(relative)) throw new IOException("업데이트 파일 경로가 올바르지 않습니다.");
            string full = Path.GetFullPath(Path.Combine(root, relative.Replace('/', '\\')));
            if (!full.StartsWith(Path.GetFullPath(root).TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) throw new IOException("업데이트 파일 경로가 올바르지 않습니다.");
            return full;
        }
        static List<BackupFile> Inventory(string root)
        {
            var files = new List<BackupFile>();
            var pending = new Stack<string>(); pending.Push(root);
            while (pending.Count > 0)
            {
                string directory = pending.Pop(); RejectReparsePoints(directory);
                foreach (string child in System.IO.Directory.GetDirectories(directory)) { RejectReparsePoints(child); pending.Push(child); }
                foreach (string file in System.IO.Directory.GetFiles(directory))
                {
                    var info = new FileInfo(file);
                    if ((info.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("연결된 파일은 업데이트할 수 없습니다.");
                    files.Add(new BackupFile { RelativePath=file.Substring(root.TrimEnd('\\').Length + 1).Replace('\\','/'), Bytes=info.Length, SHA256=HashFile(file), LastWriteTicks=info.LastWriteTimeUtc.Ticks, Attributes=(int)info.Attributes });
                    if (files.Count > 100000) throw new IOException("설치 폴더의 파일 수를 확인해 주세요.");
                }
            }
            return files.OrderBy(item => item.RelativePath, StringComparer.Ordinal).ToList();
        }

        // This is deliberately stricter than an ordinary installation: a live,
        // registered copy at this product's configured per-user location is required.
        public AutomaticUpdateSession PrepareAutomaticUpdate(int parentPid, string nonce, string installerSHA256)
        {
            // An unresolved previous transaction must be rejected before READY,
            // while the caller still owns its normal quit/save decision.
            CheckPendingTransaction();
            if (parentPid <= 0 || parentPid == Process.GetCurrentProcess().Id || !Regex.IsMatch(nonce ?? "", "^[a-f0-9]{64}$") || !Regex.IsMatch(installerSHA256 ?? "", "^[a-f0-9]{64}$")) throw new ArgumentException("자동 업데이트 실행 정보를 확인할 수 없습니다.");
            if (!Regex.IsMatch(spec.AppId ?? "", "^[A-Za-z0-9][A-Za-z0-9.-]{1,127}$") || Path.GetFileName(spec.ShortcutName) != spec.ShortcutName) throw new InvalidOperationException("자동 업데이트 제품 정보가 올바르지 않습니다.");
            string registered = ReadRegistry(RegistryHive.CurrentUser, RegistryKey, "InstallLocation");
            string expected = Path.GetFullPath(Environment.ExpandEnvironmentVariables(spec.InstallDirectory));
            if (String.IsNullOrWhiteSpace(registered) || !SamePath(registered, expected) || !Directory.Exists(expected)) throw new InvalidOperationException("설치된 SYNK의 위치를 확인할 수 없습니다.");
            RejectReparsePoints(expected);
            var identity = ReadJson<InstalledIdentity>(Path.Combine(expected,"resources","synk-install.json"));
            string currentVersion = ReadRegistry(RegistryHive.CurrentUser, UninstallKey,"DisplayVersion");
            if (identity.AppId != spec.AppId || identity.ClientId != "platform" || identity.Mode != "development" || identity.Platform != "win32" || identity.Arch != "x64" || identity.Version != currentVersion || StrictVersion(spec.Version) <= StrictVersion(currentVersion)) throw new InvalidOperationException("설치된 앱과 업데이트 버전이 일치하지 않습니다.");
            if (!String.IsNullOrWhiteSpace(ReadRegistry(RegistryHive.LocalMachine, RegistryKey,"InstallLocation")) || !String.IsNullOrWhiteSpace(ReadRegistry(RegistryHive.LocalMachine,UninstallKey,"UninstallString"))) throw new InvalidOperationException("현재 사용자용 설치만 자동 업데이트할 수 있습니다.");
            string executable = Path.Combine(expected,spec.ExecutableName), archive = Path.Combine(expected,"resources","app.asar");
            RejectReparsePoints(Path.GetDirectoryName(archive));
            if ((File.GetAttributes(executable) & FileAttributes.ReparsePoint) != 0 || (File.GetAttributes(archive) & FileAttributes.ReparsePoint) != 0) throw new IOException("설치 파일 연결을 확인할 수 없습니다.");
            Process parent = Process.GetProcessById(parentPid);
            try
            {
                if (parent.HasExited || !SamePath(parent.MainModule.FileName,executable)) throw new InvalidOperationException("업데이트를 요청한 앱을 확인할 수 없습니다.");
                return new AutomaticUpdateSession { Parent=parent, Directory=expected.TrimEnd('\\'), Version=currentVersion, ExecutableSHA256=HashFile(executable), AsarSHA256=HashFile(archive), Nonce=nonce, InstallerSHA256=installerSHA256 };
            }
            catch { parent.Dispose(); throw; }
        }

        public AutomaticUpdateResult InstallAutomaticUpdate(AutomaticUpdateSession session, Action<string,string,int?> progress)
        {
            return InstallAutomaticUpdateCore(session, progress, InstallPayload, delegate(string executable,string arguments) {
                InstallFile incoming = spec.Files.Find(item => String.Equals(item.Path,spec.ExecutableName,StringComparison.OrdinalIgnoreCase));
                if(incoming==null)throw new IOException("업데이트 실행 파일 정보가 없습니다.");
                StartVerifiedProcess(executable,arguments,arguments.Length==0 ? incoming.SHA256 : session.ExecutableSHA256);
            });
        }

        internal AutomaticUpdateResult InstallAutomaticUpdateCore(AutomaticUpdateSession session, Action<string,string,int?> progress, Func<Action<string,string,int?>,string> install, Action<string,string> launch)
        {
            if (session == null || session.Used || session.Parent == null) throw new InvalidOperationException("자동 업데이트 요청은 한 번만 실행할 수 있습니다.");
            session.Used = true;
            progress("앱을 닫는 중", "저장된 작업을 확인하고 앱이 종료되기를 기다립니다.", null);
            if (!session.Parent.WaitForExit(60000)) throw new InvalidOperationException("SYNK가 아직 실행 중입니다. 작업을 저장하고 앱을 종료한 뒤 다시 시도해 주세요.");
            UpdateBackup backup = null;
            bool mutationStarted = false;
            try
            {
                VerifyPrevious(session);
                Preflight();
                backup = BackupPrevious(session, progress);
                BeginTransaction(backup);
                mutationStarted = true;
                install(progress);
                VerifyInstalled(progress);
                launch(Path.Combine(session.Directory,spec.ExecutableName),"");
                EndTransaction(backup,"updated");
                // Retain the compact transaction receipt. Verified old application
                // files are removed only from this invocation's private cache.
                TryCleanupBackupPayload(backup);
                return new AutomaticUpdateResult { Updated=true, Relaunched=true, Message="업데이트를 완료하고 앱을 다시 열었습니다." };
            }
            catch (Exception failure)
            {
                var unsafeFailure=failure as InstallFailure;
                if(unsafeFailure!=null&&(!unsafeFailure.BackendStopped||!unsafeFailure.CanRetry))
                    return new AutomaticUpdateResult { Message=backup==null?failure.Message:RecoveryRequired(backup,failure).Message };
                try
                {
                    if (mutationStarted) RestorePrevious(backup, progress);
                    VerifyPrevious(session);
                    string marker = WriteRecoveryMarker(session, mutationStarted ? "rolled-back" : "unchanged");
                    if (backup != null&&mutationStarted) EndTransaction(backup,"restored");
                    launch(Path.Combine(session.Directory,spec.ExecutableName),"--synk-update-recovery="+session.Nonce);
                    if (backup != null) TryCleanupBackupPayload(backup);
                    return new AutomaticUpdateResult { Restored=true, Relaunched=true, RecoveryFile=marker, Message="업데이트를 마치지 못해 이전 버전을 다시 열었습니다. 앱에서 다시 시도할 수 있습니다.\n"+failure.Message };
                }
                catch (Exception recoveryFailure)
                {
                    return new AutomaticUpdateResult { Message=RecoveryRequired(backup,recoveryFailure).Message };
                }
            }
        }

        void VerifyPrevious(AutomaticUpdateSession session)
        {
            if (!SamePath(ResolveDirectory(),session.Directory) || ReadRegistry(RegistryHive.CurrentUser,UninstallKey,"DisplayVersion") != session.Version || HashFile(Path.Combine(session.Directory,spec.ExecutableName)) != session.ExecutableSHA256 || HashFile(Path.Combine(session.Directory,"resources","app.asar")) != session.AsarSHA256) throw new IOException("이전 앱 상태를 확인할 수 없습니다.");
            var identity = ReadJson<InstalledIdentity>(Path.Combine(session.Directory,"resources","synk-install.json"));
            if (identity.AppId != spec.AppId || identity.Version != session.Version) throw new IOException("이전 앱의 설치 정보를 확인할 수 없습니다.");
        }

        UpdateBackup BackupPrevious(AutomaticUpdateSession session, Action<string,string,int?> progress)
        {
            progress("복구 파일을 준비합니다", "기존 앱과 설치 정보를 보존합니다.", 0);
            bool existed=Directory.Exists(session.Directory);
            var files = existed?Inventory(session.Directory):new List<BackupFile>();
            long bytes = files.Sum(item => item.Bytes), reserve = spec.MinFreeBytes > 0 ? spec.MinFreeBytes : 3L*1024*1024*1024;
            long required = checked(reserve + bytes + spec.BackendBytes + 16L*1024*1024);
            foreach (string drive in new HashSet<string>(new [] { Path.GetPathRoot(session.Directory),Path.GetPathRoot(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)),Path.GetPathRoot(Path.GetTempPath()) },StringComparer.OrdinalIgnoreCase))
                if (new DriveInfo(drive).AvailableFreeSpace < required) throw new IOException("자동 업데이트와 복구를 위한 여유 공간이 부족합니다. 기존 앱을 다시 엽니다.");
            var backup = new UpdateBackup { Directory=CreatePrivateCache(), OriginalDirectory=session.Directory, DirectoryExisted=existed, State="preparing", Files=files, Registry=new List<RegistrySnapshot>(), Shortcuts=new List<ShortcutSnapshot>() };
            using (var hive = Microsoft.Win32.RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))
                foreach (string key in new [] { RegistryKey,UninstallKey,"Software\\Classes\\AppUserModelId\\"+spec.AppId }) backup.Registry.Add(ReadRegistryTree(hive,key));
            WriteJson(Path.Combine(backup.Directory,"transaction.json"),backup);
            int done=0;
            foreach (var file in files)
            {
                string target=Inside(Path.Combine(backup.Directory,"application"),file.RelativePath); Directory.CreateDirectory(Path.GetDirectoryName(target)); File.Copy(Inside(session.Directory,file.RelativePath),target,false);
                if (HashFile(target)!=file.SHA256) throw new IOException("복구 파일 확인에 실패했습니다.");
                progress("복구 파일을 준비합니다","기존 앱을 보존합니다.",++done*100/files.Count);
            }
            foreach (string shortcut in KnownShortcutPaths())
            {
                ValidateShortcutPath(shortcut);
                var item = new ShortcutSnapshot { Path=shortcut, Exists=File.Exists(shortcut), BackupPath=Path.Combine(backup.Directory,"shortcut-"+backup.Shortcuts.Count+".lnk") };
                if (item.Exists) { VerifyShortcut(shortcut,Path.Combine(session.Directory,spec.ExecutableName)); item.SHA256=HashFile(shortcut); File.Copy(shortcut,item.BackupPath,false); if (HashFile(item.BackupPath)!=item.SHA256) throw new IOException("바로가기 보존에 실패했습니다."); }
                backup.Shortcuts.Add(item);
            }
            backup.State="prepared";WriteJson(Path.Combine(backup.Directory,"transaction.json"),backup);return backup;
        }

        void RestorePrevious(UpdateBackup backup, Action<string,string,int?> progress)
        {
            if (backup == null || activeTransaction!=backup.Directory) throw new IOException("복구 위치가 올바르지 않습니다.");
            var running=Process.GetProcessesByName(Path.GetFileNameWithoutExtension(spec.ExecutableName));try { if (running.Length!=0) throw new IOException("앱이 실행 중이어서 복구 파일을 보존했습니다. 앱을 닫아 주세요."); } finally { foreach (var process in running) process.Dispose(); }
            RejectReparsePoints(backup.OriginalDirectory);RejectReparsePoints(backup.Directory);
            foreach (var file in backup.Files) if (HashFile(Inside(Path.Combine(backup.Directory,"application"),file.RelativePath))!=file.SHA256) throw new IOException("복구 원본을 확인할 수 없습니다.");
            progress("이전 버전으로 복구합니다","앱 파일과 설치 정보를 되돌립니다.",null);
            var old = new HashSet<string>(backup.Files.Select(item=>item.RelativePath),StringComparer.OrdinalIgnoreCase);
            var permittedNew = new HashSet<string>(spec.Files.Select(item=>item.Path),StringComparer.OrdinalIgnoreCase); permittedNew.Add("Uninstall "+Path.GetFileNameWithoutExtension(spec.ExecutableName)+".exe");
            if (Directory.Exists(backup.OriginalDirectory)) foreach (var item in Inventory(backup.OriginalDirectory)) if (!old.Contains(item.RelativePath)) { if (!permittedNew.Contains(item.RelativePath)) throw new IOException("설치 폴더에 알 수 없는 파일이 있어 복구 원본을 보존했습니다."); File.Delete(Inside(backup.OriginalDirectory,item.RelativePath)); }
            foreach (var file in backup.Files) { string target=Inside(backup.OriginalDirectory,file.RelativePath);Directory.CreateDirectory(Path.GetDirectoryName(target));if(File.Exists(target))File.SetAttributes(target,FileAttributes.Normal);File.Copy(Inside(Path.Combine(backup.Directory,"application"),file.RelativePath),target,true);File.SetLastWriteTimeUtc(target,new DateTime(file.LastWriteTicks,DateTimeKind.Utc));File.SetAttributes(target,(FileAttributes)file.Attributes); }
            using (var hive=Microsoft.Win32.RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64)) foreach (var key in backup.Registry) { hive.DeleteSubKeyTree(key.Name,false); if(key.Exists)WriteRegistryTree(hive,key); }
            foreach(var shortcut in backup.Shortcuts) { ValidateShortcutPath(shortcut.Path);if(shortcut.Exists) { if(HashFile(shortcut.BackupPath)!=shortcut.SHA256)throw new IOException("바로가기 복구 원본을 확인할 수 없습니다.");Directory.CreateDirectory(Path.GetDirectoryName(shortcut.Path));File.Copy(shortcut.BackupPath,shortcut.Path,true); } else if(File.Exists(shortcut.Path)) File.Delete(shortcut.Path); }
            var restored=Directory.Exists(backup.OriginalDirectory)?Inventory(backup.OriginalDirectory):new List<BackupFile>();if(restored.Count!=backup.Files.Count||restored.Where((item,index)=>item.RelativePath!=backup.Files[index].RelativePath||item.SHA256!=backup.Files[index].SHA256).Any())throw new IOException("이전 앱 파일 복구를 확인할 수 없습니다.");
            if(!backup.DirectoryExisted&&Directory.Exists(backup.OriginalDirectory))RemoveEmptyDirectories(backup.OriginalDirectory);
            using(var hive=Microsoft.Win32.RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))foreach(var key in backup.Registry)if(RegistryDigest(ReadRegistryTree(hive,key.Name))!=RegistryDigest(key))throw new IOException("설치 등록 복구를 확인할 수 없습니다.");
            foreach(var shortcut in backup.Shortcuts)if(File.Exists(shortcut.Path)!=shortcut.Exists||shortcut.Exists&&HashFile(shortcut.Path)!=shortcut.SHA256)throw new IOException("바로가기 복구를 확인할 수 없습니다.");
        }

        static void RemoveEmptyDirectories(string root)
        {
            RejectReparsePoints(root);foreach(string child in Directory.GetDirectories(root))RemoveEmptyDirectories(child);
            if(Directory.GetFileSystemEntries(root).Length==0)Directory.Delete(root,false);
        }

        static RegistrySnapshot ReadRegistryTree(Microsoft.Win32.RegistryKey parent,string name)
        {
            var result=new RegistrySnapshot { Name=name };using(var key=parent.OpenSubKey(name)) { if(key==null)return result;result.Exists=true;
                foreach(string valueName in key.GetValueNames().OrderBy(value=>value,StringComparer.Ordinal)) { var value=new RegistryValueSnapshot { Name=valueName,Kind=(int)key.GetValueKind(valueName) };object raw=key.GetValue(valueName,null,RegistryValueOptions.DoNotExpandEnvironmentNames);switch((RegistryValueKind)value.Kind){case RegistryValueKind.String:case RegistryValueKind.ExpandString:value.Text=(string)raw;break;case RegistryValueKind.DWord:value.Integer=(int)raw;break;case RegistryValueKind.QWord:value.Long=(long)raw;break;case RegistryValueKind.MultiString:value.Strings=(string[])raw;break;case RegistryValueKind.Binary:case RegistryValueKind.None:value.Binary=(byte[])raw;break;default:throw new IOException("설치 등록을 보존할 수 없습니다.");}result.Values.Add(value); }
                foreach(string child in key.GetSubKeyNames().OrderBy(value=>value,StringComparer.Ordinal))result.Children.Add(ReadRegistryTree(key,child));
            }return result;
        }
        static void WriteRegistryTree(Microsoft.Win32.RegistryKey parent,RegistrySnapshot snapshot)
        {
            using(var key=parent.CreateSubKey(snapshot.Name)){foreach(var value in snapshot.Values){object raw;switch((RegistryValueKind)value.Kind){case RegistryValueKind.String:case RegistryValueKind.ExpandString:raw=value.Text;break;case RegistryValueKind.DWord:raw=value.Integer;break;case RegistryValueKind.QWord:raw=value.Long;break;case RegistryValueKind.MultiString:raw=value.Strings;break;default:raw=value.Binary;break;}key.SetValue(value.Name,raw,(RegistryValueKind)value.Kind);}foreach(var child in snapshot.Children)WriteRegistryTree(key,child);}
        }
        static string RegistryDigest(RegistrySnapshot snapshot) { using(var stream=new MemoryStream()){new DataContractJsonSerializer(typeof(RegistrySnapshot)).WriteObject(stream,snapshot);return Convert.ToBase64String(stream.ToArray());} }
        static void TryCleanupBackupPayload(UpdateBackup backup)
        {
            // The journal stays in the private cache for diagnosis; only paths
            // captured by this transaction are removed, never an app/profile tree.
            try {
                foreach(var file in backup.Files){string target=Inside(Path.Combine(backup.Directory,"application"),file.RelativePath);if(File.Exists(target))File.Delete(target);}
                foreach(var shortcut in backup.Shortcuts)if(File.Exists(shortcut.BackupPath))File.Delete(shortcut.BackupPath);
            } catch(IOException) { } catch(UnauthorizedAccessException) { }
        }
        string WriteRecoveryMarker(AutomaticUpdateSession session,string status)
        {
            string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Recovery");RejectReparsePoints(root);Directory.CreateDirectory(root);
            var security=new DirectorySecurity();security.SetAccessRuleProtection(true,false);var sid=WindowsIdentity.GetCurrent().User;security.SetOwner(sid);security.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));new DirectoryInfo(root).SetAccessControl(security);
            string destination=Path.Combine(root,spec.AppId+".json"),temporary=Path.Combine(root,session.Nonce+".tmp");DateTime now=DateTime.UtcNow;
            if(File.Exists(temporary))throw new IOException("복구 실행 정보가 이미 사용되었습니다.");
            WriteJson(temporary,new RecoveryMarker { AppId=spec.AppId,Nonce=session.Nonce,FromVersion=session.Version,ToVersion=spec.Version,ExecutablePath=Path.Combine(session.Directory,spec.ExecutableName),ExecutableSHA256=session.ExecutableSHA256,AsarSHA256=session.AsarSHA256,InstallerSHA256=session.InstallerSHA256,CreatedAt=now.ToString("o",CultureInfo.InvariantCulture),ExpiresAt=now.AddMinutes(10).ToString("o",CultureInfo.InvariantCulture),Status=status });
            if(File.Exists(destination))File.Replace(temporary,destination,null);else File.Move(temporary,destination);return destination;
        }
        void StartVerifiedProcess(string executable,string arguments,string expectedHash)
        {
            using(var held=new FileStream(executable,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                if(HashFile(executable)!=expectedHash)throw new IOException("다시 열 앱의 실행 파일을 확인하지 못했습니다.");
                Process child=Process.Start(new ProcessStartInfo(executable,arguments) { WorkingDirectory=Path.GetDirectoryName(executable),UseShellExecute=false });
                if(child==null)throw new IOException("앱을 다시 열 수 없습니다.");using(child){if(child.WaitForExit(2000)&&child.ExitCode!=0)throw new IOException("새 앱 실행을 완료하지 못했습니다.");}
            }
        }
    }
}
