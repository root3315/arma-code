import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { AICore } from '../components/shared/AICore';
import { hasLandingIntent } from '../utils/landingIntent';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(formData);
      toast.success('Добро пожаловать!');
      navigate(hasLandingIntent() ? '/dashboard?source=landing' : '/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Ошибка входа. Проверьте email и пароль.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0C0C0F' }}>
      {/* Background AI Core */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <AICore size="xl" />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md relative z-10 glass-panel border-white/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">Вход в Arma AI</CardTitle>
          <CardDescription className="text-white/60">
            Введите свои данные для доступа к платформе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#FF8A3D] hover:bg-[#FF8A3D]/90 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>

            <p className="text-center text-sm text-white/60 mt-4">
              Нет аккаунта?{' '}
              <Link to="/register" className="text-[#FF8A3D] hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
