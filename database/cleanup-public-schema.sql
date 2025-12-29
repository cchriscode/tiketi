-- ========================================
-- Public Schema Cleanup Script
-- ========================================
-- MSA 마이그레이션 후 public 스키마의 오래된 테이블 삭제
--
-- ⚠️  경고: 이 스크립트는 되돌릴 수 없습니다!
-- 실행 전 반드시 백업하세요:
-- kubectl exec -n tiketi deployment/postgres -- pg_dump -U tiketi_user -d tiketi > backup.sql
--
-- 실행 방법:
-- cat database/cleanup-public-schema.sql | kubectl exec -i -n tiketi deployment/postgres -- psql -U tiketi_user -d tiketi
-- ========================================

BEGIN;

-- 1. 현재 상태 확인
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '현재 Public 스키마 테이블 상태';
    RAISE NOTICE '========================================';
END $$;

SELECT
    tablename,
    (xpath('//row/count/text()', query_to_xml(format('SELECT COUNT(*) as count FROM public.%I', tablename), false, true, '')))[1]::text::int as row_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'events', 'seats', 'reservations', 'reservation_items',
                    'ticket_types', 'seat_layouts', 'keyword_mappings', 'news')
ORDER BY tablename;

-- 2. 백업 확인 프롬프트
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  다음 테이블이 삭제됩니다:';
    RAISE NOTICE '   - public.reservation_items';
    RAISE NOTICE '   - public.reservations';
    RAISE NOTICE '   - public.seats';
    RAISE NOTICE '   - public.ticket_types';
    RAISE NOTICE '   - public.news';
    RAISE NOTICE '   - public.events';
    RAISE NOTICE '   - public.keyword_mappings';
    RAISE NOTICE '   - public.seat_layouts';
    RAISE NOTICE '   - public.users';
    RAISE NOTICE '';
    RAISE NOTICE '백업을 완료했습니까? 계속하려면 이 스크립트를 실행하세요.';
    RAISE NOTICE '';
END $$;

-- 3. FK 제약조건 삭제 (테이블 삭제 전)
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Step 1: FK 제약조건 삭제';
    RAISE NOTICE '========================================';
END $$;

-- reservation_items FK 삭제
ALTER TABLE IF EXISTS public.reservation_items DROP CONSTRAINT IF EXISTS reservation_items_reservation_id_fkey;
ALTER TABLE IF EXISTS public.reservation_items DROP CONSTRAINT IF EXISTS reservation_items_seat_id_fkey;
ALTER TABLE IF EXISTS public.reservation_items DROP CONSTRAINT IF EXISTS reservation_items_ticket_type_id_fkey;

-- reservations FK 삭제
ALTER TABLE IF EXISTS public.reservations DROP CONSTRAINT IF EXISTS reservations_user_id_fkey;
ALTER TABLE IF EXISTS public.reservations DROP CONSTRAINT IF EXISTS reservations_event_id_fkey;

-- seats FK 삭제
ALTER TABLE IF EXISTS public.seats DROP CONSTRAINT IF EXISTS seats_event_id_fkey;

-- ticket_types FK 삭제
ALTER TABLE IF EXISTS public.ticket_types DROP CONSTRAINT IF EXISTS ticket_types_event_id_fkey;

-- events FK 삭제
ALTER TABLE IF EXISTS public.events DROP CONSTRAINT IF EXISTS events_seat_layout_id_fkey;
ALTER TABLE IF EXISTS public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;

-- news FK 삭제
ALTER TABLE IF EXISTS public.news DROP CONSTRAINT IF EXISTS news_author_id_fkey;

-- 4. 테이블 삭제 (FK 제약조건 순서대로)
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Step 2: 테이블 삭제 (하위 테이블부터)';
    RAISE NOTICE '========================================';
END $$;

-- 4.1 reservation_items (가장 하위)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservation_items') THEN
        DROP TABLE public.reservation_items CASCADE;
        RAISE NOTICE '✅ Dropped: public.reservation_items';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.reservation_items';
    END IF;
END $$;

-- 4.2 reservations
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        DROP TABLE public.reservations CASCADE;
        RAISE NOTICE '✅ Dropped: public.reservations';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.reservations';
    END IF;
