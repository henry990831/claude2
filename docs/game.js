// ============================================================
//  无限世界 RPG — GitHub Pages 版 (真实 3D)
//  真实 GLTF 模型 + PBR + IBL环境光 + 阴影 + 泛光后处理 + 昼夜
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const $ = id => document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const choice=a=>a[Math.floor(Math.random()*a.length)];

// ---------------- 噪声地形 ----------------
function hash(x,z){ const n=Math.sin(x*127.1+z*311.7)*43758.5453; return n-Math.floor(n); }
function vnoise(x,z){ const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);
  const u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v; }
function terrainH(x,z){
  let h=(vnoise(x*0.018,z*0.018)-0.5)*18 + (vnoise(x*0.06,z*0.06)-0.5)*4.5 + (vnoise(x*0.15,z*0.15)-0.5)*1.2;
  const d=Math.hypot(x,z); if(d<26) h*=clamp((d-6)/20,0,1); // 出生点压平
  return h;
}

// ---------------- 全局 ----------------
let scene,camera,renderer,composer,clock,raycaster;
let sun,hemi,sky,skyMat,stars,pmrem;
const WORLD=420, PR=0.55;
const player={x:0,y:2,z:6,vy:0,yaw:0,pitch:0,onGround:true,eye:1.7};
const keys={};
let colliders=[];
let water=null; const WATER_Y=-2.6; let wildlife=[];
// 真实资源状态（加载失败会自动回退，绝不会让画面比现在更差）
let hdriLoaded=false, groundMaps=null, TreeLib=null, treeTemplates=[];
let started=false,paused=true,pointerLocked=false;
let lastMX=innerWidth/2,lastMY=innerHeight/2,mouseX=innerWidth/2,mouseY=innerHeight/2;
let lastAttack=0,lastMobHit=0,gameTime=480,timeStr='08:00';

// 玩家数值
const G={level:1,xp:0,gold:0,hp:120,maxHp:120,atk:12,def:2,kills:0};
function xpNeed(l){ return Math.floor(80*Math.pow(l,1.5)); }

// ---------------- 渲染管线 ----------------
function initRenderer(){
  const canvas=$('game-canvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.0;

  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0xbcd4ee,0.0075);

  camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.3,100000);
  camera.position.set(player.x,3,player.z);
  clock=new THREE.Clock(); raycaster=new THREE.Raycaster();

  // 环境光照(IBL) — 让 PBR 材质有真实反射
  pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;

  // 真实大气天空(散射) — Sky addon
  sky=new Sky(); sky.scale.setScalar(45000); scene.add(sky);
  const su=sky.material.uniforms; su.turbidity.value=6; su.rayleigh.value=1.8; su.mieCoefficient.value=0.005; su.mieDirectionalG.value=0.8;

  // 星空
  const sg=new THREE.BufferGeometry(),arr=[];
  for(let i=0;i<700;i++){const th=Math.random()*6.28,ph=Math.acos(Math.random());const r=560;arr.push(r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph)+30,r*Math.sin(ph)*Math.sin(th));}
  sg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false}));
  scene.add(stars);

  // 光照
  hemi=new THREE.HemisphereLight(0xbfe0ff,0x55603f,0.5); scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff1d0,2.4);
  sun.position.set(60,120,40); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.near=1; sun.shadow.camera.far=400;
  sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90;
  sun.shadow.bias=-0.0003; sun.shadow.normalBias=0.03;
  scene.add(sun); scene.add(sun.target);

  // 后处理：泛光
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.35,0.55,1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // 正确的色调映射/色彩空间输出

  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); });
}


