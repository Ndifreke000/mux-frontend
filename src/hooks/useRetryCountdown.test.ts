import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRetryCountdown } from "./useRetryCountdown";

describe("useRetryCountdown", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not schedule an interval when retryAt is already in the past", () => {
		const now = () => 1_000;
		renderHook(() => useRetryCountdown(500, now));

		expect(vi.getTimerCount()).toBe(0);
	});

	it("reports ready immediately when retryAt is already in the past", () => {
		const now = () => 1_000;
		const { result } = renderHook(() => useRetryCountdown(500, now));

		expect(result.current.ready).toBe(true);
		expect(result.current.remainingMs).toBe(0);
	});

	it("ticks down and becomes ready once retryAt elapses", () => {
		let current = 0;
		const now = () => current;
		const { result } = renderHook(() => useRetryCountdown(1_000, now));

		expect(result.current.ready).toBe(false);
		expect(result.current.remainingMs).toBe(1_000);

		current = 1_000;
		vi.advanceTimersByTime(250);

		expect(result.current.ready).toBe(true);
		expect(result.current.remainingMs).toBe(0);
		// The tick that observes current >= retryAt clears its own interval.
		expect(vi.getTimerCount()).toBe(0);
	});

	it("clears the outstanding interval when retryAt transitions to null", () => {
		let current = 0;
		const now = () => current;
		const { result, rerender } = renderHook(
			({ retryAt }: { retryAt: number | null }) =>
				useRetryCountdown(retryAt, now),
			{ initialProps: { retryAt: 1_000 } },
		);

		expect(vi.getTimerCount()).toBe(1);

		rerender({ retryAt: null });

		expect(vi.getTimerCount()).toBe(0);
		expect(result.current.ready).toBe(true);
		expect(result.current.remainingMs).toBe(0);
	});
});
