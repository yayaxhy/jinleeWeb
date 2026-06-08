export const runtimeScriptsPart = {
  id: "runtimeScripts",
  html: String.raw`<script src="/newhome/assets/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__516609640c.js" type="text/javascript" crossorigin="anonymous"></script><script src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/js/webflow.ffa5c1f6.0856072fcde1f3cf.js" type="text/javascript" crossorigin="anonymous"></script><!-- Delays loading of sections after preloader and hero -->
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
</script><!-- Audio-reactive system with procedural sound generation using the Web Audio API. -->
<script>
(function () {
  var APP_CONFIG = {
      'urls': {
          'music': "/newhome/assets/raw.githubusercontent.com/iroms01/warhol-audio/main/sound_bg.mp3",
          'lottie': "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/694184f847e38582877cd8f8_Sound_wave.json"
      },
      'volumes': {
          'music': 0.2,
          'hover': 0.5,
          'click': 0.5,
          'air': 1.0
      },
      'soundParams': {
          'default_hover': { 'type': 'fm', 'freqStart': 2000, 'attack': 0.001, 'decay': 0.02, 'gain': 0.04, 'detune': 150 },
          'default_click': { 'type': 'fm', 'freqStart': 2000, 'attack': 0.001, 'decay': 0.05, 'gain': 0.1, 'detune': 300 },
          'air_hover': { 'type': 'noise', 'attack': 0.1, 'decay': 0.5, 'gain': 0.03, 'filterFreq': 600 }
      },
      'timing': {
          'initDelay': 5000,
          'fadeDuration': 1000,
          'syncDelay': 100
      },
      'slowMo': {
          'rate': 0.7,
          'freq': 600,
          'smooth': 0.05
      },
      'selectors': {
          'toggleBtn': '[data-music="bttn-turn-on"]',
          'clickElement': 'a, button, [data-sound-click], [data-music-header-btn="true"]',
          'hoverElement': 'a, button, [data-sound-hover], [data-music-header-btn="true"]',
          'hoverAirElement': '[data-sound-hover-air]',
          'ignoreElement': '[data-no-sound]',
          'panelOff': '[sound-panel]',
          'panelOn': '[sound-panel-2]',
          'headerBtn': '[data-music-header-btn="true"]',
          'bannerBtn': '[data-banner="bttn-later"]',
          'textOn': '[data-music-text="on"]',
          'textOff': '[data-music-text="off"]',
          'triggerSlowMo': '.nav_brand',
          'lottieContainer': '[data-lottie-sound]'
      }
  };

  var ctx, src, audio, bgFilter, masterGain;
  var noiseBuffer = null;
  var playing = false;
  var sfxActive = false;
  var init = false;
  var unlocked = false;
  var initTimer = null;
  var targetPlaybackRate = 1.0;
  var firstPlay = true;
  var lottieAnims = [];
  var lottieLoopSegment = null;

  var hBtns = document.querySelectorAll(APP_CONFIG.selectors.headerBtn);
  var brandTrigger = document.querySelector(APP_CONFIG.selectors.triggerSlowMo);
  var lottieContainers = document.querySelectorAll(APP_CONFIG.selectors.lottieContainer);
  
  var panelOffEls = document.querySelectorAll(APP_CONFIG.selectors.panelOff);
  var panelOnEls = document.querySelectorAll(APP_CONFIG.selectors.panelOn);
  var textOnEls = document.querySelectorAll(APP_CONFIG.selectors.textOn);
  var textOffEls = document.querySelectorAll(APP_CONFIG.selectors.textOff);

  function setupLottie() {
      if (typeof lottie === 'undefined' || lottieContainers.length === 0) {
          return;
      }

      lottieContainers.forEach(function(container) {
          var anim = lottie.loadAnimation({
              'container': container,
              'renderer': 'svg',
              'loop': false,
              'autoplay': false,
              'path': APP_CONFIG.urls.lottie
          });

          anim.addEventListener('DOMLoaded', function() {
              if (lottieLoopSegment) return;
              var totalFrames = anim.totalFrames;
              var startFrame = Math.floor(totalFrames * 0.10);
              var endFrame = Math.floor(totalFrames * 0.90);
              lottieLoopSegment = [startFrame, endFrame];
          });

          anim.addEventListener('complete', function() {
              if (playing) {
                  if (lottieLoopSegment) {
                      anim.loop = true;
                      anim.playSegments(lottieLoopSegment, true);
                  }
              } else {
                  anim.goToAndStop(0, true);
              }
          });

          lottieAnims.push(anim);
      });
  }

  function createNoiseBuffer() {
      if (!ctx) return;
      var bufferSize = ctx.sampleRate * 2;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  function playProcedural(presetKey) {
      if (!ctx || !unlocked) return;
      if (ctx.state === "suspended") ctx.resume();

      if (presetKey === 'air_hover') {
          if (playing) return;
      } else {
          if (!sfxActive) return;
      }

      var params = APP_CONFIG.soundParams[presetKey];
      if (!params) return;

      var volumeScale = presetKey === 'air_hover' ? APP_CONFIG.volumes.air :
                         presetKey.includes('hover') ? APP_CONFIG.volumes.hover :
                         APP_CONFIG.volumes.click;

      var t = ctx.currentTime;
      var gainNode = ctx.createGain();
      var sourceNode, endNode;

      if (params.type === 'noise') {
          if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
          sourceNode = ctx.createBufferSource();
          sourceNode.buffer = noiseBuffer;
          
          var filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(params.filterFreq, t);
          
          sourceNode.connect(filter);
          endNode = filter;
      } else {
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(params.freqStart, t);

          var mod = ctx.createOscillator();
          mod.type = 'square';
          mod.frequency.setValueAtTime(params.freqStart * 2, t);
          if (params.detune) mod.detune.setValueAtTime(params.detune, t);

          var modGain = ctx.createGain();
          modGain.gain.setValueAtTime(100, t);
          modGain.gain.exponentialRampToValueAtTime(0.01, t + params.decay);

          mod.connect(modGain);
          modGain.connect(osc.frequency);
          mod.start(t);
          mod.stop(t + params.attack + params.decay + 0.1);
          
          sourceNode = osc;
          endNode = osc;
      }

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(params.gain * volumeScale, t + params.attack);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + params.attack + params.decay);

      endNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      sourceNode.start(t);
      sourceNode.stop(t + params.attack + params.decay + 0.1);
  }

  window.playWarholSound = playProcedural;

  function setSlowMotion(active) {
      if (!init || !bgFilter) return;
      var now = ctx.currentTime;

      targetPlaybackRate = active ? APP_CONFIG.slowMo.rate : 1.0;
      bgFilter.frequency.cancelScheduledValues(now);
      bgFilter.frequency.setTargetAtTime(
          active ? APP_CONFIG.slowMo.freq : 22000,
          now,
          active ? 0.5 : 0.2
      );
  }
  
  function audioUpdateLoop() {
      if (audio && audio.playbackRate !== targetPlaybackRate) {
          audio.playbackRate += (targetPlaybackRate - audio.playbackRate) * APP_CONFIG.slowMo.smooth;
      }
      requestAnimationFrame(audioUpdateLoop);
  }

  function animateText(el) {
      if (typeof SplitType === 'undefined' || typeof gsap === 'undefined') return;
      if (el.querySelector('.char')) el.textContent = el.textContent;

      try {
          new SplitType(el, { 'types': "words, chars", 'tagName': "span" });
          var chars = el.querySelectorAll('.char');
          if (chars.length) {
              gsap.fromTo(chars,
                  { 'rotation': -45, 'opacity': 0, 'transformOrigin': "0% 50%" },
                  { 'rotation': 0, 'opacity': 1, 'duration': 0.6, 'ease': "back.out(2)", 'stagger': 0.03 }
              );
          }
      } catch (e) {}
  }

  function ui(forceAnim) {
      for (var i = 0; i < panelOffEls.length; i++) {
          panelOffEls[i].hidden = playing;
      }
      for (var j = 0; j < panelOnEls.length; j++) {
          panelOnEls[j].hidden = !playing;
      }

      lottieContainers.forEach(function(container) {
          container.style.display = 'block';
      });

      if (playing) {
          for (var k = 0; k < textOnEls.length; k++) {
              textOnEls[k].style.display = "none";
          }
          for (var l = 0; l < textOffEls.length; l++) {
              var el = textOffEls[l];
              if (!forceAnim && el.style.display === "block") continue;
              el.style.display = "block";
              animateText(el);
          }
      } else {
          for (var m = 0; m < textOffEls.length; m++) {
              textOffEls[m].style.display = "none";
          }
          for (var n = 0; n < textOnEls.length; n++) {
              var el2 = textOnEls[n];
              if (!forceAnim && el2.style.display === "block") continue;
              el2.style.display = "block";
              animateText(el2);
          }
      }
  }

  function syncVisibleLottie() {
      if (!playing || !lottieLoopSegment || lottieAnims.length === 0) return;
      
      lottieAnims.forEach(function(anim) {
          var isVisible = anim.wrapper && anim.wrapper.offsetParent !== null;
          if (isVisible && anim.isPaused) {
              anim.loop = false;
              anim.playSegments([[0, lottieLoopSegment[1]]], true);
          }
      });
  }

  function toggleMusic(state) {
      if (!init) return;
      if (ctx.state === "suspended") ctx.resume();
      if (playing === state) return;

      playing = state;
      ui();
      
      var fadeDurationInSeconds = APP_CONFIG.timing.fadeDuration / 1000;
      var now = ctx.currentTime;
      
      if (state) {
          if (firstPlay) {
              audio.currentTime = 0;
              firstPlay = false;
          }
          
          audio.play().catch(function() {});
          
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(APP_CONFIG.volumes.music, now + fadeDurationInSeconds);
          
      } else {
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeDurationInSeconds);
      }

      if (lottieAnims.length > 0 && lottieLoopSegment) {
          lottieAnims.forEach(function(anim) {
              var isVisible = anim.wrapper && anim.wrapper.offsetParent !== null;
              
              if (isVisible) {
                  if (playing) {
                      anim.loop = false;
                      anim.playSegments([[0, lottieLoopSegment[1]]], true);
                  } else {
                      anim.loop = false;
                  }
              } else {
                  anim.goToAndStop(8, true);
              }
          });
      }
  }

  function setup() {
      if (init) return;

      try {
          var AC = window.AudioContext || window.webkitAudioContext;
          ctx = new AC();
          noiseBuffer = createNoiseBuffer();

          audio = new Audio();
          audio.crossOrigin = "anonymous";
          audio.src = APP_CONFIG.urls.music;
          audio.loop = true;

          src = ctx.createMediaElementSource(audio);
          
          masterGain = ctx.createGain();
          masterGain.gain.value = 0.0001;
          
          bgFilter = ctx.createBiquadFilter();
          bgFilter.type = "lowpass";
          bgFilter.frequency.value = 22000;

          src.connect(masterGain);
          masterGain.connect(bgFilter);
          bgFilter.connect(ctx.destination);

          audio.play().catch(function() {});

          init = true;
      } catch (e) {}
  }

  hBtns.forEach(function(btn) {
      btn.dataset.blocked = "true";
  });

  document.addEventListener("click", function(e) {
      var t = e.target;
      var sel = APP_CONFIG.selectors;

      var isHeaderBtn = t.closest(sel.headerBtn);
      var isMusicControl = isHeaderBtn;
      var isBannerBtn = t.closest(sel.bannerBtn);
      var isToggleBtn = t.closest(sel.toggleBtn);
      
      var skipGenericClick = false;

      if (isMusicControl && !unlocked) {
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
      }

      if (isBannerBtn) {
          unlocked = true;
          sfxActive = false;
          hBtns.forEach(function(btn) {
              btn.removeAttribute("data-blocked");
          });
          if (init && ctx.state === "suspended") ctx.resume();
          if (!init) setup();
      }

      if (isToggleBtn && !isMusicControl) {
          unlocked = true;
          sfxActive = true;
          skipGenericClick = true;
          hBtns.forEach(function(btn) {
              btn.removeAttribute("data-blocked");
          });
          if (!init) {
              if (initTimer) clearTimeout(initTimer);
              setup();
          }
          toggleMusic(true);
      }

      if (isMusicControl) {
          sfxActive = true;
          toggleMusic(!playing);
      }

      if (sfxActive && !skipGenericClick) {
          var soundTarget = t.closest(sel.clickElement);
          if (soundTarget && !soundTarget.closest(sel.ignoreElement)) {
              playProcedural('default_click');
          }
      }
      
      setTimeout(syncVisibleLottie, APP_CONFIG.timing.syncDelay);
      
  }, true);

  document.addEventListener("mouseover", function(e) {
      var targetEl = e.target;
      var airTarget = targetEl.closest(APP_CONFIG.selectors.hoverAirElement);
      if (airTarget) {
           if (targetEl.closest(APP_CONFIG.selectors.ignoreElement)) return;
           if (airTarget.dataset.soundPlaying) return;
           
           airTarget.dataset.soundPlaying = "true";
           playProcedural('air_hover');
           
           var onAirMouseLeave = function() {
              delete airTarget.dataset.soundPlaying;
              airTarget.removeEventListener("mouseleave", onAirMouseLeave);
           };
           airTarget.addEventListener("mouseleave", onAirMouseLeave);
           return;
      }

      if (!sfxActive || targetEl.closest(APP_CONFIG.selectors.ignoreElement)) return;

      var t = targetEl.closest(APP_CONFIG.selectors.hoverElement);
      if (t && !t.dataset.soundPlaying) {
          t.dataset.soundPlaying = "true";
          playProcedural('default_hover');
          var onMouseLeave = function() {
              delete t.dataset.soundPlaying;
              t.removeEventListener("mouseleave", onMouseLeave);
          };
          t.addEventListener("mouseleave", onMouseLeave);
      }
  });

  if (brandTrigger) {
      brandTrigger.addEventListener("mouseenter", function() { if (playing) setSlowMotion(true); });
      brandTrigger.addEventListener("mouseleave", function() { setSlowMotion(false); });
  }

  setupLottie();
  ui(true);
  audioUpdateLoop();

  initTimer = setTimeout(setup, APP_CONFIG.timing.initDelay);

})();
</script>
















<!-- SECTION QUOTE GSAP TEXT -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  gsap.registerPlugin(ScrollTrigger);

  function runSplit() {
    new SplitType(".split-word", { types: "lines, words" });
    
    document.querySelectorAll(".word").forEach(word => {
      word.appendChild(Object.assign(document.createElement("div"), {
        className: "line-mask"
      }));
    });
    
    gsap.to(".line-mask", {
      width: "0%",
      duration: 1,
      stagger: 0.5,
      scrollTrigger: {
        trigger: ".split-word",
        start: "top 85%",
        end: "bottom center",
        scrub: 1
      }
    });
  }

  runSplit();

});
</script>





<!-- Modal Window -->
<script>
const KEYCODES = { ESC: 27, TAB: 9 };

(window.requestIdleCallback || function (cb) {
  setTimeout(cb, 1);
})(() => {
  const btn = document.querySelector(".button-cube");
  const modal = document.querySelector("#modal");
  const modalBg = document.querySelector(".modal_bg");
  const modalContent = document.querySelector(".modal_content");
  const focusableSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const closers = document.querySelectorAll('[wb-data="close"]');

  let previousActiveElement = null;
  let focusableContent = [];
  let isOpen = false;

  const handleKeydown = (event) => {
    if (!isOpen) return;

    if (event.keyCode === KEYCODES.ESC) {
      closeModal();
      return;
    }

    if (event.keyCode !== KEYCODES.TAB) return;

    const first = focusableContent[0];
    const last = focusableContent[focusableContent.length - 1];

    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  };

  const openModal = () => {
    if (isOpen) return;
    isOpen = true;

    previousActiveElement = document.activeElement;
    focusableContent = modal.querySelectorAll(focusableSelector);

    modal.classList.add("is-open");

    requestAnimationFrame(() => {
      modalBg.classList.add("is-bg-visible");
    });

    document.addEventListener("keydown", handleKeydown);

    setTimeout(() => {
      modalContent.classList.add("is-content-visible");
    }, 220);

    setTimeout(() => {
      window.playWarholSound?.("air_hover");
    }, 520);

    focusableContent[0]?.focus();
  };

  const closeModal = () => {
    if (!isOpen) return;
    isOpen = false;

    modalContent.classList.add("is-closing");

    setTimeout(() => {
      modalBg.classList.remove("is-bg-visible");
    }, 520);

    setTimeout(() => {
      window.playWarholSound?.("air_hover");
    }, 150);

    document.removeEventListener("keydown", handleKeydown);

    setTimeout(() => {
      modal.classList.remove("is-open");
      modalContent.classList.remove("is-closing", "is-content-visible");
      previousActiveElement?.focus();
    }, 1000);
  };

  btn?.addEventListener("click", openModal);
  btn?.addEventListener("touchstart", openModal);

  modalBg?.addEventListener("click", closeModal);

  closers.forEach(c => c.addEventListener("click", closeModal));
});
</script>




<!-- SVG Render -->
<script>
$(document).ready(function () {
  const svgs = $('[svg="animated"]');
  const state = new WeakMap();

  function setupSVG(svgEl) {
    const paths = svgEl.find("path").toArray().map(path => {
      const length = path.getTotalLength();
      $(path).css({
        "stroke-dasharray": length,
        "stroke-dashoffset": length,
        "transition": "none"
      });
      return { el: path, length };
    });

    svgEl.css("opacity", 0);
    state.set(svgEl[0], { paths, animated: false });
  }

  function resetSVG(svgEl) {
    const data = state.get(svgEl[0]);
    if (!data || !data.animated) return;

    svgEl.css("opacity", 0);
    data.paths.forEach(p => {
      $(p.el).css({
        "stroke-dashoffset": p.length,
        "transition": "none"
      });
    });

    data.animated = false;
  }

  function animateSVG(svgEl) {
    const data = state.get(svgEl[0]);
    if (!data || data.animated) return;

    const duration = svgEl.attr("svg-animation-time") || 5000;
    const delay = svgEl.attr("svg-delay") || 0;

    setTimeout(() => {
      svgEl.css("opacity", 1);
      data.paths.forEach(p => {
        $(p.el).css({
          "transition": \`stroke-dashoffset \${duration}ms ease-out\`,
          "stroke-dashoffset": 0
        });
      });
    }, delay);

    data.animated = true;
  }

  function checkVisibility() {
    const winTop = $(window).scrollTop();
    const winBottom = winTop + $(window).height();

    svgs.each(function () {
      const svgEl = $(this);
      const top = svgEl.offset().top;
      const height = svgEl.outerHeight();

      const isVisible = winBottom > top && winTop < top + height;

      isVisible ? animateSVG(svgEl) : resetSVG(svgEl);
    });
  }

  svgs.each(function () {
    setupSVG($(this));
  });

  $(window).on("scroll resize", checkVisibility);
  checkVisibility();
});
</script>`,
} as const;
