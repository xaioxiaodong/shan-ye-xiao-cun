/**
 * 游戏入口 —— Phaser 配置与 Scene 框架
 *
 * 本文件行数超过 300 行：作为游戏引导入口，包含 BootScene、PreloadScene、
 * GameScene 及 Phaser 配置，14 个键盘键声明为固有代码，
 * 按编码规范"引导/配置文件可放宽至 500 行"。
 */

import Phaser from 'phaser';
import { CANVAS_CONFIG } from '@config/constants';
import { GameConfig } from '@config/game-config';
import { EventBus } from '@core/EventBus';
import { GameState } from '@core/GameState';
import { SystemManager } from '@core/SystemManager';
import { DataRegistry } from '@core/DataRegistry';
import { TileMapRenderer } from '@render/TileMapRenderer';
import { PlaceholderAssetGenerator } from '@render/PlaceholderAssetGenerator';
import { GameLoopSafeguard } from '@safeguards/GameLoopSafeguard';
import { TimeSystem } from '@systems/time/TimeSystem';
import { FarmingSystem } from '@systems/farming/FarmingSystem';
import { SprinklerFertilizerSystem } from '@systems/farming/SprinklerFertilizerSystem';
import { SkillSystem } from '@systems/skill/SkillSystem';
import { FishingSystem } from '@systems/fishing/FishingSystem';
import { AnimalSystem } from '@systems/animal/AnimalSystem';
import { CookingSystem } from '@systems/cooking/CookingSystem';
import { CraftingSystem } from '@systems/crafting/CraftingSystem';
import { InventorySystem } from '@systems/inventory/InventorySystem';
import { NpcSystem } from '@systems/npc/NPCSystem';
import { WeatherSystem } from '@systems/weather/WeatherSystem';
import { CombatSystem } from '@systems/combat/CombatSystem';
import { BuildingSystem } from '@systems/building/BuildingSystem';
import { QuestSystem } from '@systems/quest/QuestSystem';
import { FestivalSystem } from '@systems/festival/FestivalSystem';
import { SaveManager } from '@save/SaveManager';
import { TimeEvents } from '@config/events';
import { HUD } from '@ui/HUD';
import { BackpackPanel } from '@ui/components/BackpackPanel';
import { SkillPanel } from '@ui/components/SkillPanel';

const TILE = CANVAS_CONFIG.TILE_SIZE;
const MAP_W = 60;
const MAP_H = 50;

// ── BootScene / PreloadScene ──
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  preload(): void {
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    const box = this.add.graphics();
    box.fillStyle(0x333333, 0.8);
    box.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);
    const txt = this.add.text(width / 2, height / 2 - 40, '山野小村', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      bar.clear(); bar.fillStyle(0x4CAF50, 1);
      bar.fillRect(width / 2 - 155, height / 2 - 10, 310 * v, 20);
    });
    this.load.on('complete', () => { bar.destroy(); box.destroy(); txt.destroy(); });
  }
  create(): void { this.scene.start('PreloadScene'); }
}

class PreloadScene extends Phaser.Scene {
  constructor() { super({ key: 'PreloadScene' }); }
  preload(): void {}
  async create(): Promise<void> {
    this.generatePlaceholderTextures();
    await DataRegistry.getInstance().loadAll();
    this.scene.start('GameScene');
  }
  private generatePlaceholderTextures(): void {
    const gen = PlaceholderAssetGenerator;
    const playerCanvas = gen.generateHumanSprite('#4A90D9');
    this.textures.addCanvas('player', playerCanvas);
    const tileColors: Record<string, string> = {
      grass: '#4CAF50', dirt: '#8B7355', water: '#4A90D9',
      stone: '#808080', tilled: '#6B4226', path: '#C4A882',
    };
    for (const [key, color] of Object.entries(tileColors)) {
      this.textures.addCanvas(`tile_${key}`, gen.generateTileTexture(color));
    }
    console.log('[PreloadScene] 占位纹理生成完成');
  }
}

