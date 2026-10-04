const { dirname, join } = require('node:path');

// lucide ships ES modules under the "react-native" condition, which jest does not transform. Its
// CommonJS build (what Node resolves) needs no transforming.
const lucideCjs = dirname(require.resolve('lucide-react-native'));

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  // The first test that renders an Animated component transforms react-native's animation modules
  // on a cold cache, which takes more than jest's default 5 s on a busy machine.
  testTimeout: 30000,
  moduleNameMapper: {
    // Order matters: the specific @/assets mapping must come before the general @/ one.
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-maps$': '<rootDir>/src/testing/reactNativeMapsMock.tsx',
    '^lucide-react-native$': join(lucideCjs, 'lucide-react-native.js'),
    '^lucide-react-native/icons/(.*)$': join(lucideCjs, 'icons', '$1.js'),
  },
};
