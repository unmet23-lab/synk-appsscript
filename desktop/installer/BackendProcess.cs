using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Synk.SignalInstaller
{
    public sealed class InstallFailure : IOException
    {
        public readonly bool CanRetry, BackendStopped;
        public InstallFailure(string message, bool canRetry, bool backendStopped) : base(message)
        { CanRetry=canRetry; BackendStopped=backendStopped; }
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
                        throw new InstallFailure("설치 제한 시간("+TimeSpan.FromMilliseconds(deadline).TotalMinutes.ToString("0.##",System.Globalization.CultureInfo.InvariantCulture)+"분)을 넘겼습니다. "+(finished?"설치 작업을 중단했습니다.":"설치 작업의 종료를 확인하지 못했습니다."),finished,finished);
                    }
                    Thread.Sleep(50);
                }
                finished=true;uint code;if(!GetExitCodeProcess(process.Process,out code))throw new Win32Exception();return unchecked((int)code);
            }
            catch(Exception error)
            {
                if(!finished&&assigned) { finished=Stop(job);if(!finished)throw new InstallFailure("설치 작업의 종료를 확인하지 못했습니다. 복구와 재시도를 중단합니다.\n"+error.Message,false,false); }
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
