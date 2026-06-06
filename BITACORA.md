# 📒 BITÁCORA DEL PROYECTO — GASTOS

> Documento maestro con **todo lo realizado**, decisiones, accesos y pendientes.
> Pensado para retomar el proyecto sin depender del chat. Última actualización: **2026-06-06**.

---

## 1. Qué es

App web para **administrar finanzas personales** (gastos, ingresos, inversiones cripto)
con un sistema de **gamificación** (niveles, rachas, logros, metas) que motiva a registrar
con disciplina y a ahorrar. Multi-moneda (ARS / USD) + cripto. Datos en la nube (Supabase),
**sin login**, compartidos entre todos los dispositivos.

- **Repo Git:** https://github.com/FDany90/gastos
- **Stack:** HTML + CSS + JavaScript vanilla (sin framework) · Supabase (Postgres + Auth) · Chart.js (CDN)

---

## 2. Cómo correrlo

Es una web estática. Para que funcione Supabase/CDN tiene que servirse por `http(s)://`
(no abrir con `file://`).

```bash
# local
python -m http.server 8000     # y entrar a http://localhost:8000
```

Para abrirlo en el **celular** está publicado (o conviene publicarlo) con **GitHub Pages**:
Settings → Pages → branch `main` → la URL queda tipo `https://fdany90.github.io/gastos/`.
Tras cada cambio pusheado, **refrescar fuerte** (recargar/limpiar caché de la pestaña).

---

## 3. Estructura de archivos

```
GASTOS/
├── index.html          → Dashboard / Balance
├── gastos.html         → Gastos + Gastos fijos
├── ingresos.html       → Ingresos + Ingresos fijos
├── inversiones.html    → Inversiones cripto
├── metas.html          → Metas & Logros
├── reportes.html       → Reportes (comparativas, TC, reset)
├── css/styles.css      → estilos, tema, responsive, gamificación
├── js/
│   ├── config.js       → credenciales Supabase (URL + anon key)
│   ├── supabaseClient.js → crea el cliente global `SB`
│   ├── auth.js         → acceso anónimo automático + "asegurar cuenta"
│   ├── format.js       → formato de moneda/fechas (ARS "$", USD "US$")
│   ├── store.js        → CAPA DE DATOS: caché + lectura/escritura Supabase + recurrentes
│   ├── analytics.js    → cálculos (balances, por moneda, comparativas, score)
│   ├── gamification.js → niveles/XP, rachas, 16 logros
│   ├── layout.js       → sidebar, drawer mobile, carga rápida (FAB), modales, toasts
│   ├── dashboard.js / gastos.js / ingresos.js / inversiones.js / metas.js / reportes.js
├── schema.sql              → tablas base + RLS (YA EJECUTADO)
├── schema_recurrentes.sql  → tabla recurrentes + columnas (YA EJECUTADO)
├── schema_compartir.sql    → RLS compartido sin login (YA EJECUTADO)
├── README.md
└── BITACORA.md         → este documento
```

**Regla de oro de la arquitectura:** `store.js` es la **única** capa que toca los datos.
`getState()` es sincrónico (devuelve una caché en memoria), por eso las páginas renderizan
igual que cuando todo era localStorage. Las mutaciones (`addGasto`, etc.) escriben en
Supabase **y** actualizan la caché (write-through).

---

## 4. Supabase — accesos y estado

- **Project URL:** `https://gfvglnrjwvamecxuavuf.supabase.co`
- **anon / publishable key:** `sb_publishable_i50Au1pqtf9q4iYLeyr5nA_kLKGkrDM`
  (es **pública por diseño**; lo que protege/define el acceso es el RLS. Nunca subir la *service_role key*.)
- Credenciales cargadas en `js/config.js`.

### Estado verificado (2026-06-06) — TODO LISTO ✅
| Ítem | Estado |
|------|--------|
| Tablas `gastos, ingresos, inversiones, metas, stats_usuario` (`schema.sql`) | ✅ creadas |
| Tabla `recurrentes` + columnas `recurrente_id` (`schema_recurrentes.sql`) | ✅ creada |
| RLS compartido sin login (`schema_compartir.sql`) | ✅ aplicado |
| Authentication → **Anonymous sign-ins** | ✅ ON |
| Authentication → **Allow new users to sign up** | ✅ ON |

> Si alguna vez se rompe el acceso: revisar que esos dos toggles de Auth sigan en ON
> y que `js/config.js` tenga la URL/key correctas.

### Tablas (resumen)
- `gastos(monto, moneda, tipo['fijo'|'variable'], categoria, descripcion, fecha, recurrente_id)`
- `ingresos(monto, moneda, fuente, recurrente, descripcion, fecha, recurrente_id)`
- `inversiones(simbolo, nombre, cantidad, precio_compra, precio_actual, fecha)` — valuadas en USD
- `metas(nombre, icono, objetivo, actual, moneda, fecha_limite)`
- `stats_usuario(xp, racha_max, dias_actividad, logros, metas_cumplidas, tipo_cambio_usd)` — **fila compartida**
- `recurrentes(tipo_mov, nombre, monto, moneda, categoria, fuente, dia_mes, desde, activo)` — plantillas de fijos

