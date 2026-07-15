/**
 * 《山野小村》联机信令服务器
 *
 * 职责：
 * 1. WebRTC 握手协调（ICE候选/SDP转发）
 * 2. 房间码生成与管理（4位数字 + 校验位）
 * 3. 速率限制与暴力破解防护
 * 4. 房间过期自动清理
 * 5. 心跳检测与僵尸连接清理
 * 6. 健康检查HTTP端点
 *
 * 技术栈：Node.js 20 LTS + ws库（零依赖）
 * 部署：PM2守护 + Nginx反向代理 + WSS
 *
 * 协议：
 *   客户端→服务器: create_room | join_room | sdp | ice | leave_room | heartbeat
 *   服务器→客户端: room_created | room_joined | room_not_found | room_full
 *                  | invalid_code | rate_limited | sdp | ice | peer_disconnected | pong
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomInt, createHash } from 'crypto';

// ── 配置常量 ──

const CONFIG = {
  /** WebSocket 监听端口 */
  WS_PORT: parseInt(process.env.WS_PORT || '8888'),
  /** HTTP 健康检查端口 */
  HTTP_PORT: parseInt(process.env.HTTP_PORT || '8889'),
  /** 房间过期时间（秒）：无人加入则自动销毁 */
  ROOM_TTL_SECONDS: 600,
  /** 心跳间隔（秒） */
  HEARTBEAT_INTERVAL: 30,
  /** 心跳超时（秒）：超过此时间无心跳视为僵尸连接 */
  HEARTBEAT_TIMEOUT: 60,
  /** 房间码范围 */
  ROOM_CODE_MIN: 0,
  ROOM_CODE_MAX: 9999,
  /** 单IP每秒最大请求数（生产环境建议5，开发环境可适当放宽） */
  RATE_LIMIT_PER_SECOND: parseInt(process.env.RATE_LIMIT || '10'),
  /** 连续错误房间码次数后锁定 */
  MAX_WRONG_ATTEMPTS: 3,
  /** 锁定时间（秒） */
  LOCKOUT_DURATION: 30,
  /** 房间码最大重试生成次数（防冲突） */
  ROOM_CODE_MAX_RETRIES: 50,
  /** 过期房间清理间隔（秒） */
  CLEANUP_INTERVAL: 60,
};

// ── 全局状态 ──

/** @type {Map<string, Room>} 活跃房间表：roomCode → Room */
const rooms = new Map();

/** @type {Map<string, ClientInfo>} 连接信息表：connectionId → ClientInfo */
const clients = new Map();

/** @type {Map<string, RateLimitInfo>} IP速率限制表：ip → {count, resetTime, wrongAttempts, lockUntil} */
const ipLimits = new Map();

/** @type {Map<string, string>} 连接→房间映射：connectionId → roomCode */
const clientRoomMap = new Map();

/** 统计信息 */
const stats = {
  startTime: Date.now(),
  totalRoomsCreated: 0,
  totalConnections: 0,
  peakConnections: 0,
};

// ── 类型定义（JSDoc）──

/**
 * @typedef {Object} Room
 * @property {string} roomCode        - 4位房间码 "0000"~"9999"
 * @property {number} checkDigit      - 校验位 0-9
 * @property {string} hostId          - 主办方连接ID
 * @property {string|null} clientId   - 参加方连接ID（加入后填充）
 * @property {'waiting'|'connecting'|'active'|'closed'} status
 * @property {number} createdAt       - 创建时间戳(ms)
 * @property {number} ttl             - 过期时间(秒)
 * @property {string} hostIP          - 主办方IP（用于速率限制）
 */

/**
 * @typedef {Object} ClientInfo
 * @property {string} id              - 连接唯一ID
 * @property {import('ws').WebSocket} ws - WebSocket连接
 * @property {string} ip              - 客户端IP
 * @property {number} connectedAt     - 连接时间戳(ms)
 * @property {number} lastHeartbeat   - 最后心跳时间戳(ms)
 */

