// 공통 첫 화면의 단일 구체와 전환 중 도트 SYNK 글리프를 그리는 시각 렌더러다.
// WebGL을 지원하지 않거나 컨텍스트를 잃으면 기존 캔버스를 재사용하지 않고 새 캔버스나 정적 프레임으로 넘어간다.

export const PORTAL_DURATION_MS = 1080;

const TAU = Math.PI * 2;
const DOT_COLS = 41;
const DOT_ROWS = 9;
const DOT_TEX_W = 64;
const DOT_TEX_H = 16;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

export function getPortalOrbRadius(width, height) {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  return clamp(Math.min(w * 0.32, h * 0.255), 68, 224);
}

const DOT_DATA = (() => {
  const S = [
    '.######.',
    '##....##',
    '##......',
    '.####...',
    '..####..',
    '...####.',
    '......##',
    '##....##',
    '.######.',
  ];
  const Y = [
    '##....##',
    '##....##',
    '.##..##.',
    '..####..',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
  ];
  const N = [
    '##....##',
    '###...##',
    '####..##',
    '##.#..##',
    '##.##.##',
    '##..#.##',
    '##..####',
    '##...###',
    '##....##',
  ];
  const K = [
    '##....##',
    '##...##.',
    '##..##..',
    '##.##...',
    '####....',
    '##.##...',
    '##..##..',
    '##...##.',
    '##....##',
  ];
  const matrix = new Uint8Array(DOT_COLS * DOT_ROWS);
  const texData = new Uint8Array(DOT_TEX_W * DOT_TEX_H * 4);

  for (let row = 0; row < DOT_ROWS; row += 1) {
    const line = S[row] + '...' + Y[row] + '...' + N[row] + '...' + K[row];
    for (let col = 0; col < DOT_COLS; col += 1) {
      const on = line.charCodeAt(col) === 35 ? 1 : 0;
      matrix[row * DOT_COLS + col] = on;
      const offset = (row * DOT_TEX_W + col) * 4;
      const byteVal = on ? 255 : 0;
      texData[offset] = byteVal;
      texData[offset + 1] = byteVal;
      texData[offset + 2] = byteVal;
      texData[offset + 3] = 255;
    }
  }
  return Object.freeze({ matrix, texData });
})();

