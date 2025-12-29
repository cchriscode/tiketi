-- ========================================
-- Ticket Service Database Schema
-- ========================================
-- 기존 tiketi DB에서 ticket_schema로 분리
-- 이벤트, 티켓, 좌석, 예약 관련 테이블 분리

-- 1. Schema 생성
CREATE SCHEMA IF NOT EXISTS ticket_schema;

-- 2. 확장 기능 (이미 있으면 스킵) - in public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Set search path
SET search_path TO ticket_schema, public;

-- 4. Seat Layouts 테이블 (좌석 레이아웃 템플릿)
CREATE TABLE IF NOT EXISTS ticket_schema.seat_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    total_seats INTEGER NOT NULL,
    layout_config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Events 테이블
CREATE TABLE IF NOT EXISTS ticket_schema.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    venue VARCHAR(255) NOT NULL,
    address TEXT,
    event_date TIMESTAMP NOT NULL,
    sale_start_date TIMESTAMP NOT NULL,
    sale_end_date TIMESTAMP NOT NULL,
    poster_image_url TEXT,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'on_sale', 'sold_out', 'ended', 'cancelled')),
    seat_layout_id UUID REFERENCES ticket_schema.seat_layouts(id),
    artist_name VARCHAR(255),
    pre_scaled BOOLEAN DEFAULT FALSE,
    created_by UUID, -- FK to auth_schema.users, but not enforced across schemas
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Ticket Types 테이블 (등급별 티켓: VIP, R석, S석 등)
CREATE TABLE IF NOT EXISTS ticket_schema.ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES ticket_schema.events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Seats 테이블 (개별 좌석)
CREATE TABLE IF NOT EXISTS ticket_schema.seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES ticket_schema.events(id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL,
    row_number INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    seat_label VARCHAR(20) NOT NULL,
    price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'locked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, section, row_number, seat_number)
);

-- 8. Reservations 테이블 (예매)
CREATE TABLE IF NOT EXISTS ticket_schema.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- FK to auth_schema.users, but not enforced across schemas
    event_id UUID REFERENCES ticket_schema.events(id) ON DELETE SET NULL,
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Reservation Items 테이블 (예매 상세 - 티켓별 수량)
CREATE TABLE IF NOT EXISTS ticket_schema.reservation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES ticket_schema.reservations(id) ON DELETE CASCADE,
    ticket_type_id UUID REFERENCES ticket_schema.ticket_types(id),
    seat_id UUID REFERENCES ticket_schema.seats(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Keyword Mappings 테이블 (한글-영어 검색 매핑)
CREATE TABLE IF NOT EXISTS ticket_schema.keyword_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    korean VARCHAR(255) NOT NULL,
    english VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'artist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(korean, english)
);

-- 11. News 테이블 (TIKETI 뉴스)
CREATE TABLE IF NOT EXISTS ticket_schema.news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    author_id UUID, -- FK to auth_schema.users, but not enforced across schemas
    views INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ticket_seat_layouts_name ON ticket_schema.seat_layouts(name);
