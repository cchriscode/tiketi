# 📊 과거 데이터 기반 스케일링 + 대기열 시스템

> **목표**: 과거 데이터 평균으로 EC2를 사전 확장하고, 초과 트래픽은 대기열 처리

## 🎯 시나리오

### 예시: 임영웅 콘서트
```
9:00 AM - 티켓 오픈
   ↓
시스템이 과거 데이터 조회:
   "임영웅" 검색 → 과거 3회 콘서트
   - 1회차: 12,000명
   - 2회차: 18,000명  
   - 3회차: 15,000명
   → 평균: 15,000명
   
   필요한 EC2 = 15,000 / 1,500 (인스턴스당 처리량) = 10대
   ↓
8:30 AM - 자동 스케일업 시작 (30분 전)
   EC2: 2대 → 10대 (8분 소요)
   ↓
8:38 AM - EC2 준비 완료
   대기열 시스템 활성화 (임계값: 12,000명)
   ↓
9:00 AM - 트래픽 몰림
   - 0~12,000명: ✅ 바로 접속
   - 12,001~18,000명: ⏳ 대기열 (평균 30초)
   - 18,001명~: ⏳ 대기열 (평균 2분)
   ↓
결과: 안정적 처리, 서버 다운 없음
```

---

## 📊 핵심 아이디어

### 1. 간단한 평균 계산
```
과거 데이터만 평균 내면 끝!
- ML 모델 ❌
- 복잡한 예측 ❌  
- 실시간 분석 ❌

필요한 것:
✅ 과거 동시접속자 평균
✅ 인스턴스당 처리 가능 인원 (약 1,500명)
✅ EC2 = 평균 / 1,500 (올림)
```

### 2. 대기열로 버퍼 확보
```
예상치를 초과하면?
→ 대기열로 자동 이동
→ 서버 다운 방지
→ 순차 입장으로 안정성 확보

예: 10대 EC2 = 15,000명 처리 가능
    실제 20,000명 접속?
    → 15,000명: 바로 입장
    → 5,000명: 대기열 (평균 1분)
```

### 3. 수집할 데이터 (분 단위)
```
이벤트별로 저장:
- 타임스탬프 (분 단위)
- 동시 접속자 수
- EC2 인스턴스 수
- 대기열 인원

이게 전부!
```

---

## 🗄️ 데이터베이스 구조 (초간단)

### 1. 트래픽 기록 테이블
```sql
-- 분 단위로 기록
CREATE TABLE traffic_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id),
    timestamp TIMESTAMP NOT NULL,
    
    -- 핵심 데이터만
    concurrent_users INTEGER,      -- 동시 접속자
    queue_users INTEGER DEFAULT 0, -- 대기열 인원
    ec2_count INTEGER,             -- EC2 인스턴스 수
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_traffic_event ON traffic_logs(event_id, timestamp DESC);
```

### 2. 아티스트 평균 데이터 테이블
```sql
-- 아티스트별 단순 평균
CREATE TABLE artist_averages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_name VARCHAR(255) UNIQUE,
    
    -- 평균 데이터
    avg_concurrent_users INTEGER,  -- 평균 동시접속
    event_count INTEGER,           -- 샘플 수
    
    -- 계산된 추천값
    recommended_ec2 INTEGER,       -- 추천 EC2 수
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_artist_name ON artist_averages(artist_name);
```

### 3. 이벤트 테이블에 컬럼 추가
```sql
ALTER TABLE events ADD COLUMN artist_name VARCHAR(255);
ALTER TABLE events ADD COLUMN pre_scaled BOOLEAN DEFAULT FALSE;
```

---

## 💻 구현 코드 (초간단)

### 1. 트래픽 수집 (분 단위)

