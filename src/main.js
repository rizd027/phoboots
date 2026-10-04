import './style.css';
import { t, getLang, setLang } from './i18n.js';
import { THEMES, LAYOUTS, FILTERS, slotsOf, shotsOf, MAX_MEMBERS } from './config.js';
import { Room } from './room.js';
import { getCamera, stopStream, captureFrame } from './camera.js';
import { renderStrip, renderShotThumb, renderFramePreview, clearImgCache, stripSize, roundRect, drawCover } from './compose.js';
import { FRAME_CATEGORIES, FRAME_TEMPLATES, getFrame } from './frames.js';
import { recordLiveClip, recordCanvasVideo, isLivePhotoSupported } from './livephoto.js';

/* =========================================================
   App state
   ========================================================= */
const app = document.getElementById('app');
const S = {
  view: 'home', // home | booth | join | loading | lobby | session
  mode: 'host', // host | solo
  room: null,
  stream: null,
  name: localStorage.getItem('phoboots-name') || '',
  joinCode: '',
  joinError: '',
  joining: false,
  activeFrameCat: 'patterns',
  styleFrameCat: 'patterns',
  shots: [], // [{ [peerId]: dataURL }]
  liveClips: [], // [string objectUrl]
  liveBlobs: [], // [Blob]
  liveMode: false, // boolean Live Photo toggle
  participants: [], // [{ id, name }] snapshot at shoot start
  shooting: false,
  lastPhase: null,
  finalBlob: null,
};
const videos = new Map(); // peerId -> <video>
const PHASES = ['frame', 'shoot', 'pick', 'style', 'done'];
const LAYOUT_IDS = ['4cut', '2x2', '2cut', 'polaroid'];

const st = () => S.room?.state || {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const debounce = (fn, ms) => {
  let id;
  return (...a) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...a), ms);
  };
};

/* =========================================================
   Icons
   ========================================================= */
const ic = {
  back: '<svg viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  micOff: '<svg viewBox="0 0 24 24"><path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
  again: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
};

/* =========================================================
   Small UI helpers
   ========================================================= */
function toast(msg) {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3200);
}

let actx;
function beep(freq = 880, dur = 0.08, type = 'sine', vol = 0.06) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    /* audio not available */
  }
}
const shutter = () => {
  beep(1400, 0.05, 'square', 0.04);
  setTimeout(() => beep(600, 0.09, 'triangle', 0.05), 40);
};

const langBtn = (cls = '') =>
  `<button class="lang-btn ${cls}" data-action="lang" id="btn-lang" aria-label="Change language">
     <span class="${getLang() === 'id' ? 'on' : ''}">ID</span><span class="${getLang() === 'en' ? 'on' : ''}">EN</span>
   </button>`;

const logo = () =>
  `<a class="logo" href="/" data-action="home" id="logo">phoboots<span class="logo-dots"><i></i><i></i></span></a>`;

const roomLink = () => `${location.origin}${location.pathname}?room=${S.room?.code}`;

function boothCards(mode) {
  const art = {
    classic: '<i class="b-dot pink"></i><i class="b-dot blue"></i>',
    party: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    vintage: '<span class="b-curtain"></span><span class="b-lamp"></span>',
    neon: '<span class="b-neon">찰칵</span>',
  };
  return `<div class="booths">${Object.values(THEMES)
    .map(
      (th, i) => `
      <button class="booth-card booth-${th.id}" style="--d:${i * 70}ms" data-action="pick-theme" data-mode="${mode}" data-theme="${th.id}" id="booth-${th.id}">
        <div class="booth-art">${art[th.id]}</div>
        <div class="booth-label"><b>${t(th.name)}</b><span>${t(th.desc)}</span></div>
      </button>`
    )
    .join('')}</div>`;
}

const nameField = () => `
  <label class="name-field">
    <span>${t('yourName')}</span>
    <input id="name-input" maxlength="20" autocomplete="nickname" placeholder="${t('namePh')}" value="${esc(S.name)}" />
  </label>`;

/* =========================================================
   Views
   ========================================================= */
function homeView() {
  return `
  <div class="ribbon">${t('footer')}</div>
  <header class="nav container">
    ${logo()}
    <nav class="nav-links">
      <a href="#how">${t('navHow')}</a>
      <a href="#booths">${t('navBooths')}</a>
      <a href="#faq">${t('navFaq')}</a>
    </nav>
    ${langBtn()}
  </header>

  <main>
    <section class="hero container">
      <div class="hero-copy">
        <span class="pill"><span class="pill-dot"></span>${t('heroBadge')}</span>
        <h1>${t('heroTitle1')}<br/><span class="grad">${t('heroTitle2')}</span><br/>${t('heroTitle3')}</h1>
        <p class="lead">${t('heroDesc')}</p>
        <div class="cta">
          <button class="cta-btn primary" data-action="start" id="btn-start">
            <b>${t('startRoom')}</b><span>${t('startRoomSub')}</span>
          </button>
          <button class="cta-btn" data-action="join" id="btn-join">
            <b>${t('joinRoom')}</b><span>${t('joinRoomSub')}</span>
          </button>
        </div>
        <div class="chips">
          <button class="chip" data-action="solo" id="btn-solo">${ic.cam}${t('justMe')}</button>
          <span class="chip static">${ic.users}${t('groupOf4')}</span>
        </div>
      </div>

      <div class="hero-art" aria-hidden="true">
        <div class="glow g1"></div><div class="glow g2"></div>
        <div class="hanger">
          <div class="hanger-bar"></div>
          <img class="hang-strip" src="/hero-strip.jpg" alt="Example photobooth strip" width="424" height="632" />
        </div>
        <div class="float-card fc1">${ic.pin}<b>Jakarta</b><span>Indonesia</span></div>
        <div class="float-card fc2">${ic.pin}<b>Seoul</b><span>Korea</span></div>
        <div class="float-card fc3"><span class="live-dot"></span>3 / 4 ${t('inRoom')}</div>
      </div>
    </section>

    <section id="how" class="container section">
      <h2>${t('howTitle')}</h2>
      <div class="how-grid">
        ${[1, 2, 3]
          .map(
            (n) => `
          <article class="how-card">
            <span class="how-num">0${n}</span>
            <h3>${t(`how${n}t`)}</h3>
            <p>${t(`how${n}d`)}</p>
          </article>`
          )
          .join('')}
      </div>
    </section>

    <section id="booths" class="container section">
      <h2>${t('boothsTitle')}</h2>
      ${boothCards('host')}
    </section>

    <section id="faq" class="container section faq">
      <h2>${t('faqTitle')}</h2>
      ${[1, 2, 3]
        .map((n) => `<details><summary>${t(`faq${n}q`)}</summary><p>${t(`faq${n}a`)}</p></details>`)
        .join('')}
    </section>
  </main>

  <footer class="footer container">
    ${logo()}
    <span>© ${new Date().getFullYear()} · ${t('footer')}</span>
  </footer>`;
}

