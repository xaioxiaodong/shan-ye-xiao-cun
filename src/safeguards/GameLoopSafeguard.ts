/**
 * 游戏循环安全防护 —— 帧时间保护 + 看门狗
 *
 * 对应 GDD 11.4.1 游戏循环安全
 */

import { GameConfig } from '@config/game-config';

export class GameLoopSafeguard {
  /** 单帧是否已超时 */
  private frameExceeded: boolean = false;

  /** 上一次看门狗检查时间 */
  private lastWatchdogCheck: number = 0;

  /** 上一次 update 被调用时间 */
  private lastUpdateTime: number = 0;

  /** 看门狗触发次数 */
  private watchdogTriggers: number = 0;

  /** 最大连续触发次数 */
  private readonly maxWatchdogTriggers: number = 3;

  /**
   * 在帧开始时调用
   * @returns 是否应该跳过本帧（帧时间超限）
   */
  beginFrame(): boolean {
    if (this.frameExceeded) {
      this.frameExceeded = false;
      return false;
    }
    return true;
  }

  /**
   * 在帧结束时调用
   * @param frameTimeMs 本帧耗时（毫秒）
   */
  endFrame(frameTimeMs: number): void {
    if (frameTimeMs > 100) {
      this.frameExceeded = true;
      console.warn(`[GameLoopSafeguard] 帧时间超标: ${frameTimeMs.toFixed(1)}ms，跳过下一帧渲染`);
    }
  }

  /**
   * 看门狗检查 —— 如果主循环阻塞超过 3 秒，触发保护
   * @param now 当前时间戳（毫秒）
   * @returns 是否需要重启场景
   */
  checkWatchdog(now: number): boolean {
    if (this.lastWatchdogCheck === 0) {
      this.lastWatchdogCheck = now;
      this.lastUpdateTime = now;
      return false;
    }

    const elapsed = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    // 每 5 秒检查一次
    if (now - this.lastWatchdogCheck < 5000) return false;
    this.lastWatchdogCheck = now;

    // 如果距离上次 update 超过 3 秒，说明阻塞
    if (elapsed > 3000) {
      this.watchdogTriggers++;
      console.error(`[GameLoopSafeguard] 看门狗触发 (${this.watchdogTriggers}/${this.maxWatchdogTriggers}): 主循环阻塞 ${elapsed}ms`);

      if (this.watchdogTriggers >= this.maxWatchdogTriggers) {
        console.error('[GameLoopSafeguard] 连续触发看门狗，建议重启场景');
        return true;
      }
    } else {
      this.watchdogTriggers = Math.max(0, this.watchdogTriggers - 1);
    }

    return false;
  }

  /** 获取当前帧率目标 */
  get targetFps(): number {
    return GameConfig.render.targetFps;
  }
}