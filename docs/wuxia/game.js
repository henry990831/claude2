// ================= 水墨江湖 · 单机武侠 RPG =================
// 纯网页 canvas，无依赖。水墨风：宣纸底 + 毛笔笔触 + 朱砂/竹青点缀。

// ---------------- 画布 / 基础 ----------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
let VW = 0, VH = 0;
function resize() {
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = VW * DPR; canvas.height = VH * DPR;
  canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  mini.width = 150 * DPR; mini.height = 150 * DPR; mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const nowT = () => performance.now() / 1000;
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function hash2(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const tl = hash2(xi, yi), tr = hash2(xi + 1, yi), bl = hash2(xi, yi + 1), br = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 6.283185; while (d < -Math.PI) d += 6.283185; return d; }

// ---------------- 世界常量 ----------------
const TILE = 64, MAP_W = 64, MAP_H = 48;
const WORLD_W = TILE * MAP_W, WORLD_H = TILE * MAP_H;
const TOWN = { x: WORLD_W / 2, y: WORLD_H / 2, r: 340 };
const tiles = new Uint8Array(MAP_W * MAP_H); // 0草 1路 2水 3石

function genWorld() {
  const cx = Math.round(MAP_W / 2), cy = Math.round(MAP_H / 2);
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    let t = 0;
    const n = noise(tx * 0.14, ty * 0.14);
    const river = Math.abs(ty - (MAP_H * 0.3 + Math.sin(tx * 0.28) * 4));
    if (river < 1.5) t = 2;
    if (n > 0.73) t = 3;
    if (Math.abs(tx - cx) <= 1 || Math.abs(ty - cy) <= 1) { if (t !== 2) t = 1; }
    tiles[ty * MAP_W + tx] = t;
  }
}
function tileAt(x, y) {
  const tx = clamp(Math.floor(x / TILE), 0, MAP_W - 1), ty = clamp(Math.floor(y / TILE), 0, MAP_H - 1);
  return tiles[ty * MAP_W + tx];
}

// ---------------- 景物 ----------------
const scenery = [];
function genScenery() {
  scenery.push({ type: 'pavilion', x: TOWN.x, y: TOWN.y - 30, r: 60, scale: 1.1, seed: 1 });
  scenery.push({ type: 'tablet', x: TOWN.x + 110, y: TOWN.y + 80, r: 20, scale: 1, seed: 2 });
  let tries = 0;
  while (scenery.length < 240 && tries < 5000) {
    tries++;
    const x = rand(70, WORLD_W - 70), y = rand(70, WORLD_H - 70);
    if (dist(x, y, TOWN.x, TOWN.y) < TOWN.r) continue;
    if (tileAt(x, y) === 2) continue;
    const t = Math.random();
    const type = t < 0.5 ? 'bamboo' : t < 0.8 ? 'pine' : 'rock';
    const r = type === 'rock' ? rand(18, 30) : type === 'pine' ? 22 : 16;
    scenery.push({ type, x, y, r, scale: rand(0.8, 1.4), seed: Math.random() * 1000 });
  }
}
function blocked(x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (tileAt(x, y) === 2) return true;
  for (const s of scenery) {
    if (s.type === 'bamboo') continue;
    if (dist(x, y, s.x, s.y) < s.r * 0.55 + r) return true;
  }
  return false;
}

// ---------------- 物品 ----------------
const WEAPONS = [
  { n: '木剑', atk: 2 }, { n: '铁剑', atk: 5 }, { n: '青锋剑', atk: 9 },
  { n: '湛卢剑', atk: 14 }, { n: '龙泉剑', atk: 20 }, { n: '倚天剑', atk: 28 }
];
const ARMORS = [
  { n: '布衣', def: 1, hp: 8 }, { n: '皮甲', def: 3, hp: 20 }, { n: '锁子甲', def: 6, hp: 40 },
  { n: '玄铁甲', def: 10, hp: 70 }, { n: '金丝软甲', def: 15, hp: 110 }
];
const POTIONS = {
  jinchuang: { n: '金创药', icon: '🧪', heal: 'hp', pct: 0.55, price: 20 },
  huiqi: { n: '回气丹', icon: '💊', heal: 'mp', pct: 0.6, price: 20 },
  dahuan: { n: '大还丹', icon: '🔴', heal: 'both', pct: 1, price: 80 }
};
const QUAL = [
  { k: 'fan', n: '凡品', mult: 1, cls: 'q-fan', col: '#9a9083' },
  { k: 'fine', n: '精良', mult: 1.25, cls: 'q-fine', col: '#4f7d63' },
  { k: 'rare', n: '稀有', mult: 1.6, cls: 'q-rare', col: '#3f6ea8' },
  { k: 'epic', n: '绝世', mult: 2.2, cls: 'q-epic', col: '#b8893f' }
];
function rollQuality() { const r = Math.random(); if (r > 0.965) return QUAL[3]; if (r > 0.86) return QUAL[2]; if (r > 0.6) return QUAL[1]; return QUAL[0]; }
function makeWeapon(level) {
  const tier = clamp(Math.floor(level / 3) + randi(0, 1), 0, WEAPONS.length - 1);
  const base = WEAPONS[tier], q = rollQuality();
  return { kind: 'weapon', name: q.n + base.n, icon: '🗡️', qual: q, atk: Math.round(base.atk * q.mult), tier };
}
function makeArmor(level) {
  const tier = clamp(Math.floor(level / 3) + randi(0, 1), 0, ARMORS.length - 1);
  const base = ARMORS[tier], q = rollQuality();
  return { kind: 'armor', name: q.n + base.n, icon: '🥋', qual: q, def: Math.round(base.def * q.mult), hp: Math.round(base.hp * q.mult), tier };
}
function makePotion() { const id = pick(Object.keys(POTIONS)); const p = POTIONS[id]; return { kind: 'potion', name: p.n, icon: p.icon, potId: id, count: 1 }; }

// ---------------- 玩家 ----------------
const player = {
  x: TOWN.x, y: TOWN.y + 120, facing: -Math.PI / 2, r: 15, speed: 214,
  level: 1, exp: 0, coins: 0, hp: 100, mp: 32,
  weapon: null, armor: null, inv: [],
  atkCd: 0, hurtT: 0, invuln: 0, bobT: 0, moving: false, dead: false,
  cd: [0, 0, 0]
};
const maxHP = () => Math.round(70 + (player.level - 1) * 16 + (player.armor ? player.armor.hp : 0));
const maxMP = () => Math.round(32 + (player.level - 1) * 7);
const atkStat = () => Math.round(9 + (player.level - 1) * 2.2 + (player.weapon ? player.weapon.atk : 0));
const defStat = () => Math.round(2 + (player.level - 1) * 1.2 + (player.armor ? player.armor.def : 0));
const expToNext = () => Math.floor(60 * Math.pow(player.level, 1.45));
const inTown = () => dist(player.x, player.y, TOWN.x, TOWN.y) < TOWN.r;

