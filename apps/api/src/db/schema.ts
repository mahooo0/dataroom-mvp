import { relations, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const fileStatusEnum = pgEnum('file_status', ['pending', 'ready', 'failed'])

export const datarooms = pgTable(
  'datarooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: text('owner_id').notNull(),
    iconKey: text('icon_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('datarooms_owner_idx').on(t.ownerId),
  }),
)

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    parentIdx: index('folders_parent_idx').on(t.parentId),
    dataroomIdx: index('folders_dataroom_idx').on(t.dataroomId),
    uniqueName: uniqueIndex('folders_unique_name_idx')
      .on(t.dataroomId, t.parentId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
)

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    s3Key: text('s3_key').notNull(),
    status: fileStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    folderIdx: index('files_folder_idx').on(t.folderId),
    uniqueName: uniqueIndex('files_unique_name_idx')
      .on(t.folderId, t.name)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} = 'ready'`),
  }),
)

export const dataroomShares = pgTable(
  'dataroom_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('dataroom_shares_token_idx').on(t.token),
    activeShareIdx: uniqueIndex('dataroom_shares_active_idx')
      .on(t.dataroomId)
      .where(sql`${t.revokedAt} IS NULL`),
  }),
)

export const dataroomsRelations = relations(datarooms, ({ many }) => ({
  folders: many(folders),
  shares: many(dataroomShares),
}))

export const dataroomSharesRelations = relations(dataroomShares, ({ one }) => ({
  dataroom: one(datarooms, {
    fields: [dataroomShares.dataroomId],
    references: [datarooms.id],
  }),
}))

export const foldersRelations = relations(folders, ({ one, many }) => ({
  dataroom: one(datarooms, {
    fields: [folders.dataroomId],
    references: [datarooms.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_parent',
  }),
  children: many(folders, { relationName: 'folder_parent' }),
  files: many(files),
}))

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
}))
