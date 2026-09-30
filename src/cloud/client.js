'use strict';

// Shared cloud client wrapping @mega-yfue/eufy-sdk. The SDK is ESM-only, so this CommonJS module
// loads it via dynamic import(). One client per account: log in once, reuse across all lights.
// See FINDINGS.md / cloud validation. Requires Node >= 24.5 (the SDK's floor).

let _sdkPromise = null;
function sdk() {
  if (!_sdkPromise) _sdkPromise = import('@mega-yfue/eufy-sdk');
  return _sdkPromise;
}

class EufyCloud {
  constructor({ email, password, countryCode, sessionPath, log }) {
    this.email = email;
    this.password = password;
    this.countryCode = countryCode || 'US';
    this.sessionPath = sessionPath;
    this.log = log;
    this.eufy = null;
    this._ready = null;
  }

  // Idempotent login. Rejects clearly if 2FA/captcha is required (a background plugin can't prompt).
  connect() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      const { EufyMega, FileSessionStore, LoginStatus } = await sdk();
      this.eufy = new EufyMega({
        email: this.email,
        password: this.password,
        countryCode: this.countryCode,
        store: new FileSessionStore(this.sessionPath),
      });
      let r = await this.eufy.login();
      while (r.status !== LoginStatus.Ok) {
        if (r.status === LoginStatus.TwoFactor || r.status === LoginStatus.Captcha) {
          throw new Error(
            'eufy login needs 2FA/captcha, which a background plugin cannot do interactively. ' +
            'Run the one-time setup (README: "npm run cloud-login" in the plugin dir) to establish a ' +
            'session at the configured sessionPath, then restart Homebridge.'
          );
        }
        throw new Error('unexpected eufy login status: ' + JSON.stringify(r));
      }
      this.log.info('eufy cloud: logged in; realtime channel up');
    })().catch((e) => { this._ready = null; throw e; });
    return this._ready;
  }

  // Discover smart-light devices (T8L0x family). Returns [{ sn, name, model, device }] where
  // `device` is the full capability-bound Device (keep the reference for realtime state).
  async discoverLights() {
    await this.connect();
    const records = await this.eufy.getDevices();
    const lights = [];
    for (const rec of records) {
      let device;
      try {
        device = await this.eufy.getDevice(rec.sn);
      } catch (e) {
        this.log.debug(`getDevice(${rec.sn}) failed: ${e.message}`);
        continue;
      }
      const hasSmartLight = typeof device.smartLight === 'function' && !!device.smartLight();
      if (hasSmartLight) {
        lights.push({ sn: rec.sn, name: rec.name, model: rec.model, device });
      }
    }
    return lights;
  }

  async close() {
    try { await this.eufy?.close?.(); } catch (_) { /* ignore */ }
    try { await this.eufy?.dispose?.(); } catch (_) { /* ignore */ }
  }
}

module.exports = { EufyCloud };
