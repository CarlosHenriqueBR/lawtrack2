create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) in ('isaacbcb2025@gmail.com','carlos-henrique720@hotmail.com') then
    insert into public.user_roles(user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  elsif not exists (select 1 from public.user_roles) then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
insert into public.user_roles(user_id, role)
select id, 'super_admin' from auth.users
where lower(email) in ('isaacbcb2025@gmail.com','carlos-henrique720@hotmail.com')
on conflict do nothing;