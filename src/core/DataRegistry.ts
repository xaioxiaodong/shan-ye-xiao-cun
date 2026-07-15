/**
 * 数据注册中心 —— 加载、验证、索引所有 JSON 游戏数据
 *
 * 核心设计：
 * 1. 所有游戏内容数据（作物/NPC/食谱/鱼/武器等）通过 JSON 文件加载
 * 2. 每个数据类型有独立的类型守卫，验证失败的数据条目会被跳过（非整体失败）
 * 3. 单个 JSON 文件加载失败会被记录，但不会阻止其他数据加载（优雅降级）
 * 4. 所有数据加载完成后建立索引，提供按 ID / 按类别等查询方法
 */

import type { Season, ToolLevel } from '@config/constants';
import { isValidId, isSeason, isCropCategory } from '@utils/validation';
import type {
  CropData, AnimalData, NpcData, RecipeData, FishData,
  ItemData, QuestData, WeaponData, MonsterData,
  BuildingData, FestivalData, ToolUpgradeData,
} from '@core/data-types';

// 重新导出所有数据类型，便于外部统一从 DataRegistry 导入
export type {
  CropData, AnimalData, NpcData, NpcSchedule, NpcScheduleEntry,
  RecipeData, FishData, ItemData, QuestData,
  WeaponData, MonsterData, BuildingData, FestivalData, ToolUpgradeData,
} from '@core/data-types';

// ── DataRegistry 类 ──

export class DataRegistry {
  private static instance: DataRegistry | null = null;

  private crops: Map<string, CropData> = new Map();
  private animals: Map<string, AnimalData> = new Map();
  private npcs: Map<string, NpcData> = new Map();
  private recipes: Map<string, RecipeData> = new Map();
  private fish: Map<string, FishData> = new Map();
  private items: Map<string, ItemData> = new Map();
  private quests: Map<string, QuestData> = new Map();
  private weapons: Map<string, WeaponData> = new Map();
  private monsters: Map<string, MonsterData> = new Map();
  private buildings: Map<string, BuildingData> = new Map();
  private festivals: Map<string, FestivalData> = new Map();
  private toolUpgrades: Map<ToolLevel, ToolUpgradeData> = new Map();

  private failedLoads: string[] = [];
  private loaded: boolean = false;

  private constructor() {
    // 单例模式
  }

  static getInstance(): DataRegistry {
    if (DataRegistry.instance === null) {
      DataRegistry.instance = new DataRegistry();
    }
    return DataRegistry.instance;
  }

  /** 是否已加载数据 */
  get isLoaded(): boolean { return this.loaded; }

  /** 加载失败的 JSON 文件（诊断用） */
  getFailedLoads(): readonly string[] { return this.failedLoads.slice(); }

