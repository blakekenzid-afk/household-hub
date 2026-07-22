import type { Transaction } from './db'

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Dining',
  'Bills',
  'Transport',
  'Shopping',
  'Health',
  'Home',
  'Fun',
  'Other',
]

export const INCOME_CATEGORIES = ['Paycheck', 'Gift', 'Refund', 'Other']

export function categoriesFor(type: Transaction['type']): string[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: '#16A34A',
  Dining: '#EA580C',
  Bills: '#DC2626',
  Transport: '#2563EB',
  Shopping: '#DB2777',
  Health: '#0891B2',
  Home: '#7C3AED',
  Fun: '#D97706',
  Paycheck: '#16A34A',
  Gift: '#DB2777',
  Refund: '#0891B2',
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#6E6E73'
}
