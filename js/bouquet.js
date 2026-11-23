// Parte 2 — buquê de rosas brancas desenhado com 0 e 1.
//
// Adaptado de "Ascii Flower Bouquet" (bouquet3d.py), de Alish Sharma,
// licença MIT — https://github.com/alishsharma17/Ascii-Flower-Bouquet-
// Veja THIRD_PARTY_NOTICES.md.
//
// O que foi mantido do original: a mesma cena 3D (10 flores distribuídas
// pelo ângulo de ouro, hastes, 8 folhas, cone de papel, laço com fita,
// mosquitinhos, brilhos, corações e a mensagem), a câmera, a luz, o
// z-buffer e o giro.
// O que mudou: cada flor virou uma rosa branca (pétalas em camadas), todos
// os caracteres do buquê são 0 e 1, os verdes e o papel ficaram mais
// discretos (para as rosas brancas se destacarem) e o
// desenho é construído progressivamente, peça por peça, como código sendo
// escrito na tela.

import { CONFIG } from './config.js';
import { clamp, easeOut, hash } from './grid.js';

// ------------------------------------------------------------- paletas
// (escuro → claro)
const ROSE_WHITE = [
  '#3a3936', '#4d4b47', '#62605b', '#7a7771', '#94918a',
  '#b0ada6', '#cbc8c1', '#e2dfd8', '#f3f1eb', '#ffffff',
];
const GREENS = ['#1e3a23', '#284b2e', '#335d39', '#3f7045', '#4c8352', '#5e9662', '#78ab79', '#97c196'];
// papel: mesmos tons creme do original, um pouco mais baixos para que as
// rosas brancas se destaquem dele
const PAPER = ['#4a4936', '#626048', '#7b795a', '#94916c', '#aca87e', '#c2bd91', '#d4cfa3'];
const RIBBON = ['#870000', '#af005f', '#d7005f', '#ff005f', '#ff5f87', '#ff87af'];
const HEART_COLORS = ['#d7005f', '#ff005f', '#ff5f87', '#ff5faf', '#ff87af', '#ffafd7'];
const MSG_COLORS = [
  '#d7005f', '#d75f87', '#ff5faf', '#ff87af', '#ffafd7',
  '#ffd7ff', '#ffafd7', '#ff87af', '#ff5faf', '#d75f87',
];
const CODE_FLASH = '#e9fbe9'; // cor do "dígito recém-escrito"

