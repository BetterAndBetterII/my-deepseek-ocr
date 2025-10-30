import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun, Info } from "lucide-react";
import { useEffect, useState } from "react";

export function Navbar() {
  const { user, logout, authDisabled } = useAuth();
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const cls = document.documentElement.classList;
    if (dark) cls.add("dark"); else cls.remove("dark");
  }, [dark]);

  return (
    <div className={cn("border-b bg-background")}> 
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="font-semibold">My OCR</div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground" title="本应用不存储用户信息">
            <Info className="h-3 w-3" />
            <span>本应用不存储用户信息</span>
          </div>
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setDark(v => !v)}>
            {dark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
          </Button>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{user.username}</span>
              {!authDisabled && (
                <Button variant="outline" size="sm" onClick={logout}>退出</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
