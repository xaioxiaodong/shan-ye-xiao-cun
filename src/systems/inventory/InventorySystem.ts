/**
 * 背包系统 —— 物品管理、分类、堆叠、工具栏
 *
 * 职责：
 * 1. 背包存储管理（初始 12 格，可扩容至 24/36 格）
 * 2. 物品堆叠（最多 999 个/格）
 * 3. 工具栏（9 格，数字键切换）
 * 4. 物品添加/移除/合并/查询
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { InventoryEvents, EconomyEvents } from '@config/events';
import { GameState, type InventoryItem } from '@core/GameState';
import { GameConfig } from '@config/game-config';
import type { Quality } from '@config/constants';

/** 工具栏槽位数量 */
const TOOLBAR_SIZE = 9;

/** 背包扩容价格 */
const UPGRADE_COSTS: Record<number, number> = {
  24: 2000,
  36: 10000,
};

export class InventorySystem extends System {
  readonly name = 'inventory';

  private state: GameState;
  /** 当前选中的工具栏索引 */
  private selectedToolbarIndex: number = 0;

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    // 初始化背包为初始容量
    if (this.state.inventory.length === 0) {
      this.state.inventory = new Array(GameConfig.player.initialInventorySize).fill(null);
    }

    EventBus.on('inventory:add', (itemId: unknown, amount: unknown, quality?: unknown) => {
      this.addItem(itemId as string, amount as number, (quality ?? 'normal') as Quality);
    }, 'inventory');
    EventBus.on('inventory:remove', (itemId: unknown, amount: unknown) => {
      this.removeItem(itemId as string, amount as number);
    }, 'inventory');
    EventBus.on('inventory:select_slot', (index: unknown) => {
      this.selectToolbarSlot(index as number);
    }, 'inventory');

