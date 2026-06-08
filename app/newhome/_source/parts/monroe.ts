export const monroePart = {
  id: "monroe",
  html: String.raw`<section id="section-monroe" data-scroll-time="0.5" data-w-id="3e9155fa-b7aa-ca6d-6793-39e599b26da6" class="section_monroe lazy-section"><div class="padding-global padding-section-large"><div class="container-medium position-relative"><div data-hide-on="desktop" class="container-small monroe_adaptive"><div data-delay="2" text-split="" text-rotate-fade-in="" class="flex-monroe-right-top text-color-brown-200 is-adapt"><p class="decor-text-30-regular">00<span class="text-weight-thin">_</span>3</p><p class="text-tomato-weight-extra-l">NY</p></div><div class="flex-monroe-right text-color-brown-200"><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;</p><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;</p><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;&gt;</p><div class="flex-horizontal-6"><div class="flex-quote-left"><p data-delay="2" text-split="" text-rotate-fade-in="">POP</p><p data-delay="2" text-split="" text-rotate-fade-in="">ICON</p><p data-delay="2" text-split="" text-rotate-fade-in="">4x M</p><p data-delay="2" text-split="" text-rotate-fade-in="">CMYK</p></div><div class="flex-quote-left"><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-color-beige-300">-</p><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-color-beige-300">//</p><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-no-wrap opacity-0">//</p><p data-delay="2" text-split="" text-rotate-fade-in="" class="text-color-beige-300">//</p></div><div class="flex-quote-left"><p data-delay="2" text-split="" text-rotate-fade-in="">∞</p><p data-delay="2" text-split="" text-rotate-fade-in="">2.0</p><p class="opacity-0">1</p><p data-delay="2" text-split="" text-rotate-fade-in="">FX</p></div></div></div></div><div class="container-small position-relative"><div class="full-wrapper cs-cursor"><div class="backround-wrapper"><div class="custom-styles w-embed"><style>
.cs-cursor {
	cursor: url("/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671b7085c9596cd3a3d317bc_icon-cursor-images.svg") 35 25, auto;
}

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
</style></div><div class="auto-loop-on-small-screens w-embed w-script"><script>
document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".section_monroe");

  if (!section) return;

  const TRIGGERS = [...document.getElementsByClassName("full-center")];
  const SPEED = 1000;
  let animationActive = false;

  function changer(index) {
    if (!animationActive) return;
    TRIGGERS[index].classList.add("active");
    setTimeout(() => {
      TRIGGERS[index].classList.remove("active");
      if (index + 1 >= TRIGGERS.length) {
        changer(0);
      } else {
        changer(index + 1);
      }
    }, SPEED);
  }

  const observerMonroeSection = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && window.innerWidth <= 768) {
          if (!animationActive) {
            animationActive = true;
            changer(0);
          }
        } else if (!entry.isIntersecting) {
          if (animationActive) {
            animationActive = false;
          }
        }
      });
    },
    {
      root: null,
      rootMargin: "0px",
      threshold: 0.5,
    }
  );

  observerMonroeSection.observe(section);
});
</script></div><div class="video-monroe w-embed w-script"><!-- lazy load and control for Monroe video -->

<script>
document.addEventListener("DOMContentLoaded", () => {

  const trigger = document.querySelector('[data-video-m="video-m-trigger"]');
  const videoWrapper = trigger?.querySelector('[data-video-m="video-monroe"]');
  if (!videoWrapper) return;

  const video = videoWrapper.querySelector("video");
  if (!video) return;

  const MP4 = "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed_691b7b7fdcff6d5bab2a9357_Marilyn_video-2_mp4.mp4";
  const WEBM = "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed_691b7b7fdcff6d5bab2a9357_Marilyn_video-2_webm.webm";

  let loaded = false;
  const section = document.getElementById("section-monroe");

  const isMobile = () => window.innerWidth <= 991;

  // 1. Lazy load
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {

      if (entry.isIntersecting && !loaded) {

        video.innerHTML = \`
          <source src="\${WEBM}" type="video/webm">
          <source src="\${MP4}" type="video/mp4">
        \`;
        video.load();

        video.loop = true;

        loaded = true;

        // Mobile autoplay
        if (isMobile()) {
          video.play();
        }
      }

      // Mobile: stop outside, play inside
      if (isMobile()) {
        if (entry.isIntersecting) {
          if (loaded) video.play();
        } else {
          video.pause();
        }
      }

    });
  }, { threshold: 0.3 });

  sectionObserver.observe(section);

  // 2. Desktop hover logic
  if (!isMobile()) {

    trigger.addEventListener("mouseenter", () => {
      if (loaded) {
        video.loop = true;
        video.play();
      }
    });

    trigger.addEventListener("mouseleave", () => {
      if (loaded) {
        video.pause();
      }
    });
  }

});
</script></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55cbcf589a23ea5a02_Marilyn_Monroe_2.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55878ce1c00230864d_Marilyn_Monroe_3-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55878ce1c00230864d_Marilyn_Monroe_3-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55878ce1c00230864d_Marilyn_Monroe_3-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55878ce1c00230864d_Marilyn_Monroe_3.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55878ce1c00230864d_Marilyn_Monroe_3.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b557f48c7dfeeedec36_Marilyn_Monroe_4-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b557f48c7dfeeedec36_Marilyn_Monroe_4-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b557f48c7dfeeedec36_Marilyn_Monroe_4-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b557f48c7dfeeedec36_Marilyn_Monroe_4.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b557f48c7dfeeedec36_Marilyn_Monroe_4.avif" loading="lazy" class="background-media"/></div></div></div><div data-video-m="video-m-trigger" class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55bc23bb5255eaa7e3_Marilyn_Monroe_5.avif" loading="lazy" class="background-media opacity-0"/><div data-video-urls="" data-autoplay="false" data-loop="false" data-wf-ignore="true" data-video-m="video-monroe" class="background-media absolute-full w-background-video w-background-video-atom"><video id="4b0fda87-e002-7ad6-6be6-5bafe8459f83-video" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"></video></div></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553d235fe76002511f_Marilyn_Monroe_6-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553d235fe76002511f_Marilyn_Monroe_6-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553d235fe76002511f_Marilyn_Monroe_6-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553d235fe76002511f_Marilyn_Monroe_6.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553d235fe76002511f_Marilyn_Monroe_6.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b555265d50ef4378e73_Marilyn_Monroe_7-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b555265d50ef4378e73_Marilyn_Monroe_7-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b555265d50ef4378e73_Marilyn_Monroe_7-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b555265d50ef4378e73_Marilyn_Monroe_7.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b555265d50ef4378e73_Marilyn_Monroe_7.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55b1f2709c8a73aee4_Marilyn_Monroe_8-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55b1f2709c8a73aee4_Marilyn_Monroe_8-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55b1f2709c8a73aee4_Marilyn_Monroe_8-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55b1f2709c8a73aee4_Marilyn_Monroe_8.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55b1f2709c8a73aee4_Marilyn_Monroe_8.avif" loading="lazy" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b55d13bf5a074147233_Marilyn_Monroe_9.avif" alt="Marilyn Monroe" class="background-media"/></div></div></div><div class="background-trigger"><div class="full-center pointer-events-none"><div class="background-media-wrapper"><img sizes="100vw" srcset="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b5693843dcc44f02924_Marilyn_Monroe_10-p-500.avif 500w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b5693843dcc44f02924_Marilyn_Monroe_10-p-800.avif 800w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b5693843dcc44f02924_Marilyn_Monroe_10-p-1080.avif 1080w, /newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b5693843dcc44f02924_Marilyn_Monroe_10.avif 1920w" alt="Marilyn Monroe" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b5693843dcc44f02924_Marilyn_Monroe_10.avif" loading="lazy" class="background-media"/></div></div></div></div></div><div class="monroe_heading-left"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671aa8354bf8d4558e80e346_Vivid_Colors.svg" loading="lazy" alt="" class="blending-difference"/></div><div data-hide-on="tablet-mobile" class="monroe_dots-left hide-adaptives"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671b6b1cd00fb8bea78775b2_shape-dots.svg" loading="lazy" alt="" class="monroe_dots-shape"/></div><div class="monroe_heading-right"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671aa8358b8a706c1fc9c985_ICON_REBORN.svg" loading="lazy" alt="" class="blending-difference"/></div></div><div data-hide-on="tablet-mobile" class="monroe_decor-wrap hide-adaptives"><div data-delay="0.5" text-split="" text-rotate-fade-in="" class="flex-quote-left text-color-brown-200"><p class="text-no-wrap">10 Faces,</p><p class="text-no-wrap">1 Iconic Legend.</p></div><div class="flex-quote-right"><div class="flex-monroe-right text-color-brown-200"><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;</p><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;</p><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-tomato-weight-extra-l">&gt;&gt;</p><div class="flex-horizontal-6"><div class="flex-quote-left"><p data-delay="0.5" text-split="" text-rotate-fade-in="">POP</p><p data-delay="0.5" text-split="" text-rotate-fade-in="">ICON</p><p data-delay="0.5" text-split="" text-rotate-fade-in="">4x M</p><p data-delay="0.5" text-split="" text-rotate-fade-in="">CMYK</p></div><div class="flex-quote-left"><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-color-beige-300">-</p><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-color-beige-300">//</p><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-no-wrap opacity-0">//</p><p data-delay="0.5" text-split="" text-rotate-fade-in="" class="text-color-beige-300">//</p></div><div class="flex-quote-left"><p data-delay="0.5" text-split="" text-rotate-fade-in="">∞</p><p data-delay="0.5" text-split="" text-rotate-fade-in="">2.0</p><p class="opacity-0">1</p><p data-delay="0.5" text-split="" text-rotate-fade-in="">FX</p></div></div></div></div></div><div data-hide-on="tablet-mobile" text-split="" text-rotate-fade-in="" data-delay="0.5" class="flex-monroe-right-top text-color-brown-200 hide-adaptives"><p class="decor-text-30-regular">00<span class="text-weight-thin">_</span>3</p><p class="text-tomato-weight-extra-l">NY</p></div><div data-hide-on="desktop" class="container-small monroe_adaptive-bottom"><div data-delay="" text-split="" text-rotate-fade-in="" class="flex-quote-left text-color-brown-200"><p class="text-no-wrap">4 Faces,</p><p class="text-no-wrap">1 Iconic Legend.</p></div></div></div></div></section>`,
} as const;
