# Corcho de Tareas — Especificación para replicar en CRM externo

> Documento generado desde la implementación actual en Base44 (Voltis Energía).
> Contiene toda la info necesaria para replicar el corcho de tareas en tu CRM privado (Vercel + Supabase).

---

## 1. Modelo de datos (tabla `tareas_corcho`)

Equivalente SQL en Supabase:

```sql
CREATE TABLE tareas_corcho (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion    TEXT NOT NULL,
  notas          TEXT,
  audio_url       TEXT,
  fecha           DATE,
  completada      BOOLEAN NOT NULL DEFAULT false,
  fecha_completada TIMESTAMPTZ,
  tiene_alerta    BOOLEAN NOT NULL DEFAULT false,
  prioridad       TEXT NOT NULL DEFAULT 'verde'
                  CHECK (prioridad IN ('rojo', 'amarillo', 'verde')),
  orden           INTEGER NOT NULL DEFAULT 9999,
  creador_email   TEXT,        -- email del admin/bot que creó la tarea
  propietario_email TEXT NOT NULL,  -- email del asignado (Nico, Iranzu, José, Jokin)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX idx_corcho_propietario ON tareas_corcho (propietario_email, completada);
CREATE INDEX idx_corcho_orden ON tareas_corcho (propietario_email, orden);
CREATE INDEX idx_corcho_completada_fecha ON tareas_corcho (completada, fecha_completada DESC);
```

### Campos

| Campo               | Tipo      | Descripción                                                  |
| ------------------- | --------- | ------------------------------------------------------------ |
| `descripcion`       | TEXT (req)| Texto de la tarea                                            |
| `notas`             | TEXT      | Notas adicionales (puede contener `Cliente ID: <uuid>`)     |
| `audio_url`         | TEXT      | URL del audio explicativo (grabado desde el navegador)      |
| `fecha`             | DATE      | Fecha opcional → si existe, aparece también en el calendario|
| `completada`        | BOOL      | `false` por defecto                                          |
| `fecha_completada`  | TIMESTAMPTZ | Se setea al marcar como hecha                              |
| `tiene_alerta`      | BOOL      | `false` por defecto → pinta la card con borde rojo          |
| `prioridad`         | ENUM      | `rojo` (alta) · `amarillo` (media) · `verde` (baja)          |
| `orden`             | INT       | Orden dentro de la columna (pendientes o completadas)        |
| `creador_email`     | TEXT      | Quién creó la tarea (admin o `bot_whatsapp@voltisenergia.com`) |
| `propietario_email` | TEXT (req)| A quién está asignada                                        |

### Usuarios válidos como `propietario_email`

```
nicolasvoltis@gmail.com   → Nico
nicolas@voltisenergia.com → Nico  (ambos emails de Nico comparten el mismo corcho)
iranzu@voltisenergia.com  → Iranzu
jose@voltisenergia.com    → José
jokin@voltisenergia.com   → Jokin
```

---

## 2. Acciones del corcho (endpoints API)

Todas las acciones que el frontend ejecuta contra la entidad `TareaCorcho`. Tu CRM debe exponer endpoints equivalentes.

### 2.1 Crear tarea

```
POST /api/tareas-corcho
```

**Body:**
```json
{
  "descripcion": "Preparar estudio potencias Pepe",
  "notas": "Detalles adicionales...",
  "audio_url": "https://.../audio.webm",
  "fecha": "2026-08-15",
  "prioridad": "verde",
  "propietario_email": "iranzu@voltisenergia.com",
  "creador_email": "admin@voltisenergia.com"
}
```

**Lógica backend:**
- `completada = false`
- `tiene_alerta = false`
- `orden = MAX(orden) + 1` de las tareas **pendientes** del mismo `propietario_email`
- Si viene del bot de WhatsApp: `creador_email = "bot_whatsapp@voltisenergia.com"`, `prioridad = "verde"`, `orden = 9999`

### 2.2 Crear múltiples tareas (modo batch)

```
POST /api/tareas-corcho/batch
```

**Body:**
```json
{
  "tareas": [
    { "descripcion": "Tarea 1", "prioridad": "rojo" },
    { "descripcion": "Tarea 2", "prioridad": "verde" }
  ],
  "propietario_email": "iranzu@voltisenergia.com",
  "creador_email": "admin@voltisenergia.com"
}
```

