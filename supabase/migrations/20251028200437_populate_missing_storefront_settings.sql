/*
  # Populate Missing Storefront Settings

  1. Purpose
    - Automatically populate user_storefront_settings for users who have products but no settings
    - This migration fixes the bug where CorretorPage appears empty until user saves settings
    - Creates category display settings for all existing product categories

  2. Changes
    - Identifies users with products but no storefront settings
    - Extracts all unique categories from their products
    - Creates initial storefront settings with all categories enabled
    - Sets proper order for categories (alphabetical)

  3. Important Notes
    - Only affects users who have products AND no storefront settings
    - All categories are enabled by default
    - Categories are ordered alphabetically
    - Preserves any existing settings (no overwrite)
*/

DO $$
DECLARE
  user_record RECORD;
  user_categories TEXT[];
  category_settings JSONB;
  settings_json JSONB;
  cat_index INTEGER;
BEGIN
  FOR user_record IN
    SELECT DISTINCT p.user_id
    FROM products p
    WHERE p.is_visible_on_storefront = true
      AND NOT EXISTS (
        SELECT 1
        FROM user_storefront_settings uss
        WHERE uss.user_id = p.user_id
      )
  LOOP
    RAISE NOTICE 'Processing user_id: %', user_record.user_id;

    SELECT ARRAY_AGG(DISTINCT category_item ORDER BY category_item)
    INTO user_categories
    FROM products p,
         LATERAL unnest(p.category) AS category_item
    WHERE p.user_id = user_record.user_id
      AND p.is_visible_on_storefront = true
      AND p.category IS NOT NULL
      AND array_length(p.category, 1) > 0;

    IF user_categories IS NOT NULL AND array_length(user_categories, 1) > 0 THEN
      category_settings := '[]'::jsonb;
      cat_index := 0;

      FOREACH cat_index IN ARRAY ARRAY(SELECT generate_series(1, array_length(user_categories, 1)))
      LOOP
        category_settings := category_settings || jsonb_build_object(
          'category', user_categories[cat_index],
          'enabled', true,
          'order', cat_index - 1
        );
      END LOOP;

      settings_json := jsonb_build_object(
        'showFilters', true,
        'showSearch', true,
        'showPriceRange', true,
        'showCategories', true,
        'showBrands', true,
        'showGender', true,
        'showStatus', true,
        'showCondition', true,
        'itemsPerPage', 24,
        'priceRange', jsonb_build_object(
          'minPrice', 10,
          'maxPrice', 5000
        ),
        'categoryDisplaySettings', category_settings
      );

      INSERT INTO user_storefront_settings (user_id, settings)
      VALUES (user_record.user_id, settings_json)
      ON CONFLICT (user_id) DO NOTHING;

      RAISE NOTICE 'Created settings for user % with % categories',
        user_record.user_id, array_length(user_categories, 1);
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration completed successfully';
END $$;
