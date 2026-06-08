export const notFoundScenePart = {
  id: "notFoundScene",
  html: String.raw`<section id="hero-section" data-scroll-time="0.5" data-w-id="a7bba4c9-d36a-7962-ffc0-3d4c337940fe" class="section_404"><div data-hide-on="tablet-mobile" class="background_component"><div class="background_image-container"><div class="background_gradient-wrapper"><div class="background_gradient"></div></div><div class="background_edge-gradient"></div><div class="background_image-wrappe"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy.avif 2400w" alt="" loading="eager" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671909bf803b9bd37a5e3c97_bg-hero_andy.avif" class="background_image"/></div><div class="background_image-gradient"></div></div><div class="andy-face-bg-code"><div data-hide-on="tablet-mobile" class="hero_bg-css w-embed"><!-- BG HERO CURSOR ON ANDY WARHOL PHOTO -->
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
</script></div></div></div><div data-w-id="a7bba4c9-d36a-7962-ffc0-3d4c33794109" class="padding-global padding-section-large is-404"><div class="container-custom-1360 flex-vertical-between is-404"><div class="custom-styles w-embed"><style>
.pointer-events-none {
	pointer-events: none;
}

.full-center.active {
	opacity: 1;
}

@media (min-width: 1024px) {
	.background-trigger:hover .full-center {
		opacity: 1;
	}
}
</style></div><div><div id="topSwing" text-split="" text-rotate-fade-in="" class="flex-horizontal is-404-05rem flex-baseline"><div class="decor-text-30">Page</div><div class="flex-horizontal is-404-05rem"><div class="decor-text-404 is-parentheses">(</div><div class="decor-text-404">404</div><div class="decor-text-404 is-parentheses">)</div></div><div class="decor-text-30">Error</div></div><div class="spacer-16px"></div><div><div class="_404_decor-icons"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star loop-spin"/><div class="border-horizontal-wrap"><div class="border-horizontal is-shadow"></div></div><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star loop-spin"/></div><div class="spacer-8px"></div><div class="mobile-max-90"><p text-rotate-fade-in="" text-split="" class="text-size-regular text-color-beige-300">Don&#x27;t worry, this page just decided to become part of Andy&#x27;s art.</p><div class="spacer-44px"></div><div class="_404-help-text w-embed w-script"><style>
  @keyframes blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .blinking {
    animation: blink 1s infinite;
  }

  .transparent {
    color: transparent;
    transition: color 0.5s ease; /* Плавный переход */
  }
</style>




<script>
  document.addEventListener("DOMContentLoaded", () => {
    const text404 = document.getElementById("text-404");
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    let blinkingTimeout;

    if (text404) {
      if (isMobile) {
        blinkingTimeout = setTimeout(() => {
          text404.classList.add("blinking");
        }, 2000);

        document.addEventListener("click", () => {
          clearTimeout(blinkingTimeout);
          text404.classList.remove("blinking");
          text404.classList.add("transparent");
        });
      }
    }
  });
</script></div></div></div></div><div class="_404_visual-wrapper scaleup"><div id="firstSwing" class="card_root"><div class="camera-mask"><div data-w-id="10053eac-e4d3-07f9-5388-a05e440dbad3" class="_404_backround-wrapper-1"><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f634a9606a490a1552bf6_404-mask-1.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f634a1a056c8740219172_404-mask-2.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f634a93795981b3173a1e_404-mask-3.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f8010b71900b5516d3000_404-mask-1-4.avif" alt="" class="background-media"/></div></div></div></div><div class="glow"></div></div></div><div id="secondSwing" class="card_root"><div class="camera-mask-0"><div data-w-id="c67aa1d6-a19e-4342-92cf-d3608faeee7b" class="_404_backround-wrapper-2"><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f810a579dc184d19bb50b_404-mask-2-1.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f810a2aba5628cd8b6a03_404-mask-2-2.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f810a7ca3d262280026c5_404-mask-2-3.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f810a3849963660520410_404-mask-2-4.avif" alt="" class="background-media"/></div></div></div></div><div class="glow"></div></div><div class="_404_help-text-wrapper"><p id="text-404" text-split="" text-rotate-fade-in="" class="text-size-regular text-color-beige-100">PLEASE TAP THE SCREEN</p></div></div><div id="thirdSwing" class="card_root"><div class="camera-mask"><div data-w-id="0d763b93-afd5-643c-825d-0e5711a14044" class="_404_backround-wrapper-3"><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f81ec384996366052d5f7_404-mask-3-1.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f81eb1f6816f8c5c07c15_404-mask-3-2.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f81eb16334f650a7d0e79_404-mask-3-3.avif" alt="" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678f81eb691f81bf5fb929ca_404-mask-3-4.avif" alt="" class="background-media"/></div></div></div></div><div class="glow"></div></div></div></div><div><div><div><div class="spacer-44px"></div><p text-rotate-fade-in="" text-split="" class="text-size-regular text-color-beige-300">Shall we start over?</p></div><div class="spacer-8px"></div><div class="_404_decor-icons"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star loop-spin"/><div class="border-horizontal-wrap"><div class="border-horizontal is-shadow-bottom"></div></div><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star loop-spin"/></div></div><div class="spacer-16px"></div><a id="BottomSwing" role="button" aria-label="go-back" href="/newhome" class="button-cube is-404 w-node-_1787fb9b-a797-4b89-6400-8c1df6df5fe5-21f3a2f1 w-inline-block"><div class="cube-wrapper is-404"><div class="cube-face-1 is-404"><div class="text-3d-button is-404">go back</div><div><div class="button-cube_dot-404 is-top-left"></div><div class="button-cube_dot-404 is-top-right"></div><div class="button-cube_dot-404 is-buttom-right"></div><div class="button-cube_dot-404 is-buttom-left"></div></div></div><div class="cube-face-2 is-404"><div class="text-3d-button is-404">go back</div><div><div class="button-cube_dot-404 is-top-left"></div><div class="button-cube_dot-404 is-top-right"></div><div class="button-cube_dot-404 is-buttom-right"></div><div class="button-cube_dot-404 is-buttom-left"></div></div></div><div class="cube-face-3 is-404"><div class="text-3d-button is-404">go back</div><div><div class="button-cube_dot-404 is-top-left"></div><div class="button-cube_dot-404 is-top-right"></div><div class="button-cube_dot-404 is-buttom-right"></div><div class="button-cube_dot-404 is-buttom-left"></div></div></div><div class="cube-face-4 is-404"><div class="text-3d-button is-404">go back</div><div><div class="button-cube_dot-404 is-top-left"></div><div class="button-cube_dot-404 is-top-right"></div><div class="button-cube_dot-404 is-buttom-right"></div><div class="button-cube_dot-404 is-buttom-left"></div></div></div></div></a></div></div></div></section></main></div>`,
} as const;
