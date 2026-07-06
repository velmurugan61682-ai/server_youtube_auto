/**
 * ✅ PERFORMANCE: Debouncer for Socket.io emissions
 * Prevents excessive re-renders by emitting max once per second
 */

const debouncedEmitters = new Map();

export const debouncedEmit = (io, eventName, data = null, delayMs = 1000) => {
  const key = `${eventName}`;
  
  if (debouncedEmitters.has(key)) {
    // Already scheduled, skip
    return;
  }
  
  // Schedule emission
  const timeoutId = setTimeout(() => {
    io.emit(eventName, data);
    debouncedEmitters.delete(key);
  }, delayMs);
  
  debouncedEmitters.set(key, timeoutId);
};

export default debouncedEmit;
