/**
 * pricingEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all fee calculations.
 * Both orderController (server-side) and pricingUtils.ts (mobile-side) use
 * the same logic, just different languages.
 *
 * All amounts are in ₹ and returned as plain numbers (not strings).
 */

/**
 * Find the fee for a given value in a sorted slab array.
 * If value exceeds the last slab, applies the step extension rule.
 *
 * @param {number} value       - The value to look up (product price or cart total)
 * @param {Array}  slabs       - [{ min, max, fee }] sorted ascending by min
 * @param {number} stepAmount  - Range size for extension beyond last slab
 * @param {number} stepFee     - Fee to add per step beyond last slab
 * @returns {number}
 */
function lookupSlab(value, slabs, stepAmount, stepFee) {
  if (!Array.isArray(slabs) || slabs.length === 0) return 0;

  for (const slab of slabs) {
    if (value >= slab.min && value <= slab.max) {
      return slab.fee;
    }
  }

  // Beyond last defined slab → apply step extension
  const lastSlab = slabs[slabs.length - 1];
  if (value > lastSlab.max) {
    const stepsAbove = Math.ceil((value - lastSlab.max) / stepAmount);
    return lastSlab.fee + stepsAbove * stepFee;
  }

  return 0;
}

/**
 * Calculate Platform Fee across all cart items.
 * Fee is looked up per product selling price, then multiplied by quantity.
 *
 * @param {Array}  items      - Cart items: [{ price, quantity, discount_percent }]
 * @param {Object} config     - pricingConfig row from DB
 * @returns {number}
 */
function calcPlatformFee(items, config) {
  if (!config.platform_fee_enabled) return 0;

  const slabs       = config.platform_fee_slabs || [];
  const stepAmount  = config.platform_fee_step_amount || 1000;
  const stepFee     = config.platform_fee_step_fee || 10;

  let total = 0;
  for (const item of items) {
    const discount      = item.discount_percent || 0;
    const sellingPrice  = item.price * (1 - discount / 100);
    const feePerUnit    = lookupSlab(sellingPrice, slabs, stepAmount, stepFee);
    total += feePerUnit * (item.quantity || 1);
  }
  return Math.round(total);
}

/**
 * Calculate Order Handling Fee based on cart subtotal.
 *
 * @param {number} subtotal  - Cart subtotal (after discounts, before fees)
 * @param {Object} config    - pricingConfig row from DB
 * @returns {number}
 */
function calcHandlingFee(subtotal, config) {
  if (!config.handling_fee_enabled) return 0;

  const slabs       = config.handling_fee_slabs || [];
  const stepAmount  = config.handling_fee_step_amount || 500;
  const stepFee     = config.handling_fee_step_fee || 5;

  return Math.round(lookupSlab(subtotal, slabs, stepAmount, stepFee));
}

/**
 * Calculate Packaging Fee (restaurant-wise: one flat fee per order).
 *
 * @param {Object} config  - pricingConfig row from DB
 * @param {number} subtotal - Cart subtotal (needed for percentage type)
 * @returns {number}
 */
function calcPackagingFee(config, subtotal) {
  if (!config.packaging_fee_enabled) return 0;

  if (config.packaging_fee_type === 'percentage') {
    return Math.round((subtotal * parseFloat(config.packaging_fee_value || 0)) / 100);
  }
  return Math.round(parseFloat(config.packaging_fee_value || 0));
}

/**
 * Calculate Delivery Fee using distance + appSettings thresholds.
 *
 * @param {number} subtotal      - Cart subtotal
 * @param {number} distanceKm    - Distance between store and user (Haversine)
 * @param {Object} appSettings   - app_settings row from DB
 * @param {boolean} isSelfPickup
 * @returns {number}
 */
function calcDeliveryFee(subtotal, distanceKm, appSettings, isSelfPickup) {
  if (isSelfPickup) return 0;
  if (!distanceKm) return Math.round(parseFloat(appSettings.min_delivery_fee || 30));

  const freeThreshold = parseFloat(appSettings.free_delivery_threshold || 500);
  if (subtotal >= freeThreshold) return 0;

  let fee        = parseFloat(appSettings.min_delivery_fee || 30);
  const baseKm   = parseFloat(appSettings.base_delivery_radius || 5);
  const perKm    = parseFloat(appSettings.per_km_extra_charge || 10);

  if (distanceKm > baseKm) {
    fee += (distanceKm - baseKm) * perKm;
  }
  return Math.round(fee);
}

/**
 * Calculate total surge fees (rain + peak hour).
 * appSettings.is_rainy_condition is the rain toggle (existing field).
 * pricingConfig has the peak surge fields.
 *
 * @param {Object} appSettings
 * @param {Object} config
 * @param {boolean} isSelfPickup
 * @returns {number}
 */
function calcSurgeFee(appSettings, config, isSelfPickup) {
  if (isSelfPickup) return 0;
  let surge = 0;

  // Rain surge (uses existing app_settings.is_rainy_condition)
  if (appSettings.is_rainy_condition) {
    surge += parseFloat(appSettings.rainy_condition_fee || 0);
  }

  // Peak hour surge (from pricing_config)
  if (config.peak_surge_enabled) {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (config.peak_surge_start || '12:00').split(':').map(Number);
    const [eh, em] = (config.peak_surge_end   || '14:00').split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;
    const isPeak = startMins > endMins
      ? (currentMins >= startMins || currentMins <= endMins)
      : (currentMins >= startMins && currentMins <= endMins);
    if (isPeak) surge += parseFloat(config.peak_surge_amount || 0);
  }

  return Math.round(surge);
}

