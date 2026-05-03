export type RecipeCategory =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'dessert'
  | 'snacks'
  | 'drinks'
  | 'other';

export const RECIPE_CATEGORIES: { id: RecipeCategory; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'other', label: 'Other' },
];

export interface Recipe {
  id: string;
  title: string;
  source: string;        // "From Aunt Rose, summer 1962"
  forWhom: string;       // optional free-text "for the grandkids"
  category: RecipeCategory;
  prepTime: string;      // free text e.g. "30 min"
  ingredients: string;   // multi-line
  instructions: string;  // multi-line
  text: string;          // raw OCR transcription, preserved verbatim
  photoUrl: string;      // GCS URL or data URL
  photoThumbUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  date: string;          // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  targetType: 'recipe' | 'journal';
  targetId: string;
  name: string;
  body: string;
  createdAt: number;
}

export type Role = 'admin' | 'family' | 'guest';
