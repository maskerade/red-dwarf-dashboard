/**
 * Red Dwarf Dashboard — design.js
 * Visual effects: scanning line, glitch effects, ambient animations
 */
(function () {
  'use strict';

  // ============================================================
  // 1. Scanning line — create a moving scan line across the screen
  // ============================================================
  function initScanLine() {
    let existing = document.querySelector('.scan-line');
    if (!existing) {
      const div = document.createElement('div');
      div.className = 'scan-line';
      document.body.appendChild(div);
    }
  }

  // ============================================================
  // 2. Ambient glow surge — subtle pulsing on panel borders
  // ============================================================
  function initGlowSurge() {
    const panels = document.querySelectorAll('.panel');
    if (panels.length === 0) return;

    let cycle = 0;
    setInterval(() => {
      cycle = (cycle + 1) % panels.length;
      const panel = panels[cycle];
      if (!panel) return;

      // Apply a brief extra glow
      const originalBorder = panel.style.borderColor || '';
      const originalShadow = panel.style.boxShadow || '';

      panel.style.transition = 'border-color 0.4s, box-shadow 0.4s';
      panel.style.borderColor = 'rgba(255, 176, 0, 0.25)';
      panel.style.boxShadow = '0 0 12px rgba(255, 176, 0, 0.08)';

      setTimeout(() => {
        panel.style.borderColor = '';
        panel.style.boxShadow = '';
      }, 800);
    }, 4000);
  }

  // ============================================================
  // 3. Occasional "glitch" — brief flicker on random ship values
  // ============================================================
  function initGlitchEffect() {
    setInterval(() => {
      const values = document.querySelectorAll('.ship-value:not(.null-value)');
      if (values.length === 0) return;

      const target = values[Math.floor(Math.random() * values.length)];
      const original = target.textContent;

      // Glitch it
      const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      let glitched = '';
      for (let i = 0; i < original.length; i++) {
        if (Math.random() < 0.4) {
          glitched += glitchChars[Math.floor(Math.random() * glitchChars.length)];
        } else {
          glitched += original[i];
        }
      }

      target.textContent = glitched;
      target.style.color = '#ff3344';
      target.style.transition = 'none';

      setTimeout(() => {
        target.textContent = original;
        target.style.color = '';
      }, 120);
    }, 8000);
  }

  // ============================================================
  // 4. Data stream effect on the quote panel (ambient)
  // ============================================================
  function initDataStream() {
    const quotePanel = document.getElementById('panel-quote');
    if (!quotePanel) return;

    // Create a subtle data-stream overlay that occasionally flickers
    const stream = document.createElement('div');
    stream.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      background: linear-gradient(180deg,
        transparent 0%,
        rgba(0, 204, 255, 0.02) 50%,
        transparent 100%
      );
      transition: opacity 0.3s;
    `;
    quotePanel.style.position = 'relative';
    quotePanel.appendChild(stream);

    setInterval(() => {
      stream.style.opacity = '1';
      setTimeout(() => {
        stream.style.opacity = '0';
      }, 150);
    }, 12000);
  }

  // ============================================================
  // 5. Corner LCARS-style ornament animation
  // ============================================================
  function initCornerAnimation() {
    const corners = document.querySelectorAll('.panel-corner');
    setInterval(() => {
      const randomCorner = corners[Math.floor(Math.random() * corners.length)];
      if (!randomCorner) return;
      randomCorner.style.opacity = '1';
      randomCorner.style.borderColor = '#ffb000';
      setTimeout(() => {
        randomCorner.style.opacity = '';
        randomCorner.style.borderColor = '';
      }, 500);
    }, 5000);
  }

  // ============================================================
  // 6. Starfield Parallax Background (#1, Lister, June 21)
  // ============================================================
  function initStarfield() {
    // Check if canvas already exists
    if (document.getElementById('starfield-canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'starfield-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let stars = [];
    let animationId = null;
    let mouseX = 0;
    let mouseY = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createStars() {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 1200); // ~130 stars on 1280x900

      for (let i = 0; i < count; i++) {
        const depth = Math.random(); // 0 = far, 1 = near
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 0.5 + depth * 1.5, // far = tiny, near = bigger
          speed: 0.3 + depth * 0.7, // far = slow, near = fast
          brightness: 0.3 + depth * 0.6, // far = dim, near = bright
          flickerSpeed: 0.5 + Math.random() * 2,
          flickerPhase: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Very subtle parallax: stars shift slightly opposite to mouse
      const parallaxX = (mouseX / window.innerWidth - 0.5) * 6;
      const parallaxY = (mouseY / window.innerHeight - 0.5) * 4;

      const now = Date.now() / 1000;

      for (const star of stars) {
        // Parallax offset (far stars shift less)
        const depthFactor = 1 - (star.speed - 0.3) / 0.7; // 1 = far, 0 = near
        const shiftX = parallaxX * depthFactor;
        const shiftY = parallaxY * depthFactor;

        let x = star.x + shiftX;
        let y = star.y + shiftY;

        // Drift slowly downward (feels like ship moving through space)
        star.y += star.speed * 0.02;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }

        // Subtle flicker
        const flicker = 0.7 + 0.3 * Math.sin(now * star.flickerSpeed + star.flickerPhase);

        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${star.brightness * flicker})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    // Mouse tracking for parallax
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    resize();
    createStars();
    draw();

    window.addEventListener('resize', () => {
      resize();
      createStars();
    });
  }

  // ============================================================
  // 7. Init everything
  // ============================================================
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  function run() {
    initScanLine();
    initGlowSurge();
    initGlitchEffect();
    initDataStream();
    initCornerAnimation();
    initStarfield();

    console.log('[Design] Retro effects initialised.');
  }

  init();

})();