const PIVOT_Y = 0.2;
const L = (() => {
  const v = [-0.45, 0.6, 0.66];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const [LX, LY, LZ] = L;

// ----------------------------------------------- cronograma da construção
const B = {
  handle: 0.15, // hastes que saem por baixo do papel
  paper: 0.75, // cone de papel, de baixo para cima
  ribbon: 2.2,
  stems: 2.35, // hastes de cada flor, do laço até a flor
  leaves: 3.0,
  roses: 3.35, // rosas desabrocham uma a uma
  roseStep: 0.2,
  bloom: 1.25,
  babies: 5.4,
  sparkles: 5.8,
  hearts: 6.1,
  message: 6.6,
  msgChar: 0.12,
};
const FLASH = 0.28; // quanto tempo um dígito novo "pisca" antes de assentar

// ------------------------------------------------------------ utilidades
function rng(seed) {
  // mesmo papel do random.Random(21) do Python: sequência determinística
  let a = seed >>> 0;
  return {
    random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    uniform(lo, hi) {
      return lo + (hi - lo) * this.random();
    },
  };
}
const norm = (v) => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];

const VARIANTS = ['colorido', 'rosas', 'rosas-margaridas', 'rosas-tulipas', 'rosas-mosquitinho'];

// Cores das flores do buquê colorido: tons suaves que combinam com as rosas
// brancas (rosa, lilás, amarelo, pêssego), todos em 0 e 1.
const PINK = ['#5c1f3a', '#86294f', '#b33468', '#dc4c84', '#f2729f', '#fb9dbd', '#ffc8da'];
const LILAC = ['#35265a', '#4f3a84', '#6b52ad', '#8a6fd0', '#a991e6', '#c6b4f3', '#e2d8fb'];
const BUTTER = ['#5a460c', '#836812', '#ad8c1a', '#d6b126', '#f0cc3e', '#fadf6e', '#fff0a6'];
const PEACH = ['#5e2a14', '#88401e', '#b35a2b', '#dc7a40', '#f49a63', '#fcba8e', '#ffd8bd'];
const BROWN = ['#24170b', '#3a2512', '#50351b', '#684625', '#80582f'];
function variant() {
  const q = new URLSearchParams(location.search).get('buque');
  return VARIANTS.includes(q) ? q : VARIANTS.includes(CONFIG.bouquet) ? CONFIG.bouquet : 'rosas';
}

// Qual flor vai em cada uma das 10 posições (as mesmas do original, que
// tinha tulipas nas posições 3 e 8).
// Devolve { kind, pal (pétalas), cpal (miolo) }.
function flowerKind(v, idx) {
  const rose = { kind: 'rose', pal: ROSE_WHITE };
  if (v === 'colorido') {
    // 5 rosas brancas + 2 tulipas rosa-chá + 1 tulipa pêssego +
    // 1 margarida lilás + 1 margarida amarela, espalhadas pelo buquê
    const mix = {
      2: { kind: 'daisy', pal: LILAC, cpal: GOLD },
      3: { kind: 'tulip', pal: PINK },
      6: { kind: 'daisy', pal: BUTTER, cpal: BROWN },
      8: { kind: 'tulip', pal: PINK },
      9: { kind: 'tulip', pal: PEACH },
    };
    return mix[idx] || rose;
  }
  if (v === 'rosas-margaridas' && [2, 5, 8].includes(idx)) return { kind: 'daisy', pal: ROSE_WHITE, cpal: GOLD };
  if (v === 'rosas-tulipas' && [3, 6, 8].includes(idx)) return { kind: 'tulip', pal: ROSE_WHITE };
  return rose;
}

// ------------------------------------------------------- monta a cena 3D
function buildScene() {
  const v = variant();
  const rnd = rng(21);
  const pts = [];
  const P = (x, y, z, nx, ny, nz, pal, tone, two, born, ov = null) =>
    pts.push({ x, y, z, nx, ny, nz, pal, tone, two, born, ov, ph: rnd.random() * 10 });
  const neck = [0.0, -0.12, 0.0];

  // posições das 10 flores (ângulo de ouro), igual ao original
  const C = [0.0, 0.12, 0.0];
  const D = 0.64;
  const N = 10;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const heads = [];
  for (let i = 0; i < N; i++) {
    const el = ((88 - 60 * Math.sqrt(i / (N - 1))) * Math.PI) / 180;
    const az = i * golden;
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const pos = add(C, d, D * rnd.uniform(0.92, 1.05));
    heads.push([pos, norm(d)]);
  }

  const flowers = [];
  heads.forEach(([pos, axis], idx) => {
    const base = add(pos, axis, -0.03);
    for (let j = 0; j < 110; j++) {
      const t = j / 109; // 0 = base da flor, 1 = laço
      const p = [
        base[0] + (neck[0] - base[0]) * t,
        base[1] + (neck[1] - base[1]) * t,
        base[2] + (neck[2] - base[2]) * t,
      ];
      P(p[0], p[1], p[2], axis[0], 0.0, axis[2], GREENS, -0.15, true, B.stems + (1 - t) * 0.85 + idx * 0.05);
    }
    // no original: 8 margaridas + 2 tulipas. Aqui: 10 rosas brancas, nas
    // mesmas posições e com tamanhos parecidos (10% maiores, para as
    // pétalas ficarem legíveis). Desabrocham do centro para fora.
    const look = flowerKind(v, idx);
    const kind = look.kind;
    const r0 = rnd.uniform(0.12, 0.14);
    const R = kind === 'rose' ? r0 * 1.1 : kind === 'daisy' ? r0 * 1.05 : 0.12;
    const seed = rnd.uniform(0, 6.28);
    flowers.push({
      kind,
      pal: look.pal,
      cpal: look.cpal || GOLD,
      pos,
      R,
      seed,
      idx,
      born: B.roses + idx * B.roseStep,
    });
  });

  // 8 folhas
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.4) / 8) * 2 * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const base = [0.26 * c, 0.3, 0.26 * s];
    const d = norm([c, 0.15, s]);
    const side = [-s, 0.0, c];
    const n = norm(cross(side, d));
    const Ln = 0.3;
    const W = 0.07;
    for (let ti = 0; ti < 50; ti++) {
      const t = ti / 49;
      for (let wi = -8; wi <= 8; wi++) {
        const w = wi / 8;
        const curl = 0.025 * w * w;
        const p = [
          base[0] + d[0] * Ln * t + side[0] * W * Math.sin(Math.PI * t) * w + n[0] * curl,
          base[1] + d[1] * Ln * t - 0.1 * t * t + n[1] * curl,
          base[2] + d[2] * Ln * t + side[2] * W * Math.sin(Math.PI * t) * w + n[2] * curl,
        ];
        const rib = wi === 0 ? -0.25 : 0.0;
        P(p[0], p[1], p[2], n[0], n[1], n[2], GREENS, rib, true, B.leaves + i * 0.07 + t * 0.45);
      }
    }
  }

  // cone de papel
  const y0 = -0.2;
  const y1 = 0.3;
  const r0 = 0.06;
  const r1 = 0.36;
  const k = (r1 - r0) / (y1 - y0);
  const rings = 80;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const r = r0 + (r1 - r0) * t;
    const count = Math.max(12, Math.floor(270 * r));
    for (let j = 0; j < count; j++) {
      const ph = ((j + rnd.random()) / count) * 2 * Math.PI;
      const c = Math.cos(ph);
      const s = Math.sin(ph);
      let y = y0 + (y1 - y0) * t;
      if (t > 0.9) y += 0.03 * Math.sin(9 * ph);
      const fold = 0.3 * (Math.abs(Math.sin(5 * ph)) - 0.6);
      const nn = norm([c, -k, s]);
      P(r * c, y, r * s, nn[0], nn[1], nn[2], PAPER, fold, false, B.paper + t * 1.45 + rnd.random() * 0.12);
    }
  }

  // hastes que aparecem abaixo do papel
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 2 * Math.PI;
    const sx = 0.025 * Math.cos(a);
    const sz = 0.025 * Math.sin(a);
    for (let j = 0; j < 64; j++) {
      const t = j / 63;
      P(sx * (1 + 1.2 * t), -0.2 - 0.3 * t, sz * (1 + 1.2 * t), Math.cos(a), 0.0, Math.sin(a),
        GREENS, -0.1, true, B.handle + (1 - t) * 0.6);
    }
  }

  // fita e laço
  const by = -0.12;
  const br = r0 + k * (by - y0) + 0.01;
  for (let j = 0; j < 150; j++) {
    const ph = (j / 150) * 2 * Math.PI;
    for (const dy of [-0.016, -0.008, 0.0, 0.008, 0.016]) {
      P(br * Math.cos(ph), by + dy, br * Math.sin(ph), Math.cos(ph), 0.0, Math.sin(ph),
        RIBBON, 0.0, false, B.ribbon + (j / 150) * 0.35);
    }
  }
  const knot = [0.0, by, br + 0.01];
  for (const side of [-1, 1]) {
    for (let j = 0; j < 110; j++) {
      const a = (j / 110) * 2 * Math.PI;
      const lx = side * (0.07 + 0.07 * Math.cos(a));
      const ly = 0.04 * Math.sin(a) + (0.02 * (0.07 + 0.07 * Math.cos(a))) / 0.14;
      for (const fill of [1.0, 0.8, 0.6]) {
        P(knot[0] + lx * fill, knot[1] + ly * fill, knot[2] + 0.01, side * 0.3, 0.2, 0.93,
          RIBBON, 0.1, true, B.ribbon + 0.35 + (j / 110) * 0.3);
      }
    }
    for (let j = 0; j < 48; j++) {
      const t = j / 47;
      P(knot[0] + side * 0.06 * t, knot[1] - 0.15 * t, knot[2] + 0.015, side * 0.2, 0.0, 0.98,
        RIBBON, -0.05 + 0.05 * Math.sin(t * 9), true, B.ribbon + 0.6 + t * 0.2);
    }
  }
  for (const dx of [-0.01, 0.0, 0.01]) P(dx, by, knot[2] + 0.02, 0, 0, 1, RIBBON, 0.2, true, B.ribbon + 0.8);

  // mosquitinhos (baby's breath)
  const babies = [];
  const nBabies = v === 'rosas-mosquitinho' ? 320 : 90;
  for (let i = 0; i < nBabies; i++) {
    const a = rnd.random() * 2 * Math.PI;
    const el = rnd.uniform(0.3, 1.4);
    const rr = v === 'rosas-mosquitinho' ? rnd.uniform(0.38, 0.72) : rnd.uniform(0.4, 0.58);
    babies.push({
      x: rr * Math.cos(a) * Math.cos(el),
      y: C[1] + rr * Math.sin(el),
      z: rr * Math.sin(a) * Math.cos(el),
      phase: rnd.uniform(0, 6.28),
      born: B.babies + rnd.random() * 1.0,
    });
  }

  // brilhos ao redor
  const sparkles = [];
  for (let i = 0; i < 30; i++) {
    const a = rnd.random() * 2 * Math.PI;
    const rr = rnd.uniform(0.75, 0.95);
    sparkles.push({
      x: rr * Math.cos(a),
      y: rnd.uniform(-0.3, 1.0),
      z: rr * Math.sin(a),
      phase: rnd.uniform(0, 6.28),
      speed: rnd.uniform(1.5, 4.0),
      born: B.sparkles + rnd.random() * 1.0,
    });
  }

  return { pts, flowers, babies, sparkles };
}

