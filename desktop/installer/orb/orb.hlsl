// SYNK Platform 설치기의 검정 구(검정 구 1-가 ③). 원본은 PC 앱 desktop/renderer/orb-stage.mjs의 FS 하나다.
// 이 판은 그 셰이더를 HLSL(ps_3_0)로 옮긴 것이고, 구 위의 자리(place)만 뺐다. 설치기에는 자리가 없기 때문이다.
// 깎기와 점 눈은 그대로 옮겼다. 원본을 고치면 이 파일과 OrbCpu.cs(같은 셈의 CPU 판)도 고치고,
// desktop/tools/orb-parity.cjs --installer로 셋이 같은지 본다.
// 값은 모두 실행 중에 받는다(사용자 PC에서는 fxc를 돌릴 수 없다). 빌드할 때 build-signal.cjs가 컴파일한다.
// 셰이더는 그리는 면의 화소마다 한 번 셈한다. 시안처럼 화면보다 촘촘하게 그리는 일은 설치기 창이 맡는다
// (구를 그리는 판을 BitmapCache의 RenderAtScale로 촘촘하게 그린 뒤 화면 크기로 줄인다, OrbView.cs).
sampler2D input : register(s0);
float2 uRes : register(c0);      // 캔버스 크기(화소)
float2 uC : register(c1);        // 구 가운데(캔버스 화소, 아래에서 위로 센다)
float uR : register(c2);
float uLit : register(c3);
float uAz : register(c4);
float uLz : register(c5);
float uFocus : register(c6);
float uGb : register(c7);
float uDpr : register(c8);
float uSeed : register(c9);
float2 uAxisXY : register(c10);
float uAxisZ : register(c11);
float uMark : register(c12);
float uCalm : register(c13);
float uCut : register(c14);
float uCutOn : register(c15);
float2 uEyeKV : register(c16);   // 종류(1 점, 0 없음), 보이는 정도
float2 uEyeOM : register(c17);   // 뜬 정도, 표정(0 평소, 1 웃음, 2 잠, 3 문제, 4 일하는 중)
float2 uFaceXY : register(c18);  // 얼굴이 향한 쪽(z는 1)
float2 uGazeXY : register(c19);
float uGazeT : register(c20);    // 초(일하는 중 표정의 점이 도는 때)

