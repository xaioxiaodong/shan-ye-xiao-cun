/**
 * 钓鱼系统 —— 完整钓鱼小游戏 + 鱼类管理
 *
 * 职责：
 * 1. 管理钓鱼小游戏（能量条控制机制，GDD 4.6.2）
 * 2. 根据地点/季节/时间判定可钓到的鱼
 * 3. 3 级鱼竿 + 鱼饵系统
 * 4. 20 种鱼 + 3 条传奇鱼数据
 *
 * GDD 引用：4.6 钓鱼系统、4.6.2 钓鱼小游戏规则
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { DataRegistry } from '@core/DataRegistry';
import type { GameState } from '@core/GameState';
import type { FishData } from '@core/data-types';

/** 鱼竿等级 */
type RodLevel = 'basic' | 'fiberglass' | 'iridium';

/** 鱼行为模式 */
type FishBehavior = 'slow' | 'smooth' | 'dart' | 'erratic' | 'float';

/** 钓鱼小游戏状态 */
interface FishingMiniGame {
  active: boolean;
  fish: FishData;
  /** 绿色条位置（0-1） */
  barPosition: number;
  /** 鱼图标位置（0-1） */
  fishPosition: number;
  /** 鱼移动方向 */
  fishDirection: number;
  /** 鱼移动速度 */
  fishSpeed: number;
  /** 捕获进度（0-1） */
  catchProgress: number;
  /** 进度变化速率 */
  progressRate: number;
  /** 当前计时（秒） */
  elapsedTime: number;
  /** 超时时间（秒） */
  timeout: number;
}

/** 鱼竿配置 */
const ROD_CONFIG: Record<RodLevel, { barSize: number; catchMultiplier: number }> = {
  basic: { barSize: 0.18, catchMultiplier: 1.0 },
  fiberglass: { barSize: 0.22, catchMultiplier: 1.2 },
  iridium: { barSize: 0.28, catchMultiplier: 1.5 },
};

/** 鱼行为参数 */
const BEHAVIOR_PARAMS: Record<FishBehavior, { speed: number; turnChance: number }> = {
  slow: { speed: 0.3, turnChance: 0.02 },
  smooth: { speed: 0.5, turnChance: 0.03 },
  dart: { speed: 1.0, turnChance: 0.06 },
  erratic: { speed: 1.5, turnChance: 0.10 },
  float: { speed: 0.2, turnChance: 0.01 },
};

export class FishingSystem extends System {
  readonly name = 'fishing';

