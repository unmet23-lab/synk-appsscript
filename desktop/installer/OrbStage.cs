using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace Synk.SignalInstaller
{
    /// <summary>
    /// 검정 구의 셰이더 값 한 벌(검정 구 1-가 ③). 차례와 뜻은 orb/orb.hlsl의 레지스터, PC 앱 desktop/renderer/orb-stage.mjs의 uniform과 같다.
    /// 설치기에는 구 위의 자리가 없어서 그 값들은 없다.
    /// </summary>
    public struct OrbUniforms
    {
        public double ResX, ResY, Cx, Cy, R, Lit, Az, Lz, Focus, Gb, Dpr, Seed;
        public double AxisX, AxisY, AxisZ, Mark, Calm, Cut, CutOn;
        public double EyeKind, EyeVis, EyeOpen, EyeMood, FaceX, FaceY, GazeX, GazeY, GazeT;
    }

    /// <summary>GPU 판. orb.hlsl을 빌드할 때 컴파일한 바이트(어셈블리 자원 shader.orb.ps)를 WPF 효과로 그린다.</summary>
    public sealed class OrbEffect : ShaderEffect
    {
        public static readonly DependencyProperty InputProperty = RegisterPixelShaderSamplerProperty("Input", typeof(OrbEffect), 0);
        static DependencyProperty P(string name, int register) { return DependencyProperty.Register(name, typeof(Point), typeof(OrbEffect), new UIPropertyMetadata(new Point(), PixelShaderConstantCallback(register))); }
        static DependencyProperty D(string name, int register) { return DependencyProperty.Register(name, typeof(double), typeof(OrbEffect), new UIPropertyMetadata(0.0, PixelShaderConstantCallback(register))); }
        static readonly DependencyProperty Res = P("Res", 0), Center = P("Center", 1), Radius = D("Radius", 2), Lit = D("Lit", 3), Az = D("Az", 4), Lz = D("Lz", 5),
            Focus = D("Focus", 6), Gb = D("Gb", 7), Dpr = D("Dpr", 8), Seed = D("Seed", 9), AxisXY = P("AxisXY", 10), AxisZ = D("AxisZ", 11), Mark = D("Mark", 12),
            Calm = D("Calm", 13), Cut = D("Cut", 14), CutOn = D("CutOn", 15), EyeKV = P("EyeKV", 16), EyeOM = P("EyeOM", 17), FaceXY = P("FaceXY", 18),
            GazeXY = P("GazeXY", 19), GazeT = D("GazeT", 20);
        static readonly DependencyProperty[] All = { Res, Center, Radius, Lit, Az, Lz, Focus, Gb, Dpr, Seed, AxisXY, AxisZ, Mark, Calm, Cut, CutOn, EyeKV, EyeOM, FaceXY, GazeXY, GazeT };

        /// <summary>셰이더가 쓰는 명령 자리(fxc가 약 946이라고 적는다). 장치가 이만큼 받지 못하면 CPU 판으로 그린다.</summary>
        public const int RequiredInstructionSlots = 1024;

        public OrbEffect(byte[] bytecode)
        {
            PixelShader shader = new PixelShader();
            shader.SetStreamSource(new MemoryStream(bytecode));
            PixelShader = shader;
            UpdateShaderValue(InputProperty);
            foreach (DependencyProperty property in All) UpdateShaderValue(property);
        }

        public void Apply(OrbUniforms u)
        {
            SetValue(Res, new Point(u.ResX, u.ResY)); SetValue(Center, new Point(u.Cx, u.Cy)); SetValue(Radius, u.R); SetValue(Lit, u.Lit); SetValue(Az, u.Az); SetValue(Lz, u.Lz);
            SetValue(Focus, u.Focus); SetValue(Gb, u.Gb); SetValue(Dpr, u.Dpr); SetValue(Seed, u.Seed); SetValue(AxisXY, new Point(u.AxisX, u.AxisY)); SetValue(AxisZ, u.AxisZ);
            SetValue(Mark, u.Mark); SetValue(Calm, u.Calm); SetValue(Cut, u.Cut); SetValue(CutOn, u.CutOn); SetValue(EyeKV, new Point(u.EyeKind, u.EyeVis));
            SetValue(EyeOM, new Point(u.EyeOpen, u.EyeMood)); SetValue(FaceXY, new Point(u.FaceX, u.FaceY)); SetValue(GazeXY, new Point(u.GazeX, u.GazeY)); SetValue(GazeT, u.GazeT);
        }

        /// <summary>어셈블리에 실린 셰이더 바이트. 없으면 null(CPU 판으로 그린다).</summary>
        public static byte[] LoadBytecode()
        {
            try {
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("shader.orb.ps")) {
                    if (stream == null) return null;
                    MemoryStream copy = new MemoryStream(); stream.CopyTo(copy); return copy.ToArray();
                }
            } catch (Exception) { return null; }
        }
    }

    /// <summary>
    /// CPU 판. orb.hlsl(원본은 orb-stage.mjs의 FS)과 같은 셈을 C#으로 옮겼다. 그래픽 가속이 없는 창, 원격 세션, 창 검사(ui-check)가 쓴다.
    /// 원본을 고치면 이 셈도 고치고 desktop/tools/orb-parity.cjs --installer로 견준다.
    /// </summary>
    public static class OrbCpu
    {
        const double PI = 3.14159265, N1 = 110.0;
        static double Ss(double e0, double e1, double x) { double t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3.0 - 2.0 * t); }
        static double Mix(double a, double b, double t) { return a + (b - a) * t; }
        static double Clamp(double v, double a, double b) { return v < a ? a : v > b ? b : v; }
        static double Fract(double v) { return v - Math.Floor(v); }
        static double Ign(double x, double y) { return Fract(52.9829189 * Fract(x * 0.06711056 + y * 0.00583715)); }
        static double Len(double x, double y) { return Math.Sqrt(x * x + y * y); }
        static double SdBox(double px, double py, double bx, double by, double r)
        {
            double qx = Math.Abs(px) - bx + r, qy = Math.Abs(py) - by + r;
            return Len(Math.Max(qx, 0), Math.Max(qy, 0)) + Math.Min(Math.Max(qx, qy), 0) - r;
        }
        static double EyeSd(double px, double py, double open, double mood, double t, double czx, double czy)
        {
            if (mood < 0.5) { double h = Mix(0.012, czy, open); return SdBox(px, py, czx, h, Math.Min(czx, h)); }
            double sd;
            if (mood < 1.5) { double cx = px, cy = py + 0.060; sd = Math.Max(Math.Abs(Len(cx, cy) - 0.100) - 0.014, 0.045 - cy); }
            else if (mood < 2.5) { double cx = px, cy = py - 0.060; sd = Math.Max(Math.Abs(Len(cx, cy) - 0.100) - 0.014, cy + 0.045); }
            else if (mood < 3.5) { sd = SdBox(px, py, 0.056, 0.013, 0.013); }
            else { double a = t * 5.2; sd = Math.Min(Len(px - 0.052 * Math.Cos(a), py - 0.052 * Math.Sin(a)) - 0.026, Len(px - 0.052 * Math.Cos(a - 1.25), py - 0.052 * Math.Sin(a - 1.25)) - 0.015); }
            return Math.Max(sd, Math.Abs(py) - Mix(0.003, 0.2, open));
        }
        static void Norm(ref double x, ref double y, ref double z) { double l = Math.Sqrt(x * x + y * y + z * z); if (l > 0) { x /= l; y /= l; z /= l; } }

        /// <summary>캔버스 화소 하나(f는 아래 왼쪽에서 잰 화소 가운데)의 색(0~1)을 셈한다.</summary>
        public static void Shade(ref OrbUniforms u, double fx, double fy, out double cr, out double cg, out double cb)
        {
            double qx = fx - u.Cx, qy = fy - u.Cy;
            double dist = Len(qx, qy);
            double px = (dist - u.R) / u.Dpr;
            double inside = 1.0 - Ss(-0.7, 0.7, px);
            double dx = qx / Math.Max(dist, 0.001), dy = qy / Math.Max(dist, 0.001);
            double d = Math.Min(dist / u.R, 1.0);
            double z = Math.Sqrt(Math.Max(0.0, 1.0 - d * d));
            double nx = dx * d, ny = dy * d, nz = z;
            const double wr = 1.0, wg = 0.982, wb = 0.955;
            double line = Math.Exp(-Math.Abs(px) / 1.1);
            double halo = Math.Exp(-Math.Max(px, 0.0) / (0.045 * u.R / u.Dpr + 5.0));
            double ldx = Mix(Math.Cos(u.Az), -0.22, u.Focus), ldy = Mix(Math.Sin(u.Az), 1.0, u.Focus); double ll = Len(ldx, ldy); ldx /= ll; ldy /= ll;
            double mu = dx * ldx + dy * ldy;
            double cres = Ss(-0.5, 1.0, mu); cres *= cres;
            cres *= Mix(1.0, Math.Pow(Math.Max(mu, 0.0), 7.0), u.Focus);
            double pulse = 1.0 + 0.5 * u.Gb;
            double r = 0, g = 0, b = 0;
            if (px <= 0.4 * u.R / u.Dpr + 48.0)
            {
                double h = Math.Sqrt(Math.Max(1.0 - u.Lz * u.Lz, 0.0));
                double Lx = Math.Cos(u.Az) * h, Ly = Math.Sin(u.Az) * h, Lz = u.Lz;
                double Hx = Lx, Hy = Ly, Hz = Lz + 1.0; Norm(ref Hx, ref Hy, ref Hz);
                double Ax = u.AxisX, Ay = u.AxisY, Az = u.AxisZ; Norm(ref Ax, ref Ay, ref Az);
                double th = Math.Acos(Clamp(nx * Ax + ny * Ay + nz * Az, -1.0, 1.0));
                double Tx = Ay * nz - Az * ny, Ty = Az * nx - Ax * nz, Tz = Ax * ny - Ay * nx;
                double tl = Math.Sqrt(Tx * Tx + Ty * Ty + Tz * Tz);
                double tk = Math.Max(tl, 0.0001); Tx /= tk; Ty /= tk; Tz /= tk;
                double Bx = ny * Tz - nz * Ty, By = nz * Tx - nx * Tz, Bz = nx * Ty - ny * Tx;
                double sp = PI / N1 * u.R;
                double cap = Ss(7.0, 24.0, tl * u.R / u.Dpr);
                double v1 = Ss(2.4, 6.0, sp * z) * cap, v2 = Ss(2.4, 6.0, sp / 5.0 * z) * cap, v3 = Ss(2.4, 6.0, sp / 25.0 * z) * cap;
                double eTh = u.Cut * (1.5708 + Math.Acos(Clamp(Az, -1.0, 1.0)) + 0.05);
                double cutM = Mix(1.0, 1.0 - Ss(eTh - 0.014, eTh + 0.004, th), u.CutOn);
                v1 *= cutM; v2 *= cutM; v3 *= cutM;
                double s1 = Math.Sin(2.0 * N1 * th), s2 = Math.Sin(10.0 * N1 * th), s3 = Math.Sin(50.0 * N1 * th);
                double e1 = Clamp(7.5 / Math.Max(sp * z, 0.001), 0.06, 0.265), e2 = Clamp(7.5 / Math.Max(sp / 5.0 * z, 0.001), 0.06, 0.265);
                double w1 = s1 / Math.Sqrt(s1 * s1 + e1 * e1), w2 = s2 / Math.Sqrt(s2 * s2 + e2 * e2), w3 = s3 / Math.Sqrt(s3 * s3 + 0.12);
                double k = 0.22 * w1 * v1 + 0.10 * w2 * v2 + 0.05 * w3 * v3;
                double mx = nx + Bx * k, my = ny + By * k, mz = nz + Bz * k; Norm(ref mx, ref my, ref mz);
                double pole = Ss(Mix(0.03, 0.12, u.Mark), Mix(0.30, 0.58, u.Mark), tl);
                double tdh = Tx * Hx + Ty * Hy + Tz * Hz;
                double an = Math.Pow(Math.Max(1.0 - tdh * tdh, 0.0), Mix(44.0, 110.0, u.Focus)) * pole * Mix(0.07, 1.0, cutM);
                double nl = nx * Lx + ny * Ly + nz * Lz;
                double side = Ss(-0.28, 0.32, nl);
                double groove = 0.60 + 0.40 * (0.70 * w1 * v1 * (1.0 - 0.7 * v2) + 0.42 * w2 * v2 * (1.0 - 0.5 * v3) + 0.30 * w3 * v3);
                double spec = Math.Pow(Math.Max(mx * Hx + my * Hy + mz * Hz, 0.0), 30.0);
                double ax2 = -0.25, ay2 = 0.7, az2 = 0.66; Norm(ref ax2, ref ay2, ref az2);
                double amb = 0.5 + 0.5 * (mx * ax2 + my * ay2 + mz * az2);
                double rings = ((0.5 + 0.5 * w1) * v1 * 0.036 + (0.5 + 0.5 * w2) * v2 * 0.016 + (0.5 + 0.5 * w3) * v3 * 0.010) * amb;
                double L2x = -Lx * 0.7 + 0.35, L2y = -Ly * 0.5 - 0.3, L2z = 0.6; Norm(ref L2x, ref L2y, ref L2z);
                double H2x = L2x, H2y = L2y, H2z = L2z + 1.0; Norm(ref H2x, ref H2y, ref H2z);
                double t2 = Tx * H2x + Ty * H2y + Tz * H2z;
                double an2 = Math.Pow(Math.Max(1.0 - t2 * t2, 0.0), 28.0) * pole * Ss(-0.2, 0.4, nx * L2x + ny * L2y + nz * L2z) * Mix(0.12, 1.0, cutM);
                double calm = Mix(1.0, Mix(0.16, 1.0, Ss(0.47, 0.69, fy / u.ResY)), u.Calm);
                double tiny = 1.0 - Ss(14.0, 60.0, u.R / u.Dpr);
                double body = u.Lit * Mix(1.0, 0.1, tiny) * (an * side * groove * Mix(0.78, 0.46, u.Focus) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side + 0.010 * Math.Max(nl, 0.0));
                double edge = (1.0 - Ss(0.35, 1.0, Math.Abs(px))) * tiny * (0.26 + 0.5 * cres);
                double soft = 1.0 - 0.75 * tiny;
                double rim = u.Lit * (cres * (Math.Pow(1.0 - z, 5.0) * 0.14 + line * 0.16) * pulse * soft + edge);
                double unc = u.Lit * (1.0 - cutM) * Math.Pow(Math.Max(nx * Hx + ny * Hy + nz * Hz, 0.0), 9.0) * 0.085 * side;
                double live = u.CutOn * (u.Cut >= 0.004 ? 1 : 0) * (0.996 >= u.Cut ? 1 : 0);
                double dpx = (th - eTh) * u.R / u.Dpr;
                double seam = Math.Exp(-dpx * dpx / 1.5) * Ss(0.0, 0.3, z);
                double vd = Az; // dot(V, A), V = (0,0,1)
                double E1x = -Ax * vd, E1y = -Ay * vd, E1z = 1.0 - Az * vd; Norm(ref E1x, ref E1y, ref E1z);
                double ce = Math.Cos(eTh), se = Math.Sin(eTh);
                double Px = Ax * ce + E1x * se, Py = Ay * ce + E1y * se, Pz = Az * ce + E1z * se;
                double dP = Math.Sqrt((nx - Px) * (nx - Px) + (ny - Py) * (ny - Py) + (nz - Pz) * (nz - Pz)) * u.R / u.Dpr;
                double tool = (Math.Exp(-dP * dP / 12.0) + 0.20 * Math.Exp(-dP / 22.0)) * Ss(-0.03, 0.08, Pz);
                double cutLight = live * (seam * (0.09 + 0.28 * side) + tool * 0.95);
                double inR = 0.005 + wr * (body + rim + unc + cutLight), inG = 0.005 + wg * (body + rim + unc + cutLight), inB = 0.005 + wb * (body + rim + unc + cutLight);
                double outK = u.Lit * (cres * (line * 0.16 + halo * 0.03) * pulse * soft + edge);
                r = Mix(wr * outK, inR, inside); g = Mix(wg * outK, inG, inside); b = Mix(wb * outK, inB, inside);
            }
            double ev = u.EyeVis * inside;
            if (ev > 0.001 && u.EyeKind > 0.5)
            {
                double Fx = u.FaceX, Fy = u.FaceY, Fz = 1.0; Norm(ref Fx, ref Fy, ref Fz);
                double Rx = Fz, Ry = 0.0, Rz = -Fx; Norm(ref Rx, ref Ry, ref Rz); // cross((0,1,0), F)
                double Ux = Fy * Rz - Fz * Ry, Uy = Fz * Rx - Fx * Rz, Uz = Fx * Ry - Fy * Rx;
                double fpx = nx * Rx + ny * Ry + nz * Rz, fpy = nx * Ux + ny * Uy + nz * Uz;
                double front = Ss(0.10, 0.40, nx * Fx + ny * Fy + nz * Fz);
                double ppx = u.R / u.Dpr;
                double small = 1.0 - Ss(14.0, 60.0, ppx);
                double k = Mix(1.0, 1.85, small);
                double gs = 0.040 * k;
                double sep = 0.220 * Mix(1.0, 1.12, small);
                double gzx = u.GazeX * gs, gzy = u.GazeY * gs;
                double eLx = -sep + gzx, eLy = 0.06 + gzy, eRx = sep + gzx, eRy = 0.06 + gzy;
                double czx = Mix(0.050, 0.046, small), czy = Mix(0.094, 0.064, small);
                double sd = Math.Min(EyeSd((fpx - eLx) / k, (fpy - eLy) / k, u.EyeOpen, u.EyeMood, u.GazeT, czx, czy), EyeSd((fpx - eRx) / k, (fpy - eRy) / k, u.EyeOpen, u.EyeMood, u.GazeT, czx, czy)) * k;
                double solid = 1.0 - Ss(-0.6, 0.6, sd * ppx);
                double ccx = (Math.Floor(fpx / gs) + 0.5) * gs, ccy = (Math.Floor(fpy / gs) + 0.5) * gs;
                double cs = Math.Min(EyeSd((ccx - eLx) / k, (ccy - eLy) / k, u.EyeOpen, u.EyeMood, u.GazeT, czx, czy), EyeSd((ccx - eRx) / k, (ccy - eRy) / k, u.EyeOpen, u.EyeMood, u.GazeT, czx, czy)) * k;
                double tol = u.EyeMood < 0.5 ? 0.0 : 0.008;
                double on = 1.0 - Ss(tol - 0.003, tol + 0.003, cs);
                double edpx = Len(fpx - ccx, fpy - ccy) * ppx, rd = 0.27 * gs * ppx;
                double led = (1.0 - Ss(rd - 0.6, rd + 0.6, edpx)) + 0.20 * Math.Exp(-Math.Max(edpx - rd, 0.0) / (0.4 * rd + 0.5));
                double e = Mix(solid, on * led, Ss(3.0, 5.0, gs * ppx));
                double dim = 0.34 * (1.0 - Ss(-0.2 * gs, 1.0 * gs, sd));
                double keep = 1.0 - dim * ev * front, add = e * ev * front * 0.96;
                r = r * keep + wr * add; g = g * keep + wg * add; b = b * keep + wb * add;
            }
            double gr = Ign(fx + u.Seed * 7.31, fy + u.Seed * 7.31) + Ign(fy + 17.0 + u.Seed * 3.17, fx + 17.0 + u.Seed * 3.17) - 1.0;
            double grain = gr * 2.8 / 255.0;
            cr = Clamp(Math.Max(r + grain, 0.0), 0, 1); cg = Clamp(Math.Max(g + grain, 0.0), 0, 1); cb = Clamp(Math.Max(b + grain, 0.0), 0, 1);
        }

        /// <summary>캔버스 한 장(ResX×ResY, 위에서 아래로 센 BGRA)을 그린다. 줄마다 나눠 여러 스레드로 셈한다.</summary>
        public static void Render(OrbUniforms u, byte[] bgra, int stride)
        {
            int w = (int)u.ResX, h = (int)u.ResY;
            Parallel.For(0, h, delegate(int y) {
                OrbUniforms local = u;
                int row = y * stride;
                double fy = u.ResY - y - 0.5;
                for (int x = 0; x < w; x++) {
                    double r, g, b;
                    Shade(ref local, x + 0.5, fy, out r, out g, out b);
                    int i = row + x * 4;
                    bgra[i] = (byte)Math.Floor(b * 255.0 + 0.5); bgra[i + 1] = (byte)Math.Floor(g * 255.0 + 0.5); bgra[i + 2] = (byte)Math.Floor(r * 255.0 + 0.5); bgra[i + 3] = 255;
                }
            });
        }
    }

    /// <summary>
    /// 설치기 창의 검정 구 무대(검정 구 1-가 ③). PC 앱의 orb-stage.mjs에서 설치기가 쓰는 자세(void, forge), 깎기, 점 눈, 손을 따라가는 시차를 옮겼다.
    /// GPU를 쓸 수 있으면 셰이더 효과를 BitmapCache(RenderAtScale)로 화면보다 촘촘하게 그린 뒤 줄인다. 시안이 캔버스를 2배로 그리고 브라우저가 줄이는 것과 같다.
    /// 쓸 수 없으면(가속 없음, 원격 세션, ps_3_0 없음, 시험 강제) 같은 셈의 CPU 판을 뒤 스레드에서 그려 보인다.
    /// </summary>
    public sealed class OrbStage : Grid
    {
        public sealed class Pose
        {
            public double Cx, Top, R, Az, Lz, Lit, Focus, Ax0, Ax1, Ax2, Mark, Par, Calm, Eye;
            public Pose Copy() { return (Pose)MemberwiseClone(); }
        }
        sealed class Move { public Pose From; public string Name; public double T0, Ms; public Func<double, double> Ease; public Func<double, double, double, double> LitCurve; public Action Done; }
        sealed class Lid { public double From, To, T0, Ms; public Func<double, double> Ease; public Action Done; }

        public static double Rad(double d) { return d * Math.PI / 180; }
        public static double Lerp(double a, double b, double t) { return a + (b - a) * t; }
        public static double Clamp(double v, double a, double b) { return Math.Max(a, Math.Min(b, v)); }
        public static double Smooth(double a, double b, double x) { double t = Clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
        public static double EaseOut(double t) { return 1 - Math.Pow(1 - t, 3); }
        public static double EaseIO(double t) { return t < .5 ? 4 * t * t * t : 1 - Math.Pow(-2 * t + 2, 3) / 2; }
        public static double EaseIOQ(double t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.Pow(-2 * t + 2, 4) / 2; }
        static readonly double[] AxisRest = { 0.28, 0.52, 0.81 };

        /// <summary>새 판을 받는 동안 구가 서는 자리(웅장한 판). orb-stage.mjs의 forgeGeom과 같다.</summary>
        public static void ForgeGeom(double w, double h, double p, out double r, out double cy)
        {
            r = Math.Min(h * Lerp(0.5, 0.62, Clamp(p, 0, 1)), w * 0.78); cy = h * 0.64;
        }
        public static Pose PoseFor(string name, double w, double h, double forgeP)
        {
            double r0 = Math.Min(h * 0.21, w * 0.3);
            if (name == "forge") {
                double r, cy; ForgeGeom(w, h, forgeP, out r, out cy);
                return new Pose { Cx = w / 2, Top = cy - r, R = r, Az = Rad(128), Lz = 0.42, Lit = 0.58, Focus = 0, Ax0 = AxisRest[0], Ax1 = AxisRest[1], Ax2 = AxisRest[2], Mark = 0, Par = 0.16, Calm = 0.85, Eye = 1 };
            }
            if (name == "rest") return new Pose { Cx = w / 2, Top = h / 2 - r0, R = r0, Az = Rad(135), Lz = 0.5, Lit = 1, Focus = 0, Ax0 = AxisRest[0], Ax1 = AxisRest[1], Ax2 = AxisRest[2], Mark = 0, Par = 1, Calm = 0, Eye = 1 };
            return new Pose { Cx = w / 2, Top = h / 2 - r0, R = r0, Az = Rad(-50), Lz = 0.5, Lit = 0, Focus = 0, Ax0 = AxisRest[0], Ax1 = AxisRest[1], Ax2 = AxisRest[2], Mark = 0, Par = 1, Calm = 0, Eye = 0 };
        }
        /// <summary>자세 a에서 b로 가는 길의 한순간(orb-stage.mjs의 mixPose, 자리로 들어가는 길은 없다)</summary>
        public static void MixPose(Pose s, Pose a, Pose b, double t, Func<double, double> ease, Func<double, double, double, double> litCurve)
        {
            double e = ease(t);
            s.R = Math.Exp(Lerp(Math.Log(a.R), Math.Log(b.R), e));
            s.Az = Lerp(a.Az, b.Az, e); s.Focus = Lerp(a.Focus, b.Focus, e); s.Mark = Lerp(a.Mark, b.Mark, e); s.Par = Lerp(a.Par, b.Par, e); s.Calm = Lerp(a.Calm, b.Calm, e);
            s.Eye = a.Eye > b.Eye ? Lerp(a.Eye, b.Eye, Smooth(0, 0.3, t)) : Lerp(a.Eye, b.Eye, Smooth(0.6, 1, t));
            s.Lz = Lerp(a.Lz, b.Lz, e);
            s.Ax0 = Lerp(a.Ax0, b.Ax0, e); s.Ax1 = Lerp(a.Ax1, b.Ax1, e); s.Ax2 = Lerp(a.Ax2, b.Ax2, e);
            s.Lit = litCurve != null ? litCurve(t, a.Lit, b.Lit) : Lerp(a.Lit, b.Lit, e);
            s.Cx = Lerp(a.Cx, b.Cx, e); s.Top = Lerp(a.Top, b.Top, e);
        }

        static readonly Dictionary<string, int> MoodNo = new Dictionary<string, int> { { "calm", 0 }, { "smile", 1 }, { "sleep", 2 }, { "sorry", 3 }, { "busy", 4 } };

        readonly Stopwatch clock = Stopwatch.StartNew();
        readonly Random random = new Random();
        readonly byte[] bytecode;
        readonly Border cacheHost;
        readonly Rectangle surface;
        readonly Image cpuImage;
        OrbEffect effect;
        BitmapCache cache;
        bool gpu, cpuBusy, cpuDirty, attached, still;
        WriteableBitmap cpuBitmap;
        byte[] cpuPixels;

        Pose S = PoseFor("void", 1440, 940, 0);
        string poseName = "void";
        Move tween;
        double cut = 1, cutOn = 0, cutOnWant = 0, forgeP = 0;
        bool eyeOn = true; double eyeGate = 0, eyeGateS = 0, eyeOpen = 1, nextBlink = 0; string mood = "sleep"; Lid lid; int eyeToken;
        double faceX, faceY, gazeX, gazeY, ptrX = 0.5, ptrY = 0.5, ptrSX = 0.5, ptrSY = 0.5;
        double dprCap = 2, lastDraw; int frameNo, sampled, slowFrames;
        readonly List<Action> timers = new List<Action>();

        /// <summary>창 검사가 정하는 CPU 판의 촘촘함(화면 배율). 0이면 장치 배율을 쓴다</summary>
        public double CpuScale;
        /// <summary>참이면 GPU를 쓸 수 있어도 CPU 판으로 그린다(창 검사, 시험). 환경 변수 SYNK_ORB_CPU=1도 같다.</summary>
        public static bool ForceCpu;
        /// <summary>움직임 줄이기(Windows의 「애니메이션 효과」를 끈 때).</summary>
        public bool Reduced { get { return !SystemParameters.ClientAreaAnimation; } }
        public bool UsesGpu { get { return gpu; } }
        public string PoseName { get { return poseName; } }
        public double Cut { get { return cut; } }
        /// <summary>지금 빛(도착 쪽지에 마지막 장의 빛으로 적는다)</summary>
        public double Lit { get { return S.Lit; } }
        public string Mood { get { return eyeGate > 0 ? mood : "off"; } }
        public bool Moving { get { return tween != null; } }
        /// <summary>장면이 바뀔 때마다(화면 확인용) 알린다.</summary>
        public event EventHandler EyesChanged;

        public OrbStage(byte[] shaderBytecode)
        {
            bytecode = shaderBytecode;
            Background = Brushes.Black;
            SnapsToDevicePixels = true;
            surface = new Rectangle { Fill = Brushes.Black, SnapsToDevicePixels = true };
            cacheHost = new Border { Child = surface, Background = Brushes.Black };
            cpuImage = new Image { Stretch = Stretch.Fill, Visibility = Visibility.Collapsed };
            RenderOptions.SetBitmapScalingMode(cpuImage, BitmapScalingMode.Linear);
            Children.Add(cacheHost);
            Children.Add(cpuImage);
            Loaded += delegate { Attach(); };
            Unloaded += delegate { Detach(); };
            SizeChanged += delegate { Resize(); };
            RenderCapability.TierChanged += delegate { Dispatcher.BeginInvoke(new Action(ChooseRenderer)); };
        }

        double Now() { return clock.Elapsed.TotalMilliseconds + offset; }
        double W { get { return Math.Max(1, ActualWidth); } }
        double H { get { return Math.Max(1, ActualHeight); } }
        double DeviceScale
        {
            get {
                PresentationSource source = PresentationSource.FromVisual(this);
                return source != null && source.CompositionTarget != null ? source.CompositionTarget.TransformToDevice.M11 : 1.0;
            }
        }
        /// <summary>캔버스 촘촘함. orb-stage.mjs의 resize와 같은 셈이다(화면 점보다 촘촘하게, 느리면 dprCap을 한 단씩 낮춘다)</summary>
        double Dpr { get { if (!gpu && CpuScale > 0) return CpuScale; return Math.Min(Math.Max(DeviceScale, gpu ? dprCap : 1), Math.Sqrt(7e6 / (W * H))); } }

        /// <summary>GPU 판을 쓸 수 있는지 가른다(1-가 구현 설계 1절). WPF는 효과를 그리지 못해도 알려 주지 않으므로 미리 가른다.</summary>
        public static bool GpuAvailable(Visual visual)
        {
            if (ForceCpu || Environment.GetEnvironmentVariable("SYNK_ORB_CPU") == "1") return false;
            try {
                if ((RenderCapability.Tier >> 16) < 2) return false;
                if (!RenderCapability.IsPixelShaderVersionSupported(3, 0)) return false;
                if (RenderCapability.MaxPixelShaderInstructionSlots(3, 0) < OrbEffect.RequiredInstructionSlots) return false;
                if (SystemParameters.IsRemoteSession) return false;
                if (RenderOptions.ProcessRenderMode == RenderMode.SoftwareOnly) return false;
                HwndSource source = visual == null ? null : PresentationSource.FromVisual(visual) as HwndSource;
                if (source != null && source.CompositionTarget != null && source.CompositionTarget.RenderMode == RenderMode.SoftwareOnly) return false;
                return true;
            } catch (Exception) { return false; }
        }

        void ChooseRenderer()
        {
            bool want = bytecode != null && GpuAvailable(this);
            if (want && effect == null) { try { effect = new OrbEffect(bytecode); } catch (Exception) { want = false; } }
            gpu = want;
            if (gpu) {
                surface.Effect = effect;
                cacheHost.Visibility = Visibility.Visible; cpuImage.Visibility = Visibility.Collapsed;
            } else {
                surface.Effect = null;
                cacheHost.Visibility = Visibility.Collapsed; cpuImage.Visibility = Visibility.Visible;
            }
            Resize();
        }

        void Attach()
        {
            if (attached) return;
            attached = true;
            ChooseRenderer();
            CompositionTarget.Rendering += OnRendering;
            Window window = Window.GetWindow(this);
            if (window != null) {
                window.MouseMove += delegate(object sender, MouseEventArgs args) {
                    Point p = args.GetPosition(this);
                    SetPointer(p.X / W, p.Y / H);
                };
            }
        }
        void Detach()
        {
            if (!attached) return;
            attached = false;
            CompositionTarget.Rendering -= OnRendering;
        }

        void Resize()
        {
            if (gpu) {
                double scale = DeviceScale, k = Dpr / scale;
                if (cache == null || Math.Abs(cache.RenderAtScale - k) > 0.001) { cache = new BitmapCache(k) { SnapsToDevicePixels = true }; cacheHost.CacheMode = cache; }
            }
            if (tween == null) { double lit = S.Lit; Snap(poseName); if (poseName == "forge") S.Lit = lit; }
            cpuDirty = true;
        }

        // ── 자세 ──
        Pose Target(string name) { return PoseFor(name, W, H, forgeP); }
        public void Snap(string name)
        {
            FinishTween(false);
            S = Target(name).Copy(); poseName = name;
            cpuDirty = true;
        }
        public void Tween(string name, double ms, Func<double, double> ease, Func<double, double, double, double> litCurve, Action done)
        {
            FinishTween(true);
            poseName = name;
            double length = Reduced ? Math.Min(ms, 220) : ms;
            tween = new Move { From = S.Copy(), Name = name, T0 = Now(), Ms = Math.Max(1, length), Ease = ease ?? EaseIO, LitCurve = litCurve, Done = done };
        }
        void FinishTween(bool complete)
        {
            if (tween == null) return;
            Move t = tween; tween = null;
            if (complete) MixPose(S, t.From, Target(t.Name), 1, t.Ease, t.LitCurve);
            if (t.Done != null) t.Done();
        }
        void StepTween(double now)
        {
            if (tween == null) return;
            double k = Clamp((now - tween.T0) / tween.Ms, 0, 1);
            MixPose(S, tween.From, Target(tween.Name), k, tween.Ease, tween.LitCurve);
            if (k >= 1) { Move t = tween; tween = null; if (t.Done != null) t.Done(); }
        }
        public void SetLit(double value) { S.Lit = value; cpuDirty = true; }
        /// <summary>밝기를 ms 동안 바꾼다(실패 장면의 어두워짐)</summary>
        public void FadeLit(double to, double ms)
        {
            double from = S.Lit, t0 = Now(), length = Reduced ? Math.Min(ms, 120) : ms;
            Action step = null;
            step = delegate {
                double k = Clamp((Now() - t0) / length, 0, 1);
                S.Lit = Lerp(from, to, EaseIO(k)); cpuDirty = true;
                if (k >= 1) timers.Remove(step);
            };
            timers.Add(step);
        }
        /// <summary>깎인 만큼. 웅장한 판에서는 그만큼 구가 조금씩 커진다(orb-stage.mjs의 forgeAt)</summary>
        public void ForgeAt(double p)
        {
            cut = Clamp(p, 0, 1); forgeP = cut;
            if (poseName == "forge" && tween == null) { double r, cy; ForgeGeom(W, H, forgeP, out r, out cy); S.R = r; S.Top = cy - r; }
            cpuDirty = true;
        }
        public void SetCutOn(bool on, bool instant) { cutOnWant = on ? 1 : 0; if (instant) cutOn = cutOnWant; cpuDirty = true; }
        public void SetPointer(double x, double y) { ptrX = Clamp(x, 0, 1); ptrY = Clamp(y, 0, 1); }
        /// <summary>참이면 움직임 없이 지금 모습으로 선다(창 검사)</summary>
        public void SetStill(bool on) { still = on; }

        // ── 점 눈(orb-stage.mjs의 lidTo · blink · setMood · eyesWake를 그대로 옮겼다) ──
        void SayEyes() { EventHandler handler = EyesChanged; if (handler != null) handler(this, EventArgs.Empty); }
        void LidTo(double v, double ms, Func<double, double> ease, Action done)
        {
            if (lid != null) { Lid old = lid; lid = null; if (old.Done != null) old.Done(); }
            lid = new Lid { From = eyeOpen, To = v, T0 = Now(), Ms = Reduced ? Math.Min(ms, 80) : ms, Ease = ease ?? EaseIO, Done = done };
        }
        void EyeStop() { eyeToken++; if (lid != null) { lid = null; } }
        public void EyesAsleep() { EyeStop(); mood = "sleep"; eyeOpen = 1; eyeGate = 1; SayEyes(); cpuDirty = true; }
        public void EyesCalm() { EyeStop(); mood = "calm"; eyeOpen = 1; eyeGate = 1; SayEyes(); cpuDirty = true; }
        public void EyesOff() { EyeStop(); eyeGate = 0; eyeGateS = 0; mood = "sleep"; eyeOpen = 1; SayEyes(); cpuDirty = true; }
        public void EyesWake()
        {
            int k = ++eyeToken; eyeGate = 1;
            LidTo(0, 160, EaseIO, delegate {
                if (k != eyeToken) return;
                mood = "calm"; SayEyes();
                LidTo(1, 460, EaseOut, delegate { if (k == eyeToken) nextBlink = Now() + 1100; });
            });
        }
        public void SetMood(string next, double holdMs)
        {
            if (!MoodNo.ContainsKey(next)) return;
            int k = ++eyeToken;
            Action hold = delegate {
                if (k != eyeToken || holdMs <= 0) return;
                double at = Now() + (Reduced ? Math.Min(holdMs, 120) : holdMs);
                Action wait = null;
                wait = delegate { if (Now() < at) return; timers.Remove(wait); if (k == eyeToken) SetMood("calm", 0); };
                timers.Add(wait);
            };
            // 같은 표정이어도 깜빡임이나 앞선 표정 바꾸기가 눈을 감던 중이면 마저 뜬다. 위 ++eyeToken이 그 눈 뜨기를 지웠으므로,
            // 그대로 돌아가면 눈이 감긴 줄로 멈춘다(0.4.96 검수 A1)
            if (next == mood) {
                if (lid != null || eyeOpen < 1) LidTo(1, next == "calm" ? 260 : 190, EaseOut, delegate { if (k == eyeToken) hold(); });
                else hold();
                return;
            }
            LidTo(0, 110, EaseIO, delegate {
                if (k != eyeToken) return;
                mood = next; SayEyes();
                LidTo(1, next == "calm" ? 260 : 190, EaseOut, delegate { if (k == eyeToken) hold(); });
            });
        }
        void Blink()
        {
            int k = ++eyeToken;
            LidTo(0, 90, EaseIO, delegate { if (k == eyeToken) LidTo(1, 170, EaseOut, null); });
        }
        void StepEye(double now)
        {
            if (lid != null) {
                double k = Clamp((now - lid.T0) / lid.Ms, 0, 1);
                eyeOpen = Lerp(lid.From, lid.To, lid.Ease(k));
                if (k >= 1) { Lid done = lid; lid = null; if (done.Done != null) done.Done(); }
            }
            eyeGateS += (eyeGate - eyeGateS) * 0.09;
            if (!Reduced && !still && lid == null && mood == "calm" && eyeGateS > 0.9 && S.Eye > 0.9 && now > nextBlink) { nextBlink = now + 2600 + random.NextDouble() * 4200; Blink(); }
        }

        // ── 그리기 ──
        /// <summary>지금 모습의 셰이더 값. 손을 따라가는 시차, 숨 쉬는 빛, 눈길은 orb-stage.mjs의 draw와 같다.</summary>
        public OrbUniforms Uniforms(double now, bool advance)
        {
            double sec = now / 1000, motion = Reduced || still ? 0 : 1;
            if (advance) {
                ptrSX += (ptrX - ptrSX) * 0.06; ptrSY += (ptrY - ptrSY) * 0.06;
                StepEye(now);
                cutOn += (cutOnWant - cutOn) * (motion > 0 ? 0.09 : 1);
            }
            double w = W, h = H, dpr = Dpr;
            double free = S.Par * motion, par = free * S.R * 0.05;
            double cx = S.Cx + (ptrSX - 0.5) * par, cy = S.Top + S.R + (ptrSY - 0.5) * par;
            double az = S.Az + ((ptrSX - 0.5) * -(0.7 * free + 0.14 * S.Focus + 0.2 * (1 - S.Par) * (1 - S.Focus)) + 0.05 * Math.Sin(sec * 0.4)) * motion;
            double ax0 = S.Ax0 + (ptrSX - 0.5) * 0.24 * free, ax1 = S.Ax1 - (ptrSY - 0.5) * 0.2 * free, ax2 = S.Ax2;
            if (advance) {
                double reach = Math.Max(280, S.R * 2.6), wx = Clamp((ptrSX * w - cx) / reach, -1, 1) * 0.5, wy = Clamp((cy - ptrSY * h) / reach, -1, 1) * 0.4, q = motion > 0 ? 0.1 : 1;
                gazeX = Clamp((wx - faceX) * 7, -1, 1); gazeY = Clamp((wy - faceY) * 7, -1, 1);
                faceX += (wx - faceX) * q; faceY += (wy - faceY) * q;
                if (motion > 0) frameNo = (frameNo + 1) % 64;
            }
            double lit = S.Lit * (1 + 0.03 * Math.Sin(sec * 0.9) * motion);
            OrbUniforms u = new OrbUniforms();
            u.ResX = Math.Round(w * dpr); u.ResY = Math.Round(h * dpr);
            u.Cx = cx * dpr; u.Cy = (h - cy) * dpr; u.R = S.R * dpr; u.Lit = lit; u.Az = az; u.Lz = S.Lz; u.Focus = S.Focus; u.Gb = 0; u.Dpr = dpr; u.Seed = frameNo;
            u.AxisX = ax0; u.AxisY = ax1; u.AxisZ = ax2; u.Mark = 0; u.Calm = S.Calm; u.Cut = cut; u.CutOn = cutOn;
            u.EyeKind = eyeOn ? 1 : 0; u.EyeVis = S.Eye * eyeGateS; u.EyeOpen = eyeOpen; u.EyeMood = MoodNo[mood];
            u.FaceX = faceX; u.FaceY = faceY; u.GazeX = gazeX; u.GazeY = gazeY; u.GazeT = sec % 600;
            return u;
        }

        bool Idle() { return tween == null && lid == null && Math.Abs(eyeGate - eyeGateS) < 0.01 && Math.Abs(cutOnWant - cutOn) < 0.01 && Math.Abs(ptrX - ptrSX) < 0.001 && Math.Abs(ptrY - ptrSY) < 0.001 && timers.Count == 0; }

        void OnRendering(object sender, EventArgs args)
        {
            Window window = Window.GetWindow(this);
            if (!IsVisible || window == null || window.WindowState == WindowState.Minimized) return;
            double now = Now(), gap = now - lastDraw;
            bool resting = Idle();
            if (resting && gap < 32) return;
            // 60장 가운데 40장 넘게 느리면(움직일 때 24ms, 멈춰 있을 때 50ms 넘음) 촘촘함을 한 단 낮춘다(orb-stage.mjs와 같다)
            if (gpu && lastDraw > 0 && gap > 0 && gap < 1000) {
                sampled++; if (gap > (resting ? 50 : 24)) slowFrames++;
                if (sampled >= 60) { if (slowFrames > 40 && dprCap > 1) { dprCap = dprCap > 1.5 ? 1.5 : 1; Resize(); } sampled = 0; slowFrames = 0; }
            }
            lastDraw = now;
            foreach (Action timer in timers.ToArray()) timer();
            StepTween(now);
            OrbUniforms u = Uniforms(now, true);
            if (gpu) { effect.Apply(u); return; }
            if (!CpuDue(cpuBusy, resting, ref cpuDirty, now - lastCpu)) return;
            lastCpu = now;
            DrawCpuAsync(u);
        }
        double lastCpu;
        /// <summary>
        /// CPU 판이 이 장을 그릴지 고른다. 한 장에 수백 ms가 걸리므로 바뀐 것이 없으면 1초에 한 번만 다시 그린다(1-가 구현 설계 1절의 사다리).
        /// 앞 장을 그리는 중이라 건너뛴 움직이는 장은 dirty로 남긴다. 그러지 않으면 그 사이에 끝난 짧은 전환이 1초 막음에 걸려
        /// 전환 앞의 모습이 1초 가까이 남았다(0.4.96 검수 A2)
        /// </summary>
        internal static bool CpuDue(bool busy, bool resting, ref bool dirty, double sinceLast)
        {
            if (busy) { if (!resting) dirty = true; return false; }
            if (!dirty && resting && sinceLast < 1000) return false;
            dirty = false;
            return true;
        }

        void DrawCpuAsync(OrbUniforms u)
        {
            if (cpuBusy) return;
            cpuBusy = true;
            Task.Factory.StartNew(delegate {
                int w = (int)u.ResX, h = (int)u.ResY, stride = w * 4;
                byte[] pixels = cpuPixels != null && cpuPixels.Length == stride * h ? cpuPixels : new byte[stride * h];
                OrbCpu.Render(u, pixels, stride);
                return pixels;
            }).ContinueWith(delegate(Task<byte[]> done) {
                cpuBusy = false;
                if (done.IsFaulted) return;
                ShowCpu(u, done.Result);
            }, TaskScheduler.FromCurrentSynchronizationContext());
        }
        void ShowCpu(OrbUniforms u, byte[] pixels)
        {
            int w = (int)u.ResX, h = (int)u.ResY, stride = w * 4;
            cpuPixels = pixels;
            if (cpuBitmap == null || cpuBitmap.PixelWidth != w || cpuBitmap.PixelHeight != h) { cpuBitmap = new WriteableBitmap(w, h, 96, 96, PixelFormats.Bgra32, null); cpuImage.Source = cpuBitmap; }
            cpuBitmap.WritePixels(new Int32Rect(0, 0, w, h), pixels, stride, 0);
        }

        /// <summary>지금 모습을 CPU 판으로 그 자리에서 한 장 그린다(창 검사가 RenderTargetBitmap 앞에서 부른다. 그 그림은 GPU 효과를 찍지 못한다)</summary>
        public void RenderCpuNow()
        {
            gpu = false; surface.Effect = null; cacheHost.Visibility = Visibility.Collapsed; cpuImage.Visibility = Visibility.Visible;
            Settle();
            OrbUniforms u = Uniforms(Now(), false);
            int w = (int)u.ResX, h = (int)u.ResY, stride = w * 4;
            byte[] pixels = new byte[stride * h];
            OrbCpu.Render(u, pixels, stride);
            ShowCpu(u, pixels);
        }

        /// <summary>움직임을 모두 끝 모습으로 세운다(창 검사). 자세 옮기기, 눈꺼풀, 밝기 바꾸기, 깎는 장면 켜기를 마친다</summary>
        public void Settle()
        {
            for (int guard = 0; guard < 20; guard++) {
                bool busy = false;
                if (tween != null) { FinishTween(true); busy = true; }
                if (lid != null) { eyeOpen = lid.To; Lid done = lid; lid = null; if (done.Done != null) done.Done(); busy = true; }
                if (timers.Count > 0) { offset += 1e7; foreach (Action timer in timers.ToArray()) timer(); busy = true; }
                if (!busy) break;
            }
            eyeGateS = eyeGate; cutOn = cutOnWant; ptrSX = ptrX; ptrSY = ptrY;
        }
        double offset;

        /// <summary>시험용: 지금 상태</summary>
        public string Describe()
        {
            return String.Format(System.Globalization.CultureInfo.InvariantCulture, "pose={0} cut={1:0.###} cutOn={2:0.##} lit={3:0.###} eyes={4} gpu={5} r={6:0.#}", poseName, cut, cutOnWant, S.Lit, Mood, gpu, S.R);
        }
    }
}
