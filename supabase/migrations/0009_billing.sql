-- ══════════════════════════════════════════════════════════════════════
--  TANDA 8 — Facturación (parte 2/2)
--  Facturas con NCF simulado (B01/B02), ítems, pagos y secuencias NCF.
--  Facturas inmutables una vez emitidas: solo cambian de estado / se anulan
--  con motivo. Ítems y pagos inmutables. RLS + FORCE. Aplicar tras 0008.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum
      ('efectivo', 'transferencia', 'tarjeta', 'seguro', 'mixto');
  end if;
end $$;

-- ─── Secuencias NCF ───────────────────────────────────────────────────
create table if not exists public.ncf_sequences (
  tipo              text primary key,
  prefijo           text not null,
  secuencia_actual  bigint not null default 0,
  secuencia_final   bigint not null
);
alter table public.ncf_sequences enable row level security;
alter table public.ncf_sequences force  row level security;
-- Sin políticas: nadie accede directo. Solo next_ncf() (SECURITY DEFINER).

insert into public.ncf_sequences (tipo, prefijo, secuencia_actual, secuencia_final) values
  ('B01', 'B01', 0, 50000000),
  ('B02', 'B02', 0, 50000000)
on conflict (tipo) do nothing;

-- Emisor atómico de NCF. SECURITY DEFINER: incrementa saltando RLS.
create or replace function public.next_ncf(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare seq bigint; pref text;
begin
  update public.ncf_sequences
     set secuencia_actual = secuencia_actual + 1
   where tipo = p_tipo and secuencia_actual < secuencia_final
   returning secuencia_actual, prefijo into seq, pref;
  if seq is null then
    raise exception 'Secuencia NCF agotada o tipo inválido: %', p_tipo;
  end if;
  return pref || lpad(seq::text, 8, '0');
end $$;
revoke all on function public.next_ncf(text) from public, anon;
grant execute on function public.next_ncf(text) to authenticated;

-- ─── Ampliación de invoices ───────────────────────────────────────────
alter table public.invoices
  add column if not exists ncf                 text,
  add column if not exists tipo_ncf            text not null default 'B02',
  add column if not exists subtotal            numeric(12,2) not null default 0,
  add column if not exists descuento_global    numeric(12,2) not null default 0,
  add column if not exists itbis               numeric(12,2) not null default 0,
  add column if not exists total               numeric(12,2) not null default 0,
  add column if not exists metodo_pago         public.payment_method,
  add column if not exists notas               text,
  add column if not exists motivo_cancelacion  text,
  add column if not exists created_by          uuid references public.profiles (id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_tipo_ncf_check;
alter table public.invoices
  add constraint invoices_tipo_ncf_check check (tipo_ncf in ('B01', 'B02')) not valid;

-- ─── invoice_items ────────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  tratamiento_id   uuid,
  descripcion      text not null,
  cantidad         integer not null default 1 check (cantidad > 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  descuento_item   numeric(12,2) not null default 0 check (descuento_item >= 0),
  subtotal         numeric(12,2) not null,
  created_at       timestamptz not null default now()
);
alter table public.invoice_items enable row level security;
alter table public.invoice_items force  row level security;
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- ─── payments ─────────────────────────────────────────────────────────
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  metodo       public.payment_method not null,
  monto        numeric(12,2) not null check (monto > 0),
  referencia   text,
  fecha        date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);
alter table public.payments enable row level security;
alter table public.payments force  row level security;
create index if not exists payments_invoice_idx on public.payments (invoice_id);
-- Voucher de transferencia único (evita duplicados).
create unique index if not exists payments_transferencia_ref_key
  on public.payments (referencia)
  where metodo = 'transferencia' and referencia is not null;

-- ══════════════════════════════════════════════════════════════════════
--  BACKFILL de facturas sembradas en T2 (antes de crear los triggers)
-- ══════════════════════════════════════════════════════════════════════
with inv as (
  select id, monto, estado, row_number() over (order by created_at) rn
  from public.invoices where ncf is null
)
update public.invoices i set
  ncf              = public.next_ncf('B02'),
  tipo_ncf         = 'B02',
  subtotal         = round(i.monto / 1.18, 2),
  descuento_global = 0,
  itbis            = round(i.monto - round(i.monto / 1.18, 2), 2),
  total            = i.monto,
  metodo_pago      = case when i.estado = 'pagada'
                       then (array['efectivo','transferencia','tarjeta','seguro'])[1 + (inv.rn % 4)]::public.payment_method
                       else null end
from inv where inv.id = i.id;

-- Un ítem por factura sembrada.
insert into public.invoice_items (invoice_id, descripcion, cantidad, precio_unitario, descuento_item, subtotal)
select id, 'Servicios odontológicos', 1, subtotal, 0, subtotal
from public.invoices
where ncf is not null
  and not exists (select 1 from public.invoice_items it where it.invoice_id = invoices.id);

-- Pago por cada factura pagada.
insert into public.payments (invoice_id, metodo, monto, fecha)
select id, coalesce(metodo_pago, 'efectivo'), total, fecha
from public.invoices
where estado = 'pagada'
  and not exists (select 1 from public.payments p where p.invoice_id = invoices.id);

-- NCF único (todas asignadas ya).
create unique index if not exists invoices_ncf_key
  on public.invoices (ncf) where ncf is not null;

-- ══════════════════════════════════════════════════════════════════════
--  INMUTABILIDAD (después del backfill)
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.invoices_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las facturas no se borran: anula con motivo.';
  end if;
  -- Campos financieros e identidad son inmutables tras emitir.
  if old.ncf is distinct from new.ncf
     or old.subtotal is distinct from new.subtotal
     or old.itbis is distinct from new.itbis
     or old.total is distinct from new.total
     or old.descuento_global is distinct from new.descuento_global
     or old.tipo_ncf is distinct from new.tipo_ncf
     or old.patient_id is distinct from new.patient_id then
    raise exception 'Factura emitida inmutable: solo cambia estado/pago/motivo.';
  end if;
  return new;
end $$;

drop trigger if exists invoices_guard_upd on public.invoices;
drop trigger if exists invoices_guard_del on public.invoices;
create trigger invoices_guard_upd before update on public.invoices
  for each row execute function public.invoices_guard();
create trigger invoices_guard_del before delete on public.invoices
  for each row execute function public.invoices_guard();

create or replace function public.block_billing_children()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro de facturación inmutable: operación % bloqueada', tg_op;
end $$;

drop trigger if exists invoice_items_no_upd on public.invoice_items;
drop trigger if exists invoice_items_no_del on public.invoice_items;
create trigger invoice_items_no_upd before update on public.invoice_items
  for each row execute function public.block_billing_children();
create trigger invoice_items_no_del before delete on public.invoice_items
  for each row execute function public.block_billing_children();

drop trigger if exists payments_no_upd on public.payments;
drop trigger if exists payments_no_del on public.payments;
create trigger payments_no_upd before update on public.payments
  for each row execute function public.block_billing_children();
create trigger payments_no_del before delete on public.payments
  for each row execute function public.block_billing_children();

-- ══════════════════════════════════════════════════════════════════════
--  POLÍTICAS (facturación: owner y recepcionista)
-- ══════════════════════════════════════════════════════════════════════
-- invoices_select ya existe (T2). Añadimos escritura.
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.my_role() in ('owner', 'recepcionista'));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.my_role() in ('owner', 'recepcionista'))
  with check (public.my_role() in ('owner', 'recepcionista'));

do $$
declare t text;
begin
  foreach t in array array['invoice_items','payments'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %1$I_select on public.%1$I
      for select to authenticated
      using (public.my_role() in ('owner','recepcionista'))$f$, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$create policy %1$I_insert on public.%1$I
      for insert to authenticated
      with check (public.my_role() in ('owner','recepcionista'))$f$, t);
  end loop;
end $$;

grant insert, update         on public.invoices      to authenticated;
grant select, insert         on public.invoice_items to authenticated;
grant select, insert         on public.payments      to authenticated;
revoke update, delete on public.invoice_items from authenticated, anon;
revoke update, delete on public.payments      from authenticated, anon;
