(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  const title = document.querySelector("h1");
  if (!title || !document.fonts) return;

  const canvas = document.createElement("canvas");
  canvas.id = "fx";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Physics tuning (CSS px, per 60fps frame)
  const SPRING = 0.045;
  const DAMPING = 0.88;
  const PUSH = 6;
  const SWIRL = 0.4;
  const BURST = 16;
  const REST_ENERGY = 0.02;

  const colors = { fg: "#161616" };
  const readColors = () => {
    const cs = getComputedStyle(root);
    colors.fg = cs.getPropertyValue("--fg").trim() || colors.fg;
  };

  let particles = [];
  let dpr = 1;
  let size = 2;
  let radius = 120;
  let box = { x: 0, y: 0, w: 0, h: 0 };

  const pointer = { x: 0, y: 0, active: false, moved: false };
  let ghost = null;
  let running = false;
  let last = 0;
  let startedAt = 0;

  function build(intro) {
    const rect = title.getBoundingClientRect();
    const cs = getComputedStyle(title);
    const fontSize = parseFloat(cs.fontSize);
    const w = innerWidth;
    const h = innerHeight;

    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 8;
    const bw = Math.ceil(rect.width) + pad * 2;
    const bh = Math.ceil(rect.height) + pad * 2;
    box = { x: rect.left - pad, y: rect.top - pad, w: bw, h: bh };

    const off = document.createElement("canvas");
    off.width = bw;
    off.height = bh;
    const o = off.getContext("2d", { willReadFrequently: true });
    o.font = `${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    o.textAlign = "center";
    o.textBaseline = "middle";
    if ("letterSpacing" in o) o.letterSpacing = cs.letterSpacing;
    o.fillStyle = "#000";
    o.fillText(title.textContent.trim(), bw / 2, bh / 2);
    const data = o.getImageData(0, 0, bw, bh).data;

    const gap = Math.max(2, Math.round(fontSize / 28));
    size = gap * 0.8;
    radius = Math.min(Math.max(fontSize * 1.7, 90), 190);

    const next = [];
    for (let y = 0; y < bh; y += gap) {
      for (let x = 0; x < bw; x += gap) {
        if (data[(y * bw + x) * 4 + 3] < 128) continue;
        const ox = box.x + x;
        const oy = box.y + y;
        const p = { ox, oy, x: ox, y: oy, vx: 0, vy: 0, delay: 0 };
        if (intro) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.delay = ((ox - box.x) / bw) * 700 + Math.random() * 250;
        }
        next.push(p);
      }
    }
    particles = next;
    startedAt = performance.now();
  }

  function step(now) {
    const dt = Math.min(2.5, (now - last) / 16.667);
    last = now;
    const t = now - startedAt;
    const damp = Math.pow(DAMPING, dt);

    if (ghost) {
      const k = (now - ghost.t0) / ghost.dur;
      if (k >= 1 || pointer.moved) {
        ghost = null;
        if (!pointer.moved) pointer.active = false;
      } else {
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        pointer.x = box.x + e * box.w;
        pointer.y = box.y + box.h / 2 + Math.sin(e * Math.PI * 3) * box.h * 0.35;
        pointer.active = true;
      }
    }

    const r2 = radius * radius;
    let energy = 0;
    for (const p of particles) {
      if (t < p.delay) continue;

      if (pointer.active) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / radius) ** 2 * PUSH * dt;
          p.vx += (dx / d) * f + (dy / d) * f * SWIRL;
          p.vy += (dy / d) * f - (dx / d) * f * SWIRL;
        }
      }

      p.vx += (p.ox - p.x) * SPRING * dt;
      p.vy += (p.oy - p.y) * SPRING * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      energy += p.vx * p.vx + p.vy * p.vy;
    }

    draw();

    const intro = t < 1500;
    const idle = !pointer.active && !ghost && !intro && energy / (particles.length || 1) < REST_ENERGY;
    if (idle) {
      for (const p of particles) { p.x = p.ox; p.y = p.oy; p.vx = p.vy = 0; }
      draw();
      running = false;
      return;
    }
    requestAnimationFrame(step);
  }

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = colors.fg;
    for (const p of particles) ctx.fillRect(p.x, p.y, size, size);
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  }

  function burst(x, y) {
    const R = radius * 2;
    for (const p of particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      const f = (1 - d / R) ** 2 * BURST;
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f;
    }
  }

  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.moved = true;
    wake();
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.moved = true;
    burst(e.clientX, e.clientY);
    wake();
  }, { passive: true });

  const release = () => { pointer.active = false; wake(); };
  addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") release(); });
  addEventListener("pointercancel", release);
  document.addEventListener("pointerleave", release);

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(false); wake(); }, 150);
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    readColors();
    wake();
  });

  document.fonts.load(`500 40px "IBM Plex Sans"`).then(() => document.fonts.ready).then(() => {
    readColors();
    build(true);
    root.classList.add("fx");
    wake();
    setTimeout(() => {
      if (pointer.moved) return;
      ghost = { t0: performance.now(), dur: 1800 };
      wake();
    }, 1500);
  });
})();