// Escolhe 0 ou 1: áreas escuras tendem a "1" (traço fino), claras a "0"
// (traço cheio) — dá volume — e o meio-termo varia como um fluxo de bits.
function bit(b, seed, t) {
  if (b < 0.3) return '1';
  if (b > 0.72) return '0';
  return hash(seed, Math.floor(t * 0.9 + (seed % 7) * 0.13)) & 1 ? '1' : '0';
}

// Molde da rosa branca, vista de cima: pétalas em camadas ao redor do miolo
// e as pétalas externas formando a taça. Cada símbolo é só um nível de
// brilho (do escuro ":" ao claro "%"); "." e espaços internos são os vãos
// entre as pétalas. Na tela, tudo vira 0 e 1.
const ROSE_ART = [
  '             .-=+****+=-.',
  '         .=*#%%%%%%%%%%%#*=.',
  '      .=#%%%#*+==----==+*#%%#=.',
  '     +%%%*=:.  .:-====-:. .:=#%%+',
  '   .*%%*-. .-+#%%%%%%%%#+-. .-*%%*.',
  '   #%%+. .=#%%#*+=--=+*#%%#=. .+%%#',
  '  -%%#. :*%%*=: .-==-. :=*%%*: .#%%-',
  '  =%%+ .#%%=. -*%%%%%%*- .=%%#. +%%=',
  '  -%%#. *%%= .#%%*==*%%#. =%%* .#%%-',
  '   #%%= :#%#- :*%%%%%%*: -#%#: =%%#',
  '   .*%%+..=#%#+-:----:-+#%#=..+%%*.',
  ' .=: :*%%*-..-=+*##*+=-..-*%%*: :=.',
  ' =%%*-. :=*#%%%%%%%%%%#*=: .-*%%=',
  '  -#%%%*=:...:-======-:...:=*%%%#-',
  '    .=*%%%%#*++======++*#%%%%*=.',
  '        .:-=+**########**+=-:.',
];
const ROSE_TONE = { ':': 0.12, '-': 0.25, '=': 0.38, '+': 0.52, '*': 0.66, '#': 0.82, '%': 0.97 };
const ROSE_W = Math.max(...ROSE_ART.map((r) => r.length));
const ROSE_H = ROSE_ART.length;
// pré-calcula: null = fora da flor, -1 = vão, número = brilho
const ROSE_MAP = ROSE_ART.map((line) => {
  const first = line.search(/\S/);
  const last = line.length - 1 - [...line].reverse().join('').search(/\S/);
  return Array.from({ length: ROSE_W }, (_, i) => {
    if (i < first || i > last) return null;
    const ch = line[i];
    return ch in ROSE_TONE ? ROSE_TONE[ch] : -1;
  });
});

