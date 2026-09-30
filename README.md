# LA Referencia Harvester Admin Web

SPA para operar el cosechador exclusivamente mediante `/api/v5`. Es la única
interfaz web de Harvester y se compila al directorio
`lareferencia-lrharvester-app/static/`.

## Inicio local

1. Iniciar el harvester con la API v5 habilitada y permitir explícitamente `http://localhost:5173` en `security.api-v5.allowed-origins` si se sirve en otro origen.
2. Copiar o ajustar `public/config.json`. Para desarrollo con Vite, usar `"apiBaseUrl": "http://localhost:8090/api/v5"`.
3. Ejecutar `./run-dev.sh`.

El script instala dependencias con `npm ci` cuando aún no existe `node_modules`,
inicia Vite en `http://127.0.0.1:5173` y redirige `/api/v5` al harvester local
en `http://localhost:8090`. Se puede indicar otro origen como primer argumento:

```bash
./run-dev.sh http://localhost:8090
```

La interfaz usa sesiones locales del servidor mediante una cookie segura y protección CSRF. Los usuarios se administran desde la sección de usuarios; las integraciones utilizan tokens revocables de cuentas técnicas y no pueden iniciar sesión en esta interfaz.
El primer usuario administrador debe crearse en la base de datos de Harvester con
`security-create-admin <username>` desde el shell interactivo, después de aplicar
`database_migrate`. No hay cuentas por defecto ni migración de Keycloak. Roles,
alcance por red, cookies y tokens están descritos en
[`docs/AUTHENTICATION.md`](../docs/AUTHENTICATION.md).

## Compilación para el harvester

El frontend de producción se genera directamente en el directorio externo
`static` del harvester, sin copiar recursos a `target`. Ese directorio contiene
la SPA React; no existe `static-legacy` ni una ruta `/legacy/`:

```bash
./build.sh
```

El script delega en Maven: instala una versión fijada de Node, ejecuta `npm ci`,
compila la aplicación y sincroniza `dist/` con
`../lareferencia-lrharvester-app/static/`. El harvester sirve ese directorio en
la raíz de `8090`; nunca se sirve contenido desde `target`.

También puede usarse Maven directamente, por ejemplo en CI:

```bash
mvn package
```

Para un checkout donde el harvester no sea un repositorio hermano, indicar el
destino de forma explícita:

```bash
mvn package -Dharvester.static.dir=/ruta/a/lareferencia-lrharvester-app/static
```

## Contrato API

El cliente del vertical inicial está tipado a partir del contrato v5. Cuando el backend esté disponible, regenerar tipos con:

```sh
npm run generate:api
```

El comando consulta `${API_OPENAPI_URL:-http://localhost:8080/api/v5/openapi}` (default del script: puerto `8080`). El harvester normalmente publica la API en `8090`; exporta `API_OPENAPI_URL` si hace falta:

```sh
API_OPENAPI_URL=http://localhost:8090/api/v5/openapi npm run generate:api
```

Con el asistente Docker en modo aislado, la Admin Web de desarrollo (Vite con HMR) corre en `5273` (`5173` + offset).
