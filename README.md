# LA Referencia Harvester Admin Web

SPA de administración para operar el cosechador mediante `/api/v5`. Se compila
en `lareferencia-lrharvester-app/admin-static/` y se sirve bajo `/admin/`.
El Repository Dashboard Angular es una aplicación separada de solo lectura,
servida bajo `/dashboard/`.

## Inicio local

1. Preparar el workspace de plataforma con `githelper init` e iniciar el harvester en `http://localhost:8090`.
2. Mantener `"apiBaseUrl": "/api/v5"` en `public/config.json`: Vite reenvía esas peticiones al harvester. Si se decide acceder a la API directamente desde otro origen, configurar CORS y cookies para ese despliegue.
3. Ejecutar `./run-dev.sh`.

El script instala dependencias con `npm ci` cuando aún no existe `node_modules`,
requiere Node 22 y npm locales, inicia Vite en `http://127.0.0.1:5173/admin/` y redirige `/api/v5` al harvester local
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
`admin-static` del harvester, sin copiar recursos a `target`. Ese directorio contiene
la SPA React; no existe `static-legacy` ni una ruta `/legacy/`:

```bash
./build.sh
```

El script delega en Maven: instala una versión fijada de Node, ejecuta `npm ci`,
compila la aplicación y sincroniza `dist/` con
`../lareferencia-lrharvester-app/admin-static/`. El harvester sirve ese directorio en
`/admin/` del harvester (puerto `8090` en Compose normal); el Dashboard usa su
propio directorio. La versión Maven se hereda del padre de plataforma y se
sincroniza a `package.json` y `package-lock.json` antes de `npm ci`.

El POM padre debe estar disponible en el workspace o instalado previamente con
la misma versión si se compila este repositorio por separado.

También puede usarse Maven directamente, por ejemplo en CI:

```bash
mvn package
```

Para un checkout donde el harvester no sea un repositorio hermano, indicar el
destino de forma explícita:

```bash
mvn package -Dharvester.static.dir=/ruta/a/lareferencia-lrharvester-app/admin-static
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

En Docker Dev aislado, Vite permanece interno. El gateway ofrece HMR en
`http://admin.localhost:8188/admin/`; la SPA compilada está disponible en
`http://localhost:8190/admin/`. Consulte [Docker Dev](../docs/DOCKER_DEV.md).
