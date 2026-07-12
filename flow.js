(function(){
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  let W, H;

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  /* ============================================================
     簡易Perlinノイズ（外部ライブラリ不使用の軽量実装）
     ============================================================ */
  const PERM = new Uint8Array(512);
  (function initPerm(){
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();

  function fade(t){ return t*t*t*(t*(t*6-15)+10); }
  function lerp(a, b, t){ return a + t*(b-a); }
  function grad(hash, x, y){
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise2D(x, y){
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = PERM[PERM[X] + Y], ab = PERM[PERM[X] + Y + 1];
    const ba = PERM[PERM[X + 1] + Y], bb = PERM[PERM[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, x, y), grad(ba, x - 1, y), u),
      lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u),
      v
    );
  }

  /* ============================================================
     フローフィールド: 各座標に「流れの向き」を持たせる
     時間とともにノイズの位相をずらし、ゆっくり渦を巻き続ける
     ============================================================ */
  const FIELD_SCALE = 0.0035;
  let timeOffset = 0;

  function angleAt(x, y){
    const n = noise2D(x * FIELD_SCALE, y * FIELD_SCALE + timeOffset);
    return n * Math.PI * 4;
  }

  /* ============================================================
     粒子システム
     ============================================================ */
  const PALETTE = [
    "68, 90, 196",   // 深い青紫
    "138, 99, 210",  // 紫
    "94, 170, 200",  // 水色
    "220, 150, 90",  // 暖色アクセント（控えめに混ぜる）
  ];

  let particles = [];
  const MAX_PARTICLES = 2600;
  let baseDensity = 900; // 常時漂う環境粒子の数（発言なしでも画面が寂しくならない量）

  function spawnParticle(x, y, opts){
    opts = opts || {};
    return {
      x: x, y: y,
      vx: 0, vy: 0,
      age: 0,
      life: opts.life || (400 + Math.random() * 500),
      size: opts.size || (1 + Math.random() * 1.6),
      color: opts.color || PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alphaBase: opts.alphaBase || (0.25 + Math.random() * 0.4)
    };
  }

  function ensureBaseParticles(){
    while (particles.length < baseDensity){
      particles.push(spawnParticle(Math.random() * W, Math.random() * H));
    }
  }

  function burst(x, y, count){
    for (let i = 0; i < count; i++){
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 18;
      const p = spawnParticle(x + Math.cos(angle) * r, y + Math.sin(angle) * r, {
        life: 600 + Math.random() * 500,
        size: 1.4 + Math.random() * 2.2,
        alphaBase: 0.5 + Math.random() * 0.4
      });
      particles.push(p);
    }
    if (particles.length > MAX_PARTICLES){
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  }

  /* ============================================================
     更新・描画
     ============================================================ */
  function step(){
    timeOffset += 0.0006;

    ctx.fillStyle = "rgba(11, 14, 26, 0.14)"; // 薄く塗り重ねて軌跡を残すトレイル効果
    ctx.fillRect(0, 0, W, H);

    ensureBaseParticles();

    for (let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      const a = angleAt(p.x, p.y);
      const speed = 0.55;
      p.vx = lerp(p.vx, Math.cos(a) * speed, 0.08);
      p.vy = lerp(p.vy, Math.sin(a) * speed, 0.08);
      p.x += p.vx;
      p.y += p.vy;
      p.age++;

      if (p.x < 0) p.x += W;
      if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H;
      if (p.y > H) p.y -= H;

      const lifeRatio = p.age / p.life;
      if (lifeRatio >= 1){
        particles.splice(i, 1);
        continue;
      }
      const fade = lifeRatio < 0.1 ? lifeRatio / 0.1 : (1 - lifeRatio);
      const alpha = p.alphaBase * fade;

      ctx.fillStyle = "rgba(" + p.color + ", " + alpha + ")";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    requestAnimationFrame(step);
  }

  canvas.addEventListener("click", function(e){
    burst(e.clientX, e.clientY, 60);
  });

  step();
})();
