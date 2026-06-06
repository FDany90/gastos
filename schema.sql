-- ============================================================
--  GASTOS · Esquema para Supabase (FASE 2)
--  Pegá esto en Supabase → SQL Editor → Run.
--  Activa Row Level Security para que cada usuario vea solo lo suyo.
-- ============================================================

-- ---------- GASTOS ----------
create table if not exists gastos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) default auth.uid(),
  monto       numeric(14,2) not null check (monto >= 0),
  moneda      text not null default 'ARS' check (moneda in ('ARS','USD')),
  tipo        text not null default 'variable' check (tipo in ('fijo','variable')),
  categoria   text not null,
  descripcion text,
  fecha       date not null default current_date,
  created_at  timestamptz default now()
);

-- ---------- INGRESOS ----------
create table if not exists ingresos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) default auth.uid(),
  monto       numeric(14,2) not null check (monto >= 0),
  moneda      text not null default 'USD' check (moneda in ('ARS','USD')),
  fuente      text not null,
  recurrente  boolean default false,
  descripcion text,
  fecha       date not null default current_date,
  created_at  timestamptz default now()
);

-- ---------- INVERSIONES (cripto) ----------
create table if not exists inversiones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) default auth.uid(),
  simbolo       text not null,
  nombre        text,
  cantidad      numeric(24,8) not null check (cantidad >= 0),
  precio_compra numeric(18,2) not null,
  precio_actual numeric(18,2) not null,
  fecha         date not null default current_date,
  created_at    timestamptz default now()
);

-- ---------- METAS ----------
create table if not exists metas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) default auth.uid(),
  nombre       text not null,
  icono        text default '🎯',
  objetivo     numeric(14,2) not null check (objetivo > 0),
  actual       numeric(14,2) not null default 0,
  moneda       text not null default 'USD' check (moneda in ('ARS','USD')),
  fecha_limite date,
  created_at   timestamptz default now()
);

-- ---------- STATS / GAMIFICACIÓN (1 fila por usuario) ----------
create table if not exists stats_usuario (
  user_id          uuid primary key references auth.users (id) default auth.uid(),
  xp               integer not null default 0,
  racha_max        integer not null default 0,
  dias_actividad   jsonb not null default '{}'::jsonb,  -- { "2026-06-06": true, ... }
  logros           jsonb not null default '{}'::jsonb,  -- { "primer_gasto": "2026-06-06", ... }
  metas_cumplidas  jsonb not null default '{}'::jsonb,
  tipo_cambio_usd  numeric(12,2) not null default 1150,
  updated_at       timestamptz default now()
);

-- ============================================================
--  ROW LEVEL SECURITY  (cada usuario, solo sus filas)
-- ============================================================
alter table gastos        enable row level security;
alter table ingresos      enable row level security;
alter table inversiones   enable row level security;
alter table metas         enable row level security;
alter table stats_usuario enable row level security;

-- política genérica: el dueño puede todo sobre sus filas
do $$
declare t text;
begin
  foreach t in array array['gastos','ingresos','inversiones','metas','stats_usuario'] loop
    execute format($f$
      create policy "own_select_%1$s" on %1$s for select using (auth.uid() = user_id);
      create policy "own_insert_%1$s" on %1$s for insert with check (auth.uid() = user_id);
      create policy "own_update_%1$s" on %1$s for update using (auth.uid() = user_id);
      create policy "own_delete_%1$s" on %1$s for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- índices útiles
create index if not exists idx_gastos_user_fecha   on gastos (user_id, fecha desc);
create index if not exists idx_ingresos_user_fecha on ingresos (user_id, fecha desc);
