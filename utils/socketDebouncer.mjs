/**
 * ✅ PERFORMANCE: Debouncer for Socket.io emissions
 * Prevents excessive re-renders by emitting max once per second
 */

const debouncedEmitters = new Map();

export const debouncedEmit = (io, roomNameOrEvent, eventNameOrData, data = null, delayMs = 1000) => {
  let roomName = null;
  let eventName = null;
  let actualData = data;
  let actualDelay = delayMs;

  if (typeof eventNameOrData === 'string') {
    roomName = roomNameOrEvent;
    eventName = eventNameOrData;
  } else {
    roomName = null;
    eventName = roomNameOrEvent;
    actualData = eventNameOrData;
    if (typeof data === 'number') {
      actualDelay = data;
    }
  }

  const key = roomName ? `${roomName}_${eventName}` : `${eventName}`;
  
  if (debouncedEmitters.has(key)) {
    return;
  }
  
  const timeoutId = setTimeout(() => {
    if (roomName) {
      io.to(roomName).emit(eventName, actualData);
    } else {
      io.emit(eventName, actualData);
    }
    debouncedEmitters.delete(key);
  }, actualDelay);
  
  debouncedEmitters.set(key, timeoutId);
};

export default debouncedEmit;
