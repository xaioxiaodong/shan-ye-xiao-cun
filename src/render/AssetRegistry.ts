/** 资源注册表 —— 管理资源路径映射，便于后续替换占位资源为最终美术 */

/** 资源路径配置 */
interface AssetPathConfig {
  placeholder: string | null;
  final: string | null;
}

/** 资源注册表 */
export class AssetRegistry {
  private static instance: AssetRegistry | null = null;
  private paths: Map<string, AssetPathConfig> = new Map();
  private useFinal: boolean = false;

  private constructor() {
    this.registerDefaults();
  }

  static getInstance(): AssetRegistry {
    if (!AssetRegistry.instance) {
      AssetRegistry.instance = new AssetRegistry();
    }
    return AssetRegistry.instance;
  }

  /** 注册默认占位资源映射 */
  private registerDefaults(): void {
    // 玩家
    this.register('player', 'placeholder/player', 'final/player');

    // NPC
    const npcIds = ['小鹿', '阿杰', '灵溪', '石头', '小暖', '渔夫', '林婶', '陈姨', '老铁', '顾医生', '阿木', '威利', '阿婆', '小胖', '法师', '神秘商人', '隐士'];
    for (const id of npcIds) {
      this.register(`npc_${id}`, `placeholder/npc/${id}`, `final/npc/${id}`);
    }

    // 作物
    const cropIds = ['parsnip', 'potato', 'strawberry', 'blue_jazz', 'tomato', 'carrot', 'lettuce', 'pea', 'blueberry', 'hot_pepper', 'corn', 'watermelon', 'okra', 'sunflower', 'pumpkin', 'red_bean', 'eggplant', 'grape', 'cabbage', 'sweet_potato', 'wheat', 'rose', 'yam', 'autumn_pepper', 'snow_lotus', 'winter_root', 'crystal_flower', 'ice_berry'];
    for (const id of cropIds) {
      this.register(`crop_${id}`, `placeholder/crops/${id}`, `final/crops/${id}`);
    }

    // 建筑
    const buildingIds = ['coop', 'big_coop', 'barn', 'big_barn', 'deluxe_barn', 'silo', 'stable', 'fish_pond', 'cabin'];
    for (const id of buildingIds) {
      this.register(`building_${id}`, `placeholder/buildings/${id}`, `final/buildings/${id}`);
    }

    // 工具
    const toolIds = ['hoe', 'watering_can', 'axe', 'pickaxe', 'scythe', 'fishing_rod', 'sword', 'hammer', 'dagger'];
    for (const id of toolIds) {
      this.register(`tool_${id}`, `placeholder/tools/${id}`, `final/tools/${id}`);
    }

    // 动物
    const animalIds = ['chicken', 'duck', 'cow', 'sheep', 'pig'];
    for (const id of animalIds) {
      this.register(`animal_${id}`, `placeholder/animals/${id}`, `final/animals/${id}`);
    }

    // 鱼类
    const fishIds = ['carp', 'trout', 'tuna', 'catfish', 'sardine', 'bass', 'pufferfish', 'eel', 'koi', 'lantern_fish', 'magma_eel', 'ice_fish', 'night_fish', 'moonlight_fish', 'salmon', 'sea_bass', 'flounder', 'stonefish', 'glacier_fish', 'ice_pike'];
    for (const id of fishIds) {
      this.register(`fish_${id}`, `placeholder/fish/${id}`, `final/fish/${id}`);
    }

    // 怪物
    const monsterIds = ['green_slime', 'red_slime', 'bat', 'skeleton', 'rock_crab', 'bug', 'shadow_brute', 'magma_sprite'];
    for (const id of monsterIds) {
      this.register(`monster_${id}`, `placeholder/monsters/${id}`, `final/monsters/${id}`);
    }

    // UI 元素
    this.register('ui_button', 'placeholder/ui/button', 'final/ui/button');
    this.register('ui_panel', 'placeholder/ui/panel', 'final/ui/panel');
    this.register('ui_progress_bar', 'placeholder/ui/progress_bar', 'final/ui/progress_bar');
    this.register('ui_toolbar', 'placeholder/ui/toolbar', 'final/ui/toolbar');
    this.register('ui_hud', 'placeholder/ui/hud', 'final/ui/hud');

    // 地图 Tile
    const tileIds = ['grass', 'dirt', 'water', 'stone', 'path', 'sand', 'wood', 'snow', 'farmland', 'tilled_soil'];
    for (const id of tileIds) {
      this.register(`tile_${id}`, `placeholder/tiles/${id}`, `final/tiles/${id}`);
    }
  }

  /** 注册资源 */
  register(key: string, placeholder: string | null, final: string | null): void {
    this.paths.set(key, { placeholder, final });
  }

  /** 获取资源路径 */
  getPath(key: string): string | null {
    const config = this.paths.get(key);
    if (!config) return null;

    if (this.useFinal && config.final) {
      return config.final;
    }
    return config.placeholder;
  }

  /** 检查是否存在最终资源 */
  hasFinal(key: string): boolean {
    const config = this.paths.get(key);
    return config !== undefined && config.final !== null;
  }

  /** 切换到最终资源（用户提供美术后调用） */
  enableFinalAssets(): void {
    this.useFinal = true;
    console.log('[AssetRegistry] 已切换到最终美术资源');
  }

  /** 切换到占位资源 */
  enablePlaceholderAssets(): void {
    this.useFinal = false;
    console.log('[AssetRegistry] 已切换到占位美术资源');
  }

  /** 获取所有资源 key */
  getAllKeys(): string[] {
    return [...this.paths.keys()];
  }
}