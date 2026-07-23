-- ══════════════════════════════════════════════════════════════════════
--  TANDA 10 — Inventario de materiales
--  Materiales, proveedores, movimientos (entrada/salida) inmutables y
--  recetas de consumo por tratamiento. RLS + FORCE. Nace cerrada.
-- ══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'material_category') then
    create type public.material_category as enum (
      'anestesia', 'restauracion', 'impresion', 'endodoncia', 'implantes',
      'ortodoncia', 'bioseguridad', 'instrumental', 'radiologia', 'consumibles'
    );
  end if;
end $$;

-- ─── Proveedores ──────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  contacto   text,
  telefono   text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
alter table public.suppliers force  row level security;

-- ─── Materiales ───────────────────────────────────────────────────────
create table if not exists public.materials (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  categoria          public.material_category not null,
  unidad             text not null default 'unidad',
  stock_actual       numeric(12,2) not null default 0 check (stock_actual >= 0),
  stock_minimo       numeric(12,2) not null default 0 check (stock_minimo >= 0),
  costo_unitario     numeric(12,2) not null default 0 check (costo_unitario >= 0),
  proveedor_id       uuid references public.suppliers (id) on delete set null,
  ultima_reposicion  date,
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);
alter table public.materials enable row level security;
alter table public.materials force  row level security;
create index if not exists materials_categoria_idx on public.materials (categoria);

-- ─── Movimientos (auditoría inmutable) ────────────────────────────────
create table if not exists public.material_movements (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  tipo        text not null check (tipo in ('entrada', 'salida')),
  cantidad    numeric(12,2) not null check (cantidad > 0),
  motivo      text,
  fecha       date not null default current_date,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);
alter table public.material_movements enable row level security;
alter table public.material_movements force  row level security;
create index if not exists material_movements_material_idx on public.material_movements (material_id, fecha desc);

-- ─── Recetas: materiales por tratamiento ──────────────────────────────
create table if not exists public.treatment_materials (
  id            uuid primary key default gen_random_uuid(),
  treatment_id  uuid not null references public.treatments (id) on delete cascade,
  material_id   uuid not null references public.materials (id) on delete cascade,
  cantidad      numeric(12,2) not null default 1 check (cantidad > 0),
  unique (treatment_id, material_id)
);
alter table public.treatment_materials enable row level security;
alter table public.treatment_materials force  row level security;

-- ─── Políticas ────────────────────────────────────────────────────────
-- Lectura para todo el personal activo.
do $$
declare t text;
begin
  foreach t in array array['suppliers','materials','material_movements','treatment_materials'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %1$I_select on public.%1$I
      for select to authenticated using (public.is_active())$f$, t);
  end loop;
end $$;

-- Escritura de catálogo (materiales/proveedores/recetas): owner y recepción.
create policy suppliers_write on public.suppliers
  for insert to authenticated with check (public.my_role() in ('owner','recepcionista'));
create policy suppliers_update on public.suppliers
  for update to authenticated using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
create policy materials_write on public.materials
  for insert to authenticated with check (public.my_role() in ('owner','recepcionista'));
create policy materials_update on public.materials
  for update to authenticated using (public.my_role() in ('owner','recepcionista'))
  with check (public.my_role() in ('owner','recepcionista'));
create policy treatment_materials_write on public.treatment_materials
  for insert to authenticated with check (public.my_role() = 'owner');

-- Movimientos: los registra el personal clínico y de caja.
create policy material_movements_insert on public.material_movements
  for insert to authenticated
  with check (public.my_role() in ('owner','recepcionista','asistente'));

grant select, insert, update on public.suppliers           to authenticated;
grant select, insert, update on public.materials           to authenticated;
grant select, insert         on public.material_movements  to authenticated;
grant select, insert         on public.treatment_materials to authenticated;
revoke update, delete on public.material_movements from authenticated, anon;

-- Inmutabilidad de movimientos.
create or replace function public.block_material_movements()
returns trigger language plpgsql as $$
begin
  raise exception 'Los movimientos de inventario son inmutables: % bloqueado', tg_op;
end $$;
drop trigger if exists material_movements_no_upd on public.material_movements;
drop trigger if exists material_movements_no_del on public.material_movements;
create trigger material_movements_no_upd before update on public.material_movements
  for each row execute function public.block_material_movements();
