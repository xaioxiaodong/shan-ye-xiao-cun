/**
 * 事件总线 —— 系统间松耦合通信的核心
 *
 * 设计要点：
 * 1. 单例模式，全局唯一
 * 2. 支持按 context（系统名）批量取消订阅，避免内存泄漏
 * 3. 每个 handler 有独立 try/catch，一个 handler 崩溃不影响其他
 * 4. emit 期间移除/新增的监听器不影响当前 emit 批次
 * 5. 事件名推荐使用 @config/events 中的常量，保持统一
 */

/** 事件处理函数签名 */
export type EventHandler = (...args: unknown[]) => void;

/** 内部存储结构 */
interface EventEntry {
  /** 处理函数 */
  readonly handler: EventHandler;
  /** 来源标识（通常是注册该 handler 的系统名，便于批量清理） */
  readonly context: string;
  /** 是否只触发一次 */
  readonly once: boolean;
}

export class EventBus {
  private static instance: EventBus | null = null;
  private listeners: Map<string, EventEntry[]> = new Map();

  private constructor() {
    // 单例模式
  }

  /** 获取单例 */
  static getInstance(): EventBus {
    if (EventBus.instance === null) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 订阅事件
   * @param event 事件名（推荐使用 @config/events 中的常量）
   * @param handler 处理函数
   * @param context 来源标识（系统名），用于后续批量清理
   */
  static on(event: string, handler: EventHandler, context: string = 'unknown'): void {
    EventBus.getInstance().addListener(event, handler, context, false);
  }

  /**
   * 订阅事件（仅触发一次后自动取消）
   * @param event 事件名
   * @param handler 处理函数
   * @param context 来源标识
   */
  static once(event: string, handler: EventHandler, context: string = 'unknown'): void {
    EventBus.getInstance().addListener(event, handler, context, true);
  }

  /**
   * 取消指定 handler 的订阅（精确匹配）
   * @param event 事件名
   * @param handler 要移除的处理函数
   */
  static off(event: string, handler: EventHandler): void {
    const bus = EventBus.getInstance();
    const entries = bus.listeners.get(event);
    if (entries === undefined) return;
    const filtered = entries.filter((e: EventEntry) => e.handler !== handler);
    if (filtered.length === 0) {
      bus.listeners.delete(event);
    } else {
      bus.listeners.set(event, filtered);
    }
  }

  /**
   * 批量取消指定 context 的所有监听器
   * 用途：系统销毁时清理自身注册的所有事件，避免内存泄漏
   * @param context 系统名
   */
  static offAllByContext(context: string): number {
    const bus = EventBus.getInstance();
    let removedCount = 0;
    for (const event of [...bus.listeners.keys()]) {
      const entries = bus.listeners.get(event);
      if (entries === undefined) continue;
      const before = entries.length;
      const filtered = entries.filter((e: EventEntry) => e.context !== context);
      removedCount += before - filtered.length;
      if (filtered.length === 0) {
        bus.listeners.delete(event);
      } else {
        bus.listeners.set(event, filtered);
      }
    }
    return removedCount;
  }

  /**
   * 发布事件
   * @param event 事件名
   * @param args 事件参数
   */
  static emit(event: string, ...args: unknown[]): void {
    const bus = EventBus.getInstance();
    const entries = bus.listeners.get(event);
    if (entries === undefined) return;

    // 复制一份快照，避免遍历期间被修改
    const snapshot = entries.slice();
    const onceHandlers: EventHandler[] = [];

    for (const entry of snapshot) {
      try {
        entry.handler(...args);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[EventBus] 事件 "${event}" 处理失败 (${entry.context}): ${message}`);
      }
      if (entry.once) {
        onceHandlers.push(entry.handler);
      }
    }

    // 延迟移除 once 触发的 handler
    if (onceHandlers.length > 0) {
      for (const handler of onceHandlers) {
        EventBus.off(event, handler);
      }
    }
  }

  /** 清除所有监听器（慎用，仅在完全重置时使用） */
  static clear(): void {
    EventBus.getInstance().listeners.clear();
  }

  /** 获取某事件的监听器数量（调试用） */
  static getListenerCount(event: string): number {
    return EventBus.getInstance().listeners.get(event)?.length ?? 0;
  }

  /** 获取某 context 的总监听器数量（调试用） */
  static getContextListenerCount(context: string): number {
    let count = 0;
    for (const entries of EventBus.getInstance().listeners.values()) {
      for (const entry of entries) {
        if (entry.context === context) count++;
      }
    }
    return count;
  }

  /** 内部：添加监听器 */
  private addListener(event: string, handler: EventHandler, context: string, once: boolean): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ handler, context, once });
  }
}
