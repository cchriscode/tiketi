# ✅ 대기열 모달 구현 완료!

## 변경 사항

### ❌ 이전 방식 (별도 페이지)
```
사용자가 이벤트 접속
  ↓
대기열 필요?
  ↓
새 페이지로 리다이렉트: /waiting-room/이벤트ID
```

### ✅ 새로운 방식 (모달/오버레이)
```
사용자가 이벤트 페이지 보는 중
  ↓
대기열 필요?
  ↓
같은 페이지에 풀스크린 오버레이 모달 표시!
```

---

## 동작 방식

### 1. 이벤트 페이지 접속 시

```javascript
// EventDetail.js
useEffect(() => {
  fetchEventDetail();
  checkQueueStatus(); // 대기열 상태 자동 확인
}, []);

// 대기열 필요하면 모달 표시
if (data.queued) {
  setShowQueueModal(true); // 모달 팝업!
}
```

### 2. 모달 표시

```jsx
{showQueueModal && (
  <WaitingRoomModal
    eventId={id}
    onEntryAllowed={handleQueueEntryAllowed} // 입장 허용 시
    onClose={handleQueueClose}               // 닫기 시
  />
)}
```

### 3. 모달 내부 동작

- ⏳ **실시간 순번 표시** (WebSocket)
- 📊 **프로그레스 바 애니메이션**
- 🔄 **자동 폴링** (5초마다 상태 확인)
- ✅ **입장 허용 시 자동으로 모달 닫힘**

---

## 사용자 경험

### 시나리오 1: 정상 입장

```
1. 사용자가 이벤트 페이지 클릭
2. 대기열 불필요 → 정상적으로 이벤트 페이지 표시 ✅
```

### 시나리오 2: 대기열 필요

```
1. 사용자가 이벤트 페이지 클릭
2. 대기열 필요 → 페이지 위에 풀스크린 오버레이 모달 표시
3. 모달에서 대기 순번 확인 (실시간 업데이트)
4. 입장 허용 → 모달 자동으로 닫힘
5. 뒤에 있던 이벤트 페이지가 그대로 보임 ✅
```

### 시나리오 3: 새로고침 시

```
1. 대기열 모달 표시 중 (300번째)
2. 사용자가 F5 (새로고침)
3. 페이지 다시 로드
4. 대기열 상태 자동 확인
5. 여전히 300번째 → 모달 다시 표시 ✅
   (순번 유지됨!)
```

---

## 파일 구조

### 생성된 파일
```
frontend/src/
├── components/
│   ├── WaitingRoomModal.js       # 대기열 모달 컴포넌트 (NEW)
│   └── WaitingRoomModal.css      # 모달 스타일 (NEW)
└── pages/
    ├── EventDetail.js            # 모달 통합 (수정됨)
    └── WaitingRoom.js            # ❌ 더 이상 사용하지 않음 (삭제해도 됨)
```

### 삭제/변경된 파일
```
frontend/src/
├── App.js                        # /waiting-room 라우트 제거
└── pages/
    ├── WaitingRoom.js            # 사용하지 않음
    └── WaitingRoom.css           # 사용하지 않음
```

---

## 주요 코드

### WaitingRoomModal.js (핵심 부분)

```javascript
function WaitingRoomModal({ eventId, onEntryAllowed, onClose }) {
  // WebSocket 연결
  const { isConnected } = useQueueUpdates(
    eventId,
    userId,
    handleQueueUpdate,      // 순번 업데이트
    handleEntryAllowed      // 입장 허용
  );

  // 입장 허용 시 자동으로 모달 닫기
  const handleEntryAllowed = useCallback((data) => {
    if (onEntryAllowed) {
      onEntryAllowed(); // 부모 컴포넌트에 알림
    }
  }, [onEntryAllowed]);

  return (
    <div className="waiting-room-modal-overlay"> {/* 풀스크린 오버레이 */}
      <div className="waiting-room-modal">      {/* 모달 */}
        {/* 대기열 UI */}
      </div>
    </div>
  );
}
```

### EventDetail.js (핵심 부분)

