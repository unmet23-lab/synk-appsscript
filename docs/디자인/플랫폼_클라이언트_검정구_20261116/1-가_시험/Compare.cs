// 두 그림을 화소 채널마다 견준다. 쓰기: Compare.exe <시안 png> <견줄 png> <나갈 접두사> [x0 y0 x1 y1(견줄 범위)]
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;

static class Program {
    static byte[] Load(string file, out int w, out int h) {
        using (var bmp = new Bitmap(file)) {
            w = bmp.Width; h = bmp.Height; var rgb = new byte[w * h * 3];
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb); var row = new byte[data.Stride];
            for (int y = 0; y < h; y++) { Marshal.Copy(data.Scan0 + y * data.Stride, row, 0, data.Stride); for (int x = 0; x < w; x++) { rgb[(y * w + x) * 3] = row[x * 3 + 2]; rgb[(y * w + x) * 3 + 1] = row[x * 3 + 1]; rgb[(y * w + x) * 3 + 2] = row[x * 3]; } }
            bmp.UnlockBits(data); return rgb;
        }
    }
    static void Save(string file, byte[] rgb, int w, int h) {
        using (var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb); var row = new byte[data.Stride];
            for (int y = 0; y < h; y++) { for (int x = 0; x < w; x++) { row[x * 3 + 2] = rgb[(y * w + x) * 3]; row[x * 3 + 1] = rgb[(y * w + x) * 3 + 1]; row[x * 3] = rgb[(y * w + x) * 3 + 2]; } Marshal.Copy(row, 0, data.Scan0 + y * data.Stride, data.Stride); }
            bmp.UnlockBits(data); bmp.Save(file, ImageFormat.Png);
        }
    }
    static int Main(string[] a) {
        int w, h, w2, h2; var r = Load(a[0], out w, out h); var m = Load(a[1], out w2, out h2);
        if (w != w2 || h != h2) { Console.WriteLine("size differs " + w + "x" + h + " vs " + w2 + "x" + h2); return 2; }
        int x0 = 0, y0 = 0, x1 = w, y1 = h; if (a.Length >= 7) { x0 = int.Parse(a[3]); y0 = int.Parse(a[4]); x1 = int.Parse(a[5]); y1 = int.Parse(a[6]); }
        int[] hist = new int[256]; long sum = 0, n = 0; int max = 0; var diff = new byte[w * h * 3];
        for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) for (int c = 0; c < 3; c++) { int i = (y * w + x) * 3 + c; int dv = Math.Abs(r[i] - m[i]); hist[dv]++; sum += dv; n++; if (dv > max) max = dv; diff[i] = (byte)Math.Min(255, dv * 16); }
        long acc = 0; int p99 = -1, p999 = -1; for (int v = 0; v < 256; v++) { acc += hist[v]; if (p99 < 0 && acc >= n * 0.99) p99 = v; if (p999 < 0 && acc >= n * 0.999) p999 = v; }
        long o2 = 0, o4 = 0, o8 = 0; for (int v = 3; v < 256; v++) o2 += hist[v]; for (int v = 5; v < 256; v++) o4 += hist[v]; for (int v = 9; v < 256; v++) o8 += hist[v];
        Save(a[2] + "-diff16.png", diff, w, h);
        var pair = new byte[w * 2 * h * 3]; for (int y = 0; y < h; y++) { Buffer.BlockCopy(r, y * w * 3, pair, y * w * 6, w * 3); Buffer.BlockCopy(m, y * w * 3, pair, y * w * 6 + w * 3, w * 3); }
        Save(a[2] + "-pair.png", pair, w * 2, h);
        Console.WriteLine(String.Format(CultureInfo.InvariantCulture, "{0}: diff mean {1:0.000} p99 {2} p99.9 {3} max {4} | >2 {5:0.000}% >4 {6:0.000}% >8 {7:0.0000}%", System.IO.Path.GetFileName(a[2]), (double)sum / n, p99, p999, max, 100.0 * o2 / n, 100.0 * o4 / n, 100.0 * o8 / n));
        return 0;
    }
}