END $$;

-- 4.3 seats
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seats') THEN
        DROP TABLE public.seats CASCADE;
        RAISE NOTICE '✅ Dropped: public.seats';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.seats';
    END IF;
END $$;

-- 4.4 ticket_types
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_types') THEN
        DROP TABLE public.ticket_types CASCADE;
        RAISE NOTICE '✅ Dropped: public.ticket_types';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.ticket_types';
    END IF;
END $$;

-- 4.5 news
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'news') THEN
        DROP TABLE public.news CASCADE;
        RAISE NOTICE '✅ Dropped: public.news';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.news';
    END IF;
END $$;

-- 4.6 events
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        DROP TABLE public.events CASCADE;
        RAISE NOTICE '✅ Dropped: public.events';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.events';
    END IF;
END $$;

-- 4.7 keyword_mappings (FK 없음)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'keyword_mappings') THEN
        DROP TABLE public.keyword_mappings CASCADE;
        RAISE NOTICE '✅ Dropped: public.keyword_mappings';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.keyword_mappings';
    END IF;
END $$;

-- 4.8 seat_layouts (FK 없음)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seat_layouts') THEN
        DROP TABLE public.seat_layouts CASCADE;
        RAISE NOTICE '✅ Dropped: public.seat_layouts';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.seat_layouts';
    END IF;
END $$;

-- 4.9 users (최상위 부모)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DROP TABLE public.users CASCADE;
        RAISE NOTICE '✅ Dropped: public.users';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist: public.users';
    END IF;
END $$;

-- 5. 최종 확인
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Step 3: 삭제 후 확인';
    RAISE NOTICE '========================================';
END $$;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ SUCCESS: Public 스키마에 오래된 테이블이 모두 삭제되었습니다.'
        ELSE '⚠️  WARNING: 아직 ' || COUNT(*) || '개의 테이블이 남아있습니다.'
    END as cleanup_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'events', 'seats', 'reservations', 'reservation_items',
                    'ticket_types', 'seat_layouts', 'keyword_mappings', 'news');

-- 남아있는 public 테이블 확인 (정상적으로는 없어야 함)
SELECT
    'Remaining tables in public schema:' as info,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'events', 'seats', 'reservations', 'reservation_items',
                    'ticket_types', 'seat_layouts', 'keyword_mappings', 'news');

-- 서비스별 스키마 테이블 확인 (정상 동작 확인)
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Step 4: 서비스별 스키마 확인';
    RAISE NOTICE '========================================';
END $$;

SELECT schemaname, COUNT(*) as table_count
FROM pg_tables
WHERE schemaname IN ('auth_schema', 'ticket_schema', 'payment_schema', 'stats_schema')
GROUP BY schemaname
ORDER BY schemaname;

-- 데이터 확인
SELECT 'auth_schema.users' as table_name, COUNT(*) as row_count FROM auth_schema.users
UNION ALL
SELECT 'ticket_schema.events' as table_name, COUNT(*) as row_count FROM ticket_schema.events
UNION ALL
SELECT 'ticket_schema.seats' as table_name, COUNT(*) as row_count FROM ticket_schema.seats
UNION ALL
SELECT 'ticket_schema.reservations' as table_name, COUNT(*) as row_count FROM ticket_schema.reservations
UNION ALL
SELECT 'payment_schema.payments' as table_name, COUNT(*) as row_count FROM payment_schema.payments
UNION ALL
SELECT 'stats_schema.daily_stats' as table_name, COUNT(*) as row_count FROM stats_schema.daily_stats;

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Public 스키마 정리 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '1. 서비스 재시작: kubectl rollout restart deployment -n tiketi';
    RAISE NOTICE '2. 기능 테스트:';
    RAISE NOTICE '   - 회원가입 (auth_schema.users)';
    RAISE NOTICE '   - 이벤트 조회 (ticket_schema.events)';
    RAISE NOTICE '   - 예약 생성 (ticket_schema.reservations)';
    RAISE NOTICE '   - 관리자 통계 (stats_schema)';
    RAISE NOTICE '';
END $$;
