-- 테스트용 콘서트 21개 추가
-- 오늘부터 20일간 매일 19:00 판매 시작, 23:59 판매 종료

-- 0일차 (오늘): 10CM 콘서트 - 판매 진행 중!
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('10CM HOTEL ROOM TOUR 2024', '10CM의 감성 어쿠스틱 공연', '블루스퀘어 마스터카드홀', '서울특별시 용산구 이태원로 294', 
 CURRENT_DATE + INTERVAL '20 days' + TIME '19:00', 
 CURRENT_DATE + TIME '19:00', 
 CURRENT_DATE + TIME '23:59', 
 '/images/10cm.jpg', 'on_sale', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), '10CM');

-- 1일차: 아이유 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('아이유 2024 콘서트 - The Golden Hour', '아이유의 감성 가득한 콘서트', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '30 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '1 day' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '1 day' + TIME '23:59', 
 '/images/iu.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), '아이유');

-- 2일차: BTS 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('BTS WORLD TOUR 2024', 'BTS의 화려한 월드투어 서울 공연', '잠실종합운동장 주경기장', '서울특별시 송파구 올림픽로 25', 
 CURRENT_DATE + INTERVAL '35 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '2 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '2 days' + TIME '23:59', 
 '/images/bts.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'sports_stadium'), 'BTS');

-- 3일차: BLACKPINK 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('BLACKPINK BORN PINK TOUR', 'BLACKPINK의 강렬한 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '40 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '3 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '3 days' + TIME '23:59', 
 '/images/blackpink.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'BLACKPINK');

-- 4일차: 임영웅 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('임영웅 - IM HERO TOUR 2024', '임영웅의 감동 콘서트', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '42 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '4 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '4 days' + TIME '23:59', 
 '/images/limyoungwoong.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), '임영웅');

-- 5일차: 뉴진스 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('NewJeans SUPER SHY TOUR', '뉴진스의 청량한 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '45 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '5 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '5 days' + TIME '23:59', 
 '/images/newjeans.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'NewJeans');

-- 6일차: 세븐틴 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('SEVENTEEN FOLLOW TOUR', '세븐틴의 완벽한 퍼포먼스', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '48 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '6 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '6 days' + TIME '23:59', 
 '/images/seventeen.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'SEVENTEEN');

-- 7일차: 에스파 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('aespa SYNK TOUR 2024', '에스파의 미래형 콘서트', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '50 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '7 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '7 days' + TIME '23:59', 
 '/images/aespa.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'aespa');

-- 8일차: 엔시티 드림 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('NCT DREAM THE DREAM SHOW 3', 'NCT DREAM의 환상적인 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '52 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '8 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '8 days' + TIME '23:59', 
 '/images/nctdream.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'NCT DREAM');

-- 9일차: 르세라핌 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('LE SSERAFIM FLAME RISES', '르세라핌의 카리스마 넘치는 공연', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '55 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '9 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '9 days' + TIME '23:59', 
 '/images/lesserafim.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'LE SSERAFIM');

-- 10일차: 아이브 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('IVE THE PROM QUEENS TOUR', '아이브의 화려한 무대', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '58 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '10 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '10 days' + TIME '23:59', 
 '/images/ive.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'IVE');

-- 11일차: 스트레이 키즈 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('Stray Kids 5-STAR TOUR', '스트레이 키즈의 폭발적인 에너지', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '60 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '11 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '11 days' + TIME '23:59', 
 '/images/straykids.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'Stray Kids');

-- 12일차: 트와이스 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('TWICE READY TO BE TOUR', '트와이스의 감성 공연', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '62 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '12 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '12 days' + TIME '23:59', 
 '/images/twice.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'TWICE');

-- 13일차: 태양 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('태양 WHITE NIGHT TOUR', '태양의 감성 가득한 라이브', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '65 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '13 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '13 days' + TIME '23:59', 
 '/images/taeyang.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), '태양');

-- 14일차: 지드래곤 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('G-DRAGON ACT III: MOTTE', 'GD의 독보적인 무대', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '68 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '14 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '14 days' + TIME '23:59', 
 '/images/gdragon.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'G-DRAGON');

-- 15일차: 엑소 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('EXO PLANET 2024', '엑소의 완벽한 퍼포먼스', 'KSPO DOME', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '70 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '15 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '15 days' + TIME '23:59', 
 '/images/exo.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'EXO');

-- 16일차: 레드벨벳 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('Red Velvet FEEL MY RHYTHM', '레드벨벳의 매력적인 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '72 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '16 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '16 days' + TIME '23:59', 
 '/images/redvelvet.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'Red Velvet');

-- 17일차: 투모로우바이투게더 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('TXT ACT: SWEET MIRAGE', '투모로우바이투게더의 청춘 콘서트', '잠실실내체육관', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '75 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '17 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '17 days' + TIME '23:59', 
 '/images/txt.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'TOMORROW X TOGETHER');

-- 18일차: 엔하이픈 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('ENHYPEN FATE TOUR', '엔하이픈의 강렬한 퍼포먼스', '고척스카이돔', '서울특별시 구로구 경인로 430', 
 CURRENT_DATE + INTERVAL '78 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '18 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '18 days' + TIME '23:59', 
 '/images/enhypen.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'large_theater'), 'ENHYPEN');

-- 19일차: 있지 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('ITZY CHECKMATE TOUR', '있지의 파워풀한 무대', '올림픽공원 체조경기장', '서울특별시 송파구 올림픽로 424', 
 CURRENT_DATE + INTERVAL '80 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '19 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '19 days' + TIME '23:59', 
 '/images/itzy.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'ITZY');

-- 20일차: 지코 콘서트
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) VALUES
('ZICO KING OF THE ZUNGLE', '지코의 힙합 라이브', 'YES24 라이브홀', '서울특별시 광진구 광나루로 56길 85', 
 CURRENT_DATE + INTERVAL '82 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '20 days' + TIME '19:00', 
 CURRENT_DATE + INTERVAL '20 days' + TIME '23:59', 
 '/images/zico.jpg', 'upcoming', 
 (SELECT id FROM seat_layouts WHERE name = 'small_theater'), 'ZICO');

