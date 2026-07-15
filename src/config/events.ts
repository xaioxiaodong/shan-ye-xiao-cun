/**
 * 游戏事件定义 —— 统一事件名常量，避免字符串散落
 * 按系统分组，便于查找和防止命名冲突
 */

/** 时间系统事件 */
export const TimeEvents = {
  /** 每帧时间推进（参数: delta 毫秒） */
  FRAME_TICK: 'time:frame_tick',
  /** 每游戏分钟推进一次（参数: 当前时间值） */
  TICK: 'time:tick',
  /** 当天结束，准备进入下一天 */
  DAY_END: 'time:day_end',
  /** 玩家睡眠（参数: 睡眠时刻） */
  SLEEP: 'time:sleep',
  /** 季节变更（参数: 新季节） */
  SEASON_CHANGE: 'time:season_change',
  /** 年份变更（参数: 新年份） */
  YEAR_CHANGE: 'time:year_change',
  /** 时段变化（参数: 新时段） */
  PERIOD_CHANGE: 'time:period_change',
} as const;

/** 玩家事件 */
export const PlayerEvents = {
  /** 玩家移动（参数: 新坐标） */
  MOVE: 'player:move',
  /** 玩家使用工具（参数: 工具类型, 目标坐标） */
  USE_TOOL: 'player:use_tool',
  /** 玩家奔跑状态变化 */
  RUN_CHANGED: 'player:run_changed',
  /** 玩家体力变化（参数: 新体力, 最大体力） */
  ENERGY_CHANGED: 'player:energy_changed',
  /** 玩家 HP 变化 */
  HP_CHANGED: 'player:hp_changed',
  /** 玩家死亡 */
  DIED: 'player:died',
  /** 玩家复活 */
  REVIVED: 'player:revived',
} as const;

/** 耕种系统事件 */
export const FarmingEvents = {
  /** 地块翻耕（参数: 地块坐标） */
  TILL: 'farming:till',
  /** 作物播种（参数: 地块坐标, 作物ID） */
  PLANT: 'farming:plant',
  /** 作物浇水（参数: 地块坐标） */
  WATER: 'farming:water',
  /** 作物收获（参数: 地块坐标, 作物ID, 品质） */
  HARVEST: 'farming:harvest',
  /** 作物生长推进（参数: 地块坐标, 生长进度） */
  CROP_GROWN: 'farming:crop_grown',
  /** 洒水器触发（参数: 覆盖区域） */
  SPRINKLER: 'farming:sprinkler',
} as const;

/** 背包事件 */
export const InventoryEvents = {
  /** 背包变化（参数: 背包实例） */
  CHANGED: 'inventory:changed',
  /** 物品添加（参数: itemId, amount） */
  ITEM_ADDED: 'inventory:item_added',
  /** 物品移除（参数: itemId, amount） */
  ITEM_REMOVED: 'inventory:item_removed',
  /** 物品使用（参数: itemId） */
  ITEM_USED: 'inventory:item_used',
  /** 工具栏切换（参数: 新索引） */
  TOOLBAR_CHANGED: 'inventory:toolbar_changed',
} as const;

/** NPC 事件 */
export const NpcEvents = {
  /** NPC 好感度变化（参数: npcId, 新好感度） */
  FRIENDSHIP_CHANGED: 'npc:friendship_changed',
  /** 对话开始（参数: npcId） */
  DIALOGUE_START: 'npc:dialogue_start',
  /** 对话结束（参数: npcId） */
  DIALOGUE_END: 'npc:dialogue_end',
  /** 礼物赠送（参数: npcId, itemId） */
  GIFT_GIVEN: 'npc:gift_given',
  /** NPC 日程切换（参数: 当前日程类型） */
  SCHEDULE_CHANGED: 'npc:schedule_changed',
  /** 关系状态变化（如恋爱/结婚） */
  RELATIONSHIP_CHANGED: 'npc:relationship_changed',
} as const;

