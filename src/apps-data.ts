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
    phase: 'Phase 3',
    soon: 'Folders, pinned notes, and checklists as their own type — with search across everything.',
  },
  {
    id: 'meals',
    name: 'Meals & Recipes',
    subtitle: 'Recipe box & weekly planner',
    icon: ChefHat,
    color: '#16A34A',
    phase: 'Phase 4',
    soon: 'A recipe box plus a weekly planner grid. One tap adds the week’s ingredients to your shopping list.',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    subtitle: 'Grocery & shopping lists',
    icon: ShoppingCart,
    color: '#EA580C',
    phase: 'Phase 4',
    soon: 'Grocery and general lists that receive items from the meal planner and brain dump.',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    subtitle: 'Events & reminders',
    icon: Calendar,
    color: '#DC2626',
    phase: 'Later',
    soon: 'Events with a fast chip-based form for repeats and reminders, plus your dated tasks in one view.',
  },
  {
    id: 'finance',
    name: 'Finance',
    subtitle: 'Spending & receipts',
    icon: Wallet,
    color: '#4F46E5',
    phase: 'Later',
    soon: 'Income and expense tracking with categories and receipts.',
  },
  {
    id: 'inventory',
    name: 'Home Inventory',
    subtitle: 'Catalog & find your things',
    icon: Package,
    color: '#DB2777',
    phase: 'Later',
    soon: 'Catalog what you own by room, with search and filter chips to find anything fast.',
  },
]
