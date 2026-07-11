# 扫雷游戏新功能需求 - 完整方案

## 当前状态

### ✅ 已实现功能

1. **生存模式和连胜加成** - 已完成
   - 连续通关获得连胜加成
   - 公式：基础奖励 × (1 + 连胜数 × 0.2)
   - 失败后连胜清零

2. **每日签到系统** - 已完成
   - 可以识别日期变化（今天→明天）
   - `resetHour` 机制：可设置凌晨几点算新的一天（默认4点）
   - 连续签到天数追踪
   - 每日首胜奖励

3. **时间判断** - 已完成
   - `todayStr()` 函数获取当前日期
   - `getUserDate()` 函数考虑重置时间的日期
   - 自动识别跨天和新的一天

---

## 🆕 新增功能建议

### 3. 金币消耗点扩展

#### 当前已有：
- ✅ 道具商城（扫描、自动标记、时间冻结、拆弹、撤销）
- ✅ 皮肤商城（8种主题皮肤）
- ✅ 背景商城（5种动态背景）
- ✅ 音效包（4种音效）
- ✅ 特效包（4种粒子特效）
- ✅ BGM曲目（10首背景音乐）

#### 新增消费点：

**A. 头像装饰系统** 💎
```javascript
const AVATAR_FRAMES = {
  none: { name:'无边框', price:0, icon:'⭕' },
  bronze: { name:'青铜边框', price:100, icon:'🟤', tier:'bronze' },
  silver: { name:'白银边框', price:200, icon:'⚪', tier:'silver' },
  gold: { name:'黄金边框', price:300, icon:'🟡', tier:'gold' },
  platinum: { name:'白金边框', price:500, icon:'💎', tier:'platinum' },
  diamond: { name:'钻石边框', price:800, icon:'💠', tier:'diamond' },
  rainbow: { name:'彩虹边框', price:1000, icon:'🌈', tier:'king' },
  flame: { name:'烈焰边框', price:1200, icon:'🔥', tier:'king' },
  ice: { name:'寒冰边框', price:1200, icon:'❄️', tier:'king' },
  lightning: { name:'雷电边框', price:1500, icon:'⚡', tier:'legend' }
};
```
**预期收入：** 每个玩家平均消费 300-800 金币

**B. 称号系统** 🏆
```javascript
const TITLES = {
  none: { name:'无称号', price:0, icon:'' },
  rookie: { name:'萌新', price:50, icon:'🌱' },
  veteran: { name:'老司机', price:200, icon:'🚗' },
  master: { name:'大师', price:500, icon:'🎓' },
  legend: { name:'传奇', price:1000, icon:'⭐' },
  speedDemon: { name:'速度恶魔', price:800, icon:'💨' },
  perfect: { name:'完美主义', price:600, icon:'✨' },
  lucky: { name:'幸运之子', price:400, icon:'🍀' },
  hardcore: { name:'硬核玩家', price:1500, icon:'💀' }
};
```
**预期收入：** 每个玩家平均消费 200-600 金币

**C. 道具增强版** ⚡
```javascript
const ITEM_UPGRADES = {
  scan_plus: { 
    name:'高级扫描', 
    price:150, 
    icon:'🔍+', 
    desc:'扫描3×3区域', 
    requires:'scan' 
  },
  autoflag_pro: { 
    name:'智能标雷', 
    price:180, 
    icon:'🚩+', 
    desc:'自动标记所有能确定的雷', 
    requires:'autoflag' 
  },
  freeze_long: { 
    name:'长时冻结', 
    price:200, 
    icon:'⏸️+', 
    desc:'暂停计时30秒', 
    requires:'freeze' 
  },
  defuse_multi: { 
    name:'批量拆弹', 
    price:300, 
    icon:'💥+', 
    desc:'一次拆除3个地雷', 
    requires:'defuse' 
  },
  undo_infinite: { 
    name:'无限撤销', 
    price:2000, 
    icon:'↩️∞', 
    desc:'本局内无限次撤销', 
    requires:'undo' 
  }
};
```
**预期收入：** 高频玩家每场平均消费 100-200 金币