**Lógica:** Calcular `maxOrden` de pendientes del propietario y asignar `maxOrden + i + 1` a cada una.

### 2.3 Editar tarea

```
PATCH /api/tareas-corcho/:id
```

**Body (campos opcionales):**
```json
{
  "descripcion": "Texto actualizado",
  "notas": "Notas actualizadas",
  "fecha": "2026-08-20",
  "audio_url": "https://.../nuevo-audio.webm",
  "prioridad": "amarillo"
}
```

### 2.4 Marcar como hecha (✓ Hecha)

```
PATCH /api/tareas-corcho/:id/complete
```

**Lógica backend:**
```sql
UPDATE tareas_corcho
SET completada = true,
    fecha_completada = now()
WHERE id = :id;
```

### 2.5 Toggle alerta (Alerta / Quitar)

```
PATCH /api/tareas-corcho/:id/toggle-alerta
```

**Lógica:** `tiene_alerta = !tiene_alerta`

### 2.6 Pasapalabra (reenviar a otro usuario)

```
POST /api/tareas-corcho/:id/pasapalabra
```

**Body:**
```json
{
  "destinatario_email": "jose@voltisenergia.com"
}
```

**Lógica backend:**
```sql
-- Calcular nuevo orden al final de los pendientes del destinatario
SELECT COALESCE(MAX(orden), 0) + 1
FROM tareas_corcho
WHERE propietario_email = :destinatario
  AND completada = false;

UPDATE tareas_corcho
SET propietario_email = :destinatario,
    orden = :nuevo_orden
WHERE id = :id;
```

#### A quién puede pasapalabra cada usuario

| Usuario actual        | Puede enviar a                                              |
| --------------------- | ----------------------------------------------------------- |
| Nico (cualquier email)| Iranzu, José, Jokin                                         |
| Iranzu                | Nico, José, Jokin                                           |
| José                  | Nico, Iranzu, Jokin                                          |
| Jokin                 | Nico, Iranzu, José                                           |

> **Caso especial Nico:** si el destinatario es Nico y el remitente no es Nico, resolver qué email usar buscando tareas existentes de Nico en la BD. Si no hay ninguna, usar `nicolas@voltisenergia.com`.

### 2.7 Eliminar tarea

```
DELETE /api/tareas-corcho/:id
```

### 2.8 Reordenar (drag & drop)

```
PATCH /api/tareas-corcho/reorder
```

**Body:**
```json
{
  "tareas": [
    { "id": "uuid-1", "orden": 0 },
    { "id": "uuid-2", "orden": 1 },
    { "id": "uuid-3", "orden": 2 }
  ]
}
```

**Lógica:** Update batch del campo `orden`.

### 2.9 Mover entre columnas (drag pendiente → completada y viceversa)

```
PATCH /api/tareas-corcho/:id/move
```

**Body:**
```json
{
  "completada": true,
  "orden": 3
}
```

**Lógica:**
- Si `completada = true` → `fecha_completada = now()`
- Si `completada = false` → `fecha_completada = null`
- Reordenar las tareas afectadas en la columna de destino

### 2.10 Listar tareas del corcho

```
GET /api/tareas-corcho?propietario_email=:email
```

**Query params opcionales:**
- `propietario_email` — filtra por propietario
- `completada` — `true`/`false`

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "descripcion": "...",
    "notas": "...",
    "audio_url": "...",
    "fecha": "2026-08-15",
    "completada": false,
    "fecha_completada": null,
    "tiene_alerta": false,
    "prioridad": "verde",
    "orden": 1,
    "creador_email": "...",
    "propietario_email": "...",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

### 2.11 Historial de tareas completadas (con filtros)

```
GET /api/tareas-corcho/historial?usuario=todos&search=texto
```

- `usuario` — email o `todos`
- `search` — busca en `descripcion` y `notas` (case-insensitive)
- Ordenar por `fecha_completada DESC`

---

## 3. Limpieza automática

Las tareas **completadas** se eliminan automáticamente tras **3 semanas** (21 días).

