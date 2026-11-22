/**
 * 按鈕回饋，全站共用（landing、靜態頁、waitlist、app）。
 * 手機（觸控）：照 iOS——手指按下約 60ms 後輕微縮小並變暗，放開用彈簧回彈；開始捲動就取消，不會誤觸。
 * 電腦（滑鼠）：照 apple.com——hover 微亮、按下微暗、不位移（CSS 在 press.css）。
 * 「可以按的東西」= 滑鼠游標是 pointer 的最近一層元素，所以 React 畫出來的按鈕、卡片、列都吃得到，不用改模板。
 */
(() => {
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let cur = null, timer = 0;

  // cursor 會繼承，所以先找語意上的按鈕／連結；沒有的話找 cursor:pointer 那一串的最外層。
  function target(el) {
    if (!el || !el.closest || el.closest('input:not([type=button]):not([type=submit]),textarea,select')) return null;
    let n = el.closest('button,a[href],[role=button],summary,label');
    if (!n) {
      for (n = el; n && n !== document.body && getComputedStyle(n).cursor !== 'pointer'; n = n.parentElement);
      if (!n || n === document.body) return null;
      while (n.parentElement && n.parentElement !== document.body && getComputedStyle(n.parentElement).cursor === 'pointer') n = n.parentElement;
    }
    if (n.disabled || n.getAttribute('aria-disabled') === 'true') return null;
    return n;
  }

  function transparent(c) { return !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c); }

  function pressFrames(el) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const row = r.width > innerWidth * 0.7 && r.height < 96 && transparent(cs.backgroundColor);
    if (row) return [{ backgroundColor: cs.backgroundColor }, { backgroundColor: 'rgba(11,15,20,.06)' }];
    const s = r.width < 120 ? 0.92 : r.width < 260 ? 0.96 : 0.975;
    const light = /rgb\(2[3-5]\d, 2[3-5]\d, 2[3-5]\d\)/.test(cs.backgroundColor);
    return [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: `scale(${reduce.matches ? 1 : s})`, filter: `brightness(${light ? 0.94 : 0.9})` }];
  }

  function down(el) {
    const frames = pressFrames(el);
    el.__press = el.animate(frames, { duration: 110, easing: 'ease-out', fill: 'forwards' });
    el.__frames = frames;
  }

  function up(el) {
    const a = el.__press, f = el.__frames;
    if (!a) return;
    const back = el.animate([f[1], f[0]], { duration: reduce.matches ? 120 : 380, easing: SPRING });
    a.cancel();
    el.__press = null;
    back.onfinish = () => back.cancel();
  }

  function release() {
    clearTimeout(timer);
    if (cur) { up(cur); cur = null; }
  }

  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    release();
    const el = target(e.target);
    if (!el) return;
    cur = el;
    timer = setTimeout(() => cur === el && down(el), 60);
  }, { passive: true });
  addEventListener('pointerup', () => {
    // 很快的點擊：60ms 還沒到就放開，也要補一次按下再彈回，手感才不會像沒按到。
    if (cur && !cur.__press) { clearTimeout(timer); const el = cur; down(el); setTimeout(() => { if (cur === el) release(); }, 90); return; }
    release();
  }, { passive: true });
  addEventListener('pointercancel', release, { passive: true });
  addEventListener('scroll', release, { passive: true, capture: true });

  // 電腦版：只標記可按的元素，效果由 press.css 處理。
  addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = target(e.target);
    if (!el || el.hasAttribute('data-press')) return;
    const cs = getComputedStyle(el), bg = cs.backgroundColor;
    const boxed = !transparent(bg) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
    // 有底色的按鈕微亮；白／淺色按鈕微暗（變亮看不出來）；純文字連結淡一點。
    el.setAttribute('data-press', !boxed ? 'text' : /rgb\(2[3-5]\d, 2[3-5]\d, 2[3-5]\d\)/.test(bg) ? 'light' : '');
  }, { passive: true });
})();
