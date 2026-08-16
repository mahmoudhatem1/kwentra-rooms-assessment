export class PricingCalculatorPage {
  private static _instance: PricingCalculatorPage;
  static get Instance() { return (this._instance ??= new PricingCalculatorPage()); }

  visit() { cy.visit('/pricing'); }

  selectRoom(roomId: string) { cy.get('[data-cy=calc-room]').select(roomId); }

  setCheckIn(date: string)  { cy.get('[data-cy=calc-checkin]').clear().type(date); }
  setCheckOut(date: string) { cy.get('[data-cy=calc-checkout]').clear().type(date); }

  fillPromoCode(code: string) { cy.get('[data-cy=calc-promo]').clear().type(code); }

  checkGroupBooking() { cy.get('[data-cy=calc-group]').check(); }

  calculate() {
    cy.intercept('POST', '/api/pricing/calculate').as('calcPrice');
    cy.get('[data-cy=calc-btn]').click();
    cy.wait('@calcPrice');
  }

  // Result getters — all return Cypress chainables for assertion chaining
  getResult()              { return cy.get('[data-cy=calc-result]'); }
  getNights()              { return cy.get('[data-cy=preview-nights]'); }
  getBaseTotal()           { return cy.get('[data-cy=preview-base-total]'); }
  getWeekendSurcharge()    { return cy.get('[data-cy=preview-weekend-surcharge]'); }
  getPromoDiscount()       { return cy.get('[data-cy=preview-promo-discount]'); }
  getGroupDiscount()       { return cy.get('[data-cy=preview-group-discount]'); }
  getVat()                 { return cy.get('[data-cy=preview-vat]'); }
  getCityTax()             { return cy.get('[data-cy=preview-city-tax]'); }
  getGrandTotal()          { return cy.get('[data-cy=preview-grand-total]'); }
  getRoomSubtotal()        { return cy.get('[data-cy=preview-room-subtotal]'); }
  getPromoError()          { return cy.get('[data-cy=promo-error]'); }
}
