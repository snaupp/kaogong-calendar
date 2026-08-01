/* =========================================================
   勇者修行 · 考公讨伐魔王 —— RPG 打卡逻辑
   ========================================================= */
'use strict';

/* ---------------- 常量配置 ---------------- */

const SAVE_KEY = 'rpg-checkin-calendar-v1';

// 魔王阶段：血量 = 累计打卡造成的伤害
const BOSSES = [
  { name: '见习小恶魔',   maxHp: 10 },
  { name: '哥布林军团长', maxHp: 20 },
  { name: '魔将·红鬼',    maxHp: 36 },
  { name: '堕天魔将·影',  maxHp: 55 },
  { name: '魔王·初形态',  maxHp: 80 },
  { name: '完全体魔王',   maxHp: 110 },
  { name: '最终魔王·灾厄', maxHp: 150 },
];

// 连续打卡里程碑（达到即发放一次性大奖）
const MILESTONES = [7, 14, 21, 30, 45, 60, 90, 120, 180, 240, 300, 365];

// 每日签到奖励（7 天一轮，中断重来）
const SIGNIN_REWARDS = {
  1: { gold: 20,  exp: 10 },
  2: { gold: 30,  exp: 15 },
  3: { gold: 40,  exp: 20, item: 'fine' },
  4: { gold: 50,  exp: 25 },
  5: { gold: 60,  exp: 30 },
  6: { gold: 70,  exp: 35, item: 'rare' },
  7: { gold: 100, exp: 50, item: 'epic' },
};

// 攻击暴击率
const CRIT_RATE = 0.15;
// 魔王反击概率
const COUNTER_RATE = 0.2;

// 技能定义（effect: crit=必暴击 heal=回血 mana=回蓝 freeze=冰冻免反击）
const SKILLS = [
  { name: '重斩',     type: 'physical', mult: 2.0, mp: 10, icon: '🗡', rarity: 'common',  effect: null,  desc: '对魔王造成 2 倍伤害' },
  { name: '旋风斩',   type: 'physical', mult: 2.6, mp: 16, icon: '🌪', rarity: 'fine',    effect: null,  desc: '对魔王造成 2.6 倍伤害' },
  { name: '破甲斩',   type: 'physical', mult: 2.2, mp: 14, icon: '💥', rarity: 'rare',    effect: 'crit', desc: '2.2 倍伤害且必定暴击' },
  { name: '嗜血斩',   type: 'physical', mult: 2.0, mp: 18, icon: '🩸', rarity: 'rare',    effect: 'heal', desc: '2 倍伤害并回复 20% 最大生命' },
  { name: '龙牙突',   type: 'physical', mult: 3.2, mp: 26, icon: '🐉', rarity: 'epic',    effect: null,  desc: '对魔王造成 3.2 倍伤害' },
  { name: '火球术',   type: 'magic',    mult: 2.4, mp: 14, icon: '🔥', rarity: 'fine',    effect: null,  desc: '对魔王造成 2.4 倍魔法伤害' },
  { name: '冰霜新星', type: 'magic',    mult: 2.2, mp: 16, icon: '❄️', rarity: 'rare',    effect: 'freeze', desc: '2.2 倍伤害，并冰冻魔王（下次免反击）' },
  { name: '雷击术',   type: 'magic',    mult: 3.0, mp: 24, icon: '⚡', rarity: 'epic',    effect: 'crit', desc: '3 倍伤害且必定暴击' },
  { name: '魔力吸取', type: 'magic',    mult: 1.6, mp: 12, icon: '💜', rarity: 'fine',    effect: 'mana', desc: '1.6 倍伤害并回复 30 点蓝量' },
  { name: '流星坠落', type: 'magic',    mult: 4.0, mp: 40, icon: '☄️', rarity: 'legend',  effect: null,  desc: '对魔王造成 4 倍魔法伤害' },
];

// 区域：随讨伐魔王进度（阶段）推进
const ZONES = [
  { id: 'grass',  name: '希望草原', minStage: 1 },
  { id: 'forest', name: '幽暗森林', minStage: 3 },
  { id: 'desert', name: '流沙沙漠', minStage: 5 },
  { id: 'snow',   name: '凛风雪原', minStage: 7 },
  { id: 'demon',  name: '魔王领地', minStage: 9 },
];

// 商店商品
const SHOP_ITEMS = [
  { id: 'potion_hp',   name: '红药水',   icon: '🧪', price: 20, desc: '回复 40 点生命',            type: 'consumable', hp: 40 },
  { id: 'potion_mp',   name: '蓝药水',   icon: '🧪', price: 20, desc: '回复 40 点蓝量',            type: 'consumable', mp: 40 },
  { id: 'potion_full', name: '仙露',     icon: '✨', price: 45, desc: '回复 80 点生命和蓝量',      type: 'consumable', hp: 80, mp: 80 },
  { id: 'attacks',     name: '攻击次数包', icon: '🗡', price: 30, desc: '立即获得 3 次攻击次数' },
  { id: 'makeup',      name: '补签卡',   icon: '📋', price: 80, desc: '补签 1 天漏掉的打卡，恢复连续记录' },
  { id: 'skill_scroll',name: '随机技能书', icon: '📖', price: 80, desc: '学会一个随机技能' },
  { id: 'equip_box',   name: '装备箱',   icon: '🎁', price: 50, desc: '随机掉落一件装备' },
];

const RARITY_ORDER = ['common', 'fine', 'rare', 'epic', 'legend'];

const RARITY = {
  common:  { label: '普通', color: '#cfd8dc' },
  fine:    { label: '优秀', color: '#7ce38b' },
  rare:    { label: '稀有', color: '#6bc7ff' },
  epic:    { label: '史诗', color: '#d58cff' },
  legend:  { label: '传说', color: '#ffcd38' },
};

const TYPE_META = {
  weapon:    { label: '武器', icon: '⚔' },
  armor:     { label: '防具', icon: '🛡' },
  accessory: { label: '饰品', icon: '💍' },
  trophy:    { label: '战利品', icon: '🏆' },
};

// 掉落池
const ITEM_POOL = {
  weapon: [
    { name: '铁剑',     atk: 5,   rarity: 'common' },
    { name: '精钢剑',   atk: 12,  rarity: 'fine' },
    { name: '秘银剑',   atk: 25,  rarity: 'rare' },
    { name: '龙牙剑',   atk: 45,  rarity: 'epic' },
    { name: '圣剑·裁决', atk: 80,  rarity: 'legend' },
  ],
  armor: [
    { name: '皮甲',     hp: 30,   rarity: 'common' },
    { name: '锁子甲',   hp: 60,   rarity: 'fine' },
    { name: '秘银铠',   hp: 110,  rarity: 'rare' },
    { name: '龙鳞铠',   hp: 200,  rarity: 'epic' },
    { name: '圣盾·守护', hp: 350,  rarity: 'legend' },
  ],
  accessory: [
    { name: '幸运护符', expPct: 5,  rarity: 'common' },
    { name: '修炼戒指', expPct: 10, rarity: 'fine' },
    { name: '智慧宝珠', expPct: 20, rarity: 'rare' },
    { name: '贤者之书', expPct: 35, rarity: 'epic' },
    { name: '天命之冠', expPct: 50, rarity: 'legend' },
  ],
  trophy: [
    { name: '史莱姆凝胶', rarity: 'common' },
    { name: '魔狼之牙',   rarity: 'fine' },
    { name: '暗影鳞片',   rarity: 'rare' },
    { name: '魔王之角',   rarity: 'epic' },
    { name: '深渊魔核',   rarity: 'legend' },
  ],
};

const QUOTES = [
  '坚持 21 天，习惯自成。',
  '今天的你，离上岸更近一步。',
  '行测一道题，也是一次经验值。',
  '魔王再强，也怕持之以恒的勇者。',
  '偷懒一天，魔王就多喘一口气。',
  '刷题如打怪，量变引起质变。',
  '申论多写一篇，剑就多锋利一分。',
  '没有白刷的题，每一步都算数。',
  '上岸的路，是一天一天打卡铺出来的。',
  '勇士不怕题海，只怕半途而废。',
];

/* ---------------- 像素精灵 ---------------- */

// 勇者（12 x 13）
const HERO_ROWS = [
  '....KKKK....',
  '...KWWWWK...',
  '..KWWWWWWK..',
  '..KWWWWWWK..',
  '..KKKKKKKK..',
  '.KSSSSSSSSK.',
  '.KSWSSSWSSK.',
  '.KSSSSSSSWK.',
  '.KRRGGGRRK..',
  '..KSSSSSSK..',
  '..KSSKSSKK..',
  '.KKSK.KSKK..',
  '.KKK..KKKK..',
];
const HERO_PAL = {
  K: '#10131f', W: '#e8ecf4', S: '#9fb0c4',
  R: '#e0514e', G: '#ffcd38',
};

// 魔王（14 x 16）
const BOSS_ROWS = [
  '..K........K..',
  '...K......K...',
  '..PKK....KKP..',
  '..PWWWWWWWWP..',
  '..PWWWWWWWWP..',
  '..PWWWYYWWWP..',
  '..PWWWYYWWWP..',
  '..PWWWWWWWWP..',
  '...PPPPPPPP...',
  '..PPPPPPPPPP..',
  '..PPKKKKKKPP..',
  '..PPKRRRRKPP..',
  '..PPKKKKKKPP..',
  '...PPPPPPPP...',
  '...PP..PP.....',
  '...KK..KK.....',
];
const BOSS_PAL = {
  K: '#0d0f1a', P: '#5a3aa8', W: '#c9a8ff',
  Y: '#ffe14d', R: '#ff4d5e',
};

// 国王（16 x 16，胜利庆典用）
const KING_ROWS = [
  '................',
  '....#....#......',
  '...###..###.....',
  '...#########....',
  '..###########...',
  '..##R#####R##...',
  '....oooooo......',
  '...owwwwww......',
  '...owsowso......',
  '...owwwwww......',
  '..oowbbbbb......',
  '..oowbbbbb......',
  '...owbbbb.......',
  '....bbbbbb......',
  '....pp..pp......',
  '................',
];
const KING_PAL = {
  '#': '#ffcd38', o: '#6b4423', w: '#f0c8a0',
  s: '#2b2130', b: '#e8ecf4', p: '#7a4fb0', R: '#e0514e',
};