    console.log('[InventorySystem] 背包系统初始化完成');
  }

  update(_dt: number): void {
    // 背包系统不需要每帧更新
  }

  // ── 背包操作 ──

  /**
   * 添加物品到背包
   * 优先堆叠到已有同类物品的格子，否则放入空位
   * @returns 是否成功添加（false = 背包已满）
   */
  addItem(itemId: string, amount: number, quality: Quality = 'normal'): boolean {
    if (amount <= 0) return true;

    const maxStack = GameConfig.player.maxItemStackSize;
    let remaining = amount;

    // 先尝试堆叠到已有同类物品的格子
    for (let i = 0; i < this.state.inventory.length; i++) {
      const slot = this.state.inventory[i];
      if (slot !== null && slot.itemId === itemId && slot.quality === quality && slot.amount < maxStack) {
        const canAdd = Math.min(remaining, maxStack - slot.amount);
        slot.amount += canAdd;
        remaining -= canAdd;
        if (remaining <= 0) break;
      }
    }

    // 剩余物品放入空位
    if (remaining > 0) {
      for (let i = 0; i < this.state.inventory.length; i++) {
        if (this.state.inventory[i] === null || this.state.inventory[i] === undefined) {
          const canAdd = Math.min(remaining, maxStack);
          this.state.inventory[i] = { itemId, amount: canAdd, quality };
          remaining -= canAdd;
          if (remaining <= 0) break;
        }
      }
    }

    EventBus.emit(InventoryEvents.ITEM_ADDED, itemId, amount - remaining, quality);
    EventBus.emit(InventoryEvents.CHANGED);
    // 通知任务系统等：玩家实际获得了物品
    if (amount - remaining > 0) {
      EventBus.emit('player:item_gained', itemId, amount - remaining);
    }

    if (remaining > 0) {
      console.log(`[InventorySystem] 背包已满，无法放入 ${remaining} 个 ${itemId}`);
      return false;
    }

    return true;
  }

  /**
   * 从背包移除物品
   * @param itemId 物品ID
   * @param amount 数量
   * @param quality 品质（可选，不指定则移除任意品质）
   * @returns 是否成功移除（false = 物品不足）
   */
  removeItem(itemId: string, amount: number, quality?: Quality): boolean {
    if (amount <= 0) return true;

    let remaining = amount;

    for (let i = this.state.inventory.length - 1; i >= 0; i--) {
      const slot = this.state.inventory[i];
      // 如果指定了品质，必须同时匹配 itemId 和 quality
      if (slot !== null && slot.itemId === itemId) {
        if (quality !== undefined && slot.quality !== quality) {
          continue;
        }
        const canRemove = Math.min(remaining, slot.amount);
        slot.amount -= canRemove;
        remaining -= canRemove;
        if (slot.amount <= 0) {
          this.state.inventory[i] = null;
        }
        if (remaining <= 0) break;
      }
    }

    EventBus.emit(InventoryEvents.ITEM_REMOVED, itemId, amount - remaining, quality ?? 'any');
    EventBus.emit(InventoryEvents.CHANGED);

    return remaining <= 0;
  }

  /**
   * 检查背包中是否有足够数量的物品
   */
  hasItem(itemId: string, amount: number = 1): boolean {
    let count = 0;
    for (const slot of this.state.inventory) {
      if (slot !== null && slot.itemId === itemId) {
        count += slot.amount;
        if (count >= amount) return true;
      }
    }
    return false;
  }

  /**
   * 获取背包中某种物品的总数量
   */
  getItemCount(itemId: string): number {
    let count = 0;
    for (const slot of this.state.inventory) {
      if (slot !== null && slot.itemId === itemId) {
        count += slot.amount;
      }
    }
    return count;
  }

  /**
   * 检查背包是否有空位
   */
  hasEmptySlot(): boolean {
    return this.state.inventory.some((s: InventoryItem | null) => s === null || s === undefined);
  }

  /**
   * 扩容背包
   * @returns 是否成功扩容
   */
  upgradeBackpack(): boolean {
    const currentSize = this.state.inventory.length;
    const newSize = currentSize === GameConfig.player.initialInventorySize ? 24
      : currentSize === 24 ? 36 : 0;

    if (newSize === 0) {
      console.log('[InventorySystem] 背包已达最大容量');
      return false;
    }

    const cost = UPGRADE_COSTS[newSize];
    if (cost === undefined || this.state.money < cost) {
      console.log(`[InventorySystem] 金币不足，扩容需要 ${cost}g`);
      return false;
    }

    this.state.addMoney(-cost);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, -cost, this.state.money);

    // 扩容：填充空位
    const newSlots = new Array(newSize - currentSize).fill(null) as (InventoryItem | null)[];
    this.state.inventory = [...this.state.inventory, ...newSlots];

    console.log(`[InventorySystem] 背包扩容至 ${newSize} 格`);
    EventBus.emit(InventoryEvents.CHANGED);
    return true;
  }

  // ── 工具栏操作 ──

  /**
   * 选择工具栏槽位
   */
  selectToolbarSlot(index: number): void {
    if (index < 0 || index >= TOOLBAR_SIZE) return;
    this.selectedToolbarIndex = index;
    EventBus.emit(InventoryEvents.TOOLBAR_CHANGED, index);
  }

  /**
   * 获取当前选中的工具栏物品
   */
  getSelectedItem(): InventoryItem | null {
    const slot = this.state.inventory[this.selectedToolbarIndex];
    return slot ?? null;
  }

  /**
   * 获取工具栏物品列表（前 9 格）
   */
  getToolbarItems(): (InventoryItem | null)[] {
    return this.state.inventory.slice(0, TOOLBAR_SIZE);
  }

  /**
   * 获取当前工具栏索引
   */
  getSelectedIndex(): number {
    return this.selectedToolbarIndex;
  }

  /**
   * 获取背包容量
   */
  getCapacity(): number {
    return this.state.inventory.length;
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}