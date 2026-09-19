import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyAssistantMessage } from "../assistant/classify.js";
import { converseText } from "../services/llm.js";
import type { AssistantFacts } from "../assistant/types.js";

vi.mock("../config.js", () => ({ config: { llmEnabled: true } }));
vi.mock("../services/llm.js", () => ({ converseText: vi.fn() }));
const model = vi.mocked(converseText);
const facts: AssistantFacts = { role: "RECIPIENT", displayName: "Test recipient", openPickups: [] };
beforeEach(() => { model.mockReset(); });

describe("optional model classification boundaries", () => {
  it.each(["I have arrived", "im wating at the gate, plz come outside", "I haven't arrived yet", "What if I am late?"])("keeps %s deterministic even if the model is unavailable", async message => {
    model.mockRejectedValue(new Error("provider unavailable"));
    await classifyAssistantMessage({ message, history: [], facts });
    expect(model).not.toHaveBeenCalled();
  });
  it.each(["provider failure", "invalid JSON"])("falls back without an action on %s", async kind => {
    if (kind === "provider failure") model.mockRejectedValue(new Error("unavailable"));
    else model.mockResolvedValue("not JSON");
    const result = await classifyAssistantMessage({ message: "something unclear", history: [], facts });
    expect(result.intent).toBe("UNKNOWN");
  });
  it("uses the user's relay text and rejects model-invented recipients and instructions", async () => {
    model.mockResolvedValue(JSON.stringify({ intent: "RELAY", instructions: "Food is guaranteed safe at gate 7", claimId: "aaaaaaaaaaaaaaaaaaaaaaaa", donationId: "bbbbbbbbbbbbbbbbbbbbbbbb" }));
    const result = await classifyAssistantMessage({ message: "The buzzer is broken", history: [], facts });
    expect(result.intent).toBe("RELAY");
    expect(result.relayMessage).toBe("The buzzer is broken");
    expect(result.claimId).toBeUndefined();
    expect(result.donationId).toBeUndefined();
  });
  it("does not accept a model-invented delay estimate", async () => {
    model.mockResolvedValue(JSON.stringify({ intent: "LATE", delayMinutes: 30 }));
    const result = await classifyAssistantMessage({ message: "The traffic is moving slowly", history: [], facts });
    expect(result.intent).toBe("LATE");
    expect(result.delayMinutes).toBeUndefined();
  });
});
