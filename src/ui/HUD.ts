/**
 * HUD 抬头显示 —— 游戏信息浮层
 *
 * 显示时间、金币、季节日期、体力、生命值等信息。
 * 使用占位风格（纯色背景 + 等宽字体）。
 */

import Phaser from 'phaser';
import { EventBus } from '@core/EventBus';
import { TimeEvents, EconomyEvents, PlayerEvents } from '@config/events';
import type { GameState } from '@core/GameState';

export class HUD {
  private scene: Phaser.Scene;
  private state: GameState;

  /** 顶部信息栏 */
  private timeText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private dateText!: Phaser.GameObjects.Text;

  /** 右侧状态栏 */
  private energyBarBg!: Phaser.GameObjects.Graphics;
  private energyBarFill!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private energyText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;

  /** 提示栏 */
  private toolHint!: Phaser.GameObjects.Text;

  private readonly barWidth: number = 120;
  private readonly barHeight: number = 12;
  private readonly barX: number;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
    this.barX = scene.scale.width - this.barWidth - 10;
    this.create();
  }

  private create(): void {
    const { width } = this.scene.scale;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 },
    };

    // 顶部信息栏
    this.timeText = this.scene.add.text(4, 4, '', textStyle).setDepth(100).setScrollFactor(0);
    this.moneyText = this.scene.add.text(width / 2 - 100, 4, '', textStyle).setDepth(100).setScrollFactor(0);
    this.dateText = this.scene.add.text(width / 2 + 40, 4, '', textStyle).setDepth(100).setScrollFactor(0);

    // 右侧体力条
    this.energyBarBg = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.energyBarFill = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.energyText = this.scene.add.text(this.barX, 26, '', {
      fontSize: '11px', color: '#F1C40F', fontFamily: 'monospace',
    }).setDepth(100).setScrollFactor(0);

    // 右侧生命条
    this.hpBarBg = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.hpBarFill = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.hpText = this.scene.add.text(this.barX, 44, '', {
      fontSize: '11px', color: '#E74C3C', fontFamily: 'monospace',
    }).setDepth(100).setScrollFactor(0);

    // 底部工具栏提示
    this.toolHint = this.scene.add.text(width / 2, this.scene.scale.height - 16, '', {
      fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    // 注册事件监听
    EventBus.on(TimeEvents.TICK, this.onTimeTick.bind(this), 'hud');
    EventBus.on(EconomyEvents.MONEY_CHANGED, this.onMoneyChanged.bind(this), 'hud');
    EventBus.on(PlayerEvents.ENERGY_CHANGED, this.onEnergyChanged.bind(this), 'hud');
    EventBus.on(PlayerEvents.HP_CHANGED, this.onHpChanged.bind(this), 'hud');

    // 初始刷新
    this.refreshAll();
  }

  /** 时间更新 */
  private onTimeTick(): void {
    this.timeText.setText(this.state.timeString);
    this.dateText.setText(`${this.getSeasonName()}·第${this.state.day}天`);
  }

  /** 金钱更新 */
  private onMoneyChanged(): void {
    this.moneyText.setText(`${this.state.money}g`);
  }

  /** 体力更新 */
  private onEnergyChanged(): void {
    this.drawBar(this.energyBarBg, this.energyBarFill, this.barX, 22, 0x333333, 0xF1C40F, this.state.energy / this.state.maxEnergy);
    this.energyText.setText(`体力 ${this.state.energy}/${this.state.maxEnergy}`);
  }

  /** HP 更新 */
  private onHpChanged(): void {
    this.drawBar(this.hpBarBg, this.hpBarFill, this.barX, 40, 0x333333, 0xE74C3C, this.state.hp / this.state.maxHp);
    this.hpText.setText(`HP ${this.state.hp}/${this.state.maxHp}`);
  }

  /** 绘制进度条 */
  private drawBar(
    bg: Phaser.GameObjects.Graphics,
    fill: Phaser.GameObjects.Graphics,
    x: number, y: number,
    bgColor: number, fillColor: number,
    ratio: number,
  ): void {
    bg.clear();
    bg.fillStyle(bgColor, 1);
    bg.fillRect(x, y, this.barWidth, this.barHeight);

    fill.clear();
    fill.fillStyle(fillColor, 1);
    fill.fillRect(x, y, Math.max(0, this.barWidth * ratio), this.barHeight);
  }

  /** 设置工具提示 */
  setToolHint(text: string): void {
    this.toolHint.setText(text);
  }

  /** 全量刷新 */
  private refreshAll(): void {
    this.onTimeTick();
    this.onMoneyChanged();
    this.onEnergyChanged();
    this.onHpChanged();
    this.setToolHint('WASD 移动 | Shift 奔跑 | 点击使用工具');
  }

  /** 季节中文名 */
  private getSeasonName(): string {
    const map: Record<string, string> = {
      spring: '春', summer: '夏', fall: '秋', winter: '冬',
    };
    return map[this.state.season] ?? this.state.season;
  }

  /** 销毁 */
  destroy(): void {
    this.timeText.destroy();
    this.moneyText.destroy();
    this.dateText.destroy();
    this.energyBarBg.destroy();
    this.energyBarFill.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.energyText.destroy();
    this.hpText.destroy();
    this.toolHint.destroy();
  }
}