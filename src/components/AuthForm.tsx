
"use client";
import React, { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Leaf } from 'lucide-react'; 

const formSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

type FormValues = z.infer<typeof formSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: "Conta criada!", description: "Você foi registrado com sucesso." });
        router.push('/dashboard'); 
      } else {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: "Login bem-sucedido!", description: "Bem-vindo de volta." });
        router.push('/dashboard'); 
      }
    } catch (error: any) {
      const errorMessage = error.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' 
                         : error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' ? 'Email ou senha inválidos.'
                         : 'Ocorreu um erro. Tente novamente.';
      toast({ title: "Erro de autenticação", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl bg-card">
      <CardHeader className="items-center text-center">
        <Leaf className="h-12 w-12 text-primary mb-2" data-ai-hint="logo app" />
        <CardTitle className="text-3xl font-headline text-primary">{mode === 'login' ? 'Bem-vindo!' : 'Crie sua Conta'}</CardTitle>
        <CardDescription className="text-muted-foreground">{mode === 'login' ? 'Faça login para continuar no Seca Jejum.' : 'Junte-se ao Seca Jejum para começar.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} disabled={isLoading} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Senha</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register('password')} disabled={isLoading} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
            {isLoading ? (mode === 'login' ? 'Entrando...' : 'Criando conta...') : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center pt-6">
        {mode === 'signup' && (
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?
            <Button variant="link" className="text-accent hover:text-accent/80" onClick={() => router.push('/login')}>
              Faça login
            </Button>
          </p>
        )}
      </CardFooter>
    </Card>
  );
};

export default AuthForm;
