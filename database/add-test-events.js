const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || 'tiketi_pass',
});

const events = [
  {
    title: '아이유 2024 콘서트 - The Golden Hour',
    description: '아이유의 감성 가득한 콘서트',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: '아이유',
    day_offset: 1,
    layout: 'large_theater'
  },
  {
    title: 'BTS WORLD TOUR 2024',
    description: 'BTS의 화려한 월드투어 서울 공연',
    venue: '잠실종합운동장 주경기장',
    address: '서울특별시 송파구 올림픽로 25',
    artist_name: 'BTS',
    day_offset: 2,
    layout: 'sports_stadium'
  },
  {
    title: 'BLACKPINK BORN PINK TOUR',
    description: 'BLACKPINK의 강렬한 무대',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'BLACKPINK',
    day_offset: 3,
    layout: 'large_theater'
  },
  {
    title: '임영웅 - IM HERO TOUR 2024',
    description: '임영웅의 감동 콘서트',
    venue: '잠실실내체육관',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: '임영웅',
    day_offset: 4,
    layout: 'large_theater'
  },
  {
    title: 'NewJeans SUPER SHY TOUR',
    description: '뉴진스의 청량한 무대',
    venue: '올림픽공원 체조경기장',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'NewJeans',
    day_offset: 5,
    layout: 'small_theater'
  },
  {
    title: 'SEVENTEEN FOLLOW TOUR',
    description: '세븐틴의 완벽한 퍼포먼스',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'SEVENTEEN',
    day_offset: 6,
    layout: 'large_theater'
  },
  {
    title: 'aespa SYNK TOUR 2024',
    description: '에스파의 미래형 콘서트',
    venue: 'KSPO DOME',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'aespa',
    day_offset: 7,
    layout: 'large_theater'
  },
  {
    title: 'NCT DREAM THE DREAM SHOW 3',
    description: 'NCT DREAM의 환상적인 무대',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'NCT DREAM',
    day_offset: 8,
    layout: 'large_theater'
  },
  {
    title: 'LE SSERAFIM FLAME RISES',
    description: '르세라핌의 카리스마 넘치는 공연',
    venue: '올림픽공원 체조경기장',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'LE SSERAFIM',
    day_offset: 9,
    layout: 'small_theater'
  },
  {
    title: 'IVE THE PROM QUEENS TOUR',
    description: '아이브의 화려한 무대',
    venue: 'KSPO DOME',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'IVE',
    day_offset: 10,
    layout: 'large_theater'
  },
  {
    title: 'Stray Kids 5-STAR TOUR',
    description: '스트레이 키즈의 폭발적인 에너지',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'Stray Kids',
    day_offset: 11,
    layout: 'large_theater'
  },
  {
    title: 'TWICE READY TO BE TOUR',
    description: '트와이스의 감성 공연',
    venue: '잠실실내체육관',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'TWICE',
    day_offset: 12,
    layout: 'large_theater'
  },
  {
    title: '태양 WHITE NIGHT TOUR',
    description: '태양의 감성 가득한 라이브',
    venue: '올림픽공원 체조경기장',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: '태양',
    day_offset: 13,
    layout: 'small_theater'
  },
  {
    title: 'G-DRAGON ACT III: MOTTE',
    description: 'GD의 독보적인 무대',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'G-DRAGON',
    day_offset: 14,
    layout: 'large_theater'
  },
  {
    title: 'EXO PLANET 2024',
    description: '엑소의 완벽한 퍼포먼스',
    venue: 'KSPO DOME',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'EXO',
    day_offset: 15,
    layout: 'large_theater'
  },
  {
    title: 'Red Velvet FEEL MY RHYTHM',
    description: '레드벨벳의 매력적인 무대',
    venue: '올림픽공원 체조경기장',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'Red Velvet',
    day_offset: 16,
    layout: 'small_theater'
  },
  {
    title: 'TXT ACT: SWEET MIRAGE',
    description: '투모로우바이투게더의 청춘 콘서트',
    venue: '잠실실내체육관',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'TOMORROW X TOGETHER',
    day_offset: 17,
    layout: 'large_theater'
  },
  {
    title: 'ENHYPEN FATE TOUR',
    description: '엔하이픈의 강렬한 퍼포먼스',
    venue: '고척스카이돔',
    address: '서울특별시 구로구 경인로 430',
    artist_name: 'ENHYPEN',
    day_offset: 18,
    layout: 'large_theater'
  },
  {
    title: 'ITZY CHECKMATE TOUR',
    description: '있지의 파워풀한 무대',
    venue: '올림픽공원 체조경기장',
    address: '서울특별시 송파구 올림픽로 424',
    artist_name: 'ITZY',
    day_offset: 19,
    layout: 'small_theater'
  },
  {
    title: 'ZICO KING OF THE ZUNGLE',
    description: '지코의 힙합 라이브',
    venue: 'YES24 라이브홀',
    address: '서울특별시 광진구 광나루로 56길 85',
    artist_name: 'ZICO',
    day_offset: 20,
    layout: 'small_theater'
  }
];

async function addTestEvents() {
  const client = await pool.connect();
  
  try {
    console.log('🎵 테스트 이벤트 20개 추가 시작...\n');

    for (const event of events) {
      await client.query('BEGIN');

      try {
        // 좌석 레이아웃 ID 조회
        const layoutResult = await client.query(
          'SELECT id FROM seat_layouts WHERE name = $1',
          [event.layout]
        );

        if (layoutResult.rows.length === 0) {
          console.error(`❌ 레이아웃 '${event.layout}' 을(를) 찾을 수 없습니다.`);
          await client.query('ROLLBACK');
          continue;
        }

        const layoutId = layoutResult.rows[0].id;

        // 날짜 계산
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 판매 시작: 오늘 + offset일 14:00
        const saleStart = new Date(today);
        saleStart.setDate(saleStart.getDate() + event.day_offset);
        saleStart.setHours(14, 0, 0, 0);

        // 판매 종료: 같은 날 19:00
        const saleEnd = new Date(saleStart);
        saleEnd.setHours(19, 0, 0, 0);

        // 공연 날짜: 판매 시작일 + 30일
        const eventDate = new Date(saleStart);
        eventDate.setDate(eventDate.getDate() + 30);
        eventDate.setHours(19, 0, 0, 0);

        // 이벤트 삽입
        await client.query(
          `INSERT INTO events (
            title, description, venue, address, 
            event_date, sale_start_date, sale_end_date, 
            poster_image_url, status, seat_layout_id, artist_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            event.title,
            event.description,
            event.venue,
            event.address,
            eventDate,
            saleStart,
            saleEnd,
            `/images/${event.artist_name.toLowerCase().replace(/\s+/g, '')}.jpg`,
            'upcoming',
            layoutId,
            event.artist_name
          ]
        );

        await client.query('COMMIT');

        console.log(`✅ ${event.day_offset}일차: ${event.title}`);
        console.log(`   판매: ${saleStart.toLocaleString('ko-KR')} ~ ${saleEnd.toLocaleString('ko-KR')}`);
        console.log(`   공연: ${eventDate.toLocaleString('ko-KR')}\n`);

      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ 이벤트 추가 실패 (${event.title}):`, error.message);
      }
    }

    console.log('🎉 테스트 이벤트 추가 완료!');

  } catch (error) {
    console.error('❌ 전체 프로세스 오류:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

addTestEvents();

