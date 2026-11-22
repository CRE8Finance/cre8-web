// Landing 第一幕：照滑動距離推近建築、打開大門、白光，最後落在大廳和文案。
// 全部依捲動位置計算，不播影片；往回滑就倒退。
// 門外這層用 canvas 畫：放大十幾倍時只畫螢幕看得到的部分，不會像 DOM 圖層那樣缺塊。
(() => {
  const DOOR = { cx: 0.5, cy: (974 + 1799) / 2 / 2160, h: (1799 - 974) / 2160 };
  // 門洞與門片在 16:9 場景裡的位置（比例）
  const OP = { x: .42734, y: .45093, w: .14531, h: .38194 };
  const PERSP = 2400, PO = { x: .5, y: .64 };         // 透視距離與消失點
  const $ = id => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeIn = t => t * t * t;
  const load = src => { const i = new Image(); i.decoding = 'async'; i.src = src; i.onload = () => request(); return i; };
  const img = { ext: load('assets/bank-ext.webp'), l: load('assets/door-l.webp'), r: load('assets/door-r.webp') };
  let el, ctx, W, H, vw, vh, k, ticking = false;

  function size() {
    vw = el.stick.clientWidth; vh = el.stick.clientHeight;
    W = Math.max(vw, vh * 16 / 9); H = W * 9 / 16;
    k = Math.min(devicePixelRatio || 1, 2);
    el.cv.width = Math.round(vw * k); el.cv.height = Math.round(vh * k);
    draw();
  }
  function request() { if (!ticking && el) { ticking = true; requestAnimationFrame(draw); } }

  // 一片門：hinge 是轉軸在場景裡的 x，dir=1 往右延伸（左門）、-1 往左（右門）
  function leaf(im, hinge, dir, ang) {
    if (!im.complete || !im.naturalWidth) return;
    const lw = OP.w / 2 * W, top = OP.y * H, lh = OP.h * H, px = PO.x * W, py = PO.y * H;
    const N = 40, sw = im.naturalWidth / N, sin = Math.sin(ang), cos = Math.cos(ang);
    const at = u => { const f = PERSP / (PERSP + u * sin); return [px + (hinge + dir * u * cos - px) * f, f]; };
    for (let i = 0; i < N; i++) {
      const u0 = lw * i / N, u1 = lw * (i + 1) / N;
      const x0 = at(u0)[0], x1 = at(u1)[0], f = at((u0 + u1) / 2)[1];
      const sx = dir > 0 ? i * sw : (N - 1 - i) * sw;
      const dx = Math.min(x0, x1), dw = Math.abs(x1 - x0) + .6;
      ctx.drawImage(im, sx, 0, sw, im.naturalHeight, dx, py + (top - py) * f, dw, lh * f);
    }
  }

  function draw() {
    ticking = false;
    const r = el.sec.getBoundingClientRect();
    const p = clamp(-r.top / span());
    const s1 = (vh * .78) / (DOOR.h * H);             // 大門約佔畫面八成高
    const a = ease(seg(p, 0, .32));                   // 走到門前
    const o = ease(seg(p, .26, .56));                 // 開門
    const t = easeIn(seg(p, .5, .76));                // 穿過門
    const s = (1 + (s1 - 1) * a) * (1 + 6 * t);
    const L = (vw - W) / 2, T = (vh - H) / 2, Ox = DOOR.cx * W, Oy = DOOR.cy * H;
    const dy = (vh / 2 - (T + Oy)) * Math.max(a, t ? 1 : 0);
    const e = L + Ox - s * Ox, f = T + dy + Oy - s * Oy;  // 場景座標 → 螢幕：x*s + e
    el.cv.style.opacity = p > .78 ? 0 : 1;            // 在全白時才換場，不會閃
    if (p <= .78) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el.cv.width, el.cv.height);
      ctx.setTransform(k * s, 0, 0, k * s, k * e, k * f);
      // 門洞裡的光
      const gx = OP.x * W, gy = OP.y * H, gw = OP.w * W, gh = OP.h * H;
      ctx.save(); ctx.globalAlpha = clamp(.35 + o * .65);
      ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      ctx.translate(gx + gw / 2, gy + gh * .55); ctx.scale(gw * .6, gh * .55);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(255,253,248,.95)'); g.addColorStop(.7, 'rgba(246,236,214,.55)'); g.addColorStop(1, 'rgba(227,181,91,.22)');
      ctx.fillStyle = g; ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
      // 建築：只取螢幕看得到的那一塊
      const ex = img.ext;
      if (ex.complete && ex.naturalWidth) {
        const q = ex.naturalWidth / W;
        const x0 = clamp(-e / s, 0, W), x1 = clamp((vw - e) / s, 0, W);
        const y0 = clamp(-f / s, 0, H), y1 = clamp((vh - f) / s, 0, H);
        if (x1 > x0 && y1 > y0) ctx.drawImage(ex, x0 * q, y0 * q, (x1 - x0) * q, (y1 - y0) * q, x0, y0, x1 - x0, y1 - y0);
      }
      // 門片往內推開
      const ang = 82 * o * Math.PI / 180;
      leaf(img.l, OP.x * W, 1, ang);
      leaf(img.r, (OP.x + OP.w) * W, -1, ang);
    }
    const w1 = seg(p, .6, .76), w2 = seg(p, .8, .92);
    el.white.style.opacity = w1 * (1 - w2);
    el.hall.style.transform = `scale(${1.18 - .18 * ease(seg(p, .6, 1))})`;
    const c = ease(seg(p, .86, .98));
    el.copy.style.opacity = c;
    el.copy.style.transform = `translate3d(0,${(1 - c) * 24}px,0)`;
    el.copy.style.pointerEvents = c > .5 ? 'auto' : 'none';
  }

  function init() {
    el = { sec: $('door'), stick: $('door-stick'), cv: $('door-cv'), white: $('door-white'), hall: $('door-hall'), copy: $('door-copy') };
    if (!el.sec) return;
    ctx = el.cv.getContext('2d');
    addEventListener('scroll', () => { gate(); request(); }, { passive: true });
    addEventListener('resize', size);
    // 最後一幕卡一拍：從上面滑下來的那一下停在文案，要再滑一次才往下。
    const begin = () => { fromAbove = scrollY < end() - 2; };
    addEventListener('touchstart', begin, { passive: true });
    addEventListener('wheel', () => { const t = performance.now(); if (t - lastWheel > 220) begin(); lastWheel = t; }, { passive: true });
    addEventListener('keydown', begin);
    addEventListener('click', e => { if (e.target.closest && e.target.closest('a[href^="#"]')) fromAbove = false; }, true);
    size();
    fromAbove = scrollY < end() - 2;
  }
  let fromAbove = true, lastWheel = 0, freezing = false;
  // 區塊 460vh：前 300vh 是動畫，後 60vh 畫面不動，卡住時多滑出去的那一點看不出來。
  const span = () => (el.sec.offsetHeight - vh) * 300 / 360;
  const end = () => el.sec.offsetTop + span();
  function gate() {
    const e = end();
    if (!fromAbove || scrollY <= e) return;
    window.scrollTo({ top: e, behavior: 'instant' });
    // iOS 的慣性捲動要暫停 overflow 才停得住。
    if (!freezing && 'ontouchstart' in window) {
      freezing = true; const r = document.documentElement;
      r.style.overflow = 'hidden';
      setTimeout(() => { r.style.overflow = ''; freezing = false; }, 350);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
