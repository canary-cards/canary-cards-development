import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formats order number from UUID by taking the last 8 characters
export const formatOrderNumber = (uuid: string): string => {
  if (!uuid) return 'CC000000';
  return uuid.replace(/-/g, '').slice(-8).toUpperCase();
};

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
