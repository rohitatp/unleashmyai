-- Unleash My AI — credits store. Run once in the Supabase SQL editor.
-- The server talks to these via PostgREST RPC using the service_role key.

create table if not exists credit_codes (
  code              text primary key,
  credits_total     int  not null,
  credits_remaining int  not null,
  stripe_session_id text unique,
  email             text,
  created_at        timestamptz default now()
);

-- Idempotent grant: a duplicate session id (webhook + success page racing) is a no-op.
create or replace function grant_credits(p_code text, p_credits int, p_session text, p_email text)
returns void language sql as $$
  insert into credit_codes (code, credits_total, credits_remaining, stripe_session_id, email)
  values (p_code, p_credits, p_credits, p_session, p_email)
  on conflict (stripe_session_id) do nothing;
$$;

-- Atomic spend: returns the new remaining balance, or null if none left / bad code.
create or replace function spend_credit(p_code text)
returns int language sql as $$
  update credit_codes set credits_remaining = credits_remaining - 1
  where code = p_code and credits_remaining > 0
  returning credits_remaining;
$$;

-- Refund one credit (used when an LLM call fails after reserving a credit).
create or replace function add_credit(p_code text)
returns void language sql as $$
  update credit_codes set credits_remaining = credits_remaining + 1 where code = p_code;
$$;

-- Read helpers.
create or replace function code_balance(p_code text)
returns int language sql as $$
  select credits_remaining from credit_codes where code = p_code;
$$;

create or replace function code_for_session(p_session text)
returns text language sql as $$
  select code from credit_codes where stripe_session_id = p_session;
$$;
