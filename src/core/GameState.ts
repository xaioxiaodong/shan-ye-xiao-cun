/**
 * 中央游戏状态 —— 运行时状态与存档共用 Schema
 *
 * 设计要点：
 * 1. 所有字段必须可 JSON 序列化（便于存档 / 网络同步）
 * 2. 数值修改统一走 addXxx 方法，内建边界保护（GDD 11.4.5 valueBounds）
 * 3. getter 仅用于只读计算，不参与序列化
 * 4. fromSaveData 对必填字段做基础验证，防止损坏存档污染运行时
 */

import type { Season, WeatherType, Quality, SkillType, AreaId, ToolLevel, TimeOfDay } from '@config/constants';
import { TIME_CONSTANTS } from '@config/constants';
import { GameConfig } from '@config/game-config';
import { clamp } from '@utils/validation';

/** 物品实例 */
export interface InventoryItem {
  itemId: string;
  amount: number;
  quality: Quality;
}

/** 工具状态 */
export interface ToolState {
  toolId: string;
  level: ToolLevel;
}

/** 技能等级 */
export interface SkillLevel {
  skill: SkillType;
  level: number;
  experience: number;
}

/** 专精选择 */
export interface PerkSelection {
  skill: SkillType;
  level5Choice: string;
  level10Choice: string;
}

/** 地块数据 */
export interface PlotData {
  x: number;
  y: number;
  cropId: string | null;
  /** 生长进度 0.0 ~ 1.0 */
  growthProgress: number;
  watered: boolean;
  fertilized: boolean;
  fertilizerType: string | null;
  /** 再生作物是否已进入再生阶段（首次收获后设为 true） */
  regrowing: boolean;
}

/** 任务进度 */
export interface QuestProgress {
  questId: string;
  objectives: Array<{ type: string; targetId: string; requiredAmount: number; currentAmount: number }>;
  acceptedDay: number;
  acceptedSeason: Season;
}

/** 存档版本号（语义化版本，用于迁移） */
const SAVE_VERSION = '1.0.0';

/** 中央游戏状态 */
export class GameState {
  /** 版本号 */
  version: string = SAVE_VERSION;

  /** ── 玩家数据 ── */
  playerName: string = '农场主';
  playerPosition: { x: number; y: number; map: AreaId } = { x: 30, y: 25, map: 'farm' };
  money: number = GameConfig.economy.startingMoney;
  energy: number = GameConfig.player.initialMaxEnergy;
  maxEnergy: number = GameConfig.player.initialMaxEnergy;
  hp: number = GameConfig.player.initialMaxHp;
  maxHp: number = GameConfig.player.initialMaxHp;
  inventory: (InventoryItem | null)[] = [];
  tools: ToolState[] = [];
  skills: SkillLevel[] = [];
  perks: PerkSelection[] = [];
  npcFriendships: Record<string, number> = {};
  isMarried: boolean = false;
  spouseId: string | null = null;
  /** 当前装备武器 ID */
  playerWeapon: string | null = null;
  /** 基础伤害（空手） */
  playerBaseDamage: number = 5;

  /** ── 农场数据 ── */
  farmPlots: PlotData[] = [];
  farmBuildings: string[] = [];
  farmAnimals: string[] = [];
  farmMachines: string[] = [];

  /** ── 世界数据 ── */
  season: Season = 'spring';
  day: number = 1;
  year: number = 1;
  weather: WeatherType = 'sunny';
  tomorrowWeather: WeatherType = 'sunny';
  /** 游戏时间（24 小时制编码，如 1200 = 12:00，2400 = 0:00） */
  gameTime: number = TIME_CONSTANTS.DAY_START;
  unlockedAreas: AreaId[] = ['farm', 'town', 'forest', 'mountain', 'beach'];
  completedQuests: string[] = [];
  communityCenterRooms: Record<string, boolean> = {};
  /** 进行中的任务 */
  activeQuests: QuestProgress[] = [];
  /** 已参加的节日记录 */
  festivalParticipated: string[] = [];
  /** 当前矿洞楼层（0 表示不在矿洞中） */
  mineFloor: number = 0;

  /** ── 存档元数据 ── */
  savedAt: number = 0;

  // ── 安全修改器（内建边界保护）──

  /** 安全地修改金钱（受 moneyCap 限制） */
  addMoney(amount: number): void {
    this.money = clamp(this.money + amount, 0, GameConfig.economy.moneyCap);
  }

  /** 安全地修改体力（不超过 maxEnergy） */
  addEnergy(amount: number): void {
    this.energy = clamp(this.energy + amount, 0, this.maxEnergy);
  }

