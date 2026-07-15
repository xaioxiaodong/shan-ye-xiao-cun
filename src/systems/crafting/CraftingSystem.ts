/**
 * 合成系统 —— 15 配方 + 7 工匠设备
 *
 * 职责：
 * 1. 管理 15 种合成配方
 * 2. 管理 7 种工匠设备（蛋黄酱机/奶酪压机/腌菜桶/酿酒桶/蜂箱/织布机/油榨机）
 * 3. 技能等级解锁配方
 * 4. 与背包系统联动（消耗材料、产出成品）
 *
 * GDD 引用：4.8 工匠设备系统、4.11 通用合成系统
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents } from '@config/events';
import type { GameState } from '@core/GameState';
import type { SkillSystem } from '@systems/skill/SkillSystem';
import { SystemManager } from '@core/SystemManager';

/** 合成配方 */
interface CraftingRecipe {
  id: string;
  name: string;
  category: 'facility' | 'consumable' | 'decoration' | 'equipment';
  unlockSkill: string;
  unlockLevel: number;
  materials: Array<{ itemId: string; amount: number }>;
  resultItemId: string;
  resultAmount: number;
  description: string;
}

/** 工匠设备 */
interface ArtisanMachine {
  id: string;
  name: string;
  unlockSkill: string;
  unlockLevel: number;
  inputItemId: string;
  outputItemId: string;
  outputMultiplier: number;
  processingHours: number;
  description: string;
}

/** 运行时设备实例 */
interface MachineInstance {
  machineId: string;
  /** 已加工时间（游戏分钟） */
  processedTime: number;
  /** 是否正在加工 */
  active: boolean;
}

/** 15 种合成配方（GDD 4.11.2） */
const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: 'craft_furnace', name: '熔炉', category: 'facility', unlockSkill: 'mining', unlockLevel: 1,
    materials: [{ itemId: 'copper_ore', amount: 5 }, { itemId: 'stone', amount: 20 }],
    resultItemId: 'furnace', resultAmount: 1, description: '熔炼矿石成锭' },
  { id: 'craft_scarecrow', name: '稻草人', category: 'facility', unlockSkill: 'farming', unlockLevel: 1,
    materials: [{ itemId: 'wood', amount: 20 }, { itemId: 'stone', amount: 20 }, { itemId: 'coal', amount: 5 }],
    resultItemId: 'scarecrow', resultAmount: 1, description: '防止乌鸦偷吃作物' },
  { id: 'craft_chest', name: '箱子', category: 'decoration', unlockSkill: 'foraging', unlockLevel: 1,
    materials: [{ itemId: 'wood', amount: 50 }],
    resultItemId: 'chest', resultAmount: 1, description: '额外存储空间' },
  { id: 'craft_torch', name: '火炬', category: 'decoration', unlockSkill: 'foraging', unlockLevel: 1,
    materials: [{ itemId: 'wood', amount: 2 }, { itemId: 'sap', amount: 1 }],
    resultItemId: 'torch', resultAmount: 1, description: '照明' },
  { id: 'craft_trash_can', name: '垃圾桶', category: 'decoration', unlockSkill: 'foraging', unlockLevel: 1,
    materials: [{ itemId: 'wood', amount: 25 }],
    resultItemId: 'trash_can', resultAmount: 1, description: '销毁不需要的物品' },
  { id: 'craft_bomb', name: '炸弹', category: 'consumable', unlockSkill: 'mining', unlockLevel: 3,
    materials: [{ itemId: 'copper_ore', amount: 4 }, { itemId: 'coal', amount: 2 }],
    resultItemId: 'bomb', resultAmount: 1, description: '矿洞炸矿' },
  { id: 'craft_tapper', name: '树液采集器', category: 'facility', unlockSkill: 'foraging', unlockLevel: 3,
    materials: [{ itemId: 'copper_ingot', amount: 3 }, { itemId: 'wood', amount: 40 }],
    resultItemId: 'tapper', resultAmount: 1, description: '采集树液/枫糖浆' },
  { id: 'craft_crab_pot', name: '蟹笼', category: 'facility', unlockSkill: 'fishing', unlockLevel: 3,
    materials: [{ itemId: 'wood', amount: 30 }, { itemId: 'iron_ingot', amount: 3 }],
    resultItemId: 'crab_pot', resultAmount: 1, description: '捕捉螃蟹和虾类' },
  { id: 'craft_lightning_rod', name: '避雷针', category: 'facility', unlockSkill: 'foraging', unlockLevel: 4,
    materials: [{ itemId: 'iron_ingot', amount: 1 }, { itemId: 'bat_wing', amount: 5 }, { itemId: 'refined_quartz', amount: 1 }],
    resultItemId: 'lightning_rod', resultAmount: 1, description: '防雷暴，产出电池棒' },
  { id: 'craft_ring', name: '戒指', category: 'equipment', unlockSkill: 'combat', unlockLevel: 4,
    materials: [{ itemId: 'iron_ingot', amount: 2 }, { itemId: 'ruby', amount: 1 }],
    resultItemId: 'ring', resultAmount: 1, description: '佩戴后增强属性' },
  { id: 'craft_cork_bobber', name: '软木塞浮标', category: 'consumable', unlockSkill: 'fishing', unlockLevel: 2,
    materials: [{ itemId: 'wood', amount: 5 }, { itemId: 'sap', amount: 2 }],
    resultItemId: 'cork_bobber', resultAmount: 1, description: '钓鱼减少能量条滑动' },
  { id: 'craft_ladder', name: '梯子', category: 'consumable', unlockSkill: 'foraging', unlockLevel: 6,
    materials: [{ itemId: 'wood', amount: 99 }, { itemId: 'iron_ingot', amount: 2 }],
    resultItemId: 'ladder', resultAmount: 1, description: '矿洞直接下一层' },
  { id: 'craft_gem_copier', name: '宝石复制机', category: 'facility', unlockSkill: 'mining', unlockLevel: 7,
    materials: [{ itemId: 'gold_ingot', amount: 2 }, { itemId: 'ruby', amount: 1 }, { itemId: 'battery_pack', amount: 1 }],
    resultItemId: 'gem_copier', resultAmount: 1, description: '复制宝石' },
  { id: 'craft_seed_maker', name: '种子机', category: 'facility', unlockSkill: 'farming', unlockLevel: 9,
    materials: [{ itemId: 'gold_ingot', amount: 1 }, { itemId: 'wood', amount: 30 }, { itemId: 'coal', amount: 5 }],
    resultItemId: 'seed_maker', resultAmount: 1, description: '作物转化为种子' },
  { id: 'craft_honey', name: '蜂蜜采集', category: 'consumable', unlockSkill: 'foraging', unlockLevel: 8,
    materials: [],
    resultItemId: 'honey', resultAmount: 1, description: '蜂箱自动产出蜂蜜' },
];