---

## 5. Decisiones de diseño (el "por qué")

1. **Sin login, datos compartidos entre dispositivos.**
   El usuario quería entrar directo (sin email/contraseña) y ver lo mismo en PC y celular.
   Solución: sesión **anónima automática** (Supabase la crea sola y la recuerda) + **RLS compartido**
   (`schema_compartir.sql`) que hace que *cualquier* sesión vea/edite el mismo conjunto de datos.
   - ⚠️ **Trade-off de seguridad aceptado:** cualquiera con la URL de la app puede ver/editar los datos.
     Mitigación futura opcional: un **PIN de 4 dígitos** al abrir (sin email).

2. **Multi-moneda: cada cosa en su moneda (no se convierte).**
   Las tarjetas de totales muestran pesos como pesos y dólares como dólares (formato `US$` para
   no confundir con `$`). Los gráficos que combinan monedas (categorías, tendencias) usan USD al
   tipo de cambio configurable. Cripto siempre en USD.
   - Tipo de cambio editable en **Reportes** (campo "TC USD/ARS"), default **1150**.

3. **Gamificación enfocada en la DISCIPLINA de registrar.**
   Carga rápida (FAB "+" y tecla `A`), XP por cada registro, rachas diarias bien visibles,
   y logros específicos por constancia. Los movimientos **auto-generados por recurrentes NO dan XP**
   (no son esfuerzo del usuario).

4. **Gastos/Ingresos fijos recurrentes.**
   Se carga la plantilla **una vez** y la app **genera el movimiento cada mes** automáticamente
   (rellena meses faltantes hasta 24 atrás, idempotente). Editar la plantilla actualiza este mes
   y los próximos; los meses pasados quedan históricos. Se pueden pausar.

5. **Performance: caché + refresco en segundo plano (stale-while-revalidate).**
   Cada página se dibuja **al instante** con lo cacheado en `localStorage` y sincroniza con
   Supabase por detrás, sin bloquear. `userId` se toma de la sesión local (una consulta menos).

6. **Responsive (aplicando el skill `ui-design/responsive-design`).**
   Tipografía/espaciado fluidos con `clamp()`, grids intrínsecos `auto-fit` con `min(X,100%)`,
   container queries (`cqi`) en las tarjetas de stats, touch targets ≥44px, `dvh`, y el menú
   lateral como **drawer** (☰) en mobile.

---

## 6. Gamificación (detalle)

- **Niveles/XP:** +5 por gasto, +20 por ingreso, +15 por inversión/aporte, +10 por crear meta,
  +250 por cumplir meta, +50 por logro. 8 niveles: Novato del Ahorro → … → Maestro de las Finanzas.
- **Rachas 🔥:** días consecutivos registrando (en la barra lateral y en el dashboard).
- **16 logros:** primer registro, semana de fuego (7 días), imparable (30), constante (50 movs),
  mes austero, más rico, manos de diamante (cripto en verde), meta cumplida, finanzas sanas, etc.
- **Metas:** objetivos con barra de progreso, aportes, confeti al cumplir.
- **Score de salud financiera (0-100)** y resúmenes motivadores ("este mes ahorraste X / gastaste menos").

---

## 7. Git / deploy

- Repo: `https://github.com/FDany90/gastos` (rama `main`).
- Identidad local configurada: `FDany90 / daniel.fernandezalb@gmail.com`.
- Para subir cambios:
  ```bash
  git add -A && git commit -m "mensaje" && git push
  ```
- Deploy sugerido: **GitHub Pages** (Settings → Pages → branch `main`). Gratis, sin servidor.

---

## 8. Estado actual y PENDIENTES

**Funcionando:** las 6 páginas, gamificación, multi-moneda, Supabase compartido, recurrentes,
caché/performance, responsive. Backend verificado end-to-end (2 dispositivos ven la misma data).

**Posibles mejoras / Fase 3:**
- [ ] **PIN de 4 dígitos** al abrir (privacidad simple, sin email) — tapa el trade-off de "sin login".
- [ ] **Precios cripto en vivo** (API CoinGecko) para no actualizar a mano `precio_actual`.
- [ ] **Tipo de cambio automático** (API dólar) en vez del valor manual.
- [ ] **Exportar a CSV / Excel**.
- [ ] **Editor del gasto del mes** generado por un recurrente (hoy se edita la plantilla).
- [ ] Limpieza de datos viejos si quedaron duplicados de cuando PC y celu estaban separados
      (Reportes → Reiniciar datos para empezar prolijo).

---

## 9. Cómo retomar el trabajo con Claude

Abrir la carpeta `GASTOS` con Claude Code y pegar algo como:

> "Estoy retomando mi app de finanzas personales. Leé `BITACORA.md` para ponerte al día con
> todo lo hecho, las decisiones y los pendientes. Quiero seguir con: [lo que sea]."

Toda la información de contexto (arquitectura, accesos, decisiones, pendientes) está en este
documento, así que no hace falta el historial del chat.
