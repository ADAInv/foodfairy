import { StrictMode, Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { RouterProvider, useRouter } from './lib/router';
import { SiteProvider, BasketProvider, UiProvider } from './lib/store';
import { Home } from './pages/Home';
import { MenuPage } from './pages/MenuPage';
import { Catering } from './pages/Catering';
import { About } from './pages/About';
import { Faq } from './pages/Faq';
import { Contact } from './pages/Contact';
import { Checkout } from './pages/Checkout';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { NotFound } from './pages/NotFound';

const AdminApp = lazy(() => import('./admin/AdminApp'));

// The server sets the real <title>/meta on first load (for link previews).
// This keeps the tab title right during in-app navigation.
const TITLES: Record<string, string> = {
  '/': 'The Food Fairy — Nigerian food in Kitchener / Waterloo',
  '/menu': 'Menu — The Food Fairy',
  '/catering': 'Catering — The Food Fairy',
  '/about': 'About — The Food Fairy',
  '/faq': 'FAQ — The Food Fairy',
  '/contact': 'Contact — The Food Fairy',
  '/checkout': 'Checkout — The Food Fairy'
};

function Routes() {
  const { path } = useRouter();
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;

  useEffect(() => {
    document.title = clean.startsWith('/admin') ? 'Admin — The Food Fairy'
      : clean.startsWith('/order/') ? 'Your order — The Food Fairy'
      : TITLES[clean] ?? 'Page not found — The Food Fairy';
  }, [clean]);

  if (clean.startsWith('/admin')) {
    return <Suspense fallback={<p className="p-8">Loading…</p>}><AdminApp /></Suspense>;
  }
  const order = /^\/order\/([A-Za-z0-9_-]{16,64})$/.exec(clean);
  if (order) return <OrderConfirmation token={order[1]!} />;
  switch (clean) {
    case '/': return <Home />;
    case '/menu': return <MenuPage />;
    case '/catering': return <Catering />;
    case '/about': return <About />;
    case '/faq': return <Faq />;
    case '/contact': return <Contact />;
    case '/checkout': return <Checkout />;
    default: return <NotFound />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <SiteProvider>
        <BasketProvider>
          <UiProvider>
            <Routes />
          </UiProvider>
        </BasketProvider>
      </SiteProvider>
    </RouterProvider>
  </StrictMode>
);