// ---------------- 技能 ----------------
const SKILLS = [
  { name: '剑气斩', icon: '⚔️', key: '1', mp: 8, cd: 0.9 },
  { name: '掌风', icon: '🌀', key: '2', mp: 18, cd: 3.5 },
  { name: '踏雪', icon: '💨', key: '3', mp: 10, cd: 2.2 }
];

// ---------------- 怪物 ----------------
const ENEMY_TYPES = {
  wolf: { name: '野狼', hp: 34, atk: 7, def: 0, spd: 158, aggro: 300, atkRange: 44, atkCd: 1.0, exp: 14, coin: [3, 9], r: 15, robe: '#7a6446', big: 0.9, dropW: 0.05, dropA: 0.05, dropP: 0.14 },
  bandit: { name: '山贼', hp: 62, atk: 12, def: 2, spd: 122, aggro: 340, atkRange: 48, atkCd: 1.2, exp: 27, coin: [6, 16], r: 17, robe: '#4a4650', big: 1.0, dropW: 0.12, dropA: 0.12, dropP: 0.16 },
  bear: { name: '黑熊', hp: 170, atk: 22, def: 5, spd: 96, aggro: 300, atkRange: 60, atkCd: 1.6, exp: 72, coin: [20, 42], r: 24, robe: '#2f2a26', big: 1.5, dropW: 0.28, dropA: 0.28, dropP: 0.3 }
};
const enemies = [];
const spawnZones = [];
function genSpawns() {
  const defs = [
    { type: 'wolf', lv: 1, n: 3, count: 5 }, { type: 'wolf', lv: 2, n: 3, count: 4 },
    { type: 'bandit', lv: 3, n: 3, count: 5 }, { type: 'bandit', lv: 5, n: 2, count: 4 },
    { type: 'bear', lv: 6, n: 2, count: 2 }, { type: 'bear', lv: 8, n: 1, count: 2 }
  ];
  for (const d of defs) for (let i = 0; i < d.count; i++) {
    let x, y, tries = 0;
    do { x = rand(120, WORLD_W - 120); y = rand(120, WORLD_H - 120); tries++; }
    while ((dist(x, y, TOWN.x, TOWN.y) < TOWN.r + 160 || tileAt(x, y) === 2) && tries < 60);
    spawnZones.push({ x, y, type: d.type, lv: d.lv, max: d.n, timer: rand(0, 2) });
  }
}
function spawnEnemy(zone) {
  const base = ENEMY_TYPES[zone.type], lv = zone.lv, sc = 1 + (lv - 1) * 0.16;
  enemies.push({
    type: zone.type, name: base.name, lv, zone,
    x: zone.x + rand(-90, 90), y: zone.y + rand(-90, 90),
    hp: Math.round(base.hp * sc), maxhp: Math.round(base.hp * sc),
    atk: Math.round(base.atk * sc), def: base.def + Math.floor(lv / 2),
    spd: base.spd, aggro: base.aggro, atkRange: base.atkRange, atkCdMax: base.atkCd,
    exp: Math.round(base.exp * sc), r: base.r, robe: base.robe, big: base.big,
    state: 'idle', atkCd: 0, hurtT: 0, wanderT: 0, wx: 0, wy: 0, facing: 0, bobT: Math.random() * 6, dead: false, deadT: 0, base
  });
}

// ---------------- 特效 / 掉落 ----------------
const particles = [], floats = [], slashes = [], projectiles = [], rings = [], drops = [];
function addFloat(x, y, txt, col, size) { floats.push({ x, y, txt, col, size: size || 16, t: 0, life: 1.0 }); }
function inkBurst(x, y, n, col, spd) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(spd * 0.3, spd); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rand(0, 40), r: rand(2, 6), col: col || '#2b2620', t: 0, life: rand(0.4, 0.9) }); }
}
function spawnDrop(x, y, item) { drops.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), item, t: 0 }); }

// ---------------- 输入 ----------------
const keys = {};
const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  onKey(k);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { mouse.down = true; doBasic(); }
  if (e.button === 2) mouse.rdown = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rdown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
