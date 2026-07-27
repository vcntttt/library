import {
	createEmptyCard,
	fsrs,
	Rating,
	State,
	type Card,
	type CardInput,
	type Grade,
} from "ts-fsrs";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface StoredReviewCard {
	due: number;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	learningSteps: number;
	reps: number;
	lapses: number;
	state: number;
	lastReview?: number;
}

export interface StoredReviewLog {
	rating: number;
	state: number;
	due: number;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	lastElapsedDays: number;
	scheduledDays: number;
	learningSteps: number;
	review: number;
}

const scheduler = fsrs({ enable_fuzz: false });

export function scheduleReview(
	storedCard: StoredReviewCard | undefined,
	rating: ReviewRating,
	now = Date.now(),
) {
	const card = storedCard ? deserializeCard(storedCard) : createEmptyCard(new Date(now));
	const result = scheduler.next(card, new Date(now), ratingToGrade(rating));

	return {
		card: serializeCard(result.card),
		log: serializeLog(result.log),
	};
}

function ratingToGrade(rating: ReviewRating): Grade {
	if (rating === "again") return Rating.Again;
	if (rating === "hard") return Rating.Hard;
	if (rating === "easy") return Rating.Easy;
	return Rating.Good;
}

function deserializeCard(card: StoredReviewCard): CardInput {
	return {
		due: new Date(card.due),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsed_days: card.elapsedDays,
		scheduled_days: card.scheduledDays,
		learning_steps: card.learningSteps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state as State,
		last_review: card.lastReview ? new Date(card.lastReview) : undefined,
	};
}

function serializeCard(card: Card): StoredReviewCard {
	return {
		due: card.due.getTime(),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsedDays: card.elapsed_days,
		scheduledDays: card.scheduled_days,
		learningSteps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		lastReview: card.last_review?.getTime(),
	};
}

function serializeLog(log: {
	rating: number;
	state: number;
	due: Date;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	last_elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	review: Date;
}): StoredReviewLog {
	return {
		rating: log.rating,
		state: log.state,
		due: log.due.getTime(),
		stability: log.stability,
		difficulty: log.difficulty,
		elapsedDays: log.elapsed_days,
		lastElapsedDays: log.last_elapsed_days,
		scheduledDays: log.scheduled_days,
		learningSteps: log.learning_steps,
		review: log.review.getTime(),
	};
}
