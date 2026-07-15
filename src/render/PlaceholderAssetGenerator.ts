/** 占位资源生成器 —— 程序化生成简单色块精灵/Tile/UI，供后续替换最终美术 */

import { CANVAS_CONFIG } from '@config/constants';

const TILE = CANVAS_CONFIG.TILE_SIZE;

/** 精灵尺寸配置 */
export interface SpriteSize {
  width: number;
  height: number;
}

/** 占位资源生成器 */
export class PlaceholderAssetGenerator {
  /**
   * 生成色块人形精灵（16×16 像素风格）
   * @param color 主颜色
   * @param secondaryColor 副颜色（可选）
   */
  static generateHumanSprite(color: string, secondaryColor: string = '#000000'): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    // 头（4×4，顶部居中）
    ctx.fillStyle = color;
    ctx.fillRect(6, 0, 4, 4);

    // 眼睛（2×1）
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(7, 1, 1, 1);
    ctx.fillRect(9, 1, 1, 1);

    // 身体（6×6）
    ctx.fillStyle = color;
    ctx.fillRect(5, 4, 6, 6);

    // 手臂（2×4）
    ctx.fillRect(3, 5, 2, 4);
    ctx.fillRect(11, 5, 2, 4);

    // 腿（3×6）
    ctx.fillRect(5, 10, 3, 6);
    ctx.fillRect(9, 10, 3, 6);

    return canvas;
  }

  /**
   * 生成作物生长阶段精灵
   * @param color 作物颜色
   * @param stage 生长阶段 (0=种子, 1=幼苗, 2=生长, 3=成熟)
   */
  static generateCropSprite(color: string, stage: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    ctx.fillStyle = '#8B4513'; // 棕色土壤
    ctx.fillRect(0, 0, TILE, TILE);

    ctx.fillStyle = color;
    switch (stage) {
      case 0: // 种子：小点
        ctx.fillRect(7, 12, 2, 2);
        break;
      case 1: // 幼苗：小芽
        ctx.fillRect(7, 10, 2, 4);
        ctx.fillRect(8, 8, 1, 2);
        break;
      case 2: // 生长中：较大植物
        ctx.fillRect(5, 6, 6, 8);
        ctx.fillRect(7, 4, 2, 4);
        break;
      case 3: // 成熟：完整作物
        ctx.fillRect(3, 4, 10, 10);
        ctx.fillRect(6, 2, 4, 4);
        break;
      default:
        break;
    }

    return canvas;
  }

  /**
   * 生成建筑精灵（简单几何体）
   * @param width 宽度（tile 单位）
   * @param height 高度（tile 单位）
   * @param wallColor 墙壁颜色
   * @param roofColor 屋顶颜色
   */
  static generateBuildingSprite(
    width: number,
    height: number,
    wallColor: string,
    roofColor: string,
  ): HTMLCanvasElement {
    const w = width * TILE;
    const h = height * TILE;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    // 屋顶（三角形）
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w, h * 0.3);
    ctx.closePath();
    ctx.fill();

    // 墙壁（矩形）
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, h * 0.3, w, h * 0.7);

    // 门
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(w * 0.35, h * 0.6, w * 0.3, h * 0.4);

    // 窗户
    ctx.fillStyle = '#ADD8E6';
    ctx.fillRect(w * 0.1, h * 0.45, w * 0.15, h * 0.15);
    ctx.fillRect(w * 0.75, h * 0.45, w * 0.15, h * 0.15);

    return canvas;
  }

  /**
   * 生成纯色 Tile 纹理
   * @param color 颜色
   */
  static generateTileTexture(color: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TILE, TILE);

    // 添加细微边框区分相邻 tile
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.strokeRect(0, 0, TILE, TILE);

    return canvas;
  }

  /**
   * 生成 UI 按钮
   */
  static generateButton(width: number, height: number, color: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    // 按钮主体
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // 高光边
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 0, width, 2);
    ctx.fillRect(0, 0, 2, height);

    // 阴影边
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, height - 2, width, 2);
    ctx.fillRect(width - 2, 0, 2, height);

    return canvas;
  }

  /**
   * 生成 UI 面板
   */
  static generatePanel(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    // 面板背景
    ctx.fillStyle = 'rgba(40, 40, 50, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // 边框
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // 标题栏
    ctx.fillStyle = 'rgba(60, 60, 70, 0.95)';
    ctx.fillRect(0, 0, width, 24);

    return canvas;
  }

  /**
   * 生成进度条背景
   */
  static generateProgressBar(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

    // 背景
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, width, height);

    // 边框
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    return canvas;
  }

  /**
   * 将 Canvas 转为 Phaser 可用的纹理 key
   */
  static canvasToTextureKey(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL();
  }
}

/** 预定义占位颜色方案 */
export const PLACEHOLDER_COLORS = {
  /** 玩家 */
  player: '#4A90D9',
  /** NPC 颜色 */
  npc: {
    小鹿: '#FFB7C5',
    阿杰: '#5D8A5D',
    灵溪: '#9B59B6',
    石头: '#95A5A6',
    小暖: '#FF8C42',
    渔夫: '#3498DB',
    林婶: '#E67E22',
    陈姨: '#C0392B',
    老铁: '#7F8C8D',
    顾医生: '#FFFFFF',
    阿木: '#8B4513',
    威利: '#1ABC9C',
    阿婆: '#BDC3C7',
    小胖: '#F1C40F',
    法师: '#8E44AD',
    神秘商人: '#D35400',
    隐士: '#2C3E50',
  } as Record<string, string>,

  /** 地图 Tile 颜色 */
  tile: {
    grass: '#4CAF50',
    dirt: '#8B7355',
    water: '#4A90D9',
    stone: '#808080',
    path: '#C4A882',
    sand: '#F5DEB3',
    wood: '#8B4513',
    snow: '#F0F8FF',
  } as Record<string, string>,

  /** 建筑颜色 */
  building: {
    wall: '#D2B48C',
    roof: '#8B4513',
  },

  /** UI 颜色 */
  ui: {
    buttonPrimary: '#4A90D9',
    buttonSecondary: '#666',
    buttonDanger: '#C0392B',
    panelBg: '#2C2C36',
    progressBg: '#333',
    progressFill: '#4CAF50',
    energyFill: '#F1C40F',
    hpFill: '#E74C3C',
  },
} as const;