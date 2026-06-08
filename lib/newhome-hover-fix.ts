const newhomeHoverVideoScriptContent = String.raw`(function () {
  const VIDEO_MAP = {
    "letter-w": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919ccd90a94a7e0a7915eec_Pete-Rose_video-new_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919ccd90a94a7e0a7915eec_Pete-Rose_video-new_webm.webm"
    },
    "letter-a": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c78fa82e91cc2c752b23_Cow_video_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c78fa82e91cc2c752b23_Cow_video_webm.webm"
    },
    "letter-r": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7b3ccd7c46fc1cf5431_Ingrid-Bergman-With-Hat_video_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7b3ccd7c46fc1cf5431_Ingrid-Bergman-With-Hat_video_webm.webm"
    },
    "letter-h": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7b78fde4561a84e233b_Marilyn_video_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7b78fde4561a84e233b_Marilyn_video_webm.webm"
    },
    "letter-o": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7bb8db2cf6fcdb42e9c_Queen-Elizabeth-II_video_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7bb8db2cf6fcdb42e9c_Queen-Elizabeth-II_video_webm.webm"
    },
    "letter-l": {
      mp4: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7c51e45f5c5b6368400_Jimmy-Carter_video_mp4.mp4",
      webm: "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6919c7c51e45f5c5b6368400_Jimmy-Carter_video_webm.webm"
    }
  };

  function setupHoverVideos() {
    document.querySelectorAll(".background-video[data-video]").forEach((block) => {
      if (!(block instanceof HTMLElement) || block.dataset.hoverFixReady === "true") {
        return;
      }

      const urls = VIDEO_MAP[block.dataset.video || ""];
      if (!urls) {
        return;
      }

      const video = block.querySelector("video");
      const mask = block.parentElement;
      const overlay = mask ? mask.querySelector(".letter-color-full") : null;

      if (!(video instanceof HTMLVideoElement) || !(mask instanceof HTMLElement)) {
        return;
      }

      block.dataset.hoverFixReady = "true";
      block.style.opacity = "0";
      block.style.transition = "opacity 120ms linear";

      video.muted = true;
      video.defaultMuted = true;
      video.loop = false;
      video.preload = "auto";
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");

      if (!video.querySelector("source")) {
        video.insertAdjacentHTML(
          "beforeend",
          '<source src="' + urls.mp4 + '" type="video/mp4">' +
            '<source src="' + urls.webm + '" type="video/webm">'
        );
      }

      try {
        video.load();
      } catch (_error) {}

      const playVideo = () => {
        mask.dataset.hoverVideoActive = "true";
        block.style.opacity = "1";
        if (overlay instanceof HTMLElement) {
          overlay.style.opacity = "0";
          overlay.style.transition = "opacity 120ms linear";
        }
        video.currentTime = 0;
        video.loop = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      };

      const stopVideo = () => {
        mask.dataset.hoverVideoActive = "false";
        block.style.opacity = "0";
        if (overlay instanceof HTMLElement) {
          overlay.style.opacity = "1";
        }
        video.pause();
        video.currentTime = 0;
        video.loop = false;
      };

      video.addEventListener("canplay", () => {
        if (mask.dataset.hoverVideoActive === "true") {
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
        }
      });

      mask.addEventListener("mouseenter", playVideo);
      mask.addEventListener("mouseleave", stopVideo);
      mask.addEventListener("pointerenter", playVideo);
      mask.addEventListener("pointerleave", stopVideo);
      mask.addEventListener("focusin", playVideo);
      mask.addEventListener("focusout", stopVideo);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupHoverVideos, { once: true });
  } else {
    setupHoverVideos();
  }

  window.addEventListener("load", setupHoverVideos, { once: true });
})();
`;

export const newhomeHoverVideoScriptHtml = `<script>${newhomeHoverVideoScriptContent}</script>`;

export const newhomeHoverVideoEmbedHtml = String.raw`<div class="warhol_hover-video w-embed w-script">${newhomeHoverVideoScriptHtml}</div>`;
