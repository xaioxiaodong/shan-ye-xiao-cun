/**
 * NPC 系统 —— 日程、对话、好感度、寻路
 *
 * 阶段 2 先用 3 个 NPC 验证：小鹿、阿杰、石头
 */

import Phaser from 'phaser';
import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { NpcEvents, TimeEvents } from '@config/events';
import { GameState } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import type { NpcData, NpcScheduleEntry } from '@core/data-types';
import { CANVAS_CONFIG } from '@config/constants';
import type { TileMapRenderer } from '@render/TileMapRenderer';
import { PlaceholderAssetGenerator } from '@render/PlaceholderAssetGenerator';

const TILE = CANVAS_CONFIG.TILE_SIZE;

/** NPC 好感度变化量（GDD 4.4.2） */
const FRIENDSHIP_DELTA = {
  talk: 20, lovedGift: 80, likedGift: 45,
  neutralGift: 20, hatedGift: -20, birthdayMultiplier: 8,
} as const;

/** 季节映射表（英文 → 中文） */
const SEASON_TO_CN: Record<string, string> = {
  spring: '春', summer: '夏', fall: '秋', winter: '冬',
};

/** NPC 运行时实例 */
interface NpcInstance {
  data: NpcData;
  sprite: Phaser.GameObjects.Sprite;
  scheduleIndex: number;
  talkedToday: boolean;
  giftedToday: boolean;
  targetX: number;
  targetY: number;
}

/** NPC 在各地图上的预设位置（Tile 坐标） */
const NPC_SPAWN_TILES: Record<string, Record<string, { x: number; y: number }>> = {
  farm: {
    小鹿: { x: 30, y: 30 },
    阿杰: { x: 35, y: 30 },
    石头: { x: 40, y: 30 },
  },
};

/** 解析 NPC 生日字符串，返回 { season, day } */
function parseBirthday(birthday: string): { season: string; day: number } {
  return {
    season: birthday.substring(0, 1),
    day: parseInt(birthday.substring(1), 10),
  };
}

/** 检查是否为 NPC 的生日 */
function isNpcBirthday(data: NpcData, currentSeason: string, currentDay: number): boolean {
  const { season, day } = parseBirthday(data.birthday);
  return season === SEASON_TO_CN[currentSeason] && day === currentDay;
}

export class NpcSystem extends System {
  readonly name = 'npc';

  private state: GameState;
  private scene: Phaser.Scene;
  private tileMap: TileMapRenderer;
  private npcs: Map<string, NpcInstance> = new Map();
  private currentArea: string = 'farm';

  constructor(state: GameState, scene: Phaser.Scene, tileMap: TileMapRenderer) {
    super();
    this.state = state;
    this.scene = scene;
    this.tileMap = tileMap;
  }

  init(): void {
    const registry = DataRegistry.getInstance();
    const allNpcs = registry.getAllNpcs();
    if (allNpcs.length === 0) return;

    const npcColors: Record<string, string> = {
      小鹿: '#FFB7C5', 阿杰: '#5D8A5D', 石头: '#95A5A6',
    };

    for (const data of allNpcs) {
      const color = npcColors[data.name] ?? '#FFFFFF';
      const canvas = PlaceholderAssetGenerator.generateHumanSprite(color);
      this.scene.textures.addCanvas(`npc_${data.name}`, canvas);

      const tile = NPC_SPAWN_TILES[this.currentArea]?.[data.name] ?? { x: 30, y: 30 };
      const spawnPx = tile.x * TILE;
      const spawnPy = tile.y * TILE;

      const sprite = this.scene.add.sprite(spawnPx, spawnPy, `npc_${data.name}`);
      sprite.setDepth(9);

      this.npcs.set(data.id, {
        data, sprite, scheduleIndex: 0,
        talkedToday: false, giftedToday: false,
        targetX: spawnPx, targetY: spawnPy,
      });

      if (!(data.id in this.state.npcFriendships)) {
        this.state.npcFriendships[data.id] = 0;
      }
    }

    EventBus.on(TimeEvents.TICK, () => this.onTick(), 'npc');
    EventBus.on(TimeEvents.DAY_END, () => this.onDayEnd(), 'npc');
    EventBus.on('npc:interact', (npcId: unknown) => {
      this.interactWithNpc(npcId as string);
    }, 'npc');
    EventBus.on('npc:gift', (npcId: unknown, itemId: unknown) => {
      this.giveGift(npcId as string, itemId as string);
    }, 'npc');

    console.log(`[NpcSystem] ${allNpcs.length} 个 NPC 初始化完成`);
  }

  update(_dt: number): void {
    this.updateNpcMovement();
  }

  // ── 日程管理 ──

  private onTick(): void {
    const gameTime = this.state.gameTime;
    for (const npc of this.npcs.values()) {
      this.updateSchedule(npc, gameTime);
    }
  }

