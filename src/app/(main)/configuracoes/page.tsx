// src/app/(main)/configuracoes/page.tsx
"use client"; // Converter para Client Component

import React, { useState } from 'react';
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Palette, KeyRound, Loader2 } from "lucide-react";

export default function ConfiguracoesPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (!currentUser || !currentUser.email) {
      toast({
        title: "Erro",
        description: "Não foi possível identificar o usuário ou email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      toast({
        title: "Email Enviado!",
        description: `Um link para redefinição de senha foi enviado para ${currentUser.email}. Verifique sua caixa de entrada e spam.`,
        className: "bg-success text-success-foreground",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      let errorMessage = "Ocorreu um erro ao enviar o email de redefinição de senha.";
      if (error.code === 'auth/too-many-requests') {
        errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
      }
      toast({
        title: "Erro ao Redefinir Senha",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold font-headline text-primary">Configurações</h1>
        <p className="text-muted-foreground mt-2">Ajuste as preferências do aplicativo.</p>
      </header>
      
      <Card className="bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="mr-2 h-6 w-6 text-primary" />
            Aparência
          </CardTitle>
          <CardDescription>
            Escolha o tema visual do aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      <Card className="bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <KeyRound className="mr-2 h-6 w-6 text-primary" />
            Segurança da Conta
          </CardTitle>
          <CardDescription>
            Gerencie a segurança da sua conta, incluindo a redefinição de senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handlePasswordReset} 
            disabled={isLoading || !currentUser?.email}
            className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Enviando..." : "Enviar Email de Redefinição de Senha"}
          </Button>
          {currentUser?.email && (
            <p className="text-xs text-muted-foreground">
              Será enviado um email para: <span className="font-medium">{currentUser.email}</span>
            </p>
          )}
           {!currentUser?.email && (
            <p className="text-xs text-destructive">
              Email do usuário não disponível para redefinição.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 
      <Card className="bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-6 w-6 text-primary" />
            Notificações
          </CardTitle>
          <CardDescription>
            Gerencie suas preferências de notificação (Em breve).
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[100px] flex items-center justify-center">
          <p className="text-muted-foreground">Configurações de notificação em breve...</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
