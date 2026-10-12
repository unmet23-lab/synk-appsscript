using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;
using ShapePath = System.Windows.Shapes.Path;

namespace Synk.SignalInstaller
{
    /// <summary>
    /// 설치 창이 그리는 제품. 플랫폼·WORLD·워크스페이스는 같은 창에서 포스터의 사업 색·펠트 물건·큰 한글과 문구만 다르다.
    /// 사업 색과 글자색은 플랫폼 웹(experiences/synk-account/platform.css)의 --face·--on-face와 같다.
    /// 짧은 이름(ShortName)에는 「를」「가」가 붙는다(SYNK를·WORLD를·워크스페이스를).
    /// </summary>
    public sealed class SignalProduct
    {
        public string Id, ShortName, ProductName, Edition, Scope, Category, Name, Word, Lead, PosterResource, PosterLabel, Intro, CompleteText, NextStep;
        public double WordSize, WordLineHeight, WordTracking;
        public Color OnFace, Accent;

        public string LaunchLabel { get { return ShortName + " 열기"; } }
        public string WindowTitle { get { return ProductName + " 설치"; } }

        public static SignalProduct ById(string id)
        {
            switch (id) {
                case "world": return World();
                case "messenger": return Workspace();
                default: return Platform();
            }
        }

        public static SignalProduct Platform()
        {
            return new SignalProduct {
                Id = "platform", ShortName = "SYNK", ProductName = "SYNK Platform Preview", Edition = "PLATFORM",
                Scope = "SYNK · PLATFORM", Category = "ONE SYNK ID", Name = "SYNK Platform",
                // 큰 한글: 자간은 플랫폼 규칙 −.085em + 글자 수(3) × .01em
                Word = "플랫폼", WordSize = 86, WordLineHeight = 70, WordTracking = -.055,
                Lead = "앱과 회원 혜택을 한곳에서.", PosterResource = "art.poster-platform.png", PosterLabel = "청금석 면 위에 선 흰 펠트 synk 로고",
                Intro = "앱과 회원 혜택을 한곳에서 여는 SYNK 플랫폼이에요.\n지금 쓰는 Windows 계정에 바로 설치해요.",
                CompleteText = "SYNK 열기를 누르면 플랫폼이 열려요.\n다음부터는 시작 메뉴에서도 열 수 있어요.", NextStep = "SYNK ID 로그인",
                OnFace = Colors.White, Accent = Hex("#3D6BC9")
            };
        }

        public static SignalProduct World()
        {
            return new SignalProduct {
                Id = "world", ShortName = "WORLD", ProductName = "SYNK WORLD Preview", Edition = "WORLD",
                Scope = "SYNK · WORLD", Category = "PLAY · LEARN · CONNECT", Name = "SYNK WORLD",
                Word = "월드", WordSize = 112, WordLineHeight = 92, WordTracking = -.065,
                Lead = "놀면서 익히는 한국어.", PosterResource = "art.poster-world.png", PosterLabel = "코랄 면 위에 선 펠트 책",
                Intro = "놀면서 한국어를 익히는 SYNK WORLD예요.\n지금 쓰는 Windows 계정에 바로 설치해요.",
                CompleteText = "WORLD 열기를 누르면 바로 열려요.\nSYNK 플랫폼에서는 「설치 상태 확인」을 눌러 주세요.", NextStep = "플랫폼에서 확인",
                OnFace = Hex("#1E0E0A"), Accent = Hex("#F96859")
            };
        }

        public static SignalProduct Workspace()
        {
            return new SignalProduct {
                Id = "messenger", ShortName = "워크스페이스", ProductName = "SYNK Workspace Preview", Edition = "WORKSPACE",
                Scope = "SYNK · WORKSPACE", Category = "WORK · TEACH · CREATE", Name = "SYNK Workspace",
                Word = "워크\n스페이스", WordSize = 64, WordLineHeight = 58, WordTracking = -.05,
                Lead = "수업·대화·업무를 한곳에서.", PosterResource = "art.poster-messenger.png", PosterLabel = "먹색 면 위에 선 펠트 노트북",
                Intro = "수업·대화·업무를 한곳에서 여는 SYNK 워크스페이스예요.\n지금 쓰는 Windows 계정에 바로 설치해요.",
                CompleteText = "워크스페이스 열기를 누르면 바로 열려요.\nSYNK 플랫폼에서는 「설치 상태 확인」을 눌러 주세요.", NextStep = "플랫폼에서 확인",
                OnFace = Hex("#C5D6F5"), Accent = Hex("#3D6BC9")
            };
        }

        private static Color Hex(string value) { return (Color)ColorConverter.ConvertFromString(value); }
    }

    /// <summary>
    /// 설치 창 — 싱ㅋ 시그널 2(플랫폼 런처 desktop/renderer/launcher.css)와 같은 문법이다.
    /// 책상(#060709) 위 떠 있는 본문 판(#0C0D10) 안에 왼쪽 「플랫폼」 포스터(플랫폼 기본 사업 색 청금석 + 스튜디오 빛 + 그레인 +
    /// 흰 펠트 synk + 아주 큰 한글 + 기울인 상태 스티커)와 오른쪽 모노 눈썹·큰 제목·계기판·흰 알약 단추를 둔다.
    /// 설치 작업은 호스트(Program)가 맡고, 이 창은 상태만 그린다. 스스로 움직이는 효과는 없다.
    /// </summary>
    public sealed class SignalWindow : Window
    {
        private enum InstallerState { Ready, Installing, Complete, Failure }

        // 플랫폼 밤 토큰
        private static readonly Brush Desk = Solid("#060709");
        private static readonly Brush PanelFill = Solid("#0C0D10");
        private static readonly Brush Ink = Solid("#FAFAF9");
        private static readonly Brush Ink2 = Solid("#B8FAFAF9");
        private static readonly Brush Ink3 = Solid("#85FAFAF9");
        private static readonly Brush Ink4 = Solid("#38FAFAF9");
        private static readonly Brush Line = Solid("#13FFFFFF");
        private static readonly Brush Line2 = Solid("#24FFFFFF");
        private static readonly Brush OnInk = Solid("#08090C");
        private static readonly Brush Lapis = Solid("#3D6BC9");
        private static readonly Brush LapisLight = Solid("#C5D6F5");
        private static readonly Brush Butter = Solid("#F5C445");
        private static readonly Brush Green = Solid("#2E9E66");
        private static readonly Brush GreenLed = Solid("#6FD39B");
        private static readonly Brush Coral = Solid("#F96859");
        private static readonly Brush CoralText = Solid("#FFB3AA");
        private static readonly Brush White62 = Solid("#9EFFFFFF");
        private static readonly Brush White78 = Solid("#C7FFFFFF");
        private static readonly Brush White90 = Solid("#E6FFFFFF");
        private static readonly string[] Steps = { "준비", "설치", "확인" };

