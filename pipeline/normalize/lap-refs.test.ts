import { describe, expect, it } from 'vitest';
import { lapRefParser } from './lap-refs';

const parse = lapRefParser({
  白川: 'Shirakawa',
  高速路: 'Highway Circuit',
  高速公路环道: 'Highway Circuit',
  地平线攀爬赛: 'Chiheisen',
  向日葵: 'Sunflower',
  奈良: 'Narai-Juku',
});

describe('lapRefParser', () => {
  it('reads track + time pairs and translates the track', () => {
    expect(parse('白川1:04.9干净极限04.6 相对简单好开')).toEqual([
      { track: 'Shirakawa', time: '1:04.9' },
    ]);
    expect(parse('高速路52.8(53.0干净) 加速非常快')).toEqual([
      { track: 'Highway Circuit', time: '52.8' },
    ]);
    expect(parse('奈良 42.1')).toEqual([{ track: 'Narai-Juku', time: '42.1' }]);
  });

  it('marks world records and expands a dropped minute', () => {
    expect(parse('地平线攀爬赛世界纪录 59.9')).toEqual([
      { track: 'Chiheisen', time: '59.9', worldRecord: true },
    ]);
    expect(parse('向日葵04.8')).toEqual([{ track: 'Sunflower', time: '1:04.8' }]);
  });

  it('prefers the longest track name and ignores unknown text', () => {
    expect(parse('高速公路环道 50.1')).toEqual([{ track: 'Highway Circuit', time: '50.1' }]);
    expect(parse('倒转19.7 入弯略推')).toEqual([]);
    expect(parse(undefined)).toEqual([]);
  });
});
