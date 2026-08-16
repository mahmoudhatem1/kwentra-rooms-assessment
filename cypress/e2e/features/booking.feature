Feature: Room Booking

  # ─── How to read this file ────────────────────────────────────────────────────
  # Two example scenarios are provided below to show you the expected style and
  # level of detail. Read them, then add your own scenarios underneath.
  #

  Background:
    Given the app is in a clean state

  # ── Example scenario 1: happy path ────────────────────────────────────────────
  Scenario: Successfully book a standard room for two weeknight stays
    Given I navigate to the booking form for room "101" with check-in "2026-09-01" and check-out "2026-09-03"
    When I fill in guest details with name "Jane Smith", email "jane@example.com" and "2" guests
    And I click Preview Price
    Then the price preview shows "2" nights at "$120.00" per night
    And the preview grand total is "$276.00"
    When I confirm the booking
    Then I am on the reservation detail page
    And the reservation status is "Confirmed"
    And the guest name shown is "Jane Smith"
    And the grand total shown is "$276.00"

  # ── Example scenario 2: booking form intercept ────────────────────────────────
  # This scenario demonstrates cy.intercept() — the preview API call is
  # intercepted and its response body is verified before the form is submitted.
  Scenario: Booking form calls the pricing API with correct parameters
    Given I navigate to the booking form for room "201" with check-in "2026-09-05" and check-out "2026-09-08"
    When I fill in guest details with name "Bob Allen", email "bob@example.com" and "2" guests
    And I intercept the pricing API call
    And I click Preview Price
    Then the intercepted pricing request body contains roomId "201", checkIn "2026-09-05", checkOut "2026-09-08"
    And the API response nights count is "3"

  # ════════════════════════════════════════════════════════════════════════════
  # ADD YOUR SCENARIOS BELOW
  # ════════════════════════════════════════════════════════════════════════════

  # ── KNOWN ISSUE — Suite minimum stay does not match the business rules doc ──
  # The business rules document states: "Suites require a minimum stay of 2
  # nights". But cypress/../src/data.js configures room 301 (the only Suite)
  # with `minNights: 3`, and server.js validates directly against that field.
  # The pair of scenarios below intentionally documents BOTH sides: the first
  # asserts the DOCUMENTED rule (2 nights, expected to FAIL against the
  # current build — that failure is the point) and the second locks in the
  # ACTUAL current behaviour (3 nights) as a regression baseline so it doesn't
  # silently drift further from the spec.

  Scenario: [Per spec] Suite booking should be accepted at the documented 2-night minimum
    Given I navigate to the booking form for room "301" with check-in "2026-09-14" and check-out "2026-09-16"
    When I fill in guest details with name "Carol Williams", email "carol@example.com" and "4" guests
    And I confirm the booking
    Then I am on the reservation detail page
    And the reservation status is "Confirmed"

  Scenario: [Actual behaviour] Suite booking is currently rejected below its real 3-night minimum
    Given I navigate to the booking form for room "301" with check-in "2026-09-14" and check-out "2026-09-16"
    When I fill in guest details with name "Carol Williams", email "carol@example.com" and "4" guests
    And I confirm the booking
    Then a validation error is shown containing "minimum stay of 3 nights"

  # ── Guest count boundaries per room type (equivalence partitioning) ─────────
  # Deluxe (201) and Suite (301) get their own room to avoid double-booking
  # the same room within one Outline's parallel-looking rows; the app resets
  # between scenarios anyway, but distinct rooms keep each row self-explanatory.

  Scenario Outline: Guest count is rejected above the room's maximum capacity
    Given I navigate to the booking form for room "<roomId>" with check-in "<checkIn>" and check-out "<checkOut>"
    When I fill in guest details with name "Over Capacity", email "overcap@example.com" and "<guests>" guests
    And I confirm the booking
    Then a validation error is shown containing "<errorText>"

    Examples:
      | roomId | checkIn    | checkOut   | guests | errorText           |
      | 101    | 2026-09-08 | 2026-09-09 | 3      | maximum of 2 guests |
      | 201    | 2026-09-08 | 2026-09-09 | 4      | maximum of 3 guests |
      | 301    | 2026-09-21 | 2026-09-24 | 5      | maximum of 4 guests |

  Scenario Outline: Guest count exactly at the room's maximum capacity is accepted
    Given I navigate to the booking form for room "<roomId>" with check-in "<checkIn>" and check-out "<checkOut>"
    When I fill in guest details with name "At Capacity", email "atcap@example.com" and "<guests>" guests
    And I confirm the booking
    Then I am on the reservation detail page
    And the guest count shown is "<guests>"

    Examples:
      | roomId | checkIn    | checkOut   | guests |
      | 101    | 2026-09-08 | 2026-09-09 | 2      |
      | 201    | 2026-09-08 | 2026-09-09 | 3      |
      | 301    | 2026-09-21 | 2026-09-24 | 4      |

  # ── Date validation ───────────────────────────────────────────────────────────
  Scenario: Check-out date must be after check-in date
    Given I navigate to the booking form for room "101" with check-in "2026-09-10" and check-out "2026-09-10"
    When I fill in guest details with name "Same Day", email "sameday@example.com" and "1" guests
    And I confirm the booking
    Then a validation error is shown containing "Check-out must be after check-in"

  # ── Double-booking prevention ─────────────────────────────────────────────────
  # Seeds the conflicting reservation directly via the API (not the UI) since
  # the thing under test is the conflict check on the SECOND booking attempt,
  # not the first booking's own flow.
  Scenario: A room cannot be double-booked for overlapping dates
    Given a confirmed reservation exists for room "102" checking in "2026-09-15" and checking out "2026-09-17"
    And I navigate to the booking form for room "102" with check-in "2026-09-16" and check-out "2026-09-18"
    When I fill in guest details with name "Second Guest", email "second@example.com" and "1" guests
    And I confirm the booking
    Then a validation error is shown containing "not available for the selected dates"

  # ── Cancelled reservations free their dates ───────────────────────────────────
  Scenario: A cancelled reservation's room and dates can be booked again
    Given a cancelled reservation exists for room "102" checking in "2026-09-15" and checking out "2026-09-17"
    And I navigate to the booking form for room "102" with check-in "2026-09-15" and check-out "2026-09-17"
    When I fill in guest details with name "Rebooking Guest", email "rebook@example.com" and "1" guests
    And I confirm the booking
    Then I am on the reservation detail page
    And the reservation status is "Confirmed"

  # ── cy.intercept() — request body assertion beyond the example scenario ─────
  # The example scenario above only asserts roomId/checkIn/checkOut. This one
  # confirms promoCode and groupBooking are correctly included in the exact
  # request the browser sends, and that the response reflects the discount.
  Scenario: Booking form pricing preview sends promo code and group flag in the request
    Given I navigate to the booking form for room "101" with check-in "2026-09-21" and check-out "2026-09-24"
    When I fill in guest details with name "Group Guest", email "group@example.com" and "2" guests
    And I fill in promo code "SUMMER20"
    And I enable group booking on the form
    And I intercept the pricing API call
    And I click Preview Price
    Then the intercepted request body includes promoCode "SUMMER20" and groupBooking true
    And the API response nights count is "3"

  # ── cy.request() — cross-checking persisted server data against the form ───
  # Submits through the UI, then hits the API directly to confirm what the
  # server actually stored matches what was submitted — catches bugs where
  # the UI *displays* correctly but the persisted record is wrong.
  Scenario: Reservation data persisted on the server matches what was submitted
    Given I navigate to the booking form for room "201" with check-in "2026-09-08" and check-out "2026-09-09"
    When I fill in guest details with name "Persist Check", email "persist@example.com" and "3" guests
    And I confirm the booking
    Then I am on the reservation detail page
    And the reservation stored on the server has guestCount 3 and status "confirmed"