const ORB_VS = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const ORB_FS = `
precision highp float;
uniform vec2 uCenterPx;
uniform float uRadiusPx;
uniform float uBaseRadiusPx;
uniform vec2 uViewPx;
uniform float uTime;
uniform float uHover;
uniform float uPortal;
uniform float uInterior;
uniform vec2 uPointer;
uniform sampler2D uDotTex;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float causticField(vec3 q, float t) {
  q.xz = rot(t * 0.30) * q.xz;
  q.xy = rot(-0.34 + sin(t * 0.20) * 0.12) * q.xy;

  vec3 w = q;
  w.x += 0.35 * sin(q.y * 2.95 + t * 0.46) + 0.17 * cos(q.z * 3.80 - t * 0.32);
  w.y += 0.31 * cos(q.x * 2.70 - t * 0.40) + 0.15 * sin(q.z * 3.40 + t * 0.35);
  w.z += 0.26 * sin((q.x - q.y) * 2.45 + t * 0.30);

  float sheetA = abs(w.y * 0.92 + 0.28 * sin(w.x * 2.55 + w.z * 2.05));
  float sheetB = abs(w.x * 0.86 - w.z * 0.52 + 0.24 * cos(w.y * 3.10 - t * 0.26));

  float veilA = exp(-sheetA * 6.2);
  float spineA = exp(-sheetA * 17.5);
  float veilB = exp(-sheetB * 7.8) * 0.52;

  return veilA * 0.64 + spineA * 0.58 + veilB * 0.44;
}

float sampleDotCell(vec2 uvMark, float breakup, float scanTick, float colReveal, float softEdge) {
  if (uvMark.x < 0.0 || uvMark.x >= 1.0 || uvMark.y < 0.0 || uvMark.y >= 1.0) {
    return 0.0;
  }
  vec2 grid = vec2(uvMark.x * 41.0, uvMark.y * 9.0);
  vec2 cellIdx = floor(grid);
  vec2 f = fract(grid) - 0.5;

  if (cellIdx.x / 41.0 > colReveal) {
    return 0.0;
  }

  vec2 texUV = (cellIdx + 0.5) / vec2(64.0, 16.0);
  float bit = texture2D(uDotTex, texUV).r;
  if (bit < 0.5) {
    return 0.0;
  }

  if (breakup > 0.01) {
    float dropNoise = hash(cellIdx + vec2(scanTick * 1.7, scanTick * 0.9));
    if (dropNoise < breakup * 0.78) {
      return 0.0;
    }
  }

  float dist = length(f);
  return 1.0 - smoothstep(0.21, 0.35 + softEdge, dist);
}

void main() {
  float rPx = max(uRadiusPx, 2.0);
  vec2 deltaPx = gl_FragCoord.xy - uCenterPx;
  vec2 p = deltaPx / rPx;
  float d = length(p);
  float aa = 1.45 / rPx;

  if (d > 1.0 + aa) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float edgeMask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  float dc = min(d, 1.0);
  float z = sqrt(max(0.0, 1.0 - dc * dc));
  vec3 N = normalize(vec3(p, max(z, 0.001)));

  float shellVis = (1.0 - uInterior) * (1.0 - uInterior);
  float t = uTime * (0.34 + 0.22 * uPortal);
  vec2 steer = uPointer * (0.24 + 0.10 * uHover) * shellVis;
  vec3 eye = normalize(vec3(-steer.x, -steer.y, 1.0));

  vec3 rNear = refract(-eye, N, 0.660);
  vec3 rDeep = refract(-eye, N, 0.735);

  float optDepth = 0.78 + 0.26 * (1.0 - z) - 0.08 * uHover + 0.30 * uPortal;
  vec3 baseP = vec3(p * (1.04 - 0.18 * uInterior), (z - 0.42 - 0.26 * uPortal) * 0.96);

  float cPrimary = causticField(baseP + rNear * optDepth, t);
  float cSecond = causticField(baseP * 0.92 + rDeep * (optDepth * 1.18), t * 0.88 + 1.4);

  vec3 obsidian = vec3(0.005, 0.006, 0.008);
  vec3 graphite = vec3(0.036, 0.040, 0.048);
  float interiorDepth = (1.0 - smoothstep(0.10, 0.98, dc)) * (0.30 + 0.70 * (1.0 - z));
  vec3 col = mix(obsidian, graphite, interiorDepth * 0.52 * shellVis);

  float causticGain = (0.76 + 0.24 * uHover + 0.18 * sin(uPortal * 3.14159)) * shellVis;
  float folded = (cPrimary * cPrimary * 0.74 + cSecond * cSecond * 0.34) * causticGain;
  float coreAtten = 1.0 - smoothstep(0.08, 0.992, dc);

  col += vec3(0.11, 0.12, 0.14) * cPrimary * 0.30 * coreAtten * shellVis;
  col += vec3(0.92, 0.95, 0.99) * folded * (0.86 + 0.14 * uHover) * coreAtten;

  vec2 dir2 = normalize(p + vec2(0.0001, 0.0001));
  vec2 keyAxis = normalize(vec2(-0.56, 0.83) + steer * 0.32);
  vec2 counterAxis = normalize(vec2(0.62, -0.78) - steer * 0.22);

  float keyAlign = smoothstep(-0.28, 0.94, dot(dir2, keyAxis));
  float counterAlign = smoothstep(0.12, 0.96, dot(dir2, counterAxis));

  float meniscusBand = exp(-pow((dc - 0.895) * 26.0, 2.0));
  float innerArc = meniscusBand * pow(keyAlign, 1.65) * 0.46;
  float softCrown = exp(-pow((dc - 0.70) * 6.5, 2.0)) * pow(keyAlign, 3.2) * 0.11;

  float fresnel = pow(max(1.0 - z, 0.0001), 4.6);
  float grazingLip = smoothstep(0.978, 0.9992, dc);

  col += vec3(0.88, 0.91, 0.96) * fresnel * (0.18 + 0.74 * keyAlign + 0.22 * counterAlign) * (0.78 + 0.22 * uHover) * shellVis;
  col += vec3(0.95, 0.97, 1.00) * (innerArc + softCrown) * (0.90 + 0.16 * uHover) * shellVis;
  col += vec3(0.94, 0.96, 0.99) * grazingLip * (0.14 + 0.58 * keyAlign + 0.10 * counterAlign + 0.16 * uHover) * shellVis;

  if (uPortal > 0.015 && uPortal < 0.90) {
    float fadeIn = smoothstep(0.02, 0.15, uPortal);
    float fadeOut = 1.0 - smoothstep(0.56, 0.86, uPortal);
    float markAlpha = fadeIn * fadeOut;

    if (markAlpha > 0.002) {
      float markR = mix(max(uBaseRadiusPx, 40.0), rPx, 0.55);
      float spanX = markR * 1.12;
      float spanY = spanX * (9.0 / 41.0);

      vec2 relMark = (deltaPx - steer * markR * 0.08) / max(spanX * 0.62, 1.0);
      float r2 = min(dot(relMark, relMark), 2.2);
      float barrel = 0.90 + 0.14 * r2 + 0.10 * (1.0 - z);
      vec2 lensDelta = (deltaPx - steer * markR * 0.08) * barrel;

      float rawY = 0.5 - lensDelta.y / max(spanY, 1.0);
      float rowId = floor(rawY * 9.0);
      float scanTick = floor(uTime * 22.0 + uPortal * 18.0);

      float earlyJitter = (1.0 - smoothstep(0.03, 0.16, uPortal)) * 0.024;
      float breakup = smoothstep(0.46, 0.85, uPortal);
      float rowRand = hash(vec2(rowId * 3.1, scanTick));
      float sliceMask = step(0.58, rowRand);
      float shear = (rowRand - 0.5) * 2.0 * sliceMask * (earlyJitter + breakup * 0.11);

      float rawX = 0.5 + (lensDelta.x / max(spanX, 1.0)) + shear;
      float colReveal = smoothstep(0.01, 0.18, uPortal) * 1.06;

      float edgeSoft = clamp(r2 * 0.055, 0.0, 0.09);
      float dCore = sampleDotCell(vec2(rawX, rawY), breakup, scanTick, colReveal, edgeSoft);

      float scanPos = fract(uPortal * 2.05);
      float scanWave = exp(-abs(rawY - scanPos) * 12.0);
      vec2 glowCoord = vec2((rawX - 0.5) * 1.75, (rawY - 0.5) * 2.85);
      float radialEnvelope = exp(-dot(glowCoord, glowCoord) * 2.4);
      float softVeil = scanWave * radialEnvelope * (0.028 + 0.036 * (1.0 - breakup));

      float depthShade = (0.72 + 0.28 * z) * (1.0 - smoothstep(0.68, 0.96, dc));
      col *= 1.0 - radialEnvelope * markAlpha * 0.28;
      float dotEnergy = dCore * (0.92 + 0.28 * scanWave);
      col += vec3(0.95, 0.97, 1.00) * (dotEnergy * 1.06 + softVeil) * markAlpha * depthShade;
    }
  }

  if (uInterior > 0.001) {
    vec2 vNorm = (gl_FragCoord.xy - 0.5 * uViewPx) / max(min(uViewPx.x, uViewPx.y), 1.0);
    float zenithWhisper = exp(-dot(vNorm, vNorm) * 1.9);
    vec3 calmInterior = vec3(0.013, 0.014, 0.017) * zenithWhisper;
    col = mix(col, calmInterior, smoothstep(0.0, 1.0, uInterior));
  }

  col = col / (1.0 + col * 0.24);
  float ditherA = hash(gl_FragCoord.xy + fract(uTime));
  float ditherB = hash(gl_FragCoord.yx + vec2(17.3, 9.1) + fract(uTime));
  float grain = (ditherA - ditherB) * 0.0055;
  col = max(col + grain, 0.0) * edgeMask;

  gl_FragColor = vec4(col, 1.0);
}`;

