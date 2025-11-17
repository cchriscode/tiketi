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

module.exports = { measureQuery, setActiveConnections };
// -> → Grafana에서
// “현재 DB 연결이 많아지는 시점”
// “DB 병목이 발생하는 순간”
// 확인 가능