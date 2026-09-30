'use strict';

const { EufyCloudLightsPlatform, PLATFORM_NAME } = require('./cloud/platform');

module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, EufyCloudLightsPlatform);
};
