import { describe, expect, it } from "vitest";
import { classifyWithKeywords } from "../assistant/classify.js";
import { isChatCancelPhrase, isChatConfirmPhrase, parseDelayMinutes } from "../assistant/detect.js";
import { sanitizeInstructions, sanitizeRelayMessage, stripPickupCodes } from "../assistant/copy.js";

describe("pickup conversation scenarios", () => {
  it.each([
    ["I’ve arrived at the door", "ARRIVED"],
    ["im here", "ARRIVED"],
    ["I have reachd the location", "ARRIVED"],
    ["we are at the east gate", "ARRIVED"],
    ["I've arived", "ARRIVED"],
    ["I have reached the location, please come to the gate", "RELAY"],
    ["im wating outside, plz open the east gate", "RELAY"],
    ["the gate is locked", "RELAY"],
    ["I can't find the donor", "RELAY"],
    ["I am here but nobody is here", "RELAY"],
    ["message the donor that I am outside gate 2", "RELAY"],
    ["Please let the donor know I am at reception", "RELAY"],
    ["I will arrive in ten minutes", "RELAY"],
    ["I am running twenty minutes late", "LATE"],
    ["I am 10 minutes late, please wait at the east gate", "RELAY"],
    ["I was late but I have arrived now", "RELAY"],
    ["I'm stuck in traffic", "LATE"],
  ])("classifies %s as %s", (message, intent) => {
    expect(classifyWithKeywords(message, [], "RECIPIENT").intent).toBe(intent);
  });

  it.each([
    "The donor is late", "She has arrived", "I haven't arrived yet", "I'm not at the gate", "I am not late", "I never reached the pickup",
    "What if I am late?", "Has the donor arrived?", "When I have reached, what should I do?",
    "If I arrived late would I lose the food?", "I will have arrived by then", "When should I arrive?",
  ])("does not propose an action for %s", message => {
    expect(["LATE", "ARRIVED", "RELAY", "UPDATE_INSTRUCTIONS"]).not.toContain(classifyWithKeywords(message, [], "RECIPIENT").intent);
  });

  it.each(["send it", "yes, send it!", "confirm", "go ahead", "yes please", "OK", "please send the message", "sure, do it"])("accepts explicit approval: %s", message => {
    expect(isChatConfirmPhrase(message)).toBe(true);
  });
  it.each(["yes but use the other gate", "send it tomorrow", "don't send it", "send it?", "should I confirm", "please notify him", "yes inform her then notify her", "send that I have reached", "confirm pickup", "sendd it"])("does not treat %s as approval", message => {
    expect(isChatConfirmPhrase(message)).toBe(false);
  });
  it.each(["no", "nope", "not yet", "wait", "hold on", "don't send it", "don’t send it yet", "do not send", "cancel the message", "never mind", "no, cancel it"])("cancels a draft for %s", message => {
    expect(isChatCancelPhrase(message)).toBe(true);
  });
  it.each(["cancel my pickup", "no, use the east gate", "don't leave food with the guard", "no one is here"])("does not confuse %s with cancelling a draft", message => {
    expect(isChatCancelPhrase(message)).toBe(false);
  });
  it.each([
    ["20 minutes", 20], ["twenty one minutes", 21], ["an hour", 60], ["one hundred minutes", undefined], ["- 10 minutes", undefined], ["twenty-five minutes", 25], ["half an hour", 30], ["one hour", 60],
    ["1.5 hours", 90], ["fifteen mins", 15], ["180 minutes", 180],
    ["late", undefined], ["-10 minutes", undefined], ["0 minutes", undefined], ["200 minutes", undefined],
    ["10-20 minutes", undefined], ["between 10 and 20 minutes", undefined], ["10 minutes or 20 minutes", undefined],
  ])("parses the stated delay in %s", (message, minutes) => {
    expect(parseDelayMinutes(message)).toBe(minutes);
  });

  it("preserves directions, negation, and future tense instead of inventing a guard handoff", () => {
    const instructions = "Don't leave food with the guard. I will bring it to the east gate in 5 minutes.";
    expect(sanitizeInstructions(instructions)).toBe(instructions);
    const relay = "I am at gate 2, not the main gate. Please come to gate 2.";
    expect(sanitizeRelayMessage(relay)).toBe(relay);
  });
  it("removes every pickup code from a message", () => {
    expect(stripPickupCodes("ST-1234 and FR-4321 and st-9876")).not.toMatch(/(?:ST|FR)-\d{4}/i);
  });
  it("does not turn the donor asking about a late recipient into the donor being late", () => {
    expect(classifyWithKeywords("Ask her if she is running late", [], "DONOR").intent).toBe("RELAY");
  });
});