/** 7 种工匠设备（GDD 4.8） */
const ARTISAN_MACHINES: ArtisanMachine[] = [
  { id: 'mayonnaise_machine', name: '蛋黄酱机', unlockSkill: 'farming', unlockLevel: 1,
    inputItemId: 'egg', outputItemId: 'mayonnaise', outputMultiplier: 1.8, processingHours: 3,
    description: '鸡蛋加工成蛋黄酱' },
  { id: 'cheese_press', name: '奶酪压机', unlockSkill: 'farming', unlockLevel: 5,
    inputItemId: 'milk', outputItemId: 'cheese', outputMultiplier: 1.8, processingHours: 3,
    description: '牛奶加工成奶酪' },
  { id: 'pickle_jar', name: '腌菜桶', unlockSkill: 'farming', unlockLevel: 4,
    inputItemId: 'vegetable', outputItemId: 'pickles', outputMultiplier: 2.0, processingHours: 60,
    description: '蔬菜加工成腌菜' },
  { id: 'keg', name: '酿酒桶', unlockSkill: 'farming', unlockLevel: 7,
    inputItemId: 'fruit', outputItemId: 'wine', outputMultiplier: 3.0, processingHours: 144,
    description: '水果加工成果酒' },
  { id: 'bee_house', name: '蜂箱', unlockSkill: 'farming', unlockLevel: 3,
    inputItemId: 'flower', outputItemId: 'honey', outputMultiplier: 1.0, processingHours: 24,
    description: '花附近产出蜂蜜' },
  { id: 'loom', name: '织布机', unlockSkill: 'farming', unlockLevel: 6,
    inputItemId: 'wool', outputItemId: 'cloth', outputMultiplier: 2.5, processingHours: 4,
    description: '羊毛加工成布料' },
  { id: 'oil_maker', name: '油榨机', unlockSkill: 'farming', unlockLevel: 8,
    inputItemId: 'truffle', outputItemId: 'truffle_oil', outputMultiplier: 2.5, processingHours: 2,
    description: '松露加工成松露油' },
];

export class CraftingSystem extends System {
  readonly name = 'crafting';

