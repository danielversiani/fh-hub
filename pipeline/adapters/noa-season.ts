import { cleanText } from '../lib/text';
import { cell, type Table } from '../lib/table';
import type { CarRef, EventPickKind, RawEventPick } from './types';

/** Chinese car makes as Noa Miyako's weekly tab writes them (the class tabs use English). */
export const ZH_MAKES: Readonly<Record<string, string>> = {
  阿尔法罗密欧: 'Alfa Romeo',
  阿斯顿马丁: 'Aston Martin',
  阿斯顿·马丁: 'Aston Martin',
  奥迪: 'Audi',
  宝马: 'BMW',
  保时捷: 'Porsche',
  奔驰: 'Mercedes-Benz',
  本田: 'Honda',
  宾利: 'Bentley',
  标致: 'Peugeot',
  别克: 'Buick',
  布加迪: 'Bugatti',
  大众: 'Volkswagen',
  道奇: 'Dodge',
  法拉利: 'Ferrari',
  菲亚特: 'Fiat',
  丰田: 'Toyota',
  福特: 'Ford',
  悍马: 'Hummer',
  吉普: 'Jeep',
  捷豹: 'Jaguar',
  凯迪拉克: 'Cadillac',
  科尼赛格: 'Koenigsegg',
  柯尼塞格: 'Koenigsegg',
  克莱斯勒: 'Chrysler',
  兰博基尼: 'Lamborghini',
  劳斯莱斯: 'Rolls-Royce',
  雷克萨斯: 'Lexus',
  雷诺: 'Renault',
  莲花: 'Lotus',
  路特斯: 'Lotus',
  林肯: 'Lincoln',
  铃木: 'Suzuki',
  路虎: 'Land Rover',
  马自达: 'Mazda',
  玛莎拉蒂: 'Maserati',
  迈凯伦: 'McLaren',
  梅赛德斯: 'Mercedes-Benz',
  三菱: 'Mitsubishi',
  帕加尼: 'Pagani',
  庞蒂亚克: 'Pontiac',
  普利茅斯: 'Plymouth',
  日产: 'Nissan',
  斯巴鲁: 'Subaru',
  斯柯达: 'Skoda',
  沃尔沃: 'Volvo',
  现代: 'Hyundai',
  雪佛兰: 'Chevrolet',
  雪铁龙: 'Citroen',
  讴歌: 'Acura',
  英菲尼迪: 'Infiniti',
  大发: 'Daihatsu',
  五十铃: 'Isuzu',
  特斯拉: 'Tesla',
  起亚: 'Kia',
};

const SEASONS: Readonly<Record<string, RawEventPick['season']>> = {
  夏季: 'summer',
  秋季: 'autumn',
  冬季: 'winter',
  春季: 'spring',
};

/** Event types in column A (continuation rows of the same event leave it empty). */
const KINDS: Readonly<Record<string, EventPickKind>> = {
  季节锦标赛: 'championship',
  终极考验: 'trial',
  每周挑战: 'weekly-challenge',
  计时赛: 'time-attack',
  测速照相: 'speed-trap',
  测速区间: 'speed-zone',
  漂移区域: 'drift-zone',
  危险标志: 'danger-sign',
  直线车友赛: 'drag',
  拓荒者: 'trailblazer',
};

const COL = { type: 0, name: 2, car: 4, notes: 8 } as const;

/**
 * "2005 斯巴鲁 IMPREZA WRX STI", "丰田 Sera 1991", "拥有并驾驶 2554 AMG … Warthog CST" (own and
 * drive …) → a car reference with the make in English.
 */
export function parseZhCar(text: string): CarRef | undefined {
  let t = text.replace(/^(拥有并驾驶|驾驶)\s*/u, '').split(/\s在\s/u)[0]!;
  const year = /\b(\d{4})\b/.exec(t)?.[1];
  if (!year) return undefined;
  let make: string | undefined;
  for (const [zh, en] of Object.entries(ZH_MAKES)) {
    if (t.includes(zh)) {
      make = en;
      t = t.replace(zh, ` ${en} `);
    }
  }
  const rest = cleanText(t.replace(/\p{Script=Han}+/gu, ' ').replace(year, ' '));
  if (!rest) return undefined;
  return { text: `${year} ${rest}`, year: Number(year), make };
}

/**
 * Noa Miyako's weekly tab (季节赛 每周更新): blocks of one playlist week each ("系列赛7 城市生活
 * 秋季", series 7 autumn), one row per event: type, name, car, then "调校师: <tuner> 调校代码:
 * <code>" (tuner and share code). Only rows that recommend a car are kept.
 */
export function parseNoaSeasonTab(rows: Table, tab: string): RawEventPick[] {
  const out: RawEventPick[] = [];
  let week: { series: number; season: RawEventPick['season'] } | undefined;
  let kind: EventPickKind | undefined;
  let eventName = '';
  rows.forEach((row, r) => {
    const header = row
      .map((c) => /系列赛\s*(\d+)[^夏秋冬春]*(夏季|秋季|冬季|春季)/u.exec(c ?? ''))
      .find(Boolean);
    if (header) {
      week = { series: Number(header[1]), season: SEASONS[header[2]!]! };
      kind = undefined;
      return;
    }
    const type = cell(row, COL.type);
    if (type) {
      kind = KINDS[type];
      eventName = cell(row, COL.name);
    }
    if (!week || !kind) return;
    const notes = cell(row, COL.notes);
    const tune = /调校师\s*[:：]\s*(.+?)\s+调校代码\s*[:：]\s*(\d[\d\s]{8,})/u.exec(notes);
    const car = parseZhCar(cell(row, COL.car));
    if (!car || !tune) return;
    out.push({
      tab,
      row: r + 1,
      ...week,
      kind,
      eventName,
      car,
      tuner: cleanText(tune[1]!),
      shareCode: tune[2]!.replace(/\s/g, ''),
    });
  });
  return out;
}
