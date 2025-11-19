/**
 * Custom Hook: useCountdown
 * 실시간 카운트다운을 위한 커스텀 훅
 */

import { useState, useEffect, useRef } from 'react';

/**
 * 두 날짜 사이의 시간 차이를 계산
 * @param {Date} targetDate - 목표 날짜
 * @returns {Object} 남은 시간 객체 { months, days, hours, minutes, seconds, isExpired }
 */
const calculateTimeLeft = (targetDate) => {
  // targetDate가 없거나 유효하지 않으면 기본값 반환
  if (!targetDate) {
    return {
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalDays: 0,
      isExpired: true,
    };
  }

  const now = new Date();
  const target = new Date(targetDate);
  const difference = target - now;

  // Invalid Date 체크
  if (isNaN(difference)) {
    return {
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalDays: 0,
      isExpired: true,
    };
  }

  if (difference <= 0) {
    return {
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalDays: 0,
      isExpired: true,
    };
  }

  const seconds = Math.floor((difference / 1000) % 60);
  const minutes = Math.floor((difference / 1000 / 60) % 60);
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  // 월 계산 (대략적으로 30일 = 1개월)
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;

  return {
    months,
    days: remainingDays,
    hours,
    minutes,
    seconds,
    totalDays: days,
    isExpired: false,
  };
};

/**
 * useCountdown Hook
 * @param {string|Date} targetDate - 카운트다운 목표 날짜
 * @param {Function} onExpire - 카운트다운 종료 시 실행할 콜백 함수
 * @returns {Object} 남은 시간 객체
 */
export const useCountdown = (targetDate, onExpire) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetDate));
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false); // state 대신 ref 사용

  // onExpire 함수를 ref로 업데이트 (useEffect 재실행 방지)
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // 초기 계산
    const initial = calculateTimeLeft(targetDate);
    setTimeLeft(initial);

    // 이미 만료된 상태면 타이머 설정 안함
    if (initial.isExpired) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        // 콜백이 있으면 한 번만 실행 (비동기 처리로 무한 루프 방지)
        if (onExpireRef.current && typeof onExpireRef.current === 'function') {
          // 콜백을 변수에 저장해서 타이밍 이슈 방지
          const callback = onExpireRef.current;
          setTimeout(() => {
            // 다시 한 번 함수인지 체크
            if (typeof callback === 'function') {
              console.log('⏰ 카운트다운 종료 (초기 상태) - 자동 새로고침');
              callback();
            }
          }, 100);
        }
      }
      return;
    }

    // 아직 만료되지 않은 경우 hasExpired를 false로 리셋
    hasExpiredRef.current = false;

    // 1초마다 업데이트
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setTimeLeft(newTimeLeft);

      // 시간이 만료되면 콜백 실행 (한 번만)
      if (newTimeLeft.isExpired && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        clearInterval(timer);

        if (onExpireRef.current && typeof onExpireRef.current === 'function') {
          // 콜백을 변수에 저장해서 타이밍 이슈 방지
          const callback = onExpireRef.current;
          // 비동기 처리로 현재 렌더링 사이클과 분리
          setTimeout(() => {
            // 다시 한 번 함수인지 체크
            if (typeof callback === 'function') {
              console.log('⏰ 카운트다운 종료 - 자동 새로고침');
              callback();
            }
          }, 100);
        }
      }
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [targetDate]); // targetDate만 의존성으로 유지

  return timeLeft;
};

/**
 * 카운트다운을 읽기 쉬운 문자열로 변환
 * @param {Object} timeLeft - useCountdown의 반환값
 * @param {boolean} showMonths - 월 표시 여부
 * @returns {string} 포맷된 문자열
 */
export const formatCountdown = (timeLeft, showMonths = false) => {
  if (timeLeft.isExpired) {
    return '종료됨';
  }

  const parts = [];

  if (showMonths && timeLeft.months > 0) {
    parts.push(`${timeLeft.months}개월`);
  }

  if (showMonths) {
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}일`);
  } else {
    if (timeLeft.totalDays > 0) parts.push(`${timeLeft.totalDays}일`);
  }

  if (timeLeft.hours > 0 || parts.length > 0) {
    parts.push(`${timeLeft.hours}시간`);
  }

  if (timeLeft.minutes > 0 || parts.length > 0) {
    parts.push(`${timeLeft.minutes}분`);
  }

  parts.push(`${timeLeft.seconds}초`);

  return parts.join(' ');
};

export default useCountdown;

