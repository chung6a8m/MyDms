import { describe, expect, it } from 'vitest';
import { FOUNDATION_SCOPE, isFoundationOnly } from '../../apps/shared/src/scope';

describe('S6-0 engineering-only frontend guard', () => {
  it('does not claim Product Verification', () => {
    expect(FOUNDATION_SCOPE.productVerified).toBe(false);
    expect(FOUNDATION_SCOPE.tenantGoLiveAccepted).toBe(false);
  });
  it('keeps offline/cutover and blocked B disabled', () => {
    expect(isFoundationOnly()).toBe(true);
    expect(FOUNDATION_SCOPE.bNoChannelEnabled).toBe(false);
    expect(FOUNDATION_SCOPE.offlineWriteEnabled).toBe(false);
  });
});
