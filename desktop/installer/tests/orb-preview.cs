using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Threading;
using Synk.SignalInstaller;

// Platform 설치기 새 창(검정 구 1-가 ③)을 실제 화면에 띄워 장면마다 찍는다. 설치 엔진 없이 가짜 진행을 흘려 넣는다.
// GPU 판이 그대로 찍히도록 RenderTargetBitmap이 아니라 화면을 찍는다(창을 맨 위에 잠깐 띄운다).
// 쓰기: orb-preview.exe <글꼴 폴더> <나갈 폴더> <장면> [cpu]
//   장면: ready · reinstall · install40 · auto70 · restoring · fail-running · fail-recovery · launch-fail · auto-blocked · auto-still-running
internal static class OrbPreview
{
    [STAThread]
    private static int Main(string[] args)
    {
        string fonts = Path.GetFullPath(args[0]), output = Path.GetFullPath(args[1]), scene = args[2];
        if (args.Length > 3 && args[3] == "cpu") OrbStage.ForceCpu = true;
        Directory.CreateDirectory(output);
        Application app = new Application();
        OrbWindow window = new OrbWindow(fonts, "0.4.96", SignalProduct.Platform());
        window.Topmost = true;
        window.ShowActivated = false;
        bool installed = scene == "reinstall";
        window.SetInstalled(installed);
        List<KeyValuePair<double, Action>> steps = new List<KeyValuePair<double, Action>>();
        Action<double, Action> at = delegate(double ms, Action action) { steps.Add(new KeyValuePair<double, Action>(ms, action)); };
        MethodInfo onWay = typeof(OrbWindow).GetMethod("OnWay", BindingFlags.NonPublic | BindingFlags.Instance);
        double shot = 4200;
        switch (scene) {
            case "ready": case "reinstall": at(0, delegate { window.SetReady(); }); shot = 6800; break;
            case "install40":
                at(0, delegate { window.SetReady(); });
                at(4300, delegate { onWay.Invoke(window, null); window.ShowProgress(new InstallProgress(InstallStage.BackingUp, "", "", 0)); });
                at(4400, delegate { window.ShowProgress(new InstallProgress(InstallStage.Preparing, "", "", 100)); });
                at(4500, delegate { window.ShowProgress(new InstallProgress(InstallStage.Installing, "", "", null)); });
                shot = 8200; break;
            case "auto70":
                at(0, delegate { window.BeginAutomatic(); });
                at(200, delegate { window.ShowProgress(new InstallProgress(InstallStage.WaitingForApp, "", "", null)); });
                at(600, delegate { window.ShowProgress(new InstallProgress(InstallStage.BackingUp, "", "", 100)); });
                at(700, delegate { window.ShowProgress(new InstallProgress(InstallStage.Preparing, "", "", 0)); });
                shot = 2400; break;
            case "restoring":
                at(0, delegate { window.BeginAutomatic(); });
                at(300, delegate { window.ShowProgress(new InstallProgress(InstallStage.Restoring, "", "", null)); });
                shot = 2600; break;
            case "fail-running":
                at(0, delegate { window.SetReady(); });
                at(4300, delegate { onWay.Invoke(window, null); });
                at(4500, delegate { window.ShowInstallFailure(FailureKind.Tag(new InvalidOperationException("SYNK가 켜져 있어요."), FailureKind.AppRunning)); });
                shot = 7000; break;
            case "fail-recovery":
                at(0, delegate { window.SetReady(); });
                at(4300, delegate { onWay.Invoke(window, null); });
                at(4500, delegate { window.ShowInstallFailure(new InstallFailure("설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요. 계정과 앱 기록은 그대로예요.\n되돌릴 원본: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Cache\\example\nSYNK에 이 내용을 알려 주세요.", false, true)); });
                shot = 7000; break;
            case "launch-fail":
                at(0, delegate { window.BeginAutomatic(); });
                at(300, delegate { window.ShowLaunchFailure(new IOException("새 버전 앱을 열지 못했어요.")); });
                shot = 2800; break;
            case "auto-blocked":
                at(0, delegate { window.BeginAutomatic(); });
                at(200, delegate { window.ShowBlocked(new InstallFailure("지난번 설치를 되돌렸는지 아직 확인하지 못했어요. 다시 설치하지 말고 SYNK에 알려 주세요.\n되돌리기 안내: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Pending\\example.txt", false, true)); });
                shot = 2800; break;
            case "auto-still-running":
                at(0, delegate { window.BeginAutomatic(); });
                at(300, delegate { window.ShowAutomaticError(FailureKind.Tag(new InvalidOperationException("SYNK가 아직 켜져 있어요."), FailureKind.AppStillRunning)); });
                shot = 2800; break;
            default: Console.WriteLine("모르는 장면: " + scene); return 2;
        }
        at(shot, delegate {
            string file = Path.Combine(output, "installer-" + scene + (OrbStage.ForceCpu ? "-cpu" : "") + ".png");
            Capture(window, file);
            Console.WriteLine("PASS " + scene + " " + window.SceneName + " say=" + window.SayText + " | then=" + window.ThenText + " | " + window.Orb.Describe() + " -> " + file);
            window.CloseNow();
        });
        window.Loaded += delegate {
            DateTime start = DateTime.UtcNow;
            foreach (KeyValuePair<double, Action> step in steps) {
                KeyValuePair<double, Action> item = step;
                DispatcherTimer timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(Math.Max(1, item.Key)) };
                timer.Tick += delegate { timer.Stop(); item.Value(); };
                timer.Start();
            }
        };
        app.Run(window);
        return 0;
    }

    static void Capture(Window window, string file)
    {
        PresentationSource source = PresentationSource.FromVisual(window);
        double k = source.CompositionTarget.TransformToDevice.M11;
        int x = (int)Math.Round(window.Left * k), y = (int)Math.Round(window.Top * k), w = (int)Math.Round(window.ActualWidth * k), h = (int)Math.Round(window.ActualHeight * k);
        using (var bitmap = new System.Drawing.Bitmap(w, h))
        using (var g = System.Drawing.Graphics.FromImage(bitmap)) {
            g.CopyFromScreen(x, y, 0, 0, new System.Drawing.Size(w, h));
            bitmap.Save(file, System.Drawing.Imaging.ImageFormat.Png);
        }
    }
}
