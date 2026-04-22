import { Link, useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { ModeToggle } from "./toggle-theme";
import { UserMenu } from "./user-menu";

const navItems = [
	{
		to: "/",
		label: "Panel",
		isActive: (pathname: string) => pathname === "/",
	},
	{
		to: "/biblioteca",
		label: "Biblioteca",
		isActive: (pathname: string) =>
			pathname.startsWith("/biblioteca") || pathname.startsWith("/obra/"),
	},
] as const;

export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<header className="sticky top-0 z-50 w-full border-b border-[#D6D0C7] bg-[#F5F2EB]/90 backdrop-blur-sm">
			<div className="container mx-auto flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
				<Link to="/" className="flex items-baseline gap-3">
					<h1 className="font-serif text-xl font-semibold tracking-tight">
						Biblioteca
					</h1>
					<span className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
						archivo personal
					</span>
				</Link>

				<div className="flex w-full flex-wrap items-center gap-4 sm:w-auto sm:flex-nowrap">
					<nav className="flex flex-wrap items-center gap-6">
						{navItems.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className={cn(
									"text-sm tracking-wide transition-colors pb-1 border-b-2",
									item.isActive(pathname)
										? "border-[#B85C38] text-[#1A1A1A]"
										: "border-transparent text-[#8C8279] hover:text-[#1A1A1A]",
								)}
							>
								{item.label}
							</Link>
						))}
					</nav>
					<div className="flex items-center gap-2">
						<UserMenu />
						<ModeToggle />
					</div>
				</div>
			</div>
		</header>
	);
}
