import { useEffect, useRef } from 'react';
import api from '../services/api';
import { getQueueState, setQueueState, clearQueueState } from '../utils/queueState';

const DEFAULT_INTERVAL_MS = 15000;

export const useQueueHeartbeat = (eventId, options = {}) => {
  const { enabled = true, intervalMs = DEFAULT_INTERVAL_MS } = options;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !eventId) {
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return undefined;
    }

    const shouldRun = () => {
      const state = getQueueState();
      return state && state.eventId === eventId && (state.status === 'queued' || state.status === 'active');
    };

    const sendHeartbeat = async () => {
      if (!shouldRun() || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const response = await api.post(`/queue/heartbeat/${eventId}`);
        const status = response?.data?.status;
        if (status === 'queued' || status === 'active') {
          const current = getQueueState();
          if (!current || current.status !== status || current.eventId !== eventId) {
            setQueueState(eventId, status);
          }
        } else {
          clearQueueState(eventId);
        }
      } catch (error) {
        // Ignore transient errors; next heartbeat will retry.
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleUnload = () => {
      const state = getQueueState();
      if (!state || state.eventId !== eventId) {
        return;
      }

      const authToken = localStorage.getItem('token');
      if (!authToken) {
        return;
      }

      const baseUrl = api.defaults.baseURL || '/api';
      try {
        fetch(`${baseUrl}/queue/leave/${eventId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          keepalive: true,
          body: '{}',
        });
      } catch (error) {
        // Best-effort cleanup only.
      }
    };

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, intervalMs);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [eventId, enabled, intervalMs]);
};
