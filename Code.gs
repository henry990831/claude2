/**
 * 扫雷 Minesweeper WebApp - Enhanced Edition
 * 存档方式：方案B，浏览器 localStorage（认设备）
 * 新增功能：生存模式、每日签到、成就系统、现代化UI
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('💎 扫雷 Minesweeper Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 用于在 Index.html 里插入 CSS.html / JS.html 的内容
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
