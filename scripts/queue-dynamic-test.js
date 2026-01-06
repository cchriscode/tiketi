/**
 * Queue Dynamic Test Script
 *
 * 대기열 순번 감소를 테스트하기 위한 스크립트
 * Active 사용자가 주기적으로 나가면서 대기열 처리를 시뮬레이션합니다.
 *
 * 사용법:
 *   node scripts/queue-dynamic-test.js --eventId <UUID>
 *   node scripts/queue-dynamic-test.js --eventId <UUID> --clearQueue true --adminEmail <email> --adminPassword <password>
 *   node scripts/queue-dynamic-test.js --eventId <UUID> --clearQueue true --adminToken <token>
 *
 * 예시:
 *   node scripts/queue-dynamic-test.js --eventId f19b2439-fc50-434e-b9e6-72b090f1c27c
 */

const axios = require('axios');

// 커맨드 라인 인자 파싱
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};
const isTruthy = (value) => ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase());

const CONFIG = {
  eventId: getArg('--eventId', 'f19b2439-fc50-434e-b9e6-72b090f1c27c'),
  apiUrl: getArg('--apiUrl', 'http://localhost:3001'),
  activeUsers: 10, // 초기 active 사용자 수
  queueUsers: 5,   // 대기열 사용자 수
  exitInterval: 3000, // 3초마다 한 명씩 나감
  maxDrainIterations: parseInt(getArg('--maxDrainIterations', '200'), 10),
  clearQueue: isTruthy(getArg('--clearQueue', process.env.CLEAR_QUEUE || 'false')),
  adminEmail: getArg('--adminEmail', process.env.ADMIN_EMAIL),
  adminPassword: getArg('--adminPassword', process.env.ADMIN_PASSWORD),
  adminToken: getArg('--adminToken', process.env.ADMIN_TOKEN),
};

const users = [];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 테스트 사용자 생성 또는 로그인
 */
async function createOrLoginUser(index) {
  try {
    const email = `queuetest${index}@test.com`;
    const password = 'Test1234!';
    const name = `QueueTestUser${index}`;

    // 회원가입 시도
    try {
      await axios.post(`${CONFIG.apiUrl}/api/auth/register`, {
        email,
        password,
        name,
        phone: `010-1000-${String(index).padStart(4, '0')}`,
      });
      console.log(`✅ User ${index} registered: ${email}`);
    } catch (registerError) {
      const status = registerError.response?.status;
      if (status !== 400 && status !== 409) {
        throw registerError;
      }
    }

    // 로그인
    const loginResponse = await axios.post(`${CONFIG.apiUrl}/api/auth/login`, {
      email,
      password,
    });

    const { token, userId } = loginResponse.data;
    return { userId, token, email, index };
  } catch (error) {
    console.error(`❌ Error creating/logging user ${index}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * 대기열 진입
 */
async function enterQueue(user) {
  try {
    const response = await axios.post(
      `${CONFIG.apiUrl}/api/queue/check/${CONFIG.eventId}`,
      {},
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error entering queue for user ${user.index}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * 대기열에서 나가기
 */
async function leaveQueue(user) {
  try {
    await axios.post(
      `${CONFIG.apiUrl}/api/queue/leave/${CONFIG.eventId}`,
      {},
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    console.log(`👋 User ${user.index} left the queue`);
  } catch (error) {
    console.error(`❌ Error leaving queue for user ${user.index}:`, error.message);
  }
}

/**
 * 대기열 상태 조회
 */
async function checkQueueStatus(user) {
  try {
    const response = await axios.get(
      `${CONFIG.apiUrl}/api/queue/status/${CONFIG.eventId}`,
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error checking queue status:`, error.response?.data || error.message);
    return null;
  }
}

async function getAdminToken() {
  if (CONFIG.adminToken) {
    return CONFIG.adminToken;
  }

  if (!CONFIG.adminEmail || !CONFIG.adminPassword) {
    console.log('⚠️  Admin credentials missing. Use --adminEmail/--adminPassword or ADMIN_EMAIL/ADMIN_PASSWORD.');
    return null;
  }

  try {
    const loginResponse = await axios.post(`${CONFIG.apiUrl}/api/auth/login`, {
      email: CONFIG.adminEmail,
      password: CONFIG.adminPassword,
    });
    return loginResponse.data?.token || null;
  } catch (error) {
    console.log('⚠️  Admin login failed:', error.response?.data || error.message);
    return null;
  }
}

