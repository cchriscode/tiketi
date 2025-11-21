const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tiketi API',
      version: '1.0.0',
      description: 'Tiketi 티켓 예매 시스템 API 문서',
      contact: {
        name: 'Tiketi Team',
      },
    },
      servers: [
        {
          url: 'http://localhost:3001',
          description: '개발 서버',
        },
        {
          url: 'https://api.tiketi.store',
          description: '프로덕션 서버',
        },
      ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 인증 토큰',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: '에러 메시지',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '사용자 ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: '사용자 ID (중복)',
            },
            email: {
              type: 'string',
              format: 'email',
              description: '이메일',
            },
            name: {
              type: 'string',
              description: '이름',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: '사용자 역할',
            },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '이벤트 ID',
            },
            title: {
              type: 'string',
              description: '이벤트 제목',
            },
            description: {
              type: 'string',
              description: '이벤트 설명',
            },
            venue: {
              type: 'string',
              description: '장소',
            },
            address: {
              type: 'string',
              description: '주소',
            },
            event_date: {
              type: 'string',
              format: 'date-time',
              description: '이벤트 날짜',
            },
            sale_start_date: {
              type: 'string',
              format: 'date-time',
              description: '판매 시작 날짜',
            },
            sale_end_date: {
              type: 'string',
              format: 'date-time',
              description: '판매 종료 날짜',
            },
            poster_image_url: {
              type: 'string',
              description: '포스터 이미지 URL',
            },
            status: {
              type: 'string',
              enum: ['upcoming', 'on_sale', 'sold_out', 'ended', 'cancelled'],
              description: '이벤트 상태',
            },
            artist_name: {
              type: 'string',
              description: '아티스트 이름',
            },
          },
        },
        TicketType: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '티켓 타입 ID',
            },
            name: {
              type: 'string',
              description: '티켓 타입 이름',
            },
            price: {
              type: 'integer',
              description: '가격',
            },
            total_quantity: {
              type: 'integer',
              description: '전체 수량',
            },
            available_quantity: {
              type: 'integer',
              description: '남은 수량',
            },
            description: {
              type: 'string',
              description: '설명',
            },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '예매 ID',
            },
            reservation_number: {
              type: 'string',
              description: '예매 번호',
            },
            total_amount: {
              type: 'integer',
              description: '총 금액',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'cancelled'],
              description: '예매 상태',
            },
            payment_status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed', 'refunded'],
              description: '결제 상태',
            },
            payment_method: {
              type: 'string',
              enum: ['naver_pay', 'kakao_pay', 'bank_transfer'],
              description: '결제 방법',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: '생성 날짜',
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: '만료 날짜',
            },
          },
        },
        Seat: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '좌석 ID',
            },
            section: {
              type: 'string',
              description: '섹션',
            },
            row_number: {
              type: 'integer',
              description: '행 번호',
            },
            seat_number: {
              type: 'integer',
              description: '좌석 번호',
            },
            seat_label: {
              type: 'string',
              description: '좌석 레이블',
            },
            price: {
              type: 'integer',
              description: '가격',
            },
            status: {
              type: 'string',
              enum: ['available', 'locked', 'reserved'],
              description: '좌석 상태',
            },
          },
        },
        News: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '뉴스 ID',
            },
            title: {
              type: 'string',
              description: '제목',
            },
            content: {
              type: 'string',
              description: '내용',
            },
            author: {
              type: 'string',
              description: '작성자',
            },
            author_id: {
              type: 'string',
              format: 'uuid',
              description: '작성자 ID',
            },
            views: {
              type: 'integer',
              description: '조회수',
            },
            is_pinned: {
              type: 'boolean',
              description: '고정 여부',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: '생성 날짜',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: '수정 날짜',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: '현재 페이지',
            },
            limit: {
              type: 'integer',
              description: '페이지당 항목 수',
            },
            total: {
              type: 'integer',
              description: '전체 항목 수',
            },
            totalPages: {
              type: 'integer',
              description: '전체 페이지 수',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: '인증 관련 API',
      },
      {
        name: 'Events',
        description: '이벤트 관련 API',
      },
      {
        name: 'Tickets',
        description: '티켓 관련 API',
      },
      {
        name: 'Reservations',
        description: '예매 관련 API',
      },
      {
        name: 'Seats',
        description: '좌석 관련 API',
      },
      {
        name: 'Payments',
        description: '결제 관련 API',
      },
      {
        name: 'Queue',
        description: '대기열 관련 API',
      },
      {
        name: 'News',
        description: '뉴스 관련 API',
      },
      {
        name: 'Admin',
        description: '관리자 API',
      },
      {
        name: 'Image',
        description: '이미지 업로드 API',
      },
      {
        name: 'Health',
        description: '헬스체크 API',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // 모든 라우트 파일에서 Swagger 주석 읽기
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