// ── GameScene ──
class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileMap!: TileMapRenderer;
  private player!: Phaser.GameObjects.Sprite;
  private hud!: HUD;
  private safeguard!: GameLoopSafeguard;
  private farmingSystem!: FarmingSystem;
  private sprinklerSystem!: SprinklerFertilizerSystem;
  private skillSystem!: SkillSystem;
  private fishingSystem!: FishingSystem;
  private animalSystem!: AnimalSystem;
  private cookingSystem!: CookingSystem;
  private craftingSystem!: CraftingSystem;
  private inventorySystem!: InventorySystem;
  private npcSystem!: NpcSystem;
  private weatherSystem!: WeatherSystem;
  private combatSystem!: CombatSystem;
  private buildingSystem!: BuildingSystem;
  private questSystem!: QuestSystem;
  private festivalSystem!: FestivalSystem;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyF5!: Phaser.Input.Keyboard.Key;
  private keyF9!: Phaser.Input.Keyboard.Key;
  private keyTab!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private backpackPanel!: BackpackPanel;
  private skillPanel!: SkillPanel;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    this.state = new GameState();
    this.tileMap = new TileMapRenderer(this, MAP_W, MAP_H);

    const startPos = this.tileMap.tileToPixel(5, 25);
    this.player = this.add.sprite(startPos.x, startPos.y, 'player');
    this.player.setDepth(10);

    this.cameras.main.setBounds(0, 0, this.tileMap.pixelWidth, this.tileMap.pixelHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 注册系统（洒水器必须在耕种之前注册，确保 DAY_END 时先浇水后生长；天气必须在耕种之前）
    // 注意：FarmingSystem 必须先创建，因为 WeatherSystem 和 SprinklerSystem 需要其引用来操作地块
    const sysMgr = SystemManager.getInstance();
    const timeSystem = new TimeSystem(this.state);
    this.farmingSystem = new FarmingSystem(this.state, this.tileMap, this);
    this.weatherSystem = new WeatherSystem(this.state, this.farmingSystem);
    this.inventorySystem = new InventorySystem(this.state);
    this.sprinklerSystem = new SprinklerFertilizerSystem(this.farmingSystem);
    this.skillSystem = new SkillSystem(this.state);
    this.fishingSystem = new FishingSystem(this.state);
    this.animalSystem = new AnimalSystem(this.state);
    this.cookingSystem = new CookingSystem(this.state);
    this.craftingSystem = new CraftingSystem(this.state);
    this.npcSystem = new NpcSystem(this.state, this, this.tileMap);
    this.combatSystem = new CombatSystem(this.state);
    this.buildingSystem = new BuildingSystem(this.state);
    this.questSystem = new QuestSystem(this.state);
    this.festivalSystem = new FestivalSystem(this.state);

    sysMgr.register(timeSystem);
    sysMgr.register(this.weatherSystem);
    sysMgr.register(this.inventorySystem);
    sysMgr.register(this.sprinklerSystem);
    sysMgr.register(this.farmingSystem);
    sysMgr.register(this.skillSystem);
    sysMgr.register(this.fishingSystem);
    sysMgr.register(this.animalSystem);
    sysMgr.register(this.cookingSystem);
    sysMgr.register(this.craftingSystem);
    sysMgr.register(this.npcSystem);
    sysMgr.register(this.combatSystem);
    sysMgr.register(this.buildingSystem);
    sysMgr.register(this.questSystem);
    sysMgr.register(this.festivalSystem);
    sysMgr.initAll();

    // 初始化背包（初始 12 格）
    this.state.inventory = new Array(GameConfig.player.initialInventorySize).fill(null);

    this.hud = new HUD(this, this.state);
    this.backpackPanel = new BackpackPanel(this, this.state);
    this.skillPanel = new SkillPanel(this);
    this.safeguard = new GameLoopSafeguard();

    this.setupInput();

    // 存档：每天结束时自动保存，F5 手动保存，F9 加载
    EventBus.on(TimeEvents.DAY_END, () => {
      SaveManager.save(this.state, 'auto');
    }, 'gamescene');

    this.events.on('shutdown', () => {
      SystemManager.getInstance().destroyAll();
      EventBus.clear();
    });

    this.tileMap.render(this.cameras.main);
    console.log('[GameScene] 阶段 3 全部系统已启动（15 系统）');
  }

  private setupInput(): void {
    if (this.input.keyboard === null) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyF5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.keyF9 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    this.keyTab = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyK = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = this.tileMap.pixelToTile(worldPoint.x, worldPoint.y);
      this.useToolAt(tile.x, tile.y);
    });
  }

  private handleToolSwitch(): void {
    if (Phaser.Input.Keyboard.JustDown(this.key1)) {
      this.farmingSystem.switchTool('hoe');
      this.hud.setToolHint('工具: 锄头 | 点击翻地');
    }
    if (Phaser.Input.Keyboard.JustDown(this.key2)) {
      this.farmingSystem.switchTool('watering_can');
      this.hud.setToolHint('工具: 水壶 | 点击浇水');
    }
    if (Phaser.Input.Keyboard.JustDown(this.key3)) {
      this.farmingSystem.switchTool('seed', 'parsnip');
      this.hud.setToolHint('工具: 种子(防风草) | 点击播种');
    }
  }

  private handleInteraction(): void {
    // E 键与最近的 NPC 交互
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
      const nearest = this.npcSystem.getNearestNpc(this.player.x, this.player.y);
      if (nearest !== null) {
        EventBus.emit('npc:interact', nearest.data.id);
      }
    }
    // F5 手动保存
    if (Phaser.Input.Keyboard.JustDown(this.keyF5)) {
      SaveManager.save(this.state, 'slot1');
      this.hud.setToolHint('存档已保存');
    }
    // F9 加载存档
    if (Phaser.Input.Keyboard.JustDown(this.keyF9)) {
      SaveManager.load('slot1').then((s: GameState | null) => {
        if (s !== null) {
          this.state = s;
          this.hud.setToolHint('存档已加载');
        }
      });
    }
    // Tab 背包面板 / K 技能面板
    if (Phaser.Input.Keyboard.JustDown(this.keyTab)) this.backpackPanel.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keyK)) this.skillPanel.toggle();
  }

  private useToolAt(tileX: number, tileY: number): void {
    if (this.farmingSystem.tryHarvest(tileX, tileY)) return;
    EventBus.emit('farming:action', tileX, tileY);
  }

  update(time: number, delta: number): void {
    if (!this.safeguard.beginFrame()) return;
    const frameStart = performance.now();

    if (this.safeguard.checkWatchdog(time)) {
      this.scene.restart();
      return;
    }

    this.handleInput(delta);
    SystemManager.getInstance().updateAll(delta);
    this.tileMap.render(this.cameras.main);

    const frameTime = performance.now() - frameStart;
    this.safeguard.endFrame(frameTime);
  }

  private handleInput(delta: number): void {
    if (this.input.keyboard === null) return;
    this.handleToolSwitch();
    this.handleInteraction();

    let moveX = 0; let moveY = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) moveX = -1;
    if (this.cursors.right.isDown || this.keyD.isDown) moveX = 1;
    if (this.cursors.up.isDown || this.keyW.isDown) moveY = -1;
    if (this.cursors.down.isDown || this.keyS.isDown) moveY = 1;
    if (moveX === 0 && moveY === 0) return;

    const length = Math.sqrt(moveX * moveX + moveY * moveY);
    moveX /= length; moveY /= length;

    const isRunning = this.keyShift.isDown;
    const speedMultiplier = delta / 16.67;
    let speed = GameConfig.player.baseMoveSpeed * speedMultiplier;
    if (isRunning) speed *= GameConfig.player.runMultiplier;

    const newX = this.player.x + moveX * speed;
    const newY = this.player.y + moveY * speed;

    if (this.canMoveTo(newX, newY)) {
      this.player.x = newX; this.player.y = newY;
    } else if (this.canMoveTo(newX, this.player.y)) {
      this.player.x = newX;
    } else if (this.canMoveTo(this.player.x, newY)) {
      this.player.y = newY;
    }
  }

  private canMoveTo(px: number, py: number): boolean {
    const halfTile = TILE / 2 - 1;
    const corners = [
      { x: px - halfTile, y: py - halfTile },
      { x: px + halfTile, y: py - halfTile },
      { x: px - halfTile, y: py + halfTile },
      { x: px + halfTile, y: py + halfTile },
    ];
    for (const corner of corners) {
      const tile = this.tileMap.pixelToTile(corner.x, corner.y);
      if (!this.tileMap.isWalkable(tile.x, tile.y)) return false;
    }
    return true;
  }
}

// ── Phaser 配置 ──
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_CONFIG.WIDTH,
  height: CANVAS_CONFIG.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, GameScene],
};

new Phaser.Game(config);
console.log('[Main] 山野小村 启动完成');
console.log('[Main] 阶段 3: 内容填充');