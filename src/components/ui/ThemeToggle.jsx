import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from '../AppIcon';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex h-10 w-10 items-center justify-center rounded-lg
        bg-muted hover:bg-accent transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${className}
      `}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Icon 
          name="Moon" 
          size={20} 
          className="text-foreground transition-transform duration-200 hover:scale-110" 
        />
      ) : (
        <Icon 
          name="Sun" 
          size={20} 
          className="text-foreground transition-transform duration-200 hover:scale-110" 
        />
      )}
    </button>
  );
};

export default ThemeToggle;