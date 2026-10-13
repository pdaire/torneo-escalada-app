// La tablet del juez se puede instalar como app. El manifiesto, las etiquetas de
// iOS y el service worker se agregan solo en /juez: el tablero público y el
// resto de las pantallas siguen siendo una web normal.

function agregar(tag, atributos) {
  const elemento = document.createElement(tag);
  Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
  document.head.appendChild(elemento);
}

export function prepararPwaJuez() {
  if (!/^\/juez(\/|$)/.test(window.location.pathname)) return;

  agregar('link', { rel: 'manifest', href: '/juez.webmanifest' });
  agregar('link', { rel: 'apple-touch-icon', href: '/juez-apple-touch.png' });
  agregar('meta', { name: 'theme-color', content: '#111111' });
  agregar('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  agregar('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  agregar('meta', { name: 'apple-mobile-web-app-title', content: 'Juez' });
  agregar('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  document.title = 'Juez · Torneo de escalada';

  // En desarrollo no: el servidor de Vite sirve módulos sin hash y el service worker los dejaría viejos.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw-juez.js', { scope: '/juez' }).catch((error) => {
        console.warn('No se pudo registrar el service worker del juez:', error);
      });
    });
  }
}
