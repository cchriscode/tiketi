-- Payment Service Schema Migration
-- TossPayments API 연동을 위한 결제 스키마

-- 1. Create schema
CREATE SCHEMA IF NOT EXISTS payment_schema;

-- 2. Enable UUID extension (in public schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Set search path
SET search_path TO payment_schema, public;

-- 4. Create payments table
CREATE TABLE IF NOT EXISTS payment_schema.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 연관 정보
    reservation_id UUID NOT NULL,  -- ticket_schema.reservations 참조
    user_id UUID NOT NULL,         -- auth_schema.users 참조
    event_id UUID,                 -- ticket_schema.events 참조 (캐시)

    -- TossPayments 정보
    order_id VARCHAR(64) UNIQUE NOT NULL,  -- 주문 ID (6-64자)
    payment_key VARCHAR(200) UNIQUE,       -- TossPayments 결제 키

    -- 결제 상세
    amount INTEGER NOT NULL,               -- 결제 금액
    method VARCHAR(50),                    -- 결제 수단 (카드, 가상계좌 등)
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, confirmed, failed, cancelled, refunded

    -- TossPayments 응답 데이터
    toss_order_name VARCHAR(255),          -- 주문명
    toss_status VARCHAR(50),               -- TossPayments 결제 상태
    toss_requested_at TIMESTAMP,           -- 결제 요청 시각
    toss_approved_at TIMESTAMP,            -- 결제 승인 시각
    toss_receipt_url TEXT,                 -- 영수증 URL
    toss_checkout_url TEXT,                -- 결제창 URL
    toss_response JSONB,                   -- 전체 TossPayments 응답

    -- 환불 정보
    refund_amount INTEGER DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create payment_logs table (API 요청/응답 로그)
CREATE TABLE IF NOT EXISTS payment_schema.payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payment_schema.payments(id) ON DELETE CASCADE,

    -- API 정보
    action VARCHAR(50) NOT NULL,           -- confirm, cancel, refund 등
    endpoint VARCHAR(255),                 -- API 엔드포인트
    method VARCHAR(10),                    -- HTTP method

    -- 요청/응답
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,

    -- 에러 정보
    error_code VARCHAR(50),
    error_message TEXT,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_reservation ON payment_schema.payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_schema.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_id ON payment_schema.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_payment_key ON payment_schema.payments(payment_key);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_schema.payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON payment_schema.payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_schema.payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_action ON payment_schema.payment_logs(action);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_schema.payment_logs(created_at DESC);

-- 7. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION payment_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payment_schema.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payment_schema.payments
    FOR EACH ROW
    EXECUTE FUNCTION payment_schema.update_updated_at_column();

-- 9. Grant permissions
GRANT USAGE ON SCHEMA payment_schema TO tiketi_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA payment_schema TO tiketi_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA payment_schema TO tiketi_user;

-- 10. Verification queries
SELECT 'Payment Service Schema Migration Complete!' as status;

-- Check tables
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'payment_schema'
ORDER BY tablename;

-- Check indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'payment_schema'
ORDER BY tablename, indexname;
