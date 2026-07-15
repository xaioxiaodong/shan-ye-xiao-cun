/**
 * 系统管理器 —— 系统注册、生命周期调度、错误隔离
 *
 * 核心职责：
 * 1. 统一调度所有游戏系统的生命周期（init → update → destroy）
 * 2. 错误隔离：单个系统崩溃不影响其他系统（降级为"该功能暂不可用"）
 * 3. 按注册顺序更新系统（顺序敏感：时间 → 玩家 → 业务 → 渲染）
 * 4. 系统销毁时自动通过 EventBus.offAllByContext 清理其事件监听
 */

import { EventBus } from '@core/EventBus';
import { SystemEvents } from '@config/events';

/** 系统基类 */
export abstract class System {
  /** 系统唯一标识（用于注册、查询、日志） */
  abstract readonly name: string;

  /** 系统启用标志（子类不应直接修改，应使用 setEnabled） */
  protected enabled: boolean = true;

  /** 初始化（注册事件监听等） */
  abstract init(): void;

  /** 每帧更新 */
  abstract update(dt: number): void;

  /** 销毁（清理资源） */
  abstract destroy(): void;

  /** 启用/禁用系统 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** 查询是否启用 */
  get isEnabled(): boolean {
    return this.enabled;
  }
}

/** 系统注册条目 */
interface SystemEntry {
  system: System;
  healthy: boolean;
  errorCount: number;
  lastError: string | null;
}

export class SystemManager {
  private static instance: SystemManager | null = null;
  private systems: Map<string, SystemEntry> = new Map();
  private updateOrder: string[] = [];
  private readonly maxErrorsBeforeDisable: number = 3;

  private constructor() {
    // 单例模式
  }

  static getInstance(): SystemManager {
    if (SystemManager.instance === null) {
      SystemManager.instance = new SystemManager();
    }
    return SystemManager.instance;
  }

  /** 注册系统（按调用顺序决定更新顺序） */
  register(system: System): void {
    if (this.systems.has(system.name)) {
      console.warn(`[SystemManager] 系统 "${system.name}" 已注册，跳过`);
      return;
    }
    this.systems.set(system.name, {
      system,
      healthy: true,
      errorCount: 0,
      lastError: null,
    });
    this.updateOrder.push(system.name);
  }

  /** 初始化所有系统（按注册顺序） */
  initAll(): void {
    for (const name of this.updateOrder) {
      const entry = this.systems.get(name);
      if (entry === undefined) continue;
      try {
        entry.system.init();
        console.log(`[SystemManager] 系统 "${name}" 初始化完成`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[SystemManager] 系统 "${name}" 初始化失败: ${message}`);
        entry.healthy = false;
        entry.lastError = message;
      }
    }
    EventBus.emit(SystemEvents.SYSTEMS_INITIALIZED);
  }

  /** 更新所有系统（按注册顺序，跳过不健康/未启用的系统） */
  updateAll(dt: number): void {
    for (const name of this.updateOrder) {
      const entry = this.systems.get(name);
      if (entry === undefined || !entry.healthy || !entry.system.isEnabled) continue;

      try {
        entry.system.update(dt);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        entry.errorCount++;
        entry.lastError = message;
        console.error(`[SystemManager] 系统 "${name}" 更新失败 (${entry.errorCount}/${this.maxErrorsBeforeDisable}): ${message}`);

        if (entry.errorCount >= this.maxErrorsBeforeDisable) {
          entry.healthy = false;
          console.error(`[SystemManager] 系统 "${name}" 已被禁用（错误次数过多），降级为"该功能暂不可用"`);
          EventBus.emit(SystemEvents.SYSTEM_DISABLED, name);
        }
      }
    }
  }

  /**
   * 销毁所有系统（按注册的逆序，便于依赖清理）
   * 每个系统销毁时自动通过 EventBus.offAllByContext 清理其事件监听
   */
  destroyAll(): void {
    for (let i = this.updateOrder.length - 1; i >= 0; i--) {
      const name = this.updateOrder[i]!;
      const entry = this.systems.get(name);
      if (entry === undefined) continue;

      try {
        entry.system.destroy();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[SystemManager] 系统 "${name}" 销毁失败: ${message}`);
      }

      // 自动清理该系统注册的事件监听，避免内存泄漏
      const removedCount = EventBus.offAllByContext(name);
      if (removedCount > 0) {
        console.log(`[SystemManager] 系统 "${name}" 清理了 ${removedCount} 个事件监听器`);
      }
    }

    this.systems.clear();
    this.updateOrder = [];
  }

  /** 获取指定名称的系统（仅返回健康系统） */
  getSystem<T extends System>(name: string): T | null {
    const entry = this.systems.get(name);
    if (entry === undefined || !entry.healthy) return null;
    return entry.system as T;
  }

  /** 获取系统健康状态（调试用） */
  getSystemHealth(name: string): { healthy: boolean; errorCount: number; lastError: string | null } | null {
    const entry = this.systems.get(name);
    if (entry === undefined) return null;
    return {
      healthy: entry.healthy,
      errorCount: entry.errorCount,
      lastError: entry.lastError,
    };
  }

  /** 获取所有已注册的系统名 */
  getSystemNames(): readonly string[] {
    return this.updateOrder.slice();
  }
}
