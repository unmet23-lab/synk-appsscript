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
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace Synk.SignalInstaller
{
    /// <summary>The approved Signal design, with installation work supplied by the host.</summary>
    public sealed class SignalWindow : Window
    {
        private enum InstallerState { Ready, Installing, Complete, Failure }

        private readonly Brush ink = Solid("#FAFAF9");
        private readonly Brush muted = Solid("#B1B3BC");
        private readonly Brush background = Solid("#0C0D10");
        private readonly Brush panel = Solid("#15161B");
        private readonly Brush line = Solid("#292A31");
        private readonly FontFamily suit;
        private readonly FontFamily inter;
        private readonly FontFamily mono;
        private readonly FontFamily bodyFont;
        private readonly TextBlock headline;
        private readonly TextBlock description;
        private readonly TextBlock statusTitle;
        private readonly TextBlock statusDetail;
        private readonly TextBlock percent;
        private readonly TextBlock infoText;
        private readonly Grid info;
        private readonly Grid progressSection;
        private readonly ProgressBar progress;
        private readonly Button primary;
        private readonly Button secondary;
        private readonly Button closeButton;
        private readonly TextBlock primaryLabel;
        private readonly TextBlock secondaryLabel;
        private readonly System.Windows.Shapes.Path primaryArrow;
        private InstallerState state;
        private bool installed;

        public event EventHandler InstallRequested;
        public event EventHandler LaunchRequested;

        public SignalWindow(string fontDirectory, string version)
        {
            // A missing or wrong font is a packaging error, not a reason to silently
            // render the approved design in an unrelated installed system font.
            IList<FontFamily> families = ReadFontFamilies(fontDirectory);
            suit = RequireFont(families, "SUIT", 500, 800);
            inter = RequireFont(families, "Inter Tight", 500, 700);
            mono = RequireFont(families, "DM Mono", 500);
            bodyFont = new FontFamily();
            bodyFont.FamilyMaps.Add(new FontFamilyMap {
                Unicode = "0000-024F,0400-052F", Target = inter.Source
            });
            bodyFont.FamilyMaps.Add(new FontFamilyMap { Target = suit.Source });

            Title = "SYNK Platform Preview 설치";
            Width = 728;
            Height = 492;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            FontFamily = bodyFont;
            FontWeight = FontWeights.Medium;
            Foreground = ink;
            UseLayoutRounding = true;
            SnapsToDevicePixels = true;
            Language = System.Windows.Markup.XmlLanguage.GetLanguage("ko-KR");
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Display);
            AutomationProperties.SetName(this, Title);

            Border shell = new Border {
                CornerRadius = new CornerRadius(20),
                BorderBrush = line, BorderThickness = new Thickness(1),
                Background = background
            };
            Grid layout = new Grid();
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(44) });
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            layout.SizeChanged += delegate {
                layout.Clip = new RectangleGeometry(new Rect(0, 0, layout.ActualWidth,
                    layout.ActualHeight), 19, 19);
            };
            shell.Child = layout;
            Content = shell;

            Grid titleBar = new Grid { Background = background };
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(40) });
            titleBar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(44) });
            TextBlock caption = Text("SYNK Platform", 12, muted, inter);
            caption.VerticalAlignment = VerticalAlignment.Center;
            caption.Margin = new Thickness(19, 0, 0, 0);
            titleBar.Children.Add(caption);
            titleBar.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs args) {
                if (args.ClickCount == 1 && Mouse.LeftButton == MouseButtonState.Pressed &&
                    !InsideButton(args.OriginalSource as DependencyObject)) DragMove();
            };
            Button minimize = WindowButton("최소화", "M 1,6 L 11,6");
            minimize.Click += delegate { WindowState = WindowState.Minimized; };
            Grid.SetColumn(minimize, 1);
            titleBar.Children.Add(minimize);
            closeButton = WindowButton("설치 창 닫기", "M 2,2 L 10,10 M 10,2 L 2,10");
            closeButton.Click += delegate { Close(); };
            Grid.SetColumn(closeButton, 2);
            titleBar.Children.Add(closeButton);
            Border titleDivider = new Border {
                BorderBrush = line, BorderThickness = new Thickness(0, 0, 0, 1), Child = titleBar
            };
            layout.Children.Add(titleDivider);

            Grid body = new Grid();
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(300) });
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            Grid.SetRow(body, 1);
            layout.Children.Add(body);
            body.Children.Add(CreateBrandPanel());

            Grid content = new Grid { Margin = new Thickness(30, 28, 30, 24) };
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star), MinHeight = 90 });
            content.RowDefinitions.Add(new RowDefinition { Height = new GridLength(48) });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            Grid.SetColumn(content, 1);
            body.Children.Add(content);

            TextBlock step = Text("WINDOWS · PREVIEW", 12, muted, mono);
            step.Margin = new Thickness(0, 0, 0, 20);
            content.Children.Add(step);
            headline = Text("", 36, ink, suit);
            headline.FontWeight = FontWeights.ExtraBold;
            headline.LineHeight = 43;
            headline.LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
            headline.Margin = new Thickness(0, 0, 0, 14);
            AutomationProperties.SetLiveSetting(headline, AutomationLiveSetting.Polite);
            Grid.SetRow(headline, 1);
            content.Children.Add(headline);

            description = Text("", 14, muted, bodyFont);
            description.LineHeight = 23;
            description.LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
            description.MinHeight = 46;
            Grid.SetRow(description, 2);
            content.Children.Add(description);

            Grid status = new Grid { Margin = new Thickness(0, 10, 0, 22) };
            Grid.SetRow(status, 3);
            content.Children.Add(status);

            info = new Grid { VerticalAlignment = VerticalAlignment.Bottom };
            info.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(25) });
            info.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            System.Windows.Shapes.Path monitor = new System.Windows.Shapes.Path {
                Data = Geometry.Parse("M 2,2 L 18,2 L 18,13 L 2,13 Z M 10,13 L 10,17 M 6,17 L 14,17"),
                Stroke = muted, StrokeThickness = 1.3, Width = 20, Height = 20,
                HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Center
            };
            info.Children.Add(monitor);
            infoText = Text("현재 Windows 계정에 설치합니다.", 14, muted, bodyFont);
            infoText.LineHeight = 21;
            Grid.SetColumn(infoText, 1);
            info.Children.Add(infoText);
            status.Children.Add(info);

            progressSection = new Grid { Visibility = Visibility.Collapsed, VerticalAlignment = VerticalAlignment.Bottom };
            progressSection.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            progressSection.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            progressSection.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            Grid progressHeading = new Grid();
            progressHeading.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            progressHeading.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            statusTitle = Text("", 14, ink, bodyFont);
            statusTitle.Margin = new Thickness(0, 0, 8, 0);
            statusTitle.LineHeight = 20;
            AutomationProperties.SetLiveSetting(statusTitle, AutomationLiveSetting.Polite);
            progressHeading.Children.Add(statusTitle);
            percent = Text("", 12, muted, mono);
            percent.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(percent, 1);
            progressHeading.Children.Add(percent);
            progressSection.Children.Add(progressHeading);
            progress = new ProgressBar {
                Minimum = 0, Maximum = 100, Height = 6,
                Margin = new Thickness(0, 9, 0, 7),
                Foreground = ink, Background = line, BorderThickness = new Thickness(0)
            };
            AutomationProperties.SetName(progress, "SYNK 설치 진행률");
            Grid.SetRow(progress, 1);
            progressSection.Children.Add(progress);
            statusDetail = Text("", 14, muted, bodyFont);
            statusDetail.LineHeight = 20;
            statusDetail.LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
            ScrollViewer detailScroll = new ScrollViewer {
                Content = statusDetail, MaxHeight = 40, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Focusable = false
            };
            Grid.SetRow(detailScroll, 2);
            progressSection.Children.Add(detailScroll);
            status.Children.Add(progressSection);

            Grid actions = new Grid();
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            actions.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            secondaryLabel = Text("나중에", 14, muted, suit);
            secondary = ActionButton(secondaryLabel, false);
            secondary.MinWidth = 78;
            secondary.Padding = new Thickness(12, 0, 12, 0);
            secondary.Margin = new Thickness(-12, 0, 0, 0);
            secondary.Click += delegate { Close(); };
            actions.Children.Add(secondary);

            StackPanel primaryContent = new StackPanel { Orientation = Orientation.Horizontal };
            primaryLabel = Text("설치하기", 14, background, bodyFont);
            primaryLabel.VerticalAlignment = VerticalAlignment.Center;
            primaryContent.Children.Add(primaryLabel);
            primaryArrow = new System.Windows.Shapes.Path {
                Data = Geometry.Parse("M 1,7 L 13,7 M 8,2 L 13,7 L 8,12"),
                Stroke = background, StrokeThickness = 1.5, Width = 15, Height = 14,
                Margin = new Thickness(13, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center
            };
            primaryContent.Children.Add(primaryArrow);
            primary = ActionButton(primaryContent, true);
            primary.MinWidth = 149;
            primary.IsDefault = true;
            primary.Click += OnPrimaryClick;
            Grid.SetColumn(primary, 2);
            actions.Children.Add(primary);
            Grid.SetRow(actions, 4);
            content.Children.Add(actions);
            TextBlock footer = Text("WINDOWS x64 · PREVIEW " + version, 12, muted, mono);
            footer.Margin = new Thickness(0, 19, 0, 0);
            Grid.SetRow(footer, 5);
            content.Children.Add(footer);

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

        public void SetReady()
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action(SetReady)); return; }
            state = InstallerState.Ready;
            SetHeadline("SYNK를\n설치합니다.");
            description.Text = "앱과 회원 혜택을 한곳에서.\n내 PC에서 편하게 이어가세요.";
            infoText.Text = installed ? "현재 Windows 계정에 다시 설치합니다." : "현재 Windows 계정에 설치합니다.";
            info.Visibility = Visibility.Visible;
            progressSection.Visibility = Visibility.Collapsed;
            progress.IsIndeterminate = false;
            SetButtons(installed ? "다시 설치하기" : "설치하기", "나중에", true);
        }

        public void ShowProgress(string title, string detail, int? percentage)
        {
            if (!Dispatcher.CheckAccess()) {
                Dispatcher.Invoke(new Action<string, string, int?>(ShowProgress), title, detail, percentage); return;
            }
            state = InstallerState.Installing;
            SetHeadline("SYNK를\n준비하고 있어요.");
            description.Text = "설치를 마칠 때까지 잠시 기다려 주세요.\n앱 파일을 적용하는 동안 창을 닫을 수 없어요.";
            info.Visibility = Visibility.Collapsed;
            progressSection.Visibility = Visibility.Visible;
            progress.Visibility = Visibility.Visible;
            statusTitle.Text = title ?? "설치하는 중";
            statusDetail.Text = detail ?? "";
            progress.IsIndeterminate = !percentage.HasValue;
            if (percentage.HasValue) {
                progress.Value = Math.Max(0, Math.Min(100, percentage.Value));
                percent.Text = ((int)progress.Value).ToString(CultureInfo.InvariantCulture) + "%";
            } else {
                percent.Text = "";
            }
            SetButtons("설치 중", "나중에", false);
            Announce(statusTitle);
        }

        public void ShowComplete()
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action(ShowComplete)); return; }
            state = InstallerState.Complete;
            SetHeadline("준비됐어요.\n시작해 볼까요?");
            description.Text = "내 PC에서 나만의 SYNK를 만나세요.\n아래 버튼을 누르면 플랫폼이 열립니다.";
            infoText.Text = "설치가 완료되었습니다.";
            info.Visibility = Visibility.Visible;
            progress.IsIndeterminate = false;
            progressSection.Visibility = Visibility.Collapsed;
            SetButtons("SYNK 열기", "나중에 열기", true);
            primary.Focus();
            Announce(headline);
        }

        public void ShowFailure(string detail)
        {
            if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(new Action<string>(ShowFailure), detail); return; }
            state = InstallerState.Failure;
            SetHeadline("설치를\n마치지 못했어요.");
            description.Text = "아래 내용을 확인한 뒤 다시 시도해 주세요.\n나중에 이 설치 파일을 다시 열어도 됩니다.";
            info.Visibility = Visibility.Collapsed;
            progress.IsIndeterminate = false;
            progress.Visibility = Visibility.Collapsed;
            progressSection.Visibility = Visibility.Visible;
            statusTitle.Text = "설치 확인이 필요합니다";
            statusDetail.Text = detail ?? "설치 파일을 다시 실행해 주세요.";
            percent.Text = "";
            SetButtons("다시 시도", "닫기", true);
            primary.Focus();
            Announce(statusTitle);
        }

        private void OnPrimaryClick(object sender, RoutedEventArgs args)
        {
            if (state == InstallerState.Installing) return;
            if (state == InstallerState.Complete) {
                primary.IsEnabled = false;
                primaryLabel.Text = "여는 중";
                AutomationProperties.SetName(primary, "SYNK 여는 중");
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
            primaryArrow.Visibility = enabled ? Visibility.Visible : Visibility.Collapsed;
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
        }

        private void ExplainCloseGuard()
        {
            statusDetail.Text = "설치가 끝나면 창을 닫을 수 있어요. 잠시 기다려 주세요.";
            Announce(statusDetail);
        }

        private void SetHeadline(string value)
        {
            headline.Inlines.Clear();
            if (value.StartsWith("SYNK", StringComparison.Ordinal)) {
                headline.Inlines.Add(new Run("SYNK") { FontFamily = inter, FontWeight = FontWeights.Bold });
                headline.Inlines.Add(new Run(value.Substring(4)) { FontFamily = suit, FontWeight = FontWeights.ExtraBold });
            } else headline.Inlines.Add(new Run(value) { FontFamily = suit, FontWeight = FontWeights.ExtraBold });
            AutomationProperties.SetName(headline, value.Replace("\n", " "));
        }

        private Border CreateBrandPanel()
        {
            Grid brand = new Grid { Margin = new Thickness(28, 28, 28, 29) };
            brand.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            brand.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            brand.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            brand.Children.Add(Text("SYNK PLATFORM", 12, muted, mono));

            // Exact paths from the approved Signal mock. Never reconstruct the logo with text.
            Canvas logo = new Canvas { Width = 560, Height = 328 };
            string[] paths = {
                "M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z",
                "M222 8h58v172h-58Z",
                "F0 M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z",
                "M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"
            };
            foreach (string path in paths) logo.Children.Add(new System.Windows.Shapes.Path { Data = Geometry.Parse(path), Fill = ink });
            Viewbox mark = new Viewbox { Child = logo, Stretch = Stretch.Uniform, MaxHeight = 144, Margin = new Thickness(0, 12, 0, 12) };
            AutomationProperties.SetName(mark, "싱ㅋ 로고");
            Grid.SetRow(mark, 1);
            brand.Children.Add(mark);

            StackPanel bottom = new StackPanel();
            Grid colors = new Grid { Width = 80, Height = 4, HorizontalAlignment = HorizontalAlignment.Left };
            string[] palette = { "#3D6BC9", "#526956", "#F5C445", "#E05C97" };
            for (int i = 0; i < palette.Length; i++) {
                colors.ColumnDefinitions.Add(new ColumnDefinition());
                Border color = new Border { Background = Solid(palette[i]) };
                if (i == 0) color.CornerRadius = new CornerRadius(2, 0, 0, 2);
                if (i == 3) color.CornerRadius = new CornerRadius(0, 2, 2, 0);
                Grid.SetColumn(color, i);
                colors.Children.Add(color);
            }
            bottom.Children.Add(colors);
            TextBlock tagline = Text("하나의 SYNK ID.\n나에게 맞는 SYNK.", 14, ink, bodyFont);
            tagline.LineHeight = 23;
            tagline.LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
            tagline.Margin = new Thickness(0, 16, 0, 0);
            bottom.Children.Add(tagline);
            Grid.SetRow(bottom, 2);
            brand.Children.Add(bottom);
            return new Border { Background = panel, Child = brand };
        }

        private TextBlock Text(string value, double size, Brush color, FontFamily family)
        {
            return new TextBlock {
                Text = value, FontFamily = family, FontSize = size,
                FontWeight = FontWeights.Medium, Foreground = color,
                TextWrapping = TextWrapping.Wrap
            };
        }

        private Button WindowButton(string name, string geometry)
        {
            Button button = new Button {
                Width = 32, Height = 30, Padding = new Thickness(0),
                Background = Brushes.Transparent, BorderBrush = Brushes.Transparent,
                BorderThickness = new Thickness(1), Cursor = Cursors.Hand,
                Style = ButtonStyle(false, 8)
            };
            button.Content = new System.Windows.Shapes.Path {
                Data = Geometry.Parse(geometry), Stroke = muted, StrokeThickness = 1.35,
                Width = 12, Height = 12, HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            button.ToolTip = name;
            AutomationProperties.SetName(button, name);
            return button;
        }

        private Button ActionButton(object content, bool isPrimary)
        {
            return new Button {
                Content = content, Height = 48, Padding = new Thickness(22, 0, 22, 0),
                Background = isPrimary ? ink : Brushes.Transparent,
                BorderBrush = Brushes.Transparent, BorderThickness = new Thickness(2),
                Cursor = Cursors.Hand, Style = ButtonStyle(isPrimary, 24)
            };
        }

        private Style ButtonStyle(bool isPrimary, double radius)
        {
            Style style = new Style(typeof(Button));
            FrameworkElementFactory border = new FrameworkElementFactory(typeof(Border), "Surface");
            border.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            border.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            border.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            border.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            border.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Control.PaddingProperty));
            FrameworkElementFactory presenter = new FrameworkElementFactory(typeof(ContentPresenter));
            presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            presenter.SetValue(ContentPresenter.RecognizesAccessKeyProperty, true);
            border.AppendChild(presenter);
            ControlTemplate template = new ControlTemplate(typeof(Button)) { VisualTree = border };
            Trigger hover = new Trigger { Property = UIElement.IsMouseOverProperty, Value = true };
            hover.Setters.Add(new Setter(Border.BackgroundProperty, Solid(isPrimary ? "#DCDDDF" : "#202128"), "Surface"));
            template.Triggers.Add(hover);
            Trigger press = new Trigger { Property = ButtonBase.IsPressedProperty, Value = true };
            press.Setters.Add(new Setter(UIElement.OpacityProperty, 0.78, "Surface"));
            template.Triggers.Add(press);
            Trigger focused = new Trigger { Property = UIElement.IsKeyboardFocusedProperty, Value = true };
            focused.Setters.Add(new Setter(Border.BorderBrushProperty, Solid("#79A3F5"), "Surface"));
            template.Triggers.Add(focused);
            Trigger disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
            disabled.Setters.Add(new Setter(UIElement.OpacityProperty, 0.44, "Surface"));
            template.Triggers.Add(disabled);
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
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
            AutomationPeer peer = UIElementAutomationPeer.FromElement(element);
            if (peer != null) peer.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }

        private static Brush Solid(string value)
        {
            SolidColorBrush brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(value));
            brush.Freeze();
            return brush;
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
}
