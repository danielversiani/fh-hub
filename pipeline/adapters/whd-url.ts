import { cell, findHeader } from '../lib/table';
import { parseShareCode } from '../normalize/fields';
import { emptyOutput, requireTab, type Adapter, type RawCustomEvent } from './types';

/**
 * Underground Racing League by Wrong Hand Drive. The sheet is split into "car packs": each pack
 * starts with a row holding its title plus the labels "Adj. Aero | Drivetrain | Tuned By".
 * Data columns sit at fixed offsets to the left of "Adj. Aero":
 * label (-5), car (-4), tune code (-3), livery code (-2), PI (-1).
 * The last pack also lists event routes (name + event share code + creator in the PI column).
 */
export const whdUrl: Adapter = {
  id: 'whd-url',
  parse(input) {
    const out = emptyOutput();
    const event: RawCustomEvent = {
      id: 'underground-racing-league',
      organizer: input.source.ownerTuner ?? 'Wrong Hand Drive',
      name: 'Underground Racing League',
      groups: [],
    };
    for (const tab of input.source.tabs) {
      const { rows } = requireTab(input, tab.id, 'table');
      const { index, col } = findHeader(rows, ['Adj. Aero', 'Drivetrain', 'Tuned By'], {
        sourceId: input.source.id,
        tab: tab.id,
      });
      const aero = col['Adj. Aero'];

      rows.slice(index).forEach((row, offset) => {
        if (cell(row, aero) === 'Adj. Aero') {
          event.groups.push({ name: cell(row, aero - 4), entries: [] });
          return;
        }
        const tuneCode = cell(row, aero - 3);
        const group = event.groups.at(-1);
        if (!group || !parseShareCode(tuneCode)) return;
        const label = cell(row, aero - 5);
        const pi = cell(row, aero - 1);
        // Event routes (tracks shared by code) have no label, and the PI column holds the
        // route's creator instead of a number.
        const isRoute = !label && !/^\d{3}$/.test(pi);
        group.entries.push({
          row: index + offset + 1,
          kind: isRoute ? 'route' : 'car',
          label,
          car: { text: cell(row, aero - 4) },
          tuneCode,
          livery: isRoute ? undefined : cell(row, aero - 2) || undefined,
          pi: isRoute ? undefined : pi || undefined,
          adjustableAero: isRoute ? undefined : cell(row, aero) || undefined,
          drivetrain: isRoute ? undefined : cell(row, col.Drivetrain) || undefined,
          tunedBy: (isRoute ? pi : cell(row, col['Tuned By'])) || undefined,
        });
      });
    }
    event.groups = event.groups.filter((g) => g.entries.length > 0);
    out.customEvents.push(event);
    return out;
  },
};
