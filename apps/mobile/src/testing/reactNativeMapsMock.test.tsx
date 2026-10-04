import { render, screen } from '@testing-library/react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

describe('react-native-maps mock', () => {
  it('renders the map, its marker and its circle as plain views, keeping their props', async () => {
    await render(
      <MapView
        testID="map"
        initialRegion={{ latitude: 53, longitude: -6, latitudeDelta: 1, longitudeDelta: 1 }}
      >
        <Marker testID="pin" coordinate={{ latitude: 53, longitude: -6 }} />
        <Circle testID="area" center={{ latitude: 53, longitude: -6 }} radius={500} />
      </MapView>,
    );
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByTestId('pin').props.coordinate).toEqual({ latitude: 53, longitude: -6 });
    expect(screen.getByTestId('area').props.radius).toBe(500);
  });
});
