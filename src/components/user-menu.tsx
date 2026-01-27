import { Link, useRouter } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";
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
	const { data: session, isPending } = authClient.useSession();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const user = session?.user;
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
			await authClient.signOut();
			await router.navigate({ to: "/login" });
		} catch {
			setIsSigningOut(false);
		}
	};

	if (isPending) return null;

	if (!session) {
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
						className="gap-2 rounded-full px-2 py-1.5 hover:bg-muted/60"
					/>
				}
			>
				<span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/40 text-[0.6rem] font-semibold text-muted-foreground">
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
				className="w-64 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-lg"
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
