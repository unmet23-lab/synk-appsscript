// 시험 그림을 나란히 붙인다. 줄마다 왼쪽부터 시안 캡처, WPF GPU 판, CPU 판(150% 화면에서 찍은 것)
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;

static class Program {
    static float[] U(string file, string key) { foreach (var l in File.ReadAllLines(file)) if (l.StartsWith(key + "=")) { var p = l.Substring(key.Length + 1).Split(','); var v = new float[p.Length]; for (int i = 0; i < p.Length; i++) v[i] = float.Parse(p[i], CultureInfo.InvariantCulture); return v; } return null; }
    static int Main(string[] a) {
        string root = a[0], outFile = a[1];
        string[] rows = { "forge-p40", "forge-ready", "forge-grand-p40" };
        string[] rowLabel = { "새 판 받기 40%(지금 판)", "처음 설치 전 매끈한 구", "새 판 받기 40%(웅장한 판)" };
        string[] cols = { "시안(브라우저 WebGL)", "설치기 GPU 판(WPF 셰이더)", "설치기 CPU 판(C#)" };
        int pw = 720, gap = 16, head = 64, label = 44;
        int[] ph = { 720, 720, 451 };
        int W = pw * 3 + gap * 4, H = head + gap; foreach (int h in ph) H += label + h + gap;
        using (var canvas = new Bitmap(W, H, PixelFormat.Format24bppRgb))
        using (var g = Graphics.FromImage(canvas)) {
            g.Clear(Color.FromArgb(18, 18, 20)); g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            var title = new Font("Malgun Gothic", 20, FontStyle.Bold, GraphicsUnit.Pixel); var small = new Font("Malgun Gothic", 17, GraphicsUnit.Pixel);
            var ink = new SolidBrush(Color.FromArgb(236, 234, 228)); var dim = new SolidBrush(Color.FromArgb(150, 148, 142));
            g.DrawString("1-가 시험 · 검정 구를 설치기 창에서 그리는 길(150% 화면, 2160×1353 화소에서 찍음)", title, ink, gap, 18);
            int y = head + gap;
            for (int r = 0; r < rows.Length; r++) {
                g.DrawString(rowLabel[r], small, ink, gap, y + 10);
                y += label;
                string uni = Path.Combine(root, "shots-1.5", rows[r] + ".uni.txt");
                float[] c = U(uni, "uC"), res = U(uni, "uRes"); float rr = U(uni, "uR")[0];
                string[] files = { Path.Combine(root, "shots-1.5", rows[r] + ".png"), Path.Combine(root, "gpu", rows[r] + "-x1.5-gpu.png"), Path.Combine(root, "cpu", rows[r] + "-x1.5-cpu.png") };
                for (int k = 0; k < 3; k++) {
                    using (var img = new Bitmap(files[k])) {
                        float sx = img.Width / res[0];
                        RectangleF src;
                        if (r < 2) { float cx = c[0] * sx, cy = (res[1] - c[1]) * sx, side = rr * sx * 2.7f; src = new RectangleF(cx - side / 2, cy - side / 2, side, side); }
                        else src = new RectangleF(0, 0, img.Width, img.Height);
                        int x = gap + k * (pw + gap);
                        g.DrawImage(img, new Rectangle(x, y, pw, ph[r]), src, GraphicsUnit.Pixel);
                        if (r == 0) { }
                        g.DrawString(cols[k], small, dim, x + 12, y + 10);
                    }
                }
                y += ph[r] + gap;
            }
            canvas.Save(outFile, ImageFormat.Png);
        }
        Console.WriteLine("ok " + new FileInfo(outFile).Length / 1024 + " KB");
        return 0;
    }
}
