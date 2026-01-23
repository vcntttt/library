import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { ModeToggle } from "./toggle-theme";

const navItems = [
	{ to: "/", label: "Panel" },
	{ to: "/biblioteca", label: "Biblioteca" },
] as const;

export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
			<div className="container mx-auto flex h-14 items-center justify-between px-4">
				<Link to="/" className="flex items-center gap-2">
					<BookOpen className="h-5 w-5 text-foreground" />
					<span className="font-semibold tracking-tight">Library</span>
				</Link>

				<nav className="flex items-center gap-1">
					{navItems.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
								pathname === item.to
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</Link>
					))}
				</nav>
				<ModeToggle />
			</div>
		</header>
	);
}