/** 天气系统事件 */
export const WeatherEvents = {
  /** 天气变化（参数: 新天气类型） */
  CHANGED: 'weather:changed',
  /** 天气预报更新（参数: 明日天气） */
  FORECAST: 'weather:forecast',
  /** 特殊天气效果触发（如雷暴闪电） */
  SPECIAL_EFFECT: 'weather:special_effect',
} as const;

/** 经济事件 */
export const EconomyEvents = {
  /** 金钱变化（参数: 变化量, 当前金钱） */
  MONEY_CHANGED: 'economy:money_changed',
  /** 交易完成（参数: 物品ID, 数量, 单价） */
  TRADE: 'economy:trade',
} as const;

/** 战斗系统事件 */
export const CombatEvents = {
  /** 怪物被击杀（参数: monsterId, floor） */
  MONSTER_KILLED: 'combat:monster_killed',
  /** 楼层切换（参数: 新楼层） */
  FLOOR_CHANGED: 'combat:floor_changed',
  /** 进入矿洞 */
  MINE_ENTERED: 'combat:mine_entered',
  /** 离开矿洞 */
  MINE_EXITED: 'combat:mine_exited',
  /** 玩家受到伤害（参数: 伤害量, 剩余HP） */
  PLAYER_DAMAGED: 'combat:player_damaged',
  /** 玩家在矿洞中死亡 */
  PLAYER_DIED: 'combat:player_died',
} as const;

/** 建筑系统事件 */
export const BuildingEvents = {
  /** 建筑放置完成（参数: buildingId） */
  BUILDING_PLACED: 'building:placed',
  /** 建筑升级完成（参数: buildingId, 新等级） */
  BUILDING_UPGRADED: 'building:upgraded',
  /** 建筑拆除（参数: buildingId） */
  BUILDING_DEMOLISHED: 'building:demolished',
} as const;

/** 任务系统事件 */
export const QuestEvents = {
  /** 任务接取（参数: questId） */
  QUEST_ACCEPTED: 'quest:accepted',
  /** 任务完成（参数: questId） */
  QUEST_COMPLETED: 'quest:completed',
  /** 任务失败（参数: questId） */
  QUEST_FAILED: 'quest:failed',
  /** 目标进度更新（参数: questId, objectiveIndex, currentAmount） */
  OBJECTIVE_PROGRESS: 'quest:objective_progress',
} as const;

/** 节日系统事件 */
export const FestivalEvents = {
  /** 节日开始（参数: festivalId） */
  FESTIVAL_STARTED: 'festival:started',
  /** 节日结束 */
  FESTIVAL_ENDED: 'festival:ended',
  /** 玩家参与节日 */
  FESTIVAL_PARTICIPATED: 'festival:participated',
} as const;

/** 系统级事件 */
export const SystemEvents = {
  /** 所有系统初始化完成 */
  SYSTEMS_INITIALIZED: 'system:initialized',
  /** 某系统被禁用（参数: 系统名称） */
  SYSTEM_DISABLED: 'system:disabled',
  /** 场景切换 */
  SCENE_CHANGE: 'system:scene_change',
  /** 存档开始 */
  SAVE_START: 'system:save_start',
  /** 存档完成 */
  SAVE_COMPLETE: 'system:save_complete',
  /** 存档加载 */
  SAVE_LOADED: 'system:save_loaded',
} as const;

/** 全部事件名联合类型（用于类型检查） */
export type GameEvent =
  | typeof TimeEvents[keyof typeof TimeEvents]
  | typeof PlayerEvents[keyof typeof PlayerEvents]
  | typeof FarmingEvents[keyof typeof FarmingEvents]
  | typeof InventoryEvents[keyof typeof InventoryEvents]
  | typeof NpcEvents[keyof typeof NpcEvents]
  | typeof WeatherEvents[keyof typeof WeatherEvents]
  | typeof EconomyEvents[keyof typeof EconomyEvents]
  | typeof CombatEvents[keyof typeof CombatEvents]
  | typeof BuildingEvents[keyof typeof BuildingEvents]
  | typeof QuestEvents[keyof typeof QuestEvents]
  | typeof FestivalEvents[keyof typeof FestivalEvents]
  | typeof SystemEvents[keyof typeof SystemEvents];
