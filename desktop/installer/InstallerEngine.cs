using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using Microsoft.Win32;

namespace Synk.SignalInstaller
{
    [DataContract]
    public sealed class InstallFile
    {
        [DataMember(Name="path")] public string Path;
        [DataMember(Name="sha256")] public string SHA256;
        [DataMember(Name="bytes")] public long Bytes;
    }
    [DataContract]
    public sealed class InstallSpec
    {
        [DataMember(Name="appId")] public string AppId;
        [DataMember(Name="version")] public string Version;
        [DataMember(Name="guid")] public string Guid;
        [DataMember(Name="installDirectory")] public string InstallDirectory;
        [DataMember(Name="executableName")] public string ExecutableName;
        [DataMember(Name="shortcutName")] public string ShortcutName;
        [DataMember(Name="backendSHA256")] public string BackendSHA256;
        [DataMember(Name="backendBytes")] public long BackendBytes;
        [DataMember(Name="minFreeBytes")] public long MinFreeBytes;
        [DataMember(Name="files")] public List<InstallFile> Files;
    }

    public sealed class InstallerEngine
    {
        readonly InstallSpec spec;
        readonly Func<Stream> backendFactory;
        string verifiedDirectory;
        string RegistryKey { get { return @"Software\" + spec.Guid; } }
        string UninstallKey { get { return @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + spec.Guid; } }

        public InstallerEngine(InstallSpec spec, Func<Stream> backendFactory)
        {
            this.spec = spec;
            this.backendFactory = backendFactory;
            System.Guid parsed;
            if (spec == null || !System.Guid.TryParse(spec.Guid, out parsed) || spec.Files == null || spec.Files.Count == 0 ||
                String.IsNullOrEmpty(spec.ExecutableName) || System.IO.Path.GetFileName(spec.ExecutableName) != spec.ExecutableName)
                throw new InvalidOperationException("설치 정보가 올바르지 않습니다. 설치 파일을 다시 받아 주세요.");
        }

        string ReadRegistry(RegistryHive hive, string key, string value)
        {
            using (RegistryKey root = Microsoft.Win32.RegistryKey.OpenBaseKey(hive, RegistryView.Registry64))
            using (RegistryKey item = root.OpenSubKey(key))
                return item == null ? null : item.GetValue(value) as string;
        }

        string ResolveDirectory()
        {
            string registered = ReadRegistry(RegistryHive.CurrentUser, RegistryKey, "InstallLocation");
            if (String.IsNullOrWhiteSpace(registered)) registered = spec.InstallDirectory;
            if (String.IsNullOrWhiteSpace(registered)) throw new InvalidOperationException("설치 위치를 확인할 수 없습니다.");
            return System.IO.Path.GetFullPath(Environment.ExpandEnvironmentVariables(registered)).TrimEnd('\\');
        }

        internal static void RejectReparsePoints(string path)
        {
            DirectoryInfo directory = new DirectoryInfo(path);
            while (directory != null)
            {
                if (directory.Exists && (directory.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("연결된 폴더에는 설치할 수 없습니다. 일반 폴더를 사용해 주세요.");
                directory = directory.Parent;
            }
        }

        public static string CreatePrivateCache()
        {
            string parent = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SYNK", "Installer", "Cache");
            RejectReparsePoints(parent);
            Directory.CreateDirectory(parent);
            string directory = System.IO.Path.Combine(parent, System.Guid.NewGuid().ToString("N"));
            DirectorySecurity security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new FileSystemAccessRule(WindowsIdentity.GetCurrent().User, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            Directory.CreateDirectory(directory, security);
            return directory;
        }

        public string Preflight()
        {
            if (!Environment.Is64BitOperatingSystem) throw new InvalidOperationException("Windows 64비트에서 설치할 수 있습니다.");
            Process[] running = Process.GetProcessesByName(System.IO.Path.GetFileNameWithoutExtension(spec.ExecutableName));
            try
            {
                if (running.Length != 0) throw new InvalidOperationException("SYNK가 실행 중입니다. 작업을 저장하고 SYNK를 닫은 뒤 다시 설치해 주세요.");
            }
            finally { foreach (Process p in running) p.Dispose(); }
            if (!String.IsNullOrWhiteSpace(ReadRegistry(RegistryHive.LocalMachine, RegistryKey, "InstallLocation")) ||
                !String.IsNullOrWhiteSpace(ReadRegistry(RegistryHive.LocalMachine, UninstallKey, "UninstallString")))
                throw new InvalidOperationException("모든 사용자용 SYNK가 설치되어 있습니다. 해당 설치를 정리한 뒤 현재 사용자용으로 설치해 주세요.");
            Version existing, incoming;
            string current = ReadRegistry(RegistryHive.CurrentUser, UninstallKey, "DisplayVersion");
            if (Version.TryParse(current, out existing) && Version.TryParse(spec.Version, out incoming) && existing > incoming)
                throw new InvalidOperationException("더 최신 버전이 설치되어 있습니다. 홈페이지에서 최신 설치 파일을 받아 주세요.");
            string directory = ResolveDirectory();
            RejectReparsePoints(directory);
            foreach (InstallFile item in spec.Files)
            {
                if (String.IsNullOrWhiteSpace(item.Path) || System.IO.Path.IsPathRooted(item.Path) ||
                    !System.IO.Path.GetFullPath(System.IO.Path.Combine(directory, item.Path.Replace('/', '\\'))).StartsWith(directory + "\\", StringComparison.OrdinalIgnoreCase))
                    throw new IOException("설치 파일 경로가 올바르지 않습니다.");
            }
            string root = System.IO.Path.GetPathRoot(directory);
            if (String.Equals(root.TrimEnd('\\'), directory, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("설치 위치가 올바르지 않습니다.");
            long required = spec.MinFreeBytes > 0 ? spec.MinFreeBytes : 3L * 1024 * 1024 * 1024;
            foreach (string drive in new HashSet<string>(new [] { root, System.IO.Path.GetPathRoot(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)), System.IO.Path.GetPathRoot(System.IO.Path.GetTempPath()) }, StringComparer.OrdinalIgnoreCase))
                if (new DriveInfo(drive).AvailableFreeSpace < required)
                    throw new IOException("설치할 공간이 부족합니다. 드라이브에 약 3 GB의 여유 공간을 확보해 주세요.");
            return directory;
        }

        public static string HashFile(string file)
        {
            using (FileStream input = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (SHA256 sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
        }

        public string Install(Action<string,string,int?> progress)
        {
            Preflight();
            string cache = CreatePrivateCache();
            try
            {
                string backend = System.IO.Path.Combine(cache, "setup.exe");
                progress("설치를 준비합니다", "설치 파일을 확인하고 있습니다.", 0);
                using (Stream source = backendFactory())
                using (FileStream target = new FileStream(backend, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    if (source == null) throw new IOException("설치 파일이 없습니다. 홈페이지에서 다시 받아 주세요.");
                    byte[] buffer = new byte[1024*1024];
                    long written = 0;
                    int count, last = -1;
                    while ((count = source.Read(buffer, 0, buffer.Length)) != 0)
                    {
                        target.Write(buffer, 0, count);
                        written += count;
                        int percent = (int)(written * 100 / Math.Max(1, spec.BackendBytes));
                        if (percent != last) { last = percent; progress("설치를 준비합니다", "설치 파일을 준비하고 있습니다.", Math.Min(100, percent)); }
                    }
                }
                // Keep a no-write/no-delete handle until the verified child has exited.
                using (FileStream held = new FileStream(backend, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    if (held.Length != spec.BackendBytes || !String.Equals(HashFile(backend), spec.BackendSHA256, StringComparison.OrdinalIgnoreCase))
                        throw new IOException("설치 파일 확인에 실패했습니다. 홈페이지에서 다시 받아 주세요.");
                    Preflight();
                    progress("SYNK를 설치합니다", "잠시만 기다려 주세요. 설치 중에는 창을 닫을 수 없습니다.", null);
                    ProcessStartInfo start = new ProcessStartInfo(backend, "/S /currentuser") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = cache };
                    using (Process child = Process.Start(start))
                    {
                        if (child == null) throw new IOException("설치를 시작할 수 없습니다.");
                        child.WaitForExit();
                        if (child.ExitCode == 20) throw new InvalidOperationException("SYNK가 실행 중이거나 실행 상태를 확인할 수 없습니다. SYNK를 닫고 다시 시도해 주세요.");
                        if (child.ExitCode != 0) throw new IOException("설치가 완료되지 않았습니다. 다시 시도해 주세요. (코드 " + child.ExitCode + ")");
                    }
                }
                return VerifyInstalled(progress);
            }
            finally
            {
                // Only this invocation's random, private extraction directory is removed.
                try { Directory.Delete(cache, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            }
        }

        public string VerifyInstalled() { return VerifyInstalled(delegate(string a, string b, int? c) { }); }
        string VerifyInstalled(Action<string,string,int?> progress)
        {
            string directory = ResolveDirectory();
            RejectReparsePoints(directory);
            if (String.IsNullOrWhiteSpace(ReadRegistry(RegistryHive.CurrentUser, RegistryKey, "InstallLocation")) ||
                ReadRegistry(RegistryHive.CurrentUser, UninstallKey, "DisplayVersion") != spec.Version)
                throw new IOException("설치 등록을 확인하지 못했습니다. 다시 설치해 주세요.");
            int done = 0;
            foreach (InstallFile item in spec.Files)
            {
                string file = System.IO.Path.GetFullPath(System.IO.Path.Combine(directory, item.Path.Replace('/', '\\')));
                if (!file.StartsWith(directory + "\\", StringComparison.OrdinalIgnoreCase)) throw new IOException("설치 파일 경로가 올바르지 않습니다.");
                FileInfo info = new FileInfo(file);
                if (!info.Exists || (info.Attributes & FileAttributes.ReparsePoint) != 0 || info.Length != item.Bytes ||
                    !String.Equals(HashFile(file), item.SHA256, StringComparison.OrdinalIgnoreCase))
                    throw new IOException("설치 파일을 확인하지 못했습니다: " + item.Path + ". 다시 설치해 주세요.");
                progress("설치를 확인합니다", "SYNK를 열기 전에 설치된 파일을 확인합니다.", ++done * 100 / spec.Files.Count);
            }
            string uninstall = ReadRegistry(RegistryHive.CurrentUser, UninstallKey, "UninstallString");
            string uninstallFile = null;
            if (!String.IsNullOrWhiteSpace(uninstall) && uninstall.StartsWith("\""))
            {
                int closing = uninstall.IndexOf('"', 1);
                if (closing > 1) uninstallFile = uninstall.Substring(1, closing - 1);
            }
            if (uninstallFile == null || !uninstallFile.StartsWith(directory + "\\", StringComparison.OrdinalIgnoreCase) || !File.Exists(uninstallFile))
                throw new IOException("제거 프로그램을 확인하지 못했습니다. 다시 설치해 주세요.");
            string shortcut = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), spec.ShortcutName + ".lnk");
            if (File.Exists(shortcut)) VerifyShortcut(shortcut, System.IO.Path.Combine(directory, spec.ExecutableName));
            verifiedDirectory = directory;
            return directory;
        }

        static void VerifyShortcut(string shortcut, string expected)
        {
            object shell = null, link = null;
            try
            {
                shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                link = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcut });
                string target = (string)link.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, link, null);
                if (!String.Equals(target, expected, StringComparison.OrdinalIgnoreCase)) throw new IOException("바로가기 확인에 실패했습니다. 다시 설치해 주세요.");
            }
            finally
            {
                if (link != null) Marshal.FinalReleaseComObject(link);
                if (shell != null) Marshal.FinalReleaseComObject(shell);
            }
        }

        public void Launch()
        {
            if (verifiedDirectory == null) throw new InvalidOperationException("설치 완료 후 SYNK를 열 수 있습니다.");
            string executable = System.IO.Path.Combine(verifiedDirectory, spec.ExecutableName);
            InstallFile expected = spec.Files.Find(delegate(InstallFile item) { return String.Equals(item.Path, spec.ExecutableName, StringComparison.OrdinalIgnoreCase); });
            if (expected == null || !String.Equals(HashFile(executable), expected.SHA256, StringComparison.OrdinalIgnoreCase))
                throw new IOException("SYNK 실행 파일을 확인하지 못했습니다. 다시 설치해 주세요.");
            Process.Start(new ProcessStartInfo(executable) { WorkingDirectory = verifiedDirectory, UseShellExecute = true });
        }
    }
}