// 触屏：拖动移动 + 靠近自动出招
canvas.addEventListener('touchstart', e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; mouse.rdown = true; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', e => { mouse.rdown = false; e.preventDefault(); }, { passive: false });

function onKey(k) {
  if (!gameStarted) return;
  if (k === 'b' || k === 'i') { togglePanel('inv'); return; }
  if (k === 'c') { togglePanel('char'); return; }
  if (k === 'escape') { if (panelOpen) closePanel(); return; }
  if (paused || player.dead) return;
  if (k === '1') useSkill(0);
  else if (k === '2') useSkill(1);
  else if (k === '3' || k === ' ') useSkill(2);
  else if (k === 'j') doBasic();
}

// ---------------- 相机 ----------------
const cam = { x: 0, y: 0 };
function updateCam() {
  cam.x = WORLD_W < VW ? (WORLD_W - VW) / 2 : clamp(player.x - VW / 2, 0, WORLD_W - VW);
  cam.y = WORLD_H < VH ? (WORLD_H - VH) / 2 : clamp(player.y - VH / 2, 0, WORLD_H - VH);
}
function mouseWorld() { mouse.wx = mouse.x + cam.x; mouse.wy = mouse.y + cam.y; }

// ---------------- 战斗 ----------------
function doBasic(ang) {
  if (!gameStarted || paused || player.dead || player.atkCd > 0) return;
  player.atkCd = 0.42;
  if (ang == null) ang = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);
  player.facing = ang;
  slashes.push({ x: player.x, y: player.y, ang, t: 0, life: 0.22, range: 84, arc: 1.0 });
  const base = atkStat();
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, player.x, player.y);
    if (d < 88 + e.r) { const ea = Math.atan2(e.y - player.y, e.x - player.x); if (Math.abs(angDiff(ea, ang)) < 1.0) hitEnemy(e, base * rand(0.9, 1.15)); }
  }
  Sfx.swing();
}
function hitEnemy(e, raw) {
  const dmg = Math.max(1, Math.round(raw - e.def * 0.6));
  const crit = chance(0.12), fin = crit ? Math.round(dmg * 1.6) : dmg;
  e.hp -= fin; e.hurtT = 0.15; e.state = 'chase';
  addFloat(e.x, e.y - e.r - 10, (crit ? '✦' : '') + fin, crit ? '#c94236' : '#2b2620', crit ? 20 : 16);
  inkBurst(e.x, e.y, crit ? 10 : 6, '#3a332b', crit ? 220 : 150);
  Sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; e.deadT = 0;
  gainExp(e.exp);
  player.coins += randi(e.base.coin[0], e.base.coin[1]);
  addFloat(e.x, e.y - e.r, '+' + e.exp + ' 经验', '#b8893f', 13);
  inkBurst(e.x, e.y, 16, '#2b2620', 200);
  if (chance(e.base.dropW)) spawnDrop(e.x, e.y, makeWeapon(e.lv));
  else if (chance(e.base.dropA)) spawnDrop(e.x, e.y, makeArmor(e.lv));
  if (chance(e.base.dropP)) spawnDrop(e.x, e.y, makePotion());
  msg('击败 ' + e.name + ' Lv.' + e.lv, 'good');
  save();
}
function hurtPlayer(atk) {
  if (player.invuln > 0 || player.dead) return;
  const dmg = Math.max(1, Math.round(atk - defStat() * 0.5));
  player.hp -= dmg; player.hurtT = 0.18; player.invuln = 0.25;
  addFloat(player.x, player.y - 30, '-' + dmg, '#c94236', 16);
  inkBurst(player.x, player.y, 6, '#8a2b23', 140);
  Sfx.hurt();
  if (player.hp <= 0) { player.hp = 0; die(); }
}
function gainExp(n) { player.exp += n; while (player.exp >= expToNext()) { player.exp -= expToNext(); levelUp(); } }
function levelUp() {
  player.level++; player.hp = maxHP(); player.mp = maxMP();
  msg('✦ 突破！境界提升至 Lv.' + player.level, 'good');
  addFloat(player.x, player.y - 44, 'LEVEL UP!', '#b8893f', 22);
  rings.push({ x: player.x, y: player.y, t: 0, life: 0.7, rmax: 120, col: '#b8893f' });
  Sfx.level();
}

// ---------------- 技能施放 ----------------
function useSkill(i) {
  if (paused || player.dead) return;
  const s = SKILLS[i];
  if (player.cd[i] > 0) return;
  if (player.mp < s.mp) { msg('内力不足', 'warn'); return; }
  player.mp -= s.mp; player.cd[i] = s.cd;
  if (i === 0) castSword(); else if (i === 1) castPalm(); else castDash();
  Sfx.skill();
}
function castSword() {
  const ang = Math.atan2(mouse.wy - player.y, mouse.wx - player.x); player.facing = ang;
  projectiles.push({ x: player.x, y: player.y, vx: Math.cos(ang) * 660, vy: Math.sin(ang) * 660, ang, t: 0, life: 0.85, dmg: atkStat() * 1.7, hits: new Set(), pierce: 3, r: 15 });
  inkBurst(player.x, player.y, 6, '#2b2620', 120);
}
function castPalm() {
  rings.push({ x: player.x, y: player.y, t: 0, life: 0.45, rmax: 170, col: '#2b2620' });
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, player.x, player.y);
    if (d < 180 + e.r) { hitEnemy(e, atkStat() * 2.4); const a = Math.atan2(e.y - player.y, e.x - player.x); e.x += Math.cos(a) * 42; e.y += Math.sin(a) * 42; }
  }
  inkBurst(player.x, player.y, 22, '#2b2620', 260);
}
function castDash() {
  const mv = moveDir(); const ang = mv ? Math.atan2(mv.y, mv.x) : player.facing;
  const dx = Math.cos(ang) * 240, dy = Math.sin(ang) * 240;
  for (let i = 1; i <= 10; i++) { const nx = player.x + dx * i / 10, ny = player.y + dy * i / 10; if (!blocked(nx, ny, player.r)) { player.x = nx; player.y = ny; } else break; }
  player.invuln = 0.4; player.facing = ang;
  for (let i = 0; i < 6; i++) particles.push({ x: player.x - dx * i / 9, y: player.y - dy * i / 9, vx: 0, vy: 0, r: 9 - i, col: 'rgba(43,38,32,0.22)', t: 0, life: 0.4 });
}

