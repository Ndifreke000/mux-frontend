import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCorrelationId, readRealBackendEnv, redactToken } from "./helpers";

const ENV_NAMES = [
	"NEXT_PUBLIC_API_URL",
	"E2E_TEST_EMAIL",
	"E2E_TEST_PASSWORD",
] as const;

function stubValidEnv() {
	vi.stubEnv("NEXT_PUBLIC_API_URL", "  https://api.example.com  ");
	vi.stubEnv("E2E_TEST_EMAIL", "  e2e@example.com ");
	vi.stubEnv("E2E_TEST_PASSWORD", " hunter2-but-longer ");
}

function headers(values: Record<string, string>) {
	return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("readRealBackendEnv", () => {
	beforeEach(stubValidEnv);
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns trimmed values when every var is set to an http(s) origin", () => {
		expect(readRealBackendEnv()).toEqual({
			apiUrl: "https://api.example.com",
			email: "e2e@example.com",
			password: "hunter2-but-longer",
		});
	});

	it("accepts a plain http origin", () => {
		vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000");
		expect(readRealBackendEnv()?.apiUrl).toBe("http://localhost:4000");
	});

	it.each(ENV_NAMES)("returns null when %s is missing", (name) => {
		// Stubbed first in beforeEach, so unstubAllEnvs restores the original.
		delete process.env[name];
		expect(readRealBackendEnv()).toBeNull();
	});

	it.each(ENV_NAMES)("returns null when %s is blank", (name) => {
		vi.stubEnv(name, " ");
		expect(readRealBackendEnv()).toBeNull();
	});

	it.each(["ftp://example.com", "javascript:alert(1)", "not a url"])(
		"returns null for non-http(s) URL %s",
		(url) => {
			vi.stubEnv("NEXT_PUBLIC_API_URL", url);
			expect(readRealBackendEnv()).toBeNull();
		},
	);
});

describe("redactToken", () => {
	it.each(["", "short", "12345678"])("masks %j (length <= 8) entirely", (token) => {
		expect(redactToken(token)).toBe("***");
	});

	it("keeps only the first and last four characters of longer tokens", () => {
		const token = "abcd" + "x".repeat(32) + "wxyz";
		expect(token).toHaveLength(40);
		expect(redactToken(token)).toBe("abcd…wxyz");
		expect(redactToken("123456789")).toBe("1234…6789");
	});
});

describe("readCorrelationId", () => {
	it("prefers the x-correlation-id header over the body", () => {
		expect(
			readCorrelationId(headers({ "x-correlation-id": " hdr-1 " }), {
				correlationId: "body-1",
			}),
		).toBe("hdr-1");
	});

	it("falls back to the body when the header is blank or absent", () => {
		const body = { correlationId: " body-1 " };
		expect(readCorrelationId(headers({ "x-correlation-id": "  " }), body)).toBe(
			"body-1",
		);
		expect(readCorrelationId(headers({}), body)).toBe("body-1");
	});

	it.each([
		["a missing body", undefined],
		["a non-object body", "body-1"],
		["a body without correlationId", { code: "AUTH_UNAUTHORIZED" }],
		["a non-string correlationId", { correlationId: 42 }],
		["a blank correlationId", { correlationId: "   " }],
	])("returns null with no header and %s", (_label, body) => {
		expect(readCorrelationId(headers({}), body)).toBeNull();
	});
});
