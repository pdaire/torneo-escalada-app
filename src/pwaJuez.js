// La tablet del juez de cada competencia se puede instalar como app: /copa-chile/juez
// queda como "Juez" con su propio ícono y abre directo en esa competencia. El
// manifiesto, las etiquetas de iOS y el service worker se agregan solo en esas
// direcciones: el tablero público y el resto de las pantallas siguen siendo web normal.

function agregar(tag, atributos) {
  const elemento = document.createElement(tag);
  Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
  document.head.appendChild(elemento);
}

export function prepararPwaJuez() {
  const coincidencia = window.location.pathname.match(/^\/([^/]+)\/juez\/?$/);
  if (!coincidencia) return;
  const competenciaId = coincidencia[1];

  agregar('meta', { name: 'theme-color', content: '#111111' });
  agregar('link', { rel: 'apple-touch-icon', href: '/juez-apple-touch.png' });
  agregar('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  agregar('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  agregar('meta', { name: 'apple-mobile-web-app-title', content: 'Juez' });
  agregar('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  document.title = 'Juez · Torneo de escalada';

  // En desarrollo no: el manifiesto por competencia lo sirve Hosting, y el service
  // worker dejaría viejos los módulos sin hash del servidor de Vite.
  if (!import.meta.env.PROD) return;
  // Hosting sirve el mismo manifiesto en cada competencia; sus rutas relativas
  // (./juez) hacen que la app instalada abra en /{competencia}/juez.
  agregar('link', { rel: 'manifest', href: `/${competenciaId}/juez.webmanifest` });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // La versión anterior se instalaba en /juez, sin competencia.
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros
          .filter((registro) => new URL(registro.scope).pathname === '/juez')
          .map((registro) => registro.unregister()));
        await navigator.serviceWorker.register('/sw-juez.js', { scope: `/${competenciaId}/juez` });
      } catch (error) {
        console.warn('No se pudo registrar el service worker del juez:', error);
      }
    });
  }
}
