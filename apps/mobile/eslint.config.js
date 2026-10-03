const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*'] },
  {
    rules: {
      // The package root pulls in all 1,500 icons: a slow dev bundle and a slow jest suite.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message: 'import icons from lucide-react-native/icons/<name>',
            },
          ],
        },
      ],
    },
  },
]);