function createWebGLBackend(canvas) {
  let gl = null;
  let vs = null;
  let fs = null;
  let prog = null;
  let dotTex = null;
  let buf = null;

  const cleanup = () => {
    if (!gl) return;
    try {
      if (dotTex) gl.deleteTexture(dotTex);
      if (buf) gl.deleteBuffer(buf);
      if (prog) gl.deleteProgram(prog);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    } catch {
      // 컨텍스트 손실 직후의 정리 오류는 무시한다.
    }
    gl = null;
    vs = null;
    fs = null;
    prog = null;
    dotTex = null;
    buf = null;
  };

  try {
    const attrs = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
    gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
    if (!gl) return null;

    vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, ORB_VS);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      cleanup();
      return null;
    }

    fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, ORB_FS);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      cleanup();
      return null;
    }

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      cleanup();
      return null;
    }

    dotTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dotTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, DOT_TEX_W, DOT_TEX_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, DOT_DATA.texData);

    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const locations = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      uCenterPx: gl.getUniformLocation(prog, 'uCenterPx'),
      uRadiusPx: gl.getUniformLocation(prog, 'uRadiusPx'),
      uBaseRadiusPx: gl.getUniformLocation(prog, 'uBaseRadiusPx'),
      uViewPx: gl.getUniformLocation(prog, 'uViewPx'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uHover: gl.getUniformLocation(prog, 'uHover'),
      uPortal: gl.getUniformLocation(prog, 'uPortal'),
      uInterior: gl.getUniformLocation(prog, 'uInterior'),
      uPointer: gl.getUniformLocation(prog, 'uPointer'),
      uDotTex: gl.getUniformLocation(prog, 'uDotTex'),
    };

    return {
      mode: 'webgl',
      canvas,
      draw(frame) {
        if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) return false;
        const { w, h, dpr, time, cx, cy, radius, baseRadius, hover, portal, interior, px, py } = frame;
        const pw = Math.max(2, Math.round(w * dpr));
        const ph = Math.max(2, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        gl.viewport(0, 0, pw, ph);
        gl.useProgram(prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dotTex);
        gl.uniform1i(locations.uDotTex, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locations.aPos);
        gl.vertexAttribPointer(locations.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(locations.uCenterPx, cx * dpr, (h - cy) * dpr);
        gl.uniform1f(locations.uRadiusPx, radius * dpr);
        gl.uniform1f(locations.uBaseRadiusPx, baseRadius * dpr);
        gl.uniform2f(locations.uViewPx, pw, ph);
        gl.uniform1f(locations.uTime, time);
        gl.uniform1f(locations.uHover, hover);
        gl.uniform1f(locations.uPortal, portal);
        gl.uniform1f(locations.uInterior, interior);
        gl.uniform2f(locations.uPointer, px, -py);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return true;
      },
      destroy: cleanup,
    };
  } catch {
    cleanup();
    return null;
  }
}

