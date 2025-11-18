-- Migration: Add keyword_mappings and news tables
-- Run this on production database

-- 1. Enable pg_trgm extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create keyword_mappings table for cross-language search
CREATE TABLE IF NOT EXISTS keyword_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    korean VARCHAR(255) NOT NULL,
    english VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'artist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(korean, english)
);

-- 3. Insert Korean-English artist mappings
INSERT INTO keyword_mappings (korean, english, entity_type) VALUES
('방탄소년단', 'BTS', 'artist'),
('비티에스', 'BTS', 'artist'),
('엑소', 'EXO', 'artist'),
('블랙핑크', 'BLACKPINK', 'artist'),
('블핑', 'BLACKPINK', 'artist'),
('트와이스', 'TWICE', 'artist'),
('세븐틴', 'SEVENTEEN', 'artist'),
('뉴진스', 'NewJeans', 'artist'),
('르세라핌', 'LE SSERAFIM', 'artist'),
('아이브', 'IVE', 'artist'),
('에스파', 'aespa', 'artist'),
('스트레이 키즈', 'Stray Kids', 'artist'),
('스키즈', 'Stray Kids', 'artist'),
('아이유', 'IU', 'artist'),
('태연', 'TAEYEON', 'artist'),
('지드래곤', 'G-DRAGON', 'artist'),
('지디', 'G-DRAGON', 'artist'),
('빅뱅', 'BIGBANG', 'artist'),
('샤이니', 'SHINee', 'artist'),
('레드벨벳', 'Red Velvet', 'artist'),
('레벨', 'Red Velvet', 'artist'),
('엔시티', 'NCT', 'artist'),
('있지', 'ITZY', 'artist'),
('에이티즈', 'ATEEZ', 'artist'),
('투모로우바이투게더', 'TOMORROW X TOGETHER', 'artist'),
('투바투', 'TXT', 'artist'),
('티엑스티', 'TXT', 'artist'),
('엔하이픈', 'ENHYPEN', 'artist'),
('제로베이스원', 'ZEROBASEONE', 'artist'),
('제베원', 'ZB1', 'artist'),
('지비원', 'ZB1', 'artist'),
('보이넥스트도어', 'BOYNEXTDOOR', 'artist'),
('본도', 'BOYNEXTDOOR', 'artist'),
('라이즈', 'RIIZE', 'artist'),
('키스오브라이프', 'Kiss of Life', 'artist'),
('키오라', 'KIOF', 'artist'),
('베이비몬스터', 'BABYMONSTER', 'artist'),
('베몬', 'BABYMONSTER', 'artist'),
('아일릿', 'ILLIT', 'artist'),
('드림캐처', 'Dreamcatcher', 'artist'),
('드캐', 'Dreamcatcher', 'artist'),
('마마무', 'MAMAMOO', 'artist'),
('오마이걸', 'OH MY GIRL', 'artist'),
('오걸', 'OH MY GIRL', 'artist'),
('여자아이들', '(G)I-DLE', 'artist'),
('아이들', '(G)I-DLE', 'artist'),
('위클리', 'Weeekly', 'artist')
ON CONFLICT (korean, english) DO NOTHING;

-- 4. Create search index on events table
DROP INDEX IF EXISTS idx_events_search;
CREATE INDEX idx_events_search ON events USING GIN (
    (COALESCE(title, '') || ' ' || COALESCE(artist_name, '') || ' ' || COALESCE(venue, '') || ' ' || COALESCE(address, '')) gin_trgm_ops
);

-- 5. Create news table
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create trigger function for news updated_at
CREATE OR REPLACE FUNCTION update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger on news table
DROP TRIGGER IF EXISTS trigger_update_news_updated_at ON news;
CREATE TRIGGER trigger_update_news_updated_at
    BEFORE UPDATE ON news
    FOR EACH ROW
    EXECUTE FUNCTION update_news_updated_at();

-- 8. Insert sample news (optional)
INSERT INTO news (title, content, author, views) VALUES
('TIKETI 서비스 정식 오픈!', '안녕하세요, 티케티입니다.

드디어 티케티 서비스가 정식으로 오픈하게 되었습니다!

티케티는 가장 빠르고 안전한 티켓팅 서비스를 제공하기 위해 만들어졌습니다.
앞으로 더욱 좋은 서비스로 보답하겠습니다.

감사합니다.', '관리자', 0),
('2024년 연말 콘서트 티켓 오픈 안내', '안녕하세요, 티케티입니다.

2024년 12월 연말 콘서트 티켓이 순차적으로 오픈됩니다.

많은 관심 부탁드립니다!', '관리자', 0)
ON CONFLICT DO NOTHING;

-- Verification queries (uncomment to run)
-- SELECT COUNT(*) as keyword_mappings_count FROM keyword_mappings;
-- SELECT COUNT(*) as news_count FROM news;
-- SELECT * FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_search';
