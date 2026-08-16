export class BookingFormPage {
  private static _instance: BookingFormPage;
  static get Instance() { return (this._instance ??= new BookingFormPage()); }

  visit(roomId?: string, checkIn?: string, checkOut?: string) {
    const params = new URLSearchParams();
    if (roomId)   params.set('room',     roomId);
    if (checkIn)  params.set('checkIn',  checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    cy.visit(`/reservations/new${params.toString() ? '?' + params.toString() : ''}`);
  }

  selectRoom(roomId: string) { cy.get('[data-cy=room-select]').select(roomId); }

  setCheckIn(date: string)   { cy.get('[data-cy=check-in]').clear().type(date); }
  setCheckOut(date: string)  { cy.get('[data-cy=check-out]').clear().type(date); }

  fillGuestName(name: string)   { cy.get('[data-cy=guest-name]').clear().type(name); }
  fillGuestEmail(email: string) { cy.get('[data-cy=guest-email]').clear().type(email); }

  fillGuestCount(n: number) {
    cy.get('[data-cy=guest-count]').clear().type(String(n));
  }

  fillPromoCode(code: string) { cy.get('[data-cy=promo-code]').clear().type(code); }

  checkGroupBooking() { cy.get('[data-cy=group-booking]').check(); }

  clickPreview() {
    cy.intercept('POST', '/api/pricing/calculate').as('calcPrice');
    cy.get('[data-cy=preview-btn]').click();
    cy.wait('@calcPrice');
  }

  submit() { cy.get('[data-cy=submit-btn]').click(); }

  // Pricing preview getters
  getPreviewBox()          { return cy.get('[data-cy=price-preview-box]'); }
  getPreviewNights()       { return cy.get('[data-cy=preview-nights]'); }
  getPreviewBaseTotal()    { return cy.get('[data-cy=preview-base-total]'); }
  getPreviewWeekendSurcharge() { return cy.get('[data-cy=preview-weekend-surcharge]'); }
  getPreviewPromoDiscount()    { return cy.get('[data-cy=preview-promo-discount]'); }
  getPreviewGroupDiscount()    { return cy.get('[data-cy=preview-group-discount]'); }
  getPreviewVat()          { return cy.get('[data-cy=preview-vat]'); }
  getPreviewCityTax()      { return cy.get('[data-cy=preview-city-tax]'); }
  getPreviewGrandTotal()   { return cy.get('[data-cy=preview-grand-total]'); }
  getPromoError()          { return cy.get('[data-cy=promo-error]'); }

  getFlashMessage()        { return cy.get('[data-cy=flash-message]'); }
}
