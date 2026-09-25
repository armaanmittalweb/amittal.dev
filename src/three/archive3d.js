// <archive-3d mode mat hue data> — every 3D view after the vault.
// mode: cabinet | graph | pipeline | seed | exploded | reel. data is JSON.
// Picks are reported as window 'archive3d' events; the page owns all state.
import * as THREE from 'three'
import { disposeTree, releaseRenderer, sceneUnavailable, still, watchContext } from './shared.js'

const clamp=x=>Math.max(0,Math.min(1,x));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const lerp=(a,b,k)=>a+(b-a)*k;
const PAL={
  paper:{ink:'#1c1a15',muted:'#5a5447',line:'#c6baa0',face:'#e6dcc3',body:0x8a7f68,block:0xe6dcc3},
  draft:{ink:'#eef0ee',muted:'#a9b5c9',line:'#3d5076',face:'#22324f',body:0x2b3a5a,block:0x2a3c60},
  film:{ink:'#d3e0c6',muted:'#8c9a84',line:'#3a473b',face:'#1a2019',body:0x1c231c,block:0x1f2a20}
};
const FH='"Big Shoulders Stencil Display", sans-serif', FM='"Martian Mono", monospace';
const emit=d=>window.dispatchEvent(new CustomEvent('archive3d',{detail:d}));
// With reduced motion every view is shown at a fixed moment after its intro has finished.
const STILL_T=30;

export class Archive3D extends HTMLElement{
  static get observedAttributes(){ return ['data','mat','hue','mode']; }
  connectedCallback(){
    Object.assign(this.style,{display:'block',width:'100%',height:'100%',position:'relative',touchAction:'pan-y'});
    this.alive=true; this.mx=0; this.my=0; this.spin=0;
    (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>{ if(this.alive&&!this.r) this.init(THREE); }).catch(e=>sceneUnavailable(this,e));
  }
  disconnectedCallback(){
    this.alive=false; cancelAnimationFrame(this.raf); clearTimeout(this.openT);
    if(this.ro) this.ro.disconnect(); if(this.io) this.io.disconnect();
    window.removeEventListener('pointermove',this.onWinMove);
    if(this.unwatch) this.unwatch();
    if(this.overlay){ this.overlay.remove(); this.overlay=null; }
    disposeTree(this.scene); this.scene=null;
    if(this.r){ releaseRenderer(this.r); this.r=null; this.ready=false; }
  }
  attributeChangedCallback(n,o,v){
    if(!this.ready||o===v) return;
    const u=this['update_'+this.mode];
    if(n==='data'&&u) u.call(this,this.data); else this.rebuild();
  }
  // React 19 assigns props to custom elements as properties when one exists, so these reflect to attributes.
  get mode(){ return this.getAttribute('mode')||'cabinet'; }
  set mode(v){ this.setAttribute('mode',v); }
  get data(){ try{ return JSON.parse(this.getAttribute('data')||'{}'); }catch{ return {}; } }
  set data(v){ this.setAttribute('data',typeof v==='string'?v:JSON.stringify(v)); }
  get pal(){ return PAL[this.getAttribute('mat')]||PAL.paper; }
  get accent(){ const h=(+this.getAttribute('hue')||40)/360; return new this.T.Color().setHSL(h,.62,this.getAttribute('mat')==='paper'?.42:.64); }

