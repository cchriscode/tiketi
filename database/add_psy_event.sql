-- 싸이 흠뻑쇼 2024 추가 (오늘부터 판매 시작)
INSERT INTO events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id, artist_name) 
VALUES (
  '싸이 흠뻑쇼 2024', 
  '싸이의 신나는 여름 콘서트', 
  '잠실종합운동장 주경기장', 
  '서울특별시 송파구 올림픽로 25', 
  CURRENT_DATE + INTERVAL '25 days' + TIME '19:00', 
  CURRENT_DATE + TIME '19:00', 
  CURRENT_DATE + TIME '23:59', 
  '/images/psy.jpg', 
  'upcoming', 
  (SELECT id FROM seat_layouts WHERE name = 'sports_stadium'), 
  '싸이'
)
ON CONFLICT DO NOTHING;

