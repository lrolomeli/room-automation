const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '.', '');
console.log(DATA_DIR);

const INVITES_FILE = path.join(DATA_DIR, 'invites.json');

function ensureFile() {
  if (!fs.existsSync(INVITES_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(INVITES_FILE, JSON.stringify({ invites: [] }, null, 2));
  }
}

function loadRaw() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8'));
  } catch {
    return { invites: [] };
  }
}

function saveRaw(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INVITES_FILE, JSON.stringify(data, null, 2));
}

function hashToken(token) {
  const pepper = process.env.INVITE_PEPPER || '';
  return crypto.createHash('sha256').update(pepper + token, 'utf8').digest('hex');
}

function redeemInvite(plaintextToken) {
  const trimmed = String(plaintextToken || '').trim();
  if (!trimmed) return { ok: false, reason: 'invalid' };

  const h = hashToken(trimmed);
  const data = loadRaw();
  const inv = data.invites.find((i) => i.tokenHash === h);
  if (!inv) return { ok: false, reason: 'invalid' };
  if (inv.revoked) return { ok: false, reason: 'revoked' };
  if (inv.expiresAt && Date.now() > new Date(inv.expiresAt).getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (inv.maxUses != null && inv.usedCount >= inv.maxUses) {
    return { ok: false, reason: 'depleted' };
  }

  inv.usedCount = (inv.usedCount || 0) + 1;
  inv.lastUsedAt = new Date().toISOString();
  saveRaw(data);
  return { ok: true };
}

function addInvite({ label, expiresAt, maxUses } = {}) {
  ensureFile();
  const plaintext = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(plaintext);
  const data = loadRaw();
  const id = crypto.randomBytes(8).toString('hex');
  data.invites.push({
    id,
    tokenHash,
    label: label || '',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
    maxUses: maxUses != null && Number.isFinite(Number(maxUses)) ? Number(maxUses) : null,
    usedCount: 0,
    revoked: false,
  });
  saveRaw(data);
  return { id, inviteToken: plaintext };
}

function revokeInvite(id) {
  const data = loadRaw();
  const inv = data.invites.find((i) => i.id === id);
  if (!inv) return false;
  inv.revoked = true;
  saveRaw(data);
  return true;
}

function listInvitesMeta() {
  const data = loadRaw();
  return data.invites.map(
    ({ id, label, createdAt, expiresAt, maxUses, usedCount, revoked, lastUsedAt }) => ({
      id,
      label,
      createdAt,
      expiresAt,
      maxUses,
      usedCount,
      revoked,
      lastUsedAt,
    }),
  );
}

module.exports = {
  redeemInvite,
  addInvite,
  revokeInvite,
  listInvitesMeta,
};
