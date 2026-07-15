/**
 * 烹饪系统 —— 30 种食谱 + buff 增益 + 食材消耗
 *
 * 职责：
 * 1. 管理食谱解锁与烹饪执行
 * 2. 消耗食材，产出料理
 * 3. 料理提供体力恢复与临时 buff
 * 4. 与背包系统联动（消耗食材、添加成品）
 *
 * GDD 引用：4.10 烹饪系统、4.10.2 料理分类、4.10.4 首发食谱全表
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { DataRegistry } from '@core/DataRegistry';
import { TIME_CONSTANTS } from '@config/constants';
import type { GameState } from '@core/GameState';
import type { RecipeData } from '@core/data-types';

/** 活跃的 buff */
interface ActiveBuff {
  type: string;
  value: number;
  remainingDuration: number;
}

export class CookingSystem extends System {
  readonly name = 'cooking';

  private state: GameState;
  private activeBuffs: ActiveBuff[] = [];
  /** 已解锁的食谱 ID 集合 */
  private unlockedRecipes: Set<string> = new Set();

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    // 默认解锁基础食谱
    this.unlockDefaultRecipes();

    EventBus.on('cooking:cook', (recipeId: unknown) => {
      this.cook(recipeId as string);
    }, this.name);
    EventBus.on('cooking:unlock', (recipeId: unknown) => {
      this.unlockRecipe(recipeId as string);
    }, this.name);
    console.log('[CookingSystem] 烹饪系统初始化完成');
  }

  update(_dt: number): void {
    // 更新 buff 持续时间（_dt 为真实毫秒，需转换为游戏分钟）
    const dtGameMin = (_dt / 1000) * TIME_CONSTANTS.GAME_MINUTES_PER_REAL_SECOND;
    this.activeBuffs = this.activeBuffs.filter((b: ActiveBuff) => {
      b.remainingDuration -= dtGameMin;
      return b.remainingDuration > 0;
    });
  }

  /** 解锁默认食谱 */
  private unlockDefaultRecipes(): void {
    const registry = DataRegistry.getInstance();
    const allRecipes = registry.getAllRecipes();
    for (const recipe of allRecipes) {
      if (recipe.unlockCondition === 'default') {
        this.unlockedRecipes.add(recipe.id);
      }
    }
  }

  /** 解锁食谱 */
  unlockRecipe(recipeId: string): boolean {
    const registry = DataRegistry.getInstance();
    const recipe = registry.getRecipe(recipeId);
    if (recipe === undefined) return false;

    this.unlockedRecipes.add(recipeId);
    EventBus.emit('cooking:recipe_unlocked', recipeId, recipe.name);
    return true;
  }

  /** 烹饪 */
  cook(recipeId: string): boolean {
    const registry = DataRegistry.getInstance();
    const recipe = registry.getRecipe(recipeId);
    if (recipe === undefined) return false;
    if (!this.unlockedRecipes.has(recipeId)) {
      console.log('[CookingSystem] 食谱尚未解锁');
      return false;
    }

    // 检查食材是否足够
    if (!this.hasIngredients(recipe)) {
      console.log('[CookingSystem] 食材不足');
      return false;
    }

    // 消耗食材
    this.consumeIngredients(recipe);

    // 恢复体力
    this.state.addEnergy(recipe.restoreEnergy);

    // 恢复生命值
    if (recipe.restoreHP > 0) {
      this.state.addHp(recipe.restoreHP);
    }

    // 应用 buff
    if (recipe.buff !== null) {
      this.activeBuffs.push({
        type: recipe.buff.type,
        value: recipe.buff.value,
        remainingDuration: recipe.buff.duration,
      });
      EventBus.emit('cooking:buff_applied', recipe.buff.type, recipe.buff.value);
    }

    // 添加料理到背包
    EventBus.emit('inventory:add', recipe.id, 1);

    EventBus.emit('cooking:cooked', recipeId, recipe.name);
    return true;
  }

  /** 检查食材是否足够 */
  private hasIngredients(recipe: RecipeData): boolean {
    for (const ing of recipe.ingredients) {
      const found = this.state.inventory.find(
        (slot) => slot !== null && slot.itemId === ing.itemId && slot.amount >= ing.amount,
      );
      if (found === undefined) return false;
    }
    return true;
  }

  /** 消耗食材 */
  private consumeIngredients(recipe: RecipeData): void {
    for (const ing of recipe.ingredients) {
      EventBus.emit('inventory:remove', ing.itemId, ing.amount);
    }
  }

  /** 获取活跃 buff */
  getActiveBuffs(): ActiveBuff[] {
    return this.activeBuffs.slice();
  }

  /** 获取指定类型的 buff 加成值 */
  getBuffValue(type: string): number {
    return this.activeBuffs
      .filter((b: ActiveBuff) => b.type === type)
      .reduce((sum: number, b: ActiveBuff) => sum + b.value, 0);
  }

  /** 获取已解锁食谱列表 */
  getUnlockedRecipes(): string[] {
    return [...this.unlockedRecipes];
  }

  /** 检查食谱是否已解锁 */
  isRecipeUnlocked(recipeId: string): boolean {
    return this.unlockedRecipes.has(recipeId);
  }

  destroy(): void {
    this.activeBuffs = [];
    this.unlockedRecipes.clear();
  }
}