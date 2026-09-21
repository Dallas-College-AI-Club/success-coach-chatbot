/** Art-preserving local bones. Rest UVs are the approved drawing, never rebuilt body parts. */
export type Point = { x: number; y: number };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const wave = (t: number, p: number) => ((t % p) + p) % p;
function footStep(phase: number, stride: number, lift: number): Point {
  const q = wave(phase, 1),
    duty = 0.62,
    u = clamp((q - duty) / (1 - duty));
  return {
    x:
      q < duty
        ? stride * (duty / 2 - q)
        : (-stride * duty) / 2 + stride * duty * smooth(u),
    y: q < duty ? 0 : -(Math.sin(Math.PI * u) ** 2) * lift,
  };
}
function rotate(
  p: Point,
  pivot: Point,
  degrees: number,
  weight: number,
): Point {
  if (weight <= 0 || degrees === 0) return p;
  const a = (degrees * weight * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    x = p.x - pivot.x,
    y = p.y - pivot.y;
  return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c };
}
export function articulatedPoint(
  key: string,
  x: number,
  y: number,
  t: number,
  phase = 0,
  run = 0,
  strength = 1,
): Point {
  const source = { x, y };
  if (!strength) return source;
  let p = source;
  if (key === "eagle") {
    const beat = wave(t, 14),
      power =
        0.2 +
        0.8 *
          (1 -
            smooth((beat - 3.5) / 1.5) +
            smooth((beat - 8.5) / 1.2) * (1 - smooth((beat - 12) / 1.5)));
    const stroke = Math.sin(t * 4.7) * 8 * clamp(power, 0.2, 1) * strength;
    const upper = smooth((0.8 - y) / 0.22);
    p = rotate(
      p,
      { x: 0.49, y: 0.6 },
      stroke,
      smooth((0.55 - x) / 0.28) * upper,
    );
    p = rotate(
      p,
      { x: 0.7, y: 0.58 },
      -stroke,
      smooth((x - 0.73) / 0.23) * upper,
    );
  } else if (key === "harvester-bee") {
    const wing = smooth((0.61 - x) / 0.18) * smooth((0.61 - y) / 0.16);
    const stroke = Math.sin(t * 47) * 9 * strength;
    p = rotate(p, { x: 0.55, y: 0.54 }, stroke, wing);
  } else if (key === "blazer-stallion" || key === "lion") {
    const horse = key === "blazer-stallion",
      centers = horse ? [0.22, 0.49, 0.69, 0.91] : [0.25, 0.48, 0.67, 0.9];
    const root = horse ? 0.72 : 0.77,
      weight = smooth((y - root) / (0.94 - root));
    const offsets = horse ? [0, 0.5, 0.5, 0] : [0.5, 0.6, 0, 0.1];
    const stride = horse ? 0.17 : 0.16;
    const step = (index: number) => {
      const q = wave(phase + offsets[index], 1),
        duty = horse ? 0.56 : 0.6,
        u = clamp((q - duty) / (1 - duty));
      return {
        x:
          q < duty
            ? stride * (duty / 2 - q)
            : (-stride * duty) / 2 + stride * duty * smooth(u),
        y:
          q < duty
            ? 0
            : -(Math.sin(Math.PI * u) ** 2) * (horse ? 0.027 : 0.023),
      };
    };
    let a = 0;
    while (a < centers.length - 2 && x > centers[a + 1]) a++;
    const mix = smooth((x - centers[a]) / (centers[a + 1] - centers[a])),
      p0 = step(a),
      p1 = step(a + 1);
    const dx = (p0.x + (p1.x - p0.x) * mix) * run * strength,
      dy = (p0.y + (p1.y - p0.y) * mix) * run * strength;
    // Whole paws translate; only the already-drawn lower leg bridges to its fixed hip.
    p = { x: p.x + dx * weight, y: p.y + dy * weight };
    const tailMask =
      smooth((0.28 - x) / 0.12) *
      smooth((y - 0.32) / 0.15) *
      smooth((0.86 - y) / 0.13);
    p = rotate(
      p,
      { x: 0.29, y: horse ? 0.63 : 0.69 },
      Math.sin(phase * Math.PI * 2 - 0.6) * 2.5 * strength * run,
      tailMask,
    );
  } else if (key === "thunderduck") {
    p = rotate(
      p,
      { x: 0.39, y: 0.52 },
      Math.sin(phase * Math.PI * 2 - 0.3) * 2 * run * strength,
      smooth((0.41 - x) / 0.22) *
        smooth((y - 0.4) / 0.12) *
        smooth((0.84 - y) / 0.12),
    );
    const leg = smooth((y - 0.85) / 0.12),
      mix = smooth((x - 0.4) / 0.4),
      left = footStep(phase, 0.16, 0.03),
      right = footStep(phase + 0.5, 0.16, 0.03);
    p = {
      x: p.x + (left.x + (right.x - left.x) * mix) * leg * run * strength,
      y: p.y + (left.y + (right.y - left.y) * mix) * leg * run * strength,
    };
  } else if (key === "bear") {
    // Low-amplitude shoulder follow-through; torso and face remain fixed.
    const a = Math.sin(phase * Math.PI * 2) * 5 * run * strength;
    p = rotate(
      p,
      { x: 0.29, y: 0.5 },
      a,
      smooth((0.3 - x) / 0.17) *
        smooth((y - 0.42) / 0.15) *
        smooth((0.85 - y) / 0.12),
    );
    p = rotate(
      p,
      { x: 0.8, y: 0.51 },
      -a,
      smooth((x - 0.79) / 0.16) *
        smooth((y - 0.43) / 0.13) *
        smooth((0.86 - y) / 0.12),
    );
    const leg = smooth((y - 0.8) / 0.15),
      mix = smooth((x - 0.35) / 0.3),
      left = footStep(phase, 0.18, 0.035),
      right = footStep(phase + 0.5, 0.18, 0.035);
    p = {
      x: p.x + (left.x + (right.x - left.x) * mix) * leg * run * strength,
      y: p.y + (left.y + (right.y - left.y) * mix) * leg * run * strength,
    };
  }
  return p;
}

