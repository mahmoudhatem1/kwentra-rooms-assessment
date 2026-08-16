export class HomePage {
  private static _instance: HomePage;
  static get Instance() { return (this._instance ??= new HomePage()); }

  visit() { cy.visit('/'); }

  setCheckIn(date: string)  { cy.get('[data-cy=filter-checkin]').clear().type(date); }
  setCheckOut(date: string) { cy.get('[data-cy=filter-checkout]').clear().type(date); }

  searchAvailability(checkIn: string, checkOut: string) {
    this.setCheckIn(checkIn);
    this.setCheckOut(checkOut);
    cy.get('[data-cy=filter-btn]').click();
  }

  getRoomCard(roomId: string) { return cy.get(`[data-cy-room="${roomId}"]`); }

  getRoomRate(roomId: string) { return cy.get(`[data-cy=room-rate-${roomId}]`); }

  getRoomAvailabilityBadge(roomId: string) { return cy.get(`[data-cy=room-availability-${roomId}]`); }

  getBookButton(roomId: string) { return cy.get(`[data-cy=book-btn-${roomId}]`); }

  clickBook(roomId: string) { this.getBookButton(roomId).click(); }
}
