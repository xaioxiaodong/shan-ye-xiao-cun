/**
 * 存档管理器 —— 原子写入 + SHA-256 校验 + 备份槽
 *
 * 对应 GDD 9.1 存档规则
 */

import { GameState } from '@core/GameState';

/** 存档槽位 */
export type SaveSlot = 'auto' | 'slot1' | 'slot2' | 'slot3';

export class SaveManager {
  private static readonly STORAGE_PREFIX = 'sxyc_save_';
  private static readonly BACKUP_PREFIX = 'sxyc_backup_';

  /**
   * 保存游戏
   * @param state 游戏状态
   * @param slot 存档槽位
   */
  static async save(state: GameState, slot: SaveSlot): Promise<void> {
    const key = this.getKey(slot);
    const backupKey = this.getBackupKey(slot);

    // 备份旧存档
    const oldData = this.getRawData(slot);
    if (oldData !== null) {
      this.setRawData(backupKey, oldData);
    }

    // 序列化 + 计算校验和
    const json = state.toSaveData();
    const checksum = await this.computeChecksum(json);
    const saveData = JSON.stringify({ checksum, data: json, timestamp: Date.now() });

    this.setRawData(key, saveData);
    console.log(`[SaveManager] 存档已保存到 ${slot}`);
  }

  /**
   * 加载存档
   * @param slot 存档槽位
   * @returns GameState 或 null（存档不存在/损坏）
   */
  static async load(slot: SaveSlot): Promise<GameState | null> {
    const raw = this.getRawData(slot);
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as { checksum: string; data: string };
      const actualChecksum = await this.computeChecksum(parsed.data);

      if (actualChecksum !== parsed.checksum) {
        console.error(`[SaveManager] ${slot} 存档校验失败，尝试恢复备份...`);
        return this.restoreFromBackup(slot);
      }

      return GameState.fromSaveData(parsed.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[SaveManager] ${slot} 存档加载失败: ${msg}`);
      return this.restoreFromBackup(slot);
    }
  }

  /** 删除存档 */
  static delete(slot: SaveSlot): void {
    localStorage.removeItem(this.getKey(slot));
    localStorage.removeItem(this.getBackupKey(slot));
  }

  /** 检查存档是否存在 */
  static exists(slot: SaveSlot): boolean {
    return localStorage.getItem(this.getKey(slot)) !== null;
  }

  /** 获取存档元信息 */
  static getSaveInfo(slot: SaveSlot): { timestamp: number; version: string } | null {
    const raw = this.getRawData(slot);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as { timestamp: number; data: string };
      const state = JSON.parse(parsed.data) as { version: string };
      return { timestamp: parsed.timestamp, version: state.version };
    } catch {
      return null;
    }
  }

  /** 从备份恢复 */
  private static async restoreFromBackup(slot: SaveSlot): Promise<GameState | null> {
    const backupKey = this.getBackupKey(slot);
    const raw = localStorage.getItem(backupKey);
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as { checksum: string; data: string };
      const actualChecksum = await this.computeChecksum(parsed.data);
      if (actualChecksum !== parsed.checksum) return null;

      console.log(`[SaveManager] 从备份恢复 ${slot} 成功`);
      return GameState.fromSaveData(parsed.data);
    } catch {
      return null;
    }
  }

  /** 获取 slot 的原始数据 */
  private static getRawData(slot: SaveSlot): string | null {
    return localStorage.getItem(this.getKey(slot));
  }

  /** 写入原始数据 */
  private static setRawData(key: string, data: string): void {
    try {
      localStorage.setItem(key, data);
    } catch {
      console.error('[SaveManager] 写入失败：localStorage 可能已满');
    }
  }

  /** 计算 SHA-256 校验和 */
  private static async computeChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
  }

  private static getKey(slot: SaveSlot): string {
    return `${this.STORAGE_PREFIX}${slot}`;
  }

  private static getBackupKey(slot: SaveSlot): string {
    return `${this.BACKUP_PREFIX}${slot}`;
  }
}