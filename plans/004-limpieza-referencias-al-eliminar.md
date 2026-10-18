# Plan 004: Limpiar referencias al eliminar una obra

> **Instrucciones para el executor**: sigue los pasos y verifica cada uno. Ante
> STOP conditions, detente. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/obras.ts convex/schema.ts convex/reading.ts`
> Mismatch con "Current state" = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (mutation de borrado; operaciones acotadas al usuario dueño)
- **Depends on**: plans/001-linea-base-verificacion.md; NO ejecutar en paralelo con el plan 003 (ambos tocan funciones Convex; secuenciar)
- **Category**: bug
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

`obras.remove` borra la obra y sus citas, pero deja referencias colgantes en dos tablas: `readingDocuments.obraId` sigue apuntando a la obra borrada y los `notificationEvents` pendientes de esa obra siguen en cola. Consecuencias visibles: el documento de lectura aparece como "vinculado" en `/lectura/documentos` para siempre, el progreso KOReader deja de proyectarse sin ningún aviso (`projectProgressForDocument` sale en silencio cuando la obra no existe), y Alfred puede recibir la notificación de una obra que ya no existe.

## Current state

- `convex/obras.ts:413-429` — `remove`, completo:

```ts
export const remove = mutation({
  args: { id: v.id("obras") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) {
      throw new Error("Obra no encontrada.");
    }

    const quotes = await listQuotesForObra(ctx, userId, id);
    for (const quote of quotes) {
      await ctx.db.delete(quote._id);
    }
    await ctx.db.delete(id);
    return { id };
  },
});
```

- `convex/schema.ts:134-153` — `readingDocuments` tiene campo `obraId: v.optional(v.id("obras"))` pero **ningún índice** sobre `obraId`. Índices existentes: `by_user_sourceKey`, `by_user_documentKey`, `by_user_fileHash`, `by_user_updatedAt`.
- `convex/schema.ts:100-133` — `notificationEvents` tiene `obraId` obligatorio; índices: `by_eventId`, `by_status_createdAt ["status","createdAt"]`, `by_user_status_createdAt ["userId","status","createdAt"]`.
- Convención de schema (AGENTS.md): usar índices para todo patrón de consulta y declararlos en `convex/schema.ts`; los despliegues corren con `bun run convex:push`. OJO del repo: dev y producción comparten deployment Convex — un push de schema es aditivo aquí (índice nuevo), seguro, pero avísalo en el PR.
- Mensajes de error user-facing en español.

## Commands you will need

| Purpose        | Command               | Expected                     |
| -------------- | --------------------- | ---------------------------- |
| Typecheck      | `bun run typecheck`   | exit 0                       |
| Tests          | `bun run test`        | todas pasan                  |
| Lint           | `bun run check`       | exit 0                       |
| Push de schema | `bun run convex:push` | éxito, sin errores de índice |

## Scope

**In scope**:

- `convex/obras.ts` (solo `remove`)
- `convex/schema.ts` (añadir UN índice a `readingDocuments`)

**Out of scope**:

- `convex/reading.ts` (no cambiar `listDocuments` ni la proyección).
- Borrado de `readingAnnotations` / `readingProgress`: los documentos NO se borran, solo se desvinculan (`obraId: undefined`) — decisión documentada en `docs/plans/2026-07-22-reading-integration-design.md` ("Desapariciones de fuentes nunca borran automáticamente datos del usuario").
- Eventos ya `delivered`: quedan como histórico.

## Git workflow

- Branch: `codex/004-referencias-colgantes`
- Commit: `fix(obras): desvincula lectura y cancela eventos al eliminar una obra`

## Steps

> **Enmienda del reviewer (2026-08-22)**: NO se añade el índice `by_user_obraId`
> ni se ejecuta `convex:push`. Razón: el deployment Convex es compartido con
> producción; entre merge y deploy coordinado, `remove()` fallaría en runtime
> contra el schema viejo. En su lugar, escaneo acotado por el índice existente
> `by_user_updatedAt` (documentos por usuario limitados por
> `READING_SYNC_MAX_FILES`, default 500). El push de schema quedó fuera.

### Step 1: Extender `remove`

Reescribe el handler de `remove` así (después de borrar citas, ANTES de borrar la obra):

```ts
// Desvincula documentos de lectura que apuntaban a esta obra (escaneo acotado).
const userDocs = await ctx.db
  .query("readingDocuments")
  .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
  .collect();
for (const doc of userDocs) {
  if (doc.obraId === id) {
    await ctx.db.patch(doc._id, { obraId: undefined, updatedAt: Date.now() });
  }
}

// Cancela eventos de notificación pendientes/procesando de esta obra.
let orphanEvents: Doc<"notificationEvents">[] = [];
do {
  orphanEvents = [];
  for (const status of ["pending", "processing"] as const) {
    const batch = await ctx.db
      .query("notificationEvents")
      .withIndex("by_user_status_createdAt", (q) =>
        q.eq("userId", userId).eq("status", status),
      )
      .take(100);
    orphanEvents.push(...batch.filter((event) => event.obraId === id));
  }
  for (const event of orphanEvents) {
    await ctx.db.delete(event._id);
  }
} while (orphanEvents.length > 0);

await ctx.db.delete(id);
return { id };
```

Importa `type { Doc }` desde `./_generated/dataModel` si aún no está importado en el archivo.

**Verify**: `bun run typecheck && bun run check && bun run test` → exit 0.

## Test plan

- Sin test unitario nuevo automatizable hoy: las mutaciones requieren harness de Convex (plan 012 lo construye después; allí se añade el caso "remove desvincula documento").
- La verificación funcional con UI queda deferida al dueño (deployment compartido).

## Done criteria

- [ ] `remove` desvincula documentos y borra eventos pendientes/procesando antes de borrar la obra
- [ ] `bun run typecheck && bun run check && bun run test` exit 0
- [ ] `convex/schema.ts` SIN cambios
- [ ] Sin archivos fuera de scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Descubres que algún código asume que `readingDocuments.obraId` apunta SIEMPRE a obras vivas con semántica distinta a "sin vínculo" (revisa `convex/reading.ts:810-812` y `src/routes/lectura/documentos.tsx`).

## Maintenance notes

- Si mañana se añade borrado en cascada de documentos de lectura, este paso de desvinculación cambia por borrado directo.
- El loop de eventos está acotado por lotes de 100; con colas enormes podría tardar, pero es una mutation por borrado de obra, poco frecuente.
- Reviewer: confirmar que nada de lo borrado pertenece a otro usuario (todos los queries filtran por `userId`).
