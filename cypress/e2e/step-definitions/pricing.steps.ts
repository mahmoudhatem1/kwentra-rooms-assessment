import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { PricingCalculatorPage } from '../../pages/pricing-calculator.page';

const calc = PricingCalculatorPage.Instance;

// ── Background ─────────────────────────────────────────────────────────────────

Given('I am on the pricing calculator page', () => {
  calc.visit();
});

// ── Calculator interaction ─────────────────────────────────────────────────────

When('I calculate the price for room {string} from {string} to {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    calc.selectRoom(roomId);
    calc.setCheckIn(checkIn);
    calc.setCheckOut(checkOut);
    calc.calculate();
  });

When('I apply promo code {string}', (code: string) => {
  calc.fillPromoCode(code);
});

When('I apply promo code {string} and calculate for room {string} from {string} to {string}',
  (code: string, roomId: string, checkIn: string, checkOut: string) => {
    calc.selectRoom(roomId);
    calc.setCheckIn(checkIn);
    calc.setCheckOut(checkOut);
    calc.fillPromoCode(code);
    calc.calculate();
  });

When('I enable group booking discount', () => {
  calc.checkGroupBooking();
});

// ── Result assertions ──────────────────────────────────────────────────────────

Then('the base total is {string}', (value: string) => {
  calc.getBaseTotal().should('have.text', value);
});

Then('the grand total is {string}', (value: string) => {
  calc.getGrandTotal().should('have.text', value);
});

Then('the VAT is {string}', (value: string) => {
  calc.getVat().should('have.text', value);
});

Then('the city tax is {string}', (value: string) => {
  calc.getCityTax().should('have.text', value);
});

Then('the room subtotal is {string}', (value: string) => {
  calc.getRoomSubtotal().should('have.text', value);
});

Then('the weekend surcharge is {string}', (value: string) => {
  calc.getWeekendSurcharge().should('contain.text', value);
});

Then('no weekend surcharge is shown', () => {
  calc.getResult().find('[data-cy=preview-weekend-surcharge]').should('not.exist');
});

Then('the promo discount is {string}', (value: string) => {
  calc.getPromoDiscount().should('contain.text', value);
});

Then('a promo error is shown containing {string}', (text: string) => {
  calc.getPromoError().should('contain.text', text);
});

Then('no promo discount is applied', () => {
  calc.getResult().find('[data-cy=preview-promo-discount]').should('not.exist');
});

Then('the group discount is {string}', (value: string) => {
  calc.getGroupDiscount().should('contain.text', value);
});

// ── Direct API-level pricing checks (bypasses the UI entirely) ──────────────────
// Used for pure math verification and invalid-input handling, per the tips
// above. Response is aliased so multiple Then steps can inspect it.

When('I request the pricing API directly for room {string} from {string} to {string}',
  (roomId: string, checkIn: string, checkOut: string) => {
    cy.request({
      method: 'POST',
      url: '/api/pricing/calculate',
      body: { roomId, checkIn, checkOut },
      failOnStatusCode: false,
    }).as('pricingApiResponse');
  });

Then('the API response body has nights {string}', (nights: string) => {
  cy.get('@pricingApiResponse').its('body.nights').should('eq', parseInt(nights));
});

Then('the API response body has grandTotal {string}', (total: string) => {
  cy.get('@pricingApiResponse').its('body.grandTotal').should('eq', parseFloat(total));
});

Then('the pricing API responds with status {int}', (statusCode: number) => {
  cy.get('@pricingApiResponse').its('status').should('eq', statusCode);
});

// ════════════════════════════════════════════════════════════════════════════════
// STEP STUBS — implement these as you add your own scenarios
// ════════════════════════════════════════════════════════════════════════════════

// TODO: Add step definitions for your new pricing scenarios below.
// Tips:
//   · The pricing API endpoint is POST /api/pricing/calculate
//     You can test it directly with cy.request() for pure math verification
//   · Test weekend surcharge by checking specific nights — the README documents which nights qualify
//   · SUMMER20 requires a minimum stay — test exactly at that boundary
//   · Promo codes are case-insensitive on the server (try lowercase)
//   · Group discount and promo discount do NOT stack — both apply sequentially
//     (promo on subtotal first, then group on the result)
