// src/app/(main)/planejamento/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Utensils, Sparkles, Loader2, AlertTriangle, History, CalendarDays, Hourglass } from "lucide-react";
import MealPlannerForm from '@/components/MealPlannerForm';
import MealPlanDisplay from '@/components/MealPlanDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, type UserProfile } from '@/actions/userProfileActions';
import { 
  createAIMealPlanRequest, 
  getAIMealPlanRequestHistory,
  countTodaysMealPlanRequests
  // processMealPlanRequestAction, // Removido: não será chamado automaticamente
} from '@/actions/mealPlanActions';
import type { DailyMealPlan } from '@/ai/flows/generate-meal-plan-flow'; 
import type { ClientAIMealPlanRequest, AIMealPlanRequest } from '@/actions/aiMealPlanRequestTypes';
import { toClientAIMealPlanRequest } from '@/actions/aiMealPlanRequestTypes';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot, Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';

const DAILY_MEAL_PLAN_LIMIT = 3;

export default function PlanejamentoPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isProcessingRequest, setIsProcessingRequest] = useState(false); // Usado para o momento da criação da solicitação
  const [currentMealPlanRequest, setCurrentMealPlanRequest] = useState<ClientAIMealPlanRequest | null>(null);
  const [mealPlanHistory, setMealPlanHistory] = useState<ClientAIMealPlanRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const [showForm, setShowForm] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [todaysRequestsCount, setTodaysRequestsCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false); // Potencialmente usado se carregarmos um plano existente

  const fetchInitialData = useCallback(async () => {
    if (!currentUser) {
      setIsFetchingProfile(false);
      setIsLoadingHistory(false);
      setIsLoadingCount(false);
      return;
    }

    setIsFetchingProfile(true);
    getUserProfile(currentUser.uid)
      .then(profile => setUserProfile(profile))
      .catch(err => {
        console.error("Failed to fetch user profile", err);
        toast({ title: "Erro", description: "Não foi possível carregar seu perfil.", variant: "destructive" });
      })
      .finally(() => setIsFetchingProfile(false));

    setIsLoadingHistory(true);
    getAIMealPlanRequestHistory(currentUser.uid)
      .then(history => setMealPlanHistory(history))
      .catch(err => {
        console.error("Failed to fetch meal plan history", err);
        toast({ title: "Erro", description: "Não foi possível carregar o histórico de cardápios.", variant: "destructive" });
      })
      .finally(() => setIsLoadingHistory(false));

    setIsLoadingCount(true);
    countTodaysMealPlanRequests(currentUser.uid)
      .then(count => setTodaysRequestsCount(count))
      .catch(err => {
        console.error("Failed to count today's requests", err);
      })
      .finally(() => setIsLoadingCount(false));

  }, [currentUser, toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    // Listener para a solicitação ATUAL (se houver uma e estiver pendente/processando)
    if (currentUser && currentMealPlanRequest?.id && (currentMealPlanRequest.status === 'pending' || currentMealPlanRequest.status === 'processing')) {
      const requestDocRef = doc(db, 'ai_meal_plan_requests', currentMealPlanRequest.id);
      unsubscribe = onSnapshot(requestDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
           if (data && data.createdAt instanceof Timestamp && data.updatedAt instanceof Timestamp) {
            const firestoreData = data as Omit<AIMealPlanRequest, 'id'>;
            const clientData = toClientAIMealPlanRequest(docSnap.id, firestoreData);
            setCurrentMealPlanRequest(clientData); // Atualiza o estado da solicitação atual

            if (clientData.status === 'completed') {
              toast({ title: "Cardápio Gerado!", description: "Seu cardápio personalizado está pronto.", className: "bg-success text-success-foreground" });
              fetchInitialData(); // Recarrega o histórico
              setShowForm(false); // Esconde o formulário para mostrar o plano
              // isProcessingRequest já deve ser false ou será tornado false pelo listener de 'completed'
              if (unsubscribe) unsubscribe();
            } else if (clientData.status === 'error') {
              toast({ title: "Erro ao Gerar Cardápio", description: clientData.error || "Ocorreu um erro no servidor.", variant: "destructive" });
              fetchInitialData(); // Recarrega o histórico
              if (unsubscribe) unsubscribe();
            }
            // Se ainda 'pending' ou 'processing', o estado é atualizado, mas não há ação específica aqui.
          } else {
             console.warn("Meal plan request document data is malformed or missing Timestamps:", docSnap.id, JSON.stringify(data, null, 2));
          }
        } else {
          toast({ title: "Erro", description: "Solicitação de cardápio não encontrada.", variant: "destructive" });
          setCurrentMealPlanRequest(null);
          fetchInitialData();
          if (unsubscribe) unsubscribe();
        }
      }, (error) => {
        console.error("Error listening to meal plan request:", error);
        toast({ title: "Erro de Conexão", description: "Não foi possível ouvir as atualizações do cardápio.", variant: "destructive" });
        setCurrentMealPlanRequest(prev => prev ? {...prev, status: 'error', error: 'Erro de conexão'} : null);
        fetchInitialData();
        if (unsubscribe) unsubscribe();
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentMealPlanRequest?.id, currentMealPlanRequest?.status, currentUser, toast, fetchInitialData]);

  const handleRequestMealPlan = async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Atenção", description: "Perfil do usuário não carregado.", variant: "destructive" });
      return;
    }
    if (!userProfile.mealPreferences || Object.values(userProfile.mealPreferences).every(val => !val)) {
       toast({ title: "Preferências Necessárias", description: "Por favor, salve suas preferências alimentares.", variant: "destructive" });
       setShowForm(true);
       return;
    }
    if (todaysRequestsCount >= DAILY_MEAL_PLAN_LIMIT) {
      toast({ title: "Limite Atingido", description: `Você já gerou ${DAILY_MEAL_PLAN_LIMIT} cardápios hoje. Tente novamente amanhã.`, variant: "destructive" });
      return;
    }

    setIsProcessingRequest(true); // Indica que a operação de criação está em andamento
    setCurrentMealPlanRequest(null); // Limpa o cardápio anterior
    
    try {
      const requestId = await createAIMealPlanRequest(currentUser.uid, userProfile.mealPreferences, 3);
      // Define a solicitação atual como pendente para que o listener possa pegá-la
      setCurrentMealPlanRequest({ 
        id: requestId,
        userId: currentUser.uid,
        userInput: { 
            dietType: userProfile.mealPreferences.dietType,
            foodIntolerances: userProfile.mealPreferences.foodIntolerances,
            calorieGoal: userProfile.mealPreferences.calorieGoal,
            numberOfDays: 3,
        },
        status: 'pending', 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Solicitação Enviada!", description: "Seu pedido de cardápio está pendente e será processado." });
      
      // NÃO chama processMealPlanRequestAction aqui
      
      setTodaysRequestsCount(prev => prev + 1);
      fetchInitialData(); // Atualiza o histórico para mostrar a nova entrada pendente
      setShowForm(false); // Esconde o formulário, mostra mensagem de pendente

    } catch (error: any) {
      console.error("Error creating AI meal plan request", error);
      toast({ title: "Erro na Solicitação", description: error.message || "Não foi possível solicitar o cardápio.", variant: "destructive" });
      setCurrentMealPlanRequest(null);
    } finally {
      setIsProcessingRequest(false); // Finaliza o estado de "criando solicitação"
    }
  };
  
  const handlePreferencesSaved = async () => {
    if (currentUser) {
      setIsFetchingProfile(true); 
      try {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        toast({title: "Preferências Salvas", description: "Agora você pode gerar seu cardápio."});
      } catch (error) {
         toast({title: "Erro", description: "Não foi possível recarregar o perfil.", variant: "destructive"});
      } finally {
        setIsFetchingProfile(false);
      }
    }
  };
  
  const handleEditPreferences = () => {
    setShowForm(true); 
    setCurrentMealPlanRequest(null); // Limpa o cardápio atual ao editar preferências
  };

  const canGenerate = !isLoadingCount && todaysRequestsCount < DAILY_MEAL_PLAN_LIMIT;
  const generatedMealPlan = currentMealPlanRequest?.status === 'completed' ? currentMealPlanRequest.mealPlanOutput?.mealPlan : null;
  const mealPlanDisclaimer = currentMealPlanRequest?.status === 'completed' ? currentMealPlanRequest.mealPlanOutput?.disclaimer : null;

  const getStatusBadgeVariant = (status: ClientAIMealPlanRequest['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'error': return 'destructive';
      case 'pending': case 'processing': return 'secondary'; 
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold font-headline text-primary">Planejamento de Refeições</h1>
        <p className="text-muted-foreground mt-2">
          Defina suas preferências para que a IA personalize um plano alimentar. 
          Você pode gerar até {DAILY_MEAL_PLAN_LIMIT} cardápios por dia.
          {!isLoadingCount && ` (${DAILY_MEAL_PLAN_LIMIT - todaysRequestsCount} restantes hoje)`}
        </p>
      </header>
      
      {(isFetchingProfile || isLoadingCount) && (
         <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Carregando dados...</div>
      )}

      {!isFetchingProfile && !isLoadingCount && showForm && (
        <MealPlannerForm onPreferencesSaved={handlePreferencesSaved} />
      )}

      {!isFetchingProfile && !isLoadingCount && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center text-primary">
              <Sparkles className="mr-2 h-6 w-6" />
              Geração de Cardápio com IA
            </CardTitle>
            <CardDescription>
              {showForm 
                ? "Após salvar suas preferências, clique abaixo para solicitar um cardápio."
                : "Sua solicitação foi enviada ou um cardápio foi exibido. Você pode editar suas preferências para uma nova solicitação."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!showForm && (generatedMealPlan || currentMealPlanRequest?.status === 'error' || currentMealPlanRequest?.status === 'pending' || currentMealPlanRequest?.status === 'processing')) && (
               <Button onClick={handleEditPreferences} variant="outline" className="mb-4">
                  Editar Preferências e Solicitar Novo Cardápio
              </Button>
            )}
            {showForm && (
              <Button 
                onClick={handleRequestMealPlan} 
                disabled={isProcessingRequest || !currentUser || isFetchingProfile || isLoadingCount || !canGenerate || !userProfile?.mealPreferences || Object.values(userProfile.mealPreferences).every(val => !val)} 
                className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isProcessingRequest ? ( <Loader2 className="mr-2 h-5 w-5 animate-spin" /> ) : ( <Sparkles className="mr-2 h-5 w-5" /> )}
                {isProcessingRequest ? 'Enviando Solicitação...' : `Solicitar Cardápio (${DAILY_MEAL_PLAN_LIMIT - todaysRequestsCount} restantes)`}
              </Button>
            )}
             {!isLoadingPlan && showForm && userProfile?.mealPreferences && Object.values(userProfile.mealPreferences).every(val => !val) && (
                <p className="text-sm text-destructive mt-2">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Preencha e salve suas preferências alimentares para habilitar a solicitação.
                </p>
             )}
             {!canGenerate && !isLoadingCount && (
                <p className="text-sm text-destructive mt-2">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Você atingiu o limite de {DAILY_MEAL_PLAN_LIMIT} cardápios solicitados hoje.
                </p>
             )}
          </CardContent>
        </Card>
      )}
      
      {currentMealPlanRequest?.status === 'error' && !isProcessingRequest && (
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-6 w-6" />
              Erro ao Gerar Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground/90">{currentMealPlanRequest.error || "Ocorreu um erro desconhecido."}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Mensagem de Pendente / Processando */}
      {currentMealPlanRequest && (currentMealPlanRequest.status === 'pending' || currentMealPlanRequest.status === 'processing') && !isProcessingRequest && (
        <Card className="mt-8 shadow-lg bg-card">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center text-primary">
                    <Hourglass className="mr-2 h-6 w-6" />
                    Solicitação em Andamento
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                {currentMealPlanRequest.status === 'pending' ? (
                    <>
                        <p>Sua solicitação de cardápio está pendente.</p>
                        <p className="text-xs">(Aguardando processamento)</p>
                    </>
                ) : ( // processing
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p>Seu cardápio está sendo processado pela IA...</p>
                        <p className="text-xs">(Isso pode levar alguns instantes)</p>
                    </>
                )}
            </CardContent>
        </Card>
      )}


      {!isProcessingRequest && generatedMealPlan && generatedMealPlan.length > 0 && (
        <MealPlanDisplay mealPlan={generatedMealPlan} asCard={true} />
      )}
      {!isProcessingRequest && currentMealPlanRequest?.status === 'completed' && (!generatedMealPlan || generatedMealPlan.length === 0) && (
         <Card className="mt-8 shadow-lg">
           <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center text-primary">
                <Utensils className="mr-2 h-6 w-6" /> Cardápio
              </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">A IA não retornou sugestões para as preferências atuais. Tente ajustá-las e gerar novamente.</p>
           </CardContent>
         </Card>
      )}

      {mealPlanDisclaimer && !isProcessingRequest && generatedMealPlan && generatedMealPlan.length > 0 && (
        <Card className="bg-card shadow-lg mt-8">
          <CardHeader>
              <CardTitle className="font-headline text-lg text-primary flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-accent"/>Importante</CardTitle>
          </CardHeader>
          <CardContent>
              <p className="text-muted-foreground text-sm">
                {mealPlanDisclaimer}
              </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8 w-full shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
            <History className="mr-2 h-6 w-6 text-primary" />
            Histórico de Cardápios Solicitados
          </CardTitle>
          <CardDescription>
            Aqui são exibidas suas solicitações de cardápios da IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Carregando histórico...</div>
          ) : mealPlanHistory.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {mealPlanHistory.map((item) => (
                  <Card key={item.id} className="p-4 bg-card shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start mb-2">
                      <p className="text-sm text-muted-foreground flex items-center">
                        <CalendarDays className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                       <Badge variant={getStatusBadgeVariant(item.status)} className="capitalize self-start sm:self-auto">
                        {item.status === 'pending' ? 'Pendente' :
                         item.status === 'processing' ? 'Processando' :
                         item.status === 'completed' ? 'Concluído' : 
                         item.status // fallback para outros status, como 'error'
                        }
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <p><strong>Dieta:</strong> {item.userInput.dietType || 'N/A'}</p>
                        <p><strong>Restrições:</strong> {item.userInput.foodIntolerances || 'Nenhuma'}</p>
                        <p><strong>Calorias:</strong> {item.userInput.calorieGoal ? `${item.userInput.calorieGoal} kcal` : 'N/A'}</p>
                    </div>
                    {item.status === 'completed' && item.mealPlanOutput?.mealPlan && item.mealPlanOutput.mealPlan.length > 0 && (
                      <Accordion type="single" collapsible className="mt-2 pt-2 border-t border-border/50">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-sm text-primary hover:no-underline py-1">Ver Cardápio Gerado</AccordionTrigger>
                            <AccordionContent className="pt-2 max-h-60 overflow-y-auto">
                                <MealPlanDisplay mealPlan={item.mealPlanOutput.mealPlan} asCard={false} />
                                {item.mealPlanOutput.disclaimer && <p className="text-xs text-muted-foreground mt-2 italic">{item.mealPlanOutput.disclaimer}</p>}
                            </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                     {item.status === 'completed' && item.mealPlanOutput?.mealPlan && item.mealPlanOutput.mealPlan.length === 0 && (
                         <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">A IA não retornou sugestões para estas preferências.</p>
                     )}
                    {item.status === 'error' && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-sm text-destructive break-words">
                          <strong className="font-medium">Erro:</strong> {item.error || "Detalhes do erro não disponíveis."}
                        </p>
                      </div>
                    )}
                    {(item.status === 'pending' || item.status === 'processing') && !item.mealPlanOutput && !item.error && (
                       <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-sm text-muted-foreground">Aguardando processamento pela IA...</p>
                       </div>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum cardápio solicitado no histórico.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

