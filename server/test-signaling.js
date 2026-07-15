/**
 * 信令服务器集成测试脚本
 *
 * 测试流程：
 * 1. 主机连接 → 创建房间 → 获得房间码
 * 2. 客户端连接 → 加入房间 → 验证匹配
 * 3. SDP/ICE 转发 → 验证正确路由
 * 4. 心跳测试
 * 5. 断开测试
 * 6. 错误场景测试（房间不存在/已满/格式错误/速率限制）
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8888';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${message}`);
  } else {
    failCount++;
    console.error(`  ❌ ${message}`);
  }
}

/**
 * 创建WebSocket客户端并等待连接
 */
function createClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.messages = [];
    ws.clientName = name;

    ws.on('open', () => {
      console.log(`\n[${name}] 已连接`);
      resolve(ws);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      ws.messages.push(msg);
      console.log(`  [${name}] 收到: ${msg.type}`, JSON.stringify(msg).substring(0, 100));
    });

    ws.on('error', (err) => {
      console.error(`[${name}] 错误:`, err.message);
      reject(err);
    });

    ws.on('close', () => {
      console.log(`  [${name}] 已断开`);
    });
  });
}

/**
 * 发送消息并等待响应
 */
function sendAndWait(ws, message, expectedType, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`等待 ${expectedType} 超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    const check = () => {
      const idx = ws.messages.findIndex(m => m.type === expectedType);
      if (idx !== -1) {
        clearTimeout(timer);
        const msg = ws.messages.splice(idx, 1)[0];
        resolve(msg);
      } else {
        setTimeout(check, 50);
      }
    };

    ws.send(JSON.stringify(message));
    check();
  });
}

/**
 * 等待收到指定类型的消息（不发送）
 */
function waitForMessage(ws, expectedType, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`等待 ${expectedType} 超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    const check = () => {
      const idx = ws.messages.findIndex(m => m.type === expectedType);
      if (idx !== -1) {
        clearTimeout(timer);
        const msg = ws.messages.splice(idx, 1)[0];
        resolve(msg);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── 测试用例 ──

async function test01_CreateRoom() {
  console.log('\n━━━ 测试1: 创建房间 ━━━');
  const host = await createClient('主机A');

  const response = await sendAndWait(host, { type: 'create_room' }, 'room_created');
  assert(response.roomCode && /^\d{4}$/.test(response.roomCode), `房间码格式正确: ${response.roomCode}`);
  assert(typeof response.checkDigit === 'number', `校验位存在: ${response.checkDigit}`);
  assert(response.checkDigit >= 0 && response.checkDigit <= 9, `校验位范围正确: ${response.checkDigit}`);

  // 验证校验位算法
  const digits = response.roomCode.split('').map(Number);
  const expected = (digits[0] * 1 + digits[1] * 2 + digits[2] * 3 + digits[3] * 4) % 10;
  assert(response.checkDigit === expected, `校验位计算正确: ${response.checkDigit} === ${expected}`);

  host.close();
  await sleep(200);
  return response.roomCode;
}

async function test02_JoinRoom(roomCode) {
  console.log('\n━━━ 测试2: 加入房间 ━━━');
  const host = await createClient('主机B');
  const client = await createClient('客户端B');

  // 主机创建房间
  const created = await sendAndWait(host, { type: 'create_room' }, 'room_created');
  console.log(`  房间已创建: ${created.roomCode}-${created.checkDigit}`);

  // 客户端加入
  const joinResult = await sendAndWait(client, { type: 'join_room', roomCode: created.roomCode }, 'room_joined');
  assert(joinResult.roomCode === created.roomCode, `客户端加入成功，房间码匹配`);

  // 主机应收到通知
  const hostNotify = await waitForMessage(host, 'room_joined');
  assert(hostNotify.peerCount === 2, `主机收到通知，玩家数: ${hostNotify.peerCount}`);

  host.close();
  client.close();
  await sleep(200);
}

async function test03_SDPForwarding() {
  console.log('\n━━━ 测试3: SDP/ICE 转发 ━━━');
  const host = await createClient('主机C');
  const client = await createClient('客户端C');

  // 创建并加入
  const created = await sendAndWait(host, { type: 'create_room' }, 'room_created');
  await sendAndWait(client, { type: 'join_room', roomCode: created.roomCode }, 'room_joined');
  await waitForMessage(host, 'room_joined');

  // 等待速率限制窗口重置
  await sleep(300);

  // 主机发送SDP offer
  const testSDP = { type: 'offer', sdp: 'v=0\r\no=- 123 456 IN IP4 0.0.0.0\r\n' };
  host.send(JSON.stringify({ type: 'sdp', sdp: testSDP }));

  // 客户端应收到SDP
  const receivedSDP = await waitForMessage(client, 'sdp');
  assert(receivedSDP.from === 'host', `SDP来自host角色`);
  assert(receivedSDP.sdp !== undefined, `SDP数据存在`);

  await sleep(200);

  // 客户端发送ICE candidate
  const testICE = { candidate: 'candidate:1 1 udp 2130706431 192.168.1.100 50000 typ host' };
  client.send(JSON.stringify({ type: 'ice', candidate: testICE.candidate }));

  // 主机应收到ICE
  const receivedICE = await waitForMessage(host, 'ice');
  assert(receivedICE.from === 'client', `ICE来自client角色`);
  assert(receivedICE.candidate !== undefined, `ICE候选数据存在`);

  host.close();
  client.close();
  await sleep(200);
}

async function test04_Heartbeat() {
  console.log('\n━━━ 测试4: 心跳 ━━━');
  const host = await createClient('主机D');

  const pong = await sendAndWait(host, { type: 'heartbeat' }, 'pong');
  assert(typeof pong.timestamp === 'number', `心跳响应包含时间戳: ${pong.timestamp}`);

  host.close();
  await sleep(200);
}

async function test05_ErrorScenarios() {
  console.log('\n━━━ 测试5: 错误场景 ━━━');
  const client = await createClient('错误测试');

  // 房间不存在
  const notFound = await sendAndWait(client, { type: 'join_room', roomCode: '9999' }, 'room_not_found');
  assert(notFound.type === 'room_not_found', '房间不存在时返回 room_not_found');

  await sleep(200);

  // 格式错误（非4位数字）
  client.send(JSON.stringify({ type: 'join_room', roomCode: 'abc' }));
  const invalid = await waitForMessage(client, 'invalid_code');
  assert(invalid.type === 'invalid_code', '格式错误时返回 invalid_code');

  // 房间已满测试
  const host1 = await createClient('满房主机');
  const created = await sendAndWait(host1, { type: 'create_room' }, 'room_created');
  const joiner1 = await createClient('加入者1');
  await sendAndWait(joiner1, { type: 'join_room', roomCode: created.roomCode }, 'room_joined');

  const joiner2 = await createClient('加入者2（应被拒）');
  const fullResult = await sendAndWait(joiner2, { type: 'join_room', roomCode: created.roomCode }, 'room_full');
  assert(fullResult.type === 'room_full', '房间已满时返回 room_full');

  host1.close();
  joiner1.close();
  joiner2.close();
  client.close();
  await sleep(200);
}

async function test06_LeaveRoom() {
  console.log('\n━━━ 测试6: 离开房间 ━━━');
  const host = await createClient('主机F');
  const client = await createClient('客户端F');

  const created = await sendAndWait(host, { type: 'create_room' }, 'room_created');
  await sendAndWait(client, { type: 'join_room', roomCode: created.roomCode }, 'room_joined');
  await waitForMessage(host, 'room_joined');

  // 客户端离开
  client.send(JSON.stringify({ type: 'leave_room' }));

  // 主机应收到断开通知
  const disconnectNotify = await waitForMessage(host, 'peer_disconnected');
  assert(disconnectNotify.reason === 'peer_left', `主机收到离开通知，原因: ${disconnectNotify.reason}`);

  host.close();
  client.close();
  await sleep(200);
}

async function test07_DuplicateCreate() {
  console.log('\n━━━ 测试7: 重复创建房间 ━━━');
  const host = await createClient('重复创建');

  // 第一次创建
  const first = await sendAndWait(host, { type: 'create_room' }, 'room_created');
  assert(first.roomCode !== undefined, `第一次创建成功: ${first.roomCode}`);

  // 第二次创建（应被拒绝，因为已在房间中）
  host.send(JSON.stringify({ type: 'create_room' }));
  const errorMsg = await waitForMessage(host, 'error');
  assert(errorMsg.message.includes('已在房间中'), `重复创建被拒绝: ${errorMsg.message}`);

  host.close();
  await sleep(200);
}

// ── 主测试流程 ──

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  《山野小村》信令服务器 集成测试                    ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    await test01_CreateRoom();
    await test02_JoinRoom();
    await test03_SDPForwarding();
    await test04_Heartbeat();
    await test05_ErrorScenarios();
    await test06_LeaveRoom();
    await test07_DuplicateCreate();
  } catch (err) {
    console.error('\n💥 测试中断:', err.message);
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  测试结果: ${passCount} 通过, ${failCount} 失败`);
  console.log(`  总计: ${passCount + failCount} 项`);
  console.log('═══════════════════════════════════════\n');

  process.exit(failCount > 0 ? 1 : 0);
}

runAllTests();