// ---------------- 更新 ----------------
function moveDir() {
  let x = 0, y = 0;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (x || y) return { x, y };
  if (mouse.rdown && dist(mouse.wx, mouse.wy, player.x, player.y) > 24) { const a = Math.atan2(mouse.wy - player.y, mouse.wx - player.x); return { x: Math.cos(a), y: Math.sin(a) }; }
  return null;
}
function updatePlayer(dt) {
  if (player.dead) return;
  if (player.atkCd > 0) player.atkCd -= dt;
  if (player.hurtT > 0) player.hurtT -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  for (let i = 0; i < 3; i++) if (player.cd[i] > 0) player.cd[i] -= dt;
  player.hp = Math.min(maxHP(), player.hp + (inTown() ? 20 : 3) * dt);
  player.mp = Math.min(maxMP(), player.mp + (inTown() ? 12 : 4.5) * dt);
  const mv = moveDir(); player.moving = !!mv;
  if (mv) {
    const len = Math.hypot(mv.x, mv.y) || 1, nx = mv.x / len, ny = mv.y / len, step = player.speed * dt;
    player.facing = Math.atan2(ny, nx);
    if (!blocked(player.x + nx * step, player.y, player.r)) player.x += nx * step;
    if (!blocked(player.x, player.y + ny * step, player.r)) player.y += ny * step;
    player.bobT += dt * 10;
  }
  // 自动普攻最近的敌人（方便手机/新手）
  if (player.atkCd <= 0) {
    let near = null, nd = 94;
    for (const e of enemies) { if (e.dead) continue; const d = dist(e.x, e.y, player.x, player.y); if (d < nd + e.r) { nd = d; near = e; } }
    if (near) doBasic(Math.atan2(near.y - player.y, near.x - player.x));
  }
  // 拾取
  for (const dp of drops) { if (dp.picked) continue; if (dist(dp.x, dp.y, player.x, player.y) < 36) pickup(dp); }
}
function moveEnemy(e, dx, dy) { if (!blocked(e.x + dx, e.y, e.r)) e.x += dx; if (!blocked(e.x, e.y + dy, e.r)) e.y += dy; }
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    e.bobT += dt; if (e.hurtT > 0) e.hurtT -= dt; if (e.atkCd > 0) e.atkCd -= dt;
    const d = dist(e.x, e.y, player.x, player.y);
    if (!player.dead && d < e.aggro) e.state = 'chase';
    else if (e.state === 'chase' && d > e.aggro * 1.6) e.state = 'idle';
    if (e.state === 'chase' && !player.dead) {
      if (d > e.atkRange) { const a = Math.atan2(player.y - e.y, player.x - e.x); e.facing = a; moveEnemy(e, Math.cos(a) * e.spd * dt, Math.sin(a) * e.spd * dt); }
      else if (e.atkCd <= 0) {
        e.atkCd = e.atkCdMax; e.facing = Math.atan2(player.y - e.y, player.x - e.x);
        slashes.push({ x: e.x, y: e.y, ang: e.facing, t: 0, life: 0.2, range: e.atkRange + 20, arc: 0.9, enemy: true });
        if (dist(e.x, e.y, player.x, player.y) < e.atkRange + 24) hurtPlayer(e.atk);
      }
    } else {
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(1.5, 3.5); const a = Math.random() * 6.28; e.wx = Math.cos(a); e.wy = Math.sin(a); if (chance(0.4)) { e.wx = 0; e.wy = 0; } }
      if (e.wx || e.wy) e.facing = Math.atan2(e.wy, e.wx);
      moveEnemy(e, e.wx * e.spd * 0.4 * dt, e.wy * e.spd * 0.4 * dt);
      if (dist(e.x, e.y, e.zone.x, e.zone.y) > 270) { const a = Math.atan2(e.zone.y - e.y, e.zone.x - e.x); moveEnemy(e, Math.cos(a) * e.spd * 0.5 * dt, Math.sin(a) * e.spd * 0.5 * dt); }
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead && enemies[i].deadT > 0.6) enemies.splice(i, 1);
  for (const z of spawnZones) {
    const alive = enemies.filter(e => !e.dead && e.zone === z).length;
    if (alive < z.max) { z.timer -= dt; if (z.timer <= 0) { z.timer = rand(4, 8); spawnEnemy(z); } }
  }
}
function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.vx *= 0.96; if (p.t > p.life) particles.splice(i, 1); }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.y -= 26 * dt; if (f.t > f.life) floats.splice(i, 1); }
  for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t > slashes[i].life) slashes.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].life) rings.splice(i, 1); }
  for (let i = drops.length - 1; i >= 0; i--) { drops[i].t += dt; if (drops[i].picked) drops.splice(i, 1); }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    let gone = p.t > p.life;
    for (const e of enemies) {
      if (e.dead || p.hits.has(e)) continue;
      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r) { hitEnemy(e, p.dmg); p.hits.add(e); p.pierce--; if (p.pierce <= 0) gone = true; }
    }
    if (blocked(p.x, p.y, 4) && tileAt(p.x, p.y) === 2) { /* 水面上可飞过 */ }
    if (gone) projectiles.splice(i, 1);
  }
}

// ---------------- 拾取 / 背包 ----------------
function pickup(dp) {
  const it = dp.item; dp.picked = true;
  if (it.kind === 'potion') {
    const ex = player.inv.find(x => x.kind === 'potion' && x.potId === it.potId);
    if (ex) ex.count++; else player.inv.push(it);
    msg('拾取 ' + it.name, 'jade');
  } else {
    if (player.inv.length >= 30) { msg('行囊已满', 'warn'); dp.picked = false; dp.t = 0; return; }
    player.inv.push(it);
    msg('拾取 ' + it.name, it.qual.k === 'epic' ? 'good' : 'jade');
  }
  Sfx.coin(); save();
  if (panelOpen === 'inv') renderInv();
}

// ---------------- 存档 ----------------
const SAVE_KEY = 'moxiang_wuxia_save_v1';
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: player.level, exp: player.exp, coins: player.coins,
      hp: Math.round(player.hp), mp: Math.round(player.mp),
      weapon: player.weapon, armor: player.armor, inv: player.inv,
      x: Math.round(player.x), y: Math.round(player.y)
    }));
  } catch (e) {}
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s) return false;
    player.level = s.level || 1; player.exp = s.exp || 0; player.coins = s.coins || 0;
    player.weapon = s.weapon || null; player.armor = s.armor || null; player.inv = s.inv || [];
    player.x = s.x || TOWN.x; player.y = s.y || TOWN.y + 120;
    player.hp = s.hp || maxHP(); player.mp = s.mp || maxMP();
    return true;
  } catch (e) { return false; }
}

// ---------------- 死亡 ----------------
function die() {
  player.dead = true;
  const lost = Math.round(player.coins * 0.2); player.coins -= lost;
  document.getElementById('death-sub').textContent = '你倒在了江湖之中…… 损失 ' + lost + ' 文铜钱';
  document.getElementById('death-screen').classList.remove('hidden');
  save();
}
function revive() {
  player.dead = false; player.x = TOWN.x; player.y = TOWN.y + 120;
  player.hp = maxHP(); player.mp = maxMP(); player.invuln = 1.5;
  document.getElementById('death-screen').classList.add('hidden');
  msg('回城疗伤，气血已复', 'jade'); save();
}