function boothView() {
  return `
  <div class="corner">${langBtn()}</div>
  <main class="center-view">
    <h1 class="title">${t('pickBooth')}</h1>
    <p class="sub">${t('pickBoothDesc')}</p>
    ${nameField()}
    ${boothCards(S.mode)}
    <button class="link-btn" data-action="home" id="btn-back">${ic.back}${t('back')}</button>
  </main>`;
}

function joinView() {
  const code = S.joinCode.padEnd(5, ' ');
  return `
  <div class="corner">${langBtn()}</div>
  <main class="center-view">
    <h1 class="title">${t('joinTitle')}</h1>
    <p class="sub">${t('joinDesc')}</p>
    <form class="join-form" id="join-form" autocomplete="off">
      <div class="code-inputs">
        ${[...code]
          .map(
            (c, i) =>
              `<input class="code-box" id="code-${i}" data-i="${i}" maxlength="1" inputmode="text" autocapitalize="characters" value="${c.trim()}" aria-label="Code letter ${i + 1}" />`
          )
          .join('')}
      </div>
      ${nameField()}
      <p class="error" id="join-error">${esc(S.joinError)}</p>
      <button class="btn primary big" type="submit" id="btn-join-submit" ${S.joining ? 'disabled' : ''}>
        ${S.joining ? `<span class="spinner sm"></span>${t('joining')}` : t('join')}
      </button>
    </form>
    <button class="link-btn" data-action="home" id="btn-back">${ic.back}${t('back')}</button>
  </main>`;
}

function loadingView() {
  return `<main class="center-view"><div class="spinner"></div><p class="sub">${t('preparing')}</p></main>`;
}

function lobbyView() {
  const code = S.room.code;
  return `
  <div class="corner">${langBtn()}</div>
  <main class="center-view lobby">
    <h1 class="title display">${t('sendCode')}</h1>
    <p class="sub">${t('sendCodeDesc')}</p>
    <div class="glass code-card">
      <div class="code-tiles">
        ${[...code].map((c, i) => `<span class="tile" style="--i:${i}">${c}</span>`).join('')}
      </div>
      <div class="row">
        <button class="btn ghost" data-action="copy-link" id="btn-copy">${ic.copy}<span>${t('copyLink')}</span></button>
        <button class="btn ghost" data-action="share-link" id="btn-share">${t('share')}${ic.share}</button>
      </div>
      <div class="status"><span class="pulse"></span><span id="lobby-status"></span></div>
    </div>
    <div class="stage lobby-stage" id="stage"></div>
    <div class="lobby-actions" id="lobby-actions"></div>
  </main>`;
}

/* ---------- session ---------- */

function sessionView() {
  const s = st();
  const phase = s.phase;
  const idx = PHASES.indexOf(phase);
  const hasMic = !S.room.solo && S.stream?.getAudioTracks().length;
  const micOn = hasMic && S.stream.getAudioTracks()[0].enabled;
  return `
  <div class="session phase-${phase}">
    <header class="topbar">
      <div class="tb-left">
        ${idx > 0 && phase !== 'done' ? `<button class="text-btn" data-action="back" id="btn-phase-back">${ic.back}${t('back')}</button>` : ''}
        <button class="icon-btn" data-action="leave" id="btn-leave" title="${t('leave')}">${ic.x}</button>
      </div>
      <ol class="stepper">
        ${PHASES.map(
          (p, i) =>
            `<li class="${i < idx ? 'past' : ''} ${i === idx ? 'now' : ''}"><i></i>${t('step' + p[0].toUpperCase() + p.slice(1))}</li>`
        ).join('')}
      </ol>
      <div class="tb-right">
        ${!S.room.solo ? `<span class="code-badge" title="Room code">${S.room.code}</span>` : ''}
        ${hasMic ? `<button class="icon-btn ${micOn ? '' : 'off'}" data-action="mic" id="btn-mic" title="${t('mic')}">${micOn ? ic.mic : ic.micOff}</button>` : ''}
        ${langBtn('sm')}
      </div>
    </header>
    <main class="phase" id="phase">${phaseView(phase)}</main>
    ${phase !== 'shoot' && !S.room.solo ? '<div class="dock" id="stage"></div>' : ''}
  </div>`;
}