// 公主（16 x 16，胜利庆典用）
const PRINCESS_ROWS = [
  '................',
  '....#....#......',
  '...#########....',
  '..oooooooooo....',
  '..owwwwwwwwo....',
  '..owwswswwo.....',
  '..owwwwwwwwo....',
  '..oooooooooo....',
  '.oooooooooooo...',
  '.oooppppppooo...',
  '.ooppppppppoo...',
  '.ooppppppppoo...',
  '.ooppppppppoo...',
  '..ooppppppoo....',
  '..oooooooooo....',
  '................',
];
const PRINCESS_PAL = {
  '#': '#ffcd38', o: '#4a2a18', w: '#f0c8a0',
  s: '#2b2130', p: '#f088b0',
};

// 凯旋勇者（16 x 16，披风与肩甲，胜利庆典用）
const HERO_C_ROWS = [
  '................',
  '......KKKK......',
  '.....KWWWWKR....',
  '....KWWWWWWKR...',
  '....KWWWWWWKR...',
  '....KKKKKKKKR...',
  '...KSSSSSSSSKR..',
  '...KSWSSSWSSKR..',
  '...KSSSSSSSWKR..',
  '...KRRGGGRRK....',
  '....KSSSSSSK....',
  '....KSSKSSKK....',
  '...KKSK.KSKK....',
  '...KKK..KKKK....',
  '................',
  '................',
];
const HERO_C_PAL = {
  K: '#10131f', W: '#e8ecf4', S: '#9fb0c4',
  R: '#d04a3a', G: '#ffcd38',
};

// 王城（16 x 16，胜利庆典用）
const CASTLE_ROWS = [
  '...BB.....BB....',
  '...BB.....BB....',
  '....RR...RR.....',
  '....RR...RR.....',
  '....RRRRRRR.....',
  '...RWWWWWWWR....',
  '...RWWWWWWWR....',
  '...RWGGGGGWR....',
  '...RWGGGGGWR....',
  '...RWGGGGGWR....',
  '...RWWWWWWWR....',
  '....WWWWWWW.....',
  '....WWDDDWW.....',
  '....WWDDDWW.....',
  '.....DDDDD......',
  '................',
];
const CASTLE_PAL = {
  B: '#6bc7ff', R: '#d04a3a', W: '#c8d4e0',
  G: '#ffd98a', D: '#1a1c2c',
};

// 国民（8 x 9，胜利庆典人群用，衣服色 T 可替换）
const CROWD_ROWS = [
  '........',
  '..WWWW..',
  '..WSWS..',
  '..WWWW..',
  '...TT...',
  '..TTTT..',
  '..TTTT..',
  '..K..K..',
  '........',
];
const CROWD_PAL = {
  W: '#f0c8a0', S: '#2b2130', T: '#e0514e', K: '#1a1c2c',
};

// 小花（5 x 5，庆祝花瓣/装饰）
const FLOWER_ROWS = [
  '.....',
  '..P..',
  '.PWP.',
  '..P..',
  '.....',
];
const FLOWER_PAL = { P: '#f088b0', W: '#ffcd38' };

// 荣誉勋章（10 x 10）
const MEDAL_ROWS = [
  '..........',
  '...YYYY...',
  '..YYYYYY..',
  '..YYYYYY..',
  '..YYYYYY..',
  '...YYYY...',
  '..RR..RR..',
  '..RR...RR.',
  '..........',
  '..........',
];
const MEDAL_PAL = { Y: '#ffcd38', R: '#e0514e' };

// 用 canvas 逐像素绘制精灵图，保证对齐与清晰
function makeSprite(rows, pal, pixel) {
  const canvas = document.createElement('canvas');
  const w = rows[0].length, h = rows.length;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvas.style.width = w * pixel + 'px';
  canvas.style.height = h * pixel + 'px';
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}

/* ---------------- 音效（WebAudio） ---------------- */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type, delay, vol) {
  if (state.muted || !audioCtx) return;
  const t = audioCtx.currentTime + (delay || 0);
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  click()     { beep(440, .05, 'square', 0, .07); },
  checkin()   { beep(660, .09, 'square'); beep(880, .14, 'square', .09); },
  signin()    { beep(880, .09, 'triangle'); beep(1175, .16, 'triangle', .09); },
  skill()     { beep(440, .1, 'sawtooth'); beep(660, .14, 'sawtooth', .08); beep(880, .2, 'sawtooth', .16); },
  ouch()      { beep(220, .15, 'square'); beep(160, .22, 'square', .12); },
  loot()      { [523, 659, 784, 1046].forEach((f, i) => beep(f, .1, 'triangle', i * .07)); },
  levelup()   { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => beep(f, .12, 'square', i * .09)); },
  defeat()    { [330, 392, 494, 659, 784, 988, 1318].forEach((f, i) => beep(f, .13, 'square', i * .1)); },
  victory()   { [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => beep(f, .16, 'triangle', i * .12, .12)); },
};

/* ---------------- 背景音乐（8-bit 循环） ---------------- */

function midiNote(n) { return 440 * Math.pow(2, (n - 69) / 12); }

const BGM = {
  ctx: null, master: null, timer: null, step: 0, nextTime: 0,
  zone: 'grass', running: false,
  // 各区域的音阶（root 为 MIDI 音高）与速度，营造不同氛围
  scales: {
    grass:  { root: 60, mode: [0, 2, 4, 5, 7, 9, 11, 12], tempo: 108 },
    forest: { root: 57, mode: [0, 2, 3, 5, 7, 8, 10, 12], tempo: 92 },
    desert: { root: 55, mode: [0, 2, 3, 5, 7, 9, 10, 12], tempo: 84 },
    snow:   { root: 64, mode: [0, 2, 4, 7, 9, 11, 12, 14], tempo: 100 },
    demon:  { root: 52, mode: [0, 1, 3, 5, 6, 8, 10, 12], tempo: 122 },
  },
  // 每区域一首 32 步主旋律（音阶度数，-1 为休止），原创曲目，明亮冒险风
  melodies: {
    grass: [0, 2, 4, 5, 7, 5, 4, 2,  4, 5, 4, 2, 0, -1, 0, -1,
            0, 2, 4, 5, 7, 9, 7, 5,  4, 5, 7, 9, 7, 5, 4, 2],
    forest: [0, -1, 2, 4, 5, 4, 2, -1,  4, -1, 5, -1, 7, 5, 4, -1,
             9, -1, 7, -1, 5, 4, 2, -1,  4, 2, 0, 2, 0, -1, -1, -1],
    desert: [0, 2, 4, -1, 5, 4, 2, -1,  4, 5, 7, -1, 5, 4, 2, -1,
             5, 4, 2, -1, 4, 2, 0, -1,  2, 4, 5, 7, 5, 4, 2, 0],
    snow: [0, -1, 4, 5, 7, 5, 4, -1,  7, -1, 9, 7, 5, 4, 2, -1,
           4, 5, 7, 9, 11, 9, 7, 5,  4, 5, 7, 5, 4, 2, 0, -1],
    demon: [0, 1, 3, 1, 0, 1, 3, 5,  6, 5, 3, 1, 0, 1, 0, -1,
            0, 1, 3, 5, 6, 8, 6, 5,  3, 1, 0, -1, 3, 1, 0, -1],
  },
  start() {
    if (this.running) return;
    ensureAudio();
    if (!audioCtx) return;
    this.ctx = audioCtx;
    // 总音量控制（调小避免太吵）
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    this.running = true;
    this.step = 0;
    this.nextTime = audioCtx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 90);
  },
  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },
  setZone(z) {
    if (this.zone !== z) { this.zone = z; this.step = 0; this.nextTime = audioCtx ? audioCtx.currentTime + 0.1 : 0; }
  },
  tick() {
    if (!this.running || !this.ctx) return;
    const s = this.scales[this.zone] || this.scales.grass;
    const mel = this.melodies[this.zone] || this.melodies.grass;
    const stepDur = 60 / s.tempo / 4;   // 十六分音符
    while (this.nextTime < this.ctx.currentTime + 0.28) {
      const t = this.nextTime;
      const st = this.step % 32;
      // 主旋律：三角波柔和音色，略拉长（连奏感）
      const deg = mel[st];
      if (deg >= 0) {
        const oct = Math.floor(deg / s.mode.length);
        const mid = s.root + s.mode[deg % s.mode.length] + oct * 12;
        this.note(midiNote(mid), stepDur * 1.7, t, 'triangle', 0.035);
      }
      // 低音每 4 步
      if (st % 4 === 0) this.note(midiNote(s.root - 12), stepDur * 3, t, 'triangle', 0.055);
      // 打击乐：弱化，响弦只在反拍
      if (st % 4 === 0) this.kick(t);
      if (st % 4 === 2) this.hat(t);
      this.step++;
      this.nextTime += stepDur;
    }
  },
  note(freq, dur, t, type, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master || this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  kick(t) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.master || this.ctx.destination);
    o.start(t); o.stop(t + 0.13);
  },
  hat(t) {
    if (!this.ctx) return;
    const dur = 0.04;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.014, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g); g.connect(this.master || this.ctx.destination);
    src.start(t);
  },
};

/* ---------------- 存档 ---------------- */

let state = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function defaultState() {
  const goals = [
    { id: uid(), name: '行测刷题 2 小时' },
    { id: uid(), name: '申论写作 1 篇' },
    { id: uid(), name: '常识时政背诵 30 分钟' },
  ];
  return {
    version: 1,
    goals,
    checkIns: {},               // { 'YYYY-MM-DD': [{ goalId, ts }, ...] } 一天可打卡多个目标
    signIns: {},                // { 'YYYY-MM-DD': ts } 每日签到
    claimedMilestones: [],      // 已领取的连续打卡里程碑
    battleLog: [],              // 讨伐战报（最近攻击记录）
    player: {
      level: 1, exp: 0, gold: 0, attacks: 0,
      hp: 100, mp: 30, down: false, makeup: 0,
      skills: [],
      equip: { weapon: null, armor: null, accessory: null },
      inventory: [],
    },
    boss: { stage: 1, dmg: 0, frozen: false },
    muted: false,
    bgmOn: false,
    celebrated: false,   // 是否已举办过讨伐魔王的凯旋庆典
  };
}
// 旧存档字段迁移与默认值补齐（loadState 与导入存档共用）
function migrateState() {
  // 兼容旧存档：单日单条打卡 → 单日多条数组
  Object.keys(state.checkIns || {}).forEach(k => {
    if (state.checkIns[k] && !Array.isArray(state.checkIns[k])) {
      state.checkIns[k] = [state.checkIns[k]];
    }
  });
  if (!state.signIns) state.signIns = {};
  if (!state.claimedMilestones) state.claimedMilestones = [];
  if (!state.battleLog) state.battleLog = [];
  if (!state.player) state.player = {};
  if (!state.player.equip) state.player.equip = { weapon: null, armor: null, accessory: null };
  if (!state.player.inventory) state.player.inventory = [];
  if (typeof state.player.attacks !== 'number') state.player.attacks = 0;
  if (typeof state.player.hp !== 'number') state.player.hp = playerHp();
  if (typeof state.player.mp !== 'number') state.player.mp = playerMaxMp();
  if (!state.player.down) state.player.down = false;
  if (!state.player.skills) state.player.skills = [];
  if (typeof state.player.makeup !== 'number') state.player.makeup = 0;   // 补签卡数量
  if (!state.boss) state.boss = { stage: 1, dmg: 0, frozen: false };
  if (!state.boss.frozen) state.boss.frozen = false;
  if (typeof state.bgmOn !== 'boolean') state.bgmOn = false;
  if (state.celebrated !== true) state.celebrated = false;
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      migrateState();
      return;
    }
  } catch (e) { /* 存档损坏则重建 */ }
  state = defaultState();
  saveState();
}
function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
}

