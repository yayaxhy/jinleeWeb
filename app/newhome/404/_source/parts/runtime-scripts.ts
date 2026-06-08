export const runtimeScriptsPart = {
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
} as const;
