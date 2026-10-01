import { Outlet, useLocation } from 'react-router-dom';

export default function CustomerLayout() {
  const location = useLocation();
  const isMenuPage = location.pathname === '/' || 
                     location.pathname === '/menu' || 
                     location.pathname === '/delivery' || 
                     location.pathname === '/dine-in' || 
                     location.pathname.startsWith('/ilisher-bari') ||
                     location.pathname.startsWith('/table');

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {isMenuPage ? (
          <Outlet />
        ) : (
          <div className="w-full max-w-xl mx-auto min-h-screen bg-white shadow-xl">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
