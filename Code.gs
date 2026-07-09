/**
 * 扫雷 Minesweeper Pro - Complete Edition
 * 包含：段位系统、特殊地雷模式、统计中心、音乐播放器、护眼模式
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('💎 扫雷 Minesweeper Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
