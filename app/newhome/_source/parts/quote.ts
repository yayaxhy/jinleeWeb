export const quotePart = {
  id: "quote",
  html: String.raw`<section id="section-quote" data-scroll-time="0.5" class="section_quote lazy-section"><div class="quote-bg_js w-embed w-script"><script>
(function() {
  // Settings
  const SETTINGS = {
    targetID: 'quote-canvas',     // Container element ID
    smoothness: 0.04,             // Mouse movement smoothness (↑ faster, ↓ smoother)
    radius: 0.09,                 // Interaction area radius (↑ wider, ↓ narrower)
    strength: 0.04                // Wave strength (↑ stronger, ↓ weaker)
  };

  function init() {
    const container = document.getElementById(SETTINGS.targetID);
    if (!container || container.querySelector('canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0;z-index:0;pointer-events:none;';
    
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl', { 
      alpha: false, 
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
    if (!gl) return;

    // Shaders
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = \`
      precision highp float;
      uniform vec2 r;
      uniform float t;
      uniform vec2 m;

      float noise(vec2 p){return smoothstep(-0.5,80.9,sin((p.x-p.y)*55.)*sin(p.y*204.))-.4;}
      
      float fabric(vec2 p){
        mat2 mat=mat2(50.6,.2,70.2,-.6);
        float f=.2*noise(p);
        f+=-90.3*noise(p=mat*p);
        f+=-.1*noise(p=mat*p);
        return f+.1*noise(mat*p);
      }

      float silk(vec2 uv,float time){
        float s=sin(5.*(uv.x+uv.y+cos(2.*uv.x+5.*uv.y))+sin(19.*(uv.x+uv.y))-time);
        s=.7+1.2*(s*s*.05+s);
        s*=400.8-19.1*fabric(uv*min(r.x,r.y)*.0006);
        return s*.8+.5;
      }

      float silkd(vec2 uv,float time){
        float xy=uv.x+uv.y;
        float d=(-1.*(1.-2.*sin(20.*uv.x+-5.*uv.y))+14.*cos(12.*xy))*
                cos(5.*(cos(-84.*uv.x+54.*uv.y)+xy)+sin(-1.*xy)-time);
        return .1*d*(sign(d)*-2.);
      }

      void main(){
        float mr=min(r.x,r.y);
        vec2 uv=gl_FragCoord.xy/mr;
        vec2 mUV=m/mr;

        float dist=distance(uv,mUV);
        float hover=exp(-dist*\${SETTINGS.radius.toFixed(1)}); 
        uv-=normalize(uv-mUV)*\${SETTINGS.strength.toFixed(3)}*hover;
        
        uv.y+=.0008*sin(1.*uv.x-t);
        
        float s=sqrt(silk(uv,t));
        float d=silkd(uv,t);
        
        vec3 c=vec3(s);
        c+=.7*vec3(1.,-.83,-4.6)*d;
        c*=1.-max(0.,1.8*d);
        
        c=pow(c,.3/vec3(.52,.5,.4));
        gl_FragColor=vec4(1.-c,1.);
      }
    \`;

    // Create program
    const createShader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Setup geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const pl = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pl);
    gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const uRes = gl.getUniformLocation(prog, 'r');
    const uTime = gl.getUniformLocation(prog, 't');
    const uMouse = gl.getUniformLocation(prog, 'm');

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const start = Date.now();

    // Resize handler
    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    
    (window.ResizeObserver 
      ? new ResizeObserver(resize).observe(container)
      : window.addEventListener('resize', resize)
    );
    setTimeout(resize, 100);

    // Mouse tracking
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      target.x = (e.clientX - rect.left) * d;
      target.y = canvas.height - (e.clientY - rect.top) * d;
    }, { passive: true });

    // Animation loop
    const loop = () => {
      current.x += (target.x - current.x) * SETTINGS.smoothness;
      current.y += (target.y - current.y) * SETTINGS.smoothness;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (Date.now() - start) * 0.001);
      gl.uniform2f(uMouse, current.x, current.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(loop);
    };
    loop();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
</script></div><div id="quote-canvas" class="quote_bg"></div><div class="padding-global padding-section-medium z-index-3"><div class="container-medium is-quote"><div class="quote_decor-icons"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star is-1"/><div class="border-horizontal-wrap"><div class="border-horizontal"></div></div><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star is-2"/></div><div class="spacer-medium"></div><div class="container-small is-quote"><div data-w-id="2e0a27dd-37c6-b1a5-6bf8-74f6de61e0bf" class="about-content-block"><div class="split-word">The most exciting attractions are between opposites that never meet. People think they’ve connected through attraction, but found someone to forget themselves. The less important a meeting, the more you want it.</div></div><div class="spacer-medium"></div><div text-rotate-fade-in="" text-split="" class="flex-horizontal is-quote-1rem"><p class="text-qoute-bottom text-style-italic">The Philosophy of Andy Warhol</p><p class="text-qoute-bottom"><span class="text-weight-bold text-color-red">(</span> <span class="text-weight-thin">From A to B and Back Again</span> <span class="text-weight-bold text-color-red">)</span></p></div><div class="spacer-huge"></div><p text-rotate-fade-in="" text-split="" class="text-qoute-bottom">© <span class="text-weight-bold">1975</span></p></div><div class="spacer-medium"></div><div class="quote_decor-icons"><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star is-1"/><div class="border-horizontal-wrap"><div class="border-horizontal"></div></div><img src="/newhome/assets/cdn.prod.website-files.com/6718c8afa78e156621f3a2ed/671a4c5b86c9e34860c28b68_icon-star.svg" loading="lazy" alt="" class="icon_star is-2"/></div><div class="quote_decor-wrap"><div class="flex-quote-left text-color-beige-300 hide-adaptives"><p text-rotate-fade-in="" text-split="" class="text-no-wrap">WARHOL™</p><p text-rotate-fade-in="" text-split="" class="text-no-wrap">POP∆</p></div><p class="text-qoute-bottom opacity-0 pointer-events-none">1</p><div class="flex-quote-right hide-adaptives"><div svg-delay="1000" svg="animated" svg-animation-time="5000" class="quote_icon w-embed"><div style="width: 100%; display: flex; justify-content: center;">
	<svg 
  aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 41 37"
  style="width: auto; height: 2.3em;" 
  class="responsive-svg"
>

    <path stroke="#665C57" d="M30.597 17.923h-7.914V.5H40.5v19.47c0 5.31-1.683 9.42-4.769 12.208-3.005 2.716-7.404 4.234-13.048 4.318v-7.828c2.67-.083 4.753-.84 6.185-2.289 1.52-1.538 2.229-3.775 2.229-6.563v-1.893h-.5Zm-22.183 0H.5V.5h17.817v19.47c0 5.31-1.683 9.42-4.769 12.208C10.543 34.894 6.144 36.412.5 36.496v-7.828c2.671-.083 4.753-.84 6.185-2.289 1.52-1.538 2.23-3.775 2.23-6.563v-1.893h-.5Z"/>
  </svg>
</div>

<style>
  .responsive-svg {
    height: 2.3em;
  }

  @media screen and (max-width: 768px) {
    .responsive-svg {
      height: 3.38em;
    }
  }
</style></div></div></div></div></div><div class="quote-fade_top"></div><div class="quote-fade_top is-bottom"></div></section>`,
} as const;
