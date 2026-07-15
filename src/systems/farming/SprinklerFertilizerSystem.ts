/**
 * 洒水器与肥料系统 —— 自动浇水 + 肥料效果
 *
 * 职责：
 * 1. 管理洒水器放置（基础/优质/铱，覆盖范围不同）
 * 2. 每日结束时自动浇水覆盖区域
 * 3. 肥料施用（7 种肥料类型，影响品质/生长/保水）
 * 4. 与 FarmingSystem 的 PlotData 联动
 *
 * GDD 引用：4.1.4 肥料规则、4.1.5 洒水器规则
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents, FarmingEvents } from '@config/events';
import type { PlotData } from '@core/GameState';
import type { FarmingSystem } from '@systems/farming/FarmingSystem';

/** 洒水器类型 */
type SprinklerType = 'basic' | 'quality' | 'iridium';

/** 肥料类型 */
export type FertilizerType =
  | 'basic_fertilizer'
  | 'quality_fertilizer'
  | 'deluxe_fertilizer'
  | 'speed_gro'
  | 'hyper_speed_gro'
  | 'retaining_soil'
  | 'quality_retaining_soil';

/** 洒水器实例 */
interface SprinklerInstance {
  type: SprinklerType;
  x: number;
  y: number;
}

/** 洒水器覆盖范围（GDD 4.1.5）—— 后续阶段用于精确覆盖计算，当前简化为 waterAllPlots */
export const SPRINKLER_COVERAGE: Record<SprinklerType, Array<{ dx: number; dy: number }>> = {
  basic: [
    { dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
  ],
  quality: [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 },
    { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
  ],
  iridium: [
    { dx: -2, dy: -2 }, { dx: -1, dy: -2 }, { dx: 0, dy: -2 }, { dx: 1, dy: -2 }, { dx: 2, dy: -2 },
    { dx: -2, dy: -1 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 2, dy: -1 },
    { dx: -2, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 },
    { dx: -2, dy: 1 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 },
    { dx: -2, dy: 2 }, { dx: -1, dy: 2 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }, { dx: 2, dy: 2 },
  ],
};

/** 肥料效果配置（GDD 4.1.4） */
export const FERTILIZER_EFFECTS: Record<FertilizerType, {
  silverBonus: number;
  goldBonus: number;
  iridiumBonus: number;
  growthMultiplier: number;
  retainChance: number;
  unlockLevel: number;
}> = {
  basic_fertilizer:       { silverBonus: 0.10, goldBonus: 0, iridiumBonus: 0, growthMultiplier: 1.0, retainChance: 0, unlockLevel: 1 },
  quality_fertilizer:     { silverBonus: 0, goldBonus: 0.15, iridiumBonus: 0, growthMultiplier: 1.0, retainChance: 0, unlockLevel: 4 },
  deluxe_fertilizer:      { silverBonus: 0, goldBonus: 0, iridiumBonus: 0.10, growthMultiplier: 1.0, retainChance: 0, unlockLevel: 8 },
  speed_gro:              { silverBonus: 0, goldBonus: 0, iridiumBonus: 0, growthMultiplier: 0.9, retainChance: 0, unlockLevel: 3 },
  hyper_speed_gro:        { silverBonus: 0, goldBonus: 0, iridiumBonus: 0, growthMultiplier: 0.8, retainChance: 0, unlockLevel: 6 },
  retaining_soil:         { silverBonus: 0, goldBonus: 0, iridiumBonus: 0, growthMultiplier: 1.0, retainChance: 0.30, unlockLevel: 4 },
  quality_retaining_soil: { silverBonus: 0, goldBonus: 0, iridiumBonus: 0, growthMultiplier: 1.0, retainChance: 0.60, unlockLevel: 7 },
};

/** 洒水器解锁等级 */
const SPRINKLER_UNLOCK: Record<SprinklerType, number> = {
  basic: 2,
  quality: 6,
  iridium: 9,
};

export class SprinklerFertilizerSystem extends System {
  readonly name = 'sprinkler_fertilizer';

  private farming: FarmingSystem;
  private sprinklers: SprinklerInstance[] = [];

  constructor(farming: FarmingSystem) {
    super();
    this.farming = farming;
  }

  init(): void {
    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), this.name);
    EventBus.on('sprinkler:place', (type: unknown, x: unknown, y: unknown) => {
      this.placeSprinkler(type as SprinklerType, x as number, y as number);
    }, this.name);
    EventBus.on('sprinkler:remove', (x: unknown, y: unknown) => {
      this.removeSprinkler(x as number, y as number);
    }, this.name);
    EventBus.on('fertilizer:apply', (type: unknown, x: unknown, y: unknown) => {
      this.applyFertilizer(type as FertilizerType, x as number, y as number);
    }, this.name);
    console.log('[SprinklerFertilizerSystem] 洒水器肥料系统初始化完成');
  }

  update(_dt: number): void {
    // 洒水器在每日结束时触发，无需每帧更新
  }

  /** 放置洒水器 */
  placeSprinkler(type: SprinklerType, x: number, y: number): boolean {
    // 检查是否已存在
    if (this.sprinklers.some((s: SprinklerInstance) => s.x === x && s.y === y)) {
      console.log('[SprinklerFertilizerSystem] 该位置已有洒水器');
      return false;
    }
    this.sprinklers.push({ type, x, y });
    console.log(`[SprinklerFertilizerSystem] 放置 ${type} 洒水器于 (${x}, ${y})`);
    return true;
  }

  /** 移除洒水器 */
  removeSprinkler(x: number, y: number): boolean {
    const idx = this.sprinklers.findIndex((s: SprinklerInstance) => s.x === x && s.y === y);
    if (idx === -1) return false;
    this.sprinklers.splice(idx, 1);
    return true;
  }

  /** 施用肥料到地块 */
  applyFertilizer(fertilizerType: FertilizerType, x: number, y: number): boolean {
    const plot = this.farming.getPlots().find((p: PlotData) => p.x === x && p.y === y);
    if (plot === undefined) return false;
    if (plot.cropId === null) return false;
    if (plot.fertilized) {
      console.log('[SprinklerFertilizerSystem] 该地块已施肥');
      return false;
    }

    plot.fertilized = true;
    plot.fertilizerType = fertilizerType;
    console.log(`[SprinklerFertilizerSystem] 施用 ${fertilizerType} 于 (${x}, ${y})`);
    return true;
  }

  /** 每日结束：洒水器自动浇水 + 保水判定 */
  private onDayEnd(): void {
    // 洒水器自动浇水（通过 FarmingSystem 引用直接操作地块）
    if (this.sprinklers.length > 0) {
      this.farming.waterAllPlots();
    }

    // 保水肥料判定：已浇水的地块有概率保留浇水状态
    const plots = this.farming.getPlots();
    for (const plot of plots) {
      if (plot.watered || plot.cropId === null || !plot.fertilized || plot.fertilizerType === null) continue;
      const effect = FERTILIZER_EFFECTS[plot.fertilizerType as FertilizerType];
      if (effect === undefined) continue;
      if (effect.retainChance > 0 && Math.random() < effect.retainChance) {
        plot.watered = true;
      }
    }

    EventBus.emit(FarmingEvents.SPRINKLER, this.sprinklers.length);
  }

  /**
   * 获取施肥后的品质概率修正
   * 返回 { silver, gold, iridium } 加成值（0~1）
   */
  getFertilizerQualityBonus(plot: PlotData): { silver: number; gold: number; iridium: number } {
    if (!plot.fertilized || plot.fertilizerType === null) {
      return { silver: 0, gold: 0, iridium: 0 };
    }
    const effect = FERTILIZER_EFFECTS[plot.fertilizerType as FertilizerType];
    if (effect === undefined) return { silver: 0, gold: 0, iridium: 0 };
    return {
      silver: effect.silverBonus,
      gold: effect.goldBonus,
      iridium: effect.iridiumBonus,
    };
  }

  /**
   * 获取生长激素修正后的有效生长天数
   * @returns 修正后的生长天数（浮点数）
   */
  getEffectiveGrowthDays(plot: PlotData, baseGrowthDays: number): number {
    if (!plot.fertilized || plot.fertilizerType === null) return baseGrowthDays;
    const effect = FERTILIZER_EFFECTS[plot.fertilizerType as FertilizerType];
    if (effect === undefined) return baseGrowthDays;
    if (effect.growthMultiplier >= 1.0) return baseGrowthDays;
    return Math.max(1, Math.floor(baseGrowthDays * effect.growthMultiplier));
  }

  /** 获取洒水器数量 */
  getSprinklerCount(): number {
    return this.sprinklers.length;
  }

  /** 获取指定类型的洒水器数量 */
  getSprinklerCountByType(type: SprinklerType): number {
    return this.sprinklers.filter((s: SprinklerInstance) => s.type === type).length;
  }

  /** 检查是否解锁了指定洒水器 */
  isSprinklerUnlocked(type: SprinklerType, farmingLevel: number): boolean {
    return farmingLevel >= SPRINKLER_UNLOCK[type];
  }

  /** 检查是否解锁了指定肥料 */
  isFertilizerUnlocked(type: FertilizerType, farmingLevel: number): boolean {
    const effect = FERTILIZER_EFFECTS[type];
    return farmingLevel >= effect.unlockLevel;
  }

  destroy(): void {
    this.sprinklers = [];
  }
}