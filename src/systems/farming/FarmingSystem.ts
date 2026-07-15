/**
 * 耕种系统 —— 完整耕种循环
 *
 * 本文件行数超过 300 行：核心业务系统，包含地块状态管理、玩家工具操作、
 * 生长推进、地块状态渲染覆盖层及肥料加成计算，
 * 按编码规范"核心复杂系统可放宽至 500 行"。
 *
 * 职责：
 * 1. 管理地块状态（翻地/播种/浇水/生长/收获）
 * 2. 响应玩家工具操作
 * 3. 在每日结束时推进作物生长
 * 4. 渲染地块状态覆盖层（颜色区分不同生长阶段）
 */

import Phaser from 'phaser';
import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents, FarmingEvents, PlayerEvents, EconomyEvents } from '@config/events';
import { GameState, type PlotData } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import { CANVAS_CONFIG } from '@config/constants';
import type { CropData } from '@core/data-types';
import type { TileMapRenderer } from '@render/TileMapRenderer';
import { TileType, TILLABLE_TILES } from '@render/TileMapRenderer';
import { FERTILIZER_EFFECTS, type FertilizerType } from '@systems/farming/SprinklerFertilizerSystem';

const TILE = CANVAS_CONFIG.TILE_SIZE;

/** 地块状态 */
const enum PlotState {
  TILLED = 0,     // 已翻地（空）
  PLANTED = 1,    // 已播种
  GROWING = 2,    // 生长中
  READY = 3,      // 可收获
}

/** 地块状态对应的覆盖颜色（阶段 1 占位色块） */
const PLOT_OVERLAY_COLORS: Record<number, { color: number; alpha: number }> = {
  [PlotState.TILLED]:  { color: 0x6B4226, alpha: 0.0 },   // 翻地：无覆盖（用 Tile 底色）
  [PlotState.PLANTED]: { color: 0x8B7355, alpha: 0.4 },   // 播种：淡棕覆盖
  [PlotState.GROWING]: { color: 0x4CAF50, alpha: 0.5 },   // 生长：绿色覆盖
  [PlotState.READY]:   { color: 0xFFD700, alpha: 0.7 },   // 成熟：金色高亮
};

/** 工具类型（阶段 1 简化版） */
type FarmTool = 'hoe' | 'watering_can' | 'seed';

/** 各工具操作所需最低体力（GDD 3.3 规定体力归零时拒绝执行） */
const TOOL_ENERGY_COST: Record<FarmTool, number> = {
  hoe: 2,
  watering_can: 1,
  seed: 1,
};

export class FarmingSystem extends System {
  readonly name = 'farming';

  private state: GameState;
  private tileMap: TileMapRenderer;
  private scene: Phaser.Scene;
  private plots: Map<string, PlotData> = new Map();
  private currentTool: FarmTool = 'hoe';
  private selectedSeed: string | null = null;

  /** 覆盖层 Graphics（用于绘制地块状态颜色） */
  private overlayGraphics: Phaser.GameObjects.Graphics | null = null;

  /** 耕种区域边界（Tile 坐标） */
  private readonly farmBounds = {
    minX: 10, minY: 10,
    maxX: 50, maxY: 40,
  };

  constructor(state: GameState, tileMap: TileMapRenderer, scene: Phaser.Scene) {
    super();
    this.state = state;
    this.tileMap = tileMap;
    this.scene = scene;
  }