static const float PI = 3.14159265;
static const float RHO = 0.092;
// GLSL의 smoothstep은 경계가 거꾸로여도 같은 식으로 셈한다. fxc의 smoothstep은 그렇지 않아(1-가 시험의 함정) 식을 직접 쓴다
float ss(float e0, float e1, float x) { float t = saturate((x - e0) / (e1 - e0)); return t * t * (3.0 - 2.0 * t); }
float ign(float2 p) { return frac(52.9829189 * frac(dot(p, float2(0.06711056, 0.00583715)))); }
float sdBox(float2 p, float2 b, float r) { float2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float eyeSd(float2 p, float open, float mood, float t, float2 cz) {
  [branch] if (mood < 0.5) { float h = lerp(0.012, cz.y, open); return sdBox(p, float2(cz.x, h), min(cz.x, h)); }
  float sd;
  [branch] if (mood < 1.5) { float2 c = p - float2(0.0, -0.060); sd = max(abs(length(c) - 0.100) - 0.014, 0.045 - c.y); }
  else if (mood < 2.5) { float2 c = p - float2(0.0, 0.060); sd = max(abs(length(c) - 0.100) - 0.014, c.y + 0.045); }
  else if (mood < 3.5) { sd = sdBox(p, float2(0.056, 0.013), 0.013); }
  else { float a = t * 5.2; sd = min(length(p - 0.052 * float2(cos(a), sin(a))) - 0.026, length(p - 0.052 * float2(cos(a - 1.25), sin(a - 1.25))) - 0.015); }
  return max(sd, abs(p.y) - lerp(0.003, 0.2, open));
}
float3 shade(float2 f) {
  float2 q = f - uC;
  float dist = length(q);
  float px = (dist - uR) / uDpr;
  float inside = 1.0 - ss(-0.7, 0.7, px);
  float2 dir = q / max(dist, 0.001);
  float d = min(dist / uR, 1.0);
  float z = sqrt(max(0.0, 1.0 - d * d));
  float3 n = float3(dir * d, z);
  float3 warm = float3(1.0, 0.982, 0.955);
  float line_ = exp(-abs(px) / 1.1);
  float halo = exp(-max(px, 0.0) / (0.045 * uR / uDpr + 5.0));
  float2 Ld = normalize(lerp(float2(cos(uAz), sin(uAz)), float2(-0.22, 1.0), uFocus));
  float mu = dot(dir, Ld);
  float cres = ss(-0.5, 1.0, mu); cres *= cres;
  cres *= lerp(1.0, pow(max(mu, 0.0), 7.0), uFocus);
  float pulse = 1.0 + 0.5 * uGb;
  float3 col = float3(0.0, 0.0, 0.0);
  [branch] if (px <= 0.4 * uR / uDpr + 48.0) {
    const float N1 = 110.0;
    float h = sqrt(max(1.0 - uLz * uLz, 0.0));
    float3 L = float3(cos(uAz) * h, sin(uAz) * h, uLz);
    float3 V = float3(0.0, 0.0, 1.0);
    float3 H = normalize(L + V);
    float3 A = normalize(float3(uAxisXY, uAxisZ));
    float th = acos(clamp(dot(n, A), -1.0, 1.0));
    float3 T = cross(A, n);
    float tl = length(T);
    T /= max(tl, 0.0001);
    float3 B = cross(n, T);
    float sp = PI / N1 * uR;
    float cap = ss(7.0, 24.0, tl * uR / uDpr);
    float v1 = ss(2.4, 6.0, sp * z) * cap;
    float v2 = ss(2.4, 6.0, sp / 5.0 * z) * cap;
    float v3 = ss(2.4, 6.0, sp / 25.0 * z) * cap;
    float eTh = uCut * (1.5708 + acos(clamp(A.z, -1.0, 1.0)) + 0.05);
    float cutM = lerp(1.0, 1.0 - ss(eTh - 0.014, eTh + 0.004, th), uCutOn);
    v1 *= cutM; v2 *= cutM; v3 *= cutM;
    float s1 = sin(2.0 * N1 * th), s2 = sin(10.0 * N1 * th), s3 = sin(50.0 * N1 * th);
    float e1 = clamp(7.5 / max(sp * z, 0.001), 0.06, 0.265), e2 = clamp(7.5 / max(sp / 5.0 * z, 0.001), 0.06, 0.265);
    float w1 = s1 / sqrt(s1 * s1 + e1 * e1), w2 = s2 / sqrt(s2 * s2 + e2 * e2), w3 = s3 / sqrt(s3 * s3 + 0.12);
    float3 nn = normalize(n + B * (0.22 * w1 * v1 + 0.10 * w2 * v2 + 0.05 * w3 * v3));
    float pole = ss(lerp(0.03, 0.12, uMark), lerp(0.30, 0.58, uMark), tl);
    float tdh = dot(T, H);
    float an = pow(max(1.0 - tdh * tdh, 0.0), lerp(44.0, 110.0, uFocus)) * pole * lerp(0.07, 1.0, cutM);
    float side = ss(-0.28, 0.32, dot(n, L));
    float groove = 0.60 + 0.40 * (0.70 * w1 * v1 * (1.0 - 0.7 * v2) + 0.42 * w2 * v2 * (1.0 - 0.5 * v3) + 0.30 * w3 * v3);
    float spec = pow(max(dot(nn, H), 0.0), 30.0);
    float amb = 0.5 + 0.5 * dot(nn, normalize(float3(-0.25, 0.7, 0.66)));
    float rings = ((0.5 + 0.5 * w1) * v1 * 0.036 + (0.5 + 0.5 * w2) * v2 * 0.016 + (0.5 + 0.5 * w3) * v3 * 0.010) * amb;
    float3 L2 = normalize(float3(-L.x * 0.7 + 0.35, -L.y * 0.5 - 0.3, 0.6));
    float3 H2 = normalize(L2 + V);
    float t2 = dot(T, H2);
    float an2 = pow(max(1.0 - t2 * t2, 0.0), 28.0) * pole * ss(-0.2, 0.4, dot(n, L2)) * lerp(0.12, 1.0, cutM);
    float calm = lerp(1.0, lerp(0.16, 1.0, ss(0.47, 0.69, f.y / uRes.y)), uCalm);
    float tiny = 1.0 - ss(14.0, 60.0, uR / uDpr);
    float3 inC = float3(0.005, 0.005, 0.005) + warm * uLit * lerp(1.0, 0.1, tiny) * (an * side * groove * lerp(0.78, 0.46, uFocus) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side + 0.010 * max(dot(n, L), 0.0));
    float edge = (1.0 - ss(0.35, 1.0, abs(px))) * tiny * (0.26 + 0.5 * cres);
    float soft = 1.0 - 0.75 * tiny;
    inC += warm * uLit * (cres * (pow(1.0 - z, 5.0) * 0.14 + line_ * 0.16) * pulse * soft + edge);
    inC += warm * uLit * (1.0 - cutM) * pow(max(dot(n, H), 0.0), 9.0) * 0.085 * side;
    float live = uCutOn * step(0.004, uCut) * step(uCut, 0.996);
    float dpx = (th - eTh) * uR / uDpr;
    float seam = exp(-dpx * dpx / 1.5) * ss(0.0, 0.3, z);
    float3 E1 = normalize(V - A * dot(V, A));
    float3 P = A * cos(eTh) + E1 * sin(eTh);
    float dP = length(n - P) * uR / uDpr;
    float tool = (exp(-dP * dP / 12.0) + 0.20 * exp(-dP / 22.0)) * ss(-0.03, 0.08, P.z);
    inC += warm * live * (seam * (0.09 + 0.28 * side) + tool * 0.95);
    float3 outC = warm * uLit * (cres * (line_ * 0.16 + halo * 0.03) * pulse * soft + edge);
    col = lerp(outC, inC, inside);
  }
  // 점 눈(원본의 같은 자리를 그대로 옮겼다)
  float ev = uEyeKV.y * inside;
  [branch] if (ev > 0.001 && uEyeKV.x > 0.5) {
    float3 F = normalize(float3(uFaceXY, 1.0));
    float3 Rr = normalize(cross(float3(0.0, 1.0, 0.0), F));
    float3 Uu = cross(F, Rr);
    float2 fp = float2(dot(n, Rr), dot(n, Uu));
    float front = ss(0.10, 0.40, dot(n, F));
    float ppx = uR / uDpr;
    float small = 1.0 - ss(14.0, 60.0, ppx);
    float k = lerp(1.0, 1.85, small);
    float g = 0.040 * k;
    float sep = 0.220 * lerp(1.0, 1.12, small);
    float2 gz = uGazeXY * g;
    float2 eL = float2(-sep, 0.06) + gz, eR = float2(sep, 0.06) + gz;
    float2 cz = lerp(float2(0.050, 0.094), float2(0.046, 0.064), small);
    float sd = min(eyeSd((fp - eL) / k, uEyeOM.x, uEyeOM.y, uGazeT, cz), eyeSd((fp - eR) / k, uEyeOM.x, uEyeOM.y, uGazeT, cz)) * k;
    float solid = 1.0 - ss(-0.6, 0.6, sd * ppx);
    float2 cc = (floor(fp / g) + 0.5) * g;
    float cs = min(eyeSd((cc - eL) / k, uEyeOM.x, uEyeOM.y, uGazeT, cz), eyeSd((cc - eR) / k, uEyeOM.x, uEyeOM.y, uGazeT, cz)) * k;
    float tol = uEyeOM.y < 0.5 ? 0.0 : 0.008;
    float on = 1.0 - ss(tol - 0.003, tol + 0.003, cs);
    float edpx = length(fp - cc) * ppx, rd = 0.27 * g * ppx;
    float led = (1.0 - ss(rd - 0.6, rd + 0.6, edpx)) + 0.20 * exp(-max(edpx - rd, 0.0) / (0.4 * rd + 0.5));
    float e = lerp(solid, on * led, ss(3.0, 5.0, g * ppx));
    float dim = 0.34 * (1.0 - ss(-0.2 * g, 1.0 * g, sd));
    col *= 1.0 - dim * ev * front;
    col += warm * e * ev * front * 0.96;
  }
  float gr = ign(f + uSeed * 7.31) + ign(f.yx + 17.0 + uSeed * 3.17) - 1.0;
  col += gr * 2.8 / 255.0;
  return saturate(max(col, 0.0));
}
// 캔버스 화소(위 왼쪽 기준 정수 자리)를 셈하고, 캔버스처럼 8비트로 끊는다. 캔버스 y는 아래에서 위로 센다
float4 main(float2 uv : TEXCOORD) : COLOR {
  float2 c = clamp(floor(uv * uRes), 0.0, uRes - 1.0);
  float3 v = floor(shade(float2(c.x + 0.5, uRes.y - c.y - 0.5)) * 255.0 + 0.5) / 255.0;
  return float4(v, 1.0) + tex2D(input, uv) * 0.0;
}
