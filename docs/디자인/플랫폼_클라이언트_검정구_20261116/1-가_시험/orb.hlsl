// 검정구.html FS의 HLSL 판(새 판 받기 장면만, 새긴 자리 없음). 앞에 붙는 #define이 셰이더 값이다.
sampler2D input : register(s0);
static const float PI = 3.14159265;
// GLSL의 smoothstep은 경계가 거꾸로여도 같은 식으로 셈한다. fxc의 smoothstep은 그렇지 않아(경계 넘으면 1) 식을 직접 쓴다
float ss(float e0, float e1, float x) { float t = saturate((x - e0) / (e1 - e0)); return t * t * (3.0 - 2.0 * t); }
float ign(float2 p) { return frac(52.9829189 * frac(dot(p, float2(0.06711056, 0.00583715)))); }
float3 shade(float2 f) {
  float2 q = f - float2(CX, CY);
  float dist = length(q);
  float px = (dist - UR) / DPR;
  float inside = 1.0 - ss(-0.7, 0.7, px);
  float2 dir = q / max(dist, 0.001);
  float d = min(dist / UR, 1.0);
  float z = sqrt(max(0.0, 1.0 - d * d));
  float3 n = float3(dir * d, z);
  float3 warm = float3(1.0, 0.982, 0.955);
  float line_ = exp(-abs(px) / 1.1);
  float halo = exp(-max(px, 0.0) / (0.045 * UR / DPR + 5.0));
  float2 Ld = normalize(lerp(float2(cos(AZ), sin(AZ)), float2(-0.22, 1.0), FOCUS));
  float mu = dot(dir, Ld);
  float cres = ss(-0.5, 1.0, mu); cres *= cres;
  cres *= lerp(1.0, pow(max(mu, 0.0), 7.0), FOCUS);
  float pulse = 1.0 + 0.5 * GB;
  float3 col = float3(0, 0, 0);
  [branch] if (px <= 0.4 * UR / DPR + 48.0) {
    const float N1 = 110.0;
    float h = sqrt(max(1.0 - LZ * LZ, 0.0));
    float3 L = float3(cos(AZ) * h, sin(AZ) * h, LZ);
    float3 V = float3(0, 0, 1);
    float3 H = normalize(L + V);
    float3 A = normalize(AXIS);
    float th = acos(clamp(dot(n, A), -1.0, 1.0));
    float3 T = cross(A, n);
    float tl = length(T);
    T /= max(tl, 0.0001);
    float3 B = cross(n, T);
    float sp = PI / N1 * UR;
    float cap = ss(7.0, 24.0, tl * UR / DPR);
    float v1 = ss(2.4, 6.0, sp * z) * cap;
    float v2 = ss(2.4, 6.0, sp / 5.0 * z) * cap;
    float v3 = ss(2.4, 6.0, sp / 25.0 * z) * cap;
    float eTh = CUT * (1.5708 + acos(clamp(A.z, -1.0, 1.0)) + 0.05);
    float cutM = lerp(1.0, 1.0 - ss(eTh - 0.014, eTh + 0.004, th), CUTON);
    v1 *= cutM; v2 *= cutM; v3 *= cutM;
    float s1 = sin(2.0 * N1 * th), s2 = sin(10.0 * N1 * th), s3 = sin(50.0 * N1 * th);
    float e1 = clamp(7.5 / max(sp * z, 0.001), 0.06, 0.265), e2 = clamp(7.5 / max(sp / 5.0 * z, 0.001), 0.06, 0.265);
    float w1 = s1 / sqrt(s1 * s1 + e1 * e1), w2 = s2 / sqrt(s2 * s2 + e2 * e2), w3 = s3 / sqrt(s3 * s3 + 0.12);
    float3 nn = normalize(n + B * (0.22 * w1 * v1 + 0.10 * w2 * v2 + 0.05 * w3 * v3));
    float pole = ss(lerp(0.03, 0.12, MARK), lerp(0.30, 0.58, MARK), tl);
    float tdh = dot(T, H);
    float an = pow(max(1.0 - tdh * tdh, 0.0), lerp(44.0, 110.0, FOCUS)) * pole * lerp(0.07, 1.0, cutM);
    float side = ss(-0.28, 0.32, dot(n, L));
    float groove = 0.60 + 0.40 * (0.70 * w1 * v1 * (1.0 - 0.7 * v2) + 0.42 * w2 * v2 * (1.0 - 0.5 * v3) + 0.30 * w3 * v3);
    float spec = pow(max(dot(nn, H), 0.0), 30.0);
    float amb = 0.5 + 0.5 * dot(nn, normalize(float3(-0.25, 0.7, 0.66)));
    float rings = ((0.5 + 0.5 * w1) * v1 * 0.036 + (0.5 + 0.5 * w2) * v2 * 0.016 + (0.5 + 0.5 * w3) * v3 * 0.010) * amb;
    float3 L2 = normalize(float3(-L.x * 0.7 + 0.35, -L.y * 0.5 - 0.3, 0.6));
    float3 H2 = normalize(L2 + V);
    float t2 = dot(T, H2);
    float an2 = pow(max(1.0 - t2 * t2, 0.0), 28.0) * pole * ss(-0.2, 0.4, dot(n, L2)) * lerp(0.12, 1.0, cutM);
    float calm = lerp(1.0, lerp(0.16, 1.0, ss(0.47, 0.69, f.y / RESY)), CALM);
    float tiny = ss(60.0, 14.0, UR / DPR);
    float3 inC = float3(0.005, 0.005, 0.005) + warm * LIT * lerp(1.0, 0.1, tiny) * (an * side * groove * lerp(0.78, 0.46, FOCUS) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side + 0.010 * max(dot(n, L), 0.0));
    float edge = (1.0 - ss(0.35, 1.0, abs(px))) * tiny * (0.26 + 0.5 * cres);
    float soft = 1.0 - 0.75 * tiny;
    inC += warm * LIT * (cres * (pow(1.0 - z, 5.0) * 0.14 + line_ * 0.16) * pulse * soft + edge);
    inC += warm * LIT * (1.0 - cutM) * pow(max(dot(n, H), 0.0), 9.0) * 0.085 * side;
    float live = CUTON * step(0.004, CUT) * step(CUT, 0.996);
    float dpx = (th - eTh) * UR / DPR;
    float seam = exp(-dpx * dpx / 1.5) * ss(0.0, 0.3, z);
    float3 E1 = normalize(V - A * dot(V, A));
    float3 P = A * cos(eTh) + E1 * sin(eTh);
    float dP = length(n - P) * UR / DPR;
    float tool = (exp(-dP * dP / 12.0) + 0.20 * exp(-dP / 22.0)) * ss(-0.03, 0.08, P.z);
    inC += warm * live * (seam * (0.09 + 0.28 * side) + tool * 0.95);
    float3 outC = warm * LIT * (cres * (line_ * 0.16 + halo * 0.03) * pulse * soft + edge);
    col = lerp(outC, inC, inside);
  }
  float g = ign(f + SEED * 7.31) + ign(f.yx + 17.0 + SEED * 3.17) - 1.0;
  col += g * 2.8 / 255.0;
  return saturate(max(col, 0.0));
}
float3 canvasTexel(float cx, float cy) {
  // 캔버스 화소(위 왼쪽 기준 정수 자리)를 셈하고, 캔버스처럼 8비트로 끊는다. 캔버스 y는 아래에서 위로 센다
  cx = clamp(cx, 0.0, RESX - 1.0); cy = clamp(cy, 0.0, RESY - 1.0);
  return floor(shade(float2(cx + 0.5, RESY - cy - 0.5)) * 255.0 + 0.5) / 255.0;
}
float4 main(float2 uv : TEXCOORD) : COLOR {
  // 시안은 캔버스를 화면보다 촘촘하게 그리고 브라우저가 쌍선형으로 줄인다(2배면 네 화소 평균). 화면 화소마다 그 네 화소를 셈해 같은 무게로 섞는다
  float2 o = floor(uv * float2(OW, OH));
  float2 src = (o + 0.5) * float2(RESX / OW, RESY / OH) - 0.5;
  float2 b0 = floor(src), a = src - b0;
  float3 c00 = canvasTexel(b0.x, b0.y), c10 = canvasTexel(b0.x + 1.0, b0.y), c01 = canvasTexel(b0.x, b0.y + 1.0), c11 = canvasTexel(b0.x + 1.0, b0.y + 1.0);
  float3 avg = lerp(lerp(c00, c10, a.x), lerp(c01, c11, a.x), a.y);
  return float4(avg, 1.0) + tex2D(input, uv) * 0.0;
}
