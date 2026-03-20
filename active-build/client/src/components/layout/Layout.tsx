import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      <h1>Main Layout</h1>
      <main>
        <Outlet />
      </main>
    </div>
  );
}