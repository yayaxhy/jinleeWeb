export const elvisPart = {
  id: "elvis",
  html: String.raw`<section id="4-elvis" data-scroll-time="0.5" class="section_elvis lazy-section"><div class="padding-global padding-section-medium"><div class="container-medium position-relative"><div data-hide-on="desktop" text-split="" text-rotate-fade-in="" class="elvis_flex-decor hide-desktop"><div class="flex-horiz-decor-baseline"><p class="decor-text-30-regular text-color-beige-300">00<span class="text-weight-thin">_</span>1</p><div class="flex-horiz-heading"><div class="heading-section-91 is-parenthesis">(</div><div class="heading-section-91 text-color-beige-100">FOUR ELVISES</div><div class="heading-section-91 is-parenthesis">)</div></div></div></div><div data-hide-on="tablet-mobile" text-split="" text-rotate-fade-in="" class="elvis_flex-decor hide-adaptives is-elvis-grid"><div id="w-node-ef84e41a-3efd-74d5-0b21-4902f13caa0d-21f3a2ee" class="elvis-text">SHOOT</div><div id="w-node-ef84e41a-3efd-74d5-0b21-4902f13caa0f-21f3a2ee" class="elvis-text">SHOOT</div><div id="w-node-ef84e41a-3efd-74d5-0b21-4902f13caa11-21f3a2ee" class="elvis-text">SHOOT</div><div id="w-node-ef84e41a-3efd-74d5-0b21-4902f13caa13-21f3a2ee" class="elvis-text">SHOOT</div></div><div class="font-hight_js w-embed w-script"><style>
.elvis-text {
  font-size: 2.125em;      
  line-height: 1;
  display: inline-block;
  transform-origin: bottom center;
}
</style>

<script>
const section = document.getElementById("4-elvis");
const texts = document.querySelectorAll(".elvis-text");

const minScaleY = 0.65;   // minimum height
const maxScaleY = 1.35;   // maximum height
const minScaleX = 0.85;   // minimum width (slightly compressed)
const maxScaleX = 1.15;   // maximum width (slightly expanded)
const baseScale = 1;

section.addEventListener("mousemove", (e) => {
  const rect = section.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;

  texts.forEach((text) => {
    const textRect = text.getBoundingClientRect();
    const centerX = textRect.left + textRect.width / 2;

    const distance = Math.abs(mouseX - centerX);
    const maxDist = rect.width / 2;
    const t = Math.min(distance / maxDist, 1);

    const scaleY = maxScaleY - (maxScaleY - minScaleY) * t;
    const scaleX = maxScaleX - (maxScaleX - minScaleX) * t;

    gsap.to(text, {
      scaleY: scaleY,
      scaleX: scaleX,
      duration: 0.3,
      ease: "power3.out",
      overwrite: "auto"
    });
  });
});

section.addEventListener("mouseleave", () => {
  texts.forEach((text) => {
    gsap.to(text, {
      scaleX: baseScale,
      scaleY: baseScale,
      duration: 0.4,
      ease: "power3.out"
    });
  });
});
</script></div><div class="lw-card-container"><figure id="shot-cursor" data-w-id="36bf408c-99c4-59f1-d390-03c4dfd8e2ac" class="lw-card cs-gun-cursor"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-front lw-card-image"/><div data-hide-on="tablet-mobile" class="lw-card-faders"><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/><img loading="lazy" src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6719f97569304d338ba273b0_elvis-presley-4.avif" alt="Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities." class="lw-card-fader lw-card-image"/></div><div data-hide-on="tablet-mobile" class="elvis_css w-embed w-script"><style>

.cs-gun-cursor {
	cursor: url("/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/675602d252809136add03058_cursor-revolver-2.svg") 35 25, auto;
}

.lw-card.animate:hover .lw-card-faders {
  opacity: 1;
}

.lw-card-fader:nth-child(odd) {
  animation: fade-left 3s linear infinite;
}

.lw-card-fader:nth-child(even) {
  animation: fade-right 3s linear infinite;
}

.lw-card-fader:is(:nth-child(3), :nth-child(4)) {
  animation-delay: 750ms;
}

.lw-card-fader:is(:nth-child(5), :nth-child(6)) {
  animation-delay: 1500ms;
}

.lw-card-fader:is(:nth-child(7), :nth-child(8)) {
  animation-delay: 2250ms;
}

@media (max-width: 1200px) {
  body {    
    justify-content: flex-start;
    align-items: flex-start;
  }
  
  #cards {
    flex-direction: column; 
    align-items: center;
    gap: 4rem;
    padding: 4rem;
  }
  
  .card .card-image {
    width: 400px;    
  }
}

@media (max-width: 600px) {
  #cards {
    gap: 2rem;
    padding: 2rem;
  }
  
  .card {
    width: 80%;    
  }
  
  .card .card-image {
    width: 100%;    
  }
}

@keyframes fade-left {
  from {
    scale: 1;
    translate: 0%;
    opacity: 1;
  }
  
  to {
    scale: 0.8;
    translate: -30%;
    opacity: 0;
  }
}

@keyframes fade-right {
  from {
    scale: 1;
    translate: 0%;
    opacity: 1;
  }
  
  to {
    scale: 0.8;
    translate: 30%;
    opacity: 0;
  }
}
</style>


<script>
document.addEventListener("DOMContentLoaded", function () {
  const sectionElvis = document.querySelector(".section_elvis");
  const cards = document.querySelectorAll(".lw-card");

  const observerElvisCards = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        cards.forEach((card) => card.classList.add("animate"));
      } else {
        cards.forEach((card) => card.classList.remove("animate"));
      }
    });
  });

  observerElvisCards.observe(sectionElvis);
});
</script></div><div class="shot-cursor audio shader-test w-embed w-script"><style>
    /* Basic setup for the target container */
    /* Ensure the container takes up space and is positioned correctly */
    #shot-cursor {
      width: 100%;
      height: 100%;
      position: relative; /* Or absolute, fixed, etc. depending on your layout */
    }
    
    /* The canvas will be created by the script and injected here */
    #splatter-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 3;
    }
  </style>


<script src="/newhome/assets/cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

 <!-- 
    WEBFLOW INTEGRATION SCRIPT 
    Copy and paste the entire <script> block below into your Webflow project's
    custom code section, preferably in the "Before </body> tag" area.
  -->
  <script>
    (function() {
      'use strict';

      class SplatterAnimation {
        
        // --- CONFIGURATION ---
        // You can change these values
        
        // URLs for the splatter images. For best results in Webflow, 
        // upload these SVGs to your Webflow Assets and replace the URLs.
        IMAGES = [
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d275296dbe75c473e136_paint_green.svg",
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d275f024f9155c0527b9_paint_purple.svg",
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d275ea88b11f73b5e83d_paint_red.svg",
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d275383c8c6debf55b9c_paint_pink.svg",
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d27589707490722d179f_paint_blue.svg",
          "/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6921d2758b543c94a5d92b96_paint_yellow.svg"
        ];
        
        // Quality for SVG rasterization. Higher numbers are better quality but use more memory.
        RASTER_SIZE = 256; 

        // --- INTERNAL PROPERTIES ---
        // Do not change these
        container = null;
        canvas = null;
        gl = null;
        shaderProgram = null;
        vertexBuffer = null;
        shaderLocations = null;
        textures = [];
        splatters = [];
        animationFrameId = 0;
        ctx = null;
        unlocked = false;

        constructor(containerSelector) {
          this.container = document.querySelector(containerSelector);
          if (!this.container) {
            console.error(\`[Splatter] Container with selector "\${containerSelector}" not found.\`);
            return;
          }

          this.canvas = document.createElement('canvas');
          this.canvas.id = 'splatter-canvas';
          this.container.appendChild(this.canvas);
          
          // Bind 'this' for class methods used as callbacks
          this.animate = this.animate.bind(this);
          this.handleClick = this.handleClick.bind(this);
        }

        async init() {
          if (!this.container) return;
          try {
            const webglInitialized = await this.initWebGLWithRetries();
            if (!webglInitialized) return;

            await this.loadTextures();
            this.setupClickListener();
            this.animate();
          } catch (error) {
            console.error('[Splatter] A critical error occurred during initialization:', error);
          }
        }

        destroy() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            if (this.container) {
                this.container.removeEventListener('click', this.handleClick);
            }
        }

        async initWebGLWithRetries(retries = 3, delay = 200) {
          for (let i = 0; i < retries; i++) {
            if (this.initWebGL()) {
              return true;
            }
            if (i < retries - 1) {
              console.warn(\`[Splatter] WebGL context creation failed. Retrying in \${delay}ms...\`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          console.error('[Splatter] CRITICAL FAILURE: Could not initialize WebGL context. This might be due to a conflict with another 3D/WebGL script on your page (e.g., Spline).');
          return false;
        }

        initWebGL() {
          const gl = this.canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
          if (!gl) return false;
          this.gl = gl;

          const vsSource = \`
            attribute vec2 a_position; uniform vec2 u_resolution; uniform vec2 u_translation; uniform vec2 u_scale;
            uniform float u_rotation; varying vec2 v_texCoord;
            void main() {
              float c = cos(u_rotation); float s = sin(u_rotation); mat2 rotationMatrix = mat2(c, -s, s, c);
              vec2 rotatedPosition = rotationMatrix * (a_position * u_scale);
              vec2 position = rotatedPosition + u_translation;
              vec2 zeroToOne = position / u_resolution; vec2 zeroToTwo = zeroToOne * 2.0;
              vec2 clipSpace = zeroToTwo - 1.0;
              gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
              v_texCoord = a_position + 0.5;
            }\`;
          const fsSource = \`
            precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_texture; uniform float u_time;
            void main() {
              float fade_start_time = 0.5;
              float fade_time = clamp((u_time - fade_start_time) / (1.0 - fade_start_time), 0.0, 1.0);
              float fade = 1.0 - pow(fade_time, 4.0);
              vec4 color = texture2D(u_texture, v_texCoord);
              gl_FragColor = vec4(color.rgb, color.a * fade);
            }\`;

          const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
          const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
          if (!vs || !fs) return false;

          const shaderProgram = this.createProgram(vs, fs);
          if (!shaderProgram) return false;
          this.shaderProgram = shaderProgram;

          gl.useProgram(this.shaderProgram);

          this.shaderLocations = {
            position: gl.getAttribLocation(this.shaderProgram, 'a_position'),
            resolution: gl.getUniformLocation(this.shaderProgram, 'u_resolution'),
            translation: gl.getUniformLocation(this.shaderProgram, 'u_translation'),
            scale: gl.getUniformLocation(this.shaderProgram, 'u_scale'),
            rotation: gl.getUniformLocation(this.shaderProgram, 'u_rotation'),
            texture: gl.getUniformLocation(this.shaderProgram, 'u_texture'),
            time: gl.getUniformLocation(this.shaderProgram, 'u_time'),
          };

          this.vertexBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
          gl.vertexAttribPointer(this.shaderLocations.position, 2, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(this.shaderLocations.position);
          
          return true;
        }

        compileShader(type, source) {
          const shader = this.gl.createShader(type);
          if (!shader) return null;
          this.gl.shaderSource(shader, source);
          this.gl.compileShader(shader);
          if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
          }
          return shader;
        }

        createProgram(vs, fs) {
          const program = this.gl.createProgram();
          if (!program) return null;
          this.gl.attachShader(program, vs);
          this.gl.attachShader(program, fs);
          this.gl.linkProgram(program);
          if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(program));
            return null;
          }
          return program;
        }

        loadTextures() {
          const rasterCanvas = document.createElement('canvas');
          rasterCanvas.width = this.RASTER_SIZE;
          rasterCanvas.height = this.RASTER_SIZE;
          const ctx2d = rasterCanvas.getContext('2d');

          const promises = this.IMAGES.map(src => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                ctx2d.clearRect(0, 0, this.RASTER_SIZE, this.RASTER_SIZE);
                ctx2d.drawImage(img, 0, 0, this.RASTER_SIZE, this.RASTER_SIZE);
                const texture = this.gl.createTexture();
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, rasterCanvas);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
                resolve(texture);
              };
              img.onerror = reject;
              img.src = src;
            });
          });

          return Promise.all(promises).then(textures => {
            this.textures = textures;
          }).catch(error => {
            console.error('Critical texture loading error. Check image URLs and server CORS settings.', error);
          });
        }
        
        handleClick(e) {
          if (!this.unlocked) this.initAudio();
          this.playProcedural('bubble_minimal');
          this.createSplatter(e);
        }

        setupClickListener() {
          this.container.addEventListener('click', this.handleClick);
        }

        createSplatter(e) {
          if (this.textures.length === 0) return;
          const rect = this.container.getBoundingClientRect();
          const size = (80 + Math.random() * 50);
          this.splatters.push({
            texture: this.textures[Math.floor(Math.random() * this.textures.length)],
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            width: size,
            height: size,
            rotation: Math.random() * Math.PI * 2,
            startTime: Date.now(),
            duration: 1500 + Math.random() * 500,
          });
        }

        animate() {
          this.animationFrameId = requestAnimationFrame(this.animate);
          
          const gl = this.gl;
          
          const parentWidth = this.container.clientWidth;
          const parentHeight = this.container.clientHeight;

          if (parentWidth === 0 || parentHeight === 0) return; 
          
          if (this.canvas.width !== parentWidth || this.canvas.height !== parentHeight) {
              this.canvas.width = parentWidth;
              this.canvas.height = parentHeight;
              gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          }

          gl.clearColor(0.0, 0.0, 0.0, 0.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

          gl.useProgram(this.shaderProgram);
          gl.uniform2f(this.shaderLocations.resolution, gl.canvas.width, gl.canvas.height);

          const now = Date.now();
          this.splatters = this.splatters.filter(s => now < s.startTime + s.duration);

          this.splatters.forEach(splatter => {
            const timeElapsed = Math.min(1.0, (now - splatter.startTime) / splatter.duration);
            const easedTime = 1.0 - Math.pow(1.0 - timeElapsed, 5.0);
            const expansionFactor = 0.25;
            const currentSize = splatter.width * (1.0 + easedTime * expansionFactor);
            
            gl.bindTexture(gl.TEXTURE_2D, splatter.texture);
            gl.uniform1i(this.shaderLocations.texture, 0);

            gl.uniform2f(this.shaderLocations.translation, splatter.x, splatter.y);
            gl.uniform2f(this.shaderLocations.scale, currentSize, currentSize);
            gl.uniform1f(this.shaderLocations.rotation, splatter.rotation);
            gl.uniform1f(this.shaderLocations.time, timeElapsed);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          });
        }

        initAudio() {
          if (this.unlocked) return;
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.unlocked = true;
            if (this.ctx.state === "suspended") this.ctx.resume();
          } catch (e) {
            console.error("Web Audio API is not supported.");
          }
        }

        playProcedural() {
          if (!this.unlocked || !this.ctx) return;
          if (this.ctx.state === "suspended") this.ctx.resume();

          const params = { type: "sine", freqStart: 400, freqEnd: 200, attack: 0.001, decay: 0.1, gain: 0.07 };
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gainNode = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(params.freqStart, t);
          osc.frequency.exponentialRampToValueAtTime(params.freqEnd, t + params.attack + params.decay * 0.8);
          gainNode.gain.setValueAtTime(0, t);
          gainNode.gain.linearRampToValueAtTime(params.gain, t + params.attack);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + params.attack + params.decay);
          osc.connect(gainNode);
          gainNode.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + params.attack + params.decay + 0.1);
        }
      }

      // --- SCRIPT INITIALIZATION ---
      // This code runs when the page has finished loading.
      document.addEventListener('DOMContentLoaded', () => {
        // The script will target the element with the ID '#shot-cursor'.
        // Make sure you have an element with this ID in your Webflow project.
        const splatterEffect = new SplatterAnimation('#shot-cursor');
        splatterEffect.init();
      });

    })();
  </script></div></figure><div class="banana_absolute"><div class="decor_lottie" data-w-id="ad828df3-8800-4a96-6311-5295e631a758" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756f8ee69c5cb074d34fdaa_warhol-banana.json" data-loop="1" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg" data-default-duration="0" data-duration="4" data-loading="eager"></div></div><div class="soup_absolute"><div class="decor_lottie" data-w-id="5e5bc0b9-80fc-7899-0ad2-dcd07d2183d5" data-animation-type="lottie" data-src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/6756f8ee089faf3755292fdd_warhol-soup.json" data-loop="1" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg" data-default-duration="0" data-duration="4" data-loading="eager"></div></div></div><div data-hide-on="tablet-mobile" class="elvis_flex-decor-bottom hide-adaptives"><div id="w-node-_5485a568-2f1f-d3a5-c670-1b1fae60ff27-21f3a2ee" class="flex-horiz-decor-2 is-beetwen"><div class="flex-vert-decor-4 text-color-beige-300"><div class="flex-horiz-decor-2 flex-baseline"><p text-rotate-fade-in="" text-split="" class="text-no-wrap">FOUR ELVISES</p><p text-rotate-fade-in="" text-split="" class="decor-text-8">1963</p></div><p class="opacity-0"> </p><p class="opacity-0"> </p><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus">+</p></div><div class="flex-vert-decor-4"><p text-rotate-fade-in="" text-split="" class="text-no-wrap">Silkscreen Technique</p><p class="opacity-0"> </p><p class="opacity-0"> </p><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus">+</p></div><div class="flex-vert-decor-4 text-color-beige-300"><p text-rotate-fade-in="" text-split="" class="text-no-wrap">Andy Warhol explores </p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">four images of Elvis.</p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">Capturing his fame.</p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">Elvis as a gunslinger </p></div></div><div id="w-node-_5238e626-dc43-bdf3-6bbc-f74dc32278b1-21f3a2ee" class="flex-vert-decor-4 text-color-beige-300"><div class="flex-horiz-decor-2 is-beetwen"><div class="flex-horizontal-2rem"><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus">+</p><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus">+</p><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus">+</p></div><p text-rotate-fade-in="" text-split="" class="text-color-beige-100">Icon of mass-produced Pop Art</p></div><p class="opacity-0">1</p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">Mass-produced imagery, key to Pop Art, highlights how fame and </p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">consumerism shapes modern identities.</p></div></div><div data-hide-on="desktop" class="elvis_flex-decor-bottom hide-desktop"><div id="w-node-ea51af2b-7db9-902d-9d5e-245bb72f0da4-21f3a2ee" class="flex-vert-decor-4 text-color-beige-300 is-elvis"><div class="flex-horiz-decor-2 is-beetwen flex-baseline"><div class="flex-horizontal-2rem"><p text-rotate-fade-in="" text-split="" class="text-size-medium is-plus hide-mobile">+</p></div><p text-rotate-fade-in="" text-split="">Icon of mass-produced Pop Art</p></div><p class="opacity-0">1</p><p text-rotate-fade-in="" text-split="">Mass-produced imagery, key to Pop Art, highlights how fame and consumerism shape modern identities.</p></div></div></div></div></section>`,
} as const;
