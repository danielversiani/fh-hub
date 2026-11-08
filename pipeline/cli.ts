import { updateFixtures } from './commands/fixtures';
import { sync, type InputMode } from './commands/sync';
import { validate } from './commands/validate';

const HELP = `Usage: pnpm <command> [options]

  sync             Read the sources and regenerate data/ (public) and .cache/preview/
    --source=a,b     only these sources (the others reuse their last good snapshot)
    --offline        reuse files in .cache/raw instead of downloading
    --fixtures       run on test fixtures (implies --dry-run)
    --dry-run        do not write anything
    --accept-drop    accept a large drop in rows (intentional clean-up by the tuner)
    --public-only    skip sources without publication permission (scheduled workflow)
  fixtures:update  Download fresh samples into pipeline/__fixtures__ [--source=a,b]
  validate         Validate sources.yaml, manual data, generated data and i18n keys
`;

function parseFlags(args: string[]) {
  const flags = new Map<string, string | true>();
  for (const arg of args) {
    const [key = '', value] = arg.replace(/^--/, '').split('=');
    flags.set(key, value ?? true);
  }
  const source = flags.get('source');
  return {
    sourceIds: typeof source === 'string' ? source.split(',').filter(Boolean) : undefined,
    has: (name: string) => flags.has(name),
  };
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const flags = parseFlags(args);

  switch (command) {
    case 'sync': {
      const mode: InputMode = flags.has('fixtures')
        ? 'fixtures'
        : flags.has('offline')
          ? 'offline'
          : 'live';
      const { ok } = await sync({
        sourceIds: flags.sourceIds,
        mode,
        dryRun: flags.has('dry-run'),
        acceptDrop: flags.has('accept-drop'),
        publicOnly: flags.has('public-only'),
      });
      return ok ? 0 : 1;
    }
    case 'fixtures':
      await updateFixtures(flags.sourceIds);
      return 0;
    case 'validate': {
      const errors = validate();
      for (const e of errors) console.error(`✗ ${e}`);
      console.log(errors.length ? `\n${errors.length} problem(s) found` : '✓ everything valid');
      return errors.length ? 1 : 0;
    }
    default:
      console.log(HELP);
      return command ? 1 : 0;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
