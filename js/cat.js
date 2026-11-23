// Parte 1 — o gatinho tigrado que entrega a rosa.
//
// Tudo é desenhado com caracteres numa grade de terminal: o gato entra
// andando com a rosa na boca (e o envelopinho pendurado), para, senta,
// deixa a rosa no chão à sua frente, o envelope vira um cartão que é
// "digitado" letra a letra, e um coraçãozinho aparece sobre a cabeça.

import { CONFIG } from './config.js';
import { clamp, easeOut, easeInOut } from './grid.js';

// ---------------------------------------------------------------- cores
const C = {
  fur: '#cfc3b0', // pelagem clara (contorno)
  dark: '#93785d', // listras do tigrado
  eye: '#8fd18a',
  blush: '#a9b8c9',
  nose: '#e796b2',
  stem: '#5fae6a',
  rose: '#e0475f',
  roseDim: '#b8475b',
  white: '#f1eee8',
  ground: '#3b3b3b',
  heart: ['#f08fb0', '#e8789e', '#f5a9c4'],
  cardBg: '#f2ede4',
  cardEdge: '#dcd3c4',
  cardText: '#c4536a',
};

const MASK = {
  d: C.dark,
  e: C.eye,
  b: C.blush,
  n: C.nose,
  g: C.stem,
  r: C.rose,
  p: C.roseDim,
  w: C.white,
};

// Converte arte ASCII + máscara de cores em uma lista de células.
function sprite(art, mask, base = C.fur) {
  const a = art.replace(/^\n/, '').split('\n');
  const m = (mask || '').replace(/^\n/, '').split('\n');
  const cells = [];
  let w = 0;
  a.forEach((line, row) => {
    const chars = [...line];
    const mline = [...(m[row] || '')];
    w = Math.max(w, chars.length);
    chars.forEach((ch, col) => {
      if (ch === ' ') return;
      const k = mline[col];
      cells.push({ col, row, ch, color: (k && MASK[k]) || base });
    });
  });
  return { cells, w, h: a.length };
}

// ------------------------------------------------------- gato andando (→)
const WALK_BODY = String.raw`
                 /\_____/\
                /  ≈ M ≈  \
               |  o     o  |
               | ▬   ω   ▬ |
   \ \_________/            \
    \   ≈≈     ≈≈     ≈≈     |
     |    ≈≈     ≈≈     ≈≈   |
     \_______________________/`;
const WALK_BODY_M = String.raw`

                   d d d
                  e     e
                 b   n   b
   d
        dd     dd     dd
          dd     dd     dd
                              `;

const TAIL_A = String.raw`
  _
 ( )
  \ \ `;
const TAIL_A_M = String.raw`
  d
 d d
  d  `;
const TAIL_B = String.raw`
 _
( )
 \ \ `;
const TAIL_B_M = String.raw`
 d
d d
 d  `;

const LEGS_A = String.raw`      |_| |_|         |_| |_|`;
const LEGS_A_M = String.raw`       d   d           d   d `;
const LEGS_B = String.raw`     /_/   \_\       /_/   \_\ `;
const LEGS_B_M = String.raw`      d     d         d     d `;

// ------------------------------------------------------ gato sentado (de frente)
const SIT = String.raw`
            /\_______/\
           /  ≈  M  ≈  \
          |   o     o   |
          (  ▬   ω   ▬  )
         __\           /__
        /    ≈≈     ≈≈    \
       |  ≈≈    ≈≈    ≈≈   |
  .-.  |     ≈≈     ≈≈     |
 (   '-\____(__)___(__)____/`;
const SIT_M = String.raw`

              d  d  d
              e     e
             b   n   b

             dd     dd
          dd    dd    dd
  d d        dd     dd
 d   dd                      `;

// ------------------------------------------------------------- a rosa
// carregada na boca (haste para a esquerda, flor à direita)
const ROSE_CARRY = String.raw`
           .--.
----------<(@@)
        |  '--'
       [▣]`;
