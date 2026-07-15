/**
 * 游戏数据接口定义（与 GDD 4.x 各系统对应）
 *
 * 所有 JSON 数据文件的 TypeScript 类型定义集中在此文件，
 * DataRegistry 和各个 System 均从此文件导入类型。
 */

import type { Season, CropCategory, ItemCategory, QuestType, ToolLevel } from '@config/constants';

/** 作物数据（GDD 4.1） */
export interface CropData {
  id: string;
  name: string;
  season: Season;
  seedCost: number;
  growthDays: number;
  regrowDays: number | null;
  basePrice: number;
  sellToNpc: boolean;
  canBeGiant: boolean;
  description: string;
  color: string;
  category: CropCategory;
  giftPreference: Record<string, 'love' | 'like' | 'neutral' | 'hate'>;
  cookingId: string | null;
  qualityChances: { normal: number; silver: number; gold: number; iridium: number };
}

/** 动物数据（GDD 4.2） */
export interface AnimalData {
  id: string;
  name: string;
  buildingRequired: string;
  price: number;
  product: string;
  productBasePrice: number;
  productInterval: number;
  maxFriendship: number;
  description: string;
  favoriteFood: string;
  artisanProduct: string;
  artisanMultiplier: number;
  secondaryProduct?: string;
  secondaryInterval?: number;
  secondaryPrice?: number;
}

/** NPC 日程条目 */
export interface NpcScheduleEntry {
  time: string;
  location: string;
  activity: string;
  interactable: boolean;
}

/** NPC 日程（四套：工作日/周末/雨天/节日） */
export interface NpcSchedule {
  weekday: NpcScheduleEntry[];
  weekend: NpcScheduleEntry[];
  rainy: NpcScheduleEntry[];
  festival: NpcScheduleEntry[];
}

/** NPC 对话数据 */
export interface NpcDialogue {
  greeting: string;
  hearts2: string;
  hearts5: string;
  birthday: string;
  festival: string;
}

/** NPC 数据（GDD 4.4） */
export interface NpcData {
  id: string;
  name: string;
  role: string;
  home: string;
  birthday: string;
  lovedGifts: string[];
  likedGifts: string[];
  hatedGifts: string[];
  isMarriageable: boolean;
  dialogue: NpcDialogue;
  schedule: NpcSchedule;
}

/** 食谱数据（GDD 4.10） */
export interface RecipeData {
  id: string;
  name: string;
  ingredients: Array<{ itemId: string; amount: number }>;
  restoreEnergy: number;
  restoreHP: number;
  buff: { type: string; value: number; duration: number } | null;
  basePrice: number;
  giftPreference: Record<string, string>;
  unlockCondition: string;
}

/** 鱼类数据（GDD 4.6） */
export interface FishData {
  id: string;
  name: string;
  location: string;
  season: Season[];
  timeRange: [number, number];
  difficulty: number;
  basePrice: number;
  behavior: string;
  description: string;
  cookingId: string | null;
  giftPreference: Record<string, string>;
  isLegendary?: boolean;
}

/** 物品数据（GDD 4.12） */
export interface ItemData {
  id: string;
  name: string;
  category: ItemCategory;
  maxStack: number;
  basePrice: number;
  description: string;
  sellable: boolean;
}

/** 任务数据（GDD 4.13） */
export interface QuestData {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  objectives: Array<{ type: string; targetId: string; requiredAmount: number }>;
  rewards: { money: number; items: Array<{ itemId: string; amount: number }> };
  prerequisites: { questIds: string[]; season: string | null };
}

/** 武器数据（GDD 4.5） */
export interface WeaponData {
  id: string;
  name: string;
  type: 'sword' | 'hammer' | 'dagger';
  damage: number;
  attackSpeed: number;
  description: string;
}

/** 怪物数据（GDD 4.5） */
export interface MonsterData {
  id: string;
  name: string;
  area: string;
  hp: number;
  damage: number;
  experience: number;
  commonDrops: Array<{ itemId: string; chance: number }>;
  rareDrops: Array<{ itemId: string; chance: number }>;
}

/** 建筑数据（GDD 4.9） */
export interface BuildingData {
  id: string;
  name: string;
  cost: number;
  materials: Array<{ itemId: string; amount: number }>;
  function: string;
  capacity: number;
}

/** 节日数据（GDD 4.14） */
export interface FestivalData {
  id: string;
  name: string;
  season: Season;
  day: number;
  time: string;
  description: string;
  participationReward: { money: number; items: Array<{ itemId: string; amount: number }> };
  rankRewards: Array<{ rank: number; money: number; items: Array<{ itemId: string; amount: number }> }>;
}

/** 工具升级数据（GDD 4.3） */
export interface ToolUpgradeData {
  level: ToolLevel;
  cost: number;
  materials: Array<{ itemId: string; amount: number }>;
  range: string;
  chargeTime: number;
}
