import { Layout } from '../components/Layout';
import { DropTicket } from '../components/DropTicket';
import { Menu } from '../components/Menu';

export function MenuPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 pt-8"><DropTicket /></div>
      <Menu headingLevel={1} />
    </Layout>
  );
}
