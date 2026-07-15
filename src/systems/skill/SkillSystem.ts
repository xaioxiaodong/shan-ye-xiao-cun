/**
 * 技能系统 —— 5 技能等级 + 专精树选择
 *
 * 本文件行数超过 300 行：PERK_TREES 专精树为纯数据配置（GDD 4.7.3），
 * 按编码规范"纯数据配置文件可放宽至 500 行"。
 *
 * 职责：
 * 1. 管理 5 种技能的等级与经验值
 * 2. 响应游戏事件自动增加经验
 * 3. 等级 5 和 10 时可选择专精（不可重置）
 * 4. 提供专精加成查询（供其他系统使用）
 *
 * GDD 引用：4.7 技能系统、4.7.2 专精选择规则、4.7.3 专精树详细设计
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { FarmingEvents } from '@config/events';
import type { GameState, SkillLevel, PerkSelection } from '@core/GameState';
import type { SkillType } from '@config/constants';

/** 技能配置 */
interface SkillConfig {
  type: SkillType;
  name: string;
  /** 升级方式描述 */
  levelUpMethod: string;
}

/** 专精选项 */
interface PerkOption {
  id: string;
  name: string;
  description: string;
  /** 效果数值（具体含义取决于专精类型） */
  value: number;
}

/** 专精节点 */
interface PerkNode {
  /** 等级 5 的两个选项 */
  level5: [PerkOption, PerkOption];
  /** 等级 10 的选项：基于 level5 选择的分支 */
  level10: {
    /** 选择了 5A 后的两个选项 */
    branchA: [PerkOption, PerkOption];
    /** 选择了 5B 后的两个选项 */
    branchB: [PerkOption, PerkOption];
  };
}

/** 5 种技能定义 */
const SKILL_CONFIGS: SkillConfig[] = [
  { type: 'farming', name: '耕种', levelUpMethod: '收获作物、照顾动物' },
  { type: 'mining', name: '采矿', levelUpMethod: '敲矿石、下矿层' },
  { type: 'foraging', name: '采集', levelUpMethod: '捡采集物、砍树' },
  { type: 'fishing', name: '钓鱼', levelUpMethod: '钓鱼、蟹笼' },
  { type: 'combat', name: '战斗', levelUpMethod: '杀怪物' },
];

/** 专精树（GDD 4.7.3） */
const PERK_TREES: Record<SkillType, PerkNode> = {
  farming: {
    level5: [
      { id: 'farming_tiller', name: '农耕人', description: '作物产值 +10%', value: 0.10 },
      { id: 'farming_rancher', name: '畜牧人', description: '动物产品 +20%', value: 0.20 },
    ],
    level10: {
      branchA: [
        { id: 'farming_artisan', name: '工匠', description: '工匠产品产值 +40%', value: 0.40 },
        { id: 'farming_agriculturist', name: '农场主', description: '作物生长速度 +15%', value: 0.15 },
      ],
      branchB: [
        { id: 'farming_shepherd', name: '牧羊人', description: '羊毛生长速度 +50%', value: 0.50 },
        { id: 'farming_breeder', name: '牧场主', description: '动物产品 +40%', value: 0.40 },
      ],
    },
  },
  mining: {
    level5: [
      { id: 'mining_miner', name: '矿工', description: '每个矿脉 +1 矿石', value: 1 },
      { id: 'mining_geologist', name: '地质学家', description: '宝石概率 +50%', value: 0.50 },
    ],
    level10: {
      branchA: [
        { id: 'mining_blacksmith', name: '铁匠', description: '金属锭售价 +50%', value: 0.50 },
        { id: 'mining_prospector', name: '勘探者', description: '煤炭概率 +50%', value: 0.50 },
      ],
      branchB: [
        { id: 'mining_excavator', name: '挖掘者', description: '晶洞概率 +50%', value: 0.50 },
        { id: 'mining_gemologist', name: '宝石专家', description: '宝石售价 +30%', value: 0.30 },
      ],
    },
  },
  foraging: {
    level5: [
      { id: 'foraging_forester', name: '护林人', description: '木材掉落 +25%', value: 0.25 },
      { id: 'foraging_gatherer', name: '采集者', description: '采集物 +1', value: 1 },
    ],
    level10: {
      branchA: [
        { id: 'foraging_lumberjack', name: '伐木工', description: '硬木概率 +50%', value: 0.50 },
        { id: 'foraging_tapper', name: '森林主', description: '野生种子 +50%', value: 0.50 },
      ],
      branchB: [
        { id: 'foraging_botanist', name: '植物学家', description: '采集物全金星', value: 1 },
        { id: 'foraging_tracker', name: '追踪者', description: '地图显示采集点', value: 1 },
      ],
    },
  },
  fishing: {
    level5: [
      { id: 'fishing_fisher', name: '渔夫', description: '鱼售价 +25%', value: 0.25 },
      { id: 'fishing_trapper', name: '捕蟹人', description: '蟹笼成本 -50%', value: 0.50 },
    ],
    level10: {
      branchA: [
        { id: 'fishing_angler', name: '垂钓者', description: '鱼售价 +50%', value: 0.50 },
        { id: 'fishing_pirate', name: '海盗', description: '宝藏概率 +50%', value: 0.50 },
      ],
      branchB: [
        { id: 'fishing_luremaster', name: '诱饵大师', description: '蟹笼无需鱼饵', value: 1 },
        { id: 'fishing_mariner', name: '渔夫', description: '蟹笼无垃圾', value: 1 },
      ],
    },
  },
  combat: {
    level5: [
      { id: 'combat_fighter', name: '战士', description: '伤害 +10%', value: 0.10 },
      { id: 'combat_scout', name: '斥候', description: '暴击率 +50%', value: 0.50 },
    ],
    level10: {
      branchA: [
        { id: 'combat_brute', name: '野蛮人', description: '伤害 +15%', value: 0.15 },
        { id: 'combat_defender', name: '防御者', description: 'HP +25', value: 25 },
      ],
      branchB: [
        { id: 'combat_acrobat', name: '忍者', description: '暴击率 +50%', value: 0.50 },
        { id: 'combat_desperado', name: '杂技', description: '技能冷却 -50%', value: 0.50 },
      ],
    },
  },
};

