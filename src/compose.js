// Canvas compositor: builds the final photo strip from everyone's shots.
import { LAYOUTS } from './config.js';

const imgCache = new Map();

export function loadImg(src) {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
  imgCache.set(src, p);
  return p;
}

export function clearImgCache() {
  imgCache.clear();
}

/* ---------- helpers ---------- */

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) {
    sh = img.height;
    sw = sh * r;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / r;
    sx = 0;
    sy = (img.height - sh) * 0.4; // bias upward: faces are usually in the top half
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Pixel-level filters (works everywhere, unlike ctx.filter on Safari). */
function applyFilter(ctx, w, h, filter, seed = 1) {
  if (!filter || filter === 'none') return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rnd = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    switch (filter) {
      case 'mono': {
        const v = (l - 128) * 1.18 + 128;
        r = g = b = v;
        break;
      }
      case 'warm':
        r = r * 1.08 + 12; g = g * 1.02 + 4; b = b * 0.88;
        break;
      case 'cool':
        r = r * 0.92; g = g * 1.0 + 3; b = b * 1.08 + 12;
        break;
      case 'film': {
        r = (l + (r - l) * 0.8) * 0.86 + 30;
        g = (l + (g - l) * 0.8) * 0.86 + 24;
        b = (l + (b - l) * 0.8) * 0.82 + 18;
        const n = (rnd() - 0.5) * 18;
        r += n; g += n; b += n;
        break;
      }
      case 'vivid':
        r = ((l + (r - l) * 1.4) - 128) * 1.06 + 128;
        g = ((l + (g - l) * 1.4) - 128) * 1.06 + 128;
        b = ((l + (b - l) * 1.4) - 128) * 1.06 + 128;
        break;
    }
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  ctx.putImageData(img, 0, 0);

  if (filter === 'film' || filter === 'mono') {
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Draw a single cell: all participants of one shot side by side.
 * photos: [{ name, src }] already ordered.
 */
async function drawCell(w, h, photos, filter, seed) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#26262b';
  ctx.fillRect(0, 0, c.width, c.height);

  const n = Math.max(1, photos.length);
  const cols = n === 4 ? 2 : n;
  const rows = n === 4 ? 2 : 1;
  const sep = n > 1 ? Math.max(2, Math.round(w * 0.006)) : 0;
  const cw = (c.width - sep * (cols - 1)) / cols;
  const ch = (c.height - sep * (rows - 1)) / rows;
  const imgs = await Promise.all(photos.map((p) => loadImg(p.src)));

  photos.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cw + sep);
    const y = row * (ch + sep);
    const img = imgs[i];
    if (img) {
      drawCover(ctx, img, x, y, cw, ch);
    } else {
      ctx.fillStyle = '#34343b';
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = `600 ${Math.round(ch * 0.25)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((p.name || '?')[0].toUpperCase(), x + cw / 2, y + ch / 2);
    }
  });
  applyFilter(ctx, c.width, c.height, filter, seed);
  return c;
}

/** Render a single shot thumbnail into the given canvas. */
export async function renderShotThumb(canvas, photos, filter, ratio, width = 360) {
  const h = Math.round(width / ratio);
  const cell = await drawCell(width, h, photos, filter, 7);
  canvas.width = width;
  canvas.height = h;
  canvas.getContext('2d').drawImage(cell, 0, 0);
}

export function stripSize(layoutId) {
  const L = LAYOUTS[layoutId];
  const cellW = (L.width - L.pad * 2 - L.gap * (L.cols - 1)) / L.cols;
  const cellH = cellW / L.cellRatio;
  const height = L.pad + L.rows * cellH + (L.rows - 1) * L.gap + L.footer;
  return { width: L.width, height: Math.round(height), cellW, cellH, L };
}

/* ---------- theme decorations ---------- */

function decorateBackground(ctx, W, H, themeId, frameColor) {
  const dark = luminance(frameColor) < 0.45;
  if (themeId === 'party') {
    const rnd = mulberry32(42);
    const colors = ['#ff7eb6', '#ffc94d', '#7ad7c4', '#9b8cff', '#6aa5ff'];
    for (let i = 0; i < 140; i++) {
      ctx.save();
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.85;
      ctx.translate(rnd() * W, rnd() * H);
      ctx.rotate(rnd() * Math.PI);
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 4 + rnd() * 4, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-6, -2.5, 12 + rnd() * 6, 5);
      ctx.restore();
    }
  } else if (themeId === 'vintage') {
    const rnd = mulberry32(9);
    for (let i = 0; i < W * H * 0.004; i++) {
      ctx.fillStyle = dark ? `rgba(255,255,255,${rnd() * 0.06})` : `rgba(60,40,20,${rnd() * 0.08})`;
      ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
    }
    ctx.strokeStyle = dark ? 'rgba(243,234,216,.35)' : 'rgba(60,40,20,.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);
  } else if (themeId === 'neon') {
    const rnd = mulberry32(3);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function decorateCell(ctx, x, y, w, h, i, themeId) {
  if (themeId === 'neon') {
    ctx.save();
    const c = i % 2 ? '#4fe3ff' : '#ff4fd8';
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 12);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Render the full strip.
 * cells: array (length = slots) of photo arrays ([{ name, src }]) or null for empty slots.
 */
export async function renderStrip(canvas, opts) {
  const { layoutId, themeId, cells, filter, frameColor, caption, showDate } = opts;
  const { width: W, height: H, cellW, cellH, L } = stripSize(layoutId);
  const font = themeId === 'vintage' ? 'Fraunces' : 'Inter';
  try {
    await document.fonts.load(`700 40px ${font}`);
  } catch {
    /* ignore */
  }

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, W, H);
  decorateBackground(ctx, W, H, themeId, frameColor);

  const radius = themeId === 'vintage' ? 0 : Math.round(W * 0.012);
  const rendered = await Promise.all(
    cells.map((photos, i) => (photos ? drawCell(cellW, cellH, photos, filter, i + 11) : null))
  );

  rendered.forEach((cell, i) => {
    const col = i % L.cols;
    const row = Math.floor(i / L.cols);
    const x = L.pad + col * (cellW + L.gap);
    const y = L.pad + row * (cellH + L.gap);
    decorateCell(ctx, x, y, cellW, cellH, i, themeId);
    ctx.save();
    roundRect(ctx, x, y, cellW, cellH, radius);
    ctx.clip();
    if (cell) ctx.drawImage(cell, x, y, cellW, cellH);
    else {
      ctx.fillStyle = luminance(frameColor) < 0.45 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
      ctx.fillRect(x, y, cellW, cellH);
    }
    ctx.restore();
  });

  // footer
  const dark = luminance(frameColor) < 0.45;
  const ink = dark ? '#f6f1e7' : '#1b1b20';
  const gridBottom = L.pad + L.rows * cellH + (L.rows - 1) * L.gap;
  const base = Math.min(W, 900);
  const capSize = Math.round(base * (layoutId === '4cut' ? 0.068 : 0.05));
  const text = (caption || 'phoboots').slice(0, 40);
  const cy = gridBottom + L.footer * (showDate ? 0.42 : 0.5);

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${themeId === 'vintage' ? 'italic 600' : '800'} ${capSize}px ${font}, sans-serif`;
  if (themeId === 'neon') {
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 16;
  }
  ctx.fillText(text, W / 2, cy);
  ctx.shadowBlur = 0;

  if (themeId === 'classic') {
    const tw = ctx.measureText(text).width;
    const r = capSize * 0.16;
    ctx.fillStyle = '#ff7aa8';
    ctx.beginPath();
    ctx.arc(W / 2 + tw / 2 + r * 2.2, cy + capSize * 0.12, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6aa5ff';
    ctx.beginPath();
    ctx.arc(W / 2 + tw / 2 + r * 5, cy + capSize * 0.12, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showDate) {
    const d = new Date();
    const ds = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    ctx.fillStyle = dark ? 'rgba(246,241,231,.7)' : 'rgba(27,27,32,.6)';
    ctx.font = `500 ${Math.round(capSize * 0.42)}px 'JetBrains Mono', monospace`;
    ctx.fillText(ds, W / 2, gridBottom + L.footer * 0.72);
  }
  return canvas;
}