  /** 安全地修改 HP（不超过 maxHp） */
  addHp(amount: number): void {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  // ── 只读计算属性（getter 不参与 JSON 序列化）──

  /** 是否体力耗尽 */
  get isExhausted(): boolean {
    return this.energy <= 0;
  }

  /**
   * 获取当前时间字符串（HH:MM 格式）
   * 注意：游戏时间以 60 为进制，不是 100
   * 例：1200 → "12:00"，1330 → "13:30"，2530 → "25:30"
   */
  get timeString(): string {
    const hours = Math.floor(this.gameTime / 60);
    const minutes = this.gameTime % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /** 获取当前时段 */
  get timeOfDay(): TimeOfDay {
    const t = this.gameTime;
    if (t < 800) return 'dawn';
    if (t < 1200) return 'morning';
    if (t < 1400) return 'noon';
    if (t < 1800) return 'afternoon';
    if (t < 2000) return 'evening';
    if (t < 2400) return 'night';
    return 'late_night';
  }

  /** 是否处于深夜（玩家应回家睡觉） */
  get isLateNight(): boolean {
    return this.gameTime >= TIME_CONSTANTS.NIGHT_START;
  }

  /** 是否已过强制昏迷时间 */
  get isPastFaintTime(): boolean {
    return this.gameTime >= TIME_CONSTANTS.DAY_END;
  }

  // ── 序列化 ──

  /**
   * 序列化为存档 JSON 字符串
   * 注意：getter（timeString 等）不会出现在输出中，这是符合预期的
   */
  toSaveData(): string {
    this.savedAt = Date.now();
    return JSON.stringify(this);
  }

  /**
   * 从存档 JSON 字符串恢复
   * 对关键字段做基础校验，损坏的数据会使用默认值而非污染运行时
   */
  static fromSaveData(json: string): GameState {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('存档数据格式错误：期望对象');
    }

    const data = parsed as Record<string, unknown>;
    const state = new GameState();

    // 关键字段校验：如果类型不匹配，保留默认值
    if (typeof data.version === 'string') state.version = data.version;
    if (typeof data.playerName === 'string') state.playerName = data.playerName;
    if (typeof data.money === 'number' && Number.isFinite(data.money)) {
      state.money = clamp(data.money, 0, GameConfig.economy.moneyCap);
    }
    if (typeof data.energy === 'number' && Number.isFinite(data.energy)) {
      state.energy = clamp(data.energy, 0, state.maxEnergy);
    }
    if (typeof data.maxEnergy === 'number' && Number.isFinite(data.maxEnergy)) {
      state.maxEnergy = clamp(data.maxEnergy, GameConfig.player.initialMaxEnergy, GameConfig.player.maxEnergyCap);
    }
    if (typeof data.hp === 'number' && Number.isFinite(data.hp)) {
      state.hp = clamp(data.hp, 0, state.maxHp);
    }
    if (typeof data.gameTime === 'number' && Number.isFinite(data.gameTime)) {
      state.gameTime = clamp(data.gameTime, TIME_CONSTANTS.DAY_START, TIME_CONSTANTS.DAY_END);
    }
    if (typeof data.season === 'string') state.season = data.season as Season;
    if (typeof data.day === 'number') state.day = data.day;
    if (typeof data.year === 'number') state.year = data.year;
    if (typeof data.weather === 'string') state.weather = data.weather as WeatherType;
    if (Array.isArray(data.inventory)) state.inventory = data.inventory as (InventoryItem | null)[];
    if (Array.isArray(data.tools)) state.tools = data.tools as ToolState[];
    if (Array.isArray(data.skills)) state.skills = data.skills as SkillLevel[];
    if (Array.isArray(data.perks)) state.perks = data.perks as PerkSelection[];
    if (Array.isArray(data.completedQuests)) state.completedQuests = data.completedQuests as string[];
    if (Array.isArray(data.unlockedAreas)) state.unlockedAreas = data.unlockedAreas as AreaId[];
    if (Array.isArray(data.farmPlots)) {
      state.farmPlots = (data.farmPlots as PlotData[]).map((p: PlotData) => ({
        ...p,
        regrowing: p.regrowing ?? false,
      }));
    }
    if (Array.isArray(data.farmBuildings)) state.farmBuildings = data.farmBuildings as string[];
    if (Array.isArray(data.farmAnimals)) state.farmAnimals = data.farmAnimals as string[];
    if (Array.isArray(data.farmMachines)) state.farmMachines = data.farmMachines as string[];
    if (typeof data.isMarried === 'boolean') state.isMarried = data.isMarried;
    if (typeof data.spouseId === 'string' || data.spouseId === null) {
      state.spouseId = data.spouseId as string | null;
    }
    if (typeof data.playerWeapon === 'string' || data.playerWeapon === null) {
      state.playerWeapon = data.playerWeapon as string | null;
    }
    if (typeof data.playerBaseDamage === 'number' && Number.isFinite(data.playerBaseDamage)) {
      state.playerBaseDamage = data.playerBaseDamage;
    }
    if (Array.isArray(data.activeQuests)) state.activeQuests = data.activeQuests as QuestProgress[];
    if (Array.isArray(data.festivalParticipated)) state.festivalParticipated = data.festivalParticipated as string[];
    if (typeof data.mineFloor === 'number') state.mineFloor = data.mineFloor;
    if (typeof data.savedAt === 'number') state.savedAt = data.savedAt;

    return state;
  }
}
