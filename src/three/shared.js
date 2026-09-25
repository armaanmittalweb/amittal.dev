// Shared by both 3D elements.

/** Reduced motion is decided once, on <html data-motion>, by the app. */
export const still = () => document.documentElement.dataset.motion === 'reduced';

/** Tell the page this scene could not start, so it can show a fallback instead of a blank box. */
export function sceneUnavailable(el, err){
  console.warn('[archive] 3D unavailable:', err);
  el.dispatchEvent(new CustomEvent('scene-unavailable', { bubbles: true }));
}

/** Frees every geometry, material, texture and shadow map under an object. */
export function disposeTree(root){
  if(!root) return;
  root.traverse(o=>{
    if(o.geometry) o.geometry.dispose();
    const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    for(const m of mats){ for(const v of Object.values(m)) if(v&&v.isTexture) v.dispose(); m.dispose(); }
    if(o.isLight&&o.dispose) o.dispose();
  });
}

/** Releases the renderer and its WebGL context, so views don't pile up contexts toward the browser's cap. */
export function releaseRenderer(r){
  r.dispose();
  r.forceContextLoss();
  r.domElement.remove();
}

/**
 * three.js recovers from a lost context if it is restored. One that stays lost
 * for a few seconds (GPU reset, driver crash) counts as the scene failing.
 * Returns a function that stops watching.
 */
export function watchContext(canvas, el){
  let t;
  const lost=()=>{ clearTimeout(t); t=setTimeout(()=>sceneUnavailable(el,new Error('WebGL context lost')),3000); };
  const restored=()=>clearTimeout(t);
  canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('webglcontextrestored',restored);
  return ()=>{ clearTimeout(t); canvas.removeEventListener('webglcontextlost',lost); canvas.removeEventListener('webglcontextrestored',restored); };
}
