'use strict';

const { hsvToRgb } = require('../color');

const APPLY_DEBOUNCE_MS = 200;

// One HomeKit Lightbulb backed by a cloud smart light (dev.smartLight()). State is optimistic:
// the device's real state arrives only over realtime MQTT, so HomeKit reflects the last command.
class EufyCloudLightAccessory {
  constructor(platform, accessory, ctx) {
    this.platform = platform;
    this.log = platform.log;
    this.accessory = accessory;
    this.device = ctx.device; // full capability-bound Device (holds realtime state)
    this.sn = ctx.sn;
    this.displayName = accessory.displayName;

    this.state = { on: false, brightness: 100, hue: 0, saturation: 0 };
    this._dirty = { power: false, brightness: false, color: false };
    this._timer = null;

    const { Service, Characteristic } = platform.api.hap;
    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(Characteristic.Model, ctx.model || 'T8L0x')
      .setCharacteristic(Characteristic.SerialNumber, ctx.sn);

    const svc = accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb, accessory.displayName);
    this.service = svc;

    svc.getCharacteristic(Characteristic.On)
      .onGet(() => this.state.on)
      .onSet((v) => { this.state.on = !!v; this._dirty.power = true; this._schedule(); });
    svc.getCharacteristic(Characteristic.Brightness)
      .onGet(() => this.state.brightness)
      .onSet((v) => { this.state.brightness = v; if (v > 0) { this.state.on = true; this._dirty.power = true; } this._dirty.brightness = true; this._schedule(); });
    svc.getCharacteristic(Characteristic.Hue)
      .onGet(() => this.state.hue)
      .onSet((v) => { this.state.hue = v; this._dirty.color = true; this._schedule(); });
    svc.getCharacteristic(Characteristic.Saturation)
      .onGet(() => this.state.saturation)
      .onSet((v) => { this.state.saturation = v; this._dirty.color = true; this._schedule(); });
  }

  _light() { return this.device.smartLight(); }

  _schedule() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._apply().catch((e) => this.log.warn(`[${this.displayName}] apply failed: ${e.message}`));
    }, APPLY_DEBOUNCE_MS);
  }

  async _apply() {
    const dirty = this._dirty;
    this._dirty = { power: false, brightness: false, color: false };
    const light = this._light();

    if (!this.state.on) { await light.off(); return; }
    if (dirty.power) await light.on();
    if (dirty.brightness) await light.setBrightness(Math.max(0, Math.min(100, Math.round(this.state.brightness))));
    if (dirty.color) {
      const [r, g, b] = hsvToRgb(this.state.hue, this.state.saturation, 100);
      await this._setColorSafe(light, { red: r, green: g, blue: b });
    }
  }

  // setColor needs a reported segment count (lightLength) from realtime MQTT; if it isn't in yet,
  // request a refresh and retry once.
  async _setColorSafe(light, rgb) {
    try {
      await light.setColor(rgb);
    } catch (e) {
      if (/segment count/i.test(e.message || '')) {
        try { if (typeof light.refreshState === 'function') await light.refreshState(); } catch (_) { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1500));
        await this.device.smartLight().setColor(rgb);
      } else {
        throw e;
      }
    }
  }

  async shutdown() {
    if (this._timer) clearTimeout(this._timer);
  }
}

module.exports = { EufyCloudLightAccessory };
