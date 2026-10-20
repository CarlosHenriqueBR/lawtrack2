create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) in ('isaacbcb2025@gmail.com','carlos-henrique720@hotmail.com')
     or not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users
where lower(email) in ('isaacbcb2025@gmail.com','carlos-henrique720@hotmail.com')
on conflict do nothing;