// Amostra o molde em (dx, dy) ∈ [-1, 1]; devolve brilho, vão ou null (fora).
function roseShade(dx, dy, rot, mirror) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  let u = dx * c - dy * s;
  const v = dx * s + dy * c;
  if (mirror) u = -u;
  const col = Math.floor(((u + 1) / 2) * ROSE_W);
  const row = Math.floor(((v + 1) / 2) * ROSE_H);
  if (row < 0 || row >= ROSE_H || col < 0 || col >= ROSE_W) return null;
  const tone = ROSE_MAP[row][col];
  if (tone === null) return null;
  if (tone < 0) return { b: 0, gap: true };
  return { b: tone - 0.08 * dx - 0.1 * dy, gap: false };
}

// Margarida branca: a mesma flor de disco do original (pétalas em raio com
// vãos entre elas), em branco com miolo dourado suave.
function daisyShade(dx, dy, rot) {
  const s = Math.hypot(dx, dy);
  if (s > 1) return null;
  if (s < 0.3) return { b: 0.55 - 0.35 * dx - 0.35 * dy, center: true };
  const ph = Math.atan2(dy, dx);
  const reach = 0.32 + 0.68 * Math.pow(Math.abs(Math.cos((13 * (ph + rot)) / 2)), 0.7);
  if (s > reach) return s < 0.97 ? { b: 0, gap: true } : null;
  const edge = s > reach - 0.14 ? -0.22 : 0;
  return { b: 0.66 - 0.22 * dx - 0.28 * dy + 0.12 * s + edge };
}

