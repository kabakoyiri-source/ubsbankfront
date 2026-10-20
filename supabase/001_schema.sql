-- Run in the Supabase SQL Editor as postgres. All application tables use usb_.
begin;
create schema if not exists usb_private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema usb_private from public, anon, authenticated;

create table if not exists public.usb_users (
  id text primary key default gen_random_uuid()::text,
  mongo_id text unique,
  email text not null,
  password_hash text not null,
  first_name text not null default '',
  last_name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  ledger_revision bigint not null default 0,
  balances jsonb not null default '{"CHF":0,"EUR":0,"USD":0}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.usb_beneficiaries (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.usb_users(id),
  first_name text not null default '', last_name text not null,
  email text, phone text, address jsonb,
  account_number text not null, bank_name text not null,
  swift_code text not null, bank_address text not null,
  balance numeric(18,2) not null default 0 check (balance >= 0),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, account_number), unique(id, user_id)
);
create table if not exists public.usb_operations (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.usb_users(id),
  beneficiary_id text,
  type text not null check (type in ('deposit','withdrawal','transfer','payment')),
  amount numeric(18,2) not null,
  currency text not null default 'CHF' check (currency in ('CHF','EUR','USD')),
  description text, reason text, recipient_account_number text,
  admin_account_type text, admin_account_name text, admin_account_iban text,
  transfer_type text not null default 'instant' check (transfer_type in ('instant','delayed')),
  transfer_speed text, is_scheduled boolean not null default false,
  status text not null default 'pending' check (status in ('pending','completed','failed','cancelled')),
  balance_after numeric(18,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(beneficiary_id, user_id) references public.usb_beneficiaries(id, user_id)
);
create index if not exists usb_beneficiaries_owner on public.usb_beneficiaries(user_id, deleted_at, created_at desc);
create index if not exists usb_operations_owner on public.usb_operations(user_id, created_at desc);
create index if not exists usb_operations_beneficiary on public.usb_operations(user_id, beneficiary_id);
create unique index if not exists usb_users_email on public.usb_users(lower(email));

-- Lossless BSON Extended JSON archive, including fields not used by the UI.
-- This schema is deliberately not exposed through the Data API.
create table if not exists usb_private.usb_migration_documents (
  collection text not null, mongo_id text not null, document jsonb not null,
  primary key(collection, mongo_id)
);
create table if not exists usb_private.usb_sessions (
  token_hash text primary key,
  user_id text not null references public.usb_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '12 hours'
);
create index if not exists usb_sessions_owner on usb_private.usb_sessions(user_id);
create table if not exists usb_private.usb_login_attempts (
  email_hash text primary key, attempts integer not null default 0,
  started_at timestamptz not null default now()
);
alter table usb_private.usb_migration_documents enable row level security;
alter table usb_private.usb_sessions enable row level security;
alter table usb_private.usb_login_attempts enable row level security;
revoke all on all tables in schema usb_private from public, anon, authenticated;

alter table public.usb_users enable row level security;
alter table public.usb_beneficiaries enable row level security;
alter table public.usb_operations enable row level security;
revoke all on public.usb_users, public.usb_beneficiaries, public.usb_operations from public, anon, authenticated;
-- No direct table reads/writes from the browser, even with the public API key.
-- The RPCs validate an opaque session and expose only that account's records.

create or replace function usb_private.usb_balances(p_user text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'CHF', coalesce(sum(case when currency='CHF' then case when status='completed' then amount when status='pending' then -abs(amount) else 0 end else 0 end),0),
    'EUR', coalesce(sum(case when currency='EUR' then case when status='completed' then amount when status='pending' then -abs(amount) else 0 end else 0 end),0),
    'USD', coalesce(sum(case when currency='USD' then case when status='completed' then amount when status='pending' then -abs(amount) else 0 end else 0 end),0))
  from public.usb_operations where user_id=p_user;
$$;
create or replace function usb_private.usb_user_json(u public.usb_users) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',u.id,'email',u.email,'firstName',u.first_name,'lastName',u.last_name,'role',u.role,
    'balances',usb_private.usb_balances(u.id),'createdAt',u.created_at,'updatedAt',u.updated_at);
$$;
create or replace function usb_private.usb_beneficiary_json(b public.usb_beneficiaries) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('_id',b.id,'userId',b.user_id,'firstName',b.first_name,'lastName',b.last_name,
    'email',b.email,'phone',b.phone,'address',b.address,'accountNumber',b.account_number,'bankName',b.bank_name,
    'swiftCode',b.swift_code,'bankAddress',b.bank_address,'balance',b.balance,'status',b.status,
    'deletedAt',b.deleted_at,'createdAt',b.created_at,'updatedAt',b.updated_at);
