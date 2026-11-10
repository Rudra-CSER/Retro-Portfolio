import * as THREE from 'three';

// A voxel DNA double helix dissolving into floating cubes, inside a wireframe
// lattice — rendered at low resolution, then ordered-dithered (4×4 Bayer) down
// to a 4-tone palette so it reads like a 90s studio photograph on a CRT.

const DITHER_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec3 uInk;
  uniform vec3 uMid;
  uniform vec3 uDark;
  uniform vec3 uAccent;
  uniform float uInvert; // 1 on a light page: ink goes where the shadows are, paper where the light is
  varying vec2 vUv;

  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec4 c = texture2D(tScene, vUv);
    if (c.a < 0.02) { gl_FragColor = vec4(0.0); return; }
    vec3 rgb = c.rgb / max(c.a, 0.001);
    float lum = pow(dot(rgb, vec3(0.299, 0.587, 0.114)), 1.0 / 2.0);
    lum = mix(lum, 1.0 - lum, uInvert);
    float mx = max(max(rgb.r, rgb.g), rgb.b);
    float mn = min(min(rgb.r, rgb.g), rgb.b);
    float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
    float th = bayer4(gl_FragCoord.xy) - 0.5;
    float v = clamp(lum * 1.08 + th * 0.36, 0.0, 1.0);
    float q = floor(v * 3.0 + 0.5);
    vec3 col;
    float alpha = 1.0;
    if (q < 0.5) { alpha = 0.0; col = vec3(0.0); }
    else if (q < 1.5) col = uDark;
    else if (q < 2.5) col = sat > 0.32 ? uAccent * 0.62 : uMid;
    else col = sat > 0.32 ? uAccent : uInk;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

