/**
 * 背包面板 —— 物品管理 UI
 *
 * 职责：
 * 1. 显示背包所有槽位（网格布局）
 * 2. 显示物品名称、数量、品质
 * 3. 按 Tab 键打开/关闭
 * 4. 工具栏高亮当前选中
 *
 * GDD 引用：4.12 背包系统、6.2 菜单系统
 */

import Phaser from 'phaser';
import { EventBus } from '@core/EventBus';
import { InventoryEvents } from '@config/events';
import type { GameState } from '@core/GameState';
import type { Quality } from '@config/constants';

const PANEL_W = 480;
const PANEL_H = 400;
const SLOT_SIZE = 48;
const COLS = 6;
const PADDING = 8;
const TOOLBAR_H = 60;

/** 品质颜色映射 */
const QUALITY_COLORS: Record<Quality, string> = {
  normal: '#ffffff',
  silver: '#C0C0C0',
  gold: '#FFD700',
  iridium: '#8A2BE2',
};

export class BackpackPanel {
  private scene: Phaser.Scene;
  private state: GameState;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private toolbarTexts: Phaser.GameObjects.Text[] = [];
  private visible: boolean = false;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);
    this.container.setVisible(false);

    this.bg = scene.add.graphics().setDepth(200).setScrollFactor(0);
    this.bg.setVisible(false);

    this.titleText = this.createText('背包', 0, 0, 18, '#FFD700');
    this.titleText.setVisible(false);

    // 监听背包变化
    EventBus.on(InventoryEvents.CHANGED, () => {
      if (this.visible) this.refresh();
    }, 'backpack_panel');
  }

  /** 切换显示 */
  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    this.bg.setVisible(this.visible);
    this.titleText.setVisible(this.visible);
    if (this.visible) this.refresh();
  }

  /** 是否可见 */
  get isVisible(): boolean { return this.visible; }

  /** 刷新显示 */
  private refresh(): void {
    const { width, height } = this.scene.scale;
    const px = (width - PANEL_W) / 2;
    const py = (height - PANEL_H) / 2;

    // 背景
    this.bg.clear();
    this.bg.fillStyle(0x1a1a2e, 0.92);
    this.bg.fillRoundedRect(px, py, PANEL_W, PANEL_H, 8);
    this.bg.lineStyle(2, 0x4A90D9, 0.8);
    this.bg.strokeRoundedRect(px, py, PANEL_W, PANEL_H, 8);
    this.bg.setPosition(0, 0);

    this.titleText.setPosition(px + PANEL_W / 2, py + 12);
    this.titleText.setOrigin(0.5, 0);

    // 清理旧文字
    for (const t of this.slotTexts) t.destroy();
    this.slotTexts = [];
    for (const t of this.toolbarTexts) t.destroy();
    this.toolbarTexts = [];

    // 背包槽位
    const gridStartX = px + PADDING;
    const gridStartY = py + 36;
    const inventory = this.state.inventory;

    for (let i = 0; i < inventory.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = gridStartX + col * (SLOT_SIZE + 2);
      const sy = gridStartY + row * (SLOT_SIZE + 2);
      const slot = inventory[i];

      // 槽位背景
      this.bg.fillStyle(0x2a2a3e, 0.8);
      this.bg.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      if (slot !== null) {
        const qualityColor = QUALITY_COLORS[slot.quality] ?? '#ffffff';
        const txt = this.createText(
          `${slot.itemId}\n${slot.amount}`,
          sx + 2, sy + 2, 10, qualityColor,
        );
        this.slotTexts.push(txt);
      }
    }

    // 工具栏
    const toolbarY = py + PANEL_H - TOOLBAR_H;
    this.bg.fillStyle(0x2a2a4e, 0.9);
    this.bg.fillRect(px, toolbarY, PANEL_W, TOOLBAR_H);
    this.bg.lineStyle(1, 0x4A90D9, 0.5);
    this.bg.lineBetween(px, toolbarY, px + PANEL_W, toolbarY);

    for (let i = 0; i < 9; i++) {
      const sx = px + PADDING + i * (SLOT_SIZE + 2);
      const sy = toolbarY + 6;
      const slot = inventory[i] ?? null;

      this.bg.fillStyle(0x3a3a5e, 0.8);
      this.bg.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      if (slot !== null) {
        const txt = this.createText(
          `${slot.amount}`,
          sx + 2, sy + 2, 10, '#ffffff',
        );
        this.toolbarTexts.push(txt);
      }
    }

    // 容量提示
    const capText = this.createText(
      `容量: ${inventory.length} 格 | Tab 关闭`,
      px + PANEL_W / 2, py + PANEL_H - 8,
      11, '#888888',
    );
    capText.setOrigin(0.5, 1);
    this.slotTexts.push(capText);
  }

  private createText(
    text: string, x: number, y: number,
    size: number, color: string,
  ): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, {
      fontSize: `${size}px`,
      color,
      fontFamily: 'monospace',
      lineSpacing: 2,
    }).setDepth(201).setScrollFactor(0);
    return t;
  }

  destroy(): void {
    EventBus.offAllByContext('backpack_panel');
    this.bg.destroy();
    this.titleText.destroy();
    this.container.destroy();
    for (const t of this.slotTexts) t.destroy();
    for (const t of this.toolbarTexts) t.destroy();
  }
}