// Temporary declarations for remaining JSX files during TypeScript migration
declare module '*.jsx' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

// Keep declarations for components that haven't been converted yet
declare module '@/pages/authentication-role-selection' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module '@/pages/NotFound' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}