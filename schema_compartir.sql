-- ============================================================
--  COMPARTIR DATOS ENTRE DISPOSITIVOS (sin login)
--  Pegá esto en Supabase → SQL Editor → Run.
--
--  Cambia las reglas (RLS) para que cualquier sesión anónima
--  vea y edite el MISMO conjunto de datos. Así abrís la app
--  desde PC, celular o donde sea y ves lo mismo, sin loguearte.
--
--  ⚠️ Nota de seguridad: con esto, cualquiera con la URL de la
--  app puede ver/editar los datos. Es el precio de "sin login".
-- ============================================================

do $$
declare t text; p record;
begin
  foreach t in array array['gastos','ingresos','inversiones','metas','stats_usuario','recurrentes'] loop
    -- borrar políticas anteriores (las por-usuario)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    -- política compartida: cualquier usuario autenticado (incluye anónimos) ve/edita todo
    execute format('create policy "compartido_%1$s" on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