// Tulipa branca: a mesma silhueta de taça do original, com os vincos das
// pétalas mais escuros.
function tulipShade(dx, dy) {
  const v = (1 - dy) / 2;
  if (v < 0 || v > 1) return null;
  const hw = 0.62 * Math.sin(Math.PI * 0.5 * Math.min(1, v * 1.5 + 0.05));
  if (hw <= 0 || Math.abs(dx) > hw) return null;
  const xn = dx / hw;
  if (v > 0.72 + 0.28 * Math.cos(1.5 * Math.PI * xn) ** 2) return null;
  const seam = Math.abs(Math.abs(xn) - 0.33) < 0.12 && v > 0.3;
  if (seam) return { b: 0.22 };
  return { b: 0.72 - 0.3 * xn + 0.12 * v };
}

const GOLD = ['#4a3c16', '#6b5620', '#8c712b', '#ad8d3a', '#c9a74e', '#dcc06a'];

export class BouquetScene {
  constructor() {
    this.scene = buildScene();
    this.hearts = [];
    this.heartRnd = rng(5);
  }

  static layout(w, h) {
    // grade fina (como o terminal "dando zoom out" do vídeo): mais células
    // por rosa = pétalas legíveis
    const byH = h / (100 * 1.2);
    const byW = w / (140 * 0.6);
    return clamp(Math.min(byH, byW), 3.5, 13);
  }

