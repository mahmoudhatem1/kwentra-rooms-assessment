Feature: Reservation Cancellation

  # ─── How to read this file ────────────────────────────────────────────────────
  # Two example scenarios are provided. Add your own underneath.
  #
  # The cancellation policy has three fee tiers based on how many hours remain
  # before check-in at the time of cancellation:
  #
  #   > 72 h  →  free cancellation
  #   24–72 h →  50% of the first night's base rate
  #   < 24 h  →  100% of the first night's base rate
  #
  # There is also a grace window:
  #   Booked within the last 24 h AND check-in is still > 72 h away → free
  #
  # Key technique: the server accepts an X-Current-Time header that overrides
  # "now" for all time-based calculations. Use cy.intercept() to inject this
  # header into the cancel request so you can test each fee tier without
  # waiting for real time to pass.

  Background:
    Given the app is in a clean state

  # ── Example scenario 1: free cancellation via API ────────────────────────────
  # Seeds a reservation with check-in 10 days from now, then cancels it
  # more than 72 h before check-in → expects $0 fee.
  #
  # Note: this test uses cy.seedReservation() (API) + cy.cancelReservationViaAPI()
  # with an X-Current-Time header — no UI interaction needed for the cancel itself.
  Scenario: Cancelling more than 72 hours before check-in incurs no fee
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-17T10:00:00Z"
    Then the cancellation fee returned is "$0.00"
    And the cancellation policy mentions "Free cancellation"
    And the reservation status is now "cancelled"

  # ── Example scenario 2: UI cancel panel shows correct fee ────────────────────
  # Verifies the UI shows the right fee in the confirmation panel before
  # the user clicks "Yes, Cancel". The cancel POST is intercepted to inject
  # X-Current-Time so the server sees the correct window.
  #
  # Room 101: $120/night. 50% of first night = $60.00
  Scenario: Cancel panel displays the 50% fee when cancelling 24–72 hours before check-in
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    And the cancel request will use current time "2026-10-19T10:00:00Z"
    When I visit the reservation detail page
    And I click Cancel Reservation
    Then the cancellation confirmation panel is visible
    And the cancellation fee displayed is "$60.00"
    And the policy text mentions "50%"

  # ════════════════════════════════════════════════════════════════════════════
  # ADD YOUR SCENARIOS BELOW
  # ════════════════════════════════════════════════════════════════════════════

  # ── Boundary values around the 72-hour tier edge ──────────────────────────────
  # calculateCancellationFee() uses `hoursUntilCheckIn > 72` to qualify as free.
  # Exactly 72h therefore falls into the NEXT tier (50%), not the free tier —
  # this is the kind of off-by-one that's invisible unless tested at the exact
  # boundary rather than "somewhere in the 24-72h range".
  Scenario: Exactly 72 hours before check-in is charged the 50% tier, not free
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-17T14:00:00Z"
    Then the cancellation fee returned is "$60.00"
    And the cancellation policy mentions "50%"

  Scenario: One minute past 72 hours before check-in is free
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-17T13:59:00Z"
    Then the cancellation fee returned is "$0.00"
    And the cancellation policy mentions "Free cancellation"

  # ── Boundary values around the 24-hour tier edge ──────────────────────────────
  Scenario: Exactly 24 hours before check-in is charged the full 100% tier, not 50%
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-19T14:00:00Z"
    Then the cancellation fee returned is "$120.00"
    And the cancellation policy mentions "Full first-night rate"

  Scenario: One minute past 24 hours before check-in is charged the 50% tier
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-19T13:59:00Z"
    Then the cancellation fee returned is "$60.00"
    And the cancellation policy mentions "50%"

  # ── Grace window ───────────────────────────────────────────────────────────────
  # Booked within the last 24 h AND check-in still >72 h away → free.
  # As noted in the questionnaire, this branch is checked before, and produces
  # the same outcome as, the plain ">72h away" rule — this scenario still locks
  # in the current wording/behaviour rather than relying on that overlap.
  Scenario: A booking made within the last 24 hours with check-in still far away is free
    Given a confirmed reservation exists for room "101" checking in "2026-10-25" and checking out "2026-10-27", booked at "2026-10-16T09:00:00Z"
    When the reservation is cancelled at "2026-10-16T10:00:00Z"
    Then the cancellation fee returned is "$0.00"
    And the cancellation policy mentions "booked within 24 h"

  # ── Undocumented rule discovered by reading src/pricing.js directly ──────────
  # calculateCancellationFee() returns `eligible: false` when hoursUntilCheckIn
  # <= 0 — i.e. the check-in time has already passed but the guest never
  # actually checked in (status is still "confirmed"). This is NOT one of the
  # three documented fee tiers and is NOT a state-machine guard (status hasn't
  # changed) — it's a fourth, undocumented rule. The API responds 409 with a
  # distinct message rather than any fee.
  Scenario: Cancelling is rejected once check-in time has already passed
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-20T15:00:00Z"
    Then the cancellation request is rejected with status 409
    And the cancellation error mentions "already arrived"
    And the reservation status is still "confirmed"

  # ── State-machine guards ──────────────────────────────────────────────────────
  Scenario: A checked-in reservation cannot be cancelled
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    And the reservation has been checked in
    When the reservation is cancelled at "2026-10-17T10:00:00Z"
    Then the cancellation request is rejected with status 409
    And the cancellation error mentions "checked-in"

  Scenario: An already-cancelled reservation cannot be cancelled again
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When the reservation is cancelled at "2026-10-17T10:00:00Z"
    Then the reservation status is now "cancelled"
    When the reservation is cancelled at "2026-10-17T11:00:00Z"
    Then the cancellation request is rejected with status 409
    And the cancellation error mentions "cancelled"

  # ── UI flow: abort ─────────────────────────────────────────────────────────────
  Scenario: Clicking Keep Reservation hides the panel and restores the Cancel button
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    When I visit the reservation detail page
    And I click Cancel Reservation
    Then the cancellation confirmation panel is visible
    When I click Keep Reservation
    Then the confirmation panel is hidden
    And the cancel button is visible again

  # ── UI flow: full confirm end-to-end ──────────────────────────────────────────
  # Combines X-Current-Time injection with an actual "Yes, Cancel" submit —
  # the earlier example scenario only checks the panel's displayed fee before
  # confirming; this one follows through to the final page state.
  Scenario: Confirming cancellation through the UI updates the status and shows the fee charged
    Given a confirmed reservation exists for room "101" checking in "2026-10-20" and checking out "2026-10-22"
    And the cancel request will use current time "2026-10-19T10:00:00Z"
    When I visit the reservation detail page
    And I click Cancel Reservation
    And I confirm the cancellation
    Then the reservation status on the page is "Cancelled"
    And the flash message contains "Cancellation fee: $60.00"