#### `backend/src/services/traffic-logger.js`
```javascript
const { pool } = require('../config/database');
const queueManager = require('./queue-manager');

class TrafficLogger {
  constructor() {
    this.activeUsers = new Set();
    
    // 1분마다 저장
    setInterval(() => this.logTraffic(), 60000);
  }
  
  // 요청마다 사용자 추적
  trackUser(userId, eventId) {
    this.activeUsers.add(userId);
  }
  
  async logTraffic() {
    // 현재 활성 이벤트 가져오기
    const activeEvents = await pool.query(`
      SELECT id FROM events 
      WHERE sale_start_date <= NOW() 
      AND sale_end_date >= NOW()
    `);
    
    for (const event of activeEvents.rows) {
      await pool.query(`
        INSERT INTO traffic_logs (
          event_id, 
          timestamp, 
          concurrent_users,
          queue_users,
          ec2_count
        ) VALUES ($1, NOW(), $2, $3, $4)
      `, [
        event.id,
        this.activeUsers.size,
        queueManager.getQueueSize(event.id),
        parseInt(process.env.EC2_COUNT || 2)
      ]);
    }
    
    // 리셋
    this.activeUsers.clear();
  }
}

module.exports = new TrafficLogger();
```

### 2. 평균 계산 (이벤트 종료 후)

