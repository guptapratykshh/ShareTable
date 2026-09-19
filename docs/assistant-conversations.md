# Assistant conversation behavior

The assistant supports English pickup questions and four reviewed updates: LATE, UPDATE_INSTRUCTIONS, ARRIVED, and RELAY. This is application-level routing, clarification, and regression coverage; it does not fine-tune a model or promise to understand every phrasing.

## Conversation examples

| Conversation | Expected behavior |
| --- | --- |
| “I have reached the location, please come to the gate” → “send it” | Preview the relay, then notify the donor after confirmation. |
| “im wating outside, plz open the east gate” | Recognize common typing variants and retain the named gate in the preview. |
| “I've arrived” | Preview an arrival announcement. |
| “I haven't arrived yet” | Do not announce arrival; withdraw any pending update. |
| “What if I am late?” | Answer or clarify; do not propose a current delay. |
| “I'm running late” → “twenty-five minutes” → “yes please” | Ask for the estimate, preview 25 minutes, then send. |
| “I'll arrive in ten minutes” | Relay the stated ETA; do not invent that it is ten minutes after the deadline. |
| “10 minutes late” → “actually 20 minutes” | Replace the preview and require a fresh confirmation. The old confirmation ID stops working. |
| “yes, but I am at the east gate instead” | Revise the draft; this is not approval to send. |
| “no”, “hold on”, “not yet”, “don't send it” | Cancel the pending message without sending. |
| “cancel my pickup” | Explain where to cancel the pickup; do not claim to have cancelled the reservation. |
| “please notify him” | Re-propose the current note, or reuse the latest relevant user note. Still requires confirmation. |
| Multiple open pickups | Ask for a number or food name before offering a send confirmation. |
| Closed or foreign claim explicitly selected | Refuse that target; never silently select another pickup. |
| Expired preview → “send it” | Ask for a new preview; never send from chat history alone. |
| Simultaneous button/chat confirmations | Share one in-flight execution in the current server process. |
| “don't collect from the guard; use the east gate” | Preserve the negation and named gate rather than replacing them with generic instructions. |

## Boundaries

- Confirmation is handled on the server. The browser supplies the pending ID it displayed, including explicit `null` when it has no preview. The Confirm button uses the same execution function.
- Missing or conflicting delay estimates require clarification. Accepted numeric delay estimates are 1–180 minutes; the assistant does not silently clamp them or assume ten minutes.
- Keyword routing handles common pickup flows without a model. The optional model can suggest an intent for unfamiliar text, but cannot supply the outgoing message, invented delay numbers, or a recipient ID. Outgoing action content comes from the user's message and is shown before sending.
- Pickup-code filtering removes every ST-/FR- code occurrence. Existing donor-declared allergen and food-category answers remain in place.
- Notification-status answers use recorded pickup-update notifications sent to the other participant, not listing or claim alerts.
- Pending actions and clarification state are user-scoped, in memory, with a ten-minute lifetime. They are not durable across restarts and are not shared across server instances. In-flight deduplication is also process-local. Durable storage and distributed delivery guarantees are separate work.
- Clock-time ETA calculations retain the existing server-timezone behavior. Relative ETA messages preserve the user's wording.

## Verification

Run the language, model-boundary, and API conversation checks:

```sh
npm test -- src/tests/assistant-language.test.ts src/tests/assistant-llm.test.ts src/tests/assistant.test.ts
```

Model-boundary checks use a mock provider, including unavailable and malformed responses; API tests use an isolated MongoDB memory server and disable the LLM. These tests do not validate live provider quality or production deployment configuration.
