"use client";
import {useEffect,useRef,useState} from "react";
import {Pause,Play,RotateCcw,MoveHorizontal} from "lucide-react";
type Controls={mode:(mode:number)=>void;rotate:(amount:number)=>void;reset:()=>void};
const modes=["Intelligence","Vision","Systems"];
function positions(mode:number,count:number){const a=new Float32Array(count*3);for(let i=0;i<count;i++){const t=i/count*Math.PI*2;let x=0,y=0,z=0;
if(mode===0){const rings=80,tube=Math.ceil(count/rings),u=Math.floor(i/tube)/rings*Math.PI*2,v=(i%tube)/tube*Math.PI*2;const r=.4*(2+Math.cos(3*u))+.13*Math.cos(v);x=r*Math.cos(2*u);y=r*Math.sin(2*u);z=.4*Math.sin(3*u)+.13*Math.sin(v);}
else if(mode===1){const phi=Math.acos(1-2*(i+.5)/count),theta=i*2.399963;const r=1.08+.12*Math.sin(phi*12);x=r*Math.sin(phi)*Math.cos(theta);y=r*Math.cos(phi);z=r*Math.sin(phi)*Math.sin(theta);}
else{const side=Math.ceil(Math.cbrt(count));x=((i%side)/(side-1)-.5)*1.9;y=((Math.floor(i/side)%side)/(side-1)-.5)*1.9;z=(Math.floor(i/(side*side))/(side-1)-.5)*1.9;}
a.set([x,y,z],i*3);}return a;}
export default function ParticleScene(){const canvasRef=useRef<HTMLCanvasElement>(null),controls=useRef<Controls|null>(null),pausedRef=useRef(false);
const [mode,setMode]=useState(0),[paused,setPaused]=useState(false),[fallback,setFallback]=useState(false),[ready,setReady]=useState(false);
useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;let gl:WebGLRenderingContext|null=null;
try{gl=canvas.getContext("webgl",{alpha:true,antialias:false,powerPreference:"low-power"});}catch{}if(!gl){setFallback(true);return;}const g=gl;
const vs=`attribute vec3 aPosition;attribute vec3 aTarget;uniform float uMix;uniform float uTime;uniform vec2 uRotation;uniform float uAspect;uniform float uPixel;uniform float uZoom;varying float vDepth;varying float vColor;
void main(){vec3 p=mix(aPosition,aTarget,uMix);p+=normalize(p+vec3(.001))*sin(uTime*.65+p.y*4.)*.025;float cy=cos(uRotation.x),sy=sin(uRotation.x),cx=cos(uRotation.y),sx=sin(uRotation.y);p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);float d=3.6-p.z;gl_Position=vec4(p.x*uZoom/uAspect,p.y*uZoom,0.,d);gl_PointSize=clamp((3.8+p.z*1.1)*uPixel,2.,10.);vDepth=clamp((p.z+1.5)/3.,0.,1.);vColor=aTarget.y;}`;
const fs=`precision mediump float;varying float vDepth;varying float vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=pow(1.-d,2.);vec3 violet=vec3(.57,.32,1.);vec3 mint=vec3(.45,.93,.9);vec3 c=mix(violet,mint,smoothstep(-1.,1.,vColor));c=mix(c,vec3(1.,.76,.42),pow(vDepth,5.)*.5);gl_FragColor=vec4(c,(.3+.7*vDepth)*glow);}`;
function shader(type:number,source:string){const s=g.createShader(type)!;g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error("Shader unavailable");return s;}
let program:WebGLProgram;let vert:WebGLShader,frag:WebGLShader;
try{vert=shader(g.VERTEX_SHADER,vs);frag=shader(g.FRAGMENT_SHADER,fs);program=g.createProgram()!;g.attachShader(program,vert);g.attachShader(program,frag);g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw new Error("Renderer unavailable");}catch{setFallback(true);return;}
g.useProgram(program);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.disable(g.DEPTH_TEST);
const count=window.innerWidth<650?2400:5200;let from=positions(0,count),target=from.slice(),mix=1,transitionStart=0;
const sourceBuffer=g.createBuffer()!,targetBuffer=g.createBuffer()!;
function upload(buffer:WebGLBuffer,name:string,data:Float32Array){g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);const loc=g.getAttribLocation(program,name);g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,3,g.FLOAT,false,0,0);}
upload(sourceBuffer,"aPosition",from);upload(targetBuffer,"aTarget",target);
const uniforms=Object.fromEntries(["uMix","uTime","uRotation","uAspect","uPixel","uZoom"].map(k=>[k,g.getUniformLocation(program,k)]));
let yaw=.4,pitch=-.28,pointerX=0,pointerY=0,dragging=false,lastX=0,lastY=0,visible=true,lastFrame=0,elapsed=0,raf=0,lost=false;
const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");pausedRef.current=reduced.matches;setPaused(reduced.matches);
function resize(){const rect=canvas!.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio,1.75);canvas!.width=Math.round(rect.width*dpr);canvas!.height=Math.round(rect.height*dpr);g.viewport(0,0,canvas!.width,canvas!.height);g.uniform1f(uniforms.uAspect,rect.width/Math.max(1,rect.height));g.uniform1f(uniforms.uPixel,dpr);g.uniform1f(uniforms.uZoom,2.25*Math.min(rect.width/Math.max(1,rect.height),1));}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(canvas);
function frame(now:number){raf=requestAnimationFrame(frame);if(lost||!visible||document.hidden){lastFrame=now;return;}const dt=Math.min((now-lastFrame)/1000,.05);if(now-lastFrame<1000/45)return;lastFrame=now;
if(!pausedRef.current&&!dragging){elapsed+=dt;yaw+=dt*.12;}mix=Math.min(1,(now-transitionStart)/900);const eased=mix*mix*(3-2*mix);g.uniform1f(uniforms.uMix,eased);g.uniform1f(uniforms.uTime,elapsed);g.uniform2f(uniforms.uRotation,yaw+(reduced.matches?0:pointerX*.13),pitch+(reduced.matches?0:pointerY*.1));g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.POINTS,0,count);}
controls.current={mode(n){for(let i=0;i<from.length;i++)from[i]=from[i]+(target[i]-from[i])*(mix*mix*(3-2*mix));target=positions(n,count);upload(sourceBuffer,"aPosition",from);upload(targetBuffer,"aTarget",target);transitionStart=performance.now();},rotate(n){yaw+=n;},reset(){yaw=.4;pitch=-.28;pointerX=0;pointerY=0;}};
const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas!.setPointerCapture(e.pointerId);};
const move=(e:PointerEvent)=>{const r=canvas!.getBoundingClientRect();pointerX=(e.clientX-r.left)/r.width-.5;pointerY=(e.clientY-r.top)/r.height-.5;if(dragging){yaw+=(e.clientX-lastX)*.007;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-lastY)*.007));lastX=e.clientX;lastY=e.clientY;}};
const up=()=>{dragging=false;};const leave=()=>{pointerX=0;pointerY=0;};const loss=(e:Event)=>{e.preventDefault();lost=true;setFallback(true);};
canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);canvas.addEventListener("pointerleave",leave);canvas.addEventListener("webglcontextlost",loss);
const media=()=>{pausedRef.current=reduced.matches;setPaused(reduced.matches);};reduced.addEventListener("change",media);
resize();raf=requestAnimationFrame(frame);setReady(true);
return()=>{cancelAnimationFrame(raf);resizeObserver.disconnect();observer.disconnect();controls.current=null;canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.removeEventListener("pointerleave",leave);canvas.removeEventListener("webglcontextlost",loss);reduced.removeEventListener("change",media);g.deleteBuffer(sourceBuffer);g.deleteBuffer(targetBuffer);g.deleteProgram(program);g.deleteShader(vert);g.deleteShader(frag);};
},[]);
function choose(n:number){setMode(n);controls.current?.mode(n);}
return <div className="scene-wrap"><div className="scene-coordinate">INTERACTIVE FIELD / {String(mode+1).padStart(2,"0")}</div><canvas ref={canvasRef} className="particle-canvas" role="img" aria-label={"Interactive 3D particle sculpture: "+modes[mode]} data-renderer={ready&&!fallback?"webgl":"fallback"}/>{fallback&&<div className="scene-fallback"><span>INTELLIGENCE · VISION · SYSTEMS</span><p>The interactive scene needs a browser with WebGL support. You can explore all my projects below.</p></div>}<div className="scene-badge"><span>EXPLORING</span><strong>{modes[mode]}</strong></div><div className="scene-controls"><div className="scene-modes" role="group" aria-label="3D visual modes">{modes.map((label,i)=><button key={label} onClick={()=>choose(i)} aria-pressed={mode===i} disabled={!ready||fallback}>{label}</button>)}</div><div className="scene-tools"><button aria-label={paused?"Play animation":"Pause animation"} onClick={()=>{pausedRef.current=!paused;setPaused(!paused);}} disabled={!ready||fallback}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button aria-label="Rotate sculpture left" onClick={()=>controls.current?.rotate(-.35)} disabled={!ready||fallback}>‹</button><button aria-label="Rotate sculpture right" onClick={()=>controls.current?.rotate(.35)} disabled={!ready||fallback}>›</button><button aria-label="Reset sculpture view" onClick={()=>controls.current?.reset()} disabled={!ready||fallback}><RotateCcw size={15}/></button></div></div><p className="scene-hint"><MoveHorizontal size={15}/> Drag to rotate · Choose a field to transform</p></div>;}

