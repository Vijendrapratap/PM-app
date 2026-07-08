// Defensive belt-and-suspenders: some deploy pipelines (tar/zip re-extraction,
// certain CI copy steps, restrictive umasks) can strip the executable bit off
// node_modules/.bin/* shims after `npm install` already set it correctly.
// This re-applies it. Runs as a postinstall hook; no-ops safely on Windows
// and never fails the install if node_modules/.bin doesn't exist yet.
const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'node_modules', '.bin');

try {
  if (!fs.existsSync(binDir)) process.exit(0);

  for (const name of fs.readdirSync(binDir)) {
    const filePath = path.join(binDir, name);
    try {
      fs.chmodSync(filePath, 0o755);
    } catch {
      // Best-effort; ignore individual failures (e.g. Windows permission quirks).
    }
  }
} catch {
  // Never fail npm install because of this.
}
