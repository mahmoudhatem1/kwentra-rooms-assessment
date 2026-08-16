# Questionnaire
Fill in your answers below each question. We are looking for structured
thinking, not a single "correct" answer. Explain your reasoning.

---

## Section 1 — Scenario Analysis

**Q1.** Looking at the cancellation policy (three fee tiers + the grace window),
list every distinct test scenario you would cover. For each one, briefly explain
why it is worth testing independently.

> Your answer:
>
> 1. **Check-in > 72h away → free cancellation.** This is the baseline "no
>    penalty" case and the most common real-world path — must confirm no fee
>    is ever charged here regardless of when the booking was made.
> 2. **Check-in 24–72h away → 50% of first night's base rate.** Confirms the
>    mid-tier fee is calculated correctly, and specifically off the *base
>    rate of the first night only* (not the weekend-adjusted rate, not the
>    whole stay).
> 3. **Check-in < 24h away → 100% of first night's base rate.** The
>    highest-penalty tier — highest financial risk if miscalculated, so it
>    deserves its own explicit assertion rather than being inferred from the
>    50% case.
> 4. **Grace window: booked within last 24h AND check-in > 72h away → free.**
>    Worth testing on its own because it's a compound condition (two
>    variables, not one) and is the one most likely to be implemented
>    incorrectly (e.g. developer forgets the `AND` and treats it as an `OR`).
> 5. **Boundary: exactly 24h since booking.** Is the grace window inclusive or
>    exclusive at the edge? This is exactly the kind of off-by-one that unit
>    tests miss and that black-box boundary testing catches.
> 6. **Boundary: exactly 72h until check-in.** Same reasoning — does 72h
>    round to "free" or "50%"? The spec says "> 72h" is free and "24–72h" is
>    the 50% band, so the boundary value itself (exactly 72h) needs an
>    explicit test to lock in which side it falls on.
> 7. **Boundary: exactly 24h until check-in.** Same class of edge case
>    between the 50% and 100% tiers.
> 8. **Cancelling a reservation on a Suite (min-stay room) vs a Standard
>    room.** The fee is "first night's base rate," and base rates differ
>    ($120 vs $300) — worth confirming the fee scales with the *room's* rate,
>    not a hardcoded value.
> 9. **Attempting to cancel a `checked-in` or `checked-out` reservation.**
>    This isn't a fee-tier case but a *state machine* guard that intersects
>    with cancellation — must verify the action is rejected regardless of
>    what the fee calculation would have produced.
> 10. **Attempting to cancel an already-`cancelled` reservation (double
>     cancel).** Idempotency/error-handling case — should not silently
>     succeed or double-charge.
>
> **A design note worth flagging (see Q5):** mathematically, the "booked
> within 24h" condition in the grace-window rule never changes the outcome
> versus the plain ">72h away → free" rule, because both branches resolve to
> "free." This makes the grace window window logically redundant *unless*
> there's a hidden rule not stated in the spec (e.g. it was meant to apply to
> the 24–72h tier too). I would flag this ambiguity to the business/dev team
> rather than assume — and write the boundary tests in a way that would catch
> either interpretation.

---

**Q2.** The pricing engine takes four inputs that interact with each other:
room type, date range (which nights are weekends?), promo code, and group
booking flag. You cannot realistically test every combination.
How would you decide which combinations to prioritise? Describe your approach.

