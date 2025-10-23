-- 이벤트 이미지 업데이트 SQL
-- 각 아티스트별로 적절한 이미지 경로 설정

UPDATE events SET poster_image_url = '/images/10cm.jpg' WHERE artist_name = '10CM';
UPDATE events SET poster_image_url = '/images/psy.jpg' WHERE artist_name = '싸이';
UPDATE events SET poster_image_url = '/images/iu.jpg' WHERE artist_name = '아이유';
UPDATE events SET poster_image_url = '/images/bts.jpg' WHERE artist_name = 'BTS';
UPDATE events SET poster_image_url = '/images/blackpink.jpg' WHERE artist_name = 'BLACKPINK';
UPDATE events SET poster_image_url = '/images/limyoungwoong.jpg' WHERE artist_name = '임영웅';
UPDATE events SET poster_image_url = '/images/newjeans.jpg' WHERE artist_name = 'NewJeans';
UPDATE events SET poster_image_url = '/images/seventeen.jpg' WHERE artist_name = 'SEVENTEEN';
UPDATE events SET poster_image_url = '/images/aespa.jpg' WHERE artist_name = 'aespa';
UPDATE events SET poster_image_url = '/images/nctdream.jpg' WHERE artist_name = 'NCT DREAM';
UPDATE events SET poster_image_url = '/images/lesserafim.jpg' WHERE artist_name = 'LE SSERAFIM';
UPDATE events SET poster_image_url = '/images/ive.jpg' WHERE artist_name = 'IVE';
UPDATE events SET poster_image_url = '/images/straykids.jpg' WHERE artist_name = 'Stray Kids';
UPDATE events SET poster_image_url = '/images/twice.jpg' WHERE artist_name = 'TWICE';
UPDATE events SET poster_image_url = '/images/taeyang.jpg' WHERE artist_name = '태양';
UPDATE events SET poster_image_url = '/images/gdragon.jpg' WHERE artist_name = 'G-DRAGON';
UPDATE events SET poster_image_url = '/images/exo.jpg' WHERE artist_name = 'EXO';
UPDATE events SET poster_image_url = '/images/redvelvet.jpg' WHERE artist_name = 'Red Velvet';
UPDATE events SET poster_image_url = '/images/txt.jpg' WHERE artist_name = 'TOMORROW X TOGETHER';
UPDATE events SET poster_image_url = '/images/enhypen.jpg' WHERE artist_name = 'ENHYPEN';
UPDATE events SET poster_image_url = '/images/itzy.jpg' WHERE artist_name = 'ITZY';
UPDATE events SET poster_image_url = '/images/zico.jpg' WHERE artist_name = 'ZICO';

-- 일반 이벤트들
UPDATE events SET poster_image_url = '/images/concert1.jpg' WHERE title = '2024 콘서트 투어 in 서울' AND artist_name IS NULL;
UPDATE events SET poster_image_url = '/images/musical1.jpg' WHERE title = '뮤지컬 오페라의 유령';
UPDATE events SET poster_image_url = '/images/sports1.jpg' WHERE title = '스포츠 경기 - 농구 결승전';

-- 임시로 플레이스홀더 이미지 설정 (실제 이미지가 없는 경우)
UPDATE events SET poster_image_url = '/images/placeholder.svg' WHERE poster_image_url IS NULL OR poster_image_url = '';