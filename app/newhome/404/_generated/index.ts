export const newhomeDocument = {
  htmlAttributes: {
  "data-wf-domain": "newhome.local",
  "data-wf-page": "6718c8afa78e156621f3a2f1",
  "data-wf-site": "6718c8afa78e156621f3a2ed",
  "data-wf-status": "1",
  "lang": "en"
} as const,
  title: "Page (404) Error",
  description: "",
  preambleHtml: String.raw`<!-- This site was created in Webflow. https://webflow.com --><!-- Last Published: Wed Apr 01 2026 08:59:42 GMT+0000 (Coordinated Universal Time) -->`,
  postambleHtml: String.raw``,
  headHtml: String.raw`<meta charset="utf-8"/><title>Page (404) Error</title><meta content="Don&#x27;t worry, this page just decided to become part of Andy&#x27;s art." name="description"/><meta content="Page (404) Error" property="og:title"/><meta content="Don&#x27;t worry, this page just decided to become part of Andy&#x27;s art." property="og:description"/><meta content="Page (404) Error" property="twitter:title"/><meta content="Don&#x27;t worry, this page just decided to become part of Andy&#x27;s art." property="twitter:description"/><meta property="og:type" content="website"/><meta content="summary_large_image" name="twitter:card"/><meta content="width=device-width, initial-scale=1" name="viewport"/><meta content="Webflow" name="generator"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/css/warhol-arts.webflow.shared.57f88b5c4.min.css" rel="stylesheet" type="text/css" crossorigin="anonymous"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/css/warhol-arts.webflow.6718c8afa78e156621f3a2f1-f37cfc272.min.css" rel="stylesheet" type="text/css" crossorigin="anonymous"/><script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);</script><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6718cc3a2ba1e4f264788f01_Favicon.png" rel="shortcut icon" type="image/x-icon"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6718cc3ee98386f75783cb9a_Webclip.png" rel="apple-touch-icon"/>



<!-- Delays loading of sections after preloader -->
<style>
.lazy-section {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease-in-out;
}

.lazy-section.active {
  opacity: 1;
  visibility: visible;
}
</style>



<!-- Text selection color -->
<style>
::selection {
  background-color: #FB4E2B;
  color: #FFE5D5;
}

.hero_display {
  user-select: none;
}
</style>



<!-- Custom scroll bar -->
<style>

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #353535;
}

::-webkit-scrollbar-thumb {
  background: #727272;
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: #8A8A8A;
}

</style>



<!-- Lenis smooth scroll -->
<style>
html.lenis {
  height: auto;
}
.lenis.lenis-smooth {
  scroll-behavior: auto;
}
.lenis.lenis-smooth [data-lenis-prevent] {
  overscroll-behavior: contain;
}
.lenis.lenis-stopped {
  overflow: hidden;
}
</style>`,
  bodyParts: [
    {
      id: "frame",
      html: String.raw`<div class="page-wrapper"><div class="global-styles"><div class="styles w-embed"><style>

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
</script></div></div><div class="_404_mask-css w-embed"><style>
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

  .camera-mask {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678e53d7486fb3f891016bf5_mask-number-4.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678e53d7486fb3f891016bf5_mask-number-4.svg);
  }
  
  .camera-mask-0 {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678e53d76945cb4759bc621d_mask-number-0.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/678e53d76945cb4759bc621d_mask-number-0.svg);
  }

  .button-mask {
    -webkit-mask-image: url(/newhome/assets/cdn.prod.website-files.com/65e61ac90950149fdb15e419/65e6c9014b1b88e8b4f5f90e_button-mask.svg);
    mask-image: url(/newhome/assets/cdn.prod.website-files.com/65e61ac90950149fdb15e419/65e6c9014b1b88e8b4f5f90e_button-mask.svg);
  }
</style></div><main class="main-wrapper">`,
    },
    {
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
    },
    {
      id: "runtimeScripts",
      html: String.raw`<script src="/newhome/assets/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__516609640c.js" type="text/javascript" crossorigin="anonymous"></script><script src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/js/webflow.d9036e15.c1ac75ec64f205e5.js" type="text/javascript" crossorigin="anonymous"></script><!-- Delays loading of sections after preloader and hero -->
<script>
  document.addEventListener("DOMContentLoaded", () => {
    const preloader = document.querySelector(".preloader");
    const lazySections = document.querySelectorAll(".lazy-section");

    const activateLazySections = () => {
      lazySections.forEach((section) => {
        section.classList.add("active");
      });
    };

    const handlePreloaderEnd = () => {
      preloader.style.display = "none";
      activateLazySections();
    };

    const preloaderObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.style.display === "none") {
          handlePreloaderEnd();
          preloaderObserver.disconnect();
        }
      });
    });

    preloaderObserver.observe(preloader, { attributes: true, attributeFilter: ["style"] });
  });
</script>




<script defer src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script defer src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script defer src="/newhome/assets/unpkg.com/split-type"></script>
<script defer src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
<script defer src="/newhome/assets/cdn.jsdelivr.net/gh/studio-freight/lenis_1.0.23/bundled/lenis.min.js"></script>




<script>
let lenis;
if (Webflow.env("editor") === undefined) {
  lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1,
    gestureOrientation: "vertical",
    normalizeWheel: false,
    smoothTouch: false
  });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}
$("[data-lenis-start]").on("click", function () {
  lenis.start();
});
$("[data-lenis-stop]").on("click", function () {
  lenis.stop();
});
$("[data-lenis-toggle]").on("click", function () {
  $(this).toggleClass("stop-scroll");
  if ($(this).hasClass("stop-scroll")) {
    lenis.stop();
  } else {
    lenis.start();
  }
});
</script>


<!-- Hide elements in DOM by attributes: adaptives or desktop -->
<script>
function hideElementsOnResize() {
  const elementsToHide = document.querySelectorAll("[data-hide-on]");

  elementsToHide.forEach(element => {
    const hideOn = element.getAttribute("data-hide-on");

    const shouldHide = 
      (hideOn === "desktop" && window.innerWidth >= 1024) ||
      (hideOn === "tablet" && window.innerWidth >= 768 && window.innerWidth < 1024) ||
      (hideOn === "mobile" && window.innerWidth < 768) ||
      (hideOn === "tablet-mobile" && window.innerWidth < 1024);

    if (shouldHide && element.parentNode) {
      element.remove();
    }
  });
}

window.addEventListener("DOMContentLoaded", hideElementsOnResize);
window.addEventListener("resize", hideElementsOnResize);
</script>





<!-- Text rotate fade in -->
<script src="/newhome/assets/ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>

<script>
window.addEventListener("DOMContentLoaded", () => {
  new SplitType("[text-split]", {
    types: "words, chars",
    tagName: "span"
  });
  
  function createScrollTrigger(triggerElement, timeline) {
    ScrollTrigger.create({
      trigger: triggerElement,
      start: "top bottom",
      onLeaveBack: () => {
        timeline.progress(0).pause();
      }
    });
    ScrollTrigger.create({
      trigger: triggerElement,
      start: "top 85%",
      onEnter: () => timeline.play()
    });
  }
  
  $("[text-rotate-fade-in]").each(function () {
    const delay = parseFloat($(this).attr("data-delay")) || 0;
    const speed = parseFloat($(this).attr("data-speed")) || 1;
    const duration = 0.6 / speed;
    const stagger = 0.03 / speed;
    
    const tl = gsap.timeline({ paused: true });
    tl.from($(this).find(".char"), {
      rotation: -45,
      opacity: 0,
      transformOrigin: "0% 50%",
      duration: duration,
      ease: "back.out(2)",
      stagger: stagger,
      delay: delay
    });
    createScrollTrigger($(this), tl);
  });
  
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  if (!isTouchDevice) {
    $("[text-rotate-fade-hover]").each(function () {
      const element = $(this);
      const speed = parseFloat(element.attr("data-speed")) || 1;
      const duration = (parseFloat(element.attr("data-duration")) || 0.6) / speed;
      const stagger = (parseFloat(element.attr("data-stagger")) || 0.03) / speed;
      
      const tlIn = gsap.timeline({ paused: true });
      const tlOut = gsap.timeline({ paused: true });
      
      tlIn.to(element.find(".char"), {
        rotation: -45,
        opacity: 0,
        transformOrigin: "0% 50%",
        duration: duration * 0.5,
        ease: "power2.in",
        stagger: stagger
      }).to(element.find(".char"), {
        rotation: 0,
        opacity: 1,
        duration: duration * 0.5,
        ease: "back.out(2)",
        stagger: stagger
      });
      
      element.on("mouseenter", function() {
        tlOut.pause();
        tlIn.restart();
      });
      
      element.on("mouseleave", function() {
        tlIn.pause();
        gsap.to(element.find(".char"), {
          rotation: 0,
          opacity: 1,
          duration: 0.3 / speed,
          ease: "power2.out"
        });
      });
    });
  }
  
  gsap.set("[text-split]", { opacity: 1 });
});
</script>



<script>
eval(atob('KGZ1bmN0aW9uKCl7dmFyIHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtzLmlubmVySFRNTD0nW2NsYXNzKj0id2ViZmxvdyJdW2NsYXNzKj0iYmFkZ2UiXXtkaXNwbGF5Om5vbmUhaW1wb3J0YW50O3Zpc2liaWxpdHk6aGlkZGVuIWltcG9ydGFudDtvcGFjaXR5OjAhaW1wb3J0YW50O3Bvc2l0aW9uOmFic29sdXRlIWltcG9ydGFudDtsZWZ0Oi05OTk5cHghaW1wb3J0YW50fS53LXdlYmZsb3ctYmFkZ2V7ZGlzcGxheTpub25lIWltcG9ydGFudH0nO2RvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQocyk7dmFyIGg9ZnVuY3Rpb24oKXt2YXIgZT1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbY2xhc3MqPSJ3ZWJmbG93Il1bY2xhc3MqPSJiYWRnZSJdLCAudy13ZWJmbG93LWJhZGdlJyk7ZS5mb3JFYWNoKGZ1bmN0aW9uKGVsKXtlbC5zdHlsZS5jc3NUZXh0PSdkaXNwbGF5Om5vbmUhaW1wb3J0YW50O3Zpc2liaWxpdHk6aGlkZGVuIWltcG9ydGFudDtvcGFjaXR5OjAhaW1wb3J0YW50O3Bvc2l0aW9uOmFic29sdXRlIWltcG9ydGFudDtsZWZ0Oi05OTk5cHghaW1wb3J0YW50J30pfTtzZXRUaW1lb3V0KGgsMTAwKTtzZXRUaW1lb3V0KGgsNTAwKTtzZXRUaW1lb3V0KGgsMTAwMCk7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsaCk7d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLGgpfSkoKTs='));
</script>





<!-- Always start page from the top on reload -->
<!--
<script>
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}

window.onload = function() {
  setTimeout(function() {
    window.scrollTo(0, 0);
  }, 10);
};

document.addEventListener("DOMContentLoaded", function() {
  window.scrollTo(0, 0);
});

window.addEventListener("beforeunload", function() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});
</script>
-->

<!-- Always start page from the top on reload -->
<script>
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;

document.addEventListener("DOMContentLoaded", function() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

window.addEventListener("load", function() {
  setTimeout(function() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 0);
});

setTimeout(function() {
  window.scrollTo(0, 0);
}, 50);
</script><script>
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      document.addEventListener("click", () => {
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            if (response === "granted") {
              initializeDeviceOrientation();
            }
          })
          .catch(console.error);
      });
    } else {
      initializeDeviceOrientation();
    }
  }

  function initializeDeviceOrientation() {
    const firstSwing = document.getElementById("firstSwing");
    const secondSwing = document.getElementById("secondSwing");
    const thirdSwing = document.getElementById("thirdSwing");

    let smoothedGamma = 0;
    let smoothedBeta = 0;
    const lerpFactor = 0.1; // Медленнее сглаживание
    const threshold = 1; // Более чувствительный порог
    let isAnimating = false;

    function applyTransform(element, tiltY, tiltX, delay) {
      setTimeout(() => {
        if (element) {
          element.style.transition = \`transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)\`; // Более плавный easing
          element.style.transform = \`rotateY(\${tiltY}deg) rotateX(\${tiltX}deg)\`;
        }
      }, delay);
    }

    function handleOrientation(event) {
      const rawGamma = event.gamma || 0;
      const rawBeta = event.beta || 0;

      smoothedGamma = lerp(smoothedGamma, rawGamma, lerpFactor);
      smoothedBeta = lerp(smoothedBeta, rawBeta, lerpFactor);

      const maxTiltY = 75;
      const maxTiltX = 50;

      const tiltY = Math.max(-maxTiltY, Math.min(maxTiltY, smoothedGamma));
      const tiltX = -Math.max(-maxTiltX, Math.min(maxTiltX, smoothedBeta));

      if (Math.abs(rawGamma - smoothedGamma) < threshold && Math.abs(rawBeta - smoothedBeta) < threshold) {
        return;
      }

      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(() => {
          applyTransform(firstSwing, tiltY, tiltX, 0);
          applyTransform(secondSwing, tiltY, tiltX, 300);
          applyTransform(thirdSwing, tiltY, tiltX, 600);
          isAnimating = false;
        });
      }
    }

    window.addEventListener("deviceorientation", handleOrientation);
  }

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }
</script>`,
    },
  ] as const,
} as const;