/* ---------------- 存档导出 / 导入 ---------------- */

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rpg-save-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  SFX.click();
  floatText('存档已导出 📤', $('pGold'));
}
function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.goals || !parsed.checkIns || !parsed.player || !parsed.boss) {
        throw new Error('格式不正确');
      }
      state = parsed;
      migrateState();
      saveState();
      renderAll();
      SFX.loot();
      showReward('📥 导入成功！', `<div class="res-row">存档已恢复：LV ${state.player.level} · 🪙 ${state.player.gold} · 总打卡 ${totalCheckIns()} 天</div>`);
    } catch (e) {
      askConfirm('导入失败：文件内容不是有效的存档数据。\n请选择之前导出的 JSON 备份文件。', () => {});
    }
  };
  reader.readAsText(file);
}

/* ---------------- 日期工具 ---------------- */

const pad = n => String(n).padStart(2, '0');
function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() { return dateStr(new Date()); }

/* ---------------- 数值计算 ---------------- */

function expToNext(lv) { return Math.floor(50 * Math.pow(lv, 1.35)); }
function playerAtk() {
  const w = state.player.equip.weapon;
  return 5 + (state.player.level - 1) * 2 + (w ? w.atk : 0);
}
function playerHp() {
  const a = state.player.equip.armor;
  return 100 + (state.player.level - 1) * 12 + (a ? a.hp : 0);
}
function playerMaxMp() { return 30 + (state.player.level - 1) * 4; }
function expPct() {
  const ac = state.player.equip.accessory;
  return ac ? ac.expPct : 0;
}
function bossConfig() {
  const idx = Math.min(state.boss.stage - 1, BOSSES.length - 1);
  const base = BOSSES[idx];
  const cycle = Math.floor((state.boss.stage - 1) / BOSSES.length);
  const mul = Math.pow(1.4, cycle);
  return {
    name: cycle > 0 ? `轮回${cycle}·${base.name}` : base.name,
    maxHp: Math.floor(base.maxHp * mul),
  };
}
// 当前区域：由魔王阶段决定
function currentZone() {
  let z = ZONES[0];
  ZONES.forEach(zn => { if (state.boss.stage >= zn.minStage) z = zn; });
  return z;
}
// 打卡攻击伤害（受等级与武器加成）
function hitDamage() {
  const w = state.player.equip.weapon;
  return 1 + Math.floor((state.player.level - 1) / 4) + (w ? Math.floor(w.atk / 10) : 0);
}
// 里程碑奖励的攻击次数
function milestoneAttacks(m) { return 5 + Math.floor(m / 7); }
// 暴击判定
function attack(dmg) {
  const crit = Math.random() < CRIT_RATE;
  return { dmg: crit ? dmg * 2 : dmg, crit };
}
// 将指定伤害结算到魔王身上，返回 { dmg, crit, defeated, name }
function applyBossDamage(dmg, crit) {
  const cfg = bossConfig();
  state.boss.dmg += dmg;
  const r = { dmg, crit: !!crit, defeated: false, name: cfg.name };
  if (state.boss.dmg >= cfg.maxHp) {
    r.defeated = true;
    state.boss.dmg = 0;
    const oldStage = state.boss.stage;
    state.boss.stage++;
    // 击败每一轮的最终魔王 → 播放凯旋庆典动画
    if (oldStage % BOSSES.length === 0) playVictory();
  }
  return r;
}
// 对魔王造成一次平A攻击
function hitBoss(dmg) {
  const a = attack(dmg);
  return applyBossDamage(a.dmg, a.crit);
}
// 魔王被讨伐的额外奖励
function bossDefeatLoot() {
  state.player.gold += 60;
  return collect(forceLoot(Math.random() < 0.6 ? 'epic' : 'legend'));
}
// 增加经验并处理升级（升级时 HP/MP 全恢复）
function gainExp(amount) {
  let lvups = 0;
  state.player.exp += amount;
  while (state.player.exp >= expToNext(state.player.level)) {
    state.player.exp -= expToNext(state.player.level);
    state.player.level++;
    state.player.hp = playerHp();
    state.player.mp = playerMaxMp();
    state.player.down = false;
    lvups++;
  }
  return lvups;
}
// 随机技能书
function randomSkillItem() {
  const def = SKILLS[Math.floor(Math.random() * SKILLS.length)];
  return Object.assign({}, def, { id: uid(), type: 'skill' });
}
// 学习技能：已学会则转化为金币
function learnSkill(def) {
  if (state.player.skills.some(s => s.name === def.name)) {
    state.player.gold += 50;
    return { learned: false, gold: 50 };
  }
  state.player.skills.push(def);
  return { learned: true, gold: 0 };
}
// 打卡/签到小概率掉落技能书
function maybeDropSkill(drops) {
  if (Math.random() >= 0.2) return;
  const def = randomSkillItem();
  const r = learnSkill(def);
  drops.push({ item: def, learned: r.learned, gold: r.gold, equipped: false });
}
// 魔王反击：20% 概率；冰冻时免反击；返回伤害或 null
function bossCounterattack() {
  if (state.boss.frozen) { state.boss.frozen = false; return null; }
  if (Math.random() >= COUNTER_RATE) return null;
  const dmg = 2 + state.boss.stage * 2;
  state.player.hp = Math.max(0, state.player.hp - dmg);
  if (state.player.hp <= 0) state.player.down = true;
  pushLog({ src: '魔王反击', dmg, crit: false, enemy: true });
  return dmg;
}
// 截至某日的连续打卡天数（用于日历连击火苗）
function streakUntil(ds) {
  const p = ds.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  let c = 0;
  while (dateRecords(dateStr(d)).length) { c++; d.setDate(d.getDate() - 1); }
  return c;
}
// 记录一条讨伐战报
function pushLog(entry) {
  state.battleLog = state.battleLog || [];
  entry.date = todayStr();
  state.battleLog.unshift(entry);
  if (state.battleLog.length > 8) state.battleLog.length = 8;
}

// 连续打卡天数：今天已打卡则从今天往前数，否则从昨天往前数
function getStreak() {
  const d = new Date();
  if (!state.checkIns[dateStr(d)]) d.setDate(d.getDate() - 1);
  let c = 0;
  while (state.checkIns[dateStr(d)]) { c++; d.setDate(d.getDate() - 1); }
  return c;
}
function dateRecords(ds) { return state.checkIns[ds] || []; }
function todayRecords() { return dateRecords(todayStr()); }
function goalDoneToday(goalId) { return todayRecords().some(r => r.goalId === goalId); }
function goalCount(goalId) {
  let c = 0;
  Object.values(state.checkIns).forEach(arr => arr.forEach(r => { if (r.goalId === goalId) c++; }));
  return c;
}
function totalCheckIns() {
  let c = 0;
  Object.values(state.checkIns).forEach(arr => c += arr.length);
  return c;
}
// 签到连续天数（今天已签则含今天，否则从昨天往前数）
function signStreak() {
  const d = new Date();
  if (!state.signIns[dateStr(d)]) d.setDate(d.getDate() - 1);
  let c = 0;
  while (state.signIns[dateStr(d)]) { c++; d.setDate(d.getDate() - 1); }
  return c;
}
// 签到周期位置 1..7
function signCyclePos() {
  const signedToday = !!state.signIns[todayStr()];
  const streak = signStreak();
  return signedToday ? ((streak - 1) % 7) + 1 : (streak % 7) + 1;
}

/* ---------------- 掉落 ---------------- */

function rank(r) { return RARITY_ORDER.indexOf(r); }

function randomType() {
  const t = Math.random();
  if (t < 0.35) return 'weapon';
  if (t < 0.65) return 'armor';
  if (t < 0.85) return 'accessory';
  return 'trophy';
}
function forceLoot(rarity) {
  const type = randomType();
  const pool = ITEM_POOL[type].filter(i => i.rarity === rarity);
  const item = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
  item.id = uid();
  item.type = type;
  return item;
}
function rollLoot() {
  const r = Math.random();
  let rarity;
  if (r < 0.50) rarity = 'common';
  else if (r < 0.78) rarity = 'fine';
  else if (r < 0.92) rarity = 'rare';
  else if (r < 0.98) rarity = 'epic';
  else rarity = 'legend';
  return forceLoot(rarity);
}

// 自动装备：同类型更高品质才替换；战利品直接进背包
function equipOrStore(item) {
  if (item.type === 'trophy') {
    state.player.inventory.push(item);
    return false;
  }
  const slot = state.player.equip[item.type];
  if (!slot || rank(item.rarity) >= rank(slot.rarity)) {
    if (slot) state.player.inventory.push(slot);
    state.player.equip[item.type] = item;
    return true;
  }
  state.player.inventory.push(item);
  return false;
}
// 拾取物品并自动装备/入包，返回展示用结果
function collect(item) { return { item, equipped: equipOrStore(item) }; }

/* ---------------- 打卡主流程 ---------------- */