function phaseView(phase) {
  const s = st();
  switch (phase) {
    case 'frame': {
      const curCat = S.activeFrameCat || 'patterns';
      const framesInCat = FRAME_TEMPLATES.filter((f) => f.cat === curCat);
      const activeFrameId = s.frameId || 'hearts';

      return `
      <section class="phase-inner frame-picker-view">
        <div class="frame-picker-header">
          <h1 class="title display">${t('pickFrame')}</h1>
          <p class="sub">${t('pickFrameDesc')}</p>
        </div>

        <!-- Category tabs with badges -->
        <div class="frame-cats-wrap">
          <div class="frame-cats">
            ${FRAME_CATEGORIES.map(
              (cat) => `
              <button class="frame-cat-pill ${curCat === cat.id ? 'active' : ''}" data-action="frame-cat" data-cat="${cat.id}" id="cat-${cat.id}">
                <span class="cat-icon">${cat.icon}</span>
                <span class="cat-name">${cat.label}</span>
                ${cat.badge ? `<span class="cat-badge ${cat.badge.includes('NEW') ? 'badge-new' : ''}">${cat.badge}</span>` : ''}
              </button>`
            ).join('')}
          </div>
        </div>

        <!-- Format switch pills -->
        <div class="layout-switch-bar">
          <span class="layout-switch-label">Format:</span>
          ${LAYOUT_IDS.map(
            (id) => `
            <button class="layout-pill ${s.layout === id ? 'selected' : ''}" data-action="layout" data-layout="${id}" id="layout-${id}">
              ${t('l' + id)}
            </button>`
          ).join('')}
        </div>

        <!-- Grid of decorative frames -->
        <div class="frame-cards-grid layout-${s.layout}">
          ${framesInCat.map(
            (f) => `
            <button class="frame-card-item ${activeFrameId === f.id ? 'selected' : ''}" data-action="pick-frame" data-frame="${f.id}" id="frame-card-${f.id}">
              <div class="frame-canvas-holder">
                <canvas class="frame-card-canvas" data-frame-id="${f.id}" data-layout="${s.layout}"></canvas>
                <span class="frame-check-badge">✓</span>
              </div>
              <span class="frame-card-title">${f.name}</span>
            </button>`
          ).join('')}
        </div>

        <button class="ticket" data-action="goto" data-phase="shoot" id="btn-next"><span>${t('next')}</span></button>
      </section>`;
    }

    case 'shoot': {
      const total = S.shooting ? S.shots.length : shotsOf(s.layout);
      return `
      <section class="phase-inner shoot">
        <div class="shoot-head">
          <h1 class="title display">${t('shootTitle')}</h1>
          <p class="sub"><b>${total}</b> ${t('shootDesc')}</p>
        </div>
        <div class="stage-wrap">
          <div class="stage" id="stage"></div>
          <div class="countdown" id="countdown"></div>
          <div class="flash" id="flash"></div>
        </div>
        <div class="shoot-bar">
          <div class="progress" id="progress"></div>
          <button class="btn primary big" data-action="shoot" id="btn-shoot">${ic.cam}<span>${t('startShooting')}</span></button>
        </div>
        <div class="thumbs" id="thumbs"></div>
      </section>`;
    }

    case 'pick':
      return `
      <section class="phase-inner split">
        <div class="split-main">
          <h1 class="title display">${t('pickTitle')}</h1>
          <p class="sub">${t('pickDesc', { n: slotsOf(s.layout) })}</p>
          <div class="pick-grid ratio-${s.layout}" id="pick-grid">
            ${S.shots
              .map(
                (_, i) =>
                  `<button class="pick-item" data-action="pick" data-i="${i}" id="pick-${i}"><canvas></canvas><span class="badge"></span></button>`
              )
              .join('')}
          </div>
          <div class="row">
            <button class="btn ghost" data-action="goto" data-phase="shoot" id="btn-retake">${ic.again}${t('retake')}</button>
            <button class="ticket" data-action="goto" data-phase="style" id="btn-next"><span>${t('next')}</span></button>
          </div>
        </div>
        <aside class="preview-col">
          <div class="strip-preview-wrap layout-${s.layout}">
            <canvas id="preview" class="strip-preview layout-${s.layout}"></canvas>
            <div class="live-strip-overlay ${S.liveMode ? 'active' : ''}" id="live-overlay"></div>
            ${S.liveClips.some(Boolean) ? `
              <button class="live-pill-toggle ${S.liveMode ? 'active' : ''}" data-action="toggle-live" title="${t('liveHelp')}">
                <span class="live-dot"></span> <b>LIVE</b>
              </button>` : ''}
          </div>
        </aside>
      </section>`;

    case 'style': {
      const th = THEMES[s.theme];
      const curFrame = getFrame(s.frameId || 'hearts');
      const curCat = S.styleFrameCat || 'all';
      const filteredFrames = curCat === 'all'
        ? FRAME_TEMPLATES
        : FRAME_TEMPLATES.filter((f) => f.cat === curCat);

      return `
      <section class="phase-inner split reverse">
        <aside class="preview-col">
          <div class="strip-preview-wrap layout-${s.layout}">
            <canvas id="preview" class="strip-preview layout-${s.layout}"></canvas>
            <div class="live-strip-overlay ${S.liveMode ? 'active' : ''}" id="live-overlay"></div>
            ${S.liveClips.some(Boolean) ? `
              <button class="live-pill-toggle ${S.liveMode ? 'active' : ''}" data-action="toggle-live" title="${t('liveHelp')}">
                <span class="live-dot"></span> <b>LIVE</b>
              </button>` : ''}
          </div>
        </aside>

        <div class="split-main style-panel glass">
          <div class="style-panel-head">
            <h1 class="title display">${t('styleTitle')}</h1>
            ${S.liveClips.some(Boolean) ? `
              <button class="live-pill-toggle sm ${S.liveMode ? 'active' : ''}" data-action="toggle-live">
                <span class="live-dot"></span> <b>LIVE PHOTO</b>
              </button>
            ` : ''}
          </div>

          <!-- DETAILED FRAME STUDIO -->
          <div class="field style-frame-studio">
            <div class="style-field-head">
              <label class="field-title">${t('pickFrame')}: <b id="style-frame-name">${curFrame.name}</b></label>
            </div>

            <!-- Mini category tabs -->
            <div class="style-cats-wrap">
              <div class="style-cats">
                <button class="style-cat-pill ${curCat === 'all' ? 'active' : ''}" data-action="style-cat" data-cat="all">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                  <span>All (37)</span>
                </button>
                ${FRAME_CATEGORIES.map(
                  (c) => `
                  <button class="style-cat-pill ${curCat === c.id ? 'active' : ''}" data-action="style-cat" data-cat="${c.id}">
                    <span>${c.icon}</span> <span>${c.label}</span>
                  </button>`
                ).join('')}
              </div>
            </div>

            <!-- Scrollable Frame Cards with Live Canvas Previews -->
            <div class="style-frame-cards-scroll" id="style-frame-cards">
              ${filteredFrames.map(
                (f) => `
                <button class="style-frame-card ${s.frameId === f.id ? 'selected' : ''}" data-action="pick-frame" data-frame="${f.id}" title="${f.name}">
                  <div class="style-frame-canvas-holder">
                    <canvas class="style-frame-card-canvas" data-frame-id="${f.id}" data-layout="${s.layout}"></canvas>
                    <span class="style-card-check">✓</span>
                  </div>
                  <span class="style-frame-card-name">${f.name}</span>
                </button>`
              ).join('')}
            </div>
          </div>

          <!-- Layout switcher in Style -->
          <div class="field">
            <label>${t('pickSize')}</label>
            <div class="chip-row">
              ${LAYOUT_IDS.map(
                (id) => `
                <button class="chip ${s.layout === id ? 'active' : ''}" data-action="layout" data-layout="${id}">
                  ${t('l' + id)}
                </button>`
              ).join('')}
            </div>
          </div>

          <!-- Filter selection -->
          <div class="field">
            <label>${t('filter')}</label>
            <div class="chip-row">
              ${FILTERS.map(
                (f) =>
                  `<button class="chip ${s.filter === f.id ? 'active' : ''}" data-action="filter" data-filter="${f.id}" id="filter-${f.id}"><i class="fdot" style="filter:${f.css}"></i>${t(f.label)}</button>`
              ).join('')}
            </div>
          </div>

          <!-- Frame color palette -->
          <div class="field">
            <label>${t('frameColor')}</label>
            <div class="swatches">
              ${th.frameColors
                .map(
                  (c, i) =>
                    `<button class="swatch ${s.frameColor === c ? 'active' : ''}" style="--c:${c}" data-action="color" data-color="${c}" id="swatch-${i}" aria-label="${c}"></button>`
                )
                .join('')}
              <label class="swatch custom" title="Custom"><input type="color" id="color-input" value="${s.frameColor}" /></label>
            </div>
          </div>

          <!-- Caption -->
          <div class="field">
            <label for="caption-input">${t('caption')}</label>
            <input class="input" id="caption-input" maxlength="40" placeholder="${t('captionPh')}" value="${esc(s.caption)}" />
          </div>

          <!-- Show date toggle -->
          <label class="toggle">
            <input type="checkbox" id="date-toggle" ${s.showDate ? 'checked' : ''} />
            <span class="track"></span>${t('showDate')}
          </label>

          <button class="ticket" data-action="goto" data-phase="done" id="btn-next"><span>${t('next')}</span></button>
        </div>
      </section>`;
    }

    case 'done':
      return `
      <section class="phase-inner done">
        <div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <div class="done-art">
          <div class="spinner"></div>
          <div class="strip-preview-wrap layout-${s.layout}">
            <img id="final-img" class="final-strip layout-${s.layout}" alt="Your photobooth strip" />
            <div class="live-strip-overlay ${S.liveMode ? 'active' : ''}" id="live-overlay"></div>
            ${S.liveClips.some(Boolean) ? `
              <button class="live-pill-toggle ${S.liveMode ? 'active' : ''}" data-action="toggle-live" title="${t('liveHelp')}">
                <span class="live-dot"></span> <b>LIVE</b>
              </button>` : ''}
          </div>
        </div>
        <div class="done-copy">
          <h1 class="title display">${t('doneTitle')}</h1>
          <p class="sub">${S.room.solo ? '' : t('doneDesc')}</p>
          <div class="done-download-buttons">
            <button class="btn primary big" data-action="download" id="btn-download">${ic.download}${t('download')}</button>
            ${S.liveClips.some(Boolean) ? `
              <button class="btn secondary big live-dl-btn" data-action="download-live" id="btn-download-live">${ic.cam}<span>${t('downloadLive')}</span></button>
            ` : ''}
          </div>
          <div class="row">
            <button class="btn ghost" data-action="share-img" id="btn-share-img">${t('share')}${ic.share}</button>
            <button class="btn ghost" data-action="again" id="btn-again">${ic.again}${t('takeAgain')}</button>
          </div>
          <button class="link-btn" data-action="leave" id="btn-leave-done">${t('leave')}</button>
        </div>
      </section>`;
  }
  return '';
}

