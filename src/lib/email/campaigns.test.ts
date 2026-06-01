import { describe, expect, it } from "vitest";

import {
  buildInactivityEmailCampaign,
  buildWelcomeEmailCampaign,
  estimateMeetingMinutesSaved,
} from "./campaigns";

describe("email campaigns", () => {
  it("builds the welcome campaign with a tracked first-meeting CTA", () => {
    const campaign = buildWelcomeEmailCampaign({
      appUrl: "https://app.notura.test",
      name: "Ana",
    });

    expect(campaign.emailType).toBe("welcome");
    expect(campaign.campaign).toBe("welcome");
    expect(campaign.subject).toContain("Bem-vindo");
    expect(campaign.preview).toContain("primeira reunião");
    expect(campaign.ctaUrl).toBe(
      "https://app.notura.test/dashboard/recording?utm_source=resend&utm_medium=email&utm_campaign=welcome&notura_email=welcome"
    );
  });

  it("summarizes quota and saved time for active users", () => {
    const campaign = buildInactivityEmailCampaign({
      appUrl: "https://app.notura.test",
      name: "Ana",
      meetingsUsed: 4,
      quotaLimit: 10,
    });

    expect(campaign.emailType).toBe("inactivity_3d");
    expect(campaign.campaign).toBe("inactivity_3d");
    expect(campaign.quotaRemaining).toBe(6);
    expect(campaign.quotaCopy).toContain("6 reuniões restantes");
    expect(campaign.savedTimeCopy).toContain("4 reuniões processadas");
    expect(campaign.savedTimeCopy).toContain("1 hora e 20 minutos");
    expect(campaign.upgradeCopy).toBeNull();
    expect(campaign.ctaUrl).toBe(
      "https://app.notura.test/dashboard/recording?utm_source=resend&utm_medium=email&utm_campaign=inactivity_3d&notura_email=inactivity_3d"
    );
  });

  it("asks exhausted users to choose a plan", () => {
    const campaign = buildInactivityEmailCampaign({
      appUrl: "https://app.notura.test",
      name: null,
      meetingsUsed: 3,
      quotaLimit: 3,
    });

    expect(campaign.quotaRemaining).toBe(0);
    expect(campaign.quotaCopy).toContain("cota atual acabou");
    expect(campaign.upgradeCopy).toContain("escolha um plano");
    expect(campaign.ctaLabel).toBe("Escolher um plano");
    expect(campaign.ctaUrl).toBe(
      "https://app.notura.test/dashboard/settings?utm_source=resend&utm_medium=email&utm_campaign=inactivity_3d&notura_email=inactivity_3d"
    );
  });

  it("estimates 20 minutes saved per processed meeting", () => {
    expect(estimateMeetingMinutesSaved(0)).toBe(0);
    expect(estimateMeetingMinutesSaved(3)).toBe(60);
  });
});