        private readonly FontFamily suit;
        private readonly GlyphTypeface suitMedium, suitBold, suitHeavy, interBold, mono;
        private readonly IList<GlyphTypeface> fallbacks;
        private readonly string version;
        private readonly SignalProduct product;
        private readonly Brush accent;

        private readonly TrackedText headline, stickerText;
        private readonly Ellipse stickerDot;
        private readonly TextBlock description, locationText, detail, failureText;
        private readonly TrackedText[] readoutTerms = new TrackedText[3], readoutValues = new TrackedText[3];
        private readonly FrameworkElement infoBlock, progressBlock, failureBlock;
        private readonly TrackedText statusTitle, statusMeter;
        private readonly ProgressBar progress;
        private readonly Ellipse[] stepDots = new Ellipse[3];
        private readonly TrackedText[] stepLabels = new TrackedText[3];
        private readonly Button primary, secondary, closeButton;
        private readonly TrackedText primaryLabel, secondaryLabel;
        private readonly Border primaryArrow;
        private readonly DispatcherTimer clock;
        private InstallerState state;
        private bool installed;
        private string location;
        private long requiredBytes = 3L * 1024 * 1024 * 1024;
        private int step;
        private int? percent;
        private DateTime stepStarted;

        public event EventHandler InstallRequested;
        public event EventHandler LaunchRequested;

        public SignalWindow(string fontDirectory, string version) : this(fontDirectory, version, null) { }

        public SignalWindow(string fontDirectory, string version, SignalProduct product)
        {
            this.product = product ?? SignalProduct.Platform();
            accent = new SolidColorBrush(this.product.Accent);
            accent.Freeze();
            // 빠지거나 굵기가 다른 글꼴은 포장 오류다. 다른 시스템 글꼴로 조용히 바꿔 그리지 않는다.
            IList<FontFamily> families = ReadFontFamilies(fontDirectory);
            suit = RequireFont(families, "SUIT", 500, 800, 900);
            FontFamily inter = RequireFont(families, "Inter Tight", 500, 700);
            FontFamily monoFamily = RequireFont(families, "DM Mono", 500);
            suitMedium = Face(suit, 500); suitBold = Face(suit, 800); suitHeavy = Face(suit, 900);
            interBold = Face(inter, 700); mono = Face(monoFamily, 500);
            fallbacks = new[] { suitMedium, Face(inter, 500), mono };
            this.version = String.IsNullOrWhiteSpace(version) ? "" : version.Trim();

            Title = this.product.WindowTitle;
            Width = 760;
            Height = 512;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            FontFamily = suit;
            FontWeight = FontWeights.Medium;
            Foreground = Ink;
            UseLayoutRounding = true;
            SnapsToDevicePixels = true;
            Language = System.Windows.Markup.XmlLanguage.GetLanguage("ko-KR");
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Display);
            AutomationProperties.SetName(this, Title);