> Your answer:
>
> I would combine **risk-based prioritisation** with **pairwise (all-pairs)
> testing**, rather than either pure exhaustive combinatorics or pure
> intuition:
>
> 1. **Isolate each variable first** with a single "control" scenario that
>    changes only one input at a time against a known baseline (e.g. same
>    room, same weekday-only dates, no promo, no group — then vary just the
>    promo code, then just the group flag, then just weekend nights). This
>    proves each individual rule works in isolation and gives me a trusted
>    baseline to reason from.
> 2. **Apply pairwise testing for interaction risk.** Since the formula
>    explicitly says promo and group discounts are applied *sequentially*
>    (promo first, then group on top), the interaction between those two is
>    the highest-value pair to test explicitly — a stacking-order bug would
>    only surface when both are present together. I'd generate a small
>    pairwise matrix (room type × weekend-or-not × promo-or-not ×
>    group-or-not) rather than the full 5 rooms × N dates × 3 promo states ×
>    2 group states cartesian product.
> 3. **Weight combinations by financial/business risk, not just technical
>    coverage.** The riskiest single combination is: Suite + weekend nights +
>    SUMMER20 + group booking, because it exercises every branch of the
>    formula (min-stay validation, surcharge, promo minimum-stay validation,
>    group discount, and tax) in one scenario. I'd guarantee that one
>    combination is covered explicitly as a "does everything work together"
>    smoke case, since a bug in ordering of operations would only show up
>    here.
> 4. **Boundary-value combinations get priority over "safe middle"
>    combinations.** E.g. exactly 3-night stays with SUMMER20 (the minimum),
>    exactly 2-night Suite stays, and date ranges that straddle a Fri/Sat
>    boundary are more valuable than arbitrary mid-range dates, because
>    that's where implementation bugs cluster.
> 5. **De-prioritise combinations that are provably independent.** Room type
>    only affects the base rate and max-guests/min-nights validation — it
>    doesn't change *how* the promo or weekend math works. So I don't need to
>    re-test every promo code against every room type; one representative
>    room per "does this rule apply here" question is enough, reserving full
>    combinatorial coverage for variables that are known to interact
>    (promo × group; weekend nights × surcharge calc).

---

**Q3.** Pick the three flows you would prioritise for automated regression and
rank them by risk (highest first). Justify each ranking in one or two sentences.

