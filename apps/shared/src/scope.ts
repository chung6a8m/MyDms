// Engineering-only UI status: does not authorize transactions or feature gates.
export const FOUNDATION_SCOPE = Object.freeze({
  productVerified: false,
  tenantGoLiveAccepted: false,
  offlineWriteEnabled: false,
  productionCutoverEnabled: false,
  bNoChannelEnabled: false,
  tadr01Approved: false,
  tadr02Approved: false
});

export function isFoundationOnly(): boolean {
  return !FOUNDATION_SCOPE.productVerified &&
    !FOUNDATION_SCOPE.tenantGoLiveAccepted &&
    !FOUNDATION_SCOPE.offlineWriteEnabled &&
    !FOUNDATION_SCOPE.productionCutoverEnabled &&
    !FOUNDATION_SCOPE.bNoChannelEnabled;
}