**D. VIP会员系统** 👑
```javascript
const VIP_TIERS = {
  vip1: { 
    name:'VIP 1', 
    price:500, 
    duration:7, // 天数
    benefits: [
      '每日签到金币 +50%',
      '游戏金币奖励 +20%',
      '商城道具 9折',
      '专属VIP标识'
    ]
  },
  vip2: { 
    name:'VIP 2', 
    price:1000, 
    duration:30,
    benefits: [
      '每日签到金币 +100%',
      '游戏金币奖励 +50%',
      '商城道具 8折',
      '专属VIP标识',
      '解锁专属皮肤',
      '每日免费道具×1'
    ]
  },
  vip3: { 
    name:'VIP 3 (永久)', 
    price:3000, 
    duration:999999,
    benefits: [
      '每日签到金币 +200%',
      '游戏金币奖励 +100%',
      '商城道具 7折',
      '专属VIP皇冠标识',
      '解锁所有专属皮肤',
      '每日免费道具×3',
      '无限云存档',
      '专属客服支持'
    ]
  }
};
```
**预期收入：** 10-20%玩家购买，单价高

**E. 复活机制** 💊
- 踩雷后可花费金币复活（价格递增）
  - 第1次复活：50金币
  - 第2次复活：100金币
  - 第3次复活：200金币
  - 第4次及以上：500金币

**F. 幸运抽奖系统** 🎰
```javascript
const GACHA_SYSTEM = {
  common: { // 普通抽奖
    price: 50,
    prizes: [
      { type:'coins', amount:20, weight:40 },
      { type:'coins', amount:50, weight:25 },
      { type:'item', id:'scan', count:1, weight:15 },
      { type:'item', id:'freeze', count:1, weight:10 },
      { type:'skin', id:'random', weight:8 },
      { type:'coins', amount:500, weight:2 } // 大奖
    ]
  },
  premium: { // 高级抽奖
    price: 200,
    prizes: [
      { type:'coins', amount:100, weight:30 },
      { type:'coins', amount:300, weight:20 },
      { type:'item', id:'defuse', count:2, weight:15 },
      { type:'item', id:'undo', count:1, weight:12 },
      { type:'skin', id:'rare', weight:10 },
      { type:'frame', id:'diamond', weight:8 },
      { type:'coins', amount:2000, weight:5 } // 大奖
    ]
  }
};
```
**预期收入：** 高频玩家每天消费 100-300 金币

**G. 排行榜系统入场费** 🏅
- 普通排行榜：免费查看
- 全球排行榜：每次查看 10 金币
- 创建私人排行榜：100 金币
- 加入联赛：200 金币/赛季

---

### 4. UI界面优化建议

#### 当前问题：
> "我希望整个UI界面更好看，不要整得像1986的游戏一样"

#### 改进方案：

**A. 现代化设计语言** 🎨
- ✅ 玻璃拟态（Glassmorphism）效果
- ✅ 柔和的阴影和圆角
- ✅ 流畅的动画过渡
- ✅ 渐变色彩运用

**B. 字体优化**
```css
font-family: 'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
```

**C. 配色方案升级**
- 默认主题已改为护眼的深蓝紫配色
- 柔和的强调色：`#5b9bd5` 和 `#7ec8a3`
- 避免过度饱和的颜色

**D. 动画效果**
```css
/* 平滑过渡 */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* 悬停效果 */
.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.2);
}

/* 点击反馈 */
.button:active {
  transform: scale(0.95);
}
```

**E. 响应式布局**
- 自适应屏幕尺寸
- 移动端优化触摸体验
- 平板横屏支持

**F. 微交互设计**
- ✅ 格子翻开有动画
- ✅ 按钮按下有反馈
- ✅ Toast通知有淡入淡出
- 添加：金币增加有数字跳动动画
- 添加：成就解锁有特效

---

### 5. 振动反馈系统 📳

```javascript
const Vibration = {
  // 成功振动
  success: () => {
    if (SAVE.vibration.enabled && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]); // 短-停-短
    }
  },
  
  // 错误振动
  error: () => {
    if (SAVE.vibration.enabled && navigator.vibrate) {
      navigator.vibrate([200]); // 长振动
    }
  },
  
  // 轻触振动
  tap: () => {
    if (SAVE.vibration.enabled && navigator.vibrate) {
      navigator.vibrate(10); // 极短
    }
  },
  
  // 标记振动
  flag: () => {
    if (SAVE.vibration.enabled && navigator.vibrate) {
      navigator.vibrate([30, 10, 30]); // 快速两次
    }
  },
  
  // 胜利振动
  win: () => {
    if (SAVE.vibration.enabled && navigator.vibrate) {
      navigator.vibrate([50, 50, 50, 50, 100]); // 庆祝效果
    }
  }
};
```

