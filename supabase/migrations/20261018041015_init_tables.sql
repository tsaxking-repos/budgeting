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

create schema if not exists "budgeting";


  create table "budgeting"."bucket" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "name" text not null,
    "balance" bigint not null
      );


alter table "budgeting"."bucket" enable row level security;


  create table "budgeting"."budget" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "name" text not null,
    "start_date" timestamp with time zone not null,
    "end_date" timestamp with time zone not null,
    "status" text not null
      );


alter table "budgeting"."budget" enable row level security;


  create table "budgeting"."budget_item" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "budget_id" uuid not null,
    "category" uuid not null,
    "planned_amount" bigint not null,
    "rollover" boolean not null
      );


alter table "budgeting"."budget_item" enable row level security;


  create table "budgeting"."category" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "name" text not null,
    "parent_id" uuid,
    "kind" text not null,
    "icon" text,
    "color" text
      );


alter table "budgeting"."category" enable row level security;


  create table "budgeting"."tags" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "name" text not null,
    "color" text not null
      );


alter table "budgeting"."tags" enable row level security;


  create table "budgeting"."transaction" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "description" text not null,
    "amount" bigint not null,
    "bucket_id" uuid not null
      );


alter table "budgeting"."transaction" enable row level security;


  create table "budgeting"."transaction_tag" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null,
    "transaction_id" uuid,
    "tag_id" uuid
      );


alter table "budgeting"."transaction_tag" enable row level security;

CREATE UNIQUE INDEX bucket_pkey ON budgeting.bucket USING btree (id);

CREATE UNIQUE INDEX budget_item_pkey ON budgeting.budget_item USING btree (id);

CREATE UNIQUE INDEX budgets_pkey ON budgeting.budget USING btree (id);

CREATE UNIQUE INDEX category_pkey ON budgeting.category USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON budgeting.tags USING btree (id);

CREATE UNIQUE INDEX transaction_pkey ON budgeting.transaction USING btree (id);

CREATE UNIQUE INDEX transaction_tag_pkey ON budgeting.transaction_tag USING btree (id);

alter table "budgeting"."bucket" add constraint "bucket_pkey" PRIMARY KEY using index "bucket_pkey";

alter table "budgeting"."budget" add constraint "budgets_pkey" PRIMARY KEY using index "budgets_pkey";

alter table "budgeting"."budget_item" add constraint "budget_item_pkey" PRIMARY KEY using index "budget_item_pkey";

alter table "budgeting"."category" add constraint "category_pkey" PRIMARY KEY using index "category_pkey";

alter table "budgeting"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "budgeting"."transaction" add constraint "transaction_pkey" PRIMARY KEY using index "transaction_pkey";

alter table "budgeting"."transaction_tag" add constraint "transaction_tag_pkey" PRIMARY KEY using index "transaction_tag_pkey";

