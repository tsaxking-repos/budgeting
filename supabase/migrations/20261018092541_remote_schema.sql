set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.dispatch_table_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text;
  v_token text;
  v_timeout integer;
  v_headers extensions.http_header[];
  v_request extensions.http_request;
  v_response extensions.http_response;
  v_payload jsonb;
begin
  -- Read configuration from Supabase Vault.
  select decrypted_secret into strict v_url
  from vault.decrypted_secrets
  where name = 'webhook_url';

  select decrypted_secret into strict v_token
  from vault.decrypted_secrets
  where name = 'webhook_auth_token';

  select decrypted_secret::integer into strict v_timeout
  from vault.decrypted_secrets
  where name = 'webhook_timeout_ms';

  v_headers := array[
    extensions.http_header(
      'Authorization',
      'Bearer ' || v_token
    ),
    extensions.http_header(
      'Content-Type',
      'application/json'
    )
  ];

  -- Build the webhook payload.
  v_payload := jsonb_build_object(
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'new',
      case
        when TG_OP = 'DELETE' then null
        else to_jsonb(NEW)
      end,
    'old',
      case
        when TG_OP = 'INSERT' then null
        else to_jsonb(OLD)
      end,
    'type', lower(TG_OP)
  );

  -- Construct the HTTP request.
  v_request := ROW(
    'POST',
    v_url,
    v_headers,
    'application/json',
    v_payload::text
  )::extensions.http_request;

  -- Set timeout in milliseconds.
  if v_timeout > 0 then
    perform extensions.http_set_curlopt(
      'CURLOPT_TIMEOUT_MS',
      v_timeout::text
    );
  end if;

  -- Send the request synchronously.
  v_response := extensions.http(v_request);

  -- Log non-2xx responses.
  if v_response.status < 200 or v_response.status >= 300 then
    raise warning
      'Webhook HTTP status % for table %.%: %',
      v_response.status,
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME,
      v_response.content;
  end if;

  -- Preserve the original row operation.
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$function$
;

alter table "budgeting"."budget_item" drop constraint "budget_item_category_fkey";


  create table "budgeting"."asset" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null,
    "name" text not null,
    "current_value" bigint not null
      );


alter table "budgeting"."asset" enable row level security;


  create table "budgeting"."transaction_transfer_dismissal" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "left_transaction_id" uuid not null,
    "right_transaction_id" uuid not null
      );


alter table "budgeting"."transaction_transfer_dismissal" enable row level security;

alter table "budgeting"."budget_item" drop column "category";

alter table "budgeting"."budget_item" add column "category_id" uuid not null;

alter table "budgeting"."transaction" add column "category" uuid;

alter table "budgeting"."transaction" add column "transfer_sibling" uuid;

alter table "budgeting"."transaction" alter column "description" drop not null;

CREATE UNIQUE INDEX asset_pkey ON budgeting.asset USING btree (id);

CREATE UNIQUE INDEX transaction_transfer_dismissal_pkey ON budgeting.transaction_transfer_dismissal USING btree (id);

alter table "budgeting"."asset" add constraint "asset_pkey" PRIMARY KEY using index "asset_pkey";

alter table "budgeting"."transaction_transfer_dismissal" add constraint "transaction_transfer_dismissal_pkey" PRIMARY KEY using index "transaction_transfer_dismissal_pkey";

alter table "budgeting"."budget_item" add constraint "budget_item_category_id_fkey" FOREIGN KEY (category_id) REFERENCES budgeting.category(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."budget_item" validate constraint "budget_item_category_id_fkey";

alter table "budgeting"."transaction" add constraint "transaction_category_fkey" FOREIGN KEY (category) REFERENCES budgeting.category(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "budgeting"."transaction" validate constraint "transaction_category_fkey";

alter table "budgeting"."transaction" add constraint "transaction_transfer_sibling_fkey" FOREIGN KEY (transfer_sibling) REFERENCES budgeting.transaction(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "budgeting"."transaction" validate constraint "transaction_transfer_sibling_fkey";

alter table "budgeting"."transaction_transfer_dismissal" add constraint "transaction_transfer_dismissal_left_transaction_id_fkey" FOREIGN KEY (left_transaction_id) REFERENCES budgeting.transaction(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."transaction_transfer_dismissal" validate constraint "transaction_transfer_dismissal_left_transaction_id_fkey";

alter table "budgeting"."transaction_transfer_dismissal" add constraint "transaction_transfer_dismissal_right_transaction_id_fkey" FOREIGN KEY (right_transaction_id) REFERENCES budgeting.transaction(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."transaction_transfer_dismissal" validate constraint "transaction_transfer_dismissal_right_transaction_id_fkey";

grant delete on table "budgeting"."asset" to "anon";

grant insert on table "budgeting"."asset" to "anon";

grant select on table "budgeting"."asset" to "anon";

grant update on table "budgeting"."asset" to "anon";

grant delete on table "budgeting"."asset" to "authenticated";

grant insert on table "budgeting"."asset" to "authenticated";

grant references on table "budgeting"."asset" to "authenticated";

grant select on table "budgeting"."asset" to "authenticated";

grant trigger on table "budgeting"."asset" to "authenticated";

grant truncate on table "budgeting"."asset" to "authenticated";

grant update on table "budgeting"."asset" to "authenticated";

grant delete on table "budgeting"."asset" to "service_role";

grant insert on table "budgeting"."asset" to "service_role";

grant references on table "budgeting"."asset" to "service_role";

grant select on table "budgeting"."asset" to "service_role";

grant trigger on table "budgeting"."asset" to "service_role";

grant truncate on table "budgeting"."asset" to "service_role";

grant update on table "budgeting"."asset" to "service_role";

grant delete on table "budgeting"."transaction_transfer_dismissal" to "anon";

grant insert on table "budgeting"."transaction_transfer_dismissal" to "anon";

grant select on table "budgeting"."transaction_transfer_dismissal" to "anon";

grant update on table "budgeting"."transaction_transfer_dismissal" to "anon";

grant delete on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant insert on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant references on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant select on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant trigger on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant truncate on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant update on table "budgeting"."transaction_transfer_dismissal" to "authenticated";

grant delete on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant insert on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant references on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant select on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant trigger on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant truncate on table "budgeting"."transaction_transfer_dismissal" to "service_role";

grant update on table "budgeting"."transaction_transfer_dismissal" to "service_role";


  create policy "Policy with security definer functions"
  on "budgeting"."bucket"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."budget"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."budget_item"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."category"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."tags"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."transaction"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."transaction_tag"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Policy with security definer functions"
  on "budgeting"."transaction_transfer_dismissal"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