create trigger material_movements_no_del before delete on public.material_movements
  for each row execute function public.block_material_movements();

-- ══════════════════════════════════════════════════════════════════════
--  SEED — proveedores
-- ══════════════════════════════════════════════════════════════════════
insert into public.suppliers (id, nombre, contacto, telefono) values
  ('00000000-0000-0000-0002-000000000001','Depósito Dental Dominicano','Ana Mejía','809-555-1001'),
  ('00000000-0000-0000-0002-000000000002','Dental Import SRL','Carlos Peña','809-555-1002'),
  ('00000000-0000-0000-0002-000000000003','Suplidora Odontológica del Caribe','Rosa Núñez','829-555-1003'),
  ('00000000-0000-0000-0002-000000000004','MedDental RD','Luis Fernández','809-555-1004'),
  ('00000000-0000-0000-0002-000000000005','Casa del Dentista','Miguel Santos','849-555-1005'),
  ('00000000-0000-0000-0002-000000000006','Ortho Supply RD','Yamile Objío','809-555-1006'),
  ('00000000-0000-0000-0002-000000000007','BioDental Import','Pedro Guzmán','829-555-1007'),
  ('00000000-0000-0000-0002-000000000008','Implant Solutions RD','Scarlet Read','809-555-1008')
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════════════
--  SEED — 55 materiales dentales reales (algunos bajo mínimo)
-- ══════════════════════════════════════════════════════════════════════
with sup as (
  select array[
    '00000000-0000-0000-0002-000000000001','00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0002-000000000003','00000000-0000-0000-0002-000000000004',
    '00000000-0000-0000-0002-000000000005','00000000-0000-0000-0002-000000000006',
    '00000000-0000-0000-0002-000000000007','00000000-0000-0000-0002-000000000008'
  ]::uuid[] as ids
),
m(nombre, categoria, unidad, stock_actual, stock_minimo, costo) as (values
  ('Lidocaína 2% con epinefrina (cartuchos)','anestesia','cartucho',45,50,55),
  ('Articaína 4% (cartuchos)','anestesia','cartucho',120,60,75),
  ('Mepivacaína 3% (cartuchos)','anestesia','cartucho',30,40,65),
  ('Aguja dental corta 27G','anestesia','caja',18,10,220),
  ('Aguja dental larga 27G','anestesia','caja',8,10,220),
  ('Benzocaína tópica 20%','anestesia','frasco',12,5,480),
  ('Resina compuesta A2','restauracion','jeringa',25,15,950),
  ('Resina compuesta A3','restauracion','jeringa',22,15,950),
  ('Resina compuesta B1','restauracion','jeringa',9,12,950),
  ('Resina fluida A2','restauracion','jeringa',14,10,780),
  ('Ionómero de vidrio','restauracion','set',7,5,1200),
  ('Ácido grabador 37%','restauracion','jeringa',30,20,260),
  ('Adhesivo dental (bonding)','restauracion','frasco',16,10,1450),
  ('Amalgama (cápsulas)','restauracion','caja',6,8,1600),
  ('Alginato','impresion','kg',20,10,620),
  ('Silicona de adición pesada','impresion','set',5,4,2400),
  ('Silicona liviana (light body)','impresion','cartucho',11,8,1350),
  ('Cubetas de impresión desechables','impresion','paquete',40,20,350),
  ('Yeso piedra tipo IV','impresion','kg',25,15,480),
  ('Cera para mordida','impresion','caja',14,8,420),
  ('Limas K #15-40 (serie)','endodoncia','set',12,10,680),
  ('Limas rotatorias ProTaper','endodoncia','set',4,5,3200),
  ('Gutapercha (puntas)','endodoncia','caja',18,10,540),
  ('Conos de papel absorbente','endodoncia','caja',22,12,380),
  ('Sellador endodóntico AH Plus','endodoncia','set',6,4,2100),
  ('Hipoclorito de sodio 5.25%','endodoncia','litro',8,6,240),
  ('EDTA 17%','endodoncia','frasco',5,5,560),
  ('Implante de titanio 3.5mm','implantes','unidad',10,6,12500),
  ('Implante de titanio 4.0mm','implantes','unidad',8,6,12500),
  ('Pilar de cicatrización','implantes','unidad',12,8,3800),
  ('Tornillo de cobertura','implantes','unidad',15,10,1800),
  ('Membrana de regeneración','implantes','unidad',3,4,6500),
  ('Injerto óseo (0.5g)','implantes','frasco',5,4,8900),
  ('Brackets metálicos (kit)','ortodoncia','kit',9,6,4200),
  ('Brackets cerámicos (kit)','ortodoncia','kit',4,4,7800),
  ('Arco NiTi 0.014','ortodoncia','paquete',20,12,520),
  ('Ligaduras elásticas','ortodoncia','bolsa',30,15,180),
  ('Bandas molares','ortodoncia','caja',7,6,980),
  ('Cadena elastomérica','ortodoncia','rollo',11,8,260),
  ('Guantes de nitrilo M (caja 100)','bioseguridad','caja',35,20,620),
  ('Guantes de nitrilo S (caja 100)','bioseguridad','caja',12,20,620),
  ('Mascarillas quirúrgicas (caja 50)','bioseguridad','caja',40,20,350),
  ('Gorros desechables','bioseguridad','paquete',18,10,240),
  ('Batas desechables','bioseguridad','paquete',9,10,780),
  ('Campos desechables','bioseguridad','paquete',25,15,320),
  ('Fresas de diamante (surtido)','instrumental','set',16,10,890),
  ('Fresas de carburo','instrumental','set',10,8,760),
  ('Espejo bucal #5','instrumental','unidad',30,15,180),
  ('Explorador dental','instrumental','unidad',22,12,160),
  ('Películas radiográficas periapicales','radiologia','caja',6,8,1250),
  ('Líquido revelador','radiologia','litro',4,3,420),
  ('Rollos de algodón','consumibles','paquete',50,25,220),
  ('Eyectores de saliva','consumibles','paquete',45,25,190),
  ('Vasos desechables','consumibles','paquete',30,20,150),
  ('Servilletas de paciente','consumibles','paquete',28,15,240)
)
insert into public.materials
  (nombre, categoria, unidad, stock_actual, stock_minimo, costo_unitario, proveedor_id, ultima_reposicion)