alter table "budgeting"."budget_item" add constraint "budget_item_budget_id_fkey" FOREIGN KEY (budget_id) REFERENCES budgeting.budget(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."budget_item" validate constraint "budget_item_budget_id_fkey";

alter table "budgeting"."budget_item" add constraint "budget_item_category_fkey" FOREIGN KEY (category) REFERENCES budgeting.category(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."budget_item" validate constraint "budget_item_category_fkey";

alter table "budgeting"."category" add constraint "category_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES budgeting.category(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "budgeting"."category" validate constraint "category_parent_id_fkey";

alter table "budgeting"."transaction" add constraint "transaction_bucket_id_fkey" FOREIGN KEY (bucket_id) REFERENCES budgeting.bucket(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."transaction" validate constraint "transaction_bucket_id_fkey";

alter table "budgeting"."transaction_tag" add constraint "transaction_tag_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES budgeting.tags(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."transaction_tag" validate constraint "transaction_tag_tag_id_fkey";

alter table "budgeting"."transaction_tag" add constraint "transaction_tag_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES budgeting.transaction(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "budgeting"."transaction_tag" validate constraint "transaction_tag_transaction_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION budgeting.apply_transaction_balance_deltas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM inserted_rows
      WHERE bucket_id IS NULL OR amount IS NULL
    ) THEN
      RAISE EXCEPTION 'transaction bucket_id and amount must not be null';
    END IF;

    FOR r IN
      SELECT bucket_id, sum(amount::numeric) AS delta
      FROM inserted_rows
      GROUP BY bucket_id
      HAVING sum(amount::numeric) <> 0
      ORDER BY bucket_id
    LOOP
      UPDATE budgeting.bucket
      SET balance = (balance::numeric + r.delta)::bigint
      WHERE id = r.bucket_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'bucket % does not exist', r.bucket_id;
      END IF;
    END LOOP;

  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM new_rows
      WHERE bucket_id IS NULL OR amount IS NULL
    ) THEN
      RAISE EXCEPTION 'transaction bucket_id and amount must not be null';
    END IF;

    FOR r IN
      SELECT bucket_id, sum(delta) AS delta
      FROM (
        SELECT bucket_id, -amount::numeric AS delta
        FROM old_rows
        WHERE bucket_id IS NOT NULL
        UNION ALL
        SELECT bucket_id, amount::numeric AS delta
        FROM new_rows
      ) AS changes
      GROUP BY bucket_id
      HAVING sum(delta) <> 0
      ORDER BY bucket_id
    LOOP
      UPDATE budgeting.bucket
      SET balance = (balance::numeric + r.delta)::bigint
      WHERE id = r.bucket_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'bucket % does not exist', r.bucket_id;
      END IF;
    END LOOP;

  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM deleted_rows WHERE amount IS NULL
    ) THEN
      RAISE EXCEPTION 'cannot reverse a transaction with null amount';
    END IF;

    FOR r IN
      SELECT bucket_id, sum(delta) AS delta
      FROM (
        SELECT bucket_id, -amount::numeric AS delta
        FROM deleted_rows
        WHERE bucket_id IS NOT NULL
      ) AS changes
      GROUP BY bucket_id
      HAVING sum(delta) <> 0
      ORDER BY bucket_id
    LOOP
      UPDATE budgeting.bucket
      SET balance = (balance::numeric + r.delta)::bigint
      WHERE id = r.bucket_id;
      -- A missing bucket during DELETE can occur during the existing FK's ON DELETE CASCADE.
      -- For ordinary transaction deletes, the foreign key guarantees the bucket exists.
    END LOOP;
  ELSE
    RAISE EXCEPTION 'unsupported trigger operation: %', TG_OP;
  END IF;

  RETURN NULL;
END;
$function$
;

grant delete on table "budgeting"."bucket" to "authenticated";

grant insert on table "budgeting"."bucket" to "authenticated";

grant references on table "budgeting"."bucket" to "authenticated";

grant select on table "budgeting"."bucket" to "authenticated";

grant trigger on table "budgeting"."bucket" to "authenticated";

grant truncate on table "budgeting"."bucket" to "authenticated";

grant update on table "budgeting"."bucket" to "authenticated";

grant delete on table "budgeting"."bucket" to "service_role";

grant insert on table "budgeting"."bucket" to "service_role";

grant references on table "budgeting"."bucket" to "service_role";

grant select on table "budgeting"."bucket" to "service_role";

grant trigger on table "budgeting"."bucket" to "service_role";

grant truncate on table "budgeting"."bucket" to "service_role";

grant update on table "budgeting"."bucket" to "service_role";

grant delete on table "budgeting"."budget" to "authenticated";

grant insert on table "budgeting"."budget" to "authenticated";

grant references on table "budgeting"."budget" to "authenticated";

grant select on table "budgeting"."budget" to "authenticated";

grant trigger on table "budgeting"."budget" to "authenticated";

grant truncate on table "budgeting"."budget" to "authenticated";

grant update on table "budgeting"."budget" to "authenticated";

grant delete on table "budgeting"."budget" to "service_role";

grant insert on table "budgeting"."budget" to "service_role";

grant references on table "budgeting"."budget" to "service_role";

grant select on table "budgeting"."budget" to "service_role";

grant trigger on table "budgeting"."budget" to "service_role";

grant truncate on table "budgeting"."budget" to "service_role";

grant update on table "budgeting"."budget" to "service_role";

grant delete on table "budgeting"."budget_item" to "authenticated";

grant insert on table "budgeting"."budget_item" to "authenticated";

grant references on table "budgeting"."budget_item" to "authenticated";

grant select on table "budgeting"."budget_item" to "authenticated";

grant trigger on table "budgeting"."budget_item" to "authenticated";

grant truncate on table "budgeting"."budget_item" to "authenticated";

grant update on table "budgeting"."budget_item" to "authenticated";

grant delete on table "budgeting"."budget_item" to "service_role";

grant insert on table "budgeting"."budget_item" to "service_role";