  init(T){
    this.T=T;
    const r=new T.WebGLRenderer({antialias:true,alpha:true});
    r.setPixelRatio(Math.min(2,devicePixelRatio)); r.outputColorSpace=T.SRGBColorSpace;
    r.toneMapping=T.ACESFilmicToneMapping; r.shadowMap.enabled=true; r.shadowMap.type=T.PCFSoftShadowMap;
    r.domElement.style.cssText='display:block;width:100%;height:100%;outline:none';
    this.appendChild(r.domElement); this.r=r; this.unwatch=watchContext(r.domElement,this);
    // Text sits over the canvas as real DOM, so it stays crisp and readable at any size.
    this.overlay=document.createElement('div'); this.overlay.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
    this.appendChild(this.overlay); this.tags=[];
    this.cam=new T.PerspectiveCamera(32,1,.1,100);
    this.ray=new T.Raycaster(); this.ptr=new T.Vector2(-9,-9);
    const cv=r.domElement; cv.draggable=false; cv.setAttribute('draggable','false');
    Object.assign(cv.style,{userSelect:'none',webkitUserSelect:'none',webkitUserDrag:'none',touchAction:'pan-y',webkitTapHighlightColor:'transparent'});
    this.style.userSelect='none'; this.style.webkitUserSelect='none';
    const setPtr=e=>{ const b=cv.getBoundingClientRect(); this.ptr.set(((e.clientX-b.left)/b.width)*2-1, -((e.clientY-b.top)/b.height)*2+1); };
    cv.addEventListener('dragstart',e=>e.preventDefault());
    cv.addEventListener('pointerdown',e=>{ if(e.button>0) return; e.preventDefault(); setPtr(e); try{ cv.setPointerCapture(e.pointerId); }catch{ /* pointer already gone */ } this.drag={x:e.clientX,moved:0}; this.lastTouch=performance.now(); });
    cv.addEventListener('pointermove',e=>{ setPtr(e); if(!this.drag) return; const dx=e.clientX-this.drag.x; this.drag.x=e.clientX; this.drag.moved+=Math.abs(dx); this.lastTouch=performance.now();
      const dm=this['drag_'+this.mode]; if(dm) dm.call(this,dx); else if(this.draggable) this.spin+=dx*.008; });
    const end=e=>{ const d=this.drag; this.drag=null; try{ cv.releasePointerCapture(e.pointerId); }catch{ /* never captured */ } return d; };
    cv.addEventListener('pointerup',e=>{ const d=end(e); if(d&&d.moved<6){ setPtr(e); const hit=this.pick(); if(hit){ const f=this['pick_'+this.mode]; if(f) f.call(this,hit.userData.pick,this.lastHit); } } if(e.pointerType!=='mouse') this.ptr.set(-9,-9); });
    cv.addEventListener('pointercancel',e=>{ end(e); this.ptr.set(-9,-9); });
    cv.addEventListener('pointerleave',()=>{ if(!this.drag) this.ptr.set(-9,-9); });
    this.onWinMove=e=>{ const b=this.getBoundingClientRect(); this.mx=Math.max(-1,Math.min(1,((e.clientX-b.left)/b.width-.5)*2)); this.my=Math.max(-1,Math.min(1,((e.clientY-b.top)/b.height-.5)*2)); };
    window.addEventListener('pointermove',this.onWinMove);
    this.ro=new ResizeObserver(()=>this.resize()); this.ro.observe(this);
    this.visible=true; this.io=new IntersectionObserver(es=>{ this.visible=es[0].isIntersecting; }); this.io.observe(this);
    this.ready=true; this.rebuild();
    const tick=now=>{
      this.raf=requestAnimationFrame(tick);
      const calm=still();
      const dt=calm?0:Math.min(.05,(now-(this.last||now))/1000); this.last=now;
      if(!this.visible||!this.scene) return;
      if(!this.t0) this.t0=now;
      this.frame(calm?STILL_T:(now-this.t0)/1000,dt,calm);
      r.render(this.scene,this.cam);
      this.placeTags();
    };
    this.raf=requestAnimationFrame(tick);
  }
  resize(){
    if(!this.r) return; const w=this.clientWidth,h=this.clientHeight; if(!w||!h) return;
    this.r.setSize(w,h,false); this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); this.aspect=w/h;
    this.classList.toggle('a3d-compact',w<480);
    this.tags.forEach(t=>{ t.w=0; }); // label font sizes follow the viewport, so re-measure
    if(this.layout) this.layout();
  }
  pick(){
    this.lastHit=null;
    if(!this.pickables||!this.pickables.length||this.ptr.x<-2) return null;
    this.ray.setFromCamera(this.ptr,this.cam);
    const h=this.ray.intersectObjects(this.pickables,true)[0]; if(!h) return null; this.lastHit=h;
    let o=h.object; while(o&&o.userData.pick===undefined) o=o.parent; return o;
  }
  rebuild(){
    const T=this.T;
    if(this.lastMode!==this.mode){ this.spin=0; this.lastMode=this.mode; }
    clearTimeout(this.openT); disposeTree(this.scene);
    this.overlay.textContent=''; this.tags=[]; this.tagHover=null;
    this.scene=new T.Scene(); this.pickables=[]; this.layout=null; this.t0=0; this.opened=null;
    this.baseRot={x:0,y:0}; this.spinLimit=Infinity; this.autoSpin=0; this.draggable=false;
    this.scene.add(new T.HemisphereLight(0xfff6e8,0x2a2a2a,1.2));
    const key=new T.DirectionalLight(0xfff0dc,2.4); key.position.set(-3,6,5); key.castShadow=true;
    key.shadow.mapSize.set(1024,1024); const sc=key.shadow.camera; sc.left=-6; sc.right=6; sc.top=6; sc.bottom=-6; sc.far=30; key.shadow.bias=-.0005;
    this.scene.add(key);
    const rim=new T.DirectionalLight(0xbcd0ff,.9); rim.position.set(5,2,-4); this.scene.add(rim);
    this.root=new T.Group(); this.scene.add(this.root);
    const b=this['build_'+this.mode]; if(b) b.call(this,this.data);
    this.resize();
  }
  frame(t,dt,calm){
    const hov=this.pick(); this.hover=hov?hov.userData.pick:null;
    if(this.hover!==this.lastHov){ this.lastHov=this.hover; emit({type:'hover',mode:this.mode,i:this.hover}); }
    this.r.domElement.style.cursor=this.drag&&this.drag.moved>5?'grabbing':(hov?'pointer':(this.draggable||this['drag_'+this.mode]?'grab':'default'));
    if(!this.drag&&performance.now()-(this.lastTouch||0)>3500) this.spin+=this.autoSpin*dt;
    if(isFinite(this.spinLimit)) this.spin=Math.max(-this.spinLimit,Math.min(this.spinLimit,this.spin));
    const px=calm?0:this.mx, py=calm?0:this.my;
    this.root.rotation.y=lerp(this.root.rotation.y,this.baseRot.y+this.spin+px*.12,.08);
    this.root.rotation.x=lerp(this.root.rotation.x,this.baseRot.x+py*.06,.08);
    const f=this['frame_'+this.mode]; if(f) f.call(this,t,dt);
  }
  ground(y,size){
    const T=this.T; const g=new T.Mesh(new T.PlaneGeometry(size||16,size||16),new T.ShadowMaterial({opacity:this.getAttribute('mat')==='paper'?.16:.4}));
    g.rotation.x=-Math.PI/2; g.position.y=y; g.receiveShadow=true; this.root.add(g);
  }
  tex(w,h,draw){ const T=this.T; const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; t.anisotropy=8; return t; }
  /**
   * A DOM label pinned to an Object3D. o.align 'left' starts the label at the anchor;
   * o.top hangs it below the anchor; o.onPick makes it tappable, a bigger target than the mesh.
   */
  tag(text,sub,anchor,o={}){
    const el=document.createElement('div'); el.className='a3d-tag'+(o.align==='left'?' a3d-left':'')+(o.mono?' a3d-mono':'');
    const b=document.createElement('b'); b.textContent=text; el.appendChild(b);
    if(sub){ const s=document.createElement('span'); s.textContent=sub; el.appendChild(s); }
    if(o.onPick){
      el.classList.add('a3d-pick');
      el.addEventListener('click',o.onPick);
      el.addEventListener('pointerenter',()=>{ this.tagHover=o.key; });
      el.addEventListener('pointerleave',()=>{ if(this.tagHover===o.key) this.tagHover=null; });
    }
    this.overlay.appendChild(el);
    const t={el,anchor,left:o.align==='left',top:!!o.top,w:0,h:0,s:''}; this.tags.push(t); return t;
  }
  tagState(t,s){ if(t.s!==s){ t.s=s; t.el.dataset.s=s; } }
  /** Moves every label to its anchor's projected position, clamped inside the canvas. */
  placeTags(){
    if(!this.tags.length) return;
    const W=this.clientWidth,H=this.clientHeight,v=this.tv||(this.tv=new this.T.Vector3());
    for(const t of this.tags) if(!t.w){ t.w=t.el.offsetWidth; t.h=t.el.offsetHeight; }
    for(const t of this.tags){
      t.anchor.getWorldPosition(v).project(this.cam);
      let x=(v.x+1)/2*W-(t.left?0:t.w/2), y=(1-v.y)/2*H-(t.top?0:t.h/2);
      x=Math.min(Math.max(x,2),W-t.w-2); y=Math.min(Math.max(y,2),H-t.h-2);
      t.el.style.visibility=v.z>1?'hidden':'visible';
      t.el.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';
    }
  }
  fit(w,h,m){ const f=Math.tan(this.cam.fov*Math.PI/360), a=this.aspect||1; return Math.max((h*m)/(2*f),(w*m)/(2*f*a)); }
  metals(){ const T=this.T; return {
    steel:new T.MeshStandardMaterial({color:0x8d887e,metalness:.75,roughness:.38}),
    dark:new T.MeshStandardMaterial({color:0x3d3c37,metalness:.65,roughness:.5}),
    brass:new T.MeshStandardMaterial({color:0xc29d56,metalness:.9,roughness:.28}) }; }

  /* ---------- CABINET (Core) ---------- */
  drawerTex(it){ const p=PAL[it.mat]||PAL.paper; return this.tex(1024,256,(g,w,h)=>{
    g.fillStyle=p.face; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.2)'; g.fillRect(0,h-8,w,8);
    g.fillStyle='#a8874a'; g.fillRect(w/2-300,18,600,142); g.fillStyle='#f4efe2'; g.fillRect(w/2-290,27,580,124);
    g.fillStyle='#1c1a15'; g.textAlign='center'; g.textBaseline='middle';
    let fs=108; g.font='800 '+fs+'px '+FH; while(fs>48&&g.measureText(it.label).width>540){ fs-=4; g.font='800 '+fs+'px '+FH; }
    g.fillText(it.label,w/2,92);
    g.textAlign='left'; g.fillStyle=p.ink; g.globalAlpha=.85; g.font='600 38px '+FM; g.fillText(it.num,34,64); g.fillText(it.mat.toUpperCase(),34,212); g.globalAlpha=1;
    if(it.seen){ g.save(); g.translate(w-190,200); g.rotate(-.1); g.strokeStyle='#b23a2a'; g.lineWidth=6; g.strokeRect(-150,-34,300,68); g.fillStyle='#b23a2a'; g.font='800 50px '+FH; g.textAlign='center'; g.fillText('RECOVERED',0,3); g.restore(); }
  }); }
  build_cabinet(d){
    const T=this.T, items=d.items||[], n=items.length, H=.46, W=1.8, D=1.6, bodyH=n*H+.14, {dark,brass}=this.metals();
    const steel=new T.MeshStandardMaterial({color:0x6a685f,metalness:.55,roughness:.45});
    const shell=new T.Group(); shell.position.z=-D/2;
    const add=(w,h,dd,x,y,z,m)=>{ const o=new T.Mesh(new T.BoxGeometry(w,h,dd),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; shell.add(o); };
    add(W+.14,bodyH,.05,0,bodyH/2,-D/2+.025,steel);
    add(.07,bodyH,D,-(W/2+.035),bodyH/2,0,steel); add(.07,bodyH,D,(W/2+.035),bodyH/2,0,steel);
    add(W+.22,.07,D+.08,0,bodyH+.035,0,dark); add(W+.14,.07,D,0,.035,0,dark);
    add(W,bodyH-.1,.01,0,bodyH/2,-D/2+.06,new T.MeshStandardMaterial({color:0x121110,roughness:1}));
    this.root.add(shell);
    const trayM=new T.MeshStandardMaterial({color:0x4a4943,metalness:.4,roughness:.6});
    const folderA=new T.MeshStandardMaterial({color:0xd9c9a2,roughness:.95}), folderB=new T.MeshStandardMaterial({color:0xc9b684,roughness:.95});
    this.drawers=items.map((it,i)=>{
      const g=new T.Group(); g.userData.pick=i; g.position.set(0,bodyH-.07-H*(i+.5),0);
      const side=new T.MeshStandardMaterial({color:(PAL[it.mat]||PAL.paper).body,metalness:.3,roughness:.6});
      const face=new T.MeshStandardMaterial({map:this.drawerTex(it),roughness:.75,metalness:.05});
      const front=new T.Mesh(new T.BoxGeometry(W-.02,H-.035,.07),[side,side,side,side,face,side]); front.castShadow=true; front.receiveShadow=true; g.add(front);
      const tl=D-.14;
      [[W-.12,.02,tl,0,-H/2+.05],[.02,H-.14,tl,-(W-.12)/2,-.02],[.02,H-.14,tl,(W-.12)/2,-.02]].forEach(q=>{ const m=new T.Mesh(new T.BoxGeometry(q[0],q[1],q[2]),trayM); m.position.set(q[3],q[4],-tl/2); g.add(m); });
      for(let k=0;k<7;k++){ const f=new T.Mesh(new T.BoxGeometry(W-.3,H*.62,.014),k%2?folderA:folderB); f.position.set(0,-.02,-.14-k*.19); f.rotation.x=-.08; g.add(f);
        if(k%3===0){ const tab=new T.Mesh(new T.BoxGeometry(.28,.07,.014),f.material); tab.position.set(-.5+k*.16,H*.31+.02,-.14-k*.19); tab.rotation.x=-.08; g.add(tab); } }
      const hd=new T.Mesh(new T.CylinderGeometry(.022,.022,.4,16),brass); hd.rotation.z=Math.PI/2; hd.position.set(0,-.13,.1); hd.castShadow=true; g.add(hd);
      [-.2,.2].forEach(x=>{ const p=new T.Mesh(new T.CylinderGeometry(.014,.014,.07,10),brass); p.rotation.x=Math.PI/2; p.position.set(x,-.13,.06); g.add(p); });
      this.root.add(g); this.pickables.push(g); return {g,z:0,it};
    });
    this.ground(0);
    this.baseRot={x:0,y:-.42}; this.spinLimit=.55; this.draggable=true;
    this.layout=()=>{ const dist=this.fit(2.6,bodyH*1.18,1); this.cam.position.set(0,bodyH*.62,dist); this.cam.lookAt(0,bodyH*.47,0); };
  }
  frame_cabinet(t){
    this.drawers.forEach((dr,i)=>{ let tg=0; if(this.hover===i) tg=.28; if(this.opened===i) tg=1.2;
      const intro=(1-ease(clamp((t-i*.07)/.7)))*.6; dr.z=lerp(dr.z,tg,.12); dr.g.position.z=dr.z+intro; });
  }
  pick_cabinet(i){ if(this.opened!=null) return; this.opened=i; const key=this.drawers[i].it.key; this.openT=setTimeout(()=>emit({type:'open',key}),still()?0:520); }

  /* ---------- GRAPH (Trace) ---------- */
  build_graph(d){
    const T=this.T, acc=this.accent, p=this.pal, nodes=d.nodes||[], pos={}, zs=[0,.9,-.8,.7,-.6,0];
    // Portrait canvases get a narrower, taller layout so nodes and labels keep their room.
    const portrait=(this.aspect||2)<1, sx=portrait?.62:1, sy=portrait?1.35:1; this.portrait=portrait;
    this.graphSig=JSON.stringify(nodes); this.sel=d.sel;
    nodes.forEach((n,i)=>{ pos[n.id]=new T.Vector3((n.x-320)/105*sx,-(n.y-190)/105*sy,zs[i%6]); });
    this.pulses=[]; this.edgeObjs=[]; this.adj={};
    (d.edges||[]).forEach(([a,b])=>{ const A=pos[a],B=pos[b]; if(!A||!B) return;
      (this.adj[a]=this.adj[a]||[]).push(b); (this.adj[b]=this.adj[b]||[]).push(a);
      const on=nodes.find(n=>n.id===a).lit&&nodes.find(n=>n.id===b).lit, e={a,b,mats:[]};
      if(on){ const m=new T.MeshBasicMaterial({color:acc,transparent:true}); m.userData.base=1; e.mats.push(m); this.root.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(A,B),1,.016,6),m));
        for(let k=0;k<2;k++){ const sm=new T.MeshBasicMaterial({color:0xffffff,transparent:true}); sm.userData.base=1; e.mats.push(sm); const s=new T.Mesh(new T.SphereGeometry(.04,10,8),sm); this.root.add(s); this.pulses.push({s,A,B,o:k*.5+Math.random()*.2}); } }
      else { const m=new T.LineDashedMaterial({color:new T.Color(p.muted),dashSize:.08,gapSize:.07,transparent:true,opacity:.7}); m.userData.base=.7; e.mats.push(m); const l=new T.Line(new T.BufferGeometry().setFromPoints([A,B]),m); l.computeLineDistances(); this.root.add(l); }
      this.edgeObjs.push(e);
    });
    this.nodeGroups=[];
    nodes.forEach(n=>{ const g=new T.Group(); g.position.copy(pos[n.id]); g.userData.pick=n.id;
      if(n.lit){ const s=new T.Mesh(new T.SphereGeometry(.18,32,24),new T.MeshStandardMaterial({color:acc,emissive:acc,emissiveIntensity:.5,roughness:.35})); s.castShadow=true; g.add(s); }
      else g.add(new T.Mesh(new T.IcosahedronGeometry(.18,1),new T.MeshBasicMaterial({color:new T.Color(p.muted),wireframe:true})));
      g.add(new T.Mesh(new T.SphereGeometry(.4,12,8),new T.MeshBasicMaterial({visible:false})));
      const a=new T.Object3D(); a.position.set(0,-.24,0); g.add(a);
      g.userData.tag=this.tag(n.label,n.year,a,{top:true,key:n.id,onPick:()=>emit({type:'node',id:n.id})}); g.userData.lit=n.lit;
      this.root.add(g); this.pickables.push(g); this.nodeGroups.push(g);
    });
    this.ring=new T.Mesh(new T.TorusGeometry(.3,.014,8,48),new T.MeshBasicMaterial({color:new T.Color(p.ink)})); this.root.add(this.ring);
    this.draggable=true; this.spinLimit=.9;
    this.layout=()=>{ if(((this.aspect||2)<1)!==this.portrait){ this.rebuild(); return; } const dist=portrait?this.fit(4.4,5.6,1.05):this.fit(6.6,4.6,1.05); this.cam.position.set(0,.2,dist); this.cam.lookAt(0,portrait?-.3:-.1,0); };
  }
  update_graph(d){ if(JSON.stringify(d.nodes)!==this.graphSig) return this.rebuild(); this.sel=d.sel; }
  frame_graph(t){
    if(performance.now()-(this.lastTouch||0)>3500) this.baseRot.y=lerp(this.baseRot.y,Math.sin(t*.28)*.3,.02);
    const hv=this.hover||this.tagHover, f=hv||this.sel, adj=f?(this.adj[f]||[]):[];
    this.pulses.forEach(p=>p.s.position.lerpVectors(p.A,p.B,(t*.4+p.o)%1));
    this.edgeObjs.forEach(e=>{ const k=!f||e.a===f||e.b===f?1:.12; e.mats.forEach(m=>{ m.opacity=lerp(m.opacity,m.userData.base*k,.15); }); });
    this.nodeGroups.forEach(g=>{ const id=g.userData.pick, near=!f||id===f||adj.includes(id);
      g.scale.setScalar(lerp(g.scale.x,hv===id?1.25:(near?1:.8),.15));
      this.tagState(g.userData.tag,[near?'':'dim',id===this.sel?'sel':'',g.userData.lit?'':'off'].join(' ').trim()); });
    const sg=this.nodeGroups.find(g=>g.userData.pick===this.sel); this.ring.visible=!!sg;
    if(sg){ this.ring.position.copy(sg.position); this.ring.lookAt(this.cam.position); this.ring.scale.setScalar(sg.scale.x*(1+Math.sin(t*3)*.05)); }
  }
  pick_graph(id){ emit({type:'node',id}); }

  /* ---------- PIPELINE (Project) ---------- */
  /**
   * Picks the pipeline's rows and columns: the biggest blocks (so the biggest text) among
   * layouts no taller than about half the screen, and never taller than the space under the
   * header, so the figure and its verdict fit together. Rows are evened out: 7 stages become
   * 4+3, never 6+1.
   */
  pipeLayout(n){
    const W=this.clientWidth||600, hdr=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||60;
    const maxH=Math.max(200,Math.min(520,innerHeight-hdr-150)), opts=[];
    for(let c=n;c>=Math.min(2,n);c--){
      const rows=Math.ceil(n/c), cols=Math.ceil(n/rows), w=(cols-1)*1.32+1.35, hh=(rows-1)*1.25+1.6;
      const h=Math.round(Math.min(maxH,Math.max(200,W*hh/w))), px=Math.min(W/w,h/hh)*1.05;
      if(!opts.some(o=>o.cols===cols)) opts.push({cols,rows,w,hh,h,px});
    }
    const comfort=Math.min(maxH,Math.max(300,innerHeight*.5)), fits=opts.filter(o=>o.h<=comfort);
    return fits.length?fits.reduce((a,b)=>b.px>a.px+2?b:a):opts.reduce((a,b)=>b.h<a.h?b:a);
  }
  build_pipeline(d){
    const T=this.T, p=this.pal, acc=this.accent, st=d.stages||[], n=st.length;
    this.lastStages=JSON.stringify(st); this.removed=d.removed;
    // Rows run left to right, then right to left, so the flow never jumps back across the figure.
    const L=this.pipeLayout(n), {cols,rows}=L, sx=1.32, sy=1.25; this.cols=cols;
    const pts=st.map((_,i)=>{ const row=Math.floor(i/cols), c=i%cols, cc=row%2?cols-1-c:c; return new T.Vector3((cc-(cols-1)/2)*sx,((rows-1)/2-row)*sy,0); });
    this.pts=pts; this.stages=[];
    const blockM=new T.MeshStandardMaterial({color:(PAL[this.getAttribute('mat')]||PAL.paper).block,roughness:.55,metalness:.15});
    st.forEach((name,i)=>{
      const g=new T.Group(); g.position.copy(pts[i]); g.userData.pick=i;
      const face=this.tex(512,300,(c,w,h)=>{ c.fillStyle=p.face; c.fillRect(0,0,w,h); c.strokeStyle=p.ink; c.lineWidth=6; c.strokeRect(10,10,w-20,h-20);
        c.fillStyle=p.ink; c.globalAlpha=.8; c.font='600 54px '+FM; c.textAlign='left'; c.textBaseline='top'; c.fillText('S'+String(i+1).padStart(2,'0'),28,20); c.globalAlpha=1;
        c.textAlign='center'; c.textBaseline='middle';
        const words=name.toUpperCase().split(' '), half=Math.ceil(words.length/2);
        const lines=words.length>1&&name.length>9?[words.slice(0,half).join(' '),words.slice(half).join(' ')]:[name.toUpperCase()];
        let fs=104; c.font='800 '+fs+'px '+FH; while(fs>44&&Math.max(...lines.map(l=>c.measureText(l).width))>w-60){ fs-=4; c.font='800 '+fs+'px '+FH; }
        const lh=fs*.92; lines.forEach((l,k)=>c.fillText(l,w/2,h/2+30+(k-(lines.length-1)/2)*lh)); });
      const fm=new T.MeshStandardMaterial({map:face,roughness:.6});
      const box=new T.Mesh(new T.BoxGeometry(1.05,.62,.42),[blockM,blockM,blockM,blockM,fm,blockM]); box.castShadow=true; g.add(box);
      g.add(new T.LineSegments(new T.EdgesGeometry(box.geometry),new T.LineBasicMaterial({color:new T.Color(p.ink),transparent:true,opacity:.45})));
      this.root.add(g); this.pickables.push(g); this.stages.push({g,fm,base:pts[i].clone(),drop:0});
    });
    const cm=new T.MeshStandardMaterial({color:new T.Color(p.muted),roughness:.5});
    for(let i=0;i<n-1;i++){ const A=pts[i],B=pts[i+1], dir=B.clone().sub(A), len=dir.length(); const c=new T.Mesh(new T.CylinderGeometry(.025,.025,len,10),cm); c.position.copy(A).add(B).multiplyScalar(.5); c.position.z=-.05; c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()); this.root.add(c); }
    const pc=Math.max(12,n*3); this.parts=[];
    for(let k=0;k<pc;k++){ const m=new T.MeshBasicMaterial({color:acc.clone()}); const s=new T.Mesh(new T.SphereGeometry(.05,12,8),m); this.root.add(s); this.parts.push({s,o:k/pc,j:new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5)}); }
    this.acc=acc; this.err=new T.Color('#d0513f'); this.white=new T.Color(1,1,1); this.dim=new T.Color(.5,.5,.5);
    this.ground(Math.min(...pts.map(v=>v.y))-.75);
    this.baseRot={x:.12,y:rows>1?0:-.16}; this.spinLimit=.4;
    const {w,hh}=L;
    // The figure sets its own height from its rows, so nothing is letterboxed or cut off.
    const fitHeight=h=>{ if(Math.abs(this.clientHeight-h)>1) this.style.height=h+'px'; };
    fitHeight(L.h);
    // A single row is turned toward the viewer, so its far end needs extra room in the frame.
    this.layout=()=>{ const now=this.pipeLayout(n); if(now.cols!==this.cols){ this.rebuild(); return; } fitHeight(now.h); const dist=rows>1?this.fit(w,hh,1.08):this.fit(w+.7,hh,1.1); this.cam.position.set(0,.35,dist); this.cam.lookAt(0,-.12,0); };
  }
  update_pipeline(d){ if(JSON.stringify(d.stages)!==this.lastStages) return this.rebuild(); this.removed=d.removed; }
  pointAt(u){ const pts=this.pts, n=pts.length; u=Math.max(0,Math.min(n-1,u)); const i=Math.min(n-2,Math.floor(u)); return pts[i].clone().lerp(pts[i+1],u-i); }
  frame_pipeline(t){
    const rem=this.removed, n=this.stages.length;
    this.stages.forEach((s,i)=>{ const isRem=rem===i, after=rem!=null&&i>rem;
      s.drop=lerp(s.drop,isRem?1:0,.1);
      s.g.position.y=s.base.y-s.drop*.5+(this.hover===i?.07:0)+Math.sin(t*1.6+i)*.02;
      s.g.position.z=s.base.z-s.drop*.25; s.g.rotation.x=s.drop*.45; s.g.rotation.z=s.drop*(i%2?.18:-.18);
      s.fm.color.lerp(isRem?this.err:(after?this.dim:this.white),.1); });
    if(n<2) return;
    const limit=rem==null?n-1:Math.max(0,rem-.6);
    this.parts.forEach(p=>{ const u=((t*.32+p.o)%1)*(n-1);
      if(u<=limit||rem==null){ p.s.position.copy(this.pointAt(u)); p.s.material.color.lerp(this.acc,.2); p.s.scale.setScalar(1); }
      else { const q=this.pointAt(limit); q.addScaledVector(p.j,.18+Math.sin(t*9+p.o*20)*.05); p.s.position.copy(q); p.s.material.color.lerp(this.err,.3); p.s.scale.setScalar(.7); } });
  }
  pick_pipeline(i){ emit({type:'stage',i}); }

  /* ---------- SEED (Report) ---------- */
  build_seed(d){
    const T=this.T, bits=(d.bits||'').padEnd(64,'0'), acc=this.accent, p=this.pal;
    const on=new T.MeshStandardMaterial({color:acc,roughness:.35,metalness:.2,emissive:acc,emissiveIntensity:.18});
    const off=new T.MeshStandardMaterial({color:new T.Color(p.line),roughness:.8});
    const geo=new T.BoxGeometry(.3,1,.3); this.cubes=[];
    for(let i=0;i<64;i++){ const r=Math.floor(i/8), c=i%8, b=bits[i]==='1'; const m=new T.Mesh(geo,b?on:off); m.position.set((c-3.5)*.38,0,(r-3.5)*.38); m.castShadow=true; m.receiveShadow=true; this.root.add(m); this.cubes.push({m,h:b?.9:.08,d:(r+c)*.06}); }
    const hex=(d.hex||'').toUpperCase();
    // Each row of cubes is one byte; its label sits at the row's end. The grid holds a slight
    // angle instead of spinning, so the labels stay in a readable column beside their rows.
    if(hex) for(let r=0;r<8;r++){ const a=new T.Object3D(); a.position.set(1.85,.1,(r-3.5)*.38); this.root.add(a); this.tag(hex.slice(r*2,r*2+2),'',a,{align:'left',mono:true}); }
    this.ground(0,8); this.draggable=true; this.spinLimit=.5; this.baseRot={x:0,y:.28};
    this.layout=()=>{ const dist=this.fit(4.8,3,1); this.cam.position.set(0,dist*.62,dist*.8); this.cam.lookAt(0,.25,0); };
  }
  frame_seed(t){ this.cubes.forEach(c=>{ const k=ease(clamp((t-c.d)/.7)); const h=Math.max(.01,c.h*k+(c.h>.5?Math.sin(t*1.4+c.d*6)*.04:0)); c.m.scale.y=h; c.m.position.y=h/2; }); }

  /* ---------- EXPLODED (Inspect) ---------- */
  build_exploded(d){
    const T=this.T, acc=this.accent, p=this.pal, L=d.layers||[], {steel,dark,brass}=this.metals(), mk=[];
    const G=()=>new T.Group();
    { const g=G(); g.add(new T.Mesh(new T.CircleGeometry(1,64),new T.MeshBasicMaterial({color:acc,side:T.DoubleSide}))); mk.push(g); }
    { const g=G(); g.add(new T.Mesh(new T.TorusGeometry(1.08,.09,20,96),dark)); mk.push(g); }
    { const g=G(); const s=new T.Mesh(new T.CylinderGeometry(1,1,.16,96),steel); s.rotation.x=Math.PI/2; g.add(s);
      for(let i=0;i<12;i++){ const a=i/12*Math.PI*2, b=new T.Mesh(new T.CylinderGeometry(.035,.035,.04,16),brass); b.rotation.x=Math.PI/2; b.position.set(Math.cos(a)*.93,Math.sin(a)*.93,.09); g.add(b); } mk.push(g); }
    { const g=G(); g.add(new T.Mesh(new T.RingGeometry(.66,.86,96),new T.MeshStandardMaterial({color:0x5a564d,metalness:.8,roughness:.45,side:T.DoubleSide})));
      for(let i=0;i<60;i++){ const long=i%5===0,a=i/60*Math.PI*2,rr=long?.79:.81, tk=new T.Mesh(new T.BoxGeometry(.012,long?.1:.05,.02),long?brass:dark); tk.position.set(Math.sin(a)*rr,Math.cos(a)*rr,.01); tk.rotation.z=-a; g.add(tk); } mk.push(g); this.dialL=g; }
    { const g=G(); const hub=new T.Mesh(new T.CylinderGeometry(.3,.32,.1,48),steel); hub.rotation.x=Math.PI/2; g.add(hub);
      for(let i=0;i<3;i++){ const a=i/3*Math.PI*2+Math.PI/6, sp=new T.Mesh(new T.CylinderGeometry(.032,.032,.32,12),steel); sp.position.set(Math.cos(a)*.46,Math.sin(a)*.46,.03); sp.rotation.z=a-Math.PI/2; g.add(sp); const k=new T.Mesh(new T.SphereGeometry(.065,20,14),brass); k.position.set(Math.cos(a)*.63,Math.sin(a)*.63,.03); g.add(k); } mk.push(g); this.wheelL=g; }
    { const g=G(); g.add(new T.Mesh(new T.CircleGeometry(.2,40),brass)); const bl=new T.MeshBasicMaterial({color:0x050404}); const c=new T.Mesh(new T.CircleGeometry(.075,24),bl); c.position.set(0,.08,.002); g.add(c); const s=new T.Mesh(new T.PlaneGeometry(.06,.2),bl); s.position.set(0,-.04,.002); g.add(s); mk.push(g); }
    const lm=new T.LineBasicMaterial({color:new T.Color(p.muted)});
    this.layerSig=JSON.stringify(L); this.sel=d.sel==null?null:d.sel;
    this.layers=mk.map((disc,i)=>{ const holder=G(); holder.userData.pick=i; holder.userData.o=0; disc.rotation.x=-Math.PI/2; disc.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); holder.add(disc);
      holder.add(new T.Mesh(new T.CylinderGeometry(1.2,1.2,.34,24),new T.MeshBasicMaterial({visible:false})));
      const info=L[i]||{k:'',v:''}; const a=new T.Object3D(); this.root.add(a); holder.userData.anchor=a;
      holder.userData.tag=this.tag(info.k,info.v,a,{align:'left',key:i,onPick:()=>emit({type:'layer',i})});
      holder.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(1.12,0,0),new T.Vector3(1.38,0,0)]),lm));
      this.root.add(holder); this.pickables.push(holder); return holder; });
    this.gap=(this.aspect||2)<1.1?.8:.62; this.tall=(this.aspect||2)<1.1;
    this.ground(-2.2-(this.gap-.62)*2.5,10);
    this.baseRot={x:0,y:-.35}; this.draggable=true; this.spinLimit=.8;
    this.layout=()=>{ if(((this.aspect||2)<1.1)!==this.tall){ this.rebuild(); return; } const dist=this.fit(5.4,(mk.length-1)*this.gap+1.3,1.05); this.cam.position.set(0,dist*.42,dist); this.cam.lookAt(.5,0,0); };
  }
  update_exploded(d){ if(JSON.stringify(d.layers||[])!==this.layerSig) return this.rebuild(); this.sel=d.sel==null?null:d.sel; }
  pick_exploded(i){ emit({type:'layer',i}); }
  frame_exploded(t){ const k=ease(clamp((t-.3)/1.4)), n=this.layers.length, sel=this.sel, hov=this.hover!=null?this.hover:this.tagHover;
    this.layers.forEach((h,i)=>{ const tg=i===sel?1:(hov===i?.35:0); h.userData.o=lerp(h.userData.o,tg,.12);
      h.position.y=(i-(n-1)/2)*this.gap*k-(1-k)*.4; h.position.z=h.userData.o*.75; h.position.x=-h.userData.o*.2;
      h.userData.anchor.position.set(1.42,(i-(n-1)/2)*this.gap*k-(1-k)*.4,0);
      this.tagState(h.userData.tag,[sel==null||i===sel||hov===i?'':'dim',i===sel?'sel':''].join(' ').trim()); });
    if(this.dialL) this.dialL.rotation.z=t*.2; if(this.wheelL) this.wheelL.rotation.z=-t*.35; }

  /* ---------- REEL (Research) ---------- */
  drawReel(){
    const c=this.reelCanvas, g=c.getContext('2d'), w=c.width, h=c.height, frames=this.reelFrames, count=this.reelCount, fw=w/count, acc=this.accent.getStyle();
    g.globalCompositeOperation='source-over'; g.clearRect(0,0,w,h); g.fillStyle='#1e241d'; g.fillRect(0,0,w,h);
    for(let i=0;i<count;i++){ const fi=i%frames.length, [id,sub]=frames[fi].split('|'), x=i*fw, on=fi===this.reelSel, hv=fi===this.reelHov;
      g.fillStyle=on?'#34402f':(hv?'#2f382d':'#2a3229'); g.fillRect(x+14,56,fw-28,h-112);
      g.strokeStyle=on?acc:(hv?'#a9b89f':'#6f7d68'); g.lineWidth=on?7:(hv?4:2); g.strokeRect(x+14,56,fw-28,h-112);
      g.fillStyle=on?acc:'#e4eed8'; g.textAlign='left'; g.textBaseline='middle'; g.font='800 66px '+FH; g.fillText(id||'',x+36,104);
      let fs=28; g.font='500 '+fs+'px '+FM; while(fs>18&&g.measureText(sub||'').width>fw-72){ fs-=2; g.font='500 '+fs+'px '+FM; }
      g.fillStyle='#e4eed8'; g.fillText(sub||'',x+36,162);
      if(on){ g.font='600 22px '+FM; g.fillStyle=acc; g.textAlign='right'; g.fillText('OPEN',x+fw-36,104); } }
    g.globalCompositeOperation='destination-out'; for(let x=8;x<w;x+=38){ g.fillRect(x,14,20,26); g.fillRect(x,h-40,20,26); } g.globalCompositeOperation='source-over';
  }
  frameAt(hit){ if(!hit||!hit.uv) return null; const u=hit.uv.x*this.reelTex.repeat.x+this.reelTex.offset.x; return Math.floor((((u%1)+1)%1)*this.reelCount)%this.reelFrames.length; }
  build_reel(d){
    const T=this.T, frames=(d.frames&&d.frames.length)?d.frames:['R-00|'];
    this.reelFrames=frames; this.reelCount=Math.max(6,frames.length*3); this.reelSel=d.sel==null?null:d.sel; this.reelHov=null; this.reelSig=JSON.stringify(frames);
    const cnv=document.createElement('canvas'); cnv.width=3072; cnv.height=256; this.reelCanvas=cnv; this.drawReel();
    const tex=new T.CanvasTexture(cnv); tex.colorSpace=T.SRGBColorSpace; tex.anisotropy=8;
    tex.wrapS=T.RepeatWrapping; tex.repeat.set(10/(2.3*this.reelCount),1); // each 512×256 cell spans 2.3 × 1.15 units
    const geo=new T.PlaneGeometry(10,1.15,200,1), pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){ const x=pos.getX(i); pos.setZ(i,Math.cos(x*.42)*1.4-1.4+Math.sin(x*1.1)*.1); pos.setY(i,pos.getY(i)+Math.sin(x*.6)*.2); }
    geo.computeVertexNormals();
    const m=new T.Mesh(geo,new T.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.5,side:T.DoubleSide,roughness:.5,metalness:.15})); m.castShadow=true; m.userData.pick=0; this.root.add(m); this.pickables.push(m);
    this.reelTex=tex; this.baseRot={x:.12,y:0}; this.spinLimit=.4;
    this.layout=()=>{ this.viewW=Math.max(3.2,Math.min(6.2,(this.clientWidth||600)/105)); const dist=this.fit(this.viewW,1.9,1); this.cam.position.set(0,.25,dist); this.cam.lookAt(0,0,-.4); };
  }
  update_reel(d){ if(JSON.stringify(d.frames||[])!==this.reelSig) return this.rebuild(); const s=d.sel==null?null:d.sel; if(s!==this.reelSel){ this.reelSel=s; this.drawReel(); this.reelTex.needsUpdate=true; } }
  drag_reel(dx){ this.reelTex.offset.x-=dx/(this.clientWidth||600)*(this.viewW||6.2)*this.reelTex.repeat.x/10; } // film follows the finger
  pick_reel(_,hit){ const i=this.frameAt(hit); if(i!=null) emit({type:'reel',i}); }
  frame_reel(t,dt){
    const hv=this.hover!=null?this.frameAt(this.lastHit):null;
    if(hv!==this.reelHov){ this.reelHov=hv; this.drawReel(); this.reelTex.needsUpdate=true; }
    if(this.hover==null&&!this.drag) this.reelTex.offset.x+=dt*.012;
  }
}