/**
 * @typedef {Object} RateLimitInfo
 * @property {number} count           - 当前秒内请求数
 * @property {number} resetTime       - 计数重置时间戳(ms)
 * @property {number} wrongAttempts   - 连续错误房间码次数
 * @property {number} lockUntil       - 锁定到期时间戳(ms)
 */

// ── 工具函数 ──

/**
 * 生成连接唯一ID
 * @returns {string}
 */
function generateConnectionId() {
  return `conn_${Date.now()}_${randomInt(100000)}`;
}

/**
 * 计算房间码校验位
 * 公式：(千位×1 + 百位×2 + 十位×3 + 个位×4) % 10
 * @param {string} code - 4位数字字符串
 * @returns {number} 校验位 0-9
 */
function computeCheckDigit(code) {
  const digits = code.split('').map(Number);
  return (digits[0] * 1 + digits[1] * 2 + digits[2] * 3 + digits[3] * 4) % 10;
}

/**
 * 验证房间码校验位
 * @param {string} code - 4位房间码
 * @param {number} checkDigit - 校验位
 * @returns {boolean}
 */
function verifyCheckDigit(code, checkDigit) {
  return computeCheckDigit(code) === checkDigit;
}

/**
 * 生成唯一房间码（不与已有房间冲突）
 * @returns {string|null} 4位房间码，或null（重试次数耗尽）
 */
function generateUniqueRoomCode() {
  for (let i = 0; i < CONFIG.ROOM_CODE_MAX_RETRIES; i++) {
    const code = String(randomInt(CONFIG.ROOM_CODE_MIN, CONFIG.ROOM_CODE_MAX + 1)).padStart(4, '0');
    if (!rooms.has(code)) {
      return code;
    }
  }
  return null;
}

/**
 * 脱敏日志：对房间码做哈希，不记录明文
 * @param {string} roomCode
 * @returns {string}
 */
function hashRoomCode(roomCode) {
  return createHash('sha256').update(roomCode).digest('hex').substring(0, 8);
}

/**
 * 获取客户端IP（支持反向代理）
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 安全发送JSON消息（捕获异常）
 * @param {import('ws').WebSocket} ws
 * @param {Object} data
 */
function safeSend(ws, data) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error(`[信令] 发送失败:`, err.message);
    }
  }
}

// ── 速率限制 ──

/**
 * 检查IP是否被限流
 * @param {string} ip
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let info = ipLimits.get(ip);

  if (!info) {
    info = { count: 0, resetTime: now + 1000, wrongAttempts: 0, lockUntil: 0 };
    ipLimits.set(ip, info);
  }

  // 检查是否被锁定
  if (info.lockUntil > now) {
    const retryAfter = Math.ceil((info.lockUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // 重置计数器（每秒）
  if (now > info.resetTime) {
    info.count = 0;
    info.resetTime = now + 1000;
  }

  // 检查请求频率
  info.count++;
  if (info.count > CONFIG.RATE_LIMIT_PER_SECOND) {
    return { allowed: false, retryAfter: 1 };
  }

  return { allowed: true };
}

/**
 * 记录错误房间码尝试
 * @param {string} ip
 */
function recordWrongAttempt(ip) {
  const info = ipLimits.get(ip);
  if (!info) return;

  info.wrongAttempts++;
  if (info.wrongAttempts >= CONFIG.MAX_WRONG_ATTEMPTS) {
    info.lockUntil = Date.now() + CONFIG.LOCKOUT_DURATION * 1000;
    info.wrongAttempts = 0;
    console.warn(`[安全] IP ${ip} 被锁定 ${CONFIG.LOCKOUT_DURATION}秒（连续错误房间码）`);
  }
}

/**
 * 重置错误尝试计数（成功加入后调用）
 * @param {string} ip
 */
function resetWrongAttempts(ip) {
  const info = ipLimits.get(ip);
  if (info) {
    info.wrongAttempts = 0;
  }
}