const ROSE_CARRY_M = String.raw`
           pppp
gggggggggggrrrr
        w  pppp
       www`;
// deitada no chão
const ROSE_GROUND = String.raw`
      .--.
---<--(@@)
      '--'`;
const ROSE_GROUND_M = String.raw`
      pppp
ggggggrrrr
      pppp`;

const SPR = {
  walkBody: sprite(WALK_BODY, WALK_BODY_M),
  tailA: sprite(TAIL_A, TAIL_A_M),
  tailB: sprite(TAIL_B, TAIL_B_M),
  legsA: sprite(LEGS_A, LEGS_A_M),
  legsB: sprite(LEGS_B, LEGS_B_M),
  sit: sprite(SIT, SIT_M),
  roseCarry: sprite(ROSE_CARRY, ROSE_CARRY_M),
  // só a rosa, sem o envelopinho pendurado (quando não há cartão)
  roseOnly: sprite(
    ROSE_CARRY.split('\n').slice(0, 4).join('\n').replace('|', ' '),
    ROSE_CARRY_M.split('\n').slice(0, 4).join('\n'),
  ),
  roseGround: sprite(ROSE_GROUND, ROSE_GROUND_M),
  box: sprite('[▣]', 'www'),
};

// Posições de referência dentro dos sprites
const WALK_MOUTH = { col: 22, row: 3 }; // logo depois do "ω"
const WALK_TAIL_TIP = { col: 2, row: 0 };
const SIT_EYES = [
  { col: 14, row: 2 },
  { col: 20, row: 2 },
];
const SIT_HEAD_TOP = { col: 17, row: 0 };

// ----------------------------------------------------------- a cena
const SCENE_W = 66; // largura lógica da cena (em colunas)
const GROUND = 16; // linha do chão (em linhas da cena)
const SCENE_H = GROUND + 2;
const SIT_X = 6; // onde o gato senta
const ROSE_X = SIT_X + 33; // onde a rosa fica no chão
const BOX_X = SIT_X + 29;

// Linha do tempo (segundos)
const T = {
  ground: 0.0, // chão pontilhado vai sendo desenhado
  walk: 0.7, // começa a andar (duração calculada pela largura da tela)
  // as demais são relativas ao fim da caminhada:
  pause: 0.35,
  sit: 0.45, // rosa cai até o chão
  idle: 1.2,
  card: 0.55, // cartão cresce a partir do envelope
  typeChar: 0.075,
  optionsDelay: 0.35,
  heartDelay: 0.55,
};

export class CatScene {
  constructor() {
    this.hearts = [];
    this.lastHeart = 0;
    this.rand = mulberry32(7);
  }

  // Tamanho da fonte: a cena ocupa uma faixa central, como no vídeo.
  static layout(w, h) {
    const byH = h / (44 * 2 * 0.6);
    const byW = w / ((SCENE_W + 6) * 0.6);
    const byW2 = w / (150 * 0.6);
    return clamp(Math.min(byH, Math.max(byW, byW2)), 5, 22);
  }

  // Monta o cronograma depois de saber a largura da tela.
  prepare(grid) {
    this.sx = Math.floor((grid.cols - SCENE_W) / 2);
    this.sy = Math.floor((grid.rows - SCENE_H) / 2) + 1;
    const startX = -this.sx - SPR.walkBody.w - 2; // fora da tela, à esquerda
    this.startX = startX;
    const dist = SIT_X - startX;
    this.walkDur = clamp(dist / 22, 2.4, 3.8);
    const t0 = T.walk + this.walkDur;
    this.tStop = t0;
    this.tSit = t0 + T.pause;
    this.tIdle = this.tSit + T.sit;
    this.tCard = this.tIdle + T.idle;
    this.tType = this.tCard + T.card;
    this.tOptions = this.tType + CONFIG.cardText.length * T.typeChar + T.optionsDelay;
    this.tHeart = CONFIG.showCard ? this.tOptions + T.heartDelay : this.tCard + 0.2;
    this.duration = this.tHeart + CONFIG.catHold;
  }

