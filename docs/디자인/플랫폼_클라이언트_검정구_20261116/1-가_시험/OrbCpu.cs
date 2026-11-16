// 1-가 시험 B: 검정 구 셰이더(검정구.html의 FS)를 C#으로 옮겨 CPU로 그린다. 시안이 그린 순간의 셰이더 값을 받아 같은 그림을 그리고,
// 시안 캡처와 화소마다 견준다. 새 판 받기 장면만 쓰므로 새긴 자리(uMark>0)는 옮기지 않았다.
// 쓰기: OrbCpu.exe <uni.txt> <시안 png> <나갈 접두사> [threads]
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

struct V3 {
    public float x, y, z;
    public V3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
    public static V3 operator +(V3 a, V3 b) { return new V3(a.x + b.x, a.y + b.y, a.z + b.z); }
    public static V3 operator -(V3 a, V3 b) { return new V3(a.x - b.x, a.y - b.y, a.z - b.z); }
    public static V3 operator *(V3 a, float s) { return new V3(a.x * s, a.y * s, a.z * s); }
    public static float Dot(V3 a, V3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    public static V3 Cross(V3 a, V3 b) { return new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    public float Len() { return (float)Math.Sqrt(x * x + y * y + z * z); }
    public V3 Norm() { float l = Len(); return new V3(x / l, y / l, z / l); }
}

sealed class Uni {
    public float ResX, ResY, Cx, Cy, R, Lit, Az, Lz, Focus, Gb, Dpr, Seed, Mark, Calm, Cut, CutOn;
    public V3 Axis;
    public static Uni Load(string file) {
        var d = new Dictionary<string, float[]>();
        foreach (string line in File.ReadAllLines(file)) {
            int eq = line.IndexOf('='); if (eq < 0) continue;
            string[] parts = line.Substring(eq + 1).Split(',');
            var v = new float[parts.Length];
            for (int i = 0; i < parts.Length; i++) v[i] = float.Parse(parts[i], CultureInfo.InvariantCulture);
            d[line.Substring(0, eq)] = v;
        }
        var u = new Uni();
        u.ResX = d["uRes"][0]; u.ResY = d["uRes"][1]; u.Cx = d["uC"][0]; u.Cy = d["uC"][1];
        u.R = d["uR"][0]; u.Lit = d["uLit"][0]; u.Az = d["uAz"][0]; u.Lz = d["uLz"][0]; u.Focus = d["uFocus"][0]; u.Gb = d["uGb"][0];
        u.Dpr = d["uDpr"][0]; u.Seed = d["uSeed"][0]; u.Mark = d["uMark"][0]; u.Calm = d["uCalm"][0]; u.Cut = d["uCut"][0]; u.CutOn = d["uCutOn"][0];
        u.Axis = new V3(d["uAxis"][0], d["uAxis"][1], d["uAxis"][2]);
        return u;
    }
}

static class Orb {
    static float SS(float e0, float e1, float x) { float t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
    static float Mix(float a, float b, float t) { return a + (b - a) * t; }
    static float Clamp(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
    static float Fract(float v) { return v - (float)Math.Floor(v); }
    static float Pow(float a, float b) { return (float)Math.Pow(a, b); }
    static float Exp(float a) { return (float)Math.Exp(a); }
    static float Ign(float px, float py) { return Fract(52.9829189f * Fract(px * 0.06711056f + py * 0.00583715f)); }
    const float PI = 3.14159265f;

    // 한 화소(fx, fy는 gl_FragCoord와 같은 아래 왼쪽 기준의 화소 가운데)를 셈해 0..1 빛으로 돌려준다
    public static void Shade(Uni u, float fx, float fy, out float r, out float g, out float b) {
        float qx = fx - u.Cx, qy = fy - u.Cy;
        float dist = (float)Math.Sqrt(qx * qx + qy * qy);
        float px = (dist - u.R) / u.Dpr;
        float inside = 1 - SS(-0.7f, 0.7f, px);
        float dm = Math.Max(dist, 0.001f);
        float dx = qx / dm, dy = qy / dm;
        float d = Math.Min(dist / u.R, 1);
        float z = (float)Math.Sqrt(Math.Max(0, 1 - d * d));
        V3 n = new V3(dx * d, dy * d, z);
        V3 warm = new V3(1.0f, 0.982f, 0.955f);
        float line = Exp(-Math.Abs(px) / 1.1f);
        float halo = Exp(-Math.Max(px, 0) / (0.045f * u.R / u.Dpr + 5.0f));
        float cAz = (float)Math.Cos(u.Az), sAz = (float)Math.Sin(u.Az);
        float ldx = Mix(cAz, -0.22f, u.Focus), ldy = Mix(sAz, 1.0f, u.Focus); float ll = (float)Math.Sqrt(ldx * ldx + ldy * ldy); ldx /= ll; ldy /= ll;
        float mu = dx * ldx + dy * ldy;
        float cres = SS(-0.5f, 1.0f, mu); cres *= cres;
        cres *= Mix(1.0f, Pow(Math.Max(mu, 0), 7.0f), u.Focus);
        float pulse = 1.0f + 0.5f * u.Gb;
        V3 col;
        if (px > 0.4f * u.R / u.Dpr + 48.0f) col = new V3(0, 0, 0);
        else {
            const float N1 = 110.0f;
            float h = (float)Math.Sqrt(Math.Max(1 - u.Lz * u.Lz, 0));
            V3 L = new V3(cAz * h, sAz * h, u.Lz);
            V3 V = new V3(0, 0, 1);
            V3 H = (L + V).Norm();
            V3 A = u.Axis.Norm();
            float th = (float)Math.Acos(Clamp(V3.Dot(n, A), -1, 1));
            V3 T = V3.Cross(A, n);
            float tl = T.Len();
            T = T * (1.0f / Math.Max(tl, 0.0001f));
            V3 B = V3.Cross(n, T);
            float sp = PI / N1 * u.R;
            float cap = SS(7.0f, 24.0f, tl * u.R / u.Dpr);
            float v1 = SS(2.4f, 6.0f, sp * z) * cap;
            float v2 = SS(2.4f, 6.0f, sp / 5.0f * z) * cap;
            float v3 = SS(2.4f, 6.0f, sp / 25.0f * z) * cap;
            float eTh = u.Cut * (1.5708f + (float)Math.Acos(Clamp(A.z, -1, 1)) + 0.05f);
            float cutM = Mix(1.0f, 1.0f - SS(eTh - 0.014f, eTh + 0.004f, th), u.CutOn);
            v1 *= cutM; v2 *= cutM; v3 *= cutM;
            float s1 = (float)Math.Sin(2.0f * N1 * th), s2 = (float)Math.Sin(10.0f * N1 * th), s3 = (float)Math.Sin(50.0f * N1 * th);
            float e1 = Clamp(7.5f / Math.Max(sp * z, 0.001f), 0.06f, 0.265f), e2 = Clamp(7.5f / Math.Max(sp / 5.0f * z, 0.001f), 0.06f, 0.265f);
            float w1 = s1 / (float)Math.Sqrt(s1 * s1 + e1 * e1), w2 = s2 / (float)Math.Sqrt(s2 * s2 + e2 * e2), w3 = s3 / (float)Math.Sqrt(s3 * s3 + 0.12f);
            V3 nn = (n + B * (0.22f * w1 * v1 + 0.10f * w2 * v2 + 0.05f * w3 * v3)).Norm();
            float pole = SS(Mix(0.03f, 0.12f, u.Mark), Mix(0.30f, 0.58f, u.Mark), tl);
            float tdh = V3.Dot(T, H);
            float an = Pow(Math.Max(1 - tdh * tdh, 0), Mix(44.0f, 110.0f, u.Focus)) * pole * Mix(0.07f, 1.0f, cutM);
            float side = SS(-0.28f, 0.32f, V3.Dot(n, L));
            float groove = 0.60f + 0.40f * (0.70f * w1 * v1 * (1 - 0.7f * v2) + 0.42f * w2 * v2 * (1 - 0.5f * v3) + 0.30f * w3 * v3);
            float spec = Pow(Math.Max(V3.Dot(nn, H), 0), 30.0f);
            float amb = 0.5f + 0.5f * V3.Dot(nn, new V3(-0.25f, 0.7f, 0.66f).Norm());
            float rings = ((0.5f + 0.5f * w1) * v1 * 0.036f + (0.5f + 0.5f * w2) * v2 * 0.016f + (0.5f + 0.5f * w3) * v3 * 0.010f) * amb;
            V3 L2 = new V3(-L.x * 0.7f + 0.35f, -L.y * 0.5f - 0.3f, 0.6f).Norm();
            V3 H2 = (L2 + V).Norm();
            float t2 = V3.Dot(T, H2);
            float an2 = Pow(Math.Max(1 - t2 * t2, 0), 28.0f) * pole * SS(-0.2f, 0.4f, V3.Dot(n, L2)) * Mix(0.12f, 1.0f, cutM);
            float calm = Mix(1.0f, Mix(0.16f, 1.0f, SS(0.47f, 0.69f, fy / u.ResY)), u.Calm);
            float tiny = SS(60.0f, 14.0f, u.R / u.Dpr);
            float k = u.Lit * Mix(1.0f, 0.1f, tiny) * (an * side * groove * Mix(0.78f, 0.46f, u.Focus) * pulse + (an2 * groove * 0.09f + rings) * calm + spec * 0.20f * side + 0.010f * Math.Max(V3.Dot(n, L), 0));
            V3 inC = new V3(0.005f, 0.005f, 0.005f) + warm * k;
            float edge = (1.0f - SS(0.35f, 1.0f, Math.Abs(px))) * tiny * (0.26f + 0.5f * cres);
            float soft = 1.0f - 0.75f * tiny;
            inC = inC + warm * (u.Lit * (cres * (Pow(1.0f - z, 5.0f) * 0.14f + line * 0.16f) * pulse * soft + edge));
            inC = inC + warm * (u.Lit * (1.0f - cutM) * Pow(Math.Max(V3.Dot(n, H), 0), 9.0f) * 0.085f * side);
            float live = u.CutOn * (u.Cut < 0.004f ? 0 : 1) * (0.996f < u.Cut ? 0 : 1);
            float dpx = (th - eTh) * u.R / u.Dpr;
            float seam = Exp(-dpx * dpx / 1.5f) * SS(0.0f, 0.3f, z);
            V3 E1 = (V - A * V3.Dot(V, A)).Norm();
            V3 P = A * (float)Math.Cos(eTh) + E1 * (float)Math.Sin(eTh);
            float dP = (n - P).Len() * u.R / u.Dpr;
            float tool = (Exp(-dP * dP / 12.0f) + 0.20f * Exp(-dP / 22.0f)) * SS(-0.03f, 0.08f, P.z);
            inC = inC + warm * (live * (seam * (0.09f + 0.28f * side) + tool * 0.95f));
            V3 outC = warm * (u.Lit * (cres * (line * 0.16f + halo * 0.03f) * pulse * soft + edge));
            col = outC + (inC - outC) * inside;
        }
        float gr = Ign(fx + u.Seed * 7.31f, fy + u.Seed * 7.31f) + Ign(fy + 17.0f + u.Seed * 3.17f, fx + 17.0f + u.Seed * 3.17f) - 1.0f;
        float add = gr * 2.8f / 255.0f;
        r = Math.Max(col.x + add, 0); g = Math.Max(col.y + add, 0); b = Math.Max(col.z + add, 0);
    }
}

static class Program {
    static byte Q(float v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return (byte)Math.Floor(v * 255 + 0.5f); }
    // 캔버스 크기(uRes)로 그린 뒤 화면 화소로 줄인다. 시안은 캔버스를 2배 이상으로 그려 브라우저가 줄인다(쌍선형, 2배면 네 화소 평균)
    static byte[] RenderCanvas(Uni u, int cw, int ch, int threads) {
        var buf = new byte[cw * ch * 3];
        var opt = new ParallelOptions { MaxDegreeOfParallelism = threads };
        Parallel.For(0, ch, opt, row => {
            float fy = ch - row - 0.5f; // 위에서 row번째 줄의 gl_FragCoord.y
            int o = row * cw * 3;
            for (int x = 0; x < cw; x++) {
                float r, g, b; Orb.Shade(u, x + 0.5f, fy, out r, out g, out b);
                buf[o++] = Q(r); buf[o++] = Q(g); buf[o++] = Q(b);
            }
        });
        return buf;
    }
    static byte[] Downsample(byte[] src, int cw, int ch, int ow, int oh) {
        var dst = new byte[ow * oh * 3]; float sx = (float)cw / ow, sy = (float)ch / oh;
        for (int y = 0; y < oh; y++) for (int x = 0; x < ow; x++) {
            float fx = (x + 0.5f) * sx - 0.5f, fy = (y + 0.5f) * sy - 0.5f;
            int x0 = (int)Math.Floor(fx), y0 = (int)Math.Floor(fy); float ax = fx - x0, ay = fy - y0;
            for (int c = 0; c < 3; c++) {
                Func<int, int, float> at = (xx, yy) => src[(Math.Max(0, Math.Min(ch - 1, yy)) * cw + Math.Max(0, Math.Min(cw - 1, xx))) * 3 + c];
                float v = (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
                dst[(y * ow + x) * 3 + c] = (byte)Math.Floor(v + 0.5f);
            }
        }
        return dst;
    }
    static byte[] LoadRgb(string file, out int w, out int h) {
        using (var bmp = new Bitmap(file)) {
            w = bmp.Width; h = bmp.Height; var rgb = new byte[w * h * 3];
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            var row = new byte[data.Stride];
            for (int y = 0; y < h; y++) { Marshal.Copy(data.Scan0 + y * data.Stride, row, 0, data.Stride); for (int x = 0; x < w; x++) { rgb[(y * w + x) * 3] = row[x * 3 + 2]; rgb[(y * w + x) * 3 + 1] = row[x * 3 + 1]; rgb[(y * w + x) * 3 + 2] = row[x * 3]; } }
            bmp.UnlockBits(data); return rgb;
        }
    }
    static void SaveRgb(string file, byte[] rgb, int w, int h) {
        using (var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
            var row = new byte[data.Stride];
            for (int y = 0; y < h; y++) { for (int x = 0; x < w; x++) { row[x * 3 + 2] = rgb[(y * w + x) * 3]; row[x * 3 + 1] = rgb[(y * w + x) * 3 + 1]; row[x * 3] = rgb[(y * w + x) * 3 + 2]; } Marshal.Copy(row, 0, data.Scan0 + y * data.Stride, data.Stride); }
            bmp.UnlockBits(data); bmp.Save(file, ImageFormat.Png);
        }
    }
    public static int Main(string[] args) {
        var u = Uni.Load(args[0]);
        int rw, rh; byte[] reference = LoadRgb(args[1], out rw, out rh);
        string prefix = args[2]; int threads = args.Length > 3 ? int.Parse(args[3]) : Environment.ProcessorCount;
        int cw = (int)u.ResX, ch = (int)u.ResY;
        RenderCanvas(u, cw, ch, threads); // 데우기(JIT)
        var sw = Stopwatch.StartNew(); byte[] canvas = RenderCanvas(u, cw, ch, 1); long one = sw.ElapsedMilliseconds;
        sw.Restart(); canvas = RenderCanvas(u, cw, ch, threads); long many = sw.ElapsedMilliseconds;
        sw.Restart(); byte[] mine = cw == rw && ch == rh ? canvas : Downsample(canvas, cw, ch, rw, rh); long down = sw.ElapsedMilliseconds;
        SaveRgb(prefix + "-cpu.png", mine, rw, rh);
        // 견주기: 화소 채널마다 차이
        int[] hist = new int[256]; long sum = 0; int max = 0; var diff = new byte[rw * rh * 3]; long n = 0;
        for (int i = 0; i < mine.Length; i++) { int dv = Math.Abs(mine[i] - reference[i]); hist[dv]++; sum += dv; if (dv > max) max = dv; diff[i] = (byte)Math.Min(255, dv * 16); n++; }
        long acc = 0; int p999 = 0, p99 = 0; for (int v = 0; v < 256; v++) { acc += hist[v]; if (p99 == 0 && acc >= n * 0.99) p99 = v == 0 ? -1 : v; if (p999 == 0 && acc >= n * 0.999) { p999 = v; break; } }
        if (p99 < 0) p99 = 0;
        long over2 = 0, over4 = 0, over8 = 0; for (int v = 3; v < 256; v++) over2 += hist[v]; for (int v = 5; v < 256; v++) over4 += hist[v]; for (int v = 9; v < 256; v++) over8 += hist[v];
        SaveRgb(prefix + "-diff16.png", diff, rw, rh);
        // 나란히: 왼쪽 시안, 오른쪽 CPU
        var pair = new byte[rw * 2 * rh * 3];
        for (int y = 0; y < rh; y++) { Buffer.BlockCopy(reference, y * rw * 3, pair, y * rw * 6, rw * 3); Buffer.BlockCopy(mine, y * rw * 3, pair, y * rw * 6 + rw * 3, rw * 3); }
        SaveRgb(prefix + "-pair.png", pair, rw * 2, rh);
        Console.WriteLine(String.Format(CultureInfo.InvariantCulture,
            "{0}: canvas {1}x{2} -> {3}x{4} | 1 thread {5} ms, {6} threads {7} ms, downsample {8} ms | diff mean {9:0.000} p99 {10} p99.9 {11} max {12} | >2 {13:0.000}% >4 {14:0.000}% >8 {15:0.0000}%",
            Path.GetFileName(prefix), cw, ch, rw, rh, one, threads, many, down, (double)sum / n, p99, p999, max, 100.0 * over2 / n, 100.0 * over4 / n, 100.0 * over8 / n));
        return 0;
    }
}
