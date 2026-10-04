import { findTown } from './geocode';

describe('findTown (fixture mode)', () => {
  it('finds a known town whatever the case or spacing', async () => {
    expect(await findTown('  Ballynahinch ')).toEqual({ lat: 54.4026, lng: -5.9163 });
  });
  it('does not find a misspelt town, or nothing at all', async () => {
    expect(await findTown('Ballynahinchh')).toBeNull();
    expect(await findTown('   ')).toBeNull();
  });
});
