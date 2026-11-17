using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shell;
using Synk.SignalInstaller;

// 설치 창을 상태별로 1·1.5·2배 PNG로 찍고, 글꼴 대체·닫기 막기·설치/열기 이벤트를 확인한다(10-12 도구를 signal.2 창에 맞춤).
// 진행·실패 글은 설치 엔진이 실제로 띄우는 글을 그대로 쓴다(10-22 해요체 글에 맞춤 — 엔진 글을 바꾸면 여기도 바꾼다).
// 셋째 인자로 제품(platform·world·messenger, 기본 platform)을 고른다. 파일은 ui-<제품>-<상태>-<배율>.png.
// 사용법은 ../README.md 「Check the window」.
internal static class SignalUiCheck
{
    const double W = 760, H = 512;

    [STAThread]
    private static int Main(string[] args)
    {
        try {
            string fonts = Path.GetFullPath(args[0]);
            string output = Path.GetFullPath(args[1]);
            Directory.CreateDirectory(output);
            Application app = new Application();
            SignalProduct product = SignalProduct.ById(args.Length > 2 ? args[2] : "platform");
            // Platform은 검정 구 새 창이다(검정 구 1-가 ③). WORLD와 Workspace는 아래 지금 창 그대로 검사한다
            if (product.Id == "platform") return PlatformCheck(fonts, output, product);
            string version = "0.4.11";
            string folder = product.Id == "world" ? "SYNKWorldPreview" : product.Id == "messenger" ? "SYNKMessengerPreview" : "SYNKPlatformPreview";
            SignalWindow window = new SignalWindow(fonts, version, product);
            window.SetInstallLocation(@"C:\Users\Example\AppData\Local\Programs\" + folder, (product.Id == "platform" ? 3L : 1L) * 1024 * 1024 * 1024);
            FrameworkElement surface = (FrameworkElement)window.Content;
            HashSet<string> renderedFonts = new HashSet<string>();
            Action<string> render = delegate(string state) {
                surface.Measure(new Size(W, H));
                surface.Arrange(new Rect(0, 0, W, H));
                surface.UpdateLayout();
                foreach (double scale in new double[] { 1, 1.5, 2 }) {
                    RenderTargetBitmap bitmap = new RenderTargetBitmap((int)(W * scale), (int)(H * scale), 96 * scale, 96 * scale, PixelFormats.Pbgra32);
                    bitmap.Render(surface);
                    PngBitmapEncoder encoder = new PngBitmapEncoder();
                    encoder.Frames.Add(BitmapFrame.Create(bitmap));
                    string path = Path.Combine(output, "ui-" + product.Id + "-" + state + "-" + (int)(scale * 100) + ".png");
                    using (FileStream file = File.Create(path)) encoder.Save(file);
                }
                CollectFonts(surface, renderedFonts);
                Console.WriteLine("PASS: " + state);
            };
            FieldInfo started = typeof(SignalWindow).GetField("stepStarted", BindingFlags.NonPublic | BindingFlags.Instance);
            MethodInfo meter = typeof(SignalWindow).GetMethod("UpdateMeter", BindingFlags.NonPublic | BindingFlags.Instance);
            window.SetReady(); render("ready");
            window.SetInstalled(true); render("reinstall");
            window.SetInstalled(false);
            window.ShowProgress(new InstallProgress(InstallStage.Preparing, "설치를 준비해요", "설치할 수 있는지 확인해요.", null)); render("prepare");
            CheckButtons(surface, false);
            window.ShowProgress(new InstallProgress(InstallStage.Preparing, "설치를 준비해요", "설치 파일을 준비하고 있어요.", 64)); render("prepare-64");
            window.ShowProgress(new InstallProgress(InstallStage.Installing, product.ShortName + "를 설치해요", "잠시만 기다려 주세요. 설치하는 동안에는 창을 닫을 수 없어요.", null));
            started.SetValue(window, DateTime.UtcNow.AddSeconds(-42)); meter.Invoke(window, null); render("install-42s");
            window.ShowProgress(new InstallProgress(InstallStage.Verifying, "설치를 확인해요", product.ShortName + "를 열기 전에 설치된 파일을 확인해요.", 80)); render("verify-80");
            CheckButtons(surface, false);
            window.ShowComplete(); render("complete");
            CheckButtons(surface, true);
            window.ShowFailure(product.ShortName + "가 켜져 있어요.\n작업을 저장하고 " + product.ShortName + "를 닫은 뒤 다시 설치해 주세요."); render("failure");
            CheckButtons(surface, true);
            window.ShowFailure("설치된 파일을 확인하지 못했어요: resources/app.asar. 다시 설치해 주세요. 설치 파일이 손상됐을 수 있으니 synk.im에서 다시 받은 뒤 열어 주세요. (코드 2)"); render("failure-long");
            window.ShowFailure("설치 제한 시간(10분)을 넘겼어요. 설치를 멈췄어요.\n이전 앱 파일·설치 등록·바로가기를 되돌렸어요. 계정과 앱 기록은 그대로예요. 다시 해 보거나 닫아도 돼요."); render("timeout-restored");
            if(FindButton(surface,"다시 시도")==null||FindButton(surface,"닫기")==null)throw new Exception("Timeout retry/close missing");
            window.ShowFailure("설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요. 계정과 앱 기록은 그대로예요.\n되돌릴 원본: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Cache\\example\nSYNK에 이 내용을 알려 주세요.",false); render("timeout-recovery-required");
            if(FindButton(surface,"다시 시도")!=null)throw new Exception("Unsafe recovery exposed retry");
            window.ShowProgress(new InstallProgress(InstallStage.Restoring,"이전 버전으로 되돌려요","앱 파일과 설치 정보를 되돌려요.",null));render("restoring");
            window.ShowAutomaticFailure("설치된 앱과 업데이트 버전이 맞지 않아요.",true);render("automatic-failure");
            if(FindButton(surface,"다시 시도")!=null)throw new Exception("Automatic failure exposed retry");
            window.ShowAutomaticFailure("설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요. 계정과 앱 기록은 그대로예요.\n되돌릴 원본: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Cache\\example\nSYNK에 이 내용을 알려 주세요.",false);render("automatic-recovery-required");
            if(FindButton(surface,"다시 시도")!=null)throw new Exception("Automatic recovery exposed retry");
            window.SetInstalled(true);
            window.SetReady();
            int installed = 0, launched = 0;
            window.InstallRequested += delegate { installed++; };
            window.LaunchRequested += delegate { launched++; };
            FindButton(surface, "다시 설치하기").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            if (installed != 1) throw new Exception("InstallRequested event not emitted");
            CheckButtons(surface, false);
            window.ShowComplete();
            FindButton(surface, product.LaunchLabel).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            if (launched != 1) throw new Exception("LaunchRequested event not emitted");
            window.SetReady();
            Console.WriteLine("PASS: install/launch event dispatch and installation close-button guard");
            // 점은 엔진 단계로만 고른다 — 제목 글이 달라도 같은 점, 되돌리기는 지금 점을 두고 엔진 글을 그대로.
            FieldInfo stepField = typeof(SignalWindow).GetField("step", BindingFlags.NonPublic | BindingFlags.Instance);
            FieldInfo titleField = typeof(SignalWindow).GetField("statusTitle", BindingFlags.NonPublic | BindingFlags.Instance);
            FieldInfo detailField = typeof(SignalWindow).GetField("detail", BindingFlags.NonPublic | BindingFlags.Instance);
            Func<string> shownTitle = delegate { return (string)titleField.FieldType.GetProperty("Text").GetValue(titleField.GetValue(window), null); };
            window.ShowProgress(new InstallProgress(InstallStage.Verifying, "다른 글로 바꾼 확인 제목", "다른 설명", 10));
            if ((int)stepField.GetValue(window) != 3 || shownTitle() != "설치된 파일을 확인하고 있어요") throw new Exception("Verifying stage did not select step 3 independent of title");
            window.ShowProgress(new InstallProgress(InstallStage.Restoring, "이전 버전으로 되돌려요", "앱 파일과 설치 정보를 되돌려요.", null));
            if ((int)stepField.GetValue(window) != 3 || shownTitle() != "이전 버전으로 되돌려요" || ((TextBlock)detailField.GetValue(window)).Text != "앱 파일과 설치 정보를 되돌려요.") throw new Exception("Restoring stage must keep the current step and show engine copy");
            window.ShowProgress(new InstallProgress(InstallStage.Installing, "설치를 준비해요", "제목이 준비여도 단계는 설치", null));
            if ((int)stepField.GetValue(window) != 2 || shownTitle() != "앱 파일을 넣고 있어요") throw new Exception("Installing stage must not be inferred from title text");
            Console.WriteLine("PASS: progress steps follow engine stage, not display copy");
            foreach (string font in renderedFonts) Console.WriteLine("RENDERED FONT: " + font);
            app.Shutdown();
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
    }

    // ── Platform 새 창(OrbWindow): 5절 설치기 표의 장면을 100%, 150%, 200%에서 그린다 ──
    // RenderTargetBitmap은 GPU 효과를 찍지 못하므로 구는 같은 셈의 CPU 판으로 그린다(OrbStage.ForceCpu). 창은 화면에 띄우지 않는다.
    const double PW = 1440, PH = 940;
    private static int PlatformCheck(string fonts, string output, SignalProduct product)
    {
        OrbStage.ForceCpu = true;
        int installs = 0, launches = 0;
        Func<OrbWindow> make = delegate {
            OrbWindow made = new OrbWindow(fonts, "0.4.96", product);
            made.Width = PW; made.Height = PH;
            made.InstallRequested += delegate { installs++; };
            made.LaunchRequested += delegate { launches++; };
            return made;
        };
        HashSet<string> renderedFonts = new HashSet<string>();
        Action<OrbWindow, string> render = delegate(OrbWindow window, string state) {
            FrameworkElement surface = (FrameworkElement)window.Content;
            window.Settle();
            // 창의 글은 모두 「~습니다」다. 기록 칸에도 엔진의 해요체 문장이 붙지 않는다(0.4.96 검수 F4)
            if (Haeyo(window.SayText + "\n" + window.ThenText + "\n" + Detail(window))) throw new Exception(state + " mixes the engine's haeyo sentences into the window: " + Detail(window).Replace("\n", " | "));
            foreach (double scale in new double[] { 1, 1.5, 2 }) {
                surface.Measure(new Size(PW, PH)); surface.Arrange(new Rect(0, 0, PW, PH)); surface.UpdateLayout();
                window.Relayout(); window.Settle();
                window.Orb.CpuScale = scale; window.Orb.RenderCpuNow();
                surface.UpdateLayout();
                RenderTargetBitmap bitmap = new RenderTargetBitmap((int)(PW * scale), (int)(PH * scale), 96 * scale, 96 * scale, PixelFormats.Pbgra32);
                bitmap.Render(surface);
                PngBitmapEncoder encoder = new PngBitmapEncoder();
                encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (FileStream file = File.Create(Path.Combine(output, "ui-platform-" + state + "-" + (int)(scale * 100) + ".png"))) encoder.Save(file);
            }
            CollectPlatformFonts(surface, renderedFonts);
            Console.WriteLine("PASS: " + state + " · " + window.SayText + " / " + window.ThenText + " · " + window.Orb.Describe());
        };
        MethodInfo click = typeof(ButtonBase).GetMethod("OnClick", BindingFlags.NonPublic | BindingFlags.Instance);
        Action<OrbWindow, string> press = delegate(OrbWindow window, string name) {
            Button button = FindButton((DependencyObject)window.Content, name);
            if (button == null || button.Visibility != Visibility.Visible) throw new Exception("Button missing: " + name + " in " + window.SceneName);
            click.Invoke(button, null);
        };
        Action<OrbWindow, string, bool> closable = delegate(OrbWindow window, string state, bool expected) {
            Button close = FindButton((DependencyObject)window.Content, "창 닫기");
            if (close == null || close.IsEnabled != expected) throw new Exception("Unexpected window close state in " + state);
        };

        // ── 0.4.96 검수가 0.4.97로 넘긴 지적(A1, A2, B3, B4, B5, F4). 고치기 전 판에서 어느 것이 떨어지는지 하나씩 보이도록 모두 돌린 뒤 모아서 알린다.
        // 고치기 전 판에도 컴파일되게 공개 API와 반사(reflection)만 쓴다 ──
        List<string> failures = new List<string>();
        Action<string, Action> expect = delegate(string name, Action body) {
            try { body(); Console.WriteLine("PASS: " + name); }
            catch (Exception error) { Exception cause = error is TargetInvocationException && error.InnerException != null ? error.InnerException : error; failures.Add(name); Console.WriteLine("FAIL: " + name + " · " + cause.Message); }
        };
        BindingFlags hidden = BindingFlags.NonPublic | BindingFlags.Instance;
        // F4: 기록 칸은 창의 문장(「~습니다」)과 알릴 곳, 엔진 글의 값만 보인다. 엔진의 해요체 문장은 옮기지 않는다
        string cachePath = @"C:\Users\example\AppData\Local\SYNK\Installer\Cache\example", pendingPath = @"C:\Users\example\AppData\Local\SYNK\Installer\Pending\example.txt";
        string unresolved = "설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요. 계정과 앱 기록은 그대로예요.\n되돌릴 원본: " + cachePath + "\nSYNK에 이 내용을 알려 주세요.\n설치 제한 시간(10분)을 넘겼어요. 설치가 끝났는지 확인하지 못했어요.";
        string pendingText = "지난번 설치를 되돌렸는지 아직 확인하지 못했어요. 다시 설치하지 말고 SYNK에 알려 주세요.\n되돌리기 안내: " + pendingPath;
        Action<OrbWindow, string, string[]> record = delegate(OrbWindow window, string state, string[] lines) {
            string text = Detail(window);
            if (Haeyo(window.SayText + "\n" + window.ThenText + "\n" + text)) throw new Exception(state + " shows an engine sentence: " + window.SayText + " / " + window.ThenText + " / " + text.Replace("\n", " | "));
            string expected = String.Join(Environment.NewLine, lines);
            if (text != expected) throw new Exception(state + " record: «" + text.Replace(Environment.NewLine, " | ") + "» expected «" + expected.Replace(Environment.NewLine, " | ") + "»");
        };
        expect("F4 manual recovery-required record", delegate {
            OrbWindow f = make(); f.ShowInstallFailure(new InstallFailure(unresolved, false, false));
            record(f, "recovery-required", new[] { "앱 파일이 어떤 상태인지 확인하지 못했습니다. 알릴 곳: " + OrbWindow.Contact, "되돌릴 원본: " + cachePath });
        });
        expect("F4 manual install meets an earlier unfinished install", delegate {
            OrbWindow f = make(); f.ShowInstallFailure(FailureKind.Tag(new InstallFailure(pendingText, false, true), "pending"));
            if (f.SayText != "지난번 설치를 되돌렸는지 확인하지 못했습니다.") throw new Exception("say: " + f.SayText);
            record(f, "pending", new[] { "알릴 곳: " + OrbWindow.Contact, "되돌리기 안내: " + pendingPath });
        });
        expect("F4 automatic recovery-required record", delegate {
            OrbWindow f = make(); f.BeginAutomatic(); f.ShowAutomaticResult(new AutomaticUpdateResult { Message = unresolved });
            record(f, "auto-recovery-required", new[] { "앱 파일이 어떤 상태인지 확인하지 못했습니다. 알릴 곳: " + OrbWindow.Contact, "되돌릴 원본: " + cachePath });
        });
        expect("F4 blocked automatic update record", delegate {
            OrbWindow f = make(); f.BeginAutomatic(); f.ShowBlocked(new InstallFailure(pendingText, false, true));
            record(f, "auto-blocked", new[] { "알릴 곳: " + OrbWindow.Contact, "되돌리기 안내: " + pendingPath });
        });
        expect("F4 launch failure keeps no engine sentence", delegate {
            OrbWindow f = make(); f.ShowLaunchFailure(new IOException("SYNK 실행 파일을 확인하지 못했어요. 다시 설치해 주세요."));
            record(f, "launch-failure", new string[0]);
        });
        expect("F4 space failure says the size in the window's own sentence", delegate {
            OrbWindow f = make(); f.ShowInstallFailure(FailureKind.Tag(new IOException("설치할 공간이 모자라요. 드라이브에서 약 3 GB를 비워 주세요."), "space"));
            if (f.ThenText != "약 3 GB를 비운 뒤 다시 시도해 주세요.") throw new Exception("then: " + f.ThenText);
            record(f, "space", new string[0]);
        });
        expect("F4 restored failure keeps the engine code only", delegate {
            OrbWindow f = make(); f.ShowInstallFailure(FailureKind.Tag(new InstallFailure("설치를 마치지 못했어요. 다시 해 주세요. (코드 2)\n이전 앱 파일·설치 등록·바로가기를 되돌렸어요. 계정과 앱 기록은 그대로예요. 다시 해 보거나 닫아도 돼요.", true, true), "restored"));
            record(f, "restored", new[] { "설치 엔진 코드: 2" });
        });
        expect("F4 unknown failure keeps the Windows message and the unchecked file", delegate {
            OrbWindow f = make(); f.ShowInstallFailure(new IOException("'C:\\example\\app.asar' 경로에 대한 액세스가 거부되었습니다."));
            record(f, "windows-message", new[] { "'C:\\example\\app.asar' 경로에 대한 액세스가 거부되었습니다." });
            f.ShowInstallFailure(new IOException("설치된 파일을 확인하지 못했어요: resources/app.asar. 다시 설치해 주세요."));
            record(f, "unchecked-file", new[] { "확인하지 못한 파일: resources/app.asar" });
        });
        // A1: 눈을 감던 중에 지금과 같은 표정을 청해도 눈을 마저 뜬다
        expect("A1 eyes open again when the same mood is asked while they close", delegate {
            OrbStage o = make().Orb;
            FieldInfo open = typeof(OrbStage).GetField("eyeOpen", hidden);
            o.EyesCalm(); o.SetMood("smile", 0); o.SetMood("calm", 0); o.Settle();
            if ((double)open.GetValue(o) < 0.999) throw new Exception("eyes stayed closed after a mood change: " + open.GetValue(o));
            o.EyesCalm(); typeof(OrbStage).GetMethod("Blink", hidden).Invoke(o, null); o.SetMood("calm", 0); o.Settle();
            if ((double)open.GetValue(o) < 0.999) throw new Exception("eyes stayed closed after a blink: " + open.GetValue(o));
            o.EyesOff(); o.EyesWake(); o.SetMood("sleep", 0); o.Settle();
            if ((double)open.GetValue(o) < 0.999) throw new Exception("eyes stayed closed while waking: " + open.GetValue(o));
        });
        // A2: CPU 판이 앞 장을 그리는 동안 건너뛴 움직이는 장은, 앞 장이 끝나자마자 끝 모습으로 그린다(1초 막음에 걸리지 않는다)
        expect("A2 a CPU frame skipped while drawing is drawn right after", delegate {
            MethodInfo due = typeof(OrbStage).GetMethod("CpuDue", BindingFlags.NonPublic | BindingFlags.Static);
            if (due == null) throw new Exception("the CPU frame decision is not separable (old OnRendering)");
            object[] first = { false, false, false, 0.0 }, during = { true, false, false, 16.0 }, after = { false, true, false, 100.0 }, idle = { false, true, false, 100.0 };
            if (!(bool)due.Invoke(null, first)) throw new Exception("a moving frame was not drawn");
            during[2] = first[2]; if ((bool)due.Invoke(null, during)) throw new Exception("drew while the previous frame was drawing");
            after[2] = during[2]; if (!(bool)due.Invoke(null, after)) throw new Exception("the end of a short transition waited for the 1 s throttle");
            if ((bool)due.Invoke(null, idle)) throw new Exception("a resting unchanged frame was drawn before 1 s");
        });
        // B3: 화면에 놓인 적 없는 창(조용한 업데이트)의 도착 쪽지도 화면 화소로 적는다. 이 PC의 배율이 1이면 고치기 전 판도 지나간다
        expect("B3 arrival note of a never-shown window is in screen pixels", delegate {
            OrbWindow q = make(); q.Left = 100; q.Top = 60;
            DpiScale dpi = VisualTreeHelper.GetDpi(q);
            ArrivalNote n = q.Arrival("updated", "hidden", "0.4.97");
            int x = (int)Math.Round(100 * dpi.DpiScaleX), y = (int)Math.Round(60 * dpi.DpiScaleY), w2 = (int)Math.Round((100 + PW) * dpi.DpiScaleX) - x, h2 = (int)Math.Round((60 + PH) * dpi.DpiScaleY) - y;
            Console.WriteLine("  system scale " + dpi.DpiScaleX + " · note " + n.X + "," + n.Y + " " + n.Width + "x" + n.Height);
            if (n.X != x || n.Y != y || n.Width != w2 || n.Height != h2) throw new Exception("note " + n.X + "," + n.Y + " " + n.Width + "x" + n.Height + " expected " + x + "," + y + " " + w2 + "x" + h2);
        });
        // B4: 최대화한 동안에는 가장자리 끌기가 꺼지고, 되돌리면 다시 켜진다
        expect("B4 edge resizing is off while maximized", delegate {
            OrbWindow m = make();
            press(m, "최대화");
            Thickness t = WindowChrome.GetWindowChrome(m).ResizeBorderThickness;
            if (t.Left != 0 || t.Top != 0 || t.Right != 0 || t.Bottom != 0) throw new Exception("resize border while maximized: " + t);
            press(m, "이전 크기로");
            t = WindowChrome.GetWindowChrome(m).ResizeBorderThickness;
            if (t.Left != 6 || t.Top != 6) throw new Exception("resize border after restoring: " + t);
        });
        // B5: 맨 위 창 단추의 키보드 초점 테가 창 안에 들어온다
        expect("B5 focus ring of the window buttons stays inside the window", delegate {
            OrbWindow fb = make();
            FrameworkElement surface = (FrameworkElement)fb.Content;
            surface.Measure(new Size(PW, PH)); surface.Arrange(new Rect(0, 0, PW, PH)); surface.UpdateLayout();
            foreach (string name in new[] { "최소화", "최대화", "창 닫기" }) {
                Button button = FindButton(surface, name);
                ControlTemplate template = null;
                foreach (SetterBase item in button.FocusVisualStyle.Setters) { Setter setter = item as Setter; if (setter != null && setter.Property == Control.TemplateProperty) template = (ControlTemplate)setter.Value; }
                Control probe = new Control { Template = template }; probe.ApplyTemplate();
                FrameworkElement ring = (FrameworkElement)VisualTreeHelper.GetChild(probe, 0);
                Point at = button.TranslatePoint(new Point(0, 0), surface);
                double top = at.Y + ring.Margin.Top, left = at.X + ring.Margin.Left, right = at.X + button.ActualWidth - ring.Margin.Right;
                if (top < 0 || left < 0 || right > PW) throw new Exception(name + " ring reaches " + top + " (top), " + right + " (right)");
            }
        });
        foreach (string failed in failures) Console.WriteLine("FAILED CHECK: " + failed);

        // 처음 설치: 매끈한 구와 「설치」 하나. 누르면 깎이고 닫기가 꺼진다
        OrbWindow w = make(); w.SetInstalled(false); w.SetReady(); render(w, "ready"); closable(w, "ready", true);
        if (w.SayText != "SYNK를 이 PC에 설치합니다." || w.ThenText != "끝나면 바로 열립니다.") throw new Exception("Ready copy changed");
        press(w, "설치"); if (installs != 1) throw new Exception("InstallRequested not emitted");
        closable(w, "installing", false);
        w.ShowProgress(new InstallProgress(InstallStage.BackingUp, "", "", 0));
        w.ShowProgress(new InstallProgress(InstallStage.Preparing, "", "", 100));
        w.ShowProgress(new InstallProgress(InstallStage.Installing, "", "", null)); render(w, "install");
        // 깎인 만큼은 어떤 단계 순서에서도 뒤로 가지 않는다(3절)
        double last = w.ShownCut;
        foreach (InstallProgress step in new[] { new InstallProgress(InstallStage.Preparing, "", "", 10), new InstallProgress(InstallStage.BackingUp, "", "", 0), new InstallProgress(InstallStage.Verifying, "", "", 50), new InstallProgress(InstallStage.Installing, "", "", null), new InstallProgress(InstallStage.Verifying, "", "", 100) }) {
            w.ShowProgress(step); w.Settle();
            if (w.ShownCut + 1e-9 < last) throw new Exception("Cut went backwards at " + step.Stage);
            last = w.ShownCut;
        }
        if (last < 0.98) throw new Exception("Verified install should be nearly carved: " + last);
        w.FinishCut(); w.Settle(); if (w.ShownCut < 0.999) throw new Exception("FinishCut must reach 100%");
        Console.WriteLine("PASS: carving never goes backwards and finishes at 100%");
        w.ShowInstallFailure(FailureKind.Tag(new InvalidOperationException("SYNK가 켜져 있어요."), FailureKind.AppRunning)); render(w, "failure-running"); closable(w, "failure", true);
        press(w, "다시 시도"); if (installs != 2) throw new Exception("Retry did not request installation");
        w.ShowInstallFailure(FailureKind.Tag(new InstallFailure("설치 제한 시간(10분)을 넘겼어요. 설치를 멈췄어요.", true, true), FailureKind.Timeout)); render(w, "failure-timeout");
        w.ShowInstallFailure(new InstallFailure("설치가 끝나지 않았어요. 앱 파일이 일부 바뀌었을 수 있어 다시 설치하지 못하게 막았어요.\n되돌릴 원본: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Cache\\example", false, true)); render(w, "recovery-required");
        if (FindButton((DependencyObject)w.Content, "다시 시도").Visibility == Visibility.Visible) throw new Exception("Unsafe recovery exposed retry");
        w.ShowLaunchFailure(new IOException("SYNK 실행 파일을 확인하지 못했어요.")); render(w, "launch-failure");
        press(w, "열기"); if (launches != 1) throw new Exception("LaunchRequested not emitted");

        // 다시 설치
        OrbWindow r = make(); r.SetInstalled(true); r.SetReady(); render(r, "reinstall");
        if (r.SayText != "SYNK를 같은 자리에 다시 설치합니다.") throw new Exception("Reinstall copy changed");
        press(r, "다시 설치");
        r.ShowProgress(new InstallProgress(InstallStage.Restoring, "", "", null)); render(r, "restoring"); closable(r, "restoring", false);

        // 자동 업데이트: 절반 깎인 구에서 이어 깎는다. 실패마다 5절의 줄
        OrbWindow a = make(); a.BeginAutomatic(); render(a, "auto-50"); closable(a, "automatic", false);
        a.ShowProgress(new InstallProgress(InstallStage.WaitingForApp, "", "", null));
        a.ShowProgress(new InstallProgress(InstallStage.BackingUp, "", "", 100));
        a.ShowProgress(new InstallProgress(InstallStage.Installing, "", "", null)); render(a, "auto-replacing");
        if (a.ShownCut < 0.9) throw new Exception("Automatic replacing should be past 90%: " + a.ShownCut);
        a.ShowAutomaticError(FailureKind.Tag(new InvalidOperationException("SYNK가 아직 켜져 있어요."), FailureKind.AppStillRunning)); render(a, "auto-still-running");
        a.ShowAutomaticResult(new AutomaticUpdateResult { Restored = true, Relaunched = false, Message = "업데이트를 마치지 못해 이전 버전으로 두었어요." }); render(a, "auto-restored-not-opened");
        a.ShowAutomaticResult(new AutomaticUpdateResult { Message = "설치가 끝나지 않았어요. 되돌릴 원본: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Cache\\example" }); render(a, "auto-recovery-required");
        a.ShowLaunchFailure(null); render(a, "auto-launch-failure");
        // 되돌린 뒤 쓰던 앱을 켜지 못함(5절): 「쓰던 판 열기」 하나. 누르거나 호스트가 잠시 뒤 대신 누르면 여는 요청을 보낸다
        a.ShowRestoredLaunchFailure(); render(a, "auto-restored-open");
        if (a.SayText != "새 판으로 바꾸지 못했습니다." || a.ThenText != "쓰던 판은 그대로입니다.") throw new Exception("Restored launch failure copy changed");
        int before = launches; a.OpenAgain(); if (launches != before + 1) throw new Exception("OpenAgain did not request a launch");
        a.OpenAgain(); if (launches != before + 1) throw new Exception("OpenAgain must not press twice while opening");
        a.ShowRestoredLaunchFailure(); press(a, "쓰던 판 열기"); if (launches != before + 2) throw new Exception("Open previous button did not request a launch");
        OrbWindow b = make(); b.BeginAutomatic(); b.ShowBlocked(new InstallFailure("지난번 설치를 되돌렸는지 아직 확인하지 못했어요.\n되돌리기 안내: C:\\Users\\example\\AppData\\Local\\SYNK\\Installer\\Pending\\example.txt", false, true)); render(b, "auto-blocked");
        if (!b.Topmost) throw new Exception("Blocked window must stay on top");

        // 가림막(2절)과 넘김 쪽지에서 이어받는 자동 업데이트: 앱 창의 마지막 장과 같은 절반 깎인 구와 글이 떠오르지 않고 바로 놓인다
        OrbWindow c = make(); c.BeginCurtain(0.5); render(c, "curtain");
        if (!c.IsCurtain || c.ShowInTaskbar || c.ShowActivated || c.SayText != "새 판으로 바꾸고 있습니다." || Math.Abs(c.ShownCut - 0.5) > 1e-9) throw new Exception("Curtain must be the half-carved scene that never activates or shows in the taskbar");
        closable(c, "curtain", false);
        OrbWindow h = make(); h.BeginAutomatic(true, 0.5); render(h, "auto-from-note");
        if (h.SayText != "새 판으로 바꾸고 있습니다." || Math.Abs(h.ShownCut - 0.5) > 1e-9) throw new Exception("Automatic window from a handoff note must start where the curtain is");
        foreach (string font in renderedFonts) Console.WriteLine("RENDERED FONT: " + font);
        if (failures.Count > 0) throw new Exception(failures.Count + " review checks failed");
        return 0;
    }

    /// <summary>기록 칸의 글(숨었으면 빈 글). 고치기 전 판에도 돌도록 반사로 읽는다</summary>
    private static string Detail(OrbWindow window)
    {
        BindingFlags hidden = BindingFlags.NonPublic | BindingFlags.Instance;
        ScrollViewer box = (ScrollViewer)typeof(OrbWindow).GetField("detailBox", hidden).GetValue(window);
        TextBlock text = (TextBlock)typeof(OrbWindow).GetField("detail", hidden).GetValue(window);
        return box.Visibility == Visibility.Visible ? text.Text : "";
    }
    /// <summary>해요체로 끝나는 문장이 있는가. 「~해 주세요」는 창 문장도 쓰므로 뺀다</summary>
    private static bool Haeyo(string text)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(text ?? "", @"(?<!세)요(?=[.!?]?(\s|$))");
    }

    private static void CollectPlatformFonts(DependencyObject element, HashSet<string> fonts)
    {
        Visual visual = element as Visual;
        if (visual != null) CollectPlatformDrawingFonts(VisualTreeHelper.GetDrawing(visual), fonts);
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(element); i++)
            CollectPlatformFonts(VisualTreeHelper.GetChild(element, i), fonts);
    }