// ================= 渲染 =================
function render() {
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, VW, VH);
  drawTiles();
  drawTownMarker();
  // 深度排序绘制：景物 + 敌人 + 玩家
  const list = [];
  for (const s of scenery) { const sx = s.x - cam.x, sy = s.y - cam.y; if (sx < -80 || sy < -120 || sx > VW + 80 || sy > VH + 40) continue; list.push({ y: s.y, kind: 'scn', o: s }); }
  for (const e of enemies) { const sx = e.x - cam.x, sy = e.y - cam.y; if (sx < -60 || sy < -80 || sx > VW + 60 || sy > VH + 40) continue; list.push({ y: e.y, kind: 'enm', o: e }); }
  list.push({ y: player.y, kind: 'ply', o: player });
  // 地面掉落先画（在脚下）
  drawDrops();
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.kind === 'scn') drawScenery(it.o);
    else if (it.kind === 'enm') drawEnemy(it.o);
    else drawPlayer();
  }
  drawEffects();
  drawOverlay();
}
function drawTiles() {
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(MAP_W - 1, Math.floor((cam.x + VW) / TILE)), y1 = Math.min(MAP_H - 1, Math.floor((cam.y + VH) / TILE));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tiles[ty * MAP_W + tx], sx = tx * TILE - cam.x, sy = ty * TILE - cam.y;
    ctx.fillStyle = t === 2 ? '#c6d5d5' : t === 1 ? '#ddd0b0' : t === 3 ? '#cdc5b3' : '#d9dcc4';
    ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    if (t === 0) { ctx.fillStyle = 'rgba(79,125,99,0.10)'; for (let i = 0; i < 3; i++) { const hx = hash2(tx * 7 + i, ty * 3), hy = hash2(tx * 3, ty * 7 + i); ctx.beginPath(); ctx.arc(sx + hx * TILE, sy + hy * TILE, 1.5 + hx * 2, 0, 6.28); ctx.fill(); } }
    else if (t === 2) { ctx.strokeStyle = 'rgba(43,38,32,0.12)'; ctx.lineWidth = 1.4; ctx.beginPath(); const yy = sy + TILE * 0.4 + Math.sin(tx + ty) * 4; ctx.moveTo(sx, yy); ctx.quadraticCurveTo(sx + TILE / 2, yy + 6, sx + TILE, yy); ctx.stroke(); }
    else if (t === 3) { ctx.fillStyle = 'rgba(43,38,32,0.14)'; ctx.beginPath(); ctx.arc(sx + TILE * 0.5, sy + TILE * 0.55, TILE * 0.26, 0, 6.28); ctx.fill(); }
    else if (t === 1) { ctx.fillStyle = 'rgba(43,38,32,0.10)'; for (let i = 0; i < 4; i++) { const hx = hash2(tx * 5 + i, ty * 9), hy = hash2(tx * 2, ty * 4 + i); ctx.fillRect(sx + hx * TILE, sy + hy * TILE, 3, 2); } }
  }
}
function drawTownMarker() {
  const sx = TOWN.x - cam.x, sy = TOWN.y - cam.y;
  ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#b8893f'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(sx, sy, TOWN.r, 0, 6.28); ctx.stroke(); ctx.restore();
}
function inkStroke(x1, y1, cx, cy, x2, y2, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
}
function drawScenery(s) {
  const sx = s.x - cam.x, sy = s.y - cam.y, sc = s.scale;
  ctx.fillStyle = 'rgba(43,38,32,0.18)'; ctx.beginPath(); ctx.ellipse(sx, sy, 16 * sc, 6 * sc, 0, 0, 6.28); ctx.fill();
  if (s.type === 'bamboo') {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 8 * sc, h = (46 + i * 6) * sc;
      inkStroke(sx + ox, sy, sx + ox + 3, sy - h * 0.5, sx + ox + 2, sy - h, 3 * sc, '#4f7d63');
      ctx.fillStyle = 'rgba(79,125,99,0.85)';
      for (let j = 0; j < 3; j++) { const ly = sy - h + j * 10 * sc; ctx.beginPath(); ctx.ellipse(sx + ox + 8, ly, 9 * sc, 2.4 * sc, -0.5, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(sx + ox - 6, ly + 4, 8 * sc, 2.2 * sc, 0.5, 0, 6.28); ctx.fill(); }
    }
  } else if (s.type === 'pine') {
    inkStroke(sx, sy, sx - 2, sy - 20 * sc, sx, sy - 34 * sc, 5 * sc, '#5b4a33');
    ctx.fillStyle = '#3f5f47';
    for (let k = 0; k < 3; k++) { const ly = sy - 20 * sc - k * 16 * sc, rw = (26 - k * 6) * sc; ctx.beginPath(); ctx.moveTo(sx - rw, ly); ctx.lineTo(sx, ly - 22 * sc); ctx.lineTo(sx + rw, ly); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(43,38,32,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (s.type === 'rock') {
    ctx.fillStyle = '#8f887b'; ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 22 * sc, sy); ctx.quadraticCurveTo(sx - 24 * sc, sy - 22 * sc, sx - 4 * sc, sy - 26 * sc);
    ctx.quadraticCurveTo(sx + 20 * sc, sy - 28 * sc, sx + 24 * sc, sy - 4 * sc); ctx.quadraticCurveTo(sx + 24 * sc, sy + 4 * sc, sx, sy + 5 * sc);
    ctx.quadraticCurveTo(sx - 20 * sc, sy + 5 * sc, sx - 22 * sc, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,38,32,0.4)'; ctx.lineWidth = 1.5; inkStroke(sx - 8 * sc, sy - 18 * sc, sx - 2 * sc, sy - 8 * sc, sx + 6 * sc, sy - 2 * sc, 1.5, 'rgba(43,38,32,0.4)');
  } else if (s.type === 'pavilion') {
    // 亭子：柱 + 檐
    ctx.strokeStyle = '#7a3b30'; ctx.lineWidth = 6 * sc;
    for (const px of [-34, -12, 12, 34]) { ctx.beginPath(); ctx.moveTo(sx + px * sc, sy); ctx.lineTo(sx + px * sc, sy - 46 * sc); ctx.stroke(); }
    ctx.fillStyle = '#8a2f24'; ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 56 * sc, sy - 46 * sc); ctx.quadraticCurveTo(sx, sy - 84 * sc, sx + 56 * sc, sy - 46 * sc);
    ctx.quadraticCurveTo(sx + 40 * sc, sy - 40 * sc, sx, sy - 44 * sc); ctx.quadraticCurveTo(sx - 40 * sc, sy - 40 * sc, sx - 56 * sc, sy - 46 * sc); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8893f'; ctx.font = 'bold ' + (11 * sc) + 'px KaiTi,serif'; ctx.textAlign = 'center'; ctx.fillText('归 云 亭', sx, sy - 54 * sc);
  } else if (s.type === 'tablet') {
    ctx.fillStyle = '#9a9083'; ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2;
    ctx.fillRect(sx - 12 * sc, sy - 40 * sc, 24 * sc, 42 * sc); ctx.strokeRect(sx - 12 * sc, sy - 40 * sc, 24 * sc, 42 * sc);
    ctx.fillStyle = '#2b2620'; ctx.font = 'bold ' + (10 * sc) + 'px KaiTi,serif'; ctx.textAlign = 'center';
    ctx.fillText('安', sx, sy - 26 * sc); ctx.fillText('全', sx, sy - 14 * sc);
  }
}
function drawFighter(sx, sy, o) {
  const s = o.scale || 1;
  ctx.fillStyle = 'rgba(43,38,32,0.22)'; ctx.beginPath(); ctx.ellipse(sx, sy, 13 * s, 5.5 * s, 0, 0, 6.28); ctx.fill();
  const bob = o.moving ? Math.sin(o.bobT) * 2 : 0, cy = sy - 2 + bob;
  const faceLeft = Math.cos(o.facing) < 0;
  ctx.save(); ctx.translate(sx, cy);
  // 腿
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  const sw = o.moving ? Math.sin(o.bobT) * 4 : 0;
  ctx.beginPath(); ctx.moveTo(-5 * s, 6 * s); ctx.lineTo(-6 * s + sw, 14 * s); ctx.moveTo(5 * s, 6 * s); ctx.lineTo(6 * s - sw, 14 * s); ctx.stroke();
  // 袍
  ctx.fillStyle = o.robe; ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -34 * s);
  ctx.quadraticCurveTo(-16 * s, -20 * s, -13 * s, 2 * s);
  ctx.quadraticCurveTo(-14 * s, 9 * s, -8 * s, 9 * s); ctx.lineTo(8 * s, 9 * s);
  ctx.quadraticCurveTo(14 * s, 9 * s, 13 * s, 2 * s);
  ctx.quadraticCurveTo(16 * s, -20 * s, 0, -34 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 腰带
  ctx.fillStyle = o.sash || '#4f7d63'; ctx.fillRect(-13 * s, -8 * s, 26 * s, 4.5 * s);
  // 头
  ctx.fillStyle = '#efe0c4'; ctx.beginPath(); ctx.arc(0, -40 * s, 8.5 * s, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#2b2620'; ctx.beginPath(); ctx.arc(0, -43 * s, 8.5 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.fillRect(-2 * s, -52 * s, 4 * s, 6 * s);
  ctx.beginPath(); ctx.arc((faceLeft ? -6 : 6) * s, -40 * s, 1.8 * s, 0, 6.28); ctx.fill();
  if (o.ears) { ctx.fillStyle = o.robe; ctx.beginPath(); ctx.arc(-7 * s, -50 * s, 4 * s, 0, 6.28); ctx.arc(7 * s, -50 * s, 4 * s, 0, 6.28); ctx.fill(); }
  ctx.restore();
  if (o.hurtT > 0) { ctx.fillStyle = 'rgba(201,66,54,0.4)'; ctx.beginPath(); ctx.arc(sx, cy - 18, 22 * s, 0, 6.28); ctx.fill(); }
}
function drawPlayer() {
  if (player.dead) return;
  drawFighter(player.x - cam.x, player.y - cam.y, { scale: 1.05, facing: player.facing, moving: player.moving, bobT: player.bobT, robe: '#e8e0cc', sash: '#4f7d63', hurtT: player.hurtT });
  if (player.invuln > 0) { const sx = player.x - cam.x, sy = player.y - cam.y; ctx.strokeStyle = 'rgba(79,125,99,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 18, 26, 0, 6.28); ctx.stroke(); }
}
function drawEnemy(e) {
  const sx = e.x - cam.x, sy = e.y - cam.y;
  if (e.dead) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.6); inkBurstStatic(sx, sy); ctx.restore(); return; }
  drawFighter(sx, sy, { scale: e.big, facing: e.facing, moving: e.state === 'chase', bobT: e.bobT, robe: e.robe, sash: '#6b3a30', hurtT: e.hurtT, ears: e.type !== 'bandit' });
  // 血条 + 名字
  const w = 40 * e.big, hpx = sx - w / 2, hpy = sy - 60 * e.big;
  ctx.fillStyle = 'rgba(43,38,32,0.5)'; ctx.fillRect(hpx - 1, hpy - 1, w + 2, 6);
  ctx.fillStyle = '#c94236'; ctx.fillRect(hpx, hpy, w * clamp(e.hp / e.maxhp, 0, 1), 4);
  ctx.fillStyle = '#2b2620'; ctx.font = '11px KaiTi,serif'; ctx.textAlign = 'center';
  ctx.fillText(e.name + ' Lv.' + e.lv, sx, hpy - 4);
}
function inkBurstStatic(sx, sy) { ctx.fillStyle = '#2b2620'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 14, sy + Math.sin(a) * 10, 3, 0, 6.28); ctx.fill(); } }
function drawDrops() {
  for (const dp of drops) {
    if (dp.picked) continue;
    const sx = dp.x - cam.x, sy = dp.y - cam.y;
    if (sx < -30 || sy < -30 || sx > VW + 30 || sy > VH + 30) continue;
    const bob = Math.sin(dp.t * 3) * 3;
    const col = dp.item.qual ? dp.item.qual.col : '#4f7d63';
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 6.28); ctx.fill(); ctx.restore();
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dp.item.icon, sx, sy - 8 + bob); ctx.textBaseline = 'alphabetic';
  }
}
function drawEffects() {
  // 刀光
  for (const sl of slashes) {
    const sx = sl.x - cam.x, sy = sl.y - cam.y, p = sl.t / sl.life;
    ctx.save(); ctx.globalAlpha = (1 - p) * 0.85; ctx.strokeStyle = sl.enemy ? 'rgba(138,43,35,0.9)' : '#2b2620';
    ctx.lineWidth = 6 * (1 - p) + 2; ctx.lineCap = 'round';
    ctx.beginPath(); const a0 = sl.ang - sl.arc / 2, a1 = sl.ang + sl.arc / 2, rr = sl.range * (0.6 + p * 0.5);
    ctx.arc(sx, sy, rr, a0, a1); ctx.stroke(); ctx.restore();
  }
  // 掌风环
  for (const r of rings) {
    const sx = r.x - cam.x, sy = r.y - cam.y, p = r.t / r.life;
    ctx.save(); ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = r.col; ctx.lineWidth = 5 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(sx, sy, r.rmax * p, 0, 6.28); ctx.stroke(); ctx.restore();
  }
  // 剑气
  for (const p of projectiles) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.ang);
    ctx.fillStyle = '#2b2620'; ctx.beginPath(); ctx.moveTo(-16, -5); ctx.quadraticCurveTo(12, 0, 20, 0); ctx.quadraticCurveTo(12, 0, -16, 5); ctx.quadraticCurveTo(-6, 0, -16, -5); ctx.fill();
    ctx.restore();
  }
  // 墨点
  for (const p of particles) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, 6.28); ctx.fill(); ctx.restore(); }
  // 飘字
  for (const f of floats) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = f.col;
    ctx.font = 'bold ' + f.size + 'px KaiTi,serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(239,230,210,0.85)'; ctx.strokeText(f.txt, f.x - cam.x, f.y - cam.y); ctx.fillText(f.txt, f.x - cam.x, f.y - cam.y); ctx.restore();
  }
}
function drawOverlay() {
  const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,48,32,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}