// ---------------- 程序化贴图 ----------------
function grassTexture(){
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  x.fillStyle='#4f8a3f'; x.fillRect(0,0,256,256);
  for(let i=0;i<9000;i++){ const g=90+Math.random()*90; x.fillStyle=`rgba(${40+Math.random()*40},${g},${40+Math.random()*30},.5)`; const s=1+Math.random()*2.5; x.fillRect(Math.random()*256,Math.random()*256,s,s); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(WORLD/6,WORLD/6); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}

// ---------------- 真实资源加载（Poly Haven CC0，失败自动回退）----------------
// 1) 真实 HDRI 天空 + 图像光照(IBL) —— realism 最大杠杆
function loadHDRI(){
  return new Promise(res=>{
    const url='https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr';
    new RGBELoader().load(url, tex=>{
      try{
        tex.mapping=THREE.EquirectangularReflectionMapping;
        const envRT=pmrem.fromEquirectangular(tex);
        scene.environment=envRT.texture;   // 真实环境反射光
        scene.background=tex;               // 真实照片天空
        if(sky) sky.visible=false;          // 关掉程序化天空
        hemi.intensity=0.35; sun.intensity=2.2;
        renderer.toneMappingExposure=0.72;
        scene.fog.color.set(0xcfe0f2); scene.fog.density=0.0045;
        hdriLoaded=true;
      }catch(e){ console.warn('HDRI 应用失败',e); }
      res(true);
    }, undefined, ()=>{ console.warn('HDRI 加载失败，保留程序化天空'); res(false); });
  });
}
// 2) 真实 PBR 地面材质（漫反射+法线+粗糙度）
function loadGroundTextures(){
  return new Promise(res=>{
    const base='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_grass_rock/aerial_grass_rock_';
    const tl=new THREE.TextureLoader(); const maps={}; let done=0,fail=0; const need=3;
    const rep=WORLD/10;
    const fin=()=>{ if(++done>=need){ groundMaps=(fail===0)?maps:null; res(true); } };
    const cfg=(t,srgb)=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep); if(srgb)t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; };
    maps.map=tl.load(base+'diff_2k.jpg', t=>{cfg(t,true);fin();}, undefined, ()=>{fail++;fin();});
    maps.normalMap=tl.load(base+'nor_gl_2k.jpg', t=>{cfg(t,false);fin();}, undefined, ()=>{fail++;fin();});
    maps.roughnessMap=tl.load(base+'rough_2k.jpg', t=>{cfg(t,false);fin();}, undefined, ()=>{fail++;fin();});
  });
}
// 3) ez-tree：真实枝干分叉树（程序生成，失败/性能问题自动回退到简易树）
async function loadTreeLib(){
  try{
    const mod=await import('https://cdn.jsdelivr.net/npm/@dgreenheck/ez-tree/+esm');
    TreeLib=mod||null;
  }catch(e){ console.warn('ez-tree 加载失败，用简易树',e); TreeLib=null; }
}
function buildTreeTemplates(){
  if(!TreeLib||!TreeLib.Tree) return;
  const presetKeys = TreeLib.TreePreset ? Object.keys(TreeLib.TreePreset) : [];
  for(let i=0;i<4;i++){
    try{
      const t=new TreeLib.Tree();
      if(presetKeys.length){ const k=presetKeys[i%presetKeys.length];
        try{ if(typeof t.loadPreset==='function') t.loadPreset(k);
             else if(typeof t.loadFromJSON==='function') t.loadFromJSON(TreeLib.TreePreset[k]);
             else if(t.options) Object.assign(t.options,TreeLib.TreePreset[k]); }catch(_){}
      }
      if(typeof t.generate==='function') t.generate();
      if(t && t.isObject3D && t.children.length){
        t.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
        treeTemplates.push(t);
      }
    }catch(e){ /* 忽略，继续 */ }
  }
}
function placeEzTree(x,z,targetH){
  if(!treeTemplates.length) return false;
  try{
    const tpl=treeTemplates[Math.floor(Math.random()*treeTemplates.length)];
    const box=new THREE.Box3().setFromObject(tpl); const sz=box.getSize(new THREE.Vector3());
    const t=tpl.clone(true);
    const s=(targetH/(sz.y||targetH))*(0.8+Math.random()*0.5); t.scale.setScalar(s);
    t.position.set(x,terrainH(x,z),z); t.rotation.y=Math.random()*6.28;
    scene.add(t); colliders.push({x,z,r:Math.max(0.7,targetH*0.1)}); return true;
  }catch(e){ return false; }
}

// ---------------- 地形 ----------------
function buildTerrain(){
  const seg=200;
  const geo=new THREE.PlaneGeometry(WORLD,WORLD,seg,seg); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, cols=[];
  const cGrass=new THREE.Color(0x4f8a3f),cDark=new THREE.Color(0x3a6a2e),cRock=new THREE.Color(0x7d7266),cSnow=new THREE.Color(0xeef4f7);
  for(let i=0;i<pos.count;i++){
    const wx=pos.getX(i),wz=pos.getZ(i),h=terrainH(wx,wz); pos.setY(i,h);
    let c=cGrass.clone().lerp(cDark,clamp((0.5-vnoise(wx*0.05,wz*0.05)),0,1)*0.6);
    if(h>10) c.lerp(cRock,clamp((h-10)/8,0,1)); if(h>17) c.lerp(cSnow,clamp((h-17)/6,0,1));
    cols.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3)); geo.computeVertexNormals();
  let mat;
  if(groundMaps){
    // 真实 PBR 地面：顶点色只做极轻微高度着色，避免盖住照片材质
    mat=new THREE.MeshStandardMaterial({map:groundMaps.map,normalMap:groundMaps.normalMap,roughnessMap:groundMaps.roughnessMap,roughness:1.0,metalness:0.0});
    mat.normalScale=new THREE.Vector2(0.8,0.8);
  } else {
    mat=new THREE.MeshStandardMaterial({map:grassTexture(),vertexColors:true,roughness:0.95,metalness:0.0});
  }
  const mesh=new THREE.Mesh(geo,mat); mesh.receiveShadow=true; scene.add(mesh);
}

