using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Synk.SignalInstaller;

// 구 일치 검사(검정 구 1-가 8절)의 설치기 CPU 판. 시안이 한 장면에 넘긴 셰이더 값(desktop/tools/orb-parity.cjs가 남긴 <장면>.uni.json)으로
// 설치기의 CPU 판(OrbCpu)을 캔버스 크기로 그린 뒤, 브라우저처럼 쌍선형으로 화면 크기에 줄여 PNG로 남긴다. 창을 띄우지 않는다.
// 쓰기: orb-render.exe <uni.json> <나갈 png> <화면 폭 px> <화면 높이 px>
internal static class OrbRender
{
    [STAThread]
    private static int Main(string[] args)
    {
        try {
            Dictionary<string, double[]> d = new Dictionary<string, double[]>();
            foreach (Match m in Regex.Matches(File.ReadAllText(args[0]), "\"(u\\w+)\":\\[([^\\]]*)\\]")) {
                string[] parts = m.Groups[2].Value.Split(',');
                double[] values = new double[parts.Length];
                for (int i = 0; i < parts.Length; i++) values[i] = Double.Parse(parts[i], CultureInfo.InvariantCulture);
                d[m.Groups[1].Value] = values;
            }
            OrbUniforms u = new OrbUniforms {
                ResX = d["uRes"][0], ResY = d["uRes"][1], Cx = d["uC"][0], Cy = d["uC"][1], R = d["uR"][0], Lit = d["uLit"][0], Az = d["uAz"][0], Lz = d["uLz"][0],
                Focus = d["uFocus"][0], Gb = d["uGb"][0], Dpr = d["uDpr"][0], Seed = d["uSeed"][0], AxisX = d["uAxis"][0], AxisY = d["uAxis"][1], AxisZ = d["uAxis"][2],
                Mark = d["uMark"][0], Calm = d["uCalm"][0], Cut = d["uCut"][0], CutOn = d["uCutOn"][0],
                EyeKind = d["uEye"][0], EyeVis = d["uEye"][1], EyeOpen = d["uEye"][2], EyeMood = d["uEye"][3],
                FaceX = d["uFace"][0], FaceY = d["uFace"][1], GazeX = d["uGaze"][0], GazeY = d["uGaze"][1], GazeT = d["uGaze"][2]
            };
            if (u.Mark > 0.001) throw new InvalidOperationException("설치기 구에는 구 위의 자리가 없다(uMark > 0인 장면은 견주지 않는다)");
            int cw = (int)u.ResX, ch = (int)u.ResY, ow = Int32.Parse(args[2]), oh = Int32.Parse(args[3]);
            byte[] canvas = new byte[cw * ch * 4];
            DateTime start = DateTime.UtcNow;
            OrbCpu.Render(u, canvas, cw * 4);
            double ms = (DateTime.UtcNow - start).TotalMilliseconds;
            // 브라우저처럼 캔버스를 화면 크기로 쌍선형으로 줄인다(화면 화소마다 캔버스 화소 넷을 섞는다)
            byte[] screen = new byte[ow * oh * 4];
            double kx = (double)cw / ow, ky = (double)ch / oh;
            for (int y = 0; y < oh; y++) {
                double sy = (y + 0.5) * ky - 0.5; int y0 = (int)Math.Floor(sy); double ay = sy - y0;
                int ya = Math.Max(0, Math.Min(ch - 1, y0)), yb = Math.Max(0, Math.Min(ch - 1, y0 + 1));
                for (int x = 0; x < ow; x++) {
                    double sx = (x + 0.5) * kx - 0.5; int x0 = (int)Math.Floor(sx); double ax = sx - x0;
                    int xa = Math.Max(0, Math.Min(cw - 1, x0)), xb = Math.Max(0, Math.Min(cw - 1, x0 + 1));
                    for (int c = 0; c < 3; c++) {
                        double top = canvas[(ya * cw + xa) * 4 + c] * (1 - ax) + canvas[(ya * cw + xb) * 4 + c] * ax;
                        double bottom = canvas[(yb * cw + xa) * 4 + c] * (1 - ax) + canvas[(yb * cw + xb) * 4 + c] * ax;
                        screen[(y * ow + x) * 4 + c] = (byte)Math.Max(0, Math.Min(255, Math.Round(top * (1 - ay) + bottom * ay)));
                    }
                    screen[(y * ow + x) * 4 + 3] = 255;
                }
            }
            BitmapSource image = BitmapSource.Create(ow, oh, 96, 96, PixelFormats.Bgra32, null, screen, ow * 4);
            PngBitmapEncoder encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(image));
            using (FileStream file = File.Create(args[1])) encoder.Save(file);
            Console.WriteLine("{\"canvas\":[" + cw + "," + ch + "],\"ms\":" + Math.Round(ms) + "}");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
