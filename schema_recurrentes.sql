-- ============================================================
--  MIGRACIÓN · Movimientos recurrentes (gastos/ingresos fijos)
--  Pegá esto en Supabase → SQL Editor → Run.
--  Cargás una plantilla UNA vez y la app genera el movimiento
--  cada mes automáticamente.
-- ============================================================

create table if not exists recurrentes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) default auth.uid(),
  tipo_mov   text not null default 'gasto' check (tipo_mov in ('gasto','ingreso')),
  nombre     text not null,
  monto      numeric(14,2) not null check (monto >= 0),
  moneda     text not null default 'ARS' check (moneda in ('ARS','USD')),
  categoria  text,                 -- para gastos
  fuente     text,                 -- para ingresos
  tipo       text not null default 'fijo',
  dia_mes    int  not null default 1 check (dia_mes between 1 and 31),
  desde      text not null,        -- 'YYYY-MM': desde qué mes aplica
  activo     boolean not null default true,
  created_at timestamptz default now()
);

-- vínculo de cada movimiento generado con su plantilla
alter table gastos   add column if not exists recurrente_id uuid references recurrentes (id) on delete set null;
alter table ingresos add column if not exists recurrente_id uuid references recurrentes (id) on delete set null;

-- Row Level Security
alter table recurrentes enable row level security;
create policy "own_select_recurrentes" on recurrentes for select using (auth.uid() = user_id);
create policy "own_insert_recurrentes" on recurrentes for insert with check (auth.uid() = user_id);
create policy "own_update_recurrentes" on recurrentes for update using (auth.uid() = user_id);
create policy "own_delete_recurrentes" on recurrentes for delete using (auth.uid() = user_id);

create index if not exists idx_recurrentes_user on recurrentes (user_id, activo);