// ── 房间管理 ──

/**
 * 创建房间
 * @param {string} hostId - 主办方连接ID
 * @param {string} hostIP - 主办方IP
 * @returns {Room|null}
 */
function createRoom(hostId, hostIP) {
  const code = generateUniqueRoomCode();
  if (!code) {
    console.error('[房间] 无法生成唯一房间码（重试次数耗尽）');
    return null;
  }

  const checkDigit = computeCheckDigit(code);

  /** @type {Room} */
  const room = {
    roomCode: code,
    checkDigit,
    hostId,
    clientId: null,
    status: 'waiting',
    createdAt: Date.now(),
    ttl: CONFIG.ROOM_TTL_SECONDS,
    hostIP,
  };

  rooms.set(code, room);
  clientRoomMap.set(hostId, code);
  stats.totalRoomsCreated++;

  console.log(`[房间] 创建 ${code}-${checkDigit} (哈希:${hashRoomCode(code)}) 主办方:${hostId}`);
  return room;
}

/**
 * 加入房间
 * @param {string} roomCode - 4位房间码
 * @param {string} clientId - 参加方连接ID
 * @param {string} clientIP - 参加方IP
 * @returns {{ success: boolean, room?: Room, error?: string }}
 */
function joinRoom(roomCode, clientId, clientIP) {
  const room = rooms.get(roomCode);

  if (!room) {
    return { success: false, error: 'room_not_found' };
  }

  if (room.status === 'closed') {
    rooms.delete(roomCode);
    return { success: false, error: 'room_not_found' };
  }

  if (room.clientId !== null) {
    return { success: false, error: 'room_full' };
  }

  // 检查房间是否过期
  const elapsed = (Date.now() - room.createdAt) / 1000;
  if (elapsed > room.ttl) {
    rooms.delete(roomCode);
    clientRoomMap.delete(room.hostId);
    return { success: false, error: 'room_expired' };
  }

  room.clientId = clientId;
  room.status = 'connecting';
  clientRoomMap.set(clientId, roomCode);
  resetWrongAttempts(clientIP);

  console.log(`[房间] 加入 ${roomCode} (哈希:${hashRoomCode(roomCode)}) 参加方:${clientId}`);
  return { success: true, room };
}

/**
 * 关闭并清理房间
 * @param {string} roomCode
 * @param {string} reason
 */
function closeRoom(roomCode, reason) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.status = 'closed';

  // 通知房间内双方
  const hostClient = clients.get(room.hostId);
  const clientClient = room.clientId ? clients.get(room.clientId) : null;

  if (hostClient) {
    safeSend(hostClient.ws, { type: 'peer_disconnected', reason });
  }
  if (clientClient) {
    safeSend(clientClient.ws, { type: 'peer_disconnected', reason });
  }

  // 清理映射
  clientRoomMap.delete(room.hostId);
  if (room.clientId) {
    clientRoomMap.delete(room.clientId);
  }
  rooms.delete(roomCode);

  console.log(`[房间] 关闭 ${roomCode} (哈希:${hashRoomCode(roomCode)}) 原因:${reason}`);
}

// ── 连接管理 ──

/**
 * 处理客户端断开
 * @param {string} connectionId
 */
function handleDisconnect(connectionId) {
  const client = clients.get(connectionId);
  if (!client) return;

  const roomCode = clientRoomMap.get(connectionId);
  if (roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
      if (room.hostId === connectionId) {
        closeRoom(roomCode, 'host_disconnected');
      } else if (room.clientId === connectionId) {
        closeRoom(roomCode, 'client_disconnected');
      }
    }
  }

  clients.delete(connectionId);
  clientRoomMap.delete(connectionId);

  console.log(`[连接] 断开 ${connectionId} (IP:${client.ip}) 当前连接数:${clients.size}`);
}

// ── 消息处理 ──

/**
 * 处理收到的WebSocket消息
 * @param {string} connectionId
 * @param {string} rawMessage
 */
