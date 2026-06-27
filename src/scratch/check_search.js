const db = require('../config/db');

async function testSearch() {
  try {
    const searchTerms = ['pizza', 'store', 'veg', 'a'];
    
    for (const q of searchTerms) {
      const searchTerm = `%${q}%`;
      console.log(`\n=== Testing search term: "${q}" ===`);
      
      const storesResult = await db.query(
        `SELECT id, name, approval_status, is_active, latitude, longitude
         FROM stores 
         WHERE name ILIKE $1`,
        [searchTerm]
      );
      console.log(`Matching stores:`, storesResult.rows);

      const productsResult = await db.query(
        `SELECT p.id, p.name, p.is_active, p.store_id, 
                s.name as store_name, s.approval_status as store_approval_status, s.is_active as store_is_active
         FROM products p
         JOIN stores s ON p.store_id = s.id
         WHERE p.name ILIKE $1`,
        [searchTerm]
      );
      console.log(`Matching products:`, productsResult.rows);
    }

    console.log('\n=== All Stores in DB (up to 5) ===');
    const allStores = await db.query('SELECT id, name, approval_status, is_active, latitude, longitude FROM stores LIMIT 5');
    console.log(allStores.rows);

    console.log('\n=== All Products in DB (up to 5) ===');
    const allProducts = await db.query('SELECT id, name, is_active, store_id FROM products LIMIT 5');
    console.log(allProducts.rows);

  } catch (error) {
    console.error('Test search failed:', error);
  } finally {
    process.exit(0);
  }
}

testSearch();
