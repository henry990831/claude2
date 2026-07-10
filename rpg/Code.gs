/**
 * 开放世界 RPG WebApp - Google Apps Script Edition
 * 第一人称 3D 游戏：新手村 → 野外 → 城市
 * 打怪爆装备 · 熔炉合成 · 挑战更强怪物
 * 存档方式：浏览器 localStorage（认设备）
 * 3D 渲染：Three.js（跑在用户浏览器，GAS 仅负责托管页面）
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('⚔️ 开放世界 RPG')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 用于在 Index.html 里插入 CSS.html / JS.html 的内容
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
