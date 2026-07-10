---
name: game-design-project
description: 像素农场游戏《山野小村》项目状态与GDD版本信息
metadata:
  type: project
---

# 像素农场游戏《山野小村》

**工作目录：** `D:\School Work\game-design\`
**GDD 版本：** v3.3（2026-07-09 定稿）
**状态：** 设计完成，准备进入 P0 开发

## 核心文档
- `gdd.md` — 游戏设计规范书 v3.3（2134+行，15个部分）
- `star-dew-valley-complete-analysis.md` — 星露谷系统参考（3292行）

## 技术栈
| 层 | 技术 | 版本 |
|----|------|------|
| 渲染引擎 | Phaser 3 | 3.80+ |
| 网络框架 | Colyseus | 0.15+ |
| 构建工具 | Vite | 6.x |
| 语言 | TypeScript | 5.x strict |
| PC 打包 | Tauri | 2.x |
| 手机打包 | Capacitor | 6.x |
| 音频 | Howler.js | 2.x |
| 测试 | Vitest | — |

## 开发排期
| 阶段 | 周次 | 产出 |
|------|:----:|------|
| P0 核心原型 | 1-6 | 农耕循环+时间+地图+背包+安全框架 |
| P1 内容填充 | 7-14 | 作物/动物/NPC/工具/技能 |
| P2 联机实现 | 15-20 | 局域网+同步+预测+联机安全 |
| P3 打磨发布 | 21-26 | 手机适配+音频+引导+打包 |

## 核心设计原则（10条）
1. 体验优先，数值次之
2. 内容密度决定质量
3. 渐进解锁，不提前给完
4. 没有强制失败
5. 像素美术风格统一（16×16 Tile）
6. 全平台可玩（PC+手机一套代码）
7. 质量与防护并重（安全护栏必须）
8. 联机不歧视（客户端预测+主机仲裁）
9. 系统整合闭环（禁止孤岛系统）
10. 可及性优先（色盲/重映射/字幕）

## 记忆文件索引
- `project.md` — 本文件，项目状态
- `gdd-core-systems.md` — 核心系统规则（时间/经济/体力/天气/安全）
- `gdd-game-data.md` — 游戏数据全表（作物/NPC/食谱/鱼/怪物/合成/建筑）
- `gdd-tech-safety.md` — 技术架构与安全防护规范

## 关联文档位置
- 全局记忆索引：`C:\Users\86166\.claude\projects\D--\memory\MEMORY.md`
- 全局记忆目录：`C:\Users\86166\.claude\projects\D--\memory\`
- 工作区记忆目录：`D:\School Work\game-design\.claude\memory\`
- GDD 原文：`D:\School Work\game-design\gdd.md`
