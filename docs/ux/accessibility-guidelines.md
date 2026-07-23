# Archon IDE UX & Accessibility Guidelines

## Product Truth Principles
1. **Never imply a capability that is absent.**
2. **Workspace Isolation:** Do not claim workspaces are isolated until the backend guarantees it. Use wording like "coming next" or "requires a connected workspace".
3. **Authentication:** Do not imply that GitHub authentication grants repository access. Clearly state "No repo access" during sign in.
4. **Imports:** Do not present browser folder selection as a working cloud import. Cloud sync features require secure workspace provisioning.
5. **Connectors:** Do not promise a connector is linked merely because it is planned.
6. **Mocks:** Do not call mock responses real analysis. Ensure it is clearly labeled as a simulated demo.

## Accessibility Requirements
- **Keyboard Navigation:** All interactive elements (buttons, inputs) must be focusable via `tabindex` or appropriate semantic HTML (`<button>`, `<a>`, `<input>`).
- **Focus States:** Must have highly visible focus states (e.g. `focus-visible:outline` with an offset).
- **ARIA Attributes:** Use `aria-label`, `aria-checked`, `aria-current="step"`, etc. for dynamic state tracking, especially custom radiogroups and tab lists.
- **Screen Reader Support:** Add `.sr-only` utility classes for context where visual cues aren't sufficient.