const DITHER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const hexToVec3 = (hex) => {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/**
 * The palette as seen from `el` (CSS variables inherit, so a dark device inside a light page
 * gets its own dark set). `light` is true when the page behind `el` is light.
 */
export function readPalette(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const get = (v, d) => cs.getPropertyValue(v).trim() || d;
  return {
    ink: get('--text', '#F2EEE6'),
    mid: get('--muted', '#8C8981'),
    dark: get('--bg-3', '#1A1A1A'),
    accent: get('--accent', '#FFB627'),
    red: get('--p2', '#FF3B5C'),
    light: cs.getPropertyValue('color-scheme').trim() === 'light',
  };
}

// `held`: while the opening plays on top of the page, the helix draws one still frame and waits.
// Its render loop would otherwise run unseen under the intro and take frames away from it.
export function createHeroScene(container, { pixel = 3, held = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'hero-canvas';
  container.appendChild(renderer.domElement);

  const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });

  // ── scene ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const rim = new THREE.DirectionalLight(0xffffff, 5.2);
  rim.position.set(-5, 4, -6);
  scene.add(rim);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(6, 2, 7);
  scene.add(key);

  const root = new THREE.Group();
  root.position.x = 0.4;
  scene.add(root);
  const helixGroup = new THREE.Group();
  root.add(helixGroup);

  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.6 });
  const box = new THREE.BoxGeometry(1, 1, 1);

  // helix voxels
  const N = 52;
  const helix = [];
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const y = (t - 0.5) * 8.4;
    const a = t * Math.PI * 4.6;
    const r = 1.4;
    const dissolve = Math.max(0, (t - 0.72) / 0.28); // top of the helix breaks apart
    for (const off of [0, Math.PI]) {
      const scatter = dissolve * dissolve;
      helix.push({
        base: new THREE.Vector3(Math.cos(a + off) * r, y, Math.sin(a + off) * r),
        drift: new THREE.Vector3((rnd() - 0.5) * 5 * scatter, rnd() * 3.2 * scatter, (rnd() - 0.5) * 5 * scatter),
        size: 0.26 * (1 - dissolve * 0.35),
        spin: dissolve,
        phase: rnd() * 6.28,
      });
    }
    if (i % 2 === 0 && dissolve < 0.6) {
      for (let k = 1; k <= 4; k++) {
        const f = k / 5;
        helix.push({
          base: new THREE.Vector3(Math.cos(a) * r * (1 - 2 * f), y, Math.sin(a) * r * (1 - 2 * f)),
          drift: new THREE.Vector3(),
          size: 0.13,
          spin: 0,
          phase: rnd() * 6.28,
        });
      }
    }
  }
  // free-floating cubes around the dissolve
  const floaters = [];
  for (let i = 0; i < 46; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = 2.2 + rnd() * 3.2;
    floaters.push({
      base: new THREE.Vector3(Math.cos(ang) * rad, 1.2 + rnd() * 4.4 - (rnd() < 0.35 ? 5 : 0), Math.sin(ang) * rad * 0.7),
      size: 0.08 + rnd() * 0.22,
      speed: 0.15 + rnd() * 0.5,
      phase: rnd() * 6.28,
    });
  }

  const ACCENT_N = 5; // the only coloured pixels in the sculpture
  const inst = new THREE.InstancedMesh(box, metal, helix.length + floaters.length - ACCENT_N);
  helixGroup.add(inst);
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xffb627, emissive: 0x3a2600, roughness: 0.45, metalness: 0.1 });
  const accentInst = new THREE.InstancedMesh(box, accentMat, ACCENT_N);
  helixGroup.add(accentInst);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  // wireframe lattice
  const lattice = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.5, 1)),
    new THREE.LineBasicMaterial({ color: 0x6a6a6a, transparent: true, opacity: 0.32 }),
  );
  root.add(lattice);
  const lattice2 = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 9.6, 2.2, 1, 4, 1)),
    new THREE.LineBasicMaterial({ color: 0x5a5a5a, transparent: true, opacity: 0.3 }),
  );
  helixGroup.add(lattice2);

  // drifting particles
  const P = 260;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    pPos[i * 3] = (rnd() - 0.5) * 14;
    pPos[i * 3 + 1] = (rnd() - 0.5) * 12;
    pPos[i * 3 + 2] = (rnd() - 0.5) * 8;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false }));
  root.add(points);

  // ── dither pass ─────────────────────────────────────────────────────────
  const pal = readPalette();
  const ditherMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: rt.texture },
      uInk: { value: hexToVec3(pal.ink) },
      uMid: { value: hexToVec3(pal.mid) },
      uDark: { value: hexToVec3(pal.dark) },
      uAccent: { value: hexToVec3(pal.accent) },
      uInvert: { value: pal.light ? 1 : 0 },
    },
    vertexShader: DITHER_VERT,
    fragmentShader: DITHER_FRAG,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ditherMat));

  // ── state ────────────────────────────────────────────────────────────────
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let progress = 0;
  let running = false;
  let hold = held;
  let raf = 0;
  let last = performance.now();
  let t = 0;

  function resize() {
    const w = Math.max(2, container.clientWidth);
    const h = Math.max(2, container.clientHeight);
    const lw = Math.max(2, Math.round(w / pixel));
    const lh = Math.max(2, Math.round(h / pixel));
    renderer.setSize(lw, lh, false);
    rt.setSize(lw, lh);
    camera.aspect = w / h;
    camera.position.z = w / h < 0.8 ? 16 : 13;
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    helixGroup.rotation.y += dt * 0.32;
    root.rotation.x = 0.12 + mouse.y * 0.28;
    root.rotation.z = -0.08 + mouse.x * 0.08;
    root.rotation.y = mouse.x * 0.45;
    lattice.rotation.y -= dt * 0.08;
    lattice.rotation.x += dt * 0.03;
    const sc = 1 - progress * 0.22;
    root.scale.setScalar(sc);
    root.position.y = progress * 1.4;

    let i = 0;
    for (const c of helix) {
      const breathe = Math.sin(t * 0.9 + c.phase) * 0.5 + 0.5;
      v.copy(c.base).addScaledVector(c.drift, 0.75 + breathe * 0.25);
      e.set(c.spin * (t * 0.6 + c.phase), c.spin * (t * 0.4 + c.phase), 0);
      q.setFromEuler(e);
      s.setScalar(c.size);
      m4.compose(v, q, s);
      inst.setMatrixAt(i++, m4);
    }
    let a = 0;
    floaters.forEach((f, k) => {
      v.copy(f.base);
      v.y += Math.sin(t * f.speed + f.phase) * 0.35;
      e.set(t * f.speed + f.phase, t * f.speed * 0.7, f.phase);
      q.setFromEuler(e);
      s.setScalar(f.size);
      m4.compose(v, q, s);
      if (k < ACCENT_N) accentInst.setMatrixAt(a++, m4);
      else inst.setMatrixAt(i++, m4);
    });
    accentInst.instanceMatrix.needsUpdate = true;
    inst.instanceMatrix.needsUpdate = true;

    const arr = pGeo.attributes.position.array;
    for (let k = 0; k < P; k++) {
      arr[k * 3 + 1] += dt * 0.18;
      if (arr[k * 3 + 1] > 6) arr[k * 3 + 1] = -6;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  function render() {
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
  }

  function start() {
    if (running || hold) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onMove = (ev) => {
    mouse.tx = (ev.clientX / innerWidth) * 2 - 1;
    mouse.ty = (ev.clientY / innerHeight) * 2 - 1;
  };
  const onPalette = () => {
    const p = readPalette();
    ditherMat.uniforms.uInk.value = hexToVec3(p.ink);
    ditherMat.uniforms.uMid.value = hexToVec3(p.mid);
    ditherMat.uniforms.uDark.value = hexToVec3(p.dark);
    ditherMat.uniforms.uAccent.value = hexToVec3(p.accent);
    ditherMat.uniforms.uInvert.value = p.light ? 1 : 0;
    if (!running) render();
  };
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) render();
  });
  ro.observe(container);
  let inView = false;
  const io = new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    if (inView && !document.hidden) start();
    else stop();
  });
  io.observe(container);
  const onVis = () => (document.hidden || !inView ? stop() : start());
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('palettechange', onPalette);
  document.addEventListener('visibilitychange', onVis);

  resize();
  update(0.016);
  render();

  return {
    setProgress(p) {
      progress = p;
    },
    /** Hold the animation (a still frame stays on screen) or let it run again. */
    setHeld(h) {
      hold = !!h;
      if (hold) stop();
      else if (inView && !document.hidden) start();
    },
    renderStill() {
      update(0.016);
      render();
    },
    dispose() {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('palettechange', onPalette);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      ditherMat.dispose();
      rt.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
