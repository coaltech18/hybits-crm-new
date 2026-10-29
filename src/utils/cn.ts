import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge so a page's className override actually wins over a component default.
// Custom font sizes are registered so `text-sm` and colour tokens like `text-ink` don't collide.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] }],
      'shadow': [{ shadow: ['sheet', 'lift', 'dialog'] }],
      'rounded': [{ rounded: ['sheet'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
