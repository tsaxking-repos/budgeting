alter table "sfz_budgeting"."test" drop column "archive";

alter table "sfz_budgeting"."test" add column "archived" boolean not null default false;