> Your answer:
>
> 1. **Pricing calculation & the UI/server total match (Ranked #1 — highest
>    risk).** This is the core monetisation logic; every other flow depends
>    on it being correct, it has the most interacting variables (five rules
>    combined in one formula), and a silent miscalculation would go unnoticed
>    by users while directly costing or overcharging money.
> 2. **Cancellation fee calculation (Ranked #2).** Also directly financial,
>    also time-dependent (harder to get right than static math), and
>    intersects with the state machine — meaning a bug here could either
>    charge a customer incorrectly *or* let a reservation be cancelled/not
>    cancelled when it shouldn't be, compounding the risk.
> 3. **Booking creation with conflict/double-booking prevention (Ranked #3).**
>    Lower direct financial risk than the two above, but a data-integrity
>    failure here (two guests double-booked into the same room) causes
>    operational/reputational damage that's expensive to unwind manually and
>    is the kind of concurrency bug that's easy to miss in manual testing
>    but common in real systems.

---

## Section 2 — Test Design

**Q4.** Define the equivalence partitions and boundary values for the
**guest count** field on the booking form. Consider each room type separately
where relevant.

> Your answer:
>
> **General partitions (apply to all rooms):**
> - Invalid: non-numeric input, empty field, decimal values (e.g. 1.5),
>   negative numbers
> - Invalid: `0` guests
> - Valid: any integer from `1` up to the room's `maxGuests`
> - Invalid: any integer greater than `maxGuests`
>
> **Per room type (boundary values):**
>
> | Room type | maxGuests | Invalid low | Valid low boundary | Valid high boundary | Invalid high |
> |---|---|---|---|---|---|
> | Standard (101/102) | 2 | 0, -1 | 1 | 2 | 3 |
> | Deluxe (201/202) | 3 | 0, -1 | 1 | 3 | 4 |
> | Suite (301) | 4 | 0, -1 | 1 | 4 | 5 |
>
> **Additional edge cases worth testing regardless of room:**
> - Leading/trailing whitespace or non-integer characters if the field is a
>   free-text input rather than a stepper/select
> - Extremely large values (e.g. `999999`) to check for missing upper-bound
>   validation entirely, not just off-by-one
> - Whether the field even allows selecting a value above max in the UI
>   (client-side constraint) vs whether the server independently re-validates
>   it (API-level test bypassing the UI control, since a UI-only cap is not a
>   real security/data boundary)

---

**Q5.** Draw (or describe in text) a decision table for the cancellation fee
calculation. Your table should cover all combinations of:
- Hours since booking (≤24 h / >24 h)
- Hours until check-in (≤24 h / 24–72 h / >72 h)

> Your answer:
>
> | # | Hours since booking | Hours until check-in | Resulting fee |
> |---|---|---|---|
> | 1 | ≤ 24h | ≤ 24h | 100% of first night's base rate |
> | 2 | > 24h | ≤ 24h | 100% of first night's base rate |
> | 3 | ≤ 24h | 24–72h | 50% of first night's base rate |
> | 4 | > 24h | 24–72h | 50% of first night's base rate |
> | 5 | ≤ 24h | > 72h | Free (grace window rule) |
> | 6 | > 24h | > 72h | Free |
>
> **Observation:** rows 5 and 6 produce the *same* outcome regardless of
> "hours since booking." As noted in Q1, this means the "hours since
> booking" variable, as currently specified, never actually changes the
> fee outcome anywhere in the table — the grace-window condition is
> logically absorbed by the plain >72h-away rule. I'd still write automated
> tests for both rows 5 and 6 (to lock in current behaviour and catch
> regressions), but I'd raise this with the business analyst/dev as a
> possible spec gap — either the grace window was intended to also waive the
> fee in the 24–72h band for very recent bookings, or the "booked within 24h"
> condition is dead logic that should be removed for clarity.

---

**Q6.** The SUMMER20 promo code requires a minimum stay of 3 nights.
List all boundary and edge cases you would test around this rule.

> Your answer:
>
> - **1 night + SUMMER20** → should be rejected with a minimum-stay error
> - **2 nights + SUMMER20** → should be rejected (still below minimum,
>   closest boundary below the cutoff)
> - **3 nights + SUMMER20** → should be **accepted** (exact boundary, the
>   stated minimum)
> - **4 nights + SUMMER20** → should be accepted (just above boundary,
>   confirms the rule isn't accidentally coded as "> 3" instead of "≥ 3")
> - **Case sensitivity**: `summer20`, `SuMmEr20`, `SUMMER20` should all be
>   treated identically since codes are case-insensitive per spec
> - **Whitespace handling**: code entered with leading/trailing spaces
>   (`" SUMMER20 "`) — does the server trim it or reject it as invalid?
> - **Invalid/unknown code** (e.g. `SUMMER2020`, `SUMER20`) → generic error,
>   distinct from the minimum-stay error, so I'd assert the error *message/
>   type* differs between "code doesn't exist" and "code exists but stay too
>   short," since conflating them would be a UX/debugging problem
> - **SUMMER20 combined with a Suite booking** (which has its own 2-night
>   minimum) at exactly 2 nights — confirms the *room's* minimum-stay
>   validation fires independently and doesn't get bypassed or confused with
>   the promo's minimum-stay validation
> - **SUMMER20 applied together with WELCOME10** (if the UI allows entering
>   both, or re-entering a second code) — confirms only one promo can be
>   active at a time, or if stacking is somehow allowed, that it's
>   intentional and not a bug
> - **Empty/blank promo code field** → should behave as "no promo applied,"
>   not throw a minimum-stay error<br>

---

## Section 3 — Technical Judgment

**Q7.** After you push your tests to CI, the booking availability-conflict test
fails intermittently — it passes 7 out of 10 runs. The test books room 101,
then tries to book the same dates again and expects a conflict error.
List at least three possible root causes and describe how you would investigate
each one.

> Your answer:
>
> 1. **Test-level race condition / missing wait.** The test may fire the
>    second booking request before the first one's response (and thus the
>    server-side reservation record) has fully completed. I'd investigate by
>    adding `cy.intercept()` + `cy.wait('@firstBooking')` around the first
>    request and confirming the test explicitly waits for a 2xx response
>    (and ideally polls/asserts the reservation exists via `cy.request()`
>    to `GET /api/reservations`) before attempting the second booking, rather
>    than relying on Cypress's default command queueing to be "fast enough."
> 2. **Server-side race condition (TOCTOU — time-of-check-to-time-of-use).**
>    If the server checks "is this room available?" and then writes the
>    reservation as two separate non-atomic operations, two near-simultaneous
>    requests could both pass the check before either writes. I'd
>    investigate by deliberately firing two booking requests for the same
>    room/dates truly in parallel via `cy.request()` (not sequentially) and
>    seeing if *both* succeed — if so, that confirms a genuine backend
>    concurrency bug, not a test flake, and I'd file it separately from the
>    flaky-test investigation.
> 3. **Test data / state leakage from parallel test runs or incomplete
>    reset.** If `cy.resetApp()` doesn't fully complete (e.g. async delete
>    not awaited server-side) before the test starts, room 101 might already
>    have a stale reservation from a previous run with different dates,
>    causing the "conflict" check to behave inconsistently depending on what
>    stale data exists. I'd investigate by logging the full reservation list
>    via `GET /api/reservations` immediately after `resetApp()` in a failing
>    run and confirming it's actually empty, and by checking whether CI runs
>    specs in parallel workers that might share the same backend instance.
> 4. **Date-dependent flakiness.** If the test doesn't use a fixed/explicit
>    date range but computes dates relative to "today," and the two nights
>    booked happen to change (e.g. weekday vs weekend at certain times, or a
>    run that crosses midnight), the conflict window itself might shift
>    between runs. I'd check whether test dates are hardcoded/fixed or
>    dynamically calculated, and if dynamic, whether that calculation is
>    deterministic.

---

**Q8.** The cancellation fee tests depend on "current time" relative to
check-in. Describe two different technical approaches to controlling time in
these tests, and explain the trade-offs of each.

> Your answer:
>
> **Approach 1 — Server-side time override via the `X-Current-Time` header.**
> Inject the header via `cy.intercept()` on the cancel request so the server
> computes the fee using our chosen timestamp instead of its real clock.
> - *Pros:* Deterministic and fast — no waiting, no client clock
>   manipulation; tests the actual code path the server uses for fee
>   calculation; works even if the server and CI runner are in different
>   timezones.
> - *Cons:* Only works because this app happens to support the header — it's
>   not a generally portable technique to other systems; it doesn't exercise
>   any client-side "time remaining until check-in" display logic (if the UI
>   shows a live countdown or a "cancel free until X" message, that's
>   rendered using the *browser's* real clock, so this approach alone
>   wouldn't catch a UI display bug).
>
> **Approach 2 — Client-side clock stubbing via `cy.clock()` / `cy.tick()`.**
> Freeze or set the browser's `Date`/`Date.now()` to a fixed point before
> interacting with the UI.
> - *Pros:* Tests real-world UI behaviour that depends on "now" (e.g. a
>   displayed cancellation-fee estimate before the user even clicks cancel,
>   or a disabled/enabled cancel button based on time remaining); no
>   dependency on the server implementing a special test-only header.
> - *Cons:* Only affects the browser's JS clock, not the server's clock — so
>   the server-computed fee in the actual API response is *not* controlled by
>   this at all, meaning UI and server could disagree in the test if not also
>   combined with Approach 1; can also unintentionally break unrelated
>   async/polling behaviour in the app if the clock is frozen too broadly.
>
> **Recommendation:** use both together for scenarios that need it — the
> header approach to control the authoritative fee calculation, and clock
> stubbing (scoped narrowly, e.g. only around the moment of assertion) for
> any UI element that independently renders "time until check-in." For this
> assessment specifically, since the spec explicitly calls out the header
> mechanism as the intended tool, I'd lead with Approach 1 for all
> fee-calculation assertions and reserve Approach 2 only if a UI countdown
> element actually exists to test.

---

**Q9.** You need to verify that the pricing grand total displayed in the UI
exactly matches the value calculated by the server. How would you structure
this test to make it robust and maintainable as business rules change?

> Your answer:
>
> - **Don't reimplement the pricing formula inside the test.** Hardcoding an
>   expected dollar figure (or re-deriving the formula in test code) means
>   every business rule change requires updating the test's own math, which
>   is fragile and duplicates logic that should only live in one place (the
>   server). Instead, treat the *server's own response* as the source of
>   truth and assert the UI matches it — a consistency check, not a
>   re-derivation.
> - **Structure:** use `cy.intercept()` to alias the real
>   `POST /api/pricing/calculate` call, let the UI trigger it naturally
>   (e.g. by filling the booking form), `cy.wait('@pricingCalc')`, extract
>   `grandTotal` from the intercepted response body, then compare it against
>   the number parsed out of the UI's displayed total (stripping currency
>   symbols/formatting, normalising to a fixed decimal precision to avoid
>   floating-point string-formatting mismatches like `$450.00` vs `450`).
> - **Keep formula-correctness testing separate.** A distinct, smaller set of
>   tests (ideally API-level, hitting `/api/pricing/calculate` directly with
>   `cy.request()` and fixed, known inputs) should assert the *actual
>   numeric formula* against hand-calculated expected values for each rule
>   (weekend surcharge, promo, group, tax) individually. This separates
>   "does the formula produce the right number" (fragile to rule changes, by
>   design — it *should* fail loudly when rules change) from "does the UI
>   faithfully display whatever the server says" (should remain stable
>   regardless of rule changes, since it's testing a different concern).
> - **Parameterise across scenarios** using a Scenario Outline so this
>   consistency check runs across multiple room/date/promo combinations
>   rather than just one, without needing to touch the test logic itself
>   when new combinations are added — only the Examples table grows.

---

## Section 4 — Strategy

**Q10.** You have 2 hours left in the sprint and your test suite for this
application is only 30% complete. How do you decide which scenarios to
implement first? Walk through your decision-making process.

> Your answer:
>
> 1. **Triage by financial/data-integrity risk first**, using the same
>    ranking as Q3: pricing correctness, then cancellation fees, then
>    booking conflict prevention. I'd make sure at least one solid happy-path
>    and one boundary case exist for each of these three before touching
>    anything else — a shallow safety net across the highest-risk areas beats
>    deep coverage of one low-risk area.
> 2. **Favor API-level tests over full UI E2E tests where the goal is
>    business-logic correctness rather than UI behaviour.** `cy.request()`
>    based tests are faster to write and run, and more stable under time
>    pressure, than driving the full UI through Page Objects — I'd reserve
>    UI-level tests for flows where the interaction itself is what's risky
>    (e.g. form validation messaging), and use API tests to lock in
>    calculation correctness quickly.
> 3. **Skip cosmetic/low-risk UI checks entirely** (styling, non-critical
>    copy, minor layout) — these have low probability of hiding a real
>    business-impacting bug and are the first thing to cut.
> 4. **Reuse existing scaffolding aggressively** — lean on the already-
>    provided page objects and custom commands rather than writing new
>    abstractions, since introducing new patterns under time pressure
>    increases the risk of buggy test code itself.
> 5. **Document what was deliberately left out**, rather than silently
>    leaving gaps. I'd leave a clear comment block (or a follow-up ticket) 
>    listing untested areas and their risk level, so the next person — or
>    reviewer — knows what's covered by design decision vs. what's simply
>    missing.

---

**Q11.** A developer tells you they refactored the pricing engine and "nothing
changed, just cleaner code." What would you do before accepting that claim?

> Your answer:
>
> I would not accept it at face value — "just cleaner code" is a claim about
> intent, not a guarantee about behaviour, and pricing logic is exactly the
> kind of code where a "harmless" reordering can silently change results
> (e.g. changing the order operations are applied in, or introducing a
> different rounding point, can shift the final total by cents even if the
> refactor is logically equivalent on paper).
>
> Concretely, I would:
> 1. **Run the full existing regression suite** (pricing feature file +
>    any API-level formula tests) against the refactored code before merging,
>    not just trust that "the code looks the same."
> 2. **Run a characterization/golden-master comparison**: capture the
>    server's pricing output for a representative matrix of inputs (covering
>    each rule and boundary from Q2/Q6) *before* the refactor, then run the
>    exact same inputs *after* the refactor, and diff the two sets of
>    outputs value-for-value. This catches subtle numeric drift that a
>    pass/fail regression suite with loose assertions might miss.
> 3. **Pay special attention to boundary values specifically** (exact
>    minimum-stay nights, exact weekend transitions, floating-point rounding
>    at each stage of the formula) since that's where refactors most commonly
>    introduce off-by-one or order-of-operations differences.
> 4. **Review the diff itself**, not just test output, looking specifically
>    for any change in the *order* rounding/discounts/taxes are applied,
>    since the spec defines a strict sequence and any reordering there is a
>    correctness bug even if it "looks cleaner."
> 5. Only after all of the above pass would I accept the claim — and even
>    then, I'd ask that the golden-master comparison become a permanent part
>    of the pricing test suite going forward, not a one-off check.

