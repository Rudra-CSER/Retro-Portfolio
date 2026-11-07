import * as THREE from 'three';
import { readPalette } from './heroScene';

// Inside the TV: a warp-drifting starfield and a slowly turning wireframe heme —
// the iron porphyrin at the heart of hemoglobin, with an O₂ bound on top.
// (A nod to the point-of-care hemoglobin work.)

function buildHeme() {
  const atoms = []; // {p: Vector3, kind}
  const bonds = []; // [i, j]
  const add = (x, y, z, kind) => atoms.push({ p: new THREE.Vector3(x, y, z), kind }) - 1;
  const bond = (a, b) => bonds.push([a, b]);

  const fe = add(0, 0, 0, 'fe');
  const r5 = 1.18;
  const alphaPlus = [];
  const alphaMinus = [];
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2;
    const dir = new THREE.Vector2(Math.cos(th), Math.sin(th));
    const c = dir.clone().multiplyScalar(2.0 + r5);
    const verts = [];
    for (let j = 0; j < 5; j++) {
      const a = th + Math.PI + (j * 2 * Math.PI) / 5;
      verts.push(add(c.x + Math.cos(a) * r5, c.y + Math.sin(a) * r5, 0, j === 0 ? 'n' : 'c'));
    }
    for (let j = 0; j < 5; j++) bond(verts[j], verts[(j + 1) % 5]);
    bond(fe, verts[0]);
    alphaPlus.push(verts[4]);
    alphaMinus.push(verts[1]);
    // substituents on the beta carbons
    [verts[2], verts[3]].forEach((b, n) => {
      const bp = atoms[b].p;
      const out = new THREE.Vector3(bp.x - c.x, bp.y - c.y, 0).normalize();
      const long = k % 2 === 0 && n === 0;
      let prev = b;
      let pos = bp.clone();
      const steps = long ? 3 : 1;
      for (let s = 0; s < steps; s++) {
        pos = pos.clone().addScaledVector(out, 0.95).add(new THREE.Vector3(0, 0, long ? (s % 2 ? 0.55 : -0.55) : 0));
        const id = add(pos.x, pos.y, pos.z, s === steps - 1 && long ? 'o' : 'c');
        bond(prev, id);
        prev = id;
      }
    });
  }
  // meso bridges: ring k's +side alpha carbon → meso → ring k+1's −side alpha carbon
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2 + Math.PI / 4;
    const m = add(Math.cos(th) * 3.55, Math.sin(th) * 3.55, 0, 'c');
    bond(alphaPlus[k], m);
    bond(m, alphaMinus[(k + 1) % 4]);
  }
  // proximal histidine below the iron (imidazole ring in the xz-plane)
  const nHis = add(0, 0, -2.0, 'n');
  bond(fe, nHis);
  const ring = [nHis];
  for (let j = 1; j < 5; j++) {
    const a = Math.PI / 2 + (j * 2 * Math.PI) / 5;
    ring.push(add(Math.cos(a) * 0.72, 0, -2.72 + Math.sin(a) * 0.72, j === 2 ? 'n' : 'c'));
  }
  for (let j = 0; j < 5; j++) bond(ring[j], ring[(j + 1) % 5]);
  // bound O2 on top
  const o1 = add(0, 0, 1.75, 'o');
  const o2 = add(0.75, 0.2, 2.45, 'o');
  bond(fe, o1);
  bond(o1, o2);
  return { atoms, bonds };
}

export function createCrtScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * 0.42);
  renderer.setClearColor(0x020203, 1);
  renderer.domElement.className = 'crt-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0, 15);

  const pal = readPalette();
  const colAccent = new THREE.Color(pal.accent);
  const colInk = new THREE.Color(pal.ink);
  const colRed = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--p2').trim() || '#FF3B5C');
  const colCyan = new THREE.Color('#3DE8FF');

  // starfield
  const S = 1400;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(S * 3);
  const sCol = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) {
    sPos[i * 3] = (Math.random() - 0.5) * 120;
    sPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
    sPos[i * 3 + 2] = -Math.random() * 120;
    const c = Math.random() < 0.08 ? colAccent : Math.random() < 0.05 ? colCyan : colInk;
    const b = 0.45 + Math.random() * 0.55;
    sCol[i * 3] = c.r * b;
    sCol[i * 3 + 1] = c.g * b;
    sCol[i * 3 + 2] = c.b * b;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
  scene.add(stars);

  // molecule
  const mol = new THREE.Group();
  scene.add(mol);
  const { atoms, bonds } = buildHeme();
  const center = new THREE.Vector3();
  atoms.forEach((a) => center.add(a.p));
  center.divideScalar(atoms.length);
  const lp = new Float32Array(bonds.length * 6);
  bonds.forEach(([i, j], k) => {
    lp.set([atoms[i].p.x - center.x, atoms[i].p.y - center.y, atoms[i].p.z - center.z, atoms[j].p.x - center.x, atoms[j].p.y - center.y, atoms[j].p.z - center.z], k * 6);
  });
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: colInk, transparent: true, opacity: 0.85 });
  mol.add(new THREE.LineSegments(lGeo, lineMat));

  const aPos = new Float32Array(atoms.length * 3);
  const aCol = new Float32Array(atoms.length * 3);
  atoms.forEach((a, i) => {
    aPos.set([a.p.x - center.x, a.p.y - center.y, a.p.z - center.z], i * 3);
    const c = a.kind === 'fe' ? colAccent : a.kind === 'n' ? colCyan : a.kind === 'o' ? colRed : colInk;
    aCol.set([c.r, c.g, c.b], i * 3);
  });
  const aGeo = new THREE.BufferGeometry();
  aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  aGeo.setAttribute('color', new THREE.BufferAttribute(aCol, 3));
  const atomMat = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true });
  mol.add(new THREE.Points(aGeo, atomMat));
  // iron glow
  const feGeo = new THREE.BufferGeometry();
  feGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-center.x, -center.y, -center.z]), 3));
  const feMat = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, color: colAccent });
  mol.add(new THREE.Points(feGeo, feMat));

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0;
  let running = false;
  let inView = false;
  let last = performance.now();
  let t = 0;

  function resize() {
    const w = Math.max(2, container.clientWidth);
    const h = Math.max(2, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * dt * 2;
    mouse.y += (mouse.ty - mouse.y) * dt * 2;
    const arr = sGeo.attributes.position.array;
    for (let i = 0; i < S; i++) {
      arr[i * 3 + 2] += dt * 9;
      if (arr[i * 3 + 2] > 14) arr[i * 3 + 2] = -120;
    }
    sGeo.attributes.position.needsUpdate = true;
    mol.rotation.y = t * 0.35 + mouse.x * 0.5;
    mol.rotation.x = Math.sin(t * 0.25) * 0.45 + 0.5 + mouse.y * 0.3;
    mol.rotation.z = t * 0.06;
    feMat.size = 8 + Math.sin(t * 3) * 2;
    renderer.render(scene, camera);
  }

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const onMove = (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  const onPalette = () => {
    const p = readPalette();
    feMat.color.set(p.accent);
    lineMat.color.set(p.ink);
  };
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) renderer.render(scene, camera);
  });
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !document.hidden) start();
    else stop();
  });
  io.observe(container);
  const onVis = () => (document.hidden || !inView ? stop() : start());
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('palettechange', onPalette);
  document.addEventListener('visibilitychange', onVis);
  resize();
  renderer.render(scene, camera);

  return {
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
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
