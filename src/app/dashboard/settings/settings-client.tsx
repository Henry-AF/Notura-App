"use client";

import React, { useReducer } from "react";
import {
  User,
  MessageCircle,
  CreditCard,
  Bell,
  Plug,
  Video,
  Calendar as CalendarIcon,
  Hash,
  ExternalLink,
  Send,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { presentPlanCard } from "./plan-presenter";

interface SettingsProfileState {
  name: string;
  role: string | null;
  company: string;
  whatsappNumber: string;
}

interface SettingsPlanState {
  plan: string | null;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}

export interface SettingsClientProps {
  initialProfile: SettingsProfileState;
  initialPlan: SettingsPlanState;
}

function getInitialRole(role: string | null) {
  if (
    role === "rh" ||
    role === "juridico" ||
    role === "administrativo" ||
    role === "outro"
  ) {
    return role;
  }

  return "outro";
}

type SettingsClientState = {
  name: string;
  role: string;
  company: string;
  whatsappNumber: string;
  whatsappConnected: boolean;
  testSending: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
};

type SettingsClientAction =
  | { type: "fieldChanged"; field: "name" | "role" | "company" | "whatsappNumber"; value: string }
  | { type: "testSendingChanged"; value: boolean }
  | { type: "notifyWhatsappChanged"; value: boolean }
  | { type: "notifyEmailChanged"; value: boolean };

function settingsClientReducer(
  state: SettingsClientState,
  action: SettingsClientAction
): SettingsClientState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "testSendingChanged":
      return { ...state, testSending: action.value };
    case "notifyWhatsappChanged":
      return { ...state, notifyWhatsapp: action.value };
    case "notifyEmailChanged":
      return { ...state, notifyEmail: action.value };
  }
}

export function SettingsClient({
  initialProfile,
  initialPlan,
}: SettingsClientProps) {
  const [state, dispatch] = useReducer(settingsClientReducer, {
    name: initialProfile.name,
    role: getInitialRole(initialProfile.role),
    company: initialProfile.company,
    whatsappNumber: initialProfile.whatsappNumber,
    whatsappConnected: Boolean(initialProfile.whatsappNumber),
    testSending: false,
    notifyWhatsapp: true,
    notifyEmail: false,
  });
  const {
    name,
    role,
    company,
    whatsappNumber,
    whatsappConnected,
    testSending,
    notifyWhatsapp,
    notifyEmail,
  } = state;

  const planCard = presentPlanCard(initialPlan);
  const planInitial = planCard.badgeLabel[0] ?? "A";

  const handleTestWhatsapp = () => {
    dispatch({ type: "testSendingChanged", value: true });
    window.setTimeout(
      () => dispatch({ type: "testSendingChanged", value: false }),
      2000
    );
  };

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-notura-ink">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-notura-secondary">
          Gerencie seu perfil, integrações e plano
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5 text-notura-secondary" />
              Perfil
            </CardTitle>
            <CardDescription>
              Informações pessoais e da sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-notura-ink">
                  Nome
                </label>
                <Input
                  value={name}
                  onChange={(e) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "name",
                      value: e.target.value,
                    })
                  }
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-notura-ink">
                  Cargo / Área
                </label>
                <Select
                  value={role}
                  onValueChange={(value) =>
                    dispatch({ type: "fieldChanged", field: "role", value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rh">RH</SelectItem>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                    <SelectItem value="administrativo">
                      Administrativo
                    </SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-notura-ink">
                Empresa
              </label>
              <Input
                value={company}
                onChange={(e) =>
                  dispatch({
                    type: "fieldChanged",
                    field: "company",
                    value: e.target.value,
                  })
                }
                placeholder="Nome da empresa"
              />
            </div>
            <Button size="sm">Salvar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-violet-600" />
              WhatsApp
            </CardTitle>
            <CardDescription>
              Número para receber resumos das reuniões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-notura-ink">
                  Número do WhatsApp
                </label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "whatsappNumber",
                      value: e.target.value,
                    })
                  }
                  placeholder="+55 (11) 99999-9999"
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                className="gap-2"
                onClick={handleTestWhatsapp}
                disabled={testSending}
              >
                <Send className="size-3.5" />
                {testSending ? "Enviando..." : "Testar envio"}
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  whatsappConnected ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              <span className="text-sm text-notura-ink">
                {whatsappConnected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-notura-secondary" />
              Plano
            </CardTitle>
            <CardDescription>
              Seu plano atual e uso do mês
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100">
                  <span className="font-display text-sm font-bold text-violet-700">
                    {planInitial}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-notura-ink">{planCard.title}</p>
                  {planCard.priceLabel ? (
                    <p className="text-xs text-notura-secondary">
                      {planCard.priceLabel}
                    </p>
                  ) : null}
                </div>
              </div>
              <Badge variant="completed">{planCard.badgeLabel}</Badge>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-notura-secondary">
                  {planCard.usageLabel}
                </span>
                {planCard.usageValueLabel ? (
                  <span className="shrink-0 font-medium text-notura-ink">
                    {planCard.usageValueLabel}
                  </span>
                ) : null}
              </div>
              {planCard.showProgress && planCard.progressValue !== null ? (
                <Progress value={planCard.progressValue} className="mt-2" />
              ) : null}
            </div>

            <Button variant="secondary" size="sm" className="gap-2">
              <ExternalLink className="size-3.5" />
              Gerenciar plano
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-notura-secondary" />
              Notificações
            </CardTitle>
            <CardDescription>
              Como você deseja receber atualizações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-notura-ink">
                  Receber resumo no WhatsApp
                </p>
                <p className="text-xs text-notura-secondary">
                  Enviar automaticamente após processar a reunião
                </p>
              </div>
              <Switch
                checked={notifyWhatsapp}
                onCheckedChange={(value) =>
                  dispatch({
                    type: "notifyWhatsappChanged",
                    value: Boolean(value),
                  })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-notura-ink">
                  Receber email como backup
                </p>
                <p className="text-xs text-notura-secondary">
                  Cópia do resumo enviada para seu email
                </p>
              </div>
              <Switch
                checked={notifyEmail}
                onCheckedChange={(value) =>
                  dispatch({ type: "notifyEmailChanged", value: Boolean(value) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-5 text-notura-secondary" />
              Integrações
            </CardTitle>
            <CardDescription>
              Conecte suas ferramentas favoritas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
                  <Video className="size-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-notura-ink">Zoom</p>
                  <p className="text-xs text-notura-secondary">
                    Importar gravações automaticamente
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm">
                Conectar
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-red-50">
                  <CalendarIcon className="size-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-notura-ink">
                    Google Calendar
                  </p>
                  <p className="text-xs text-notura-secondary">
                    Sincronizar reuniões automaticamente
                  </p>
                </div>
              </div>
              <Badge variant="default">Em breve</Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-purple-50">
                  <Hash className="size-4.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-notura-ink">Slack</p>
                  <p className="text-xs text-notura-secondary">
                    Enviar resumos para canais
                  </p>
                </div>
              </div>
              <Badge variant="default">Em breve</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
