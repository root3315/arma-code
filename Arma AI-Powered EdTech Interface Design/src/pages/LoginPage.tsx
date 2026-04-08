import React, { useState } from 'react';
import { useNavigate, Link, To } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { motion } from 'motion/react';
import { useTranslation } from '../i18n/I18nContext';
import { toast } from 'sonner';
import { AICore } from '../components/shared/AICore';
import { Brain, ChevronRight } from 'lucide-react';
import { Header } from '@/components/ui/header';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
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
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.detail || t('login.error');
      toast.error(typeof message === 'string' ? message : t('login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0C0C0F' }}>
      <Header />
      {/* Background AI Core */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.2, scale: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <AICore size="xl" />
      </motion.div>

      {/* Login Card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        <Card className="w-full py-6 glass-panel border-white/10">
          <motion.div variants={itemVariants}>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-white">{t('login.title')}</CardTitle>
              <CardDescription className="text-white/60">
                {t('login.description')}
              </CardDescription>
            </CardHeader>
          </motion.div>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  {t('login.email')}
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
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="password" className="text-white/80">
                  {t('login.password')}
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
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  className="w-full bg-[#FF8A3D] hover:bg-[#FF8A3D]/90 text-white font-medium cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? t('login.loading') : t('login.submit')}
                </Button>
              </motion.div>

              <motion.p variants={itemVariants} className="text-center text-sm text-white/60 mt-4">
                {t('login.no_account')}{' '}
                <Link to="/register" className="text-[#FF8A3D] hover:underline">
                  {t('login.register_link')}
                </Link>
              </motion.p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
