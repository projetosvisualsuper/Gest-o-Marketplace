export interface ShippingRate {
  minWeight: number;
  maxWeight: number;
  costs: number[]; // Index corresponds to price range index
}

export const PRICE_RANGES = [
  { min: 0, max: 18.99 },
  { min: 19, max: 48.99 },
  { min: 49, max: 78.99 },
  { min: 79, max: 99.99 },
  { min: 100, max: 119.99 },
  { min: 120, max: 149.99 },
  { min: 150, max: 199.99 },
  { min: 200, max: Infinity },
];

export const SHIPPING_RATES: ShippingRate[] = [
  { minWeight: 0, maxWeight: 0.3, costs: [5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95] },
  { minWeight: 0.3, maxWeight: 0.5, costs: [5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55] },
  { minWeight: 0.5, maxWeight: 1, costs: [6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65] },
  { minWeight: 1, maxWeight: 1.5, costs: [6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65] },
  { minWeight: 1.5, maxWeight: 2, costs: [6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65] },
  { minWeight: 2, maxWeight: 3, costs: [6.35, 7.95, 8.55, 15.75, 18.35, 21.05, 23.65, 26.25] },
  { minWeight: 3, maxWeight: 4, costs: [6.45, 8.15, 8.95, 17.05, 19.85, 22.65, 25.55, 28.35] },
  { minWeight: 4, maxWeight: 5, costs: [6.55, 8.35, 9.75, 18.45, 21.55, 24.65, 27.75, 30.75] },
  { minWeight: 5, maxWeight: 6, costs: [6.65, 8.55, 9.95, 25.45, 28.55, 32.65, 35.75, 39.75] },
  { minWeight: 6, maxWeight: 7, costs: [6.75, 8.75, 10.15, 27.05, 31.05, 36.05, 40.05, 44.05] },
  { minWeight: 7, maxWeight: 8, costs: [6.85, 8.95, 10.35, 28.85, 33.65, 38.45, 43.25, 48.05] },
  { minWeight: 8, maxWeight: 9, costs: [6.95, 9.15, 10.55, 29.65, 34.55, 39.55, 44.45, 49.35] },
  { minWeight: 9, maxWeight: 11, costs: [7.05, 9.55, 10.95, 41.25, 48.05, 54.95, 61.75, 68.65] },
  { minWeight: 11, maxWeight: 13, costs: [7.15, 9.95, 11.35, 42.15, 49.25, 56.25, 63.25, 70.25] },
  { minWeight: 13, maxWeight: 15, costs: [7.25, 10.15, 11.55, 45.05, 52.45, 59.95, 67.45, 74.95] },
  { minWeight: 15, maxWeight: 17, costs: [7.35, 10.35, 11.75, 48.55, 56.05, 63.55, 70.75, 78.65] },
  { minWeight: 17, maxWeight: 20, costs: [7.45, 10.55, 11.95, 54.75, 63.85, 72.95, 82.05, 91.15] },
  { minWeight: 20, maxWeight: 25, costs: [7.65, 10.95, 12.15, 64.05, 75.05, 84.75, 95.35, 105.95] },
  { minWeight: 25, maxWeight: 30, costs: [7.75, 11.15, 12.35, 65.95, 75.45, 85.55, 96.25, 106.95] },
  { minWeight: 30, maxWeight: 40, costs: [7.85, 11.35, 12.55, 67.75, 78.95, 88.95, 99.15, 107.05] },
  { minWeight: 40, maxWeight: 50, costs: [7.95, 11.55, 12.75, 70.25, 81.05, 92.05, 102.55, 110.75] },
  { minWeight: 50, maxWeight: 60, costs: [8.05, 11.75, 12.95, 74.95, 86.45, 98.15, 109.35, 118.15] },
  { minWeight: 60, maxWeight: 70, costs: [8.15, 11.95, 13.15, 80.25, 92.95, 105.05, 117.15, 126.55] },
  { minWeight: 70, maxWeight: 80, costs: [8.25, 12.15, 13.35, 83.95, 97.05, 109.85, 122.45, 132.25] },
  { minWeight: 80, maxWeight: 90, costs: [8.35, 12.35, 13.55, 93.25, 107.45, 122.05, 136.05, 146.95] },
  { minWeight: 90, maxWeight: 100, costs: [8.45, 12.55, 13.75, 106.55, 123.95, 139.55, 155.55, 167.95] },
  { minWeight: 100, maxWeight: 125, costs: [8.55, 12.75, 13.95, 119.25, 138.05, 156.05, 173.95, 187.95] },
  { minWeight: 125, maxWeight: 150, costs: [8.65, 12.75, 14.15, 126.55, 146.15, 165.65, 184.65, 199.45] },
  { minWeight: 150, maxWeight: Infinity, costs: [8.75, 12.95, 14.35, 166.15, 192.45, 217.55, 242.55, 261.95] },
];

export interface ShopeeRule {
  min: number;
  max: number;
  percent: number;
  fixed: number;
}

export const SHOPEE_RULES: ShopeeRule[] = [
  { min: 0, max: 79.99, percent: 0.20, fixed: 4 },
  { min: 80, max: 99.99, percent: 0.14, fixed: 16 },
  { min: 100, max: 199.99, percent: 0.14, fixed: 20 },
  { min: 200, max: 499.99, percent: 0.14, fixed: 26 },
  { min: 500, max: Infinity, percent: 0.14, fixed: 26 },
];
