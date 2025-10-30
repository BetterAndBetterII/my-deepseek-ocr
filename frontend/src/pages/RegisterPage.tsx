import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { registerUser } from "@/lib/api";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export default function RegisterPage() {
  const { authDisabled } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authDisabled) navigate("/", { replace: true });
  }, [authDisabled, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await registerUser(username, password);
      setOk(true);
      setTimeout(() => navigate("/login"), 800);
    } catch (err: any) {
      setError(err?.message || "注册失败");
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 border rounded-md bg-card">
        <div className="text-lg font-semibold text-center">注册</div>
        <div className="grid gap-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {ok && <div className="text-sm text-green-600">注册成功，正在跳转登录...</div>}
        <Button className="w-full" type="submit">
          注册
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link className="underline" to="/login">
            去登录
          </Link>
        </div>
        <div className="text-center text-xs text-muted-foreground">提示：本应用不存储用户信息</div>
      </form>
    </div>
  );
}