/* =========================================================
   Rendering
   ========================================================= */
const views = { home: homeView, booth: boothView, join: joinView, loading: loadingView, lobby: lobbyView, session: sessionView };

function render() {
  const inRoom = ['lobby', 'session'].includes(S.view) && S.room;
  document.body.dataset.theme = inRoom ? st().theme : 'classic';
  document.body.dataset.view = S.view;
  app.innerHTML = views[S.view]();
  afterRender();
}

function afterRender() {
  if (S.view === 'lobby') updateLobby();
  if (S.view === 'session') {
    S.lastPhase = st().phase;
    renderStage();
    updatePhase();
  }
  if (S.view === 'join') {
    const first = [...document.querySelectorAll('.code-box')].find((b) => !b.value) || document.getElementById('code-4');
    first?.focus();
  }
}

function go(view) {
  S.view = view;
  render();
  window.scrollTo(0, 0);
}

/* ---------- videos / stage ---------- */

function ensureVideo(id, stream, local = false) {
  let v = videos.get(id);
  if (!v) {
    v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    if (local) v.muted = true;
    videos.set(id, v);
  }
  if (v.srcObject !== stream) v.srcObject = stream;
  v.play().catch(() => {});
  return v;
}

function renderStage() {
  const el = document.getElementById('stage');
  if (!el || !S.room) return;
  const members = S.room.members;
  const isLobby = S.view === 'lobby';
  el.dataset.count = members.length;
  el.innerHTML = '';
  members.forEach((m) => {
    const tile = document.createElement('div');
    tile.className = 'tile-v' + (m.id === S.room.myId ? ' me' : '');
    const v = videos.get(m.id);
    if (v) {
      tile.append(v);
      v.play().catch(() => {});
    } else tile.innerHTML = '<div class="spinner sm"></div>';
    const label = document.createElement('span');
    label.className = 'tile-name';
    label.textContent = `${m.name}${m.id === S.room.myId ? ` (${t('you')})` : ''}${m.host && !S.room.solo ? ' ★' : ''}`;
    tile.append(label);
    el.append(tile);
  });
  if (isLobby) {
    for (let i = members.length; i < MAX_MEMBERS; i++) {
      const empty = document.createElement('div');
      empty.className = 'tile-v empty';
      empty.innerHTML = ic.plus;
      el.append(empty);
    }
  }
}

/* ---------- lobby ---------- */

function updateLobby() {
  if (S.view !== 'lobby' || !S.room) return;
  const n = S.room.members.length;
  const status = document.getElementById('lobby-status');
  if (status) status.textContent = n > 1 ? `${n} / ${MAX_MEMBERS} ${t('inRoom')}` : t('waiting');
  document.querySelector('.status')?.classList.toggle('ok', n > 1);
  const actions = document.getElementById('lobby-actions');
  if (actions) {
    actions.innerHTML = S.room.isHost
      ? `<button class="btn primary big" data-action="start-session" id="btn-start-session">${ic.play}${n > 1 ? t('startSession') : t('aloneInstead')}</button>
         <button class="link-btn" data-action="leave" id="btn-leave">${t('leave')}</button>`
      : `<p class="sub"><span class="spinner sm"></span> ${t('waitingHost')}</p>
         <button class="link-btn" data-action="leave" id="btn-leave">${t('leave')}</button>`;
  }
  renderStage();
}