// 给指定目标打卡（一天可给多个目标各打卡一次）
function doCheckin(goalId) {
  const today = todayStr();
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal || goalDoneToday(goalId)) return;

  // 记录打卡
  if (!state.checkIns[today]) state.checkIns[today] = [];
  state.checkIns[today].push({ goalId: goal.id, ts: Date.now() });
  const order = state.checkIns[today].length;   // 当天第几个目标

  const streak = getStreak();
  const first = order === 1;

  // 经验 / 金币：当天第 1 个目标最丰厚，之后递减
  const base = first ? 40 : (order === 2 ? 28 : 20);
  let exp = Math.floor((base + Math.min(streak, 7) * (first ? 8 : 3)) * (1 + expPct() / 100));
  const gold = (first ? 6 : (order === 2 ? 4 : 3)) + Math.floor(Math.random() * 7) + Math.min(streak, 7) * (first ? 2 : 1);
  state.player.gold += gold;

  // 掉落（越往后概率越低）
  const drops = [];
  const chance = first ? 0.6 : (order === 2 ? 0.45 : 0.3);
  if (Math.random() < chance) drops.push(collect(rollLoot()));
  maybeDropSkill(drops);   // 小概率掉落技能书

  // 获得攻击次数与蓝量（攒着手动攻击魔王 / 施放技能）
  const attacks = first ? 3 : 2;
  state.player.attacks += attacks;
  const mpGain = 10;
  state.player.mp = Math.min(playerMaxMp(), state.player.mp + mpGain);

  // 连续打卡里程碑大奖
  const milestoneResults = [];
  const newMilestones = MILESTONES.filter(m => streak >= m && !state.claimedMilestones.includes(m));
  newMilestones.forEach(m => {
    state.claimedMilestones.push(m);
    const mg = 30 + m * 2;
    const me = 50 + m * 3;
    state.player.gold += mg;
    exp += me;
    drops.push(collect(forceLoot(m >= 30 ? 'epic' : (m >= 14 ? 'rare' : 'fine'))));
    // 里程碑奖励攻击次数
    const ma = milestoneAttacks(m);
    state.player.attacks += ma;
    milestoneResults.push({ m, gold: mg, exp: me, attacks: ma });
  });

  // 升级结算（包含所有经验来源）
  const lvups = gainExp(exp);

  saveState();
  renderAll();

  if (!state.muted) {
    ensureAudio();
    SFX.checkin();
    if (drops.length) setTimeout(SFX.loot, 350);
    if (lvups > 0) setTimeout(SFX.levelup, 650);
  }
  floatText(`+${exp} EXP`, heroSpriteEl);

  showReward('✨ 修炼完成！', buildCheckinResult({
    goalName: goal.name, order, exp, gold, attacks, mpGain, drops, lvups, streak, milestoneResults,
  }));
}

// 每日签到（7 天一轮奖励）
function doSignIn() {
  const today = todayStr();
  if (state.signIns[today]) return;
  state.signIns[today] = Date.now();

  const pos = signCyclePos();
  const r = SIGNIN_REWARDS[pos];
  const drops = [];
  let exp = r.exp;
  state.player.gold += r.gold;
  if (r.item) drops.push(collect(forceLoot(r.item)));
  maybeDropSkill(drops);   // 小概率掉落技能书

  // 签到获得攻击次数与蓝量
  state.player.attacks += 2;
  const mpGain = 10;
  state.player.mp = Math.min(playerMaxMp(), state.player.mp + mpGain);

  // 升级结算
  const lvups = gainExp(exp);

  saveState();
  renderAll();

  if (!state.muted) {
    ensureAudio();
    SFX.signin();
    if (drops.length) setTimeout(SFX.loot, 300);
    if (lvups > 0) setTimeout(SFX.levelup, 600);
  }
  floatText(`+${r.gold} 🪙`, heroSpriteEl);

  showReward('📆 签到成功！', buildSigninResult({
    pos, gold: r.gold, exp, mpGain, drops, lvups, signedDays: signStreak(),
  }));
}

// 手动攻击魔王（消耗 1 次攻击次数）
function attackBoss() {
  if (state.player.attacks <= 0 || state.player.hp <= 0) return;
  state.player.attacks--;
  const hit = hitBoss(hitDamage());
  const drops = [];
  if (hit.defeated) drops.push(bossDefeatLoot());
  pushLog({ src: '勇者攻击', dmg: hit.dmg, crit: hit.crit });

  // 魔王反击
  let counter = null;
  if (!hit.defeated) counter = bossCounterattack();

  saveState();
  renderAll();
  shakeBoss();
  flashBossHp();
  floatDamage(`-${hit.dmg}${hit.crit ? ' 暴击！' : ''}`, hit.crit);
  if (counter) floatCounter(counter);

  if (!state.muted) {
    ensureAudio();
    SFX.checkin();
    if (hit.crit) setTimeout(SFX.loot, 250);
    if (counter) setTimeout(SFX.ouch, 400);
    if (hit.defeated) setTimeout(SFX.defeat, 600);
  }

  if (hit.defeated) {
    showReward('🏆 讨伐成功！', buildAttackResult({ hit, drops }));
  }
}

// 施放技能：消耗 1 次攻击 + 蓝量
function castSkill(skillId) {
  const sk = state.player.skills.find(s => s.id === skillId);
  if (!sk) return;
  if (state.player.attacks <= 0 || state.player.mp < sk.mp || state.player.hp <= 0) return;
  state.player.attacks--;
  state.player.mp -= sk.mp;

  // 伤害与暴击
  let dmg = Math.floor(hitDamage() * sk.mult);
  let crit = false;
  if (sk.effect === 'crit') { crit = true; dmg *= 2; }
  else if (Math.random() < CRIT_RATE) { crit = true; dmg *= 2; }

  // 特殊效果
  const healAmt = sk.effect === 'heal' ? Math.floor(playerHp() * 0.2) : 0;
  const manaAmt = sk.effect === 'mana' ? 30 : 0;

  const hit = applyBossDamage(dmg, crit);
  const drops = [];
  if (hit.defeated) drops.push(bossDefeatLoot());
  pushLog({ src: sk.name, dmg: hit.dmg, crit: hit.crit });

  // 自身恢复
  if (healAmt) state.player.hp = Math.min(playerHp(), state.player.hp + healAmt);
  if (manaAmt) state.player.mp = Math.min(playerMaxMp(), state.player.mp + manaAmt);

  // 魔王反击（若此前已被冰冻，此处消耗冰冻免反击）
  let counter = null;
  if (!hit.defeated) counter = bossCounterattack();

  // 冰霜新星：本次施法后冰冻魔王，下一次攻击免反击
  if (sk.effect === 'freeze') state.boss.frozen = true;

  saveState();
  renderAll();
  shakeBoss();
  flashBossHp();
  floatSkill(sk);
  floatDamage(`-${hit.dmg}${crit ? ' 暴击！' : ''}`, crit);
  if (healAmt) floatText(`+${healAmt} ❤`, heroSpriteEl);
  if (manaAmt) floatText(`+${manaAmt} 💧`, heroSpriteEl);
  if (counter) floatCounter(counter);

  if (!state.muted) {
    ensureAudio();
    SFX.skill();
    if (crit) setTimeout(SFX.loot, 250);
    if (counter) setTimeout(SFX.ouch, 450);
    if (hit.defeated) setTimeout(SFX.defeat, 700);
  }

  if (hit.defeated) {
    showReward('🏆 讨伐成功！', buildAttackResult({ hit, drops }));
  }
}

function buildAttackResult(r) {
  let h = '';
  h += `<div class="res-row res-boss">⚔ 对「${r.hit.name}」造成 ${r.hit.dmg} 点伤害${r.hit.crit ? '（暴击！）' : ''}！</div>`;
  h += `<div class="res-defeat">🏆「${r.hit.name}」被讨伐了！</div>`;
  h += `<div class="res-row">🪙 获得讨伐奖励金币 +60</div>`;
  r.drops.forEach(d => h += itemLine(d));
  h += `<div class="res-row">🗡 剩余攻击次数：${state.player.attacks}</div>`;
  return h;
}

/* ---------------- 渲染 ---------------- */

const $ = id => document.getElementById(id);
let heroSpriteEl = null;
let bossSpriteEl = null;

function initSprites() {
  heroSpriteEl = makeSprite(HERO_ROWS, HERO_PAL, 5);
  $('heroSprite').appendChild(heroSpriteEl);
  bossSpriteEl = makeSprite(BOSS_ROWS, BOSS_PAL, 6);
  $('bossSprite').appendChild(bossSpriteEl);
}

function shakeBoss() {
  const el = $('bossSprite');
  el.classList.remove('shake');
  void el.offsetWidth; // 重新触发动画
  el.classList.add('shake');
}
// 魔王血条受击闪动
function flashBossHp() {
  const f = $('bossHpFill');
  f.classList.remove('hit');
  void f.offsetWidth;
  f.classList.add('hit');
}
// 魔王头顶伤害飘字
function floatDamage(text, crit) {
  const el = document.createElement('div');
  el.className = 'float-text dmg' + (crit ? ' crit' : '');
  el.textContent = text;
  document.body.appendChild(el);
  const r = bossSpriteEl.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2 - 24 + (Math.random() * 40 - 20)) + 'px';
  el.style.top = (r.top - 6) + 'px';
  setTimeout(() => el.remove(), 1350);
}
// 技能名飘字（勇者头顶）
function floatSkill(sk) {
  const el = document.createElement('div');
  el.className = 'float-text skill ' + sk.type;
  el.textContent = `${sk.icon} ${sk.name}！`;
  document.body.appendChild(el);
  const r = heroSpriteEl.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2 - 45) + 'px';
  el.style.top = (r.top - 12) + 'px';
  setTimeout(() => el.remove(), 1350);
}
// 魔王反击飘字（勇者头顶）
function floatCounter(dmg) {
  const el = document.createElement('div');
  el.className = 'float-text counter';
  el.textContent = `💢 魔王反击 -${dmg}`;
  document.body.appendChild(el);
  const r = heroSpriteEl.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2 - 35 + (Math.random() * 30 - 15)) + 'px';
  el.style.top = (r.top + 10) + 'px';
  setTimeout(() => el.remove(), 1400);
}
function floatText(text, anchor) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2 - 30) + 'px';
  el.style.top = (r.top - 8) + 'px';
  setTimeout(() => el.remove(), 1350);
}

function renderAll() {
  renderCalendar();
  renderStats();
  renderPlayer();
  renderBoss();
  updateScene();
  renderBattleLog();
  renderGoalList();
  renderTodayGoals();
  renderSignin();
  renderSkills();
  renderEquip();
  renderInventory();
}