**使用场景：**
- 点击格子：轻触振动
- 标记旗子：标记振动
- 踩到雷：错误振动
- 通关：胜利振动
- 成就解锁：成功振动

---

### 6. 禅模式详细设计 🧘

#### 当前已有：
- ✅ zen-easy (9×9, 10雷)
- ✅ zen-normal (16×16, 40雷)
- ✅ zen-hard (24×24, 120雷)

#### 禅模式特点：
- ✅ 无计时器
- ✅ 无压力
- ✅ 固定金币奖励
- 添加：背景音乐自动切换到轻松音乐
- 添加：界面显示"正念计数器"（已揭示格子数）
- 添加：每日禅模式挑战（额外奖励）

#### 禅模式专属功能：
```javascript
const ZEN_FEATURES = {
  // 提示系统（不扣分）
  hint: {
    name: '提示',
    desc: '高亮一个安全格',
    cooldown: 30 // 秒
  },
  
  // 冥想模式
  meditation: {
    name: '冥想',
    desc: '全屏氛围效果+白噪音',
    duration: 300 // 5分钟
  },
  
  // 每日禅语
  dailyWisdom: [
    '慢慢来，比较快',
    '专注当下，放下执念',
    '每一步都是修行',
    '享受过程，不问结果',
    // ... 更多禅语
  ]
};
```

---

### 7. 成就系统强化 🏆

当前已有20个成就，建议分类优化：

#### 基础成就 (5个)
- ✅ 首次胜利
- ✅ 10次胜利
- ✅ 50次胜利
- ✅ 100次胜利
- 添加：1000次胜利（终极成就，奖励5000金币）

#### 速度成就 (3个)
- ✅ 简单30秒
- ✅ 中等90秒
- ✅ 困难240秒

#### 完美成就 (2个)
- ✅ 不用旗子通关
- ✅ 不用道具10次

#### 金币成就 (2个)
- ✅ 累计1000金币
- ✅ 单局50金币

#### 勤奋成就 (2个)
- ✅ 100局游戏
- ✅ 连续签到7天

#### 生存成就 (2个)
- ✅ 连胜5次
- ✅ 连胜10次

#### 段位成就 (3个)
- ✅ 黄金段位
- ✅ 钻石段位
- ✅ 王者段位

#### 特殊成就 (2个)
- ✅ 触发5次宝藏
- ✅ 全模式探索

#### 新增：社交成就
- 分享游戏10次 (100金币)
- 邀请3个好友 (300金币)
- 加入联赛 (200金币)

#### 新增：收集成就
- 拥有5个皮肤 (150金币)
- 拥有所有道具 (500金币)
- 拥有10个称号 (800金币)

---

## 📊 金币经济平衡

### 金币收入来源：
1. 游戏通关：5-50金币/局
2. 每日签到：20-50金币/天
3. 成就奖励：50-1000金币/次（一次性）
4. 生存模式连胜：倍率加成
5. 特殊地雷宝藏：5-15金币/次

**预计日均收入（活跃玩家）：** 100-200金币

### 金币消费点：
1. 道具购买：15-40金币/个（高频）
2. 皮肤购买：80-150金币（一次性）
3. 背景/音效：40-100金币（一次性）
4. 头像边框：100-1500金币（一次性）
5. 称号：50-1500金币（一次性）
6. 道具升级：150-2000金币（一次性）
7. VIP会员：500-3000金币（周期性）
8. 幸运抽奖：50-200金币/次（高频）
9. 复活机制：50-500金币/次（中频）

**预计日均消费（活跃玩家）：** 80-150金币

**结论：** 平衡良好，不会过度通胀或通缩

---

## 🎯 优先级建议

### P0 (立即实现)
1. ✅ 振动反馈系统
2. ✅ UI界面现代化
3. ✅ 禅模式完善

### P1 (近期实现)
1. 头像边框系统
2. 称号系统
3. 复活机制

### P2 (中期实现)
1. VIP会员系统
2. 幸运抽奖系统
3. 道具升级系统

### P3 (长期实现)
1. 排行榜系统
2. 社交功能
3. 联赛系统

---

## 📝 实现步骤

1. **读取当前代码结构**
2. **添加新的常量定义**（头像边框、称号、VIP等）
3. **更新存档结构**（添加新字段）
4. **实现振动反馈模块**
5. **优化UI样式**（CSS升级）
6. **实现商城新标签页**（头像、称号等）
7. **添加复活机制**
8. **实现抽奖系统**
9. **测试和调优**
10. **文档更新**