            // 책상: 바깥 둥근 틀, 위 막대, 떠 있는 본문 판
            Border shell = new Border { CornerRadius = new CornerRadius(18), Background = Desk, BorderBrush = Solid("#1CFFFFFF"), BorderThickness = new Thickness(1) };
            Grid layout = new Grid();
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(46) });
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            shell.Child = layout;
            Content = shell;

            Grid titleBar = new Grid { Background = Brushes.Transparent };
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            titleBar.Children.Add(CreateLockup());
            titleBar.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs args) {
                if (args.ClickCount == 1 && Mouse.LeftButton == MouseButtonState.Pressed &&
                    !InsideButton(args.OriginalSource as DependencyObject)) DragMove();
            };
            Button minimize = WindowButton("최소화", "M 1,6 L 11,6");
            minimize.Click += delegate { WindowState = WindowState.Minimized; };
            Grid.SetColumn(minimize, 1);
            titleBar.Children.Add(minimize);
            closeButton = WindowButton("설치 창 닫기", "M 2,2 L 10,10 M 10,2 L 2,10");
            closeButton.Margin = new Thickness(2, 0, 10, 0);
            closeButton.Click += delegate { Close(); };
            Grid.SetColumn(closeButton, 2);
            titleBar.Children.Add(closeButton);
            layout.Children.Add(titleBar);

            Border panel = new Border {
                Margin = new Thickness(10, 0, 10, 10), Padding = new Thickness(12), CornerRadius = new CornerRadius(16),
                Background = PanelFill, BorderBrush = Line, BorderThickness = new Thickness(1)
            };
            Grid.SetRow(panel, 1);
            layout.Children.Add(panel);
            Grid body = new Grid();
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(308) });
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            panel.Child = body;

            // 왼쪽 포스터
            Grid poster = new Grid { Width = 308, Height = 428, VerticalAlignment = VerticalAlignment.Top };
            Image art = new Image { Source = LoadArt(this.product.PosterResource), Stretch = Stretch.Fill, Width = 308, Height = 428 };
            RenderOptions.SetBitmapScalingMode(art, BitmapScalingMode.HighQuality);
            AutomationProperties.SetName(art, this.product.PosterLabel);
            poster.Children.Add(art);
            // 포스터 글자는 사업 색 위 --on-face(플랫폼 흰색, WORLD 먹색, 워크스페이스 옅은 청금석)에 투명도만 달리한다
            Color onFace = this.product.OnFace;
            TrackedText scope = Text(mono, 9.5, .12, Tint(onFace, 0x9E), this.product.Scope);
            scope.Decorative = true;
            scope.Margin = new Thickness(20, 21, 0, 0);
            scope.HorizontalAlignment = HorizontalAlignment.Left;
            scope.VerticalAlignment = VerticalAlignment.Top;
            poster.Children.Add(scope);
            // 상태 스티커: 흰 알약을 살짝 기울여 붙인다(플랫폼 .product-stage). 점 색이 설치 상태를 말한다
            StackPanel stickerRow = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            stickerDot = new Ellipse { Width = 7, Height = 7, Fill = accent, Margin = new Thickness(0, 0, 7, 0), VerticalAlignment = VerticalAlignment.Center };
            stickerRow.Children.Add(stickerDot);
            stickerText = Text(suitBold, 11, -.01, OnInk, "설치 준비");
            stickerText.VerticalAlignment = VerticalAlignment.Center;
            stickerRow.Children.Add(stickerText);
            Border sticker = new Border {
                Background = Ink, CornerRadius = new CornerRadius(13), Height = 26, Padding = new Thickness(11, 0, 12, 0),
                HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 16, 16, 0),
                RenderTransformOrigin = new Point(.5, .5), RenderTransform = new RotateTransform(-2.5), Child = stickerRow,
                Effect = new DropShadowEffect { Color = Colors.Black, BlurRadius = 18, ShadowDepth = 6, Direction = 270, Opacity = .24 }
            };
            AutomationProperties.SetLiveSetting(stickerText, AutomationLiveSetting.Polite);
            poster.Children.Add(sticker);
            StackPanel posterText = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom, Margin = new Thickness(20, 0, 20, 21) };
            TrackedText category = Text(mono, 9.5, .16, Tint(onFace, 0xC7), this.product.Category);
            category.Decorative = true;
            posterText.Children.Add(category);
            TrackedText name = Text(interBold, 13, .02, Tint(onFace, 0xE6), this.product.Name);
            name.Margin = new Thickness(0, 8, 0, 0);
            posterText.Children.Add(name);
            // 큰 한글: 자간은 플랫폼 규칙 −.085em + 글자 수 × .01em
            TrackedText word = Text(suitHeavy, this.product.WordSize, this.product.WordTracking, onFace == Colors.White ? Ink : Tint(onFace, 0xFF), this.product.Word, this.product.WordLineHeight);
            word.Margin = new Thickness(-4, 10, 0, 0);
            posterText.Children.Add(word);
            TrackedText lead = Text(suitBold, 13, -.015, Tint(onFace, 0xF0), this.product.Lead);
            lead.Margin = new Thickness(0, 12, 0, 0);
            posterText.Children.Add(lead);
            poster.Children.Add(posterText);
            body.Children.Add(poster);

            // 오른쪽 내용
            Grid content = new Grid { Margin = new Thickness(30, 8, 6, 0) };
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            Grid.SetColumn(content, 1);
            body.Children.Add(content);

            // 모노 눈썹 + 가는 선(플랫폼 「YOUR SYNK ──」)
            StackPanel eyebrow = new StackPanel { Orientation = Orientation.Horizontal };
            TrackedText eyebrowText = Text(mono, 10, .16, Ink3, ("WINDOWS · PREVIEW " + this.version).Trim());
            eyebrowText.VerticalAlignment = VerticalAlignment.Center;
            eyebrow.Children.Add(eyebrowText);
            eyebrow.Children.Add(new Border { Width = 44, Height = 1, Background = Line2, Margin = new Thickness(12, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center });
            content.Children.Add(eyebrow);

            headline = Text(suitHeavy, 36, -.05, Ink, "", 42);
            headline.Margin = new Thickness(-1, 20, 0, 0);
            AutomationProperties.SetLiveSetting(headline, AutomationLiveSetting.Polite);
            Grid.SetRow(headline, 1);
            content.Children.Add(headline);

            description = Paragraph(13.5, Ink3, 21);
            description.Margin = new Thickness(0, 12, 0, 0);
            Grid.SetRow(description, 2);
            content.Children.Add(description);

            Grid status = new Grid { VerticalAlignment = VerticalAlignment.Bottom, Margin = new Thickness(0, 14, 0, 22) };
            Grid.SetRow(status, 3);
            content.Children.Add(status);
            infoBlock = CreateInfo(out locationText);
            status.Children.Add(infoBlock);
            progressBlock = CreateProgress(out statusTitle, out statusMeter, out progress, out detail);
            status.Children.Add(progressBlock);
            failureBlock = CreateFailure(out failureText);
            status.Children.Add(failureBlock);

            Grid actions = new Grid();
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            secondaryLabel = Text(suitBold, 14, -.015, Ink2, "나중에");
            secondaryLabel.Decorative = true;
            secondary = Pill(false, secondaryLabel);
            secondary.MinWidth = 96;
            secondary.Click += delegate { Close(); };
            actions.Children.Add(secondary);
            DockPanel primaryContent = new DockPanel { LastChildFill = false };
            primaryArrow = new Border {
                Width = 36, Height = 36, CornerRadius = new CornerRadius(18), Background = OnInk, Margin = new Thickness(18, 0, 0, 0),
                Child = new ShapePath { Data = Geometry.Parse("M 1,7 L 13,7 M 8,2 L 13,7 L 8,12"), Stroke = Ink, StrokeThickness = 1.7,
                    StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round,
                    Width = 14, Height = 14, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center }
            };
            DockPanel.SetDock(primaryArrow, Dock.Right);
            primaryContent.Children.Add(primaryArrow);
            primaryLabel = Text(suitBold, 14.5, -.02, OnInk, "설치하기");
            primaryLabel.Decorative = true;
            primaryLabel.VerticalAlignment = VerticalAlignment.Center;
            DockPanel.SetDock(primaryLabel, Dock.Left);
            primaryContent.Children.Add(primaryLabel);
            primary = Pill(true, primaryContent);
            primary.MinWidth = 176;
            primary.IsDefault = true;
            primary.Click += OnPrimaryClick;
            Grid.SetColumn(primary, 2);
            actions.Children.Add(primary);
            Grid.SetRow(actions, 4);
            content.Children.Add(actions);

            clock = new DispatcherTimer(DispatcherPriority.Background, Dispatcher) { Interval = TimeSpan.FromSeconds(1) };
            clock.Tick += delegate { UpdateMeter(); };

            Closing += OnClosing;
            PreviewKeyDown += delegate(object sender, KeyEventArgs args) {
                if (args.Key == Key.Escape) {
                    args.Handled = true;
                    if (state == InstallerState.Installing) ExplainCloseGuard(); else Close();
                }
            };
            Loaded += delegate { primary.Focus(); };
            SetReady();
        }

        public void SetInstalled(bool exists)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<bool>(SetInstalled), exists); return; }
            installed = exists;
            if (state == InstallerState.Ready) SetReady();
        }

        /// <summary>설치 위치와 필요한 공간을 준비 화면에 보인다. 위치를 몰라도 설치는 엔진이 다시 확인한다.</summary>
        public void SetInstallLocation(string directory, long minimumFreeBytes)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<string, long>(SetInstallLocation), directory, minimumFreeBytes); return; }
            location = String.IsNullOrWhiteSpace(directory) ? null : directory.Trim();
            if (minimumFreeBytes > 0) requiredBytes = minimumFreeBytes;
            if (state == InstallerState.Ready || state == InstallerState.Complete) RefreshInfo();
        }

        public void SetReady()
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action(SetReady)); return; }
            state = InstallerState.Ready;
            clock.Stop();
            SetHeadline(product.ShortName + (installed ? "를,\n다시 설치해요." : "를,\n내 PC에."));
            description.Text = installed
                ? "설치된 " + product.ShortName + "를 같은 자리에 다시 설치해요.\n계정과 앱 기록은 그대로 남아요."
                : product.Intro;
            SetSticker(installed ? "다시 설치" : "설치 준비", accent);
            ShowBlock(infoBlock);
            RefreshInfo();
            SetButtons(installed ? "다시 설치하기" : "설치하기", "나중에", true);
        }

        public void ShowProgress(string title, string detailText, int? percentage)
        {
            if (!Dispatcher.CheckAccess()) {
                Dispatcher.Invoke(new Action<string, string, int?>(ShowProgress), title, detailText, percentage); return;
            }
            bool entering = state != InstallerState.Installing;
            state = InstallerState.Installing;
            if (entering) {
                SetHeadline("설치하고\n있어요.");
                description.Text = "끝날 때까지 이 창을 열어 두세요.\n파일을 넣는 동안에는 창을 닫을 수 없어요.";
                SetSticker("설치 중", Butter);
                ShowBlock(progressBlock);
                SetButtons("설치 중", "나중에", false);
                step = 0;
            }
            int next = StepOf(title);
            if (next == 0) next = Math.Max(step, 1);
            if (next != step) { step = next; stepStarted = DateTime.UtcNow; }
            percent = percentage.HasValue ? (int?)Math.Max(0, Math.Min(100, percentage.Value)) : null;
            statusTitle.Text = StepTitle(step, title);
            detail.Text = StepDetail(step, detailText);
            progress.IsIndeterminate = !percent.HasValue;
            progress.Value = percent.HasValue ? percent.Value : 0;
            for (int i = 0; i < 3; i++) {
                bool done = i + 1 < step, current = i + 1 == step;
                stepDots[i].Fill = done ? GreenLed : current ? Butter : Ink4;
                stepLabels[i].Foreground = done ? Ink3 : current ? Ink : Ink4;
            }
            UpdateMeter();
            if (!clock.IsEnabled) clock.Start();
            if (entering) Announce(headline);
            Announce(statusTitle);
        }

        public void ShowComplete()
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action(ShowComplete)); return; }
            state = InstallerState.Complete;
            clock.Stop();
            SetHeadline("설치가\n끝났어요.");
            description.Text = product.CompleteText;
            SetSticker("설치됨", Green);
            ShowBlock(infoBlock);
            RefreshInfo();
            SetButtons(product.LaunchLabel, "나중에 열기", true);
            primary.Focus();
            Announce(headline);
        }

        public void ShowFailure(string message)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<string>(ShowFailure), message); return; }
            state = InstallerState.Failure;
            clock.Stop();
            SetHeadline("설치를\n마치지 못했어요.");
            description.Text = "아래 내용을 확인한 뒤 다시 시도해 주세요.\n이 설치 파일은 나중에 다시 열어도 돼요.";
            SetSticker("확인 필요", Coral);
            failureText.Text = String.IsNullOrWhiteSpace(message) ? "설치 파일을 다시 실행해 주세요." : message.Trim();
            failureText.ToolTip = failureText.Text;
            AutomationProperties.SetName(failureText, failureText.Text);
            ShowBlock(failureBlock);
            SetButtons("다시 시도", "닫기", true);
            primary.Focus();
            Announce(failureText);
        }

        private void OnPrimaryClick(object sender, RoutedEventArgs args)
        {
            if (state == InstallerState.Installing) return;
            if (state == InstallerState.Complete) {
                primary.IsEnabled = false;
                primaryLabel.Text = "여는 중";
                AutomationProperties.SetName(primary, product.ShortName + " 여는 중");
                EventHandler launch = LaunchRequested;
                if (launch != null) launch(this, EventArgs.Empty);
                else ShowComplete();
                return;
            }
            ShowProgress("설치를 시작하는 중", "잠시만 기다려 주세요.", null);
            EventHandler install = InstallRequested;
            if (install != null) install(this, EventArgs.Empty);
            else ShowFailure("설치를 시작하지 못했습니다. 설치 파일을 다시 실행해 주세요.");
        }

        private void SetButtons(string primaryText, string secondaryText, bool enabled)
        {
            primaryLabel.Text = primaryText;
            secondaryLabel.Text = secondaryText;
            primary.IsEnabled = enabled;
            secondary.IsEnabled = enabled;
            closeButton.IsEnabled = enabled;
            // 쓸 수 없는 주 단추는 회색 판이 아니라 조용한 선 알약으로(자리·크기는 그대로)
            primary.Background = enabled ? Ink : Brushes.Transparent;
            primary.BorderBrush = enabled ? Brushes.Transparent : Line2;
            primaryLabel.Foreground = enabled ? OnInk : Ink3;
            primaryArrow.Visibility = enabled ? Visibility.Visible : Visibility.Collapsed;
            secondaryLabel.Foreground = enabled ? Ink2 : Ink4;
            AutomationProperties.SetName(primary, primaryText);
            AutomationProperties.SetName(secondary, secondaryText);
            closeButton.ToolTip = enabled ? "닫기" : "설치를 마칠 때까지 창을 열어 두세요.";
            ToolTipService.SetShowOnDisabled(closeButton, true);
            secondary.ToolTip = enabled ? null : "설치를 마칠 때까지 잠시 기다려 주세요.";
            ToolTipService.SetShowOnDisabled(secondary, true);
        }

        private void OnClosing(object sender, CancelEventArgs args)
        {
            if (state == InstallerState.Installing) {
                args.Cancel = true;
                ExplainCloseGuard();
            }
            else clock.Stop();
        }

        private void ExplainCloseGuard()
        {
            detail.Text = "설치가 끝나면 창을 닫을 수 있어요. 조금만 기다려 주세요.";
            Announce(detail);
        }

        private void SetHeadline(string value)
        {
            headline.Text = value;
            AutomationProperties.SetName(headline, value.Replace("\n", " "));
        }

        private void SetSticker(string text, Brush dot)
        {
            stickerText.Text = text;
            stickerDot.Fill = dot;
            AutomationProperties.SetName(stickerText, "설치 상태: " + text);
        }

        private void ShowBlock(FrameworkElement visible)
        {
            foreach (FrameworkElement block in new[] { infoBlock, progressBlock, failureBlock })
                block.Visibility = block == visible ? Visibility.Visible : Visibility.Collapsed;
        }

        private void RefreshInfo()
        {
            locationText.Text = location == null ? "현재 Windows 계정의 프로그램 폴더" : ShortPath(location);
            locationText.ToolTip = location;
            if (state == InstallerState.Complete) {
                SetReadout(0, "VERSION", version.Length == 0 ? "Preview" : version);
                SetReadout(1, "CHECK", "파일 확인 끝");
                SetReadout(2, "NEXT", product.NextStep);
            } else {
                SetReadout(0, "REQUIRED", "약 " + Size(requiredBytes));
                SetReadout(1, "AVAILABLE", FreeSpace());
                SetReadout(2, "ADMIN", "필요 없음");
            }
        }

        private void SetReadout(int index, string term, string value)
        {
            readoutTerms[index].Text = term;
            readoutValues[index].Text = value;
            AutomationProperties.SetName(readoutValues[index], ReadoutName(term) + " " + value);
        }

        private static string ReadoutName(string term)
        {
            switch (term) {
                case "REQUIRED": return "필요한 공간";
                case "AVAILABLE": return "남은 공간";
                case "ADMIN": return "관리자 권한";
                case "VERSION": return "버전";
                case "CHECK": return "설치 확인";
                case "NEXT": return "다음 할 일";
                default: return term;
            }
        }

        private string FreeSpace()
        {
            try {
                string root = System.IO.Path.GetPathRoot(location ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
                return String.IsNullOrEmpty(root) ? "확인 못 함" : Size(new DriveInfo(root).AvailableFreeSpace);
            } catch (Exception) { return "확인 못 함"; }
        }

        private static string Size(long bytes)
        {
            double gib = bytes / (1024.0 * 1024 * 1024);
            if (gib >= 10) return Math.Round(gib).ToString("0", CultureInfo.InvariantCulture) + "GB";
            if (gib >= 1) return gib.ToString("0.#", CultureInfo.InvariantCulture) + "GB";
            return Math.Max(1, Math.Round(bytes / (1024.0 * 1024))).ToString("0", CultureInfo.InvariantCulture) + "MB";
        }

        private static string ShortPath(string path)
        {
            if (path.Length <= 46) return path;
            string[] parts = path.Split('\\');
            if (parts.Length <= 4) return path;
            return parts[0] + "\\" + parts[1] + "\\…\\" + parts[parts.Length - 2] + "\\" + parts[parts.Length - 1];
        }

        private int StepOf(string title)
        {
            if (title == null) return 0;
            if (title.StartsWith("설치를 준비", StringComparison.Ordinal) || title.StartsWith("설치를 시작", StringComparison.Ordinal)) return 1;
            if (title.StartsWith(product.ShortName + "를 설치", StringComparison.Ordinal)) return 2;
            if (title.StartsWith("설치를 확인", StringComparison.Ordinal)) return 3;
            return 0;
        }

        private static string StepTitle(int value, string fallback)
        {
            switch (value) {
                case 1: return "설치 파일을 준비하고 있어요";
                case 2: return "앱 파일을 넣고 있어요";
                case 3: return "설치된 파일을 확인하고 있어요";
                default: return String.IsNullOrWhiteSpace(fallback) ? "설치하는 중" : fallback;
            }
        }

        private string StepDetail(int value, string fallback)
        {
            switch (value) {
                case 1: return "받은 설치 파일을 풀고 손상되지 않았는지 확인해요.";
                case 2: return "이 단계는 진행률 대신 걸린 시간을 보여 드려요.";
                case 3: return product.ShortName + "를 열기 전에 설치된 파일을 하나씩 확인해요.";
                default: return fallback ?? "";
            }
        }

        private void UpdateMeter()
        {
            if (state != InstallerState.Installing) { clock.Stop(); return; }
            if (percent.HasValue) { statusMeter.Text = percent.Value.ToString(CultureInfo.InvariantCulture) + "%"; return; }
            TimeSpan spent = DateTime.UtcNow - stepStarted;
            if (spent < TimeSpan.Zero) spent = TimeSpan.Zero;
            statusMeter.Text = "경과 " + ((int)spent.TotalMinutes).ToString(CultureInfo.InvariantCulture) + ":" + spent.Seconds.ToString("00", CultureInfo.InvariantCulture);
            // 진행률이 없는 단계가 길어지면 멈춘 것이 아니라 계속 진행 중이라고 알린다
            if (step == 2 && spent.TotalSeconds >= 30 && detail.Text == StepDetail(2, null))
                detail.Text = "조금 더 걸리고 있어요. 설치는 계속 진행 중이에요.";
        }

        // ── 부품 ─────────────────────────────────────────

        private FrameworkElement CreateLockup()
        {
            StackPanel lockup = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(20, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            // 승인된 싱ㅋ 글자 모양 그대로. 글자로 다시 만들지 않는다.
            Canvas logo = new Canvas { Width = 560, Height = 328 };
            string[] paths = {
                "M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z",
                "M222 8h58v172h-58Z",
                "F0 M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z",
                "M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"
            };
            foreach (string path in paths) logo.Children.Add(new ShapePath { Data = Geometry.Parse(path), Fill = Ink });
            Viewbox mark = new Viewbox { Child = logo, Stretch = Stretch.Uniform, Height = 18, VerticalAlignment = VerticalAlignment.Center };
            AutomationProperties.SetName(mark, "싱ㅋ");
            lockup.Children.Add(mark);
            TrackedText edition = Text(mono, 8.5, .2, Ink3, product.Edition);
            edition.Decorative = true;
            lockup.Children.Add(new Border {
                Margin = new Thickness(11, 0, 0, 0), Padding = new Thickness(8, 4, 7, 4), CornerRadius = new CornerRadius(999),
                BorderBrush = Line2, BorderThickness = new Thickness(1), VerticalAlignment = VerticalAlignment.Center, Child = edition
            });
            return lockup;
        }

        private FrameworkElement CreateInfo(out TextBlock path)
        {
            StackPanel info = new StackPanel();
            DockPanel where = new DockPanel { Margin = new Thickness(0, 0, 0, 14) };
            TrackedText term = Text(mono, 9, .14, Ink3, "LOCATION");
            term.Decorative = true;
            term.VerticalAlignment = VerticalAlignment.Center;
            term.Width = 86;
            DockPanel.SetDock(term, Dock.Left);
            where.Children.Add(term);
            path = new TextBlock { FontFamily = suit, FontSize = 12.5, FontWeight = FontWeights.Medium, Foreground = Ink2, TextTrimming = TextTrimming.CharacterEllipsis, VerticalAlignment = VerticalAlignment.Center };
            AutomationProperties.SetHelpText(path, "설치 위치");
            where.Children.Add(path);
            info.Children.Add(where);
            // 계기판: 1px 세로선으로 나눈 세 칸(플랫폼 실행 줄의 숫자판)
            Grid readouts = new Grid { Margin = new Thickness(0, 0, 0, 0) };
            Border top = new Border { Height = 1, Background = Line, VerticalAlignment = VerticalAlignment.Top };
            Grid.SetColumnSpan(top, 3);
            for (int i = 0; i < 3; i++) {
                readouts.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                StackPanel cell = new StackPanel { Margin = new Thickness(i == 0 ? 0 : 16, 14, 0, 0) };
                readoutTerms[i] = Text(mono, 9, .14, Ink3, "");
                readoutTerms[i].Decorative = true;
                cell.Children.Add(readoutTerms[i]);
                readoutValues[i] = Text(suitBold, 14, -.015, Ink, "");
                readoutValues[i].Margin = new Thickness(0, 7, 0, 0);
                cell.Children.Add(readoutValues[i]);
                Border column = new Border { Child = cell, BorderBrush = Line2, BorderThickness = new Thickness(i == 0 ? 0 : 1, 0, 0, 0), Margin = new Thickness(0, 0, 0, 0) };
                Grid.SetColumn(column, i);
                readouts.Children.Add(column);
            }
            readouts.Children.Add(top);
            info.Children.Add(readouts);
            return info;
        }

        private FrameworkElement CreateProgress(out TrackedText title, out TrackedText meter, out ProgressBar bar, out TextBlock note)
        {
            StackPanel block = new StackPanel();
            // 세 단계: 지금 단계는 버터 점, 지난 단계는 초록 점
            StackPanel steps = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 16) };
            for (int i = 0; i < 3; i++) {
                if (i > 0) steps.Children.Add(new Border { Width = 18, Height = 1, Background = Line2, Margin = new Thickness(10, 0, 10, 0), VerticalAlignment = VerticalAlignment.Center });
                stepDots[i] = new Ellipse { Width = 6, Height = 6, Fill = Ink4, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 7, 0) };
                steps.Children.Add(stepDots[i]);
                TrackedText number = Text(mono, 9.5, .1, Ink3, "0" + (i + 1).ToString(CultureInfo.InvariantCulture));
                number.Decorative = true;
                number.VerticalAlignment = VerticalAlignment.Center;
                number.Margin = new Thickness(0, 0, 6, 0);
                steps.Children.Add(number);
                stepLabels[i] = Text(suitBold, 12.5, -.01, Ink4, Steps[i]);
                stepLabels[i].VerticalAlignment = VerticalAlignment.Center;
                steps.Children.Add(stepLabels[i]);
            }
            block.Children.Add(steps);
            Grid heading = new Grid();
            heading.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            heading.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            title = Text(suitBold, 14, -.015, Ink, "");
            AutomationProperties.SetLiveSetting(title, AutomationLiveSetting.Polite);
            heading.Children.Add(title);
            meter = Text(mono, 11, .04, Ink2, "");
            meter.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(meter, 1);
            heading.Children.Add(meter);
            block.Children.Add(heading);
            bar = new ProgressBar { Minimum = 0, Maximum = 100, Height = 8, Margin = new Thickness(0, 11, 0, 10), Template = SegmentTemplate() };
            AutomationProperties.SetName(bar, product.ShortName + " 설치 진행률");
            block.Children.Add(bar);
            note = Paragraph(12.5, Ink3, 19);
            note.MinHeight = 19;
            block.Children.Add(note);
            return block;
        }

        private FrameworkElement CreateFailure(out TextBlock message)
        {
            Border card = new Border { CornerRadius = new CornerRadius(14), Background = Solid("#1AF96859"), BorderBrush = Solid("#4DF96859"), BorderThickness = new Thickness(1), Padding = new Thickness(15, 13, 15, 14) };
            StackPanel stack = new StackPanel();
            StackPanel head = new StackPanel { Orientation = Orientation.Horizontal };
            head.Children.Add(new Ellipse { Width = 6, Height = 6, Fill = Coral, Margin = new Thickness(0, 0, 9, 0), VerticalAlignment = VerticalAlignment.Center });
            head.Children.Add(Text(suitBold, 13.5, -.015, CoralText, "확인할 내용"));
            stack.Children.Add(head);
            // 긴 문구는 네 줄까지 보이고 말줄임, 전체 문구는 손을 올리면(그리고 화면 읽기 프로그램에) 그대로 나온다
            message = Paragraph(12.5, Ink2, 19);
            message.Margin = new Thickness(15, 6, 0, 0);
            message.MaxHeight = 76;
            message.TextTrimming = TextTrimming.WordEllipsis;
            AutomationProperties.SetLiveSetting(message, AutomationLiveSetting.Assertive);
            stack.Children.Add(message);
            card.Child = stack;
            return card;
        }

        /// <summary>점 막대 진행률(플랫폼 .download-row progress): 7px 칸 + 3px 틈. 진행률을 모르면 옅은 칸으로 「진행 중」만 보인다.</summary>
        private static ControlTemplate SegmentTemplate()
        {
            ControlTemplate template = new ControlTemplate(typeof(ProgressBar));
            FrameworkElementFactory grid = new FrameworkElementFactory(typeof(Grid));
            FrameworkElementFactory track = new FrameworkElementFactory(typeof(Border), "PART_Track");
            track.SetValue(Border.BackgroundProperty, Segments(Solid("#1AFFFFFF")));
            grid.AppendChild(track);
            FrameworkElementFactory indicator = new FrameworkElementFactory(typeof(Border), "PART_Indicator");
            indicator.SetValue(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Left);
            indicator.SetValue(Border.BackgroundProperty, Segments(LapisLight));
            grid.AppendChild(indicator);
            template.VisualTree = grid;
            Trigger busy = new Trigger { Property = ProgressBar.IsIndeterminateProperty, Value = true };
            busy.Setters.Add(new Setter(Border.BackgroundProperty, Segments(Solid("#59C5D6F5")), "PART_Track"));
            busy.Setters.Add(new Setter(UIElement.VisibilityProperty, Visibility.Collapsed, "PART_Indicator"));
            template.Triggers.Add(busy);
            return template;
        }

        private static Brush Segments(Brush fill)
        {
            DrawingBrush brush = new DrawingBrush(new GeometryDrawing(fill, null, new RectangleGeometry(new Rect(0, 0, 7, 8), 1.5, 1.5))) {
                TileMode = TileMode.Tile, Viewport = new Rect(0, 0, 10, 8), ViewportUnits = BrushMappingMode.Absolute,
                Viewbox = new Rect(0, 0, 10, 8), ViewboxUnits = BrushMappingMode.Absolute, Stretch = Stretch.None,
                AlignmentX = AlignmentX.Left, AlignmentY = AlignmentY.Top
            };
            brush.Freeze();
            return brush;
        }

        private TrackedText Text(GlyphTypeface face, double size, double trackingEm, Brush brush, string value)
        {
            return Text(face, size, trackingEm, brush, value, 0);
        }

        private TrackedText Text(GlyphTypeface face, double size, double trackingEm, Brush brush, string value, double lineHeight)
        {
            TrackedText text = new TrackedText(face, size, trackingEm, brush, lineHeight, fallbacks);
            text.Text = value;
            return text;
        }

        private TextBlock Paragraph(double size, Brush brush, double lineHeight)
        {
            return new TextBlock {
                FontFamily = suit, FontSize = size, FontWeight = FontWeights.Medium, Foreground = brush, TextWrapping = TextWrapping.Wrap,
                LineHeight = lineHeight, LineStackingStrategy = LineStackingStrategy.BlockLineHeight
            };
        }

        private Button WindowButton(string name, string geometry)
        {
            Button button = new Button {
                Width = 34, Height = 30, Padding = new Thickness(0), Background = Brushes.Transparent, BorderBrush = Brushes.Transparent,
                BorderThickness = new Thickness(0), Cursor = Cursors.Hand, Style = ButtonStyle(false, 8, Solid("#12FFFFFF")),
                VerticalAlignment = VerticalAlignment.Center
            };
            button.Content = new ShapePath {
                Data = Geometry.Parse(geometry), Stroke = Ink3, StrokeThickness = 1.35, Width = 12, Height = 12,
                HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center
            };
            button.ToolTip = name;
            AutomationProperties.SetName(button, name);
            return button;
        }

        private Button Pill(bool isPrimary, object content)
        {
            return new Button {
                Content = content, Height = 48, Padding = isPrimary ? new Thickness(22, 0, 6, 0) : new Thickness(20, 0, 20, 0),
                Background = isPrimary ? Ink : Brushes.Transparent, BorderBrush = isPrimary ? Brushes.Transparent : Line2,
                BorderThickness = new Thickness(1), Cursor = Cursors.Hand,
                HorizontalContentAlignment = isPrimary ? HorizontalAlignment.Stretch : HorizontalAlignment.Center,
                Style = ButtonStyle(isPrimary, 24, isPrimary ? LapisLight : Solid("#0FFFFFFF"))
            };
        }

        /// <summary>알약 단추: 손을 올리면 주 단추는 옅은 청금석, 보조는 옅은 흰 판.</summary>
        private static Style ButtonStyle(bool isPrimary, double radius, Brush hover)
        {
            Style style = new Style(typeof(Button));
            FrameworkElementFactory root = new FrameworkElementFactory(typeof(Grid));
            FrameworkElementFactory surface = new FrameworkElementFactory(typeof(Border), "Surface");
            surface.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            surface.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            surface.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            surface.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            surface.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Control.PaddingProperty));
            FrameworkElementFactory presenter = new FrameworkElementFactory(typeof(ContentPresenter));
            presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, new TemplateBindingExtension(Control.HorizontalContentAlignmentProperty));
            presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            presenter.SetValue(ContentPresenter.RecognizesAccessKeyProperty, true);
            surface.AppendChild(presenter);
            root.AppendChild(surface);
            ControlTemplate template = new ControlTemplate(typeof(Button)) { VisualTree = root };
            MultiTrigger hoverTrigger = new MultiTrigger();
            hoverTrigger.Conditions.Add(new Condition(UIElement.IsMouseOverProperty, true));
            hoverTrigger.Conditions.Add(new Condition(UIElement.IsEnabledProperty, true));
            hoverTrigger.Setters.Add(new Setter(Border.BackgroundProperty, hover, "Surface"));
            template.Triggers.Add(hoverTrigger);
            Trigger press = new Trigger { Property = ButtonBase.IsPressedProperty, Value = true };
            press.Setters.Add(new Setter(UIElement.OpacityProperty, .82, "Surface"));
            template.Triggers.Add(press);
            if (!isPrimary) {
                Trigger disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
                disabled.Setters.Add(new Setter(UIElement.OpacityProperty, .55, "Surface"));
                template.Triggers.Add(disabled);
            }
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
            style.Setters.Add(new Setter(FrameworkElement.FocusVisualStyleProperty, FocusRing(radius)));
            return style;
        }

        /// <summary>키보드 초점 테: 키보드로 옮겨 왔을 때만 바깥 2px 옅은 청금석(플랫폼 :focus-visible). 열리자마자 주 단추에 초점이 가도 테는 그리지 않는다.</summary>
        private static Style FocusRing(double radius)
        {
            FrameworkElementFactory ring = new FrameworkElementFactory(typeof(Border));
            ring.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius + 4));
            ring.SetValue(Border.BorderThicknessProperty, new Thickness(2));
            ring.SetValue(Border.BorderBrushProperty, LapisLight);
            ring.SetValue(FrameworkElement.MarginProperty, new Thickness(-4));
            ring.SetValue(UIElement.SnapsToDevicePixelsProperty, true);
            Style style = new Style(typeof(Control));
            style.Setters.Add(new Setter(Control.TemplateProperty, new ControlTemplate(typeof(Control)) { VisualTree = ring }));
            return style;
        }

        private static bool InsideButton(DependencyObject element)
        {
            while (element != null) {
                if (element is ButtonBase) return true;
                FrameworkContentElement content = element as FrameworkContentElement;
                element = content != null ? content.Parent : VisualTreeHelper.GetParent(element);
            }
            return false;
        }

        private static void Announce(UIElement element)
        {
            AutomationPeer peer = UIElementAutomationPeer.CreatePeerForElement(element);
            if (peer != null) peer.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }

        private static Brush Solid(string value)
        {
            SolidColorBrush brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(value));
            brush.Freeze();
            return brush;
        }

        private static Brush Tint(Color color, byte alpha)
        {
            SolidColorBrush brush = new SolidColorBrush(Color.FromArgb(alpha, color.R, color.G, color.B));
            brush.Freeze();
            return brush;
        }

        private static BitmapSource LoadArt(string resource)
        {
            Stream stream = typeof(SignalWindow).Assembly.GetManifestResourceStream(resource);
            if (stream == null) throw new InvalidOperationException("설치 화면의 포스터 그림이 없습니다: " + resource);
            using (stream) {
                BitmapImage image = new BitmapImage();
                image.BeginInit();
                image.CacheOption = BitmapCacheOption.OnLoad;
                image.StreamSource = stream;
                image.EndInit();
                image.Freeze();
                return image;
            }
        }

        private static GlyphTypeface Face(FontFamily family, int weight)
        {
            foreach (Typeface face in family.GetTypefaces()) {
                GlyphTypeface glyph;
                if (face.Style == FontStyles.Normal && face.TryGetGlyphTypeface(out glyph) && glyph.Weight.ToOpenTypeWeight() == weight &&
                    glyph.StyleSimulations == StyleSimulations.None) return glyph;
            }
            throw new InvalidOperationException("설치 화면의 브랜드 폰트 굵기가 없습니다: " + family.Source + " " + weight + ".");
        }

        private static IList<FontFamily> ReadFontFamilies(string directory)
        {
            if (String.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory))
                throw new InvalidOperationException("설치 화면의 브랜드 폰트 폴더가 없습니다.");
            List<FontFamily> result = new List<FontFamily>();
            List<string> folders = new List<string> { System.IO.Path.GetFullPath(directory) };
            folders.AddRange(Directory.GetDirectories(directory, "*", SearchOption.AllDirectories));
            foreach (string folder in folders) {
                foreach (FontFamily family in Fonts.GetFontFamilies(folder.TrimEnd('\\', '/') + System.IO.Path.DirectorySeparatorChar))
                    result.Add(family);
            }
            return result;
        }

        private static FontFamily RequireFont(IList<FontFamily> families, string name, params int[] weights)
        {
            foreach (FontFamily family in families) {
                bool named = false;
                foreach (string familyName in family.FamilyNames.Values)
                    if (String.Equals(familyName, name, StringComparison.OrdinalIgnoreCase)) named = true;
                if (!named) continue;
                bool complete = true;
                foreach (int weight in weights) {
                    bool found = false;
                    foreach (Typeface face in family.GetTypefaces()) {
                        GlyphTypeface glyph;
                        if (face.TryGetGlyphTypeface(out glyph) && glyph.Weight.ToOpenTypeWeight() == weight)
                            found = true;
                    }
                    if (!found) complete = false;
                }
                if (complete) return family;
            }
            throw new InvalidOperationException("설치 화면의 브랜드 폰트가 없거나 굵기가 맞지 않습니다: " + name + ".");
        }
    }

    /// <summary>
    /// 자간(letter-spacing)을 주는 글자. WPF 글상자에는 자간이 없어서, 플랫폼의 모노 라벨(+.12~.2em)과
    /// 큰 한글(−.05em 안팎)을 같은 모양으로 그리려고 글리프를 직접 놓는다. 줄바꿈은 \n으로만 한다.
    /// </summary>
    internal sealed class TrackedText : FrameworkElement
    {
        private sealed class Piece
        {
            public GlyphTypeface Face;
            public readonly List<ushort> Glyphs = new List<ushort>();
            public readonly List<double> Advances = new List<double>();
            public double Width;
        }

        private readonly GlyphTypeface face;
        private readonly IList<GlyphTypeface> fallbacks;
        private readonly double size, tracking, lineHeight;
        private Brush foreground;
        private string text = "";
        private List<List<Piece>> lines;
        private List<double> widths;

        /// <summary>참이면 화면 읽기 프로그램이 읽지 않는다(단추 이름처럼 다른 곳에서 이미 읽는 글자).</summary>
        public bool Decorative;

        public TrackedText(GlyphTypeface face, double size, double trackingEm, Brush foreground, double lineHeight, IList<GlyphTypeface> fallbacks)
        {
            this.face = face;
            this.size = size;
            this.tracking = trackingEm * size;
            this.foreground = foreground;
            this.lineHeight = lineHeight > 0 ? lineHeight : Math.Ceiling(face.Height * size);
            this.fallbacks = fallbacks ?? new GlyphTypeface[0];
            SnapsToDevicePixels = true;
        }

        public string Text
        {
            get { return text; }
            set { text = value ?? ""; lines = null; InvalidateMeasure(); InvalidateVisual(); }
        }

        public Brush Foreground
        {
            get { return foreground; }
            set { foreground = value; InvalidateVisual(); }
        }

        private void Layout()
        {
            lines = new List<List<Piece>>();
            widths = new List<double>();
            List<Piece> line = new List<Piece>();
            Piece piece = null;
            double width = 0;
            bool any = false;
            foreach (char c in text) {
                if (c == '\r') continue;
                if (c == '\n') {
                    lines.Add(line); widths.Add(any ? width - tracking : 0);
                    line = new List<Piece>(); piece = null; width = 0; any = false;
                    continue;
                }
                GlyphTypeface used;
                ushort glyph = Glyph(c, out used);
                if (piece == null || piece.Face != used) { piece = new Piece { Face = used }; line.Add(piece); }
                double advance = used.AdvanceWidths[glyph] * size + tracking;
                piece.Glyphs.Add(glyph);
                piece.Advances.Add(advance);
                piece.Width += advance;
                width += advance;
                any = true;
            }
            lines.Add(line);
            widths.Add(any ? width - tracking : 0);
        }

        private ushort Glyph(char c, out GlyphTypeface used)
        {
            ushort index;
            if (face.CharacterToGlyphMap.TryGetValue(c, out index)) { used = face; return index; }
            foreach (GlyphTypeface other in fallbacks)
                if (other.CharacterToGlyphMap.TryGetValue(c, out index)) { used = other; return index; }
            used = face;
            face.CharacterToGlyphMap.TryGetValue('?', out index);
            return index;
        }

        protected override Size MeasureOverride(Size availableSize)
        {
            Layout();
            double width = 0;
            foreach (double value in widths) width = Math.Max(width, value);
            return new Size(Math.Ceiling(width), Math.Ceiling(lineHeight * lines.Count));
        }

        protected override void OnRender(DrawingContext context)
        {
            if (lines == null) Layout();
            double dip = VisualTreeHelper.GetDpi(this).PixelsPerDip;
            for (int i = 0; i < lines.Count; i++) {
                double baseline = i * lineHeight + (lineHeight - face.Height * size) / 2 + face.Baseline * size;
                baseline = Math.Round(baseline * dip) / dip;
                double x = 0;
                foreach (Piece piece in lines[i]) {
                    GlyphRun run = new GlyphRun(piece.Face, 0, false, size, (float)dip, piece.Glyphs, new Point(x, baseline),
                        piece.Advances, null, null, null, null, null, null);
                    context.DrawGlyphRun(foreground, run);
                    x += piece.Width;
                }
            }
        }

        protected override AutomationPeer OnCreateAutomationPeer() { return new TrackedTextPeer(this); }
    }

    internal sealed class TrackedTextPeer : FrameworkElementAutomationPeer
    {
        public TrackedTextPeer(TrackedText owner) : base(owner) { }
        protected override string GetClassNameCore() { return "TextBlock"; }
        protected override AutomationControlType GetAutomationControlTypeCore() { return AutomationControlType.Text; }
        protected override string GetNameCore()
        {
            string name = base.GetNameCore();
            return String.IsNullOrEmpty(name) ? ((TrackedText)Owner).Text.Replace('\n', ' ') : name;
        }
        protected override bool IsControlElementCore() { return !((TrackedText)Owner).Decorative; }
        protected override bool IsContentElementCore() { return !((TrackedText)Owner).Decorative; }
    }
}
