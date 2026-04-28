
  create policy "Enable all on test for everyone"
  on "sfz_budgeting"."test"
  as permissive
  for all
  to public
using (true)
with check (true);



