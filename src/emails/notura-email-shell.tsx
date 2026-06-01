import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import * as React from "react";
import type { ReactNode } from "react";

interface NoturaEmailShellProps {
  preview: string;
  title: string;
  children: ReactNode;
}

export function NoturaEmailShell({
  preview,
  title,
  children,
}: NoturaEmailShellProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Text style={brandStyle}>Notura</Text>
          <Heading style={headingStyle}>{title}</Heading>
          <Section>{children}</Section>
          <Text style={footerStyle}>
            Notura organiza reuniões em resumos, decisões, tarefas e próximos passos.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} style={buttonStyle}>
      {children}
    </Link>
  );
}

export const paragraphStyle = {
  color: "#243047",
  fontFamily: "Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const bodyStyle = {
  backgroundColor: "#f6f7fb",
  margin: 0,
  padding: "32px 12px",
};

const containerStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7eaf0",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const brandStyle = {
  color: "#0f766e",
  fontFamily: "Arial, sans-serif",
  fontSize: "14px",
  fontWeight: "700",
  letterSpacing: "0",
  margin: "0 0 20px",
};

const headingStyle = {
  color: "#111827",
  fontFamily: "Arial, sans-serif",
  fontSize: "26px",
  lineHeight: "32px",
  margin: "0 0 20px",
};

const buttonStyle = {
  backgroundColor: "#0f766e",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontFamily: "Arial, sans-serif",
  fontSize: "15px",
  fontWeight: "700",
  marginTop: "8px",
  padding: "12px 18px",
  textDecoration: "none",
};

const footerStyle = {
  color: "#6b7280",
  fontFamily: "Arial, sans-serif",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "28px 0 0",
};
