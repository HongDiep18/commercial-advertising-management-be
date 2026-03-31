-- Ensure HOMEPAGE_POPUP category exists (may not be present in shadow database)
INSERT INTO ad_package_categories (id, type, name, name_zh, sort_order, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'homepage_popup',
  'Homepage Popup',
  '首頁彈窗',
  1,
  true,
  NOW()
)
ON CONFLICT (type) DO NOTHING;

-- Insert POPUP_PRIORITY_DETAILS_LINK package
INSERT INTO ad_packages (id, category_id, type, name, name_zh, description, pricing_model, metadata, sort_order, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ad_package_categories WHERE type = 'homepage_popup'),
  'popup_priority_details_link',
  '"View Details" Link (Priority Slot)',
  '「查看詳情」連結（優先位）',
  'Adds a clickable "View Details" link to the Priority Slot (position 1) popup advertisement. Single-use, one-time fee.',
  'one_time',
  '{"action": "attach_view_details_link", "slot": "priority"}'::jsonb,
  3,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ad_packages WHERE type = 'popup_priority_details_link'
);

-- Insert POPUP_ROTATION_DETAILS_LINK package
INSERT INTO ad_packages (id, category_id, type, name, name_zh, description, pricing_model, metadata, sort_order, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ad_package_categories WHERE type = 'homepage_popup'),
  'popup_rotation_details_link',
  '"View Details" Link (Rotation Slot)',
  '「查看詳情」連結（輪播位）',
  'Adds a clickable "View Details" link to the Rotation Slot (positions 2-5) popup advertisement. Single-use, one-time fee.',
  'one_time',
  '{"action": "attach_view_details_link", "slot": "rotation"}'::jsonb,
  4,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ad_packages WHERE type = 'popup_rotation_details_link'
);

-- Insert pricing for POPUP_PRIORITY_DETAILS_LINK
INSERT INTO ad_package_pricing (id, package_id, pricing_model, duration_value, duration_unit, base_price, discount_rate, final_price, is_active, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ad_packages WHERE type = 'popup_priority_details_link'),
  'one_time',
  NULL,
  NULL,
  500000,
  0,
  500000,
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ad_package_pricing pp
  JOIN ad_packages pkg ON pp.package_id = pkg.id
  WHERE pkg.type = 'popup_priority_details_link'
);

-- Insert pricing for POPUP_ROTATION_DETAILS_LINK
INSERT INTO ad_package_pricing (id, package_id, pricing_model, duration_value, duration_unit, base_price, discount_rate, final_price, is_active, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ad_packages WHERE type = 'popup_rotation_details_link'),
  'one_time',
  NULL,
  NULL,
  500000,
  0,
  500000,
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ad_package_pricing pp
  JOIN ad_packages pkg ON pp.package_id = pkg.id
  WHERE pkg.type = 'popup_rotation_details_link'
);
