/**
 * 节日系统 —— 节日检测、参与与奖励
 *
 * 职责：
 * 1. 自动检测当天是否为节日日期（每日 TICK 检查一次）
 * 2. 触发节日活动（NPC 集中、特殊玩法）
 * 3. 4 个节日各有不同玩法机制
 * 4. 发放参与奖和排名奖
 * 5. 每年可重复参加（YEAR_CHANGE 时清除参与记录）
 *
 * GDD 引用：4.14 节日系统
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents, FestivalEvents, NpcEvents, EconomyEvents } from '@config/events';
import { GameState } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import type { FestivalData } from '@core/DataRegistry';

export class FestivalSystem extends System {
  readonly name = 'festival';

  private state: GameState;
  private registry: DataRegistry;
  /** 当前是否处于节日中 */
  private activeFestival: FestivalData | null = null;
  /** 上次检查的日期（避免每帧重复检查） */
  private lastCheckedDay: number = -1;

  constructor(state: GameState) {
    super();
    this.state = state;
    this.registry = DataRegistry.getInstance();
  }

  init(): void {
    // 每日结束时结束当前节日，并检查新的一天是否为节日
    EventBus.on(TimeEvents.DAY_END, () => {
      if (this.activeFestival !== null) {
        this.endFestival();
      }
      // 在 DAY_END 中直接检查新的一天，确保跨天立即触发
      this.lastCheckedDay = this.state.day;
      this.checkToday();
    }, this.name);

    // 每年重置参与记录（GDD 4.14.3：次年同季节可再次参加）
    EventBus.on(TimeEvents.YEAR_CHANGE, () => {
      this.state.festivalParticipated = [];
      console.log('[FestivalSystem] 新年开始，节日参与记录已重置');
    }, this.name);

    EventBus.on('festival:participate', () => this.participate(), this.name);
    EventBus.on('festival:submit', (itemId: unknown) => {
      this.submitEntry(itemId as string);
    }, this.name);

    // 启动时检查今天是否为节日
    this.checkToday();

    console.log('[FestivalSystem] 节日系统初始化完成');
  }

  update(_dt: number): void {
    // 检查是否跨天（DAY_END 事件已处理大部分情况，这里是安全兆底）
    if (this.state.day !== this.lastCheckedDay) {
      this.lastCheckedDay = this.state.day;
      this.checkToday();
    }
  }

  /** 检查今天是否为节日 */
  checkToday(): FestivalData | null {
    const festivals = this.registry.getAllFestivals();
    for (const festival of festivals) {
      if (festival.season === this.state.season && festival.day === this.state.day) {
        this.startFestival(festival);
        return festival;
      }
    }
    return null;
  }

  /** 开始节日 */
  private startFestival(festival: FestivalData): void {
    if (this.activeFestival !== null) return;

    this.activeFestival = festival;
    EventBus.emit(FestivalEvents.FESTIVAL_STARTED, festival.id);
    EventBus.emit(NpcEvents.SCHEDULE_CHANGED, 'festival');
    console.log(`[FestivalSystem] 节日开始: ${festival.name}`);
  }

  /** 结束节日 */
  private endFestival(): void {
    if (this.activeFestival === null) return;

    EventBus.emit(FestivalEvents.FESTIVAL_ENDED);
    EventBus.emit(NpcEvents.SCHEDULE_CHANGED, 'normal');
    console.log(`[FestivalSystem] 节日结束: ${this.activeFestival.name}`);
    this.activeFestival = null;
  }

  /** 玩家参与节日 */
  participate(): void {
    if (this.activeFestival === null) return;

    const festival = this.activeFestival;
    if (this.state.festivalParticipated.includes(festival.id)) return;

    // 发放参与奖
    this.state.addMoney(festival.participationReward.money);
    EventBus.emit(EconomyEvents.MONEY_CHANGED, festival.participationReward.money, this.state.money);

    for (const item of festival.participationReward.items) {
      EventBus.emit('inventory:add', item.itemId, item.amount);
    }

    this.state.festivalParticipated.push(festival.id);
    EventBus.emit(FestivalEvents.FESTIVAL_PARTICIPATED);
    console.log(`[FestivalSystem] 参与节日: ${festival.name}，获得参与奖`);
  }

  /** 提交参赛作品并评分 */
  submitEntry(_itemId: string): number {
    if (this.activeFestival === null) return 0;

    const festival = this.activeFestival;
    // 根据节日类型评分
    const score = this.calculateScore(festival.id);
    const rank = this.determineRank(score);

    // 发放排名奖励
    const rankReward = festival.rankRewards.find((r) => r.rank === rank);
    if (rankReward !== undefined) {
      this.state.addMoney(rankReward.money);
      EventBus.emit(EconomyEvents.MONEY_CHANGED, rankReward.money, this.state.money);
      for (const item of rankReward.items) {
        EventBus.emit('inventory:add', item.itemId, item.amount);
      }
    }

    return rank;
  }

  /** 计算评分（简化版：随机评分 + 品质加成） */
  private calculateScore(festivalId: string): number {
    const base = 50 + Math.floor(Math.random() * 50);
    // 不同节日有不同的评分加成
    switch (festivalId) {
      case 'spring_festival': return base + 10;
      case 'harvest_festival': return base + 15;
      case 'winter_feast': return base + 10;
      default: return base;
    }
  }

  /** 确定排名 */
  private determineRank(score: number): number {
    if (score >= 90) return 1;
    if (score >= 75) return 2;
    return 3;
  }

  /** 获取当前节日 */
  getActiveFestival(): FestivalData | null {
    return this.activeFestival;
  }

  /** 是否处于节日中 */
  isFestivalActive(): boolean {
    return this.activeFestival !== null;
  }

  /** 是否已参与过该节日（本年度） */
  hasParticipated(festivalId: string): boolean {
    return this.state.festivalParticipated.includes(festivalId);
  }

  /** 获取所有节日 */
  getAllFestivals(): FestivalData[] {
    return this.registry.getAllFestivals();
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}
