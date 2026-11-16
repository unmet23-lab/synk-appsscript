// 1-가 시험 C: 검정 구 셰이더를 HLSL(ps_3_0)로 옮겨 WPF ShaderEffect로 GPU에서 그린다.
// 시안이 그린 순간의 셰이더 값을 상수로 굽고, 화면 화소 하나마다 2×2 표본을 평균한다(시안은 캔버스를 2배로 그려 브라우저가 줄인다).
// 창을 화면 왼쪽 위에 화소 단위로 띄워 그려진 화면을 찍고 끝낸다. 쓰기: OrbGpu.exe <uni.txt> <나갈 png> <폭 px> <높이 px>
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Shapes;
using System.Windows.Threading;

sealed class OrbEffect : ShaderEffect {
    public static readonly DependencyProperty InputProperty = RegisterPixelShaderSamplerProperty("Input", typeof(OrbEffect), 0);
    public static readonly DependencyProperty CutProperty = DependencyProperty.Register("Cut", typeof(double), typeof(OrbEffect), new UIPropertyMetadata(0.0, PixelShaderConstantCallback(0)));
    public double Cut { get { return (double)GetValue(CutProperty); } set { SetValue(CutProperty, value); } }
    public OrbEffect(byte[] bytecode) { var ps = new PixelShader(); ps.SetStreamSource(new MemoryStream(bytecode)); PixelShader = ps; UpdateShaderValue(InputProperty); UpdateShaderValue(CutProperty); }
    public Brush Input { get { return (Brush)GetValue(InputProperty); } set { SetValue(InputProperty, value); } }
}

static class Program {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    static string F(float v) { return v.ToString("R", CultureInfo.InvariantCulture); }
    [STAThread]
    static int Main(string[] args) {
        SetProcessDPIAware();
        var d = new Dictionary<string, float[]>();
        foreach (string line in File.ReadAllLines(args[0])) { int eq = line.IndexOf('='); if (eq < 0) continue; string[] p = line.Substring(eq + 1).Split(','); var v = new float[p.Length]; for (int i = 0; i < p.Length; i++) v[i] = float.Parse(p[i], CultureInfo.InvariantCulture); d[line.Substring(0, eq)] = v; }
        string outPng = args[1]; int ow = int.Parse(args[2]), oh = int.Parse(args[3]);
        string dir = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(outPng));
        Func<string, string> s1 = k => F(d[k][0]);
        string defs =
            "#define RESX " + s1("uRes") + "\n#define RESY " + F(d["uRes"][1]) + "\n#define CX " + s1("uC") + "\n#define CY " + F(d["uC"][1]) +
            "\n#define UR " + s1("uR") + "\n#define LIT " + s1("uLit") + "\n#define AZ " + s1("uAz") + "\n#define LZ " + s1("uLz") + "\n#define FOCUS " + s1("uFocus") +
            "\n#define GB " + s1("uGb") + "\n#define DPR " + s1("uDpr") + "\n#define SEED " + s1("uSeed") + "\n#define MARK " + s1("uMark") + "\n#define CALM " + s1("uCalm") +
            "\nfloat4 k0 : register(c0);\n#define CUT k0.x" + "\n#define CUTON " + s1("uCutOn") + "\n#define AXIS float3(" + F(d["uAxis"][0]) + "," + F(d["uAxis"][1]) + "," + F(d["uAxis"][2]) + ")" +
            "\n#define OW " + ow + ".0\n#define OH " + oh + ".0\n";
        string hlsl = defs + File.ReadAllText(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "orb.hlsl"));
        string src = System.IO.Path.Combine(dir, System.IO.Path.GetFileNameWithoutExtension(outPng) + ".hlsl"), obj = System.IO.Path.ChangeExtension(src, ".ps");
        File.WriteAllText(src, hlsl);
        var fxc = Process.Start(new ProcessStartInfo(@"C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\fxc.exe", "/nologo /T ps_3_0 /E main /O3 /Fo \"" + obj + "\" \"" + src + "\"") { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true });
        string err = fxc.StandardError.ReadToEnd() + fxc.StandardOutput.ReadToEnd(); fxc.WaitForExit();
        if (fxc.ExitCode != 0) { Console.WriteLine("fxc failed:\n" + err); return 2; }
        byte[] code = File.ReadAllBytes(obj);
        var app = new Application();
        double dpi = 96.0;
        var rect = new Rectangle { Fill = Brushes.Black, SnapsToDevicePixels = true };
        var win = new Window { WindowStyle = WindowStyle.None, ResizeMode = ResizeMode.NoResize, ShowActivated = false, Topmost = true, Background = Brushes.Black, Left = 0, Top = 0, Content = rect, UseLayoutRounding = true, ShowInTaskbar = false };
        win.SourceInitialized += delegate {
            dpi = 96.0 * PresentationSource.FromVisual(win).CompositionTarget.TransformToDevice.M11;
            double k = 96.0 / dpi; win.Width = ow * k; win.Height = oh * k; rect.Width = ow * k; rect.Height = oh * k; win.Left = 0; win.Top = 0;
            rect.Effect = new OrbEffect(code);
        };
        OrbEffect fx = null;
        win.ContentRendered += delegate {
            fx = (OrbEffect)rect.Effect; var clock = Stopwatch.StartNew(); int frames = 0; TimeSpan last = TimeSpan.Zero; var gaps = new List<double>();
            EventHandler tick = null;
            tick = delegate(object o, EventArgs e) {
                var re = (System.Windows.Media.RenderingEventArgs)e; if (re.RenderingTime == last) return;
                if (last != TimeSpan.Zero) gaps.Add((re.RenderingTime - last).TotalMilliseconds); last = re.RenderingTime;
                frames++; fx.Cut = (clock.Elapsed.TotalSeconds % 4.0) / 4.0;
                if (clock.Elapsed.TotalSeconds >= 4.0) {
                    CompositionTarget.Rendering -= tick; gaps.Sort();
                    Console.WriteLine(String.Format(CultureInfo.InvariantCulture, "{0}x{1} px: {2:0.0} fps, frame gap median {3:0.0} ms, p95 {4:0.0} ms, max {5:0.0} ms, tier={6}", ow, oh, frames / clock.Elapsed.TotalSeconds, gaps[gaps.Count / 2], gaps[(int)(gaps.Count * 0.95)], gaps[gaps.Count - 1], RenderCapability.Tier >> 16));
                    win.Close();
                }
            };
            CompositionTarget.Rendering += tick;
        };
        app.Run(win);
        return 0;
    }
}
