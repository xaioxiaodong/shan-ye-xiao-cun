/**
 * 渲染安全防护 —— 精灵上限 + 对象池
 *
 * 对应 GDD 11.4.2 渲染安全
 */

import { GameConfig } from '@config/game-config';

/** 对象池 */
export class SpritePool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (item: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (item: T) => void, maxSize: number) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /** 获取一个对象 */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** 归还对象到池 */
  release(item: T): void {
    this.reset(item);
    if (this.pool.length < this.maxSize) {
      this.pool.push(item);
    }
  }

  /** 当前池大小 */
  get size(): number {
    return this.pool.length;
  }
}

export class RenderSafeguard {
  private activeSprites: number = 0;
  private activeEmitters: number = 0;

  /** 注册精灵创建 */
  registerSprite(): boolean {
    if (this.activeSprites >= GameConfig.render.maxActiveSprites) {
      console.warn('[RenderSafeguard] 精灵数量已达上限，拒绝创建');
      return false;
    }
    this.activeSprites++;
    return true;
  }

  /** 注销精灵销毁 */
  unregisterSprite(): void {
    this.activeSprites = Math.max(0, this.activeSprites - 1);
  }

  /** 注册粒子发射器 */
  registerEmitter(): boolean {
    if (this.activeEmitters >= GameConfig.render.maxEmittersActive) {
      console.warn('[RenderSafeguard] 粒子发射器已达上限，回收最旧');
      return false;
    }
    this.activeEmitters++;
    return true;
  }

  /** 注销粒子发射器 */
  unregisterEmitter(): void {
    this.activeEmitters = Math.max(0, this.activeEmitters - 1);
  }

  /** 获取当前精灵数量 */
  get spriteCount(): number {
    return this.activeSprites;
  }

  /** 获取当前粒子发射器数量 */
  get emitterCount(): number {
    return this.activeEmitters;
  }
}