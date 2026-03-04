"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />; // Platzhalter während SSR
    }

    const currentTheme = theme === "system" ? resolvedTheme : theme;

    return (
        <button
            onClick={() => setTheme(currentTheme === "light" ? "dark" : "light")}
            className="relative p-2 transition-transform active:scale-95 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
        >
            {currentTheme === "dark" ? (
                <Moon className="h-5 w-5" />
            ) : (
                <Sun className="h-5 w-5" />
            )}
        </button>
    );
}
