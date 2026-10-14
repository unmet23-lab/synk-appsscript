using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.Serialization.Json;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using Synk.SignalInstaller;
class Measure
{
    static int Main(string[] args)
    {
        InstallSpec spec;using(var stream=File.OpenRead(args[0]))spec=(InstallSpec)new DataContractJsonSerializer(typeof(InstallSpec)).ReadObject(stream);
        string root=Path.GetDirectoryName(args[0]),key="Software\\"+spec.Guid,uninstall="Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"+spec.Guid;
        bool existing=args.Length==3&&args[2]=="--reinstall-existing-fixture";
        if(!spec.AppId.StartsWith("im.synk.signal.measure.")||!spec.ExecutableName.StartsWith("SYNKSignalMeasure")||!spec.InstallDirectory.StartsWith(root+"\\")||Directory.Exists(spec.InstallDirectory)&&!existing)throw new Exception("Unsafe measurement fixture");
        if(existing)new InstallerEngine(spec,delegate{return File.OpenRead(args[1]);}).VerifyInstalled();
        long expectedBytes=spec.MinFreeBytes+spec.BackendBytes;foreach(var file in spec.Files)expectedBytes=checked(expectedBytes+file.Bytes);
        if(new DriveInfo(Path.GetPathRoot(root)).AvailableFreeSpace<expectedBytes)throw new Exception("Insufficient space before isolated installation");
        var runs=new List<object>();string sentinel=Path.Combine(root,"account-sentinel.txt");File.WriteAllText(sentinel,"synthetic independent profile");string digest=InstallerEngine.HashFile(sentinel);
        bool bootstrapped=false;
        if(String.IsNullOrEmpty(spec.Guid))
        {
            // Recover an already-built fixture whose build was interrupted only
            // while writing its unused blockmap. /D is confined to this fixture.
            if(InstallerEngine.HashFile(args[1])!=spec.BackendSHA256)throw new Exception("Backend pin differs");
            var clock=Stopwatch.StartNew();
            using(var process=Process.Start(new ProcessStartInfo(args[1],"/S /currentuser /D="+spec.InstallDirectory){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden}))
            { if(!process.WaitForExit(600000))throw new Exception("Isolated measurement backend did not exit; no rollback or retry attempted");if(process.ExitCode!=0)throw new Exception("Isolated initial installation failed"); }
            using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))using(var parent=hive.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"))
                foreach(string name in parent.GetSubKeyNames())using(var entry=parent.OpenSubKey(name))if((string)entry.GetValue("DisplayName")==spec.ShortcutName||(string)entry.GetValue("DisplayName")==spec.ShortcutName+" "+spec.Version) { if(spec.Guid!=null)throw new Exception("Duplicate measurement identity");spec.Guid=name; }
            Guid parsed;if(!Guid.TryParse(spec.Guid,out parsed))throw new Exception("Fixture GUID missing");
            key="Software\\"+spec.Guid;uninstall="Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"+spec.Guid;
            using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))using(var entry=hive.OpenSubKey(key))if(entry==null||(string)entry.GetValue("InstallLocation")!=spec.InstallDirectory)throw new Exception("Fixture path differs");
            new InstallerEngine(spec,delegate{return File.OpenRead(args[1]);}).VerifyInstalled();
            using(var stream=File.Create(args[0]))new DataContractJsonSerializer(typeof(InstallSpec)).WriteObject(stream,spec);
            runs.Add(new {kind="fresh-direct-isolated-NSIS",totalMilliseconds=clock.ElapsedMilliseconds,payloadFiles=spec.Files.Count,payloadVerified=true,profileSentinelUnchanged=digest==InstallerEngine.HashFile(sentinel)});bootstrapped=true;
        }
        else if(!existing)using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64))using(var entry=hive.CreateSubKey(key))entry.SetValue("InstallLocation",spec.InstallDirectory);
        bool success=false;
        try
        {
            for(int i=bootstrapped?1:0;i<2;i++)
            {
                var engine=new InstallerEngine(spec,delegate{return File.OpenRead(args[1]);});var total=Stopwatch.StartNew();long backendStart=0,backendEnd=0;
                engine.Install(delegate(string title,string detail,int? percent){if(title=="SYNK 측정를 설치합니다")backendStart=total.ElapsedMilliseconds;if(backendEnd==0&&title=="설치를 확인합니다")backendEnd=total.ElapsedMilliseconds;});
                long elapsed=total.ElapsedMilliseconds;engine.VerifyInstalled();
                if(digest!=InstallerEngine.HashFile(sentinel))throw new Exception("Profile sentinel changed");
                runs.Add(new {kind=i==0&&!existing?"fresh":"reinstall",totalMilliseconds=elapsed,backendAndFirstVerificationMilliseconds=backendEnd-backendStart,payloadFiles=spec.Files.Count,payloadVerified=true,profileSentinelUnchanged=true});
            }
            success=true;
        }
        finally
        {
            string executable=Path.Combine(spec.InstallDirectory,"Uninstall "+Path.GetFileNameWithoutExtension(spec.ExecutableName)+".exe");
            if(File.Exists(executable))using(var process=Process.Start(new ProcessStartInfo(executable,"/S /currentuser /KEEP_APP_DATA _?="+spec.InstallDirectory){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden})){if(!process.WaitForExit(120000)||process.ExitCode!=0)throw new Exception("Measurement cleanup failed");}
            using(var hive=RegistryKey.OpenBaseKey(RegistryHive.CurrentUser,RegistryView.Registry64)){using(var entry=hive.OpenSubKey(uninstall))if(entry!=null)throw new Exception("Measurement registration remains");hive.DeleteSubKeyTree(key,false);hive.DeleteSubKeyTree("Software\\Classes\\AppUserModelId\\"+spec.AppId,false);}
            var report=new {ok=success,checkedAt=DateTime.UtcNow.ToString("o"),deadlineMilliseconds=BackendProcess.DeadlineMilliseconds,runs=runs,accountSentinelUnchanged=digest==InstallerEngine.HashFile(sentinel),fixtureRegistrationRemoved=true};
            File.WriteAllText(Path.Combine(root,"measurement.json"),new JavaScriptSerializer().Serialize(report));
        }
        return success?0:1;
    }
}
