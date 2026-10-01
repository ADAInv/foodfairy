// A 40-line router: History API + a Link that intercepts clicks.
import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const Ctx = createContext<{ path: string; navigate: (to: string) => void }>({ path: '/', navigate: () => {} });

function scrollToHash(hash: string) {
  if (!hash) { window.scrollTo({ top: 0 }); return; }
  requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to: string) => {
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) { window.location.href = to; return; }
    const same = url.pathname === window.location.pathname;
    if (!same || url.hash !== window.location.hash) window.history.pushState({}, '', url.pathname + url.search + url.hash);
    setPath(url.pathname);
    // Let the new page render before scrolling to an anchor.
    setTimeout(() => scrollToHash(url.hash), same ? 0 : 60);
  };
  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target === '_blank') return;
    if (!href.startsWith('/')) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
