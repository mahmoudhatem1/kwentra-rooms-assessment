// ─── Custom Cypress commands ───────────────────────────────────────────────────
//
// These commands wrap common multi-step operations so step definitions stay
// readable. Add new commands here and declare their types below.

// ── cy.resetApp() ──────────────────────────────────────────────────────────────
// Clears all reservations via the API. Call in beforeEach.
Cypress.Commands.add('resetApp', () => {
  cy.request('POST', '/api/admin/reset').its('status').should('eq', 200);
});

// ── cy.seedReservation(data) ───────────────────────────────────────────────────
// Creates a reservation via the API (bypasses the UI) and returns the
// full reservation object. Accepts an optional `createdAt` ISO string so
// tests can simulate bookings made at a specific point in time.
//
// Example:
//   cy.seedReservation({ roomId: '101', checkIn: '2026-09-01', checkOut: '2026-09-03',
//                         guestName: 'Jane Doe', createdAt: '2026-08-28T10:00:00Z' })
//     .then(reservation => { ... });
Cypress.Commands.add('seedReservation', (data: SeedReservationData) => {
  return cy.request({
    method: 'POST',
    url:    '/api/reservations',
    body:   data,
    failOnStatusCode: false,
  });
});

// ── cy.bookRoom(data) ──────────────────────────────────────────────────────────
// Fills and submits the booking form through the UI. Returns after the
// browser lands on the reservation detail page.
Cypress.Commands.add('bookRoom', (data: BookRoomData) => {
  cy.visit(`/reservations/new?room=${data.roomId}&checkIn=${data.checkIn}&checkOut=${data.checkOut}`);
  cy.get('[data-cy=guest-name]').type(data.guestName);
  cy.get('[data-cy=guest-email]').type(data.guestEmail);
  cy.get('[data-cy=guest-count]').clear().type(String(data.guestCount ?? 1));
  if (data.promoCode) {
    cy.get('[data-cy=promo-code]').type(data.promoCode);
  }
  if (data.groupBooking) {
    cy.get('[data-cy=group-booking]').check();
  }
  cy.get('[data-cy=submit-btn]').click();
});

// ── cy.cancelReservationViaUI(id) ─────────────────────────────────────────────
// Navigates to the reservation detail page, opens the cancel panel,
// and confirms the cancellation.
Cypress.Commands.add('cancelReservationViaUI', (id: string) => {
  cy.visit(`/reservations/${id}`);
  cy.get('[data-cy=cancel-btn]').click();
  cy.get('[data-cy=cancel-confirm-section]').should('be.visible');
  cy.get('[data-cy=confirm-cancel-btn]').click();
});

// ── cy.cancelReservationViaAPI(id, now?) ───────────────────────────────────────
// Cancels a reservation directly via the API. Pass `now` as an ISO
// timestamp to simulate cancelling at a specific time (uses X-Current-Time header).
Cypress.Commands.add('cancelReservationViaAPI', (id: string, now?: string) => {
  const headers: Record<string, string> = {};
  if (now) headers['X-Current-Time'] = now;
  return cy.request({
    method:  'POST',
    url:     `/api/reservations/${id}/cancel`,
    headers,
    failOnStatusCode: false,
  });
});

// ─── TypeScript declarations ───────────────────────────────────────────────────

interface SeedReservationData {
  roomId:       string;
  checkIn:      string;   // YYYY-MM-DD
  checkOut:     string;   // YYYY-MM-DD
  guestName?:   string;
  guestEmail?:  string;
  guestCount?:  number;
  promoCode?:   string;
  groupBooking?: boolean;
  createdAt?:   string;   // ISO timestamp – overrides server time for this booking
}

interface BookRoomData {
  roomId:       string;
  checkIn:      string;
  checkOut:     string;
  guestName:    string;
  guestEmail:   string;
  guestCount?:  number;
  promoCode?:   string;
  groupBooking?: boolean;
}

declare global {
  namespace Cypress {
    interface Chainable {
      resetApp(): Chainable<void>;
      seedReservation(data: SeedReservationData): Chainable<Cypress.Response<any>>;
      bookRoom(data: BookRoomData): Chainable<void>;
      cancelReservationViaUI(id: string): Chainable<void>;
      cancelReservationViaAPI(id: string, now?: string): Chainable<Cypress.Response<any>>;
    }
  }
}

export {};
