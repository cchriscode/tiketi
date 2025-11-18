-- Database initialization script for Tiketi

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm extension for fuzzy search and similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seat Layouts (좌석 레이아웃 템플릿)
CREATE TABLE seat_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    total_seats INTEGER NOT NULL,
    layout_config JSONB NOT NULL, -- JSON structure defining sections, rows, seats
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
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
    seat_layout_id UUID REFERENCES seat_layouts(id),
    artist_name VARCHAR(255),
    pre_scaled BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket types (등급별 티켓: VIP, R석, S석 등)
CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'VIP석', 'R석', 'S석', '일반석'
    price INTEGER NOT NULL,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seats Table (개별 좌석)
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    section VARCHAR(50) NOT NULL,     -- 구역: 'VIP', 'R석', 'S석'
    row_number INTEGER NOT NULL,      -- 행 번호
    seat_number INTEGER NOT NULL,     -- 좌석 번호
    seat_label VARCHAR(20) NOT NULL,  -- 표시용 라벨: 'VIP-1-5'
    
    price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'locked')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique seat per event
    UNIQUE(event_id, section, row_number, seat_number)
);

-- Reservations (예매)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id),
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservation items (예매 상세 - 티켓별 수량)
CREATE TABLE reservation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    ticket_type_id UUID REFERENCES ticket_types(id),
    seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Korean-English keyword mapping table for cross-language search
CREATE TABLE keyword_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    korean VARCHAR(255) NOT NULL,
    english VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'artist', -- 'artist', 'venue', 'general'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(korean, english)
);

