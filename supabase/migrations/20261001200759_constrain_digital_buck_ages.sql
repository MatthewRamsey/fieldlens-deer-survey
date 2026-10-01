-- Keep future saved ages within the supported groups. Blank preserves old unclassified bucks.
alter table public.digital_bucks
  add constraint digital_buck_age_group check (age_class in ('', '1', '2', '3', '4', '5'));
