# 데이터베이스 마이그레이션 가이드

## 배포 환경에 적용하기

배포 환경의 PostgreSQL 데이터베이스에 접속해서 마이그레이션 스크립트를 실행하세요.

### 방법 1: psql 사용 (추천)

```bash
# SSH로 서버에 접속한 후
psql -U postgres -d tiketi -f database/migration_add_news_and_keyword_mappings.sql
```

또는 로컬에서 원격 DB에 직접 연결:

```bash
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f database/migration_add_news_and_keyword_mappings.sql
```

### 방법 2: Docker를 사용하는 경우

```bash
# 마이그레이션 파일을 컨테이너에 복사
docker cp database/migration_add_news_and_keyword_mappings.sql <container_name>:/tmp/

# 컨테이너 내에서 실행
docker exec -i <container_name> psql -U postgres -d tiketi -f /tmp/migration_add_news_and_keyword_mappings.sql
```

### 방법 3: SQL 클라이언트 (DBeaver, pgAdmin 등) 사용

1. `migration_add_news_and_keyword_mappings.sql` 파일을 엽니다
2. 배포 환경의 DB에 연결합니다
3. SQL을 실행합니다

## 확인 방법

마이그레이션 후 다음 쿼리로 확인:

```sql
-- 테이블 존재 확인
SELECT tablename FROM pg_tables WHERE tablename IN ('keyword_mappings', 'news');

-- 데이터 확인
SELECT COUNT(*) as keyword_count FROM keyword_mappings;
SELECT COUNT(*) as news_count FROM news;

-- 인덱스 확인
SELECT * FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_search';
```

## 문제 해결

### keyword_mappings 관련 에러
- "relation already exists" → 정상입니다. 이미 테이블이 있다는 뜻입니다.
- "constraint violation" → 중복 데이터가 있다는 뜻입니다. `ON CONFLICT DO NOTHING`으로 처리됩니다.

### news 테이블 관련 에러
- "relation already exists" → 정상입니다.
- "function already exists" → 정상입니다.

## 마이그레이션 내용

이 마이그레이션은 다음을 추가합니다:

1. **pg_trgm 확장** - 퍼지 텍스트 검색
2. **keyword_mappings 테이블** - 한영 교차 검색 (엑소 ↔ EXO)
3. **47개 아티스트 매핑 데이터**
4. **events 테이블 검색 인덱스** - 검색 성능 향상
5. **news 테이블** - 뉴스 기능
6. **news 트리거** - updated_at 자동 업데이트
7. **샘플 뉴스 데이터** (선택사항)
