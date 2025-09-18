import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import { IconProps } from '@/types';

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = "currentColor",
  className = "",
  strokeWidth = 2,
  ...props
}) => {
  const IconComponent = LucideIcons?.[name as keyof typeof LucideIcons] as React.ComponentType<any>;

  if (!IconComponent) {
    return <HelpCircle size={size} color="gray" strokeWidth={strokeWidth} className={className} {...props} />;
  }

  return <IconComponent
    size={size}
    color={color}
    strokeWidth={strokeWidth}
    className={className}
    {...props}
  />;
};

export default Icon;
