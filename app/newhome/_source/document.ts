import { framePart } from './parts/frame';
import { heroPart } from './parts/hero';
import { elvisPart } from './parts/elvis';
import { quotePart } from './parts/quote';
import { bananasPart } from './parts/bananas';
import { monroePart } from './parts/monroe';
import { expoPart } from './parts/expo';
import { ticketsPart } from './parts/tickets';
import { footerPart } from './parts/footer';
import { runtimeScriptsPart } from './parts/runtime-scripts';

export const newhomeDocument = {
  htmlAttributes: {
  "data-wf-domain": "newhome.local",
  "data-wf-page": "6718c8afa78e156621f3a2ee",
  "data-wf-site": "6718c8afa78e156621f3a2ed",
  "data-wf-status": "1",
  "lang": "en"
} as const,
  title: "WarholArts ©",
  description: "",
  preambleHtml: String.raw`<!-- This site was created in Webflow. https://webflow.com --><!-- Last Published: Wed Apr 01 2026 08:59:42 GMT+0000 (Coordinated Universal Time) -->`,
  postambleHtml: String.raw``,
  headHtml: String.raw`<meta charset="utf-8"/><title>WarholArts ©</title><meta content="Step into Andy Warhol&#x27;s iconic Pop Art universe. Explore 80+ works including Four Elvises, Marilyn Monroe, and more. Exhibition in Prague, Czech Republic 2025." name="description"/><meta content="WarholArts ©" property="og:title"/><meta content="Step into Andy Warhol&#x27;s iconic Pop Art universe. Explore 80+ works including Four Elvises, Marilyn Monroe, and more. Exhibition in Prague, Czech Republic 2025." property="og:description"/><meta content="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756e32958c64c115526b030_Open_Graph_Image.webp" property="og:image"/><meta content="WarholArts ©" property="twitter:title"/><meta content="Step into Andy Warhol&#x27;s iconic Pop Art universe. Explore 80+ works including Four Elvises, Marilyn Monroe, and more. Exhibition in Prague, Czech Republic 2025." property="twitter:description"/><meta content="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756e32958c64c115526b030_Open_Graph_Image.webp" property="twitter:image"/><meta property="og:type" content="website"/><meta content="summary_large_image" name="twitter:card"/><meta content="width=device-width, initial-scale=1" name="viewport"/><meta content="Webflow" name="generator"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/css/warhol-arts.webflow.shared.57f88b5c4.min.css" rel="stylesheet" type="text/css" crossorigin="anonymous"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/css/warhol-arts.webflow.6718c8afa78e156621f3a2ee-a12b652b9.min.css" rel="stylesheet" type="text/css" crossorigin="anonymous"/><style>@media (min-width:992px) {html.w-mod-js:not(.w-mod-ix) [data-w-id="1b307d4c-65ec-4dac-555b-701491b6dec0"] {opacity:1;}html.w-mod-js:not(.w-mod-ix) [data-w-id="10417f15-7e69-da06-babd-3229aec13735"] {opacity:1;}}</style><script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);</script><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6718cc3a2ba1e4f264788f01_Favicon.png" rel="shortcut icon" type="image/x-icon"/><link href="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6718cc3ee98386f75783cb9a_Webclip.png" rel="apple-touch-icon"/><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "WarholArts © - A Journey into the Iconic World of Andy Warhol",
  "description": "A curated vision of iconic contemporary art featuring Andy Warhol's most celebrated works including Four Elvises, Marilyn Monroe series, and a collection of 80+ iconic pieces. Exhibition in Prague, Czech Republic.",
  "url": "/newhome",
  "image": [
    "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6755a51958b8db2a614d0745_andy_1.avif",
    "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif",
    "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a9b553bbff2f4d647087a_Marilyn_Monroe_1.avif"
  ],
  "about": {
    "@type": "Person",
    "name": "Andy Warhol",
    "description": "Pop Icon and Master of Pop Art"
  },
  "publisher": {
    "@type": "Organization",
    "name": "WarholArts",
    "url": "/newhome",
    "email": "info@warholarts.com",
    "telephone": "+420 912 345 678",
    "sameAs": [
      "https://www.instagram.com/blacklead.studio/",
      "https://dribbble.com/blacklead-studio",
      "https://www.linkedin.com/company/blacklead-studio/"
    ]
  }
}
</script>



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
</style><!-- Text GSAP Quote Section -->
<style>
.split-word {
  text-align: center;
  line-height: 1.2;
}

.split-word .line {
  display: block;
  overflow: hidden;
}

.word {
  display: inline-block;
  position: relative;
  white-space: nowrap;
}

.line-mask {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #000000;
  opacity: 0.8;
  height: 105%;
  width: 105%;
  z-index: 2;
}
</style>`,
  bodyParts: [framePart, heroPart, elvisPart, quotePart, bananasPart, monroePart, expoPart, ticketsPart, footerPart, runtimeScriptsPart] as const,
} as const;
