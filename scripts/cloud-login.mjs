// One-time interactive eufy login to establish a persisted session for the cloud platform.
// Only needed if your account uses 2FA/captcha (the background plugin can't prompt). Otherwise the
// plugin logs in directly from the email/password in its config.
//
// Run it as the user Homebridge runs as, so the session file is owned correctly, e.g. on hb-service:
//   sudo -u homebridge -H env PATH=/opt/homebridge/bin:$PATH \
//     node scripts/cloud-login.mjs --session /var/lib/homebridge/eufy-permanent-lights-session.json
// Then set the same path as "sessionPath" in the plugin config (or leave the plugin default).
import { EufyMega, FileSessionStore, LoginStatus } from '@mega-yfue/eufy-sdk';
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';

function ask(query, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    if (hidden) { rl._writeToOutput = (s) => { if (!rl.muted) rl.output.write(s); }; rl.muted = false; }
    rl.question(query, (val) => { rl.close(); if (hidden) output.write('\n'); resolve(val.trim()); });
    if (hidden) rl.muted = true;
  });
}

const argSession = (() => {
  const i = process.argv.indexOf('--session');
  return i >= 0 ? process.argv[i + 1] : (process.env.SESSION_PATH || './eufy-permanent-lights-session.json');
})();

const email = process.env.EUFY_EMAIL || (await ask('eufy email: '));
const password = process.env.EUFY_PASSWORD || (await ask('eufy password: ', { hidden: true }));
const countryCode = process.env.EUFY_COUNTRY || (await ask('country code [US]: ')) || 'US';

const eufy = new EufyMega({ email, password, countryCode, store: new FileSessionStore(argSession) });

try {
  console.log(`Logging in (session will be saved to ${argSession})...`);
  let r = await eufy.login();
  while (r.status !== LoginStatus.Ok) {
    if (r.status === LoginStatus.TwoFactor) {
      r = await eufy.submitVerifyCode(await ask('Enter the 2FA code: '));
    } else if (r.status === LoginStatus.Captcha) {
      try { fs.writeFileSync('captcha.png', Buffer.from(String(r.image).split(',')[1], 'base64')); } catch {}
      console.log('Captcha required — saved to ./captcha.png; open it.');
      r = await eufy.solveCaptcha(await ask('Enter the captcha text: '));
    } else {
      console.error('Unexpected login status:', JSON.stringify(r));
      process.exit(1);
    }
  }
  const devices = await eufy.getDevices();
  console.log(`LOGIN OK — session saved. ${devices.length} device(s) on the account.`);
  console.log('You can now start/restart Homebridge; the plugin will reuse this session.');
} catch (e) {
  console.error('ERROR:', e?.message || e);
  process.exit(1);
} finally {
  try { await eufy.close?.(); } catch {}
  try { await eufy.dispose?.(); } catch {}
  process.exit(0);
}
