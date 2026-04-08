import React, { useState, useEffect } from 'react';
import { User, LogOut, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, billingApi } from '../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { UsageSummary } from '../../types/api';
import { useTranslation } from '../../i18n/I18nContext';

export function ProfileView() {
  const [activeTab, setActiveTab] = useState('Account');
  const [searchParams] = useSearchParams();
  const { user, refreshSubscription } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      refreshSubscription();
      toast.success('Subscription activated!');
    }
  }, [searchParams, refreshSubscription]);

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F] relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
         <h1 className="text-2xl md:text-3xl font-medium text-white tracking-tight mb-8">{t('profile.settings')}</h1>

         <div className="grid md:grid-cols-[240px_1fr] gap-4 md:gap-8">
            {/* Sidebar */}
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible scrollbar-hide">
               {[t('profile.account'), t('profile.billing'), t('profile.security')].map(tab => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                     activeTab === tab
                       ? 'bg-white/10 text-white'
                       : 'text-white/40 hover:text-white hover:bg-white/5'
                   }`}
                 >
                   {tab}
                   {activeTab === tab && <ChevronRight size={14} />}
                 </button>
               ))}

               <div className="pt-4 mt-4 border-t border-white/5">
                 <LogoutButton />
               </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
               {activeTab === t('profile.account') && <AccountSettings />}
               {activeTab === t('profile.billing') && <BillingSettings />}
               {activeTab === t('profile.security') && <SecuritySettings />}
            </div>
         </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success(t('profile.logout'));
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
    >
      <LogOut size={16} />
      {t('profile.logout')}
    </button>
  );
}

function BillingSettings() {
  const { subscription } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const planTier = subscription?.plan_tier || 'free';
  const planNames: Record<string, string> = { free: 'Free', student: 'Student', pro: 'Pro' };

  useEffect(() => {
    billingApi.getUsage().then(data => setUsage(data.usage)).catch(() => {});
  }, []);

  const handleManage = async () => {
    setLoadingPortal(true);
    try {
      const url = await billingApi.createPortal(window.location.href);
      window.location.href = url;
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  const resourceLabels: Record<string, string> = {
    material_upload: 'Materials',
    chat_message: 'Chat Messages',
    podcast_generation: 'Podcasts',
    presentation_generation: 'Presentations',
    storage_mb: 'Storage (MB)',
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Subscription</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            planTier === 'pro' ? 'bg-primary/20 text-primary' :
            planTier === 'student' ? 'bg-blue-500/20 text-blue-400' :
            'bg-white/10 text-white/60'
          }`}>
            {planNames[planTier]}
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            planTier === 'pro' ? 'bg-primary/20 text-primary' :
            planTier === 'student' ? 'bg-blue-500/20 text-blue-400' :
            'bg-white/5 text-white/40'
          }`}>
            {planTier === 'free' ? <User size={20} /> : <Zap size={20} />}
          </div>
          <div>
            <p className="text-white font-medium">{planNames[planTier]} Plan</p>
            <p className="text-xs text-white/40">
              {subscription?.status === 'active' ? 'Active' :
               subscription?.status === 'past_due' ? 'Payment past due' :
               subscription?.cancel_at_period_end ? 'Cancels at period end' : 'Active'}
              {subscription?.current_period_end && ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {planTier !== 'pro' && (
            <button
              onClick={() => navigate('/pricing')}
              className="px-5 py-2 bg-primary text-black rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Upgrade Plan
            </button>
          )}
          {planTier !== 'free' && (
            <button
              onClick={handleManage}
              disabled={loadingPortal}
              className="px-5 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors"
            >
              {loadingPortal ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
        <h2 className="text-lg font-medium text-white mb-6">Usage This Month</h2>
        <div className="space-y-5">
          {usage.map((item) => {
            const label = resourceLabels[item.resource_type] || item.resource_type;
            const isUnlimited = item.limit === -1;
            const percentage = isUnlimited ? 0 : item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
            const isNearLimit = !isUnlimited && percentage >= 80;

            return (
              <div key={item.resource_type}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">{label}</span>
                  <span className={`font-medium ${isNearLimit ? 'text-amber-400' : 'text-white/50'}`}>
                    {item.used} / {isUnlimited ? '∞' : item.limit}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isNearLimit ? 'bg-amber-400' : 'bg-primary/60'
                    }`}
                    style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
          {usage.length === 0 && (
            <p className="text-sm text-white/30 text-center py-4">No usage data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('File size must be less than 1MB');
      return;
    }

    if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
      toast.error('Only JPG or PNG files are allowed');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setSaving(true);
    try {
      await authApi.updateMe({ full_name: fullName, email });
      await refreshUser();
      toast.success(t('profile.profile_updated'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('profile.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
          <h2 className="text-lg font-medium text-white mb-6">{t('profile.profile_details')}</h2>

          {/* Avatar */}
          <div className="flex items-center gap-6 mb-8">
             <div className="relative">
               {avatarPreview ? (
                 <img src={avatarPreview} alt="Avatar" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border border-white/10" />
               ) : (
                 <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border border-white/10 flex items-center justify-center text-lg font-medium text-primary">
                   {initials}
                 </div>
               )}
             </div>
             <div>
                <label className="cursor-pointer px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors inline-block mb-2">
                  {t('profile.change_avatar')}
                  <input type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleAvatarChange} className="hidden" />
                </label>
                <p className="text-xs text-white/30">{t('profile.avatar_desc')}</p>
             </div>
          </div>

          {/* Form */}
          <div className="grid gap-4">
             <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">{t('profile.full_name')}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('profile.full_name_placeholder')}
                  className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">{t('profile.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('profile.email_placeholder')}
                  className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors"
                />
             </div>
          </div>

          <div className="mt-6 flex justify-end">
             <button
               onClick={handleSave}
               disabled={saving}
               className="px-6 py-2 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {saving ? t('profile.saving') : t('profile.save_changes')}
             </button>
          </div>
       </div>
    </div>
  );
}

function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const { t } = useTranslation();

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('profile.all_fields_required'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwords_mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('profile.password_min_length'));
      return;
    }

    setChanging(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(t('profile.password_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join(', ')
        : typeof detail === 'string'
          ? detail
          : t('profile.password_change_failed');
      toast.error(message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
        <h2 className="text-lg font-medium text-white mb-6">{t('profile.change_password')}</h2>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-white/40 uppercase tracking-wider">{t('profile.current_password')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('profile.current_password_placeholder')}
              className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/40 uppercase tracking-wider">{t('profile.new_password')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('profile.new_password_placeholder')}
              className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/40 uppercase tracking-wider">{t('profile.confirm_new_password')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('profile.confirm_new_password_placeholder')}
              className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={changing}
            className="px-6 py-2 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changing ? t('profile.changing_password') : t('profile.change_password_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
