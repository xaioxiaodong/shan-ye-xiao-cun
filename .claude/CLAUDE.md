# 像素农场游戏项目《山野小村》

## 工作流程
1. 先理解需求，必要时调研
2. 设计方案，得到确认后再执行
3. 代码写完后验证（tsc + vite build）
4. 每阶段完成后进行回头检查优化

## 核心约束（不可违背）

| 规则 | 说明 |
|------|------|
| 全栈 TypeScript | 禁止混用 JS，strict 模式 |
| 禁止 any | 用 unknown + 类型守卫 |
| 显式类型声明 | 所有变量/参数/返回值必须标注 |
| 单文件 ≤ 300 行 | 纯数据文件可放宽至 500 行 |
| 单函数 ≤ 50 行 | 保持可读性 |
| 命名规范 | camelCase（变量/函数），PascalCase（类/接口/类型），kebab-case（文件名） |
| 注释 | 中文 JSDoc 规范 |
| 性能不设限 | 全平台 60fps，禁止人为降帧 |
| 联机不歧视 | 主机客户端体验一致 |
| 数据驱动 | 所有游戏内容放在 JSON 数据文件中，代码只负责逻辑 |
| 占位美术 | 先用程序化色块，后续替换 final 目录资源 |

## 项目文档
- `gdd.md` — 游戏设计规范书（v3.3，开发唯一参照）
- `star-dew-valley-complete-analysis.md` — 星露谷系统参考
- `.claude/memory/project.md` — 项目状态与进度
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

## 架构模式
- 核心系统为独立 System 类，通过 SystemManager 统一调度
- 系统间通过 EventBus 松耦合通信（事件名见 `src/config/events.ts`）
- 全局状态统一由 GameState 管理（与存档共用 Schema）
- 每个 System 有独立 try/catch 边界，3次错误降级为"该功能暂不可用"

## 路径别名
```
@core/*     → src/core/*
@systems/*  → src/systems/*
@config/*   → src/config/*
@data/*     → src/data/*
@render/*   → src/render/*
@ui/*       → src/ui/*
@utils/*    → src/utils/*
@safeguards/* → src/safeguards/*
@save/*     → src/save/*
```

## 常用命令
- `npm run dev` — 启动开发服务器 (port 3000)
- `npm run build` — 生产构建
- `npm run lint` — 类型检查
- `npx tsc --noEmit` — 编译检查

## 记忆系统
- 记忆文件在 `.claude/memory/` 目录下
- `project.md` — 项目总览
- `progress.md` — 详细开发进度

## 通用规则
- 涉及文件操作先检查再执行
- 重要操作先确认
- 使用中文沟通
- 每阶段完成后回顾检查，确保质量# 像素农场游戏项目

## 工作流程
1. 先理解需求，必要时调研
2. 设计方案，得到确认后再执行
3. 代码写完后验证

## 核心约束（不可违背）

| 规则 | 说明 |
|------|------|
| 全栈 TypeScript | 禁止混用 JS |
| 禁止 any | 用 unknown + 类型守卫 |
| 显式类型声明 | 所有变量/参数/返回值必须标注 |
| 代码质量优先 | 不允许偷工减料/走捷径 |
| 性能不设限 | 全平台 60fps，禁止人为降帧 |
| 联机不歧视 | 主机客户端体验一致 |

## 项目文档
- `gdd.md` — 游戏设计规范书（开发唯一参照）
- `star-dew-valley-complete-analysis.md` — 星露谷系统参考

## 记忆系统
- 记忆文件在 `.claude/memory/` 目录下
- 每个记忆文件记录一个独立事实

## 通用规则
- 涉及文件操作先检查再执行
- 重要操作先确认
- 使用中文沟通