/**
 * Queue Dynamic Test Script
 *
 * 대기열 순번 감소를 테스트하기 위한 스크립트
 * Active 사용자가 주기적으로 나가면서 대기열 처리를 시뮬레이션합니다.
 *
 * 사용법:
 *   node scripts/queue-dynamic-test.js --eventId <UUID>
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

const CONFIG = {
  eventId: getArg('--eventId', 'f19b2439-fc50-434e-b9e6-72b090f1c27c'),
  apiUrl: getArg('--apiUrl', 'http://localhost:3001'),
  activeUsers: 10, // 초기 active 사용자 수
  queueUsers: 5,   // 대기열 사용자 수
  exitInterval: 3000, // 3초마다 한 명씩 나감
};

const users = [];

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
  console.log('='.repeat(60) + '\n');

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

  // 4단계: 주기적으로 Active 사용자 나가기
  console.log('🔄 Step 4: Simulating user exits...\n');
  console.log('👀 Watch the queue positions decrease!\n');

  let exitIndex = 0;
  const exitInterval = setInterval(async () => {
    if (exitIndex >= CONFIG.activeUsers) {
      clearInterval(exitInterval);
      console.log('\n✅ All active users exited\n');

      // 최종 상태 확인
      console.log('📊 Final Queue Status:\n');
      for (let i = CONFIG.activeUsers; i < users.length; i++) {
        const status = await checkQueueStatus(users[i]);
        if (status && status.queued) {
          console.log(`User ${i}: Position ${status.position}/${status.queueSize}`);
        } else if (status && !status.queued) {
          console.log(`User ${i}: ✅ Entered!`);
        }
      }

      console.log('\n✅ Test completed!\n');
      process.exit(0);
      return;
    }

    // Active 사용자 나가기
    await leaveQueue(users[exitIndex]);

    // 대기열 상태 확인
    if (users.length > CONFIG.activeUsers) {
      const sampleUser = users[CONFIG.activeUsers];
      const status = await checkQueueStatus(sampleUser);
      if (status && status.queued) {
        console.log(`📊 Queue Status: Position ${status.position}/${status.queueSize}`);
      } else if (status && !status.queued) {
        console.log(`✅ Sample user entered!`);
      }
    }

    exitIndex++;
  }, CONFIG.exitInterval);
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
