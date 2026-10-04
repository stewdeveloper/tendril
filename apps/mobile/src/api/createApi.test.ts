import { createApi } from './createApi';
import { FixtureApi } from './fixture/FixtureApi';

describe('createApi', () => {
  it('runs on the fixture API unless told otherwise, with the app latency', () => {
    for (const mode of [undefined, 'fixture']) {
      const api = createApi(mode);
      expect(api).toBeInstanceOf(FixtureApi);
      expect((api as FixtureApi).latencyMs).toBe(300);
    }
  });

  it('says plainly that Supabase mode is not built yet', () => {
    expect(() => createApi('supabase')).toThrow(/Phase 2/);
  });
});
