import { confidenceLabel } from '@tendril/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const [probability, setProbability] = useState(0.94);
  return (
    <View style={styles.container}>
      <Text>Tendril</Text>
      <Pressable accessibilityRole="button" onPress={() => setProbability(0.41)}>
        <Text>{confidenceLabel(probability)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFAF6',
  },
});
