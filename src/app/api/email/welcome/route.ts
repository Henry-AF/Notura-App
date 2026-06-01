import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { sendWelcomeEmailOnce } from "@/lib/email/delivery";

function readName(metadata: Record<string, unknown> | undefined): string | null {
  const fullName = metadata?.full_name;
  return typeof fullName === "string" && fullName.trim() ? fullName : null;
}

export const POST = withAuth<Record<string, never>, Request>(async (_request, { auth }) => {
  const email = auth.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "Authenticated user does not have an email." },
      { status: 400 }
    );
  }

  const result = await sendWelcomeEmailOnce({
    userId: auth.user.id,
    email,
    name: readName(auth.user.user_metadata),
  });

  return NextResponse.json({ status: result.status });
});
