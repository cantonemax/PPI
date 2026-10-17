export function commercialQuote(monthlyPrice: number, discountPercent: number) {
  const annualGross = monthlyPrice * 12;
  const discountAmount = annualGross * discountPercent / 100;
  const annualNet = annualGross - discountAmount;
  return { annualGross, discountAmount, annualNet };
}
