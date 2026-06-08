import { newhomeHoverVideoEmbedHtml } from '@/lib/newhome-hover-fix';

export const heroPart = {
  id: "hero",
  html:
    String.raw`<section id="hero-section" data-scroll-time="0.5" class="section_hero"><div data-hide-on="tablet-mobile" class="background_component"><div class="background_image-container"><div class="background_gradient-wrapper"><div class="background_gradient"></div></div><div class="background_edge-gradient"></div><div class="background_image-wrappe"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy.avif 2400w" alt="" loading="eager" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy.avif" class="background_image"/></div><div class="background_image-gradient"></div></div><div class="andy-face-bg-code"><div data-hide-on="tablet-mobile" class="hero_bg-css w-embed"><!-- BG HERO CURSOR ON ANDY WARHOL PHOTO -->
<style>
  .background_gradient {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(at center, hsla(0, 0.00%, 0.00%, 0.00), var(--black) 46%);
    z-index: -1;
  }

  .background_image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    transform: translate(0, 0);
    transition: transform 0.1s ease-out;
  }

  body {
    margin: 0;
    height: auto;
		overflow-x: hidden;
  }
</style></div><div data-hide-on="tablet-mobile" class="hero_bg-js w-embed w-script"><!-- BG HERO CURSOR -->
<script src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  const section = document.querySelector(".section_hero") || document.querySelector(".section_404");
  const gradient = document.querySelector(".background_gradient");
  const image = document.querySelector(".background_image");
  
  let isInViewport = false;
  if (!section || !gradient || !image) return;

  let currentX = 50;
  let currentY = 50;
  let targetX = 50;
  let targetY = 50;
  
  let currentTranslateX = 0;
  let currentTranslateY = 0;
  let targetTranslateX = 0;
  let targetTranslateY = 0;

  const smoothing = 0.1;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isInViewport = entry.isIntersecting;
      });
    },
    { threshold: 0.5 }
  );
  observer.observe(section);

  document.addEventListener("mousemove", function (event) {
    if (!isInViewport) return;
    
    let windowWidth = window.innerWidth;
    if (windowWidth > 990) {
      let windowHeight = window.innerHeight;
      let intensity = 3;

      targetX = Math.round((event.pageX / windowWidth) * 100);
      targetY = Math.round((event.pageY / windowHeight) * 100);
      
      targetTranslateX = Math.round(((event.pageX / windowWidth) * 10 - 5) * intensity);
      targetTranslateY = Math.round(((event.pageY / windowHeight) * 10 - 5) * intensity);
    }
  });

  function animate() {
    if (isInViewport) {
      currentX += (targetX - currentX) * smoothing;
      currentY += (targetY - currentY) * smoothing;
      currentTranslateX += (targetTranslateX - currentTranslateX) * smoothing;
      currentTranslateY += (targetTranslateY - currentTranslateY) * smoothing;

      gradient.style.background = \`radial-gradient(at \${currentX}% \${currentY}%, hsla(0, 0.00%, 0.00%, 0.00), var(--black) 46%)\`;
      image.style.transform = \`translate(\${currentTranslateX}px, \${currentTranslateY}px)\`;
    }

    requestAnimationFrame(animate);
  }

  animate();
});
</script></div></div></div><div class="padding-global padding-section-hero"><div class="container-large"><div class="spacer-3 position-relative"></div><div class="display_mask w-embed"><style>
	.button_mask,
  .camera-mask,
  .camera-mask-0 {
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }

  .camera-mask-w {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f49_d9782d1c59ed78842d599fab24281cb0_letter_w.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f49_d9782d1c59ed78842d599fab24281cb0_letter_w.svg);
  }

	  .camera-mask-a {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f47_4627f779c2bedce03b68879323e31e86_letter_a.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f47_4627f779c2bedce03b68879323e31e86_letter_a.svg);
  }

	  .camera-mask-r {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f48_2a63317ddee4bdb40dec855565843229_letter_r.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f48_2a63317ddee4bdb40dec855565843229_letter_r.svg);
  }

	  .camera-mask-h {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f4b_68e678bf0c9e299c46998f6f785db529_letter_h.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f4b_68e678bf0c9e299c46998f6f785db529_letter_h.svg);
  }

	  .camera-mask-o {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f4a_e9e82821bceeabf263559418ee316929_letter_o.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f4a_e9e82821bceeabf263559418ee316929_letter_o.svg);
  }

	  .camera-mask-l {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f46_f6401b8c99295a771d834f361974c864_letter_l.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6918e79713a76fb895b04f46_f6401b8c99295a771d834f361974c864_letter_l.svg);
  }
  

</style></div><div class="warhol_load-split w-embed w-script"><style>
  /* Hide cards before initialization to prevent flickering */
  .card_display {
    visibility: hidden;
  }

  /* Base fill color for letters */
  .letter-color-full {
    background-color: #FFE5D5;
  }
</style>

<script>
window.Webflow ||= [];
window.Webflow.push(() => {
  // === SETTINGS ===
  const BASE_COLOR    = "#FFE5D5"; // beige
  const OVERLAY_COLOR = "#FB4E2B"; // red

  const LETTER_DELAY      = 0.08; // delay between letter appearance (scale)
  const SPRING_DURATION   = 0.8;  // duration of the spring effect after appearance
  const OVERLAY_DELAY     = 0.09; // delay between letters in the color wave (stagger)
  const OVERLAY_DURATION  = 0;    // 0 → instant switch

  // Read delay the same way as in the old WARHOL code
  let BASE_DELAY = 3.5;
  const delaySource =
    document.querySelector('[wb-element="rainbow-text"]') ||
    document.querySelector('.hero_display');

  if (delaySource) {
    const attrDelay = parseFloat(delaySource.getAttribute('data-delay'));
    if (!isNaN(attrDelay)) BASE_DELAY = attrDelay;
  }

  // Elements
  const cards = gsap.utils.toArray(".card_display");
  const fills = gsap.utils.toArray(".letter-color-full");

  if (!cards.length || !fills.length) return;

  // Show cards without flickering
  gsap.set(cards, { autoAlpha: 1 });

  // Initial letter color — red
  gsap.set(fills, { backgroundColor: OVERLAY_COLOR });

  // === 1) Letter appearance with spring effect ===
  gsap.from(cards, {
    scale: 0,
    opacity: 0,
    delay: BASE_DELAY,
    stagger: LETTER_DELAY,
    transformOrigin: "center center",
    ease: "elastic.out(1, 0.55)",
    duration: 1.2
  });

  // === 2) Instant color switch to beige, sequentially ===

  const lastIndex        = cards.length - 1;
  const lastLetterStart  = BASE_DELAY + lastIndex * LETTER_DELAY;
  const overlayStartBase = lastLetterStart + SPRING_DURATION;

  gsap.to(fills, {
    backgroundColor: BASE_COLOR,
    delay: overlayStartBase,
    duration: 0, // instant
    stagger: OVERLAY_DELAY, // left to right
    ease: "none"
  });
});
</script></div><div class="warhol_rotate w-embed w-script"><style>
  /* 3D for letter cards */
  .hero_display-wrapper {
    perspective: 1600px;
    transform-style: preserve-3d;
  }
  .card_display {
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
    transform: translateZ(0);
    position: relative;
  }
  /* glow inside letter */
  .card_display .glow {
    will-change: transform, opacity;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.25) 0%, rgba(192, 132, 252, 0.1) 40%, transparent 70%);
  }
</style>



<script>
document.addEventListener("DOMContentLoaded", () => {
  // === SETTINGS ===
  const MAX_ROTATE_X = 6;      // down
  const MAX_ROTATE_X_TOP = 3;  // up
  const MAX_ROTATE_Y = 12;     // left/right
  const SMOOTH = 0.12;         // normal smoothness
  const SMOOTH_RESET = 0.06;   // smoothness on reset
  const GLOW_MAX_X_PERCENT = 75;
  const GLOW_MAX_Y_PERCENT = 85;
  const GLOW_MIN_OPACITY = 0.05;
  const GLOW_MAX_OPACITY = 0.4;

  // === HELPERS ===
  const lerp = (a, b, n) => a + (b - a) * n;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  
  // === DOM ELEMENTS ===
  const triggerArea = document.querySelector(".section_hero");
  if (!triggerArea) return;
  const cards = Array.from(triggerArea.querySelectorAll(".card_display"));
  const glows = Array.from(triggerArea.querySelectorAll(".glow"));
  
  // === STATE ===
  let mouseInside = false;
  let animationFrameId = null;
  
  let targetRX = 0;
  let targetRY = 0;
  
  let currentRX = 0;
  let currentRY = 0;

  // === EVENT HANDLERS ===
  const onWindowMouseMove = (event) => {
    // Always get the latest element position to handle scrolling
    const rect = triggerArea.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const isCurrentlyInside = event.clientX >= rect.left &&
                              event.clientX <= rect.right &&
                              event.clientY >= rect.top &&
                              event.clientY <= rect.bottom;

    if (isCurrentlyInside) {
      if (!mouseInside) {
        // Entered the area
        mouseInside = true;
        if (animationFrameId === null) {
          tick();
        }
      }

      // Calculate rotation
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      const dx = (x - midX) / midX;
      const dy = (y - midY) / midY;

      targetRY = dx * MAX_ROTATE_Y;
      if (dy < 0) {
        targetRX = -dy * MAX_ROTATE_X_TOP;
      } else {
        targetRX = -dy * MAX_ROTATE_X;
      }
    } else {
      if (mouseInside) {
        // Left the area
        mouseInside = false;
        targetRX = 0;
        targetRY = 0;
      }
    }
  };

  const onDocumentMouseLeave = () => {
    if (mouseInside) {
      mouseInside = false;
      targetRX = 0;
      targetRY = 0;
    }
  };

  // === RENDER LOOP ===
  const tick = () => {
    const smoothFactor = mouseInside ? SMOOTH : SMOOTH_RESET;
    
    currentRX = lerp(currentRX, targetRX, smoothFactor);
    currentRY = lerp(currentRY, targetRY, smoothFactor);
    
    // Apply transform to cards
    const transformStyle = \`rotateX(\${currentRX}deg) rotateY(\${currentRY}deg)\`;
    cards.forEach(card => {
      card.style.transform = transformStyle;
    });

    // Calculate and apply glow effect
    const normX = clamp(currentRY / MAX_ROTATE_Y, -1, 1);
    const normY = clamp(currentRX / MAX_ROTATE_X, -1, 1);
    
    const glowX = -normX * GLOW_MAX_X_PERCENT;
    const glowY = normY * GLOW_MAX_Y_PERCENT;
    const intensity = 1 - Math.min(1, Math.abs(normX));
    const glowOpacity = GLOW_MIN_OPACITY + (GLOW_MAX_OPACITY - GLOW_MIN_OPACITY) * intensity;
    
    const glowTransformStyle = \`translateX(\${glowX}%) translateY(\${glowY}%)\`;
    glows.forEach(glow => {
        glow.style.transform = glowTransformStyle;
        glow.style.opacity = glowOpacity;
    });
    
    const isAtRest = Math.abs(currentRX - targetRX) < 0.01 && 
                     Math.abs(currentRY - targetRY) < 0.01;

    if (!mouseInside && isAtRest) {
      // Settle to final position and stop loop
      currentRX = 0;
      currentRY = 0;
      animationFrameId = null;
    } else {
      animationFrameId = requestAnimationFrame(tick);
    }
  };
  
  // === BIND LISTENERS ===
  window.addEventListener("mousemove", onWindowMouseMove);
  document.documentElement.addEventListener("mouseleave", onDocumentMouseLeave);
});
</script></div>` +
    newhomeHoverVideoEmbedHtml +
    String.raw`<div class="hero_display-wrapper"><div data-sound-hover-air="" class="card_display"><div class="camera-mask-w"><div class="width-7ch"></div><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-w" class="background-video w-background-video w-background-video-atom"><video id="ac085182-b906-31d4-b76e-d7eba4708a47-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div><div data-sound-hover-air="" class="card_display"><div class="camera-mask-a"><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-a" class="background-video w-background-video w-background-video-atom"><video id="d33c80f2-a001-4c28-094c-0946a1b16276-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div><div data-sound-hover-air="" class="card_display"><div class="camera-mask-r"><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-r" class="background-video w-background-video w-background-video-atom"><video id="a5a45bcb-57ad-7a82-2dcc-07068f8d990b-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div><div data-sound-hover-air="" class="card_display"><div class="camera-mask-h"><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-h" class="background-video w-background-video w-background-video-atom"><video id="d88bc430-0e40-44f3-8e75-d362d3c6f2f9-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div><div data-sound-hover-air="" class="card_display"><div class="camera-mask-o"><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-o" class="background-video w-background-video w-background-video-atom"><video id="bfc02378-2d66-6657-a373-a88c77db3c20-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div><div data-sound-hover-air="" class="card_display"><div class="camera-mask-l"><div class="letter-color-full"></div><div class="glow"></div><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video="letter-l" class="background-video w-background-video w-background-video-atom"><video id="b383f8b4-b464-a02d-2e64-f606fcc44686-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div></div><div><div class="spacer-3"></div><div class="spacer-3"></div><div class="spacer-3"></div><div class="spacer-3"></div><div class="spacer-3"></div></div><div class="hero_content-bottom"><a aria-label="tube-button" id="w-node-e6a3310c-4360-93e6-0109-0d92c4c486f7-21f3a2ee" data-w-id="e6a3310c-4360-93e6-0109-0d92c4c486f7" href="#" class="button-tube-wrapper w-inline-block"><div data-is-ix2-target="1" class="button-tube is-click" data-w-id="7b91ec4c-e059-d681-065a-ff0ca0a46ab5" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756f8ee56272db205d741f1_warhol-paint.json" data-loop="0" data-direction="1" data-autoplay="0" data-renderer="svg" data-default-duration="0" data-duration="3.966666666666667" data-loading="eager"></div><div data-is-ix2-target="1" class="button-tube" data-w-id="3662527b-4ff1-41fa-6d52-77153b6b0454" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756f8ee56272db205d741f1_warhol-paint.json" data-loop="0" data-direction="1" data-autoplay="0" data-renderer="svg" data-default-duration="0" data-duration="3.966666666666667" data-loading="eager"></div><div class="button-tube_js w-embed w-script"><script>
  $('.button-tube-wrapper').click(function(e) {
    e.preventDefault();

    setTimeout(function() {

      $('html, body').animate({
        scrollTop: $('#4-elvis').offset().top
      }, 500);
    }, 1000);
  });
</script></div></a><div id="w-node-_5d6b4d50-c851-f177-4057-43d71c39af0f-21f3a2ee"><div class="flex-vert-decor-4 is-absolute-centr"><p text-rotate-fade-in="" text-split="" class="text-color-beige-100 text-color-beige-300">∞</p><div text-rotate-fade-in="" text-split="" class="flex-horiz-decor-2 flex-baseline"><p class="decor-text-30-regular">PRAGUE, </p><p class="decor-text-30-regular">CZECH REPUBLIC,</p><p class="decor-text-14">2025</p></div><div class="flex-horiz-decor-2 flex-baseline"><p class="decor-text-30-regular opacity-0 _11"> </p><p text-rotate-fade-in="" text-split="" class="decor-text-30">ANDY WARHOL</p></div><div text-rotate-fade-in="" text-split="" class="flex-horiz-decor-2 flex-baseline"><p class="decor-text-30">( EXHIBITION )</p><p class="decor-text-30-regular">THE MASTER OF POP ART</p></div></div></div><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a057aee42ab7a8e9b0294_Andy-text.svg" loading="lazy" id="w-node-_23ed6629-6e38-2089-ddd8-4df47e798393-21f3a2ee" alt="" class="hero_andy-text"/></div></div></div><div class="nav-trigger-hero"></div></section>`,
} as const;