// ---------------- 树木 / 岩石 ----------------
const barkMat=()=>new THREE.MeshStandardMaterial({color:0x5c3a1e,roughness:0.9,metalness:0});
function leafMat(c){ return new THREE.MeshStandardMaterial({color:c,roughness:0.82,metalness:0}); }
function makeTree(x,z){
  const g=new THREE.Group(); const h=terrainH(x,z);
  const th=4+Math.random()*3, r0=0.32+Math.random()*0.16;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(r0*0.55,r0,th,10),barkMat()); trunk.position.y=th/2; trunk.castShadow=true; g.add(trunk);
  const nb=3+Math.floor(Math.random()*3);
  for(let i=0;i<nb;i++){ const bl=1.8+Math.random()*1.6; const br=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.14,bl,6),barkMat());
    const ang=Math.random()*6.28,tilt=0.5+Math.random()*0.4; br.position.set(0,th*0.55+i*0.55,0); br.rotation.set(Math.cos(ang)*tilt,ang,Math.sin(ang)*tilt); br.translateY(bl/2); br.castShadow=true; g.add(br); }
  const baseL=0.3+Math.random()*0.08;
  const c1=new THREE.Color().setHSL(0.26+Math.random()*0.05,0.5,baseL).getHex();
  const c2=new THREE.Color().setHSL(0.26+Math.random()*0.05,0.55,baseL+0.12).getHex();
  const cx=[[0,th+1.0,0,2.4],[-1.4,th+0.3,0.6,1.7],[1.5,th+0.4,-0.4,1.75],[0.3,th+2.1,0.2,1.7],[-0.6,th+1.3,-1.2,1.5],[1.1,th+1.4,1.1,1.5]];
  cx.forEach((p,i)=>{ const geo=new THREE.IcosahedronGeometry(p[3],3); const pos=geo.attributes.position;
    for(let k=0;k<pos.count;k++){ const nx=pos.getX(k),ny=pos.getY(k),nz=pos.getZ(k); const n=0.82+vnoise(nx*2+i*3,nz*2+i)*0.34; pos.setXYZ(k,nx*n,ny*n,nz*n); }
    geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,leafMat(i%2?c2:c1)); m.position.set(p[0],p[1],p[2]); m.scale.y=0.92; m.castShadow=true; m.receiveShadow=true; g.add(m); });
  g.position.set(x,h,z); g.rotation.y=Math.random()*6.28; scene.add(g);
  colliders.push({x,z,r:0.9});
}
function makeRock(x,z){
  const h=terrainH(x,z); const s=0.8+Math.random()*1.6;
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),new THREE.MeshStandardMaterial({color:0x8a8378,roughness:1,metalness:0,flatShading:true}));
  m.position.set(x,h+s*0.4,z); m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({x,z,r:s*0.9});
}
// 松树(针叶)
function makePine(x,z){ const g=new THREE.Group(); const h=terrainH(x,z); const th=5+Math.random()*4;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.4,th,8),barkMat()); trunk.position.y=th/2; trunk.castShadow=true; g.add(trunk);
  const col=new THREE.Color().setHSL(0.33+Math.random()*0.04,0.45,0.22+Math.random()*0.06).getHex(); const layers=4+Math.floor(Math.random()*3);
  for(let i=0;i<layers;i++){ const r=2.6*(1-i/layers)+0.5; const cone=new THREE.Mesh(new THREE.ConeGeometry(r,2.2,9),leafMat(col)); cone.position.y=th*0.5+i*1.5+1; cone.castShadow=true; cone.receiveShadow=true; g.add(cone); }
  g.position.set(x,h,z); scene.add(g); colliders.push({x,z,r:0.8}); }
// 灌木丛
function makeBush(x,z){ const g=new THREE.Group(); const h=terrainH(x,z); const col=new THREE.Color().setHSL(0.28,0.5,0.26+Math.random()*0.08).getHex();
  for(let i=0;i<4;i++){ const r=0.5+Math.random()*0.5; const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),leafMat(col)); m.position.set((Math.random()-0.5)*0.9,0.4+Math.random()*0.3,(Math.random()-0.5)*0.9); m.castShadow=true; g.add(m); }
  g.position.set(x,h,z); scene.add(g); }
// 蕨类
function makeFern(x,z){ const g=new THREE.Group(); const h=terrainH(x,z);
  for(let i=0;i<6;i++){ const bl=new THREE.Mesh(new THREE.ConeGeometry(0.13,1.0+Math.random()*0.6,4),leafMat(0x3f8f3a)); const a=i/6*6.28; bl.position.set(Math.cos(a)*0.15,0.55,Math.sin(a)*0.15); bl.rotation.set(Math.cos(a)*0.6,a,Math.sin(a)*0.6); bl.castShadow=true; g.add(bl); }
  g.position.set(x,h,z); scene.add(g); }
// 蘑菇
function makeMushroom(x,z){ const g=new THREE.Group(); const h=terrainH(x,z); const s=0.9+Math.random()*1.1;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.12*s,0.15*s,0.55*s,8),new THREE.MeshStandardMaterial({color:0xeee3cf,roughness:0.9})); stem.position.y=0.28*s; g.add(stem);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(0.42*s,14,8,0,6.28,0,1.7),new THREE.MeshStandardMaterial({color:choice([0xd23b3b,0xe0863b,0xc23bd2,0xf0d040]),roughness:0.55})); cap.position.y=0.55*s; cap.castShadow=true; g.add(cap);
  g.position.set(x,h,z); scene.add(g); }
// 倒木
function makeLog(x,z){ const h=terrainH(x,z); const len=2+Math.random()*2.4; const m=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.4,len,10),barkMat()); m.rotation.z=Math.PI/2; m.rotation.y=Math.random()*6.28; m.position.set(x,h+0.35,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); colliders.push({x,z,r:0.6}); }
// 芦苇(水边)
function makeReeds(x,z){ const g=new THREE.Group(); const h=terrainH(x,z);
  for(let i=0;i<9;i++){ const bl=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.035,1.2+Math.random()*0.9,4),new THREE.MeshStandardMaterial({color:0x8aa14a,roughness:1})); bl.position.set((Math.random()-0.5)*0.7,0.7,(Math.random()-0.5)*0.7); bl.rotation.set((Math.random()-0.5)*0.3,0,(Math.random()-0.5)*0.3); g.add(bl); }
  g.position.set(x,h,z); scene.add(g); }
// 睡莲(水面)
function makeLilyPad(x,z){ const pad=new THREE.Mesh(new THREE.CircleGeometry(0.5+Math.random()*0.4,14),new THREE.MeshStandardMaterial({color:0x2f7a3a,roughness:0.7,side:THREE.DoubleSide})); pad.rotation.x=-Math.PI/2; pad.position.set(x,WATER_Y+0.06,z); scene.add(pad); }
// 湖水
function buildWater(){ const geo=new THREE.PlaneGeometry(WORLD,WORLD); geo.rotateX(-Math.PI/2); const mat=new THREE.MeshStandardMaterial({color:0x2f6b9e,metalness:0.5,roughness:0.12,transparent:true,opacity:0.86}); water=new THREE.Mesh(geo,mat); water.position.y=WATER_Y; scene.add(water); }