// ---------------- 小地图 ----------------
function drawMini() {
  const S = 150, sxk = S / WORLD_W, syk = S / WORLD_H;
  mctx.fillStyle = '#efe6d2'; mctx.fillRect(0, 0, S, S);
  // 水
  mctx.fillStyle = 'rgba(90,140,150,0.5)';
  for (let ty = 0; ty < MAP_H; ty += 1) for (let tx = 0; tx < MAP_W; tx += 1) if (tiles[ty * MAP_W + tx] === 2) mctx.fillRect(tx * TILE * sxk, ty * TILE * syk, TILE * sxk + 1, TILE * syk + 1);
  mctx.strokeStyle = 'rgba(184,137,63,0.9)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.arc(TOWN.x * sxk, TOWN.y * syk, TOWN.r * sxk, 0, 6.28); mctx.stroke();
  mctx.fillStyle = '#c94236'; for (const e of enemies) { if (e.dead) continue; mctx.fillRect(e.x * sxk - 1, e.y * syk - 1, 2.5, 2.5); }
  mctx.fillStyle = '#4f7d63'; mctx.beginPath(); mctx.arc(player.x * sxk, player.y * syk, 3, 0, 6.28); mctx.fill();
}

// ---------------- HUD ----------------
const $ = id => document.getElementById(id);
function updateHUD() {
  const mh = maxHP(), mm = maxMP(), en = expToNext();
  $('bar-hp').style.width = clamp(player.hp / mh * 100, 0, 100) + '%';
  $('txt-hp').textContent = Math.round(player.hp) + '/' + mh;
  $('bar-mp').style.width = clamp(player.mp / mm * 100, 0, 100) + '%';
  $('txt-mp').textContent = Math.round(player.mp) + '/' + mm;
  $('bar-exp').style.width = clamp(player.exp / en * 100, 0, 100) + '%';
  $('txt-exp').textContent = Math.floor(player.exp / en * 100) + '%';
  $('hud-level').textContent = player.level;
  $('hud-coins').textContent = player.coins;
  // 技能冷却
  for (let i = 0; i < 3; i++) {
    const cd = $('cd-' + i); if (!cd) continue;
    if (player.cd[i] > 0) { cd.style.display = 'flex'; cd.textContent = player.cd[i].toFixed(1); }
    else cd.style.display = 'none';
  }
}
function buildSkillbar() {
  const bar = $('skillbar'); bar.innerHTML = '';
  SKILLS.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'skill-slot';
    d.innerHTML = `<span class="s-key">${s.key}</span><span class="s-icon">${s.icon}</span><span class="s-name">${s.name}</span><span class="s-mp">${s.mp}</span><span class="s-cd" id="cd-${i}" style="display:none"></span>`;
    d.onclick = () => useSkill(i);
    bar.appendChild(d);
  });
}