/**
 * Calculate GST amount (inclusive — for display only, NOT added to total).
 *
 * @param {number} subtotal
 * @param {number} feesTotal  - sum of all non-GST fees
 * @param {Object} config
 * @returns {number}
 */
function calcGST(subtotal, feesTotal, config) {
  if (!config.gst_enabled) return 0;

  const pct = parseFloat(config.gst_percentage || 0);
  let base = 0;
  if (config.gst_applies_on === 'product_only')       base = subtotal;
  else if (config.gst_applies_on === 'product_and_fees') base = subtotal + feesTotal;
  else                                                    base = subtotal + feesTotal; // 'entire_order'

  // Inclusive: GST = base * rate / (1 + rate)
  return Math.round((base * pct) / 100);
}

/**
 * Apply a coupon to the pre-discount total.
 *
 * @param {Object|null} coupon  - coupon row from DB (or null)
 * @param {number} subtotal     - cart subtotal (for min_order_value check)
 * @param {number} preTaxTotal  - sum before coupon is applied
 * @returns {{ discount: number, error: string|null }}
 */
function applyCoupon(coupon, subtotal, preTaxTotal) {
  if (!coupon) return { discount: 0, error: null };

  if (!coupon.is_active) return { discount: 0, error: 'Coupon is not active.' };

  const now = new Date();
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { discount: 0, error: 'Coupon has expired.' };
  }
  if (new Date(coupon.valid_from) > now) {
    return { discount: 0, error: 'Coupon is not yet valid.' };
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { discount: 0, error: 'Coupon usage limit reached.' };
  }
  if (subtotal < coupon.min_order_value) {
    return { discount: 0, error: `Minimum order value ₹${coupon.min_order_value} required.` };
  }

  let discount = 0;
  if (coupon.discount_type === 'flat') {
    discount = Math.min(coupon.discount_value, preTaxTotal);
  } else {
    discount = Math.round((preTaxTotal * coupon.discount_value) / 100);
    if (coupon.max_discount_cap) {
      discount = Math.min(discount, coupon.max_discount_cap);
    }
  }

  return { discount, error: null };
}

/**
 * Apply platform-wide discount.
 *
 * @param {Object} config
 * @param {number} preTaxTotal
 * @returns {number}
 */
function calcPlatformDiscount(config, preTaxTotal) {
  if (!config.platform_discount_enabled) return 0;

  if (config.platform_discount_type === 'flat') {
    return Math.min(parseFloat(config.platform_discount_value || 0), preTaxTotal);
  }
  return Math.round((preTaxTotal * parseFloat(config.platform_discount_value || 0)) / 100);
}

/**
 * Full billing calculation — the master function.
 *
 * @param {Object} params
 * @param {Array}  params.items
 * @param {number} params.subtotal
 * @param {number} params.distanceKm
 * @param {boolean} params.isSelfPickup
 * @param {number} params.deliveryTip
 * @param {number} params.lateNightFee    - already calculated by existing logic
 * @param {number} params.extraStoreCharge
 * @param {Object} params.appSettings
 * @param {Object} params.pricingConfig
 * @param {Object|null} params.coupon
 *
 * @returns {{
 *   platformFee, handlingFee, packagingFee, deliveryFee,
 *   surgeFee, lateNightFee, extraStoreCharge, deliveryTip,
 *   gstAmount, couponDiscount, platformDiscount,
 *   grandTotal
 * }}
 */
function calculateBilling({
  items,
  subtotal,
  distanceKm,
  isSelfPickup,
  deliveryTip,
  lateNightFee,
  extraStoreCharge,
  appSettings,
  pricingConfig,
  coupon,
}) {
  const platformFee    = calcPlatformFee(items, pricingConfig);
  const handlingFee    = calcHandlingFee(subtotal, pricingConfig);
  const packagingFee   = calcPackagingFee(pricingConfig, subtotal);
  const deliveryFee    = calcDeliveryFee(subtotal, distanceKm, appSettings, isSelfPickup);
  const surgeFee       = calcSurgeFee(appSettings, pricingConfig, isSelfPickup);

  const effectiveTip        = isSelfPickup ? 0 : (deliveryTip || 0);
  const effectiveLateNight  = isSelfPickup ? 0 : (lateNightFee || 0);
  const effectiveExtraStore = isSelfPickup ? 0 : (extraStoreCharge || 0);

  const feesTotal = platformFee + handlingFee + packagingFee + deliveryFee +
                    surgeFee + effectiveLateNight + effectiveTip + effectiveExtraStore;

  const gstAmount = calcGST(subtotal, feesTotal, pricingConfig);

  const preTaxTotal = subtotal + feesTotal; // GST is inclusive so NOT added
  const { discount: couponDiscount } = applyCoupon(coupon, subtotal, preTaxTotal);
  const platformDiscount = calcPlatformDiscount(pricingConfig, preTaxTotal - couponDiscount);

  const grandTotal = Math.max(0, preTaxTotal - couponDiscount - platformDiscount);

  return {
    platformFee,
    handlingFee,
    packagingFee,
    deliveryFee,
    surgeFee,
    lateNightFee: effectiveLateNight,
    extraStoreCharge: effectiveExtraStore,
    deliveryTip: effectiveTip,
    gstAmount,
    couponDiscount,
    platformDiscount,
    grandTotal,
  };
}

module.exports = {
  calculateBilling,
  calcPlatformFee,
  calcHandlingFee,
  calcPackagingFee,
  calcDeliveryFee,
  calcSurgeFee,
  calcGST,
  applyCoupon,
  calcPlatformDiscount,
  lookupSlab,
};
