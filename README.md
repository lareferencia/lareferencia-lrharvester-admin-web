# LA Referencia Harvester Admin Web

SPA independiente para operar el cosechador exclusivamente mediante `/api/v5`.
No usa ni empaqueta la aplicación AngularJS ubicada en `lareferencia-lrharvester-app/static`.

## Inicio local

1. Iniciar el harvester con la API v5 habilitada y permitir explícitamente `http://localhost:5173` en `security.api-v5.allowed-origins` si se sirve en otro origen.
2. Copiar o ajustar `public/config.json`. Para desarrollo con Vite, usar `"apiBaseUrl": "http://localhost:8080/api/v5"`.
3. Ejecutar `./run-dev.sh`.

El script instala dependencias con `npm ci` cuando aún no existe `node_modules`,
inicia Vite en `http://127.0.0.1:5173` y redirige `/api/v5` al harvester local
en `http://localhost:8090`. Se puede indicar otro origen como primer argumento:

```bash
./run-dev.sh http://localhost:8090
```

La autenticación `file` usa HTTP Basic. Las credenciales permanecen solamente en memoria del navegador y se descartan al recargar o cerrar la pestaña. Para producción se recomienda configurar OIDC y completar su adaptador en `src/auth`.

## Contrato API

El cliente del vertical inicial está tipado a partir del contrato v5. Cuando el backend esté disponible, regenerar tipos con:

```sh
npm run generate:api
```

El comando consulta `http://localhost:8080/api/v5/openapi` por defecto; se puede cambiar con `API_OPENAPI_URL`.
