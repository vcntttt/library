import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { ModeToggle } from "./toggle-theme";
import { UserMenu } from "./user-menu";

const navItems = [
	{ to: "/", label: "Panel" },
	{ to: "/biblioteca", label: "Biblioteca" },
] as const;

export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/75 backdrop-blur-lg">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<Link to="/" className="flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
						<BookOpen className="h-4 w-4" />
					</span>
					<div className="leading-tight">
						<span className="block font-serif text-lg font-semibold tracking-tight">
							Biblioteca
						</span>
						<span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
							archivo personal
						</span>
					</div>
				</Link>

				<div className="flex items-center gap-3">
					<nav className="flex items-center gap-1">
						{navItems.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className={cn(
									"rounded-full px-4 py-1.5 text-sm font-medium transition-all",
									pathname === item.to
										? "bg-primary text-primary-foreground shadow-sm"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
							>
								{item.label}
							</Link>
						))}
					</nav>
					<UserMenu />
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}
