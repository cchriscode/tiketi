const QUEUE_STATE_KEY = 'queueState';

export const getQueueState = () => {
  try {
    const raw = localStorage.getItem(QUEUE_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const setQueueState = (eventId, status) => {
  if (!eventId || !status) {
    return;
  }
  const nextState = {
    eventId,
    status,
    updatedAt: Date.now(),
  };
  localStorage.setItem(QUEUE_STATE_KEY, JSON.stringify(nextState));
};

export const clearQueueState = (eventId) => {
  const current = getQueueState();
  if (!current) {
    return;
  }
  if (!eventId || current.eventId === eventId) {
    localStorage.removeItem(QUEUE_STATE_KEY);
  }
};