---

**Q12.** How would you structure the test data and test isolation strategy so
that all three feature suites (booking, pricing, cancellation) can run safely
in parallel without interfering with each other?

> Your answer:
>
> 1. **Reset scope per spec file, not globally.** Each feature file's test
>    setup calls `cy.resetApp()` in its own `beforeEach`/`before` hook,
>    scoped to that spec's run — but if specs run truly concurrently across
>    parallel workers sharing one backend instance, a reset from one spec
>    could wipe data another spec is mid-assertion on. I'd flag this as a
>    real constraint of the current app (single shared in-memory/DB state,
>    no per-test-run namespacing) and address it by *not* relying on global
>    resets for isolation between parallel specs — reset once at the start of
>    a full run, then rely on unique data per test rather than repeated wipes
>    mid-run.
> 2. **Give each feature suite its own "namespace" of resources** to avoid
>    collisions even without resets between tests: e.g. booking.feature
>    primarily exercises rooms 101/102, pricing.feature exercises 201/202,
>    cancellation.feature exercises 301 — so even if specs run in parallel,
>    they're not fighting over the same room's availability.
> 3. **Generate unique, non-overlapping data per test** rather than reusing
>    fixed fixtures: unique guest names/emails (e.g. suffixed with a
>    timestamp or Cypress-generated UUID) via `guests.json` as a base
>    template extended per test, and date ranges computed per test (e.g.
>    each test picks a date range offset by its own index) so two tests never
>    accidentally target the identical room+date combination and produce a
>    false conflict.
> 4. **Seed via API (`cy.seedReservation`), never via UI, for setup that
>    isn't the thing being tested.** This keeps each test's precondition
>    fast, explicit, and independent of any other test's side effects, and
>    avoids timing dependencies between tests.
> 5. **No test asserts on the total/global list of reservations** (e.g.
>    "there are exactly 3 reservations") — only on the specific
>    reservation(s) that test itself created, identified by their own unique
>    ID/guest name. This is what actually makes parallel-safety possible:
>    each test's assertions are scoped to data it owns, so it doesn't matter
>    what else exists in the system at the same time.
> 6. If true multi-worker parallel execution against a single shared backend
>    is required, I'd recommend (as a follow-up, not something the current
>    app supports) the backend accept a `test-session` header/token so each
>    CI worker effectively gets its own isolated data partition — this is a
>    known limitation of the current single-instance app design worth
>    documenting rather than silently working around.
