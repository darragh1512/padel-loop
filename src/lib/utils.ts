// Tiny helper used by the shadcn-style UI components: merges Tailwind class
// strings together, with later classes correctly overriding earlier ones.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
