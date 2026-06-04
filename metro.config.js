const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'wasm',
  'data',
  'tflite',
  'bin',
];

// Node modules ko mock karo — React Native mein nahi hote
config.resolver.extraNodeModules = {
  fs: require.resolve('./src/mocks/empty-module.js'),
  path: require.resolve('./src/mocks/empty-module.js'),
  crypto: require.resolve('./src/mocks/empty-module.js'),
};

module.exports = config;