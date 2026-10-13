// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
