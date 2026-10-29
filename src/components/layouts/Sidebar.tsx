import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import { navFor, activeNavPath } from './navigation';

interface SidebarProps {
  /** Called after a link is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const groups = navFor(user?.role);
  const active = activeNavPath(pathname, groups);

  return (
    <div className="flex h-full w-64 flex-col bg-rail text-rail-text">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/dashboard" onClick={onNavigate} className="rounded-md bg-white px-2.5 py-1.5" aria-label="Hybits — go to dashboard">
          <img src="/logo.png" alt="Hybits Sterilised Dish" className="h-7 w-auto" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:#1D5C4B_transparent]">
        {groups.map((group) => (
          <div key={group.label} className="mt-5 first:mt-2">
            <h2 className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-rail-muted">{group.label}</h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.to === active;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                        'focus-visible:outline-white',
                        isActive ? 'bg-rail-active text-white' : 'text-rail-text hover:bg-rail-hover hover:text-white'
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-rail-mark' : 'text-rail-muted group-hover:text-rail-text')} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rail-active text-sm font-semibold text-white" aria-hidden="true">
            {(user?.full_name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user?.full_name}</div>
            <div className="text-xs capitalize text-rail-muted">{user?.role}</div>
          </div>
          <button
            type="button"
            onClick={() => logout().catch((e) => console.error('Logout error:', e))}
            className="rounded-md p-2 text-rail-muted transition-colors hover:bg-rail-hover hover:text-white focus-visible:outline-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
