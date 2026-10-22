using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
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
            window.ShowProgress("설치를 준비해요", "설치할 수 있는지 확인해요.", null); render("prepare");
            CheckButtons(surface, false);
            window.ShowProgress("설치를 준비해요", "설치 파일을 준비하고 있어요.", 64); render("prepare-64");
            window.ShowProgress(product.ShortName + "를 설치해요", "잠시만 기다려 주세요. 설치하는 동안에는 창을 닫을 수 없어요.", null);
            started.SetValue(window, DateTime.UtcNow.AddSeconds(-42)); meter.Invoke(window, null); render("install-42s");
            window.ShowProgress("설치를 확인해요", product.ShortName + "를 열기 전에 설치된 파일을 확인해요.", 80); render("verify-80");
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
            window.ShowProgress("이전 버전으로 되돌려요","앱 파일과 설치 정보를 되돌려요.",null);render("restoring");
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
            foreach (string font in renderedFonts) Console.WriteLine("RENDERED FONT: " + font);
            app.Shutdown();
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
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
