/**
 * 任务系统 —— 主线/支线/日常/收集任务管理
 *
 * 职责：
 * 1. 任务接取（检查前置条件）
 * 2. 目标追踪（监听事件自动更新进度）
 * 3. 任务完成与奖励发放
 * 4. 日常任务每日刷新（可重复完成）
 *
 * GDD 引用：4.13 任务/剧情系统
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents, QuestEvents, NpcEvents, EconomyEvents, CombatEvents } from '@config/events';
import { GameState, type QuestProgress } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import type { QuestData } from '@core/DataRegistry';

/** 每日求助任务池 */
const DAILY_QUEST_IDS = [
  'daily_collect_crops', 'daily_deliver_item',
  'daily_fish_quest', 'daily_kill_monster', 'daily_craft_item',
];

export class QuestSystem extends System {
  readonly name = 'quest';

  private state: GameState;
  private registry: DataRegistry;

  constructor(state: GameState) {
    super();
    this.state = state;
    this.registry = DataRegistry.getInstance();
  }

  init(): void {
    // 接取任务
    EventBus.on('quest:accept', (questId: unknown) => {
      this.acceptQuest(questId as string);
    }, this.name);

    // 每日刷新日常任务
    EventBus.on(TimeEvents.DAY_END, () => this.refreshDailyQuests(), this.name);

    // 监听玩家实际获得物品事件（由 InventorySystem 发出，用于收集目标追踪）
    EventBus.on('player:item_gained', (itemId: unknown, amount: unknown) => {
      this.updateObjective('collect', itemId as string, amount as number);
    }, this.name);

    EventBus.on(NpcEvents.DIALOGUE_START, (npcId: unknown) => {
      this.updateObjective('talk', npcId as string, 1);
    }, this.name);

    EventBus.on(CombatEvents.MONSTER_KILLED, (monsterId: unknown) => {
      this.updateObjective('kill', monsterId as string, 1);
    }, this.name);

    // 通用任务进度事件（供钓鱼/合成/建筑等系统使用）
    EventBus.on('quest:progress', (type: unknown, targetId: unknown, amount: unknown) => {
      this.updateObjective(type as string, targetId as string, amount as number);
    }, this.name);

    console.log('[QuestSystem] 任务系统初始化完成');
  }

  update(_dt: number): void {
    // 任务系统无需每帧更新
  }

  /** 接取任务 */
  acceptQuest(questId: string): boolean {
    const data = this.registry.getQuest(questId);
    if (data === undefined) return false;

    // 日常任务可重复接取，不检查 completedQuests
    if (data.type !== 'daily') {
      if (this.state.completedQuests.includes(questId)) return false;
    }

    // 检查是否已在进行中
    if (this.state.activeQuests.some((q: QuestProgress) => q.questId === questId)) return false;

    // 检查前置条件
    if (!this.checkPrerequisites(data)) return false;

    // 创建任务进度
    const progress: QuestProgress = {
      questId: data.id,
      objectives: data.objectives.map((obj) => ({
        type: obj.type,
        targetId: obj.targetId,
        requiredAmount: obj.requiredAmount,
        currentAmount: 0,
      })),
      acceptedDay: this.state.day,
      acceptedSeason: this.state.season,
    };

    this.state.activeQuests.push(progress);
    EventBus.emit(QuestEvents.QUEST_ACCEPTED, questId);
    console.log(`[QuestSystem] 接取任务: ${data.title}`);
    return true;
  }

  /** 更新目标进度 */
  updateObjective(type: string, targetId: string, amount: number): void {
    for (const quest of this.state.activeQuests) {
      for (const obj of quest.objectives) {
        if (obj.type === type && obj.targetId === targetId && obj.currentAmount < obj.requiredAmount) {
          obj.currentAmount = Math.min(obj.requiredAmount, obj.currentAmount + amount);
          EventBus.emit(QuestEvents.OBJECTIVE_PROGRESS, quest.questId, obj.type, obj.currentAmount);

          // 检查是否所有目标完成
          if (this.checkQuestComplete(quest)) {
            this.completeQuest(quest);
          }
        }
      }
    }
  }

  /** 检查任务是否完成 */
  private checkQuestComplete(quest: QuestProgress): boolean {
    return quest.objectives.every((obj) => obj.currentAmount >= obj.requiredAmount);
  }

  /** 完成任务 */
  private completeQuest(quest: QuestProgress): void {
    const data = this.registry.getQuest(quest.questId);
    if (data === undefined) return;

    // 发放奖励
    this.state.addMoney(data.rewards.money);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, data.rewards.money, this.state.money);

    for (const item of data.rewards.items) {
      EventBus.emit('inventory:add', item.itemId, item.amount);
    }

    // 移除进行中任务
    this.state.activeQuests = this.state.activeQuests.filter(
      (q: QuestProgress) => q.questId !== quest.questId,
    );

    // 只有非日常任务才永久标记完成（日常任务可重复）
    if (data.type !== 'daily') {
      this.state.completedQuests.push(quest.questId);
    }

    EventBus.emit(QuestEvents.QUEST_COMPLETED, quest.questId);
    console.log(`[QuestSystem] 任务完成: ${data.title}`);
  }

  /** 检查前置条件 */
  private checkPrerequisites(data: QuestData): boolean {
    // 检查前置任务
    for (const prereqId of data.prerequisites.questIds) {
      if (!this.state.completedQuests.includes(prereqId)) return false;
    }
    // 检查季节限制
    if (data.prerequisites.season !== null && data.prerequisites.season !== this.state.season) {
      return false;
    }
    return true;
  }

  /** 刷新每日求助任务 */
  private refreshDailyQuests(): void {
    // 清除过期日常任务（未完成的）
    const expired = this.state.activeQuests.filter(
      (q: QuestProgress) => {
        const data = this.registry.getQuest(q.questId);
        return data !== undefined && data.type === 'daily';
      },
    );
    for (const exp of expired) {
      this.state.activeQuests = this.state.activeQuests.filter(
        (q: QuestProgress) => q !== exp,
      );
      EventBus.emit(QuestEvents.QUEST_FAILED, exp.questId);
    }

    // 随机生成 3 个新日常任务（日常任务可重复，不从 completedQuests 排除）
    const available = [...DAILY_QUEST_IDS];
    const count = Math.min(3, available.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const questId = available.splice(idx, 1)[0];
      if (questId !== undefined) {
        this.acceptQuest(questId);
      }
    }
  }

  /** 获取进行中的任务 */
  getActiveQuests(): QuestProgress[] {
    return this.state.activeQuests.slice();
  }

  /** 获取已完成任务 */
  getCompletedQuests(): string[] {
    return this.state.completedQuests.slice();
  }

  /** 检查任务是否可接取 */
  canAcceptQuest(questId: string): boolean {
    const data = this.registry.getQuest(questId);
    if (data === undefined) return false;
    if (data.type !== 'daily' && this.state.completedQuests.includes(questId)) return false;
    if (this.state.activeQuests.some((q: QuestProgress) => q.questId === questId)) return false;
    return this.checkPrerequisites(data);
  }

  /** 获取所有可接取的任务 */
  getAvailableQuests(): QuestData[] {
    return this.registry.getAllQuests().filter((q: QuestData) => this.canAcceptQuest(q.id));
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}