/** 经验表：升至等级 n 所需累计经验（三角数 * 100） */
function expToLevel(level: number): number {
  return 100 * level * (level + 1) / 2;
}

/** 各操作的基础经验值 */
const BASE_EXP: Record<string, number> = {
  harvest: 8,    // 收获作物
  mine: 5,       // 采矿
  forage: 7,     // 采集
  fish: 10,      // 钓鱼
  kill: 12,      // 杀怪
  animalCare: 5, // 照顾动物
};

export class SkillSystem extends System {
  readonly name = 'skill';

  private state: GameState;

  constructor(state: GameState) {
    super();
    this.state = state;
  }

  init(): void {
    // 初始化技能（如果尚未初始化）
    if (this.state.skills.length === 0) {
      for (const config of SKILL_CONFIGS) {
        this.state.skills.push({
          skill: config.type,
          level: 0,
          experience: 0,
        });
      }
    }

    // 监听可增加经验的事件
    EventBus.on(FarmingEvents.HARVEST, () => this.addExperience('farming', BASE_EXP.harvest), this.name);
    // CombatSystem 通过 skill:combat_exp 发射怪物专属经验值（不再监听 MONSTER_KILLED 防止双倍经验）
    EventBus.on('skill:combat_exp', (exp: unknown) => this.addExperience('combat', exp as number), this.name);
    EventBus.on('skill:mining_exp', (exp: unknown) => this.addExperience('mining', exp as number), this.name);
    EventBus.on('skill:foraging_exp', (exp: unknown) => this.addExperience('foraging', exp as number), this.name);
    EventBus.on('skill:fishing_exp', (exp: unknown) => this.addExperience('fishing', exp as number), this.name);

    console.log(`[SkillSystem] 技能系统初始化完成，${SKILL_CONFIGS.length} 种技能已就绪`);
  }

  update(_dt: number): void {
    // 技能系统无需每帧更新
  }

  /** 增加技能经验 */
  addExperience(skillType: SkillType, amount: number): void {
    const skill = this.state.skills.find((s: SkillLevel) => s.skill === skillType);
    if (skill === undefined) return;
    if (skill.level >= 10) return; // 满级

    skill.experience += amount;
    this.checkLevelUp(skill);
  }

