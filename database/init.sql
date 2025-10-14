-- Database initialization script for Tiketi

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservation items (예매 상세 - 티켓별 수량)
CREATE TABLE reservation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    ticket_type_id UUID REFERENCES ticket_types(id),
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_event_id ON reservations(event_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_ticket_types_event_id ON ticket_types(event_id);

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

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON ticket_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Admin account (admin@tiketi.gg / admin123) is automatically created by backend on startup

-- Insert sample events
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status) VALUES
('2024 콘서트 투어 in 서울', '2024년 최고의 콘서트! 놓치지 마세요.', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', '2024-12-31 19:00:00', '2024-11-01 10:00:00', '2024-12-30 23:59:59', '/images/concert1.jpg', 'on_sale'),
('뮤지컬 오페라의 유령', '세계적인 뮤지컬 오페라의 유령', '샤롯데씨어터', '서울특별시 송파구 올림픽로 240', '2025-01-15 19:30:00', '2024-11-10 10:00:00', '2025-01-14 23:59:59', '/images/musical1.jpg', 'on_sale'),
('스포츠 경기 - 농구 결승전', '2024-2025 시즌 농구 결승전', '잠실실내체육관', '서울특별시 송파구 올림픽로 25', '2024-12-20 18:00:00', '2024-11-05 10:00:00', '2024-12-19 23:59:59', '/images/sports1.jpg', 'on_sale');

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

