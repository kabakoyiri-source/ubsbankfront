const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const { MongoClient, BSON } = require('mongodb');
const { EJSON } = BSON;
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'supabase/exports');
const id = value => value == null ? null : String(value);
const literal = value => {
  if (value == null) return 'null';
  if (value instanceof Date) value = value.toISOString();
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Non-finite source number'); return String(value); }
  return "'" + String(value).replaceAll("'", "''") + "'";
};
const json = value => literal(JSON.stringify(value)) + '::jsonb';
function insert(table, values, conflict = 'on conflict do nothing') {
  return `insert into ${table} (${Object.keys(values).join(',')}) values (${Object.values(values).join(',')}) ${conflict};`;
}
function convert(snapshot) {
  const collections = snapshot.collections;
  for (const name of ['users','clients','operations']) if (!Array.isArray(collections[name])) throw new Error(`Missing source collection: ${name}`);
  const users = new Map(collections.users.map(u => [id(u._id), id(u._id)]));
  const clients = new Map(collections.clients.map(c => [id(c._id), c]));
  const emails = new Set();
  for (const u of collections.users) {
    if (!u.email || emails.has(u.email.toLowerCase()) || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(u.password)) throw new Error('Invalid/duplicate email or unsupported password hash in source users');
    emails.add(u.email.toLowerCase());
  }
  for (const c of collections.clients) if (!users.has(id(c.userId))) throw new Error('A beneficiary has no valid owner; source requires reconciliation');
  for (const o of collections.operations) {
    if (!users.has(id(o.userId)) || (o.clientId && (!clients.has(id(o.clientId)) || id(clients.get(id(o.clientId)).userId) !== id(o.userId)))) throw new Error('An operation has a missing or cross-account reference');
    if (!Number.isSafeInteger(Math.round(o.amount * 100)) || Math.abs(o.amount * 100 - Math.round(o.amount * 100)) > .001) throw new Error('Operation amount cannot be represented exactly in cents');
  }
  const lines = ['-- PRIVATE: real Atlas data and password hashes. Never publish or commit this file.',
    '-- Import once into the target Supabase project after 001_schema.sql.',
    '-- Re-running does not overwrite existing destination records.', 'begin;', 'set local standard_conforming_strings=on;'];
  for (const u of collections.users) {
    const uid = users.get(id(u._id));
    lines.push(insert('public.usb_users', {id:literal(uid), mongo_id:literal(id(u._id)),email:literal(u.email.toLowerCase()),password_hash:literal(u.password),first_name:literal(u.firstName || ''),last_name:literal(u.lastName || ''),
      role:literal(u.role || 'user'),ledger_revision:literal(u.ledgerRevision || 0),balances:json(u.balances || {CHF:0,EUR:0,USD:0}),created_at:literal(u.createdAt || snapshot.exportedAt),updated_at:literal(u.updatedAt || snapshot.exportedAt)},
      'on conflict(id) do nothing'));
  }
  for (const c of collections.clients) lines.push(insert('public.usb_beneficiaries', {
    id:literal(id(c._id)),user_id:literal(users.get(id(c.userId))),first_name:literal(c.firstName || ''),last_name:literal(c.lastName),email:literal(c.email),phone:literal(c.phone),address:c.address ? json(c.address) : 'null',
    account_number:literal(c.accountNumber),bank_name:literal(c.bankName),swift_code:literal(c.swiftCode),bank_address:literal(c.bankAddress),balance:literal(c.balance || 0),status:literal(c.status || 'active'),
    deleted_at:literal(c.deletedAt),created_at:literal(c.createdAt || snapshot.exportedAt),updated_at:literal(c.updatedAt || snapshot.exportedAt),
  }));
  for (const o of collections.operations) lines.push(insert('public.usb_operations', {
    id:literal(id(o._id)),user_id:literal(users.get(id(o.userId))),beneficiary_id:literal(id(o.clientId)),type:literal(o.type),amount:literal(o.amount),currency:literal(o.currency || 'CHF'),
    description:literal(o.description),reason:literal(o.reason),recipient_account_number:literal(o.recipientAccountNumber),admin_account_type:literal(o.adminAccountType),
    admin_account_name:literal(o.adminAccountName),admin_account_iban:literal(o.adminAccountIban),transfer_type:literal(o.transferType || 'instant'),transfer_speed:literal(o.transferSpeed),
    is_scheduled:literal(o.isScheduled || false),status:literal(o.status || 'pending'),balance_after:literal(o.balanceAfter),created_at:literal(o.createdAt || snapshot.exportedAt),updated_at:literal(o.updatedAt || snapshot.exportedAt),
  }));
  for (const [name, documents] of Object.entries(collections)) for (const document of documents) {
    lines.push(insert('usb_private.usb_migration_documents', {collection:literal(name),mongo_id:literal(id(document._id)),document:literal(EJSON.stringify(document,{relaxed:false})) + '::jsonb'}));
  }
  for (const [source, table] of [['users','usb_users'],['clients','usb_beneficiaries'],['operations','usb_operations']]) {
    const ids = collections[source].map(d => literal(source==='users' ? users.get(id(d._id)) : id(d._id))).join(',');
    if (ids) lines.push(`do $usb$ begin if (select count(*) from public.${table} where id in (${ids}))<>${collections[source].length} then raise exception 'Atlas import count mismatch: ${table}'; end if; end $usb$;`);
  }
  lines.push('commit;', '-- Expected source counts: ' + JSON.stringify(Object.fromEntries(Object.entries(collections).map(([k,v]) => [k,v.length]))));
  return lines.join('\n') + '\n';
}
async function main() {
  fs.mkdirSync(output,{recursive:true});
  const args = process.argv.slice(2);
  let snapshot;
  if (args.includes('--snapshot')) {
    snapshot = EJSON.parse(fs.readFileSync(path.resolve(args[args.indexOf('--snapshot')+1]),'utf8'));
  } else {
    const defaultEnv = [path.resolve(root,'../backend/.env'),path.resolve(root,'../.migration-archive/backend-before-supabase/.env')].find(file=>fs.existsSync(file));
    const envFile = args.includes('--env-file') ? path.resolve(args[args.indexOf('--env-file')+1]) : defaultEnv;
    const env = envFile && fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile,'utf8')) : {};
    const uri = process.env.MONGODB_URI || env.MONGODB_URI;
    if (!uri) throw new Error('Set MONGODB_URI or pass --env-file pointing to a private export environment file');
    const connection = new MongoClient(uri,{serverSelectionTimeoutMS:20000});
    try {
      await connection.connect();
      const db = connection.db();
      snapshot = {exportedAt:new Date().toISOString(),database:db.databaseName,collections:{}};
      const names = await db.listCollections({},{nameOnly:true}).toArray();
      const session = connection.startSession({snapshot:true});
      try { for (const {name} of names) if (!name.startsWith('system.')) snapshot.collections[name] = await db.collection(name).find({},{session}).toArray(); }
      finally { await session.endSession(); }
    } finally { await connection.close(); }
    fs.writeFileSync(path.join(output,'atlas-snapshot.ejson'),EJSON.stringify(snapshot,null,2,{relaxed:false}),{mode:0o600});
  }
  const data = convert(snapshot);
  fs.writeFileSync(path.join(output,'002_atlas_data.sql'),data,{mode:0o600});
  const schema = fs.readFileSync(path.join(root,'supabase/001_schema.sql'),'utf8');
  const complete = schema + '\n' + data;
  fs.writeFileSync(path.join(output,'usb_supabase_complete.sql'),complete,{mode:0o600});
  const manifest = {exportedAt:snapshot.exportedAt,collections:Object.fromEntries(Object.entries(snapshot.collections).map(([k,v])=>[k,v.length])),
    totalDocuments:Object.values(snapshot.collections).reduce((n,v)=>n+v.length,0),passwordHashesPreserved:true,
    completeSqlSha256:crypto.createHash('sha256').update(complete).digest('hex')};
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({exported:true,...manifest}));
}
module.exports={convert};
if (require.main===module) main().catch(error=>{ console.error('Export failed:',error.name, String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[REDACTED]'));process.exitCode=1; });