/* ----- 日历 ----- */
let calYear, calMonth;
function initCalendar() {
  const d = new Date();
  calYear = d.getFullYear();
  calMonth = d.getMonth();
}
function renderCalendar() {
  $('calTitle').textContent = `${calYear}年 ${calMonth + 1}月`;
  $('nextMonth').disabled = (calYear > new Date().getFullYear()) ||
    (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth());

  const first = new Date(calYear, calMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();
  const cells = [];

  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell blank"></div>');

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const recs = dateRecords(ds);
    const checked = recs.length > 0;
    let cls = 'cal-cell';
    let canMakeup = false;
    if (checked) cls += ' done';
    else if (ds < today) { cls += ' missed'; canMakeup = state.player.makeup > 0; }
    else if (ds > today) cls += ' locked';
    else cls += ' today';
    if (canMakeup) cls += ' can-makeup';

    let tip = '';
    if (checked) {
      const names = recs.map(r => {
        const g = state.goals.find(x => x.id === r.goalId);
        return r.goalId === 'makeup' ? '补签' : (g ? g.name : '未知目标');
      });
      tip = `完成：${names.join('、')}`;
    } else if (ds === today) {
      tip = '今天';
    } else if (ds > today) {
      tip = '尚未到来';
    } else {
      tip = state.player.makeup > 0 ? '漏打卡了…点击补签' : '漏打卡了…';
    }
    let cell = `<div class="${cls}" data-ds="${ds}" title="${tip}">${d}`;
    if (checked && streakUntil(ds) >= 2) cell += '<i class="flame-mark">🔥</i>';
    cell += '</div>';
    cells.push(cell);
  }
  $('calGrid').innerHTML = cells.join('');
  $('makeupCount').textContent = state.player.makeup;
}