function handleMessage(connectionId, rawMessage) {
  const client = clients.get(connectionId);
  if (!client) return;

  // 速率限制检查
  const rateCheck = checkRateLimit(client.ip);
  if (!rateCheck.allowed) {
    safeSend(client.ws, {
      type: 'rate_limited',
      retryAfter: rateCheck.retryAfter || 1,
    });
    return;
  }

  let msg;
  try {
    msg = JSON.parse(rawMessage);
  } catch {
    console.warn(`[消息] 无效JSON from ${connectionId}`);
    return;
  }

  if (!msg || typeof msg.type !== 'string') {
    console.warn(`[消息] 缺少type字段 from ${connectionId}`);
    return;
  }

  switch (msg.type) {
    case 'create_room':
      handleCreateRoom(connectionId, client);
      break;

    case 'join_room':
      handleJoinRoom(connectionId, client, msg);
      break;

    case 'sdp':
      handleSignalingForward(connectionId, client, msg, 'sdp');
      break;

    case 'ice':
      handleSignalingForward(connectionId, client, msg, 'ice');
      break;

    case 'leave_room':
      handleLeaveRoom(connectionId);
      break;

    case 'heartbeat':
      handleHeartbeat(connectionId, client);
      break;

    default:
      console.warn(`[消息] 未知类型 "${msg.type}" from ${connectionId}`);
  }
}

/**
 * 处理创建房间请求
 */
function handleCreateRoom(connectionId, client) {
  // 检查该连接是否已在房间中
  if (clientRoomMap.has(connectionId)) {
    safeSend(client.ws, { type: 'error', message: '已在房间中，请先离开当前房间' });
    return;
  }

  const room = createRoom(connectionId, client.ip);
  if (!room) {
    safeSend(client.ws, { type: 'error', message: '创建房间失败，请稍后重试' });
    return;
  }

  safeSend(client.ws, {
    type: 'room_created',
    roomCode: room.roomCode,
    checkDigit: room.checkDigit,
  });
}

/**
 * 处理加入房间请求
 */
function handleJoinRoom(connectionId, client, msg) {
  // 检查该连接是否已在房间中
  if (clientRoomMap.has(connectionId)) {
    safeSend(client.ws, { type: 'error', message: '已在房间中，请先离开当前房间' });
    return;
  }

  const roomCode = msg.roomCode;

  // 验证房间码格式
  if (!roomCode || typeof roomCode !== 'string' || !/^\d{4}$/.test(roomCode)) {
    safeSend(client.ws, { type: 'invalid_code', message: '房间码格式错误，需要4位数字' });
    recordWrongAttempt(client.ip);
    return;
  }

  const result = joinRoom(roomCode, connectionId, client.ip);

  if (!result.success) {
    if (result.error === 'room_not_found') {
      safeSend(client.ws, { type: 'room_not_found', message: '未找到该房间' });
      recordWrongAttempt(client.ip);
    } else if (result.error === 'room_full') {
      safeSend(client.ws, { type: 'room_full', message: '房间已满' });
    } else if (result.error === 'room_expired') {
      safeSend(client.ws, { type: 'room_not_found', message: '房间已过期' });
    } else {
      safeSend(client.ws, { type: 'error', message: '加入房间失败' });
    }
    return;
  }

  const room = result.room;

  // 通知参加方：加入成功
  safeSend(client.ws, {
    type: 'room_joined',
    roomCode: room.roomCode,
    checkDigit: room.checkDigit,
  });

  // 通知主办方：有人加入
  const hostClient = clients.get(room.hostId);
  if (hostClient) {
    safeSend(hostClient.ws, {
      type: 'room_joined',
      roomCode: room.roomCode,
      peerCount: 2,
    });
  }
}

/**
 * 处理SDP/ICE转发
 */
