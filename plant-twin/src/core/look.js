// Scene palette and per-object material sets: a white study model with graphite edges.

import * as THREE from 'three';

export const PALETTES = {
  light: {
    bg: '#e6e8e4', ground: '#d6d9d3', floor: '#e3e5e0', floorLine: '#c4c8c2', paint: '#7d868c', paintText: '#5b646a',
    body: '#f4f5f2', dark: '#b2b8bb', steel: '#e3e6e6', rubber: '#5f666b', glass: '#b9cfd8', product: '#c98b34',
    struct: '#e6e8e5', clad: '#cfd8dc', edge: '#262c31', edgeOpacity: 0.62, cladOpacity: 0.16,
    hemiSky: '#ffffff', hemiGround: '#bdbab0', hemi: 1.15, sun: 2.1, env: 0.35, exposure: 1.0, fog: 0.0009,
    figure: '#9aa2a7',
  },
};

export const STATUS_COLORS = {
  run: '#2f9e64', idle: '#d19a1f', wait: '#d19a1f', starved: '#d19a1f', blocked: '#d97a26',
  stop: '#d2453c', fault: '#d2453c', off: '#8e979c', warmup: '#3c86d8', changeover: '#7a68d0',
};

const SOLID = ['body', 'dark', 'steel', 'rubber', 'product', 'struct'];

export class Look {
  constructor() {
    this.sets = new Set();
    this.name = 'light';
    this.p = PALETTES.light;
  }

  createSet(kind = 'eq') {
    const s = new MatSet(this, kind);
    this.sets.add(s);
    return s;
  }

}

export class MatSet {
  constructor(look, kind) {
    this.look = look;
    this.kind = kind;
    this.meshes = [];
    this.lines = [];
    this.m = {
      body: new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.0 }),
      struct: new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 }),
      dark: new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.08 }),
      steel: new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.32 }),
      rubber: new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 }),
      product: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 }),
      glass: new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0.1, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      edge: new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }),
    };
    for (const k in this.m) if (this.m[k].isMeshStandardMaterial) this.m[k].envMapIntensity = 0.45;
    this.state = { mode: 'model', tint: null, k: 0, hover: false, ghost: false, selected: false, hidden: false };
    this._tmp = new THREE.Color();
    this.refresh();
  }

  get(layer) {
    return this.m[layer] || this.m.body;
  }

  track(meshes, lines) {
    this.meshes.push(...meshes);
    if (lines) this.lines.push(lines);
    this.applyShadow();
  }

  set(patch) {
    let changed = false;
    for (const k in patch) if (this.state[k] !== patch[k]) { this.state[k] = patch[k]; changed = true; }
    if (changed) this.refresh();
  }

  applyShadow() {
    const ghost = this.state.ghost || this.state.mode === 'xray';
    for (const mesh of this.meshes) mesh.castShadow = !ghost && mesh.userData.layer !== 'glass';
  }

  refresh() {
    const p = this.look.p;
    const st = this.state;
    const ghost = st.ghost;
    const xray = st.mode === 'xray' && !st.selected;
    const tint = st.tint ? this._tmp.set(st.tint) : null;
    for (const L of SOLID) {
      const mat = this.m[L];
      mat.color.set(p[L] ?? p.body);
      if (tint && L !== 'product') mat.color.lerp(tint, st.k * (L === 'body' || L === 'struct' ? 1 : 0.7));
      const transparent = ghost || xray;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.opacity = ghost ? 0.05 : xray ? 0.1 : 1;
      mat.depthWrite = !transparent;
      mat.emissive.set(st.hover || st.selected ? '#3f6fe0' : '#000000');
      mat.emissiveIntensity = st.selected ? 0.1 : st.hover ? 0.16 : 0;
    }
    const g = this.m.glass;
    g.color.set(p.glass);
    g.opacity = ghost ? 0.03 : (this.kind === 'clad' ? p.cladOpacity : 0.2);
    const e = this.m.edge;
    e.color.set(p.edge);
    e.opacity = ghost ? 0.08 : xray ? p.edgeOpacity : this.kind === 'struct' ? p.edgeOpacity * 0.55 : p.edgeOpacity;
    for (const l of this.lines) l.visible = !st.hidden;
    for (const mesh of this.meshes) mesh.visible = !st.hidden;
    this.applyShadow();
  }
}
