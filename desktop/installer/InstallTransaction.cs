using System;
using System.IO;

namespace Synk.SignalInstaller
{
    public sealed partial class InstallerEngine
    {
        string activeTransaction;
        string PendingPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SYNK","Installer","Pending",spec.Guid+".txt"); }
        }
        void CheckPendingTransaction()
        {
            RejectReparsePoints(Path.GetDirectoryName(PendingPath));
            if(File.Exists(PendingPath)&&activeTransaction==null)
                throw new InstallFailure("이전 설치의 복구 확인이 필요합니다. 다시 설치하지 말고 지원을 요청해 주세요.\n복구 안내: "+PendingPath,false,true);
        }
        void BeginTransaction(UpdateBackup backup)
        {
            CheckPendingTransaction();
            Directory.CreateDirectory(Path.GetDirectoryName(PendingPath));
            backup.State="installing";WriteJson(Path.Combine(backup.Directory,"transaction.json"),backup);
            try
            {
                using(var stream=new FileStream(PendingPath,FileMode.CreateNew,FileAccess.Write,FileShare.Read))
                { byte[] bytes=System.Text.Encoding.UTF8.GetBytes(backup.Directory);stream.Write(bytes,0,bytes.Length);stream.Flush(true); }
                activeTransaction=backup.Directory;
            }
            catch(Exception error) { if(File.Exists(PendingPath))throw RecoveryRequired(backup,error);throw; }
        }
        void EndTransaction(UpdateBackup backup,string state)
        {
            backup.State=state;WriteJson(Path.Combine(backup.Directory,"transaction.json"),backup);
            if(activeTransaction==backup.Directory&&File.ReadAllText(PendingPath)==backup.Directory)File.Delete(PendingPath);
            activeTransaction=null;
        }
        InstallFailure RecoveryRequired(UpdateBackup backup,Exception error)
        {
            if(backup!=null) { backup.State="recovery-required";try { WriteJson(Path.Combine(backup.Directory,"transaction.json"),backup); }catch(IOException){} }
            if(backup!=null&&!File.Exists(PendingPath))
                try { using(var writer=new StreamWriter(new FileStream(PendingPath,FileMode.CreateNew,FileAccess.Write,FileShare.Read)))writer.Write(backup.Directory); }catch(IOException){}
            activeTransaction=null;
            return new InstallFailure("설치가 끝나지 않았습니다. 앱 파일이 일부 바뀐 상태일 수 있어 재시도를 막았습니다. 계정·사용자 기록은 건드리지 않았습니다.\n복구 원본: "+(backup==null?"생성 전":backup.Directory)+"\n지원에 이 내용을 알려 주세요.\n"+error.Message,false,!(error is InstallFailure)||((InstallFailure)error).BackendStopped);
        }
        public string Install(Action<string,string,int?> progress) { return InstallWithDeadline(progress,BackendProcess.DeadlineMilliseconds); }
        internal string InstallWithDeadline(Action<string,string,int?> progress,int deadline)
        {
            string directory=Preflight();UpdateBackup backup=null;bool started=false;
            try
            {
                backup=BackupPrevious(new AutomaticUpdateSession { Directory=directory },progress);
                BeginTransaction(backup);started=true;
                string result=InstallPayload(progress,deadline);
                EndTransaction(backup,"installed");TryCleanupBackupPayload(backup);return result;
            }
            catch(Exception error)
            {
                if(!started)throw;
                var failure=error as InstallFailure;
                if(failure!=null&&!failure.BackendStopped)throw RecoveryRequired(backup,error);
                try
                {
                    RestorePrevious(backup,progress);
                    EndTransaction(backup,"restored");TryCleanupBackupPayload(backup);
                }
                catch(Exception recoveryError) { throw RecoveryRequired(backup,recoveryError); }
                throw new InstallFailure(error.Message+"\n"+(backup.DirectoryExisted?"이전 앱 파일·설치 등록·바로가기를 복구했습니다.":"부분 설치 파일·설치 등록·바로가기를 정리했습니다.")+" 계정·사용자 기록은 그대로입니다. 다시 시도하거나 닫아도 됩니다.",true,true);
            }
        }
    }
}
