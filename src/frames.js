// Collection of abundant decorative frames inspired by Angie and Korean photobooths (인생네컷).
// Pure Canvas 2D vector/pattern rendering for maximum performance, crispness, and zero network lag.

export const FRAME_CATEGORIES = [
  { id: 'patterns', label: 'Patterns', icon: '🌸', badge: '10' },
  { id: 'cozy', label: 'Cozy Frames', icon: '🧸', badge: '6 NEW' },
  { id: 'food', label: 'Food & Cafe', icon: '🍙', badge: '5 NEW' },
  { id: 'birthday', label: 'Birthday', icon: '🎂', badge: '5' },
  { id: 'travel', label: 'Travel', icon: '✈️', badge: '4 NEW' },
  { id: 'memes', label: 'Memes & Y2K', icon: '🐱', badge: '4' },
  { id: 'simple', label: 'Simple', icon: '🎨', badge: '6' },
];

/* ---------------- Helper Drawing Primitives ---------------- */

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 1.4, x, y + size);
  ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 1.4, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
  ctx.fill();
  ctx.restore();
}

function drawCherry(ctx, cx, cy, s) {
  ctx.save();
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = '#3e7038';
  ctx.lineCap = 'round';
  // stem
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.6);
  ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.2, cx - s * 0.3, cy + s * 0.1);
  ctx.moveTo(cx, cy - s * 0.6);
  ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.2, cx + s * 0.3, cy + s * 0.1);
  ctx.stroke();
  // leaf / ribbon
  ctx.fillStyle = '#65a754';
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.1, cy - s * 0.6, s * 0.2, s * 0.08, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  // cherries
  ctx.fillStyle = '#df2c45';
  ctx.beginPath();
  ctx.arc(cx - s * 0.3, cy + s * 0.15, s * 0.22, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.3, cy + s * 0.15, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx - s * 0.36, cy + s * 0.08, s * 0.06, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.24, cy + s * 0.08, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTeddy(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#ba8b5f';
  // ears
  ctx.beginPath();
  ctx.arc(cx - r * 0.75, cy - r * 0.65, r * 0.38, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.75, cy - r * 0.65, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9b6c43';
  ctx.beginPath();
  ctx.arc(cx - r * 0.75, cy - r * 0.65, r * 0.2, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.75, cy - r * 0.65, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = '#ba8b5f';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // snout
  ctx.fillStyle = '#fae1c3';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.25, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // nose
  ctx.fillStyle = '#452614';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.15, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // mouth
  ctx.strokeStyle = '#452614';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.25);
  ctx.lineTo(cx, cy + r * 0.38);
  ctx.stroke();
  // eyes
  ctx.fillStyle = '#2b180d';
  ctx.beginPath();
  ctx.arc(cx - r * 0.36, cy - r * 0.1, r * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.36, cy - r * 0.1, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // cheek blush
  ctx.fillStyle = 'rgba(255, 130, 150, 0.4)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.55, cy + r * 0.2, r * 0.15, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.55, cy + r * 0.2, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDaisy(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r * 0.65, cy + Math.sin(angle) * r * 0.65, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f9c833';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLemon(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 6);
  // outer lemon
  ctx.fillStyle = '#ffd83b';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  // lemon rind inner
  ctx.fillStyle = '#fffce0';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // pulp segments
  ctx.fillStyle = '#ffd83b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fffce0';
  ctx.lineWidth = r * 0.08;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCatPaw(ctx, cx, cy, s, color = '#ff9ebb') {
  ctx.save();
  ctx.fillStyle = color;
  // palm
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.2, s * 0.45, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // 4 toes
  const toes = [
    [-s * 0.38, -s * 0.12, s * 0.15],
    [-s * 0.14, -s * 0.28, s * 0.16],
    [s * 0.14, -s * 0.28, s * 0.16],
    [s * 0.38, -s * 0.12, s * 0.15],
  ];
  for (const [tx, ty, tr] of toes) {
    ctx.beginPath();
    ctx.arc(cx + tx, cy + ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- FRAME TEMPLATES ---------------- */

export const FRAME_TEMPLATES = [
  /* ================== PATTERNS (10) ================== */
  {
    id: 'hearts',
    cat: 'patterns',
    name: 'Hearts',
    textColor: '#a32035',
    bgColor: '#fff6f6',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff6f6';
      ctx.fillRect(0, 0, w, h);
      const step = 64;
      for (let y = -20; y < h + 40; y += step) {
        const offset = Math.floor(y / step) % 2 ? step / 2 : 0;
        for (let x = -20; x < w + 40; x += step) {
          drawHeart(ctx, x + offset, y, 22, '#ea384d');
        }
      }
    },
  },
  {
    id: 'cherry',
    cat: 'patterns',
    name: 'Cherry',
    textColor: '#1f4874',
    bgColor: '#d8ecf8',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const size = 48;
      ctx.fillStyle = '#cde7f8';
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
            ctx.fillRect(x, y, size, size);
          }
        }
      }
      const cStep = 96;
      for (let y = 30; y < h + 30; y += cStep) {
        const off = Math.floor(y / cStep) % 2 ? cStep / 2 : 0;
        for (let x = 24; x < w + 30; x += cStep) {
          drawCherry(ctx, x + off, y, 26);
        }
      }
    },
  },
  {
    id: 'gingham',
    cat: 'patterns',
    name: 'Gingham',
    textColor: '#295431',
    bgColor: '#edf7ee',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#f8fdf8';
      ctx.fillRect(0, 0, w, h);
      const sz = 38;
      // green gingham
      ctx.fillStyle = 'rgba(128, 186, 134, 0.45)';
      for (let x = 0; x < w; x += sz * 2) ctx.fillRect(x, 0, sz, h);
      for (let y = 0; y < h; y += sz * 2) ctx.fillRect(0, y, w, sz);
      // daisies scattered
      for (let y = sz; y < h; y += sz * 4) {
        for (let x = sz; x < w; x += sz * 4) {
          drawDaisy(ctx, x, y, 11);
        }
      }
    },
  },
  {
    id: 'gingham_pink',
    cat: 'patterns',
    name: 'Pink Gingham',
    textColor: '#8e3549',
    bgColor: '#fdf0f4',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const sz = 40;
      ctx.fillStyle = 'rgba(255, 175, 196, 0.45)';
      for (let x = 0; x < w; x += sz * 2) ctx.fillRect(x, 0, sz, h);
      for (let y = 0; y < h; y += sz * 2) ctx.fillRect(0, y, w, sz);
      for (let y = sz; y < h; y += sz * 4) {
        for (let x = sz; x < w; x += sz * 4) {
          drawHeart(ctx, x, y - 6, 14, '#ff6b8b');
        }
      }
    },
  },
  {
    id: 'dots',
    cat: 'patterns',
    name: 'Dots',
    textColor: '#6f4a38',
    bgColor: '#fef8ea',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fef8ea';
      ctx.fillRect(0, 0, w, h);
      const step = 32;
      ctx.fillStyle = '#e8626f';
      for (let y = 16; y < h; y += step) {
        const off = Math.floor(y / step) % 2 ? step / 2 : 0;
        for (let x = 16; x < w; x += step) {
          ctx.beginPath();
          ctx.arc(x + off, y, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'lemonade',
    cat: 'patterns',
    name: 'Lemonade',
    textColor: '#1f5b82',
    bgColor: '#e3f3ff',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#eaf5fd';
      ctx.fillRect(0, 0, w, h);
      // pastel blue stripes
      const sw = 32;
      ctx.fillStyle = '#d4ebfc';
      for (let x = 0; x < w; x += sw * 2) {
        ctx.fillRect(x, 0, sw, h);
      }
      // floating lemons
      const lstep = 110;
      for (let y = 50; y < h + 50; y += lstep) {
        const off = Math.floor(y / lstep) % 2 ? lstep / 2 : 0;
        for (let x = 36; x < w + 50; x += lstep) {
          drawLemon(ctx, x + off, y, 19);
        }
      }
    },
  },
  {
    id: 'checker',
    cat: 'patterns',
    name: 'Checker',
    textColor: '#1d4872',
    bgColor: '#c3e2f8',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const sz = 38;
      ctx.fillStyle = '#94c9f1';
      for (let y = 0; y < h; y += sz) {
        for (let x = 0; x < w; x += sz) {
          if ((Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0) {
            ctx.fillRect(x, y, sz, sz);
          }
        }
      }
    },
  },
  {
    id: 'stripes_retro',
    cat: 'patterns',
    name: 'Retro Stripes',
    textColor: '#42372c',
    bgColor: '#faf3e0',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#faf3e0';
      ctx.fillRect(0, 0, w, h);
      const colors = ['#8fae83', '#ddb0cc', '#f7d88b', '#9ec3d5'];
      const sw = 18;
      let i = 0;
      for (let x = 0; x < w; x += sw) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, 0, sw, h);
        i++;
      }
    },
  },
  {
    id: 'denim',
    cat: 'patterns',
    name: 'Denim Stars',
    textColor: '#ffffff',
    bgColor: '#2a4467',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#223854');
      grad.addColorStop(1, '#34557f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // subtle denim texture
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1.5, h);
      // stitched denim stars
      const starColors = ['#fdf6e2', '#d5e7f8', '#ffdf85'];
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 137) % (w - 60)) + 30;
        const sy = ((i * 229) % (h - 60)) + 30;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = starColors[i % starColors.length];
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          ctx.lineTo(Math.cos(((18 + s * 72) * Math.PI) / 180) * 18, -Math.sin(((18 + s * 72) * Math.PI) / 180) * 18);
          ctx.lineTo(Math.cos(((54 + s * 72) * Math.PI) / 180) * 8, -Math.sin(((54 + s * 72) * Math.PI) / 180) * 8);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
  },
  {
    id: 'clouds',
    cat: 'patterns',
    name: 'Dreamy Sky',
    textColor: '#1a3c63',
    bgColor: '#bde3ff',
    draw: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#9ad0fc');
      sky.addColorStop(0.65, '#c8e7ff');
      sky.addColorStop(1, '#ffebf3');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const clouds = [
        [w * 0.15, 60, 45],
        [w * 0.82, 120, 55],
        [w * 0.25, h * 0.4, 60],
        [w * 0.85, h * 0.65, 50],
        [w * 0.2, h * 0.88, 65],
      ];
      for (const [cx, cy, cr] of clouds) {
        ctx.beginPath();
        ctx.arc(cx, cy, cr * 0.6, 0, Math.PI * 2);
        ctx.arc(cx + cr * 0.5, cy - cr * 0.15, cr * 0.7, 0, Math.PI * 2);
        ctx.arc(cx + cr, cy, cr * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // sparkles
      ctx.fillStyle = '#ffde59';
      for (let i = 0; i < 15; i++) {
        const x = (i * 191) % w;
        const y = (i * 317) % h;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  /* ================== COZY FRAMES (6) ================== */
  {
    id: 'teddy',
    cat: 'cozy',
    name: 'Teddy',
    textColor: '#4a2c17',
    bgColor: '#fbf4ea',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#f8f2e7';
      ctx.fillRect(0, 0, w, h);
      // cream stripes
      const sw = 48;
      ctx.fillStyle = '#f1e6d4';
      for (let x = 0; x < w; x += sw * 2) ctx.fillRect(x, 0, sw, h);
      // cute teddy bears at side borders
      const bstep = 220;
      for (let y = 90; y < h; y += bstep) {
        drawTeddy(ctx, 36, y, 26);
        drawTeddy(ctx, w - 36, y + 110, 26);
      }
    },
  },
  {
    id: 'tulips',
    cat: 'cozy',
    name: 'Tulips',
    textColor: '#1a4128',
    bgColor: '#ebf8ee',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#c7e6ff');
      grad.addColorStop(0.6, '#eef8f0');
      grad.addColorStop(1, '#94cb9d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // green stems & white tulips at bottom footer
      ctx.fillStyle = '#397843';
      for (let x = 10; x < w; x += 18) {
        ctx.fillRect(x, h - 160, 4, 160);
      }
      ctx.fillStyle = '#ffffff';
      for (let x = 12; x < w; x += 18) {
        ctx.beginPath();
        ctx.ellipse(x + 2, h - 165, 8, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'meadow',
    cat: 'cozy',
    name: 'Meadow',
    textColor: '#1f4325',
    bgColor: '#9ed3ff',
    draw: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#7bc4ff');
      sky.addColorStop(0.6, '#d9f1ff');
      sky.addColorStop(0.85, '#99d98c');
      sky.addColorStop(1, '#52b788');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // grassy hills curves at bottom
      ctx.fillStyle = '#74c69d';
      ctx.beginPath();
      ctx.ellipse(w * 0.25, h - 40, w * 0.45, 90, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#52b788';
      ctx.beginPath();
      ctx.ellipse(w * 0.75, h - 20, w * 0.5, 90, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'matcha',
    cat: 'cozy',
    name: 'Matcha',
    textColor: '#243e26',
    bgColor: '#e3ece1',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#e4ece2';
      ctx.fillRect(0, 0, w, h);
      // soft ceramic specks
      ctx.fillStyle = '#577259';
      for (let i = 0; i < 60; i++) {
        const x = (i * 277) % w;
        const y = (i * 449) % h;
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // elegant inner border
      ctx.strokeStyle = '#85a488';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(16, 16, w - 32, h - 32);
    },
  },
  {
    id: 'buttercream',
    cat: 'cozy',
    name: 'Buttercream',
    textColor: '#6d4825',
    bgColor: '#fdf7dd',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fdf6dc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e7d69b';
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      // cute little flowers at 4 corners
      drawDaisy(ctx, 32, 32, 12);
      drawDaisy(ctx, w - 32, 32, 12);
      drawDaisy(ctx, 32, h - 32, 12);
      drawDaisy(ctx, w - 32, h - 32, 12);
    },
  },
  {
    id: 'parchment',
    cat: 'cozy',
    name: 'Parchment',
    textColor: '#362719',
    bgColor: '#f3ead8',
    font: 'Fraunces',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#f3ebd9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a68c6e';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.strokeRect(22, 22, w - 44, h - 44);
    },
  },

  /* ================== FOOD & CAFE (5) ================== */
  {
    id: 'strawberry',
    cat: 'food',
    name: 'Strawberry',
    textColor: '#a31e32',
    bgColor: '#fff1f4',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff1f4';
      ctx.fillRect(0, 0, w, h);
      const step = 84;
      for (let y = 30; y < h + 40; y += step) {
        const off = Math.floor(y / step) % 2 ? step / 2 : 0;
        for (let x = 24; x < w + 40; x += step) {
          // cute strawberry
          ctx.save();
          const sx = x + off;
          ctx.fillStyle = '#ee3a54';
          ctx.beginPath();
          ctx.moveTo(sx, y - 8);
          ctx.quadraticCurveTo(sx + 14, y, sx, y + 18);
          ctx.quadraticCurveTo(sx - 14, y, sx, y - 8);
          ctx.fill();
          // stem
          ctx.fillStyle = '#4ca456';
          ctx.beginPath();
          ctx.arc(sx, y - 8, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    },
  },
  {
    id: 'boba',
    cat: 'food',
    name: 'Boba Milk',
    textColor: '#3e281b',
    bgColor: '#f3e8df',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f9f3ec');
      grad.addColorStop(0.7, '#ebd8c7');
      grad.addColorStop(1, '#c89d7c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // boba pearls cluster at bottom
      ctx.fillStyle = '#22150c';
      for (let i = 0; i < 40; i++) {
        const bx = ((i * 37) % (w - 40)) + 20;
        const by = h - 20 - ((i * 19) % 110);
        ctx.beginPath();
        ctx.arc(bx, by, 12, 0, Math.PI * 2);
        ctx.fill();
        // pearl gloss
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(bx - 3, by - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22150c';
      }
    },
  },
  {
    id: 'peaches',
    cat: 'food',
    name: 'Peachy',
    textColor: '#8e352b',
    bgColor: '#ffece3',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fff4ee');
      grad.addColorStop(1, '#ffd8c8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const step = 90;
      for (let y = 40; y < h + 40; y += step) {
        const off = Math.floor(y / step) % 2 ? step / 2 : 0;
        for (let x = 32; x < w + 40; x += step) {
          const px = x + off;
          ctx.fillStyle = '#ff8770';
          ctx.beginPath();
          ctx.arc(px - 6, y, 14, 0, Math.PI * 2);
          ctx.arc(px + 6, y, 14, 0, Math.PI * 2);
          ctx.fill();
          // leaf
          ctx.fillStyle = '#5fad67';
          ctx.beginPath();
          ctx.ellipse(px, y - 14, 6, 3, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'croissant',
    cat: 'food',
    name: 'Bakery',
    textColor: '#573318',
    bgColor: '#faf0e0',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#faf0e0';
      ctx.fillRect(0, 0, w, h);
      // warm bakery check
      const sz = 34;
      ctx.fillStyle = 'rgba(217, 166, 117, 0.28)';
      for (let x = 0; x < w; x += sz * 2) ctx.fillRect(x, 0, sz, h);
      for (let y = 0; y < h; y += sz * 2) ctx.fillRect(0, y, w, sz);
    },
  },
  {
    id: 'coffee',
    cat: 'food',
    name: 'Cafe Latte',
    textColor: '#2c1a0e',
    bgColor: '#e8dbce',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f2ece4');
      grad.addColorStop(1, '#ddcbba');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#917154';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, w - 36, h - 36);
    },
  },

  /* ================== BIRTHDAY (5) ================== */
  {
    id: 'confetti',
    cat: 'birthday',
    name: 'Party Confetti',
    textColor: '#813da1',
    bgColor: '#fff2fb',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff4fb';
      ctx.fillRect(0, 0, w, h);
      const colors = ['#ff599c', '#ffc43d', '#38bdf8', '#a855f7', '#4ade80'];
      for (let i = 0; i < 180; i++) {
        const x = (i * 127) % w;
        const y = (i * 233) % h;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((i * 45) * Math.PI) / 180);
        ctx.fillStyle = colors[i % colors.length];
        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-6, -2.5, 12, 5);
        }
        ctx.restore();
      }
    },
  },
  {
    id: 'birthday_cake',
    cat: 'birthday',
    name: 'Birthday Cake',
    textColor: '#b23067',
    bgColor: '#ffe6f0',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#ffeef6');
      grad.addColorStop(1, '#ffd0e4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // decorative scallops top and bottom
      ctx.fillStyle = '#ff82b5';
      for (let x = 0; x < w + 20; x += 30) {
        ctx.beginPath();
        ctx.arc(x, 10, 15, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, h - 10, 15, Math.PI, 0);
        ctx.fill();
      }
    },
  },
  {
    id: 'balloons',
    cat: 'birthday',
    name: 'Balloons',
    textColor: '#2a446c',
    bgColor: '#edf5ff',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#dcebfe');
      grad.addColorStop(1, '#fde2e4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const bColors = ['#ff758f', '#70d6ff', '#ffd166', '#a0c4ff', '#b9fbc0'];
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 109) % (w - 60)) + 30;
        const by = ((i * 181) % (h - 80)) + 40;
        ctx.save();
        ctx.fillStyle = bColors[i % bColors.length];
        ctx.beginPath();
        ctx.ellipse(bx, by, 16, 21, 0, 0, Math.PI * 2);
        ctx.fill();
        // string
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by + 21);
        ctx.quadraticCurveTo(bx + 8, by + 35, bx, by + 45);
        ctx.stroke();
        ctx.restore();
      }
    },
  },
  {
    id: 'champagne',
    cat: 'birthday',
    name: 'Golden Sparkle',
    textColor: '#f5e3b5',
    bgColor: '#16141a',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#17141f';
      ctx.fillRect(0, 0, w, h);
      // gold dust
      ctx.fillStyle = '#fce59f';
      for (let i = 0; i < 130; i++) {
        const x = (i * 179) % w;
        const y = (i * 283) % h;
        const r = (i % 4 === 0 ? 3.5 : 1.5);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#dfba63';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w - 36, h - 36);
    },
  },
  {
    id: 'pastel_streamers',
    cat: 'birthday',
    name: 'Streamers',
    textColor: '#6b3687',
    bgColor: '#faf3fc',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#faf3fc';
      ctx.fillRect(0, 0, w, h);
      const colors = ['#f49097', '#dfb2f4', '#f5e960', '#55d6c2'];
      ctx.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = colors[i % colors.length];
        ctx.beginPath();
        const startX = (i * 80) % w;
        ctx.moveTo(startX, 0);
        ctx.bezierCurveTo(startX + 60, h * 0.33, startX - 60, h * 0.66, startX + 40, h);
        ctx.stroke();
      }
    },
  },

  /* ================== TRAVEL (4) ================== */
  {
    id: 'seoul',
    cat: 'travel',
    name: 'Seoul Sunset',
    textColor: '#ffffff',
    bgColor: '#331f47',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1c1038');
      grad.addColorStop(0.4, '#6b2d69');
      grad.addColorStop(0.75, '#d4566c');
      grad.addColorStop(1, '#ff9a76');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // distant glowing stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 163) % w, (i * 97) % (h * 0.5), 2, 2);
      }
    },
  },
  {
    id: 'tokyo',
    cat: 'travel',
    name: 'Tokyo Metro',
    textColor: '#1a1a1a',
    bgColor: '#f4f4f4',
    font: 'JetBrains Mono',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(0, 0, w, h);
      // clean lines & metro circle badges
      ctx.strokeStyle = '#00a4e4';
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = '#e60012';
      ctx.beginPath();
      ctx.arc(36, 36, 10, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'bali',
    cat: 'travel',
    name: 'Bali Beach',
    textColor: '#213f38',
    bgColor: '#e3f3ec',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#bee3db');
      grad.addColorStop(0.65, '#f4e9cd');
      grad.addColorStop(1, '#e8c99b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // palm leaf silhouette bottom
      ctx.strokeStyle = '#2b5847';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w * 0.4, h - 120, w * 0.5, h);
      ctx.stroke();
    },
  },
  {
    id: 'paris',
    cat: 'travel',
    name: 'Paris Postcard',
    textColor: '#42281a',
    bgColor: '#f7ede2',
    font: 'Fraunces',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#f7ede2';
      ctx.fillRect(0, 0, w, h);
      // airmail border alternating blue & red hashes
      const stripeW = 16;
      for (let x = 0; x < w; x += stripeW * 2) {
        ctx.fillStyle = '#c83e3e';
        ctx.fillRect(x, 0, stripeW, 10);
        ctx.fillRect(x, h - 10, stripeW, 10);
        ctx.fillStyle = '#2a5a9c';
        ctx.fillRect(x + stripeW, 0, stripeW, 10);
        ctx.fillRect(x + stripeW, h - 10, stripeW, 10);
      }
    },
  },

  /* ================== MEMES & Y2K (4) ================== */
  {
    id: 'cat_paws',
    cat: 'memes',
    name: 'Cat Paws',
    textColor: '#8c4860',
    bgColor: '#fff2f6',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fff5f8';
      ctx.fillRect(0, 0, w, h);
      const step = 90;
      for (let y = 40; y < h + 40; y += step) {
        const off = Math.floor(y / step) % 2 ? step / 2 : 0;
        for (let x = 32; x < w + 40; x += step) {
          drawCatPaw(ctx, x + off, y, 18, '#ff9ebb');
        }
      }
    },
  },
  {
    id: 'pixel_arcade',
    cat: 'memes',
    name: 'Pixel Arcade',
    textColor: '#4deeea',
    bgColor: '#100a26',
    font: 'JetBrains Mono',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#0f0826';
      ctx.fillRect(0, 0, w, h);
      // neon pixel grid
      ctx.strokeStyle = 'rgba(116, 79, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // neon pink border
      ctx.strokeStyle = '#ff4fd8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 12;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'stickers',
    cat: 'memes',
    name: 'Deco Stickers',
    textColor: '#222222',
    bgColor: '#fdf9f4',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, w, h);
      // colorful doodle stars and hearts
      const sColors = ['#ff85a1', '#7bf1a8', '#ffd166', '#a0c4ff'];
      for (let i = 0; i < 35; i++) {
        const x = (i * 157) % w;
        const y = (i * 241) % h;
        if (i % 2 === 0) {
          drawHeart(ctx, x, y, 16, sColors[i % sColors.length]);
        } else {
          drawDaisy(ctx, x, y, 8);
        }
      }
    },
  },
  {
    id: 'vaporwave',
    cat: 'memes',
    name: 'Vaporwave',
    textColor: '#ffffff',
    bgColor: '#1a0b2e',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#190a32');
      grad.addColorStop(0.5, '#4a1259');
      grad.addColorStop(1, '#ff4985');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // perspective sun
      ctx.fillStyle = '#ffe259';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.7, 70, Math.PI, 0);
      ctx.fill();
    },
  },

  /* ================== SIMPLE & MINIMAL (6) ================== */
  {
    id: 'classic_black',
    cat: 'simple',
    name: 'Matte Black',
    textColor: '#f2f2f2',
    bgColor: '#151518',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#151518';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'classic_white',
    cat: 'simple',
    name: 'Pure White',
    textColor: '#1a1a1a',
    bgColor: '#ffffff',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e6e6e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    },
  },
  {
    id: 'warm_beige',
    cat: 'simple',
    name: 'Warm Beige',
    textColor: '#423326',
    bgColor: '#f5eee6',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#f5ede4';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'soft_pink',
    cat: 'simple',
    name: 'Soft Pink',
    textColor: '#853e50',
    bgColor: '#ffe6ee',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#ffe5ee';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'sage_green',
    cat: 'simple',
    name: 'Sage Mist',
    textColor: '#294331',
    bgColor: '#e3ece4',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#e4ece5';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'slate_dark',
    cat: 'simple',
    name: 'Graphite',
    textColor: '#f5f5f7',
    bgColor: '#2a2a30',
    draw: (ctx, w, h, L, customColor) => {
      ctx.fillStyle = customColor || '#29292f';
      ctx.fillRect(0, 0, w, h);
    },
  },
];

export const FRAME_MAP = Object.fromEntries(FRAME_TEMPLATES.map((f) => [f.id, f]));

export function getFrame(id) {
  return FRAME_MAP[id] || FRAME_MAP['hearts'] || FRAME_TEMPLATES[0];
}
