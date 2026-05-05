import { describe, it, expect } from 'vitest';
import {
	formatDuration,
	parseDurationHMS,
	capitalizeFirstLetter,
	toYmd,
	formatDateLabel,
	formatTime,
	formatDate,
	parseCSVLine
} from './util';

describe('util.ts', () => {
	describe('capitalizeFirstLetter', () => {
		it('should capitalize the first letter', () => {
			expect(capitalizeFirstLetter('hard')).toBe('Hard');
			expect(capitalizeFirstLetter('Work')).toBe('Work');
		});

		it('should ignore non-alphabetic characters', () => {
			expect(capitalizeFirstLetter('123')).toBe('123');
			expect(capitalizeFirstLetter('_a_')).toBe('_a_');
		});
	});

	describe('formatDuration', () => {
		it('should format milliseconds to HH:MM:SS', () => {
			expect(formatDuration(0)).toBe('00:00:00');
			expect(formatDuration(999)).toBe('00:00:00');
			expect(formatDuration(1000)).toBe('00:00:01');
			expect(formatDuration(60000)).toBe('00:01:00');
			expect(formatDuration(3600000)).toBe('01:00:00');
			expect(formatDuration(3661000)).toBe('01:01:01');
		});

		it('should handle negative number or non-numbers', () => {
			expect(formatDuration(-1)).toBe('00:00:00');
			expect(formatDuration(NaN)).toBe('00:00:00');
			expect(formatDuration(Infinity)).toBe('00:00:00');
		});
	});

	describe('parseDurationHMS', () => {
		it('should parse HH:MM:SS to milliseconds', () => {
			expect(parseDurationHMS('00:00:01')).toBe(1000);
			expect(parseDurationHMS('00:01:00')).toBe(60000);
			expect(parseDurationHMS('01:00:00')).toBe(3600000);
			expect(parseDurationHMS('01:01:01')).toBe(3661000);
		});

		it('should return 0 for invalid formats', () => {
			expect(parseDurationHMS('')).toBe(0);
			expect(parseDurationHMS('10:00')).toBe(0);
			expect(parseDurationHMS('invalid')).toBe(0);
			expect(parseDurationHMS('00:00:-01')).toBe(0);
			expect(parseDurationHMS('00:-01:00')).toBe(0);
			expect(parseDurationHMS('-01:00:00')).toBe(0);
			expect(parseDurationHMS('-01:-01:-01')).toBe(0);
		});
	});

	describe('toYmd', () => {
		it('should format a date as YYYY-MM-DD', () => {
			// Jan 1
			expect(toYmd(new Date(2024, 0, 1))).toBe('2024-01-01');
			// Dec 31
			expect(toYmd(new Date(2024, 11, 31))).toBe('2024-12-31');
			// June 6 with zeros
			expect(toYmd(new Date(2000, 5, 6))).toBe('2000-06-06');
		});

		it('should zero-pad single digit months and days', () => {
			expect(toYmd(new Date(2026, 0, 1))).toBe('2026-01-01');
		});
	});

	describe('formatDateLabel', () => {
		it('should format YYYY-MM-DD as "Month DD, YYYY"', () => {
			expect(formatDateLabel('2026-01-01')).toBe('January 1, 2026');
			expect(formatDateLabel('2025-12-31')).toBe('December 31, 2025');
			expect(formatDateLabel('2000-03-01')).toBe('March 1, 2000');
			expect(formatDateLabel('1969-01-01')).toBe('January 1, 1969');
		});

		it('should return the original string for invalid or incomplete input', () => {
			expect(formatDateLabel('invalid')).toBe('invalid');
			expect(formatDateLabel('2026-00-10')).toBe('2026-00-10');
			expect(formatDateLabel('2026-01-00')).toBe('2026-01-00');
			expect(formatDateLabel('')).toBe('');
		});
	});

	describe('formatTime', () => {
		it('should return empty string for null, undefined, or empty input', () => {
			expect(formatTime(null)).toBe('');
			expect(formatTime(undefined)).toBe('');
			expect(formatTime('')).toBe('');
		});

		it('should return empty string for an invalid date string', () => {
			expect(formatTime('not-a-date')).toBe('');
		});

		it('should return a formatted HH:MM time for a valid date string', () => {
			// fixed ISO string to verify it gets parsed without throwing an error
			const result = formatTime('2026-01-01T12:00:00');
			expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)?$/i);
		});
	});

	describe('formatDate', () => {
		it('should return empty string for null, undefined, or empty input', () => {
			expect(formatDate(null)).toBe('');
			expect(formatDate(undefined)).toBe('');
			expect(formatDate('')).toBe('');
		});

		it('should return empty string for an invalid date string', () => {
			expect(formatDate('not-a-date')).toBe('');
		});

		it('should return a non-empty localized date string for a valid input', () => {
			const result = formatDate('2024-06-15T00:00:00');
			expect(result).toBeTruthy();
			expect(typeof result).toBe('string');
		});
	});

	describe('parseCSVLine', () => {
		it('should parse a simple comma-separated line', () => {
			expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
		});

		it('should handle quoted fields', () => {
			expect(parseCSVLine('"hello","world"')).toEqual(['hello', 'world']);
			expect(parseCSVLine('"hello, world",foo')).toEqual(['hello, world', 'foo']);
		});

		it('should handle escaped double quotes inside quoted fields', () => {
			expect(parseCSVLine('"say ""hi""",next')).toEqual(['say "hi"', 'next']);
		});

		it('should handle empty fields', () => {
			expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
			expect(parseCSVLine(',,')).toEqual(['', '', '']);
		});

		it('should handle a single field with no commas', () => {
			expect(parseCSVLine('the only field')).toEqual(['the only field']);
			expect(parseCSVLine('')).toEqual(['']);
		});

		it('should handle mixed quoted and unquoted fields', () => {
			expect(parseCSVLine('plain,"quoted, value",another')).toEqual([
				'plain',
				'quoted, value',
				'another'
			]);
		});
	});
});
