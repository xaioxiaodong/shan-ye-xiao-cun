/**
 * 建筑系统 —— 建造、升级与管理农场建筑
 *
 * 职责：
 * 1. 建筑建造（检查材料/金钱，放置建筑）
 * 2. 建筑升级（鸡舍→大鸡舍，畜棚→大畜棚→豪华畜棚）
 * 3. 房屋升级（1→5 级，解锁新功能）
 * 4. 建筑容量管理（与 AnimalSystem 联动）
 *
 * GDD 引用：4.9 建筑系统
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { BuildingEvents, EconomyEvents } from '@config/events';
import { GameState } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import type { BuildingData } from '@core/DataRegistry';

/** 房屋升级路径 */
const HOUSE_UPGRADE_PATH = ['house_lv1', 'house_lv2', 'house_lv3', 'house_lv4', 'house_lv5'];

/** 鸡舍升级路径 */
const COOP_UPGRADE_PATH = ['chicken_coop', 'big_coop'];

/** 畜棚升级路径 */
const BARN_UPGRADE_PATH = ['barn', 'big_barn', 'deluxe_barn'];

export class BuildingSystem extends System {
  readonly name = 'building';

  private state: GameState;
  private registry: DataRegistry;

  constructor(state: GameState) {
    super();
    this.state = state;
    this.registry = DataRegistry.getInstance();
  }

  init(): void {
    // 初始化房屋 Lv1（玩家起始拥有）
    if (!this.state.farmBuildings.includes('house_lv1')) {
      this.state.farmBuildings.push('house_lv1');
    }

    EventBus.on('building:build', (buildingId: unknown) => {
      this.buildBuilding(buildingId as string);
    }, this.name);

    EventBus.on('building:upgrade', (buildingId: unknown) => {
      this.upgradeBuilding(buildingId as string);
    }, this.name);

    EventBus.on('building:demolish', (buildingId: unknown) => {
      this.demolishBuilding(buildingId as string);
    }, this.name);

    console.log('[BuildingSystem] 建筑系统初始化完成');
  }

  update(_dt: number): void {
    // 建筑系统无需每帧更新
  }

  /** 建造建筑 */
  buildBuilding(buildingId: string): boolean {
    const data = this.registry.getBuilding(buildingId);
    if (data === undefined) return false;

    // 检查是否已存在
    if (this.hasBuilding(buildingId)) return false;

    // 检查金钱
    if (this.state.money < data.cost) return false;

    // 检查材料
    if (!this.checkMaterials(data)) return false;

    // 扣除金钱和材料
    this.state.addMoney(-data.cost);
    this.consumeMaterials(data);

    this.state.farmBuildings.push(buildingId);
    EventBus.emit(BuildingEvents.BUILDING_PLACED, buildingId);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, -data.cost, this.state.money);
    console.log(`[BuildingSystem] 建造完成: ${data.name}`);
    return true;
  }

  /** 升级建筑 */
  upgradeBuilding(buildingId: string): boolean {
    const upgradeTarget = this.getUpgradeTarget(buildingId);
    if (upgradeTarget === null) return false;

    // 检查是否已拥有当前建筑
    if (!this.hasBuilding(buildingId)) return false;

    const data = this.registry.getBuilding(upgradeTarget);
    if (data === undefined) return false;

    if (this.state.money < data.cost) return false;
    if (!this.checkMaterials(data)) return false;

    this.state.addMoney(-data.cost);
    this.consumeMaterials(data);

    // 替换建筑
    const idx = this.state.farmBuildings.indexOf(buildingId);
    if (idx !== -1) {
      this.state.farmBuildings[idx] = upgradeTarget;
    }

    EventBus.emit(BuildingEvents.BUILDING_UPGRADED, buildingId, upgradeTarget);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, -data.cost, this.state.money);
    console.log(`[BuildingSystem] 升级完成: ${buildingId} → ${upgradeTarget}`);
    return true;
  }

  /** 拆除建筑 */
  demolishBuilding(buildingId: string): boolean {
    const idx = this.state.farmBuildings.indexOf(buildingId);
    if (idx === -1) return false;

    this.state.farmBuildings.splice(idx, 1);
    EventBus.emit(BuildingEvents.BUILDING_DEMOLISHED, buildingId);
    return true;
  }

  /** 获取升级目标 */
  private getUpgradeTarget(currentId: string): string | null {
    const coopIdx = COOP_UPGRADE_PATH.indexOf(currentId);
    if (coopIdx !== -1 && coopIdx < COOP_UPGRADE_PATH.length - 1) {
      return COOP_UPGRADE_PATH[coopIdx + 1]!;
    }
    const barnIdx = BARN_UPGRADE_PATH.indexOf(currentId);
    if (barnIdx !== -1 && barnIdx < BARN_UPGRADE_PATH.length - 1) {
      return BARN_UPGRADE_PATH[barnIdx + 1]!;
    }
    const houseIdx = HOUSE_UPGRADE_PATH.indexOf(currentId);
    if (houseIdx !== -1 && houseIdx < HOUSE_UPGRADE_PATH.length - 1) {
      return HOUSE_UPGRADE_PATH[houseIdx + 1]!;
    }
    return null;
  }

  /** 检查是否拥有某建筑 */
  private hasBuilding(buildingId: string): boolean {
    return this.state.farmBuildings.includes(buildingId);
  }

  /** 检查材料是否足够 */
  private checkMaterials(data: BuildingData): boolean {
    for (const mat of data.materials) {
      if (!this.hasItem(mat.itemId, mat.amount)) return false;
    }
    return true;
  }

  /** 消耗材料 */
  private consumeMaterials(data: BuildingData): void {
    for (const mat of data.materials) {
      EventBus.emit('inventory:remove', mat.itemId, mat.amount);
    }
  }

  /** 检查背包中是否有足够的物品 */
  private hasItem(itemId: string, amount: number): boolean {
    let total = 0;
    for (const slot of this.state.inventory) {
      if (slot !== null && slot.itemId === itemId) {
        total += slot.amount;
      }
    }
    return total >= amount;
  }

  /** 获取所有建筑 */
  getBuildings(): string[] {
    return this.state.farmBuildings.slice();
  }

  /** 获取当前房屋等级（1-5） */
  getHouseLevel(): number {
    for (let i = HOUSE_UPGRADE_PATH.length - 1; i >= 0; i--) {
      if (this.state.farmBuildings.includes(HOUSE_UPGRADE_PATH[i]!)) {
        return i + 1;
      }
    }
    return 1;
  }

  /** 获取动物总容量 */
  getAnimalCapacity(): number {
    let capacity = 0;
    for (const buildingId of this.state.farmBuildings) {
      const data = this.registry.getBuilding(buildingId);
      if (data !== undefined && ['chicken_coop', 'big_coop', 'barn', 'big_barn', 'deluxe_barn'].includes(buildingId)) {
        capacity += data.capacity;
      }
    }
    return capacity;
  }

  /** 是否已解锁烹饪（房屋 ≥ 2 级） */
  isCookingUnlocked(): boolean {
    return this.getHouseLevel() >= 2;
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}