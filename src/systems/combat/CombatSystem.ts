/**
 * 战斗系统 —— 矿洞探索、怪物战斗、武器管理
 *
 * 职责：
 * 1. 矿洞楼层管理（60 层，每 10 层有电梯）
 * 2. 怪物生成（根据楼层范围）
 * 3. 战斗机制（攻击/受伤/死亡）
 * 4. 掉落系统与经验奖励
 * 5. 武器装备与切换
 *
 * GDD 引用：4.5 战斗系统
 */

import { System } from '@core/SystemManager';
import { EventBus } from '@core/EventBus';
import { CombatEvents, PlayerEvents } from '@config/events';
import { GameState } from '@core/GameState';
import { DataRegistry } from '@core/DataRegistry';
import type { MonsterData, WeaponData } from '@core/DataRegistry';

/** 矿洞楼层怪物分布 */
const FLOOR_MONSTERS: Record<string, string[]> = {
  '1-20': ['green_slime', 'rock_crab', 'flying_bug'],
  '10-30': ['bat', 'flying_bug'],
  '21-40': ['red_slime', 'rock_crab', 'flying_bug'],
  '30-50': ['skeleton', 'flying_bug'],
  '40-60': ['shadow_brute', 'flying_bug'],
  '50-60': ['shadow_brute', 'magma_spirit', 'flying_bug'],
};

/** 矿洞配置 */
const MINE_CONFIG = {
  totalFloors: 60,
  elevatorInterval: 10,
  monstersPerFloor: { min: 3, max: 8 },
  /** 武器攻击冷却（ms） */
  attackCooldown: 500,
  /** 怪物攻击间隔（ms） */
  monsterAttackInterval: 3000,
};

export class CombatSystem extends System {
  readonly name = 'combat';

  private state: GameState;
  private registry: DataRegistry;
  /** 当前楼层怪物列表（instanceId 为唯一标识，防止同类型怪物误伤） */
  private currentMonsters: Array<{ instanceId: string; data: MonsterData; hp: number }> = [];
  /** 实例计数器（保证唯一 instanceId） */
  private instanceCounter: number = 0;
  /** 是否在矿洞中 */
  private inMine: boolean = false;
  /** 攻击冷却计时 */
  private attackTimer: number = 0;
  /** 怪物攻击计时 */
  private monsterAttackTimer: number = 0;

  constructor(state: GameState) {
    super();
    this.state = state;
    this.registry = DataRegistry.getInstance();
  }

  init(): void {
    EventBus.on('combat:attack', (targetId: unknown) => {
      this.attackMonster(targetId as string);
    }, this.name);

    EventBus.on('combat:enter_mine', () => this.enterMine(), this.name);
    EventBus.on('combat:exit_mine', () => this.exitMine(), this.name);
    EventBus.on('combat:go_down', () => this.goDownFloor(), this.name);
    EventBus.on('combat:go_up', () => this.goUpFloor(), this.name);

    console.log('[CombatSystem] 战斗系统初始化完成');
  }