async function clearQueueIfRequested() {
  if (!CONFIG.clearQueue) {
    return;
  }

  const adminToken = await getAdminToken();
  if (!adminToken) {
    console.log('⚠️  Skipping queue clear (no admin token).');
    return;
  }

  try {
    await axios.post(
      `${CONFIG.apiUrl}/api/queue/admin/clear/${CONFIG.eventId}`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log('🧹 Cleared existing queue/active users for this event');
  } catch (error) {
    console.log('⚠️  Failed to clear queue:', error.response?.data || error.message);
  }
}

async function getAllStatuses() {
  const results = await Promise.all(
    users.map(async (user) => {
      const statusData = await checkQueueStatus(user);
      if (!statusData) return null;
      return { user, statusData };
    })
  );
  return results.filter(Boolean);
}

/**
 * 메인 테스트 실행
 */
async function runDynamicTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Queue Dynamic Test Started');
  console.log('='.repeat(60));
  console.log(`📊 Config:`);
  console.log(`   - Event ID: ${CONFIG.eventId}`);
  console.log(`   - Initial Active Users: ${CONFIG.activeUsers}`);
  console.log(`   - Queue Users: ${CONFIG.queueUsers}`);
  console.log(`   - Exit Interval: ${CONFIG.exitInterval}ms`);
  console.log(`   - Clear Queue: ${CONFIG.clearQueue}`);
  if (CONFIG.clearQueue && CONFIG.adminEmail) {
    console.log(`   - Admin Email: ${CONFIG.adminEmail}`);
  }
  console.log('='.repeat(60) + '\n');

  await clearQueueIfRequested();

  // 1단계: 사용자 생성
  console.log('📝 Step 1: Creating users...\n');
  const totalUsers = CONFIG.activeUsers + CONFIG.queueUsers;

  for (let i = 0; i < totalUsers; i++) {
    const user = await createOrLoginUser(i);
    if (user) {
      users.push(user);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ ${users.length}/${totalUsers} users ready\n`);

  // 2단계: Active 사용자 진입 (threshold까지 채우기)
  console.log('🚪 Step 2: Filling active slots...\n');

  for (let i = 0; i < CONFIG.activeUsers && i < users.length; i++) {
    const result = await enterQueue(users[i]);
    if (result) {
      console.log(`User ${i}: ${result.queued ? 'Queued' : 'Active'}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n⏳ Active slots filled\n');

  // 3단계: 대기열 사용자 진입
  console.log('⏳ Step 3: Adding queue users...\n');

  for (let i = CONFIG.activeUsers; i < users.length; i++) {
    const result = await enterQueue(users[i]);
    if (result && result.queued) {
      console.log(`User ${i}: Queued at position ${result.position}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n✅ Queue users added\n');

  // 4단계: Active + Queue 전부 비우기
  console.log('🔄 Step 4: Draining active and queued users...\n');
  console.log('👀 Watch the queue positions decrease!\n');

  let iterations = 0;
  while (iterations < CONFIG.maxDrainIterations) {
    const statuses = await getAllStatuses();
    const activeUsers = statuses.filter(s => s.statusData.status === 'active');
    const queuedUsers = statuses.filter(s => s.statusData.status === 'queued');

    if (activeUsers.length === 0 && queuedUsers.length === 0) {
      console.log('\n✅ All users cleared (active: 0, queued: 0)\n');
      break;
    }

    if (activeUsers.length > 0) {
      const target = activeUsers[0].user;
      await leaveQueue(target);
      console.log(`👋 User ${target.index} left (active: ${Math.max(activeUsers.length - 1, 0)}, queued: ${queuedUsers.length})`);
    } else {
      console.log(`⏳ Waiting for queue to admit users... (queued: ${queuedUsers.length})`);
    }

    if (queuedUsers.length > 0) {
      const sample = queuedUsers[0].statusData;
      if (sample && sample.position && sample.queueSize) {
        console.log(`📊 Queue Status: Position ${sample.position}/${sample.queueSize}`);
      }
    }

    iterations += 1;
    await sleep(CONFIG.exitInterval);
  }

  if (iterations >= CONFIG.maxDrainIterations) {
    console.log('\n⚠️  Drain timed out. Some users may still be queued or active.\n');
  }

  console.log('\n✅ Test completed!\n');
  process.exit(0);
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  process.exit(0);
});

// 실행
runDynamicTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