**Lógica (puede ser un cron job diario en Vercel):**
```sql
DELETE FROM tareas_corcho
WHERE completada = true
  AND fecha_completada < now() - interval '21 days';
```

---

## 4. Reglas de acceso

Quién puede ver y usar el corcho:

```
tieneAccesoCorcho = (
  email === 'nicolasvoltis@gmail.com' ||
  email === 'nicolas@voltisenergia.com' ||
  email === 'iranzu@voltisenergia.com' ||
  email === 'jose@voltisenergia.com' ||
  email === 'jokin@voltisenergia.com'
)
```

- **Nico** puede ver el corcho de cualquier usuario mediante un selector.
- Los demás solo ven su propio corcho.
- Solo Nico puede eliminar tareas del historial de completadas.

---

## 5. Interfaz de usuario (UI)

### Estructura general

```
┌─────────────────────────────────────────────┐
│  Corcho de Tareas          [+ Nueva Tarea] │
│  [Selector de propietario — solo Nico]      │
├──────────────────┬──────────────────────────┤
│  Por Realizar    │  Realizadas              │
│  (drag & drop)   │  (drag & drop)           │
│                  │                          │
│  ┌────────────┐  │  ┌────────────┐          │
│  │ Tarea card │  │  │ Tarea card │          │
│  │ ✏️ Alerta ✓ │  │  │ (tachada)  │          │
│  │  ↔ Pasap.  │  │  │ 🗑️ (solo   │          │
│  └────────────┘  │  │    Nico)   │          │
│                  │  └────────────┘          │
│                  │  📜 click título →       │
│                  │    historial completo     │
└──────────────────┴──────────────────────────┘
```

### Card de tarea pendiente

- **Borde izquierdo de color** según prioridad: rojo (alta), amarillo (media), verde (baja)
- **Descripción** (negrita)
- **Notas** (texto gris, si existen)
- **Audio** (reproductor inline, si existe)
- **Fecha** (badge azul con 📅, si existe)
- **Si `tiene_alerta = true`**: borde rojo de 2px + fondo rojo claro

#### Botones de acción (debajo de la descripción):

| Botón          | Acción                              |
| -------------- | ----------------------------------- |
| ✏️ Editar      | Abre formulario inline de edición   |
| 🔔 Alerta/Quitar | Toggle `tiene_alerta`             |
| ✓ Hecha        | Marca `completada = true`           |
| ↔ (icon) Pasapalabra | Abre diálogo de selección de destinatario |

### Card de tarea completada

- Fondo verde claro, borde verde
- Descripción **tachada**
- Notas (si existen)
- Audio (si existe, con opacidad 70%)
- Fecha de completado (formato `DD/MM HH:MM`)
- Botón 🗑️ eliminar (**solo visible para Nico**)

### Diálogo "Nueva Tarea"

Modos:
1. **Individual**: descripción, notas, audio, prioridad (3 botones de color), fecha opcional
2. **Múltiple**: lista de inputs con selector de prioridad cada uno (Enter para añadir más)

### Diálogo "Pasapalabra"

- Título grande naranja: **¡PASAPALABRA!**
- Muestra la descripción de la tarea
- Botones grandes naranjas con los nombres de destinatarios posibles
- Al click → reasigna la tarea y cierra

### Diálogo "Historial" (solo Nico)

- Buscador de texto (busca en descripción + notas)
- Filtro por usuario (Todos / Nico / Iranzu / José / Jokin)
- Lista de tareas completadas ordenadas por `fecha_completada DESC`
- Cada card: descripción tachada, notas, audio, fecha, badge con iniciales del propietario
- Botón 🗑️ para eliminar

---

## 6. Bot de WhatsApp (corcho_whatsapp)

El bot `BOTtis Energía` permite añadir tareas al corcho por WhatsApp.

### Reglas de asignación por mensaje

| Mensaje contiene        | Asigna a                          |
| ----------------------- | --------------------------------- |
| `tarea nico` / `nicolas`| nicolasvoltis@gmail.com           |
| `tarea iranzu`          | iranzu@voltisenergia.com          |
| `tarea jose` / `josé`   | jose@voltisenergia.com            |
| `tarea jokin`           | jokin@voltisenergia.com           |
| (sin nombre)            | iranzu@voltisenergia.com (default)|

### Extracción del texto

