# Senior Automation Tester Assessment
## Kwentra Rooms — Mini Property Management System

Welcome. This document is your complete guide to the assessment. Read it fully
before touching any code or test files.

---

## Overview

You are a new QA engineer joining the Kwentra team. You have been given access
to a small web application — **Kwentra Rooms** — a mini hotel reservation
system. Your job is to analyse it, think critically about what needs to be
tested, and implement a Cypress test suite that demonstrates senior-level
automation skills.

The assessment has two parts:

| Part | Description | Where |
|------|-------------|-------|
| **Part 1 — Written** | Answer 12 questions about test strategy, design, and technical approach | `QUESTIONNAIRE.md` |
| **Part 2 — Implementation** | Write Gherkin scenarios and implement Cypress step definitions | `cypress/` |

Both parts carry significant weight, so please give each genuine attention —
strong code with throwaway answers (or vice versa) won't reflect your real
ability.

> **Note:** The implementation may contain bugs. Part of this
> assessment is evaluating whether your tests are rigorous enough to surface
> discrepancies between the application's actual behaviour and the
> **business rules** defined below. Don't assume the app is 100% correct — verify
> it against the spec.

---

## Part 0 — Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Install and run the app

```bash
npm install
node server.js
```

The app will be running at **http://localhost:3000**

Open it in a browser and explore every page before writing a single test.

### Run the Cypress tests

In a separate terminal (while the app is running):

```bash
# Interactive UI
npm run cy:open

# Headless
npm run cy:run
```

---

## Part 1 — Written Questions

Open `QUESTIONNAIRE.md` and fill in your answers directly in that file.

---

## Part 2 — Implementation

### The application

Kwentra Rooms is a hotel reservation system with five pages:

| Page | URL | Description |
|------|-----|-------------|
| Room Listing | `/` | Displays all rooms. Optional date filter shows real-time availability. |
| New Reservation | `/reservations/new` | Booking form with live price preview (fetches from `/api/pricing/calculate`). |
| Reservations List | `/reservations` | Filterable/searchable table of all bookings. |
| Reservation Detail | `/reservations/:id` | Full booking info, pricing breakdown, and action buttons. |
| Pricing Calculator | `/pricing` | Standalone tool to calculate cost for any room and date range. |

There is also an **Admin** page (`/admin`) with a reset button that wipes all
reservations — use it via `cy.resetApp()` in your test setup.

---

### Business rules

Study these carefully. They are the source of your test scenarios.

#### Rooms

| Room | Type | Rate/night | Max guests | Min nights |
|------|------|-----------|------------|------------|
| 101  | Standard | $120 | 2 | 1 |
| 102  | Standard | $120 | 2 | 1 |
| 201  | Deluxe   | $180 | 3 | 1 |
| 202  | Deluxe   | $180 | 3 | 1 |
| 301  | Suite    | $300 | 4 | **2** |

#### Pricing

1. **Weekend surcharge** — Friday nights and Saturday nights cost an additional
   30% on top of the base rate. Sunday through Thursday are standard rate.

2. **Promo codes**

   | Code | Discount | Minimum stay |
   |------|----------|--------------|
   | `WELCOME10` | 10% off | 1 night |
   | `SUMMER20`  | 20% off | 3 nights |

   Codes are case-insensitive. An invalid code shows an error; a valid code
   applied to a stay that does not meet the minimum also shows an error.

3. **Group discount** — 15% off when the `groupBooking` flag is set.
   Applied after the promo discount.

4. **Tax** — Applied to the discounted room subtotal only (not to fees):
   - VAT: 10%
   - City tax: 5%

5. **Pricing formula** (in order):
   ```
   baseTotal       = baseRate × nights
   weekendSurcharge= baseRate × 0.30 × weekendNights
   afterPromo      = (baseTotal + weekendSurcharge) × (1 - promoRate)
   afterGroup      = afterPromo × (1 - 0.15)          [if groupBooking]
   roomSubtotal    = afterGroup (or afterPromo)
   vat             = roomSubtotal × 0.10
   cityTax         = roomSubtotal × 0.05
   grandTotal      = roomSubtotal + vat + cityTax
   ```

#### Booking validation

- Check-out must be after check-in
- Guest count cannot exceed the room's `maxGuests`
- Suites require a minimum stay of 2 nights
- Rooms cannot be double-booked (conflicting active reservations are rejected)
- A cancelled reservation frees the dates — the same room can be re-booked

#### Cancellation policy

The fee is calculated at the time of cancellation based on hours remaining
before check-in (which is treated as 14:00 UTC on the check-in date):

