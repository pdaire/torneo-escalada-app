# Torneo de escalada

App para puntuar un torneo de búlder con el sistema de puntos IFSC y mostrar el ranking en vivo.

- Sitio: https://torneo-escalada-app.web.app/
- Proyecto de Firebase: `torneo-escalada-app` (Hosting, Firestore y Authentication)
- React + Vite

```bash
npm install
npm run dev          # app local contra la base real
npm run demo:local   # app local con la competencia demo en el emulador
npm test             # puntaje, validación y ranking
npm run test:rules   # reglas de Firestore en el emulador (necesita Java)
```

La documentación está en [docs/](docs/README.md): modelo de datos, pantallas, puntuación y despliegue.
