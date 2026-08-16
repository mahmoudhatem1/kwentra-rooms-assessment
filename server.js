'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  getRooms, getRoomById,
  getReservations, getReservationById,
  addReservation, updateReservation,
  resetReservations, hasConflict,
} = require('./src/data');
const {
  calculatePricing, calculateCancellationFee, GROUP_MIN_ROOMS,
} = require('./src/pricing');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ─── HTML helpers ──────────────────────────────────────────────────────────────

function typeBadge(type) {
  const cls = { Standard: 'badge-standard', Deluxe: 'badge-deluxe', Suite: 'badge-suite' }[type] || '';
  return `<span class="badge ${cls}">${type}</span>`;
}

function statusBadge(status) {
  const cls = {
    confirmed:   'badge-confirmed',
    cancelled:   'badge-cancelled',
    'checked-in':  'badge-checked-in',
    'checked-out': 'badge-checked-out',
  }[status] || '';
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
  return `<span class="badge ${cls}" data-cy="res-status">${label}</span>`;
}

function layout(title, body, flash = null) {
  const flashHtml = flash
    ? `<div class="flash flash-${flash.type}" data-cy="flash-message" role="alert">${flash.message}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Kwentra Rooms</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand">Kwentra <span>Rooms</span></a>
    <div class="nav-links">
      <a href="/"              data-cy="nav-home">Rooms</a>
      <a href="/reservations"  data-cy="nav-reservations">Reservations</a>
      <a href="/pricing"       data-cy="nav-pricing">Pricing</a>
      <a href="/admin"         data-cy="nav-admin">Admin</a>
    </div>
  </nav>
  <main>
    ${flashHtml}
    ${body}
  </main>
  <script src="/app.js"></script>
</body>
</html>`;
}

function getFlash(req) {
  const { flash, flashType } = req.query;
  return flash ? { message: decodeURIComponent(flash), type: flashType || 'info' } : null;
}

