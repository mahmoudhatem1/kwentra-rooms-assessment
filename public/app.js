/* Client-side JS for live price preview on booking form and pricing calculator */
'use strict';

async function fetchPricing(params) {
  const res = await fetch('/api/pricing/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

function fmt(n) {
  return '$' + Number(n).toFixed(2);
}

function renderPricing(data, container) {
  if (data.error) {
    container.innerHTML = `<p class="flash flash-error">${data.error}</p>`;
    return;
  }

  const promoRow = data.promoDiscount > 0
    ? `<div class="price-row"><span class="label">${data.promoLabel}</span><span class="value" data-cy="preview-promo-discount">-${fmt(data.promoDiscount)}</span></div>`
    : '';

  const groupRow = data.groupDiscount > 0
    ? `<div class="price-row"><span class="label">Group discount (15%)</span><span class="value" data-cy="preview-group-discount">-${fmt(data.groupDiscount)}</span></div>`
    : '';

  const weekendRow = data.weekendSurcharge > 0
    ? `<div class="price-row"><span class="label">Weekend surcharge (${data.weekendNights} night${data.weekendNights > 1 ? 's' : ''} × 30%)</span><span class="value" data-cy="preview-weekend-surcharge">+${fmt(data.weekendSurcharge)}</span></div>`
    : '';

  const promoErr = data.promoError
    ? `<p class="promo-err" data-cy="promo-error">${data.promoError}</p>`
    : '';

  container.innerHTML = `
    <div class="price-preview">
      <h3>Price Breakdown</h3>
      <div class="price-row">
        <span class="label" data-cy="preview-nights">${data.nights} night${data.nights !== 1 ? 's' : ''} × ${fmt(data.baseTotal / data.nights)}</span>
        <span class="value" data-cy="preview-base-total">${fmt(data.baseTotal)}</span>
      </div>
      ${weekendRow}
      ${promoRow}
      ${groupRow}
      <div class="price-row divider">
        <span class="label">Room subtotal</span>
        <span class="value" data-cy="preview-room-subtotal">${fmt(data.roomSubtotal)}</span>
      </div>
      <div class="price-row">
        <span class="label">VAT (10%)</span>
        <span class="value" data-cy="preview-vat">${fmt(data.vat)}</span>
      </div>
      <div class="price-row">
        <span class="label">City tax (5%)</span>
        <span class="value" data-cy="preview-city-tax">${fmt(data.cityTax)}</span>
      </div>
      <div class="price-row divider total">
        <span class="label">Grand total</span>
        <span class="value" data-cy="preview-grand-total">${fmt(data.grandTotal)}</span>
      </div>
      ${promoErr}
    </div>`;
}

// ── Booking form live preview ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const previewBtn = document.getElementById('preview-btn');
  const previewBox = document.getElementById('price-preview-box');
  const calcBtn    = document.getElementById('calc-btn');
  const calcResult = document.getElementById('calc-result');

  if (previewBtn && previewBox) {
    previewBtn.addEventListener('click', async () => {
      const roomId     = document.getElementById('room-select').value;
      const checkIn    = document.getElementById('check-in').value;
      const checkOut   = document.getElementById('check-out').value;
      const promoCode  = document.getElementById('promo-code').value;
      const groupBooking = document.getElementById('group-booking').checked;

      if (!roomId || !checkIn || !checkOut) {
        previewBox.innerHTML = '<p class="flash flash-error">Please select a room and dates first.</p>';
        return;
      }

      previewBtn.disabled = true;
      previewBtn.textContent = 'Calculating…';
      const data = await fetchPricing({ roomId, checkIn, checkOut, promoCode, groupBooking });
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview Price';
      renderPricing(data, previewBox);
    });
  }

  // ── Standalone pricing calculator ───────────────────────────────────────────
  if (calcBtn && calcResult) {
    calcBtn.addEventListener('click', async () => {
      const roomId     = document.getElementById('calc-room').value;
      const checkIn    = document.getElementById('calc-checkin').value;
      const checkOut   = document.getElementById('calc-checkout').value;
      const promoCode  = document.getElementById('calc-promo').value;
      const groupBooking = document.getElementById('calc-group').checked;

      if (!roomId || !checkIn || !checkOut) {
        calcResult.innerHTML = '<p class="flash flash-error">Please fill in all fields.</p>';
        return;
      }

      calcBtn.disabled = true;
      calcBtn.textContent = 'Calculating…';
      const data = await fetchPricing({ roomId, checkIn, checkOut, promoCode, groupBooking });
      calcBtn.disabled = false;
      calcBtn.textContent = 'Calculate';
      renderPricing(data, calcResult);
    });
  }

  // ── Cancel confirmation toggle ───────────────────────────────────────────────
  const cancelBtn   = document.getElementById('cancel-btn');
  const cancelPanel = document.getElementById('cancel-confirm-section');
  const abortBtn    = document.getElementById('abort-cancel-btn');

  if (cancelBtn && cancelPanel) {
    cancelBtn.addEventListener('click', () => {
      cancelPanel.classList.remove('hidden');
      cancelBtn.classList.add('hidden');
    });
  }
  if (abortBtn && cancelPanel && cancelBtn) {
    abortBtn.addEventListener('click', () => {
      cancelPanel.classList.add('hidden');
      cancelBtn.classList.remove('hidden');
    });
  }
});