-- News table for TIKETI News feature
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_seat_layouts_name ON seat_layouts(name);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_seat_layout ON events(seat_layout_id);
CREATE INDEX idx_events_artist ON events(artist_name);
CREATE INDEX idx_seats_event ON seats(event_id);
CREATE INDEX idx_seats_status ON seats(event_id, status);
CREATE INDEX idx_seats_section ON seats(event_id, section);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_event_id ON reservations(event_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX idx_reservation_items_seat ON reservation_items(seat_id);

-- GIN index for full-text search on events
-- Combines title, artist_name, venue, and address for comprehensive search
CREATE INDEX idx_events_search ON events USING GIN (
  (COALESCE(title, '') || ' ' || COALESCE(artist_name, '') || ' ' || COALESCE(venue, '') || ' ' || COALESCE(address, '')) gin_trgm_ops
);

-- Indexes for keyword mappings (for fast cross-language search)
CREATE INDEX idx_keyword_mappings_korean ON keyword_mappings USING GIN (korean gin_trgm_ops);
CREATE INDEX idx_keyword_mappings_english ON keyword_mappings USING GIN (english gin_trgm_ops);

-- Indexes for news table
CREATE INDEX idx_news_created_at ON news(created_at DESC);
CREATE INDEX idx_news_author_id ON news(author_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seat_layouts_updated_at BEFORE UPDATE ON seat_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seats_updated_at BEFORE UPDATE ON seats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON ticket_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Admin account (admin@tiketi.gg / admin123) is automatically created by backend on startup

-- Insert sample seat layouts
INSERT INTO seat_layouts (name, description, total_seats, layout_config) VALUES
('small_theater', 'Small theater with 300 seats', 265, 
 '{"sections": [{"name": "VIP", "rows": 3, "seatsPerRow": 10, "price": 150000, "startRow": 1}, {"name": "R", "rows": 5, "seatsPerRow": 15, "price": 100000, "startRow": 4}, {"name": "S", "rows": 8, "seatsPerRow": 20, "price": 70000, "startRow": 9}]}'::jsonb),
('large_theater', 'Large theater with 1500 seats', 1250,
 '{"sections": [{"name": "VIP", "rows": 5, "seatsPerRow": 20, "price": 200000, "startRow": 1}, {"name": "R", "rows": 10, "seatsPerRow": 30, "price": 150000, "startRow": 6}, {"name": "S", "rows": 15, "seatsPerRow": 30, "price": 100000, "startRow": 16}, {"name": "A", "rows": 10, "seatsPerRow": 40, "price": 70000, "startRow": 31}]}'::jsonb),
('sports_stadium', 'Sports stadium with 5000 seats', 4900,
 '{"sections": [{"name": "Floor1", "rows": 20, "seatsPerRow": 50, "price": 80000, "startRow": 1}, {"name": "Floor2", "rows": 30, "seatsPerRow": 60, "price": 50000, "startRow": 21}, {"name": "Floor3", "rows": 30, "seatsPerRow": 70, "price": 30000, "startRow": 51}]}'::jsonb);

-- Insert sample events (with seat layouts)
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id) VALUES
('2024 콘서트 투어 in 서울', '2024년 최고의 콘서트! 놓치지 마세요.', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', '2024-12-31 19:00:00', '2024-11-01 10:00:00', '2024-12-30 23:59:59', '/images/concert1.jpg', 'on_sale', (SELECT id FROM seat_layouts WHERE name = 'small_theater')),
('뮤지컬 오페라의 유령', '세계적인 뮤지컬 오페라의 유령', '샤롯데씨어터', '서울특별시 송파구 올림픽로 240', '2025-01-15 19:30:00', '2024-11-10 10:00:00', '2025-01-14 23:59:59', '/images/musical1.jpg', 'on_sale', (SELECT id FROM seat_layouts WHERE name = 'large_theater')),
('스포츠 경기 - 농구 결승전', '2024-2025 시즌 농구 결승전', '잠실실내체육관', '서울특별시 송파구 올림픽로 25', '2024-12-20 18:00:00', '2024-11-05 10:00:00', '2024-12-19 23:59:59', '/images/sports1.jpg', 'on_sale', (SELECT id FROM seat_layouts WHERE name = 'sports_stadium'));

-- Insert sample ticket types for first event
INSERT INTO ticket_types (event_id, name, price, total_quantity, available_quantity, description) VALUES
((SELECT id FROM events WHERE title = '2024 콘서트 투어 in 서울'), 'VIP석', 150000, 100, 95, '최고의 시야와 사운드를 즐기실 수 있습니다'),
((SELECT id FROM events WHERE title = '2024 콘서트 투어 in 서울'), 'R석', 100000, 200, 180, '무대를 가까이서 볼 수 있는 좌석'),
((SELECT id FROM events WHERE title = '2024 콘서트 투어 in 서울'), 'S석', 70000, 300, 250, '합리적인 가격의 좌석'),
((SELECT id FROM events WHERE title = '2024 콘서트 투어 in 서울'), '일반석', 50000, 400, 320, '스탠딩 또는 자유석');

-- Insert sample ticket types for second event
INSERT INTO ticket_types (event_id, name, price, total_quantity, available_quantity, description) VALUES
((SELECT id FROM events WHERE title = '뮤지컬 오페라의 유령'), 'VIP석', 180000, 80, 75, 'VIP 라운지 이용 가능'),
((SELECT id FROM events WHERE title = '뮤지컬 오페라의 유령'), 'R석', 120000, 150, 140, '최상의 관람석'),
((SELECT id FROM events WHERE title = '뮤지컬 오페라의 유령'), 'S석', 80000, 200, 185, '일반 관람석');

-- Insert sample ticket types for third event
INSERT INTO ticket_types (event_id, name, price, total_quantity, available_quantity, description) VALUES
((SELECT id FROM events WHERE title = '스포츠 경기 - 농구 결승전'), '코트사이드', 200000, 50, 48, '선수들을 가장 가까이서'),
((SELECT id FROM events WHERE title = '스포츠 경기 - 농구 결승전'), '1층석', 80000, 300, 280, '1층 일반석'),
((SELECT id FROM events WHERE title = '스포츠 경기 - 농구 결승전'), '2층석', 50000, 500, 450, '2층 일반석');

-- 테스트용 콘서트 22개 추가 (매일 오전 9시부터 오후 6시까지 판매)
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('10CM HOTEL ROOM TOUR 2024', '10CM의 감성 어쿠스틱 공연', '블루스퀘어 마스터카드홀', '서울특별시 용산구 이태원로 294', CURRENT_DATE + INTERVAL '20 days' + TIME '19:00', CURRENT_DATE + TIME '09:00', CURRENT_DATE + TIME '18:00', '/images/10cm.jpg', 'on_sale', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), '10CM'),
('싸이 흠뻑쇼 2024', '싸이의 신나는 여름 콘서트', '잠실종합운동장 주경기장', '서울특별시 송파구 올림픽로 25', CURRENT_DATE + INTERVAL '25 days' + TIME '19:00', CURRENT_DATE + TIME '09:00', CURRENT_DATE + TIME '18:00', '/images/psy.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'sports_stadium'), '싸이'),
('아이유 2024 콘서트 - The Golden Hour', '아이유의 감성 가득한 콘서트', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '30 days' + TIME '19:00', CURRENT_DATE + INTERVAL '1 day' + TIME '09:00', CURRENT_DATE + INTERVAL '1 day' + TIME '18:00', '/images/iu.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), '아이유'),
('BTS WORLD TOUR 2024', 'BTS의 화려한 월드투어 서울 공연', '잠실종합운동장 주경기장', '서울특별시 송파구 올림픽로 25', CURRENT_DATE + INTERVAL '35 days' + TIME '19:00', CURRENT_DATE + INTERVAL '2 days' + TIME '09:00', CURRENT_DATE + INTERVAL '2 days' + TIME '18:00', '/images/bts.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'sports_stadium'), 'BTS'),
('BLACKPINK BORN PINK TOUR', 'BLACKPINK의 강렬한 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '40 days' + TIME '19:00', CURRENT_DATE + INTERVAL '3 days' + TIME '09:00', CURRENT_DATE + INTERVAL '3 days' + TIME '18:00', '/images/blackpink.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'BLACKPINK'),
('임영웅 - IM HERO TOUR 2024', '임영웅의 감동 콘서트', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '42 days' + TIME '19:00', CURRENT_DATE + INTERVAL '4 days' + TIME '09:00', CURRENT_DATE + INTERVAL '4 days' + TIME '18:00', '/images/limyoungwoong.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), '임영웅'),
('NewJeans SUPER SHY TOUR', '뉴진스의 청량한 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '45 days' + TIME '19:00', CURRENT_DATE + INTERVAL '5 days' + TIME '09:00', CURRENT_DATE + INTERVAL '5 days' + TIME '18:00', '/images/newjeans.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'NewJeans'),
('SEVENTEEN FOLLOW TOUR', '세븐틴의 완벽한 퍼포먼스', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '48 days' + TIME '19:00', CURRENT_DATE + INTERVAL '6 days' + TIME '09:00', CURRENT_DATE + INTERVAL '6 days' + TIME '18:00', '/images/seventeen.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'SEVENTEEN'),
('aespa SYNK TOUR 2024', '에스파의 미래형 콘서트', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '50 days' + TIME '19:00', CURRENT_DATE + INTERVAL '7 days' + TIME '09:00', CURRENT_DATE + INTERVAL '7 days' + TIME '18:00', '/images/aespa.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'aespa'),
('NCT DREAM THE DREAM SHOW 3', 'NCT DREAM의 환상적인 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '52 days' + TIME '19:00', CURRENT_DATE + INTERVAL '8 days' + TIME '09:00', CURRENT_DATE + INTERVAL '8 days' + TIME '18:00', '/images/nctdream.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'NCT DREAM'),
('LE SSERAFIM FLAME RISES', '르세라핌의 카리스마 넘치는 공연', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '55 days' + TIME '19:00', CURRENT_DATE + INTERVAL '9 days' + TIME '09:00', CURRENT_DATE + INTERVAL '9 days' + TIME '18:00', '/images/lesserafim.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'LE SSERAFIM'),
('IVE THE PROM QUEENS TOUR', '아이브의 화려한 무대', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '58 days' + TIME '19:00', CURRENT_DATE + INTERVAL '10 days' + TIME '09:00', CURRENT_DATE + INTERVAL '10 days' + TIME '18:00', '/images/ive.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'IVE'),
('Stray Kids 5-STAR TOUR', '스트레이 키즈의 폭발적인 에너지', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '60 days' + TIME '19:00', CURRENT_DATE + INTERVAL '11 days' + TIME '09:00', CURRENT_DATE + INTERVAL '11 days' + TIME '18:00', '/images/straykids.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'Stray Kids'),
('TWICE READY TO BE TOUR', '트와이스의 감성 공연', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '62 days' + TIME '19:00', CURRENT_DATE + INTERVAL '12 days' + TIME '09:00', CURRENT_DATE + INTERVAL '12 days' + TIME '18:00', '/images/twice.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'TWICE'),
('태양 WHITE NIGHT TOUR', '태양의 감성 가득한 라이브', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '65 days' + TIME '19:00', CURRENT_DATE + INTERVAL '13 days' + TIME '09:00', CURRENT_DATE + INTERVAL '13 days' + TIME '18:00', '/images/taeyang.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), '태양'),
('G-DRAGON ACT III: MOTTE', 'GD의 독보적인 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '68 days' + TIME '19:00', CURRENT_DATE + INTERVAL '14 days' + TIME '09:00', CURRENT_DATE + INTERVAL '14 days' + TIME '18:00', '/images/gdragon.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'G-DRAGON'),
('EXO PLANET 2024', '엑소의 완벽한 퍼포먼스', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '70 days' + TIME '19:00', CURRENT_DATE + INTERVAL '15 days' + TIME '09:00', CURRENT_DATE + INTERVAL '15 days' + TIME '18:00', '/images/exo.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'EXO'),
('Red Velvet FEEL MY RHYTHM', '레드벨벳의 매력적인 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '72 days' + TIME '19:00', CURRENT_DATE + INTERVAL '16 days' + TIME '09:00', CURRENT_DATE + INTERVAL '16 days' + TIME '18:00', '/images/redvelvet.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'Red Velvet'),
('TXT ACT: SWEET MIRAGE', '투모로우바이투게더의 청춘 콘서트', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '75 days' + TIME '19:00', CURRENT_DATE + INTERVAL '17 days' + TIME '09:00', CURRENT_DATE + INTERVAL '17 days' + TIME '18:00', '/images/txt.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'TOMORROW X TOGETHER'),
('ENHYPEN FATE TOUR', '엔하이픈의 강렬한 퍼포먼스', '고척스카이돔', '서울특별시 구로구 경인로 430', CURRENT_DATE + INTERVAL '78 days' + TIME '19:00', CURRENT_DATE + INTERVAL '18 days' + TIME '09:00', CURRENT_DATE + INTERVAL '18 days' + TIME '18:00', '/images/enhypen.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'ENHYPEN'),
('ITZY CHECKMATE TOUR', '있지의 파워풀한 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', CURRENT_DATE + INTERVAL '80 days' + TIME '19:00', CURRENT_DATE + INTERVAL '19 days' + TIME '09:00', CURRENT_DATE + INTERVAL '19 days' + TIME '18:00', '/images/itzy.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'ITZY'),
('ZICO KING OF THE ZUNGLE', '지코의 힙합 라이브', 'YES24 라이브홀', '서울특별시 광진구 광나루로 56길 85', CURRENT_DATE + INTERVAL '82 days' + TIME '19:00', CURRENT_DATE + INTERVAL '20 days' + TIME '09:00', CURRENT_DATE + INTERVAL '20 days' + TIME '18:00', '/images/zico.jpg', 'upcoming', (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'ZICO');

-- Insert Korean-English keyword mappings for cross-language search
INSERT INTO keyword_mappings (korean, english, entity_type) VALUES
-- Artists
('싸이', 'PSY', 'artist'),
('아이유', 'IU', 'artist'),
('방탄소년단', 'BTS', 'artist'),
('블랙핑크', 'BLACKPINK', 'artist'),
('임영웅', 'Lim Young Woong', 'artist'),
('뉴진스', 'NewJeans', 'artist'),
('세븐틴', 'SEVENTEEN', 'artist'),
('에스파', 'aespa', 'artist'),
('엔시티 드림', 'NCT DREAM', 'artist'),
('르세라핌', 'LE SSERAFIM', 'artist'),
('아이브', 'IVE', 'artist'),
('스트레이 키즈', 'Stray Kids', 'artist'),
('트와이스', 'TWICE', 'artist'),
('태양', 'TAEYANG', 'artist'),
('태양', 'SOL', 'artist'),
('지드래곤', 'G-DRAGON', 'artist'),
('지드래곤', 'GD', 'artist'),
('엑소', 'EXO', 'artist'),
('레드벨벳', 'Red Velvet', 'artist'),
('투모로우바이투게더', 'TOMORROW X TOGETHER', 'artist'),
('투바투', 'TXT', 'artist'),
('엔하이픈', 'ENHYPEN', 'artist'),
('있지', 'ITZY', 'artist'),
('지코', 'ZICO', 'artist'),

-- Venues
('서울', 'Seoul', 'venue'),
('올림픽', 'Olympic', 'venue'),
('잠실', 'Jamsil', 'venue'),
('고척', 'Gocheok', 'venue'),
('송파', 'Songpa', 'venue'),
('구로', 'Guro', 'venue'),
('용산', 'Yongsan', 'venue'),
('광진', 'Gwangjin', 'venue'),
('체조경기장', 'Gymnastics Arena', 'venue'),
('경기장', 'Stadium', 'venue'),
('돔', 'Dome', 'venue'),
('스카이돔', 'Sky Dome', 'venue'),
('실내체육관', 'Indoor Stadium', 'venue'),

-- General terms
('콘서트', 'Concert', 'general'),
('투어', 'Tour', 'general'),
('공연', 'Performance', 'general'),
('뮤지컬', 'Musical', 'general');


-- Insert sample news
INSERT INTO news (title, content, author, views) VALUES
('TIKETI 서비스 정식 오픈!', '안녕하세요, 티케티입니다.

드디어 티케티 서비스가 정식으로 오픈하게 되었습니다!

티케티는 가장 빠르고 안전한 티켓팅 서비스를 제공하기 위해 만들어졌습니다.
실시간 좌석 선택, 공정한 대기열 시스템, 그리고 간편한 결제까지 모든 것을 한 곳에서 경험하실 수 있습니다.

앞으로 더 나은 서비스로 보답하겠습니다.
많은 이용 부탁드립니다!

감사합니다.', '관리자', 125),
('2024년 연말 콘서트 티켓 오픈 안내', '2024년 12월 연말 콘서트 티켓팅 일정을 안내드립니다.

12월 한 달 동안 다양한 아티스트들의 연말 콘서트가 예정되어 있습니다.
각 공연별 티켓 오픈 일정은 아래와 같습니다:

- 12/15: 아이유 연말 콘서트
- 12/20: BTS 월드 투어 서울 공연
- 12/25: 크리스마스 특집 콘서트

모든 티켓은 선착순이며, 공정한 대기열 시스템을 통해 진행됩니다.
티켓 오픈 10분 전부터 대기가 가능하니 참고해주세요.

행복한 연말 되세요!', '관리자', 89),
('티케티 모바일 앱 출시 예정', '티케티 모바일 앱이 곧 출시됩니다!

더욱 편리한 티켓팅을 위한 모바일 앱을 준비 중입니다.
iOS와 Android 모두 지원 예정이며, 1월 중 출시를 목표로 하고 있습니다.

모바일 앱에서는 다음과 같은 기능을 제공할 예정입니다:
- 푸시 알림으로 티켓 오픈 알림 받기
- 더 빠른 결제 프로세스
- 모바일 티켓 QR코드
- 나의 예매 내역 한눈에 보기

많은 기대 부탁드립니다!', '관리자', 45);