CREATE INDEX IF NOT EXISTS idx_ticket_events_event_date ON ticket_schema.events(event_date);
CREATE INDEX IF NOT EXISTS idx_ticket_events_status ON ticket_schema.events(status);
CREATE INDEX IF NOT EXISTS idx_ticket_events_seat_layout ON ticket_schema.events(seat_layout_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_artist ON ticket_schema.events(artist_name);
CREATE INDEX IF NOT EXISTS idx_ticket_events_sale_start ON ticket_schema.events(sale_start_date);
CREATE INDEX IF NOT EXISTS idx_ticket_seats_event ON ticket_schema.seats(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_seats_status ON ticket_schema.seats(event_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_seats_section ON ticket_schema.seats(event_id, section);
CREATE INDEX IF NOT EXISTS idx_ticket_reservations_user_id ON ticket_schema.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reservations_event_id ON ticket_schema.reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reservations_status ON ticket_schema.reservations(status);
CREATE INDEX IF NOT EXISTS idx_ticket_reservations_expires_at ON ticket_schema.reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ticket_ticket_types_event_id ON ticket_schema.ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reservation_items_seat ON ticket_schema.reservation_items(seat_id);
CREATE INDEX IF NOT EXISTS idx_ticket_news_pinned ON ticket_schema.news(is_pinned, created_at DESC);

-- 12. Updated_at 트리거 함수 (모든 테이블에 적용)
CREATE OR REPLACE FUNCTION ticket_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Updated_at 트리거 적용
DROP TRIGGER IF EXISTS update_seat_layouts_updated_at ON ticket_schema.seat_layouts;
CREATE TRIGGER update_seat_layouts_updated_at
    BEFORE UPDATE ON ticket_schema.seat_layouts
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON ticket_schema.events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON ticket_schema.events
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ticket_types_updated_at ON ticket_schema.ticket_types;
CREATE TRIGGER update_ticket_types_updated_at
    BEFORE UPDATE ON ticket_schema.ticket_types
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

DROP TRIGGER IF EXISTS update_seats_updated_at ON ticket_schema.seats;
CREATE TRIGGER update_seats_updated_at
    BEFORE UPDATE ON ticket_schema.seats
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservations_updated_at ON ticket_schema.reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON ticket_schema.reservations
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_updated_at ON ticket_schema.news;
CREATE TRIGGER update_news_updated_at
    BEFORE UPDATE ON ticket_schema.news
    FOR EACH ROW
    EXECUTE FUNCTION ticket_schema.update_updated_at_column();

-- ========================================
-- 데이터 마이그레이션 (기존 public → ticket_schema)
-- ========================================
-- 주의: 기존 테이블이 있다면 데이터 복사
-- 실행 전 백업 필수!

DO $$
BEGIN
    -- 1. seat_layouts 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'seat_layouts')
    AND NOT EXISTS (SELECT FROM ticket_schema.seat_layouts LIMIT 1)
    THEN
        INSERT INTO ticket_schema.seat_layouts (id, name, description, total_seats, layout_config, created_at, updated_at)
        SELECT id, name, description, total_seats, layout_config, created_at, updated_at
        FROM public.seat_layouts;

        RAISE NOTICE '✅ Migrated % seat layouts',
                     (SELECT COUNT(*) FROM ticket_schema.seat_layouts);
    END IF;

    -- 2. events 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'events')
    AND NOT EXISTS (SELECT FROM ticket_schema.events LIMIT 1)
    THEN
        INSERT INTO ticket_schema.events (id, title, description, venue, address, event_date, sale_start_date, sale_end_date,
                                          poster_image_url, status, seat_layout_id, artist_name, pre_scaled, created_by, created_at, updated_at)
        SELECT id, title, description, venue, address, event_date, sale_start_date, sale_end_date,
               poster_image_url, status, seat_layout_id, artist_name, pre_scaled, created_by, created_at, updated_at
        FROM public.events;

        RAISE NOTICE '✅ Migrated % events',
                     (SELECT COUNT(*) FROM ticket_schema.events);
    END IF;

    -- 3. ticket_types 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'ticket_types')
    AND NOT EXISTS (SELECT FROM ticket_schema.ticket_types LIMIT 1)
    THEN
        INSERT INTO ticket_schema.ticket_types (id, event_id, name, price, total_quantity, available_quantity, description, created_at, updated_at)
        SELECT id, event_id, name, price, total_quantity, available_quantity, description, created_at, updated_at
        FROM public.ticket_types;

        RAISE NOTICE '✅ Migrated % ticket types',
                     (SELECT COUNT(*) FROM ticket_schema.ticket_types);
    END IF;

    -- 4. seats 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'seats')
    AND NOT EXISTS (SELECT FROM ticket_schema.seats LIMIT 1)
    THEN
        INSERT INTO ticket_schema.seats (id, event_id, section, row_number, seat_number, seat_label, price, status, created_at, updated_at)
        SELECT id, event_id, section, row_number, seat_number, seat_label, price, status, created_at, updated_at
        FROM public.seats;

        RAISE NOTICE '✅ Migrated % seats',
                     (SELECT COUNT(*) FROM ticket_schema.seats);
    END IF;

    -- 5. reservations 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'reservations')
    AND NOT EXISTS (SELECT FROM ticket_schema.reservations LIMIT 1)
    THEN
        INSERT INTO ticket_schema.reservations (id, user_id, event_id, reservation_number, total_amount, status,
                                                payment_method, payment_status, expires_at, created_at, updated_at)
        SELECT id, user_id, event_id, reservation_number, total_amount, status,
               payment_method, payment_status, expires_at, created_at, updated_at
        FROM public.reservations;

        RAISE NOTICE '✅ Migrated % reservations',
                     (SELECT COUNT(*) FROM ticket_schema.reservations);
    END IF;

    -- 6. reservation_items 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'reservation_items')
    AND NOT EXISTS (SELECT FROM ticket_schema.reservation_items LIMIT 1)
    THEN
        INSERT INTO ticket_schema.reservation_items (id, reservation_id, ticket_type_id, seat_id, quantity, unit_price, subtotal, created_at)
        SELECT id, reservation_id, ticket_type_id, seat_id, quantity, unit_price, subtotal, created_at
        FROM public.reservation_items;

        RAISE NOTICE '✅ Migrated % reservation items',
                     (SELECT COUNT(*) FROM ticket_schema.reservation_items);
    END IF;

    -- 7. keyword_mappings 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'keyword_mappings')
    AND NOT EXISTS (SELECT FROM ticket_schema.keyword_mappings LIMIT 1)
    THEN
        INSERT INTO ticket_schema.keyword_mappings (id, korean, english, entity_type, created_at)
        SELECT id, korean, english, entity_type, created_at
        FROM public.keyword_mappings;

        RAISE NOTICE '✅ Migrated % keyword mappings',
                     (SELECT COUNT(*) FROM ticket_schema.keyword_mappings);
    END IF;

    -- 8. news 마이그레이션
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'news')
    AND NOT EXISTS (SELECT FROM ticket_schema.news LIMIT 1)
    THEN
        INSERT INTO ticket_schema.news (id, title, content, author, author_id, views, is_pinned, created_at, updated_at)
        SELECT id, title, content, author, author_id, views, is_pinned, created_at, updated_at
        FROM public.news;

        RAISE NOTICE '✅ Migrated % news items',
                     (SELECT COUNT(*) FROM ticket_schema.news);
    END IF;