function createCanvas2DBackend(canvas) {
  let ctx = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  return {
    mode: '2d',
    canvas,
    draw(frame) {
      const { w, h, dpr, time, cx, cy, radius, baseRadius, cornerDist, hover, portal, interior, px, py, reduced } = frame;
      const pw = Math.max(2, Math.round(w * dpr));
      const ph = Math.max(2, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.clip();

      const core = ctx.createRadialGradient(
        cx - radius * 0.24 * (1 - interior * 0.6),
        cy - radius * 0.28 * (1 - interior * 0.6),
        radius * 0.04,
        cx,
        cy,
        radius
      );
      if (interior > 0.5) {
        core.addColorStop(0, '#040406');
        core.addColorStop(0.55, '#010102');
        core.addColorStop(1, '#000000');
      } else {
        core.addColorStop(0, '#14171d');
        core.addColorStop(0.45, '#040507');
        core.addColorStop(0.86, '#0b0d12');
        core.addColorStop(0.975, '#7c828e');
        core.addColorStop(1, '#f2f5fa');
      }
      ctx.fillStyle = core;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      const shellVis = (1 - interior) * (1 - interior);
      if (shellVis > 0.01) {
        const phase = reduced ? 0.45 : Math.sin(time * 0.4) * 0.12;
        ctx.globalCompositeOperation = 'screen';
        const fold = ctx.createRadialGradient(
          cx - radius * (0.18 - px * 0.22),
          cy - radius * (0.14 - py * 0.22),
          radius * 0.02,
          cx + radius * phase,
          cy + radius * 0.08,
          radius * 0.86
        );
        const causticAlpha = (0.56 + hover * 0.14) * shellVis;
        fold.addColorStop(0, `rgba(245,247,252,${causticAlpha.toFixed(3)})`);
        fold.addColorStop(0.28, `rgba(176,184,196,${(0.26 * shellVis).toFixed(3)})`);
        fold.addColorStop(0.64, `rgba(48,52,60,${(0.10 * shellVis).toFixed(3)})`);
        fold.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fold;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }

      if (portal > 0.015 && portal < 0.90) {
        const fadeIn = smoothstep(0.02, 0.15, portal);
        const fadeOut = 1 - smoothstep(0.56, 0.86, portal);
        const alpha = fadeIn * fadeOut;
        if (alpha > 0.01) {
          const markR = baseRadius + (radius - baseRadius) * 0.55;
          const spanX = markR * 1.12;
          const cell = spanX / DOT_COLS;
          const spanY = cell * DOT_ROWS;
          const startX = cx - spanX * 0.5;
          const startY = cy - spanY * 0.5;
          const breakup = smoothstep(0.46, 0.85, portal);
          const colReveal = smoothstep(0.01, 0.18, portal) * DOT_COLS * 1.06;
          const scanTick = Math.floor(time * 22 + portal * 18);
          const dotR = Math.max(1.1, cell * 0.30);

          ctx.globalCompositeOperation = 'lighter';
          for (let row = 0; row < DOT_ROWS; row += 1) {
            const rowNoise = hash2(row * 3.1, scanTick);
            const shearPx = rowNoise > 0.58 ? (rowNoise - 0.5) * 2 * spanX * breakup * 0.11 : 0;
            for (let colIdx = 0; colIdx < DOT_COLS; colIdx += 1) {
              if (colIdx > colReveal) continue;
              if (!DOT_DATA.matrix[row * DOT_COLS + colIdx]) continue;
              if (breakup > 0.01 && hash2(colIdx, row + scanTick) < breakup * 0.78) continue;
              const normX = (colIdx + 0.5) / DOT_COLS - 0.5;
              const normY = (row + 0.5) / DOT_ROWS - 0.5;
              const edgeCurve = 1 - 0.12 * (normX * normX * 2.2);
              const dx = cx + ((startX + (colIdx + 0.5) * cell + shearPx) - cx) * edgeCurve;
              const dy = cy + ((startY + (row + 0.5) * cell) - cy) * (1 - 0.06 * normX * normX);
              const depthShade = clamp(1 - (normX * normX * 0.45 + normY * normY * 0.25), 0.62, 1);
              ctx.fillStyle = `rgba(244,247,252,${(alpha * 0.92 * depthShade).toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(dx, dy, dotR, 0, TAU);
              ctx.fill();
            }
          }
        }
      }

      if (shellVis > 0.06) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(245,248,252,${((0.46 + hover * 0.16) * shellVis).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, radius * 0.011);
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.90, -Math.PI * 0.86, -Math.PI * 0.38);
        ctx.stroke();
      }

      ctx.restore();

      if (radius < cornerDist * 1.05 && shellVis > 0.08) {
        ctx.strokeStyle = `rgba(232,237,245,${((0.52 + hover * 0.20) * shellVis).toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, radius - 0.65), 0, TAU);
        ctx.stroke();
      }
      return true;
    },
    destroy() {
      ctx = null;
    },
  };
}

export function createPortalOrb(container, options = {}) {
  const doc = options.documentObj || container?.ownerDocument || globalThis.document;
  const win = options.windowObj || doc?.defaultView || globalThis.window || globalThis;
  const getReducedMotion = typeof options.getReducedMotion === 'function' ? options.getReducedMotion : () => false;
  const onRadiusChange = typeof options.onRadiusChange === 'function' ? options.onRadiusChange : null;

  let disposed = false;
  let active = true;
  let rafId = null;
  let startMs = null;
  let backend = null;
  let contextLostHandler = null;
  let lastRadius = 0;

  const scene = {
    portal: 0,
    interior: 0,
    hover: 0,
    pointerX: 0,
    pointerY: 0,
  };

  function makeCanvasElement() {
    const el = doc.createElement('canvas');
    el.className = 'portal-orb-canvas';
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function detachCurrentCanvas() {
    if (!backend) return;
    if (contextLostHandler && backend.canvas) {
      backend.canvas.removeEventListener('webglcontextlost', contextLostHandler);
      contextLostHandler = null;
    }
    const prevCanvas = backend.canvas;
    backend.destroy();
    backend = null;
    if (prevCanvas) {
      prevCanvas.width = 0;
      prevCanvas.height = 0;
      prevCanvas.remove?.();
    }
  }

  function switchToFallback2D() {
    if (disposed || !container || !doc) return;
    detachCurrentCanvas();
    // WebGL을 시도했던 캔버스에는 2D 컨텍스트를 요청하지 않고 새 캔버스를 만든다.
    const freshCanvas = makeCanvasElement();
    const fallback = createCanvas2DBackend(freshCanvas);
    if (fallback) {
      backend = fallback;
      container.dataset.orbMode = '2d';
      container.append(freshCanvas);
    } else {
      container.dataset.orbMode = 'static';
    }
  }

  function initBackend() {
    if (disposed || !container || !doc) return;
    const glCanvas = makeCanvasElement();
    const glBackend = createWebGLBackend(glCanvas);
    if (glBackend) {
      backend = glBackend;
      container.dataset.orbMode = 'webgl';
      contextLostHandler = event => {
        event?.preventDefault?.();
        if (disposed) return;
        switchToFallback2D();
        drawOnce(nowSeconds());
      };
      glCanvas.addEventListener('webglcontextlost', contextLostHandler);
      container.append(glCanvas);
      return;
    }
    // WebGL 초기화가 실패하면 해당 캔버스는 버리고 새 캔버스로 2D 폴백을 연다.
    switchToFallback2D();
  }

  function nowSeconds() {
    const now = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
    if (startMs === null) startMs = now;
    return (now - startMs) * 0.001;
  }

  function isHidden() {
    return doc?.hidden === true;
  }

  function shouldAnimateContinuously() {
    if (disposed || !active || isHidden()) return false;
    if (!backend) return false;
    if (getReducedMotion()) return false;
    // 구 내부로 완전히 들어간 뒤에는 상시 루프를 돌리지 않는다.
    if (scene.interior >= 0.999 && scene.portal <= 0.001) return false;
    return true;
  }

  function stopLoop() {
    if (rafId !== null) {
      if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(rafId);
      else clearTimeout(rafId);
      rafId = null;
    }
  }

  function measureContainer() {
    if (!container) return { w: 0, h: 0 };
    const rect = typeof container.getBoundingClientRect === 'function'
      ? container.getBoundingClientRect()
      : { width: win.innerWidth || 0, height: win.innerHeight || 0 };
    const w = rect.width || win.innerWidth || 0;
    const h = rect.height || win.innerHeight || 0;
    return { w, h };
  }

  function drawOnce(timeSec) {
    if (disposed || !active || isHidden()) return;
    const { w, h } = measureContainer();
    if (w < 2 || h < 2) return;

    const baseRadius = getPortalOrbRadius(w, h);
    if (Math.abs(baseRadius - lastRadius) > 0.25) {
      lastRadius = baseRadius;
      onRadiusChange?.(baseRadius);
    }

    if (!backend) return;

    const reduced = !!getReducedMotion();
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cornerDist = Math.hypot(cx, cy);
    const fullEnvelopeRadius = Math.max(cornerDist * 1.48, baseRadius * 5.2);

    const portal = reduced ? 0 : clamp(scene.portal, 0, 1);
    const settledInterior = clamp(scene.interior, 0, 1);
    const interior = clamp(Math.max(settledInterior, smoothstep(0.56, 0.98, portal)), 0, 1);
    const hover = clamp(scene.hover, 0, 1) * (1 - portal) * (1 - interior);
    const px = reduced ? 0 : clamp(scene.pointerX, -0.5, 0.5);
    const py = reduced ? 0 : clamp(scene.pointerY, -0.5, 0.5);

    let radius = baseRadius * (1 + hover * 0.022);
    if (portal > 0.0001) {
      const expandEase = 0.16 * portal + 0.84 * Math.pow(portal, 2.35);
      radius = baseRadius + (fullEnvelopeRadius - baseRadius) * expandEase;
    } else if (interior > 0.0001) {
      radius = baseRadius + (fullEnvelopeRadius - baseRadius) * interior;
    }

    const dpr = Math.min(Number(win.devicePixelRatio) || 1, 2);
    const rendered = backend.draw({
      w,
      h,
      dpr,
      time: reduced ? 2.65 : timeSec,
      cx,
      cy,
      radius,
      baseRadius,
      cornerDist,
      hover,
      portal,
      interior,
      px,
      py,
      reduced,
    });

    if (!rendered && backend?.mode === 'webgl') {
      switchToFallback2D();
      backend?.draw({
        w,
        h,
        dpr,
        time: reduced ? 2.65 : timeSec,
        cx,
        cy,
        radius,
        baseRadius,
        cornerDist,
        hover,
        portal,
        interior,
        px,
        py,
        reduced,
      });
    }
  }

  function scheduleLoop() {
    if (rafId !== null || !shouldAnimateContinuously()) return;
    const tick = () => {
      rafId = null;
      if (disposed || !active || isHidden()) return;
      drawOnce(nowSeconds());
      if (shouldAnimateContinuously()) scheduleLoop();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      rafId = win.requestAnimationFrame(tick);
    } else {
      rafId = setTimeout(tick, 16);
    }
  }

  function syncLoop() {
    if (disposed || !active || isHidden()) {
      stopLoop();
      return;
    }
    drawOnce(nowSeconds());
    if (shouldAnimateContinuously()) scheduleLoop();
    else stopLoop();
  }

  const onResize = () => {
    if (!disposed && active && !isHidden()) syncLoop();
  };

  const onVisibility = () => {
    if (disposed) return;
    if (isHidden()) stopLoop();
    else if (active) syncLoop();
  };

  initBackend();
  win.addEventListener?.('resize', onResize);
  doc?.addEventListener?.('visibilitychange', onVisibility);
  syncLoop();

  return {
    getMode: () => container?.dataset?.orbMode || 'none',
    setScene(patch = {}) {
      if (disposed) return;
      if (typeof patch.portal === 'number') scene.portal = clamp(patch.portal, 0, 1);
      if (typeof patch.interior === 'number') scene.interior = clamp(patch.interior, 0, 1);
      if (typeof patch.hover === 'number') scene.hover = clamp(patch.hover, 0, 1);
      if (typeof patch.pointerX === 'number') scene.pointerX = clamp(patch.pointerX, -0.5, 0.5);
      if (typeof patch.pointerY === 'number') scene.pointerY = clamp(patch.pointerY, -0.5, 0.5);
      if (typeof patch.active === 'boolean') active = patch.active;
      syncLoop();
    },
    pause() {
      stopLoop();
    },
    resume() {
      syncLoop();
    },
    refresh() {
      syncLoop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      stopLoop();
      win.removeEventListener?.('resize', onResize);
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      detachCurrentCanvas();
      if (container?.dataset) delete container.dataset.orbMode;
    },
  };
}