// ---- 真实模型资产：把 .glb 放进 docs/models/ 就会自动替换程序化树/石/灌木 ----
// 支持的文件名（存在哪个就用哪个，缺失自动回退到程序化）：
const ENV_MODELS={
  tree:['./models/tree1.glb','./models/tree2.glb','./models/tree3.glb','./models/tree.glb'],
  pine:['./models/pine1.glb','./models/pine2.glb','./models/pine.glb'],
  rock:['./models/rock1.glb','./models/rock2.glb','./models/rock.glb'],
  bush:['./models/bush1.glb','./models/bush.glb','./models/plant1.glb','./models/plant.glb'],
};
let envAssets={tree:[],pine:[],rock:[],bush:[]};
function loadEnvModels(){
  const loader=new GLTFLoader(); const jobs=[];
  for(const kind in ENV_MODELS){ ENV_MODELS[kind].forEach(url=>{
    jobs.push(new Promise(res=>{ loader.load(url, g=>{
      const box=new THREE.Box3().setFromObject(g.scene); const sz=box.getSize(new THREE.Vector3());
      g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material)o.material.envMapIntensity=0.7; } });
      envAssets[kind].push({scene:g.scene,h:sz.y||1}); res(true);
    }, undefined, ()=>res(false)); })); // 404 静默回退
  }); }
  return Promise.all(jobs);
}
function placeModel(kind,x,z,targetH){
  const list=envAssets[kind]; if(!list||!list.length) return false;
  const a=list[Math.floor(Math.random()*list.length)]; const m=a.scene.clone(true);
  const s=(targetH/(a.h||1))*(0.85+Math.random()*0.4); m.scale.setScalar(s);
  m.position.set(x,terrainH(x,z),z); m.rotation.y=Math.random()*6.28; scene.add(m);
  colliders.push({x,z,r:Math.max(0.6,targetH*0.12)}); return true;
}

function scatterWorld(){
  for(let i=0;i<480;i++){
    const a=Math.random()*6.28,d=15+Math.random()*(WORLD/2-24); const x=Math.cos(a)*d,z=Math.sin(a)*d;
    if(Math.hypot(x,z)<13)continue; const h=terrainH(x,z);
    if(h<WATER_Y+0.5){ if(h<WATER_Y-0.4){ if(Math.random()<0.5)makeLilyPad(x,z); } else makeReeds(x,z); continue; }
    if(h>16)continue;
    const r=Math.random();
    if(r<0.28){ if(!placeModel('tree',x,z,7) && !placeEzTree(x,z,7)) makeTree(x,z); }
    else if(r<0.46){ if(!placeModel('pine',x,z,8)&&!placeModel('tree',x,z,8)&&!placeEzTree(x,z,8.5)) makePine(x,z); }
    else if(r<0.60){ if(!placeModel('rock',x,z,1.8)) makeRock(x,z); }
    else if(r<0.73){ if(!placeModel('bush',x,z,1.4)) makeBush(x,z); }
    else if(r<0.84) makeFern(x,z);
    else if(r<0.92) makeMushroom(x,z);
    else makeLog(x,z);
  }
}
// 草地(实例化) — 大幅提升"茂密真实"感
function buildGrass(){
  const blade=new THREE.PlaneGeometry(0.14,0.9); blade.translate(0,0.45,0);
  const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,side:THREE.DoubleSide});
  const N=22000; const im=new THREE.InstancedMesh(blade,mat,N); const d=new THREE.Object3D(); const col=new THREE.Color(); let c=0;
  for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*360,z=(Math.random()-0.5)*360,h=terrainH(x,z); if(h>13||h<WATER_Y+0.2)continue;
    d.position.set(x,h,z); d.rotation.set((Math.random()-0.5)*0.35,Math.random()*6.28,(Math.random()-0.5)*0.35); const s=0.7+Math.random()*1.0; d.scale.set(s,s,s); d.updateMatrix(); im.setMatrixAt(c,d.matrix);
    col.setHSL(0.24+Math.random()*0.09,0.55,0.30+Math.random()*0.14); im.setColorAt(c,col); c++; }
  im.count=c; im.instanceMatrix.needsUpdate=true; if(im.instanceColor)im.instanceColor.needsUpdate=true; im.receiveShadow=true; scene.add(im);
}
function buildFlowers(){
  const cols=[0xff5a7a,0xffd23f,0xffffff,0xa66bff,0xff8f3f];
  for(let i=0;i<280;i++){ const x=(Math.random()-0.5)*330,z=(Math.random()-0.5)*330,h=terrainH(x,z); if(h>12||h<WATER_Y+0.2)continue;
    const g=new THREE.Group();
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.4,4),new THREE.MeshStandardMaterial({color:0x4a8a3a,roughness:1})); stem.position.y=0.2; g.add(stem);
    const cc=cols[i%cols.length]; const head=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8),new THREE.MeshStandardMaterial({color:cc,emissive:cc,emissiveIntensity:0.12,roughness:0.6})); head.position.y=0.44; g.add(head);
    g.position.set(x,h,z); scene.add(g); }
}


// ============================================================
//  怪物：真实动画 GLTF 模型 (RobotExpressive)
// ============================================================
const MODEL_URL='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
let monsterBase=null, baseScale=1;
let enemies=[];

function loadMonsterModel(){
  return new Promise(res=>{
    const loader=new GLTFLoader();
    loader.load(MODEL_URL, gltf=>{
      gltf.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material)o.material.envMapIntensity=0.8; } });
      const box=new THREE.Box3().setFromObject(gltf.scene); const sz=box.getSize(new THREE.Vector3());
      baseScale=2.0/(sz.y||2);
      monsterBase={scene:gltf.scene,animations:gltf.animations};
      res(true);
    }, undefined, err=>{ console.warn('模型加载失败，使用回退',err); monsterBase=null; res(false); });
  });
}
function findClip(anims,names){ for(const n of names){ const c=anims.find(a=>a.name===n); if(c)return c; } return anims[0]; }

