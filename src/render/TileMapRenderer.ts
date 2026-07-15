/**
 * TileMap 渲染器 —— 纯色占位地图渲染
 *
 * 基于 Phaser Graphics 绘制纯色 Tile 网格，
 * 支持视口裁剪（只渲染可见 Tile）和碰撞检测。
 */

import Phaser from 'phaser';
import { CANVAS_CONFIG } from '@config/constants';
import { PLACEHOLDER_COLORS } from '@render/PlaceholderAssetGenerator';

const TILE = CANVAS_CONFIG.TILE_SIZE;

/** Tile 类型枚举 */
export const enum TileType {
  /** 草地（可行走） */
  GRASS = 0,
  /** 泥土（可行走，可耕种） */
  DIRT = 1,
  /** 水域（不可行走） */
  WATER = 2,
  /** 石头（不可行走） */
  STONE = 3,
  /** 已翻耕的土地（可行走） */
  TILLED = 4,
  /** 路径（可行走，移动加速） */
  PATH = 5,
}

/** Tile 十六进制颜色映射 */
const TILE_HEX_COLORS: Record<number, string> = {
  [TileType.GRASS]: PLACEHOLDER_COLORS.tile.grass,
  [TileType.DIRT]: PLACEHOLDER_COLORS.tile.dirt,
  [TileType.WATER]: PLACEHOLDER_COLORS.tile.water,
  [TileType.STONE]: PLACEHOLDER_COLORS.tile.stone,
  [TileType.TILLED]: '#6B4226',
  [TileType.PATH]: PLACEHOLDER_COLORS.tile.path,
};

/** 不可行走的 Tile 类型 */
const UNWALKABLE_TILES: ReadonlySet<number> = new Set([TileType.WATER, TileType.STONE]);

/** 可翻地的 Tile 类型（草地/泥土） */
export const TILLABLE_TILES: ReadonlySet<number> = new Set([TileType.DIRT, TileType.GRASS]);

export class TileMapRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private mapWidth: number;
  private mapHeight: number;
  private mapData: number[][];

  /** 预计算的数值颜色（避免每帧做 hex 转换） */
  private numericColors: Record<number, number>;

  /** 地图像素尺寸 */
  readonly pixelWidth: number;
  readonly pixelHeight: number;

  constructor(
    scene: Phaser.Scene,
    mapWidth: number,
    mapHeight: number,
    mapData?: number[][],
  ) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.pixelWidth = mapWidth * TILE;
    this.pixelHeight = mapHeight * TILE;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(0);

    // 预计算颜色数值
    this.numericColors = {};
    for (const [type, hex] of Object.entries(TILE_HEX_COLORS)) {
      this.numericColors[Number(type)] = Phaser.Display.Color.HexStringToColor(hex).color;
    }

    // 使用传入的地图数据，或生成默认农场地图
    this.mapData = mapData ?? this.generateDefaultFarmMap();
  }

  /** 生成默认农场地图：四周石头边界，中间泥土+草地，两处水域 */
  private generateDefaultFarmMap(): number[][] {
    const data: number[][] = [];
    for (let y = 0; y < this.mapHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        if (x === 0 || y === 0 || x === this.mapWidth - 1 || y === this.mapHeight - 1) {
          row.push(TileType.STONE);
        } else if (x > 45 && y > 40) {
          row.push(TileType.WATER);
        } else if (x > 5 && x < 10 && y > 5 && y < 10) {
          row.push(TileType.WATER);
        } else if (x >= 10 && x <= 50 && y >= 10 && y <= 40) {
          row.push(TileType.DIRT);
        } else {
          row.push(TileType.GRASS);
        }
      }
      data.push(row);
    }
    return data;
  }

  /**
   * 渲染可见区域的 Tile（使用预计算颜色，无每帧 hex 转换）
   * @param camera 当前摄像机
   */
  render(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.graphics.clear();

    const bounds = camera.worldView;
    const buffer = 2;

    const startX = Math.max(0, Math.floor(bounds.x / TILE) - buffer);
    const startY = Math.max(0, Math.floor(bounds.y / TILE) - buffer);
    const endX = Math.min(this.mapWidth, Math.ceil((bounds.x + bounds.width) / TILE) + buffer);
    const endY = Math.min(this.mapHeight, Math.ceil((bounds.y + bounds.height) / TILE) + buffer);

    for (let y = startY; y < endY; y++) {
      const row = this.mapData[y];
      if (row === undefined) continue;
      for (let x = startX; x < endX; x++) {
        const tileType = row[x];
        if (tileType === undefined) continue;
        const numColor = this.numericColors[tileType] ?? 0x000000;
        this.graphics.fillStyle(numColor, 1);
        this.graphics.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  /** 获取指定 Tile 坐标的类型 */
  getTile(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return TileType.STONE;
    return this.mapData[y]?.[x] ?? TileType.STONE;
  }

  /** 设置 Tile 类型 */
  setTile(x: number, y: number, type: number): void {
    if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return;
    const row = this.mapData[y];
    if (row === undefined) return;
    row[x] = type;
  }

  /** 检查是否可行走 */
  isWalkable(x: number, y: number): boolean {
    return !UNWALKABLE_TILES.has(this.getTile(x, y));
  }

  /** 像素坐标 → Tile 坐标 */
  pixelToTile(px: number, py: number): { x: number; y: number } {
    return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
  }

  /** Tile 坐标 → 像素坐标（中心） */
  tileToPixel(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  /** 获取地图尺寸（tile 单位） */
  getSize(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  /** 销毁 */
  destroy(): void {
    this.graphics.destroy();
  }
}