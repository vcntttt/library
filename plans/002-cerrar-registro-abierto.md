# Plan 002: Cerrar el autorregistro abierto con código de invitación

> **Instrucciones para el executor**: sigue el plan paso a paso, ejecuta cada
> verificación y confirma el resultado. Ante una STOP condition, detente y
> reporta. Al terminar, actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/auth.ts src/routes/login.tsx README.md .env.example`
> Si cambian, compara con los extractos de "Current state"; mismatch = STOP.

## Status

- **Priority**: P1 (seguridad)
- **Effort**: S–M
- **Risk**: LOW-MED (no romper el login de usuarios existentes ni la cuenta E2E)
- **Depends on**: plans/001-linea-base-verificacion.md
- **Category**: security
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Library es una app privada multiusuario desplegada en internet (Dokploy), pero cualquiera que descubra la URL puede crear una cuenta: el proveedor Password de Convex Auth acepta todo registro y la UI ofrece la pestaña de registro sin fricción. Los datos quedan aislados por usuario (verificado), pero un desconocido obtiene acceso a los proxys de metadatos, consume cuotas de TMDB/AniList/Google Books y gana superficie para los hallazgos de endurecimiento (plan 009). El gate debe ser del lado del servidor.

Mecanismo elegido (decisión de producto): **código de invitación** vía variable de entorno `SIGNUP_INVITE_CODE`. El dueño comparte el código con cada persona nueva; no hace falta allowlist ni cierre total.

## Current state

- `convex/auth.ts` completo hoy:

```ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { Value } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params: Record<string, Value | undefined>) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        const name = String(params.name ?? "").trim() || "Usuario";
        return { email, name };
      },
    }),
  ],
});
```

- `src/routes/login.tsx:41-56`: el submit arma un `FormData` con `email`, `password`, `flow` (`signUp`|`signIn`) y, solo en modo registro, `name`. Ahí se puede inyectar el campo extra del formulario.
- En Convex Auth, `profile()` se invoca durante el flujo `signUp` para crear el documento de usuario; NO se invoca en `signIn` de cuentas existentes. Los campos arbitrarios del `FormData` llegan en `params`.
- Las variables del deployment Convex se gestionan con `bun run deploy` / scripts en `scripts/sync-convex-env.ts` (sincroniza `ALFRED_*`); las variables locales viven en `.env.local` (nunca commitear valores).
- Convenciones: mensajes de error user-facing en español (`throw new Error("...")`), Biome con tabs y comillas dobles.
- La cuenta E2E (`E2E_TEST_EMAIL`) ya existe: hace `signIn`, nunca `signUp`; no debe afectarse.

## Commands you will need

| Purpose      | Command                                          | Expected on success |
| ------------ | ------------------------------------------------ | ------------------- |
| Typecheck    | `bun run typecheck`                              | exit 0              |
| Tests        | `bun run test`                                   | todas pasan         |
| Lint         | `bun run check`                                  | exit 0              |
| Test puntual | `bun run test -- convex/lib/invite-code.test.ts` | pasa                |

## Scope

**In scope**:

- `convex/auth.ts`
- `convex/lib/invite-code.ts` (crear)
- `convex/lib/invite-code.test.ts` (crear)
- `src/routes/login.tsx`
- `README.md` (solo la lista de variables de entorno)
- `.env.example` (crear si aún no existe; si el plan 018 lo creó antes, edítalo)

**Out of scope**:

- `convex/http.ts`, `convex/users.ts`, cualquier otra función Convex.
- Migraciones o cambios al schema.
- Cambiar el flujo de login de cuentas existentes.

## Git workflow

- Branch: `codex/002-cerrar-registro`
- Commits: `feat(auth): exige código de invitación para registrarse`

## Steps

### Step 1: Helper puro de validación

Crea `convex/lib/invite-code.ts`:

```ts
export function isValidInviteCode(
  received: unknown,
  expected: string | undefined,
) {
  if (!expected || typeof received !== "string") return false;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
```

Comparación en tiempo constante pura (Convex mutations no tienen `node:crypto`). Crea `convex/lib/invite-code.test.ts` modelado sobre `convex/lib/obras.test.ts` (imports de `vitest`, `describe/it/expect`): casos — código correcto true, incorrecto false, vacío/undefined/false/number false, esperado indefinido false, largo distinto false.

**Verify**: `bun run test -- convex/lib/invite-code.test.ts` → todos pasan.

### Step 2: Gate en `convex/auth.ts`

Dentro de `Password({ profile(...) })`, primera línea del callback:

```ts
if (
  !isValidInviteCode(params.inviteCode, process.env.SIGNUP_INVITE_CODE?.trim())
) {
  throw new Error("Código de invitación inválido.");
}
```

El resto del callback queda igual.

**Verify**: `bun run typecheck && bun run check` → exit 0.

### Step 3: Campo de código en el formulario de registro

En `src/routes/login.tsx`:

1. Agrega al schema del formulario (TanStack Form) un campo opcional `inviteCode` (string).
2. Renderiza el input "Código de invitación" SOLO cuando `mode === "signup"` (mismo patrón que el input `name`).
3. En el submit, dentro del bloque `if (value.mode === "signup")`, agrega `formData.set("inviteCode", value.inviteCode ?? "");`.

**Verify**: `bun run typecheck && bun run check` → exit 0.

### Step 4: Documentar y persistir la variable

1. En `README.md`, sección "Variables de entorno", añade `SIGNUP_INVITE_CODE` (código requerido para crear cuentas nuevas) a ambas listas (desarrollo y producción).
2. En `.env.example` (crea con nombres y comentario en español, SIN valores) añade la línea `SIGNUP_INVITE_CODE=`.
3. Recuerda al operador (nota final del PR): definir `SIGNUP_INVITE_CODE` en `.env.local` y en el entorno del deployment Convex (misma mecánica que `ALFRED_NOTIFY_USER_EMAIL` en `scripts/sync-convex-env.ts`; NO agregues esa variable a ese script sin pedir confirmación).

**Verify**: `rg -n "SIGNUP_INVITE_CODE" README.md .env.example` → presente en ambos.

### Step 5: Verificación manual del flujo

Con el dev server corriendo y `SIGNUP_INVITE_CODE` definido en `.env.local`:

1. Registro con código erróneo → la UI muestra "Código de invitación inválido." y no crea cuenta.
2. Registro con código correcto → crea cuenta y entra.
3. Login de una cuenta existente (p. ej. la E2E) → funciona igual que antes, sin campo de código visible.

**Verify**: captura o nota de las tres comprobaciones en el resumen del PR.

## Test plan

- `convex/lib/invite-code.test.ts`: happy path, rechazos y tiempo constante (largo distinto sale antes por diseño).
- Verificación manual del flujo completo en Step 5 (la creación de usuarios vive dentro de Convex Auth y no es testeable unitariamente sin harness).

## Done criteria

- [ ] `bun run typecheck && bun run check && bun run test` exit 0
- [ ] Registro sin código válido falla con mensaje visible; con código válido funciona; login existente intacto
- [ ] `SIGNUP_INVITE_CODE` documentado en README y `.env.example`
- [ ] Sin archivos fuera de scope modificados
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `params.inviteCode` llega `undefined` a `profile()` pese a enviarlo en el FormData (la versión instalada de `@convex-dev/auth` filtraría campos custom): reporta versión instalada y detente — la alternativa es un provider custom y requiere decisión.
- Algún usuario real reporta que su login dejó de funcionar (sign-in no debería pasar por `profile`).

## Maintenance notes

- Para invitar a alguien nuevo: compartir el código basta; rotar el código invalida futuras altas, nunca cuentas existentes.
- Si algún día se quiere cierre total, basta borrar el campo del form y poner `expected` fijo imposible.
- Reviewer: confirmar que el mensaje de error no revela si el código estaba mal formado vs. ausente (es el mismo mensaje).
