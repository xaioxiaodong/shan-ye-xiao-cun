/**
 * 游戏常量与枚举定义
 * 所有类型、枚举值、基础常量统一在此定义，避免重复定义
 */

/** 季节 */
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

/** 天气类型 */
export type WeatherType = 'sunny' | 'rain' | 'storm' | 'snow' | 'wind';

/** 物品品质 */
export type Quality = 'normal' | 'silver' | 'gold' | 'iridium';

/** 作物类别 */
export type CropCategory = 'vegetable' | 'fruit' | 'flower' | 'grain' | 'mushroom';

/** 物品分类 */
export type ItemCategory = 'tool' | 'crop' | 'food' | 'material' | 'fish' | 'drop' | 'decoration' | 'seed' | 'artisan';

/** 工具类型 */
export type ToolType = 'hoe' | 'watering_can' | 'axe' | 'pickaxe' | 'scythe' | 'fishing_rod' | 'weapon';

/** 工具等级 */
export type ToolLevel = 'basic' | 'copper' | 'iron' | 'gold' | 'iridium';

/** 技能类型 */
export type SkillType = 'farming' | 'mining' | 'foraging' | 'fishing' | 'combat';

/** 任务类型 */
export type QuestType = 'main' | 'side' | 'daily' | 'collection';

/** 对话类型 */
export type DialogueType = 'greeting' | 'default' | 'birthday' | 'festival' | 'heart_event' | 'married' | 'quest';

/** 好感度偏好 */
export type GiftPreference = 'love' | 'like' | 'neutral' | 'hate';

/** 区域 ID */
export type AreaId = 'farm' | 'town' | 'forest' | 'mountain' | 'beach' | 'desert' | 'island';

/** 时段 */
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'late_night';

/** 季节枚举数组 */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'] as const;

/** 品质倍率（与 GDD 3.2 一致） */
export const QUALITY_MULTIPLIERS: Readonly<Record<Quality, number>> = {
  normal: 1.0,
  silver: 1.25,
  gold: 1.50,
  iridium: 2.0,
};

/** 工具等级顺序 */
export const TOOL_LEVEL_ORDER: readonly ToolLevel[] = ['basic', 'copper', 'iron', 'gold', 'iridium'] as const;

/**
 * 游戏时间常量
 * 说明：
 * - 游戏时间采用 24 小时制，范围 600（6:00）~ 2600（次日 2:00）
 * - 玩家实际可活动时间为 600 ~ 2400（即 6:00 ~ 24:00）
 * - 2400 ~ 2600 为"昏迷倒计时"区间，超过 2600 强制昏迷
 * - 一天实际活动时长为 1200 分钟（20 小时 × 60）
 */
export const TIME_CONSTANTS = {
  /** 每天起始时间：6:00 AM */
  DAY_START: 600,
  /** 玩家强制昏迷时间：次日 2:00 AM（26:00） */
  DAY_END: 2600,
  /** 玩家开始困倦的时间：12:00 AM（24:00） */
  NIGHT_START: 2400,
  /** 一天实际活动分钟数：1200 分钟（6:00 ~ 24:00） */
  MINUTES_PER_DAY: 1200,
  /** 每季天数 */
  DAYS_PER_SEASON: 28,
  /** 每年季数 */
  SEASONS_PER_YEAR: 4,
  /** 每年天数 */
  DAYS_PER_YEAR: 112,
  /** 一天对应现实分钟数 */
  REAL_MINUTES_PER_DAY: 14,
  /** 每秒流逝的游戏分钟数（~1.43 游戏分钟/秒 = 14 现实分钟走完 1200 游戏分钟） */
  GAME_MINUTES_PER_REAL_SECOND: 1200 / 14 / 60,
} as const;

/** 游戏画布配置 */
export const CANVAS_CONFIG = {
  /** 逻辑宽度（像素） */
  WIDTH: 800,
  /** 逻辑高度（像素） */
  HEIGHT: 600,
  /** 单个 Tile 尺寸（像素，GDD 规定 16×16） */
  TILE_SIZE: 16,
  /** 缩放倍率（渲染分辨率 = 逻辑尺寸 × SCALE） */
  SCALE: 2,
} as const;

/** 品质等级顺序（用于比较） */
export const QUALITY_ORDER: readonly Quality[] = ['normal', 'silver', 'gold', 'iridium'] as const;

/** 品质数值等级（用于排序比较） */
export const QUALITY_RANK: Readonly<Record<Quality, number>> = {
  normal: 0,
  silver: 1,
  gold: 2,
  iridium: 3,
} as const;
