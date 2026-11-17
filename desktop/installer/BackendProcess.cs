using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace Synk.SignalInstaller
{
    public sealed class InstallFailure : IOException
    {
        public readonly bool CanRetry, BackendStopped;
        public InstallFailure(string message, bool canRetry, bool backendStopped) : base(message)
        { CanRetry=canRetry; BackendStopped=backendStopped; }
    }

    /// <summary>
    /// 엔진의 실패 종류(검정 구 1-가 5절). 엔진 문장은 세 제품이 같이 쓰므로 바꾸지 않고, 던지는 자리에서 예외의 Data에 종류만 붙인다.
    /// Platform 새 창은 이 값으로 문장을 고른다. 시험(Tests.cs)이 엔진 문장을 Message.Contains로 맞추는 것은 그대로 둔다.
    /// </summary>
    public static class FailureKind
    {
        public const string Key = "synk.failure-kind";
        public const string NotX64 = "not-x64", AppRunning = "app-running", AllUsers = "all-users", Newer = "newer", Space = "space", Damaged = "damaged",
            Timeout = "timeout", AppStillRunning = "app-still-running", Restored = "restored",
            // 지난 설치가 끝나지 않은 표시가 남아 있다. 이번 실행은 아무것도 바꾸지 않았다
            Pending = "pending";
        public static T Tag<T>(T error, string kind) where T : Exception { try { error.Data[Key] = kind; } catch (Exception) { } return error; }
        public static string Of(Exception error)
        {
            for (Exception item = error; item != null; item = item.InnerException) {
                try { string kind = item.Data[Key] as string; if (kind != null) return kind; } catch (Exception) { }
            }
            return null;
        }
        public static void Copy(Exception from, Exception to) { string kind = Of(from); if (kind != null) Tag(to, kind); }
    }

    /// <summary>
    /// Platform 새 창의 기록 칸에 옮길 값(0.4.96 검수 F4). 엔진 문장은 세 제품이 같이 써서 해요체 그대로 두므로, 새 창은 기록 칸의 문장도 「~습니다」로
    /// 스스로 쓰고 엔진 글에서는 값만 옮긴다. 값은 되돌릴 원본과 되돌리기 안내의 경로, 확인하지 못한 파일, 설치 엔진의 끝 코드다.
    /// 엔진이 감싼 Windows의 글(「~니다」로 끝나거나 한글이 없는 줄)은 그대로 옮긴다. 엔진의 해요체 문장은 옮기지 않는다
    /// </summary>
    public static class FailureValues
    {
        static readonly Regex UncheckedFile = new Regex(@"확인하지 못했어요: (.+?)\. ");
        static readonly Regex ExitCode = new Regex(@"\(코드 (-?\d+)\)");
        static readonly Regex Gigabyte = new Regex(@"약 (\d+) GB");
        static readonly Regex Hangul = new Regex(@"[가-힣]");
        static readonly string[] PathLabels = { "되돌릴 원본: ", "되돌리기 안내: " };

        public static List<string> Of(string message)
        {
            List<string> values = new List<string>();
            if (String.IsNullOrEmpty(message)) return values;
            foreach (string raw in message.Split('\n')) {
                string line = raw.Trim();
                if (line.Length == 0) continue;
                bool labelled = false;
                foreach (string label in PathLabels) {
                    int at = line.IndexOf(label, StringComparison.Ordinal);
                    if (at >= 0) { Add(values, label + line.Substring(at + label.Length).Trim()); labelled = true; }
                }
                if (labelled) continue;
                Match file = UncheckedFile.Match(line + " ");
                if (file.Success) Add(values, "확인하지 못한 파일: " + file.Groups[1].Value);
                Match code = ExitCode.Match(line);
                if (code.Success) Add(values, "설치 엔진 코드: " + code.Groups[1].Value);
                if (!Hangul.IsMatch(line) || line.EndsWith("니다.", StringComparison.Ordinal) || line.EndsWith("니다", StringComparison.Ordinal)) Add(values, line);
            }
            return values;
        }
        /// <summary>공간이 모자랄 때 엔진이 적은 GB 수. 없으면 null</summary>
        public static string Gigabytes(string message)
        {
            Match m = Gigabyte.Match(message ?? "");
            return m.Success ? m.Groups[1].Value : null;
        }
        static void Add(List<string> values, string line) { if (!values.Contains(line)) values.Add(line); }
    }

    // The verified NSIS and every descendant belong to this job before the
    // first instruction runs. No PID-name killing or breakaway is permitted.
    internal static class BackendProcess
    {
        internal const int DeadlineMilliseconds = 10 * 60 * 1000;
        const uint Suspended=4, NoWindow=0x08000000, KillOnClose=0x2000;
        [StructLayout(LayoutKind.Sequential)] struct Limits { public long PerProcess, PerJob; public uint Flags; public UIntPtr Min, Max; public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling; }
        [StructLayout(LayoutKind.Sequential)] struct Counters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
        [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public Limits Basic; public Counters IO; public UIntPtr ProcessMemory,JobMemory,PeakProcess,PeakJob; }
        [StructLayout(LayoutKind.Sequential)] struct Accounting { public long User,Kernel,ThisUser,ThisKernel; public uint Faults,Total,Active,Terminated; }
        [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public int Size; public string Reserved,Desktop,Title; public uint X,Y,Width,Height,CharsX,CharsY,Fill,Flags; public short Show,Reserved2; public IntPtr ReservedPointer,Input,Output,Error; }
        [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process,Thread; public uint ProcessId,ThreadId; }
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimits value,int size);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting value,int size,IntPtr returned);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exitCode);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo info);
        [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
        [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

        static bool Empty(IntPtr job) { Accounting value; if(!QueryInformationJobObject(job,1,out value,Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero))throw new Win32Exception();return value.Active==0; }
        static bool Stop(IntPtr job)
        {
            TerminateJobObject(job,1460);
            var watch=Stopwatch.StartNew();
            do { try { if(Empty(job))return true; } catch(Win32Exception) { return false; } Thread.Sleep(50); } while(watch.ElapsedMilliseconds<15000);
            return false;
        }
        internal static int Run(string executable,string directory,int deadline,Action stopping)
        {
            if(deadline<=0)throw new ArgumentOutOfRangeException("deadline");
            IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero)throw new Win32Exception();
            ProcessInfo process=new ProcessInfo();bool assigned=false,finished=false;
            try
            {
                var limits=new ExtendedLimits();limits.Basic.Flags=KillOnClose;
                if(!SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(typeof(ExtendedLimits))))throw new Win32Exception();
                var startup=new Startup();startup.Size=Marshal.SizeOf(typeof(Startup));
                if(!CreateProcess(executable,new StringBuilder("\""+executable+"\" /S /currentuser"),IntPtr.Zero,IntPtr.Zero,false,Suspended|NoWindow,IntPtr.Zero,directory,ref startup,out process))throw new Win32Exception();
                if(!AssignProcessToJobObject(job,process.Process))throw new Win32Exception();
                assigned=true;
                if(ResumeThread(process.Thread)==UInt32.MaxValue)throw new Win32Exception();
                var watch=Stopwatch.StartNew();
                while(!Empty(job))
                {
                    if(watch.ElapsedMilliseconds>=deadline)
                    {
                        if(stopping!=null)stopping();
                        finished=Stop(job);
                        throw new InstallFailure("설치 제한 시간("+TimeSpan.FromMilliseconds(deadline).TotalMinutes.ToString("0.##",System.Globalization.CultureInfo.InvariantCulture)+"분)을 넘겼어요. "+(finished?"설치를 멈췄어요.":"설치가 끝났는지 확인하지 못했어요."),finished,finished);
                    }
                    Thread.Sleep(50);
                }
                finished=true;uint code;if(!GetExitCodeProcess(process.Process,out code))throw new Win32Exception();return unchecked((int)code);
            }
            catch(Exception error)
            {
                if(!finished&&assigned) { finished=Stop(job);if(!finished)throw new InstallFailure("설치가 끝났는지 확인하지 못해 되돌리기와 재시도를 멈췄어요.\n"+error.Message,false,false); }
                throw;
            }
            finally
            {
                if(process.Process!=IntPtr.Zero&&!assigned) { TerminateProcess(process.Process,1460);WaitForSingleObject(process.Process,15000); }
                if(process.Thread!=IntPtr.Zero)CloseHandle(process.Thread);
                if(process.Process!=IntPtr.Zero)CloseHandle(process.Process);
                CloseHandle(job);
            }
        }
    }
}
