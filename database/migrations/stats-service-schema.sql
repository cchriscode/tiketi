-- Stats Service Schema Migration
-- 통계 및 대시보드를 위한 스키마

-- 1. Create schema
CREATE SCHEMA IF NOT EXISTS stats_schema;

-- 2. Enable UUID extension (in public schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Set search path
SET search_path TO stats_schema, public;

-- 4. Daily Statistics Cache Table (일별 통계 캐시)
-- 매일 자정에 전날 통계를 계산해서 저장
CREATE TABLE IF NOT EXISTS stats_schema.daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,

    -- 예약 통계
    total_reservations INTEGER DEFAULT 0,
    confirmed_reservations INTEGER DEFAULT 0,
    cancelled_reservations INTEGER DEFAULT 0,

    -- 매출 통계
    total_revenue INTEGER DEFAULT 0,
    payment_revenue INTEGER DEFAULT 0,  -- 실제 결제된 금액

    -- 사용자 통계
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,

    -- 이벤트 통계
    new_events INTEGER DEFAULT 0,
    active_events INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Event Statistics Cache Table (이벤트별 통계 캐시)
CREATE TABLE IF NOT EXISTS stats_schema.event_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL UNIQUE,  -- ticket_schema.events 참조

    -- 좌석 통계
    total_seats INTEGER DEFAULT 0,
    reserved_seats INTEGER DEFAULT 0,
    available_seats INTEGER DEFAULT 0,

    -- 예약 통계
    total_reservations INTEGER DEFAULT 0,
    confirmed_reservations INTEGER DEFAULT 0,

    -- 매출 통계
    total_revenue INTEGER DEFAULT 0,
    average_ticket_price INTEGER DEFAULT 0,

    -- 인기도
    view_count INTEGER DEFAULT 0,

    last_calculated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON stats_schema.daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_event_stats_event_id ON stats_schema.event_stats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_stats_revenue ON stats_schema.event_stats(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_event_stats_reservations ON stats_schema.event_stats(total_reservations DESC);

-- 7. Updated_at trigger function
CREATE OR REPLACE FUNCTION stats_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Triggers
CREATE TRIGGER update_daily_stats_updated_at
    BEFORE UPDATE ON stats_schema.daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION stats_schema.update_updated_at_column();

CREATE TRIGGER update_event_stats_updated_at
    BEFORE UPDATE ON stats_schema.event_stats
    FOR EACH ROW
    EXECUTE FUNCTION stats_schema.update_updated_at_column();

-- 9. Permissions
GRANT USAGE ON SCHEMA stats_schema TO tiketi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA stats_schema TO tiketi_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA stats_schema TO tiketi_user;

-- 10. Initial data (선택사항 - 현재 날짜 통계 초기화)
INSERT INTO stats_schema.daily_stats (date)
VALUES (CURRENT_DATE)
ON CONFLICT (date) DO NOTHING;