// ─── Home page ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const { checkIn, checkOut } = req.query;
  const rooms = getRooms();

  const filterBar = `
    <form class="filter-bar" method="get" action="/" data-cy="availability-filter">
      <label>Check-in
        <input type="date" name="checkIn"  value="${checkIn  || ''}" data-cy="filter-checkin"  required>
      </label>
      <label>Check-out
        <input type="date" name="checkOut" value="${checkOut || ''}" data-cy="filter-checkout" required>
      </label>
      <button type="submit" class="btn btn-primary" data-cy="filter-btn">Check Availability</button>
      ${checkIn ? `<a href="/" class="btn btn-secondary" data-cy="clear-filter-btn">Clear</a>` : ''}
    </form>`;

  const cards = rooms.map(room => {
    let availBadge = '';
    if (checkIn && checkOut) {
      const conflict = hasConflict(room.id, checkIn, checkOut);
      availBadge = conflict
        ? `<span class="badge badge-unavailable" data-cy="room-availability-${room.id}">Unavailable</span>`
        : `<span class="badge badge-available"   data-cy="room-availability-${room.id}">Available</span>`;
    }

    const bookHref = checkIn && checkOut
      ? `/reservations/new?room=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      : `/reservations/new?room=${room.id}`;

    const minStayNote = room.minNights > 1
      ? `<span style="font-size:.78rem;color:#9a3412;">Min ${room.minNights} nights</span>`
      : '';

    return `
      <div class="card" data-cy="room-card" data-cy-room="${room.id}" id="room-card-${room.id}">
        <div class="card-header">
          <h3 data-cy="room-name-${room.id}">${room.name}</h3>
          ${typeBadge(room.type)}
        </div>
        <div class="card-body">
          <p style="color:#6b7280;font-size:.85rem;margin-bottom:.75rem">${room.description}</p>
          <div class="meta-row">
            <span data-cy="room-max-guests-${room.id}">👥 Max ${room.maxGuests} guests</span>
            ${minStayNote}
          </div>
          <div class="amenity-list">
            ${room.amenities.map(a => `<span class="amenity">${a}</span>`).join('')}
          </div>
        </div>
        <div class="card-footer">
          <div>
            <span class="room-rate" data-cy="room-rate-${room.id}">$${room.baseRate}<span>/night</span></span>
            ${availBadge}
          </div>
          <a href="${bookHref}" class="btn btn-primary btn-sm" data-cy="book-btn-${room.id}">Book Now</a>
        </div>
      </div>`;
  }).join('');

  res.send(layout('Rooms', `
    <h1>Available Rooms</h1>
    ${filterBar}
    <div class="cards" data-cy="rooms-grid">${cards}</div>
  `));
});

// ─── New reservation form ──────────────────────────────────────────────────────
app.get('/reservations/new', (req, res) => {
  const { room: preRoom, checkIn: preCheckIn, checkOut: preCheckOut } = req.query;
  const rooms = getRooms();

  const roomOptions = rooms.map(r =>
    `<option value="${r.id}" ${preRoom === r.id ? 'selected' : ''}>${r.name} (${r.type} – $${r.baseRate}/night)</option>`
  ).join('');

  res.send(layout('New Reservation', `
    <h1>New Reservation</h1>
    <div class="form-card">
      <form method="post" action="/reservations" data-cy="booking-form" id="booking-form">
        <div class="form-grid">

          <div class="form-group full">
            <label for="room-select">Room</label>
            <select name="roomId" id="room-select" data-cy="room-select" required>
              <option value="">— select a room —</option>
              ${roomOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="check-in">Check-in date</label>
            <input type="date" name="checkIn" id="check-in" data-cy="check-in"
                   value="${preCheckIn || ''}" required>
          </div>

          <div class="form-group">
            <label for="check-out">Check-out date</label>
            <input type="date" name="checkOut" id="check-out" data-cy="check-out"
                   value="${preCheckOut || ''}" required>
          </div>

          <div class="form-group">
            <label for="guest-name">Guest name</label>
            <input type="text" name="guestName" id="guest-name" data-cy="guest-name"
                   placeholder="Full name" required>
          </div>

          <div class="form-group">
            <label for="guest-email">Guest email</label>
            <input type="email" name="guestEmail" id="guest-email" data-cy="guest-email"
                   placeholder="guest@email.com" required>
          </div>

          <div class="form-group">
            <label for="guest-count">Number of guests</label>
            <input type="number" name="guestCount" id="guest-count" data-cy="guest-count"
                   min="1" max="10" value="1" required>
          </div>

          <div class="form-group">
            <label for="promo-code">Promo code <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
            <input type="text" name="promoCode" id="promo-code" data-cy="promo-code"
                   placeholder="e.g. WELCOME10">
            <span class="field-hint">WELCOME10 · SUMMER20 (3+ nights)</span>
          </div>

          <div class="form-group" style="justify-content:flex-end">
            <label style="flex-direction:row;align-items:center;gap:.5rem;cursor:pointer">
              <input type="checkbox" name="groupBooking" id="group-booking" data-cy="group-booking" value="true">
              Group booking (15% off for 3+ rooms)
            </label>
          </div>

        </div>

        <div style="margin-top:1.25rem;display:flex;gap:.75rem;align-items:center">
          <button type="button" id="preview-btn" class="btn btn-secondary" data-cy="preview-btn">
            Preview Price
          </button>
          <button type="submit" class="btn btn-primary" data-cy="submit-btn">
            Confirm Booking
          </button>
        </div>

        <div id="price-preview-box" data-cy="price-preview-box"></div>
      </form>
    </div>
  `));
});

// ─── Create reservation ────────────────────────────────────────────────────────
app.post('/reservations', (req, res) => {
  const { roomId, checkIn, checkOut, guestName, guestEmail, guestCount, promoCode, groupBooking } = req.body;

  const room = getRoomById(roomId);
  if (!room) return res.redirect('/reservations/new?flash=' + encodeURIComponent('Invalid room selected') + '&flashType=error');

  const guests = parseInt(guestCount, 10);
  const errors = [];

  // Validation
  if (!checkIn || !checkOut)            errors.push('Check-in and check-out dates are required');
  if (checkIn >= checkOut)              errors.push('Check-out must be after check-in');
  if (isNaN(guests) || guests < 1)      errors.push('Guest count must be at least 1');
  if (guests > room.maxGuests)          errors.push(`Room ${room.name} holds a maximum of ${room.maxGuests} guest${room.maxGuests > 1 ? 's' : ''}`);

  const { calculatePricing: cp, GROUP_MIN_ROOMS: gmr } = require('./src/pricing');
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);

  if (nights < room.minNights)          errors.push(`${room.type} rooms require a minimum stay of ${room.minNights} nights`);
  if (hasConflict(roomId, checkIn, checkOut)) errors.push(`Room ${room.name} is not available for the selected dates`);

  if (errors.length) {
    const msg = errors.join(' · ');
    return res.redirect(`/reservations/new?room=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&flash=${encodeURIComponent(msg)}&flashType=error`);
  }

  const isGroup = groupBooking === 'true' || groupBooking === true;
  const pricing = calculatePricing({ room, checkIn, checkOut, promoCode: promoCode || '', groupBooking: isGroup });

  if (pricing.promoError) {
    return res.redirect(`/reservations/new?room=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&flash=${encodeURIComponent(pricing.promoError)}&flashType=error`);
  }

  const reservation = addReservation({
    id:         'RES-' + uuidv4().slice(0, 8).toUpperCase(),
    roomId,
    guestName:  guestName.trim(),
    guestEmail: guestEmail.trim(),
    guestCount: guests,
    checkIn,
    checkOut,
    promoCode:  pricing.promoCode,
    groupBooking: isGroup,
    status:     'confirmed',
    createdAt:  new Date().toISOString(),
    pricing,
  });

  res.redirect(`/reservations/${reservation.id}?flash=${encodeURIComponent('Reservation confirmed!')}&flashType=success`);
});

// ─── Reservations list ─────────────────────────────────────────────────────────
app.get('/reservations', (req, res) => {
  const { status = 'all', guest = '' } = req.query;
  let list = getReservations();

  if (status !== 'all')  list = list.filter(r => r.status === status);
  if (guest.trim())      list = list.filter(r => r.guestName.toLowerCase().includes(guest.trim().toLowerCase()));

  const rows = list.length
    ? list.map(r => {
        const room = getRoomById(r.roomId);
        return `
          <tr data-cy="reservation-row" data-res-id="${r.id}">
            <td data-cy="res-id">${r.id}</td>
            <td data-cy="res-guest">${r.guestName}</td>
            <td data-cy="res-room">${room ? room.name : r.roomId}</td>
            <td data-cy="res-dates">${r.checkIn} → ${r.checkOut}</td>
            <td data-cy="res-nights">${r.pricing.nights}</td>
            <td data-cy="res-total">$${r.pricing.grandTotal.toFixed(2)}</td>
            <td>${statusBadge(r.status)}</td>
            <td><a href="/reservations/${r.id}" class="btn btn-secondary btn-sm" data-cy="view-btn">View</a></td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="empty-state" data-cy="empty-state">No reservations found.</td></tr>`;

  res.send(layout('Reservations', `
    <h1>Reservations</h1>
    <form class="filter-bar" method="get" action="/reservations" data-cy="reservations-filter">
      <label>Guest name
        <input type="text" name="guest" value="${guest}" placeholder="Search…" data-cy="search-guest">
      </label>
      <label>Status
        <select name="status" data-cy="status-filter">
          ${['all','confirmed','cancelled','checked-in','checked-out'].map(s =>
            `<option value="${s}" ${status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
          ).join('')}
        </select>
      </label>
      <button type="submit" class="btn btn-primary" data-cy="apply-filter-btn">Filter</button>
      <a href="/reservations" class="btn btn-secondary">Reset</a>
      <a href="/reservations/new" class="btn btn-primary" style="margin-left:auto" data-cy="new-reservation-btn">+ New</a>
    </form>
    <div class="table-wrap">
      <table data-cy="reservations-table">
        <thead>
          <tr>
            <th>ID</th><th>Guest</th><th>Room</th><th>Dates</th>
            <th>Nights</th><th>Total</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="margin-top:.75rem;font-size:.82rem;color:#9ca3af" data-cy="results-count">
      Showing ${list.length} reservation${list.length !== 1 ? 's' : ''}
    </p>
  `, getFlash(req)));
});

// ─── Reservation detail ────────────────────────────────────────────────────────
app.get('/reservations/:id', (req, res) => {
  const reservation = getReservationById(req.params.id);
  if (!reservation) return res.status(404).send(layout('Not Found', '<p class="flash flash-error">Reservation not found.</p>'));

  const room = getRoomById(reservation.roomId);
  const now  = req.headers['x-current-time'] || new Date().toISOString();
  const cancel = calculateCancellationFee({ reservation, now });
  const p = reservation.pricing;

  const promoRow = p.promoDiscount > 0
    ? `<div class="price-row"><span class="label">${p.promoLabel}</span><span class="value" data-cy="pricing-promo-discount">-$${p.promoDiscount.toFixed(2)}</span></div>`
    : '';
  const groupRow = p.groupDiscount > 0
    ? `<div class="price-row"><span class="label">Group discount (15%)</span><span class="value" data-cy="pricing-group-discount">-$${p.groupDiscount.toFixed(2)}</span></div>`
    : '';
  const weekendRow = p.weekendSurcharge > 0
    ? `<div class="price-row"><span class="label">Weekend surcharge (${p.weekendNights} night${p.weekendNights > 1 ? 's' : ''})</span><span class="value" data-cy="pricing-weekend-surcharge">+$${p.weekendSurcharge.toFixed(2)}</span></div>`
    : '';

  // Action buttons depending on state
  let actions = '';
  if (reservation.status === 'confirmed') {
    actions = `
      <button id="cancel-btn" class="btn btn-danger" data-cy="cancel-btn">Cancel Reservation</button>
      <form method="post" action="/reservations/${reservation.id}/checkin" style="display:inline">
        <button type="submit" class="btn btn-success" data-cy="checkin-btn">Check In</button>
      </form>`;
  } else if (reservation.status === 'checked-in') {
    actions = `
      <form method="post" action="/reservations/${reservation.id}/checkout" style="display:inline">
        <button type="submit" class="btn btn-primary" data-cy="checkout-btn">Check Out</button>
      </form>`;
  }

  // Cancel confirmation panel
  let cancelPanel = '';
  if (reservation.status === 'confirmed' && cancel.eligible) {
    const feeDisplay = cancel.fee === 0
      ? `<span class="fee-highlight" data-cy="cancellation-fee">$0.00</span> — no charge`
      : `<span class="fee-highlight" data-cy="cancellation-fee">$${cancel.fee.toFixed(2)}</span> will be charged`;

    cancelPanel = `
      <div id="cancel-confirm-section" class="cancel-confirm hidden" data-cy="cancel-confirm-section">
        <h3>Confirm Cancellation</h3>
        <p data-cy="cancellation-policy">${cancel.policy}</p>
        <p style="margin-top:.5rem">${feeDisplay}</p>
        <div class="cancel-actions">
          <form method="post" action="/reservations/${reservation.id}/cancel">
            <button type="submit" class="btn btn-danger" data-cy="confirm-cancel-btn">Yes, Cancel</button>
          </form>
          <button type="button" id="abort-cancel-btn" class="btn btn-secondary" data-cy="abort-cancel-btn">Keep Reservation</button>
        </div>
      </div>`;
  }

  res.send(layout(`Reservation ${reservation.id}`, `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <h1 style="margin:0" data-cy="res-id-heading">${reservation.id}</h1>
      ${statusBadge(reservation.status)}
      <a href="/reservations" style="margin-left:auto;font-size:.85rem;color:#3b5bdb">← All Reservations</a>
    </div>

    <div class="detail-grid">
      <div class="detail-section">
        <h2>Guest</h2>
        <div class="detail-row"><span class="dk">Name</span>    <span class="dv" data-cy="guest-name">${reservation.guestName}</span></div>
        <div class="detail-row"><span class="dk">Email</span>   <span class="dv" data-cy="guest-email">${reservation.guestEmail}</span></div>
        <div class="detail-row"><span class="dk">Guests</span>  <span class="dv" data-cy="guest-count">${reservation.guestCount}</span></div>
      </div>

      <div class="detail-section">
        <h2>Stay</h2>
        <div class="detail-row"><span class="dk">Room</span>      <span class="dv" data-cy="room-name">${room ? room.name : reservation.roomId}</span></div>
        <div class="detail-row"><span class="dk">Type</span>      <span class="dv" data-cy="room-type">${room ? room.type : '—'}</span></div>
        <div class="detail-row"><span class="dk">Check-in</span>  <span class="dv" data-cy="check-in-date">${reservation.checkIn}</span></div>
        <div class="detail-row"><span class="dk">Check-out</span> <span class="dv" data-cy="check-out-date">${reservation.checkOut}</span></div>
        <div class="detail-row"><span class="dk">Nights</span>    <span class="dv" data-cy="nights-count">${p.nights}</span></div>
        ${reservation.promoCode ? `<div class="detail-row"><span class="dk">Promo</span><span class="dv" data-cy="applied-promo">${reservation.promoCode}</span></div>` : ''}
      </div>
    </div>

    <div class="detail-section" style="margin-bottom:1.5rem" data-cy="pricing-section">
      <h2>Pricing</h2>
      <div class="price-row"><span class="label">${p.nights} night${p.nights > 1 ? 's' : ''} × $${(p.baseTotal / p.nights).toFixed(2)}</span>
        <span class="value" data-cy="pricing-base-total">$${p.baseTotal.toFixed(2)}</span></div>
      ${weekendRow}
      ${promoRow}
      ${groupRow}
      <div class="price-row divider"><span class="label">Room subtotal</span>
        <span class="value" data-cy="pricing-room-subtotal">$${p.roomSubtotal.toFixed(2)}</span></div>
      <div class="price-row"><span class="label">VAT (10%)</span>
        <span class="value" data-cy="pricing-vat">$${p.vat.toFixed(2)}</span></div>
      <div class="price-row"><span class="label">City tax (5%)</span>
        <span class="value" data-cy="pricing-city-tax">$${p.cityTax.toFixed(2)}</span></div>
      <div class="price-row divider total"><span class="label">Grand total</span>
        <span class="value" data-cy="grand-total">$${p.grandTotal.toFixed(2)}</span></div>
    </div>

    <div style="display:flex;gap:.75rem;flex-wrap:wrap">
      ${actions}
    </div>
    ${cancelPanel}
  `, getFlash(req)));
});

// ─── Cancel ────────────────────────────────────────────────────────────────────
app.post('/reservations/:id/cancel', (req, res) => {
  const reservation = getReservationById(req.params.id);
  if (!reservation) return res.redirect('/reservations?flash=Reservation+not+found&flashType=error');

  if (reservation.status !== 'confirmed') {
    const msg = encodeURIComponent(`Cannot cancel a reservation with status "${reservation.status}"`);
    return res.redirect(`/reservations/${reservation.id}?flash=${msg}&flashType=error`);
  }

  const now = req.headers['x-current-time'] || new Date().toISOString();
  const cancel = calculateCancellationFee({ reservation, now });
  if (!cancel.eligible) {
    return res.redirect(`/reservations/${reservation.id}?flash=${encodeURIComponent(cancel.policy)}&flashType=error`);
  }

  updateReservation(reservation.id, { status: 'cancelled', cancelledAt: now, cancellationFee: cancel.fee });
  const msg = cancel.fee > 0
    ? `Reservation cancelled. Cancellation fee: $${cancel.fee.toFixed(2)}`
    : 'Reservation cancelled. No charge.';
  res.redirect(`/reservations/${reservation.id}?flash=${encodeURIComponent(msg)}&flashType=success`);
});

// ─── Check-in ──────────────────────────────────────────────────────────────────
app.post('/reservations/:id/checkin', (req, res) => {
  const reservation = getReservationById(req.params.id);
  if (!reservation) return res.redirect('/reservations?flash=Reservation+not+found&flashType=error');

  if (reservation.status !== 'confirmed') {
    const msg = encodeURIComponent(`Cannot check in a reservation with status "${reservation.status}"`);
    return res.redirect(`/reservations/${reservation.id}?flash=${msg}&flashType=error`);
  }

  updateReservation(reservation.id, { status: 'checked-in', checkedInAt: new Date().toISOString() });
  res.redirect(`/reservations/${reservation.id}?flash=${encodeURIComponent('Guest checked in successfully')}&flashType=success`);
});

// ─── Check-out ─────────────────────────────────────────────────────────────────
app.post('/reservations/:id/checkout', (req, res) => {
  const reservation = getReservationById(req.params.id);
  if (!reservation) return res.redirect('/reservations?flash=Reservation+not+found&flashType=error');

  if (reservation.status !== 'checked-in') {
    const msg = encodeURIComponent(`Cannot check out a reservation with status "${reservation.status}"`);
    return res.redirect(`/reservations/${reservation.id}?flash=${msg}&flashType=error`);
  }

  updateReservation(reservation.id, { status: 'checked-out', checkedOutAt: new Date().toISOString() });
  res.redirect(`/reservations/${reservation.id}?flash=${encodeURIComponent('Guest checked out. Thank you!')}&flashType=success`);
});

// ─── Pricing calculator page ───────────────────────────────────────────────────
app.get('/pricing', (req, res) => {
  const rooms = getRooms();
  const roomOptions = rooms.map(r =>
    `<option value="${r.id}">${r.name} (${r.type} – $${r.baseRate}/night)</option>`
  ).join('');

  res.send(layout('Pricing Calculator', `
    <h1>Pricing Calculator</h1>
    <div class="form-card">
      <div class="form-grid">
        <div class="form-group full">
          <label for="calc-room">Room</label>
          <select id="calc-room" data-cy="calc-room">
            <option value="">— select a room —</option>
            ${roomOptions}
          </select>
        </div>
        <div class="form-group">
          <label for="calc-checkin">Check-in</label>
          <input type="date" id="calc-checkin" data-cy="calc-checkin">
        </div>
        <div class="form-group">
          <label for="calc-checkout">Check-out</label>
          <input type="date" id="calc-checkout" data-cy="calc-checkout">
        </div>
        <div class="form-group">
          <label for="calc-promo">Promo code</label>
          <input type="text" id="calc-promo" data-cy="calc-promo" placeholder="e.g. WELCOME10">
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label style="flex-direction:row;align-items:center;gap:.5rem;cursor:pointer">
            <input type="checkbox" id="calc-group" data-cy="calc-group">
            Group booking (15% off)
          </label>
        </div>
      </div>
      <div style="margin-top:1.25rem">
        <button id="calc-btn" class="btn btn-primary" data-cy="calc-btn">Calculate</button>
      </div>
      <div id="calc-result" data-cy="calc-result"></div>
    </div>
  `));
});

// ─── Admin page ────────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  const all = getReservations();
  const counts = {
    total:      all.length,
    confirmed:  all.filter(r => r.status === 'confirmed').length,
    cancelled:  all.filter(r => r.status === 'cancelled').length,
    checkedIn:  all.filter(r => r.status === 'checked-in').length,
    checkedOut: all.filter(r => r.status === 'checked-out').length,
  };

  res.send(layout('Admin', `
    <h1>Admin Panel</h1>
    <div class="stat-grid">
      <div class="stat-card"><div class="num" data-cy="stat-total">${counts.total}</div><div class="lbl">Total</div></div>
      <div class="stat-card"><div class="num" data-cy="stat-confirmed">${counts.confirmed}</div><div class="lbl">Confirmed</div></div>
      <div class="stat-card"><div class="num" data-cy="stat-cancelled">${counts.cancelled}</div><div class="lbl">Cancelled</div></div>
      <div class="stat-card"><div class="num" data-cy="stat-checked-in">${counts.checkedIn}</div><div class="lbl">Checked In</div></div>
    </div>
    <form method="post" action="/admin/reset" onsubmit="return confirm('Reset all reservations?')">
      <button type="submit" class="btn btn-danger" data-cy="reset-btn">Reset All Reservations</button>
    </form>
    <p style="margin-top:.75rem;font-size:.82rem;color:#9ca3af">
      This clears all reservations. Rooms are not affected.
    </p>
  `, getFlash(req)));
});