#### `backend/src/services/average-calculator.js`
```javascript
const { pool } = require('../config/database');

class AverageCalculator {
  // 이벤트 종료 후 평균 계산
  async calculateAverage(eventId) {
    // 1. 이벤트 정보
    const event = await pool.query(
      'SELECT title, artist_name FROM events WHERE id = $1',
      [eventId]
    );
    
    if (event.rows.length === 0) return;
    
    const { artist_name } = event.rows[0];
    if (!artist_name) return;
    
    // 2. 해당 아티스트의 모든 이벤트 트래픽 데이터 가져오기
    const avgData = await pool.query(`
      SELECT AVG(concurrent_users)::INTEGER as avg_users
      FROM traffic_logs tl
      JOIN events e ON tl.event_id = e.id
      WHERE e.artist_name = $1
    `, [artist_name]);
    
    const avgUsers = avgData.rows[0].avg_users || 0;
    
    // 3. 필요한 EC2 수 계산 (간단한 공식)
    const recommendedEc2 = Math.ceil(avgUsers / 1500);
    
    // 4. 이벤트 수 카운트
    const countData = await pool.query(`
      SELECT COUNT(DISTINCT e.id) as event_count
      FROM events e
      WHERE e.artist_name = $1
    `, [artist_name]);
    
    const eventCount = countData.rows[0].event_count;
    
    // 5. DB에 저장 (UPSERT)
    await pool.query(`
      INSERT INTO artist_averages (
        artist_name,
        avg_concurrent_users,
        event_count,
        recommended_ec2
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (artist_name) 
      DO UPDATE SET
        avg_concurrent_users = $2,
        event_count = $3,
        recommended_ec2 = $4,
        updated_at = NOW()
    `, [artist_name, avgUsers, eventCount, recommendedEc2]);
    
    console.log(`✅ ${artist_name} 평균 계산 완료`);
    console.log(`   평균 동시접속: ${avgUsers}명`);
    console.log(`   추천 EC2: ${recommendedEc2}대`);
    console.log(`   샘플 수: ${eventCount}개`);
  }
}

module.exports = new AverageCalculator();
```

---

### 3. 자동 스케일링 스케줄러 (30분 전 확장)

#### `backend/src/services/auto-scaler.js`
```javascript
const { pool } = require('../config/database');
const AWS = require('aws-sdk');

const autoscaling = new AWS.AutoScaling();

class AutoScaler {
  constructor() {
    // 10분마다 다가오는 이벤트 체크
    setInterval(() => this.checkUpcomingEvents(), 600000);
  }
  
  async checkUpcomingEvents() {
    // 30분~40분 사이에 시작하는 이벤트 찾기
    const upcomingEvents = await pool.query(`
      SELECT id, title, artist_name, sale_start_date 
      FROM events
      WHERE sale_start_date BETWEEN NOW() + INTERVAL '30 minutes' 
                                AND NOW() + INTERVAL '40 minutes'
      AND pre_scaled = FALSE
    `);
    
    for (const event of upcomingEvents.rows) {
      await this.scheduleScaling(event);
    }
  }
  
  async scheduleScaling(event) {
    const { id, title, artist_name, sale_start_date } = event;
    
    // 1. 아티스트 평균 데이터 조회
    let recommendedEc2 = 5; // 기본값
    let source = '기본 설정';
    
    if (artist_name) {
      const avgData = await pool.query(
        'SELECT avg_concurrent_users, recommended_ec2 FROM artist_averages WHERE artist_name = $1',
        [artist_name]
      );
      
      if (avgData.rows.length > 0) {
        recommendedEc2 = avgData.rows[0].recommended_ec2;
        source = `과거 평균 ${avgData.rows[0].avg_concurrent_users}명 기반`;
        
        console.log(`📊 ${artist_name} - 평균 데이터 발견!`);
        console.log(`   추천 EC2: ${recommendedEc2}대`);
      }
    }
    
    // 2. AWS Auto Scaling 실행
    await this.scaleEC2(id, recommendedEc2);
    
    // 3. DB 업데이트
    await pool.query(
      'UPDATE events SET pre_scaled = TRUE WHERE id = $1',
      [id]
    );
    
    console.log(`✅ ${title} 스케일링 완료`);
    console.log(`   EC2: 2대 → ${recommendedEc2}대`);
    console.log(`   근거: ${source}`);
    console.log(`   오픈: ${new Date(sale_start_date).toLocaleString()}`);
  }
  
  async scaleEC2(eventId, targetCount) {
    try {
      await autoscaling.setDesiredCapacity({
        AutoScalingGroupName: 'tiketi-asg',
        DesiredCapacity: targetCount
      }).promise();
      
      console.log(`✅ EC2 확장 시작: ${targetCount}대`);
      
      // 30분 후 다시 축소 스케줄
      setTimeout(async () => {
        await autoscaling.setDesiredCapacity({
          AutoScalingGroupName: 'tiketi-asg',
          DesiredCapacity: 2
        }).promise();
        console.log(`✅ EC2 축소: 2대로 복귀`);
      }, 30 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ EC2 스케일링 실패:', error);
    }
  }
}

module.exports = new AutoScaler();
```

---

## ⏳ 대기열 시스템 (초과 트래픽 처리)

### 핵심 아이디어
```
EC2로 처리 가능한 인원을 넘으면?
→ 대기열로 자동 이동
→ 순차적으로 입장
→ 서버 다운 방지
```

### `backend/src/services/queue-manager.js`
```javascript
const redis = require('../config/redis');

class QueueManager {
  // 동시 접속 임계값 (EC2 대수 * 1500)
  getThreshold() {
    const ec2Count = parseInt(process.env.EC2_COUNT || 2);
    return ec2Count * 1500;
  }
  
  // 대기열 진입 확인
  async checkQueueEntry(userId, eventId) {
    const currentUsers = await this.getCurrentUsers(eventId);
    const threshold = this.getThreshold();
    
    if (currentUsers >= threshold) {
      // 대기열로 이동
      await this.addToQueue(userId, eventId);
      return {
        queued: true,
        position: await this.getQueuePosition(userId, eventId),
        estimatedWait: await this.getEstimatedWait(userId, eventId)
      };
    }
    
    return { queued: false };
  }
  
  // 대기열 추가
  async addToQueue(userId, eventId) {
    const queueKey = `queue:${eventId}`;
    const timestamp = Date.now();
    await redis.zadd(queueKey, timestamp, userId);
  }
  
  // 대기열 순번
  async getQueuePosition(userId, eventId) {
    const queueKey = `queue:${eventId}`;
    const rank = await redis.zrank(queueKey, userId);
    return rank !== null ? rank + 1 : 0;
  }
  
  // 예상 대기 시간 (초)
  async getEstimatedWait(userId, eventId) {
    const position = await this.getQueuePosition(userId, eventId);
    const processingRate = 50; // 초당 50명 입장
    return Math.ceil(position / processingRate);
  }
  
  // 대기열에서 입장 허용
  async processQueue(eventId) {
    const queueKey = `queue:${eventId}`;
    const currentUsers = await this.getCurrentUsers(eventId);
    const threshold = this.getThreshold();
    const available = threshold - currentUsers;
    
    if (available > 0) {
      // 입장 가능한 만큼 꺼내기
      const users = await redis.zrange(queueKey, 0, available - 1);
      await redis.zremrangebyrank(queueKey, 0, available - 1);
      
      // 입장 허용 알림
      for (const userId of users) {
        await this.notifyEntry(userId, eventId);
      }
    }
  }
  
  async notifyEntry(userId, eventId) {
    // WebSocket으로 입장 허용 알림
    console.log(`✅ ${userId} 입장 허용`);
  }
  
  async getQueueSize(eventId) {
    const queueKey = `queue:${eventId}`;
    return await redis.zcard(queueKey);
  }
  
  async getCurrentUsers(eventId) {
    // 현재 활성 사용자 수 (Redis에서 관리)
    const key = `active:${eventId}`;
    return await redis.scard(key);
  }
}

module.exports = new QueueManager();
```

### 프론트엔드: 대기열 화면

#### `frontend/src/pages/Queue.js`
```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

function Queue() {
  const { eventId } = useParams();
  const [queueInfo, setQueueInfo] = useState(null);
  
  useEffect(() => {
    // 5초마다 대기열 정보 갱신
    const checkQueue = async () => {
      const res = await api.get(`/api/queue/status/${eventId}`);
      setQueueInfo(res.data);
      
      if (!res.data.queued) {
        // 입장 허용됨
        window.location.href = `/events/${eventId}`;
      }
    };
    
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    
    return () => clearInterval(interval);
  }, [eventId]);
  
  if (!queueInfo) return <div>로딩 중...</div>;
  
  return (
    <div className="queue-container">
      <h1>⏳ 대기열</h1>
      <div className="queue-info">
        <div className="position">
          <h2>{queueInfo.position}번째</h2>
          <p>현재 대기 순번</p>
        </div>
        <div className="wait-time">
          <h2>{Math.floor(queueInfo.estimatedWait / 60)}분</h2>
          <p>예상 대기 시간</p>
        </div>
      </div>
      <p className="queue-message">
        잠시만 기다려주세요. 순차적으로 입장하고 있습니다.
      </p>
      <div className="progress-bar">
        <div className="progress" style={{ 
          width: `${(1 - queueInfo.position / 1000) * 100}%` 
        }}></div>
      </div>
    </div>
  );
}

export default Queue;
```

---

## 📈 관리자 대시보드 (간단 버전)

### `frontend/src/pages/admin/TrafficMonitor.js`
```javascript
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import api from '../../services/api';

function TrafficMonitor() {
  const [metrics, setMetrics] = useState([]);
  const [eventId, setEventId] = useState(null);
  
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // 1분마다
    return () => clearInterval(interval);
  }, [eventId]);
  
  const fetchMetrics = async () => {
    const url = eventId 
      ? `/api/admin/traffic/${eventId}` 
      : '/api/admin/traffic/current';
    const res = await api.get(url);
    setMetrics(res.data.metrics);
  };
  
  const chartData = {
    labels: metrics.map(m => 
      new Date(m.timestamp).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    ),
    datasets: [
      {
        label: '동시 접속자',
        data: metrics.map(m => m.concurrent_users),
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        tension: 0.3,
      },
      {
        label: '대기열',
        data: metrics.map(m => m.queue_users),
        borderColor: '#FFA502',
        backgroundColor: 'rgba(255, 165, 2, 0.2)',
        tension: 0.3,
      },
    ]
  };
  
  return (
    <div className="traffic-monitor">
      <h1>📊 트래픽 모니터 (분 단위)</h1>
      
      {/* 현재 상태 */}
      <div className="status-cards">
        <div className="card">
          <h3>동시 접속자</h3>
          <div className="value">{metrics[metrics.length - 1]?.concurrent_users || 0}명</div>
        </div>
        <div className="card">
          <h3>대기열</h3>
          <div className="value">{metrics[metrics.length - 1]?.queue_users || 0}명</div>
        </div>
        <div className="card">
          <h3>EC2 인스턴스</h3>
          <div className="value">{metrics[metrics.length - 1]?.ec2_count || 2}대</div>
        </div>
      </div>
      
      {/* 차트 */}
      <div className="chart">
        <Line data={chartData} options={{
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '최근 트래픽 추이' }
          }
        }} />
      </div>
    </div>
  );
}

export default TrafficMonitor;
```

### `frontend/src/pages/admin/ArtistAverages.js`
```javascript
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function ArtistAverages() {
  const [artists, setArtists] = useState([]);
  
  useEffect(() => {
    fetchArtists();
  }, []);
  
  const fetchArtists = async () => {
    const res = await api.get('/api/admin/artist-averages');
    setArtists(res.data.artists);
  };
  
  return (
    <div className="artist-averages">
      <h1>🎤 아티스트별 평균 데이터</h1>
      
      <table>
        <thead>
          <tr>
            <th>아티스트</th>
            <th>평균 동시접속</th>
            <th>추천 EC2</th>
            <th>이벤트 수</th>
            <th>마지막 업데이트</th>
          </tr>
        </thead>
        <tbody>
          {artists.map(artist => (
            <tr key={artist.id}>
              <td><strong>{artist.artist_name}</strong></td>
              <td>{artist.avg_concurrent_users.toLocaleString()}명</td>
              <td>{artist.recommended_ec2}대</td>
              <td>{artist.event_count}회</td>
              <td>{new Date(artist.updated_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <p className="info">
        💡 이 데이터는 과거 이벤트 종료 후 자동으로 계산됩니다.
      </p>
    </div>
  );
}

export default ArtistAverages;
```

### `frontend/src/pages/admin/EventComparison.js`
```javascript
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import api from '../../services/api';

function EventComparison() {
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  
  useEffect(() => {
    fetchActiveEvents();
  }, []);
  
  useEffect(() => {
    if (selectedEvents.length > 0) {
      fetchComparisonData();
    }
  }, [selectedEvents]);
  
  const fetchActiveEvents = async () => {
    const res = await api.get('/api/admin/events/active');
    setActiveEvents(res.data.events);
    
    // 기본으로 모두 선택
    setSelectedEvents(res.data.events.map(e => e.id));
  };
  
  const fetchComparisonData = async () => {
    const res = await api.post('/api/admin/traffic/compare', {
      eventIds: selectedEvents,
      timeRange: '1h'
    });
    setComparisonData(res.data.comparison);
  };
  
  // 차트 데이터
  const chartData = {
    labels: comparisonData[0]?.metrics.map(m => 
      new Date(m.timestamp).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    ) || [],
    datasets: comparisonData.map((eventData, index) => {
      const colors = [
        { border: '#6C5CE7', bg: 'rgba(108, 92, 231, 0.1)' },
        { border: '#00B894', bg: 'rgba(0, 184, 148, 0.1)' },
        { border: '#FD79A8', bg: 'rgba(253, 121, 168, 0.1)' },
        { border: '#FDCB6E', bg: 'rgba(253, 203, 110, 0.1)' },
      ];
      const color = colors[index % colors.length];
      
      return {
        label: `${eventData.event_title} (동시접속)`,
        data: eventData.metrics.map(m => m.concurrent_users),
        borderColor: color.border,
        backgroundColor: color.bg,
        tension: 0.3,
      };
    })
  };
  
  // 대기열 차트
  const queueChartData = {
    labels: comparisonData[0]?.metrics.map(m => 
      new Date(m.timestamp).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    ) || [],
    datasets: comparisonData.map((eventData, index) => {
      const colors = [
        { border: '#FFA502', bg: 'rgba(255, 165, 2, 0.1)' },
        { border: '#FF6348', bg: 'rgba(255, 99, 72, 0.1)' },
        { border: '#A29BFE', bg: 'rgba(162, 155, 254, 0.1)' },
        { border: '#74B9FF', bg: 'rgba(116, 185, 255, 0.1)' },
      ];
      const color = colors[index % colors.length];
      
      return {
        label: `${eventData.event_title} (대기열)`,
        data: eventData.metrics.map(m => m.queue_users),
        borderColor: color.border,
        backgroundColor: color.bg,
        tension: 0.3,
      };
    })
  };
  
  return (
    <div className="event-comparison">
      <h1>🔄 이벤트별 트래픽 비교</h1>
      
      {/* 이벤트 선택 */}
      <div className="event-selector">
        <h3>비교할 이벤트 선택</h3>
        {activeEvents.map(event => (
          <label key={event.id}>
            <input
              type="checkbox"
              checked={selectedEvents.includes(event.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedEvents([...selectedEvents, event.id]);
                } else {
                  setSelectedEvents(selectedEvents.filter(id => id !== event.id));
                }
              }}
            />
            {event.title}
          </label>
        ))}
      </div>
      
      {/* 현재 상태 카드 */}
      <div className="comparison-cards">
        {comparisonData.map(eventData => {
          const latest = eventData.metrics[eventData.metrics.length - 1];
          return (
            <div key={eventData.event_id} className="event-card">
              <h3>{eventData.event_title}</h3>
              <div className="stats">
                <div className="stat">
                  <span className="label">접속자</span>
                  <span className="value">{latest?.concurrent_users.toLocaleString() || 0}명</span>
                </div>
                <div className="stat">
                  <span className="label">대기열</span>
                  <span className="value">{latest?.queue_users.toLocaleString() || 0}명</span>
                </div>
                <div className="stat">
                  <span className="label">총 트래픽</span>
                  <span className="value">
                    {((latest?.concurrent_users || 0) + (latest?.queue_users || 0)).toLocaleString()}명
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 동시접속 비교 차트 */}
      <div className="chart-container">
        <h3>📊 동시 접속자 비교 (분 단위)</h3>
        <Line data={chartData} options={{
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '접속자 수'
              }
            }
          }
        }} />
      </div>
      
      {/* 대기열 비교 차트 */}
      <div className="chart-container">
        <h3>⏳ 대기열 비교 (분 단위)</h3>
        <Line data={queueChartData} options={{
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '대기 인원'
              }
            }
          }
        }} />
      </div>
      
      {/* 통계 테이블 */}
      <div className="stats-table">
        <h3>📈 통계 요약</h3>
        <table>
          <thead>
            <tr>
              <th>이벤트</th>
              <th>최대 동시접속</th>
              <th>최대 대기열</th>
              <th>평균 동시접속</th>
              <th>평균 대기시간</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map(eventData => {
              const maxConcurrent = Math.max(...eventData.metrics.map(m => m.concurrent_users));
              const maxQueue = Math.max(...eventData.metrics.map(m => m.queue_users));
              const avgConcurrent = Math.round(
                eventData.metrics.reduce((sum, m) => sum + m.concurrent_users, 0) / eventData.metrics.length
              );
              
              return (
                <tr key={eventData.event_id}>
                  <td><strong>{eventData.event_title}</strong></td>
                  <td>{maxConcurrent.toLocaleString()}명</td>
                  <td>{maxQueue.toLocaleString()}명</td>
                  <td>{avgConcurrent.toLocaleString()}명</td>
                  <td>{Math.floor(maxQueue / 50)}초</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EventComparison;
```

---

## 🔍 백엔드: 이벤트 비교 API

### `backend/src/routes/admin.js`에 추가
```javascript
// 동시 진행 중인 이벤트 목록
router.get('/events/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, artist_name, sale_start_date
      FROM events
      WHERE sale_start_date <= NOW()
      AND sale_end_date >= NOW()
      ORDER BY sale_start_date
    `);
    
    res.json({ events: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 여러 이벤트 트래픽 비교
router.post('/traffic/compare', async (req, res) => {
  try {
    const { eventIds, timeRange = '1h' } = req.body;
    
    // 시간 범위 설정
    const intervals = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours'
    };
    
    const comparison = [];
    
    for (const eventId of eventIds) {
      // 이벤트 정보
      const eventInfo = await pool.query(
        'SELECT title FROM events WHERE id = $1',
        [eventId]
      );
      
      // 트래픽 데이터
      const metrics = await pool.query(`
        SELECT 
          timestamp,
          concurrent_users,
          queue_users,
          ec2_count
        FROM traffic_logs
        WHERE event_id = $1
        AND timestamp >= NOW() - INTERVAL '${intervals[timeRange]}'
        ORDER BY timestamp ASC
      `, [eventId]);
      
      comparison.push({
        event_id: eventId,
        event_title: eventInfo.rows[0]?.title || 'Unknown',
        metrics: metrics.rows
      });
    }
    
    res.json({ comparison });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📊 실제 사용 예시

### 시나리오: 임영웅 & 아이유 동시 티켓 오픈

```
9:00 AM - 동시 오픈
━━━━━━━━━━━━━━━━━━━━━━

📈 임영웅 콘서트
  접속자: 15,000명
  대기열: 5,000명
  총: 20,000명
  
🎤 아이유 콘서트
  접속자: 10,000명
  대기열: 2,000명
  총: 12,000명

━━━━━━━━━━━━━━━━━━━━━━
전체 트래픽: 32,000명
EC2: 17대 (임영웅 10대 + 아이유 7대)
```

### 관리자 대시보드에서 확인
```
[이벤트별 트래픽 비교] 화면

📊 차트:
  - 파란선: 임영웅 (동시접속)
  - 초록선: 아이유 (동시접속)
  - 주황선: 임영웅 (대기열)
  - 빨강선: 아이유 (대기열)

📋 통계 테이블:
| 이벤트      | 최대 동시접속 | 최대 대기열 | 평균 접속 |
|------------|--------------|------------|----------|
| 임영웅 콘서트 | 15,000명     | 5,000명    | 13,500명 |
| 아이유 콘서트 | 10,000명     | 2,000명    | 9,200명  |
```

---

## 📋 구현 순서 (간단 버전)

### Phase 1: 데이터베이스 준비 (1일)
- [ ] `traffic_logs` 테이블 생성
- [ ] `artist_averages` 테이블 생성
- [ ] `events` 테이블에 `artist_name`, `pre_scaled` 컬럼 추가

### Phase 2: 트래픽 수집 (2일)
- [ ] `traffic-logger.js` 구현
- [ ] 백엔드 미들웨어에 사용자 추적 추가
- [ ] 1분마다 자동 저장 확인

### Phase 3: 평균 계산 (2일)
- [ ] `average-calculator.js` 구현
- [ ] 이벤트 종료 후 자동 평균 계산
- [ ] `artist_averages` 테이블 업데이트

### Phase 4: 자동 스케일링 (3일)
- [ ] `auto-scaler.js` 구현
- [ ] AWS SDK 연동
- [ ] 30분 전 자동 확장 테스트

### Phase 5: 대기열 시스템 (3일)
- [ ] `queue-manager.js` 구현
- [ ] Redis Sorted Set 활용
- [ ] 프론트엔드 대기열 페이지

### Phase 6: 관리자 대시보드 (2일)
- [ ] Chart.js로 트래픽 차트
- [ ] 아티스트별 평균 데이터 조회
- [ ] 분 단위 트래픽 로그 표시

**총 소요 시간: 약 2주**

---

## 💰 추가 비용

| 항목 | 예상 비용 |
|------|----------|
| RDS 스토리지 증가 (트래픽 로그) | ₩2k/월 |
| **합계** | **₩2k/월** |

기존 ₩154k/월 → **₩156k/월** (약 1% 증가)

---

## 🎯 동작 예시

### 시나리오: 임영웅 콘서트 4회차

```
8:00 AM - 시스템이 자동으로 체크
   "임영웅" 아티스트 평균 확인
   - 1회차: 12,000명
   - 2회차: 18,000명
   - 3회차: 15,000명
   평균 = 15,000명
   추천 EC2 = 10대

8:30 AM - 자동 스케일업 시작
   EC2: 2대 → 10대
   
8:38 AM - EC2 준비 완료
   임계값: 15,000명 (10대 * 1,500)
   
9:00 AM - 티켓 오픈
   0~15,000명: ✅ 바로 접속
   15,001~20,000명: ⏳ 대기열 (평균 1분)
   
9:30 AM - 피크 종료
   자동 축소: 2대로 복귀
   
결과: 
✅ 서버 다운 없음
✅ 사용자 경험 개선
✅ 비용 최적화
```

---

## 🎁 핵심 장점

### 1. 간단함
- ML 모델 ❌
- 복잡한 알고리즘 ❌
- 단순 평균만 사용 ✅

### 2. 실용성
- 과거 데이터만 있으면 동작
- 데이터 없으면 기본값 사용
- 점진적으로 정확도 향상

### 3. 안정성
- 대기열로 초과 트래픽 처리
- 서버 다운 방지
- 사용자 경험 보장

---

**이제 진짜 티켓팅 시스템입니다!** 🎫

