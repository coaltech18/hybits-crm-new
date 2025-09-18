// ============================================================================
// THEME TOGGLE COMPONENT
// ============================================================================

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Button from './Button';
import Icon from '@/components/AppIcon';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-10 h-10 p-0"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Icon name="Moon" size={20} />
      ) : (
        <Icon name="Sun" size={20} />
      )}
    </Button>
  );
};

export default ThemeToggle;
