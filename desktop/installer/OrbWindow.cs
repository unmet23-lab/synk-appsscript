using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Shell;
using System.Windows.Threading;
using ShapePath = System.Windows.Shapes.Path;

namespace Synk.SignalInstaller
{
    /// <summary>CSS의 cubic-bezier 곡선(시작 창의 글이 떠오르는 곡선을 같게 그린다)</summary>
    internal sealed class CubicBezierEase : EasingFunctionBase
    {
        readonly double x1, y1, x2, y2;
        public CubicBezierEase(double x1, double y1, double x2, double y2) { this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; EasingMode = EasingMode.EaseIn; }
        static double Bez(double t, double a, double b) { double u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; }
        protected override double EaseInCore(double x)
        {
            if (x <= 0) return 0; if (x >= 1) return 1;
            double lo = 0, hi = 1, t = x;
            for (int i = 0; i < 40; i++) { t = (lo + hi) / 2; if (Bez(t, x1, x2) < x) lo = t; else hi = t; }
            return Bez(t, y1, y2);
        }
        protected override Freezable CreateInstanceCore() { return new CubicBezierEase(x1, y1, x2, y2); }
    }

    /// <summary>
    /// SYNK Platform 설치기 창(검정 구 1-가 ③, 유호님 11-17 「웅장한 판」). 앱의 시작 창(desktop/renderer/startup-update.*)과 같은 검정 창에
    /// 구 하나가 창보다 크게 다가와 있고, 글은 왼쪽 아래에 작품 설명처럼 놓인다. 모습과 시간값은 시안 검정구.html의 웅장한 판을 따른다.
    /// 설치 작업은 호스트(Program)가 맡고, 이 창은 장면만 그린다. WORLD와 Workspace는 지금 창(SignalWindow) 그대로다.
    /// </summary>
    public sealed class OrbWindow : Window
    {
        enum Scene { Intro, Ready, Installing, Automatic, Restoring, Failure, LaunchFailure, Finishing }

        static readonly Brush Paper = SignalWindow.Solid("#F3F1EC");
        static readonly Brush Dim = SignalWindow.Solid("#75F3F1EC");      // rgba(243,241,236,.46)
        static readonly Brush VerInk = SignalWindow.Solid("#99F3F1EC");   // .6
        static readonly Brush QuietInk = SignalWindow.Solid("#CCF3F1EC"); // .8
        static readonly Brush QuietLine = SignalWindow.Solid("#57F3F1EC"); // .34
        static readonly Brush Ring = SignalWindow.Solid("#8CF3F1EC");     // .55
        static readonly Brush BarInk = SignalWindow.Solid("#B8FFFFFF");   // .72
        static readonly Brush BarHover = SignalWindow.Solid("#1FFFFFFF"); // .12
        static readonly Brush CloseHover = SignalWindow.Solid("#E5484D");
        static readonly Brush Void = Brushes.Black;

        /// <summary>문의할 곳(5절: 막힌 상태의 안내에 알릴 곳을 함께 적는다). 앱의 계정 화면과 같은 주소다.</summary>
        public const string Contact = "hello@synk.im";
        /// <summary>깎인 만큼이 받은 값을 따라가는 가장 빠른 빠르기(초당). 시작 창(startup-update.mjs의 FORGE_FOLLOW_PER_SECOND)과 같다</summary>
        public const double FollowPerSecond = 0.16;

        readonly SignalProduct product;
        readonly string version;
        readonly FontFamily suit, light;
        readonly OrbStage orb;
        readonly Grid forge;
        readonly StackPanel column;
        readonly TextBlock say, then, detail;
        readonly TrackedText ver;
        readonly ScrollViewer detailBox;
        readonly Button way, retry, close, openApp, minimizeButton, maximizeButton, closeButton;
        readonly StackPanel actions;
        readonly DispatcherTimer ticker;
        Scene scene = Scene.Intro;
        bool installed, automatic, allowClose, maximized, uiShown, curtain;
        Grid windowBar;
        Rect restoreBounds;
        string sayText = "", thenText = "";
        // 깎인 만큼: 받은 값(target)을 보이는 값(shown)이 따라간다. 시간으로 다가가는 단계는 stageStart부터 잰다
        double target, shown, stageFrom, stageTo, stageTau; DateTime stageStart; bool timedStage; DateTime followAt = DateTime.UtcNow;
        InstallStage lastStage = InstallStage.Preparing; bool anyStage;
        TaskCompletionSource<bool> fullyCut;

        public event EventHandler InstallRequested;
        public event EventHandler LaunchRequested;
        public event EventHandler RetryRequested;
        public OrbStage Orb { get { return orb; } }
        /// <summary>시험용: 지금 장면 이름과 글</summary>
        public string SceneName { get { return scene.ToString(); } }
        public string SayText { get { return sayText; } }
        public string ThenText { get { return thenText; } }
        public double ShownCut { get { return shown; } }

        public OrbWindow(string fontDirectory, string version, SignalProduct product)
        {
            this.product = product ?? SignalProduct.Platform();
            this.version = String.IsNullOrWhiteSpace(version) ? "" : version.Trim();
            IList<FontFamily> families = SignalWindow.ReadFontFamilies(fontDirectory);
            // 시작 창의 글: 문장 300, 판 번호와 단추 400, 설치 단추 500(desktop/renderer/startup-update.css).
            // 400과 500은 SUIT 공식 정적 파일이다. 300은 앱이 쓰는 SUIT 가변 글꼴에서 뽑은 판이라, OFL의 예약 이름을 피해 가족 이름이 「SYNK Text」다
            suit = SignalWindow.RequireFont(families, "SUIT", 400, 500);
            light = SignalWindow.RequireFont(families, "SYNK Text", 300);

            Title = this.product.WindowTitle;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.CanResize;
            AllowsTransparency = false;
            Background = Void;
            FontFamily = suit;
            Foreground = Paper;
            UseLayoutRounding = true;
            SnapsToDevicePixels = true;
            Language = System.Windows.Markup.XmlLanguage.GetLanguage("ko-KR");
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Ideal);
            AutomationProperties.SetName(this, Title);
            WindowChrome.SetWindowChrome(this, new WindowChrome { CaptionHeight = 0, ResizeBorderThickness = new Thickness(6), GlassFrameThickness = new Thickness(0), CornerRadius = new CornerRadius(0), UseAeroCaptionButtons = false });
            PlaceFirst();