function makeFallbackEnemy(color){
  const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({color,roughness:0.6,metalness:0.1});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.5,1.0,6,12),m); body.position.y=1.0; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.42,16,14),m); head.position.y=2.0; head.castShadow=true; g.add(head);
  return {group:g,anim:false};
}
function makeEnemyMesh(){
  if(monsterBase){
    const g=SkeletonUtils.clone(monsterBase.scene); g.scale.setScalar(baseScale);
    const mixer=new THREE.AnimationMixer(g);
    const A={};
    ['Idle','Walking','Running','Death','Punch','Jump'].forEach(n=>{ const c=findClip(monsterBase.animations,[n]); if(c)A[n]=mixer.clipAction(c); });
    return {group:g,anim:true,mixer,actions:A};
  }
  return makeFallbackEnemy(0x8899aa);
}
function playAction(e,name){
  if(!e.anim||!e.actions[name]||e.cur===name)return;
  const next=e.actions[name]; if(!next)return;
  if(name==='Death'){ next.setLoop(THREE.LoopOnce,1); next.clampWhenFinished=true; }
  next.reset().fadeIn(0.2).play();
  if(e.curAction) e.curAction.fadeOut(0.2);
  e.curAction=next; e.cur=name;
}
function spawnEnemy(){
  if(enemies.length>=8)return;
  const a=Math.random()*6.28,d=26+Math.random()*70; const x=player.x+Math.cos(a)*d,z=player.z+Math.sin(a)*d;
  if(Math.abs(x)>WORLD/2-4||Math.abs(z)>WORLD/2-4)return; if(Math.hypot(x,z)<16)return;
  const lvl=Math.max(1,Math.round(1+Math.hypot(x,z)/40));
  let variant='normal',sc=1,hpM=1,lootM=1; const r=Math.random();
  if(r<0.08){variant='boss';sc=1.7;hpM=4;lootM=3;} else if(r<0.26){variant='elite';sc=1.28;hpM=2;lootM=1.7;}
  const em=makeEnemyMesh(); const g=em.group; g.scale.multiplyScalar(sc);
  g.position.set(x,terrainH(x,z),z); scene.add(g);
  if(variant!=='normal'){ g.traverse(o=>{ if(o.isMesh&&o.material){ o.material=o.material.clone(); o.material.emissive=new THREE.Color(variant==='boss'?0xff2200:0xffaa00); o.material.emissiveIntensity=0.5; } }); }
  const hp=Math.round(40*Math.pow(1.25,lvl)*sc*hpM);
  const e={...em,variant,lvl,hp,maxHp:hp,atk:Math.round(6*Math.pow(1.18,lvl)*(variant==='boss'?1.5:1)),
    xp:Math.round(16*Math.pow(1.18,lvl)*(variant==='boss'?3:variant==='elite'?1.6:1)),
    gold:Math.round((3+lvl*2)*(variant==='boss'?4:1)),lootM,
    speed:2.2+Math.random()*1.0,state:'idle',wt:0,wdir:Math.random()*6.28,home:new THREE.Vector3(x,0,z),
    dead:false,deadT:0,name:(variant==='boss'?'⭐首领':variant==='elite'?'✦精英':'机械兽'),label:makeLabel(variant)};
  g.userData.eref=e; playAction(e,'Idle'); enemies.push(e);
}
function makeLabel(v){ const d=document.createElement('div'); d.className='mlabel'; d.innerHTML='<div class="mn"><span class="nm"></span> <span class="lv"></span></div><div class="hpb"><div></div></div>'; if(v!=='normal')d.querySelector('.mn').style.color=v==='boss'?'#ef4444':'#fbbf24'; $('labels').appendChild(d); return d; }
function removeEnemy(e,i){ scene.remove(e.group); if(e.label)e.label.remove(); enemies.splice(i,1); }

function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(e.mixer)e.mixer.update(dt);
    if(e.dead){ e.deadT-=dt; if(e.deadT<=0)removeEnemy(e,i); else updateLabel(e,true); continue; }
    const dx=player.x-e.group.position.x,dz=player.z-e.group.position.z,dist=Math.hypot(dx,dz);
    if(dist>150){ removeEnemy(e,i); continue; }
    if(dist<13){ // 追击
      const nx=dx/dist,nz=dz/dist;
      if(dist>2.3){ e.group.position.x+=nx*e.speed*dt; e.group.position.z+=nz*e.speed*dt; playAction(e, e.speed>2.8?'Running':'Walking'); }
      else { playAction(e,'Punch'); if(performance.now()-lastMobHit>1000){ lastMobHit=performance.now(); hitPlayer(e); } }
      e.group.rotation.y=Math.atan2(nx,nz);
    } else { // 游荡
      e.wt-=dt; if(e.wt<=0){ e.wdir=Math.random()*6.28; e.wt=2+Math.random()*3; e.moving=Math.random()<0.6; }
      if(e.moving){ const dxr=Math.cos(e.wdir),dzr=Math.sin(e.wdir); e.group.position.x+=dxr*e.speed*0.4*dt; e.group.position.z+=dzr*e.speed*0.4*dt; e.group.rotation.y=Math.atan2(dxr,dzr); playAction(e,'Walking'); }
      else playAction(e,'Idle');
    }
    e.group.position.y=terrainH(e.group.position.x,e.group.position.z);
    updateLabel(e,false);
  }
}
function updateLabel(e,dead){
  const v=new THREE.Vector3(e.group.position.x,e.group.position.y+2.6,e.group.position.z).project(camera);
  if(v.z>1||dead&&e.deadT<1||v.x<-1.1||v.x>1.1||v.y<-1.1||v.y>1.1){ e.label.style.display='none'; return; }
  e.label.style.display='block'; e.label.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; e.label.style.top=((-v.y*0.5+0.5)*innerHeight)+'px';
  e.label.querySelector('.nm').textContent=e.name; e.label.querySelector('.lv').textContent='Lv.'+e.lvl; e.label.querySelector('.hpb>div').style.width=Math.max(0,e.hp/e.maxHp*100)+'%';
}


