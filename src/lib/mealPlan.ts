import type { MealPlanOption } from '@/types/mealPlan';

export const buildDescriptionFromFoods = (option: MealPlanOption | null | undefined) => {
  if (option?.description && (!option?.foodItems || option.foodItems.length === 0)) {
    return option.description;
  }
  if (!option?.foodItems || !Array.isArray(option.foodItems) || option.foodItems.length === 0) {
    return 'Refeição não definida';
  }
  return option.foodItems
    .map((food) => food.name || '')
    .filter(Boolean)
    .join(' + ');
};
