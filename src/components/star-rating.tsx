"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
	rating?: number;
	maxRating?: number;
	size?: "sm" | "md" | "lg";
	interactive?: boolean;
	onRatingChange?: (rating: number) => void;
}

export function StarRating({
	rating = 0,
	maxRating = 5,
	size = "md",
	interactive = false,
	onRatingChange,
}: StarRatingProps) {
	const sizeClasses = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};
	const stars = Array.from({ length: maxRating }, (_, index) => index + 1);

	return (
		<div className="flex items-center gap-0.5">
			{stars.map((star) => (
				<button
					key={star}
					type="button"
					disabled={!interactive}
					onClick={() => interactive && onRatingChange?.(star)}
					className={cn(
						"transition-transform transition-colors",
						interactive &&
							"cursor-pointer hover:text-amber-500 hover:scale-105",
					)}
				>
					<Star
						className={cn(
							sizeClasses[size],
							star <= rating
								? "fill-amber-500 text-amber-500 drop-shadow-sm"
								: "text-muted-foreground/40",
						)}
					/>
				</button>
			))}
		</div>
	);
}