/* ---------- phase updates (partial, keeps focus & videos) ---------- */

function renderFrameThumbnails() {
  const canvases = document.querySelectorAll('.frame-card-canvas');
  if (!canvases.length) return;
  const layout = st().layout || '4cut';
  canvases.forEach((canvas) => {
    try {
      const fid = canvas.dataset.frameId;
      if (canvas.dataset.renderedLayout === layout && canvas.dataset.renderedFrame === fid) return;
      canvas.dataset.renderedLayout = layout;
      canvas.dataset.renderedFrame = fid;
      renderFramePreview(canvas, fid, layout, 130);
    } catch (e) {
      console.error('Thumbnail render error:', e);
    }
  });
}

function updatePhase() {
  const s = st();
  switch (s.phase) {
    case 'frame': {
      document.querySelectorAll('.layout-pill').forEach((c) => c.classList.toggle('selected', c.dataset.layout === s.layout));
      document.querySelectorAll('.frame-cat-pill').forEach((c) => c.classList.toggle('active', c.dataset.cat === (S.activeFrameCat || 'patterns')));
      document.querySelectorAll('.frame-card-item').forEach((c) => c.classList.toggle('selected', c.dataset.frame === (s.frameId || 'hearts')));
      renderFrameThumbnails();
      break;
    }
    case 'shoot':
      updateShoot();
      break;
    case 'pick':
      updatePick();
      break;
    case 'style':
      updateStyle();
      break;
    case 'done':
      drawFinal();
      break;
  }
}

const shotPhotos = (i) => S.participants.map((p) => ({ name: p.name, src: S.shots[i]?.[p.id] || null }));
const shotReady = (i) => S.participants.length && S.participants.every((p) => p.id in (S.shots[i] || {}));

function updateShoot() {
  const total = S.shooting || S.shots.length ? S.shots.length : shotsOf(st().layout);
  const done = S.shots.filter((_, i) => shotReady(i)).length;
  const prog = document.getElementById('progress');
  if (prog) {
    prog.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('') +
      `<span>${t('shotOf')} ${Math.min(done + (S.shooting ? 1 : 0), total)} / ${total}</span>`;
  }
  const btn = document.getElementById('btn-shoot');
  if (btn) {
    btn.disabled = S.shooting;
    btn.querySelector('span').textContent = S.shooting ? t('shooting') : t('startShooting');
  }
  const thumbs = document.getElementById('thumbs');
  if (thumbs) {
    const ratio = LAYOUTS[st().layout].cellRatio;
    S.shots.forEach((shot, i) => {
      const count = Object.keys(shot).length;
      if (!count) return;
      let c = thumbs.querySelector(`canvas[data-i="${i}"]`);
      if (!c) {
        c = document.createElement('canvas');
        c.dataset.i = i;
        c.className = 'thumb pop-in';
        thumbs.append(c);
      }
      if (c.dataset.n !== String(count)) {
        c.dataset.n = count;
        renderShotThumb(c, shotPhotos(i), 'none', ratio, 240);
      }
    });
  }
}

function updatePick() {
  const s = st();
  const ratio = LAYOUTS[s.layout].cellRatio;
  document.querySelectorAll('.pick-item').forEach((btn) => {
    const i = +btn.dataset.i;
    const c = btn.querySelector('canvas');
    if (!c.dataset.done) {
      c.dataset.done = '1';
      renderShotThumb(c, shotPhotos(i), s.filter, ratio, 420);
    }
    const order = s.picks.indexOf(i);
    btn.classList.toggle('selected', order >= 0);
    btn.querySelector('.badge').textContent = order >= 0 ? order + 1 : '';
  });
  const next = document.getElementById('btn-next');
  if (next) next.disabled = s.picks.length !== slotsOf(s.layout);
  drawPreview();
}

function renderStyleFrameThumbnails() {
  const canvases = document.querySelectorAll('.style-frame-card-canvas');
  if (!canvases.length) return;
  const layout = st().layout || '4cut';
  canvases.forEach((canvas) => {
    try {
      const fid = canvas.dataset.frameId;
      if (canvas.dataset.renderedLayout === layout && canvas.dataset.renderedFrame === fid) return;
      canvas.dataset.renderedLayout = layout;
      canvas.dataset.renderedFrame = fid;
      renderFramePreview(canvas, fid, layout, 85);
    } catch (e) {
      console.error('Style thumbnail error:', e);
    }
  });
}

function updateLiveOverlay() {
  const overlay = document.getElementById('live-overlay');
  const btns = document.querySelectorAll('.live-pill-toggle');
  btns.forEach((btn) => btn.classList.toggle('active', !!S.liveMode));
  if (!overlay) return;
  overlay.classList.toggle('active', !!S.liveMode);
  if (!S.liveMode) {
    overlay.innerHTML = '';
    return;
  }
  const s = st();
  const slots = slotsOf(s.layout);
  const { width: W, height: H, cellW, cellH, L } = stripSize(s.layout);
  const filterObj = FILTERS.find((f) => f.id === s.filter);
  const filterCss = filterObj?.css || 'none';

  overlay.innerHTML = '';
  for (let k = 0; k < slots; k++) {
    const shotIdx = s.picks?.[k];
    const clipUrl = shotIdx != null ? S.liveClips[shotIdx] : null;
    const col = k % L.cols;
    const row = Math.floor(k / L.cols);
    const x = L.pad + col * (cellW + L.gap);
    const y = L.pad + row * (cellH + L.gap);

    const slotDiv = document.createElement('div');
    slotDiv.className = 'live-slot';
    slotDiv.style.left = `${(x / W) * 100}%`;
    slotDiv.style.top = `${(y / H) * 100}%`;
    slotDiv.style.width = `${(cellW / W) * 100}%`;
    slotDiv.style.height = `${(cellH / H) * 100}%`;
    slotDiv.style.borderRadius = `${(Math.round(W * 0.015) / W) * 100}%`;

    if (clipUrl) {
      const v = document.createElement('video');
      v.src = clipUrl;
      v.autoplay = true;
      v.loop = true;
      v.muted = true;
      v.setAttribute('playsinline', '');
      v.style.filter = filterCss;
      slotDiv.append(v);
      v.play().catch(() => {});
    }
    overlay.append(slotDiv);
  }
}

