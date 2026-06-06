import { Home, MapPin, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 text-white p-1.5 rounded-lg">
              <Home size={20} />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">MutuneRent Pro</span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
              Mombasa
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-gray-700 hover:text-brand-600 transition-colors flex items-center gap-1.5">
              <Home size={16} /> Dashboard
            </Link>
            <Link to="/properties" className="text-sm font-medium text-gray-700 hover:text-brand-600 transition-colors flex items-center gap-1.5">
              <MapPin size={16} /> Properties
            </Link>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{user.full_name || user.email}</span>
                <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu size={24} className="text-gray-700" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-2">
          <Link to="/" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Dashboard</Link>
          <Link to="/properties" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Properties</Link>
          {user && <button onClick={() => { onLogout(); setMobileOpen(false); }} className="block text-sm text-red-600 py-2">Logout</button>}
        </div>
      )}
    </nav>
  );
}
