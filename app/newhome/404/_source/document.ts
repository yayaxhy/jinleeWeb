import { framePart } from './parts/frame';
import { notFoundScenePart } from './parts/not-found-scene';
import { runtimeScriptsPart } from './parts/runtime-scripts';

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
  bodyParts: [framePart, notFoundScenePart, runtimeScriptsPart] as const,
} as const;