type Eyes = {
  centers: [number, number, number, number];
  radii: [number, number, number, number];
  lid: [number, number, number];
  period: number;
  offset: number;
};
const eyes: Record<string, Eyes> = {
  bear: {
    centers: [0.56, 0.242, 0.778, 0.266],
    radii: [0.048, 0.029, 0.028, 0.024],
    lid: [0.015, 0.62, 0.43],
    period: 5.7,
    offset: 0.6,
  },
  "blazer-stallion": {
    // This profile has one visible eye; keep the second mask outside the image.
    centers: [0.805, 0.252, -1, -1],
    radii: [0.04, 0.027, 0.01, 0.01],
    lid: [0.34, 0.66, 0.18],
    period: 6.4,
    offset: 1.9,
  },
  lion: {
    centers: [0.722, 0.329, 0.865, 0.339],
    radii: [0.039, 0.03, 0.019, 0.023],
    lid: [1, 0.74, 0.04],
    period: 7.1,
    offset: 3.2,
  },
  thunderduck: {
    centers: [0.607, 0.248, 0.808, 0.25],
    radii: [0.05, 0.033, 0.025, 0.025],
    lid: [0.43, 0.16, 0.69],
    period: 5.3,
    offset: 2.6,
  },
  "sun-phoenix": {
    centers: [0.58, 0.362, 0.713, 0.398],
    radii: [0.04, 0.025, 0.018, 0.018],
    lid: [1, 0.8, 0.06],
    period: 4.8,
    offset: 4.2,
  },
  eagle: {
    centers: [0.643, 0.449, 0.7, 0.428],
    radii: [0.016, 0.021, 0.006, 0.013],
    lid: [0.91, 0.93, 0.96],
    period: 6.1,
    offset: 1.1,
  },
  "harvester-bee": {
    centers: [0.738, 0.385, 0.912, 0.4],
    radii: [0.045, 0.045, 0.026, 0.036],
    lid: [1, 0.68, 0.015],
    period: 4.6,
    offset: 3.6,
  },
};
export function blinkAt(key: string, time: number) {
  const e = eyes[key],
    p = wave(time + e.offset, e.period),
    u = p / 0.19;
  return p < 0.19 ? Math.sin(Math.PI * u) ** 2 : 0;
}

