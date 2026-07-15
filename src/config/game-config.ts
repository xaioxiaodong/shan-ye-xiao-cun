/** 游戏配置参数（BASELINE）—— 按模块分区，禁止硬编码数值 */

export const GameConfig = {
  /** 渲染配置 */
  render: {
    targetFps: 60,
    maxActiveSprites: 5000,
    maxSpritesPerLayer: 1000,
    maxParticlesPerEmitter: 200,
    maxEmittersActive: 20,
    maxTextureMemoryMB: 256,
    viewportBuffer: 2,
    maxRenderedTiles: 10000,
  },

  /** 缓存配置 */
  cache: {
    maxCachedTexturesMB: 128,
    maxCachedAudioMB: 64,
    maxCachedDataItems: 500,
    maxPoolsTotal: 50,
    maxObjectsPerPool: 500,
  },

  /** 经济配置 */
  economy: {
    startingMoney: 500,
    maxSingleItemPrice: 100000,
    maxDailyIncome: 500000,
    minSeedCost: 1,
    moneyCap: 999999999,
    maxAnnualPriceIncrease: 0.2,
    faintMoneyLoss: 0.1,
    faintMoneyMaxLoss: 5000,
    artisanMultiplier: 1.4,
  },

  /** 玩家配置 */
  player: {
    initialMaxEnergy: 270,
    maxEnergyCap: 999,
    initialMaxHp: 100,
    maxHpCap: 999,
    hpPerLevel: 5,
    baseMoveSpeed: 2,
    runMultiplier: 1.5,
    initialInventorySize: 12,
    maxInventorySize: 36,
    maxItemStackSize: 999,
  },

  /** 网络配置 */
  network: {
    maxPlayers: 4,
    hardLimit: 8,
    maxMessagesPerSecond: 60,
    maxBytesPerSecond: 51200,
    maxSingleMessageBytes: 16384,
    initialConnectTimeout: 10000,
    idleDisconnectTimeout: 300000,
    reconnectWindow: 300000,
    maxMoveSpeed: 8,
    maxMoneyChangePerMinute: 50000,
    maxActionRate: 20,
    suspiciousThreshold: 50,
    maxBandwidthPerClient: 51200,
    maxQueuedMessages: 1000,
    processingBudgetMs: 10,
  },

  /** 输入配置 */
  input: {
    longPressDuration: 500,
    doubleTapWindow: 300,
  },

  /** 内存配置 */
  memory: {
    assetLoadTimeout: 15000,
    maxFileSizeBytes: 10485760,
    allowedExtensions: ['.json', '.png', '.wav', '.ogg', '.mp3', '.tsx', '.tmx'],
    maxLogFiles: 7,
    maxLogFileSizeMB: 10,
  },

  /** 存档配置 */
  save: {
    manualSlots: 3,
    autoSlots: 1,
    backupSlots: 3,
    maxRetries: 3,
  },
} as const;