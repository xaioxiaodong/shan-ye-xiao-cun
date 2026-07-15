/**
 * 动物养殖系统 —— 5 种动物 + 好感度 + 每日产出
 *
 * 职责：
 * 1. 管理动物购买/饲养/好感度
 * 2. 每日结束时收集动物产品
 * 3. 好感度影响产品品质
 * 4. 与 DataRegistry 联动获取动物数据
 *
 * GDD 引用：4.2 动物养殖系统、4.2.2 动物好感计算
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents } from '@config/events';
import { DataRegistry } from '@core/DataRegistry';
import type { GameState } from '@core/GameState';
import type { AnimalData } from '@core/data-types';

/** 动物实例（运行时） */
interface AnimalInstance {
  animalId: string;
  name: string;
  friendship: number;
  /** 距离上次产出的天数 */
  daysSinceProduct: number;
  /** 是否已喂食（当天） */
  fed: boolean;
  /** 是否已抚摸（当天） */
  petted: boolean;
  /** 是否在室外 */
  outside: boolean;
}

/** 动物好感度参数（GDD 4.2.2） */
const FRIENDSHIP_RULES = {
  pet: 15,
  fed: 5,
  outside: 5,
  missed: -5,
  maxPerDay: 1000,
  productQualityThresholds: { silver: 200, gold: 500, iridium: 800 },
} as const;

export class AnimalSystem extends System {
  readonly name = 'animal';

  private state: GameState;
  private animals: AnimalInstance[] = [];

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), this.name);
    EventBus.on('animal:buy', (animalId: unknown, customName?: unknown) => {
      this.buyAnimal(animalId as string, customName as string | undefined);
    }, this.name);
    EventBus.on('animal:pet', (index: unknown) => {
      this.petAnimal(index as number);
    }, this.name);
    EventBus.on('animal:feed', (index: unknown) => {
      this.feedAnimal(index as number);
    }, this.name);
    console.log('[AnimalSystem] 动物养殖系统初始化完成');
  }

  update(_dt: number): void {
    // 动物系统在每日结束时触发
  }

  /** 购买动物 */
  buyAnimal(animalId: string, customName?: string): boolean {
    const registry = DataRegistry.getInstance();
    const animalData = registry.getAnimal(animalId);
    if (animalData === undefined) return false;

    if (this.state.money < animalData.price) {
      console.log('[AnimalSystem] 金币不足，无法购买');
      return false;
    }

    this.state.addMoney(-animalData.price);
    this.animals.push({
      animalId,
      name: customName ?? animalData.name,
      friendship: 0,
      daysSinceProduct: 0,
      fed: false,
      petted: false,
      outside: false,
    });

    this.state.farmAnimals.push(animalId);
    EventBus.emit('animal:purchased', animalId, this.animals.length);
    return true;
  }

  /** 抚摸动物 */
  petAnimal(index: number): void {
    const animal = this.animals[index];
    if (animal === undefined) return;
    animal.petted = true;
    animal.friendship = Math.min(FRIENDSHIP_RULES.maxPerDay, animal.friendship + FRIENDSHIP_RULES.pet);
    EventBus.emit('animal:petted', index, animal.friendship);
  }

  /** 喂食动物 */
  feedAnimal(index: number): void {
    const animal = this.animals[index];
    if (animal === undefined) return;
    animal.fed = true;
    animal.friendship = Math.min(FRIENDSHIP_RULES.maxPerDay, animal.friendship + FRIENDSHIP_RULES.fed);
  }

  /** 每日结束：收集产品 + 好感度衰减 */
  private onDayEnd(): void {
    for (let i = 0; i < this.animals.length; i++) {
      const animal = this.animals[i]!;
      const registry = DataRegistry.getInstance();
      const data = registry.getAnimal(animal.animalId);
      if (data === undefined) continue;

      // 好感度衰减
      if (!animal.petted && !animal.fed) {
        animal.friendship = Math.max(0, animal.friendship + FRIENDSHIP_RULES.missed);
      }

      // 晴天室外放牧额外好感
      if (this.state.weather === 'sunny' && animal.outside) {
        animal.friendship = Math.min(FRIENDSHIP_RULES.maxPerDay, animal.friendship + FRIENDSHIP_RULES.outside);
      }

      // 产出判定
      animal.daysSinceProduct++;
      if (animal.daysSinceProduct >= data.productInterval) {
        animal.daysSinceProduct = 0;
        this.collectProduct(data, animal);
      }

      // 重置每日状态
      animal.fed = false;
      animal.petted = false;
    }
  }

  /** 收集动物产品 */
  private collectProduct(data: AnimalData, animal: AnimalInstance): void {
    const quality = this.calculateProductQuality(animal.friendship);

    EventBus.emit('inventory:add', data.product, 1, quality);

    EventBus.emit('animal:product_collected', animal.animalId, data.product, quality);

    // 副产物判定（鸭毛等）
    if (data.secondaryProduct !== undefined && data.secondaryInterval !== undefined) {
      if (animal.friendship >= 500 && Math.random() < 0.3) {
        EventBus.emit('inventory:add', data.secondaryProduct, 1);
      }
    }
  }

  /** 基于好感度计算产品品质 */
  private calculateProductQuality(friendship: number): string {
    if (friendship >= FRIENDSHIP_RULES.productQualityThresholds.iridium) return 'iridium';
    if (friendship >= FRIENDSHIP_RULES.productQualityThresholds.gold) return 'gold';
    if (friendship >= FRIENDSHIP_RULES.productQualityThresholds.silver) return 'silver';
    return 'normal';
  }

  /** 获取所有动物 */
  getAnimals(): AnimalInstance[] {
    return this.animals.slice();
  }

  /** 获取动物数量 */
  getAnimalCount(): number {
    return this.animals.length;
  }

  destroy(): void {
    this.animals = [];
  }
}