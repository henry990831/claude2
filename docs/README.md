# ⚔️ 无限世界 RPG — GitHub Pages 版（真实 3D）

脱离 Google Apps Script 的限制，改用 **GitHub Pages** 托管，从而支持：真实 3D 模型(GLTF)、PBR 材质、环境光反射(IBL)、动态阴影、泛光后处理、昼夜循环、以及**正常的指针锁定相机**（丝滑 360°）。

## 技术
- **Three.js r160**（ES 模块 + importmap，从 jsDelivr CDN 加载）
- **真实动画模型**：怪物用 `RobotExpressive.glb`（带 Idle/Walking/Running/Death/Punch 动画），经 `SkeletonUtils` 克隆、`AnimationMixer` 播放
- **渲染**：ACES 色调映射、`RoomEnvironment` 环境光、PCFSoft 阴影、`UnrealBloomPass` 泛光、`OutputPass` 正确色彩输出
- **世界**：噪声地形 + 程序化 PBR 草地贴图 + 树木/岩石 + 物体碰撞 + 地形贴合
- **玩法（基础）**：第一人称战斗、怪物 AI（游荡/追击/攻击/死亡动画）、等级压制、经验升级、掉落、昼夜（1 现实分钟 = 30 游戏分钟）

## 如何开启 GitHub Pages（一次性）
1. 打开仓库 **Settings → Pages**
2. **Source** 选 **Deploy from a branch**
3. **Branch** 选 `main`，文件夹选 **`/docs`**，点 **Save**
4. 等 1–2 分钟，访问：`https://henry990831.github.io/claude2/`

> 首次加载会从 CDN 拉取 Three.js 和 3D 模型，请耐心等待进度条走完，然后点击「进入世界」。

## 说明
- 这是**真实感基础版**（验证画风与平台）。确认效果后，将把完整玩法（7 品级装备 / 熔炉合成·词缀·强化 / 背包 / 人物面板 / 星球传送）移植到这个新引擎上。
- 若怪物模型 CDN 加载失败，会自动回退为简易怪物，游戏仍可运行。