            Grid root = new Grid { Background = Void };
            Content = root;
            orb = new OrbStage(OrbEffect.LoadBytecode());
            root.Children.Add(orb);

            // 글: 왼쪽 아래(시작 창 .forge-in). 글 뒤만 부드럽게 어둡힌다
            forge = new Grid { HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Bottom, Opacity = 0 };
            Rectangle shade = new Rectangle { Margin = new Thickness(-210, -70, -160, -90), IsHitTestVisible = false };
            RadialGradientBrush glow = new RadialGradientBrush();
            glow.GradientStops.Add(new GradientStop(Color.FromArgb(214, 0, 0, 0), 0));
            glow.GradientStops.Add(new GradientStop(Color.FromArgb(148, 0, 0, 0), 0.54));
            glow.GradientStops.Add(new GradientStop(Color.FromArgb(0, 0, 0, 0), 1));
            glow.Freeze();
            shade.Fill = glow;
            forge.Children.Add(shade);
            column = new StackPanel { Orientation = Orientation.Vertical, HorizontalAlignment = HorizontalAlignment.Left };
            forge.Children.Add(column);
            StackPanel sayBlock = new StackPanel();
            say = new TextBlock { FontFamily = light, FontWeight = FontWeights.Light, Foreground = Paper, TextWrapping = TextWrapping.NoWrap, LineStackingStrategy = LineStackingStrategy.BlockLineHeight };
            then = new TextBlock { FontFamily = light, FontWeight = FontWeights.Light, Foreground = Dim, TextWrapping = TextWrapping.NoWrap, LineStackingStrategy = LineStackingStrategy.BlockLineHeight };
            AutomationProperties.SetLiveSetting(say, AutomationLiveSetting.Polite);
            sayBlock.Children.Add(say); sayBlock.Children.Add(then);
            column.Children.Add(Rise(sayBlock, 0));
            // 판 번호와 백분율: 400, 12px, 자간 .22em(시작 창 .forge-ver). WPF 글상자에는 자간이 없어 글리프를 직접 놓는다
            ver = new TrackedText(SignalWindow.Face(suit, 400), 12, 0.22, VerInk, 12, null) { Margin = new Thickness(0, 16, 0, 0), HorizontalAlignment = HorizontalAlignment.Left };
            column.Children.Add(Rise(ver, 1));
            detail = new TextBlock { FontWeight = FontWeights.Normal, FontSize = 12, Foreground = VerInk, TextWrapping = TextWrapping.Wrap, LineHeight = 18, LineStackingStrategy = LineStackingStrategy.BlockLineHeight };
            // 기록 칸(막힌 상태의 알릴 곳과 엔진 기록): 단추 아래에 두고, 그 높이만큼 글 묶음을 아래 여백으로 내린다.
            // 문장이 두 줄짜리 실패 장면과 같은 자리에 남아 구의 눈과 겹치지 않는다
            detailBox = new ScrollViewer { Content = detail, MaxHeight = 72, Margin = new Thickness(0, 14, 0, 0), VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Focusable = false, Visibility = Visibility.Collapsed };
            way = Way("설치");
            way.Margin = new Thickness(0, 22, 0, 0);
            way.Click += delegate { OnWay(); };
            column.Children.Add(Rise(way, 2));
            actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 18, 0, 0) };
            retry = Quiet("다시 시도"); retry.Click += delegate { OnRetry(); };
            openApp = Quiet("열기"); openApp.Click += delegate { OnOpen(); };
            close = Quiet("닫기"); close.Click += delegate { allowClose = true; Close(); };
            actions.Children.Add(retry); actions.Children.Add(openApp); actions.Children.Add(close);
            column.Children.Add(Rise(actions, 2));
            column.Children.Add(Rise(detailBox, 3));
            root.Children.Add(forge);

            // 창 단추(시작 창 .startup-window-actions). 맨 위 40px를 잡고 창을 옮긴다
            Grid bar = new Grid { Height = 40, VerticalAlignment = VerticalAlignment.Top, Background = Brushes.Transparent };
            windowBar = bar;
            bar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            bar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            StackPanel buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
            minimizeButton = WindowButton("최소화", "M6 12h12", false); minimizeButton.Click += delegate { WindowState = WindowState.Minimized; };
            maximizeButton = WindowButton("최대화", "M8 6.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-8a1.5 1.5 0 0 1 1.5-1.5z", false);
            maximizeButton.Click += delegate { ToggleMaximize(); };
            closeButton = WindowButton("창 닫기", "M6 6l12 12M18 6L6 18", true); closeButton.Click += delegate { if (Closable) { allowClose = true; Close(); } };
            buttons.Children.Add(minimizeButton); buttons.Children.Add(maximizeButton); buttons.Children.Add(closeButton);
            Grid.SetColumn(buttons, 1);
            bar.Children.Add(buttons);
            bar.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs args) {
                if (SignalWindow.InsideButton(args.OriginalSource as DependencyObject)) return;
                if (args.ClickCount == 2) { ToggleMaximize(); return; }
                if (!maximized && Mouse.LeftButton == MouseButtonState.Pressed) { try { DragMove(); } catch (InvalidOperationException) { } }
            };
            root.Children.Add(bar);

            SizeChanged += delegate { Layout(); };
            SourceInitialized += delegate { RoundCorners(); };
            Closing += delegate(object sender, System.ComponentModel.CancelEventArgs args) { if (!allowClose && !Closable) args.Cancel = true; };
            PreviewKeyDown += delegate(object sender, KeyEventArgs args) {
                if (args.Key == Key.Escape && Closable) { args.Handled = true; allowClose = true; Close(); }
            };
            ticker = new DispatcherTimer(DispatcherPriority.Render, Dispatcher) { Interval = TimeSpan.FromMilliseconds(16) };
            ticker.Tick += delegate { Follow(); };
            Layout();
            SetButtons();
        }

        bool Closable { get { return scene == Scene.Ready || scene == Scene.Intro || scene == Scene.Failure || scene == Scene.LaunchFailure; } }

        // ── 자리: 처음 설치의 자리(주 화면 작업 영역 가운데, 1440×940 DIP, 앱 window-placement.cjs의 fitPlacement(null)과 같은 셈) ──
        void PlaceFirst()
        {
            Rect area = SystemParameters.WorkArea;
            double w = Math.Round(Math.Max(Math.Min(960, area.Width), Math.Min(1440, area.Width)));
            double h = Math.Round(Math.Max(Math.Min(680, area.Height), Math.Min(940, area.Height)));
            Width = w; Height = h; MinWidth = Math.Min(960, area.Width); MinHeight = Math.Min(680, area.Height);
            Left = Math.Round(area.X + (area.Width - w) / 2); Top = Math.Round(area.Y + (area.Height - h) / 2);
            WindowStartupLocation = WindowStartupLocation.Manual;
        }
        /// <summary>앱 창의 자리(넘김 쪽지)에 놓는다. 화면 화소가 아니라 DIP다</summary>
        public void PlaceAt(Rect bounds, bool maximize)
        {
            Left = bounds.X; Top = bounds.Y; Width = bounds.Width; Height = bounds.Height;
            if (maximize) { if (IsLoaded) ToggleMaximize(); else Loaded += delegate { if (!maximized) ToggleMaximize(); }; }
        }

        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
        [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public NativeRect Monitor, Work; public uint Flags; }
        [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
        [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
        void RoundCorners()
        {
            // Windows 11: 앱 창(Electron 테두리 없는 창)처럼 둥근 모서리를 청한다. 그 앞 판에서는 무시된다
            try { IntPtr hwnd = new WindowInteropHelper(this).Handle; int round = 2; DwmSetWindowAttribute(hwnd, 33, ref round, sizeof(int)); } catch (Exception) { }
        }
        /// <summary>최대화는 작업 영역 크기로 놓는다. 테두리 없는 WPF 창을 그냥 최대화하면 작업 표시줄을 덮는다(1-가 구현 설계 2절)</summary>
        void ToggleMaximize()
        {
            if (maximized) {
                maximized = false;
                Left = restoreBounds.X; Top = restoreBounds.Y; Width = restoreBounds.Width; Height = restoreBounds.Height;
            } else {
                IntPtr hwnd = new WindowInteropHelper(this).Handle;
                MonitorInfo info = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
                Rect work = SystemParameters.WorkArea;
                if (hwnd != IntPtr.Zero && GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref info)) {
                    PresentationSource source = PresentationSource.FromVisual(this);
                    Matrix m = source != null && source.CompositionTarget != null ? source.CompositionTarget.TransformFromDevice : Matrix.Identity;
                    Point a = m.Transform(new Point(info.Work.Left, info.Work.Top)), b = m.Transform(new Point(info.Work.Right, info.Work.Bottom));
                    work = new Rect(a, b);
                }
                restoreBounds = new Rect(Left, Top, Width, Height);
                maximized = true;
                Left = work.X; Top = work.Y; Width = work.Width; Height = work.Height;
            }
            AutomationProperties.SetName(maximizeButton, maximized ? "이전 크기로" : "최대화");
            ((ShapePath)maximizeButton.Content).Data = Geometry.Parse(maximized
                ? "M7.5 9.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM9.5 6.5h8a1.5 1.5 0 0 1 1.5 1.5v8"
                : "M8 6.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-8a1.5 1.5 0 0 1 1.5-1.5z");
        }

        // ── 글의 자리와 크기(시작 창 CSS의 clamp를 그대로 셈한다) ──
        static double ClampTo(double lo, double v, double hi) { return Math.Max(lo, Math.Min(hi, v)); }
        /// <summary>창 크기에 맞춰 글의 자리와 크기를 다시 셈한다(창 검사가 창을 띄우지 않고 부른다)</summary>
        public void Relayout() { Layout(); }
        void Layout()
        {
            double w = ActualWidth > 0 ? ActualWidth : Width, h = ActualHeight > 0 ? ActualHeight : Height;
            if (Double.IsNaN(w) || Double.IsNaN(h)) return;
            double left = ClampTo(20, w * 0.095, 168);
            double bottom = h < 620 ? ClampTo(48, h * 0.10, 84) : ClampTo(84, h * 0.13, 128);
            double extra = 0;
            if (detailBox.Visibility == Visibility.Visible) {
                detailBox.Measure(new Size(Math.Min(560, w - 40), Double.PositiveInfinity));
                extra = Math.Min(detailBox.DesiredSize.Height, bottom - 24);
            }
            forge.Margin = new Thickness(left, 0, 0, bottom - extra);
            double size = ClampTo(19, w * 0.022, 29);
            foreach (TextBlock block in new[] { say, then }) { block.FontSize = size; block.LineHeight = Math.Round(size * 1.36, 2); }
            column.MaxWidth = Math.Min(560, w - 40);
            ApplyText();
        }
        /// <summary>낱말 단위로 줄을 나눈다(시작 창의 word-break: keep-all). WPF는 한글 음절 사이에서도 줄을 바꾸기 때문이다</summary>
        string KeepAll(string text, double size, FontWeight weight, double maxWidth)
        {
            if (String.IsNullOrEmpty(text)) return "";
            Typeface face = new Typeface(weight == FontWeights.Light ? light : suit, FontStyles.Normal, weight, FontStretches.Normal);
            double dip = VisualTreeHelper.GetDpi(this).PixelsPerDip, track = -0.012 * size;
            List<string> lines = new List<string>();
            string line = "";
            foreach (string word in text.Split(' ')) {
                string next = line.Length == 0 ? word : line + " " + word;
                FormattedText measured = new FormattedText(next, CultureInfo.GetCultureInfo("ko-KR"), FlowDirection.LeftToRight, face, size, Paper, dip);
                if (line.Length > 0 && measured.WidthIncludingTrailingWhitespace + track * next.Length > maxWidth) { lines.Add(line); line = word; }
                else line = next;
            }
            if (line.Length > 0) lines.Add(line);
            return String.Join("\n", lines);
        }
        void ApplyText()
        {
            double max = column.MaxWidth > 0 && !Double.IsInfinity(column.MaxWidth) ? column.MaxWidth : 560;
            say.Text = KeepAll(sayText, say.FontSize, FontWeights.Light, max);
            then.Text = KeepAll(thenText, then.FontSize, FontWeights.Light, max);
            then.Visibility = thenText.Length == 0 ? Visibility.Collapsed : Visibility.Visible;
            AutomationProperties.SetName(say, (sayText + " " + thenText).Trim());
        }
        void SetCopy(string a, string b)
        {
            bool changed = a != sayText || (b ?? "") != thenText;
            sayText = a ?? ""; thenText = b ?? "";
            ApplyText();
            if (changed) SignalWindow.Announce(say);
        }
        void SetVersionLine()
        {
            bool percent = scene == Scene.Installing || scene == Scene.Automatic || scene == Scene.Finishing;
            string text = version;
            if (percent) text += (text.Length > 0 ? " · " : "") + Math.Round(shown * 100).ToString(CultureInfo.InvariantCulture) + "%";
            if (scene == Scene.Restoring) text = "";
            ver.Text = text;
            ver.Visibility = text.Length == 0 ? Visibility.Collapsed : Visibility.Visible;
        }
        // ── 단추 ──
        static Style FlatStyle(double radius, Brush hoverBackground, Brush hoverForeground, Brush hoverBorder, bool underline)
        {
            Style style = new Style(typeof(Button));
            FrameworkElementFactory surface = new FrameworkElementFactory(typeof(Border), "Surface");
            surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            surface.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            surface.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            surface.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            surface.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Control.PaddingProperty));
            FrameworkElementFactory presenter = new FrameworkElementFactory(typeof(ContentPresenter));
            presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            surface.AppendChild(presenter);
            ControlTemplate template = new ControlTemplate(typeof(Button)) { VisualTree = surface };
            MultiTrigger hover = new MultiTrigger();
            hover.Conditions.Add(new Condition(UIElement.IsMouseOverProperty, true));
            hover.Conditions.Add(new Condition(UIElement.IsEnabledProperty, true));
            if (hoverBackground != null) hover.Setters.Add(new Setter(Control.BackgroundProperty, hoverBackground));
            if (hoverForeground != null) hover.Setters.Add(new Setter(Control.ForegroundProperty, hoverForeground));
            if (hoverBorder != null) hover.Setters.Add(new Setter(Control.BorderBrushProperty, hoverBorder));
            template.Triggers.Add(hover);
            Trigger disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
            disabled.Setters.Add(new Setter(UIElement.OpacityProperty, underline ? 0.5 : 0.38));
            template.Triggers.Add(disabled);
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
            // 키보드 초점 테: 시작 창의 :focus-visible(1px, 바깥 5px)
            FrameworkElementFactory ring = new FrameworkElementFactory(typeof(Border));
            ring.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius > 0 ? radius + 5 : 0));
            ring.SetValue(Border.BorderThicknessProperty, new Thickness(1));
            ring.SetValue(Border.BorderBrushProperty, Ring);
            ring.SetValue(FrameworkElement.MarginProperty, new Thickness(-5));
            Style focus = new Style(typeof(Control));
            focus.Setters.Add(new Setter(Control.TemplateProperty, new ControlTemplate(typeof(Control)) { VisualTree = ring }));
            style.Setters.Add(new Setter(FrameworkElement.FocusVisualStyleProperty, focus));
            return style;
        }
        Button Way(string label)
        {
            Button button = new Button {
                Width = 220, Height = 54, Background = Paper, BorderBrush = Paper, BorderThickness = new Thickness(1), Foreground = Void,
                Padding = new Thickness(22, 0, 22, 0), HorizontalAlignment = HorizontalAlignment.Left, Cursor = Cursors.Hand,
                Style = FlatStyle(27, Brushes.White, null, Brushes.White, false)
            };
            button.Content = new TextBlock { Text = label, FontSize = 16, FontWeight = FontWeights.Medium };
            AutomationProperties.SetName(button, label);
            return button;
        }
        Button Quiet(string label)
        {
            Button button = new Button {
                Background = Brushes.Transparent, BorderBrush = QuietLine, BorderThickness = new Thickness(0, 0, 0, 1), Foreground = QuietInk,
                Padding = new Thickness(0, 0, 0, 4), Margin = new Thickness(0, 0, 26, 0), Cursor = Cursors.Hand,
                Style = FlatStyle(0, null, Paper, Paper, true)
            };
            button.Content = new TextBlock { Text = label, FontSize = 13, FontWeight = FontWeights.Normal, LineHeight = 17, LineStackingStrategy = LineStackingStrategy.BlockLineHeight };
            AutomationProperties.SetName(button, label);
            return button;
        }
        Button WindowButton(string name, string geometry, bool isClose)
        {
            Button button = new Button {
                Width = 44, Height = 32, Margin = new Thickness(2, 0, 0, 0), Background = Brushes.Transparent, BorderBrush = Brushes.Transparent, BorderThickness = new Thickness(0),
                Foreground = BarInk, Style = FlatStyle(8, isClose ? CloseHover : BarHover, Brushes.White, null, false), Focusable = true
            };
            ShapePath icon = new ShapePath { Data = Geometry.Parse(geometry), StrokeThickness = 1.6, StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round,
                Width = 18, Height = 18, Stretch = Stretch.None, IsHitTestVisible = false, RenderTransform = new ScaleTransform(0.75, 0.75) };
            icon.SetBinding(Shape.StrokeProperty, new Binding("Foreground") { RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor, typeof(Button), 1) });
            button.Content = icon;
            AutomationProperties.SetName(button, name);
            WindowChrome.SetIsHitTestVisibleInChrome(button, true);
            return button;
        }

        // ── 떠오르기(시작 창 .rise: 차례마다 95ms 늦게, 1초 동안 나타나고 1.2초 동안 10px 올라온다) ──
        readonly List<FrameworkElement> risers = new List<FrameworkElement>();
        FrameworkElement Rise(FrameworkElement element, int index)
        {
            element.Tag = index;
            element.Opacity = 0;
            element.RenderTransform = new TranslateTransform(0, 10);
            risers.Add(element);
            return element;
        }
        void ShowUi()
        {
            if (uiShown) return;
            uiShown = true;
            bool reduced = orb.Reduced;
            forge.BeginAnimation(OpacityProperty, new DoubleAnimation(1, reduced ? TimeSpan.Zero : TimeSpan.FromMilliseconds(900)) { BeginTime = TimeSpan.FromMilliseconds(reduced ? 0 : 50), EasingFunction = new CubicBezierEase(0.25, 0.1, 0.25, 1) });
            foreach (FrameworkElement element in risers) {
                int i = (int)element.Tag;
                TimeSpan begin = TimeSpan.FromMilliseconds(reduced ? 0 : i * 95 + 140);
                element.BeginAnimation(OpacityProperty, new DoubleAnimation(1, reduced ? TimeSpan.Zero : TimeSpan.FromSeconds(1)) { BeginTime = begin, EasingFunction = new CubicBezierEase(0.25, 0.1, 0.25, 1) });
                ((TranslateTransform)element.RenderTransform).BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(0, reduced ? TimeSpan.Zero : TimeSpan.FromMilliseconds(1200)) { BeginTime = begin, EasingFunction = new CubicBezierEase(0.2, 0.7, 0.2, 1) });
            }
        }

        void SetButtons()
        {
            way.Visibility = scene == Scene.Ready ? Visibility.Visible : Visibility.Collapsed;
            ((TextBlock)way.Content).Text = installed ? "다시 설치" : "설치";
            AutomationProperties.SetName(way, installed ? "다시 설치" : "설치");
            bool failure = scene == Scene.Failure || scene == Scene.LaunchFailure;
            retry.Visibility = scene == Scene.Failure && canRetry ? Visibility.Visible : Visibility.Collapsed;
            openApp.Visibility = scene == Scene.LaunchFailure ? Visibility.Visible : Visibility.Collapsed;
            close.Visibility = failure ? Visibility.Visible : Visibility.Collapsed;
            actions.Visibility = failure ? Visibility.Visible : Visibility.Collapsed;
            closeButton.IsEnabled = Closable;
            closeButton.ToolTip = Closable ? null : "설치를 마칠 때까지 창을 열어 두세요.";
            ToolTipService.SetShowOnDisabled(closeButton, true);
            SetVersionLine();
        }
        bool canRetry;

        // ── 장면 ──
        public void SetInstalled(bool exists) { installed = exists; if (scene == Scene.Ready || scene == Scene.Intro) ReadyCopy(); SetButtons(); }
        void ReadyCopy()
        {
            if (installed) SetCopy("SYNK를 같은 자리에 다시 설치합니다.", "계정과 기록은 그대로입니다. 끝나면 바로 열립니다.");
            else SetCopy("SYNK를 이 PC에 설치합니다.", "끝나면 바로 열립니다.");
        }
        /// <summary>처음 설치와 다시 설치의 준비. 아직 깎지 않은 매끈한 구가 드러나고 「설치」 하나만 묻는다(시안 installBoot)</summary>
        public void SetReady()
        {
            scene = Scene.Intro;
            ReadyCopy(); SetButtons();
            orb.Snap("void"); orb.ForgeAt(0); orb.SetCutOn(true, true); orb.EyesOff();
            Later(520, delegate {
                Later(1500, delegate { if (scene == Scene.Intro || scene == Scene.Ready) orb.EyesAsleep(); });
                orb.Tween("forge", 3000, OrbStage.EaseOut, delegate(double t, double a, double b) { return OrbStage.Lerp(a, b, OrbStage.Smooth(0, 0.62, t)); }, delegate {
                    if (scene != Scene.Intro) return;
                    scene = Scene.Ready; SetButtons(); ShowUi(); way.Focus();
                });
            });
        }
        /// <summary>
        /// 앱이 넘겨준 자동 업데이트. 받기가 끝난 절반 깎인 구에서 이어 깎는다(받기 0~50%, 바꾸기 50~100%).
        /// 넘김 쪽지가 있으면(instant) 앱 창과 가림막이 이미 같은 글을 보이고 있으므로 글을 떠오르게 하지 않고 바로 놓는다
        /// </summary>
        public void BeginAutomatic(bool instant = false, double cut = 0.5)
        {
            automatic = true; scene = Scene.Automatic;
            cut = Math.Max(0.5, Math.Min(0.99, Double.IsNaN(cut) ? 0.5 : cut));
            target = shown = cut;
            SetCopy("새 판으로 바꾸고 있습니다.", "끝나면 저절로 열립니다.");
            orb.ForgeAt(cut); orb.SetCutOn(true, true); orb.Snap("forge"); orb.EyesAsleep();
            SetButtons();
            if (instant) InstantUi(); else ShowUi();
            ticker.Start();
        }
        /// <summary>
        /// 가림막(2절): 앱 창의 마지막 장과 같은 구와 글을 그리기만 한다. 단추가 없고, 닫을 수 없고, 작업 표시줄에 없고, 앞으로 나서지 않는다.
        /// 깎기를 더 나아가게 하지 않는다(설치기가 이어받는다)
        /// </summary>
        public void BeginCurtain(double cut)
        {
            curtain = true; automatic = true; scene = Scene.Automatic;
            cut = Math.Max(0, Math.Min(1, Double.IsNaN(cut) ? 0.5 : cut));
            target = shown = cut;
            ShowInTaskbar = false; ShowActivated = false; Focusable = false; ResizeMode = ResizeMode.NoResize;
            windowBar.Visibility = Visibility.Collapsed;
            SetCopy("새 판으로 바꾸고 있습니다.", "끝나면 저절로 열립니다.");
            orb.ForgeAt(cut); orb.SetCutOn(true, true); orb.Snap("forge"); orb.EyesAsleep();
            SetButtons(); InstantUi();
        }
        public bool IsCurtain { get { return curtain; } }
        void InstantUi()
        {
            uiShown = true;
            forge.BeginAnimation(OpacityProperty, null); forge.Opacity = 1;
            foreach (FrameworkElement element in risers) { element.BeginAnimation(OpacityProperty, null); element.Opacity = 1; ((TranslateTransform)element.RenderTransform).BeginAnimation(TranslateTransform.YProperty, null); ((TranslateTransform)element.RenderTransform).Y = 0; }
        }

        // ── 화면 화소로 놓기(넘김 쪽지의 자리)와 겹침 순서 ──
        [DllImport("user32.dll", SetLastError = true)] static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out NativeRect rect);
        [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
        const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10, SWP_NOOWNERZORDER = 0x200;
        const int GWL_EXSTYLE = -20; const long WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x08000000, WS_EX_APPWINDOW = 0x40000;
        public IntPtr Handle { get { return new WindowInteropHelper(this).Handle; } }
        /// <summary>
        /// 넘김 쪽지의 자리(화면 화소)에 놓는다. below가 있으면 그 창 바로 아래에 놓아 겹침 순서를 지킨다(가림막은 앱 창 아래, 설치기는 가림막 아래).
        /// 최대화였으면 그 화면의 작업 영역으로 넓힌다. 창이 만들어진 뒤(SourceInitialized 뒤)에만 부른다
        /// </summary>
        public void PlacePhysical(HandoffNote note, IntPtr below)
        {
            IntPtr hwnd = Handle;
            if (hwnd == IntPtr.Zero || note == null || !note.HasBounds) return;
            uint flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER;
            bool order = below != IntPtr.Zero && IsWindow(below);
            if (!order) flags |= 0x4; // SWP_NOZORDER
            SetWindowPos(hwnd, order ? below : IntPtr.Zero, note.X, note.Y, note.Width, note.Height, flags);
            if (note.Maximized && !maximized) ToggleMaximize();
        }
        /// <summary>겹침 순서만 바꾼다: below 창 바로 아래로</summary>
        public void StackBelow(IntPtr below)
        {
            IntPtr hwnd = Handle;
            if (hwnd == IntPtr.Zero || below == IntPtr.Zero || !IsWindow(below)) return;
            SetWindowPos(hwnd, below, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER);
        }
        /// <summary>가림막: 작업 표시줄과 Alt+Tab에 나오지 않고, 눌러도 앞으로 나서지 않는다</summary>
        public void MakeInert()
        {
            IntPtr hwnd = Handle;
            if (hwnd == IntPtr.Zero) return;
            long style = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64();
            style = (style | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) & ~WS_EX_APPWINDOW;
            SetWindowLongPtr(hwnd, GWL_EXSTYLE, new IntPtr(style));
        }
        /// <summary>
        /// 도착 쪽지(6절)에 적을 이 창의 자리(화면 화소), 크기 상태, 마지막 장. 최대화한 창은 되돌릴 크기를 화면 화소로 바꿔 적는다
        /// </summary>
        public ArrivalNote Arrival(string kind, string visibility, string appVersion)
        {
            ArrivalNote note = new ArrivalNote { Kind = kind, Version = appVersion, Visibility = visibility ?? "front", Maximized = maximized, Cut = Math.Max(0, Math.Min(1, shown)), Lit = orb.Lit };
            IntPtr hwnd = Handle;
            NativeRect rect;
            if (!maximized && hwnd != IntPtr.Zero && GetWindowRect(hwnd, out rect)) { note.X = rect.Left; note.Y = rect.Top; note.Width = rect.Right - rect.Left; note.Height = rect.Bottom - rect.Top; }
            else {
                Rect dip = maximized ? restoreBounds : new Rect(Left, Top, Width, Height);
                PresentationSource source = PresentationSource.FromVisual(this);
                Matrix m = source != null && source.CompositionTarget != null ? source.CompositionTarget.TransformToDevice : Matrix.Identity;
                Point a = m.Transform(dip.TopLeft), b = m.Transform(dip.BottomRight);
                note.X = (int)Math.Round(a.X); note.Y = (int)Math.Round(a.Y); note.Width = (int)Math.Round(b.X - a.X); note.Height = (int)Math.Round(b.Y - a.Y);
            }
            return note;
        }
        void OnWay()
        {
            if (scene != Scene.Ready) return;
            scene = Scene.Installing; target = shown = 0; anyStage = false;
            SetCopy("설치하고 있습니다.", "끝나면 바로 열립니다.");
            SetButtons(); ticker.Start();
            EventHandler handler = InstallRequested; if (handler != null) handler(this, EventArgs.Empty);
        }
        void OnRetry()
        {
            if (scene != Scene.Failure || !canRetry) return;
            detailBox.Visibility = Visibility.Collapsed; Layout();
            orb.SetCutOn(true, false); orb.ForgeAt(0); orb.FadeLit(0.58, 600); orb.EyesAsleep();
            scene = Scene.Installing; target = shown = 0; anyStage = false;
            SetCopy("설치하고 있습니다.", "끝나면 바로 열립니다.");
            SetButtons(); ticker.Start();
            EventHandler handler = RetryRequested ?? InstallRequested; if (handler != null) handler(this, EventArgs.Empty);
        }
        void OnOpen()
        {
            if (scene != Scene.LaunchFailure) return;
            openApp.IsEnabled = false; ((TextBlock)openApp.Content).Text = "여는 중";
            EventHandler handler = LaunchRequested; if (handler != null) handler(this, EventArgs.Empty);
        }

        /// <summary>
        /// 엔진의 진행을 깎인 만큼으로 바꾼다(1-가 구현 설계 3절). 자동 업데이트는 50~100%, 처음 설치는 0~100%, 다시 설치는 백업이 앞에 있다.
        /// 백분율이 없는 단계는 시간에 따라 다가간다. 깎인 만큼은 뒤로 가지 않는다.
        /// </summary>
        public void ShowProgress(InstallProgress update)
        {
            if (update == null) throw new ArgumentNullException("update");
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<InstallProgress>(ShowProgress), update); return; }
            if (update.Stage == InstallStage.Restoring) {
                scene = Scene.Restoring; SetCopy("설치 전 상태로 되돌리고 있습니다.", "");
                orb.SetCutOn(false, false); orb.FadeLit(0.5, 900); orb.EyesAsleep(); SetButtons(); return;
            }
            if (update.Stage == InstallStage.Stopping) { SetCopy("설치가 너무 오래 걸려 멈추고 있습니다.", "멈춘 뒤 설치 전 상태로 되돌립니다."); timedStage = false; return; }
            if (scene != Scene.Installing && scene != Scene.Automatic) {
                scene = automatic ? Scene.Automatic : Scene.Installing;
                SetCopy(automatic ? "새 판으로 바꾸고 있습니다." : "설치하고 있습니다.", automatic ? "끝나면 저절로 열립니다." : "끝나면 바로 열립니다.");
                SetButtons(); ShowUi();
            }
            double pct = update.Percentage.HasValue ? Math.Max(0, Math.Min(100, update.Percentage.Value)) / 100.0 : -1;
            double from, to, tau = 0;
            if (!Share(update.Stage, out from, out to, out tau)) return;
            if (!anyStage || update.Stage != lastStage) { stageStart = DateTime.UtcNow; lastStage = update.Stage; anyStage = true; }
            if (pct >= 0) { timedStage = false; Want(from + (to - from) * pct); }
            else if (tau > 0) { timedStage = true; stageFrom = from; stageTo = to; stageTau = tau; Want(from); }
            else { timedStage = false; Want(from); }
            ticker.Start();
        }
        /// <summary>단계마다의 몫(3절의 표). tau가 있으면 백분율 없이 시간으로 다가간다</summary>
        bool Share(InstallStage stage, out double from, out double to, out double tau)
        {
            tau = 0; from = to = 0;
            if (automatic) {
                switch (stage) {
                    case InstallStage.AutomaticPreparation: case InstallStage.WaitingForApp: from = 0.50; to = 0.53; tau = 4; return true;
                    case InstallStage.BackingUp: from = 0.53; to = 0.70; return true;
                    case InstallStage.Preparing: from = 0.70; to = 0.78; return true;
                    case InstallStage.Installing: from = 0.78; to = 0.92; tau = 12; return true;
                    case InstallStage.Verifying: from = 0.92; to = 0.99; return true;
                }
                return false;
            }
            if (installed) {
                switch (stage) {
                    case InstallStage.BackingUp: from = 0; to = 0.25; return true;
                    case InstallStage.Preparing: from = 0.25; to = 0.40; return true;
                    case InstallStage.Installing: from = 0.40; to = 0.85; tau = 40; return true;
                    case InstallStage.Verifying: from = 0.85; to = 0.99; return true;
                }
                return false;
            }
            switch (stage) {
                case InstallStage.BackingUp: from = 0; to = 0; return true;
                case InstallStage.Preparing: from = 0; to = 0.20; return true;
                case InstallStage.Installing: from = 0.20; to = 0.80; tau = 40; return true;
                case InstallStage.Verifying: from = 0.80; to = 0.99; return true;
            }
            return false;
        }
        void Want(double p) { target = Math.Max(target, Math.Min(1, Math.Max(0, p))); }
        void Follow()
        {
            DateTime now = DateTime.UtcNow;
            double dt = Math.Min(0.25, (now - followAt).TotalSeconds); followAt = now;
            if (timedStage) Want(stageFrom + (stageTo - stageFrom) * (1 - Math.Exp(-(now - stageStart).TotalSeconds / stageTau)));
            if (shown < target) {
                shown = Math.Min(target, shown + dt * (orb.Reduced ? 10 : FollowPerSecond));
                orb.ForgeAt(shown); SetVersionLine();
            }
            if (fullyCut != null && shown >= 0.999) { TaskCompletionSource<bool> done = fullyCut; fullyCut = null; done.TrySetResult(true); }
            if (shown >= target && !timedStage && fullyCut == null && scene != Scene.Installing && scene != Scene.Automatic && scene != Scene.Finishing) ticker.Stop();
        }
        /// <summary>엔진이 끝났다. 남은 만큼을 정한 빠르기로 마저 깎는다. 3초를 넘기면 그 자리에서 다 깎는다(앱을 켜는 것을 오래 붙잡지 않는다)</summary>
        public Task FinishCut()
        {
            scene = Scene.Finishing; Want(1); SetButtons(); ticker.Start();
            TaskCompletionSource<bool> done = new TaskCompletionSource<bool>();
            if (shown >= 0.999) { done.SetResult(true); return done.Task; }
            fullyCut = done;
            Later(3000, delegate { if (fullyCut == done) { fullyCut = null; shown = 1; orb.ForgeAt(1); SetVersionLine(); done.TrySetResult(true); } });
            return done.Task;
        }

        void Failed(string a, string b, bool retryable, string details)
        {
            scene = Scene.Failure; canRetry = retryable; ticker.Stop(); timedStage = false;
            SetCopy(a, b);
            detail.Text = details ?? ""; detailBox.Visibility = String.IsNullOrWhiteSpace(details) ? Visibility.Collapsed : Visibility.Visible; Layout();
            AutomationProperties.SetName(detail, detail.Text);
            // 실패: 온전한 구가 어두워진 채 다가와 있다(시작 창 enterFailed, 시안 __orb.at('forge', {failed}))
            orb.SetCutOn(false, false); orb.FadeLit(0.5, 900); orb.EyesWake();
            if (orb.PoseName != "forge") orb.Tween("forge", 1500, OrbStage.EaseIO, delegate(double t, double a2, double b2) { return OrbStage.Lerp(a2, 0.5, OrbStage.Smooth(0, 0.8, t)); }, null);
            SetButtons(); ShowUi();
            (retryable ? retry : close).Focus();
        }

        /// <summary>손 설치의 실패. 엔진이 붙인 종류로 문장을 고른다(5절 설치기 표)</summary>
        public void ShowInstallFailure(Exception error)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<Exception>(ShowInstallFailure), error); return; }
            InstallFailure failure = error as InstallFailure;
            string kind = FailureKind.Of(error);
            if (failure != null && !failure.CanRetry) {
                Failed("설치하다 멈췄습니다.", "다시 설치하지 말고 SYNK에 알려 주세요.", false, "앱 파일이 어떤 상태인지 확인하지 못했습니다. 알릴 곳: " + Contact + Environment.NewLine + error.Message);
                return;
            }
            switch (kind) {
                case FailureKind.NotX64: Failed("이 PC에는 설치할 수 없습니다.", "64비트 Windows에서만 설치할 수 있습니다.", false, null); return;
                case FailureKind.AppRunning: Failed("SYNK가 켜져 있어 설치하지 못했습니다.", "SYNK를 닫은 뒤 다시 시도해 주세요.", true, null); return;
                case FailureKind.AllUsers: Failed("모든 Windows 계정용 SYNK가 이미 설치돼 있습니다.", "그 설치를 지운 뒤 다시 시도해 주세요.", true, null); return;
                case FailureKind.Newer: Failed("이 PC에 더 새 판이 이미 설치돼 있습니다.", "synk.im에서 새 설치 파일을 받아 주세요.", false, null); return;
                case FailureKind.Space: Failed("PC 저장 공간이 모자라 설치하지 못했습니다.", "공간을 비운 뒤 다시 시도해 주세요.", true, error.Message); return;
                case FailureKind.Damaged: Failed("설치 파일이 온전하지 않습니다.", "synk.im에서 설치 파일을 다시 받아 주세요.", false, null); return;
                case FailureKind.Timeout: Failed("설치가 너무 오래 걸려 멈췄습니다.", "설치 전 상태로 되돌렸습니다. 다시 시도해도 됩니다.", true, null); return;
                case FailureKind.Restored: Failed("설치를 마치지 못했습니다.", "설치 전 상태로 되돌렸습니다. 다시 시도해도 됩니다.", true, error.Message); return;
            }
            Failed("설치를 마치지 못했습니다.", "아래 내용을 확인한 뒤 다시 시도해 주세요.", true, error.Message);
        }
        /// <summary>설치와 바꾸기는 끝났는데 앱을 열지 못했다. 「열기」로 한 번 더 연다</summary>
        public void ShowLaunchFailure(Exception error)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<Exception>(ShowLaunchFailure), error); return; }
            scene = Scene.LaunchFailure; ticker.Stop();
            SetCopy(automatic ? "새 판으로 바꿨습니다." : "설치했습니다.", "앱을 열지 못했습니다.");
            detail.Text = error == null ? "" : error.Message; detailBox.Visibility = error == null ? Visibility.Collapsed : Visibility.Visible; Layout();
            openApp.IsEnabled = true; ((TextBlock)openApp.Content).Text = "열기"; AutomationProperties.SetName(openApp, "열기");
            orb.SetCutOn(false, false); orb.EyesWake();
            SetButtons(); ShowUi(); openApp.Focus();
        }
        /// <summary>
        /// 되돌린 뒤 쓰던 앱을 켜지 못했다(5절 설치기 표). 「쓰던 판 열기」 하나를 두고, 호스트가 잠시 뒤 한 번 더 켜 본다
        /// </summary>
        public void ShowRestoredLaunchFailure()
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action(ShowRestoredLaunchFailure)); return; }
            scene = Scene.LaunchFailure; ticker.Stop(); timedStage = false;
            SetCopy("새 판으로 바꾸지 못했습니다.", "쓰던 판은 그대로입니다.");
            detail.Text = ""; detailBox.Visibility = Visibility.Collapsed; Layout();
            openApp.IsEnabled = true; ((TextBlock)openApp.Content).Text = "쓰던 판 열기"; AutomationProperties.SetName(openApp, "쓰던 판 열기");
            orb.SetCutOn(false, false); orb.FadeLit(0.5, 900); orb.EyesWake();
            if (orb.PoseName != "forge") orb.Tween("forge", 1500, OrbStage.EaseIO, delegate(double t, double a2, double b2) { return OrbStage.Lerp(a2, 0.5, OrbStage.Smooth(0, 0.8, t)); }, null);
            SetButtons(); ShowUi(); openApp.Focus();
        }
        /// <summary>「잠시 뒤 한 번 더 켜 본다」: 사람이 이미 누르지 않았으면 여는 단추를 대신 누른다</summary>
        public void OpenAgain() { if (scene == Scene.LaunchFailure && openApp.IsEnabled) OnOpen(); }
        /// <summary>자동 업데이트가 끝 상태에 이르렀는데 사람이 알아야 할 것이 남았다(5절 설치기 표의 자동 업데이트 줄)</summary>
        public void ShowAutomaticResult(AutomaticUpdateResult result)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<AutomaticUpdateResult>(ShowAutomaticResult), result); return; }
            if (result.Restored) Failed("새 판으로 바꾸지 못했습니다.", "쓰던 판은 그대로입니다. 앱을 다시 열어 주세요.", false, null);
            else Failed("새 판으로 바꾸다 멈췄습니다.", "다시 설치하지 말고 SYNK에 알려 주세요.", false, "앱 파일이 어떤 상태인지 확인하지 못했습니다. 알릴 곳: " + Contact + Environment.NewLine + result.Message);
        }
        /// <summary>자동 업데이트를 시작한 뒤(READY 뒤) 엔진 밖으로 나온 예외. 앱이 60초 안에 꺼지지 않은 때가 여기로 온다</summary>
        public void ShowAutomaticError(Exception error)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<Exception>(ShowAutomaticError), error); return; }
            if (FailureKind.Of(error) == FailureKind.AppStillRunning) Failed("새 판으로 바꾸지 못했습니다.", "쓰던 SYNK가 켜져 있어 그대로 두었습니다.", false, null);
            else Failed("새 판으로 바꾸지 못했습니다.", "쓰던 판은 그대로입니다.", false, error.Message);
        }
        /// <summary>READY 전에 막힌 상태(지난 설치가 끝나지 않은 표시)를 만났다. 앱이 다시 만든 창에 가려지지 않게 맨 위에 둔다</summary>
        public void ShowBlocked(Exception error)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<Exception>(ShowBlocked), error); return; }
            Topmost = true;
            Failed("지난번 설치를 되돌렸는지 확인하지 못했습니다.", "다시 설치하지 말고 SYNK에 알려 주세요.", false, "알릴 곳: " + Contact + Environment.NewLine + error.Message);
        }
        /// <summary>호스트가 일을 마쳐 창을 닫는다(닫기 막기를 지나간다)</summary>
        public void CloseNow() { allowClose = true; Close(); }

        readonly List<KeyValuePair<DispatcherTimer, Action>> laters = new List<KeyValuePair<DispatcherTimer, Action>>();
        void Later(double ms, Action action)
        {
            DispatcherTimer timer = new DispatcherTimer(DispatcherPriority.Normal, Dispatcher) { Interval = TimeSpan.FromMilliseconds(orb.Reduced ? Math.Min(ms, 120) : ms) };
            KeyValuePair<DispatcherTimer, Action> item = new KeyValuePair<DispatcherTimer, Action>(timer, action);
            timer.Tick += delegate { timer.Stop(); if (laters.Remove(item)) action(); };
            laters.Add(item); timer.Start();
        }

        /// <summary>
        /// 창 검사(ui-check)가 부른다: 기다리던 일과 움직임을 모두 끝 모습으로 세운다. 창을 띄우지 않고 그리므로 타이머와 애니메이션이 돌지 않는다
        /// </summary>
        public void Settle()
        {
            for (int guard = 0; guard < 20; guard++) {
                orb.Settle();
                if (laters.Count == 0) break;
                KeyValuePair<DispatcherTimer, Action> item = laters[0]; laters.RemoveAt(0); item.Key.Stop(); item.Value();
            }
            orb.Settle();
            if (timedStage) Want(stageTo);
            shown = target; orb.ForgeAt(shown); SetVersionLine();
            if (fullyCut != null) { TaskCompletionSource<bool> done = fullyCut; fullyCut = null; done.TrySetResult(true); }
            if (uiShown) {
                forge.BeginAnimation(OpacityProperty, null); forge.Opacity = 1;
                foreach (FrameworkElement element in risers) { element.BeginAnimation(OpacityProperty, null); element.Opacity = 1; ((TranslateTransform)element.RenderTransform).BeginAnimation(TranslateTransform.YProperty, null); ((TranslateTransform)element.RenderTransform).Y = 0; }
            }
        }
    }
}
