// <vault-3d seed ring hue state> — the door on the entrance screen.
// state: locked | keyed | open. Setting "open" plays the unlock once.
import * as THREE from 'three'
import { disposeTree, releaseRenderer, sceneUnavailable, still, watchContext } from './shared.js'

const clamp = x => Math.max(0, Math.min(1, x));
const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

export class Vault3D extends HTMLElement {
  static get observedAttributes(){ return ['seed','ring','hue','state']; }
  connectedCallback(){
    this.style.display='block'; this.style.width='100%'; this.style.height='100%';
    this.alive = true; this.mx = 0; this.my = 0;
    if (this.renderer) return;
    try { this.init(THREE); } catch (e) { sceneUnavailable(this, e); }
  }
  disconnectedCallback(){
    this.alive = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    if (this.ro) this.ro.disconnect();
    if (this.unwatch) this.unwatch();
    disposeTree(this.scene); this.scene = null;
    if (this.renderer){ releaseRenderer(this.renderer); this.renderer = null; this.ready = false; }
  }
  attributeChangedCallback(n, o, v){
    if (n==='state'){ if (v==='open' && o!=='open') this.openAt = performance.now(); if (v!=='open') this.openAt = null; }
    if (this.ready && (n==='seed' || n==='hue')) this.applySeed();
  }
  init(T){
    this.T = T;
    const w = this.clientWidth || 400, h = this.clientHeight || 400;
    const r = new T.WebGLRenderer({antialias:true, alpha:true});
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(w, h);
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.shadowMap.enabled = true;
    r.domElement.style.cssText = 'display:block;width:100%;height:100%';
    this.appendChild(r.domElement); this.renderer = r; this.unwatch = watchContext(r.domElement, this);
    const scene = new T.Scene(); this.scene = scene;
    const cam = new T.PerspectiveCamera(30, w/h, .1, 50); cam.position.set(0,0,4.6); this.cam = cam;
    const root = new T.Group(); scene.add(root); this.root = root;
    scene.add(new T.HemisphereLight(0xfff1dc, 0x1a1510, 0.9));
    const key = new T.DirectionalLight(0xffe6c4, 2.6); key.position.set(-2.5,3,4); key.castShadow = true; key.shadow.mapSize.set(1024,1024); scene.add(key);
    const rim = new T.PointLight(0x9fb4ff, 5, 8); rim.position.set(2.5,-1.5,2); scene.add(rim);
    const steel = new T.MeshStandardMaterial({color:0x8d887e, metalness:.75, roughness:.38});
    const dark = new T.MeshStandardMaterial({color:0x3a3731, metalness:.7, roughness:.5});
    const brass = new T.MeshStandardMaterial({color:0xc29d56, metalness:.9, roughness:.3});
    const black = new T.MeshBasicMaterial({color:0x050404});
    this.brass = brass;
    root.add(new T.Mesh(new T.TorusGeometry(1.08,.09,24,120), dark));
    const wall = new T.Mesh(new T.RingGeometry(1.08,1.2,120), new T.MeshStandardMaterial({color:0x2a251e, metalness:.4, roughness:.8}));
    wall.position.z = -.05; root.add(wall);
    this.glowBase = new T.Color(0xffe2a8);
    this.glowMat = new T.MeshBasicMaterial({color:0x000000});
    const glow = new T.Mesh(new T.CircleGeometry(1.02,96), this.glowMat); glow.position.z = -.2; root.add(glow);
    this.glowLight = new T.PointLight(0xffe2a8, 0, 6); this.glowLight.position.set(0,0,.4); root.add(this.glowLight);
    const pivot = new T.Group(); pivot.position.set(-1.02,0,0); root.add(pivot); this.pivot = pivot;
    const door = new T.Group(); door.position.set(1.02,0,0); pivot.add(door);
    const slab = new T.Mesh(new T.CylinderGeometry(1,1,.2,120), steel); slab.rotation.x = Math.PI/2; slab.castShadow = true; slab.receiveShadow = true; door.add(slab);
    const bevel = new T.Mesh(new T.TorusGeometry(.93,.025,12,120), dark); bevel.position.z = .1; door.add(bevel);
    const groove = new T.Mesh(new T.TorusGeometry(.62,.012,8,120), dark); groove.position.z = .1; door.add(groove);
    this.bolts = new T.Group(); this.bolts.position.z = .1; door.add(this.bolts);
    this.dial = new T.Group(); this.dial.position.z = .105; door.add(this.dial);
    const dialBase = new T.Mesh(new T.RingGeometry(.66,.86,120), new T.MeshStandardMaterial({color:0x5a564d, metalness:.8, roughness:.45}));
    dialBase.receiveShadow = true; this.dial.add(dialBase);
    for (let i=0;i<60;i++){
      const long = i%5===0, a = i/60*Math.PI*2, rr = long?.79:.81;
      const t = new T.Mesh(new T.BoxGeometry(.012, long?.1:.05, .02), long?brass:dark);
      t.position.set(Math.sin(a)*rr, Math.cos(a)*rr, .01); t.rotation.z = -a; this.dial.add(t);
    }
    this.wheel = new T.Group(); this.wheel.position.z = .14; door.add(this.wheel);
    const hub = new T.Mesh(new T.CylinderGeometry(.3,.32,.1,64), steel); hub.rotation.x = Math.PI/2; hub.position.z = .02; hub.castShadow = true; this.wheel.add(hub);
    for (let i=0;i<3;i++){
      const a = i/3*Math.PI*2 + Math.PI/6;
      const sp = new T.Mesh(new T.CylinderGeometry(.032,.032,.32,16), steel);
      sp.position.set(Math.cos(a)*.46, Math.sin(a)*.46, .06); sp.rotation.z = a - Math.PI/2; sp.castShadow = true; this.wheel.add(sp);
      const knob = new T.Mesh(new T.SphereGeometry(.065,24,16), brass);
      knob.position.set(Math.cos(a)*.63, Math.sin(a)*.63, .06); knob.castShadow = true; this.wheel.add(knob);
    }
    const kh = new T.Group(); kh.position.z = .215; door.add(kh);
    kh.add(new T.Mesh(new T.CircleGeometry(.2,48), brass));
    const c = new T.Mesh(new T.CircleGeometry(.075,32), black); c.position.set(0,.08,.002); kh.add(c);
    const sl = new T.Mesh(new T.PlaneGeometry(.06,.2), black); sl.position.set(0,-.04,.002); kh.add(sl);
    this.onMove = e => { const b = this.getBoundingClientRect(); this.mx = Math.max(-1,Math.min(1,((e.clientX-b.left)/b.width-.5)*2)); this.my = Math.max(-1,Math.min(1,((e.clientY-b.top)/b.height-.5)*2)); };
    window.addEventListener('pointermove', this.onMove);
    this.ro = new ResizeObserver(() => { const W=this.clientWidth, H=this.clientHeight; if(!W||!H) return; r.setSize(W,H); cam.aspect=W/H; cam.updateProjectionMatrix(); });
    this.ro.observe(this);
    this.ready = true; this.applySeed();
    if (this.getAttribute('state')==='open' && !this.openAt) this.openAt = performance.now();
    const tick = now => {
      this.raf = requestAnimationFrame(tick);
      const calm = still();
      const ring = (+this.getAttribute('ring')||0) * Math.PI/180;
      const st = this.getAttribute('state') || 'locked';
      let dial = -ring, wheel = 0, swing = 0, g = 0, tilt = calm ? 0 : 1;
      if (this.openAt){
        const e = calm ? 10 : (now - this.openAt)/1000;
        dial = -ring + Math.PI*4*ease(clamp(e/.7));
        wheel = -Math.PI*1.25*ease(clamp((e-.2)/.6));
        swing = -1.75*ease(clamp((e-.8)/.9));
        g = clamp((e-.7)/.5); tilt = calm ? 0 : 1 - clamp(e/.4);
      } else if (st==='keyed' && !calm) dial = -ring + Math.sin(now/900)*.03;
      this.dial.rotation.z = dial; this.wheel.rotation.z = wheel; this.pivot.rotation.y = swing;
      this.glowMat.color.copy(this.glowBase).multiplyScalar(.04 + .96*g);
      this.glowLight.intensity = g*10;
      this.root.rotation.y += (this.mx*.1*tilt - this.root.rotation.y)*.06;
      this.root.rotation.x += (this.my*.08*tilt - this.root.rotation.x)*.06;
      r.render(scene, cam);
    };
    this.raf = requestAnimationFrame(tick);
  }
  applySeed(){
    const T = this.T, seed = this.getAttribute('seed') || '0000000000000000';
    const hue = +this.getAttribute('hue') || 40;
    this.glowBase = new T.Color().setHSL(hue/360, .55, .72);
    this.glowLight.color.copy(this.glowBase);
    while (this.bolts.children.length){ const b = this.bolts.children[0]; b.geometry.dispose(); this.bolts.remove(b); }
    const n = [8,10,12,16][parseInt(seed.slice(-2),16) % 4];
    for (let i=0;i<n;i++){
      const a = i/n*Math.PI*2;
      const b = new T.Mesh(new T.CylinderGeometry(.035,.035,.03,20), this.brass);
      b.rotation.x = Math.PI/2; b.position.set(Math.cos(a)*.965, Math.sin(a)*.965, 0); b.castShadow = true; this.bolts.add(b);
    }
  }
}
