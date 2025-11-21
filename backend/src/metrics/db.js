const { dbQueryDuration, dbConnections } = require('./index');

// DB 쿼리를 실행하면서 쿼리가 얼마나 걸렸는지 Prometheus에 기록하는 함수
const measureQuery = async (operation, table, queryFunc) => {
  const start = Date.now();
  const result = await queryFunc();
  
  // 쿼리 실행 시간을 초 단위로 변환하여 관측
  dbQueryDuration.labels(operation, table).observe((Date.now() - start) / 1000);
  return result;
};

// 현재 DB 커넥션 풀에서 얼마나 많은 커넥션이 사용 중인지 Prometheus에 저장함
const setActiveConnections = (count) => {
  dbConnections.set(count);
};

// DB Pool을 메트릭 수집 기능으로 감싸는 함수
const wrapPoolWithMetrics = (pool) => {
  const originalQuery = pool.query.bind(pool);

  // pool.query를 오버라이드하여 메트릭 수집
  pool.query = function(...args) {
    const start = Date.now();
    const promise = originalQuery(...args);

    promise
      .then((result) => {
        const duration = (Date.now() - start) / 1000;
        // 쿼리 텍스트에서 operation 추출 (SELECT, INSERT, UPDATE, DELETE 등)
        const queryText = typeof args[0] === 'string' ? args[0] : args[0].text || '';
        const operation = queryText.trim().split(/\s+/)[0].toUpperCase() || 'UNKNOWN';

        dbQueryDuration.labels(operation, 'unknown').observe(duration);
        return result;
      })
      .catch((err) => {
        const duration = (Date.now() - start) / 1000;
        const queryText = typeof args[0] === 'string' ? args[0] : args[0].text || '';
        const operation = queryText.trim().split(/\s+/)[0].toUpperCase() || 'UNKNOWN';

        dbQueryDuration.labels(operation, 'error').observe(duration);
        throw err;
      });

    return promise;
  };

  // 주기적으로 커넥션 풀 상태 업데이트
  setInterval(() => {
    setActiveConnections(pool.totalCount - pool.idleCount);
  }, 5000);
};

module.exports = { measureQuery, setActiveConnections, wrapPoolWithMetrics };
// -> → Grafana에서
// "현재 DB 연결이 많아지는 시점"
// "DB 병목이 발생하는 순간"
// 확인 가능