  private state: GameState;
  private machines: MachineInstance[] = [];

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), this.name);
    EventBus.on('crafting:craft', (recipeId: unknown) => {
      this.craft(recipeId as string);
    }, this.name);
    EventBus.on('crafting:place_machine', (machineId: unknown) => {
      this.placeMachine(machineId as string);
    }, this.name);
    EventBus.on('crafting:start_machine', (machineId: unknown) => {
      this.startMachine(machineId as string);
    }, this.name);
    console.log('[CraftingSystem] 合成系统初始化完成');
  }

  update(_dt: number): void {
    // 工匠设备在每日结束时推进
  }

  /** 执行合成 */
  craft(recipeId: string): boolean {
    const recipe = CRAFTING_RECIPES.find((r: CraftingRecipe) => r.id === recipeId);
    if (recipe === undefined) return false;

    const skillSystem = SystemManager.getInstance().getSystem<SkillSystem>('skill');
    if (skillSystem === null) return false;

    const skillLevel = skillSystem.getLevel(recipe.unlockSkill as 'farming' | 'mining' | 'foraging' | 'fishing' | 'combat');
    if (skillLevel < recipe.unlockLevel) {
      console.log(`[CraftingSystem] 需要 ${recipe.unlockSkill} 等级 ${recipe.unlockLevel}`);
      return false;
    }

    // 检查材料
    for (const mat of recipe.materials) {
      const found = this.state.inventory.find(
        (slot) => slot !== null && slot.itemId === mat.itemId && slot.amount >= mat.amount,
      );
      if (found === undefined) {
        console.log(`[CraftingSystem] 材料不足: ${mat.itemId}`);
        return false;
      }
    }

    // 消耗材料
    for (const mat of recipe.materials) {
      EventBus.emit('inventory:remove', mat.itemId, mat.amount);
    }

    // 产出成品
    EventBus.emit('inventory:add', recipe.resultItemId, recipe.resultAmount);

    EventBus.emit('crafting:crafted', recipeId, recipe.name);
    return true;
  }

  /** 放置工匠设备 */
  placeMachine(machineId: string): boolean {
    const machine = ARTISAN_MACHINES.find((m: ArtisanMachine) => m.id === machineId);
    if (machine === undefined) return false;

    this.machines.push({ machineId, processedTime: 0, active: false });
    EventBus.emit('crafting:machine_placed', machineId);
    return true;
  }

  /** 启动工匠设备加工（消耗原料，开始计时） */
  startMachine(machineId: string): boolean {
    const inst = this.machines.find((m: MachineInstance) => m.machineId === machineId && !m.active);
    if (inst === undefined) return false;

    const machine = ARTISAN_MACHINES.find((m: ArtisanMachine) => m.id === machineId);
    if (machine === undefined) return false;

    // 检查原料（需要 inputItemId）
    const found = this.state.inventory.find(
      (slot) => slot !== null && slot.itemId === machine.inputItemId && slot.amount >= 1,
    );
    if (found === undefined) {
      console.log(`[CraftingSystem] ${machine.name} 原料不足: ${machine.inputItemId}`);
      return false;
    }

    // 消耗原料
    EventBus.emit('inventory:remove', machine.inputItemId, 1);
    inst.active = true;
    inst.processedTime = 0;
    EventBus.emit('crafting:machine_started', machineId);
    return true;
  }

  /** 每日结束：推进工匠设备加工 */
  private onDayEnd(): void {
    for (const inst of this.machines) {
      const machine = ARTISAN_MACHINES.find((m: ArtisanMachine) => m.id === inst.machineId);
      if (machine === undefined) continue;

      // 推进加工时间（每天 1200 游戏分钟）
      if (inst.active) {
        inst.processedTime += 1200;
        const requiredMinutes = machine.processingHours * 60;
        if (inst.processedTime >= requiredMinutes) {
          inst.active = false;
          inst.processedTime = 0;
          // 产出
          EventBus.emit('inventory:add', machine.outputItemId, 1);
          EventBus.emit('crafting:machine_done', inst.machineId);
        }
      }
    }
  }

  /** 获取所有配方 */
  getRecipes(): CraftingRecipe[] {
    return CRAFTING_RECIPES.slice();
  }

  /** 获取所有工匠设备 */
  getArtisanMachines(): ArtisanMachine[] {
    return ARTISAN_MACHINES.slice();
  }

  /** 获取设备实例 */
  getMachines(): MachineInstance[] {
    return this.machines.slice();
  }

  destroy(): void {
    this.machines = [];
  }
}