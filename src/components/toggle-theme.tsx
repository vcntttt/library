import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
	const { theme, setTheme } = useTheme();

	const onToggle = useCallback(() => {
		const resolvedTheme =
			theme === "system"
				? window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
					? "dark"
					: "light"
				: theme;

		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [setTheme, theme]);

	return (
		<Button
			className="relative size-11 rounded-full"
			variant="outline"
			size="icon-lg"
			type="button"
			onClick={onToggle}
			aria-label="Cambiar tema"
		>
			<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
			<span className="sr-only">Cambiar tema</span>
		</Button>
	);
}