// ============================================================
//  野生动物：真实动画模型（鸟群飞行 + 地面动物漫游）
// ============================================================
function loadWildlife(){
  const loader=new GLTFLoader(); const base='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/';
  const list=[
    {f:'Parrot.glb',   k:'bird',   n:8, t:4.0, sp:9},
    {f:'Flamingo.glb', k:'bird',   n:5, t:5.0, sp:7},
    {f:'Stork.glb',    k:'bird',   n:4, t:4.5, sp:10},
    {f:'Horse.glb',    k:'ground', n:6, t:3.0, sp:2.6},
  ];
  return Promise.all(list.map(item=>new Promise(res=>{
    loader.load(base+item.f, gltf=>{
      const box=new THREE.Box3().setFromObject(gltf.scene); const sz=box.getSize(new THREE.Vector3());
      const scale=item.t/Math.max(sz.x,sz.y,sz.z,0.001);
      gltf.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=item.k==='ground'; o.frustumCulled=false; } });
      for(let i=0;i<item.n;i++) spawnWild(gltf,scale,item.k,item.sp);
      res(true);
    }, undefined, ()=>{ console.warn('野生动物加载失败:',item.f); res(false); });
  })));
}
function spawnWild(gltf,scale,kind,sp){
  const g=SkeletonUtils.clone(gltf.scene); g.scale.setScalar(scale);
  const mixer=new THREE.AnimationMixer(g); if(gltf.animations&&gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  const w={group:g,mixer,kind,speed:sp};
  if(kind==='bird'){ w.cx=(Math.random()-0.5)*WORLD*0.7; w.cz=(Math.random()-0.5)*WORLD*0.7; w.rad=25+Math.random()*55; w.h=22+Math.random()*30; w.ang=Math.random()*6.28; }
  else { const x=(Math.random()-0.5)*WORLD*0.6,z=(Math.random()-0.5)*WORLD*0.6; g.position.set(x,terrainH(x,z),z); w.wt=0; w.wdir=Math.random()*6.28; w.moving=true; }
  scene.add(g); wildlife.push(w);
}
function updateWildlife(dt){
  for(const w of wildlife){ if(w.mixer)w.mixer.update(dt);
    if(w.kind==='bird'){ w.ang+=w.speed/w.rad*dt; const x=w.cx+Math.cos(w.ang)*w.rad,z=w.cz+Math.sin(w.ang)*w.rad,y=w.h+Math.sin(w.ang*2)*2.5; w.group.position.set(x,y,z); w.group.rotation.y=-w.ang; }
    else { w.wt-=dt; if(w.wt<=0){ w.wdir=Math.random()*6.28; w.wt=3+Math.random()*4; w.moving=Math.random()<0.7; }
      const dx=w.group.position.x-player.x,dz=w.group.position.z-player.z,pd=Math.hypot(dx,dz); let s=w.speed*0.4;
      if(pd<15){ w.wdir=Math.atan2(dz,dx); s=w.speed*1.8; w.moving=true; }
      if(w.moving){ const nx=Math.cos(w.wdir),nz=Math.sin(w.wdir); w.group.position.x=clamp(w.group.position.x+nx*s*dt,-WORLD/2+3,WORLD/2-3); w.group.position.z=clamp(w.group.position.z+nz*s*dt,-WORLD/2+3,WORLD/2-3); w.group.rotation.y=Math.atan2(nx,nz); }
      w.group.position.y=terrainH(w.group.position.x,w.group.position.z); }
  }
}

// ============================================================
//  第一人称武器视图（PBR 金属）
// ============================================================
let vmGroup,vmArm,vmSwing=0;
function buildViewModel(){
  vmGroup=new THREE.Group(); camera.add(vmGroup); scene.add(camera);
  vmArm=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0xd8dde6,metalness:0.95,roughness:0.22});
  const gold=new THREE.MeshStandardMaterial({color:0xd9a441,metalness:1.0,roughness:0.3});
  const grip=new THREE.MeshStandardMaterial({color:0x3a2416,metalness:0.1,roughness:0.9});
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.26,10),grip); handle.rotation.x=Math.PI/2; handle.position.set(0,0,-0.7); vmArm.add(handle);
  const pommel=new THREE.Mesh(new THREE.SphereGeometry(0.05,12,12),gold); pommel.position.set(0,0,-0.83); vmArm.add(pommel);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.06,0.08),gold); guard.position.set(0,0,-0.56); vmArm.add(guard);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.02,0.85),steel); blade.position.set(0,0,-1.0); vmArm.add(blade);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,4),steel); tip.rotation.x=-Math.PI/2; tip.position.set(0,0,-1.5); vmArm.add(tip);
  vmArm.position.set(0.28,-0.26,-0.25); vmArm.rotation.set(0.06,-0.12,0.05);
  vmGroup.add(vmArm);
}

// ============================================================
//  控制 / 相机
// ============================================================
function look(mx,my){ player.yaw-=mx*0.0022; player.pitch=clamp(player.pitch-my*0.0022,-1.45,1.45); }
function requestLock(){ const c=$('game-canvas'); if(c.requestPointerLock)c.requestPointerLock(); }
function addControls(){
  addEventListener('keydown',e=>{ keys[e.code]=true; });
  addEventListener('keyup',e=>{ keys[e.code]=false; });
  const canvas=$('game-canvas');
  canvas.addEventListener('mousedown',e=>{ if(!started)return; if(e.button===0)attack(); if(!pointerLocked)requestLock(); });
  addEventListener('mousemove',e=>{ if(!started||paused)return;
    if(pointerLocked){ look(e.movementX,e.movementY); }
    else { const dx=clamp(e.clientX-lastMX,-60,60),dy=clamp(e.clientY-lastMY,-60,60); look(dx,dy); lastMX=e.clientX; lastMY=e.clientY; }
  });
  document.addEventListener('pointerlockchange',()=>{ pointerLocked=!!document.pointerLockElement; paused=!pointerLocked; if(!pointerLocked)$('hint').textContent='点击画面继续（ESC 释放鼠标）'; else $('hint').textContent='WASD 移动 · 鼠标 转视角 · 左键 攻击 · 空格 跳'; });
  $('start').addEventListener('click',startGame);
}

