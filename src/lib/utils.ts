import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Capitalizes the first letter of each word in a name
export function capitalizeName(name: string): string {
  if (!name) return name;
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