function handleSignalingForward(connectionId, client, msg, msgType) {
  const roomCode = clientRoomMap.get(connectionId);
  if (!roomCode) {
    safeSend(client.ws, { type: 'error', message: '不在任何房间中' });
    return;
  }

  const room = rooms.get(roomCode);
  if (!room) {
    safeSend(client.ws, { type: 'error', message: '房间不存在' });
    return;
  }

  // 确定转发目标
  let targetId;
  if (connectionId === room.hostId) {
    targetId = room.clientId;
  } else if (connectionId === room.clientId) {
    targetId = room.hostId;
  } else {
    safeSend(client.ws, { type: 'error', message: '你不是房间成员' });
    return;
  }

  if (!targetId) {
    safeSend(client.ws, { type: 'error', message: '对方尚未连接' });
    return;
  }

  const targetClient = clients.get(targetId);
  if (!targetClient) {
    safeSend(client.ws, { type: 'peer_disconnected', message: '对方已断开连接' });
    return;
  }

  // 转发SDP或ICE
  const fromRole = connectionId === room.hostId ? 'host' : 'client';
  safeSend(targetClient.ws, {
    type: msgType,
    from: fromRole,
    sdp: msg.sdp || undefined,
    candidate: msg.candidate || undefined,
  });

  // 首次SDP交换时将房间状态改为active
  if (msgType === 'sdp' && room.status === 'connecting') {
    room.status = 'active';
    console.log(`[房间] ${roomCode} 进入活跃状态 (哈希:${hashRoomCode(roomCode)})`);
  }
}

/**
 * 处理离开房间
 */
function handleLeaveRoom(connectionId) {
  const roomCode = clientRoomMap.get(connectionId);
  if (!roomCode) return;

  closeRoom(roomCode, 'peer_left');
}

/**
 * 处理心跳
 */
function handleHeartbeat(connectionId, client) {
  client.lastHeartbeat = Date.now();
  safeSend(client.ws, { type: 'pong', timestamp: Date.now() });
}

// ── 定时清理 ──

/**
 * 清理过期房间
 */
function cleanupExpiredRooms() {
  const now = Date.now();
  let cleaned = 0;

  for (const [code, room] of rooms) {
    const elapsedSeconds = (now - room.createdAt) / 1000;

    // waiting状态的房间：超过TTL自动销毁
    if (room.status === 'waiting' && elapsedSeconds > room.ttl) {
      closeRoom(code, 'expired');
      cleaned++;
      continue;
    }

    // connecting状态超过60秒还没变active：视为握手失败
    if (room.status === 'connecting' && elapsedSeconds > room.ttl + 60) {
      closeRoom(code, 'handshake_timeout');
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[清理] 清理了 ${cleaned} 个过期房间`);
  }
}

/**
 * 清理僵尸连接（无心跳超时）
 */
function cleanupZombieConnections() {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, client] of clients) {
    const timeSinceHeartbeat = now - client.lastHeartbeat;

    if (timeSinceHeartbeat > CONFIG.HEARTBEAT_TIMEOUT * 1000) {
      console.warn(`[清理] 僵尸连接 ${id} (${timeSinceHeartbeat / 1000}s 无心跳)`);
      client.ws.terminate(); // 强制关闭
      handleDisconnect(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[清理] 清理了 ${cleaned} 个僵尸连接`);
  }
}

/**
 * 清理过期的IP速率限制记录
 */
