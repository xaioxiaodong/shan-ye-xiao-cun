---
name: game-design-project
description: 像素农场游戏《山野小村》项目状态与GDD版本信息
metadata:
  type: project
---

# 像素农场游戏《山野小村》

**工作目录：** `D:\School Work\game-design\`
**GDD 版本：** v3.3（2026-07-09 定稿）
**开发状态：** 阶段 3 第二批完成（10/13 系统），待进入第三批
**TypeScript 源文件：** 30 个
**编译状态：** tsc 零错误，vite build 33 模块

## 核心文档
- `gdd.md` — 游戏设计规范书 v3.3（2513 行，15 个部分）
- `star-dew-valley-complete-analysis.md` — 星露谷系统参考
- `.claude/memory/progress.md` — 详细开发进度（含阶段 3 第三批任务清单）

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

## 架构概览
- 核心系统为独立 System 类，通过 `SystemManager` 统一调度（10/13 系统已实现）
- 系统间通过 `EventBus` 松耦合通信（8 组 40+ 事件，见 `src/config/events.ts`）
- 全局状态统一由 `GameState` 管理（与存档共用 Schema）
- 每个 System 有独立 try/catch 边界，3 次错误降级为"该功能暂不可用"
- 所有游戏内容数据驱动：JSON 文件定义，`DataRegistry` 加载验证

## 已实现的系统（10/13）
| 系统 | 文件 | 行数 | 阶段 |
|------|------|:----:|:----:|
| TimeSystem | `systems/time/TimeSystem.ts` | 83 | 阶段 1 |
| FarmingSystem | `systems/farming/FarmingSystem.ts` | 354 | 阶段 1 |
| InventorySystem | `systems/inventory/InventorySystem.ts` | 214 | 阶段 2 |
| NPCSystem | `systems/npc/NPCSystem.ts` | 233 | 阶段 2 |
| SprinklerFertilizerSystem | `systems/farming/SprinklerFertilizerSystem.ts` | 234 | 阶段 3A |
| SkillSystem | `systems/skill/SkillSystem.ts` | 339 | 阶段 3A |
| FishingSystem | `systems/fishing/FishingSystem.ts` | 261 | 阶段 3B |
| AnimalSystem | `systems/animal/AnimalSystem.ts` | 198 | 阶段 3B |
| CookingSystem | `systems/cooking/CookingSystem.ts` | 178 | 阶段 3B |
| CraftingSystem | `systems/crafting/CraftingSystem.ts` | 281 | 阶段 3B |

## 待实现的系统（3/13）
| 系统 | 阶段 |
|------|:----:|
| CombatSystem | 第三批 |
| BuildingSystem | 第三批 |
| WeatherSystem | 第三批 |

## 已实现的安全防护（2/7）
| 防护 | 文件 |
|------|------|
| GameLoopSafeguard | `safeguards/GameLoopSafeguard.ts` |
| RenderSafeguard | `safeguards/RenderSafeguard.ts` |

## JSON 数据文件清单
| 文件 | 内容 | 条目数 |
|------|------|:----:|
| `data/crops.json` | 四季作物 | 28 |
| `data/npcs.json` | NPC 完整数据 | 17 |
| `data/fish.json` | 鱼类数据 | 20 |
| `data/animals.json` | 动物数据 | 5 |
| `data/recipes.json` | 食谱数据 | 30 |

## 核心设计原则（10 条，不可违背）
1. 体验优先，数值次之
2. 内容密度决定质量
3. 渐进解锁，不提前给完
4. 没有强制失败
5. 像素美术风格统一（16×16 Tile）
6. 全平台可玩（PC+手机一套代码）
7. 质量与防护并重
8. 联机不歧视（客户端预测+主机仲裁）
9. 系统整合闭环（禁止孤岛系统）
10. 可及性优先

## 代码质量红线
- 单文件 ≤ 300 行（纯数据/引导文件可放宽至 500 行，需顶部注释说明）
- 禁止 any 类型
- 所有变量/参数/返回值显式类型声明
- 命名：camelCase（变量/函数），PascalCase（类/接口/类型），kebab-case（文件名）
- 每阶段完成后必须 tsc + vite build 验证

## 已知陷阱（Common Pitfalls）
- **SearchReplace replace_all** 操作 JSON 时 original_text 不要包含逗号，否则会丢失逗号
- **PowerShell Set-Content** 默认编码非 UTF-8，修改含中文 JSON 必须用 Write 工具
- **EventBus 注册顺序** 决定 DAY_END 事件执行顺序
- **NPC/作物 ID** 必须用英文拼音，中文 ID 会被 `isValidId()` 正则拒绝
- **TS 编译**：未使用的 import 会导致 TS6133/TS6196 错误

## GitHub 仓库
- **地址：** https://github.com/xaioxiaodong/shan-ye-xiao-cun
- **SSH：** git@github.com:xaioxiaodong/shan-ye-xiao-cun.git
- **用户名：** xaioxiaodong（注意不是 xiaoxiaodong）
- **邮箱：** d2420013751@126.com
- **认证方式：** SSH 密钥（已配置）
- **同步规则：** 仅当用户明确要求时才推送，不自动同步

## 记忆文件索引
- `project.md` — 本文件，项目总览
- `progress.md` — 详细开发进度（含阶段 3 第三批待实施任务清单）
- `gdd-tech-safety.md` — 技术架构与安全防护规范
- `gdd-core-systems.md` — 核心系统规则
- `gdd-game-data.md` — 游戏数据全表

## 关联文档位置
- 全局记忆索引：`C:\Users\86166\.claude\projects\D--\memory\MEMORY.md`
- 全局记忆目录：`C:\Users\86166\.claude\projects\D--\memory\`
- 工作区记忆目录：`D:\School Work\game-design\.claude\memory\`
- GDD 原文：`D:\School Work\game-design\gdd.md`---
name: game-design-project
description: 像素农场游戏《山野小村》项目状态与GDD版本信息
metadata:
  type: project
---

# 像素农场游戏《山野小村》

**工作目录：** `D:\School Work\game-design\`
**GDD 版本：** v3.3（2026-07-09 定稿）
**开发状态：** 阶段 2 完成，准备进入阶段 3
**TypeScript 源文件：** 22 个
**编译状态：** tsc 零错误，vite build 25 模块

## 核心文档
- `gdd.md` — 游戏设计规范书 v3.3（2175 行，15 个部分）
- `star-dew-valley-complete-analysis.md` — 星露谷系统参考（3293 行）
- `.claude/memory/progress.md` — 详细开发进度

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

## 架构概览
- 核心系统为独立 System 类，通过 `SystemManager` 统一调度（13 个系统，4 个已实现）
- 系统间通过 `EventBus` 松耦合通信（8 组 40+ 事件，见 `src/config/events.ts`）
- 全局状态统一由 `GameState` 管理（与存档共用 Schema）
- 每个 System 有独立 try/catch 边界，3 次错误降级为"该功能暂不可用"
- 所有游戏内容数据驱动：JSON 文件定义，`DataRegistry` 加载验证

## 已实现的系统（4/13）
| 系统 | 文件 | 行数 |
|------|------|:----:|
| TimeSystem | `systems/time/TimeSystem.ts` | 83 |
| FarmingSystem | `systems/farming/FarmingSystem.ts` | 268 |
| InventorySystem | `systems/inventory/InventorySystem.ts` | 214 |
| NPCSystem | `systems/npc/NPCSystem.ts` | 233 |

## 已实现的安全防护（2/7）
| 防护 | 文件 |
|------|------|
| GameLoopSafeguard | `safeguards/GameLoopSafeguard.ts` |
| RenderSafeguard | `safeguards/RenderSafeguard.ts` |

## 核心设计原则（10 条，不可违背）
1. 体验优先，数值次之
2. 内容密度决定质量
3. 渐进解锁，不提前给完
4. 没有强制失败
5. 像素美术风格统一（16×16 Tile）
6. 全平台可玩（PC+手机一套代码）
7. 质量与防护并重
8. 联机不歧视（客户端预测+主机仲裁）
9. 系统整合闭环（禁止孤岛系统）
10. 可及性优先

## 代码质量红线
- 单文件 ≤ 300 行
- 禁止 any 类型
- 所有变量/参数/返回值显式类型声明
- 命名：camelCase（变量/函数），PascalCase（类/接口/类型），kebab-case（文件名）
- 每阶段完成后必须 tsc + vite build 验证

## GitHub 仓库
- **地址：** https://github.com/xaioxiaodong/shan-ye-xiao-cun
- **SSH：** git@github.com:xaioxiaodong/shan-ye-xiao-cun.git
- **用户名：** xaioxiaodong（注意不是 xiaoxiaodong）
- **邮箱：** d2420013751@126.com
- **认证方式：** SSH 密钥（已配置）
- **同步规则：** 仅当用户明确要求时才推送，不自动同步

## 记忆文件索引
- `project.md` — 本文件，项目总览
- `progress.md` — 详细开发进度（含阶段3待实施任务清单）
- `gdd-tech-safety.md` — 技术架构与安全防护规范
- `gdd-core-systems.md` — 核心系统规则
- `gdd-game-data.md` — 游戏数据全表

## 关联文档位置
- 全局记忆索引：`C:\Users\86166\.claude\projects\D--\memory\MEMORY.md`
- 全局记忆目录：`C:\Users\86166\.claude\projects\D--\memory\`
- 工作区记忆目录：`D:\School Work\game-design\.claude\memory\`
- GDD 原文：`D:\School Work\game-design\gdd.md`---
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

## GitHub 仓库
- **地址：** https://github.com/xaioxiaodong/shan-ye-xiao-cun
- **SSH：** git@github.com:xaioxiaodong/shan-ye-xiao-cun.git
- **用户名：** xaioxiaodong（注意不是 xiaoxiaodong）
- **邮箱：** d2420013751@126.com
- **认证方式：** SSH 密钥（已配置）
- **同步规则：** 仅当用户明确要求时才推送，不自动同步

## 关联文档位置
- 全局记忆索引：`C:\Users\86166\.claude\projects\D--\memory\MEMORY.md`
- 全局记忆目录：`C:\Users\86166\.claude\projects\D--\memory\`
- 工作区记忆目录：`D:\School Work\game-design\.claude\memory\`
- GDD 原文：`D:\School Work\game-design\gdd.md`
