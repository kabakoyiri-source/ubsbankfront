const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { BSON } = require('mongodb');
const { createDatabase } = require('./supabase-test-db.cjs');

async function main() {
  const { db, rpc } = await createDatabase();
  try {
    const imported = path.resolve(__dirname,'../supabase/exports/002_atlas_data.sql');
    if (fs.existsSync(imported)) {
      await db.exec(fs.readFileSync(imported,'utf8'));
      await db.exec(fs.readFileSync(imported,'utf8')); // Import must be harmless to repeat.
      const snapshot = BSON.EJSON.parse(fs.readFileSync(path.resolve(__dirname,'../supabase/exports/atlas-snapshot.ejson'),'utf8'));
      for (const [source, table] of [['users','usb_users'],['clients','usb_beneficiaries'],['operations','usb_operations']]) {
        assert.equal(Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n),snapshot.collections[source].length);
      }
      for (const user of snapshot.collections.users) {
        const row = (await db.query('select * from public.usb_users where id=$1',[String(user._id)])).rows[0];
        assert(row.password_hash===user.password,'Source password hash must remain unchanged');
        assert.equal(row.email,user.email);
        assert.equal(row.first_name,user.firstName);
        assert.equal(row.last_name,user.lastName);
        assert.equal(new Date(row.created_at).toISOString(),user.createdAt.toISOString());
        const calculated = (await db.query('select usb_private.usb_balances($1) as balances',[row.id])).rows[0].balances;
        assert.deepEqual(calculated,user.balances);
      }
      for (const [collection, documents] of Object.entries(snapshot.collections)) for (const document of documents) {
        const saved = (await db.query('select document from usb_private.usb_migration_documents where collection=$1 and mongo_id=$2',[collection,String(document._id)])).rows[0].document;
        assert.deepEqual(saved,JSON.parse(BSON.EJSON.stringify(document,{relaxed:false})),'All source fields must be archived losslessly');
      }
      console.log('PASS: actual Atlas SQL imports twice, preserves 8 users/password hashes, 4 beneficiaries, 14 operations, dates, balances, ownership and all 26 original documents.');
    }
    const register = payload => rpc('usb_register',{p_payload:payload});
    const user = await register({email:'sql-user@example.test',password:'test-password',firstName:'SQL',lastName:'User',role:'admin',balances:{CHF:9999}});
    const other = await register({email:'other-user@example.test',password:'test-password',firstName:'Other',lastName:'User'});
    const currencyUser = await register({email:'currencies-sql@example.test',password:'test-password',firstName:'Currency',lastName:'Test'});
    const expectedCurrencyBalances = {CHF:0,EUR:0,USD:0};
    for (const [code,amount] of [['CHF',10.25],['EUR',20.50],['USD',30.75]]) {
      expectedCurrencyBalances[code]=amount;
      const response=await rpc('usb_api',{p_action:'operations.create',p_payload:{type:'deposit',amount,currency:code},p_session_token:currencyUser.token});
      assert.equal(response.data.currency,code);
      assert.deepEqual(response.balances,expectedCurrencyBalances,'Each deposit must update only its own currency');
    }
    const moneySource=fs.readFileSync(path.resolve(__dirname,'../src/services/money.js'),'utf8');
    const { formatAmount,normalizeAmountInput,formatAmountInput }=await import('data:text/javascript;base64,'+Buffer.from(moneySource).toString('base64'));
    assert.equal(formatAmount(1234567.89),"1'234'567.89");
    assert.equal(formatAmountInput('1234.50'),"1'234.50");
    assert.equal(normalizeAmountInput("1'234,50"),'1234.50');
    assert.equal(normalizeAmountInput("1'234.50"),'1234.50');
    const messagesSource=fs.readFileSync(path.resolve(__dirname,'../src/services/messages.js'),'utf8').replace(/^import englishMessages .+$/m,'const englishMessages='+fs.readFileSync(path.resolve(__dirname,'../src/services/englishMessages.json'),'utf8'));
    const {toEnglishMessage,transactionInEnglish}=await import('data:text/javascript;base64,'+Buffer.from(messagesSource).toString('base64'));
    assert.equal(toEnglishMessage('Solde insuffisant sur le compte USD. Ajoutez des fonds dans les paramètres.'),'Insufficient funds in the USD account. Add funds in Settings.');
    assert.equal(toEnglishMessage('Identifiants incorrects'),'Incorrect credentials');
    assert.equal(toEnglishMessage('constructor'),'constructor');
    assert.equal(transactionInEnglish({description:'Ajout de fonds'}).description,'Funds added');
    assert.equal(transactionInEnglish({description:'Note personnelle du client'}).description,'Note personnelle du client','Do not rewrite user-authored descriptions');
    assert(user.success && /^[a-f0-9]{64}$/.test(user.token));
    assert.equal(user.user.role,'user'); assert.deepEqual(user.user.balances,{CHF:0,EUR:0,USD:0});
    assert(!('password_hash' in user.user));
    const api = (action,payload={},token=user.token) => rpc('usb_api',{p_action:action,p_payload:payload,p_session_token:token});
    const rejects = async (action,payload,code='PT400',token=user.token) => assert.rejects(api(action,payload,token),error=>error.code===code);
    await rejects('profile.get',{},'PT401','invalid');
    assert.equal((await rpc('usb_login',{p_email:'sql-user@example.test',p_password:'wrong'})).success,false);
    assert((await rpc('usb_login',{p_email:'SQL-USER@example.test',p_password:'test-password'})).success);
    const sourceHash = await bcrypt.hash('bcrypt-import-password',10);
    await db.query('insert into public.usb_users(id,email,password_hash,first_name,last_name) values($1,$2,$3,$4,$5)',['legacy-bcrypt','bcrypt@example.test',sourceHash,'Old','User']);
    assert((await rpc('usb_login',{p_email:'bcrypt@example.test',p_password:'bcrypt-import-password'})).success,'MongoDB bcrypt hashes must work with the SQL login');
    for (const password of ['émoji-🔐-password','a'.repeat(72)]) {
      const hash = await bcrypt.hash(password,10);
      assert.equal((await db.query('select usb_private.usb_password_matches($1,$2) as matches',[password,hash])).rows[0].matches,true);
      assert.equal((await db.query('select usb_private.usb_password_matches($1,$2) as matches',['wrong',hash])).rows[0].matches,false);
    }
    for(let i=0;i<11;i++) {
      const denied = await rpc('usb_login',{p_email:'absent@example.test',p_password:'wrong'});
      assert.equal(denied.status,i<10?401:429);
    }
    const details = {firstName:'Test',lastName:'Beneficiary',bankName:'Test bank',swiftCode:'test bank',bankAddress:'Test address',accountNumber:'ch55 0023 5235 8890 1234 5',userId:other.user.id,balance:999,status:'suspended'};
    const created = await api('clients.create',details);
    const client = created.data;
    assert.equal(client.accountNumber,'CH5500235235889012345'); assert.equal(client.userId,user.user.id);
    assert.equal(client.balance,0); assert.equal(client.status,'active');
    await rejects('clients.create',details,'PT409');
    await rejects('clients.delete',{id:client._id},'PT404',other.token);
    assert.deepEqual((await api('clients.list',{},other.token)).data,[]);
    await rejects('profile.update',{firstName:'Updated',lastName:'User',password:'wrong'});
    assert.equal((await api('profile.update',{firstName:'Updated',lastName:'User',password:'test-password',role:'admin'})).user.role,'user');
    for(const amount of [0,-1,'12junk',true,1.001]) await rejects('operations.create',{type:'deposit',amount,currency:'CHF'});
    const deposit = await api('operations.create',{type:'deposit',amount:'100,50',currency:'CHF'});
    const transfer = (amount,extra={}) => api('operations.transfer',{clientId:client._id,adminAccountType:'chf',currency:'CHF',amount,transferType:'instant',isScheduled:false,...extra});
    const sent = await transfer(25.25);
    assert.equal(sent.balances.CHF,75.25); assert.equal(sent.data.clientId.balance,25.25);
    await rejects('operations.delete',{id:deposit.data._id},'PT409');
    await assert.rejects(transfer(100),error=>error.code==='PT400');
    const scheduled = await transfer(50,{transferType:'delayed',isScheduled:true});
    assert.equal(scheduled.balances.CHF,25.25);
    assert.equal((await api('clients.get',{id:client._id})).data.balance,25.25);
    assert.equal((await api('operations.status',{id:scheduled.data._id,status:'cancelled'})).balances.CHF,75.25);
    await api('operations.create',{type:'deposit',amount:20,currency:'EUR'});
    assert.equal((await api('profile.get')).user.balances.EUR,20);
    const waiting = await transfer(5,{transferType:'delayed',isScheduled:true});
    await api('clients.delete',{id:client._id});
    assert.equal((await api('clients.list')).count,0);
    await assert.rejects(transfer(1),error=>error.code==='PT404');
    await api('operations.status',{id:waiting.data._id,status:'completed'});
    await api('operations.status',{id:waiting.data._id,status:'completed'});
    assert.equal((await api('operations.history',{clientId:client._id})).data.find(o=>o._id===sent.data._id).clientId.lastName,'Beneficiary');
    const restored = await api('clients.create',details);
    assert.equal(restored.data._id,client._id); assert.equal(restored.data.balance,30.25);
    // A failing ledger insert must undo the preceding credit in the same RPC.
    await db.exec("create function usb_private.usb_fail_insert() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$; create trigger usb_test_fail before insert on public.usb_operations for each row execute function usb_private.usb_fail_insert();");
    await assert.rejects(transfer(1));
    await db.exec('drop trigger usb_test_fail on public.usb_operations; drop function usb_private.usb_fail_insert();');
    assert.equal((await api('clients.get',{id:client._id})).data.balance,30.25);
    // PGlite serializes transactions; these checks validate serialized overspend prevention.
    const concurrent = await Promise.allSettled([transfer(50),transfer(50)]);
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
    for(const table of ['usb_users','usb_beneficiaries','usb_operations']) {
      await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query(`select * from public.${table}`);}),error=>error.code==='42501');
      await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query(`delete from public.${table}`);}),error=>error.code==='42501');
    }
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select * from usb_private.usb_sessions');}),error=>error.code==='42501');
    await rpc('usb_logout',{p_session_token:user.token});
    await rejects('profile.get',{},'PT401');
    const login = await rpc('usb_login',{p_email:'sql-user@example.test',p_password:'test-password'});
    await db.query("update usb_private.usb_sessions set expires_at=now()-interval '1 second' where user_id=$1",[login.user.id]);
    await rejects('profile.get',{},'PT401',login.token);
    console.log('PASS: SQL registration/login without Supabase Auth, imported bcrypt, sessions, expiry, isolation, profile password, funds, currency separation, reservations, removal, reactivation, rollback, serialized transfers and denied direct access.');
  } finally { await db.close(); }
}
main().catch(error=>{console.error('Verification failed:',error.code || error.name,error.message);process.exitCode=1;});