  /**
   * 加载所有数据（并行）
   * 单个文件失败会记录到 failedLoads，但不影响其他文件加载
   */
  async loadAll(): Promise<void> {
    this.failedLoads = [];
    const results = await Promise.allSettled([
      this.loadCrops(), this.loadAnimals(), this.loadNpcs(),
      this.loadRecipes(), this.loadFish(), this.loadItems(),
      this.loadQuests(), this.loadWeapons(), this.loadMonsters(),
      this.loadBuildings(), this.loadFestivals(), this.loadToolUpgrades(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.warn(`[DataRegistry] 数据加载警告: ${msg}`);
      }
    }

    this.loaded = true;
    if (this.failedLoads.length > 0) {
      console.warn(`[DataRegistry] 加载失败文件（已降级跳过）: ${this.failedLoads.join(', ')}`);
    }
    console.log('[DataRegistry] 数据加载阶段完成');
  }

  /** 安全地加载 JSON（失败返回空数组） */
  private async loadJsonSafe<T>(path: string): Promise<T[]> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        this.failedLoads.push(path);
        console.warn(`[DataRegistry] 加载失败 ${path}: ${response.status}`);
        return [];
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        this.failedLoads.push(path);
        console.warn(`[DataRegistry] 格式错误 ${path}: 期望数组`);
        return [];
      }
      return data as T[];
    } catch (error: unknown) {
      this.failedLoads.push(path);
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[DataRegistry] 加载异常 ${path}: ${msg}`);
      return [];
    }
  }

  /** 验证并加载数据到 Map */
  private async loadAndValidate<T extends { id: string }>(
    path: string,
    validator: (item: unknown) => item is T,
    target: Map<string, T>,
  ): Promise<void> {
    const data = await this.loadJsonSafe<T>(path);
    let validCount = 0;
    let skippedCount = 0;

    for (const item of data) {
      if (!validator(item)) {
        const displayId = (item as Record<string, unknown>).id as string ?? 'unknown';
        console.warn(`[DataRegistry] ${path} 中 "${displayId}" 验证失败，跳过`);
        skippedCount++;
        continue;
      }
      if (target.has(item.id)) {
        console.warn(`[DataRegistry] ${path} 中 "${item.id}" 重复，跳过`);
        skippedCount++;
        continue;
      }
      target.set(item.id, item);
      validCount++;
    }

    if (validCount > 0 || data.length > 0) {
      console.log(`[DataRegistry] ${path}: 成功 ${validCount} 条，跳过 ${skippedCount} 条`);
    }
  }

  // ── 各数据加载方法 ──

  private async loadCrops(): Promise<void> {
    await this.loadAndValidate('/src/data/crops.json', isCropData, this.crops);
  }
  private async loadAnimals(): Promise<void> {
    await this.loadAndValidate('/src/data/animals.json', isAnimalData, this.animals);
  }
  private async loadNpcs(): Promise<void> {
    await this.loadAndValidate('/src/data/npcs.json', isNpcData, this.npcs);
  }
  private async loadRecipes(): Promise<void> {
    await this.loadAndValidate('/src/data/recipes.json', isRecipeData, this.recipes);
  }
  private async loadFish(): Promise<void> {
    await this.loadAndValidate('/src/data/fish.json', isFishData, this.fish);
  }
  private async loadItems(): Promise<void> {
    await this.loadAndValidate('/src/data/items.json', isItemData, this.items);
  }
  private async loadQuests(): Promise<void> {
    await this.loadAndValidate('/src/data/quests.json', isQuestData, this.quests);
  }
  private async loadWeapons(): Promise<void> {
    await this.loadAndValidate('/src/data/weapons.json', isWeaponData, this.weapons);
  }
  private async loadMonsters(): Promise<void> {
    await this.loadAndValidate('/src/data/monsters.json', isMonsterData, this.monsters);
  }
  private async loadBuildings(): Promise<void> {
    await this.loadAndValidate('/src/data/buildings.json', isBuildingData, this.buildings);
  }
  private async loadFestivals(): Promise<void> {
    await this.loadAndValidate('/src/data/festivals.json', isFestivalData, this.festivals);
  }
  private async loadToolUpgrades(): Promise<void> {
    const data = await this.loadJsonSafe<ToolUpgradeData>('/src/data/tool-upgrades.json');
    let count = 0;
    for (const item of data) {
      if (!isToolUpgradeData(item)) continue;
      this.toolUpgrades.set(item.level, item);
      count++;
    }
    if (data.length > 0) console.log(`[DataRegistry] tool-upgrades.json: 成功 ${count} 条`);
  }

  // ── 查询方法 ──

  getCrop(id: string): CropData | undefined { return this.crops.get(id); }
  getAllCrops(): CropData[] { return [...this.crops.values()]; }
  getCropsBySeason(season: Season): CropData[] {
    return this.getAllCrops().filter((c: CropData) => c.season === season);
  }

  getAnimal(id: string): AnimalData | undefined { return this.animals.get(id); }
  getAllAnimals(): AnimalData[] { return [...this.animals.values()]; }

  getNpc(id: string): NpcData | undefined { return this.npcs.get(id); }
  getAllNpcs(): NpcData[] { return [...this.npcs.values()]; }

  getRecipe(id: string): RecipeData | undefined { return this.recipes.get(id); }
  getAllRecipes(): RecipeData[] { return [...this.recipes.values()]; }

  getFish(id: string): FishData | undefined { return this.fish.get(id); }
  getAllFish(): FishData[] { return [...this.fish.values()]; }

  getItem(id: string): ItemData | undefined { return this.items.get(id); }
  getAllItems(): ItemData[] { return [...this.items.values()]; }

  getQuest(id: string): QuestData | undefined { return this.quests.get(id); }
  getAllQuests(): QuestData[] { return [...this.quests.values()]; }

  getWeapon(id: string): WeaponData | undefined { return this.weapons.get(id); }
  getAllWeapons(): WeaponData[] { return [...this.weapons.values()]; }

  getMonster(id: string): MonsterData | undefined { return this.monsters.get(id); }
  getAllMonsters(): MonsterData[] { return [...this.monsters.values()]; }

  getBuilding(id: string): BuildingData | undefined { return this.buildings.get(id); }
  getAllBuildings(): BuildingData[] { return [...this.buildings.values()]; }

  getFestival(id: string): FestivalData | undefined { return this.festivals.get(id); }
  getAllFestivals(): FestivalData[] { return [...this.festivals.values()]; }

  getToolUpgrade(level: ToolLevel): ToolUpgradeData | undefined { return this.toolUpgrades.get(level); }
  getAllToolUpgrades(): ToolUpgradeData[] { return [...this.toolUpgrades.values()]; }
}

// ── 类型守卫（文件私有）──

function isCropData(item: unknown): item is CropData {
  if (typeof item !== 'object' || item === null) return false;
  const c = item as Record<string, unknown>;
  return isValidId(c.id) && typeof c.name === 'string' && isSeason(c.season)
    && typeof c.seedCost === 'number' && typeof c.growthDays === 'number'
    && typeof c.basePrice === 'number' && isCropCategory(c.category);
}

function isAnimalData(item: unknown): item is AnimalData {
  if (typeof item !== 'object' || item === null) return false;
  const a = item as Record<string, unknown>;
  return isValidId(a.id) && typeof a.name === 'string' && typeof a.price === 'number';
}

function isNpcData(item: unknown): item is NpcData {
  if (typeof item !== 'object' || item === null) return false;
  const n = item as Record<string, unknown>;
  if (!isValidId(n.id) || typeof n.name !== 'string') return false;
  if (!Array.isArray(n.lovedGifts) || !Array.isArray(n.likedGifts) || !Array.isArray(n.hatedGifts)) return false;
  if (typeof n.schedule !== 'object' || n.schedule === null) return false;
  const schedule = n.schedule as Record<string, unknown>;
  if (!Array.isArray(schedule.weekday) || !Array.isArray(schedule.weekend)) return false;
  if (!Array.isArray(schedule.rainy) || !Array.isArray(schedule.festival)) return false;
  if (typeof n.dialogue !== 'object' || n.dialogue === null) return false;
  const d = n.dialogue as Record<string, unknown>;
  return typeof d.greeting === 'string' && typeof d.hearts2 === 'string'
    && typeof d.hearts5 === 'string' && typeof d.birthday === 'string'
    && typeof d.festival === 'string';
}

function isRecipeData(item: unknown): item is RecipeData {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return isValidId(r.id) && typeof r.name === 'string' && Array.isArray(r.ingredients);
}

function isFishData(item: unknown): item is FishData {
  if (typeof item !== 'object' || item === null) return false;
  const f = item as Record<string, unknown>;
  return isValidId(f.id) && typeof f.name === 'string' && typeof f.basePrice === 'number';
}

function isItemData(item: unknown): item is ItemData {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return isValidId(i.id) && typeof i.name === 'string';
}

function isQuestData(item: unknown): item is QuestData {
  if (typeof item !== 'object' || item === null) return false;
  const q = item as Record<string, unknown>;
  return isValidId(q.id) && typeof q.title === 'string';
}

function isWeaponData(item: unknown): item is WeaponData {
  if (typeof item !== 'object' || item === null) return false;
  const w = item as Record<string, unknown>;
  return isValidId(w.id) && typeof w.name === 'string' && typeof w.damage === 'number';
}

function isMonsterData(item: unknown): item is MonsterData {
  if (typeof item !== 'object' || item === null) return false;
  const m = item as Record<string, unknown>;
  return isValidId(m.id) && typeof m.name === 'string' && typeof m.hp === 'number';
}

function isBuildingData(item: unknown): item is BuildingData {
  if (typeof item !== 'object' || item === null) return false;
  const b = item as Record<string, unknown>;
  return isValidId(b.id) && typeof b.name === 'string' && typeof b.cost === 'number';
}

function isFestivalData(item: unknown): item is FestivalData {
  if (typeof item !== 'object' || item === null) return false;
  const f = item as Record<string, unknown>;
  return isValidId(f.id) && typeof f.name === 'string' && isSeason(f.season);
}

function isToolUpgradeData(item: unknown): item is ToolUpgradeData {
  if (typeof item !== 'object' || item === null) return false;
  const t = item as Record<string, unknown>;
  return typeof t.level === 'string' && typeof t.cost === 'number';
}
