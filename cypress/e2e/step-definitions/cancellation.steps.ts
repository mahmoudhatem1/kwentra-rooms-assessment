import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { ReservationDetailPage } from '../../pages/reservation-detail.page';

const detail = ReservationDetailPage.Instance;

// Shared state within a scenario
let currentReservationId: string;
let interceptedCurrentTime: string;

// ── Background (shared with booking feature) ───────────────────────────────────

Given('the app is in a clean state', () => {
  cy.resetApp();
});

// ── Test data setup ────────────────────────────────────────────────────────────

Given('a confirmed reservation exists for room {string} checking in {string} and checking out {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    cy.seedReservation({ roomId, checkIn, checkOut }).then(response => {
      expect(response.status).to.eq(201);
      currentReservationId = response.body.id;
    });
  });

Given('a confirmed reservation exists for room {string} checking in {string} and checking out {string}, booked at {string}',
  (roomId: string, checkIn: string, checkOut: string, createdAt: string) => {
    cy.seedReservation({ roomId, checkIn, checkOut, createdAt }).then(response => {
      expect(response.status).to.eq(201);
      currentReservationId = response.body.id;
    });
  });

// Checks in the reservation via the UI form (no API endpoint exists for this —
// see the tip in the stub section below) so state-machine guard scenarios can
// set up a "checked-in" reservation before attempting to cancel it.
Given('the reservation has been checked in', () => {
  detail.visit(currentReservationId);
  detail.clickCheckIn();
});

Given('the cancel request will use current time {string}', (now: string) => {
  interceptedCurrentTime = now;

  // Intercept the cancel POST and inject the X-Current-Time header so the server
  // evaluates the cancellation fee as if "now" is the provided timestamp.
  cy.intercept('POST', `/api/reservations/*/cancel`, (req) => {
    req.headers['x-current-time'] = interceptedCurrentTime;
  }).as('cancelRequest');
});

// ── API-based cancel ───────────────────────────────────────────────────────────

When('the reservation is cancelled at {string}', (now: string) => {
  cy.cancelReservationViaAPI(currentReservationId, now).as('cancelResponse');
});

// ── UI navigation ──────────────────────────────────────────────────────────────

When('I visit the reservation detail page', () => {
  detail.visit(currentReservationId);
});

When('I click Cancel Reservation', () => {
  detail.openCancelPanel();
});

When('I confirm the cancellation', () => {
  detail.confirmCancel();
});

When('I click Keep Reservation', () => {
  detail.abortCancel();
});

// ── Cancellation API assertions ────────────────────────────────────────────────

Then('the cancellation fee returned is {string}', (fee: string) => {
  const expectedFee = parseFloat(fee.replace('$', ''));
  cy.get('@cancelResponse').its('body.cancellationFee').should('eq', expectedFee);
});

Then('the cancellation policy mentions {string}', (text: string) => {
  cy.get('@cancelResponse').its('body.policy').should('contain', text);
});

Then('the reservation status is now {string}', (status: string) => {
  cy.get('@cancelResponse').its('body.reservation.status').should('eq', status);
});

// ── UI cancellation assertions ─────────────────────────────────────────────────

Then('the cancellation confirmation panel is visible', () => {
  cy.get('[data-cy=cancel-confirm-section]').should('be.visible');
});

Then('the cancellation fee displayed is {string}', (fee: string) => {
  detail.getCancellationFee().should('contain.text', fee);
});

Then('the policy text mentions {string}', (text: string) => {
  detail.getCancellationPolicy().should('contain.text', text);
});

Then('the reservation status on the page is {string}', (status: string) => {
  detail.getStatus().should('contain.text', status);
});

Then('the cancel button is visible again', () => {
  cy.get('[data-cy=cancel-btn]').should('be.visible');
});

Then('the confirmation panel is hidden', () => {
  cy.get('[data-cy=cancel-confirm-section]').should('not.be.visible');
});

// ── Rejection / guard assertions (state machine + the "already arrived" rule) ──

Then('the cancellation request is rejected with status {int}', (statusCode: number) => {
  cy.get('@cancelResponse').its('status').should('eq', statusCode);
});

Then('the cancellation error mentions {string}', (text: string) => {
  cy.get('@cancelResponse').its('body.error').should('contain', text);
});

Then('the reservation status is still {string}', (status: string) => {
  cy.request(`/api/reservations/${currentReservationId}`).its('body.status').should('eq', status);
});

Then('the flash message contains {string}', (text: string) => {
  detail.getFlashMessage().should('contain.text', text);
});

// ════════════════════════════════════════════════════════════════════════════════
// STEP STUBS — implement these as you add your own scenarios
// ════════════════════════════════════════════════════════════════════════════════

// TODO: Add step definitions for your new cancellation scenarios below.
// Tips:
//   · Use cy.seedReservation({ createdAt: '...' }) to control the booking timestamp
//     This lets you test the grace-window rule (booked < 24 h ago + check-in > 72 h away)
//   · For state machine tests (cancel a checked-in res, cancel an already-cancelled res)
//     change the status via API first: POST /api/reservations/:id/checkin does not exist
//     as an API endpoint — you may need to do it via the UI or add a helper
//   · Use cy.intercept() to inject X-Current-Time for the full UI cancel flow
//     (not just the API cancel) — see the "cancel-confirm-section" step above
