import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Button from './Button';
import Icon from '@/components/AppIcon';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  size = 'default' 
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={`p-2 ${className}`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon 
        name={theme === 'light' ? 'Moon' : 'Sun'} 
        size={20} 
        className="text-foreground" 
      />
    </Button>
  );
};

export default ThemeToggle;