/* ----- 月度统计 ----- */
function renderStats() {
  const el = $('statsContent');
  if (!el) return;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();
  // 已过去天数（当月取到今天，过去月份取全月）
  const now = new Date();
  let elapsed = daysInMonth;
  if (calYear === now.getFullYear() && calMonth === now.getMonth()) {
    elapsed = now.getDate();
  } else if (calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth())) {
    elapsed = 0; // 未来月份
  }
  // 统计本月的打卡天数与次数
  let checkedDays = 0, totalTimes = 0, signDays = 0;
  const goalCounts = {};
  state.goals.forEach(g => { goalCounts[g.id] = 0; });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const recs = dateRecords(ds);
    if (recs.length) {
      checkedDays++;
      totalTimes += recs.length;
      recs.forEach(r => { if (r.goalId !== 'makeup' && goalCounts[r.goalId] !== undefined) goalCounts[r.goalId]++; });
    }
    if (state.signIns[ds]) signDays++;
  }
  const rate = elapsed > 0 ? Math.round(checkedDays / elapsed * 100) : 0;
  // 目标完成排行（本月，取前 5）
  const ranking = Object.keys(goalCounts)
    .map(id => ({ name: (state.goals.find(g => g.id === id) || {}).name || '未知', count: goalCounts[id] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxRank = ranking.length ? ranking[0].count : 1;

  let html = `
    <div class="stats-grid">
      <div class="stat-cell"><b>${checkedDays}</b><span>打卡天数</span></div>
      <div class="stat-cell"><b>${totalTimes}</b><span>完成次数</span></div>
      <div class="stat-cell"><b>${rate}%</b><span>本月打卡率</span></div>
      <div class="stat-cell"><b>${signDays}</b><span>签到天数</span></div>
    </div>`;
  if (ranking.length) {
    html += '<div class="stats-rank">' + ranking.map(x => `
      <div class="rank-row">
        <span class="rank-name">${x.name}</span>
        <span class="rank-bar"><i style="width:${Math.max(6, Math.round(x.count / maxRank * 100))}%"></i></span>
        <span class="rank-num">×${x.count}</span>
      </div>`).join('') + '</div>';
  } else {
    html += '<div class="stats-empty">本月还没有打卡记录，加油讨伐魔王吧！</div>';
  }
  el.innerHTML = html;
}

/* ----- 勇者面板 ----- */
function renderPlayer() {
  $('pLevel').textContent = state.player.level;
  $('pAtk').textContent = playerAtk();
  $('pGold').textContent = state.player.gold;
  $('pAttacks').textContent = state.player.attacks;

  const need = expToNext(state.player.level);
  $('expFill').style.width = Math.min(100, state.player.exp / need * 100) + '%';
  $('expText').textContent = `${state.player.exp}/${need}`;

  // HP / MP 条
  const maxHp = playerHp();
  const maxMp = playerMaxMp();
  state.player.hp = Math.max(0, Math.min(maxHp, state.player.hp));
  state.player.mp = Math.max(0, Math.min(maxMp, state.player.mp));
  $('hpFill').style.width = (state.player.hp / maxHp * 100) + '%';
  $('hpText').textContent = `${state.player.hp}/${maxHp}`;
  $('mpFill').style.width = (state.player.mp / maxMp * 100) + '%';
  $('mpText').textContent = `${state.player.mp}/${maxMp}`;

  // 倒地状态：由 HP 推导（HP>0 即视为未倒地，自动校正历史存档里的卡死状态）
  state.player.down = state.player.hp <= 0;
  const banner = $('downBanner');
  if (state.player.down) {
    banner.classList.remove('hidden');
    banner.textContent = '💀 勇者倒下了！快去澡堂泡温泉或用红药水恢复！';
  } else {
    banner.classList.add('hidden');
  }

  const streak = getStreak();
  $('streakFlame').textContent = `🔥 连续 ${streak} 天`;
  $('streakFlame').style.color = streak >= 3 ? '#ffb347' : streak > 0 ? '#ffd58a' : '#9aa3b5';
  $('totalDays').textContent = `📅 总打卡 ${totalCheckIns()} 天`;
}

/* ----- 魔王面板 ----- */
function renderBoss() {
  const cfg = bossConfig();
  $('bossName').textContent = cfg.name;
  const pct = Math.min(100, state.boss.dmg / cfg.maxHp * 100);
  $('bossHpFill').style.width = pct + '%';
  $('bossHpText').textContent = `${state.boss.dmg} / ${cfg.maxHp}`;
  $('bossStageText').textContent = `第 ${state.boss.stage} 阶 · 每次攻击 -${hitDamage()} · ${Math.round(CRIT_RATE * 100)}% 暴击` + (state.boss.frozen ? ' · 🧊 魔王被冰冻' : '');
  // 攻击次数与按钮状态
  $('attackCount').textContent = state.player.attacks;
  const btn = $('attackBtn');
  btn.disabled = state.player.attacks <= 0;
  btn.textContent = state.player.attacks > 0 ? `⚔ 攻击魔王（剩余 ${state.player.attacks} 次）` : '⚔ 攻击魔王（没有次数）';
}

/* ----- 讨伐战报 ----- */
function renderBattleLog() {
  const el = $('battleLog');
  const log = state.battleLog || [];
  if (!log.length) {
    el.innerHTML = '<div class="log-empty">还没有攻击记录，去打卡讨伐魔王吧！</div>';
    return;
  }
  el.innerHTML = log.map(e => `<div class="log-row">
    <span class="log-date">${e.date.slice(5)}</span>
    <span class="log-src">${e.enemy ? '💢 ' : ''}${e.src}</span>
    <span class="log-dmg ${e.enemy ? 'enemy' : (e.crit ? 'crit' : '')}">-${e.dmg}${e.crit ? ' 暴击！' : ''}</span>
  </div>`).join('');
}

/* ----- 目标清单 ----- */
function renderGoalList() {
  const ul = $('goalList');
  if (!state.goals.length) {
    ul.innerHTML = '<div class="goal-empty">还没有目标，先立一个吧！</div>';
    return;
  }
  ul.innerHTML = state.goals.map(g => `
    <li data-id="${g.id}">
      <span class="gname">${g.name}</span>
      <span class="gcount">×${goalCount(g.id)}</span>
      <button class="gdel" data-id="${g.id}" title="删除目标">🗑</button>
    </li>`).join('');
}

/* ----- 今日目标（可逐个打卡） ----- */
function renderTodayGoals() {
  const wrap = $('todayGoalList');
  const hint = $('todayGoalHint');
  if (!state.goals.length) {
    wrap.innerHTML = '<div class="goal-empty">还没有目标，先去「目标清单」添加吧！</div>';
    hint.textContent = '';
    return;
  }
  hint.textContent = '完成一个目标，就给它打一次卡！';
  wrap.innerHTML = state.goals.map(g => {
    const done = goalDoneToday(g.id);
    return `<div class="tgoal ${done ? 'done' : ''}" data-id="${g.id}">
      <span class="gname">${g.name}</span>
      <span class="gcount">累计 ${goalCount(g.id)} 天</span>
      ${done ? '<span class="tg-done">✅ 今日完成</span>' : '<button class="pixel-btn small tg-btn">💪 打卡</button>'}
    </div>`;
  }).join('');
}

/* ----- 每日签到 ----- */
function renderSignin() {
  const signedToday = !!state.signIns[todayStr()];
  const pos = signCyclePos();
  let html = '';
  for (let i = 1; i <= 7; i++) {
    const r = SIGNIN_REWARDS[i];
    let cls = 'scell';
    if (i < pos || (signedToday && i <= pos)) cls += ' done';
    else if (i === pos) cls += signedToday ? ' done current' : ' current';
    else cls += ' locked';
    const tip = `第 ${i} 天：${r.gold} 金币 + ${r.exp} 经验${r.item ? ' + ' + RARITY[r.item].label + '装备' : ''}`;
    html += `<div class="scell ${cls}" title="${tip}">${i}</div>`;
  }
  $('signinCycle').innerHTML = html;

  const btn = $('signinBtn');
  const st = $('signinState');
  if (signedToday) {
    btn.disabled = true;
    btn.textContent = '✅ 今日已签到';
    st.textContent = `已连续签到 ${signStreak()} 天 · 今日奖励已领取`;
  } else {
    btn.disabled = false;
    btn.textContent = '✍️ 今日签到';
    st.textContent = `今日签到可得第 ${pos} 天奖励（已连续签到 ${signStreak()} 天）`;
  }
}

/* ----- 勇者技能 ----- */
function renderSkills() {
  const g = $('skillList');
  if (!state.player.skills.length) {
    g.innerHTML = '<div class="inv-empty">还没有技能……技能书会从打卡、签到、商店中掉落</div>';
    return;
  }
  g.innerHTML = state.player.skills.map(s => {
    const color = s.type === 'magic' ? 'var(--c-rare)' : '#ff8fa3';
    const can = state.player.attacks > 0 && state.player.mp >= s.mp && state.player.hp > 0;
    return `<button class="skill-btn${can ? '' : ' no'}" data-id="${s.id}" title="${s.desc}">
      <div class="sk-icon" style="color:${color}">${s.icon}</div>
      <div class="sk-name">${s.name}</div>
      <div class="sk-mp">💧${s.mp}</div>
    </button>`;
  }).join('');
}

/* ----- 装备栏 ----- */
function renderEquip() {
  ['weapon', 'armor', 'accessory'].forEach(t => {
    const el = $('slot-' + t);
    const it = state.player.equip[t];
    if (it) {
      el.innerHTML = `${TYPE_META[t].icon}<small>${it.name}</small>`;
      el.classList.add('has-item');
      el.title = `${it.name}（点击脱下）`;
    } else {
      el.innerHTML = `${TYPE_META[t].icon}<small>${TYPE_META[t].label}</small>`;
      el.classList.remove('has-item');
      el.title = '未装备';
    }
  });
}

// 脱下指定槽位的装备，放回背包
function unequipSlot(t) {
  const it = state.player.equip[t];
  if (!it) return;
  state.player.equip[t] = null;
  state.player.inventory.push(it);
  saveState();
  renderEquip();
  renderInventory();
  renderPlayer();
  floatText('已脱下', $('slot-' + t));
  SFX.click();
}

/* ----- 背包（已装备 + 未装备 + 战利品） ----- */
function renderInventory() {
  const g = $('invGrid');
  const inv = state.player.inventory;
  const equipped = ['weapon', 'armor', 'accessory']
    .map(t => state.player.equip[t]).filter(Boolean);
  if (!inv.length && !equipped.length) {
    g.innerHTML = '<div class="inv-empty">背包空空如也……继续打卡吧！</div>';
    return;
  }
  const itemHtml = (it, isEquipped) => {
    const meta = TYPE_META[it.type];
    let icon = meta ? meta.icon : (it.icon || '🎒');
    let stat = meta ? meta.label : '消耗品';
    let action = '';
    if (it.type === 'consumable') {
      stat = (it.hp ? `HP+${it.hp} ` : '') + (it.mp ? `MP+${it.mp}` : '');
      action = '<div class="inv-equip-btn">使用</div>';
    } else if (isEquipped) {
      if (it.atk) stat = `攻击+${it.atk}`;
      else if (it.hp) stat = `生命+${it.hp}`;
      else if (it.expPct) stat = `EXP+${it.expPct}%`;
      action = '<div class="inv-tag">已装备 · 点击脱下</div>';
    } else {
      if (it.atk) stat = `攻击+${it.atk}`;
      else if (it.hp) stat = `生命+${it.hp}`;
      else if (it.expPct) stat = `EXP+${it.expPct}%`;
      if (it.type !== 'trophy') action = '<div class="inv-equip-btn">装备</div>';
    }
    return `<div class="inv-item rarity-${it.rarity}${isEquipped ? ' equipped' : ''}" data-id="${it.id}">
      <div class="inv-icon">${icon}</div>
      <div class="inv-name">${it.name}</div>
      <div class="inv-stat">${stat} [${RARITY[it.rarity].label}]</div>
      ${action}
    </div>`;
  };
  g.innerHTML = equipped.map(it => itemHtml(it, true))
    .concat(inv.map(it => itemHtml(it, false)))
    .join('');
}

// 使用消耗品（药水）
function useConsumable(id) {
  const it = state.player.inventory.find(x => x.id === id);
  if (!it || it.type !== 'consumable') return;
  let text = '使用成功';
  if (it.hp) { state.player.hp = Math.min(playerHp(), state.player.hp + it.hp); text += ` +${it.hp}❤`; }
  if (it.mp) { state.player.mp = Math.min(playerMaxMp(), state.player.mp + it.mp); text += ` +${it.mp}💧`; }
  if (state.player.hp > 0) state.player.down = false;
  state.player.inventory = state.player.inventory.filter(x => x.id !== id);
  saveState();
  renderAll();
  floatText(text, heroSpriteEl);
  SFX.loot();
}

/* ----- 城镇设施 ----- */
let currentTown = 'shop';
function openTown(place) {
  currentTown = place;
  $('townTitle').textContent = {
    shop: '🏪 商店', bath: '♨️ 澡堂', train: '🏋️ 训练场', inn: '🏨 旅馆',
  }[place];
  let html = '';
  if (place === 'shop') {
    html = SHOP_ITEMS.map(i => `<div class="shop-item">
      <span class="shop-icon">${i.icon}</span>
      <span class="shop-info"><span class="shop-name">${i.name}</span><span class="shop-desc">${i.desc}</span></span>
      <button class="pixel-btn small shop-buy" data-id="${i.id}">🪙${i.price}</button>
    </div>`).join('') + `<div class="checkin-tip">你的金币：${state.player.gold}</div>`;
  } else if (place === 'bath') {
    html = `<div class="town-desc">♨️ 泡个温泉放松身心，生命与蓝量全部恢复！</div>
      <button class="pixel-btn big shop-buy" data-place-act="bath">泡温泉（50 金币）</button>
      <div class="checkin-tip">HP ${state.player.hp}/${playerHp()} · MP ${state.player.mp}/${playerMaxMp()} · 金币 ${state.player.gold}</div>`;
  } else if (place === 'train') {
    html = `<div class="town-desc">🏋️ 在训练场挥洒汗水，直接获得 60 点经验！</div>
      <button class="pixel-btn big shop-buy" data-place-act="train">特训（50 金币 · +60 经验）</button>
      <div class="checkin-tip">经验 ${state.player.exp}/${expToNext(state.player.level)} · 金币 ${state.player.gold}</div>`;
  } else {
    html = `<div class="town-desc">🏨 在旅馆好好休息一晚，恢复 5 次攻击次数！</div>
      <button class="pixel-btn big shop-buy" data-place-act="inn">休息（40 金币 · +5 攻击次数）</button>
      <div class="checkin-tip">攻击次数 ${state.player.attacks} · 金币 ${state.player.gold}</div>`;
  }
  $('townContent').innerHTML = html;
  showModal('townModal');
}

function buyShop(id) {
  const it = SHOP_ITEMS.find(x => x.id === id);
  if (!it) return;
  if (state.player.gold < it.price) { floatText('金币不足！', $('pGold')); return; }
  state.player.gold -= it.price;
  let msg = '';
  if (it.type === 'consumable') {
    state.player.inventory.push({ id: uid(), name: it.name, type: 'consumable', icon: it.icon, rarity: 'fine', hp: it.hp, mp: it.mp });
    msg = `购得「${it.name}」，已放入背包`;
  } else if (id === 'attacks') {
    state.player.attacks += 3;
    msg = '攻击次数 +3';
  } else if (id === 'makeup') {
    state.player.makeup++;
    msg = '补签卡 +1（点击日历上漏掉的日期即可补签）';
  } else if (id === 'skill_scroll') {
    const def = randomSkillItem();
    const r = learnSkill(def);
    msg = r.learned ? `学会技能「${def.name}」！` : `「${def.name}」已学会，转化为 +${r.gold} 金币`;
  } else if (id === 'equip_box') {
    const rr = Math.random() < 0.5 ? 'common' : Math.random() < 0.72 ? 'fine' : Math.random() < 0.86 ? 'rare' : Math.random() < 0.97 ? 'epic' : 'legend';
    const itm = forceLoot(rr);
    collect(itm);
    msg = `装备箱开出「${itm.name}」[${RARITY[rr].label}]`;
  }
  saveState();
  renderAll();
  openTown(currentTown);
  floatText(msg, $('townTitle'));
  SFX.loot();
}

function doTownAction(act) {
  if (act === 'bath') {
    if (state.player.gold < 50) { floatText('金币不足！', $('pGold')); return; }
    state.player.gold -= 50;
    state.player.hp = playerHp();
    state.player.mp = playerMaxMp();
    state.player.down = false;
  } else if (act === 'train') {
    if (state.player.gold < 50) { floatText('金币不足！', $('pGold')); return; }
    state.player.gold -= 50;
    gainExp(60);
  } else if (act === 'inn') {
    if (state.player.gold < 40) { floatText('金币不足！', $('pGold')); return; }
    state.player.gold -= 40;
    state.player.attacks += 5;
  }
  saveState();
  renderAll();
  openTown(currentTown);
  SFX.loot();
}

/* ---------------- 弹窗 ---------------- */

function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }

let confirmCb = null;
function askConfirm(text, cb) {
  $('confirmText').textContent = text;
  confirmCb = cb;
  showModal('confirmModal');
}

function itemDesc(it) {
  let s = '';
  if (it.atk) s = `攻击 +${it.atk}`;
  else if (it.hp) s = `生命 +${it.hp}`;
  else if (it.expPct) s = `经验 +${it.expPct}%`;
  return s;
}

function showReward(title, html) {
  $('resultTitle').textContent = title;
  $('resultContent').innerHTML = html;
  showModal('resultModal');
}

function itemLine(d) {
  const rc = RARITY[d.item.rarity];
  if (d.item.type === 'skill') {
    return `<div class="res-item" style="border-color:${rc.color}">
      <span style="color:${rc.color}">📖 ${d.item.name}</span>
      <span class="res-sub">[技能]${d.learned ? ' 学会了新技能！' : ' 已学会，转化为 +' + d.gold + ' 金币'}</span>
    </div>`;
  }
  const meta = TYPE_META[d.item.type];
  const desc = itemDesc(d.item);
  return `<div class="res-item" style="border-color:${rc.color}">
    <span style="color:${rc.color}">${meta.icon} ${d.item.name}</span>
    <span class="res-sub">[${rc.label}]${desc ? ' ' + desc : ''}${d.equipped ? ' ✨已自动装备' : ' → 存入背包'}</span>
  </div>`;
}

function buildCheckinResult(r) {
  let h = '';
  h += `<div class="res-row">🎯 目标：${r.goalName}（当天第 ${r.order} 个）</div>`;
  h += `<div class="res-row res-exp">✦ 获得经验 +${r.exp}</div>`;
  h += `<div class="res-row">🪙 获得金币 +${r.gold}</div>`;
  h += `<div class="res-row">🗡 获得攻击次数 +${r.attacks}（快去攻击魔王！）</div>`;
  h += `<div class="res-row">💧 恢复蓝量 +${r.mpGain}</div>`;
  h += `<div class="res-row">🔥 连续打卡 ${r.streak} 天</div>`;
  r.drops.forEach(d => h += itemLine(d));
  r.milestoneResults.forEach(m => {
    h += `<div class="res-milestone">🏅 达成「连续 ${m.m} 天」里程碑！+${m.gold} 金币 +${m.exp} 经验 +${m.attacks} 攻击次数</div>`;
  });
  if (r.lvups > 0) {
    h += `<div class="res-lvup">⭐ LEVEL UP ! 达到 LV ${state.player.level}</div>`;
  }
  return h;
}

function buildSigninResult(r) {
  let h = '';
  h += `<div class="res-row">📆 连续签到第 ${r.pos} 天（累计 ${r.signedDays} 天）</div>`;
  h += `<div class="res-row res-exp">✦ 获得经验 +${r.exp}</div>`;
  h += `<div class="res-row">🪙 获得金币 +${r.gold}</div>`;
  h += `<div class="res-row">🗡 获得攻击次数 +2（快去攻击魔王！）</div>`;
  h += `<div class="res-row">💧 恢复蓝量 +${r.mpGain}</div>`;
  r.drops.forEach(d => h += itemLine(d));
  if (r.lvups > 0) {
    h += `<div class="res-lvup">⭐ LEVEL UP ! 达到 LV ${state.player.level}</div>`;
  }
  return h;
}

/* ---------------- 场景背景（随区域变化） ---------------- */

let lastZone = null;

function updateScene() {
  const zone = currentZone();
  const zoneEl = $('zoneText');
  if (zoneEl) zoneEl.textContent = `🌍 当前区域：${zone.name} · 向着魔王领地前进！`;
  if (zone.id === lastZone) return;
  lastZone = zone.id;
  document.body.className = 'zone-' + zone.id;
  buildSceneParticles(zone.id);
  if (state.bgmOn && !state.muted) BGM.setZone(zone.id);
}

function buildSceneParticles(zoneId) {
  const scene = $('bgScene');
  const ground = scene.querySelector ? scene.querySelector('.ground') : null;
  scene.innerHTML = '';
  if (ground) scene.appendChild(ground);

  const add = (cls, style) => {
    const d = document.createElement('div');
    d.className = cls;
    if (style) Object.assign(d.style, style);
    scene.appendChild(d);
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  if (zoneId === 'grass') {
    for (let i = 0; i < 11; i++) add('tuft', { left: rnd(0, 96) + '%', bottom: rnd(1, 6) + '%', width: rnd(3, 5) + 'px', height: rnd(8, 16) + 'px', animationDelay: rnd(0, 2) + 's' });
    for (let i = 0; i < 3; i++) add('cloud', { top: rnd(4, 24) + '%', left: rnd(-10, 80) + '%', width: rnd(50, 90) + 'px', height: rnd(16, 24) + 'px', animationDuration: rnd(40, 70) + 's' });
  } else if (zoneId === 'forest') {
    for (let i = 0; i < 6; i++) add('tree', { right: rnd(2, 92) + '%', bottom: '0%', width: rnd(34, 60) + 'px', height: rnd(56, 92) + 'px', animationDelay: rnd(0, 1.6) + 's' });
    add('fog', {});
  } else if (zoneId === 'desert') {
    add('sun', {});
    for (let i = 0; i < 5; i++) add('cactus', { right: rnd(3, 92) + '%', bottom: '0%', width: rnd(12, 18) + 'px', height: rnd(36, 52) + 'px' });
  } else if (zoneId === 'snow') {
    for (let i = 0; i < 30; i++) add('snowflake', { left: rnd(0, 100) + '%', top: rnd(-10, -2) + '%', width: rnd(4, 7) + 'px', height: rnd(4, 7) + 'px', animationDelay: rnd(0, 6) + 's', animationDuration: rnd(5, 11) + 's' });
  } else if (zoneId === 'demon') {
    for (let i = 0; i < 26; i++) add('ember', { left: rnd(0, 100) + '%', bottom: rnd(-5, 8) + '%', animationDelay: rnd(0, 5) + 's', animationDuration: rnd(4, 9) + 's', width: rnd(3, 6) + 'px', height: rnd(3, 6) + 'px' });
    add('fog', {});
  }
}

/* ---------------- 事件绑定 ---------------- */

function addGoal() {
  const input = $('goalInput');
  const name = input.value.trim();
  if (!name) return;
  if (state.goals.length >= 12) { askConfirm('目标最多 12 个，先删掉一些吧。', () => {}); return; }
  state.goals.push({ id: uid(), name });
  input.value = '';
  saveState();
  renderGoalList();
  renderTodayGoals();
  SFX.click();
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  saveState();
  renderAll();
}

function doReset() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
  state = defaultState();
  saveState();
  renderAll();
}

// 补签：用 1 张补签卡补上过去某一天，恢复连续打卡并发放少量奖励
function doMakeup(ds) {
  if (state.player.makeup <= 0) return;
  if (dateRecords(ds).length) return;
  state.player.makeup--;
  if (!state.checkIns[ds]) state.checkIns[ds] = [];
  state.checkIns[ds].push({ goalId: 'makeup', ts: Date.now() });
  const exp = 20;
  state.player.gold += 10;
  gainExp(exp);
  saveState();
  renderAll();
  if (!state.muted) { ensureAudio(); SFX.checkin(); }
  floatText('补签成功 +20 EXP', $('calTitle'));
  showReward('📋 补签成功！', `<div class="res-row">已补签 <b>${ds}</b>，连续打卡记录已恢复。</div>
    <div class="res-row res-exp">+${exp} 经验</div>
    <div class="res-row">+10 金币</div>
    <div class="res-sub">补签不记入具体目标的完成次数</div>`);
}

/* ---------------- 胜利庆典（讨伐魔王后） ---------------- */

let victoryTimer = null, victoryTypeTimer = null, victoryOn = false;
const _sprCache = {};
const vSpr = (rows, pal, px) => {
  const key = rows[0] + rows.length + ':' + px + ':' + JSON.stringify(pal);
  return _sprCache[key] || (_sprCache[key] = makeSprite(rows, pal, px));
};
const vHeroC = () => vSpr(HERO_C_ROWS, HERO_C_PAL, 5);
const vKingC = () => vSpr(KING_ROWS, KING_PAL, 5);
const vPrincessC = () => vSpr(PRINCESS_ROWS, PRINCESS_PAL, 5);
const vCastleC = () => vSpr(CASTLE_ROWS, CASTLE_PAL, 4);
const vMedalC = () => vSpr(MEDAL_ROWS, MEDAL_PAL, 4);
const vFlowerC = () => vSpr(FLOWER_ROWS, FLOWER_PAL, 3);
const _personCache = {};
const vPersonC = color =>
  _personCache[color] || (_personCache[color] = makeSprite(CROWD_ROWS, Object.assign({}, CROWD_PAL, { T: color }), 3));

const VICTORY_SCENES = [
  { title: '🏰 凯旋归来', text: '魔王已被讨伐！勇者踏上归途，重返王国的土地…', art: 'welcome' },
  { title: '🎉 万人空巷', text: '人民夹道欢迎！鲜花与欢呼从城门一路涌向王宫。', art: 'crowd' },
  { title: '👑 册封荣誉', text: '国王亲自走下王座，为勇者颁发「王国守护骑士」勋章！', art: 'king' },
  { title: '💍 迎娶公主', text: '在万民的祝福声中，勇者迎娶了未婚妻——美丽的公主殿下！', art: 'wedding' },
];

function playVictory() {
  if (victoryOn) return;
  victoryOn = true;
  clearInterval(victoryTimer);
  showModal('victoryModal');
  if (!state.muted) { ensureAudio(); SFX.victory(); }
  let i = 0;
  const renderScene = idx => {
    const s = VICTORY_SCENES[idx];
    $('victoryTitle').textContent = s.title;
    typeText($('victoryText'), s.text);
    buildVictoryArt(s.art);
  };
  renderScene(0);
  victoryTimer = setInterval(() => {
    i++;
    if (i >= VICTORY_SCENES.length) {
      clearInterval(victoryTimer);
      victoryTimer = null;
      finishVictory();
      return;
    }
    renderScene(i);
  }, 4000);
}

// 文字打字机效果
function typeText(el, txt) {
  if (victoryTypeTimer) clearInterval(victoryTypeTimer);
  el.textContent = '';
  let i = 0;
  victoryTypeTimer = setInterval(() => {
    i++;
    el.textContent = txt.slice(0, i);
    if (i >= txt.length) { clearInterval(victoryTypeTimer); victoryTypeTimer = null; }
  }, 26);
}

function finishVictory() {
  if (victoryTimer) { clearInterval(victoryTimer); victoryTimer = null; }
  if (victoryTypeTimer) { clearInterval(victoryTypeTimer); victoryTypeTimer = null; }
  victoryOn = false;
  hideModal('victoryModal');
  // 首次讨伐魔王：颁发荣誉勋章（传说战利品）
  let html = '<div class="res-row">🎉 恭喜！你击败了最终魔王，王国迎来了和平！</div>';
  if (!state.celebrated) {
    state.celebrated = true;
    const medal = { id: uid(), name: '勇者勋章', type: 'trophy', icon: '🎖', rarity: 'legend' };
    collect(medal);
    html += `<div class="res-item" style="border-color:${RARITY.legend.color}">
      <span style="color:${RARITY.legend.color}">🎖 获得传说战利品「勇者勋章」！</span>
      <span class="res-sub">王国守护骑士的荣耀，已放入背包</span>
    </div>`;
  }
  html += '<div class="res-sub">魔王会轮回重生（血量提升），讨伐之路仍在继续…</div>';
  saveState();
  renderAll();
  if (!state.muted) { ensureAudio(); SFX.levelup(); }
  showReward('👑 圆满结局', html);
}

function buildVictoryArt(type) {
  const stage = $('victoryStage');
  stage.innerHTML = '';
  stage.className = 'victory-stage v-scene-' + type;
  const add = (cls, node) => {
    const d = document.createElement('div');
    d.className = cls;
    if (node) d.appendChild(node);
    stage.appendChild(d);
    return d;
  };
  const addSpr = (cls, canvas, extra) => {
    canvas.className = cls;
    if (extra) Object.assign(canvas.style, extra);
    stage.appendChild(canvas);
    return canvas;
  };
  const gen = (cls, n, fn) => {
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = cls;
      fn(d, i);
      stage.appendChild(d);
    }
  };

  if (type === 'welcome') {
    gen('v-cloud', 3, (d, i) => { d.style.top = (6 + i * 9) + '%'; d.style.animationDelay = (i * 6) + 's'; });
    addSpr('v-castle-spr', vCastleC());
    const walker = add('v-walker');
    walker.appendChild(vHeroC());
    const road = document.createElement('div'); road.className = 'v-road'; stage.appendChild(road);
    gen('v-flower-fall', 8, (d, i) => { d.style.left = (i * 12 + Math.random() * 6) + '%'; d.style.animationDelay = (Math.random() * 1.6) + 's'; d.appendChild(vFlowerC()); });
    gen('v-tuft-sm', 6, (d, i) => { d.style.left = (i * 17 + 3) + '%'; });
  } else if (type === 'crowd') {
    const bd = add('v-buildings');
    gen('v-building', 4, (d, i) => { d.style.left = (i * 26 - 5) + '%'; d.style.height = (56 + (i % 3) * 28) + 'px'; bd.appendChild(d); });
    add('v-banner', document.createTextNode('欢迎英雄归来'));
    addSpr('v-hero-center', vHeroC());
    const colors = ['#e0514e', '#6bc7ff', '#7ce38b', '#ffcd38', '#d58cff', '#f088b0'];
    for (let r = 0; r < 2; r++) {
      const row = add(r === 0 ? 'v-crowd v-crowd-back' : 'v-crowd');
      for (let i = 0; i < 11; i++) {
        const p = vPersonC(colors[(i + r * 3) % colors.length]);
        p.style.animationDelay = (i % 5) * 0.14 + 's';
        row.appendChild(p);
      }
    }
    gen('v-flower-fall', 8, (d, i) => { d.style.left = (i * 13) + '%'; d.style.animationDelay = (Math.random() * 1.2) + 's'; d.appendChild(vFlowerC()); });
  } else if (type === 'king') {
    const cols = add('v-columns');
    gen('v-column', 3, (d, i) => { d.style.left = (8 + i * 40) + '%'; cols.appendChild(d); });
    const dais = document.createElement('div'); dais.className = 'v-dais'; stage.appendChild(dais);
    addSpr('v-king-c', vKingC());
    addSpr('v-hero-kneel', vHeroC());
    addSpr('v-medal-spr', vMedalC());
    gen('v-sparkle', 6, (d, i) => { d.style.left = (i * 18 + 5) + '%'; d.style.animationDelay = (i * 0.25) + 's'; });
  } else if (type === 'wedding') {
    addSpr('v-hero-w', vHeroC());
    addSpr('v-princess-w', vPrincessC());
    const arch = add('v-arch');
    gen('v-arch-flower', 7, (d, i) => { d.style.left = (i * 17 - 2) + '%'; d.style.top = (i % 2 === 0 ? '-4px' : '10px'); arch.appendChild(d); });
    gen('v-heart', 6, (d, i) => { d.style.left = (i * 16 + 6) + '%'; d.style.animationDelay = (i * 0.4) + 's'; });
    gen('v-flower-fall', 6, (d, i) => { d.style.left = (i * 16 + 3) + '%'; d.style.animationDelay = (Math.random() * 1.4) + 's'; d.appendChild(vFlowerC()); });
    gen('v-flower-ground', 6, (d, i) => { d.style.left = (i * 16 + 4) + '%'; d.appendChild(vFlowerC()); });
  }
}

