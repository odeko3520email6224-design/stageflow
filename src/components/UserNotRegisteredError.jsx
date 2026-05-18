import React from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-5 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-3">アクセスを確認中です</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          このアプリのご利用には管理者による承認が必要です。<br />
          アカウントが承認されるまでお待ちください。
        </p>
        <div className="bg-muted rounded-xl p-4 text-xs text-muted-foreground text-left space-y-1.5 mb-6">
          <p className="font-medium text-foreground">お心当たりがある場合：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>正しいアカウントでログインしているか確認してください</li>
            <li>管理者にアクセス許可を依頼してください</li>
            <li>一度ログアウトして再度ログインをお試しください</li>
          </ul>
        </div>
        <Button variant="outline" className="gap-2 w-full" onClick={() => base44.auth.logout()}>
          <LogOut className="w-4 h-4" />
          ログアウト
        </Button>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;