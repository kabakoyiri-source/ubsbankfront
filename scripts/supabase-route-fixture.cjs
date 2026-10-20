// Reuse the existing page fixtures while intercepting the real Supabase RPC
// transport. This adapter exists only in tests; the app calls Supabase directly.
exports.routeSupabase = (context, handler) => context.route('**/rest/v1/rpc/usb_*', route => {
  const request = route.request();
  const original = new URL(request.url());
  const name = original.pathname.split('/').pop();
  const args = request.postDataJSON() || {};
  const payload = args.p_payload || {};
  let pathname;
  let method = 'POST';
  if (name === 'usb_login') pathname='/auth/login';
  else if (name === 'usb_register') pathname='/auth/register';
  else if (name === 'usb_logout') pathname='/auth/logout';
  else {
    const action = args.p_action;
    const mappings = { 'profile.get':['GET','/auth/me'],'profile.update':['PUT','/auth/updatedetails'],
      'clients.list':['GET','/clients'],'clients.get':['GET','/clients/'+payload.id],
      'clients.create':['POST','/clients'],'clients.update':['PUT','/clients/'+payload.id],'clients.delete':['DELETE','/clients/'+payload.id],
      'operations.list':['GET','/operations'],'operations.get':['GET','/operations/'+payload.id],
      'operations.history':['GET','/operations/history/'+payload.clientId],'operations.create':['POST','/operations'],
      'operations.transfer':['POST','/operations/transfer'],'operations.status':['PUT','/operations/'+payload.id+'/status'],
      'operations.delete':['DELETE','/operations/'+payload.id] };
    [method,pathname] = mappings[action] || ['POST','/unknown'];
  }
  const url = new URL('/api'+pathname,original.origin);
  if (method==='GET') for (const [key,value] of Object.entries(payload)) if (value!=null) url.searchParams.set(key,value);
  return handler({
    request:()=>({url:()=>url.href,method:()=>method,postDataJSON:()=>payload}),
    abort: reason=>route.abort(reason),
    fulfill: options=>route.fulfill({...options,headers:{'access-control-allow-origin':'*',...options.headers}}),
    fetch: options=>route.fetch({...options,url:new URL(original.pathname,options.url).href}),
  });
});
