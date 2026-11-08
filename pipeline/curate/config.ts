import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { ROOT } from '../paths';
import { Tier } from '../schema/enums';

const Weights = z.object({
  tier: z.number().min(0),
  laptime: z.number().min(0),
  endorsement: z.number().min(0),
  tuner: z.number().min(0),
  recency: z.number().min(0),
  ease: z.number().min(0),
});
export type Weights = z.infer<typeof Weights>;
export type Signal = keyof Weights;

export const CurationConfig = z.object({
  version: z.literal(1),
  weights: Weights,
  weightsPlaylist: Weights,
  thresholds: z.object({
    minConfidenceForMeta: z.number().min(0).max(1),
    offMetaMinScore: z.number().min(0).max(1),
    unlistedTunerTierFactor: z.number().min(0).max(1),
  }),
  categories: z.object({
    metaTiers: z.array(Tier),
    offMetaTiers: z.array(Tier),
    defaultTier: Tier,
    memeCars: z.array(z.string()),
  }),
  tuners: z
    .record(z.string(), z.number().min(0).max(1))
    .nullable()
    .transform((v) => v ?? {}),
  preferObtainable: z.boolean(),
  lastPhysicsPatch: z.iso.date().nullable(),
  pastSeasonsWithSuggestions: z.number().int().min(0),
});
export type CurationConfig = z.infer<typeof CurationConfig>;

export const CURATION_CONFIG_FILE = path.join(ROOT, 'data', 'curation', 'config.yaml');

export function loadCurationConfig(file = CURATION_CONFIG_FILE): CurationConfig {
  return CurationConfig.parse(parseYaml(fs.readFileSync(file, 'utf8')));
}
