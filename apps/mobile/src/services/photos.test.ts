import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { digest } from 'expo-crypto';
import { MAX_PHOTO_PIXELS, preparePhoto } from './photos';

jest.mock('expo-image-manipulator', () => {
  const save = jest.fn();
  const resize = jest.fn();
  const render = jest.fn();
  const manipulate = jest.fn();
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate },
    __mocks: { save, resize, render, manipulate },
  };
});
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(),
}));

const { save, resize, render, manipulate } = (
  jest.requireMock('expo-image-manipulator') as {
    __mocks: Record<'save' | 'resize' | 'render' | 'manipulate', jest.Mock>;
  }
).__mocks;

// "hi" in base64, and the SHA-256 bytes 0x01 0x02 0xab.
const BASE64 = 'aGk=';

describe('preparePhoto', () => {
  beforeEach(() => {
    const context = { resize, renderAsync: render };
    manipulate.mockReset().mockReturnValue(context);
    resize.mockReset().mockReturnValue(context);
    render.mockReset().mockResolvedValue({ saveAsync: save });
    save
      .mockReset()
      .mockResolvedValue({ uri: 'file:///out.jpg', width: 1000, height: 750, base64: BASE64 });
    (digest as jest.Mock).mockReset().mockResolvedValue(new Uint8Array([1, 2, 0xab]).buffer);
  });

  it('shrinks a large photo to at most 2,000,000 pixels, keeping its shape', async () => {
    await preparePhoto('file:///big.jpg', 4000, 3000);
    expect(manipulate).toHaveBeenCalledWith('file:///big.jpg');
    const { width } = resize.mock.calls[0]![0] as { width: number };
    const height = Math.round((width * 3000) / 4000);
    expect(width * height).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);
    expect(width * height).toBeGreaterThan(MAX_PHOTO_PIXELS * 0.97);
  });

  it('leaves a photo that is already small at its size', async () => {
    await preparePhoto('file:///small.jpg', 1200, 900);
    expect(resize).not.toHaveBeenCalled();
  });

  it('saves a JPEG at 0.85 with base64, and returns its uri, size, base64 and sha256', async () => {
    const out = await preparePhoto('file:///big.jpg', 4000, 3000);
    expect(save).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(1);
    expect(out).toEqual({
      uri: 'file:///out.jpg',
      base64: BASE64,
      sha256: '0102ab',
      width: 1000,
      height: 750,
    });
    // The hash is of the bytes the base64 stands for ("hi"), not of the text.
    const bytes = (digest as jest.Mock).mock.calls[0]![1] as Uint8Array;
    expect(Array.from(bytes)).toEqual([104, 105]);
  });

  it('fails when the manipulator gives no base64', async () => {
    save.mockResolvedValue({ uri: 'file:///out.jpg', width: 10, height: 10 });
    await expect(preparePhoto('file:///x.jpg', 10, 10)).rejects.toThrow();
  });
});
