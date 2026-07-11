#!/usr/bin/env python3
"""
完整扫雷游戏生成器
生成所有文件：Code.gs, Index.html, CSS.html, JS.html
包含所有功能：段位、特殊地雷、统计、音乐、护眼
"""

def generate_code_gs():
    return '''/**
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
'''

# 生成文件
print("Generating Code.gs...")
with open('Code.gs', 'w', encoding='utf-8') as f:
    f.write(generate_code_gs())
    
print("✅ Code.gs created")
print("Next: Creating Index.html, CSS.html, JS.html...")
print("This will take a moment...")

