import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "vite-ui-theme",
	...props
}: ThemeProviderProps) {
	const storage = useMemo(() => {
		if (typeof window === "undefined") return null;
		const ls = window.localStorage;
		return typeof ls?.getItem === "function" ? ls : null;
	}, []);

	const [theme, setTheme] = useState<Theme>(() => defaultTheme);

	useEffect(() => {
		const stored = storage?.getItem(storageKey);
		if (stored === "light" || stored === "dark" || stored === "system") {
			setTheme(stored);
		}
	}, [storage, storageKey]);

	useEffect(() => {
		const root = window.document.documentElement;
		const media = window.matchMedia("(prefers-color-scheme: dark)");

		const applyTheme = () => {
			root.classList.remove("light", "dark");

			if (theme === "system") {
				root.classList.add(media.matches ? "dark" : "light");
				return;
			}

			root.classList.add(theme);
		};

		applyTheme();
		if (theme !== "system") return;

		media.addEventListener("change", applyTheme);
		return () => media.removeEventListener("change", applyTheme);
	}, [theme]);

	const value = useMemo<ThemeProviderState>(
		() => ({
			theme,
			setTheme: (nextTheme: Theme) => {
				storage?.setItem(storageKey, nextTheme);
				setTheme(nextTheme);
			},
		}),
		[theme, storage, storageKey],
	);

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