select
  m.nombre, m.categoria::public.material_category, m.unidad,
  m.stock_actual, m.stock_minimo, m.costo,
  (select ids from sup)[1 + ((row_number() over ()) % 8)::int],
  (current_date - (((row_number() over ()) * 3) % 55)::int)
from m
on conflict do nothing;

-- Movimientos recientes (consumo del mes).
insert into public.material_movements (material_id, tipo, cantidad, motivo, fecha)
select id, 'salida', (2 + ((row_number() over ())::int % 4)), 'Consumo en tratamientos',
  (date_trunc('month', current_date)::date + ((row_number() over ())::int % greatest(extract(day from current_date)::int - 1, 1)))
from public.materials
limit 24;

-- Recetas de consumo por tratamiento.
insert into public.treatment_materials (treatment_id, material_id, cantidad)
select t.id, mat.id, x.cantidad
from (values
  ('Resina compuesta (1 superficie)','Resina compuesta A2',1),
  ('Resina compuesta (1 superficie)','Ácido grabador 37%',1),
  ('Resina compuesta (1 superficie)','Adhesivo dental (bonding)',1),
  ('Extracción simple','Lidocaína 2% con epinefrina (cartuchos)',2),
  ('Extracción simple','Guantes de nitrilo M (caja 100)',1),
  ('Endodoncia unirradicular','Limas K #15-40 (serie)',1),
  ('Endodoncia unirradicular','Gutapercha (puntas)',1),
  ('Endodoncia unirradicular','Hipoclorito de sodio 5.25%',1),
  ('Limpieza dental (profilaxis)','Guantes de nitrilo M (caja 100)',1),
  ('Implante dental (unitario)','Implante de titanio 4.0mm',1),
  ('Implante dental (unitario)','Injerto óseo (0.5g)',1)
) as x(trat, mat, cantidad)
join public.treatments t on t.nombre = x.trat
join public.materials mat on mat.nombre = x.mat
on conflict (treatment_id, material_id) do nothing;