function updatePlayer(dt){
  if(paused)return;
  const spd=(keys['ShiftLeft']?9:5.5);
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
  let mx=0,mz=0;
  if(keys['KeyW']){mx+=fx;mz+=fz;} if(keys['KeyS']){mx-=fx;mz-=fz;} if(keys['KeyD']){mx+=rx;mz+=rz;} if(keys['KeyA']){mx-=rx;mz-=rz;}
  const ml=Math.hypot(mx,mz); if(ml>0){ mx/=ml;mz/=ml; player.x+=mx*spd*dt; player.z+=mz*spd*dt; }
  // 碰撞
  for(let i=0;i<colliders.length;i++){ const c=colliders[i]; const dx=player.x-c.x; if(dx>5||dx<-5)continue; const dz=player.z-c.z; if(dz>5||dz<-5)continue; const d=Math.hypot(dx,dz),min=c.r+PR; if(d<min&&d>0.001){ const p=(min-d)/d; player.x+=dx*p; player.z+=dz*p; } }
  player.x=clamp(player.x,-WORLD/2+2,WORLD/2-2); player.z=clamp(player.z,-WORLD/2+2,WORLD/2-2);
  // 地形贴合 + 跳跃
  const gY=terrainH(player.x,player.z)+player.eye;
  if(keys['Space']&&player.onGround){ player.vy=6.4; player.onGround=false; }
  player.vy-=19*dt; player.y+=player.vy*dt;
  if(player.y<=gY){ player.y=gY; player.vy=0; player.onGround=true; }
  camera.position.set(player.x,player.y,player.z);
  const dir=new THREE.Vector3(-Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch));
  camera.lookAt(camera.position.clone().add(dir));
  if(G.hp<G.maxHp) G.hp=Math.min(G.maxHp,G.hp+3*dt);
}


// ============================================================
//  战斗 / 成长
// ============================================================
function findEnemyFromObj(o){ while(o){ if(o.userData&&o.userData.eref)return o.userData.eref; o=o.parent; } return null; }
function attack(){
  const cd=380; if(performance.now()-lastAttack<cd)return; lastAttack=performance.now(); vmSwing=1;
  const cr=$('crosshair'); cr.style.transform='translate(-50%,-50%) scale(1.7)'; setTimeout(()=>cr.style.transform='translate(-50%,-50%) scale(1)',90);
  raycaster.setFromCamera({x:0,y:0},camera);
  const live=enemies.filter(e=>!e.dead);
  let target=null,hd=Infinity;
  const hits=raycaster.intersectObjects(live.map(e=>e.group),true);
  if(hits.length){ target=findEnemyFromObj(hits[0].object); hd=hits[0].distance; }
  if(!target){ let best=Infinity; live.forEach(e=>{ const d=Math.hypot(player.x-e.group.position.x,player.z-e.group.position.z); if(d<3.6&&d<best){best=d;target=e;hd=d;} }); }
  if(!target||hd>7)return;
  const gap=G.level-target.lvl, mul=clamp(1+gap*0.06,0.2,2);
  const crit=Math.random()<0.2; let dmg=G.atk*(0.85+Math.random()*0.3)*mul; if(crit)dmg*=2; dmg=Math.max(1,Math.round(dmg));
  target.hp-=dmg; floatDmg(dmg,crit,target.group.position);
  if(target.hp<=0) killEnemy(target);
}
function killEnemy(e){
  e.dead=true; e.deadT=2.0; if(e.label)e.label.style.display='none';
  if(e.anim){ playAction(e,'Death'); } else { e.group.rotation.z=Math.PI/2; }
  G.kills++; G.gold+=e.gold; gainXp(e.xp);
  if(Math.random()<0.5+ (e.lootM-1)*0.2) toast(`击败 ${e.name}！+${e.xp} XP · +${e.gold} 🪙 · 掉落装备`);
  else toast(`击败 ${e.name}！+${e.xp} XP · +${e.gold} 🪙`);
  updateHUD();
}
function hitPlayer(e){
  const gap=G.level-e.lvl, mul=clamp(1-gap*0.05,0.3,2.4);
  const dmg=Math.max(1,Math.round((e.atk-G.def*0.5)*mul)); G.hp-=dmg; hurtDmg(dmg); flash();
  if(G.hp<=0){ G.hp=G.maxHp; player.x=0; player.z=6; player.vy=0; G.gold=Math.floor(G.gold*0.85); toast('💀 你被击败了，在出生点复活'); }
  updateHUD();
}
function gainXp(a){ G.xp+=a; while(G.xp>=xpNeed(G.level)){ G.xp-=xpNeed(G.level); G.level++; G.maxHp+=18; G.atk+=3; G.def+=1; G.hp=G.maxHp; toast(`🎉 升级到 Lv.${G.level}！攻击/防御/生命提升`); } updateHUD(); }

