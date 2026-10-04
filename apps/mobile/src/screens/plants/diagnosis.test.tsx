import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { DiagnosisPhotosScreen } from './DiagnosisPhotosScreen';
import { DiagnosisScreen } from './DiagnosisScreen';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const noop = () => {};
const handlers = {
  photoLabel: 'Your photo: yellow leaves',
  plantName: 'Monty',
  onApply: noop,
  onRetake: noop,
  onTryPremium: noop,
  onNotNow: noop,
  onBack: noop,
};
const overwatering = {
  id: 'd1',
  conditionName: 'Overwatering',
  probability: 0.72,
  explanation: 'Yellow lower leaves and soft stems often mean the roots are staying wet.',
  planChange: { title: 'Pause watering', detail: 'Until two dry checks in a row' },
};
const notSure = {
  id: 'd2',
  conditionName: 'Not sure yet',
  probability: 0.34,
  explanation: 'Try a close photo of one affected leaf, in daylight.',
  planChange: null,
};

describe('DiagnosisScreen', () => {
  it('shows the result with the change to the plan, and applies it', async () => {
    const onApply = jest.fn();
    await wrap(
      <DiagnosisScreen {...handlers} state="result" result={overwatering} onApply={onApply} />,
    );
    expect(screen.getByText('Likely, 72%')).toBeTruthy();
    expect(screen.getByText('Overwatering')).toBeTruthy();
    expect(screen.getByText(overwatering.explanation)).toBeTruthy();
    expect(screen.getByText('Change to your plan')).toBeTruthy();
    expect(screen.getByText('Pause watering')).toBeTruthy();
    expect(screen.getByText('Until two dry checks in a row')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Apply to care plan' }));
    expect(onApply).toHaveBeenCalled();
  });

  it('says so when the plan could not be changed, and keeps the button from a second tap', async () => {
    await wrap(
      <DiagnosisScreen {...handlers} state="result" result={overwatering} applying applyFailed />,
    );
    expect(screen.getByText("Couldn't change your plan. Try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Apply to care plan, loading/ })).toBeDisabled();
  });

  it('not sure uses no diagnosis and offers a close photo', async () => {
    const onRetake = jest.fn();
    await wrap(
      <DiagnosisScreen {...handlers} state="not_sure" result={notSure} onRetake={onRetake} />,
    );
    expect(screen.getByText('Not sure, 34%')).toBeTruthy();
    expect(screen.getByText('Not sure yet')).toBeTruthy();
    expect(screen.getByText('Try a close photo of one affected leaf, in daylight.')).toBeTruthy();
    expect(screen.getByText("This didn't use your diagnosis.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a close photo' }));
    expect(onRetake).toHaveBeenCalled();
  });

  it('used up reads its words from the quota, and offers Premium or not now', async () => {
    const onTryPremium = jest.fn();
    const onNotNow = jest.fn();
    const onBack = jest.fn();
    await wrap(
      <DiagnosisScreen
        {...handlers}
        state="used_up"
        quota={{ kind: 'diagnosis', used: 1, limit: 1, resetsOn: '2026-11-01', plan: 'free' }}
        onTryPremium={onTryPremium}
        onNotNow={onNotNow}
        onBack={onBack}
      />,
    );
    expect(screen.getByText("You've used this month's diagnosis")).toBeTruthy();
    expect(
      screen.getByText('More arrive on 1 November, or get 10 a month with Premium.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Premium free for 7 days' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Monty' }));
    expect(onTryPremium).toHaveBeenCalled();
    expect(onNotNow).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it('used up on Premium offers no Premium', async () => {
    await wrap(
      <DiagnosisScreen
        {...handlers}
        state="used_up"
        quota={{ kind: 'diagnosis', used: 10, limit: 10, resetsOn: '2026-11-01', plan: 'premium' }}
      />,
    );
    expect(screen.getByText("You've used your 10 diagnoses this month")).toBeTruthy();
    expect(screen.queryByText('Try Premium free for 7 days')).toBeNull();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });
});

describe('DiagnosisPhotosScreen', () => {
  const photosHandlers = {
    plantName: 'Monty',
    onTake: noop,
    onChoose: noop,
    onRemove: noop,
    onCheck: noop,
    onBack: noop,
  };

  it('needs a photo before it checks, and counts them', async () => {
    const onCheck = jest.fn();
    await wrap(<DiagnosisPhotosScreen {...photosHandlers} photos={[]} onCheck={onCheck} />);
    expect(screen.getByText('Take photos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check its health' })).toBeDisabled();
    await wrap(<DiagnosisPhotosScreen {...photosHandlers} photos={['a', 'b']} onCheck={onCheck} />);
    expect(screen.getByText('2 of 3 photos')).toBeTruthy();
  });

  it('removes a photo by its number', async () => {
    const onRemove = jest.fn();
    await wrap(
      <DiagnosisPhotosScreen {...photosHandlers} photos={['a', 'b']} onRemove={onRemove} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 2' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('at three photos the picker buttons are off', async () => {
    await wrap(<DiagnosisPhotosScreen {...photosHandlers} photos={['a', 'b', 'c']} />);
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeDisabled();
    expect(screen.getByText('That is three photos, the most we can use.')).toBeTruthy();
  });

  it('shows what went wrong', async () => {
    await wrap(
      <DiagnosisPhotosScreen
        {...photosHandlers}
        photos={['a']}
        error="Couldn't check your plant. Try again."
      />,
    );
    expect(screen.getByText("Couldn't check your plant. Try again.")).toBeTruthy();
  });
});
