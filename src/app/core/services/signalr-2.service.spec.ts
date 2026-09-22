import {describe, expect, it} from 'vitest';

import {SignalRService2} from './signalr-2.service';

// Not wired into the app yet; this keeps it compiling alongside the rest of the SignalR code.
describe('SignalRService2', () => {
  it('should be constructable', () => {
    expect(new SignalRService2()).toBeTruthy();
  });
});
