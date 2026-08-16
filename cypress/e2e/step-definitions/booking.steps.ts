import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { HomePage }        from '../../pages/home.page';
import { BookingFormPage } from '../../pages/booking-form.page';
import { ReservationDetailPage } from '../../pages/reservation-detail.page';

const home    = HomePage.Instance;
const form    = BookingFormPage.Instance;
const detail  = ReservationDetailPage.Instance;

// ── Background ─────────────────────────────────────────────────────────────────

Given('the app is in a clean state', () => {
  cy.resetApp();
});

// ── Navigation ─────────────────────────────────────────────────────────────────

Given('I navigate to the booking form for room {string} with check-in {string} and check-out {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    form.visit(roomId, checkIn, checkOut);
  });

// ── Form interaction ───────────────────────────────────────────────────────────

When('I fill in guest details with name {string}, email {string} and {string} guests',
  (name: string, email: string, count: string) => {
    form.fillGuestName(name);
    form.fillGuestEmail(email);
    form.fillGuestCount(parseInt(count));
  });

When('I click Preview Price', () => {
  form.clickPreview();
});

When('I confirm the booking', () => {
  form.submit();
});

// ── Intercept (example scenario 2) ────────────────────────────────────────────

When('I intercept the pricing API call', () => {
  cy.intercept('POST', '/api/pricing/calculate').as('pricingCall');
});

// ── Price preview assertions ───────────────────────────────────────────────────

Then('the price preview shows {string} nights at {string} per night',
  (nights: string, _rate: string) => {
    form.getPreviewNights().should('contain', nights);
  });

Then('the preview grand total is {string}', (total: string) => {
  form.getPreviewGrandTotal().should('have.text', total);
});

// ── Intercept assertions (example scenario 2) ────────────────────────────────

Then('the intercepted pricing request body contains roomId {string}, checkIn {string}, checkOut {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    cy.get('@pricingCall').its('request.body').should('deep.include', { roomId, checkIn, checkOut });
  });

Then('the API response nights count is {string}', (nights: string) => {
  cy.get('@pricingCall').its('response.body.nights').should('eq', parseInt(nights));
});

// ── Post-submit assertions ─────────────────────────────────────────────────────

Then('I am on the reservation detail page', () => {
  cy.url().should('match', /\/reservations\/RES-/);
});

Then('the reservation status is {string}', (status: string) => {
  detail.getStatus().should('contain.text', status);
});

Then('the guest name shown is {string}', (name: string) => {
  cy.get('[data-cy=guest-name]').should('have.text', name);
});

Then('the grand total shown is {string}', (total: string) => {
  detail.getGrandTotal().should('have.text', total);
});

// ── Extra setup steps (duplicated intentionally — see cancellation.steps.ts) ──
// cypress-cucumber-preprocessor scopes step files per feature file by name
// (see cypress.config.ts's `[filepath].steps` pattern), so steps used by both
// booking.feature and cancellation.feature must exist in both files. The
// existing "the app is in a clean state" step above follows this same pattern.

Given('a confirmed reservation exists for room {string} checking in {string} and checking out {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    cy.seedReservation({ roomId, checkIn, checkOut }).then(response => {
      expect(response.status).to.eq(201);
    });
  });

Given('a cancelled reservation exists for room {string} checking in {string} and checking out {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    cy.seedReservation({ roomId, checkIn, checkOut }).then(response => {
      expect(response.status).to.eq(201);
      // Cancel far enough before check-in (fixed "now") so this is always a
      // free, eligible cancellation regardless of when the suite actually runs.
      cy.cancelReservationViaAPI(response.body.id, '2026-09-01T00:00:00Z').then(cancelResponse => {
        expect(cancelResponse.status).to.eq(200);
      });
    });
  });

// ── Form interaction — promo & group booking ────────────────────────────────────

When('I fill in promo code {string}', (code: string) => {
  form.fillPromoCode(code);
});

When('I enable group booking on the form', () => {
  form.checkGroupBooking();
});

// ── Validation error assertions ──────────────────────────────────────────────

Then('a validation error is shown containing {string}', (text: string) => {
  form.getFlashMessage().should('contain.text', text);
});

Then('the guest count shown is {string}', (count: string) => {
  detail.getGuestCount().should('have.text', count);
});

// ── Extended intercept assertion (beyond the example scenario) ──────────────

Then('the intercepted request body includes promoCode {string} and groupBooking {word}',
  (promoCode: string, groupBooking: string) => {
    cy.get('@pricingCall').its('request.body').should('deep.include', {
      promoCode,
      groupBooking: groupBooking === 'true',
    });
  });

// ── cy.request() cross-check: does persisted server data match the form? ────

Then('the reservation stored on the server has guestCount {int} and status {string}',
  (guestCount: number, status: string) => {
    cy.url().then(url => {
      const id = url.split('/').pop();
      cy.request(`/api/reservations/${id}`).its('body').should('deep.include', { guestCount, status });
    });
  });

// ════════════════════════════════════════════════════════════════════════════════
// STEP STUBS — implement these as you add your own scenarios
// ════════════════════════════════════════════════════════════════════════════════

// TODO: Add step definitions for your new scenarios below.
// Tips:
//   · Use cy.seedReservation() to create reservations via API before UI tests
//   · Use cy.intercept() to assert on request payloads and response bodies
//   · For conflict testing, seed a reservation first, then try to book the same dates
//   · For group discount, check the GROUP_MIN_ROOMS constant in src/pricing.js
