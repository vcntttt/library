import { api as convexApi } from "@convex/_generated/api";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Activity, ChevronDown, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MAX_INITIALS = 2;

const getInitials = (name: string) => {
	const parts = name.split(" ").filter(Boolean);
	const initials = parts
		.map((part) => part[0])
		.join("")
		.slice(0, MAX_INITIALS)
		.toUpperCase();
	return initials || "U";
};

export function UserMenu() {
	const router = useRouter();
	const { isAuthenticated, isLoading } = useConvexAuth();
	const { signOut } = useAuthActions();
	const user = useQuery(convexApi.users.current);
	const [isSigningOut, setIsSigningOut] = useState(false);

	const displayName = useMemo(() => {
		if (user?.name?.trim()) return user.name.trim();
		if (user?.email) return user.email.split("@")[0] ?? "Usuario";
		return "Usuario";
	}, [user?.email, user?.name]);

	const initials = useMemo(() => getInitials(displayName), [displayName]);

	const handleSignOut = async () => {
		if (isSigningOut) return;
		setIsSigningOut(true);
		try {
			await signOut();
			await router.navigate({ to: "/login" });
		} catch {
			setIsSigningOut(false);
		}
	};

	if (isLoading) return null;

	if (!isAuthenticated) {
		return (
			<Link
				to="/login"
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					"rounded-full border-border/60 bg-background/60 shadow-sm",
				)}
			>
				Inicia sesión
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						className="h-11 gap-2 rounded-full px-3 hover:bg-muted/60"
					/>
				}
			>
				<span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/40 text-[0.65rem] font-semibold text-muted-foreground">
					{user?.image ? (
						<img
							src={user.image}
							alt={displayName}
							className="h-full w-full object-cover"
						/>
					) : (
						initials
					)}
				</span>
				<span className="hidden min-w-0 flex-1 text-left sm:block">
					<span className="block truncate text-sm font-medium text-foreground">
						{displayName}
					</span>
				</span>
				<ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
				<span className="sr-only">Menú de usuario</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				sideOffset={8}
				className="w-64 rounded-xl border border-border/60 bg-card/95 p-2 shadow-lg"
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="space-y-1 px-2 py-2">
						<span className="block text-sm font-medium text-foreground">
							{displayName}
						</span>
						{user?.email && (
							<span className="block text-xs text-muted-foreground">
								{user.email}
							</span>
						)}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						render={<Link to="/health" />}
						className="cursor-pointer"
					>
						<Activity className="h-4 w-4" />
						Sanidad de metadatos
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => void handleSignOut()}
						disabled={isSigningOut}
						className="cursor-pointer"
					>
						<LogOut className="h-4 w-4" />
						{isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
