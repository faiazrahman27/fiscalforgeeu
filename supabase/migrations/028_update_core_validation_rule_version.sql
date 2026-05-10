-- Align the database-seeded Invoice Lantern core technical rule catalog
-- with the package/runtime version. This does not alter VAT-format rules,
-- store XML, weaken RLS, or make official/compliance claims.

do $$
declare
  core_rule_set_id uuid;
begin
  select id
    into core_rule_set_id
  from public.validation_rule_sets
  where code = 'INVOICE_LANTERN_CORE';

  if core_rule_set_id is null then
    return;
  end if;

  delete from public.validation_rules old_rules
  where old_rules.rule_set_id = core_rule_set_id
    and old_rules.version <> '2026.05.1'
    and exists (
      select 1
      from public.validation_rules current_rules
      where current_rules.rule_set_id = old_rules.rule_set_id
        and current_rules.code = old_rules.code
        and current_rules.version = '2026.05.1'
    );

  update public.validation_rules
  set
    version = '2026.05.1',
    updated_at = now()
  where rule_set_id = core_rule_set_id
    and version <> '2026.05.1';

  update public.validation_rule_sets
  set
    version = '2026.05.1',
    updated_at = now()
  where id = core_rule_set_id
    and version <> '2026.05.1';
end $$;