  // desenha um sprite na grade em coordenadas da cena
  blit(grid, spr, x, y, alpha = 1, override) {
    for (const c of spr.cells) {
      const col = this.sx + x + c.col;
      const row = this.sy + y + c.row;
      grid.put(col, row, c.ch, override || c.color, alpha);
    }
  }

  draw(grid, t) {
    const sx = this.sx;
    const sy = this.sy;

    // Chão pontilhado, desenhado da esquerda para a direita
    const gp = easeOut((t - T.ground) / 1.1);
    const gEnd = Math.floor(gp * grid.cols);
    for (let c = 1; c < gEnd; c += 2) grid.put(c, sy + GROUND, '·', C.ground);

    // Corações que flutuam enquanto ele anda
    this.drawHearts(grid, t);

    if (t < this.tSit) {
      this.drawWalking(grid, t);
    } else {
      this.drawSitting(grid, t);
    }

    if (CONFIG.showCard) this.drawCard(grid, t);
  }

  drawWalking(grid, t) {
    const p = clamp((t - T.walk) / this.walkDur, 0, 1);
    // anda em velocidade constante e desacelera só no finalzinho
    const e = p < 0.85 ? p / 0.85 * 0.93 : 0.93 + easeOut((p - 0.85) / 0.15) * 0.07;
    const x = Math.round(this.startX + (SIT_X - this.startX) * e);
    const y = GROUND - 1 - (SPR.walkBody.h);
    const moving = t < this.tStop;
    const step = moving ? Math.floor(t / 0.16) % 2 : 0;
    const tailWag = Math.floor(t / 0.45) % 2;

    this.blit(grid, tailWag ? SPR.tailB : SPR.tailA, x + 1, y + 1);
    this.blit(grid, SPR.walkBody, x, y);
    this.blit(grid, step ? SPR.legsB : SPR.legsA, x, y + SPR.walkBody.h);

    // a rosa vai na boca
    const rx = x + WALK_MOUTH.col;
    const ry = y + WALK_MOUTH.row - 1;
    this.blit(grid, CONFIG.showCard ? SPR.roseCarry : SPR.roseOnly, rx, ry);

    // solta coraçõezinhos pela cauda
    if (moving && t - this.lastHeart > 0.55 && t > T.walk + 0.3) {
      this.lastHeart = t;
      this.hearts.push({
        x: x + 1 + WALK_TAIL_TIP.col + 1,
        y: y + WALK_TAIL_TIP.row,
        t0: t,
        drift: -0.6 - this.rand() * 0.8,
        color: C.heart[(this.rand() * C.heart.length) | 0],
      });
    }
  }

