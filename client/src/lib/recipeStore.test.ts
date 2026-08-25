import { describe, it, expect } from 'vitest';
import { matchIngredientToProduct, type CatalogProduct } from './recipeStore';

/**
 * The recipe↔store bridge decides what a recipe ingredient can be bought as.
 * Plain substring matching offered milk for "сүүлний тос" (tail fat) and
 * 9,500₮ butter for a spoonful of oil.
 */
const catalog: CatalogProduct[] = [
  { id: '1', name: 'Сүү', nameEn: 'Milk', emoji: '🥛', unit: 'л', pricePerUnit: 3800 },
  { id: '2', name: 'Цөцгийн тос', nameEn: 'Butter', emoji: '🧈', unit: 'ш', pricePerUnit: 9500 },
  { id: '3', name: 'Сонгино', nameEn: 'Onion', emoji: '🧅', unit: 'кг', pricePerUnit: 1800 },
  { id: '4', name: 'Улаан лооль', nameEn: 'Tomato', emoji: '🍅', unit: 'кг', pricePerUnit: 4500 },
  { id: '5', name: 'Тахианы мах', nameEn: 'Chicken', emoji: '🍗', unit: 'кг', pricePerUnit: 15000 },
  { id: '6', name: 'Үхрийн мах', nameEn: 'Beef', emoji: '🥩', unit: 'кг', pricePerUnit: 22000 },
  { id: '7', name: 'Талх', nameEn: 'Bread', emoji: '🍞', unit: 'ш', pricePerUnit: 2800 },
];

const nameOf = (ingredient: string) => matchIngredientToProduct(ingredient, catalog)?.name ?? null;

describe('matchIngredientToProduct', () => {
  it('matches an exact catalog name', () => {
    expect(nameOf('Сүү')).toBe('Сүү');
    expect(nameOf('Талх')).toBe('Талх');
  });

  it('ignores quantities, units and preparation words', () => {
    expect(nameOf('Үхрийн мах (500 гр жижиглэсэн)')).toBe('Үхрийн мах');
    expect(nameOf('Сонгино (2 ш нарийн хэрчсэн)')).toBe('Сонгино');
  });

  it('keeps a qualified ingredient on the same product', () => {
    expect(nameOf('Улаан сонгино')).toBe('Сонгино');
    expect(nameOf('Ногоон сонгино')).toBe('Сонгино');
  });

  it('follows case endings back to the noun', () => {
    expect(nameOf('Улаан лоолийн зүсэм')).toBe('Улаан лооль');
    expect(nameOf('Талхны үйрмэг')).toBe('Талх');
  });

  it('does not sell milk for tail fat', () => {
    // "сүүлний тос" merely starts with the letters of "сүү".
    expect(nameOf('Шар тос / Сүүлний тос')).toBeNull();
    expect(nameOf('Сүүлний тос')).toBeNull();
  });

  it('does not sell butter for plain oil', () => {
    expect(nameOf('Тос')).toBeNull();
    expect(nameOf('Оливын тос')).toBeNull();
  });

  it('does not sell dairy milk for a plant milk', () => {
    expect(nameOf('Овъёосны сүү')).toBeNull();
    expect(nameOf('Бадамны сүү')).toBeNull();
  });

  it('prefers the more specific meat', () => {
    expect(nameOf('Тахианы цээж мах')).toBe('Тахианы мах');
    expect(nameOf('Үхрийн мах')).toBe('Үхрийн мах');
  });

  it('returns null for something the shop does not sell', () => {
    expect(nameOf('Сармис')).toBeNull();
    expect(nameOf('Япон матча нунтаг')).toBeNull();
    expect(nameOf('')).toBeNull();
  });

  it('matches on the English name too', () => {
    expect(nameOf('Fresh tomato')).toBe('Улаан лооль');
  });
});
