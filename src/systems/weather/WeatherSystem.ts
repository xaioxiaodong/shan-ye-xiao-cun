/**
 * 天气系统 —— 天气概率矩阵与每日天气切换
 *
 * 职责：
 * 1. 实现 GDD 3.4.1 天气概率矩阵（4 季 × 5 天气）
 * 2. 每天 DAY_END 时掷骰决定次日天气
 * 3. 发射天气变化事件，通知其他系统（GDD 3.4.2 天气影响矩阵）
 * 4. 天气预报准确率 90%
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { TimeEvents, WeatherEvents } from '@config/events';
import type { Season, WeatherType } from '@config/constants';
import { GameState } from '@core/GameState';
import type { FarmingSystem } from '@systems/farming/FarmingSystem';

/** 天气概率矩阵（GDD 3.4.1） */
const WEATHER_MATRIX: Record<Season, Record<WeatherType, number>> = {
  spring: { sunny: 0.58, rain: 0.25, storm: 0.00, snow: 0.00, wind: 0.17 },
  summer: { sunny: 0.55, rain: 0.25, storm: 0.12, snow: 0.00, wind: 0.08 },
  fall:   { sunny: 0.50, rain: 0.25, storm: 0.05, snow: 0.00, wind: 0.20 },
  winter: { sunny: 0.45, rain: 0.00, storm: 0.00, snow: 0.45, wind: 0.10 },
};

const ALL_WEATHER: WeatherType[] = ['sunny', 'rain', 'storm', 'snow', 'wind'];

export class WeatherSystem extends System {
  readonly name = 'weather';

  private state: GameState;
  private farming: FarmingSystem;

  constructor(state: GameState, farming: FarmingSystem) {
    super();
    this.state = state;
    this.farming = farming;
  }

  init(): void {
    // 初始化天气：随机掷骰
    this.rollWeather(true);
    this.rollWeather(false);

    // 每日结束时决定次日天气
    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), this.name);
    // 季节切换时重新掷骰（新季节的天气概率不同）
    EventBus.on(TimeEvents.SEASON_CHANGE, () => this.onSeasonChange(), this.name);

    console.log(`[WeatherSystem] 初始化完成，今日: ${this.state.weather}, 明日: ${this.state.tomorrowWeather}`);
  }

  update(_dt: number): void {
    // 天气系统无需每帧更新
  }

  /** 每日结束：明日天气 = 今日预报，再掷骰后天天气 */
  private onDayEnd(): void {
    this.state.weather = this.state.tomorrowWeather;
    this.rollWeather(false);
    this.applyWeatherEffects();
    EventBus.emit(WeatherEvents.CHANGED, this.state.weather);
    EventBus.emit(WeatherEvents.FORECAST, this.state.tomorrowWeather);
  }

  /** 掷骰决定天气 */
  private rollWeather(isToday: boolean): void {
    const matrix = WEATHER_MATRIX[this.state.season];
    const rand = Math.random();
    let cumulative = 0;
    let selected: WeatherType = 'sunny';

    for (const weather of ALL_WEATHER) {
      cumulative += matrix[weather];
      if (rand < cumulative) {
        selected = weather;
        break;
      }
    }

    // 10% 概率预报不准（GDD 3.4.3）
    if (!isToday && Math.random() < 0.1) {
      const alternatives = ALL_WEATHER.filter((w: WeatherType) => w !== selected && matrix[w] > 0);
      if (alternatives.length > 0) {
        selected = alternatives[Math.floor(Math.random() * alternatives.length)]!;
      }
    }

    if (isToday) {
      this.state.weather = selected;
    } else {
      this.state.tomorrowWeather = selected;
    }
  }

  /** 季节切换：重新掷骰明日天气 */
  private onSeasonChange(): void {
    this.rollWeather(false);
    EventBus.emit(WeatherEvents.FORECAST, this.state.tomorrowWeather);
    console.log(`[WeatherSystem] 季节切换，重新预报: ${this.state.tomorrowWeather}`);
  }

  /** 应用天气影响（GDD 3.4.2） */
  private applyWeatherEffects(): void {
    switch (this.state.weather) {
      case 'rain':
      case 'storm':
        // 小雨/雷暴：所有作物自动浇水
        this.farming.waterAllPlots();
        break;
      case 'snow':
        // 雪：冬季作物不生长（由 FarmingSystem 检查天气）
        break;
      case 'wind':
        // 大风：NPC 室外活动减少（由 NPCSystem 检查天气）
        break;
      default:
        break;
    }
  }

  /** 获取当前天气 */
  getCurrentWeather(): WeatherType {
    return this.state.weather;
  }

  /** 获取明日天气预报 */
  getTomorrowWeather(): WeatherType {
    return this.state.tomorrowWeather;
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}