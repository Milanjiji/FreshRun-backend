/**
 * pricingEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all fee calculations.
 * Both orderController (server-side) and pricingUtils.ts (mobile-side) use
 * the same logic, just different languages.
 *
 * All amounts are in ₹ and returned as plain numbers (not strings).
 */

const DEFAULT_PRICING_CONFIG = {
  platform_fee_enabled: true,
  platform_fee_slabs: [
    { min: 1, max: 300, fee: 5 },
    { min: 301, max: 1000, fee: 10 },
    { min: 1001, max: 2000, fee: 20 },
    { min: 2001, max: 3000, fee: 30 },
    { min: 3001, max: 4000, fee: 40 },
    { min: 4001, max: 5000, fee: 50 },
  ],
  platform_fee_step_amount: 1000,
  platform_fee_step_fee: 10,

  handling_fee_enabled: true,
  handling_fee_slabs: [
    { min: 0, max: 500, fee: 5 },
    { min: 501, max: 1000, fee: 10 },
    { min: 1001, max: 1500, fee: 15 },
    { min: 1501, max: 2000, fee: 20 },
  ],
  handling_fee_step_amount: 500,
  handling_fee_step_fee: 5,

  packaging_fee_enabled: false,
  packaging_fee_type: 'fixed',
  packaging_fee_value: 10,

  gst_enabled: false,
  gst_percentage: 5,
  gst_applies_on: 'product_only',

  peak_surge_enabled: false,
  peak_surge_amount: 15,
  peak_surge_start: '12:00',
  peak_surge_end: '14:00',

  platform_discount_enabled: false,
  platform_discount_type: 'flat',
  platform_discount_value: 0,
};

function lookupSlab(value, slabs, stepAmount, stepFee) {
  if (!Array.isArray(slabs) || slabs.length === 0) return 0;

  for (const slab of slabs) {
    if (value >= slab.min && value <= slab.max) {
      return Number(slab.fee) || 0;
    }
  }

  const lastSlab = slabs[slabs.length - 1];
  if (value > lastSlab.max) {
    const stepsAbove = Math.ceil((value - lastSlab.max) / stepAmount);
    return (Number(lastSlab.fee) || 0) + stepsAbove * stepFee;
  }

  return 0;
}

function calcPlatformFee(items, config) {
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (cfg.platform_fee_enabled === false) return 0;

  const slabs = (Array.isArray(cfg.platform_fee_slabs) && cfg.platform_fee_slabs.length > 0)
    ? cfg.platform_fee_slabs
    : DEFAULT_PRICING_CONFIG.platform_fee_slabs;
  const stepAmount = Number(cfg.platform_fee_step_amount) || 1000;
  const stepFee = Number(cfg.platform_fee_step_fee) || 10;

  let total = 0;
  for (const item of items) {
    const discount = item.discount_percent || 0;
    const sellingPrice = item.price * (1 - discount / 100);
    const feePerUnit = lookupSlab(sellingPrice, slabs, stepAmount, stepFee);
    total += feePerUnit * (item.quantity || 1);
  }
  return Math.round(total);
}

function calcHandlingFee(subtotal, config) {
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (cfg.handling_fee_enabled === false) return 0;

  const slabs = (Array.isArray(cfg.handling_fee_slabs) && cfg.handling_fee_slabs.length > 0)
    ? cfg.handling_fee_slabs
    : DEFAULT_PRICING_CONFIG.handling_fee_slabs;
  const stepAmount = Number(cfg.handling_fee_step_amount) || 500;
  const stepFee = Number(cfg.handling_fee_step_fee) || 5;

  return Math.round(lookupSlab(subtotal, slabs, stepAmount, stepFee));
}

function calcPackagingFee(config, subtotal) {
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (!cfg.packaging_fee_enabled) return 0;

  if (cfg.packaging_fee_type === 'percentage') {
    return Math.round((subtotal * parseFloat(cfg.packaging_fee_value || 0)) / 100);
  }
  return Math.round(parseFloat(cfg.packaging_fee_value || 0));
}

function calcDeliveryFee(subtotal, distanceKm, appSettings, isSelfPickup) {
  if (isSelfPickup) return 0;
  const freeThreshold = parseFloat(appSettings?.free_delivery_threshold || 500);
  if (subtotal >= freeThreshold) return 0;

  let fee = parseFloat(appSettings?.min_delivery_fee || 30);
  const baseKm = parseFloat(appSettings?.base_delivery_radius || 5);
  const perKm = parseFloat(appSettings?.per_km_extra_charge || 10);

  if (distanceKm && distanceKm > baseKm) {
    fee += (distanceKm - baseKm) * perKm;
  }
  return Math.round(fee);
}

function calcSurgeFee(appSettings, config, isSelfPickup) {
  if (isSelfPickup) return 0;
  let surge = 0;

  if (appSettings?.is_rainy_condition) {
    surge += parseFloat(appSettings.rainy_condition_fee || 0);
  }

  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (cfg.peak_surge_enabled) {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (cfg.peak_surge_start || '12:00').split(':').map(Number);
    const [eh, em] = (cfg.peak_surge_end || '14:00').split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const isPeak = startMins > endMins
      ? (currentMins >= startMins || currentMins <= endMins)
      : (currentMins >= startMins && currentMins <= endMins);
    if (isPeak) surge += parseFloat(cfg.peak_surge_amount || 0);
  }

  return Math.round(surge);
}

function calcGST(subtotal, feesTotal, config) {
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (!cfg.gst_enabled) return 0;

  const pct = parseFloat(cfg.gst_percentage || 0);
  const base = cfg.gst_applies_on === 'product_only' ? subtotal : subtotal + feesTotal;
  return Math.round((base * pct) / 100);
}

function applyCoupon(coupon, subtotal, preTaxTotal) {
  if (!coupon || !coupon.is_active) return { discount: 0, error: null };

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

function calcPlatformDiscount(config, preTaxTotal) {
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...config };
  if (!cfg.platform_discount_enabled) return 0;

  if (cfg.platform_discount_type === 'flat') {
    return Math.min(parseFloat(cfg.platform_discount_value || 0), preTaxTotal);
  }
  return Math.round((preTaxTotal * parseFloat(cfg.platform_discount_value || 0)) / 100);
}

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
  const cfg = { ...DEFAULT_PRICING_CONFIG, ...pricingConfig };

  const platformFee    = calcPlatformFee(items, cfg);
  const handlingFee    = calcHandlingFee(subtotal, cfg);
  const packagingFee   = calcPackagingFee(cfg, subtotal);
  const deliveryFee    = calcDeliveryFee(subtotal, distanceKm, appSettings, isSelfPickup);
  const surgeFee       = calcSurgeFee(appSettings, cfg, isSelfPickup);

  const effectiveTip        = isSelfPickup ? 0 : (deliveryTip || 0);
  const effectiveLateNight  = isSelfPickup ? 0 : (lateNightFee || 0);
  const effectiveExtraStore = isSelfPickup ? 0 : (extraStoreCharge || 0);

  const feesTotal = platformFee + handlingFee + packagingFee + deliveryFee +
                    surgeFee + effectiveLateNight + effectiveTip + effectiveExtraStore;

  const gstAmount = calcGST(subtotal, feesTotal, cfg);

  const preTaxTotal = subtotal + feesTotal;
  const { discount: couponDiscount } = applyCoupon(coupon, subtotal, preTaxTotal);
  const platformDiscount = calcPlatformDiscount(cfg, preTaxTotal - couponDiscount);

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
  DEFAULT_PRICING_CONFIG,
};
