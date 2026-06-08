export const framePart = {
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
} as const;