| Condition | Fee |
|-----------|-----|
| Booked within last 24 h **AND** check-in > 72 h away | Free (grace window) |
| Check-in is > 72 h away | Free |
| Check-in is 24–72 h away | 50% of first night's base rate |
| Check-in is < 24 h away | 100% of first night's base rate |

#### Reservation state machine

```
confirmed ──→ checked-in ──→ checked-out
confirmed ──→ cancelled
```

- A checked-in or checked-out reservation **cannot** be cancelled
- A cancelled or checked-out reservation **cannot** be checked in
- Only a checked-in reservation can be checked out

---

### The `X-Current-Time` header

The server respects an `X-Current-Time` HTTP header (ISO timestamp). When
present, it uses that value instead of the real system clock for all
time-based calculations (cancellation fees, etc.).

This is the key mechanism for testing cancellation fee tiers without waiting
for real time to pass. Use `cy.intercept()` to inject this header:

```typescript
cy.intercept('POST', '/api/reservations/*/cancel', (req) => {
  req.headers['x-current-time'] = '2026-10-19T10:00:00Z';
}).as('cancelWithTime');
```

---

### REST API (for test setup)

You do not need to use these directly — the custom commands wrap them — but
knowing they exist helps with debugging.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/rooms` | List all rooms |
| `POST` | `/api/pricing/calculate` | Calculate pricing (body: `{roomId, checkIn, checkOut, promoCode, groupBooking}`) |
| `GET`  | `/api/reservations` | List reservations (query: `?status=&guest=`) |
| `POST` | `/api/reservations` | Create reservation (accepts `createdAt` to override booking timestamp) |
| `GET`  | `/api/reservations/:id` | Get single reservation |
| `POST` | `/api/reservations/:id/cancel` | Cancel (respects `X-Current-Time` header) |
| `POST` | `/api/admin/reset` | Delete all reservations |

---

### What is already provided

| File | Status | Description |
|------|--------|-------------|
| `cypress/support/commands.ts` | ✅ Complete | Custom commands: `cy.resetApp()`, `cy.seedReservation()`, `cy.bookRoom()`, `cy.cancelReservationViaUI()`, `cy.cancelReservationViaAPI()` |
| `cypress/pages/home.page.ts` | ✅ Complete | Page object for the Room Listing page |
| `cypress/pages/booking-form.page.ts` | ✅ Complete | Page object for the New Reservation form |
| `cypress/pages/pricing-calculator.page.ts` | ✅ Complete | Page object for the Pricing Calculator |
| `cypress/pages/reservation-detail.page.ts` | ⚠️ **Stub — you must implement this** | Skeleton with full selector documentation inside |
| `cypress/e2e/features/*.feature` | ⚠️ **Partial** | Two example scenarios each, you write the rest |
| `cypress/e2e/step-definitions/*.steps.ts` | ⚠️ **Partial** | Steps for the examples are implemented; add yours below |
| `cypress/fixtures/guests.json` | ✅ Complete | Reusable guest data |

---

### What you must deliver

#### 1 — Complete `ReservationDetailPage`

Implement every method in `cypress/pages/reservation-detail.page.ts`.
The file contains the full list of available `data-cy` selectors and
explains what each method should do.

#### 2 — Write test scenarios

Add your own Gherkin scenarios to the three feature files:

- `cypress/e2e/features/booking.feature`
- `cypress/e2e/features/pricing.feature`
- `cypress/e2e/features/cancellation.feature`

Each file has a comment block listing areas to consider. You are not limited
to that list — think independently about what is risky and what needs testing.

**Expectations for your scenarios:**

- Cover all business rules described above in a meaningful way
- Include both valid and invalid inputs (happy paths and error paths)
- Include at least one `Scenario Outline` with an `Examples` table
- Each scenario must be independent — no scenario should rely on state
  left by a previous one
- Use `cy.seedReservation()` (API) to set up preconditions rather than
  navigating through the UI when the setup is not what is being tested

#### 3 — Implement step definitions

Add step definitions for every step you introduce. You may add new steps
to the existing `.steps.ts` files or create additional ones.

**Expectations for your implementation:**

- Use the page objects
- Demonstrate at least one use of `cy.intercept()` to assert on a request
  body or response — beyond the examples already provided
- Demonstrate time manipulation via the `X-Current-Time` header mechanism
  to test a time-dependent scenario
- Use `cy.request()` for at least one API-level assertion

---

### Evaluation criteria

- Scenario coverage
- Test Isolation
- Code quality
- Senior techniques

---

## Submission

1. Complete `QUESTIONNAIRE.md`
2. Implement `ReservationDetailPage`
3. Add scenarios to all three feature files
4. Implement step definitions
5. Commit the changes you made, i.e. Git commit.
6. Submit the entire `assessment` folder

Good luck.
