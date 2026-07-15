/**
 * 时间系统 —— 游戏时间推进与日夜循环
 *
 * 职责：
 * 1. 每帧根据 TIME_CONSTANTS 推进游戏时间
 * 2. 管理日期、季节、年份切换
 * 3. 发射时间相关事件，供其他系统订阅
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents } from '@config/events';
import { TIME_CONSTANTS } from '@config/constants';
import type { Season, TimeOfDay } from '@config/constants';
import { GameState } from '@core/GameState';

export class TimeSystem extends System {
  readonly name = 'time';

  private state: GameState;
  /** 累积的游戏分钟（用于精确推进） */
  private accumulatedMinutes: number = 0;
  /** 上一个时段 */
  private lastPeriod: TimeOfDay | null = null;

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    this.lastPeriod = this.state.timeOfDay;
    console.log(`[TimeSystem] 初始化完成，当前时间: ${this.state.timeString}, 季节: ${this.state.season}, 第 ${this.state.day} 天`);
  }

  update(dt: number): void {
    // dt 是毫秒，转换为秒
    const dtSeconds = dt / 1000;
    this.accumulatedMinutes += dtSeconds * TIME_CONSTANTS.GAME_MINUTES_PER_REAL_SECOND;

    // 只推进整数分钟
    if (this.accumulatedMinutes < 1) return;
    const minutesToAdvance = Math.floor(this.accumulatedMinutes);
    this.accumulatedMinutes -= minutesToAdvance;

    this.advanceTime(minutesToAdvance);
  }

  /** 推进时间 */
  private advanceTime(minutes: number): void {
    let newTime = this.state.gameTime + minutes;

    // 检查是否跨天
    if (newTime >= TIME_CONSTANTS.DAY_END) {
      newTime = TIME_CONSTANTS.DAY_START;
      this.advanceDay();
    }

    this.state.gameTime = newTime;
    EventBus.emit(TimeEvents.TICK, this.state.gameTime);

    // 检查时段变化
    const currentPeriod = this.state.timeOfDay;
    if (currentPeriod !== this.lastPeriod) {
      this.lastPeriod = currentPeriod;
      EventBus.emit(TimeEvents.PERIOD_CHANGE, currentPeriod);
    }
  }

  /** 推进日期 */
  private advanceDay(): void {
    EventBus.emit(TimeEvents.DAY_END);

    this.state.day++;
    if (this.state.day > TIME_CONSTANTS.DAYS_PER_SEASON) {
      this.state.day = 1;
      this.advanceSeason();
    }
  }

  /** 推进季节 */
  private advanceSeason(): void {
    const seasonOrder: Season[] = ['spring', 'summer', 'fall', 'winter'];
    const currentIndex = seasonOrder.indexOf(this.state.season);
    const nextIndex = (currentIndex + 1) % seasonOrder.length;
    const nextSeason = seasonOrder[nextIndex]!;

    if (nextIndex === 0) {
      this.state.year++;
      EventBus.emit(TimeEvents.YEAR_CHANGE, this.state.year);
    }

    this.state.season = nextSeason;
    EventBus.emit(TimeEvents.SEASON_CHANGE, nextSeason);
    console.log(`[TimeSystem] 季节切换: ${nextSeason}, 年份: ${this.state.year}`);
  }

  destroy(): void {
    // 清理在 EventBus 上的监听（由 SystemManager 自动处理）
  }
}