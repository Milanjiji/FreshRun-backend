const db = require('../config/db');

/**
 * Fetch all active categories with their active subcategories nested
 */
const getAllCategories = async () => {
  const result = await db.query(`
    SELECT 
      c.id, c.name, c.slug, c.icon, c.is_active,
      COALESCE(
        json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'is_active', s.is_active
          )
        ) FILTER (WHERE s.id IS NOT NULL AND s.is_active = true),
        '[]'
      ) as subcategories
    FROM product_categories c
    LEFT JOIN product_subcategories s ON c.id = s.category_id AND s.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return result.rows;
};

/**
 * Fetch all categories and subcategories (for Admin Panel)
 */
const getAllCategoriesAdmin = async () => {
  const result = await db.query(`
    SELECT 
      c.id, c.name, c.slug, c.icon, c.is_active,
      COALESCE(
        json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'is_active', s.is_active
          )
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
      ) as subcategories
    FROM product_categories c
    LEFT JOIN product_subcategories s ON c.id = s.category_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return result.rows;
};

/**
 * Create a new category
 */
const createCategory = async (name, slug, icon) => {
  const result = await db.query(
    'INSERT INTO product_categories (name, slug, icon) VALUES ($1, $2, $3) RETURNING *',
    [name, slug, icon || null]
  );
  return result.rows[0];
};

/**
 * Delete a category
 */
const deleteCategory = async (id) => {
  const result = await db.query(
    'DELETE FROM product_categories WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

/**
 * Create a new subcategory under a category
 */
const createSubcategory = async (categoryId, name) => {
  const result = await db.query(
    'INSERT INTO product_subcategories (category_id, name) VALUES ($1, $2) RETURNING *',
    [categoryId, name]
  );
  return result.rows[0];
};

/**
 * Delete a subcategory
 */
const deleteSubcategory = async (id) => {
  const result = await db.query(
    'DELETE FROM product_subcategories WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

module.exports = {
  getAllCategories,
  getAllCategoriesAdmin,
  createCategory,
  deleteCategory,
  createSubcategory,
  deleteSubcategory
};
