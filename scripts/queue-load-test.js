/**
 * Queue Load Test Script
 *
 * 대기열 시스템 부하 테스트를 위한 스크립트
 * 가상 사용자를 생성하여 대기열 동작을 테스트합니다.
 *
 * 사용법:
 *   node scripts/queue-load-test.js [옵션]
 *
 * 옵션:
 *   --users <number>    생성할 가상 사용자 수 (기본: 50)
 *   --eventId <number>  테스트할 이벤트 ID (기본: 1)
 *   --apiUrl <url>      API URL (기본: http://localhost:3001)
 *   --delay <ms>        각 요청 간 지연 시간 (기본: 100ms)
 *
 * 예시:
 *   node scripts/queue-load-test.js --users 100 --eventId 1
 *   node scripts/queue-load-test.js --users 20 --delay 50
 */

const axios = require('axios');
const io = require('socket.io-client');

// 커맨드 라인 인자 파싱
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const CONFIG = {
  users: parseInt(getArg('--users', '50')),
  eventId: getArg('--eventId', '1'), // UUID는 문자열 그대로 사용
  apiUrl: getArg('--apiUrl', 'http://localhost:3001'),
  socketUrl: getArg('--socketUrl', 'http://localhost:3001'),
  delay: parseInt(getArg('--delay', '100')),
};

// 테스트 사용자 풀
const testUsers = [];
const sockets = [];

// 통계
const stats = {
  total: 0,
  queued: 0,
  allowed: 0,
  errors: 0,
  queuePositions: [],
};

/**
 * 테스트 사용자 생성 또는 로그인
 */
async function createOrLoginUser(index) {
  try {
    const email = `loadtest${index}@test.com`;
    const password = 'Test1234!';
    const name = `LoadTestUser${index}`;

    // 먼저 회원가입 시도
    try {
      await axios.post(`${CONFIG.apiUrl}/api/auth/register`, {
        email,
        password,
        name,
        phone: `010-0000-${String(index).padStart(4, '0')}`,
      });
      console.log(`✅ User ${index} registered: ${email}`);
    } catch (registerError) {
      // 이미 존재하는 경우 무시 (400, 409)
      const status = registerError.response?.status;
      if (status !== 400 && status !== 409) {
        throw registerError;
      }
      // 이미 존재하는 경우는 조용히 무시하고 로그인만 진행
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
    stats.errors++;
    return null;
  }
}

/**
 * 대기열 진입 API 호출
 */
async function checkQueue(user) {
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
    console.error(`❌ Error checking queue for user ${user.index}:`, error.response?.data || error.message);
    stats.errors++;
    return null;
  }
}

/**
 * Socket 연결 및 대기열 진입
 */
async function connectToQueue(user) {
  // 먼저 대기열 진입 API 호출
  const queueResult = await checkQueue(user);
  if (!queueResult) {
    return { user, status: 'error' };
  }

  console.log(`User ${user.index}: queued=${queueResult.queued}, position=${queueResult.position || 'N/A'}`);

  if (queueResult.queued) {
    stats.queued++;
    if (queueResult.position !== undefined) {
      stats.queuePositions.push(queueResult.position);
    }
  } else {
    stats.allowed++;
  }

  return new Promise((resolve, reject) => {
    const socket = io(CONFIG.socketUrl, {
      auth: { token: user.token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log(`🔌 User ${user.index} connected (socket: ${socket.id})`);

      // 대기열 진입
      socket.emit('join-queue', { eventId: CONFIG.eventId });
    });

    socket.on('queue-entry-allowed', (data) => {
      console.log(`✅ User ${user.index} allowed to enter!`, data);
      stats.allowed++;
      socket.disconnect();
      resolve({ user, status: 'allowed', data });
    });

    socket.on('queue-updated', (data) => {
      console.log(`⏳ User ${user.index} in queue, size: ${data.queueSize}`);
      if (data.position !== undefined) {
        stats.queuePositions.push(data.position);
      }
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ Socket error for user ${user.index}:`, error.message);
      stats.errors++;
      reject(error);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User ${user.index} disconnected`);
    });

    sockets.push(socket);

    // 타임아웃 설정 (30초)
    setTimeout(() => {
      stats.queued++;
      resolve({ user, status: 'queued' });
    }, 30000);
  });
}

/**
 * 대기열 상태 확인
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

/**
 * 메인 테스트 실행
 */
async function runLoadTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Queue Load Test Started');
  console.log('='.repeat(60));
  console.log(`📊 Config:`);
  console.log(`   - Users: ${CONFIG.users}`);
  console.log(`   - Event ID: ${CONFIG.eventId}`);
  console.log(`   - API URL: ${CONFIG.apiUrl}`);
  console.log(`   - Delay: ${CONFIG.delay}ms`);
  console.log('='.repeat(60) + '\n');

  const startTime = Date.now();

  // 1단계: 테스트 사용자 생성/로그인
  console.log('📝 Step 1: Creating/logging in test users...\n');
  for (let i = 0; i < CONFIG.users; i++) {
    const user = await createOrLoginUser(i);
    if (user) {
      testUsers.push(user);
    }
    stats.total++;

    // 지연
    if (CONFIG.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delay));
    }
  }

  console.log(`\n✅ ${testUsers.length}/${CONFIG.users} users ready\n`);

  // 2단계: 대기열 진입 (동시 접속)
  console.log('⏳ Step 2: Connecting to queue...\n');

  const connectPromises = testUsers.map(user =>
    connectToQueue(user).catch(err => ({ user, status: 'error', error: err }))
  );

  const results = await Promise.all(connectPromises);

  // 3단계: 결과 분석
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results');
  console.log('='.repeat(60));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`👥 Total Users: ${stats.total}`);
  console.log(`✅ Allowed Immediately: ${stats.allowed}`);
  console.log(`⏳ Queued: ${stats.queued}`);
  console.log(`❌ Errors: ${stats.errors}`);

  if (stats.queuePositions.length > 0) {
    const avgPosition = stats.queuePositions.reduce((a, b) => a + b, 0) / stats.queuePositions.length;
    console.log(`📍 Avg Queue Position: ${avgPosition.toFixed(1)}`);
  }

  console.log('='.repeat(60) + '\n');

  // 4단계: 샘플 큐 상태 확인
  if (testUsers.length > 0) {
    console.log('🔍 Checking queue status (sample)...\n');
    const sampleUser = testUsers[0];
    const queueStatus = await checkQueueStatus(sampleUser);
    if (queueStatus) {
      console.log('Queue Status:', JSON.stringify(queueStatus, null, 2));
    }
  }

  // 정리
  console.log('\n🧹 Cleaning up connections...');
  sockets.forEach(socket => {
    if (socket.connected) {
      socket.disconnect();
    }
  });

  console.log('✅ Load test completed!\n');
  process.exit(0);
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  sockets.forEach(socket => socket.disconnect());
  process.exit(0);
});

// 실행
runLoadTest().catch(error => {
  console.error('❌ Load test failed:', error);
  process.exit(1);
});
