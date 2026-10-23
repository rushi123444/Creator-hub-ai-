import AppLayout from './AppLayout.jsx';

/** Separate admin shell (own sidebar: Overview ... Settings). Used for all /admin/* routes. */
export default function AdminLayout() {
  return <AppLayout admin />;
}
