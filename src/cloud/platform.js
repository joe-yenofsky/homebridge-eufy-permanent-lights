'use strict';

const path = require('node:path');
const { EufyCloud } = require('./client');
const { EufyCloudLightAccessory } = require('./light');

const PLUGIN_NAME = 'homebridge-eufy-permanent-lights';
const PLATFORM_NAME = 'EufyCloudLights';

class EufyCloudLightsPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = [];
    this.handlers = [];

    if (!this.config.email || !this.config.password) {
      this.log.error('EufyCloudLights: "email" and "password" are required — platform disabled.');
      return;
    }

    const sessionPath = this.config.sessionPath
      || path.join(api.user.storagePath(), 'eufy-permanent-lights-session.json');

    this.client = new EufyCloud({
      email: this.config.email,
      password: this.config.password,
      countryCode: this.config.countryCode || 'US',
      sessionPath,
      log: this.log,
    });

    this.api.on('didFinishLaunching', () => this.discoverDevices());
    this.api.on('shutdown', () => { try { this.client && this.client.close(); } catch (_) { /* ignore */ } });
  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    let lights;
    try {
      lights = await this.client.discoverLights();
    } catch (e) {
      this.log.error(`EufyCloudLights: ${e.message}`);
      return;
    }
    if (!lights.length) {
      this.log.warn('EufyCloudLights: no smart-light devices found on the account.');
      return;
    }

    const valid = new Set();
    for (const l of lights) {
      const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:cloud:${l.sn}`);
      valid.add(uuid);

      let accessory = this.accessories.find((a) => a.UUID === uuid);
      if (accessory) {
        this.api.updatePlatformAccessories([accessory]);
        this.log.info(`Restored cloud light "${l.name}" (${l.model}, ${l.sn})`);
      } else {
        accessory = new this.api.platformAccessory(l.name || l.model || l.sn, uuid);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.info(`Added cloud light "${l.name}" (${l.model}, ${l.sn})`);
      }
      accessory.context.sn = l.sn;

      try {
        this.handlers.push(new EufyCloudLightAccessory(this, accessory, l));
      } catch (e) {
        this.log.error(`Failed to set up "${l.name}": ${e.message}`);
      }
    }

    const stale = this.accessories.filter((a) => !valid.has(a.UUID));
    if (stale.length) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, stale);
      this.log.info(`Removed ${stale.length} stale cloud accessory(ies).`);
    }
  }
}

module.exports = { EufyCloudLightsPlatform, PLUGIN_NAME, PLATFORM_NAME };