// ---------------- 消息 ----------------
function msg(text, cls) {
  const log = $('msglog'); const d = document.createElement('div');
  d.className = 'msg ' + (cls || ''); d.textContent = text; log.appendChild(d);
  setTimeout(() => d.remove(), 2600);
  while (log.children.length > 5) log.removeChild(log.firstChild);
}

// ---------------- 面板：背包 / 属性 ----------------
let panelOpen = null, paused = false;
function togglePanel(tab) { if (panelOpen === tab) { closePanel(); } else openPanel(tab); }
function openPanel(tab) {
  panelOpen = tab; paused = true;
  $('panel').classList.remove('hidden');
  document.querySelectorAll('.ptab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('tab-inv').classList.toggle('hidden', tab !== 'inv');
  $('tab-char').classList.toggle('hidden', tab !== 'char');
  $('panel-title').textContent = tab === 'inv' ? '行囊' : '属性';
  if (tab === 'inv') renderInv(); else renderChar();
}
function closePanel() { panelOpen = null; paused = false; $('panel').classList.add('hidden'); }
let selItem = null;
function renderInv() {
  const eq = $('equip-row');
  eq.innerHTML = `
    <div class="equip-slot" id="eq-weapon">${player.weapon ? `<span style="font-size:20px">🗡️</span><span class="es-name" style="color:${player.weapon.qual.col}">${player.weapon.name}</span>` : '<span>兵器</span><span class="es-name">空</span>'}</div>
    <div class="equip-slot" id="eq-armor">${player.armor ? `<span style="font-size:20px">🥋</span><span class="es-name" style="color:${player.armor.qual.col}">${player.armor.name}</span>` : '<span>护甲</span><span class="es-name">空</span>'}</div>`;
  $('eq-weapon').onclick = () => { if (player.weapon) { player.inv.push(player.weapon); player.weapon = null; save(); renderInv(); } };
  $('eq-armor').onclick = () => { if (player.armor) { player.inv.push(player.armor); player.armor = null; save(); renderInv(); } };
  const grid = $('inv-grid'); grid.innerHTML = '';
  const total = 30;
  for (let i = 0; i < total; i++) {
    const it = player.inv[i]; const c = document.createElement('div');
    if (!it) { c.className = 'inv-cell empty'; grid.appendChild(c); continue; }
    c.className = 'inv-cell' + (it.qual ? ' ' + it.qual.cls : '');
    c.innerHTML = it.icon + (it.count > 1 ? `<span class="cnt">${it.count}</span>` : '');
    c.onclick = () => { selItem = i; showDetail(i); };
    grid.appendChild(c);
  }
  if (selItem != null && player.inv[selItem]) showDetail(selItem); else $('item-detail').textContent = '点击物品查看 / 使用 / 装备';
}
function showDetail(i) {
  const it = player.inv[i]; if (!it) return;
  let html = `<div class="d-name" style="color:${it.qual ? it.qual.col : '#2b2620'}">${it.name}</div>`;
  if (it.kind === 'weapon') html += `<div>攻击 +${it.atk}</div>`;
  else if (it.kind === 'armor') html += `<div>防御 +${it.def} · 气血 +${it.hp}</div>`;
  else if (it.kind === 'potion') { const p = POTIONS[it.potId]; html += `<div>${p.heal === 'hp' ? '恢复气血' : p.heal === 'mp' ? '恢复内力' : '气血内力全恢复'} ${Math.round(p.pct * 100)}%</div>`; }
  html += '<div class="detail-btns">';
  if (it.kind === 'weapon' || it.kind === 'armor') html += `<button class="mini-btn" id="d-equip">装备</button>`;
  if (it.kind === 'potion') html += `<button class="mini-btn" id="d-use">使用</button>`;
  html += `<button class="mini-btn sell" id="d-sell">卖出(${sellPrice(it)}文)</button><button class="mini-btn drop" id="d-drop">丢弃</button></div>`;
  $('item-detail').innerHTML = html;
  const eb = $('d-equip'); if (eb) eb.onclick = () => equipItem(i);
  const ub = $('d-use'); if (ub) ub.onclick = () => usePotion(i);
  $('d-sell').onclick = () => sellItem(i);
  $('d-drop').onclick = () => { player.inv.splice(i, 1); selItem = null; save(); renderInv(); };
}
function sellPrice(it) { if (it.kind === 'potion') return 8 * (it.count || 1); const base = it.kind === 'weapon' ? it.atk * 4 : (it.def * 5 + it.hp); return Math.max(5, Math.round(base * (it.qual ? it.qual.mult : 1))); }
function equipItem(i) {
  const it = player.inv[i]; if (!it) return;
  if (it.kind === 'weapon') { const old = player.weapon; player.weapon = it; player.inv.splice(i, 1); if (old) player.inv.push(old); }
  else if (it.kind === 'armor') { const old = player.armor; const before = maxHP(); player.armor = it; player.inv.splice(i, 1); if (old) player.inv.push(old); player.hp += maxHP() - before; }
  selItem = null; save(); renderInv(); msg('已装备 ' + it.name, 'jade'); Sfx.skill();
}
function usePotion(i) {
  const it = player.inv[i]; if (!it || it.kind !== 'potion') return;
  const p = POTIONS[it.potId];
  if (p.heal === 'hp' || p.heal === 'both') player.hp = Math.min(maxHP(), player.hp + maxHP() * p.pct);
  if (p.heal === 'mp' || p.heal === 'both') player.mp = Math.min(maxMP(), player.mp + maxMP() * p.pct);
  it.count--; if (it.count <= 0) player.inv.splice(i, 1);
  msg('服下 ' + it.name, 'jade'); Sfx.coin(); save(); renderInv();
}
function sellItem(i) {
  const it = player.inv[i]; if (!it) return;
  player.coins += sellPrice(it); player.inv.splice(i, 1); selItem = null;
  Sfx.coin(); save(); renderInv(); msg('已卖出', 'good');
}
function renderChar() {
  $('char-stats').innerHTML = `
    <div class="st"><span>境界</span><b>Lv.${player.level}</b></div>
    <div class="st"><span>经验</span><span>${Math.floor(player.exp)} / ${expToNext()}</span></div>
    <div class="st"><span>气血</span><b>${Math.round(player.hp)} / ${maxHP()}</b></div>
    <div class="st"><span>内力</span><b>${Math.round(player.mp)} / ${maxMP()}</b></div>
    <div class="st"><span>攻击</span><b>${atkStat()}</b></div>
    <div class="st"><span>防御</span><b>${defStat()}</b></div>
    <div class="st"><span>兵器</span><span style="color:${player.weapon ? player.weapon.qual.col : '#9a9083'}">${player.weapon ? player.weapon.name : '空手'}</span></div>
    <div class="st"><span>护甲</span><span style="color:${player.armor ? player.armor.qual.col : '#9a9083'}">${player.armor ? player.armor.name : '布衣'}</span></div>
    <div class="st"><span>铜钱</span><b>${player.coins} 文</b></div>`;
}

// ---------------- 音效（Web Audio 合成）----------------
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
function beep(f, d, type, g) { try { const c = ac(); if (!c) return; const o = c.createOscillator(), gg = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; gg.gain.value = g || 0.05; o.connect(gg); gg.connect(c.destination); o.start(); gg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d); o.stop(c.currentTime + d); } catch (e) {} }
const Sfx = {
  swing: () => beep(320, 0.08, 'triangle', 0.04),
  hit: () => beep(200, 0.07, 'square', 0.04),
  hurt: () => beep(140, 0.18, 'sawtooth', 0.05),
  level: () => { beep(523, 0.12, 'sine', 0.06); setTimeout(() => beep(784, 0.18, 'sine', 0.06), 120); },
  coin: () => beep(880, 0.06, 'square', 0.04),
  skill: () => beep(440, 0.1, 'triangle', 0.05)
};