function updateStyle() {
  const s = st();
  document.querySelectorAll('[data-action="filter"]').forEach((b) => b.classList.toggle('active', b.dataset.filter === s.filter));
  document.querySelectorAll('[data-action="color"]').forEach((b) => b.classList.toggle('active', b.dataset.color === s.frameColor));
  document.querySelectorAll('.style-frame-card').forEach((b) => b.classList.toggle('selected', b.dataset.frame === (s.frameId || 'hearts')));
  document.querySelectorAll('.style-cat-pill').forEach((b) => b.classList.toggle('active', b.dataset.cat === (S.styleFrameCat || 'all')));
  document.querySelectorAll('[data-action="layout"]').forEach((b) => b.classList.toggle('active', b.dataset.layout === s.layout));

  const nameEl = document.getElementById('style-frame-name');
  if (nameEl) {
    const curFrame = getFrame(s.frameId || 'hearts');
    nameEl.textContent = curFrame?.name || '';
  }

  const cap = document.getElementById('caption-input');
  if (cap && document.activeElement !== cap) cap.value = s.caption || '';
  const dt = document.getElementById('date-toggle');
  if (dt) dt.checked = !!s.showDate;
  const ci = document.getElementById('color-input');
  if (ci && document.activeElement !== ci) ci.value = s.frameColor;
  
  renderStyleFrameThumbnails();
  drawPreview();
  updateLiveOverlay();
}

function stripOpts() {
  const s = st();
  const slots = slotsOf(s.layout);
  const cells = Array.from({ length: slots }, (_, k) => {
    const i = s.picks?.[k];
    return i != null && S.shots[i] ? shotPhotos(i) : null;
  });
  return {
    layoutId: s.layout,
    themeId: s.theme,
    frameId: s.frameId || 'hearts',
    cells,
    filter: s.filter,
    frameColor: s.frameColor,
    caption: s.caption,
    showDate: s.showDate,
  };
}

let previewToken = 0;
async function drawPreview() {
  const el = document.getElementById('preview');
  if (!el) return;
  const tok = ++previewToken;
  const off = document.createElement('canvas');
  await renderStrip(off, stripOpts());
  if (tok !== previewToken || !document.body.contains(el)) return;
  el.width = off.width;
  el.height = off.height;
  el.getContext('2d').drawImage(off, 0, 0);
}

let finalToken = 0;
async function drawFinal() {
  const img = document.getElementById('final-img');
  if (!img) return;
  const tok = ++finalToken;
  const off = document.createElement('canvas');
  await renderStrip(off, stripOpts());
  const blob = await new Promise((r) => off.toBlob(r, 'image/png'));
  if (tok !== finalToken) return;
  S.finalBlob = blob;
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  img.onload = () => {
    img.parentElement?.classList.add('ready');
    updateLiveOverlay();
  };
}

/* =========================================================
   Room flows
   ========================================================= */
function initialState(theme, phase) {
  const th = THEMES[theme];
  return {
    phase,
    theme,
    layout: '4cut',
    frameId: 'hearts',
    picks: [],
    filter: th.defaultFilter,
    frameColor: th.frameColors[0],
    caption: '',
    showDate: true,
  };
}

function saveName() {
  const input = document.getElementById('name-input');
  if (input) S.name = input.value.trim();
  localStorage.setItem('phoboots-name', S.name);
}

async function startHost(theme) {
  saveName();
  go('loading');
  try {
    S.stream = await getCamera(true);
  } catch {
    toast(t('camError'));
    return go('home');
  }
  try {
    const room = new Room({ name: S.name || 'Host', stream: S.stream });
    await room.create(initialState(theme, 'lobby'));
    attachRoom(room);
    go('lobby');
  } catch (e) {
    console.error(e);
    stopStream(S.stream);
    S.stream = null;
    toast(t('netError'));
    go('home');
  }
}

async function startSolo(theme) {
  saveName();
  go('loading');
  try {
    S.stream = await getCamera(false);
  } catch {
    toast(t('camError'));
    return go('home');
  }
  const room = new Room({ name: S.name || 'Me', stream: S.stream, solo: true });
  await room.create(initialState(theme, 'frame'));
  attachRoom(room);
  go('session');
}

async function joinRoom(code) {
  saveName();
  S.joinCode = code;
  S.joinError = '';
  S.joining = true;
  render();
  try {
    S.stream = await getCamera(true);
  } catch {
    S.joining = false;
    S.joinError = t('camError');
    return render();
  }
  const room = new Room({ name: S.name || 'Guest', stream: S.stream });
  try {
    await room.join(code);
  } catch (e) {
    stopStream(S.stream);
    S.stream = null;
    S.joining = false;
    S.joinError = { notfound: t('roomNotFound'), full: t('roomFull'), busy: t('roomBusy') }[e.message] || t('netError');
    return render();
  }
  S.joining = false;
  attachRoom(room);
  go(room.state.phase === 'lobby' ? 'lobby' : 'session');
}

function attachRoom(room) {
  S.room = room;
  S.shots = [];
  S.participants = [];
  S.shooting = false;
  ensureVideo(room.myId, S.stream, true);
  room.streams.forEach((stream, id) => ensureVideo(id, stream));

  room.on('stream', (id, stream) => {
    ensureVideo(id, stream);
    renderStage();
  });
  room.on('stream-gone', (id) => {
    const v = videos.get(id);
    if (v) v.srcObject = null;
    videos.delete(id);
    renderStage();
  });
  room.on('members', () => {
    if (S.view === 'lobby') updateLobby();
    else renderStage();
  });
  room.on('joined', (m) => m.id !== room.myId && toast(`${m.name} ${t('joined')}`));
  room.on('left', (m) => toast(`${m.name} ${t('left')}`));
  room.on('state', onState);
  room.on('event', onEvent);
  room.on('host-left', () => {
    toast(t('hostLeft'));
    leave();
  });
  room.on('net-error', () => toast(t('netError')));
}