function initEvents() {
  // 日历翻页
  $('prevMonth').addEventListener('click', () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
    renderStats();
    SFX.click();
  });
  $('nextMonth').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
    renderStats();
    SFX.click();
  });

  // 日历点击：漏掉的日期可补签
  $('calGrid').addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell[data-ds]');
    if (!cell) return;
    const ds = cell.dataset.ds;
    const today = todayStr();
    if (dateRecords(ds).length || ds >= today) return;
    if (state.player.makeup <= 0) {
      askConfirm('漏掉的日期可以用补签卡补签，恢复连续打卡。\n补签卡可在商店购买（80 金币）。', () => {});
      return;
    }
    askConfirm(`使用 1 张补签卡补签 ${ds}？\n\n补签后该日计入连续打卡，并获得少量经验与金币。`, () => { ensureAudio(); doMakeup(ds); });
  });

  // 存档导出 / 导入
  $('exportBtn').addEventListener('click', () => { ensureAudio(); exportSave(); });
  $('importBtn').addEventListener('click', () => { $('importFile').click(); });
  $('importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importSave(f);
    e.target.value = '';
  });

  // 目标添加 / 删除
  $('addGoalBtn').addEventListener('click', () => { ensureAudio(); addGoal(); });
  $('goalInput').addEventListener('keydown', e => { if (e.key === 'Enter') { ensureAudio(); addGoal(); } });
  $('goalList').addEventListener('click', e => {
    const del = e.target.closest('.gdel');
    if (del) deleteGoal(del.dataset.id);
  });

  // 今日目标逐个打卡
  $('todayGoalList').addEventListener('click', e => {
    const row = e.target.closest('.tgoal[data-id]');
    if (!row || !e.target.closest('.tg-btn')) return;
    const goal = state.goals.find(g => g.id === row.dataset.id);
    if (!goal || goalDoneToday(goal.id)) return;
    askConfirm(`确认完成今日目标「${goal.name}」？\n\n打卡后可获得经验、金币与装备`, () => doCheckin(goal.id));
  });

  // 每日签到
  $('signinBtn').addEventListener('click', () => { ensureAudio(); doSignIn(); });

  // 手动攻击魔王
  $('attackBtn').addEventListener('click', () => { ensureAudio(); attackBoss(); });

  // 施放技能
  $('skillList').addEventListener('click', e => {
    const btn = e.target.closest('.skill-btn[data-id]');
    if (!btn) return;
    ensureAudio();
    castSkill(btn.dataset.id);
  });

  // 城镇设施
  $('townPanel').addEventListener('click', e => {
    const btn = e.target.closest('.town-btn[data-place]');
    if (!btn) return;
    ensureAudio();
    openTown(btn.dataset.place);
  });
  $('townContent').addEventListener('click', e => {
    const buy = e.target.closest('.shop-buy');
    if (!buy) return;
    if (buy.dataset.id) buyShop(buy.dataset.id);
    else if (buy.dataset.placeAct) doTownAction(buy.dataset.placeAct);
  });
  $('townClose').addEventListener('click', () => hideModal('townModal'));
  // 胜利庆典：点击画面跳过动画
  $('victoryModal').addEventListener('click', () => { if (victoryOn) finishVictory(); });

  $('confirmYes').addEventListener('click', () => {
    hideModal('confirmModal');
    if (confirmCb) { const cb = confirmCb; confirmCb = null; cb(); }
  });
  $('confirmNo').addEventListener('click', () => hideModal('confirmModal'));
  $('resultClose').addEventListener('click', () => hideModal('resultModal'));

  // 背包点击：消耗品→使用；已装备→脱下；未装备→换上
  $('invGrid').addEventListener('click', e => {
    const itemEl = e.target.closest('.inv-item[data-id]');
    if (!itemEl) return;
    const id = itemEl.dataset.id;

    // 消耗品 → 使用
    const cons = state.player.inventory.find(x => x.id === id);
    if (cons && cons.type === 'consumable') { useConsumable(id); return; }

    // 已装备的道具 → 脱下放回背包
    if (itemEl.classList.contains('equipped')) {
      for (const t of ['weapon', 'armor', 'accessory']) {
        const it = state.player.equip[t];
        if (it && it.id === id) { unequipSlot(t); return; }
      }
      return;
    }

    // 未装备的装备 → 换上
    const it = state.player.inventory.find(x => x.id === id);
    if (!it || it.type === 'trophy') return;
    const old = state.player.equip[it.type];
    if (old) state.player.inventory.push(old);
    state.player.equip[it.type] = it;
    state.player.inventory = state.player.inventory.filter(x => x.id !== id);
    saveState();
    renderEquip();
    renderInventory();
    renderPlayer();
    floatText('装备成功', $('slot-' + it.type));
    SFX.loot();
  });

  // 装备栏点击可脱下
  ['weapon', 'armor', 'accessory'].forEach(t => {
    $('slot-' + t).addEventListener('click', () => unequipSlot(t));
  });

  // 设置
  $('soundToggle').addEventListener('click', () => {
    state.muted = !state.muted;
    saveState();
    $('soundToggle').textContent = state.muted ? '🔇 静音' : '🔊 音效';
    if (state.muted) BGM.stop();
    else { ensureAudio(); if (state.bgmOn) BGM.start(); }
  });
  $('bgmToggle').addEventListener('click', () => {
    state.bgmOn = !state.bgmOn;
    saveState();
    $('bgmToggle').textContent = state.bgmOn ? '🎵 BGM:开' : '🎵 BGM:关';
    if (state.bgmOn && !state.muted) { ensureAudio(); BGM.setZone(currentZone().id); BGM.start(); }
    else BGM.stop();
  });
  $('resetBtn').addEventListener('click', () => {
    ensureAudio();
    askConfirm('确定要清空所有存档吗？\n等级、金币、装备、打卡记录将全部消失！\n此操作不可撤销！', doReset);
  });

  // 按钮点击音
  document.addEventListener('click', e => {
    if (e.target.closest('.pixel-btn') && !e.target.closest('#soundToggle') && !e.target.closest('#bgmToggle')) SFX.click();
  });

  // 勇者语录轮换
  let qi = Math.floor(Math.random() * QUOTES.length);
  const tipEl = $('dailyTip');
  tipEl.textContent = QUOTES[qi];
  setInterval(() => {
    qi = (qi + 1) % QUOTES.length;
    tipEl.style.opacity = 0;
    setTimeout(() => { tipEl.textContent = QUOTES[qi]; tipEl.style.opacity = 1; }, 300);
  }, 12000);
}

/* ---------------- 启动 ---------------- */

loadState();
initSprites();
initCalendar();
renderAll();
initEvents();

if (state.muted) $('soundToggle').textContent = '🔇 静音';
if (state.bgmOn) $('bgmToggle').textContent = '🎵 BGM:开';

// 预览彩蛋：网址加 ?demo=victory 可直接观看凯旋庆典动画
if (location.search.indexOf('demo=victory') !== -1) setTimeout(playVictory, 600);
