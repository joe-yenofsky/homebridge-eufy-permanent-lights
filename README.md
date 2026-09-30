# homebridge-eufy-permanent-lights

HomeKit control of **eufy Permanent Outdoor Lights (E22 / T8L02)** via Homebridge — which eufy
ships with **no HomeKit or Matter support**. Talks to eufy's cloud with your account login, so it
works from anywhere: your Homebridge host does **not** need to be near the lights. Auto-discovers
the smart lights on your account and exposes each as a HomeKit **Lightbulb** with **power,
brightness, and RGB color**.

## Install

Install through the Homebridge UI (search "eufy permanent") or:

```bash
npm install -g homebridge-eufy-permanent-lights
```

Requires **Node 24.5+** and **Homebridge 1.6+**.

## Setup

Add the platform (or fill in the Homebridge UI settings form):

```json
{
  "platforms": [
    {
      "platform": "EufyCloudLights",
      "name": "Eufy Cloud Lights",
      "email": "you@example.com",
      "password": "your-eufy-password",
      "countryCode": "US"
    }
  ]
}
```

That's it — the plugin logs in, discovers your smart lights, and adds them to HomeKit. The login
session is cached (default: `<homebridge storage>/eufy-permanent-lights-session.json`) so it doesn't
re-log-in on every restart.

### If your account uses 2FA

A background plugin can't type a 2FA code, so establish the session **once** interactively. From the
installed plugin directory (e.g. `/var/lib/homebridge/node_modules/homebridge-eufy-permanent-lights`),
run it as the user Homebridge runs as so the session file is owned correctly:

```bash
sudo -u homebridge -H env PATH=/opt/homebridge/bin:$PATH \
  node scripts/cloud-login.mjs --session /var/lib/homebridge/eufy-permanent-lights-session.json
```

Set that same path as `sessionPath` in the config (or leave the default). After it succeeds, restart
Homebridge and the plugin reuses the session.

> Tip: don't run two clients on one eufy account with the same credentials at once — they displace
> each other's sessions. Let the plugin be the only automated client.

## Notes & limitations

- **Color** needs the strip's segment count, which arrives on the light's realtime channel shortly
  after connecting — the first color command may take a moment or retry once.
- State is **optimistic**: the light isn't reliably readable, so HomeKit reflects the last command
  sent (persisted across restarts).

## Development

```bash
npm run selftest   # checks the HSV->RGB conversion (no account/device needed)
```

Cloud control is provided by [`@mega-yfue/eufy-sdk`](https://github.com/mega-yfue/eufy-sdk).

## Legal

Unofficial; not affiliated with eufy/Anker. Controls your own devices with your own account. Use at
your own risk. MIT licensed.