  private updateSchedule(npc: NpcInstance, gameTime: number): void {
    const schedule = this.getCurrentSchedule(npc.data);
    if (schedule.length === 0) return;

    let newIndex = npc.scheduleIndex;
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (gameTime >= parseInt(schedule[i]!.time, 10)) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== npc.scheduleIndex) {
      npc.scheduleIndex = newIndex;
      npc.targetX = npc.sprite.x + (Math.random() - 0.5) * 4 * TILE;
      npc.targetY = npc.sprite.y + (Math.random() - 0.5) * 4 * TILE;
      const tile = this.tileMap.pixelToTile(npc.targetX, npc.targetY);
      if (!this.tileMap.isWalkable(tile.x, tile.y)) {
        npc.targetX = npc.sprite.x;
        npc.targetY = npc.sprite.y;
      }
    }
  }

  private getCurrentSchedule(data: NpcData): NpcScheduleEntry[] {
    const day = this.state.day;
    const isWeekend = day % 7 === 0 || day % 7 === 6;
    const isRainy = this.state.weather === 'rain' || this.state.weather === 'storm';
    if (day === 14) return data.schedule.festival;
    if (isRainy) return data.schedule.rainy;
    if (isWeekend) return data.schedule.weekend;
    return data.schedule.weekday;
  }

  // ── NPC 移动 ──

  private updateNpcMovement(): void {
    const speed = 0.5;
    for (const npc of this.npcs.values()) {
      const dx = npc.targetX - npc.sprite.x;
      const dy = npc.targetY - npc.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) continue;

      const newX = npc.sprite.x + (dx / dist) * speed;
      const newY = npc.sprite.y + (dy / dist) * speed;
      const tile = this.tileMap.pixelToTile(newX, newY);
      if (this.tileMap.isWalkable(tile.x, tile.y)) {
        npc.sprite.x = newX;
        npc.sprite.y = newY;
      }
    }
  }

  // ── 交互与送礼 ──

  private interactWithNpc(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc === undefined) return;

    EventBus.emit(NpcEvents.DIALOGUE_START, npcId);

    const hearts = Math.floor((this.state.npcFriendships[npcId] ?? 0) / 250);
    const isBirthday = isNpcBirthday(npc.data, this.state.season, this.state.day);
    const isFestival = this.state.day === 14;

    // 优先级：节日 > 生日 > 好感度
    let dialogue: string;
    if (isFestival) {
      dialogue = npc.data.dialogue.festival;
    } else if (isBirthday) {
      dialogue = npc.data.dialogue.birthday;
    } else if (hearts >= 5) {
      dialogue = npc.data.dialogue.hearts5;
    } else if (hearts >= 2) {
      dialogue = npc.data.dialogue.hearts2;
    } else {
      dialogue = npc.data.dialogue.greeting;
    }

    console.log(`[NpcSystem] ${npc.data.name}: "${dialogue}"`);

    if (!npc.talkedToday) {
      npc.talkedToday = true;
      this.addFriendship(npcId, FRIENDSHIP_DELTA.talk);
    }
    EventBus.emit(NpcEvents.DIALOGUE_END, npcId);
  }

  private giveGift(npcId: string, itemId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc === undefined) return;
    if (npc.giftedToday) return;

    const data = npc.data;
    let points: number = FRIENDSHIP_DELTA.neutralGift;

    if (data.lovedGifts.includes(itemId)) points = FRIENDSHIP_DELTA.lovedGift;
    else if (data.likedGifts.includes(itemId)) points = FRIENDSHIP_DELTA.likedGift;
    else if (data.hatedGifts.includes(itemId)) points = FRIENDSHIP_DELTA.hatedGift;

    if (isNpcBirthday(data, this.state.season, this.state.day)) {
      points *= FRIENDSHIP_DELTA.birthdayMultiplier;
    }

    npc.giftedToday = true;
    this.addFriendship(npcId, points);
    EventBus.emit(NpcEvents.GIFT_GIVEN, npcId, itemId);
  }

  private addFriendship(npcId: string, points: number): void {
    const current = this.state.npcFriendships[npcId] ?? 0;
    this.state.npcFriendships[npcId] = Math.min(2500, Math.max(0, current + points));
    EventBus.emit(NpcEvents.FRIENDSHIP_CHANGED, npcId, this.state.npcFriendships[npcId]);
  }

  private onDayEnd(): void {
    for (const npc of this.npcs.values()) {
      npc.talkedToday = false;
      npc.giftedToday = false;
    }
  }

  // ── 公开方法 ──

  getNearestNpc(playerX: number, playerY: number, maxDist: number = 2 * TILE): NpcInstance | null {
    let nearest: NpcInstance | null = null;
    let minDist = maxDist;
    for (const npc of this.npcs.values()) {
      const dx = npc.sprite.x - playerX;
      const dy = npc.sprite.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) { minDist = dist; nearest = npc; }
    }
    return nearest;
  }

  setArea(area: string): void { this.currentArea = area; }

  destroy(): void {
    for (const npc of this.npcs.values()) npc.sprite.destroy();
    this.npcs.clear();
  }
}