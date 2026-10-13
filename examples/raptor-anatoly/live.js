const D = __DATA__;
const root = document.querySelector(".rp");
const stage = root.querySelector(".rp-stage");
const front = stage.querySelector(".rp-front");
const engine = front.querySelector(".rp-engine");
const canvas = stage.querySelector(".rp-plume");
const veilCanvas = stage.querySelector(".rp-veil");
const glowGroup = stage.querySelector(".rp-glow-g");
const flashVeil = stage.querySelector(".rp-flash");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const fireButton = root.querySelector("[data-fire]");
const fireLabel = root.querySelector("[data-fire-label]");
const fixButton = root.querySelector("[data-fix]");
const hintEl = root.querySelector(".rp-hint");
const partButtons = [...root.querySelectorAll(".rp-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...engine.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  ride: el.dataset.ride || el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  index: Number(el.dataset.i),
  tag: el.dataset.b || "",
  shown: "",
}));
const tagged = (prefix) => nodes.filter((node) => node.tag.startsWith(prefix));
let order = nodes.map((_, index) => index);

const IDS = Object.keys(D.pieces);
const M = D.model;
// Only a fall moves anything: for each falling piece, how far it has gone
// sideways (x, 0 to 1), how far down (z, 0 to 1), the tape's sag before it,
// and how far it has turned (a, degrees, about its middle) with the shift
// (ex, ey) that puts the turn about whatever it is pivoting on.
const FALL = D.fall.order;
const fallen = Object.fromEntries(FALL.map((id) => [id, { x: 0, z: 0, sag: 0, a: 0, ex: 0, ey: 0, dv: 0 }]));
const moveOf = Object.fromEntries(FALL.map((id) => [id, nodes.find((node) => node.ride === id).m]));
const scr = (p) => [D.exit[0] + D.EX[0] * p[0] + D.EY[0] * p[1] + D.EZ[0] * (p[2] - D.zExit), D.exit[1] + D.EX[1] * p[0] + D.EY[1] * p[1] + D.EZ[1] * (p[2] - D.zExit)];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// The flat direction that reads as straight right on screen: a body leaning
// right rests on its rim that way, a body leaning left on the other.
const RIGHT = (() => {
  const a = 1;
  const b = -D.EX[1] / D.EY[1];
  const n = Math.hypot(a, b);
  return D.EX[0] * a + D.EY[0] * b > 0 ? [a / n, b / n] : [-a / n, -b / n];
})();
// Each body: its middle on screen, its foot, and, if it tips over, the rim it
// tips about and the turn on screen that lays its axis along the floor. A body
// of revolution turned that way on screen is the same drawing as the body
// lying on its side, so the turn is close to honest for most of them.
const BODY = Object.fromEntries(FALL.map((id) => {
  const b = D.fall.bodies[id];
  const mid = [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2);
  const half = [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2];
  const height = b.max[2] - b.min[2];
  const body = { mid, C: scr(mid), foot: [mid[0], mid[1], b.min[2]], top: [mid[0], mid[1], b.max[2]], half, height, tip: b.tip };
  if (b.tip) {
    const [dx, dy] = b.tip.dir;
    const reach = Math.abs(dx) * half[0] + Math.abs(dy) * half[1];
    const rim = [mid[0] + dx * reach, mid[1] + dy * reach, b.min[2]];
    const d = [D.EX[0] * dx + D.EY[0] * dy, D.EX[1] * dx + D.EY[1] * dy];
    // The turn on screen from straight up to d.
    const full = (Math.atan2(d[0], -d[1]) * 180) / Math.PI;
    const lying = [rim[0] + dx * (height / 2), rim[1] + dy * (height / 2), b.min[2] + reach];
    body.P = scr(rim);
    body.full = full;
    body.rest = full * b.tip.frac;
    body.dv = dot3([lying[0] - mid[0], lying[1] - mid[1], lying[2] - mid[2]], D.V);
  }
  return [id, body];
}));
// The screen shift that turns a rotation about a body's middle into the same
// rotation about the pivot p.
function about(id, a, p) {
  const c = BODY[id].C;
  const r = (a * Math.PI) / 180;
  const vx = p[0] - c[0];
  const vy = p[1] - c[1];
  return [vx - (vx * Math.cos(r) - vy * Math.sin(r)), vy - (vx * Math.sin(r) + vy * Math.cos(r))];
}
// A rim of the body's foot (or top), on the side the turn a leans it toward.
function rimOf(id, a, at = "foot", reach) {
  const b = BODY[id];
  const p = b[at];
  const r = reach ?? Math.abs(RIGHT[0]) * b.half[0] + Math.abs(RIGHT[1]) * b.half[1];
  const s = a >= 0 ? 1 : -1;
  return scr([p[0] + s * RIGHT[0] * r, p[1] + s * RIGHT[1] * r, p[2]]);
}
// A small seeded wobble per ignite, so no two collapses go quite the same.
function rand(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function tumbleOf(n) {
  const r = rand((Number(D.seed) || 7) * 977 + n * 7919);
  return Object.fromEntries(FALL.map((id, index) => [id, {
    delay: index === 0 ? 0 : D.fall.delay[index] * (0.75 + 0.6 * r()),
    land: 5 + 10 * r(),
    tip: 0.22 + 0.16 * r(),
    hop: 0.8 + 0.6 * r(),
    swing: 14 + 10 * r(),
  }]));
}
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const fmt = (value) => Math.round(value).toLocaleString("en-US");

const pct = (value) => `${(value * 100).toFixed(2)}%`;
stage.style.setProperty("--gx", pct(D.exit[0] / D.W));
stage.style.setProperty("--gy", pct((D.exit[1] + 6) / D.H));

let clock = 0;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = -1;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let jitter = [0, 0];

const VENT = 0.7;
const MAIN = 1.25;
const STEADY = 9;
const PREBURNER_PC = 0.13;
const LONGEST = D.plumeLength + 60;

const glide = () => ({ x: 0, v: 0 });
const burn = {
  on: false,
  armed: false,
  tour: false,
  t: -1,
  stopAt: Infinity,
  stopping: -1,
  pc: 0,
  pcRate: 0,
  hue: glide(),
  glowStop: null,
  lastGlow: 0,
  popped: false,
  phase: "",
  pre: glide(),
  vent: glide(),
  smoke: glide(),
  reach: glide(),
  splash: glide(),
  mainAt: -99,
  popAt: -99,
};


function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? D.pieces[selected].say : burn.on ? "firing" : broken() ? `broken · ${wordsOf(job, "settles")}` : "Assembled, cold";
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

let thud = -99;
let landed = {};
let tipped = {};
function place() {
  let glow = [0, 0];
  for (const node of nodes) {
    const f = fallen[node.ride];
    let wx = 0;
    let wy = 0;
    let wz = 0;
    if (f) {
      wx = node.m[0] * f.x;
      wy = node.m[1] * f.x;
      wz = node.m[2] * f.z - f.sag * (1 - f.x);
    }
    node.depth = node.key + wx * D.V[0] + wy * D.V[1] + wz * D.V[2] + (f ? f.dv : 0);
    const tx = D.EX[0] * wx + D.EY[0] * wy + D.EZ[0] * wz + (f ? f.ex : 0);
    const ty = D.EX[1] * wx + D.EY[1] * wy + D.EZ[1] * wz + (f ? f.ey : 0);
    if (node.ride === "nozzle") glow = [tx, ty];
    const turn = f && Math.abs(f.a) > 0.01 ? ` rotate(${f.a.toFixed(2)} ${BODY[node.ride].C[0].toFixed(1)} ${BODY[node.ride].C[1].toFixed(1)})` : "";
    const text = Math.abs(tx) < 0.005 && Math.abs(ty) < 0.005 && !turn ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})${turn}`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].depth - nodes[b].depth);
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    engine.appendChild(fragment);
    order = next;
  }
  const moved = Math.abs(jitter[0]) > 0.005 || Math.abs(jitter[1]) > 0.005;
  engine.setAttribute("transform", moved ? `translate(${jitter[0].toFixed(2)} ${jitter[1].toFixed(2)})` : "");
  const gx = jitter[0] + glow[0];
  const gy = jitter[1] + glow[1];
  glowGroup.setAttribute("transform", Math.abs(gx) > 0.005 || Math.abs(gy) > 0.005 ? `translate(${gx.toFixed(2)} ${gy.toFixed(2)})` : "");
}

const COMMON = `
uniform vec2 uJit;
uniform float uPc;
uniform float uHue;
uniform float uSmoke;
uniform float uVent;
uniform float uShockR;
uniform float uShockA;
uniform float uLight;
const float ZE=${D.zExit.toFixed(1)};
const float R0=${D.exitR.toFixed(1)};
const float PL=${D.plumeLength.toFixed(1)};
const float RB=132.;
const vec2 COL0=vec2(${D.columns[0][0].toFixed(1)},${D.columns[0][1].toFixed(1)});
const vec2 COL1=vec2(${D.columns[1][0].toFixed(1)},${D.columns[1][1].toFixed(1)});
const float COLH=${D.columnHalf.toFixed(1)};
const float COLTOP=${D.columnTop.toFixed(1)};
float ground(float r){
  if(r>56.)return 0.;
  if(r>48.)return 4.;
  if(r>43.)return mix(4.,8.,(48.-r)/5.);
  if(r>35.)return mix(8.,13.,(43.-r)/8.);
  if(r>25.)return mix(13.,19.,(35.-r)/10.);
  if(r>14.5)return mix(19.,25.,(25.-r)/10.5);
  if(r>6.)return mix(25.,29.5,(14.5-r)/8.5);
  if(r>2.)return mix(29.5,32.,(6.-r)/4.);
  return 32.;
}
bool solid(vec3 p){return p.z<ground(length(p.xy));}
float ringField(vec3 p){return length(vec2(length(p.xy)-68.,p.z-6.4))-2.1;}
vec2 groundHit(vec3 o,vec3 V){
  float tf=-o.z/V.z;
  float best=tf;
  if(length(o.xy)<56.5){
    float ta=(36.-o.z)/V.z;
    float prev=ta;
    for(int i=1;i<=28;i++){
      float t=mix(ta,tf,float(i)/28.);
      if(solid(o+t*V)){
        float lo=t;float hi=prev;
        for(int j=0;j<7;j++){float m=(lo+hi)*.5;if(solid(o+m*V))lo=m;else hi=m;}
        best=hi;
        break;
      }
      prev=t;
    }
  }
  float t6=(6.4-o.z)/V.z;
  if(abs(length((o+t6*V).xy)-68.)<12.){
    float t=(9.-o.z)/V.z;
    for(int i=0;i<14;i++){
      float d=ringField(o+t*V);
      if(d<.02)break;
      t-=d;
    }
    if(ringField(o+t*V)<.06&&t>best)return vec2(t,1.);
  }
  return vec2(best,0.);
}
float columnNear(vec3 o,vec3 V,vec2 c){
  vec3 lo=vec3(c-COLH,0.);
  vec3 hi=vec3(c+COLH,COLTOP);
  vec3 a=(lo-o)/V;
  vec3 b=(hi-o)/V;
  vec3 mn=min(a,b);
  vec3 mx=max(a,b);
  float tIn=max(mn.x,max(mn.y,mn.z));
  float tOut=min(mx.x,min(mx.y,mx.z));
  return tOut>tIn?tOut:-1e9;
}
float columnsNear(vec3 o,vec3 V){return max(columnNear(o,V,COL0),columnNear(o,V,COL1));}
float engineR(float z){
  float s=z-ZE;
  float b=36.+29.*(1.-pow(clamp(s,0.,120.)/120.,1.6))+3.;
  return mix(b,48.,smoothstep(108.,124.,s))*smoothstep(-6.,0.,s)*(1.-smoothstep(318.,330.,s));
}
float inFront(vec3 p,vec3 V){
  vec2 h=V.xy;
  float hl=length(h);
  float tau=-dot(p.xy,h)/(hl*hl);
  float d=length(p.xy+tau*h);
  float re=engineR(p.z+tau*V.z);
  float inside=1.-smoothstep(re-3.,re+3.,d);
  float surface=tau*hl+sqrt(max(re*re-d*d,0.));
  return inside*smoothstep(0.,5.,-surface);
}
float side(float front,float veil){return mix(1.-front,front,veil);}
float beyond(float t0,float tc,float sigma){return 1./(1.+exp(clamp(2.41*(t0-tc)/sigma,-30.,30.)));}
vec3 steamOf(vec3 g0,vec3 V,float tA,float u,float z0,float pf,float T,float veil){
  if(uSmoke<.0004&&uVent<.0004)return vec3(0.);
  float sE=uCam.z;
  float Hs=70.+60.*uSmoke;
  vec3 start=g0+tA*V;
  float steam=0.;
  float vapour=0.;
  for(int i=0;i<6;i++){
    float w=(float(i)+.5)/6.;
    vec3 p=start+(-Hs*log(w)/sE)*V;
    float r=length(p.xy);
    float lay=side(inFront(p,V),veil);
    float box=1.-smoothstep(120.,178.,max(abs(p.x),abs(p.y)));
    steam+=box*(.4+.6*exp(-pow((r-90.)/80.,2.)))*(1.-smoothstep(170.,330.,p.z))*lay;
    vapour+=exp(-pow(r/96.,2.))*(1.-smoothstep(40.,140.,p.z))*lay;
  }
  float layer=exp(-max(start.z,0.)/Hs)/6.;
  float b1=fbm2(vec2(u*.018+T*.03,z0*.016-T*.26+7.));
  float b2=fbm2(vec2(u*.045-T*.05,z0*.04-T*.5+2.));
  vec3 lit=mix(vec3(.3,.3,.33),vec3(.72,.4,.2),pf*exp(-max(z0,0.)/150.));
  return lit*(b1*.75+b2*.4)*smoothstep(.05,.6,b1)*steam*layer*uSmoke*1.05+vec3(.42,.47,.54)*(b2*.6+.4)*vapour*layer*uVent*.5;
}
float shellOf(float dist,float tc,float tAir,float rs,float w,vec3 e0,vec3 V,float veil){
  if(rs<.5)return 0.;
  float m=sqrt(max(rs*rs-dist*dist,0.));
  float edge=exp(-pow(max(dist-rs,0.)/w,2.));
  float limb=rs*w/sqrt(m*m+2.*rs*w)/sqrt(rs*w*.5);
  limb*=limb;
  float soft=w*2.+2.;
  float far=tc-m;
  float near=tc+m;
  float aFar=smoothstep(tAir-soft*.5,tAir+soft,far)*side(inFront(e0+far*V,V),veil);
  float aNear=smoothstep(tAir-soft*.5,tAir+soft,near)*side(inFront(e0+near*V,V),veil);
  return edge*limb*(aFar+aNear)*.5;
}
vec3 shockOf(float dist,float tc,float tAir,vec3 e0,vec3 V,float veil){
  if(uShockA<.0004)return vec3(0.);
  float rs=uShockR;
  float sw=1.8+max(rs-26.,0.)*.01;
  float lead=shellOf(dist,tc,tAir,rs,sw,e0,V,veil);
  float trail=shellOf(dist,tc,tAir,max(rs-sw*2.6,0.),sw*2.2,e0,V,veil)*.3;
  return vec3(.84,.88,1.)*(lead+trail)*.42*uShockA*(1.-smoothstep(170.,270.,rs));
}
vec4 inkOf(vec3 col){
  col=tonemap(col,1.15);
  float m=max(col.r,max(col.g,col.b));
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  col=max(col+n*smoothstep(0.,1.5/255.,m),0.);
  m=max(col.r,max(col.g,col.b));
  vec3 ink=col/max(m,1e-5)*vec3(.62,.34,.3);
  vec4 light=vec4(ink*m*.92,m*.92);
  return mix(vec4(col,m),light,uLight);
}
struct Scene{vec3 V;vec3 g0;vec3 e0;vec3 hit;float tLow;float ring;float tCol;float tAir;float tAirE;float tLowE;float u;float z0;float s0;float dist;float tc;};
Scene sceneOf(vec2 vb){
  Scene S;
  S.V=towardViewer();
  float sE=uCam.z;
  S.g0=rayOf(vb);
  vec2 gh=groundHit(S.g0,S.V);
  S.tLow=gh.x;
  S.ring=gh.y;
  S.tCol=columnsNear(S.g0,S.V);
  S.tAir=max(S.tLow,S.tCol);
  S.hit=S.g0+S.tLow*S.V;
  S.e0=rayOf(vb-uJit);
  S.u=(vb.x-uJit.x-uOrigin.x)/uK;
  S.z0=S.e0.z;
  S.s0=ZE-S.z0;
  S.tLowE=S.tLow+(S.g0.z-S.e0.z)/sE;
  S.tAirE=S.tAir+(S.g0.z-S.e0.z)/sE;
  vec3 C=vec3(0.,0.,ZE-6.);
  S.tc=dot(C-S.e0,S.V);
  S.dist=length(S.e0+S.tc*S.V-C);
  return S;
}
`;

const PLUME = `${COMMON}
uniform float uGlow;
uniform float uPre;
uniform float uReach;
uniform float uSplash;
uniform float uFlash;
uniform float uRingR;
uniform float uRingA;
uniform float uPop;
uniform float uPopR;
float onDeck(vec2 p){return 1.-smoothstep(134.,150.,max(abs(p.x),abs(p.y)));}
float radiusAt(float s,float pf,float warm){
  float spread=.045+.12*(1.-pf);
  return R0*(1.-.07*pf*smoothstep(0.,40.,s)-.42*warm*smoothstep(0.,80.,s))+spread*max(s,0.);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  Scene S=sceneOf(vb);
  vec3 V=S.V;
  float sE=uCam.z;
  float cE=uCam.w;
  float tanE=sE/cE;
  float T=uTime;
  float pc=clamp(uPc,0.,1.);
  float pf=pc;
  float warm=1.-clamp(uHue,0.,1.);
  float glow=uGlow;
  float dith=hash12(gl_FragCoord.xy);
  vec3 col=vec3(0.);
  vec3 g0=S.g0;
  vec3 e0=S.e0;
  float u=S.u;
  float z0=S.z0;
  float s0=S.s0;
  vec3 hit=S.hit;
  float rho=length(hit.xy);
  vec2 dirH=hit.xy/max(rho,1e-3);

  float tongue=fbm2(vec2(u*.07,s0*.06-T*8.));
  float reach=uReach*(1.+(tongue-.5)*.55*warm);
  float rag=1.+1.6*warm;
  float lam=29.+7.*pf;
  float v0=19.+6.*pf;
  float cellOn=smoothstep(.4,.95,pf);

  if((glow>.0004||uVent>.0004)&&abs(u)<RB){
    float e=fbm2(vec2(u*.06+7.,s0*.03-T*4.6));
    float e2=fbm2(vec2(u*.16-3.,s0*.08-T*7.3));
    float streak=.86+.3*fbm2(vec2(u*.22,s0*.012-T*9.));
    float flick=(.94+.06*sin(T*97.+s0*.23))*(1.+uPre*warm*(tongue-.45)*.9);
    float mist=fbm2(vec2(u*.035+.4*T,s0*.022-T*.7));
    float halfChord=sqrt(max(RB*RB-u*u,0.))/cE;
    float ta=max(S.tAirE,-halfChord);
    float tb=min((ZE+2.-z0)/sE,halfChord);
    float dt=max(tb-ta,0.)/28.;
    vec3 sum=vec3(0.);
    vec3 cold=vec3(0.);
    for(int i=0;i<28;i++){
      float t=ta+(float(i)+dith)*dt;
      vec3 p=e0+t*V;
      float s=ZE-p.z;
      float r=length(p.xy);
      float keep=(1.-smoothstep(RB*.8,RB,r))*smoothstep(-.5,4.,s);
      float Rv=radiusAt(s,pf,warm);
      float Re=Rv*(1.+(e-.5)*.42*rag*smoothstep(4.,120.,s)+(e2-.5)*.1*rag*smoothstep(0.,40.,s));
      float rn=r/Re;
      float fade=(1.-smoothstep(reach-46.,reach,s))*keep;
      vec3 violet=mix(vec3(.86,.44,1.),vec3(1.,.5,.62),smoothstep(0.,150.,s)*.7);
      vec3 ember=mix(vec3(1.,.36,.07),vec3(1.,.7,.32),tongue);
      vec3 bodyCol=mix(violet,ember,warm);
      float fill=smoothstep(1.06,.72,rn);
      float wBody=dt*cE/(2.*Re);
      sum+=bodyCol*fill*wBody*(.26+.3*exp(-max(s,0.)/110.))*streak*flick*fade*2.;
      sum+=bodyCol*exp(-rn*rn*2.)*(dt*cE/(Re*1.25))*.22*fade;
      float rc=Rv*.34;
      sum+=mix(vec3(1.,.74,.9),vec3(1.,.8,.45),warm)*exp(-(r*r)/(rc*rc))*(dt*cE/(rc*1.772))*.34*(1.-.5*smoothstep(PL-30.,PL+10.,s))*fade;
      float rb=Rv*.62;
      sum+=mix(vec3(1.,.9,.76),vec3(1.,.78,.46),warm)*exp(-(r*r)/(rb*rb))*exp(-max(s,0.)/24.)*(dt*cE/(rb*1.772))*1.6*keep;
      float sw=Re*.24;
      float shell=exp(-pow((r-Re*.9)/sw,2.))*smoothstep(8.,150.,s)*(dt*cE/(sw*3.545));
      sum+=vec3(1.,.42,.12)*shell*.8*(.35+1.1*e)*fade;
      sum+=vec3(1.,.8,.52)*smoothstep(PL-30.,PL+4.,s)*fill*wBody*.8*fade;
      for(int c=0;c<4;c++){
        float fc=float(c);
        float vc=v0+fc*lam+sin(T*47.+fc*2.3)*.6;
        float Rc=R0*(1.-.07*pf)+(.045+.12*(1.-pf))*vc;
        float amp=exp(-fc*.28)*cellOn*(1.-smoothstep(reach-70.,reach-10.,vc))*(1.-smoothstep(PL-24.,PL-6.,vc))*keep;
        float rm=Rc*.33;
        float ph=(s-vc)/(lam*.62);
        float taper=rm*(1.06-clamp(ph,0.,1.)*.8)+.6;
        float bead=exp(-pow(r/taper,2.)*2.)*exp(-max(ph,0.)*2.2)*smoothstep(-.16,.02,ph)*(1.-smoothstep(.7,1.,ph));
        sum+=vec3(1.,.82,.46)*bead*(dt*cE/(taper*1.25))*2.1*amp;
        float d=r/(Rc*.9)+abs(s-vc+lam*.08)/(lam*.5);
        sum+=vec3(1.,.5,.64)*pow(clamp(1.-d,0.,1.),2.2)*(dt*cE/(Rc*.9*.62))*1.05*amp;
      }
      float sigma=R0*(.85+max(s,0.)*.012);
      cold+=vec3(.5,.56,.64)*exp(-(r*r)/(sigma*sigma))*(dt*cE/(sigma*1.772))*smoothstep(0.,16.,s)*(1.-smoothstep(50.,170.,s))*keep;
    }
    col+=sum*glow;
    col+=cold*mist*uVent*.62;
  }

  if(glow>.0004){
    float sh=radiusAt(clamp(s0,0.,PL),pf,warm)*2.2;
    float span=2.6*sh/cE;
    float h0=max(S.tAirE,-span);
    float dh=max(span-h0,0.)/8.;
    float halo=0.;
    for(int i=0;i<8;i++){
      float t=h0+(float(i)+dith)*dh;
      float z=z0+t*sE;
      float rr=u*u+t*t*cE*cE;
      halo+=exp(-rr/(sh*sh))*exp(-max(ZE-z,0.)/240.)*smoothstep(0.,30.,z)*smoothstep(ZE+25.,ZE-15.,z);
    }
    col+=mix(vec3(.9,.42,.62),vec3(1.,.45,.16),warm)*halo*(dh*cE/(sh*1.772))*.16*glow;
  }
  for(int c=0;c<4;c++){
    float fc=float(c);
    float vc=v0+fc*lam+sin(T*47.+fc*2.3)*.6;
    float Rc=R0*(1.-.07*pf)+(.045+.12*(1.-pf))*vc;
    float amp=exp(-fc*.28)*cellOn*(1.-smoothstep(reach-70.,reach-10.,vc))*(1.-smoothstep(PL-24.,PL-6.,vc));
    float rm=Rc*.33;
    float q=length(vec2(u/rm,(s0-vc)/(rm*tanE+1.2)));
    col+=vec3(1.,.98,.9)*exp(-q*q*2.4)*2.6*amp*glow;
  }

  float dist=S.dist;
  col+=vec3(1.,.84,.64)*uFlash*(exp(-pow(dist/120.,2.))*.36*beyond(S.tAirE,S.tc,120.)+exp(-dist/30.)*1.5*beyond(S.tAirE,S.tc,30.));
  col+=shockOf(dist,S.tc,S.tAirE,e0,V,0.);

  float floorSeen=S.tCol>S.tLow?0.:1.;
  float deck=onDeck(hit.xy)*floorSeen;
  vec3 tube=hit-vec3(dirH*68.,6.4);
  float tubeLit=max(dot(normalize(tube),normalize(vec3(-dirH*68.,26.))),0.);
  float facing=mix(1.,.15+1.3*tubeLit,S.ring);
  float splash=uSplash*pf;
  if(splash>.0004||uRingA>.0004){
    float flow=fbm3(vec3(dirH*2.4,rho*.035-T*3.8));
    float flow2=noise3(vec3(dirH*5.1+9.,rho*.07-T*6.1));
    float reachS=56.+80.*splash;
    float sheet=exp(-pow(rho/reachS,1.5))*deck*facing;
    vec3 hot=mix(vec3(1.,.38,.1),vec3(1.,.82,.55),exp(-rho/26.));
    col+=hot*sheet*(.26+.56*flow+.22*flow2)*splash*.62;
    col+=vec3(1.,.88,.7)*exp(-pow(rho/40.,2.))*splash*.9*floorSeen;
    float dust=noise3(vec3(dirH*7.,rho*.05));
    float gw=4.+uRingR*.034;
    col+=vec3(1.,.8,.6)*exp(-pow((rho-uRingR)/gw,2.))*(.45+dust)*deck*facing*uRingA*.5;
    if(splash>.0004){
      float tS=(70.-g0.z)/sE;
      float dS=max(tS-S.tAir,0.)/10.;
      float curtain=0.;
      for(int i=0;i<10;i++){
        vec3 p=g0+(S.tAir+(float(i)+dith)*dS)*V;
        float r=length(p.xy);
        float h=max(p.z-ground(r),0.);
        curtain+=exp(-pow((r-reachS*.8)/(reachS*.34),2.))*exp(-h/26.)*onDeck(p.xy)*dS*sE/26.;
      }
      float lick=fbm2(vec2(u*.05+T*.3,z0*.06-T*1.4));
      col+=vec3(1.,.46,.16)*curtain*lick*.55*splash;
    }
  }

  col+=steamOf(g0,V,S.tAir,u,z0,pf,T,0.);

  if(uPop>.0004){
    vec3 Cp=vec3(0.,0.,ZE-uPopR*.55);
    float tp=dot(Cp-e0,V);
    float pd=length(e0+tp*V-Cp);
    float pn=fbm2(vec2(u*.045,s0*.045-T*2.4));
    col+=vec3(1.,.46,.15)*exp(-pow(pd/uPopR,2.))*(.55+.7*pn)*smoothstep(ZE+24.,ZE-12.,z0)*beyond(S.tAirE,tp,uPopR)*uPop*.95;
  }

  gl_FragColor=inkOf(col);
}`;

const VEIL = `${COMMON}
uniform float uLeak;
uniform vec3 uLeakP;
uniform vec3 uLeakD;
// Methane boiling out of a split: cold vapour puffs that leave the leak along
// uLeakD, grow and sink, each one a soft ball around its world-space centre.
vec3 leakOf(vec3 o,vec3 V,float T){
  if(uLeak<.0004)return vec3(0.);
  float sum=0.;
  for(int i=0;i<7;i++){
    float fi=float(i);
    float tt=fract(T*.8+fi/7.);
    vec3 C=uLeakP+uLeakD*(3.+tt*46.)+vec3(0.,0.,-tt*tt*12.);
    float r=1.6+tt*11.;
    float tp=dot(C-o,V);
    float pd=length(o+tp*V-C);
    float n=fbm2(vec2(pd*.13+fi*3.1,tt*2.4-T*.6));
    float a=smoothstep(0.,.14,tt)*(1.-smoothstep(.4,1.,tt));
    sum+=exp(-pow(pd/r,2.))*(.45+.8*n)*a*2.4/(1.+tt*3.);
  }
  return vec3(.72,.77,.84)*sum*uLeak*.5;
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  Scene S=sceneOf(vb);
  float pf=clamp(uPc,0.,1.);
  vec3 col=steamOf(S.g0,S.V,S.tAir,S.u,S.z0,pf,uTime,1.);
  col+=shockOf(S.dist,S.tc,S.tAirE,S.e0,S.V,1.);
  col+=leakOf(S.g0,S.V,uTime);
  gl_FragColor=inkOf(col);
}`;

const SHARED = ["uJit", "uPc", "uHue", "uSmoke", "uVent", "uShockR", "uShockA", "uLight"];
const layer = glLayer({
  canvas,
  fragment: PLUME,
  view: [D.W, D.H],
  camera: D.camera,
  uniforms: [...SHARED, "uGlow", "uPre", "uReach", "uSplash", "uFlash", "uRingR", "uRingA", "uPop", "uPopR"],
});
const veil = layer
  ? glLayer({
      canvas: veilCanvas,
      fragment: VEIL,
      view: [D.W, D.H],
      camera: D.camera,
      uniforms: [...SHARED, "uLeak", "uLeakP", "uLeakD"],
    })
  : null;
if (layer) stage.setAttribute("data-gl", "");
const LIGHT = document.body.dataset.theme === "light" || root.closest('[data-theme="light"]') ? 1 : 0;

let lastKey = "";
function paintPlume(values, active, veiled) {
  if (!layer) return;
  if (!active) {
    layer.clear();
    if (veil) veil.clear();
    lastKey = "";
    return;
  }
  const time = still.matches ? 0.8 : clock;
  const key = still.matches ? JSON.stringify(values) + veiled : "";
  if (key && key === lastKey) return;
  lastKey = key;
  layer.draw(values, time);
  if (!veil) return;
  if (veiled) veil.draw(values, time);
  else veil.clear();
}

function announce(phase) {
  if (burn.phase === phase) return;
  burn.phase = phase;
  if (live) live.textContent = phase;
}

function fireState(state) {
  if (state) fireButton.dataset.state = state;
  else delete fireButton.dataset.state;
}

// ---------------------------------------------------------------------------
// Anatoly's job: each press of Ignite is one use. Its outcome comes from the
// table; its poses come from one failure clock, so the fix can play it back.

const CLOCKS = Object.fromEntries(Object.entries(D.phases).map(([id, phases]) => [id, ANATOLY.failureClock(phases)]));
let uses = 0;
let resets = 0;
let job = null;
let tourWait = 0.6;
let strainShake = 0;
const leak = glide();

const broken = () => job && job.dir > 0 && job.id === "falls-apart" && job.age >= job.clock.startOf("gives");
// The fix button only shows when there is something lying on the deck to fix.
const syncFix = () => fixButton.toggleAttribute("data-ready", Boolean(broken()));
const thrustTf = () => Math.max(0, D.vacuumTf * burn.pc - D.backTf) * M.loadCell;

function wordsOf(j, phase) {
  if (!j || j.id !== "falls-apart") return "";
  if (phase === "strains") return `straining · tape at ${fmt(thrustTf())} tf · rated ${M.tapeKgf} kg`;
  if (phase === "gives") return "tape let go";
  if (phase === "settles") return `fell apart · ${FALL.length} pieces on the deck`;
  return "";
}

function restWords() {
  const shown = ANATOLY.repairsAfter(resets, D.maxRepairs);
  return D.honest ? "1,630 kg · cold" : shown ? `1,630 kg · cold · taped ×${shown + 1}` : "1,630 kg · cold · taped";
}

function pickOutcome() {
  return ANATOLY.outcomeOf(D.seed, uses++, D.table).id;
}

// One wrap shows at the throat: the one for the number of fixes so far. A new
// wrap is fatter than the last, so it fades in over it.
let tapeLevel = 0;
function showRepairs(count) {
  tapeLevel = count;
  stage.dataset.tape = String(count);
  if (hintEl) hintEl.textContent = D.honest ? "press ignite. stand back." : count >= D.maxRepairs ? "it's fine now. press ignite." : "press ignite. stand back.";
}

function use(fromTour = false) {
  if (burn.on) return;
  if (job) {
    if (broken() && !fromTour) {
      say("still in pieces");
      announce("still in pieces");
      fixButton.setAttribute("data-nudge", "");
      setTimeout(() => fixButton.removeAttribute("data-nudge"), 900);
    }
    return;
  }
  const id = fromTour && D.honest ? "works" : pickOutcome();
  job = { id, clock: CLOCKS[id], age: 0, dir: 1, from: 0, phase: "works", tour: fromTour, seen: false, tumble: tumbleOf(uses + resets * 101) };
  if (still.matches) {
    job.age = job.clock.total;
    poseJob(job);
    if (id === "works") {
      say(`good enough · Pc ${fmt(M.pc * D.chamberBar)} bar`);
      announce("good enough");
      job = null;
    } else {
      say(wordsOf(job, "settles"));
      announce(wordsOf(job, "gives"));
      syncFix();
    }
    describe();
    place();
    return;
  }
  ignite(fromTour, id === "works" ? job.clock.startOf("settles") : Infinity);
}

function fix() {
  if (!job || job.dir < 0) return;
  if (burn.on) shutdown();
  if (job.id === "works") return;
  if (!job.tour) resets++;
  job = { ...job, dir: -1, from: job.age };
  announce("fixing");
  if (still.matches) {
    job.age = 0;
    finishFix();
    return;
  }
  run();
}

function finishFix() {
  const wasTour = job && job.tour;
  job.age = 0;
  poseJob(job);
  job = null;
  syncFix();
  showRepairs(ANATOLY.repairsAfter(resets, D.maxRepairs));
  say(restWords());
  announce(wasTour ? "fixed" : "fixed. again.");
  describe();
  place();
}

// Every pose is a function of the job's age, so playing it backwards is the fix.
// Straining, the tape stretches and the nozzle sags and starts to peel, hinged
// on the side still stuck. At the give it swings off that hinge and drops,
// still turning, lands on one rim and slaps down, rocking. The rest let go in
// turn: each drops with a little spin, lands on the rim it was leaning toward,
// tips over about it, hits the boards and bounces back a touch.
function poseJob(j) {
  const c = j.clock;
  const a = j.age;
  const has = (name) => c.phases.some((phase) => phase.name === name);
  const strain = has("strains") ? a - c.startOf("strains") : -1;
  const give = has("gives") ? a - c.startOf("gives") : -1;
  strainShake = has("strains") && give < 0 ? ANATOLY.shakeAt(strain, { amp: 1.4, hz: 13, rise: 0.6, fall: 0.2 }) : 0;
  const strainK = strain > 0 ? Math.min(1, strain / 0.8) ** 2 : 0;
  const g = D.fall.g;
  const tumble = j.tumble || tumbleOf(0);
  FALL.forEach((id, index) => {
    const v = tumble[id];
    const b = BODY[id];
    const f = fallen[id];
    const drop = -moveOf[id][2];
    const T = Math.sqrt((2 * drop) / g);
    const set = (x, z, turn, shift, dv = 0) => {
      f.x = x;
      f.z = z;
      f.a = turn;
      [f.ex, f.ey] = shift;
      f.dv = dv;
    };
    f.sag = 0;
    if (index === 0) {
      // The nozzle: the peel, hinged at the top rim on the left.
      const hinge = rimOf(id, -1, "top", 38);
      const PEEL = 4;
      const SWING = 0.14;
      f.sag = D.fall.sag * strainK;
      if (give <= 0) return set(0, 0, PEEL * strainK, about(id, PEEL * strainK, hinge));
      if (give < SWING) {
        const turn = PEEL + (v.swing - PEEL) * (give / SWING) ** 2;
        return set(0, 0, turn, about(id, turn, hinge));
      }
      const t = give - SWING;
      if (t < T) {
        const u = t / T;
        const turn = v.swing + (v.land - v.swing) * u;
        const from = about(id, turn, hinge);
        const to = about(id, turn, rimOf(id, turn));
        return set(u, (0.5 * g * t * t) / drop, turn, [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u]);
      }
      const tb = t - T;
      land(j, id);
      // Slaps flat and rocks rim to rim, dying away.
      const turn = v.land * Math.exp(-5 * tb) * Math.cos(16 * tb);
      return set(1, 1 - hopAt(tb, drop, v.hop * 0.5), turn, about(id, turn, rimOf(id, turn)));
    }
    const t = give - v.delay;
    if (t <= 0) return set(0, 0, 0, [0, 0]);
    const sign = b.tip ? Math.sign(b.rest) : 1;
    const landTurn = sign * v.land;
    const pivot = b.tip ? b.P : rimOf(id, landTurn);
    if (t < T) {
      const u = t / T;
      const turn = landTurn * u * u;
      const to = about(id, turn, pivot);
      return set(u, (0.5 * g * t * t) / drop, turn, [to[0] * u, to[1] * u]);
    }
    const tb = t - T;
    land(j, id);
    const z = 1 - hopAt(tb, drop, v.hop);
    if (!b.tip) {
      const turn = landTurn * Math.exp(-5 * tb) * Math.cos(16 * tb);
      return set(1, z, turn, about(id, turn, rimOf(id, turn)));
    }
    // Tips over about the rim, quicker and quicker, then a small bounce back.
    let turn;
    if (tb < v.tip) turn = landTurn + (b.rest - landTurn) * (tb / v.tip) ** 2;
    else {
      const tc = tb - v.tip;
      turn = b.rest * (1 - 0.09 * Math.exp(-6 * tc) * Math.abs(Math.sin(15 * tc)));
      if (j.dir > 0 && !tipped[id]) {
        tipped[id] = true;
        thud = clock;
      }
    }
    return set(1, z, turn, about(id, turn, pivot), b.dv * clamp(turn / b.full, 0, 1));
  });
  if (give < 0) {
    landed = {};
    tipped = {};
  }
}

// One hop off the boards after landing, as a share of the drop.
function hopAt(tb, drop, size) {
  const g = D.fall.g;
  const hop = Math.min(6, drop * 0.03) * size;
  const v0 = Math.sqrt(2 * g * hop);
  return tb < (2 * v0) / g ? (v0 * tb - 0.5 * g * tb * tb) / drop : 0;
}

function land(j, id) {
  if (j.dir > 0 && !landed[id]) {
    landed[id] = true;
    thud = clock;
  }
}

function stepJob(dt, calm) {
  if (!job) return false;
  const c = job.clock;
  if (job.dir > 0) {
    if (!(burn.on && burn.armed)) job.age = Math.min(c.total, job.age + dt);
  } else {
    job.age = Math.max(0, job.age - dt * (job.from / D.fixSeconds));
  }
  const s = c.at(job.age);
  poseJob(job);
  syncFix();
  if (job.dir > 0 && s.phase !== job.phase) {
    job.phase = s.phase;
    if (s.phase === "strains") announce("straining");
    if (s.phase === "gives") {
      announce(wordsOf(job, "gives"));
      burn.cut = true;
      shutdown();
    }
  }
  const words = job.dir > 0 ? wordsOf(job, s.phase === "beat" ? "" : s.phase) : "";
  if (words) say(words);
  else if (job.dir < 0) say("fixing · more tape");
  if (job.id === "works" && job.dir > 0 && job.age >= c.total && !burn.on) {
    say(`good enough · Pc ${fmt(M.pc * D.chamberBar)} bar`);
    announce("good enough");
    job = null;
    return false;
  }
  if (job.dir < 0 && job.age <= 0) {
    finishFix();
    return false;
  }
  return job.dir < 0 || job.age < c.total;
}

function ignite(fromTour = false, stopAt = Infinity) {
  if (burn.on) return;
  select(null);
  burn.on = true;
  describe();
  burn.armed = true;
  burn.tour = fromTour;
  burn.t = 0;
  burn.stopping = -1;
  burn.glowStop = null;
  burn.popped = false;
  burn.cut = false;
  burn.armedAt = clock;
  burn.stopAt = stopAt;
  fireState("armed");
  fireLabel.textContent = "Shut down";
  run();
}

function shutdown() {
  if (!burn.on || burn.stopping >= 0) return;
  burn.stopping = burn.t;
}

function pcTarget() {
  if (!burn.on || burn.armed || burn.stopping >= 0) return 0;
  if (burn.t >= MAIN) return M.pc;
  if (burn.t >= VENT) return PREBURNER_PC;
  return 0;
}

function stepBurn(dt, calm) {
  if (burn.on && burn.armed && (calm || clock - burn.armedAt > 0.35)) {
    burn.armed = false;
    fireState("on");
    if (calm) burn.t = MAIN + 0.5;
  }
  const before = burn.t;
  if (burn.on && !burn.armed) burn.t += dt;
  const t = burn.t;
  if (burn.on && burn.stopping < 0 && t >= burn.stopAt) burn.stopping = t;
  const lit = burn.on && !burn.armed && burn.stopping < 0;
  if (lit && t >= MAIN && before < MAIN && !calm) burn.mainAt = clock;
  const target = pcTarget();
  if (calm) {
    burn.pc = target;
    burn.pcRate = 0;
  } else {
    const falling = burn.stopping >= 0;
    // When the tape goes, the lines go with it: the fire stops at once.
    const stiff = burn.cut ? 260 : falling ? 16 : target > PREBURNER_PC ? 20 : 64;
    const drag = burn.cut ? 2 * Math.sqrt(stiff) : falling ? 8.2 : 2 * Math.sqrt(stiff);
    for (let index = 0; index < 4; index++) {
      const h = dt / 4;
      burn.pcRate += ((target - burn.pc) * stiff - burn.pcRate * drag) * h;
      burn.pc = clamp(burn.pc + burn.pcRate * h, 0, 1);
    }
  }
  settle(burn.hue, lit && burn.pc > 0.2 ? 1 : 0, dt, lit ? 0.32 : 0.5, calm);
  const onset = smooth(0, 0.1, burn.pc);
  let glow = onset * (1.15 - 0.15 * burn.hue.x);
  if (burn.stopping >= 0 && !calm) {
    if (!burn.glowStop) burn.glowStop = { glow: burn.lastGlow ?? glow, onset: Math.max(onset, 1e-3), pc: Math.max(burn.pc, 1e-3) };
    const stop = burn.glowStop;
    glow = Math.min(stop.glow, stop.glow * Math.min(1, onset / stop.onset) * Math.sqrt(Math.min(1, burn.pc / stop.pc)));
  }
  if (!burn.on) glow = 0;
  burn.lastGlow = glow;
  settle(burn.pre, lit && t > VENT && t < MAIN + 0.1 ? 1 : 0, dt, lit && t < MAIN ? 0.06 : 0.12, calm);
  settle(burn.vent, lit && t < MAIN ? M.chillVent : 0, dt, lit && t < MAIN ? 0.16 : 0.24, calm);
  // Cut, the flame has nothing behind it: it is gone in a few frames, before
  // the nozzle has dropped out from under where it was.
  settle(burn.reach, 72 * smooth(0, 0.12, burn.pc) + (LONGEST - 72) * smooth(0.16, 0.75, burn.pc), dt, burn.cut ? 0.03 : burn.stopping >= 0 ? 0.12 : 0.07, calm);
  settle(burn.splash, smooth(0.35, 0.9, burn.pc) * smooth(D.plumeLength - 10, D.plumeLength + 40, burn.reach.x), dt, burn.cut ? 0.04 : 0.16, calm);
  settle(burn.smoke, lit && t > MAIN + 0.4 ? M.deluge : 0, dt, lit ? 0.9 : 1.8, calm);
  if (burn.on && burn.stopping >= 0 && burn.pc < 0.2 && !burn.popped && !calm && !burn.cut) {
    burn.popAt = clock;
    burn.popped = true;
  }
  if (burn.on && burn.stopping >= 0 && burn.pc < 0.003 && Math.abs(burn.pcRate) < 0.01 && t - burn.stopping > 0.9) {
    burn.on = false;
    burn.t = -1;
    burn.pc = 0;
    burn.pcRate = 0;
    burn.glowStop = null;
    fireState("");
    fireLabel.textContent = "Ignite";
    if (!job) announce("cold");
    describe();
  }

  // When the tape tears, what was left in the lines comes out of the joint as
  // a cold cloud: on from the give for a moment, never when fixing.
  const venting = job && job.dir > 0 && job.id === "falls-apart" && job.age >= job.clock.startOf("gives") && job.age < job.clock.startOf("gives") + 0.3;
  settle(leak, venting ? 1 : 0, dt, venting ? 0.05 : 0.22, calm);
  burn.leakP = D.joint;
  burn.leakD = [0.62, 0.55, -0.56];

  const sinceMain = clock - burn.mainAt;
  const sincePop = burn.popAt >= 0 ? clock - burn.popAt : -1;
  const flash = calm ? 0 : burst(sinceMain, 0.08, 0.13);
  const shockA = calm ? 0 : burst(sinceMain, 0.05, 0.12);
  const ringA = calm ? 0 : burst(sinceMain - 0.08, 0.08, 0.16);
  const pop = calm || sincePop < 0 ? 0 : burst(sincePop, 0.09, 0.2);
  // Each piece hitting the planks shakes the whole page a little.
  const shake = calm ? 0 : 3.2 * burst(sinceMain, 0.05, 0.12) + 3.6 * burst(clock - thud, 0.03, 0.2);
  // Fence posts, bricks and an invoice: the whole stand rocks under the burn,
  // and the engine shudders on its tape before it goes.
  const hum = calm ? 0 : 0.32 * M.hum * burn.pc * smooth(0.02, 0.12, burn.pc);
  const strain = calm ? 0 : strainShake;
  jitter = [Math.sin(clock * 91) * hum + Math.sin(clock * 53) * shake + strain, Math.cos(clock * 77) * hum * 0.7 + Math.cos(clock * 61) * shake - strain * 0.6];

  const values = {
    uJit: jitter,
    uPc: burn.pc,
    uHue: burn.hue.x,
    uGlow: glow,
    uLight: LIGHT,
    uPre: burn.pre.x,
    uVent: burn.vent.x,
    uSmoke: burn.smoke.x,
    uReach: burn.reach.x,
    uSplash: burn.splash.x,
    uFlash: flash,
    uShockR: 26 + 900 * Math.max(0, sinceMain),
    uShockA: shockA,
    uRingR: 600 * Math.max(0, sinceMain - 0.08),
    uRingA: ringA,
    uPop: pop,
    uPopR: 24 + 70 * (1 - Math.exp(-Math.max(0, sincePop) / 0.25)),
    uLeak: leak.x,
    uLeakP: burn.leakP || [0, 0, 0],
    uLeakD: burn.leakD || [1, 0, 0],
  };
  const active = burn.pc > 1e-3 || burn.pre.x > 1e-3 || burn.vent.x > 1e-3 || burn.smoke.x > 1e-3 || flash > 1e-3 || shockA > 1e-3 || ringA > 1e-3 || pop > 1e-3 || leak.x > 1e-3 || (sinceMain > 0 && sinceMain < 0.6);
  paintPlume(values, active, burn.smoke.x > 1e-3 || burn.vent.x > 1e-3 || shockA > 1e-3 || leak.x > 1e-3);

  const rim = clamp(burn.pc * 0.85 + burn.pre.x * 0.45 * smooth(0, 0.05, burn.pc) + flash * 0.6 + pop * 0.7, 0, 1);
  stage.style.setProperty("--rim", rim.toFixed(3));
  stage.style.setProperty("--deck-glow", clamp(burn.pc * 0.9 * burn.splash.x + flash * 0.5 + burn.pre.x * 0.12 * smooth(0, 0.05, burn.pc) + pop * 0.25, 0, 1).toFixed(3));
  flashVeil.style.opacity = (flash * 0.32).toFixed(3);
  stage.style.transform = shake > 0.01 ? `translate(${(Math.sin(clock * 47) * shake * 0.5).toFixed(2)}px, ${(Math.cos(clock * 59) * shake * 0.5).toFixed(2)}px)` : "";

  if (burn.on) {
    const bar = fmt(burn.pc * D.chamberBar);
    const thrust = fmt(Math.max(0, D.vacuumTf * burn.pc - D.backTf) * M.loadCell);
    if (burn.armed) {
      say("closing up · arming");
      announce("arming");
    } else if (burn.stopping >= 0) {
      say(burn.pc > 0.01 ? `shutdown · ${bar} bar` : "shutdown · purging");
      if (!broken()) announce("shutdown");
    } else if (t < VENT) {
      say("chill-down · venting");
      announce("chill-down, venting");
    } else if (t < MAIN) {
      say(`spin-up · preburners lit · ${bar} bar`);
      announce("preburners lit");
    } else {
      say(`Pc ${bar} bar · ${thrust} tf`);
      announce("main stage");
    }
  }
  return burn.on || active;
}

// The tour: one use that works, badly; one that fails; a pause on the broken
// machine; Anatoly's fix; again. It never spends the reader's uses.
function stepTour(dt) {
  if (burn.on) return;
  tourWait -= dt;
  if (tourWait > 0) return;
  if (!job) {
    use(true);
    tourWait = 1.2;
    return;
  }
  if (job.dir > 0 && job.age >= job.clock.total) {
    if (!job.seen) {
      job.seen = true;
      tourWait = 2;
      return;
    }
    fix();
    tourWait = 1.4;
  }
}

function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || burn.on) return quietTour();
    touring = !still.matches;
    tourWait = 0.6;
    run();
  }, 3600);
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  if (broken()) return wordsOf(job, "settles");
  return restWords();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) stepTour(dt);
  const moving = false;
  const burning = stepBurn(dt, calm);
  const failing = stepJob(dt, calm);
  place();
  if (!burn.on && !failing && !(job && job.dir < 0)) {
    const text = idleText();
    if (!/^(good enough|still broken|fixed)/.test(readout.textContent) || moving || selected) say(text);
  }
  frame = visible && (moving || burning || failing || touring || leak.x > 1e-3) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  if (burn.on || (job && !broken())) return;
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    run();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || burn.on) return;
  quietTour();
  // A tap on a phone uses the machine, the way a press of Ignite does.
  if (broken()) fix();
  else use(false);
  run();
});

fireButton.addEventListener("click", () => {
  quietTour();
  if (burn.on) shutdown();
  else use(false);
  run();
});

fixButton.addEventListener("click", () => {
  quietTour();
  fix();
  run();
});

partButtons.forEach((button) => {
  const show = () => {
    if (burn.on || (job && !broken())) return;
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      run();
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("keydown", (event) => {
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    if (burn.on) shutdown();
    select(null);
    run();
    return;
  } else if (event.key === "i" || event.key === "I" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    quietTour();
    if (burn.on) shutdown();
    else use(false);
    run();
    return;
  } else if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    quietTour();
    fix();
    run();
    return;
  }
  if (next === null || burn.on || (job && !broken())) return;
  event.preventDefault();
  quietTour();
  select(D.order[next]);
  run();
});

if (still.matches) touring = false;
window.addEventListener("resize", () => {
  lastKey = "";
  run();
});
showRepairs(0);
place();
say(restWords());