function onState() {
  const phase = st().phase;
  if (S.view === 'lobby' && phase !== 'lobby') return go('session');
  if (S.view !== 'session') return;
  if (phase !== S.lastPhase) {
    if (phase !== 'shoot') S.shooting = false;
    if (phase === 'frame') {
      S.shots = [];
      S.participants = [];
      S.liveClips = [];
      S.liveBlobs = [];
      clearImgCache();
    }
    render();
  } else updatePhase();
}

function onEvent(ev, data, from) {
  if (ev === 'shoot-start') {
    S.shots = Array.from({ length: data.total }, () => ({}));
    S.participants = data.participants;
    S.shooting = true;
    S.liveClips = [];
    S.liveBlobs = [];
    clearImgCache();
    const thumbs = document.getElementById('thumbs');
    if (thumbs) thumbs.innerHTML = '';
    const sub = document.querySelector('.shoot-head .sub b');
    if (sub) sub.textContent = data.total;
    updateShoot();
  } else if (ev === 'countdown') {
    runCountdown(data);
  } else if (ev === 'photo') {
    if (!S.shots[data.i]) return;
    S.shots[data.i][from] = data.src;
    if (st().phase === 'shoot') updateShoot();
  } else if (ev === 'request-shoot' && S.room.isHost) {
    hostRunShoot();
  }
}

async function hostRunShoot() {
  const room = S.room;
  if (!room || S.shooting || st().phase !== 'shoot') return;
  const total = shotsOf(st().layout);
  const participants = room.members.map((m) => ({ id: m.id, name: m.name }));
  room.send('shoot-start', { total, participants });
  await sleep(600);
  for (let i = 0; i < total; i++) {
    if (room.closed || st().phase !== 'shoot') return;
    room.send('countdown', { i, secs: 3 });
    await sleep(3000 + 1500);
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && !S.shots.every((_, i) => shotReady(i))) await sleep(200);
  if (room.closed || st().phase !== 'shoot') return;
  const slots = slotsOf(st().layout);
  room.setState({ phase: 'pick', picks: Array.from({ length: slots }, (_, k) => k) });
}

