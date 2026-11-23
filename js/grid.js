// Uma "tela de terminal" desenhada em <canvas>: uma grade de células
// monoespaçadas, cada uma com um caractere, uma cor e uma profundidade.

const FONT_STACK =
  "Menlo, 'SF Mono', Monaco, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', monospace";

export class Grid {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.layout = null; // função (w, h) => tamanho da fonte em px
    this.cols = 0;
    this.rows = 0;
  }

  // layout: (larguraCss, alturaCss) => fontSize
  setLayout(layout) {
    this.layout = layout;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    const fs = this.layout ? this.layout(w, h) : 14;
    this.font = `${fs}px ${FONT_STACK}`;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = this.font;
    // Células de terminal: altura ≈ 2× a largura (mesma proporção do script original).
    this.cw = ctx.measureText('0').width;
    this.ch = this.cw * 2;
    this.fs = fs;
    this.cols = Math.max(20, Math.floor(w / this.cw));
    this.rows = Math.max(12, Math.floor(h / this.ch));
    this.ox = (w - this.cols * this.cw) / 2;
    this.oy = (h - this.rows * this.ch) / 2;

    const n = this.cols * this.rows;
    this.chars = new Array(n).fill('');
    this.colors = new Array(n).fill('');
    this.alphas = new Float32Array(n);
    this.zbuf = new Float32Array(n);
    this.rects = [];
    this.clear();
  }

  clear() {
    this.chars.fill('');
    this.zbuf.fill(-1e9);
    this.rects.length = 0;
  }

  // Escreve respeitando o z-buffer (o mais próximo vence).
  plot(col, row, z, ch, color, alpha = 1) {
    col |= 0;
    row |= 0;
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    const i = row * this.cols + col;
    if (z <= this.zbuf[i]) return;
    this.zbuf[i] = z;
    this.chars[i] = ch;
    this.colors[i] = color;
    this.alphas[i] = alpha;
  }

  // Escreve por cima de tudo (inclusive do que já foi escrito com put).
  put(col, row, ch, color, alpha = 1) {
    col |= 0;
    row |= 0;
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    const i = row * this.cols + col;
    this.zbuf[i] = 1e9;
    this.chars[i] = ch;
    this.colors[i] = color;
    this.alphas[i] = alpha;
  }

  // Apaga uma célula (usado para "esconder" partes de um desenho).
  erase(col, row) {
    col |= 0;
    row |= 0;
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    const i = row * this.cols + col;
    this.chars[i] = '';
    this.zbuf[i] = 1e9;
  }

  // Retângulo de fundo (em células), desenhado antes do texto.
  rect(col, row, w, h, color, alpha = 1) {
    this.rects.push({ col, row, w, h, color, alpha });
  }

  // Lista as células preenchidas (para a transição entre as cenas).
  snapshot() {
    const out = [];
    for (let i = 0; i < this.chars.length; i++) {
      const ch = this.chars[i];
      if (ch && ch !== ' ') {
        out.push({
          col: i % this.cols,
          row: (i / this.cols) | 0,
          ch,
          color: this.colors[i],
          alpha: this.alphas[i],
        });
      }
    }
    return { cells: out, rects: this.rects.map((r) => ({ ...r })) };
  }

  render() {
    const { ctx, cw, ch, ox, oy } = this;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.w, this.h);

    for (const r of this.rects) {
      if (r.alpha <= 0) continue;
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle = r.color;
      ctx.fillRect(ox + r.col * cw, oy + r.row * ch, r.w * cw, r.h * ch);
    }

    // Agrupa por cor/opacidade para trocar o estilo o mínimo possível.
    const groups = new Map();
    const { chars, colors, alphas, cols } = this;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (!c || c === ' ') continue;
      const a = Math.round(alphas[i] * 20) / 20;
      if (a <= 0) continue;
      const key = colors[i] + '|' + a;
      let g = groups.get(key);
      if (!g) {
        g = [];
        groups.set(key, g);
      }
      g.push(i);
    }

    ctx.font = this.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const [key, idx] of groups) {
      const sep = key.lastIndexOf('|');
      ctx.fillStyle = key.slice(0, sep);
      ctx.globalAlpha = +key.slice(sep + 1);
      for (const i of idx) {
        const col = i % cols;
        const row = (i / cols) | 0;
        ctx.fillText(chars[i], ox + (col + 0.5) * cw, oy + (row + 0.5) * ch);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Hash inteiro rápido e determinístico (para escolher 0/1 de forma estável).
export function hash(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
