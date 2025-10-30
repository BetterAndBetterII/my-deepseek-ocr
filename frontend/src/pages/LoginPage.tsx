import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function LoginPage() {
  const { login, loading, authDisabled, ready } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Skip login if auth is disabled
    if (ready && authDisabled) navigate("/", { replace: true });
  }, [authDisabled, ready, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 border rounded-md bg-card">
        <div className="text-lg font-semibold text-center">登录</div>
        <div className="grid gap-2">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">密码</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <Button className="w-full" disabled={loading} type="submit">{loading ? "登录中..." : "登录"}</Button>
        <div className="text-center text-sm text-muted-foreground">
          还没有账号？ <Link className="underline" to="/register">去注册</Link>
        </div>
        <div className="text-center text-xs text-muted-foreground">提示：本应用不存储用户信息</div>
      </form>
    </div>
  );
}
