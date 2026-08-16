'use strict';

// ─── Rates & constants ────────────────────────────────────────────────────────
const WEEKEND_SURCHARGE   = 0.30;   // +30% on Friday & Saturday nights
const VAT_RATE            = 0.10;   // 10% VAT applied to discounted room total
const CITY_TAX_RATE       = 0.05;   // 5% city tax applied to discounted room total
const GROUP_DISCOUNT_RATE = 0.15;   // 15% off when 3+ rooms share overlapping dates
const GROUP_MIN_ROOMS     = 3;

const PROMO_CODES = {
  WELCOME10: { label: 'Welcome Discount (10%)',   rate: 0.10, minNights: 1 },
  SUMMER20:  { label: 'Summer Special (20%)',     rate: 0.20, minNights: 3 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n) { return Math.round(n * 100) / 100; }

// Is the date string (YYYY-MM-DD) a weekend night?
function isWeekendNight(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return dow === 0 || dow === 6;
}

function getNights(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

// Returns an array of YYYY-MM-DD strings for each night (checkIn up to but not including checkOut)
function getNightDates(checkIn, checkOut) {
  const dates = [];
  const cur = new Date(checkIn + 'T00:00:00Z');
  const end = new Date(checkOut + 'T00:00:00Z');
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ─── Main pricing calculator ──────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {{ baseRate: number }} params.room
 * @param {string} params.checkIn  YYYY-MM-DD
 * @param {string} params.checkOut YYYY-MM-DD
 * @param {string} [params.promoCode]
 * @param {boolean} [params.groupBooking]
 * @returns {PricingResult}
 */
function calculatePricing({ room, checkIn, checkOut, promoCode = '', groupBooking = false }) {
  const nights = getNights(checkIn, checkOut);
  const nightDates = getNightDates(checkIn, checkOut);

  let baseTotal = 0;
  let weekendSurcharge = 0;
  let weekendNights = 0;

  for (const d of nightDates) {
    baseTotal += room.baseRate;
    if (isWeekendNight(d)) {
      weekendNights++;
      weekendSurcharge += room.baseRate * WEEKEND_SURCHARGE;
    }
  }
  baseTotal = r2(baseTotal);
  weekendSurcharge = r2(weekendSurcharge);

  let subtotal = r2(baseTotal + weekendSurcharge);
  let promoDiscount = 0;
  let promoLabel = null;
  let promoError = null;

  if (promoCode) {
    const key = promoCode.trim().toUpperCase();
    const promo = PROMO_CODES[key];
    if (!promo) {
      promoError = `Invalid promo code "${promoCode}"`;
    } else if (nights < promo.minNights) {
      promoError = `Code ${key} requires a minimum stay of ${promo.minNights} night${promo.minNights > 1 ? 's' : ''}`;
    } else {
      promoDiscount = r2(subtotal * promo.rate);
      promoLabel = promo.label;
    }
  }

  subtotal = r2(subtotal - promoDiscount);

  let groupDiscount = 0;
  if (groupBooking) {
    groupDiscount = r2(subtotal * GROUP_DISCOUNT_RATE);
    subtotal = r2(subtotal - groupDiscount);
  }

  const taxBase  = r2(baseTotal + weekendSurcharge);
  const vat      = r2(taxBase * VAT_RATE);
  const cityTax  = r2(taxBase * CITY_TAX_RATE);
  const grandTotal = r2(subtotal + vat + cityTax);

  return {
    nights, weekendNights,
    baseTotal, weekendSurcharge,
    promoCode: promoCode ? promoCode.trim().toUpperCase() : '',
    promoLabel, promoDiscount, promoError,
    groupDiscount,
    roomSubtotal: subtotal,
    vat, cityTax, grandTotal,
  };
}

// ─── Cancellation fee calculator ──────────────────────────────────────────────

/**
 * @param {object} params
 * @param {object} params.reservation  Full reservation object
 * @param {string} [params.now]        ISO timestamp to use as "current time" (for testing)
 * @returns {{ fee: number|null, policy: string, eligible: boolean }}
 */
function calculateCancellationFee({ reservation, now }) {
  const currentTime   = now ? new Date(now) : new Date();
  const checkInTime   = new Date(reservation.checkIn  + 'T14:00:00Z'); // 2 PM check-in
  const createdAt     = new Date(reservation.createdAt);

  const hoursUntilCheckIn  = (checkInTime  - currentTime) / 3600000;
  const hoursSinceBooking  = (currentTime  - createdAt)   / 3600000;

  if (hoursUntilCheckIn <= 0) {
    return { fee: null, policy: 'Cannot cancel — guest has already arrived', eligible: false };
  }

  // Free grace window: booked within last 24 h AND check-in is still >72 h away
  if (hoursSinceBooking <= 24 && hoursUntilCheckIn > 72) {
    return { fee: 0, policy: 'Free cancellation (booked within 24 h, check-in >72 h away)', eligible: true };
  }

  const firstNightRate = r2(reservation.pricing.baseTotal / reservation.pricing.nights);

  if (hoursUntilCheckIn > 72) {
    return { fee: 0,                       policy: 'Free cancellation (>72 h before check-in)',        eligible: true };
  } else if (hoursUntilCheckIn > 24) {
    return { fee: r2(firstNightRate * 0.5), policy: '50% of first-night rate (24–72 h before check-in)', eligible: true };
  } else {
    return { fee: firstNightRate,           policy: 'Full first-night rate (<24 h before check-in)',     eligible: true };
  }
}

module.exports = {
  calculatePricing, calculateCancellationFee,
  PROMO_CODES, GROUP_MIN_ROOMS,
  WEEKEND_SURCHARGE, VAT_RATE, CITY_TAX_RATE, GROUP_DISCOUNT_RATE,
};
