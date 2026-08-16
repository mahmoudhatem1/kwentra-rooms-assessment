Feature: Pricing Rules

  # ─── How to read this file ────────────────────────────────────────────────────
  # Two example scenarios are provided. Add your own underneath.

  Background:
    Given I am on the pricing calculator page

  # ── Example scenario 1: simple weeknight rate ─────────────────────────────────
  # Monday 2026-09-07 to Wednesday 2026-09-09 = 2 weeknights, no surcharge
  # Room 101: $120 × 2 = $240 base
  # VAT (10%): $24.00  City tax (5%): $12.00  Grand total: $276.00
  Scenario: Two weeknight stays show correct base rate and tax breakdown
    When I calculate the price for room "101" from "2026-09-07" to "2026-09-09"
    Then the base total is "$240.00"
    And no weekend surcharge is shown
    And the VAT is "$24.00"
    And the city tax is "$12.00"
    And the grand total is "$276.00"

  # ── Example scenario 2: Scenario Outline — rate per room type ────────────────
  # Verifies base rates across all room types for a 1-night weeknight stay.
  # Taxes: VAT 10% + city tax 5% = 15% on top of base rate.
  Scenario Outline: Base rate is correct for each room type
    When I calculate the price for room "<roomId>" from "2026-09-08" to "2026-09-09"
    Then the base total is "<baseTotal>"
    And the grand total is "<grandTotal>"

    Examples:
      | roomId | baseTotal | grandTotal |
      | 101    | $120.00   | $138.00    |
      | 201    | $180.00   | $207.00    |
      | 301    | $300.00   | $345.00    |

  # ════════════════════════════════════════════════════════════════════════════
  # ADD YOUR SCENARIOS BELOW
  # ════════════════════════════════════════════════════════════════════════════

  # ── KNOWN ISSUE — read before touching any scenario below that mixes a ──────
  # ── promo code or group discount with tax assertions ─────────────────────────
  #
  # src/pricing.js computes VAT/city tax on `baseTotal + weekendSurcharge`
  # (the PRE-discount amount), not on `roomSubtotal` (the POST-discount amount)
  # as the business rules document specifies:
  #
  #     "Tax — Applied to the discounted room subtotal only"
  #
  # This means the server currently OVER-CHARGES tax on every reservation that
  # uses a promo code and/or group discount. It is invisible in scenarios with
  # no discount (tax base and room subtotal happen to be identical), which is
  # why the two example scenarios above never exposed it.
  #
  # The scenarios below assert the CORRECT value per the business rules
  # document, not the server's current output. They are expected to FAIL
  # against the current build — that failure is the point: it is what proves
  # the discrepancy and is exactly what should be reported back to the dev
  # team, e.g.: "SUMMER20 on a 3-night $360 stay should total $331.20, server
  # currently returns $342.00 — a $10.80 overcharge caused by taxing the
  # pre-discount subtotal instead of the post-discount subtotal."

  # ── Weekend surcharge isolation (no discount involved — tax is correct here) ─
  # 2026-09-11 is a Friday, so this 2-night stay covers exactly one Friday and
  # one Saturday night. No promo/group discount is used, so this scenario is
  # NOT affected by the tax bug above — a clean baseline for the surcharge rule.
  Scenario: Weekend surcharge applies only to Friday and Saturday nights
    When I calculate the price for room "101" from "2026-09-11" to "2026-09-13"
    Then the base total is "$240.00"
    And the weekend surcharge is "$36.00"
    And the room subtotal is "$276.00"
    And the VAT is "$27.60"
    And the city tax is "$13.80"
    And the grand total is "$317.40"

  # ── SUMMER20 minimum-stay boundary — below the minimum (rejected) ────────────
  Scenario Outline: SUMMER20 is rejected below its 3-night minimum stay
    When I apply promo code "SUMMER20" and calculate for room "101" from "2026-09-07" to "<checkOut>"
    Then a promo error is shown containing "requires a minimum stay of 3 nights"
    And no promo discount is applied

    Examples:
      | checkOut   | nightsBooked |
      | 2026-09-08 | 1            |
      | 2026-09-09 | 2            |

  # ── SUMMER20 minimum-stay boundary — at and above the minimum (accepted) ─────
  # Exposes the tax bug: grand totals below are the spec-correct values.
  # The server currently returns $342.00 and $456.00 respectively (both wrong).
  Scenario Outline: SUMMER20 discount applies correctly at and above the minimum stay
    When I apply promo code "SUMMER20" and calculate for room "101" from "2026-09-07" to "<checkOut>"
    Then the promo discount is "<promoDiscount>"
    And the room subtotal is "<roomSubtotal>"
    And the grand total is "<grandTotal>"

    Examples:
      | checkOut   | promoDiscount | roomSubtotal | grandTotal |
      | 2026-09-10 | $72.00        | $288.00      | $331.20    |
      | 2026-09-11 | $96.00        | $384.00      | $441.60    |

  # ── WELCOME10 minimum stay is just 1 night — confirm it works at that floor ──
  # Also exposes the tax bug on its own (single-promo, no group, no weekend).
  Scenario: WELCOME10 applies on a single-night stay
    When I apply promo code "WELCOME10" and calculate for room "101" from "2026-09-07" to "2026-09-08"
    Then the promo discount is "$12.00"
    And the room subtotal is "$108.00"
    And the grand total is "$124.20"

  # ── Promo codes are case-insensitive ──────────────────────────────────────────
  # Uses lowercase input on purpose — the server should uppercase/trim it
  # internally (src/pricing.js: promoCode.trim().toUpperCase()).
  Scenario: Promo code is accepted regardless of letter casing
    When I apply promo code "welcome10" and calculate for room "101" from "2026-09-07" to "2026-09-08"
    Then the promo discount is "$12.00"

  # ── Unknown promo code ────────────────────────────────────────────────────────
  Scenario: An unrecognised promo code shows an error and no discount
    When I apply promo code "BOGUS50" and calculate for room "101" from "2026-09-07" to "2026-09-09"
    Then a promo error is shown containing "Invalid promo code"
    And no promo discount is applied

  # ── Group discount — no room-count check exists (spec ambiguity) ────────────
  # src/pricing.js defines GROUP_MIN_ROOMS = 3 with the comment "15% off when
  # 3+ rooms share overlapping dates" — but calculatePricing() applies the
  # discount purely off the `groupBooking` boolean, with no check on room
  # count anywhere in the codebase (GROUP_MIN_ROOMS is imported in server.js
  # but never referenced in a condition). Neither the UI nor the API expose a
  # way to specify "how many rooms" in a single request in the first place, so
  # this cannot be tested as a rejection case — there's no request shape that
  # would represent "only 1 of 3 required rooms". This scenario documents the
  # CURRENT behaviour (discount applies to a single room) as a locked-in
  # regression baseline, and should be flagged to the business/dev team to
  # clarify intent: either the constant is dead code to remove, or group
  # bookings need a room-count field that doesn't exist yet.
  Scenario: Group discount currently applies even to a single-room booking
    When I enable group booking discount
    And I calculate the price for room "101" from "2026-09-07" to "2026-09-09"
    Then the group discount is "$36.00"
    And the grand total is "$234.60"

  # ── Full formula end-to-end: weekend + promo + group + tax, in order ────────
  # 2026-09-10 is a Thursday; this 4-night stay covers Thu, Fri, Sat, Sun —
  # exactly 2 weekend nights. Combines every pricing rule in one calculation
  # to prove the order of operations (surcharge → promo → group → tax) end
  # to end. All figures below are spec-correct; see the tax bug note above.
  Scenario: Weekend surcharge, promo code and group discount combine in the correct order
    When I enable group booking discount
    And I apply promo code "SUMMER20" and calculate for room "101" from "2026-09-10" to "2026-09-14"
    Then the base total is "$480.00"
    And the weekend surcharge is "$72.00"
    And the promo discount is "$110.40"
    And the group discount is "$66.24"
    And the room subtotal is "$375.36"
    And the VAT is "$37.54"
    And the city tax is "$18.77"
    And the grand total is "$431.67"

  # ── API-level assertion, bypassing the UI entirely ───────────────────────────
  # Demonstrates cy.request() for pure math verification, per the tip in
  # pricing.steps.ts. Hits /api/pricing/calculate directly and asserts on the
  # raw JSON body — useful for locking in the formula independently of any
  # future UI redesign.
  Scenario: Pricing API returns the correct raw calculation for a plain weeknight stay
    When I request the pricing API directly for room "201" from "2026-09-07" to "2026-09-09"
    Then the API response body has nights "2"
    And the API response body has grandTotal "414"

  # ── Invalid input handling ────────────────────────────────────────────────────
  Scenario: Pricing API rejects a check-out date that is before check-in
    When I request the pricing API directly for room "101" from "2026-09-10" to "2026-09-08"
    Then the pricing API responds with status 400
