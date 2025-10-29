-- Fix Event Statuses Based on Sale Dates
-- 이벤트 상태를 예매 시간 기준으로 올바르게 수정하는 스크립트

-- 1. upcoming → on_sale (판매 시작 시간이 되었지만 상태가 upcoming인 이벤트)
UPDATE events
SET status = 'on_sale', updated_at = NOW()
WHERE status = 'upcoming'
  AND sale_start_date <= NOW()
  AND sale_end_date > NOW()
  AND status != 'cancelled';

-- 2. upcoming/on_sale → ended (판매 종료 시간이 지났지만 상태가 upcoming/on_sale인 이벤트)
UPDATE events
SET status = 'ended', updated_at = NOW()
WHERE status IN ('upcoming', 'on_sale')
  AND sale_end_date <= NOW()
  AND status != 'cancelled';

-- 3. 모든 이벤트 → ended (공연 날짜가 지났지만 상태가 ended가 아닌 이벤트)
UPDATE events
SET status = 'ended', updated_at = NOW()
WHERE event_date < NOW()
  AND status NOT IN ('ended', 'cancelled');

-- 결과 확인
SELECT
  id,
  title,
  status,
  sale_start_date,
  sale_end_date,
  event_date,
  CASE
    WHEN NOW() < sale_start_date THEN 'upcoming (올바름)'
    WHEN NOW() >= sale_start_date AND NOW() < sale_end_date THEN 'on_sale (올바름)'
    WHEN NOW() >= sale_end_date THEN 'ended (올바름)'
    ELSE 'unknown'
  END as expected_status
FROM events
WHERE status != 'cancelled'
ORDER BY sale_start_date ASC;
