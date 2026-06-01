import { describe, expect, it } from "vitest";

import { buildEmailReturnEvent } from "./return-tracking";

describe("email return tracking", () => {
  it("builds a PostHog event from Resend email UTM params", () => {
    const event = buildEmailReturnEvent(
      new URLSearchParams(
        "utm_source=resend&utm_medium=email&utm_campaign=inactivity_3d&notura_email=inactivity_3d"
      )
    );

    expect(event).toEqual({
      event: "email_returned_to_app",
      properties: {
        campaign: "inactivity_3d",
        email_type: "inactivity_3d",
        source: "resend",
        medium: "email",
      },
    });
  });

  it("ignores non-email traffic", () => {
    expect(
      buildEmailReturnEvent(new URLSearchParams("utm_source=google&utm_medium=cpc"))
    ).toBeNull();
  });
});