$$;
create or replace function usb_private.usb_operation_json(o public.usb_operations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('_id',o.id,'userId',o.user_id,
    'clientId',(select usb_private.usb_beneficiary_json(b) from public.usb_beneficiaries b where b.id=o.beneficiary_id and b.user_id=o.user_id),
    'type',o.type,'amount',o.amount,'currency',o.currency,'description',o.description,'reason',o.reason,
    'recipientAccountNumber',o.recipient_account_number,'adminAccountType',o.admin_account_type,
    'adminAccountName',o.admin_account_name,'adminAccountIban',o.admin_account_iban,
    'transferType',o.transfer_type,'transferSpeed',o.transfer_speed,'isScheduled',o.is_scheduled,
    'status',o.status,'balanceAfter',o.balance_after,'createdAt',o.created_at,'updatedAt',o.updated_at);
$$;

create or replace function usb_private.usb_password_matches(p_password text,p_hash text) returns boolean
language sql immutable set search_path = '' as $$
  -- pgcrypto's Blowfish accepts the 2a prefix. Modern 2b hashes use the same
  -- result for passwords up to 72 bytes; retain the original stored hash.
  select coalesce(extensions.crypt(p_password,h)=h,false)
    from (select case when left(p_hash,4)='$2b$' then '$2a$'||substr(p_hash,5) else p_hash end as h) normalized;
$$;
create or replace function public.usb_login(p_email text,p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u public.usb_users; token text; email_key text; failures integer;
begin
  email_key := encode(extensions.digest(lower(trim(p_email)),'sha256'),'hex');
  insert into usb_private.usb_login_attempts(email_hash) values(email_key) on conflict do nothing;
  select attempts into failures from usb_private.usb_login_attempts where email_hash=email_key for update;
  if exists(select 1 from usb_private.usb_login_attempts where email_hash=email_key and started_at<now()-interval '15 minutes') then
    update usb_private.usb_login_attempts set attempts=0,started_at=now() where email_hash=email_key; failures:=0;
  end if;
  if failures>=10 then return jsonb_build_object('success',false,'status',429,'message','Trop de tentatives. Réessayez dans 15 minutes.'); end if;
  select * into u from public.usb_users where lower(email)=lower(trim(p_email));
  if u.id is null or not usb_private.usb_password_matches(p_password,u.password_hash) then
    update usb_private.usb_login_attempts set attempts=attempts+1 where email_hash=email_key;
    return jsonb_build_object('success',false,'status',401,'message','Identifiants incorrects');
  end if;
  delete from usb_private.usb_login_attempts where email_hash=email_key;
  delete from usb_private.usb_sessions where expires_at<=now();
  token := encode(extensions.gen_random_bytes(32),'hex');
  insert into usb_private.usb_sessions(token_hash,user_id) values(encode(extensions.digest(token,'sha256'),'hex'),u.id);
  return jsonb_build_object('success',true,'token',token,'user',usb_private.usb_user_json(u));
end;
$$;
create or replace function public.usb_register(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u public.usb_users; token text; normalized_email text := lower(trim(p_payload->>'email'));
begin
  if coalesce(normalized_email,'') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(normalized_email)>254
    or coalesce(length(p_payload->>'password'),0)<6 or octet_length(p_payload->>'password')>72
    or coalesce(trim(p_payload->>'firstName'),'')='' or coalesce(trim(p_payload->>'lastName'),'')='' then
    raise exception using errcode='PT400',message='Renseignez un email valide, votre nom et un mot de passe de 6 caractères minimum (72 octets maximum).';
  end if;
  insert into public.usb_users(email,password_hash,first_name,last_name)
    values(normalized_email,extensions.crypt(p_payload->>'password',extensions.gen_salt('bf',10)),trim(p_payload->>'firstName'),trim(p_payload->>'lastName')) returning * into u;
  token := encode(extensions.gen_random_bytes(32),'hex');
  insert into usb_private.usb_sessions(token_hash,user_id) values(encode(extensions.digest(token,'sha256'),'hex'),u.id);
  return jsonb_build_object('success',true,'token',token,'user',usb_private.usb_user_json(u));
exception when unique_violation then raise exception using errcode='PT409',message='Cet email est déjà enregistré.';
end;
$$;
create or replace function public.usb_logout(p_session_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from usb_private.usb_sessions where token_hash=encode(extensions.digest(p_session_token,'sha256'),'hex');
  return jsonb_build_object('success',true);
end;
$$;

-- Each RPC call is one Postgres transaction. User-row locking serializes all
-- ledger mutations before checking funds, including removal and reactivation.
create or replace function public.usb_api(p_action text, p_payload jsonb default '{}',p_session_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid text; u public.usb_users; b public.usb_beneficiaries; o public.usb_operations;
  result jsonb; funds jsonb; currency_code text; operation_type text; transfer_kind text; next_status text;
  quantity numeric; signed_amount numeric; available numeric; beneficiary_key text;
  account text; swift text; outgoing boolean; scheduled boolean; mutating boolean := false;
begin
  select user_id into uid from usb_private.usb_sessions
    where token_hash=encode(extensions.digest(p_session_token,'sha256'),'hex') and expires_at>now();
  if uid is null then raise exception using errcode='PT401', message='Veuillez vous connecter.'; end if;
  if not exists(select 1 from public.usb_users where id=uid) then raise exception using errcode='PT401', message='Compte introuvable.'; end if;
  mutating := p_action in ('profile.update','clients.create','clients.update','clients.delete','operations.create','operations.transfer','operations.status','operations.delete');
  if mutating then
    perform 1 from public.usb_users where id=uid for update;
  end if;
  funds := usb_private.usb_balances(uid);

  if p_action='profile.get' then
    select * into u from public.usb_users where id=uid;
    return jsonb_build_object('success',true,'user',usb_private.usb_user_json(u));
  elsif p_action='profile.update' then
    select * into u from public.usb_users where id=uid;
    if not usb_private.usb_password_matches(p_payload->>'password',u.password_hash) then raise exception using errcode='PT400',message='Mot de passe incorrect'; end if;
    if coalesce(trim(p_payload->>'firstName'),'')='' or coalesce(trim(p_payload->>'lastName'),'')='' then
      raise exception using errcode='PT400', message='Renseignez votre prénom et votre nom.';
    end if;
    update public.usb_users set first_name=trim(p_payload->>'firstName'),last_name=trim(p_payload->>'lastName'),updated_at=now() where id=uid returning * into u;
    return jsonb_build_object('success',true,'user',usb_private.usb_user_json(u));
  elsif p_action='clients.list' then
    select coalesce(jsonb_agg(usb_private.usb_beneficiary_json(x) order by x.created_at desc),'[]') into result
      from public.usb_beneficiaries x where x.user_id=uid and x.deleted_at is null;
    return jsonb_build_object('success',true,'data',result,'count',jsonb_array_length(result));
  elsif p_action in ('clients.get','clients.update','clients.delete') then
    select * into b from public.usb_beneficiaries where id=p_payload->>'id' and user_id=uid
      and (deleted_at is null or p_action='clients.delete');
    if not found then raise exception using errcode='PT404',message='Bénéficiaire introuvable.'; end if;
    if p_action='clients.delete' then
      update public.usb_beneficiaries set deleted_at=coalesce(deleted_at,now()),updated_at=now() where id=b.id;
      result := 'null';
    elsif p_action='clients.update' then
      update public.usb_beneficiaries set
        first_name=coalesce(p_payload->>'firstName',first_name),last_name=coalesce(p_payload->>'lastName',last_name),
        email=coalesce(p_payload->>'email',email),phone=coalesce(p_payload->>'phone',phone),address=coalesce(p_payload->'address',address),
        bank_name=coalesce(p_payload->>'bankName',bank_name),swift_code=coalesce(p_payload->>'swiftCode',swift_code),
        bank_address=coalesce(p_payload->>'bankAddress',bank_address),status=coalesce(p_payload->>'status',status),updated_at=now()
        where id=b.id returning * into b;
      result := usb_private.usb_beneficiary_json(b);
    else return jsonb_build_object('success',true,'data',usb_private.usb_beneficiary_json(b)); end if;
  elsif p_action='clients.create' then
    account := upper(regexp_replace(coalesce(p_payload->>'accountNumber',''),'\s+','','g'));
    swift := upper(regexp_replace(coalesce(p_payload->>'swiftCode',''),'\s+','','g'));
    if account='' or swift='' or coalesce(trim(p_payload->>'lastName'),'')='' or coalesce(trim(p_payload->>'bankName'),'')='' or coalesce(trim(p_payload->>'bankAddress'),'')='' then
      raise exception using errcode='PT400',message='Complétez le nom et les coordonnées bancaires du bénéficiaire.';
    end if;
    select * into b from public.usb_beneficiaries where user_id=uid and account_number=account;
    if found and b.deleted_at is null then raise exception using errcode='PT409',message='Ce numéro de compte est déjà enregistré. Vérifiez l’IBAN ou sélectionnez le bénéficiaire existant.'; end if;
    if b.id is not null then
      update public.usb_beneficiaries set first_name=coalesce(trim(p_payload->>'firstName'),''),last_name=trim(p_payload->>'lastName'),
        bank_name=trim(p_payload->>'bankName'),swift_code=swift,bank_address=trim(p_payload->>'bankAddress'),status='active',deleted_at=null,updated_at=now()
        where id=b.id returning * into b;
    else
      insert into public.usb_beneficiaries(user_id,first_name,last_name,account_number,bank_name,swift_code,bank_address)
        values(uid,coalesce(trim(p_payload->>'firstName'),''),trim(p_payload->>'lastName'),account,trim(p_payload->>'bankName'),swift,trim(p_payload->>'bankAddress')) returning * into b;
    end if;
    result := usb_private.usb_beneficiary_json(b);
  elsif p_action in ('operations.list','operations.get','operations.history') then
    if p_action='operations.get' then
      select * into o from public.usb_operations where id=p_payload->>'id' and user_id=uid;
      if not found then raise exception using errcode='PT404',message='Opération introuvable.'; end if;
      return jsonb_build_object('success',true,'data',usb_private.usb_operation_json(o));
    end if;
    select coalesce(jsonb_agg(usb_private.usb_operation_json(x) order by x.created_at desc),'[]') into result
      from public.usb_operations x where x.user_id=uid
      and (coalesce(p_payload->>'clientId','')='' or x.beneficiary_id=p_payload->>'clientId')
      and (coalesce(p_payload->>'type','')='' or x.type=p_payload->>'type')
      and (coalesce(p_payload->>'status','')='' or x.status=p_payload->>'status')
      and (coalesce(p_payload->>'startDate','')='' or x.created_at >= (p_payload->>'startDate')::timestamptz)
      and (coalesce(p_payload->>'endDate','')='' or x.created_at <= (p_payload->>'endDate')::timestamptz);
    return jsonb_build_object('success',true,'data',result,'count',jsonb_array_length(result));
  elsif p_action in ('operations.create','operations.transfer') then
    if coalesce(p_payload->>'amount','') !~ '^\d+(?:[.,]\d{1,2})?$' then raise exception using errcode='PT400',message='Saisissez un montant positif avec deux décimales au maximum.'; end if;
    quantity := replace(p_payload->>'amount',',','.')::numeric;
    if quantity<=0 or quantity>90071992547409.91 then raise exception using errcode='PT400',message='Montant invalide.'; end if;
    currency_code := upper(coalesce(p_payload->>'currency',p_payload->>'adminAccountType','CHF'));
    if currency_code not in ('CHF','EUR','USD') then raise exception using errcode='PT400',message='Devise invalide. Choisissez CHF, EUR ou USD.'; end if;
    operation_type := case when p_action='operations.transfer' then 'transfer' else p_payload->>'type' end;
    if operation_type is null or operation_type not in ('deposit','withdrawal','transfer','payment') then raise exception using errcode='PT400',message='Type d’opération invalide.'; end if;
    beneficiary_key := nullif(p_payload->>'clientId','');
    if beneficiary_key is null and operation_type<>'deposit' then raise exception using errcode='PT400',message='Veuillez sélectionner un bénéficiaire.'; end if;
    if p_action='operations.transfer' then
      if upper(coalesce(p_payload->>'adminAccountType',''))<>currency_code then raise exception using errcode='PT400',message='Le compte source doit correspondre à la devise du virement.'; end if;
      transfer_kind := coalesce(p_payload->>'transferType',case when p_payload->>'isScheduled'='true' then 'delayed' else 'instant' end);
      if transfer_kind not in ('instant','delayed') then raise exception using errcode='PT400',message='Type de virement invalide.'; end if;
      scheduled := transfer_kind='delayed';
      if p_payload ? 'isScheduled' and (p_payload->>'isScheduled')::boolean<>scheduled then raise exception using errcode='PT400',message='Planification incohérente.'; end if;
      if not scheduled and quantity>20000 then raise exception using errcode='PT400',message='Le montant maximum pour un virement instantané est de 20 000 '||currency_code||'.'; end if;
    else transfer_kind:='instant'; scheduled:=false; end if;
    available := (funds->>currency_code)::numeric;
    signed_amount := quantity;
    if beneficiary_key is not null then
      select * into b from public.usb_beneficiaries where id=beneficiary_key and user_id=uid and deleted_at is null;
      if not found then raise exception using errcode='PT404',message='Bénéficiaire introuvable.'; end if;
      if b.status<>'active' then raise exception using errcode='PT400',message='Ce bénéficiaire est indisponible.'; end if;
      outgoing := operation_type in ('deposit','transfer');
      if outgoing and available<quantity then raise exception using errcode='PT400',message='Solde insuffisant sur le compte '||currency_code||'. Ajoutez des fonds dans les paramètres.'; end if;
      signed_amount := case when outgoing then -quantity else quantity end;
      if not scheduled then
        if b.balance-signed_amount<0 then raise exception using errcode='PT400',message='Solde du bénéficiaire insuffisant.'; end if;
        update public.usb_beneficiaries set balance=balance-signed_amount,updated_at=now() where id=b.id;
      end if;
    end if;
    insert into public.usb_operations(user_id,beneficiary_id,type,amount,currency,description,reason,recipient_account_number,
      admin_account_type,admin_account_name,admin_account_iban,transfer_type,transfer_speed,is_scheduled,status,balance_after)
      values(uid,beneficiary_key,operation_type,signed_amount,currency_code,coalesce(p_payload->>'description',case when beneficiary_key is null then 'Ajout de fonds' else '' end),
        p_payload->>'reason',p_payload->>'recipientAccountNumber',lower(currency_code),p_payload->>'adminAccountName',p_payload->>'adminAccountIban',transfer_kind,
        case when scheduled then '2-3 days' else 'instant' end,scheduled,case when scheduled then 'pending' else 'completed' end,available+signed_amount)
      returning * into o;
    result := usb_private.usb_operation_json(o);
  elsif p_action in ('operations.status','operations.delete') then
    select * into o from public.usb_operations where id=p_payload->>'id' and user_id=uid;
    if not found then raise exception using errcode='PT404',message='Opération introuvable.'; end if;
    if p_action='operations.status' then
      next_status := p_payload->>'status';
      if next_status is null or next_status not in ('completed','failed','cancelled') then raise exception using errcode='PT400',message='Statut invalide.'; end if;
      if o.status<>next_status then
        if o.status<>'pending' or o.type<>'transfer' then raise exception using errcode='PT400',message='Seul un virement en attente peut changer de statut.'; end if;
        if next_status='completed' then
          update public.usb_beneficiaries set balance=balance+abs(o.amount),updated_at=now() where id=o.beneficiary_id and user_id=uid;
          if not found then raise exception using errcode='PT404',message='Bénéficiaire introuvable.'; end if;
        end if;
        update public.usb_operations set status=next_status,is_scheduled=case when next_status='completed' then false else is_scheduled end,updated_at=now() where id=o.id returning * into o;
      end if;
      result := usb_private.usb_operation_json(o);
    else
      if o.status='completed' then
        if o.amount>0 and (funds->>o.currency)::numeric<o.amount then raise exception using errcode='PT409',message='Ces fonds ont déjà été utilisés et ne peuvent pas être supprimés.'; end if;
        if o.beneficiary_id is not null then
          select * into b from public.usb_beneficiaries where id=o.beneficiary_id and user_id=uid;
          if not found then raise exception using errcode='PT404',message='Bénéficiaire introuvable.'; end if;
          if b.balance+o.amount<0 then raise exception using errcode='PT400',message='Solde du bénéficiaire insuffisant.'; end if;
          update public.usb_beneficiaries set balance=balance+o.amount,updated_at=now() where id=b.id;
        end if;
      end if;
      delete from public.usb_operations where id=o.id;
      result := 'null';
    end if;
  else raise exception using errcode='PT404',message='Action introuvable.'; end if;
  funds := usb_private.usb_balances(uid);
  if exists(select 1 from jsonb_each_text(funds) f where abs(f.value::numeric)>90071992547409.91) then raise exception using errcode='PT400',message='Le montant dépasse la limite du compte.'; end if;
  update public.usb_users set balances=funds,ledger_revision=ledger_revision+1,updated_at=now() where id=uid;
  return jsonb_build_object('success',true,'data',result,'balances',funds);
end;
$$;
revoke all on all functions in schema usb_private from public, anon, authenticated;
revoke all on function public.usb_api(text,jsonb,text),public.usb_login(text,text),public.usb_register(jsonb),public.usb_logout(text) from public;
grant execute on function public.usb_api(text,jsonb,text),public.usb_login(text,text),public.usb_register(jsonb),public.usb_logout(text) to anon,authenticated;
commit;