  updateHearts(dt, t) {
    if (t < B.hearts) return;
    const r = this.heartRnd;
    while (this.hearts.length < CONFIG.numHearts) {
      this.hearts.push({
        x: r.random(),
        y: 1.0 + r.random(),
        v: r.uniform(0.03, 0.08),
        phase: r.uniform(0, 6.28),
        color: HEART_COLORS[(r.random() * HEART_COLORS.length) | 0],
        born: t + r.random() * 1.5,
      });
    }
    for (const h of this.hearts) {
      h.y -= h.v * dt;
      if (h.y < 0) {
        h.x = r.random();
        h.y = 1.0;
        h.color = HEART_COLORS[(r.random() * HEART_COLORS.length) | 0];
      }
    }
  }

  draw(grid, t, dt) {
    const { pts, flowers, babies, sparkles } = this.scene;
    const cols = grid.cols;
    const rows = grid.rows;
    const viewRows = rows - 3;
    const scale = Math.max(1, Math.min((viewRows - 2) / 1.5, (cols - 2) / 2.95));
    const sxs = scale * 2.0; // células têm o dobro de altura
    const cx = cols / 2;
    const cy = viewRows / 2 + 0.06 * scale + 1;

    const ang = t * CONFIG.spinSpeed;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const ct = Math.cos(CONFIG.tilt);
    const st = Math.sin(CONFIG.tilt);
    const cam = CONFIG.camDist;

    const proj = (x, y, z) => {
      const xr = x * ca - z * sa;
      const zr = x * sa + z * ca;
      const yp = y - PIVOT_Y;
      const yt = yp * ct - zr * st;
      const zt = yp * st + zr * ct;
      const f = cam / (cam - zt);
      return [cx + xr * f * sxs, cy - yt * f * scale, zt, f];
    };

    // corações ao fundo
    this.updateHearts(dt, t);
    for (const h of this.hearts) {
      if (t < h.born) continue;
      const col = Math.floor((h.x + 0.015 * Math.sin(t * 1.2 + h.phase)) * cols) % cols;
      const fade = clamp((t - h.born) / 1.2, 0, 1);
      grid.plot(col, Math.floor(h.y * viewRows), -50, '♥', h.color, fade);
    }

    // pontos 3D: hastes, folhas, papel, fita
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (t < p.born) continue;
      const [fx, fy, zt] = proj(p.x, p.y, p.z);
      const nxr = p.nx * ca - p.nz * sa;
      const nzr = p.nx * sa + p.nz * ca;
      const nyt = p.ny * ct - nzr * st;
      const nzt = p.ny * st + nzr * ct;
      let dot = nxr * LX + nyt * LY + nzt * LZ;
      if (p.two && dot < 0) dot = -dot * 0.55;
      let b = 0.25 + 0.75 * Math.max(0, dot) + p.tone;
      b = Math.min(0.999, Math.max(0, b));
      const age = t - p.born;
      if (age < FLASH) {
        grid.plot(fx, fy, zt, hash(i, Math.floor(t * 30)) & 1 ? '1' : '0', CODE_FLASH, 0.55 + age);
      } else {
        grid.plot(fx, fy, zt, bit(b, i * 7 + 3, t + p.ph), p.pal[Math.floor(b * p.pal.length)]);
      }
    }