  private state: GameState;
  private currentRod: RodLevel = 'basic';
  private miniGame: FishingMiniGame | null = null;
  private isFishing: boolean = false;

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    EventBus.on('fishing:start', (location: unknown, rodLevel?: unknown) => {
      this.startFishing(location as string, rodLevel as RodLevel | undefined);
    }, this.name);
    EventBus.on('fishing:bar_move', (direction: unknown) => {
      this.moveBar(direction as number);
    }, this.name);
    EventBus.on('fishing:cancel', () => {
      this.cancelFishing();
    }, this.name);
    console.log('[FishingSystem] 钓鱼系统初始化完成');
  }

  update(_dt: number): void {
    if (this.miniGame === null || !this.miniGame.active) return;
    this.updateMiniGame(_dt);
  }

  /** 开始钓鱼（在指定水域） */
  startFishing(location: string, rodLevel?: RodLevel): void {
    if (this.isFishing) return;

    if (rodLevel !== undefined) {
      this.currentRod = rodLevel;
    }

    const registry = DataRegistry.getInstance();
    const allFish = registry.getAllFish();
    if (allFish === undefined) return;

    // 筛选当前地点/季节/时间可钓的鱼
    const candidates = allFish.filter((f: FishData) => {
      if (f.location !== location) return false;
      if (!f.season.includes(this.state.season)) return false;
      const t = this.state.gameTime;
      if (t < f.timeRange[0]! || t > f.timeRange[1]!) return false;
      return true;
    });

    if (candidates.length === 0) {
      console.log('[FishingSystem] 当前水域无可钓鱼类');
      return;
    }

    // 随机选一条鱼（加权：难度越高概率越低）
    const totalWeight = candidates.reduce((sum: number, f: FishData) => sum + (5 - f.difficulty), 0);
    let rand = Math.random() * totalWeight;
    let selectedFish = candidates[0]!;
    for (const fish of candidates) {
      rand -= (5 - fish.difficulty);
      if (rand <= 0) { selectedFish = fish; break; }
    }

    this.isFishing = true;

    const rodConfig = ROD_CONFIG[this.currentRod];
    this.miniGame = {
      active: true,  // 选鱼后立即激活小游戏
      fish: selectedFish,
      barPosition: 0.5,
      fishPosition: 0.5,
      fishDirection: 1,
      fishSpeed: BEHAVIOR_PARAMS[selectedFish.behavior as FishBehavior].speed,
      catchProgress: 0,
      progressRate: 0.02 * rodConfig.catchMultiplier,
      elapsedTime: 0,
      timeout: 60,
    };

    EventBus.emit('fishing:mini_game_ready', selectedFish.name, this.currentRod);
  }

  /** 取消钓鱼 */
  cancelFishing(): void {
    this.isFishing = false;
    this.miniGame = null;
    EventBus.emit('fishing:ended', null);
  }

  /** 移动绿色条 */
  moveBar(direction: number): void {
    if (this.miniGame === null) return;
    this.miniGame.barPosition = Math.max(0, Math.min(1,
      this.miniGame.barPosition + direction * 0.03,
    ));
  }

  /** 更新小游戏 */
  private updateMiniGame(dt: number): void {
    const mg = this.miniGame!;
    const dtSec = dt / 1000;

    mg.elapsedTime += dtSec;

    // 超时保护（GDD 4.6.2：60 秒无操作自动退出）
    if (mg.elapsedTime >= mg.timeout) {
      this.cancelFishing();
      return;
    }

    // 鱼移动
    const behavior = BEHAVIOR_PARAMS[mg.fish.behavior as FishBehavior];
    if (Math.random() < behavior.turnChance) {
      mg.fishDirection *= -1;
    }
    mg.fishPosition += mg.fishDirection * mg.fishSpeed * dtSec * 0.3;
    mg.fishPosition = Math.max(0.05, Math.min(0.95, mg.fishPosition));

    // 判定绿色条是否覆盖鱼
    const rodConfig = ROD_CONFIG[this.currentRod];
    const barHalf = rodConfig.barSize / 2;
    const barMin = mg.barPosition - barHalf;
    const barMax = mg.barPosition + barHalf;

    if (mg.fishPosition >= barMin && mg.fishPosition <= barMax) {
      mg.catchProgress += mg.progressRate * dtSec;
    } else {
      mg.catchProgress -= mg.progressRate * 0.5 * dtSec;
    }
    mg.catchProgress = Math.max(0, Math.min(1, mg.catchProgress));

    // 捕获成功
    if (mg.catchProgress >= 1) {
      this.onCatchSuccess();
    }

    // 发送小游戏状态更新
    EventBus.emit('fishing:mini_game_update', {
      barPosition: mg.barPosition,
      fishPosition: mg.fishPosition,
      catchProgress: mg.catchProgress,
      elapsedTime: mg.elapsedTime,
    });
  }

  /** 捕获成功 */
  private onCatchSuccess(): void {
    const mg = this.miniGame!;
    const fish = mg.fish;

    // 鱼添加到背包
    EventBus.emit('inventory:add', fish.id, 1, this.calculateFishQuality(fish));

    // 钓鱼技能经验（与 SkillSystem BASE_EXP.fish = 10 一致）
    EventBus.emit('skill:fishing_exp', 10);

    EventBus.emit('fishing:catch', fish.id, fish.name, fish.basePrice);
    EventBus.emit('fishing:ended', fish);

    this.isFishing = false;
    this.miniGame = null;
  }

  /** 计算鱼品质（基于钓鱼技能等级） */
  private calculateFishQuality(fish: FishData): string {
    const rand = Math.random();
    if (fish.isLegendary) return 'gold';
    if (rand < 0.02) return 'iridium';
    if (rand < 0.10) return 'gold';
    if (rand < 0.25) return 'silver';
    return 'normal';
  }

  /** 获取小游戏状态（供 UI 渲染） */
  getMiniGameState(): FishingMiniGame | null {
    return this.miniGame;
  }

  /** 是否正在钓鱼 */
  getIsFishing(): boolean {
    return this.isFishing;
  }

  /** 获取当前鱼竿等级 */
  getRodLevel(): RodLevel {
    return this.currentRod;
  }

  destroy(): void {
    this.miniGame = null;
    this.isFishing = false;
  }
}