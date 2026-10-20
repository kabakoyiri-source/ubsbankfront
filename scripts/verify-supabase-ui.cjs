const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, devices } = require('playwright');
const { createDatabase } = require('./supabase-test-db.cjs');
const { verifyFundsUi } = require('./verify-funds-ui.cjs');

async function main() {
  const { db, rpc } = await createDatabase();
  let server;
  try {
    const user = await rpc('usb_register',{p_payload:{email:'mobile@example.test',password:'local-test-password',firstName:'Mobile',lastName:'Test'}});
    const dist = path.resolve(__dirname,'../dist');
    server = http.createServer(async (req,res)=>{
      const url = new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/rest/v1/rpc/')) {
        try {
          let body='';for await (const chunk of req)body+=chunk;
          const data=await rpc(url.pathname.split('/').pop(),JSON.parse(body));
          res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');return res.end(JSON.stringify(data));
        } catch(error) {
          res.statusCode=/^PT\d{3}$/.test(error.code)?Number(error.code.slice(2)):400;
          res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');return res.end(JSON.stringify({message:error.message,code:error.code}));
        }
      }
      const target = path.resolve(dist,'.'+url.pathname);
      if(!target.startsWith(dist+path.sep) && target!==dist){res.statusCode=403;return res.end();}
      const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(dist,'index.html');
      res.setHeader('Content-Type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream');
      res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const clientId=await verifyFundsUi(base,user.token);
    const profile=await rpc('usb_api',{p_action:'profile.get',p_session_token:user.token});
    assert.deepEqual(profile.user.balances,{CHF:75.25,EUR:20,USD:0});
    const client=(await db.query('select * from public.usb_beneficiaries where id=$1',[clientId])).rows[0];
    assert.equal(Number(client.balance),25.25);assert(client.deleted_at);

    const browser=await chromium.launch({channel:'chrome',headless:true});
    try {
      const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'block'});
      await context.route('**/rest/v1/rpc/*',async route=>{
        const pathname=new URL(route.request().url()).pathname;
        const response=await route.fetch({url:base+pathname});
        await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}});
      });
      const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/login');
      await page.getByLabel('Email',{exact:true}).fill('mobile@example.test');
      await page.getByLabel('Mot de passe',{exact:true}).fill('local-test-password');
      await page.getByRole('button',{name:'Se connecter',exact:true}).click();
      await page.locator('.favorites-section').waitFor();
      const session=await page.evaluate(()=>localStorage.getItem('token'));
      assert.match(session,/^[a-f0-9]{64}$/);
      await page.evaluate(()=>{
        Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
        window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
      });
      await page.getByRole('button',{name:'Se connecter',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null);
      await page.waitForFunction(()=>document.querySelector('#login-email')&&!document.querySelector('#login-email').disabled);
      assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'mobile@example.test');
      assert.equal(await page.getByLabel('Mot de passe',{exact:true}).inputValue(),'local-test-password');
      for(let i=0;i<40;i++) {
        try {await rpc('usb_api',{p_action:'profile.get',p_session_token:session});}
        catch(error){if(error.code==='PT401')break;throw error;}
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await assert.rejects(rpc('usb_api',{p_action:'profile.get',p_session_token:session}),error=>error.code==='PT401');
      await page.goto(base+'/register');
      for(const [name,value] of Object.entries({firstName:'New',lastName:'Test',email:'new@example.test',password:'new-test-password',confirmPassword:'new-test-password'})) await page.locator(`input[name="${name}"]`).fill(value);
      await page.getByRole('button',{name:"S'inscrire",exact:true}).click();
      await page.locator('.favorites-section').waitFor();
      assert.equal((await db.query("select count(*)::int as n from public.usb_users where email='new@example.test'")).rows[0].n,1);
      assert.deepEqual(errors,[]);
      await context.close();
    } finally {await browser.close();}
    console.log('PASS: browser → Supabase RPC → PostgreSQL: signup, login, remembered login, exit revocation, funds, transfer and beneficiary deletion. No Express or MongoDB runtime.');
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.close();
  }
}
main().catch(error=>{console.error('UI verification failed:',error.code||error.name,error.message);process.exitCode=1;});
