// Liga tudo: gatinho → transição em bits → buquê.

import { Grid, hash, clamp } from './grid.js';
import { CatScene } from './cat.js';
import { BouquetScene } from './bouquet.js';

const canvas = document.getElementById('screen');
const grid = new Grid(canvas);

const DISSOLVE = 1.5; // segundos em que o desenho do gato se desfaz em 0/1
const GAP = 0.5; // tela preta entre as partes

let cat = new CatScene();
let bouquet = null;
let phase = 'cat';
let phaseT = 0;
let snap = null;

function enterCat() {
  phase = 'cat';
  phaseT = 0;
  cat = new CatScene();
  grid.setLayout(CatScene.layout);
  cat.prepare(grid);
}

function enterDissolve() {
  snap = grid.snapshot();
  snap.cells.forEach((c, i) => {
    // desfaz da esquerda para a direita, com bastante acaso
    const nx = c.col / Math.max(1, grid.cols);
    c.delay = nx * 0.5 + ((hash(i, 99) % 1000) / 1000) * 0.6;
  });
  phase = 'dissolve';
  phaseT = 0;
}

function enterBouquet() {
  phase = 'bouquet';
  phaseT = 0;
  bouquet = new BouquetScene();
  grid.setLayout(BouquetScene.layout);
}

function drawDissolve(t) {
  for (const r of snap.rects) {
    grid.rect(r.col, r.row, r.w, r.h, r.color, r.alpha * clamp(1 - t / 0.9, 0, 1));
  }
  for (let i = 0; i < snap.cells.length; i++) {
    const c = snap.cells[i];
    const k = t - c.delay;
    if (k < 0) {
      grid.put(c.col, c.row, c.ch, c.color, c.alpha);
    } else if (k < 0.45) {
      const bit = hash(i, Math.floor(t * 24)) & 1 ? '1' : '0';
      grid.put(c.col, c.row, bit, k < 0.12 ? '#e9fbe9' : c.color, (1 - k / 0.45) * 0.9);
    }
  }
}

// --------------------------------------------------------------- loop
// ~30 quadros por segundo, como um terminal (o script original roda a 24)
const FRAME = 1 / 30;
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // dt limitado: se a aba ficar em segundo plano, a animação continua de onde parou
  acc += Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  if (acc < FRAME - 0.002) return;
  const dt = acc;
  acc = 0;
  phaseT += dt;

  grid.clear();
  if (phase === 'cat') {
    cat.draw(grid, phaseT);
    if (phaseT >= cat.duration) {
      enterDissolve();
      grid.clear();
      drawDissolve(0);
    }
  } else if (phase === 'dissolve') {
    if (phaseT < DISSOLVE) drawDissolve(phaseT);
    else if (phaseT >= DISSOLVE + GAP) enterBouquet();
  } else {
    bouquet.draw(grid, phaseT, dt);
  }
  grid.render();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    grid.resize();
    if (phase === 'cat') cat.prepare(grid);
    if (phase === 'dissolve') {
      // a grade mudou de tamanho: pula direto para o buquê
      enterBouquet();
    }
  }, 120);
});

// Atalho para revisar só o buquê: abra a página com #buque no fim do link.
if (location.hash === '#buque') enterBouquet();
else enterCat();
requestAnimationFrame(frame);
