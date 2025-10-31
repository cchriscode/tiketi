const { client: redisClient } = require('../config/redis');

/**
 * WebSocket 세션 관리 (ALB 멀티 인스턴스 대비)
 *
 * Redis에 사용자 세션 저장하여 재연결 시 이전 상태 복구
 * - 어떤 이벤트 룸에 있었는지
 * - 대기열 위치
 * - 좌석 선택 상태
 */

const SESSION_TTL = 3600; // 1시간

/**
 * 사용자 세션 저장
 */
async function saveUserSession(userId, sessionData) {
  try {
    const key = `socket:session:${userId}`;
    await redisClient.set(
      key,
      JSON.stringify({
        ...sessionData,
        lastActivity: Date.now(),
      }),
      { EX: SESSION_TTL }
    );
    return true;
  } catch (error) {
    console.error('Failed to save user session:', error);
    return false;
  }
}

/**
 * 사용자 세션 조회
 */
async function getUserSession(userId) {
  try {
    const key = `socket:session:${userId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get user session:', error);
    return null;
  }
}

/**
 * 사용자 세션 삭제
 */
async function deleteUserSession(userId) {
  try {
    const key = `socket:session:${userId}`;
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Failed to delete user session:', error);
    return false;
  }
}

/**
 * 사용자 세션 업데이트 (특정 필드만)
 */
async function updateUserSession(userId, updates) {
  try {
    const session = await getUserSession(userId);
    if (!session) return false;

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: Date.now(),
    };

    return await saveUserSession(userId, updatedSession);
  } catch (error) {
    console.error('Failed to update user session:', error);
    return false;
  }
}

/**
 * Socket ID와 User ID 매핑 저장
 * (같은 유저가 여러 탭에서 접속할 수 있으므로 Set 사용)
 */
async function mapSocketToUser(socketId, userId) {
  try {
    const key = `socket:map:${socketId}`;
    await redisClient.set(key, userId, { EX: SESSION_TTL });

    // 역방향 매핑도 저장 (User -> Socket IDs)
    const userSocketsKey = `socket:user:${userId}`;
    await redisClient.sAdd(userSocketsKey, socketId);
    await redisClient.expire(userSocketsKey, SESSION_TTL);

    return true;
  } catch (error) {
    console.error('Failed to map socket to user:', error);
    return false;
  }
}

/**
 * Socket ID로 User ID 조회
 */
async function getUserIdBySocket(socketId) {
  try {
    const key = `socket:map:${socketId}`;
    return await redisClient.get(key);
  } catch (error) {
    console.error('Failed to get userId by socket:', error);
    return null;
  }
}

/**
 * Socket 연결 해제 시 매핑 제거
 */
async function unmapSocket(socketId) {
  try {
    const userId = await getUserIdBySocket(socketId);
    if (userId) {
      const userSocketsKey = `socket:user:${userId}`;
      await redisClient.sRem(userSocketsKey, socketId);
    }

    const key = `socket:map:${socketId}`;
    await redisClient.del(key);

    return true;
  } catch (error) {
    console.error('Failed to unmap socket:', error);
    return false;
  }
}

/**
 * 특정 유저의 모든 Socket ID 조회
 */
async function getUserSockets(userId) {
  try {
    const key = `socket:user:${userId}`;
    return await redisClient.sMembers(key);
  } catch (error) {
    console.error('Failed to get user sockets:', error);
    return [];
  }
}

module.exports = {
  saveUserSession,
  getUserSession,
  deleteUserSession,
  updateUserSession,
  mapSocketToUser,
  getUserIdBySocket,
  unmapSocket,
  getUserSockets,
};
