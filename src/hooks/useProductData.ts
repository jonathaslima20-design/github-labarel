import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import type { Product, CategoryDisplaySetting } from '@/types';
import { logCategoryOperation, sanitizeCategoryName } from '@/lib/categoryUtils';
import { type SupportedLanguage } from '@/lib/i18n';

interface UseProductDataProps {
  userId: string;
  language?: SupportedLanguage;
}

interface UseProductDataReturn {
  allProducts: Product[];
  categorySettings: CategoryDisplaySetting[];
  settings: any;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for managing product data and storefront settings
 */
export function useProductData({ 
  userId, 
  language = 'pt-BR'
}: UseProductDataProps): UseProductDataReturn {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategoryDisplaySetting[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStorefrontSettings = async (userId: string) => {
    try {
      logCategoryOperation('LOADING_STOREFRONT_SETTINGS', { userId });
      
      const { data: storefrontSettings, error: settingsError } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        logCategoryOperation('STOREFRONT_SETTINGS_ERROR', settingsError);
        throw settingsError;
      }

      // Default settings
      const effectiveSettings = {
        showFilters: true,
        showSearch: true,
        showPriceRange: true,
        showCategories: true,
        showBrands: true,
        showGender: true,
        showStatus: true,
        showCondition: true,
        itemsPerPage: 24,
        priceRange: {
          minPrice: 10,
          maxPrice: 5000
        }
      };

      let categoryDisplaySettings: CategoryDisplaySetting[] = [];

      if (storefrontSettings?.settings) {
        // Merge existing settings with defaults
        if (storefrontSettings.settings.filters) {
          Object.assign(effectiveSettings, {
            ...effectiveSettings,
            ...storefrontSettings.settings.filters,
            itemsPerPage: storefrontSettings.settings.itemsPerPage || 24,
            priceRange: storefrontSettings.settings.priceRange || effectiveSettings.priceRange
          });
        } else {
          Object.assign(effectiveSettings, {
            ...effectiveSettings,
            ...storefrontSettings.settings
          });
        }

        // Load category settings
        categoryDisplaySettings = (storefrontSettings.settings.categoryDisplaySettings || [])
          .sort((a: CategoryDisplaySetting, b: CategoryDisplaySetting) => a.order - b.order);
        
        logCategoryOperation('CATEGORY_SETTINGS_LOADED', {
          total: categoryDisplaySettings.length,
          enabled: categoryDisplaySettings.filter(c => c.enabled).length,
          categories: categoryDisplaySettings.map(c => ({
            name: c.category,
            enabled: c.enabled,
            order: c.order
          }))
        });
      }

      return { effectiveSettings, categoryDisplaySettings };
      
    } catch (error) {
      logCategoryOperation('STOREFRONT_SETTINGS_LOAD_ERROR', error);
      throw error;
    }
  };

  const loadAllProducts = async (userId: string) => {
    try {
      logCategoryOperation('LOADING_ALL_PRODUCTS', { userId });

      // Load all products at once
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          price,
          discounted_price,
          is_starting_price,
          short_description,
          status,
          category,
          brand,
          gender,
          condition,
          featured_image_url,
          colors,
          sizes,
          display_order,
          external_checkout_url,
          has_tiered_pricing
        `)
        .eq('user_id', userId)
        .eq('is_visible_on_storefront', true)
        .order('display_order', { ascending: true, nullsLast: true })
        .order('id', { ascending: false });
        
      if (productsError) {
        throw productsError;
      }

      const products = productsData || [];
      
      // Detailed analysis of loaded products
      const productAnalysis = {
        totalLoaded: products.length,
        withCategories: products.filter(p => p.category && Array.isArray(p.category) && p.category.length > 0).length,
        withoutCategories: products.filter(p => !p.category || !Array.isArray(p.category) || p.category.length === 0).length,
        byStatus: {
          disponivel: products.filter(p => p.status === 'disponivel').length,
          vendido: products.filter(p => p.status === 'vendido').length,
          reservado: products.filter(p => p.status === 'reservado').length
        },
        categoryBreakdown: {} as Record<string, number>
      };

      // Analysis by category
      products.forEach(product => {
        if (product.category && Array.isArray(product.category)) {
          product.category.forEach(cat => {
            const sanitized = sanitizeCategoryName(cat);
            if (sanitized) {
              productAnalysis.categoryBreakdown[sanitized] = 
                (productAnalysis.categoryBreakdown[sanitized] || 0) + 1;
            }
          });
        }
      });

      logCategoryOperation('ALL_PRODUCTS_LOADED', productAnalysis);

      return products;

    } catch (error) {
      logCategoryOperation('LOAD_ALL_PRODUCTS_ERROR', error);
      throw error;
    }
  };
  const syncCategorySettings = async (
    products: Product[],
    currentSettings: CategoryDisplaySetting[],
    userId: string
  ): Promise<CategoryDisplaySetting[]> => {
    try {
      const categoriesInProducts = new Set<string>();

      products.forEach(product => {
        if (product.category && Array.isArray(product.category)) {
          product.category.forEach(cat => {
            const sanitized = sanitizeCategoryName(cat);
            if (sanitized) {
              categoriesInProducts.add(sanitized);
            }
          });
        }
      });

      const categoriesArray = Array.from(categoriesInProducts);

      if (currentSettings.length === 0 && categoriesArray.length > 0) {
        logCategoryOperation('INITIALIZING_ALL_CATEGORIES', {
          categories: categoriesArray,
          count: categoriesArray.length
        });

        const initialSettings = categoriesArray.map((category, index) => ({
          category,
          enabled: true,
          order: index
        }));

        const { data: existingData } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();

        const mergedSettings = {
          ...existingData?.settings,
          categoryDisplaySettings: initialSettings
        };

        await supabase
          .from('user_storefront_settings')
          .upsert({
            user_id: userId,
            settings: mergedSettings
          }, {
            onConflict: 'user_id'
          });

        logCategoryOperation('ALL_CATEGORIES_INITIALIZED', {
          total: initialSettings.length
        });

        return initialSettings;
      }

      const existingCategories = new Set(currentSettings.map(s => s.category));
      const newCategories = categoriesArray.filter(
        cat => !existingCategories.has(cat)
      );

      if (newCategories.length > 0) {
        logCategoryOperation('AUTO_ADDING_NEW_CATEGORIES', {
          newCategories,
          existingCount: currentSettings.length
        });

        const updatedSettings = [
          ...currentSettings,
          ...newCategories.map((category, index) => ({
            category,
            enabled: true,
            order: currentSettings.length + index
          }))
        ];

        const { data: existingData } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();

        const mergedSettings = {
          ...existingData?.settings,
          categoryDisplaySettings: updatedSettings
        };

        await supabase
          .from('user_storefront_settings')
          .upsert({
            user_id: userId,
            settings: mergedSettings
          }, {
            onConflict: 'user_id'
          });

        logCategoryOperation('CATEGORIES_AUTO_SYNCED', {
          added: newCategories,
          total: updatedSettings.length
        });

        return updatedSettings;
      }

      return currentSettings;
    } catch (error) {
      logCategoryOperation('CATEGORY_SYNC_ERROR', error);
      return currentSettings;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [products, settingsData] = await Promise.all([
        loadAllProducts(userId),
        loadStorefrontSettings(userId)
      ]);

      const syncedCategorySettings = await syncCategorySettings(
        products,
        settingsData.categoryDisplaySettings,
        userId
      );

      setAllProducts(products);
      setSettings(settingsData.effectiveSettings);
      setCategorySettings(syncedCategorySettings);

    } catch (err: any) {
      logCategoryOperation('FETCH_DATA_ERROR', err);
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setAllProducts([]);
    await fetchData();
  };

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  return {
    allProducts,
    categorySettings,
    settings,
    loading,
    error,
    refetch,
  };
}