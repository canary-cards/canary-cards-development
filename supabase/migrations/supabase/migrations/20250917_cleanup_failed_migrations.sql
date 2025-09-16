-- Mirror of manual prod hotfix so history stays consistent
-- Safe to run multiple times

delete from storage.buckets where id='svg-assets';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid=e.enumtypid
    where t.typname='payment_status' and e.enumlabel='refunded'
  ) then
    alter type payment_status add value 'refunded';
  end if;
end$$;

insert into supabase_migrations.schema_migrations(version) values
('20250903012948_c1c2e15f-46c0-4802-a69b-eae3a458e94d'),
('20250903201111_8238529f-d297-4c83-875a-18492269e8a3'),
('20250904195015_548eee53-745a-4dd9-aaf6-87dd7c6db27b'),
('20250904200324_7d64d701-bfbd-4a21-892c-d4eda2780290'),
('20250904200547_58dfc6e3-b785-48a6-903c-1a3204bd4ea5'),
('20250905001012_ac1e3d3d-82c1-4e71-84c6-b576bfec6abe'),
('20250907080439_74036412-3c8f-406b-a1de-24f4095be0b9'),
('20250907095025_423a91cf-7957-443d-9086-f8ebdc109ba2'),
('20250909180036_0a9f7865-4a9e-40f4-8e89-36f678fddde8'),
('20250910155000_critical_rls_policies_fix'),
('20250915173924_6fbc059c-578a-4055-be5b-d78393028cce'),
('20250915181641_fa3ccbc6-1ee7-401a-a616-227617169b38'),
('20250915181854_07d41ad9-f635-4fa8-b77c-b96532bc660e'),
('20250916093836_remove_svg_assets_permanently')
on conflict (version) do nothing;