// 特效
function floatDmg(d,crit,pos){ const v=new THREE.Vector3(pos.x,pos.y+2.4,pos.z).project(camera); if(v.z>1)return; const el=document.createElement('div'); el.className='dn'+(crit?' crit':''); el.textContent=(crit?'暴击 ':'')+d; el.style.left=((v.x*.5+.5)*innerWidth)+'px'; el.style.top=((-v.y*.5+.5)*innerHeight)+'px'; $('dmg').appendChild(el); setTimeout(()=>el.remove(),1000); }
function hurtDmg(d){ const el=document.createElement('div'); el.className='dn hurt'; el.textContent='-'+d; el.style.left=(innerWidth/2+(Math.random()-.5)*80)+'px'; el.style.top=(innerHeight/2+60)+'px'; $('dmg').appendChild(el); setTimeout(()=>el.remove(),1000); }
let flashT=0; function flash(){ flashT=0.4; }
let toastTimer; function toast(t){ const el=$('toast'); el.textContent=t; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add('hidden'),2600); }

// HUD
function updateHUD(){
  $('lvl').textContent=G.level; $('hpf').style.width=clamp(G.hp/G.maxHp*100,0,100)+'%'; $('hpt').textContent=Math.max(0,Math.round(G.hp))+'/'+G.maxHp;
  const need=xpNeed(G.level); $('xpf').style.width=(G.xp/need*100)+'%'; $('xpt').textContent=G.xp+'/'+need;
  $('atk').textContent=G.atk; $('def').textContent=G.def; $('gold').textContent=G.gold;
  const t=Math.floor(Math.hypot(player.x,player.z)/60)+1; $('zone').textContent='🌍 旷野 · 危险T'+t;
}

// ============================================================
//  昼夜
// ============================================================
function updateDayNight(dt){
  gameTime=(gameTime+dt*0.5)%1440;
  const hh=String(Math.floor(gameTime/60)).padStart(2,'0'),mm=String(Math.floor(gameTime%60)).padStart(2,'0'); $('clock').textContent='🕐 '+hh+':'+mm;
  if(hdriLoaded){
    // 真实 HDRI 天空：固定明亮日照，但让阴影相机跟随玩家
    sun.position.set(player.x+70,150,player.z+45); sun.target.position.set(player.x,0,player.z);
    stars.material.opacity=0;
    return;
  }
  const f=gameTime/1440;
  const elev=Math.sin((f-0.25)*Math.PI*2), day=clamp(elev*1.6+0.4,0,1);
  const phi=THREE.MathUtils.degToRad(90-elev*90), theta=(f-0.25)*Math.PI*2;
  const sd=new THREE.Vector3().setFromSphericalCoords(1,phi,theta);
  if(sky) sky.material.uniforms.sunPosition.value.copy(sd);
  sun.position.set(player.x+sd.x*200,sd.y*200,player.z+sd.z*200); sun.target.position.set(player.x,0,player.z);
  sun.intensity=0.08+Math.max(0,elev)*2.9; hemi.intensity=0.14+day*0.55;
  renderer.toneMappingExposure=0.22+day*0.4;
  const dusk=clamp(1-Math.abs(elev)*3,0,1);
  const fday=new THREE.Color(0xbcd4ee),fnight=new THREE.Color(0x0a0f22),fdusk=new THREE.Color(0xdb8a52);
  scene.fog.color.copy(fnight.clone().lerp(fday,day).lerp(fdusk,dusk*0.45));
  stars.material.opacity=clamp(1-day*1.9,0,1); stars.position.set(player.x,0,player.z);
}

// ============================================================
//  主循环 / 启动
// ============================================================
let spawnT=0;
function animate(){
  requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),0.05);
  updateDayNight(dt); updateWildlife(dt);
  if(vmSwing>0){ vmSwing-=dt*4; if(vmArm)vmArm.rotation.x=0.06-Math.sin(Math.max(0,vmSwing)*Math.PI)*1.2; } else if(vmArm)vmArm.rotation.x=0.06;
  if(started&&!paused){
    updatePlayer(dt); updateEnemies(dt);
    spawnT+=dt; if(spawnT>1.4){ spawnT=0; spawnEnemy(); }
    if(flashT>0){ flashT-=dt; document.body.style.boxShadow=`inset 0 0 ${160*flashT}px rgba(239,68,68,${flashT})`; } else document.body.style.boxShadow='none';
  } else { enemies.forEach(e=>{ if(e.mixer)e.mixer.update(dt); updateLabel(e,e.dead); }); }
  composer.render();
}
function startGame(){ $('start').classList.add('hidden'); $('hud').classList.remove('hidden'); started=true; paused=false; player.y=terrainH(player.x,player.z)+player.eye; updateHUD(); requestLock(); }

async function boot(){
  const bar=$('lbar'),txt=$('ltext');
  try{
    txt.textContent='初始化渲染引擎...'; bar.style.width='16%'; initRenderer();
    txt.textContent='加载真实天空与光照(HDRI)...'; bar.style.width='28%'; await loadHDRI();
    txt.textContent='加载真实地面材质(PBR)...'; bar.style.width='40%'; await loadGroundTextures();
    bar.style.width='46%'; buildTerrain(); buildWater(); buildViewModel(); addControls();
    txt.textContent='加载真实树木/模型...'; bar.style.width='56%'; await loadEnvModels(); await loadTreeLib(); buildTreeTemplates();
    txt.textContent='生成世界...'; bar.style.width='64%'; scatterWorld(); buildGrass(); buildFlowers();
    animate();
    txt.textContent='加载怪物模型...'; bar.style.width='72%';
    await loadMonsterModel();
    txt.textContent='召唤野生动物...'; bar.style.width='88%';
    await loadWildlife();
    bar.style.width='100%'; txt.textContent='准备就绪！';
    setTimeout(()=>{ $('loading').classList.add('hidden'); $('start').classList.remove('hidden'); },400);
  }catch(err){ txt.textContent='出错: '+err.message; console.error(err); }
}
boot();
