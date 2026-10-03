/** The dev catalog is reachable in dev builds, or in a web export built with EXPO_PUBLIC_CATALOG=1. */
export const catalogEnabled: boolean = __DEV__ || process.env.EXPO_PUBLIC_CATALOG === '1';