// ---------------- 游戏循环 ----------------
let gameStarted = false, autosaveT = 8, last = nowT();
function loop() {
  const t = nowT(); let dt = t - last; last = t; if (dt > 0.05) dt = 0.05;
  if (gameStarted) {
    updateCam(); mouseWorld();
    if (!paused && !player.dead) {
      updatePlayer(dt); updateEnemies(dt); updateFx(dt);
      autosaveT -= dt; if (autosaveT <= 0) { autosaveT = 8; save(); }
    } else { updateFx(dt); }
    render(); updateHUD(); drawMini();
  }
  requestAnimationFrame(loop);
}

// ---------------- 启动 ----------------
function beginGame(fresh) {
  if (fresh) {
    player.level = 1; player.exp = 0; player.coins = 0; player.weapon = null; player.armor = null; player.inv = [];
    player.x = TOWN.x; player.y = TOWN.y + 120; player.hp = maxHP(); player.mp = maxMP();
    // 新手赠送
    player.inv.push({ kind: 'potion', name: '金创药', icon: '🧪', potId: 'jinchuang', count: 3 });
    player.weapon = { kind: 'weapon', name: '凡品木剑', icon: '🗡️', qual: QUAL[0], atk: 2, tier: 0 };
    save();
  } else { loadSave(); }
  player.dead = false;
  gameStarted = true;
  ['hud', 'minimap', 'msglog', 'skillbar', 'hint'].forEach(id => $(id).classList.remove('hidden'));
  $('start-screen').classList.add('hidden');
  setTimeout(() => $('hint').classList.add('hidden'), 9000);
  msg(fresh ? '踏入江湖，斩妖除魔！' : '继续你的江湖路', 'good');
}
function init() {
  genWorld(); genScenery(); genSpawns();
  for (const z of spawnZones) for (let i = 0; i < z.max; i++) spawnEnemy(z);
  buildSkillbar();
  $('btn-new').onclick = () => beginGame(true);
  $('btn-continue').onclick = () => beginGame(false);
  $('btn-revive').onclick = revive;
  $('panel-close').onclick = closePanel;
  document.querySelectorAll('.ptab').forEach(b => b.onclick = () => openPanel(b.dataset.tab));
  if (hasSave()) $('btn-continue').classList.remove('hidden');
  requestAnimationFrame(loop);
}
init();