  drawSitting(grid, t) {
    const x = SIT_X;
    const y = GROUND - SPR.sit.h;
    this.blit(grid, SPR.sit, x, y);

    // rabo abanando devagar no chão
    if (Math.floor(t / 0.6) % 2 === 1) {
      const bx = this.sx + x;
      const by = this.sy + y;
      for (let c = 0; c <= 6; c++) {
        grid.erase(bx + c, by + 7);
        grid.erase(bx + c, by + 8);
      }
      [...' .-.'].forEach((ch, i) => ch !== ' ' && grid.put(bx + i, by + 7, ch, i === 2 ? C.fur : C.dark));
      [...'(   \'--'].forEach((ch, i) => ch !== ' ' && grid.put(bx + i, by + 8, ch, i % 2 ? C.fur : C.dark));
    }

    // olhos: piscam de vez em quando; ficam felizes (^ ^) no final
    const happy = t >= this.tHeart;
    const blink = !happy && ((t > this.tIdle + 0.5 && t < this.tIdle + 0.62) || ((t % 3.1) > 3.0));
    if (happy || blink) {
      for (const e of SIT_EYES) {
        grid.put(this.sx + x + e.col, this.sy + y + e.row, happy ? '^' : '-', C.eye);
      }
    }

    // a rosa cai da boca até o chão, à frente do gato
    const fp = easeInOut((t - this.tSit) / T.sit);
    const from = { x: SIT_X + 17, y: GROUND - SPR.sit.h + 2 };
    const to = { x: ROSE_X, y: GROUND - SPR.roseGround.h };
    if (fp < 1) {
      const rx = Math.round(from.x + (to.x - from.x) * fp);
      const ry = Math.round(from.y + (to.y - from.y) * fp);
      const carry = CONFIG.showCard ? SPR.roseCarry : SPR.roseOnly;
      this.blit(grid, fp < 0.5 ? carry : SPR.roseGround, rx, ry);
    } else {
      this.blit(grid, SPR.roseGround, to.x, to.y);
    }

    // o envelopinho fica ao lado da patinha até virar cartão
    const boxAlpha = CONFIG.showCard ? 1 - clamp((t - this.tCard) / 0.25, 0, 1) : 0;
    if (fp >= 0.5 && boxAlpha > 0) {
      this.blit(grid, SPR.box, BOX_X, GROUND - 1, boxAlpha);
      if (CONFIG.showCard && t > this.tCard - 0.45 && t < this.tCard) {
        grid.put(this.sx + BOX_X + 1, this.sy + GROUND - 2, '*', C.white);
      }
    }

    // coraçãozinho sobre a cabeça
    if (t >= this.tHeart) {
      const k = t - this.tHeart;
      const lift = k < 0.25 ? 0 : -1;
      grid.put(this.sx + x + SIT_HEAD_TOP.col, this.sy + y - 2 + lift, '♥', C.heart[0]);
    }
  }

  drawCard(grid, t) {
    if (t < this.tCard) return;
    const final = { x: SCENE_W - 31, y: 1, w: 31, h: 7 };
    const p = easeOut((t - this.tCard) / T.card);
    const bx = BOX_X + 1;
    const by = GROUND - 1;
    const x = bx + (final.x - bx) * p;
    const y = by + (final.y - by) * p;
    const w = 1 + (final.w - 1) * p;
    const h = 1 + (final.h - 1) * p;
    grid.rect(this.sx + x, this.sy + y, w, h, C.cardEdge, 1);
    if (w > 2 && h > 2) grid.rect(this.sx + x + 0.35, this.sy + y + 0.2, w - 0.7, h - 0.4, C.cardBg, 1);

    if (t < this.tType) return;
    const text = CONFIG.cardText;
    const n = Math.min(text.length, Math.floor((t - this.tType) / T.typeChar) + 1);
    const tx = final.x + Math.floor((final.w - text.length) / 2);
    const ty = final.y + 2;
    const chars = [...text];
    for (let i = 0; i < n; i++) grid.put(this.sx + tx + i, this.sy + ty, chars[i], C.cardText);
    // cursor piscando enquanto digita
    if (n < text.length || (t < this.tOptions && Math.floor(t * 3) % 2 === 0)) {
      grid.put(this.sx + tx + n, this.sy + ty, '▏', C.cardText);
    }

    if (t >= this.tOptions) {
      const [a, b] = CONFIG.cardOptions;
      const line = a + '      ' + b;
      const ox = final.x + Math.floor((final.w - line.length) / 2);
      [...line].forEach((ch, i) => grid.put(this.sx + ox + i, this.sy + ty + 2, ch, C.cardText));
    }
  }

  drawHearts(grid, t) {
    this.hearts = this.hearts.filter((h) => t - h.t0 < 1.8);
    for (const h of this.hearts) {
      const k = (t - h.t0) / 1.8;
      const col = this.sx + Math.round(h.x + h.drift * k * 4);
      const row = this.sy + Math.round(h.y - k * 4);
      grid.put(col, row, k < 0.15 ? '·' : '♥', h.color, 1 - k * k);
    }
  }
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