function cleanupRateLimits() {
  const now = Date.now();
  let cleaned = 0;

  for (const [ip, info] of ipLimits) {
    // 锁定已过期 且 计数器已过期（30秒内无新请求）
    if (info.lockUntil < now && info.resetTime + 30000 < now) {
      ipLimits.delete(ip);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[清理] 清理了 ${cleaned} 个过期速率限制记录`);
  }
}

// ── HTTP 健康检查 ──

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    const uptimeSeconds = Math.floor((Date.now() - stats.startTime) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: uptimeSeconds,
      rooms: rooms.size,
      connections: clients.size,
      totalRoomsCreated: stats.totalRoomsCreated,
      peakConnections: stats.peakConnections,
    }));
  } else if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      activeRooms: rooms.size,
      activeConnections: clients.size,
      totalRoomsCreated: stats.totalRoomsCreated,
      totalConnections: stats.totalConnections,
      peakConnections: stats.peakConnections,
      rateLimitEntries: ipLimits.size,
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ── WebSocket 服务器 ──

const wss = new WebSocketServer({ noServer: true });

// HTTP服务器处理WebSocket升级
const httpWsServer = createServer();
httpWsServer.on('upgrade', (request, socket, head) => {
  const ip = getClientIP(request);

  // 基础连接限制：最大100个并发连接
  if (clients.size >= 100) {
    console.warn(`[连接] 拒绝 ${ip}: 服务器连接数已满`);
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const connectionId = generateConnectionId();

    /** @type {ClientInfo} */
    const clientInfo = {
      id: connectionId,
      ws,
      ip,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    clients.set(connectionId, clientInfo);
    stats.totalConnections++;
    stats.peakConnections = Math.max(stats.peakConnections, clients.size);

    console.log(`[连接] 新连接 ${connectionId} (IP:${ip}) 当前连接数:${clients.size}`);

    ws.on('message', (data) => {
      handleMessage(connectionId, data.toString());
    });

    ws.on('close', () => {
      handleDisconnect(connectionId);
    });

    ws.on('error', (err) => {
      console.error(`[连接] 错误 ${connectionId}:`, err.message);
      handleDisconnect(connectionId);
    });

    wss.emit('connection', ws, request);
  });
});

// ── 启动 ──

httpWsServer.listen(CONFIG.WS_PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════════╗`);
  console.log(`║  《山野小村》联机信令服务器                         ║`);
  console.log(`║  WebSocket: ws://0.0.0.0:${CONFIG.WS_PORT}               ║`);
  console.log(`║  生产环境请使用 WSS (Nginx反向代理)                 ║`);
  console.log(`╚═══════════════════════════════════════════════════╝\n`);
});

httpServer.listen(CONFIG.HTTP_PORT, () => {
  console.log(`[HTTP] 健康检查: http://0.0.0.0:${CONFIG.HTTP_PORT}/health`);
  console.log(`[HTTP] 统计信息: http://0.0.0.0:${CONFIG.HTTP_PORT}/stats\n`);
});

// ── 定时任务 ──

// 每60秒清理过期房间
setInterval(cleanupExpiredRooms, CONFIG.CLEANUP_INTERVAL * 1000);

// 每30秒检查僵尸连接
setInterval(cleanupZombieConnections, CONFIG.HEARTBEAT_INTERVAL * 1000);

// 每5分钟清理过期的速率限制记录
setInterval(cleanupRateLimits, 300000);

// ── 优雅退出 ──

function gracefulShutdown(signal) {
  console.log(`\n[系统] 收到 ${signal}，正在优雅关闭...`);

  // 通知所有客户端
  for (const [id, client] of clients) {
    safeSend(client.ws, { type: 'server_shutdown', message: '服务器正在维护，请稍后重连' });
  }

  // 关闭所有房间
  for (const [code] of rooms) {
    closeRoom(code, 'server_shutdown');
  }

  // 关闭WebSocket服务器
  wss.close(() => {
    console.log('[系统] WebSocket服务器已关闭');
  });

  // 关闭HTTP服务器
  httpServer.close(() => {
    console.log('[系统] HTTP服务器已关闭');
  });

  httpWsServer.close(() => {
    console.log('[系统] WS HTTP服务器已关闭');
    process.exit(0);
  });

  // 强制退出（5秒超时）
  setTimeout(() => {
    console.error('[系统] 优雅关闭超时，强制退出');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── 未捕获异常处理 ──

process.on('uncaughtException', (err) => {
  console.error('[系统] 未捕获异常:', err);
  // 不退出，记录错误继续运行
});

process.on('unhandledRejection', (reason) => {
  console.error('[系统] 未处理的Promise拒绝:', reason);
});
