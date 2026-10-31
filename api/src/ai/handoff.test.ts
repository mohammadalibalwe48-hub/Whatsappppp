import { describe, expect, it } from "vitest";
import { detectHumanHandoffRequest, handoffResumeMode } from "./handoff";

describe("detectHumanHandoffRequest", () => {
  it.each([
    "I want to speak to a real person",
    "Can I talk to an agent, please?",
    "Please transfer me to a human",
    "I need a representative",
    "human please",
    "agent",
    "Get me a person",
    "No, I want an actual person"
  ])("recognizes a clear request: %s", (message) => {
    expect(detectHumanHandoffRequest(message)).toBe("Customer requested a human reply");
  });

  it.each([
    "I don't want to talk to a human",
    "Do not connect me to an agent",
    "No human, please",
    "I am a human customer",
    "What is a human resources policy?"
  ])("does not misclassify: %s", (message) => {
    expect(detectHumanHandoffRequest(message)).toBeNull();
  });

  it("restores selected chats as enabled and otherwise returns to inherit", () => {
    expect(handoffResumeMode("enabled")).toBe("enabled");
    expect(handoffResumeMode("inherit")).toBe("inherit");
    expect(handoffResumeMode(null)).toBe("inherit");
  });
});
