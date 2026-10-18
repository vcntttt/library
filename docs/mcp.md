# Library MCP

Library expone un servidor MCP en `/mcp` (Streamable HTTP, sin estado) para que agentes como Hermes consulten y actualicen la biblioteca.

## Acceso

- Autenticación: `Authorization: Bearer $LIBRARY_MCP_SECRET`. Sin secreto configurado la ruta responde `503`; con uno incorrecto, `401`.
- El servidor opera siempre como el usuario `READING_INTEGRATION_OWNER_ID`, igual que el resto de integraciones privadas. No hay forma de elegir otro usuario.
- Usa las mismas funciones de Convex que la interfaz, así que comparte sus invariantes. No requiere cambios de esquema.

## Tools

Lectura: `library_list_obras`, `library_get_obra`, `library_list_pending_reviews`, `library_list_annotations`, `library_list_ideas`, `library_read_idea`.

Escritura: `library_create_obra`, `library_update_obra` (estado, progreso, etiquetas y quién la recomendó), `library_save_review`, `library_set_annotation_status`, `library_create_idea`, `library_update_idea`, `library_review_idea`.

No hay tool para eliminar obras. El progreso de obras con documento de lectura vinculado lo controla KOReader y `library_update_obra` lo rechaza.

## Ideas y conflictos

La nota de Obsidian es la versión canónica. `library_update_idea` exige el `contentHash` que devolvió `library_read_idea`; si la nota cambió desde entonces, responde `conflict: true` con el contenido actual y no escribe. Todas las rutas se limitan a `100 - Knowledge/Ideas`.

## Ejecución en producción

La ruta `OBSIDIAN_VAULT_PATH` debe existir dentro del contenedor (bind mount del vault; ver `docker/apps/library.yml` en el repositorio `homelab`).

## Cliente

```yaml
mcp_servers:
  library:
    url: https://library.tailf8b14c.ts.net/mcp
    headers:
      Authorization: Bearer ${MCP_LIBRARY_API_KEY}
```