export type Art = {
  key: string;
  image: HTMLImageElement;
  width: number;
  height: number;
};
export type RigDraw = {
  art: Art;
  t: number;
  phase: number;
  run: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  facing: number;
  strength: number;
  opacity?: number;
};
export function createArtworkRig() {
  const surface = document.createElement("canvas");
  const context = surface.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  if (!context) return null;
  const gl = context;
  try {
    const makeShader = (type: number, text: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(shader) ?? "Rig shader failed");
      return shader;
    };
    const vs = makeShader(
      gl.VERTEX_SHADER,
      "attribute vec2 a_position;attribute vec2 a_uv;uniform vec2 u_size;uniform vec2 u_center;uniform vec2 u_view;uniform vec2 u_turn;varying vec2 v_uv;void main(){vec2 p=(a_position-.5)*u_size;p=vec2(p.x*cos(u_turn.x)-p.y*sin(u_turn.x),p.x*sin(u_turn.x)+p.y*cos(u_turn.x));p=(p+u_center)/u_view*2.-1.;gl_Position=vec4(p.x,-p.y,0.,1.);v_uv=a_uv;}",
    );
    const fs = makeShader(
      gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 v_uv;uniform sampler2D u_image;uniform vec4 u_eyes;uniform vec4 u_radii;uniform float u_blink;uniform vec3 u_lid;uniform float u_opacity;\nvec4 eye(vec4 original,vec2 c,vec2 r){\n vec2 d=(v_uv-c)/r;float mask=1.-smoothstep(1.,1.22,length(d));if(mask<.001||u_blink<.001)return original;\n vec4 skin=vec4(u_lid,original.a);float opening=max(.04,1.-u_blink);\n vec4 compressed=texture2D(u_image,vec2(v_uv.x,c.y+d.y*r.y/opening));\n float slit=1.-smoothstep(opening*.84,opening*1.08,abs(d.y));vec4 lid=mix(skin,compressed,slit);\n float closed=smoothstep(.75,.98,u_blink);float line=(1.-smoothstep(.045,.090,abs(d.y-(-.12+.19*d.x*d.x))))*(1.-smoothstep(.76,.92,abs(d.x)));\n vec4 shut=mix(skin,vec4(.025,.105,.08,1.),line);\n return mix(original,mix(lid,shut,closed),mask*smoothstep(0.,.15,u_blink));\n}\nvoid main(){vec4 c=texture2D(u_image,v_uv);c=eye(c,u_eyes.xy,u_radii.xy);c=eye(c,u_eyes.zw,u_radii.zw);gl_FragColor=c*u_opacity;}",
    );
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error("Rig program failed");
    gl.useProgram(program);
    const n = 40,
      vertices = new Float32Array((n + 1) * (n + 1) * 4),
      indices = new Uint16Array(n * n * 6);
    let k = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const a = y * (n + 1) + x,
          b = a + 1,
          c = a + n + 2,
          d = a + n + 1;
        indices.set([a, b, c, a, c, d], k);
        k += 6;
      }
    const vertexBuffer = gl.createBuffer()!,
      indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_position"),
      uv = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(pos);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    const eyeUniform = gl.getUniformLocation(program, "u_eyes"),
      radiusUniform = gl.getUniformLocation(program, "u_radii"),
      lidUniform = gl.getUniformLocation(program, "u_lid"),
      blinkUniform = gl.getUniformLocation(program, "u_blink");
    const opacity = gl.getUniformLocation(program, "u_opacity"),
      size = gl.getUniformLocation(program, "u_size"),
      center = gl.getUniformLocation(program, "u_center"),
      view = gl.getUniformLocation(program, "u_view"),
      turn = gl.getUniformLocation(program, "u_turn"),
      textures = new Map<string, WebGLTexture>();
    gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    return {
      available() {
        return !gl.isContextLost();
      },
      draw(items: RigDraw[], width: number, height: number, dpr: number) {
        const sw = Math.round(width * dpr),
          sh = Math.round(height * dpr);
        if (surface.width !== sw || surface.height !== sh) {
          surface.width = sw;
          surface.height = sh;
        }
        gl.viewport(0, 0, sw, sh);
        gl.uniform2f(view, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const item of items) {
          const { art, t, phase, run, strength } = item;
          const e = eyes[art.key];
          gl.uniform4fv(eyeUniform, e.centers);
          gl.uniform4fv(radiusUniform, e.radii);
          gl.uniform3fv(lidUniform, e.lid);
          gl.uniform1f(opacity, item.opacity ?? 1);
          gl.uniform1f(blinkUniform, blinkAt(art.key, t) * strength);
          let texture = textures.get(art.key);
          if (!texture) {
            texture = gl.createTexture()!;
            textures.set(art.key, texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_S,
              gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_T,
              gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              art.image,
            );
          } else gl.bindTexture(gl.TEXTURE_2D, texture);
          let i = 0;
          for (let y = 0; y <= n; y++)
            for (let x = 0; x <= n; x++) {
              const u = x / n,
                v = y / n,
                p = articulatedPoint(art.key, u, v, t, phase, run, strength);
              vertices[i++] = p.x;
              vertices[i++] = p.y;
              vertices[i++] = u;
              vertices[i++] = v;
            }
          gl.uniform2f(size, item.w * item.facing, item.h);
          gl.uniform2f(center, item.x, item.y);
          gl.uniform2f(turn, (item.angle * Math.PI) / 180, 0);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
          gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }
        return surface;
      },
      dispose() {
        for (const t of textures.values()) gl.deleteTexture(t);
        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  } catch (error) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    console.warn(
      "Mascot articulation unavailable; using intact artwork motion",
      error,
    );
    return null;
  }
}