  init(): void {
    // 创建覆盖层（在 Tile 之上、玩家之下）
    this.overlayGraphics = this.scene.add.graphics();
    this.overlayGraphics.setDepth(1);

    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), 'farming');
    EventBus.on('farming:action', (tileX: unknown, tileY: unknown) => {
      this.onPlayerAction(tileX as number, tileY as number);
    }, 'farming');
    EventBus.on('farming:switch_tool', (tool: unknown, seedId?: unknown) => {
      this.onSwitchTool(tool as FarmTool, seedId as string | undefined);
    }, 'farming');
    console.log('[FarmingSystem] 耕种系统初始化完成');
  }

  update(_dt: number): void {
    this.renderPlotOverlays();
  }

  // ── 玩家操作 ──

  /** 玩家操作：在指定 Tile 坐标使用工具 */
  private onPlayerAction(tileX: number, tileY: number): void {
    if (!this.isInFarmBounds(tileX, tileY)) return;

    // GDD 3.3：体力耗尽时拒绝执行工具操作
    const cost = TOOL_ENERGY_COST[this.currentTool];
    if (this.state.energy < cost) {
      console.log('[FarmingSystem] 太累了，无法继续操作');
      EventBus.emit(PlayerEvents.ENERGY_CHANGED, this.state.energy, this.state.maxEnergy);
      return;
    }

    const key = this.plotKey(tileX, tileY);
    const plot = this.plots.get(key);

    switch (this.currentTool) {
      case 'hoe':
        this.useHoe(tileX, tileY, plot, key);
        break;
      case 'watering_can':
        this.useWateringCan(plot);
        break;
      case 'seed':
        this.useSeed(tileX, tileY, plot);
        break;
    }
  }

  /** 切换工具 */
  private onSwitchTool(tool: FarmTool, seedId?: string): void {
    this.currentTool = tool;
    this.selectedSeed = seedId ?? null;
  }

  /** 使用锄头翻地 */
  private useHoe(tileX: number, tileY: number, plot: PlotData | undefined, key: string): void {
    if (plot !== undefined) return; // 已有地块
    // 只允许在可翻地的 Tile 上翻地
    if (!TILLABLE_TILES.has(this.tileMap.getTile(tileX, tileY))) return;

    this.tileMap.setTile(tileX, tileY, TileType.TILLED);
    this.plots.set(key, {
      x: tileX, y: tileY,
      cropId: null,
      growthProgress: 0,
      watered: false,
      fertilized: false,
      fertilizerType: null,
      regrowing: false,
    });

    this.state.addEnergy(-2);
    EventBus.emit(PlayerEvents.ENERGY_CHANGED, this.state.energy, this.state.maxEnergy);
    EventBus.emit(FarmingEvents.TILL, tileX, tileY);
  }

  /** 使用水壶浇水 */
  private useWateringCan(plot: PlotData | undefined): void {
    if (plot === undefined || plot.cropId === null) return;
    if (plot.watered) return;

    plot.watered = true;
    this.state.addEnergy(-1);
    EventBus.emit(PlayerEvents.ENERGY_CHANGED, this.state.energy, this.state.maxEnergy);
    EventBus.emit(FarmingEvents.WATER, plot.x, plot.y);
  }

  /** 使用种子播种 */
  private useSeed(tileX: number, tileY: number, plot: PlotData | undefined): void {
    if (plot === undefined || plot.cropId !== null) return;
    if (this.selectedSeed === null) return;

    const registry = DataRegistry.getInstance();
    const cropData = registry.getCrop(this.selectedSeed);
    if (cropData === undefined) return;

    // 检查季节
    if (cropData.season !== this.state.season) {
      console.log(`[FarmingSystem] ${cropData.name} 不能在 ${this.state.season} 种植`);
      return;
    }

    plot.cropId = cropData.id;
    plot.growthProgress = 0;
    plot.watered = true; // 播种时自动浇水

    this.state.addEnergy(-1);
    EventBus.emit(PlayerEvents.ENERGY_CHANGED, this.state.energy, this.state.maxEnergy);
    EventBus.emit(FarmingEvents.PLANT, tileX, tileY, cropData.id);
  }

  /** 收获作物 */
  private harvestPlot(plot: PlotData): void {
    const registry = DataRegistry.getInstance();
    const cropData = registry.getCrop(plot.cropId!);
    if (cropData === undefined) return;

    const quality = this.calculateQuality(cropData, plot);
    const price = cropData.basePrice;

    // 如果是再生作物，重置生长进度进入再生阶段
    if (cropData.regrowDays !== null) {
      plot.growthProgress = 0;
      plot.watered = false;
      plot.regrowing = true;
    } else {
      // 一次性作物，清除地块
      const key = this.plotKey(plot.x, plot.y);
      this.plots.delete(key);
      this.tileMap.setTile(plot.x, plot.y, TileType.DIRT);
    }

    this.state.addMoney(price);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, price, this.state.money);
    EventBus.emit(FarmingEvents.HARVEST, plot.x, plot.y, cropData.id, quality);
  }

  // ── 每日结束 ──

  /** 每日结束：推进作物生长 */
  private onDayEnd(): void {
    // 同步地块数据到 state.farmPlots（供存档和外部系统读取）
    this.syncPlotsToState();

    for (const plot of this.plots.values()) {
      if (plot.cropId === null) continue;

      const registry = DataRegistry.getInstance();
      const cropData = registry.getCrop(plot.cropId);
      if (cropData === undefined) continue;

      // 未浇水的不生长
      if (!plot.watered) continue;

      // 推进生长（再生阶段用 regrowDays，初始生长用 growthDays）
      const effectiveDays = plot.regrowing ? (cropData.regrowDays ?? cropData.growthDays) : cropData.growthDays;
      // 肥料生长激素调整有效天数
      let adjustedDays = effectiveDays;
      if (plot.fertilized && plot.fertilizerType !== null) {
        const effect = FERTILIZER_EFFECTS[plot.fertilizerType as FertilizerType];
        if (effect !== undefined && effect.growthMultiplier < 1.0) {
          adjustedDays = Math.max(1, Math.floor(effectiveDays * effect.growthMultiplier));
        }
      }
      const progressPerDay = 1 / adjustedDays;
      plot.growthProgress = Math.min(1, plot.growthProgress + progressPerDay);

      // 重置浇水状态
      plot.watered = false;
    }
  }

  // ── 渲染 ──

  /** 渲染地块状态覆盖层 */
  private renderPlotOverlays(): void {
    if (this.overlayGraphics === null) return;
    this.overlayGraphics.clear();

    for (const plot of this.plots.values()) {
      const state = this.getPlotState(plot);
      const overlay = PLOT_OVERLAY_COLORS[state];
      if (overlay === undefined || overlay.alpha <= 0) continue;

      this.overlayGraphics.fillStyle(overlay.color, overlay.alpha);
      this.overlayGraphics.fillRect(
        plot.x * TILE, plot.y * TILE,
        TILE, TILE,
      );

      // 已浇水的地块额外显示蓝色水滴标记
      if (plot.watered && plot.cropId !== null) {
        this.overlayGraphics.fillStyle(0x4A90D9, 0.6);
        this.overlayGraphics.fillRect(
          plot.x * TILE + TILE / 2 - 1, plot.y * TILE + 2,
          2, 2,
        );
      }
    }
  }

  /** 获取地块状态 */
  private getPlotState(plot: PlotData): PlotState {
    if (plot.cropId === null) return PlotState.TILLED;
    if (plot.growthProgress >= 1) return PlotState.READY;
    if (plot.growthProgress > 0) return PlotState.GROWING;
    return PlotState.PLANTED;
  }

  // ── 公开方法 ──

  /** 点击成熟作物时可收获 */
  tryHarvest(tileX: number, tileY: number): boolean {
    const key = this.plotKey(tileX, tileY);
    const plot = this.plots.get(key);
    if (plot === undefined || plot.cropId === null) return false;
    if (plot.growthProgress < 1) return false;

    this.harvestPlot(plot);
    return true;
  }

  /** 切换工具 */
  switchTool(tool: FarmTool, seedId?: string): void {
    this.currentTool = tool;
    this.selectedSeed = seedId ?? null;
  }

  /** 将所有有作物的地块设为已浇水（供 WeatherSystem 雨天 / SprinklerSystem 使用） */
  waterAllPlots(): void {
    for (const plot of this.plots.values()) {
      if (plot.cropId !== null) {
        plot.watered = true;
      }
    }
  }

  /** 将私有 plots Map 同步到 state.farmPlots（供存档持久化和外部系统读取） */
  syncPlotsToState(): void {
    this.state.farmPlots = [...this.plots.values()];
  }

  /** 获取所有地块数据（供 SprinklerFertilizerSystem 等外部系统查询） */
  getPlots(): PlotData[] {
    return [...this.plots.values()];
  }

  // ── 内部工具 ──

  /** 检查是否在耕种区域内 */
  private isInFarmBounds(x: number, y: number): boolean {
    return x >= this.farmBounds.minX && x <= this.farmBounds.maxX
        && y >= this.farmBounds.minY && y <= this.farmBounds.maxY;
  }

  /** 计算品质（含肥料加成，GDD 4.1.4） */
  private calculateQuality(cropData: CropData, plot: PlotData): string {
    const rand = Math.random();
    const q = cropData.qualityChances;

    // 肥料品质加成
    let silverBonus = 0;
    let goldBonus = 0;
    let iridiumBonus = 0;
    if (plot.fertilized && plot.fertilizerType !== null) {
      const effect = FERTILIZER_EFFECTS[plot.fertilizerType as FertilizerType];
      if (effect !== undefined) {
        silverBonus = effect.silverBonus;
        goldBonus = effect.goldBonus;
        iridiumBonus = effect.iridiumBonus;
      }
    }

    const iridiumChance = q.iridium + iridiumBonus;
    const goldChance = iridiumChance + q.gold + goldBonus;
    const silverChance = goldChance + q.silver + silverBonus;

    if (rand < iridiumChance) return 'iridium';
    if (rand < goldChance) return 'gold';
    if (rand < silverChance) return 'silver';
    return 'normal';
  }

  /** 地块唯一键 */
  private plotKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  destroy(): void {
    if (this.overlayGraphics !== null) {
      this.overlayGraphics.destroy();
      this.overlayGraphics = null;
    }
  }
}