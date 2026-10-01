// Usage: npm run admin:create -- owner@example.com
// Creates the admin, or resets the password if the email already exists.

// db.js and auth.js are imported after the arguments are checked, so a typo
// gets the usage hint instead of a database or config error.

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) {
      let data = '';
      stdin.setEncoding('utf8');
      stdin.once('data', (d) => { data = String(d).split(/\r?\n/)[0] ?? ''; stdin.pause(); resolve(data); });
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData);
        process.stdout.write('\n'); resolve(value);
      } else if (ch === '\u0003') process.exit(1);
      else if (ch === '\u007f') value = value.slice(0, -1);
      else value += ch;
    };
    stdin.on('data', onData);
  });
}

const email = (process.argv[2] ?? '').toLowerCase().trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- owner@example.com');
  console.error('Note the space after "--". Without it, npm swallows the email as one of its own options.');
  process.exit(1);
}
const pw = await prompt('Password (12+ characters): ');
if (pw.length < 12) { console.error('Too short.'); process.exit(1); }
if (process.stdin.isTTY) {
  const again = await prompt('Again: ');
  if (again !== pw) { console.error("Passwords don't match."); process.exit(1); }
}
const { get, run } = await import('../db.js');
const { hashPassword } = await import('../lib/auth.js');
const { salt, hash } = hashPassword(pw);
const existing = get<{ id: number }>('SELECT id FROM admins WHERE email = ?', [email]);
if (existing) {
  run('UPDATE admins SET salt = ?, password_hash = ? WHERE id = ?', [salt, hash, existing.id]);
  run('DELETE FROM sessions WHERE admin_id = ?', [existing.id]);
  console.log(`Password reset for ${email}. Existing sessions signed out.`);
} else {
  run('INSERT INTO admins (email, salt, password_hash) VALUES (?, ?, ?)', [email, salt, hash]);
  console.log(`Admin created: ${email}`);
}
