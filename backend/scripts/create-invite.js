#!/usr/bin/env node
const invites = require('../src/data/invites');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { label: '', maxUses: null, expiresInDays: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--label' && args[i + 1]) {
      out.label = args[i + 1];
      i += 1;
    } else if (args[i] === '--max-uses' && args[i + 1]) {
      out.maxUses = parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === '--expires-days' && args[i + 1]) {
      out.expiresInDays = parseInt(args[i + 1], 10);
      i += 1;
    }
  }
  return out;
}

const opts = parseArgs();
let expiresAt = null;
if (opts.expiresInDays != null && opts.expiresInDays > 0) {
  expiresAt = new Date(Date.now() + opts.expiresInDays * 864e5).toISOString();
}

const { id, inviteToken } = invites.addInvite({
  label: opts.label,
  expiresAt,
  maxUses: Number.isFinite(opts.maxUses) ? opts.maxUses : null,
});

console.log('Invite id:', id);
console.log('Token (copy now; only a hash is stored on disk):');
console.log(inviteToken);
