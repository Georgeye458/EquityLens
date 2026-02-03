import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-900 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">EquityLens</span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center space-x-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Status indicator */}
            <div className="flex items-center space-x-2">
              <span className="flex items-center text-sm text-muted-foreground">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                SCX.ai Connected
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-muted-foreground">
            EquityLens - AI-powered earnings analysis powered by SCX.ai
          </p>
        </div>
      </footer>
    </div>
  );
}
