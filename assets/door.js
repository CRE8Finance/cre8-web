// Landing 第一幕：照滑動距離推近建築、打開大門、白光，最後落在大廳和文案。
// 全部依捲動位置計算，不播影片；往回滑就倒退。
(() => {
  const DOOR = { cx: 0.5, cy: (974 + 1799) / 2 / 2160, h: (1799 - 974) / 2160 };
  const $ = id => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeIn = t => t * t * t;
  let el, W, H, vw, vh, ticking = false;

  function size() {
    vw = innerWidth; vh = el.stick.clientHeight;
    W = Math.max(vw, vh * 16 / 9); H = W * 9 / 16;
    el.stage.style.width = W + 'px'; el.stage.style.height = H + 'px';
    el.stage.style.left = (vw - W) / 2 + 'px'; el.stage.style.top = (vh - H) / 2 + 'px';
    el.stage.style.transformOrigin = DOOR.cx * 100 + '% ' + DOOR.cy * 100 + '%';
    draw();
  }

  function draw() {
    ticking = false;
    const r = el.sec.getBoundingClientRect();
    const p = clamp(-r.top / span());
    const s1 = (vh * .78) / (DOOR.h * H);           // 大門約佔畫面八成高
    const a = ease(seg(p, 0, .32));                   // 走到門前
    const o = ease(seg(p, .26, .56));                 // 開門
    const t = easeIn(seg(p, .5, .76));                // 穿過門
    const scale = (1 + (s1 - 1) * a) * (1 + 6 * t);
    const dy = (vh / 2 - ((vh - H) / 2 + DOOR.cy * H)) * Math.max(a, t ? 1 : 0);
    el.stage.style.transform = `translate3d(0,${dy}px,0) scale(${scale})`;
    el.stage.style.opacity = p > .78 ? 0 : 1;        // 在全白時才換場，不會閃
    el.l.style.transform = `rotateY(${-82 * o}deg)`;  // 往內推開
    el.r.style.transform = `rotateY(${82 * o}deg)`;
    el.glow.style.opacity = clamp(.35 + o * .65);
    const w1 = seg(p, .6, .76), w2 = seg(p, .8, .92);
    el.white.style.opacity = w1 * (1 - w2);
    el.hall.style.transform = `scale(${1.18 - .18 * ease(seg(p, .6, 1))})`;
    const c = ease(seg(p, .86, .98));
    el.copy.style.opacity = c;
    el.copy.style.transform = `translate3d(0,${(1 - c) * 24}px,0)`;
    el.copy.style.pointerEvents = c > .5 ? 'auto' : 'none';
  }

  function init() {
    el = { sec: $('door'), stick: $('door-stick'), stage: $('door-stage'), l: $('door-l'), r: $('door-r'), glow: $('door-glow'), white: $('door-white'), hall: $('door-hall'), copy: $('door-copy') };
    if (!el.sec) return;
    addEventListener('scroll', () => { gate(); if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
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
