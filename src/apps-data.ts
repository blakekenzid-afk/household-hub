import {
  Brain,
  Calendar,
  ChefHat,
  NotebookPen,
  Package,
  ShoppingCart,
  SquareCheckBig,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface AppDef {
  id: string
  name: string
  subtitle: string
  icon: LucideIcon
  color: string
  route?: string
  phase?: string
  soon?: string
}

export const APPS: AppDef[] = [
  {
    id: 'brain-dump',
    name: 'Brain Dump',
    subtitle: 'Get it out of your head',
    icon: Brain,
    color: '#7C3AED',
    route: '/apps/brain-dump',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    subtitle: 'To-dos, chores & due dates',
    icon: SquareCheckBig,
    color: '#2563EB',
    route: '/apps/tasks',
  },
  {
    id: 'notes',
    name: 'Notes & Lists',
    subtitle: 'Notebooks, checklists & more',
    icon: NotebookPen,
    color: '#D97706',
    route: '/apps/notes',
  },
  {
    id: 'meals',
    name: 'Meals & Recipes',
    subtitle: 'Recipe box & weekly planner',
    icon: ChefHat,
    color: '#16A34A',
    route: '/apps/meals',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    subtitle: 'Grocery & shopping lists',
    icon: ShoppingCart,
    color: '#EA580C',
    route: '/apps/shopping',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    subtitle: 'Events & your dated tasks',
    icon: Calendar,
    color: '#DC2626',
    route: '/apps/calendar',
  },
  {
    id: 'finance',
    name: 'Finance',
    subtitle: 'Spending & income',
    icon: Wallet,
    color: '#4F46E5',
    route: '/apps/finance',
  },
  {
    id: 'inventory',
    name: 'Home Inventory',
    subtitle: 'Catalog & find your things',
    icon: Package,
    color: '#DB2777',
    route: '/apps/inventory',
  },
]
