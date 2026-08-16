// ─────────────────────────────────────────────────────────────────────────────
// ReservationDetailPage  ·  PAGE OBJECT TO IMPLEMENT
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the only page object you need to complete.
// The other three (HomePage, BookingFormPage, PricingCalculatorPage) are
// already implemented as reference examples.
//
// This page represents /reservations/:id — the reservation detail view.
// It is the most state-driven page in the app:
//
//   ┌──────────────────────────────────────────────────────────┐
//   │  CONFIRMED   →  shows Cancel + Check In buttons          │
//   │  CHECKED-IN  →  shows Check Out button only              │
//   │  CANCELLED   →  no action buttons                        │
//   │  CHECKED-OUT →  no action buttons                        │
//   └──────────────────────────────────────────────────────────┘
//
// When the tester clicks "Cancel Reservation", a confirmation panel slides in
// showing the cancellation fee and policy. The tester must click "Yes, Cancel"
// to confirm — or "Keep Reservation" to abort.
//
// Available data-cy selectors on this page:
//
//   [data-cy=res-id-heading]       — reservation ID text (e.g. "RES-AB12CD34")
//   [data-cy=res-status]           — status badge text
//   [data-cy=guest-name]           — guest's full name
//   [data-cy=guest-email]          — guest's email
//   [data-cy=guest-count]          — number of guests (numeric string)
//   [data-cy=room-name]            — room name (e.g. "Room 101")
//   [data-cy=room-type]            — room type (e.g. "Standard")
//   [data-cy=check-in-date]        — check-in date string (YYYY-MM-DD)
//   [data-cy=check-out-date]       — check-out date string
//   [data-cy=nights-count]         — number of nights (numeric string)
//   [data-cy=grand-total]          — grand total with $ prefix (e.g. "$276.00")
//   [data-cy=applied-promo]        — promo code applied (only present when used)
//   [data-cy=pricing-base-total]
//   [data-cy=pricing-weekend-surcharge]
//   [data-cy=pricing-promo-discount]
//   [data-cy=pricing-group-discount]
//   [data-cy=pricing-room-subtotal]
//   [data-cy=pricing-vat]
//   [data-cy=pricing-city-tax]
//
//   [data-cy=cancel-btn]           — "Cancel Reservation" button (confirmed only)
//   [data-cy=cancel-confirm-section] — confirmation panel (hidden until cancel-btn clicked)
//   [data-cy=cancellation-policy]  — policy text inside the panel
//   [data-cy=cancellation-fee]     — fee amount inside the panel (e.g. "$60.00")
//   [data-cy=confirm-cancel-btn]   — "Yes, Cancel" inside the panel
//   [data-cy=abort-cancel-btn]     — "Keep Reservation" inside the panel
//   [data-cy=checkin-btn]          — "Check In" button (confirmed only)
//   [data-cy=checkout-btn]         — "Check Out" button (checked-in only)
//   [data-cy=flash-message]        — success/error flash after an action
//
// ─────────────────────────────────────────────────────────────────────────────

export class ReservationDetailPage {
  private static _instance: ReservationDetailPage;
  static get Instance() { return (this._instance ??= new ReservationDetailPage()); }

  visit(id: string) { cy.visit(`/reservations/${id}`); }

  getStatus()            { return cy.get('[data-cy=res-status]'); }
  getGrandTotal()         { return cy.get('[data-cy=grand-total]'); }
  getCancellationFee()    { return cy.get('[data-cy=cancellation-fee]'); }
  getCancellationPolicy() { return cy.get('[data-cy=cancellation-policy]'); }

  // Clicking "Cancel Reservation" only toggles a hidden CSS class client-side
  // (see public/app.js) — no request is fired, so no cy.wait() is needed here.
  openCancelPanel() {
    cy.get('[data-cy=cancel-btn]').click();
    cy.get('[data-cy=cancel-confirm-section]').should('be.visible');
  }

  // "Yes, Cancel" is a real <form method="post"> submit (full page reload via
  // server redirect), not a fetch call. Cypress auto-waits for the resulting
  // page load, so a plain .click() is sufficient — no intercept required here
  // unless the step itself wants to assert on the request (see cancellation.steps.ts).
  confirmCancel() { cy.get('[data-cy=confirm-cancel-btn]').click(); }

  abortCancel() {
    cy.get('[data-cy=abort-cancel-btn]').click();
    cy.get('[data-cy=cancel-confirm-section]').should('not.be.visible');
    cy.get('[data-cy=cancel-btn]').should('be.visible');
  }

  // Also real <form> submits (see server.js /reservations/:id/checkin|checkout) —
  // full page reload on success, Cypress waits for it automatically.
  clickCheckIn()  { cy.get('[data-cy=checkin-btn]').click(); }
  clickCheckOut() { cy.get('[data-cy=checkout-btn]').click(); }

  getFlashMessage() { return cy.get('[data-cy=flash-message]'); }

  // ── Additional helpers ──────────────────────────────────────────────────────
  // Guest / stay details — useful for asserting a booking landed on the right
  // reservation after cy.bookRoom() or after following a redirect.
  getResId()       { return cy.get('[data-cy=res-id-heading]'); }
  getGuestName()    { return cy.get('[data-cy=guest-name]'); }
  getGuestEmail()   { return cy.get('[data-cy=guest-email]'); }
  getGuestCount()   { return cy.get('[data-cy=guest-count]'); }
  getRoomName()     { return cy.get('[data-cy=room-name]'); }
  getRoomType()     { return cy.get('[data-cy=room-type]'); }
  getCheckInDate()  { return cy.get('[data-cy=check-in-date]'); }
  getCheckOutDate() { return cy.get('[data-cy=check-out-date]'); }
  getNightsCount()  { return cy.get('[data-cy=nights-count]'); }
  getAppliedPromo() { return cy.get('[data-cy=applied-promo]'); }

  // Pricing breakdown on the detail page — mirrors BookingFormPage /
  // PricingCalculatorPage getters so the same assertion helpers read
  // naturally regardless of which page rendered the numbers.
  getBaseTotal()        { return cy.get('[data-cy=pricing-base-total]'); }
  getWeekendSurcharge() { return cy.get('[data-cy=pricing-weekend-surcharge]'); }
  getPromoDiscount()    { return cy.get('[data-cy=pricing-promo-discount]'); }
  getGroupDiscount()    { return cy.get('[data-cy=pricing-group-discount]'); }
  getRoomSubtotal()     { return cy.get('[data-cy=pricing-room-subtotal]'); }
  getVat()              { return cy.get('[data-cy=pricing-vat]'); }
  getCityTax()           { return cy.get('[data-cy=pricing-city-tax]'); }

  // The cancel-confirm panel is only rendered server-side when the
  // reservation is still `confirmed` — for checked-in / checked-out /
  // cancelled reservations no cancel-btn exists at all, so tests that
  // exercise the state-machine guards should assert on absence directly
  // rather than calling openCancelPanel().
  getCancelButton() { return cy.get('[data-cy=cancel-btn]'); }
}