Se elimina el indicador de asignación y el resto es la descripción:
- `tarea jose preparar estudio potencias pepe` → desc: `preparar estudio potencias pepe`, prop: `jose@voltisenergia.com`
- `preparar prescoring valle de egues` → desc: `preparar prescoring valle de egues`, prop: `iranzu@voltisenergia.com`

### Valores por defecto al crear desde el bot

```json
{
  "prioridad": "verde",
  "completada": false,
  "tiene_alerta": false,
  "orden": 9999,
  "creador_email": "bot_whatsapp@voltisenergia.com"
}
```

### Respuesta de confirmación

```
✅ Tarea añadida al corcho de [Nombre]: [descripción]
```

### Mensaje de bienvenida

```
👋 ¡Hola! Soy BOTtis Energía, tu asistente de tareas.

Puedo añadir tareas al corcho de trabajo. Escríbeme o envíame un audio con la tarea:

📌 Sin nombre → se asigna a Iranzu por defecto
📌 Con 'tarea nico' → se asigna a Nicolás
📌 Con 'tarea jose' → se asigna a José
📌 Con 'tarea jokin' → se asigna a Jokin

✏️ Ejemplo: 'preparar estudio potencias pepe'
```

### Soporte de audio

Si el usuario envía un audio de voz, el bot debe **transcribirlo** y aplicar las mismas reglas de asignación sobre el texto transcrito.

---

## 7. Audio explicativo

Las tareas pueden tener un audio explicativo grabado desde el navegador.

### Flujo de grabación (frontend)

1. `navigator.mediaDevices.getUserMedia({ audio: true })`
2. `new MediaRecorder(stream)` → formato `audio/webm`
3. Al parar: crear `Blob` → `File` con nombre `audio-{timestamp}.webm`
4. Subir a storage (Supabase Storage o equivalente)
5. Guardar la URL pública en `audio_url`

### Endpoint de subida

```
POST /api/upload-audio
Content-Type: multipart/form-data
```

**Respuesta:**
```json
{ "audio_url": "https://.../audio-123456.webm" }
```

---

## 8. Integración con calendario

Las tareas del corcho que tienen `fecha` (no nula) aparecen también en el calendario como eventos de color **azul**.

**Query:**
```sql
SELECT * FROM tareas_corcho
WHERE fecha IS NOT NULL
  AND propietario_email = :user_email
  AND completada = false;
```

**Render en calendario:**
- Punto azul en el día correspondiente
- Al clickar el día, aparece la tarea con botón ✓ (completar) y 🗑️ (eliminar)
- Si `tiene_alerta = true`, muestra icono de alerta

---

## 9. Resumen de endpoints API

| Método | Ruta                                  | Descripción                      |
| ------ | ------------------------------------- | -------------------------------- |
| GET    | `/api/tareas-corcho`                  | Listar (con filtros)             |
| POST   | `/api/tareas-corcho`                  | Crear tarea                      |
| POST   | `/api/tareas-corcho/batch`            | Crear múltiples                  |
| PATCH  | `/api/tareas-corcho/:id`              | Editar campos                    |
| PATCH  | `/api/tareas-corcho/:id/complete`     | Marcar como hecha                |
| PATCH  | `/api/tareas-corcho/:id/toggle-alerta`| Toggle alerta                    |
| POST   | `/api/tareas-corcho/:id/pasapalabra`  | Reenviar a otro usuario          |
| DELETE | `/api/tareas-corcho/:id`              | Eliminar                         |
| PATCH  | `/api/tareas-corcho/reorder`          | Reordenar (batch)                |
| PATCH  | `/api/tareas-corcho/:id/move`         | Mover entre columnas             |
| GET    | `/api/tareas-corcho/historial`        | Historial con filtros            |
| POST   | `/api/upload-audio`                   | Subir audio explicativo          |

---

## 10. Seguridad

- Todos los endpoints protegidos con `Authorization: Bearer <token>`
- El `propietario_email` se valida contra la lista de usuarios autorizados
- El `creador_email` se obtiene del usuario autenticado (o `bot_whatsapp@...` para el bot)
- Solo Nico puede eliminar tareas del historial de completadas
- El bot solo puede **crear** tareas (no editar, completar ni eliminar)