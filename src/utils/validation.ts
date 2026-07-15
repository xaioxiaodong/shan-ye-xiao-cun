/** 类型守卫与数据验证工具 */

import type { Season, WeatherType, Quality, CropCategory, ItemCategory, ToolType, ToolLevel, SkillType, QuestType, AreaId } from '@config/constants';

/** 验证是否为有效的季节 */
export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && ['spring', 'summer', 'fall', 'winter'].includes(value);
}

/** 验证是否为有效的天气 */
export function isWeatherType(value: unknown): value is WeatherType {
  return typeof value === 'string' && ['sunny', 'rain', 'storm', 'snow', 'wind'].includes(value);
}

/** 验证是否为有效的品质 */
export function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && ['normal', 'silver', 'gold', 'iridium'].includes(value);
}

/** 验证是否为有效的作物类别 */
export function isCropCategory(value: unknown): value is CropCategory {
  return typeof value === 'string' && ['vegetable', 'fruit', 'flower', 'grain', 'mushroom'].includes(value);
}

/** 验证是否为有效的物品类别 */
export function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === 'string' && ['tool', 'crop', 'food', 'material', 'fish', 'drop', 'decoration', 'seed', 'artisan'].includes(value);
}

/** 验证是否为有效的工具类型 */
export function isToolType(value: unknown): value is ToolType {
  return typeof value === 'string' && ['hoe', 'watering_can', 'axe', 'pickaxe', 'scythe', 'fishing_rod', 'weapon'].includes(value);
}

/** 验证是否为有效的工具等级 */
export function isToolLevel(value: unknown): value is ToolLevel {
  return typeof value === 'string' && ['basic', 'copper', 'iron', 'gold', 'iridium'].includes(value);
}

/** 验证是否为有效的技能类型 */
export function isSkillType(value: unknown): value is SkillType {
  return typeof value === 'string' && ['farming', 'mining', 'foraging', 'fishing', 'combat'].includes(value);
}

/** 验证是否为有效的任务类型 */
export function isQuestType(value: unknown): value is QuestType {
  return typeof value === 'string' && ['main', 'side', 'daily', 'collection'].includes(value);
}

/** 验证是否为有效的区域 ID */
export function isAreaId(value: unknown): value is AreaId {
  return typeof value === 'string' && ['farm', 'town', 'forest', 'mountain', 'beach', 'desert', 'island'].includes(value);
}

/** 数值边界裁剪 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 验证字符串 ID 格式 */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && /^[a-z0-9_]+$/.test(value);
}

/** 验证非空数组 */
export function isNonEmptyArray<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.length > 0 && value.every(itemGuard);
}

/** 安全解析 JSON */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}