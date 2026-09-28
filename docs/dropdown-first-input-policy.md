# Dropdown-first input policy

AAS uses dropdown-first controls for values that can be represented by reusable presets.

## Rules

- Categorical choices should use a select control.
- Preset-able numeric values should use a select control.
- Each non-closed preset list must provide `その他・自由入力`.
- Closed system enums remain fixed selects when unsupported custom values would be invalid.
- Inherently unique content stays as direct input: titles, URLs, API keys, IDs, body text, descriptions, reference text, and exact dates/times.
- Custom values must survive wizard persistence, URL handoff, reload, and cloud edit round-trips where applicable.
- A preset conversion must not change the stored value unless the user actually chooses or types a new value.

## Covered surfaces

- Article creation: target length and illustration count.
- Article library: publication target, genre, subgenre, paid price, magazine order.
- Content workflow: SNS target length, delay, series audience, purpose, monetization, article count.
- Action Prompt Library: admin-defined field choices, audience/goal presets, side-hustle selection, category icon/order/version.
- Knowledge automation: AI model and per-run candidate limit.
- Membership management: monthly price.
- Admin access codes: sales channel and maximum uses.
- Existing side-hustle wizards and free-plan controls retain their prior dropdown/custom behavior.

Unique or secret values are deliberately not converted to dropdowns.

Validation rerun after access-code import fix.

Validation rerun after effect-free custom-mode fix.
