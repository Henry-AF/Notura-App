"use client";

import React, { useState } from "react";
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Profile state
  const [name, setName] = useState("Henry Mano");
  const [role, setRole] = useState("rh");
  const [company, setCompany] = useState("Notura");

  // WhatsApp state
  const [whatsappNumber, setWhatsappNumber] = useState("+55 (11) 99988-7766");
  const [whatsappConnected] = useState(true);
  const [testSending, setTestSending] = useState(false);

  // Notifications state
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);

  // Plan mock data
  const planName = "Pro";
  const meetingsUsed = 12;
  const meetingsLimit = 30;
  const usagePercent = Math.round((meetingsUsed / meetingsLimit) * 100);

  const handleTestWhatsapp = () => {
    setTestSending(true);
    setTimeout(() => setTestSending(false), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-notura-ink">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-notura-secondary">
          Gerencie seu perfil, integrações e plano
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {/* ─── 1. Profile ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-notura-secondary" />
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-notura-ink">
                  Cargo / Área
                </label>
                <Select value={role} onValueChange={setRole}>
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
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <Button size="sm">Salvar</Button>
          </CardContent>
        </Card>

        {/* ─── 2. WhatsApp ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-violet-600" />
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
                  onChange={(e) => setWhatsappNumber(e.target.value)}
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
                <Send className="h-3.5 w-3.5" />
                {testSending ? "Enviando..." : "Testar envio"}
              </Button>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  whatsappConnected ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              <span className="text-sm text-notura-ink">
                {whatsappConnected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ─── 3. Plan ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-notura-secondary" />
              Plano
            </CardTitle>
            <CardDescription>
              Seu plano atual e uso do mês
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                  <span className="font-display text-sm font-bold text-violet-700">
                    {planName[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-notura-ink">
                    Plano {planName}
                  </p>
                  <p className="text-xs text-notura-secondary">
                    R$ 79/mês
                  </p>
                </div>
              </div>
              <Badge variant="completed">{planName}</Badge>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-secondary">
                  {meetingsUsed} de {meetingsLimit} reuniões este mês
                </span>
                <span className="font-medium text-notura-ink">
                  {usagePercent}%
                </span>
              </div>
              <Progress value={usagePercent} className="mt-2" />
            </div>

            <Button variant="secondary" size="sm" className="gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Gerenciar plano
            </Button>
          </CardContent>
        </Card>

        {/* ─── 4. Notifications ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-notura-secondary" />
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
                onCheckedChange={setNotifyWhatsapp}
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
                onCheckedChange={setNotifyEmail}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── 5. Integrations ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-notura-secondary" />
              Integrações
            </CardTitle>
            <CardDescription>
              Conecte suas ferramentas favoritas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Zoom */}
            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Video className="h-4.5 w-4.5 text-blue-600" />
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

            {/* Google Calendar */}
            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                  <CalendarIcon className="h-4.5 w-4.5 text-red-600" />
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

            {/* Slack */}
            <div className="flex items-center justify-between rounded-md px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <Hash className="h-4.5 w-4.5 text-purple-600" />
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
