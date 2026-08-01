# Source-first A1 repair

This repair removes three user-visible failures from the PHX inspection build.

## Root causes

- The equipment screen only offered training, so free-drive inspection was discoverable only after entering the simulator.
- The Terminal 4 preparation pass stamped the same synthetic seven-meter lower-facade module across many gates, visibly repeating the building base instead of preserving the converted source model.
- Gate A1 was aimed at a broad BGATE wall coordinate roughly 30 meters diagonally from the rotunda. Direct inspection of the converted Terminal 4 triangles found the actual T4_WALK portal 9.15857013 meters directly behind the authored A1 jetway root.

## Repair contract

- Offer separate `Start training` and `Drive tug / inspect airport` launch actions.
- Enter free-drive automatically when the inspection action is selected.
- Keep the converted source terminal as the sole lower-facade authority; do not generate cloned bay, door, or vent modules.
- Fit A1 to the measured source T4_WALK portal at X `-30.16857013`, preserving the authored A1 Z station.
- Do not promote until the production browser evidence visibly shows A1 touching the fixed walkway and no cloned lower-facade modules.
