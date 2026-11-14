import { describe, expect, it } from 'vitest';
import {
  inferSurface,
  parseBuildTags,
  parseClass,
  parseClassPrefix,
  parseDayFirstDate,
  parseDifficulty,
  parseDrivetrain,
  parseLapTime,
  parseShareCode,
  parseTires,
} from './fields';

describe('parseClass', () => {
  it.each([
    ['A', 'A'],
    ['S1 800', 'S1'],
    ['Class S2', 'S2'],
    ['100 D', 'D'],
    ['A700', 'A'],
    ['R 998', 'R'],
  ])('%s → %s', (input, expected) => expect(parseClass(input)).toBe(expected));

  it('returns undefined for text without a class', () =>
    expect(parseClass('Road')).toBeUndefined());
});

describe('parseClassPrefix', () => {
  it('reads the class at the start of a tune name', () => {
    expect(parseClassPrefix('C Road Purist')).toBe('C');
    expect(parseClassPrefix('S1 Dirt Meta')).toBe('S1');
    expect(parseClassPrefix('A dirt')).toBe('A');
  });
  it('does not confuse words with classes', () => {
    expect(parseClassPrefix('Road AWD Full Aero')).toBeUndefined();
    expect(parseClassPrefix('Allround Strong')).toBeUndefined();
  });
});

describe('parseShareCode', () => {
  it('accepts 9 digits with or without spaces', () => {
    expect(parseShareCode('773 309 331')).toBe('773309331');
    expect(parseShareCode('823312187')).toBe('823312187');
  });
  it('rejects anything else', () => {
    expect(parseShareCode('26/07/2026')).toBeUndefined();
    expect(parseShareCode('12345678')).toBeUndefined();
    expect(parseShareCode('Paint Black')).toBeUndefined();
    expect(parseShareCode(undefined)).toBeUndefined();
  });
});

describe('parseTires', () => {
  it.each([
    ['Off-Road', 'offroad'],
    ['Semi-Slick', 'semi-slick'],
    ['Super Slicks', 'super-slick'],
    ['Standard', 'stock'],
    ['Vintage Race', 'vintage-race'],
    ['Bananas', 'other'],
  ])('%s → %s', (input, expected) => expect(parseTires(input)).toBe(expected));
});

describe('inferSurface', () => {
  it('prefers an explicit column', () => {
    expect(inferSurface({ explicit: 'Road', name: 'Dirt Meta' })).toBe('road');
    expect(inferSurface({ explicit: 'Offroad' })).toBe('cross-country');
  });
  it('uses the tune name when the column is ambiguous', () => {
    expect(inferSurface({ explicit: 'Dirt/CC', name: 'C Dirt Rally AWD' })).toBe('dirt');
    expect(inferSurface({ explicit: 'Dirt/CC', name: 'CC Strong' })).toBe('cross-country');
  });
  it('returns null instead of guessing', () => {
    expect(inferSurface({ explicit: 'Dirt/CC', name: 'Strong V1' })).toBeNull();
    expect(inferSurface({ name: 'Allround', tires: 'offroad' })).toBeNull();
  });
  it('treats road-only tyres as road when nothing else is known', () => {
    expect(inferSurface({ name: 'Allround', tires: 'slick' })).toBe('road');
  });
  it('treats rally tyres as dirt when nothing else is known', () => {
    expect(inferSurface({ name: 'Purist', tires: 'rally' })).toBe('dirt');
  });
});

describe('other parsers', () => {
  it('drivetrain', () => expect(parseDrivetrain('B Road AWD Grip')).toBe('AWD'));
  it('build tags', () =>
    expect(parseBuildTags('AWD Full Aero', 'Road Purist Grip')).toEqual(['full-aero', 'purist']));
  it('difficulty in English and Chinese', () => {
    expect(parseDifficulty('Brain AFK')).toBe('brain-afk');
    expect(parseDifficulty('Very Easy')).toBe('very-easy');
    expect(parseDifficulty('简单')).toBe('very-easy');
    expect(parseDifficulty('普通')).toBe('easy');
    expect(parseDifficulty('非常困难')).toBe('death');
  });
  it('lap time', () => {
    expect(parseLapTime('0:59.227')).toBe(59_227);
    expect(parseLapTime('1:02.5')).toBe(62_500);
    expect(parseLapTime('fast')).toBeUndefined();
  });
  it('day-first date', () => {
    expect(parseDayFirstDate('26/07/2026')).toBe('2026-07-26');
    expect(parseDayFirstDate('2026-07-26')).toBeUndefined();
  });
});
