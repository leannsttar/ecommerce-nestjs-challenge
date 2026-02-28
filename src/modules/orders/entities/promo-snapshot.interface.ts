export interface PromoSnapshot {
  code: string;
  type: string;
  value: number;
  maxDiscountAmount: number | null;
  discountApplied: number;
}