    private static void CollectPlatformDrawingFonts(Drawing drawing, HashSet<string> fonts)
    {
        GlyphRunDrawing run = drawing as GlyphRunDrawing;
        if (run != null) {
            GlyphTypeface glyph = run.GlyphRun.GlyphTypeface;
            string file = Path.GetFileName(glyph.FontUri.LocalPath).ToLowerInvariant();
            // 새 창은 시작 창과 같은 세 굵기만 쓴다(300 SYNK Text, 400 SUIT Regular, 500 SUIT Medium)
            if (file != "synktext-light.ttf" && file != "suit-regular.otf" && file != "suit-medium.otf")
                throw new Exception("Unexpected font fallback in Platform window: " + glyph.FontUri);
            fonts.Add(file + " / " + glyph.Weight.ToOpenTypeWeight());
        }
        DrawingGroup group = drawing as DrawingGroup;
        if (group != null) foreach (Drawing child in group.Children) CollectPlatformDrawingFonts(child, fonts);
    }

    private static Button FindButton(DependencyObject root, string name)
    {
        Button button = root as Button;
        if (button != null && AutomationProperties.GetName(button) == name) return button;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++) {
            Button result = FindButton(VisualTreeHelper.GetChild(root, i), name);
            if (result != null) return result;
        }
        return null;
    }

    private static void CheckButtons(DependencyObject surface, bool enabled)
    {
        Button close = FindButton(surface, "설치 창 닫기");
        if (close == null || close.IsEnabled != enabled) throw new Exception("Unexpected close-button state");
    }

    private static void CollectFonts(DependencyObject element, HashSet<string> fonts)
    {
        Visual visual = element as Visual;
        if (visual != null) CollectDrawingFonts(VisualTreeHelper.GetDrawing(visual), fonts);
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(element); i++)
            CollectFonts(VisualTreeHelper.GetChild(element, i), fonts);
    }

    private static void CollectDrawingFonts(Drawing drawing, HashSet<string> fonts)
    {
        GlyphRunDrawing run = drawing as GlyphRunDrawing;
        if (run != null) {
            GlyphTypeface glyph = run.GlyphRun.GlyphTypeface;
            string file = Path.GetFileName(glyph.FontUri.LocalPath).ToLowerInvariant();
            if (file != "suit-medium.otf" && file != "suit-extrabold.otf" && file != "suit-heavy.otf" &&
                file != "intertight-medium.ttf" && file != "intertight-bold.ttf" && file != "dmmono-medium.ttf")
                throw new Exception("Unexpected font fallback: " + glyph.FontUri);
            fonts.Add(file + " / " + glyph.Weight.ToOpenTypeWeight());
        }
        DrawingGroup group = drawing as DrawingGroup;
        if (group != null) foreach (Drawing child in group.Children) CollectDrawingFonts(child, fonts);
    }
}
