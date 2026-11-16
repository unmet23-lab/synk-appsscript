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
    public OrbEffect(byte[] bytecode) { var ps = new PixelShader(); ps.SetStreamSource(new MemoryStream(bytecode)); PixelShader = ps; UpdateShaderValue(InputProperty); }
    public Brush Input { get { return (Brush)GetValue(InputProperty); } set { SetValue(InputProperty, value); } }
}

static class Program {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    static string F(float v) { return v.ToString("R", CultureInfo.InvariantCulture); }
    [STAThread]
    static int Main(string[] args) {
        SetProcessDPIAware();
        if (args.Length > 4 && args[4] == "soft") System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.SoftwareOnly;
        var d = new Dictionary<string, float[]>();
        foreach (string line in File.ReadAllLines(args[0])) { int eq = line.IndexOf('='); if (eq < 0) continue; string[] p = line.Substring(eq + 1).Split(','); var v = new float[p.Length]; for (int i = 0; i < p.Length; i++) v[i] = float.Parse(p[i], CultureInfo.InvariantCulture); d[line.Substring(0, eq)] = v; }
        string outPng = args[1]; int ow = int.Parse(args[2]), oh = int.Parse(args[3]);
        string dir = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(outPng));
        Func<string, string> s1 = k => F(d[k][0]);
        string defs =
            "#define RESX " + s1("uRes") + "\n#define RESY " + F(d["uRes"][1]) + "\n#define CX " + s1("uC") + "\n#define CY " + F(d["uC"][1]) +
            "\n#define UR " + s1("uR") + "\n#define LIT " + s1("uLit") + "\n#define AZ " + s1("uAz") + "\n#define LZ " + s1("uLz") + "\n#define FOCUS " + s1("uFocus") +
            "\n#define GB " + s1("uGb") + "\n#define DPR " + s1("uDpr") + "\n#define SEED " + s1("uSeed") + "\n#define MARK " + s1("uMark") + "\n#define CALM " + s1("uCalm") +
            "\n#define CUT " + s1("uCut") + "\n#define CUTON " + s1("uCutOn") + "\n#define AXIS float3(" + F(d["uAxis"][0]) + "," + F(d["uAxis"][1]) + "," + F(d["uAxis"][2]) + ")" +
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
        win.ContentRendered += delegate {
            var t = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(900) };
            t.Tick += delegate {
                t.Stop();
                var tier = RenderCapability.Tier >> 16; bool ps3 = RenderCapability.IsPixelShaderVersionSupported(3, 0);
                using (var bmp = new System.Drawing.Bitmap(ow, oh, System.Drawing.Imaging.PixelFormat.Format24bppRgb))
                using (var g = System.Drawing.Graphics.FromImage(bmp)) { g.CopyFromScreen(0, 0, 0, 0, new System.Drawing.Size(ow, oh)); bmp.Save(outPng, System.Drawing.Imaging.ImageFormat.Png); }
                Console.WriteLine("captured " + ow + "x" + oh + " dpi=" + dpi + " tier=" + tier + " ps3=" + ps3 + " bytecode=" + code.Length + "B");
                win.Close();
            };
            t.Start();
        };
        app.Run(win);
        return 0;
    }
}
