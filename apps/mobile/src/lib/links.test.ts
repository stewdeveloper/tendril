import { mapsUrl, telUrl } from './links';

describe('telUrl', () => {
  it('keeps digits and a leading plus, and drops spaces, dashes, dots and brackets', () => {
    expect(telUrl('+353 1 478 0000')).toBe('tel:+35314780000');
    expect(telUrl('(01) 478-0000')).toBe('tel:014780000');
    expect(telUrl('01.478.0000')).toBe('tel:014780000');
  });
  it('drops a plus that is not first, and anything that is not a number', () => {
    expect(telUrl('0044+20 7946 0958')).toBe('tel:00442079460958');
    expect(telUrl('Call 999; rm -rf')).toBe('tel:999');
    expect(telUrl('tel:+1 555 0100')).toBe('tel:+15550100');
  });
  it('has nothing to dial for text with no digits', () => {
    expect(telUrl('')).toBeNull();
    expect(telUrl('no number')).toBeNull();
  });
});

describe('mapsUrl', () => {
  it('searches maps for a place or address, escaped', () => {
    expect(mapsUrl('Greenfield Vets, 12 Main St & Co')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Greenfield%20Vets%2C%2012%20Main%20St%20%26%20Co',
    );
  });
});
