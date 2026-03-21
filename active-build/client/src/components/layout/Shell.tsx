import { Outlet } from 'react-router-dom';

export default function Shell() {
  return (
    <div>
      <header>Top Bar</header>
      <aside>Sidebar</aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
