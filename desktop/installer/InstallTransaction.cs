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
                throw new InstallFailure("지난번 설치를 되돌렸는지 아직 확인하지 못했어요. 다시 설치하지 말고 SYNK에 알려 주세요.\n되돌리기 안내: "+PendingPath,false,true);
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
            return new InstallFailure("설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요. 계정과 앱 기록은 그대로예요.\n되돌릴 원본: "+(backup==null?"생성 전":backup.Directory)+"\nSYNK에 이 내용을 알려 주세요.\n"+error.Message,false,!(error is InstallFailure)||((InstallFailure)error).BackendStopped);
        }
        public string Install(Action<InstallProgress> progress) { return InstallWithDeadline(progress,BackendProcess.DeadlineMilliseconds); }
        internal string InstallWithDeadline(Action<InstallProgress> progress,int deadline)
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
                throw new InstallFailure(error.Message+"\n"+(backup.DirectoryExisted?"이전 앱 파일·설치 등록·바로가기를 되돌렸어요.":"덜 설치된 파일·설치 등록·바로가기를 지웠어요.")+" 계정과 앱 기록은 그대로예요. 다시 해 보거나 닫아도 돼요.",true,true);
            }
        }
    }
}
