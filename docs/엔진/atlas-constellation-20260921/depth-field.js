/* Atlas depth field: decorative spatial context, never engines or measured data.
 * All topology is seeded and bounded. Rendering uses the caller's existing batch;
 * no DOM, listeners, timers, textures, GPU resources, or per-frame topology.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const SILVER = Object.freeze([181, 193, 205]);
  const NEAR_SILVER = Object.freeze([204, 213, 223]);
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const smooth = (low, high, value) => ease((value - low) / (high - low));

  function randomSource(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let bits = value;
      bits = Math.imul(bits ^ bits >>> 15, bits | 1);
      bits ^= bits + Math.imul(bits ^ bits >>> 7, bits | 61);
      return ((bits ^ bits >>> 14) >>> 0) / 4294967296;
    };
  }

  function node(x, y, z, layer, random) {
    return {
      x, y, z, layer, phase: random() * TAU, speed: .025 + random() * .026,
      size: .45 + random() * .42, light: .75 + random() * .25,
      p: { x: 0, y: 0, depth: 0, scale: 1, visibility: 0, valid: false }
    };
  }

  function crossesQuietCenter(a, b) {
    const ax = a.x / 1.06, ay = a.y / .80;
    const dx = (b.x - a.x) / 1.06, dy = (b.y - a.y) / .80;
    const distance = dx * dx + dy * dy;
    const t = distance ? clamp(-(ax * dx + ay * dy) / distance) : 0;
    return Math.hypot(ax + dx * t, ay + dy * t) < .72;
  }

  class AtlasDepthField {
    constructor(options = {}) {
      const random = randomSource(Number.isFinite(options.seed) ? options.seed : 0xA71A5D3F);
      this.backgroundNodes = [];
      this.backgroundEdges = [];
      this.foregroundNodes = [];
      this.foregroundEdges = [];

      // Three loose depth planes. The open center leaves the real engine map legible.
      for (let layer = 0; layer < 3; layer++) {
        const start = this.backgroundNodes.length;
        for (let i = 0; i < 50; i++) {
          let x = 0, y = 0;
          for (let attempt = 0; attempt < 30; attempt++) {
            x = (random() * 2 - 1) * 2.6;
            y = (random() * 2 - 1) * 2.16;
            const radius = Math.hypot(x / 1.12, y / .90);
            if (radius > 1 || (radius > .72 && random() < .12)) break;
          }
          const z = -1.58 - layer * .61 - random() * .14;
          this.backgroundNodes.push(node(x, y, z, layer, random));
        }

        // Short local relations make fragments that continue beyond the visible map.
        const candidates = [], degree = new Uint8Array(50);
        for (let i = 0; i < 50; i++) {
          const a = this.backgroundNodes[start + i];
          for (let j = i + 1; j < 50; j++) {
            const b = this.backgroundNodes[start + j];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (distance > .13 && distance < 1.14 && !crossesQuietCenter(a, b)) candidates.push({ i, j, distance });
          }
        }
        candidates.sort((a, b) => a.distance - b.distance);
        let count = 0;
        for (const candidate of candidates) {
          if (count >= 66) break;
          if (degree[candidate.i] >= 3 || degree[candidate.j] >= 3) continue;
          degree[candidate.i]++; degree[candidate.j]++; count++;
          this.backgroundEdges.push({
            a: this.backgroundNodes[start + candidate.i], b: this.backgroundNodes[start + candidate.j],
            layer, light: .65 + random() * .35, cross: false
          });
        }
      }

      // A handful of bridges makes the planes read as a volume, not separate sheets.
      for (let layer = 0; layer < 2; layer++) {
        for (let k = 0; k < 3; k++) {
          const a = this.backgroundNodes[layer * 50 + 7 + k * 15];
          let nearest = null, distance = Infinity;
          for (let i = (layer + 1) * 50; i < (layer + 2) * 50; i++) {
            const candidate = this.backgroundNodes[i];
            const d = Math.hypot(a.x - candidate.x, a.y - candidate.y);
            if (d < distance && !crossesQuietCenter(a, candidate)) { nearest = candidate; distance = d; }
          }
          if (nearest && distance < .9) this.backgroundEdges.push({ a, b: nearest, layer, light: .52, cross: true });
        }
      }

      // Incomplete large fragments graze the frame. They never encircle the nucleus.
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * TAU + .19 + (random() - .5) * .17;
        const x = Math.cos(angle) * (1.49 + random() * .17);
        const y = Math.sin(angle) * (.91 + random() * .14);
        const foreground = node(x, y, .76 + random() * .47, 3, random);
        foreground.size = 1.4 + random() * 1.8;
        this.foregroundNodes.push(foreground);
      }
      for (const [a, b] of [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9]]) {
        this.foregroundEdges.push({
          a: this.foregroundNodes[a], b: this.foregroundNodes[b], bend: (random() - .5) * .065,
          curve: { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }
        });
      }

      this.counts = Object.freeze({
        backgroundNodes: this.backgroundNodes.length, backgroundEdges: this.backgroundEdges.length,
        foregroundNodes: this.foregroundNodes.length, foregroundEdges: this.foregroundEdges.length
      });
    }

    projectNodes(nodes, state, foreground) {
      const time = Number.isFinite(state.time) ? state.time : 0;
      const width = state.width, height = state.height;
      const intro = Number.isFinite(state.intro) ? clamp(state.intro) : 1;
      for (const item of nodes) {
        const p = item.p;
        if (!foreground && state.mobile && item.layer === 1) { p.valid = false; continue; }
        const phase = item.phase + time * item.speed;
        const drift = foreground ? .012 : .021;
        // Pass the reusable output as an optional fourth argument. A normal three-
        // argument projector also works; its result is copied into this stable slot.
        const projected = state.project(
          item.x + Math.sin(phase) * drift,
          item.y + Math.cos(phase * .83 + item.phase) * drift,
          item.z + Math.sin(phase * .59) * .014, p
        );
        if (projected && projected !== p) {
          p.x = projected.x; p.y = projected.y;
          p.depth = projected.depth; p.scale = projected.scale;
        }
        p.valid = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.scale) && p.scale > 0 && p.scale < 5;
        if (!p.valid) continue;
        const radius = Math.hypot((p.x - width * .5) / (width * .5), (p.y - height * .493) / (height * .5));
        const opening = foreground ? smooth(.36, .94, intro) : smooth(.11 + item.layer * .055, .72 + item.layer * .055, intro);
        p.visibility = opening * (foreground ? smooth(.76, 1.13, radius) : .06 + .94 * smooth(.31, .88, radius));
      }
    }

    edgeVisible(a, b, state, margin) {
      return a.valid && b.valid &&
        !(a.x < -margin && b.x < -margin) && !(a.x > state.width + margin && b.x > state.width + margin) &&
        !(a.y < -margin && b.y < -margin) && !(a.y > state.height + margin && b.y > state.height + margin);
    }

    drawBack(gpu, state) {
      if (!gpu || !state || typeof state.project !== 'function' || !(state.width > 0 && state.height > 0)) return;
      this.projectNodes(this.backgroundNodes, state, false);
      for (const edge of this.backgroundEdges) {
        const a = edge.a.p, b = edge.b.p;
        if (!this.edgeVisible(a, b, state, 36)) continue;
        const density = .078 - edge.layer * .016;
        const alpha = density * edge.light * Math.sqrt(a.visibility * b.visibility) * (state.mobile ? .80 : 1);
        if (alpha < .004) continue;
        gpu.line(a.x, a.y, b.x, b.y, SILVER, alpha, edge.cross ? .43 : .53 - edge.layer * .06);
      }
      for (const item of this.backgroundNodes) {
        const p = item.p;
        if (!p.valid || p.x < -8 || p.x > state.width + 8 || p.y < -8 || p.y > state.height + 8) continue;
        const alpha = (.20 - item.layer * .040) * item.light * p.visibility;
        if (alpha < .004) continue;
        const radius = item.size * clamp(p.scale, .46, 1.2);
        gpu.dot(p.x, p.y, radius, SILVER, alpha * (state.mobile ? .78 : 1));
      }
    }

    drawFront(gpu, state) {
      if (!gpu || !state || typeof state.project !== 'function' || !(state.width > 0 && state.height > 0)) return;
      this.projectNodes(this.foregroundNodes, state, true);
      const density = state.mobile ? .36 : 1;
      for (const edge of this.foregroundEdges) {
        const a = edge.a.p, b = edge.b.p;
        if (!this.edgeVisible(a, b, state, 80)) continue;
        const alpha = .043 * Math.sqrt(a.visibility * b.visibility) * density;
        if (alpha < .004) continue;
        const curve = edge.curve, dx = b.x - a.x, dy = b.y - a.y;
        curve.a.x = a.x; curve.a.y = a.y; curve.b.x = b.x; curve.b.y = b.y;
        curve.c.x = (a.x + b.x) * .5 - dy * edge.bend;
        curve.c.y = (a.y + b.y) * .5 + dx * edge.bend;
        // Two quiet widths suggest a soft nearby strand without a blur pass.
        gpu.curve(curve, NEAR_SILVER, alpha * .20, state.mobile ? 2 : 3.1);
        gpu.curve(curve, NEAR_SILVER, alpha, state.mobile ? .64 : .88);
      }
      for (const item of this.foregroundNodes) {
        const p = item.p;
        if (!p.valid || p.x < -28 || p.x > state.width + 28 || p.y < -28 || p.y > state.height + 28) continue;
        const alpha = .12 * item.light * p.visibility * density;
        if (alpha < .004) continue;
        const radius = item.size * clamp(p.scale, .8, 1.65) * (state.mobile ? .72 : 1);
        gpu.glow(p.x, p.y, radius * 10, NEAR_SILVER, alpha * .38);
        gpu.dot(p.x, p.y, radius, NEAR_SILVER, alpha * .34);
        gpu.ring(p.x, p.y, radius * 1.08, NEAR_SILVER, alpha * .40, .42);
      }
    }
  }

  root.AtlasDepthField = AtlasDepthField;
})(typeof window !== 'undefined' ? window : globalThis);
