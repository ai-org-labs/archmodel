export interface MapTransform {scale:number;x:number;y:number}
interface Host {get():MapTransform;set(value:MapTransform):void;begin():void}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
type Point={x:number;y:number};
/** Pointer gestures share one transform; a changing finger count rebases without a jump. */
export function installMapGestures(canvas:HTMLElement,host:Host){
 const pointers=new Map<number,Point>();let base:MapTransform=host.get(),origin:Point={x:0,y:0},span=0,moving=false,suppressUntil=0;
 const local=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
 const center=()=>{const a=[...pointers.values()].slice(0,2);return a.length===2?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:a[0];};
 function rebase(){host.begin();base=host.get();origin=center()??{x:0,y:0};const a=[...pointers.values()];span=a.length>=2?distance(a[0],a[1]):0;}
 const capture=()=>{for(const id of pointers.keys())try{canvas.setPointerCapture(id);}catch{/* A cancelled pointer may already have left the surface. */}};
 function down(e:PointerEvent){if(e.pointerType!=='touch'&&e.button!==0)return;pointers.set(e.pointerId,local(e));if(pointers.size===1)moving=false;else {moving=true;capture();}rebase();}
 function move(e:PointerEvent){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,local(e));const mid=center();if(!mid)return;
  if(!moving&&Math.hypot(mid.x-origin.x,mid.y-origin.y)<5)return;
  moving=true;capture();if(e.cancelable)e.preventDefault();suppressUntil=performance.now()+500;
  const a=[...pointers.values()];const scale=a.length>=2&&span>0?Math.max(.1,Math.min(4,base.scale*distance(a[0],a[1])/span)):base.scale;
  const ratio=scale/base.scale;
  host.set({scale,x:mid.x-(origin.x-base.x)*ratio,y:mid.y-(origin.y-base.y)*ratio});
 }
 function end(e:PointerEvent){if(!pointers.has(e.pointerId))return;if(moving||pointers.size>1)suppressUntil=performance.now()+500;pointers.delete(e.pointerId);if(pointers.size)rebase();else moving=false;}
 function reset(){if(moving)suppressUntil=performance.now()+500;pointers.clear();moving=false;}
 const onBlur=()=>reset();
 canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);window.addEventListener('blur',onBlur);
 function click(e:MouseEvent){if(e.detail!==0&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}}
 // Capture on document precedes map editing actions, including gestures that start on a control.
 const guard=(e:MouseEvent)=>{if(canvas.contains(e.target as Node))click(e);};document.addEventListener('click',guard,true);
 return {reset,isMoving:()=>moving,destroy(){canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);canvas.removeEventListener('lostpointercapture',end);window.removeEventListener('blur',onBlur);document.removeEventListener('click',guard,true);}};
}
