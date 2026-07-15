/**
 * 技能面板 —— 5 技能等级与专精查看
 *
 * 职责：
 * 1. 显示 5 种技能的等级与经验进度条
 * 2. 展示已选专精
 * 3. 按 K 键打开/关闭
 *
 * GDD 引用：4.7 技能系统、6.2 菜单系统
 */

import Phaser from 'phaser';
import { SystemManager } from '@core/SystemManager';
import type { SkillSystem } from '@systems/skill/SkillSystem';
import type { SkillLevel } from '@core/GameState';

const PANEL_W = 420;
const PANEL_H = 360;
const ROW_H = 58;
const BAR_W = 160;
const BAR_H = 10;

/** 技能颜色映射 */
const SKILL_COLORS: Record<string, number> = {
  farming: 0x4CAF50,
  mining: 0x95A5A6,
  foraging: 0x8B4513,
  fishing: 0x3498DB,
  combat: 0xE74C3C,
};

/** 技能中文名 */
const SKILL_NAMES: Record<string, string> = {
  farming: '耕种', mining: '采矿', foraging: '采集',
  fishing: '钓鱼', combat: '战斗',
};

export class SkillPanel {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private visible: boolean = false;

  private skillSystem: SkillSystem | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bg = scene.add.graphics().setDepth(200).setScrollFactor(0);
    this.bg.setVisible(false);

    this.titleText = this.createText('技能', 0, 0, 18, '#FFD700');
    this.titleText.setVisible(false);
  }

  /** 切换显示 */
  toggle(): void {
    if (this.skillSystem === null) {
      this.skillSystem = SystemManager.getInstance().getSystem<SkillSystem>('skill');
    }
    this.visible = !this.visible;
    this.bg.setVisible(this.visible);
    this.titleText.setVisible(this.visible);
    if (this.visible) this.refresh();
  }

  get isVisible(): boolean { return this.visible; }

  private refresh(): void {
    if (this.skillSystem === null) return;

    const { width, height } = this.scene.scale;
    const px = (width - PANEL_W) / 2;
    const py = (height - PANEL_H) / 2;

    // 背景
    this.bg.clear();
    this.bg.fillStyle(0x1a1a2e, 0.92);
    this.bg.fillRoundedRect(px, py, PANEL_W, PANEL_H, 8);
    this.bg.lineStyle(2, 0x4A90D9, 0.8);
    this.bg.strokeRoundedRect(px, py, PANEL_W, PANEL_H, 8);

    this.titleText.setPosition(px + PANEL_W / 2, py + 12);
    this.titleText.setOrigin(0.5, 0);

    // 清理
    for (const t of this.rowTexts) t.destroy();
    this.rowTexts = [];

    // 技能行
    const skills = this.skillSystem.getAllSkills();
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i]!;
      const ry = py + 36 + i * ROW_H;
      this.drawSkillRow(px, ry, skill);
    }

    // 提示
    const hint = this.createText(
      '按 K 关闭',
      px + PANEL_W / 2, py + PANEL_H - 8,
      11, '#888888',
    );
    hint.setOrigin(0.5, 1);
    this.rowTexts.push(hint);
  }

  private drawSkillRow(px: number, ry: number, skill: SkillLevel): void {
    const color = SKILL_COLORS[skill.skill] ?? 0xFFFFFF;
    const name = SKILL_NAMES[skill.skill] ?? skill.skill;
    const expToNext = this.skillSystem!.getExpToNextLevel(skill.skill);
    const cumulativeNext = expToNext + skill.experience; // expToLevel(level+1)
    // 当前等级区间进度 = (当前经验 - 本级起始) / (下一级所需累计 - 本级起始)
    const levelBase = 100 * skill.level * (skill.level + 1) / 2; // expToLevel(level)
    const levelRange = cumulativeNext - levelBase;
    const levelProgress = skill.experience - levelBase;
    const progress = skill.level >= 10 ? 1
      : (levelRange > 0 ? levelProgress / levelRange : 0);

    // 技能名称 + 等级
    const label = this.createText(
      `${name} Lv.${skill.level}`,
      px + 12, ry + 4, 13, '#ffffff',
    );
    this.rowTexts.push(label);

    // 进度条背景
    const barX = px + 120;
    const barY = ry + 8;
    this.bg.fillStyle(0x333333, 0.8);
    this.bg.fillRect(barX, barY, BAR_W, BAR_H);

    // 进度条填充
    this.bg.fillStyle(color, 0.9);
    this.bg.fillRect(barX, barY, BAR_W * progress, BAR_H);

    // 经验值文字（显示当前等级区间进度）
    const expText = this.createText(
      `${levelProgress} / ${levelRange} XP`,
      barX + 4, barY + 12, 9, '#aaaaaa',
    );
    this.rowTexts.push(expText);

    // 专精信息
    const perk = this.skillSystem!.getPerkSelection(skill.skill);
    if (perk !== undefined) {
      if (perk.level5Choice !== '') {
        const opt5 = this.skillSystem!.getPerkOption(perk.level5Choice);
        const p5Text = this.createText(
          `Lv5: ${opt5?.name ?? perk.level5Choice}`,
          px + 300, ry + 4, 10, '#FFD700',
        );
        this.rowTexts.push(p5Text);
      }
      if (perk.level10Choice !== '') {
        const opt10 = this.skillSystem!.getPerkOption(perk.level10Choice);
        const p10Text = this.createText(
          `Lv10: ${opt10?.name ?? perk.level10Choice}`,
          px + 300, ry + 20, 10, '#8A2BE2',
        );
        this.rowTexts.push(p10Text);
      }
    }
  }

  private createText(
    text: string, x: number, y: number,
    size: number, color: string,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, {
      fontSize: `${size}px`,
      color,
      fontFamily: 'monospace',
    }).setDepth(201).setScrollFactor(0);
  }

  destroy(): void {
    this.bg.destroy();
    this.titleText.destroy();
    for (const t of this.rowTexts) t.destroy();
  }
}