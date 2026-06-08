export const framePart = {
  id: "frame",
  html: String.raw`<div id="noise-canvas" class="noise"><div class="noise-js w-embed w-script"><script>
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('noise-canvas');
    if (!container) return;

    // Effect settings
    const settings = {
        grainIntensity: 4,          // Grain opacity (0-100)
        dustIntensity: 24,          // Overall dust opacity (0-100)
        dustComplexity: 340,        // Number of dust particles (10-500)
        dustUpdateFrequency: 3,     // Update dust every N frames
        lintRatio: 19,              // Lint vs dust percentage (0-100)
        minDustSize: 0.7,           // Minimum dust particle radius
        maxDustSize: 1.1,           // Maximum dust particle radius
        minLintLength: 4,           // Minimum lint curve length
        maxLintLength: 27,          // Maximum lint curve length
        minLintThickness: 0.1,      // Minimum lint line width
        maxLintThickness: 0.8,      // Maximum lint line width
        rogueLintChance: 0.5,       // Chance for extra bright lint (0-100)
        rogueLintOpacity: 35,       // Opacity of bright lint (0-100)
        fps: 24,                    // Animation frame rate
    };

    // Apply container styles
    Object.assign(container.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        pointerEvents: 'none',
        zIndex: '9999'
    });

    // Inject canvases
    container.innerHTML = \`
        <style>
            #noise-canvas > canvas {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }
            #grain-canvas-el { z-index: 100; }
            #dust-canvas-el { z-index: 101; }
        </style>
        <canvas id="grain-canvas-el"></canvas>
        <canvas id="dust-canvas-el"></canvas>
    \`;
    
    const grainCanvas = document.getElementById('grain-canvas-el');
    const dustCanvas = document.getElementById('dust-canvas-el');
    const grainCtx = grainCanvas.getContext('2d', { alpha: true });
    const dustCtx = dustCanvas.getContext('2d', { alpha: true });
    
    let width = 0, height = 0, lastTime = 0, frameCounter = 0;
    const frameDuration = 1000 / settings.fps;
    const PATTERN_SIZE = 128;
    const TWO_PI = Math.PI * 2;
    
    let grainPattern;

    // Create reusable noise pattern
    const createGrainPattern = () => {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = patternCanvas.height = PATTERN_SIZE;
        const patternCtx = patternCanvas.getContext('2d');
        const imageData = patternCtx.createImageData(PATTERN_SIZE, PATTERN_SIZE);
        const pixels = imageData.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.random() * 255 | 0;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
            pixels[i + 3] = 255;
        }
        
        patternCtx.putImageData(imageData, 0, 0);
        grainPattern = grainCtx.createPattern(patternCanvas, 'repeat');
    };

    // Resize canvases
    const resizeCanvas = () => {
        width = container.clientWidth;
        height = container.clientHeight;
        grainCanvas.width = dustCanvas.width = width;
        grainCanvas.height = dustCanvas.height = height;
        createGrainPattern();
    };

    // Generate grain effect
    const generateGrain = () => {
        grainCtx.clearRect(0, 0, width, height);
        grainCtx.globalAlpha = settings.grainIntensity / 100;
        grainCtx.fillStyle = grainPattern;
        grainCtx.translate(
            Math.random() * PATTERN_SIZE | 0,
            Math.random() * PATTERN_SIZE | 0
        );
        grainCtx.fillRect(-PATTERN_SIZE, -PATTERN_SIZE, width + PATTERN_SIZE, height + PATTERN_SIZE);
        grainCtx.setTransform(1, 0, 0, 1, 0, 0);
    };

    // Generate dust effect
    const generateDust = () => {
        dustCtx.clearRect(0, 0, width, height);
        
        const baseIntensity = settings.dustIntensity / 100;
        if (baseIntensity === 0) return;
        
        const lintRatio = settings.lintRatio;
        const rogueLintChance = settings.rogueLintChance;
        const rogueLintOpacity = settings.rogueLintOpacity / 100;
        
        for (let i = 0; i < settings.dustComplexity; i++) {
            if (Math.random() * 100 < lintRatio) {
                // Lint
                const finalOpacity = Math.random() * 100 < rogueLintChance
                    ? rogueLintOpacity
                    : baseIntensity * (Math.random() * 0.7 + 0.1);

                dustCtx.strokeStyle = \`rgba(255,255,255,\${finalOpacity})\`;
                dustCtx.lineWidth = Math.max(0.1, 
                    settings.minLintThickness + Math.random() * (settings.maxLintThickness - settings.minLintThickness)
                );
                
                const x = Math.random() * width;
                const y = Math.random() * height;
                const len = settings.minLintLength + Math.random() * (settings.maxLintLength - settings.minLintLength);
                const cp1x = x + (Math.random() - 0.5) * len * 2;
                const cp1y = y + (Math.random() - 0.5) * len * 2;
                const endX = x + (Math.random() - 0.5) * len;
                const endY = y + (Math.random() - 0.5) * len;
                
                dustCtx.beginPath();
                dustCtx.moveTo(x, y);
                dustCtx.quadraticCurveTo(cp1x, cp1y, endX, endY);
                dustCtx.stroke();
            } else {
                // Dust particle
                dustCtx.fillStyle = \`rgba(255,255,255,\${baseIntensity * (Math.random() * 0.7 + 0.1)})\`;
                dustCtx.beginPath();
                dustCtx.arc(
                    Math.random() * width,
                    Math.random() * height,
                    Math.max(0.1, settings.minDustSize + Math.random() * (settings.maxDustSize - settings.minDustSize)),
                    0,
                    TWO_PI
                );
                dustCtx.fill();
            }
        }
    };
    
    // Main animation loop
    const loop = (currentTime) => {
        requestAnimationFrame(loop);
        
        const elapsed = currentTime - lastTime;
        if (elapsed > frameDuration) {
            lastTime = currentTime - (elapsed % frameDuration);

            if (settings.grainIntensity > 0) {
                generateGrain();
            } else {
                grainCtx.clearRect(0, 0, width, height);
            }

            if (frameCounter % settings.dustUpdateFrequency === 0) {
                if (settings.dustIntensity > 0) {
                    generateDust();
                } else {
                    dustCtx.clearRect(0, 0, width, height);
                }
            }

            frameCounter++;
        }
    };

    // Initialize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(loop);
});
</script></div></div><div data-idle-time="45000" data-speed="24" data-angle="60" class="screensaver-container"><div class="screensaver_css w-embed"><style>
  .screensaver-item {
    will-change: transform;
    transform: translate3d(0, 0, 0);
    z-index: 9999999999999999999999;
  }
  .screensaver-item img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  #screensaver-canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999999999999999999999;
    pointer-events: none;
  }
</style></div><div class="screensaver_canvas-class w-embed"><canvas id="screensaver-canvas"></canvas></div><div class="screensaver-item"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6900e5e777711bee0bea39a1_fc99714ed4c0b9fbd61a584220e93c47.avif" alt=""/></div><div class="screensaver-title hide"><div id="id-screensaver-title" class="heading-xlarge text-weight-custom">Random screensaver title</div></div><div class="screensaver_js w-embed w-script"><script>
window.addEventListener('load', () => {
  const imageUrls = [
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3ca97cb69f07b2e7b14f6_tomato-1.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3ca9b03a6297dac9defed_tomato-2.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3ca9d35db97712a8c840d_tomato-3.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3caa130349f49cf09b1d1_tomato-4.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3caa464515d34fc409ee7_tomato-5.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3caa8ee08d836b9f7d205_tomato-6.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3caad578a1e6baf6c53a0_tomato-7.webp',
    '/newhome/assets/cdn.prod.website-files.com/68f36b28c323b20e1d257b33/68f3cab0bb003ae357c55edf_tomato-8.webp',
  ];

  const imgCache = imageUrls.map(src =>
    Object.assign(new Image(), {
      crossOrigin: 'anonymous',
      decoding: 'async',
      loading: 'eager',
      src
    })
  );

  Promise.allSettled(imgCache.map(im =>
    im.decode?.() || new Promise(res => {
      im.onload = im.onerror = res;
    })
  ));

  const container = document.querySelector('.screensaver-container');
  if (!container) {
    console.error('Screensaver container not found!');
    return;
  }
  const item = container.querySelector('.screensaver-item');
  const img = item?.querySelector('img');
  const canvas = document.querySelector('#screensaver-canvas');

  if (!item || !img || !canvas) {
    console.error('Screensaver child elements not found!');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    console.error('Could not get 2D context from canvas');
    return;
  }

  const state = {
    x: 0, y: 0, speed: 2, angle: 0,
    width: 0, height: 0, contW: 0, contH: 0,
    currentImage: 0, lastX: null, lastY: null,
    active: false, savedState: null
  };

  const setX = gsap.quickSetter(item, "x", "px");
  const setY = gsap.quickSetter(item, "y", "px");

  const STEPS = 5;
  const IDLE_TIME = parseInt(container.dataset.idleTime || '5000', 10);

  let idleTimeout = null;
  let isFirstRun = true;

  const tickerHandler = (_time, delta) => {
    const maxDelta = 33.3;
    const clampedDelta = Math.min(delta, maxDelta);

    const dt = clampedDelta / 60;
    state.x += Math.cos(state.angle) * state.speed * dt;
    state.y += Math.sin(state.angle) * state.speed * dt;

    let bounced = false;

    if (state.x <= 0 || state.x + state.width >= state.contW) {
      state.angle = Math.PI - state.angle;
      state.x = Math.max(0, Math.min(state.x, state.contW - state.width));
      bounced = true;
    }

    if (state.y <= 0 || state.y + state.height >= state.contH) {
      state.angle = -state.angle;
      state.y = Math.max(0, Math.min(state.y, state.contH - state.height));
      bounced = true;
    }

    if (bounced) changeImage();

    setX(state.x);
    setY(state.y);
  };

  const trailDrawerHandler = () => {
    if (!img.src || img.naturalWidth === 0) return;

    if (state.lastX === null) {
      state.lastX = state.x;
      state.lastY = state.y;
    }

    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const interpX = state.lastX + (state.x - state.lastX) * t;
      const interpY = state.lastY + (state.y - state.lastY) * t;
      ctx.drawImage(img, interpX, interpY, state.width, state.height);
    }

    state.lastX = state.x;
    state.lastY = state.y;
  };

  const parseValue = (val) => {
    if (!val) return null;
    if (val.includes('-')) {
      const [min, max] = val.split('-').map(Number);
      return Math.random() * (max - min) + min;
    }
    return parseFloat(val);
  };

  const updateSize = () => {
    const r = container.getBoundingClientRect();
    state.contW = r.width;
    state.contH = r.height;
    const rect = item.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
  };

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = \`\${container.clientWidth}px\`;
    canvas.style.height = \`\${container.clientHeight}px\`;
    ctx.scale(dpr, dpr);
  };

  const changeImage = () => {
    state.currentImage = (state.currentImage + 1) % imageUrls.length;
    const im = imgCache[state.currentImage];

    im.decode?.().catch(() => {}).finally(() => { img.src = im.src; });

    const nextIdx = (state.currentImage + 1) % imageUrls.length;
    imgCache[nextIdx].decode?.().catch(() => {});
  };

  const startScreensaver = () => {
    if (state.active) return;
    
    const shouldStartAnimationTickers = document.visibilityState === 'visible';
    
    state.active = true;

    container.style.display = 'block';
    canvas.style.display = 'block';
    updateSize();
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.lastX = state.lastY = null;

    if (state.savedState) {
      Object.assign(state, state.savedState);
      img.src = imageUrls[state.currentImage];
    } else {
      if (isFirstRun) {
        state.x = 0;
        state.y = 0;
        isFirstRun = false;
      } else {
        state.x = Math.random() * (state.contW - state.width);
        state.y = Math.random() * (state.contH - state.height);
      }
      state.speed = parseValue(container.dataset.speed) || 2;
      state.angle = (parseValue(container.dataset.angle) || 45) * Math.PI / 180;
      state.currentImage = 0;
      img.src = imageUrls[0];
    }

    const nextIdx = (state.currentImage + 1) % imageUrls.length;
    imgCache[nextIdx].decode?.().catch(() => {});

    if (shouldStartAnimationTickers) {
      gsap.ticker.add(tickerHandler);
      gsap.ticker.add(trailDrawerHandler);
    }
  };

  const stopScreensaver = () => {
    if (!state.active) return;
    state.active = false;

    gsap.ticker.remove(tickerHandler);
    gsap.ticker.remove(trailDrawerHandler);
    container.style.display = 'none';
    canvas.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state.savedState = {
      x: state.x,
      y: state.y,
      angle: state.angle,
      speed: state.speed,
      currentImage: state.currentImage
    };
  };

  const resetIdleTimer = () => {
    if (idleTimeout) clearTimeout(idleTimeout);
    stopScreensaver();
    idleTimeout = window.setTimeout(startScreensaver, IDLE_TIME);
  };

  ['mousemove', 'keydown', 'wheel', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, resetIdleTimer, { passive: true })
  );

  window.addEventListener('resize', () => {
    updateSize();
    if (state.active) {
      resizeCanvas();
    }
    state.savedState = null;
  });

  document.addEventListener('visibilitychange', () => {
    if (!state.active) {
      return;
    }

    if (document.visibilityState === 'hidden') {
      gsap.ticker.remove(tickerHandler);
      gsap.ticker.remove(trailDrawerHandler);
    } else if (document.visibilityState === 'visible') {
      state.lastX = null;
      state.lastY = null;
      gsap.ticker.add(tickerHandler);
      gsap.ticker.add(trailDrawerHandler);
    }
  });

  resetIdleTimer();
});
</script></div></div><div data-w-id="0e67ac3b-849c-b48a-13aa-a2fc80e5f0c5" style="display:flex" class="preloader"><div class="preloader_css w-embed"><style>
.preloader_load-line {
    width:
    height: 1px;
    background-color: #bfaca0;
    animation: loadLine 3.9s cubic-bezier(.645, .045, .355, 1) forwards;
}

@keyframes loadLine {
    from {
        width: 0%;
    }
    to {
        width: 100%;
    }
}
</style></div><div class="preloader_number-js w-embed w-script"><script>
(function () {
  const animateNumber = (element, target, duration) => {
    let startTime;
    const initialNumber = 0;

    const cubicBezier = (t, p0, p1, p2, p3) => {
      const u = 1 - t;
      return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    };

    const easingFunction = (t) => cubicBezier(t, 0, 0.645, 0.355, 1);

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsedTime = time - startTime;
      const t = Math.min(elapsedTime / duration, 1);
      const easedT = easingFunction(t);
      const newValue = initialNumber + (target - initialNumber) * easedT;

      element.textContent = Math.round(newValue);

      if (elapsedTime < duration) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = target;
      }
    };

    requestAnimationFrame(animate);
  };

  const onIntersection = (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const finalNumber = 100;
        const animDuration = 2900;

        el.textContent = "0";
        animateNumber(el, finalNumber, animDuration);
        counterObserver.unobserve(el);
      }
    });
  };

  const counterObserver = new IntersectionObserver(onIntersection);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[counter-element="number"]').forEach((el) => {
      counterObserver.observe(el);
    });
  });
})();
</script></div><div class="preloader_image-wrap"><div class="preloader_image"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a51958b8db2a614d0745_andy_1.avif" loading="eager" style="opacity:0" data-w-id="e590527f-1bd8-447f-2096-2044b971f6eb" alt="" class="preloader_image-1"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a519d957658317378b3a_andy_2.avif" loading="eager" style="opacity:0" data-w-id="cf47daa5-3590-3ecc-e508-ffe93c56a98a" alt="" class="preloader_image-2"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a519aff1544bb1387be2_andy_3.avif" loading="eager" style="opacity:0" data-w-id="e27a6bed-493f-3f1d-2952-500695da5d26" alt="" class="preloader_image-3"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a5193c5e3c50523e4e75_andy_8.avif" loading="eager" style="opacity:0" data-w-id="e419d449-09cc-7845-7e47-a3fc3991b345" alt="" class="preloader_image-4"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a519aff1544bb1387be2_andy_3.avif" loading="eager" style="opacity:0" data-w-id="dd195682-5ca2-62f8-0b41-d0d76fb0dd7b" alt="" class="preloader_image-5"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a51a4ef606132002ec12_andy_6.avif" loading="eager" style="opacity:0" data-w-id="8bae1168-a24e-9587-49b4-25768835f32b" alt="" class="preloader_image-6"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a51922638acab5c5ef17_andy_7.avif" loading="eager" style="opacity:0" data-w-id="8c13d805-95d1-0741-d181-33df2073d970" alt="" class="preloader_image-7"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a519164ee2a855b0e1c1_andy_4.avif" loading="eager" style="opacity:0" data-w-id="3c13986a-087e-7c16-db17-59c77bfcfca0" alt="" class="preloader_image-8"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a5193c3ac852c02beb81_andy_9.avif" loading="eager" style="opacity:0" data-w-id="66372baa-4fbc-4d33-ad26-f4af04f9cdee" alt="" class="preloader_image-9"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a51a7e1fafae85d0857e_andy_10.avif" loading="eager" style="opacity:0" data-w-id="7a5530dd-2718-ea68-ae81-6771db9ef942" alt="" class="preloader_image-10"/></div></div><div class="preloader_decor-bottom-left"><div class="flex-horiz-decor-2rem text-color-beige-300"><div class="flex-vert-decor-4"><p class="decor-text-12 text-style-allcaps">Exhibit</p><p class="decor-text-12 text-style-allcaps">Collection</p></div></div><div class="preloader_load-wrapper"><div class="preloader_load-text-small">Loading</div><div id="numbercount" counter-element="number" duration="3000" class="preloader_load-text-big">0</div><div class="preloader_load-text-small">%</div></div></div><div class="preloader_decor-top-right hide-mobile"><div class="flex-horiz-decor-2rem text-color-beige-300"><div class="flex-vert-decor-4"><p class="decor-text-12 text-style-allcaps">Expression</p><p class="decor-text-12 text-style-allcaps margin-left-36">Innovation</p></div></div></div><div class="preloader_decor-top-left"><div class="flex-horiz-decor-2rem text-color-beige-300"><div class="flex-vert-decor-4"><p class="decor-text-12 text-tomato-weight-extra-l">Year:</p><p class="opacity-0 decor-text-12">1</p><p class="decor-text-12 text-tomato-weight-extra-l">Dept. of</p></div><div class="flex-vert-decor-4"><p class="decor-text-12 text-no-wrap">1962 </p><p class="opacity-0 decor-text-12">1</p><p class="decor-text-12 text-no-wrap">Warhol Arts</p></div><div class="flex-vert-decor-4 text-tomato-weight-extra-l"><p class="margin-left-12 decor-text-12">Story</p><p class="decor-text-12">Pop Icon</p><p class="margin-left-36 decor-text-12">From a simple canvas</p><p class="margin-left-12 decor-text-12">to a cultural revolution.</p></div></div></div><div class="preloader_decor-bottom-center"><div class="preloader_load-line-wrap"><div class="preloader_load-line"></div></div></div></div><div data-hide-on="tablet-mobile" class="gsap-trail-effect lazy-section"><div class="gsap-trail_css w-embed"><style>
*,
*::after,
*::before {
	box-sizing: border-box;
}

:root {
	font-size: 13px;
	--color-text: #fff;
	--color-bg: #000;
	--color-link: #fff;
	--color-link-hover: #fff;
	--img-width: 300px;
	--img-ratio: 1.1;
	--img-offset-x: 20px;
	--img-offset-y: 20px;
	--img-border-radius: 0px;
	--color-bg-content: rgba(255,255,255,0.05);
	--color-bg-demos: rgba(255,255,255,0.05);
}

body {
	margin: 0;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	-webkit-touch-callout: none;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: auto;
	min-height: 100vh;
	/* mobile viewport bug fix */
	min-height: -webkit-fill-available;
}

html {
	height: -webkit-fill-available;
}

.demo-4 {
	--img-ratio: 1;
}

.content__img {
	width: var(--img-width);
	aspect-ratio: var(--img-ratio);
	border-radius: var(--img-border-radius);
	position: absolute;
	top: 0;
	left: 0;
	opacity: 0;
	overflow: hidden;
	will-change: transform, filter;
}

.content__img-inner {
	width:100%;
	height: 100%;
	background-size: cover;
	position: absolute;

}

</style></div><div class="gsap-trail_js w-embed w-script"><!-- Trailing Images Effect GSAP -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const lerp = (a, b, n) => (1 - n) * a + n * b;

    let mousePos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let cacheMousePos = { x: 0, y: 0 };
    let isIdle = true;
    let isOverExcludedElement = false;

    const trailEffect = document.querySelector('.trail-effect');
    const imageWrap = document.querySelector('.image-wrap');
    let observerActive = false;

    const checkExcludedElement = (e) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);
      isOverExcludedElement = element?.closest('[data-no-trail]') !== null;
    };

    const handleMouseMove = (e) => {
      checkExcludedElement(e);
      const [x, y] = [e.clientX + window.scrollX, e.clientY + window.scrollY];
      mousePos = { x, y };
    };

    class Image {
      constructor(el) {
        this.DOM = { el: el, inner: el.querySelector('.content__img-inner') };
        this.rect = this.DOM.el.getBoundingClientRect();
        this.timeline = null;
      }
    }

    class ImageTrail {
      constructor(DOM_el) {
        this.DOM = { el: DOM_el };
        this.images = [...this.DOM.el.querySelectorAll('.content__img')].map(img => new Image(img));
        this.imagesTotal = this.images.length;
        this.imgPosition = 0;
        this.zIndexVal = 1;
        this.activeImagesCount = 0;
        this.threshold = 80;

        const onPointerMoveEv = () => {
          cacheMousePos = { ...mousePos };
          requestAnimationFrame(() => this.render());
          window.removeEventListener('mousemove', onPointerMoveEv);
          window.removeEventListener('touchmove', onPointerMoveEv);
        };

        window.addEventListener('mousemove', onPointerMoveEv);
        window.addEventListener('touchmove', onPointerMoveEv);
      }

      render() {
        let distance = Math.hypot(mousePos.x - lastMousePos.x, mousePos.y - lastMousePos.y);
        cacheMousePos.x = lerp(cacheMousePos.x || mousePos.x, mousePos.x, 0.1);
        cacheMousePos.y = lerp(cacheMousePos.y || mousePos.y, mousePos.y, 0.1);

        if (distance > this.threshold && !isOverExcludedElement) {
          this.showNextImage();
          lastMousePos = { ...mousePos };
        }

        if (isIdle && this.zIndexVal !== 1) {
          this.zIndexVal = 1;
        }

        if (observerActive) {
          requestAnimationFrame(() => this.render());
        }
      }

      showNextImage() {
        ++this.zIndexVal;
        this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
        const img = this.images[this.imgPosition];
        gsap.killTweensOf(img.DOM.el);

        img.timeline = gsap.timeline({
          onStart: this.onImageActivated.bind(this),
          onComplete: this.onImageDeactivated.bind(this)
        })
          .fromTo(img.DOM.el, {
            opacity: 1,
            scale: 0,
            zIndex: this.zIndexVal,
            x: cacheMousePos.x - img.rect.width / 2,
            y: cacheMousePos.y - img.rect.height / 2
          }, {
            duration: 0.4,
            ease: 'power1',
            scale: 1,
            x: mousePos.x - img.rect.width / 2,
            y: mousePos.y - img.rect.height / 2
          }, 0)
          .fromTo(img.DOM.inner, {
            scale: 2,
            filter: 'brightness(300%) contrast(300%)'
          }, {
            duration: 0.4,
            ease: 'power1',
            scale: 1,
            filter: 'brightness(100%) contrast(100%)'
          }, 0)
          .to(img.DOM.el, {
            duration: 0.4,
            ease: 'power3',
            opacity: 0
          }, 0.4);
      }

      onImageActivated() {
        this.activeImagesCount++;
        isIdle = false;
      }

      onImageDeactivated() {
        this.activeImagesCount--;
        if (this.activeImagesCount === 0) {
          isIdle = true;
        }
      }
    }

    const observerTrailEffect = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !observerActive) {
          observerActive = true;
          document.body.addEventListener('mousemove', handleMouseMove);
          document.body.addEventListener('touchmove', handleMouseMove);
          new ImageTrail(imageWrap);
        } else if (!entry.isIntersecting && observerActive) {
          observerActive = false;
          document.body.removeEventListener('mousemove', handleMouseMove);
          document.body.removeEventListener('touchmove', handleMouseMove);
        }
      });
    }, { threshold: 0.5 });

    observerTrailEffect.observe(trailEffect);
  });
</script></div><div class="image-wrap"><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02ee0933e2377120fbc_mm_9.avif" alt="money" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d51b4bb4c12aac2a0_mm_14-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d51b4bb4c12aac2a0_mm_14-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d51b4bb4c12aac2a0_mm_14.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d51b4bb4c12aac2a0_mm_14.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02dd29c48a86ed6530c_mm_15-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02dd29c48a86ed6530c_mm_15-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02dd29c48a86ed6530c_mm_15.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02dd29c48a86ed6530c_mm_15.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d67e891e4fbcd0ca9_mm_13.avif" alt="money" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d67d6ce71cd4d3666_mm_16-p-500.webp 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d67d6ce71cd4d3666_mm_16.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d67d6ce71cd4d3666_mm_16.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02d772544404816c438_mm_11.avif" alt="money" class="content__img-inner"/></div><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02dc7d10c254ae816a8_mm_6.avif" alt="money" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c20197d1f577a52d4_mm_12-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c20197d1f577a52d4_mm_12.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c20197d1f577a52d4_mm_12.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c67d6ce71cd4d3498_mm_3-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c67d6ce71cd4d3498_mm_3.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02c67d6ce71cd4d3498_mm_3.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02cac972f9c23242054_mm_8-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02cac972f9c23242054_mm_8.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02cac972f9c23242054_mm_8.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b66fe99cf79b60883_mm_10-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b66fe99cf79b60883_mm_10.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b66fe99cf79b60883_mm_10.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b311cfbd8950506cc_mm_2-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b311cfbd8950506cc_mm_2.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b311cfbd8950506cc_mm_2.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02ba73d71bad97dae8d_mm_5.avif" alt="money" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b2ef69d74b8113326_mm_4-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b2ef69d74b8113326_mm_4.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b2ef69d74b8113326_mm_4.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img sizes="300px" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b6bc92fb5b282b91b_mm_1-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b6bc92fb5b282b91b_mm_1.avif 1080w" alt="money" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b6bc92fb5b282b91b_mm_1.avif" loading="lazy" class="content__img-inner"/></div><div class="content__img"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6737c02b85df67063c4f3c8d_mm_7.avif" alt="money" class="content__img-inner"/></div></div></div><div class="awards"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/691cce4876062db55296d881_fwa_of-the-day.svg" loading="eager" alt="FWA Of The Day yellow badge." class="award_badge-fwa"/><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/691cce48c6cbe31078c419ca_awwards_of-the-day.svg" loading="eager" alt="Awwwards Site of the Day red badge." class="award_badge-awwwards"/><div class="award-scroll w-embed w-script"><script>
document.addEventListener("DOMContentLoaded", () => {

  const fwa = document.querySelector(".award_badge-fwa");
  const aww = document.querySelector(".award_badge-awwwards");
  const leftWrap = document.querySelector('[progress-wrap="left"]');
  const rightWrap = document.querySelector('[progress-wrap="right"]');
  const hideSection = document.querySelector('[data-hide-progress]');

  let badgesHidden = false;
  let isProgressVisible = false;
  let scrollStopTimer = null;
  let forceHideProgress = false;

  gsap.set([fwa, aww], { x: 0 });
  gsap.set([leftWrap, rightWrap], {
    x: (i) => i === 0 ? "-150%" : "150%",
    opacity: 0
  });

  const hideFWA = gsap.timeline({ paused: true })
    .to(fwa, { x: "-150%", duration: 1.1, ease: "power4.out" });

  const hideAWW = gsap.timeline({ paused: true })
    .to(aww, { x: "150%", duration: 1.1, ease: "power4.out" });

  const showFWA = gsap.timeline({ paused: true })
    .to(fwa, { x: 0, duration: 1.1, ease: "power4.out" });

  const showAWW = gsap.timeline({ paused: true })
    .to(aww, { x: 0, duration: 1.1, ease: "power4.out" });

  const showProgress = gsap.timeline({ paused: true })
    .to(leftWrap, { x: 0, opacity: 1, duration: 1.0, ease: "power4.out" }, 0)
    .to(rightWrap, { x: 0, opacity: 1, duration: 1.0, ease: "power4.out" }, 0);

  const hideProgress = gsap.timeline({ paused: true })
    .to(leftWrap, { x: "-150%", opacity: 0, duration: 0.8, ease: "power4.out" }, 0)
    .to(rightWrap, { x: "150%", opacity: 0, duration: 0.8, ease: "power4.out" }, 0);

  if (hideSection) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        forceHideProgress = entry.isIntersecting;

        if (forceHideProgress) {
          hideProgress.restart();
          isProgressVisible = false;
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(hideSection);
  }

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const threshold = window.innerHeight * 0.10;
    const isBelowThreshold = scrollY > threshold;

    if (isBelowThreshold && !badgesHidden) {
      badgesHidden = true;

      hideFWA.restart();
      hideAWW.restart();

      if (!forceHideProgress) {
        isProgressVisible = true;
        gsap.delayedCall(0.25, () => {
          if (badgesHidden && !forceHideProgress) {
            showProgress.restart();
          }
        });
      }
    }
    else if (!isBelowThreshold && badgesHidden) {
      badgesHidden = false;
      isProgressVisible = false;

      if (scrollStopTimer) clearTimeout(scrollStopTimer);

      hideProgress.restart();

      gsap.delayedCall(0.25, () => {
        if (!badgesHidden) {
          showFWA.restart();
          showAWW.restart();
        }
      });
    }

    if (badgesHidden && !forceHideProgress) {
      if (scrollStopTimer) clearTimeout(scrollStopTimer);

      if (!isProgressVisible) {
        showProgress.restart();
        isProgressVisible = true;
      }

      scrollStopTimer = setTimeout(() => {
        if (!forceHideProgress) {
          hideProgress.restart();
          isProgressVisible = false;
        }
      }, 300);
    }
  };

  window.addEventListener("scroll", handleScroll);

});
</script></div><div class="progress"><div progress-wrap="left" class="progress_wrap"><div data-sound-hover-air="" class="card_display pointer-events-none"><div class="camera-mask-cola"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6932ada7a7b613eba979c0ad_721188c26b8b1b025ef6abd0de9862b1_cola_visual.svg" loading="lazy" alt="" class="progress_shape"/><div class="progress_fill"></div><div class="progress_bg"></div></div></div></div><div progress-wrap="right" class="progress_wrap is-right"><div data-sound-hover-air="" class="card_display pointer-events-none"><div class="camera-mask-cola"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6932ada7a7b613eba979c0ad_721188c26b8b1b025ef6abd0de9862b1_cola_visual.svg" loading="lazy" alt="" class="progress_shape"/><div class="progress_fill"></div><div class="progress_bg"></div></div></div></div><div class="progress_mask w-embed"><style>
  .camera-mask-cola {
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }

  .camera-mask-cola {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6932ada7bcb050f8373a364c_cola_mask.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6932ada7bcb050f8373a364c_cola_mask.svg);
  }
</style></div><div class="progress_js w-embed w-script"><style>
.progress_fill {
  width: 100%;
  height: 0%;
	background-color: #66e9c5;
  transform-origin: bottom;
}
</style>


<script>
document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(ScrollTrigger);

  const fills = document.querySelectorAll(".progress_fill");
  if (!fills.length) return;

  const offset = window.innerHeight * 0.2;

  ScrollTrigger.create({
    trigger: document.documentElement,
    start: offset,
    end: document.documentElement.scrollHeight - window.innerHeight,
    scrub: true,
    onUpdate: self => {
      const targetHeight = self.progress * 100 + "%";

      fills.forEach(el => {
        gsap.to(el, {
          height: targetHeight,
          duration: 0.25,
          ease: "power2.out"
        });
      });
    }
  });
});
</script></div></div></div><div class="change-bg lazy-section"></div><div class="page-wrapper"><h1 class="hero_display-seo">Andy Warhol by BL/S® A Curated Vision of Iconic Contemporary Art</h1><div class="global-styles"><div class="styles w-embed"><style>

/* Make text look crisper and more legible in all browsers */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

section {
  overflow-x: hidden;
	overflow-y: hidden;
}

[class*="tw1"] {
text-wrap: balance;
}

/* Focus state style for keyboard navigation for the focusable elements */
*[tabindex]:focus-visible,
  input[type="file"]:focus-visible {
   outline: 0.125rem solid #4d65ff;
   outline-offset: 0.125rem;
}

/* Set color style to inherit */
.inherit-color * {
    color: inherit;
}


/* Make sure containers never lose their center alignment */
.container-medium,.container-small, .container-large {
	margin-right: auto !important;
  margin-left: auto !important;
}


/* These classes are never overwritten */
.hide {
  display: none !important;
}

@media screen and (max-width: 991px) {
    .hide, .hide-tablet {
        display: none !important;
    }
}
  @media screen and (max-width: 767px) {
    .hide-mobile-landscape{
      display: none !important;
    }
}
  @media screen and (max-width: 479px) {
    .hide-mobile{
      display: none !important;
    }
}

/* CSS Animation */
@keyframes loop-spin {
  to {transform: rotate(360deg);}
}

@keyframes scaleup {
  from {opacity: 0; transform: scale(0.5);}
  to {opacity: 1; transform: scale(1);}
}



[data-z-index="-5"] { z-index: -5; }
[data-z-index="-4"] { z-index: -4; }
[data-z-index="-3"] { z-index: -3; }
[data-z-index="-2"] { z-index: -2; }
[data-z-index="-1"] { z-index: -1; }
[data-z-index="0"] { z-index: 0; }
[data-z-index="1"] { z-index: 1; }
[data-z-index="2"] { z-index: 2; }
[data-z-index="3"] { z-index: 3; }
[data-z-index="4"] { z-index: 4; }
[data-z-index="5"] { z-index: 5; }


.sup {
  font-size: 0.5em;
  vertical-align: super;  /* moves the character upward */
}

</style></div><div class="disables-copy-image w-embed w-script"><!-- Prevent image selection color when making selections -->
<style>
img::selection {
  background: transparent;
}
</style>


<!-- Disable scrolling beyond content, including "swipe off edge" on mobile -->
<style>
html,
body {
  overscroll-behavior-y: none;
}
</style>



<!-- Blocks drag and drop and right click for img, svg and links -->
<script>
  document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("contextmenu", (e) => {
      if (e.target.tagName === "IMG" || e.target.tagName === "SVG") {
        e.preventDefault();
      }
    });

    document.querySelectorAll("img, a, svg").forEach(el => {
      el.setAttribute("draggable", "false");
    });
  });
</script></div></div><div class="lottie_optimization lazy-section w-embed w-script"><!-- LOTTIE OPTIMIZATION -->
<script src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js"></script>
<script src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  const lottieElements = document.querySelectorAll(".decor_lottie");
  const sectionElvis = document.querySelector(".section_elvis");

  const lottieInstances = Array.from(lottieElements).map((element) => {
    return lottie.loadAnimation({
      container: element,
      renderer: "canvas",
      loop: true,
      autoplay: false,
    });
  });

  const observerLottie = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          lottieInstances.forEach((instance) => {
            instance.play();
          });
        } else {
          lottieInstances.forEach((instance) => {
            instance.stop();
          });
        }
      });
    },
    { threshold: 0.5 }
  );

  observerLottie.observe(sectionElvis);
});
</script></div><div class="lottie_logo w-embed w-script"><script>
document.addEventListener("DOMContentLoaded", function () {
  const brand = document.querySelector(".nav_brand");
  const logoContainer = document.querySelector(".nav_logo");

  if (!brand || !logoContainer || !window.lottie) return;

  const logoAnim = lottie.loadAnimation({
    container: logoContainer,
    renderer: "svg",
    loop: false,
    autoplay: false,
    path: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/691889de4a2c123c73adcb8f_Warhol_Art_logo.json"
  });

  logoAnim.addEventListener("DOMLoaded", () => {
    logoAnim.goToAndStop(0, true);
  });

  let isHovering = false;

  brand.addEventListener("mouseenter", () => {
    isHovering = true;
    logoAnim.loop = true;
    logoAnim.goToAndPlay(0, true);
  });

  brand.addEventListener("mouseleave", () => {
    isHovering = false;
    logoAnim.loop = false;
  });

  logoAnim.addEventListener("complete", () => {
    if (!isHovering) {
      logoAnim.goToAndStop(0, true);
    }
  });
});
</script></div><main class="main-wrapper"><div class="nav_fixed"><div class="nav-bg"></div><div data-animation="over-right" data-collapse="medium" data-duration="850" data-easing="ease-out-expo" data-easing2="ease-out-expo" data-doc-height="1" role="banner" class="nav_component w-nav"><div class="padding-global is-nav"><div class="nav_container"><nav role="navigation" class="nav_menu w-nav-menu"><div data-hide-on="tablet-mobile" class="nav_menu-grid hide-adaptives"><div id="w-node-ad9bb018-9cac-c29c-670e-d8ad9db30ad0-21f3a2ee" class="w-layout-hflex gap-2-5rem"><div><a aria-label="4 ELVIS" href="#4-elvis" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">ELVIS</p></a><p class="text-size-medium is-plus">​<br/></p><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-size-medium is-plus">+</p></div><a aria-label="QUOTE" href="#section-quote" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">QUOTE</p></a><a aria-label="BANANAS" href="#section-bananas" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">BANANAS</p></a><a aria-label="M. MONROE" href="#section-monroe" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">M. MONROE</p></a><a aria-label="EXPO" href="#section-expo" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">EXPO</p></a><div class="flex-nav-right space-between"><a aria-label="TICKETS" href="#sec-tickets" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">TICKETS</p></a><p class="text-size-medium is-plus">​<br/></p><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-size-medium is-plus">+</p></div></div><a href="#hero-section" data-hide-on="tablet-mobile" aria-label="logo" id="w-node-_61f41df6-304e-f9cb-fb6b-4f4292fbc8e2-21f3a2ee" class="nav_brand hide-adaptives w-nav-brand"><div class="nav_logo scaleup" data-w-id="e9193c75-ef79-023b-aa0e-a4abfbd49012" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/plugins/Animation/assets/wf-placeholder.cd67a2c2ba.json" data-loop="0" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg" data-default-duration="4.08" data-duration="0" data-loading="eager"></div></a><div id="w-node-f84c6389-2268-0206-9a49-22baac936a50-21f3a2ee" class="w-layout-hflex gap-5-5rem"><div class="w-layout-hflex gap-2-5rem"><div><a aria-label="404 ERROR" href="/newhome404" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">404 ERROR</p></a><p class="text-size-medium is-plus">​<br/></p><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-size-medium is-plus">+</p></div><a aria-label="MIRROR" href="#mirror" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">MIRROR</p></a><div class="flex-nav-right space-between"><div><a aria-label="BY BL/S®" href="#" class="navbar_link w-inline-block"><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-no-wrap">BY BL/S®</p></a></div><p class="text-size-medium is-plus">​<br/></p><p data-delay="3.5" text-split="" text-rotate-fade-in="" class="text-size-medium is-plus">+</p></div></div><a data-music-header-btn="true" aria-label="sound" href="#" class="sound_wrap gap-0-25rem scaleup w-inline-block"><div class="w-layout-hflex visualizer"><div data-lottie-sound="" class="canvas-audio" data-w-id="d8b13da9-b1a2-11ec-b2e9-0380682526bf" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/plugins/Animation/assets/wf-placeholder.cd67a2c2ba.json" data-loop="0" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg" data-default-duration="4.08" data-duration="0" data-loading="eager"></div></div><div class="navbar_sound-text"><p data-music-text="off" text-split="" text-rotate-fade-in="" data-delay="3.5" class="text-no-wrap is-on">On</p><p data-music-text="on" text-split="" text-rotate-fade-in="" data-delay="3.5" class="text-no-wrap is-off">Off</p><p class="text-no-wrap blank">Off</p></div></a></div></div><div data-hide-on="desktop" class="nav_menu-links-adaptives"><a aria-label="ELVIS" href="#4-elvis" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">ELVIS</p></a><a aria-label="QUOTE" href="#section-quote" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">QUOTE</p></a><a aria-label="BANANAS" href="#section-bananas" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">BANANAS</p></a><a aria-label="M. MONROE" href="#section-monroe" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">M. MONROE</p></a><a aria-label="EXPO" href="#section-expo" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">EXPO</p></a><a aria-label="TICKETS" href="#sec-tickets" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">TICKETS</p></a><a aria-label="404 error" href="/newhome404" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">404 ERROR</p></a><a aria-label="404 error" href="#mirror" class="navbar_link is-adaptives w-inline-block"><p class="text-no-wrap">MIRROR</p></a><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/679231a4b86f3e6eabdd82c2_ruler_adaptives_menu.svg" loading="lazy" alt="" class="absolute is-bottom is-menu"/><a data-music-header-btn="true" aria-label="sound" href="#" class="sound_wrap gap-0-25rem is-mobile w-inline-block"><div class="w-layout-hflex visualizer"><div data-lottie-sound="" class="canvas-audio" data-w-id="bbc2d3ee-3ace-7790-119f-93e78fa12112" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/plugins/Animation/assets/wf-placeholder.cd67a2c2ba.json" data-loop="0" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg" data-default-duration="4.08" data-duration="0" data-loading="eager"></div></div><div class="navbar_sound-text"><p data-music-text="on" text-split="" text-rotate-fade-in="" data-delay="3.5" class="text-no-wrap is-on">On</p><p data-music-text="off" text-split="" text-rotate-fade-in="" data-delay="3.5" class="text-no-wrap is-off">Off</p><p class="text-no-wrap blank">Off</p></div></a></div></nav><a href="#hero-section" data-hide-on="desktop" aria-label="logo" class="nav_brand hide-desktop w-nav-brand"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/67195098c93410168b7a9196_Logo.svg" alt="logo" class="nav_logo"/></a><div aria-label="menu" class="nav_button w-nav-button"><div aria-hidden="true" class="hamburger_8_wrap"><div class="hamburger_embed w-embed"><style>
.hamburger_8_wrap:hover .hamburger_8_text,
.w--open .hamburger_8_panel {
	transform: translateY(-100%);
}
</style></div><div class="hamburger_8_clip"><div class="hamburger_8_panel"><div class="hamburger_8_text">MENU</div><div class="hamburger_8_text is-2">MENU</div></div><div class="hamburger_8_panel is-2"><div class="hamburger_8_text">CLOSE</div><div class="hamburger_8_text is-2">CLOSE</div></div></div></div></div></div></div></div><div class="nav_scroll w-embed w-script"><script>
document.addEventListener("DOMContentLoaded", () => {
  const nav   = document.querySelector(".nav_component");
  const navBg = document.querySelector(".nav-bg");
  if (!nav || !navBg) return;

  /* ===========================
     ⚙️ SETTINGS
  ============================ */
  const SCROLL_TRIGGER_VH = 15;     // threshold where the background hides
  const SMOOTHNESS        = 0.07;   // inertia (same for nav and bg)
  const EASING            = "power2.out"; // not used directly (kept for consistency)

  const thresholdPx = window.innerHeight * (SCROLL_TRIGGER_VH / 100);

  /* ===========================
     STATE
  ============================ */
  let lastScroll = window.scrollY;
  let targetY = 0;
  let currentY = 0;
  let hidden = false;

  let targetBgY = -100; // moves up by default
  let currentBgY = -100;

  // Initial positions
  gsap.set(nav,   { yPercent: 0 });
  gsap.set(navBg, { yPercent: -100 });

  /* ===========================
     SCROLL LOGIC
  ============================ */
  window.addEventListener("scroll", () => {
    const cur = window.scrollY;
    const goingDown = cur > lastScroll;
    const goingUp = cur < lastScroll;
    lastScroll = cur;

    // --- NAVBAR ---
    if (cur <= thresholdPx) {
      targetY = 0;
      hidden = false;
    } else {
      if (goingDown && !hidden) {
        targetY = -100;
        hidden = true;
      } else if (goingUp && hidden) {
        targetY = 0;
        hidden = false;
      }
    }

    // --- NAV-BG ---
    if (cur <= thresholdPx) {
      // In the top zone, the background moves up independently
      targetBgY = -100;
    } else {
      // Below 15vh, the background is synced with nav_component
      targetBgY = targetY;
    }
  });

  /* ===========================
     GSAP TICKER (shared smoothing)
  ============================ */
  gsap.ticker.add(() => {
    // --- nav ---
    currentY += (targetY - currentY) * SMOOTHNESS;
    gsap.set(nav, { yPercent: currentY });

    // --- nav-bg ---
    currentBgY += (targetBgY - currentBgY) * SMOOTHNESS;
    gsap.set(navBg, { yPercent: currentBgY });
  });
});
</script></div></div>`,
} as const;