```javascript
function EventDetail() {
  const [showQueueModal, setShowQueueModal] = useState(false);

  // 페이지 로드 시 대기열 체크
  const checkQueueStatus = async () => {
    const response = await api.post(`/api/queue/check/${id}`);

    if (response.data.queued) {
      setShowQueueModal(true); // 모달 표시!
    }
  };

  // 입장 허용 시
  const handleQueueEntryAllowed = () => {
    setShowQueueModal(false); // 모달 닫기
    fetchEventDetail();       // 최신 데이터 로드
  };

  return (
    <div>
      {/* 이벤트 페이지 내용 */}

      {/* 대기열 모달 (조건부 렌더링) */}
      {showQueueModal && (
        <WaitingRoomModal
          eventId={id}
          onEntryAllowed={handleQueueEntryAllowed}
          onClose={() => navigate('/')}
        />
      )}
    </div>
  );
}
```

---

## CSS 하이라이트

### 풀스크린 오버레이

```css
.waiting-room-modal-overlay {
  position: fixed;         /* 화면 고정 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);  /* 반투명 검은 배경 */
  backdrop-filter: blur(10px);       /* 뒷배경 블러 */
  z-index: 9999;                     /* 최상위 레이어 */
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 모달 애니메이션

```css
.waiting-room-modal {
  animation: slideUp 0.4s ease-out;  /* 아래에서 위로 슬라이드 */
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 테스트 방법

### 1. 대기열 임계값 낮추기 (테스트용)

```javascript
// backend/src/services/queue-manager.js
async getThreshold(eventId) {
  return 1; // 테스트용: 1명만 입장 가능
}
```

### 2. 테스트 시나리오

```bash
# 1. 브라우저 2개 열기
# Chrome: http://localhost:3000/events/이벤트ID
# Firefox: http://localhost:3000/events/이벤트ID

# 2. Chrome으로 먼저 로그인 후 접속
# → 정상 입장 (대기열 없음) ✅

# 3. Firefox로 로그인 후 같은 이벤트 접속
# → 이벤트 페이지 위에 대기열 모달 팝업! ✅

# 4. Chrome에서 페이지 나가기
# → Firefox 모달이 자동으로 닫힘 (입장 허용됨) ✅
```

### 3. 새로고침 테스트

```bash
# 1. 대기열 모달 표시 중
# 2. F5 (새로고침)
# 3. 대기열 모달 다시 표시됨 ✅
#    (순번 유지됨!)
```

---

## 장점

### ✅ 사용자 경험
- **페이지 이동 없음**: 같은 페이지에서 모달만 표시
- **맥락 유지**: 어느 이벤트 대기 중인지 명확
- **부드러운 전환**: 애니메이션으로 자연스러운 UX

### ✅ 기술적 이점
- **상태 관리 간단**: 단순히 `showQueueModal` 플래그만 관리
- **컴포넌트 재사용**: 어디서든 모달 사용 가능
- **URL 변경 없음**: 브라우저 히스토리 깔끔

### ✅ 실제 사이트와 동일
- 인터파크, 티켓링크 등 실제 티켓팅 사이트 방식
- 풀스크린 오버레이로 집중력 유지

---

## 다음 개선 사항 (선택)

### 1. 브라우저 알림
```javascript
// 입장 허용 시 브라우저 알림
if (Notification.permission === 'granted') {
  new Notification('티켓팅 입장 허용', {
    body: '지금 바로 티켓을 구매하세요!',
    icon: '/logo.png'
  });
}
```

### 2. 사운드 알림
```javascript
// 입장 허용 시 사운드 재생
const audio = new Audio('/notification.mp3');
audio.play();
```

### 3. 모달 애니메이션 개선
```css
/* 입장 허용 시 축하 애니메이션 */
.modal-entry-allowed {
  animation: celebrate 0.5s ease-out;
}

@keyframes celebrate {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

---

## 요약

✅ **구현 완료**:
- 대기열 모달 컴포넌트 (`WaitingRoomModal.js`)
- EventDetail에 모달 통합
- 실시간 WebSocket 연동
- 새로고침 시 순번 유지

🎯 **사용자 경험**:
- 이벤트 페이지 위에 풀스크린 모달
- 실시간 순번 업데이트
- 입장 허용 시 자동으로 모달 닫힘
- 페이지 이동 없이 부드러운 전환

🚀 **실제 티켓팅 사이트와 동일한 방식!**
