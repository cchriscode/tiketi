-- Insert sample events into ticket_schema.events

INSERT INTO ticket_schema.events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id)
SELECT
  '2024 Concert Tour in Seoul',
  'The best concert of 2024! Do not miss it.',
  'Olympic Park Gymnastics Arena',
  '424 Olympic-ro, Songpa-gu, Seoul',
  CURRENT_DATE + INTERVAL '20 days' + TIME '19:00',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '19 days' + TIME '23:59',
  '/images/concert1.jpg',
  'on_sale',
  id
FROM ticket_schema.seat_layouts WHERE name = 'small_theater';

INSERT INTO ticket_schema.events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id)
SELECT
  'Musical Phantom of the Opera',
  'World-class musical Phantom of the Opera',
  'Charlotte Theater',
  '240 Olympic-ro, Songpa-gu, Seoul',
  CURRENT_DATE + INTERVAL '30 days' + TIME '19:30',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '29 days' + TIME '23:59',
  '/images/musical1.jpg',
  'on_sale',
  id
FROM ticket_schema.seat_layouts WHERE name = 'large_theater';

INSERT INTO ticket_schema.events (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, status, seat_layout_id)
SELECT
  'Sports Game - Basketball Finals',
  '2024-2025 Season Basketball Finals',
  'Jamsil Indoor Stadium',
  '25 Olympic-ro, Songpa-gu, Seoul',
  CURRENT_DATE + INTERVAL '15 days' + TIME '18:00',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '14 days' + TIME '23:59',
  '/images/sports1.jpg',
  'on_sale',
  id
FROM ticket_schema.seat_layouts WHERE name = 'sports_stadium';
