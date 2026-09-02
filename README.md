# LA Referencia Harvester Admin Web

SPA independiente para operar el cosechador exclusivamente mediante `/api/v5`.
No usa ni empaqueta la aplicación AngularJS ubicada en `lareferencia-lrharvester-app/static`.

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

La autenticación `file` usa HTTP Basic. Las credenciales permanecen solamente en memoria del navegador y se descartan al recargar o cerrar la pestaña. Para producción se recomienda configurar OIDC y completar su adaptador en `src/auth`.

## Compilación para el harvester

El frontend de producción se genera directamente en el directorio externo
`static` del harvester, sin copiar recursos a `target`:

```bash
./build.sh
```

El script delega en Maven: instala una versión fijada de Node, ejecuta `npm ci`,
compila la aplicación y sincroniza `dist/` con
`../lareferencia-lrharvester-app/static/`. El harvester sirve ese directorio en
la raíz de `8090`; nunca se sirve contenido desde `target`. La interfaz
anterior permanece en `static-legacy` y puede abrirse mediante `/legacy/`.

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

El comando consulta `http://localhost:8090/api/v5/openapi` por defecto; se puede cambiar con `API_OPENAPI_URL`.