  update(dt: number): void {
    if (!this.inMine) return;
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }
    // 怪物定期攻击玩家
    this.monsterAttackTimer -= dt;
    if (this.monsterAttackTimer <= 0) {
      this.monsterAttack();
      this.monsterAttackTimer = MINE_CONFIG.monsterAttackInterval;
    }
  }

  /** 进入矿洞 */
  enterMine(): void {
    this.inMine = true;
    this.state.mineFloor = 1;
    this.monsterAttackTimer = MINE_CONFIG.monsterAttackInterval;
    this.spawnMonsters();
    EventBus.emit(CombatEvents.MINE_ENTERED);
  }

  /** 离开矿洞 */
  exitMine(): void {
    this.inMine = false;
    this.state.mineFloor = 0;
    this.currentMonsters = [];
    EventBus.emit(CombatEvents.MINE_EXITED);
  }

  /** 下一层 */
  goDownFloor(): void {
    if (this.state.mineFloor >= MINE_CONFIG.totalFloors) return;
    this.state.mineFloor++;
    this.spawnMonsters();
    EventBus.emit(CombatEvents.FLOOR_CHANGED, this.state.mineFloor);
  }

  /** 上一层 */
  goUpFloor(): void {
    if (this.state.mineFloor <= 1) return;
    this.state.mineFloor--;
    this.spawnMonsters();
    EventBus.emit(CombatEvents.FLOOR_CHANGED, this.state.mineFloor);
  }

  /** 生成当前楼层怪物 */
  private spawnMonsters(): void {
    this.currentMonsters = [];
    const count = MINE_CONFIG.monstersPerFloor.min
      + Math.floor(Math.random() * (MINE_CONFIG.monstersPerFloor.max - MINE_CONFIG.monstersPerFloor.min + 1));

    const available = this.getMonstersForFloor(this.state.mineFloor);
    for (let i = 0; i < count; i++) {
      const monsterId = available[Math.floor(Math.random() * available.length)];
      if (monsterId === undefined) continue;
      const data = this.registry.getMonster(monsterId);
      if (data !== undefined) {
        this.instanceCounter++;
        this.currentMonsters.push({ instanceId: `${data.id}_${this.instanceCounter}`, data, hp: data.hp });
      }
    }
  }

  /** 获取当前楼层可出现的怪物 */
  private getMonstersForFloor(floor: number): string[] {
    const result: string[] = [];
    for (const [range, monsters] of Object.entries(FLOOR_MONSTERS)) {
      const [min, max] = range.split('-').map(Number) as [number, number];
      if (floor >= min && floor <= max) {
        result.push(...monsters);
      }
    }
    return result.length > 0 ? result : ['flying_bug'];
  }

  /** 攻击怪物 */
  attackMonster(targetId: string): void {
    if (!this.inMine || this.attackTimer > 0) return;
    if (this.state.hp <= 0) return;

    this.attackTimer = MINE_CONFIG.attackCooldown;

    const monster = this.currentMonsters.find((m) => m.instanceId === targetId);
    if (monster === undefined) return;

    const damage = this.calculateDamage();
    monster.hp -= damage;

    if (monster.hp <= 0) {
      this.onMonsterKilled(monster);
    } else {
      // 怪物存活时反击玩家
      this.monsterAttack(monster.data.damage);
    }
  }

  /** 计算玩家伤害 */
  private calculateDamage(): number {
    let damage = this.state.playerBaseDamage;
    const weapon = this.getEquippedWeapon();
    if (weapon !== null) {
      damage += weapon.damage;
    }
    // 随机波动 ±20%
    const variance = 1 + (Math.random() * 0.4 - 0.2);
    return Math.max(1, Math.floor(damage * variance));
  }

  /** 怪物被击杀 */
  private onMonsterKilled(monster: { instanceId: string; data: MonsterData; hp: number }): void {
    this.currentMonsters = this.currentMonsters.filter((m) => m.instanceId !== monster.instanceId);

    // 掉落物品
    for (const drop of monster.data.commonDrops) {
      if (Math.random() < drop.chance) {
        EventBus.emit('inventory:add', drop.itemId, 1);
      }
    }
    for (const drop of monster.data.rareDrops) {
      if (Math.random() < drop.chance) {
        EventBus.emit('inventory:add', drop.itemId, 1);
      }
    }

    // 经验（使用怪物专属经验值，不再重复触发 MONSTER_KILLED 的基础经验）
    EventBus.emit('skill:combat_exp', monster.data.experience);
    EventBus.emit(CombatEvents.MONSTER_KILLED, monster.data.id, this.state.mineFloor);
  }

  /** 怪物攻击玩家（随机一只存活怪物） */
  private monsterAttack(damage?: number): void {
    if (this.currentMonsters.length === 0) return;
    // 如果指定了伤害值，使用指定值；否则随机选一只怪物攻击
    let dmg: number;
    if (damage !== undefined) {
      dmg = damage;
    } else {
      const attacker = this.currentMonsters[Math.floor(Math.random() * this.currentMonsters.length)];
      if (attacker === undefined) return;
      dmg = attacker.data.damage;
    }
    // 随机波动 ±20%
    const variance = 1 + (Math.random() * 0.4 - 0.2);
    const finalDamage = Math.max(1, Math.floor(dmg * variance));
    this.takeDamage(finalDamage);
  }

  /** 玩家受到伤害 */
  takeDamage(amount: number): void {
    this.state.addHp(-amount);
    EventBus.emit(PlayerEvents.HP_CHANGED, this.state.hp, this.state.maxHp);
    EventBus.emit(CombatEvents.PLAYER_DAMAGED, amount, this.state.hp);

    if (this.state.hp <= 0) {
      this.onPlayerDeath();
    }
  }

  /** 玩家死亡惩罚 */
  private onPlayerDeath(): void {
    const loss = Math.min(
      Math.floor(this.state.money * 0.1),
      5000,
    );
    this.state.addMoney(-loss);
    this.state.hp = 1;
    this.exitMine();
    EventBus.emit(CombatEvents.PLAYER_DIED);
  }

  /** 装备武器 */
  equipWeapon(weaponId: string | null): void {
    this.state.playerWeapon = weaponId;
  }

  /** 获取当前装备武器 */
  getEquippedWeapon(): WeaponData | null {
    if (this.state.playerWeapon === null) return null;
    return this.registry.getWeapon(this.state.playerWeapon) ?? null;
  }

  /** 是否在矿洞中 */
  get isInMine(): boolean {
    return this.inMine;
  }

  /** 获取当前楼层 */
  getCurrentFloor(): number {
    return this.state.mineFloor;
  }

  /** 获取当前楼层怪物 */
  getCurrentMonsters(): Array<{ instanceId: string; data: MonsterData; hp: number }> {
    return this.currentMonsters;
  }

  /** 是否有电梯（每 10 层） */
  hasElevator(): boolean {
    return this.state.mineFloor > 0 && this.state.mineFloor % MINE_CONFIG.elevatorInterval === 0;
  }

  destroy(): void {
    // 由 SystemManager 自动清理
  }
}