    // flores (sempre de frente para a câmera, como no original)
    for (const fl of flowers) {
      if (t < fl.born) continue;
      const open = easeOut((t - fl.born) / B.bloom);
      const [fx, fy, zt, f] = proj(fl.pos[0], fl.pos[1], fl.pos[2]);
      const Rr = fl.R * (0.2 + 0.8 * open);
      const rx = Rr * f * sxs;
      const ry = Rr * f * scale;
      const dim = -0.4 * (1 - Math.min(1, Math.max(0, (zt + 0.6) / 1.2)));
      const rot = (1 - open) * 1.6; // gira enquanto desabrocha
      const ox = Math.round(fx);
      const oy = Math.round(fy);
      for (let row = Math.floor(fy - ry) - 1; row <= Math.floor(fy + ry) + 1; row++) {
        const dy = (row + 0.5 - fy) / ry;
        for (let col = Math.floor(fx - rx) - 1; col <= Math.floor(fx + rx) + 1; col++) {
          const dx = (col + 0.5 - fx) / rx;
          const r =
            fl.kind === 'daisy'
              ? daisyShade(dx, dy, fl.seed + ang * 0.7 + rot)
              : fl.kind === 'tulip'
                ? tulipShade(dx, dy)
                : roseShade(dx, dy, rot, fl.idx % 2 === 1);
          if (!r) continue;
          const s = Math.hypot(dx, dy);
          if (r.gap) {
            // vão: célula vazia, mas que ainda esconde o que está atrás
            grid.plot(col, row, zt + 0.04 * (1 - s), ' ', '#000');
            continue;
          }
          let b = r.b + dim * 0.6;
          b = Math.min(0.999, Math.max(0, b));
          const seed = hash(fl.idx, col - ox, row - oy);
          let ch;
          let color;
          // dígitos recém-escritos piscam na borda que está se abrindo
          if (open < 1 && s > 0.75 * (0.2 + 0.8 * open) && hash(seed, Math.floor(t * 20)) % 3 === 0) {
            ch = hash(seed, Math.floor(t * 30)) & 1 ? '1' : '0';
            color = CODE_FLASH;
          } else {
            ch = r.b > 0.8 ? '0' : r.b < 0.35 ? '1' : bit(b, seed, t + fl.seed);
            const pal = r.center ? fl.cpal : fl.pal;
            color = pal[Math.floor(b * pal.length)];
          }
          grid.plot(col, row, zt + 0.04 * (1 - s), ch, color);
        }
      }
    }

    // mosquitinhos
    for (const bb of babies) {
      if (t < bb.born) continue;
      const [fx, fy, zt] = proj(bb.x, bb.y, bb.z);
      const star = Math.sin(t * 2 + bb.phase) > 0.6;
      grid.plot(fx, fy, zt + 0.02, star ? '*' : '·', star ? '#ffffff' : '#eeeeee', clamp((t - bb.born) / 0.4, 0, 1));
    }

    // brilhos
    for (const sp of sparkles) {
      if (t < sp.born) continue;
      const [fx, fy, zt] = proj(sp.x, sp.y, sp.z);
      const tw = Math.sin(t * sp.speed + sp.phase);
      if (tw > 0.85) grid.plot(fx, fy, zt, '*', '#ffffff');
      else if (tw > 0.4) grid.plot(fx, fy, zt, '+', '#ffd7ff');
      else if (tw > 0.0) grid.plot(fx, fy, zt, '·', '#ffafd7');
    }

    // mensagem, digitada letra a letra
    if (t >= B.message) {
      const msg = [...CONFIG.message];
      const n = Math.min(msg.length, Math.floor((t - B.message) / B.msgChar) + 1);
      const mrow = Math.min(rows - 2, Math.round(cy + 0.78 * scale) + 1);
      const start = Math.max(0, Math.floor((cols - msg.length) / 2));
      const shift = Math.floor(t * 6);
      for (let i = 0; i < n; i++) {
        grid.put(start + i, mrow, msg[i], MSG_COLORS[(i + shift) % MSG_COLORS.length]);
      }
      if (n < msg.length) grid.put(start + n, mrow, '▏', MSG_COLORS[0]);
    }
  }
}
