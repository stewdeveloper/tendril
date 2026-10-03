import { fireEvent, render, screen } from '@testing-library/react-native';
import Index from './index';

describe('Index', () => {
  it('renders a core-formatted confidence label and updates state through a hook', async () => {
    await render(<Index />);
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(await screen.findByText('Not sure, 41%')).toBeTruthy();
  });
});