  /** 选择专精（等级 5 或 10 时调用） */
  selectPerk(skillType: SkillType, perkId: string): boolean {
    const skill = this.state.skills.find((s: SkillLevel) => s.skill === skillType);
    if (skill === undefined) return false;

    const perkTree = PERK_TREES[skillType];
    const existing = this.state.perks.find((p: PerkSelection) => p.skill === skillType);

    // 等级 5 选择
    if (skill.level >= 5 && (existing === undefined || existing.level5Choice === '')) {
      const isValid = perkTree.level5.some((opt: PerkOption) => opt.id === perkId);
      if (!isValid) return false;

      if (existing === undefined) {
        this.state.perks.push({ skill: skillType, level5Choice: perkId, level10Choice: '' });
      } else {
        existing.level5Choice = perkId;
      }
      EventBus.emit('skill:perk_selected', skillType, 5, perkId);
      return true;
    }

    // 等级 10 选择
    if (skill.level >= 10 && existing !== undefined && existing.level5Choice !== '' && existing.level10Choice === '') {
      const isBranchA = perkTree.level5[0]!.id === existing.level5Choice;
      const branch = isBranchA ? perkTree.level10.branchA : perkTree.level10.branchB;
      const isValid = branch.some((opt: PerkOption) => opt.id === perkId);
      if (!isValid) return false;

      existing.level10Choice = perkId;
      EventBus.emit('skill:perk_selected', skillType, 10, perkId);
      return true;
    }

    return false;
  }

  /** 获取技能等级 */
  getLevel(skillType: SkillType): number {
    return this.state.skills.find((s: SkillLevel) => s.skill === skillType)?.level ?? 0;
  }

  /** 获取技能经验 */
  getExperience(skillType: SkillType): number {
    return this.state.skills.find((s: SkillLevel) => s.skill === skillType)?.experience ?? 0;
  }

  /** 获取升至下一级所需经验 */
  getExpToNextLevel(skillType: SkillType): number {
    const skill = this.state.skills.find((s: SkillLevel) => s.skill === skillType);
    if (skill === undefined) return 0;
    if (skill.level >= 10) return 0;
    return expToLevel(skill.level + 1) - skill.experience;
  }

  /** 获取所有技能 */
  getAllSkills(): SkillLevel[] {
    return this.state.skills.slice();
  }

  /** 获取专精选择 */
  getPerkSelection(skillType: SkillType): PerkSelection | undefined {
    return this.state.perks.find((p: PerkSelection) => p.skill === skillType);
  }

  /** 获取所有专精 */
  getAllPerks(): PerkSelection[] {
    return this.state.perks.slice();
  }

  /** 获取专精选项详情 */
  getPerkOption(perkId: string): PerkOption | undefined {
    for (const tree of Object.values(PERK_TREES)) {
      for (const opt of tree.level5) {
        if (opt.id === perkId) return opt;
      }
      for (const opt of tree.level10.branchA) {
        if (opt.id === perkId) return opt;
      }
      for (const opt of tree.level10.branchB) {
        if (opt.id === perkId) return opt;
      }
    }
    return undefined;
  }

  /** 获取指定技能等级 5 的专精选项 */
  getLevel5Perks(skillType: SkillType): PerkOption[] {
    const tree = PERK_TREES[skillType];
    if (tree === undefined) return [];
    return tree.level5.slice();
  }

  /** 获取指定技能等级 10 的专精选项（基于等级 5 选择） */
  getLevel10Perks(skillType: SkillType): PerkOption[] {
    const existing = this.state.perks.find((p: PerkSelection) => p.skill === skillType);
    if (existing === undefined || existing.level5Choice === '') return [];

    const tree = PERK_TREES[skillType];
    if (tree === undefined) return [];

    const isBranchA = tree.level5[0]!.id === existing.level5Choice;
    return (isBranchA ? tree.level10.branchA : tree.level10.branchB).slice();
  }

  /** 获取技能配置列表 */
  getSkillConfigs(): SkillConfig[] {
    return SKILL_CONFIGS.slice();
  }

  /** 检查是否拥有某个专精 */
  hasPerk(perkId: string): boolean {
    for (const perk of this.state.perks) {
      if (perk.level5Choice === perkId || perk.level10Choice === perkId) return true;
    }
    return false;
  }

  /** 获取专精加成数值 */
  getPerkValue(perkId: string): number {
    const option = this.getPerkOption(perkId);
    return option?.value ?? 0;
  }

  /** 检查升级 */
  private checkLevelUp(skill: SkillLevel): void {
    while (skill.level < 10 && skill.experience >= expToLevel(skill.level + 1)) {
      skill.level++;
      EventBus.emit('skill:level_up', skill.skill, skill.level);
      console.log(`[SkillSystem] ${skill.skill} 技能升级至 ${skill.level} 级`);
    }
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}