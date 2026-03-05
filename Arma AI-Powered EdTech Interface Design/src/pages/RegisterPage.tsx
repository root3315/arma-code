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

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      });
      toast.success('Регистрация успешна! Добро пожаловать!');
      navigate(hasLandingIntent() ? '/dashboard?source=landing' : '/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      const message = error.response?.data?.detail || 'Ошибка регистрации. Попробуйте другой email.';
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

      {/* Register Card */}
      <Card className="w-full max-w-md relative z-10 glass-panel border-white/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">Регистрация в Arma AI</CardTitle>
          <CardDescription className="text-white/60">
            Создайте аккаунт для начала обучения
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-white/80">
                Полное имя
              </Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Иван Иванов"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={isLoading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/80">
                Подтвердите пароль
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>

            <p className="text-center text-sm text-white/60 mt-4">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-[#FF8A3D] hover:underline">
                Войти
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
