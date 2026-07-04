import {
  DATAROOM_ICON_KEYS,
  type DataroomIconKey,
  searchQuerySchema,
  searchResponse,
} from '@dataroom/shared'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { searchDatarooms, searchFiles, searchFolders } from '@/db/queries'

const VALID_ICON_KEYS: ReadonlySet<string> = new Set(DATAROOM_ICON_KEYS)

function normalizeIconKey(raw: string | null): DataroomIconKey | null {
  return raw && VALID_ICON_KEYS.has(raw) ? (raw as DataroomIconKey) : null
}

export async function searchRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/search',
    {
      schema: {
        querystring: searchQuerySchema,
        response: { 200: searchResponse },
      },
    },
    async (req) => {
      const q = (req.query.q ?? '').trim()
      const iconKey = req.query.iconKey ?? null
      const filters = {
        ownerId: req.auth.userId,
        pattern: q.length > 0 ? `%${q}%` : null,
        iconKey,
      }

      const [dataroomHits, folderHits, fileHits] = await Promise.all([
        searchDatarooms(filters),
        searchFolders(filters),
        searchFiles(filters),
      ])

      return {
        datarooms: dataroomHits.map((r) => ({
          id: r.id,
          name: r.name,
          iconKey: normalizeIconKey(r.iconKey),
        })),
        folders: folderHits,
        files: fileHits,
      }
    },
  )
}
