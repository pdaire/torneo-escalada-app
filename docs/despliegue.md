# Despliegue

## Local

Desde `torneo-escalada/`:

```bash
npm install
npm run dev
```

La app queda en http://127.0.0.1:5173/. Usa la base de datos real: lo que se anote ahí se ve en el sitio publicado. Para probar sin tocarla, ver [Demo local](#demo-local).

## Firebase CLI

El paquete `firebase` del proyecto es el SDK del navegador. La CLI es `firebase-tools` y el comando `firebase` tiene que estar en el PATH.

En esta red, Node no confía el certificado del proxy. El login y el resto de comandos de la CLI necesitan los certificados del sistema:

```bash
NODE_OPTIONS=--use-system-ca firebase login
```

Usa el mismo prefijo para `firebase init` y `firebase deploy`.

## Hosting

`firebase.json` publica la carpeta `dist` de Vite y reescribe todas las rutas a `index.html`, para que `/juez` y `/admin` funcionen al recargar.

Caché del navegador:

| Ruta | `Cache-Control` | Por qué |
| --- | --- | --- |
| `/assets/**` | un año, `immutable` | Los nombres llevan hash: un cambio genera otro archivo. |
| Páginas, `sw-juez.js`, `juez.webmanifest` | `no-cache` | Con red, el navegador siempre pide la versión publicada. |

### App instalable del juez (PWA)

- `public/juez.webmanifest`: nombre, íconos (`public/juez-*.png`, fuente en `juez-icono.svg`), pantalla completa, inicio en `/juez`.
- `public/sw-juez.js`: service worker con alcance `/juez`. La página va primero a la red y, sin red, usa la última versión guardada; los archivos de `/assets` se sirven desde la caché y los de versiones anteriores se borran. No intercepta Firestore ni Firebase Auth.
- `src/pwaJuez.js`: agrega el manifiesto y las etiquetas de iOS solo en `/juez`, y registra el service worker solo en el build de producción.

Para probarlo como en producción (headers incluidos), compilar y servir con el emulador de Hosting:

```bash
npm run build && firebase emulators:start --only hosting --project demo-torneo   # http://127.0.0.1:5002/juez
```

Al fusionar en `main`, GitHub Actions corre `npm ci && npm test && npm run build` y publica el canal en vivo: https://torneo-escalada-app.web.app/

Un pull request genera una vista previa y no toca el sitio público. El secreto del deploy es `FIREBASE_SERVICE_ACCOUNT_TORNEO_ESCALADA_APP`.

## Reglas de Firestore

El archivo versionado es `firestore.rules`. El deploy de GitHub Actions **no** lo publica: hay que pegarlo en la consola de Firebase (*Firestore → Reglas*) o correr `firebase deploy --only firestore:rules`. Si las reglas del proyecto no coinciden con ese archivo, administrar y anotar fallan con permiso denegado. La lectura de una colección vacía sí funciona, y el tablero queda sin etapa activa.

Las reglas se apoyan en roles. Hay que publicarlas junto con el código que las usa.

## Primera configuración de seguridad

Una sola vez, en la consola de Firebase:

1. **Authentication → Settings → User actions:** desactivar *Enable create (sign-up)*. Si queda activo, cualquiera puede crear una cuenta con la API key pública. Las cuentas se crean en *Authentication → Users*.
2. **Firestore:** crear la colección `admins` y, dentro, un documento por administrador cuyo ID sea su correo en minúsculas. Si la consola pide un campo, cualquiera sirve (por ejemplo `nombre`); la app solo revisa que el documento exista. La contraseña no va aquí: se define al crear el usuario en *Authentication → Users*.
3. En `/admin`, agregar a cada juez, juez jefe y delegado en **Jueces y delegados** de cada competencia, y asignar bloques a los jueces.

Las asignaciones viejas (`asignaciones` dentro de la etapa) ya no se usan. Hay que volver a cargarlas como miembros.

## Demo local

```bash
npm run demo:local
```

Levanta los emuladores de Firestore y Authentication, carga la competencia demo y abre la app en http://localhost:5174/ contra ellos. No toca la base real y funciona sin internet. Todas las pantallas funcionan con estas cuentas, todas con la clave `demo1234`:

| Cuenta | Rol en la demo |
| --- | --- |
| `admin@demo.local` | Admin y juez jefe |
| `pdaire+juez1@gmail.com` | Juez de los 8 bloques de la final |
| `pdaire+delegado1@gmail.com` | Delegado de "Club Demo" |

Cada vez que se corre, la demo parte de cero. Necesita Java, igual que `test:rules`.

## Tests

```bash
npm test             # puntaje, validación y ranking
npm run test:rules   # reglas de Firestore en el emulador
```

`test:rules` usa su propia configuración (`firebase.pruebas.json`, Firestore en el puerto 8180), así que se puede correr con `demo:local` abierto. La app acepta `VITE_PUERTO_FIRESTORE` y `VITE_PUERTO_AUTH` para conectarse a emuladores en otros puertos.

`test:rules` y `demo:local` necesitan Java: `brew install openjdk`. Los scripts ya agregan el Java de Homebrew al PATH y usan los certificados del sistema (`NODE_OPTIONS=--use-system-ca`), así que no hay que configurar nada más. Usan el proyecto de prueba `demo-torneo` y no tocan datos reales.

GitHub Actions corre `npm test` antes de cada build.
