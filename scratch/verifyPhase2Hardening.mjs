import { handleCallback } from '../controllers/youtubeController.mjs';
import { debouncedEmit } from '../utils/socketDebouncer.mjs';
import Channel from '../models/Channel.mjs';
import mongoose from 'mongoose';

// Setup basic environment
process.env.JWT_SECRET = 'my_test_secret_123';

async function runTests() {
  console.log('--- Testing Socket.IO Debounced Room Emissions ---');

  let emittedRoom = null;
  let emittedEvent = null;
  let emittedData = null;
  let globalEmitCalled = false;

  const mockIo = {
    to: (room) => {
      emittedRoom = room;
      return {
        emit: (event, data) => {
          emittedEvent = event;
          emittedData = data;
        }
      };
    },
    emit: (event, data) => {
      globalEmitCalled = true;
      emittedEvent = event;
      emittedData = data;
    }
  };

  // Test Case 1: Room-targeted debounced emission
  debouncedEmit(mockIo, 'user_room_123', 'stats_updated', null, 0);

  await new Promise(resolve => setTimeout(resolve, 50));

  if (emittedRoom === 'user_room_123' && emittedEvent === 'stats_updated' && !globalEmitCalled) {
    console.log('✅ Test Case 1 Passed: Correctly emitted to specific room, avoiding global broadcast.');
  } else {
    console.error(`❌ Test Case 1 Failed: Expected room user_room_123 and stats_updated but got room: ${emittedRoom}, event: ${emittedEvent}, globalCalled: ${globalEmitCalled}`);
    process.exit(1);
  }

  // Test Case 2: Backward compatibility legacy fallback (no room parameter)
  emittedRoom = null;
  emittedEvent = null;
  emittedData = null;
  globalEmitCalled = false;

  debouncedEmit(mockIo, 'stats_updated', null, 0);

  await new Promise(resolve => setTimeout(resolve, 50));

  if (globalEmitCalled && emittedEvent === 'stats_updated' && emittedRoom === null) {
    console.log('✅ Test Case 2 Passed: Correctly fell back to global emit for legacy calls (preserving backward compatibility).');
  } else {
    console.error(`❌ Test Case 2 Failed: Expected global emit with stats_updated but got room: ${emittedRoom}, event: ${emittedEvent}, globalCalled: ${globalEmitCalled}`);
    process.exit(1);
  }

  console.log('\n--- All Phase 2 local validation test cases passed successfully! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