async function runCountdown({ i, secs }) {
  const get = () => document.getElementById('countdown');

  // Trigger live photo video recording
  let livePromise = null;
  if (S.stream && isLivePhotoSupported()) {
    livePromise = recordLiveClip(S.stream, (secs + 0.8) * 1000);
  }

  for (let s = secs; s > 0; s--) {
    const el = get();
    if (el) {
      el.textContent = s;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    beep(s === 1 ? 990 : 660, 0.09);
    await sleep(1000);
  }
  if (get()) get().textContent = '';
  if (!S.room || S.room.closed) return;
  const src = captureFrame(videos.get(S.room.myId));
  shutter();
  const fl = document.getElementById('flash');
  if (fl) {
    fl.classList.remove('go');
    void fl.offsetWidth;
    fl.classList.add('go');
  }
  S.room.send('photo', { i, src });

  if (livePromise) {
    livePromise.then((res) => {
      if (res && res.url) {
        S.liveClips[i] = res.url;
        S.liveBlobs[i] = res.blob;
        S.liveMode = true;
      }
    });
  }
}

function gotoPhase(phase) {
  const s = st();
  if (phase === 'style' && s.picks.length !== slotsOf(s.layout)) return;
  if (phase === 'shoot' && S.shooting) return;
  S.room.setState({ phase });
}

function leave() {
  try {
    S.room?.leave();
  } catch {
    /* ignore */
  }
  stopStream(S.stream);
  videos.forEach((v) => (v.srcObject = null));
  videos.clear();
  Object.assign(S, { room: null, stream: null, shots: [], liveClips: [], liveBlobs: [], participants: [], shooting: false, finalBlob: null });
  go('home');
}

/* =========================================================
   Event delegation
   ========================================================= */
const actions = {
  home: (el, e) => {
    e.preventDefault();
    if (S.room) leave();
    else go('home');
  },
  lang: () => {
    setLang(getLang() === 'id' ? 'en' : 'id');
    if (S.view === 'session') {
      render();
    } else render();
  },
  start: () => {
    S.mode = 'host';
    go('booth');
  },
  solo: () => {
    S.mode = 'solo';
    go('booth');
  },
  join: () => {
    S.joinError = '';
    go('join');
  },
  'pick-theme': (el) => (el.dataset.mode === 'solo' ? startSolo(el.dataset.theme) : startHost(el.dataset.theme)),
  'copy-link': async (el) => {
    try {
      await navigator.clipboard.writeText(roomLink());
    } catch {
      prompt('Link', roomLink());
    }
    const span = el.querySelector('span');
    span.textContent = t('copied');
    setTimeout(() => (span.textContent = t('copyLink')), 1600);
  },
  'share-link': (el) => {
    if (navigator.share) {
      navigator.share({ title: 'Phoboots', text: `Photobooth room: ${S.room.code}`, url: roomLink() }).catch(() => {});
    } else actions['copy-link'](document.getElementById('btn-copy'));
  },
  'start-session': () => S.room.setState({ phase: 'frame' }),
  leave: () => leave(),
  'frame-cat': (el) => {
    S.activeFrameCat = el.dataset.cat;
    render();
  },
  'style-cat': (el) => {
    S.styleFrameCat = el.dataset.cat;
    render();
  },
  'pick-frame': (el) => {
    S.room?.setState({ frameId: el.dataset.frame });
  },
  'toggle-live': () => {
    if (!S.liveClips.some(Boolean)) {
      toast(t('liveHelp'));
      return;
    }
    S.liveMode = !S.liveMode;
    updateLiveOverlay();
  },
  'download-live': async (el) => {
    if (!S.liveClips.some(Boolean)) {
      toast(t('liveHelp'));
      return;
    }
    const origHtml = el.innerHTML;
    el.disabled = true;
    el.innerHTML = `<span class="spinner sm"></span> <span>${t('generatingLive')}</span>`;

    try {
      const s = st();
      const { width: W, height: H, cellW, cellH, L } = stripSize(s.layout);
      const slots = slotsOf(s.layout);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = W;
      offCanvas.height = H;
      const ctx = offCanvas.getContext('2d');

      const vEls = await Promise.all(
        Array.from({ length: slots }, async (_, k) => {
          const shotIdx = s.picks?.[k];
          const clipUrl = shotIdx != null ? S.liveClips[shotIdx] : null;
          if (!clipUrl) return null;
          const v = document.createElement('video');
          v.src = clipUrl;
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          await new Promise((res) => {
            v.onloadeddata = () => res(v);
            v.onerror = () => res(null);
            setTimeout(() => res(v), 900);
          });
          v.currentTime = 0;
          v.play().catch(() => {});
          return v;
        })
      );

      const staticOpts = stripOpts();
      const staticCanvas = document.createElement('canvas');
      await renderStrip(staticCanvas, staticOpts);

      const filterObj = FILTERS.find((f) => f.id === s.filter);
      const radius = s.theme === 'vintage' ? 0 : Math.round(W * 0.015);

      const blob = await recordCanvasVideo(
        offCanvas,
        () => {
          ctx.drawImage(staticCanvas, 0, 0);

          for (let k = 0; k < slots; k++) {
            const v = vEls[k];
            if (!v || v.readyState < 2) continue;
            const col = k % L.cols;
            const row = Math.floor(k / L.cols);
            const x = L.pad + col * (cellW + L.gap);
            const y = L.pad + row * (cellH + L.gap);

            ctx.save();
            roundRect(ctx, x, y, cellW, cellH, radius);
            ctx.clip();
            if (filterObj && filterObj.id !== 'none' && filterObj.css) {
              ctx.filter = filterObj.css;
            }
            drawCover(ctx, v, x, y, cellW, cellH);
            ctx.restore();
          }
        },
        3600,
        30
      );

      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const d = new Date();
        a.download = `phoboots-live-${s.layout}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast('Live Video downloaded!');
      } else {
        toast('Video recording not supported on this device');
      }
    } catch (err) {
      console.error(err);
      toast('Error rendering video');
    } finally {
      el.disabled = false;
      el.innerHTML = origHtml;
    }
  },
  layout: (el) => {
    const newLayout = el.dataset.layout;
    if (st().layout !== newLayout) {
      const slots = slotsOf(newLayout);
      let picks = [...(st().picks || [])];
      if (picks.length > slots) {
        picks = picks.slice(0, slots);
      } else if (picks.length < slots) {
        for (let i = 0; i < S.shots.length && picks.length < slots; i++) {
          if (!picks.includes(i)) picks.push(i);
        }
      }
      S.room.setState({ layout: newLayout, picks });
      if (st().phase === 'style') {
        render();
      }
    }
  },
  goto: (el) => gotoPhase(el.dataset.phase),
  back: () => {
    const i = PHASES.indexOf(st().phase);
    if (i > 0) {
      gotoPhase(PHASES[i - 1] === 'shoot' && st().phase === 'pick' ? 'shoot' : PHASES[i - 1]);
    } else if (i === 0) {
      if (S.room?.solo) {
        leave();
      } else {
        S.room?.setState({ phase: 'lobby' });
      }
    }
  },
  shoot: () => (S.room.isHost ? hostRunShoot() : S.room.send('request-shoot')),
  pick: (el) => {
    const i = +el.dataset.i;
    const s = st();
    const slots = slotsOf(s.layout);
    let picks = [...(s.picks || [])];
    if (picks.includes(i)) picks = picks.filter((x) => x !== i);
    else if (picks.length < slots) picks.push(i);
    else {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      return;
    }
    S.room.setState({ picks });
  },
  filter: (el) => S.room.setState({ filter: el.dataset.filter }),
  color: (el) => S.room.setState({ frameColor: el.dataset.color }),
  mic: () => {
    const track = S.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const btn = document.getElementById('btn-mic');
    btn.classList.toggle('off', !track.enabled);
    btn.innerHTML = track.enabled ? ic.mic : ic.micOff;
  },
  download: () => {
    if (!S.finalBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(S.finalBlob);
    const d = new Date();
    a.download = `phoboots-${st().layout}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${d.getHours()}${d.getMinutes()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  'share-img': async () => {
    if (!S.finalBlob) return;
    const file = new File([S.finalBlob], 'phoboots.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'Phoboots' }).catch(() => {});
    } else actions.download();
  },
  again: () => {
    S.shots = [];
    S.liveClips = [];
    S.liveBlobs = [];
    clearImgCache();
    S.room.setState({ phase: 'frame', picks: [] });
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

const pushCaption = debounce((v) => S.room?.setState({ caption: v }), 250);
const pushColor = debounce((v) => S.room?.setState({ frameColor: v }), 120);

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'name-input') {
    S.name = el.value.trim();
    localStorage.setItem('phoboots-name', S.name);
  } else if (el.id === 'caption-input') {
    pushCaption(el.value);
  } else if (el.id === 'color-input') {
    pushColor(el.value);
  } else if (el.classList.contains('code-box')) {
    const v = el.value.toUpperCase().replace(/[^A-Z]/g, '');
    el.value = v.slice(-1);
    if (v && el.nextElementSibling) el.nextElementSibling.focus();
    S.joinCode = [...document.querySelectorAll('.code-box')].map((b) => b.value).join('');
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'date-toggle') S.room?.setState({ showDate: e.target.checked });
});

app.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el.classList?.contains('code-box') && e.key === 'Backspace' && !el.value && el.previousElementSibling) {
    el.previousElementSibling.focus();
    el.previousElementSibling.value = '';
    e.preventDefault();
  }
});

app.addEventListener('paste', (e) => {
  const el = e.target;
  if (!el.classList?.contains('code-box')) return;
  e.preventDefault();
  const text = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  const boxes = [...document.querySelectorAll('.code-box')];
  boxes.forEach((b, i) => (b.value = text[i] || ''));
  S.joinCode = text;
  boxes[Math.min(text.length, 4)].focus();
});

app.addEventListener('submit', (e) => {
  if (e.target.id !== 'join-form') return;
  e.preventDefault();
  const code = [...document.querySelectorAll('.code-box')].map((b) => b.value).join('');
  if (code.length !== 5) {
    S.joinError = t('roomNotFound');
    document.getElementById('join-error').textContent = S.joinError;
    return;
  }
  joinRoom(code);
});

window.addEventListener('beforeunload', () => S.room?.leave());

/* =========================================================
   Boot
   ========================================================= */
const params = new URLSearchParams(location.search);
const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
if (roomParam) {
  S.joinCode = roomParam;
  history.replaceState({}, '', location.pathname);
  S.view = 'join';
}
render();
