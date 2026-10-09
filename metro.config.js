// TEMPORAL: solo para previsualizar en web. Se borra tras la comprobación.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: path.join(__dirname, '.tmp-web', 'maps-stub.js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
