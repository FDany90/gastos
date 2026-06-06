# 💸 GASTOS — Finanzas personales gamificadas

App web para administrar tus finanzas (gastos, ingresos, inversiones cripto) con un
sistema de **niveles, rachas, logros y metas** que premia la disciplina de registrar
y la constancia en el ahorro.

> **Estado actual: Fase 1 — Prototipo visual funcional.**
> Todo funciona de verdad (podés crear/editar/borrar) y se guarda en tu navegador
> con `localStorage`. Todavía **no** usa Supabase: esa es la Fase 2.

## ▶️ Cómo abrirlo

Abrí **`index.html`** con doble clic, o (recomendado) servílo localmente para evitar
restricciones de navegador:

```bash
# con Python
python -m http.server 8000
# o con Node
npx serve .
```

Luego entrá a `http://localhost:8000`.

> No requiere instalar nada: HTML + CSS + JavaScript puro. Los gráficos usan Chart.js por CDN.

## 🗺️ Páginas

| Página | Qué hace |
|--------|----------|
| 🏠 **Balance** (`index.html`) | Patrimonio total en USD, efectivo por moneda, cripto, resumen motivador del mes, disciplina semanal, score de salud financiera |
| 💸 **Gastos** | Alta rápida de gastos fijos/variables, filtros por tipo/categoría/moneda |
| 💰 **Ingresos** | Sueldo y otros ingresos, recurrentes, tasa de ahorro |
| 📈 **Inversiones** | Cartera cripto: precio de compra vs valor actual, ganancia/pérdida, distribución |
| 🎯 **Metas & Logros** | Metas de ahorro con progreso, nivel/XP e insignias desbloqueables |
| 📊 **Reportes** | Comparativa mes a mes, evolución de 6 meses, tipo de cambio |

## 🎮 Gamificación (premia la disciplina)

- **Carga rápida:** botón flotante **+** en todas las páginas, o tecla **`A`**. Pocos clics.
- **XP y niveles:** +5 por gasto, +20 por ingreso, +15 por inversión/aporte, +250 por meta cumplida, +50 por logro. De *Novato del Ahorro* a *Maestro de las Finanzas*.
- **Rachas 🔥:** días seguidos registrando, siempre visibles en la barra lateral.
- **16 logros:** primer registro, semana de fuego, mes austero, más rico, manos de diamante, finanzas sanas, etc.
- **Resúmenes que motivan:** *"este mes ahorraste X (25% más)"*, *"gastaste menos"*, *"generaste más"*.

## 💱 Multi-moneda

Cada movimiento guarda su moneda (**ARS** o **USD**); las inversiones cripto se valúan en USD.
El **patrimonio total** se unifica a USD usando el tipo de cambio configurable en *Reportes*.

## 🧱 Arquitectura

```
GASTOS/
├── *.html                 → una página por sección
├── css/styles.css         → estilos + tema + gamificación
├── js/
│   ├── format.js          → formato de moneda/fechas
│   ├── store.js           → capa de datos (localStorage) + datos de ejemplo
│   ├── analytics.js       → balances, conversiones, comparativas
│   ├── gamification.js    → XP, niveles, rachas, logros
│   ├── layout.js          → sidebar, carga rápida, modales, toasts/confeti
│   └── <pagina>.js        → lógica de cada página
└── schema.sql             → tablas + RLS para Supabase (Fase 2)
```

La clave del diseño: **`store.js` es la única capa que toca los datos.** En la Fase 2,
sus funciones (`addGasto`, `getState`, etc.) pasan a llamar a Supabase en vez de
`localStorage`, **sin tocar el resto de la app**.

> ¿Querés empezar de cero? Entrá a **Reportes → Reiniciar datos**.

## ☁️ Fase 2 · Supabase (puesta en marcha)

La app ya está conectada a Supabase (acceso **anónimo automático**, sin pantalla de login:
entrás directo y la sesión queda guardada en el navegador). Faltan **2 pasos** en tu panel:

### 1. Crear las tablas
Supabase → **SQL Editor** → **New query** → pegá todo el contenido de [`schema.sql`](schema.sql) → **Run**.
Esto crea las tablas (`gastos`, `ingresos`, `inversiones`, `metas`, `stats_usuario`) con Row Level Security.

### 2. Activar el acceso anónimo
Supabase → **Authentication** → **Sign In / Providers** → activá **Anonymous sign-ins** → Save.

> Tus credenciales ya están en [`js/config.js`](js/config.js). La *anon key* es pública por
> diseño: lo que protege tus datos es el RLS del `schema.sql`.

### 3. Gastos/Ingresos fijos (recurrentes) — correr la migración
Supabase → **SQL Editor** → pegá [`schema_recurrentes.sql`](schema_recurrentes.sql) → **Run**.
Crea la tabla `recurrentes` y vincula los movimientos generados.

**Cómo se usa:** en **Gastos** (o **Ingresos**) hay una tarjeta *🔁 Gastos/Ingresos fijos*.
Cargás el fijo **una sola vez** (ej: Alquiler $420.000, día 1) y la app:
- genera el gasto de **este mes** automáticamente al abrir la app;
- **rellena meses faltantes** si no la abriste (hasta 24 atrás);
- al **editar** el monto, este mes y los próximos usan el nuevo valor (los meses pasados quedan históricos);
- podés **pausar** (⏸️) un fijo sin borrarlo.
Los movimientos generados se marcan con 🔁 en la lista.

### Asegurar la cuenta (opcional, recomendado)
Como el acceso es anónimo, tus datos quedan atados a **este navegador**. Para no perderlos
(y poder entrar desde otro dispositivo), tocá **🔒 Asegurar cuenta** en la barra lateral y
poné un email + contraseña: convierte tu usuario anónimo en uno permanente.

### Cómo cambia el código (vs Fase 1)
`store.js` ahora lee todo a una **caché en memoria** al iniciar y escribe en Supabase
(write-through). `getState()` sigue siendo sincrónico, así que las páginas no cambiaron su
forma de renderizar. La gamificación (XP, rachas, logros) se guarda en `stats_usuario`.

## 🚀 Roadmap

- **Fase 1 ✅** — Prototipo visual funcional.
- **Fase 2 ✅** — Supabase: datos en la nube + acceso anónimo + gamificación persistida.
- **Fase 3** — Tipo de cambio automático (API), precios cripto en vivo (CoinGecko), exportar a CSV.
