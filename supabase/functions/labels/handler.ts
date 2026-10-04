import type { LabelInfo, ToxicityEntry } from '@core/domain.ts';
import { soilCheckRange } from '@core/care/basic.ts';
import { soilCheckLine } from '@core/copy.ts';
import type { RarityTier, Severity } from '@core/toxicity.ts';
import { type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { parseLabelEvent } from '../_shared/validate.ts';

export interface LabelsDeps {
  /** Service-role client; the label endpoints are public and `public_label` is allow-listed field by field. */
  db: Db;
}

/** What `public.public_label` returns (see the migrations); it is not a `LabelInfo`. */
export interface RpcLabel {
  code: string;
  growerName: string;
  cultivar: string | null;
  species: {
    id: string;
    slug: string;
    commonName: string;
    scientificName: string;
    imageUrl: string | null;
    light: string | null;
    checkIntervalDays: number | null;
    warmth: string | null;
    rarityTier: string;
    sensitive: boolean;
  };
  toxicity: {
    animal: string;
    severity: string;
    summary: string | null;
    symptoms: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    reviewStatus: string | null;
  }[];
}

export function labelFromRpc(r: RpcLabel): LabelInfo {
  const s = r.species;
  const interval = s.checkIntervalDays;
  const range = interval === null ? null : soilCheckRange(interval);
  const toxicity: ToxicityEntry[] = r.toxicity.map((t) => ({
    animal: t.animal as 'cat' | 'dog',
    severity: t.severity as Severity,
    summary: t.summary,
    symptoms: t.symptoms,
    sourceName: t.sourceName,
    sourceUrl: t.sourceUrl,
    // Rows still at seed_pending_vet must never read as vet-reviewed, so only an explicit 'reviewed' passes as such.
    reviewStatus: t.reviewStatus === 'reviewed' ? 'reviewed' : 'seed_pending_vet',
  }));
  return {
    code: r.code,
    species: {
      id: s.id,
      commonName: s.commonName,
      scientificName: s.scientificName,
      rarity: s.rarityTier as RarityTier,
      sensitive: s.sensitive,
      imageUrl: s.imageUrl,
    },
    growerName: r.growerName,
    care: {
      light: s.light,
      soilCheck: range ? `Every ${range.min} to ${range.max} days` : null,
      warmth: s.warmth,
    },
    careLines: [
      ...(s.light ? [s.light] : []),
      ...(interval === null ? [] : [soilCheckLine(interval)]),
    ],
    toxicity,
  };
}

const pattern = (pathname: string) => new URLPattern({ pathname });
const normalise = (code: string) => code.trim().toUpperCase();

export function createHandler(deps: LabelsDeps): (req: Request) => Promise<Response> {
  const { db } = deps;
  return router('labels', [
    {
      method: 'GET',
      pattern: pattern('/:code'),
      handle: async (_req, params) => {
        const code = params.code!;
        let label: LabelInfo | null = null;
        if (code.length <= 32) {
          const { data, error } = await db.rpc('public_label', { p_code: code });
          if (error) throwDbError(error);
          label = data ? labelFromRpc(data as unknown as RpcLabel) : null;
        }
        const res = json(label);
        res.headers.set('cache-control', 'public, max-age=60');
        return res;
      },
    },
    {
      method: 'POST',
      pattern: pattern('/:code/events'),
      handle: async (req, params) => {
        const body = parseLabelEvent(await readJson(req));
        const code = normalise(params.code!);
        // Only active codes take events, the same ones the label lookup resolves.
        const known =
          code.length <= 32
            ? await db
                .from('qr_codes')
                .select('code')
                .eq('code', code)
                .eq('status', 'active')
                .maybeSingle()
            : { data: null, error: null };
        if (known.error) throwDbError(known.error);
        if (!known.data) throw new ApiError('not_found', 'Label not found.');
        const ins = await db
          .from('qr_scans')
          .insert({ code, event: body.event, platform: body.platform });
        if (ins.error) throwDbError(ins.error);
        return new Response(null, { status: 204 });
      },
    },
  ]);
}
