const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

exports.createDatabase = async function createDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create role anon; create role authenticated;');
  await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/001_schema.sql'),'utf8'));
  const rpc = (name, payload = {}, role = 'anon') => db.transaction(async tx => {
    if (!['anon','authenticated'].includes(role)) throw new Error('Invalid test role');
    await tx.exec('set local role ' + role);
    const definitions = {
      usb_api: ['p_action','p_payload','p_session_token'], usb_login: ['p_email','p_password'],
      usb_register: ['p_payload'],usb_logout: ['p_session_token'],
    };
    if (!definitions[name]) throw new Error('Unknown RPC');
    const keys = definitions[name];
    const values = keys.map(key => key === 'p_payload' ? JSON.stringify(payload[key] || {}) : payload[key] ?? null);
    return (await tx.query(`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values)).rows[0].result;
  });
  return {db,rpc};
};
