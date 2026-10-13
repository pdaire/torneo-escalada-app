# Despliegue

## Local

Desde `torneo-escalada/`:

```bash
npm install
npm run dev
```

La app queda en http://127.0.0.1:5173/.

## Firebase CLI

El paquete `firebase` del proyecto es el SDK del navegador. La CLI es `firebase-tools` y el comando `firebase` tiene que estar en el PATH.

En esta red, Node no confía el certificado del proxy. El login y el resto de comandos de la CLI necesitan los certificados del sistema:

```bash
NODE_OPTIONS=--use-system-ca firebase login
```

Usa el mismo prefijo para `firebase init` y `firebase deploy`.

## Hosting

`firebase.json` publica la carpeta `dist` de Vite y reescribe todas las rutas a `index.html`, para que `/juez` y `/admin` funcionen al recargar.

Al fusionar en `main`, GitHub Actions corre `npm ci && npm run build` y publica el canal en vivo: https://torneo-escalada-app.web.app/

Un pull request genera una vista previa y no toca el sitio público. El secreto del deploy es `FIREBASE_SERVICE_ACCOUNT_TORNEO_ESCALADA_APP`.

## Reglas de Firestore

El archivo versionado es `firestore.rules`. Hay que publicarlo en la consola de Firebase o con `firebase deploy --only firestore:rules`. Si las reglas del proyecto no coinciden con ese archivo, administrar y anotar fallan con permiso denegado. La lectura de una colección vacía sí funciona, y el tablero queda sin etapa activa.
