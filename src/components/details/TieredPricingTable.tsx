import { TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrencyI18n, type SupportedCurrency, type SupportedLanguage } from '@/lib/i18n';
import type { PriceTier } from '@/types';

interface TieredPricingTableProps {
  tiers: PriceTier[];
  basePrice: number;
  baseDiscountedPrice?: number;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
}

export default function TieredPricingTable({
  tiers,
  basePrice,
  baseDiscountedPrice,
  currency = 'BRL',
  language = 'pt-BR',
}: TieredPricingTableProps) {
  if (!tiers || tiers.length === 0) return null;

  const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const baseUnitPrice = baseDiscountedPrice || basePrice;

  const calculateSavingsPercentage = (originalPrice: number, newPrice: number): number => {
    if (originalPrice <= 0) return 0;
    return Math.round(((originalPrice - newPrice) / originalPrice) * 100);
  };

  const hasDiscountedPrices = sortedTiers.some(
    tier => tier.discounted_unit_price && tier.discounted_unit_price > 0 && tier.discounted_unit_price < tier.unit_price
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-blue-600" />
          <CardTitle>Preços por Quantidade</CardTitle>
        </div>
        <CardDescription>
          Quanto mais você compra, menos paga por unidade!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Qtd.</th>
                <th className="text-right py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Preço</th>
                <th className="text-right py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedTiers.map((tier) => {
                const unitPrice = tier.unit_price;
                const discountedPrice = tier.discounted_unit_price || null;
                const effectivePrice = discountedPrice && discountedPrice > 0 && discountedPrice < unitPrice
                  ? discountedPrice
                  : unitPrice;
                const totalAtQty = effectivePrice * tier.min_quantity;
                const baseTotal = baseUnitPrice * tier.min_quantity;
                const savings = baseTotal - totalAtQty;
                const savingsPercentage = calculateSavingsPercentage(baseUnitPrice, effectivePrice);
                const discountPercentage = discountedPrice && discountedPrice > 0 && discountedPrice < unitPrice
                  ? calculateSavingsPercentage(unitPrice, discountedPrice)
                  : 0;
                const hasDiscount = discountedPrice && discountedPrice > 0 && discountedPrice < unitPrice;

                return (
                  <tr
                    key={tier.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="py-3 px-2 sm:px-4">
                      <span className="text-xs sm:text-sm font-medium">
                        {tier.min_quantity}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 sm:px-4">
                      <div className="flex flex-col items-end gap-0.5">
                        {hasDiscount ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrencyI18n(unitPrice, currency, language)}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-green-600">
                              {formatCurrencyI18n(discountedPrice, currency, language)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs sm:text-sm font-semibold">
                            {formatCurrencyI18n(unitPrice, currency, language)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 sm:px-4">
                      <span className="text-xs sm:text-sm font-semibold">
                        {formatCurrencyI18n(totalAtQty, currency, language)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