grant references on table "budgeting"."budget_item" to "service_role";

grant select on table "budgeting"."budget_item" to "service_role";

grant trigger on table "budgeting"."budget_item" to "service_role";

grant truncate on table "budgeting"."budget_item" to "service_role";

grant update on table "budgeting"."budget_item" to "service_role";

grant delete on table "budgeting"."category" to "authenticated";

grant insert on table "budgeting"."category" to "authenticated";

grant references on table "budgeting"."category" to "authenticated";

grant select on table "budgeting"."category" to "authenticated";

grant trigger on table "budgeting"."category" to "authenticated";

grant truncate on table "budgeting"."category" to "authenticated";

grant update on table "budgeting"."category" to "authenticated";

grant delete on table "budgeting"."category" to "service_role";

grant insert on table "budgeting"."category" to "service_role";

grant references on table "budgeting"."category" to "service_role";

grant select on table "budgeting"."category" to "service_role";

grant trigger on table "budgeting"."category" to "service_role";

grant truncate on table "budgeting"."category" to "service_role";

grant update on table "budgeting"."category" to "service_role";

grant delete on table "budgeting"."tags" to "authenticated";

grant insert on table "budgeting"."tags" to "authenticated";

grant references on table "budgeting"."tags" to "authenticated";

grant select on table "budgeting"."tags" to "authenticated";

grant trigger on table "budgeting"."tags" to "authenticated";

grant truncate on table "budgeting"."tags" to "authenticated";

grant update on table "budgeting"."tags" to "authenticated";

grant delete on table "budgeting"."tags" to "service_role";

grant insert on table "budgeting"."tags" to "service_role";

grant references on table "budgeting"."tags" to "service_role";

grant select on table "budgeting"."tags" to "service_role";

grant trigger on table "budgeting"."tags" to "service_role";

grant truncate on table "budgeting"."tags" to "service_role";

grant update on table "budgeting"."tags" to "service_role";

grant delete on table "budgeting"."transaction" to "authenticated";

grant insert on table "budgeting"."transaction" to "authenticated";

grant references on table "budgeting"."transaction" to "authenticated";

grant select on table "budgeting"."transaction" to "authenticated";

grant trigger on table "budgeting"."transaction" to "authenticated";

grant truncate on table "budgeting"."transaction" to "authenticated";

grant update on table "budgeting"."transaction" to "authenticated";

grant delete on table "budgeting"."transaction" to "service_role";

grant insert on table "budgeting"."transaction" to "service_role";

grant references on table "budgeting"."transaction" to "service_role";

grant select on table "budgeting"."transaction" to "service_role";

grant trigger on table "budgeting"."transaction" to "service_role";

grant truncate on table "budgeting"."transaction" to "service_role";

grant update on table "budgeting"."transaction" to "service_role";

grant delete on table "budgeting"."transaction_tag" to "authenticated";

grant insert on table "budgeting"."transaction_tag" to "authenticated";

grant references on table "budgeting"."transaction_tag" to "authenticated";

grant select on table "budgeting"."transaction_tag" to "authenticated";

grant trigger on table "budgeting"."transaction_tag" to "authenticated";

grant truncate on table "budgeting"."transaction_tag" to "authenticated";

grant update on table "budgeting"."transaction_tag" to "authenticated";

grant delete on table "budgeting"."transaction_tag" to "service_role";

grant insert on table "budgeting"."transaction_tag" to "service_role";

grant references on table "budgeting"."transaction_tag" to "service_role";

grant select on table "budgeting"."transaction_tag" to "service_role";

grant trigger on table "budgeting"."transaction_tag" to "service_role";

grant truncate on table "budgeting"."transaction_tag" to "service_role";

grant update on table "budgeting"."transaction_tag" to "service_role";

CREATE TRIGGER transaction_balance_after_delete AFTER DELETE ON budgeting.transaction REFERENCING OLD TABLE AS deleted_rows FOR EACH STATEMENT EXECUTE FUNCTION budgeting.apply_transaction_balance_deltas();

CREATE TRIGGER transaction_balance_after_insert AFTER INSERT ON budgeting.transaction REFERENCING NEW TABLE AS inserted_rows FOR EACH STATEMENT EXECUTE FUNCTION budgeting.apply_transaction_balance_deltas();

CREATE TRIGGER transaction_balance_after_update AFTER UPDATE ON budgeting.transaction REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION budgeting.apply_transaction_balance_deltas();


