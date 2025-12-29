import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import axios from 'axios';
import './Statistics.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function Statistics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 기존 통계
  const [overview, setOverview] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [eventStats, setEventStats] = useState([]);
  const [paymentStats, setPaymentStats] = useState([]);
  const [revenueStats, setRevenueStats] = useState([]);

  // 새로운 통계
  const [hourlyTraffic, setHourlyTraffic] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [cancellations, setCancellations] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [seatPreferences, setSeatPreferences] = useState(null);
  const [userBehavior, setUserBehavior] = useState(null);
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    fetchAllStats();

    // 실시간 데이터는 30초마다 자동 갱신
    const realtimeInterval = setInterval(() => {
      fetchRealtimeStats();
    }, 30000);

    return () => clearInterval(realtimeInterval);
  }, []);

  const getStatsServiceUrl = () => {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3005';
    } else if (hostname.match(/^(172\.|192\.168\.|10\.)/)) {
      return `http://${hostname}:3005`;
    } else {
      return `${window.location.protocol}//${hostname}:3005`;
    }
  };

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      const statsServiceUrl = getStatsServiceUrl();
      const headers = getHeaders();

      // 모든 통계를 병렬로 가져오기
      const [
        overviewRes,
        dailyRes,
        eventsRes,
        paymentsRes,
        revenueRes,
        hourlyRes,
        conversionRes,
        cancellationRes,
        realtimeRes,
        seatPrefRes,
        userBehaviorRes,
        performanceRes,
      ] = await Promise.all([
        axios.get(`${statsServiceUrl}/stats/overview`, { headers }),
        axios.get(`${statsServiceUrl}/stats/daily?days=30`, { headers }),
        axios.get(`${statsServiceUrl}/stats/events?limit=10&sortBy=revenue`, { headers }),
        axios.get(`${statsServiceUrl}/stats/payments`, { headers }),
        axios.get(`${statsServiceUrl}/stats/revenue?period=daily&days=30`, { headers }),
        axios.get(`${statsServiceUrl}/stats/hourly-traffic?days=7`, { headers }),
        axios.get(`${statsServiceUrl}/stats/conversion?days=30`, { headers }),
        axios.get(`${statsServiceUrl}/stats/cancellations?days=30`, { headers }),
        axios.get(`${statsServiceUrl}/stats/realtime`, { headers }),
        axios.get(`${statsServiceUrl}/stats/seat-preferences`, { headers }),
        axios.get(`${statsServiceUrl}/stats/user-behavior?days=30`, { headers }),
        axios.get(`${statsServiceUrl}/stats/performance`, { headers }),
      ]);

      setOverview(overviewRes.data.data);
      setDailyStats(dailyRes.data.data.reverse());
      setEventStats(eventsRes.data.data);
      setPaymentStats(paymentsRes.data.data);
      setRevenueStats(revenueRes.data.data.reverse());
      setHourlyTraffic(hourlyRes.data.data);
      setConversion(conversionRes.data.data);
      setCancellations(cancellationRes.data.data);
      setRealtime(realtimeRes.data.data);
      setSeatPreferences(seatPrefRes.data.data);
      setUserBehavior(userBehaviorRes.data.data);
      setPerformance(performanceRes.data.data);

      setError(null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setError('통계를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtimeStats = async () => {
    try {
      const statsServiceUrl = getStatsServiceUrl();
      const headers = getHeaders();
      const response = await axios.get(`${statsServiceUrl}/stats/realtime`, { headers });
      setRealtime(response.data.data);
    } catch (error) {
      console.error('Failed to fetch realtime stats:', error);
    }
  };

  if (loading) {
    return <div className="stats-container"><div className="loading">통계를 불러오는 중...</div></div>;
  }

  if (error) {
    return (
      <div className="stats-container">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchAllStats}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container">
      <div className="stats-header">
        <h1>📊 통계 대시보드</h1>
        <button onClick={fetchAllStats} className="refresh-btn">🔄 새로고침</button>
      </div>

      {/* 실시간 현황 카드 */}
      {realtime && (
        <div className="realtime-section">
          <h2>⚡ 실시간 현황 <span className="live-indicator">● LIVE</span></h2>
          <div className="realtime-cards">
            <div className="realtime-card">
              <div className="realtime-icon">🔒</div>
              <div className="realtime-value">{realtime.current.locked_seats}</div>
              <div className="realtime-label">선택 중인 좌석</div>
            </div>
            <div className="realtime-card">
              <div className="realtime-icon">💳</div>
              <div className="realtime-value">{realtime.current.active_payments}</div>
              <div className="realtime-label">진행 중 결제</div>
            </div>
            <div className="realtime-card">
              <div className="realtime-icon">👥</div>
              <div className="realtime-value">{realtime.current.active_users}</div>
              <div className="realtime-label">활성 사용자</div>
            </div>
            <div className="realtime-card">
              <div className="realtime-icon">🎫</div>
              <div className="realtime-value">{realtime.lastHour.reservations}</div>
              <div className="realtime-label">최근 1시간 예약</div>
            </div>
            <div className="realtime-card highlight">
              <div className="realtime-icon">💰</div>
              <div className="realtime-value">{(realtime.lastHour.revenue || 0).toLocaleString()}원</div>
              <div className="realtime-label">최근 1시간 매출</div>
            </div>
          </div>

          {/* 인기 이벤트 */}
          {realtime.trendingEvents && realtime.trendingEvents.length > 0 && (
            <div className="trending-events">
              <h3>🔥 실시간 인기 이벤트</h3>
              <div className="trending-list">
                {realtime.trendingEvents.map((event, index) => (
                  <div key={event.id} className="trending-item">
                    <span className="trend-rank">#{index + 1}</span>
                    <span className="trend-title">{event.title}</span>
                    <span className="trend-count">{event.recent_reservations}건</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overview Cards */}
      {overview && (
        <div className="overview-cards">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{overview.total_users?.toLocaleString()}</div>
              <div className="stat-label">총 사용자</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <div className="stat-value">{overview.active_events?.toLocaleString()}</div>
              <div className="stat-label">진행 중 이벤트</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <div className="stat-value">{overview.confirmed_reservations?.toLocaleString()}</div>
              <div className="stat-label">확정 예약</div>
            </div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">{(overview.payment_revenue || 0).toLocaleString()}원</div>
              <div className="stat-label">총 매출</div>
            </div>
          </div>
        </div>
      )}

      {/* 전환율 및 성과 지표 */}
      {conversion && (
        <div className="conversion-section">
          <h2>📈 전환율 분석</h2>
          <div className="conversion-funnel">
            <div className="funnel-item">
              <div className="funnel-label">좌석 선택 시작</div>
              <div className="funnel-value">{conversion.funnel.total_started.toLocaleString()}</div>
              <div className="funnel-bar" style={{ width: '100%', backgroundColor: '#0088FE' }}></div>
            </div>
            <div className="funnel-item">
              <div className="funnel-label">결제 완료</div>
              <div className="funnel-value">{conversion.funnel.completed.toLocaleString()}</div>
              <div className="funnel-bar" style={{
                width: `${(conversion.funnel.completed / conversion.funnel.total_started * 100)}%`,
                backgroundColor: '#00C49F'
              }}></div>
            </div>
            <div className="funnel-item">
              <div className="funnel-label">대기 중</div>
              <div className="funnel-value">{conversion.funnel.pending.toLocaleString()}</div>
              <div className="funnel-bar" style={{
                width: `${(conversion.funnel.pending / conversion.funnel.total_started * 100)}%`,
                backgroundColor: '#FFBB28'
              }}></div>
            </div>
            <div className="funnel-item">
              <div className="funnel-label">취소됨</div>
              <div className="funnel-value">{conversion.funnel.cancelled.toLocaleString()}</div>
              <div className="funnel-bar" style={{
                width: `${(conversion.funnel.cancelled / conversion.funnel.total_started * 100)}%`,
                backgroundColor: '#FF8042'
              }}></div>
            </div>
          </div>
          <div className="conversion-rates">
            <div className="rate-card success">
              <div className="rate-label">전환율</div>
              <div className="rate-value">{conversion.rates.conversion_rate}%</div>
            </div>
            <div className="rate-card warning">
              <div className="rate-label">대기율</div>
              <div className="rate-value">{conversion.rates.pending_rate}%</div>
            </div>
            <div className="rate-card danger">
              <div className="rate-label">취소율</div>
              <div className="rate-value">{conversion.rates.cancellation_rate}%</div>
            </div>
          </div>
        </div>
      )}

      {/* 시간대별 트래픽 */}
      {hourlyTraffic && (
        <div className="chart-section">
          <h2>⏰ 시간대별 트래픽 분석</h2>
          <div className="traffic-info">
            <p>📊 Peak Hour: <strong>{hourlyTraffic.peakHour.hour}시</strong> ({hourlyTraffic.peakHour.reservations}건)</p>
            {hourlyTraffic.weekdayComparison && hourlyTraffic.weekdayComparison.length > 0 && (
              <div className="weekday-comparison">
                {hourlyTraffic.weekdayComparison.map(item => (
                  <span key={item.day_type}>
                    {item.day_type === 'weekday' ? '평일' : '주말'}: {parseInt(item.reservations)}건
                  </span>
                ))}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyTraffic.hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" label={{ value: '시간', position: 'insideBottom', offset: -5 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_reservations" fill="#8884d8" name="총 예약" />
              <Bar dataKey="confirmed" fill="#82ca9d" name="완료" />
              <Bar dataKey="cancelled" fill="#ff7c7c" name="취소" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 일별 예약 추이 */}
      <div className="chart-section">
        <h2>📅 일별 예약 추이</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="reservations" stroke="#8884d8" name="전체 예약" />
            <Line type="monotone" dataKey="confirmed" stroke="#82ca9d" name="확정 예약" />
            <Line type="monotone" dataKey="cancelled" stroke="#ff7c7c" name="취소" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 매출 추이 */}
      <div className="chart-section">
        <h2>💰 일별 매출 추이</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="total_revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="매출 (원)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 취소 분석 */}
      {cancellations && cancellations.overview && (
        <div className="chart-section">
          <h2>❌ 취소/환불 분석</h2>
          <div className="cancellation-overview">
            <div className="cancel-stat">
              <div className="cancel-label">총 취소 건수</div>
              <div className="cancel-value">{parseInt(cancellations.overview.total_cancelled || 0).toLocaleString()}건</div>
            </div>
            <div className="cancel-stat">
              <div className="cancel-label">평균 취소 시간</div>
              <div className="cancel-value">{parseFloat(cancellations.overview.avg_hours_before_cancel || 0).toFixed(1)}시간</div>
            </div>
            <div className="cancel-stat">
              <div className="cancel-label">환불 총액</div>
              <div className="cancel-value">{parseInt(cancellations.overview.total_refund_amount || 0).toLocaleString()}원</div>
            </div>
          </div>
          {cancellations.byEvent && cancellations.byEvent.length > 0 && (
            <div className="cancellation-table">
              <h3>이벤트별 취소율 (상위 10개)</h3>
              <table>
                <thead>
                  <tr>
                    <th>이벤트</th>
                    <th>총 예약</th>
                    <th>취소</th>
                    <th>취소율</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellations.byEvent.map(event => (
                    <tr key={event.id}>
                      <td>{event.title}</td>
                      <td>{parseInt(event.total_reservations)}</td>
                      <td>{parseInt(event.cancelled)}</td>
                      <td className={parseFloat(event.cancellation_rate) > 20 ? 'high-cancel' : ''}>
                        {parseFloat(event.cancellation_rate)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 좌석 선호도 */}
      {seatPreferences && (
        <div className="chart-section">
          <h2>🪑 좌석 선호도 분석</h2>
          <div className="seat-preference-grid">
            {/* 구역별 */}
            {seatPreferences.bySection && seatPreferences.bySection.length > 0 && (
              <div className="preference-chart">
                <h3>구역별 예약률</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={seatPreferences.bySection}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="section" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="reservation_rate" fill="#8884d8" name="예약률 (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 가격대별 */}
            {seatPreferences.byPriceTier && seatPreferences.byPriceTier.length > 0 && (
              <div className="preference-chart">
                <h3>가격대별 선호도</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={seatPreferences.byPriceTier}
                      dataKey="reserved_seats"
                      nameKey="price_tier"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {seatPreferences.byPriceTier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 사용자 행동 패턴 */}
      {userBehavior && (
        <div className="chart-section">
          <h2>👤 사용자 행동 패턴</h2>
          <div className="user-behavior-grid">
            {/* 사용자 유형 */}
            {userBehavior.userTypes && userBehavior.userTypes.length > 0 && (
              <div className="behavior-chart">
                <h3>사용자 유형</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={userBehavior.userTypes}
                      dataKey="user_count"
                      nameKey="user_type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ user_type, user_count }) => `${user_type}: ${user_count}`}
                    >
                      {userBehavior.userTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 평균 지표 */}
            {userBehavior.averageMetrics && (
              <div className="behavior-metrics">
                <h3>평균 지표</h3>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-label">평균 예약 건수</div>
                    <div className="metric-value">{parseFloat(userBehavior.averageMetrics.avg_reservations || 0).toFixed(2)}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">최대 예약 건수</div>
                    <div className="metric-value">{parseInt(userBehavior.averageMetrics.max_reservations || 0)}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">평균 결제 시간</div>
                    <div className="metric-value">{userBehavior.avgTimeToPayment}분</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 지출 분포 */}
          {userBehavior.spendingDistribution && userBehavior.spendingDistribution.length > 0 && (
            <div className="spending-distribution">
              <h3>사용자 지출 분포</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userBehavior.spendingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="spending_tier" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="user_count" fill="#82ca9d" name="사용자 수" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 성능 메트릭 */}
      {performance && (
        <div className="chart-section">
          <h2>⚙️ 시스템 성능</h2>
          <div className="performance-overview">
            <div className="perf-card">
              <div className="perf-label">DB 크기</div>
              <div className="perf-value">{performance.database.size}</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">최근 성공률</div>
              <div className="perf-value">{performance.recentPerformance.successRate}%</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">결제 실패율</div>
              <div className="perf-value">{performance.metrics.paymentFailureRate}%</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">평균 좌석 잠금 시간</div>
              <div className="perf-value">{performance.metrics.avgSeatLockSeconds}초</div>
            </div>
          </div>
          {performance.database.tableCounts && (
            <div className="table-counts">
              <h3>테이블별 레코드 수</h3>
              <div className="table-count-grid">
                <div>사용자: {parseInt(performance.database.tableCounts.users).toLocaleString()}</div>
                <div>이벤트: {parseInt(performance.database.tableCounts.events).toLocaleString()}</div>
                <div>예약: {parseInt(performance.database.tableCounts.reservations).toLocaleString()}</div>
                <div>좌석: {parseInt(performance.database.tableCounts.seats).toLocaleString()}</div>
                <div>결제: {parseInt(performance.database.tableCounts.payments).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 이벤트별 통계 테이블 */}
      <div className="chart-section">
        <h2>🎭 이벤트별 통계 (매출 순)</h2>
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th>이벤트</th>
                <th>장소</th>
                <th>예약 수</th>
                <th>확정</th>
                <th>점유율</th>
                <th>매출</th>
              </tr>
            </thead>
            <tbody>
              {eventStats.map((event) => (
                <tr key={event.id}>
                  <td className="event-title">{event.title}</td>
                  <td>{event.venue}</td>
                  <td>{parseInt(event.reservations)}</td>
                  <td>{parseInt(event.confirmed_reservations)}</td>
                  <td>{event.occupancy_rate ? `${parseFloat(event.occupancy_rate)}%` : '-'}</td>
                  <td className="revenue">{parseInt(event.revenue || 0).toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 결제 수단별 통계 */}
      {paymentStats.length > 0 && (
        <div className="chart-section">
          <h2>💳 결제 수단별 통계</h2>
          <div className="payment-stats-grid">
            <div className="payment-chart">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStats}
                    dataKey="total_amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {paymentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="payment-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>결제 수단</th>
                    <th>건수</th>
                    <th>총 금액</th>
                    <th>평균 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentStats.map((payment, index) => (
                    <tr key={index}>
                      <td>{payment.method || 'N/A'}</td>
                      <td>{parseInt(payment.count)}</td>
                      <td>{parseInt(payment.total_amount || 0).toLocaleString()}원</td>
                      <td>{Math.round(payment.average_amount || 0).toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Statistics;