app.post('/admin/reset', (req, res) => {
  resetReservations();
  res.redirect('/admin?flash=All+reservations+cleared&flashType=success');
});

// ═══════════════════════════════════════════════════════════════════════════════
// REST API  (used by Cypress for seeding and assertions)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/rooms', (req, res) => {
  res.json(getRooms());
});

app.get('/api/rooms/:id', (req, res) => {
  const room = getRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.post('/api/pricing/calculate', (req, res) => {
  const { roomId, checkIn, checkOut, promoCode = '', groupBooking = false } = req.body;
  const room = getRoomById(roomId);
  if (!room) return res.status(400).json({ error: 'Unknown room ID' });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (isNaN(nights) || nights < 1) return res.status(400).json({ error: 'Invalid date range' });

  const result = require('./src/pricing').calculatePricing({ room, checkIn, checkOut, promoCode, groupBooking });
  res.json(result);
});

app.get('/api/reservations', (req, res) => {
  const { status, guest } = req.query;
  let list = getReservations();
  if (status) list = list.filter(r => r.status === status);
  if (guest)  list = list.filter(r => r.guestName.toLowerCase().includes(guest.toLowerCase()));
  res.json(list);
});

app.get('/api/reservations/:id', (req, res) => {
  const r = getReservationById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

// Seed endpoint — lets Cypress create reservations with a controlled createdAt timestamp
app.post('/api/reservations', (req, res) => {
  const { roomId, checkIn, checkOut, guestName, guestEmail, guestCount = 1,
          promoCode = '', groupBooking = false, createdAt } = req.body;

  const room = getRoomById(roomId);
  if (!room) return res.status(400).json({ error: 'Unknown room ID' });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (nights < 1) return res.status(400).json({ error: 'Invalid dates' });
  if (parseInt(guestCount) > room.maxGuests) return res.status(400).json({ error: `Max guests for this room is ${room.maxGuests}` });
  if (nights < room.minNights) return res.status(400).json({ error: `Min stay for ${room.type} is ${room.minNights} nights` });
  if (hasConflict(roomId, checkIn, checkOut)) return res.status(409).json({ error: 'Dates not available' });

  const pricing = require('./src/pricing').calculatePricing({ room, checkIn, checkOut, promoCode, groupBooking });
  if (pricing.promoError) return res.status(400).json({ error: pricing.promoError });

  const reservation = addReservation({
    id:          'RES-' + uuidv4().slice(0, 8).toUpperCase(),
    roomId, checkIn, checkOut,
    guestName:   (guestName || 'Test Guest').trim(),
    guestEmail:  (guestEmail || 'test@example.com').trim(),
    guestCount:  parseInt(guestCount),
    promoCode:   pricing.promoCode,
    groupBooking,
    status:      'confirmed',
    createdAt:   createdAt || new Date().toISOString(),
    pricing,
  });

  res.status(201).json(reservation);
});

app.post('/api/reservations/:id/cancel', (req, res) => {
  const reservation = getReservationById(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  if (reservation.status !== 'confirmed') return res.status(409).json({ error: `Cannot cancel status "${reservation.status}"` });

  const now = req.headers['x-current-time'] || new Date().toISOString();
  const cancel = calculateCancellationFee({ reservation, now });
  if (!cancel.eligible) return res.status(409).json({ error: cancel.policy });

  const updated = updateReservation(reservation.id, { status: 'cancelled', cancelledAt: now, cancellationFee: cancel.fee });
  res.json({ reservation: updated, cancellationFee: cancel.fee, policy: cancel.policy });
});

app.post('/api/admin/reset', (req, res) => {
  resetReservations();
  res.json({ ok: true, message: 'All reservations cleared' });
});

app.get('/api/stats', (req, res) => {
  const all = getReservations();
  res.json({
    total:      all.length,
    confirmed:  all.filter(r => r.status === 'confirmed').length,
    cancelled:  all.filter(r => r.status === 'cancelled').length,
    checkedIn:  all.filter(r => r.status === 'checked-in').length,
    checkedOut: all.filter(r => r.status === 'checked-out').length,
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Kwentra Rooms is running → http://localhost:${PORT}\n`);
});