END $$;

-- ========================================
-- 권한 설정
-- ========================================
-- Ticket Service에 ticket_schema 접근 권한 부여
GRANT USAGE ON SCHEMA ticket_schema TO tiketi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ticket_schema TO tiketi_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ticket_schema TO tiketi_user;

-- ========================================
-- 검증 쿼리
-- ========================================
-- 테이블 및 데이터 확인
SELECT 'ticket_schema.seat_layouts' as table_name, COUNT(*) as row_count FROM ticket_schema.seat_layouts
UNION ALL
SELECT 'ticket_schema.events', COUNT(*) FROM ticket_schema.events
UNION ALL
SELECT 'ticket_schema.ticket_types', COUNT(*) FROM ticket_schema.ticket_types
UNION ALL
SELECT 'ticket_schema.seats', COUNT(*) FROM ticket_schema.seats
UNION ALL
SELECT 'ticket_schema.reservations', COUNT(*) FROM ticket_schema.reservations
UNION ALL
SELECT 'ticket_schema.reservation_items', COUNT(*) FROM ticket_schema.reservation_items
UNION ALL
SELECT 'ticket_schema.keyword_mappings', COUNT(*) FROM ticket_schema.keyword_mappings
UNION ALL
SELECT 'ticket_schema.news', COUNT(*) FROM ticket_schema.news;

-- 스키마 정보
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'ticket_schema'
ORDER BY tablename;

-- 인덱스 확인
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'ticket_schema'
ORDER BY tablename, indexname;
