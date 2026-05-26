import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Asset from 'expo-asset';

export interface OfflineResult {
  id: number;
  content: string;
  page_number: number;
  document_title: string;
  source_url: string;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function initOfflineDB(): Promise<void> {
  try {
    // Load the bundled SQLite file from assets
    const asset = Asset.Asset.fromModule(
      require('../assets/safetyiq_offline.db')
    );
    await asset.downloadAsync();

    const dbPath = `${FileSystem.documentDirectory}SQLite/safetyiq_offline.db`;
    const dbDir = `${FileSystem.documentDirectory}SQLite`;

    // Create SQLite directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    // Copy the bundled db to the app's document directory if not already there
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (!dbInfo.exists) {
      await FileSystem.copyAsync({
        from: asset.localUri!,
        to: dbPath,
      });
    }

    db = await SQLite.openDatabaseAsync('safetyiq_offline.db');
    console.log('✅ Offline database initialized');
  } catch (error) {
    console.error('Failed to initialize offline DB:', error);
  }
}

export async function searchOffline(
  query: string,
  limit: number = 5
): Promise<OfflineResult[]> {
  if (!db) {
    await initOfflineDB();
  }

  if (!db) {
    throw new Error('Offline database not available');
  }

  // Detect CFR number pattern e.g. "29 CFR 1910.147" or "1910.147" or "1926.502"
  const cfrPattern = /(\d{4}\.\d+\w*)/i;
  const cfrMatch = query.match(cfrPattern);

  if (cfrMatch) {
    const cfrNumber = cfrMatch[1];
    try {
      // First try to find chunks from the actual regulation document
      const directResults = await db.getAllAsync<OfflineResult>(
        `SELECT
          id,
          content,
          page_number,
          document_title,
          source_url
        FROM chunks
        WHERE document_title LIKE ?
        ORDER BY page_number ASC
        LIMIT ?`,
        [`%${cfrNumber}%`, limit]
      );
      if (directResults.length > 0) return directResults;

      // Fallback — search content if no direct document match
      const contentResults = await db.getAllAsync<OfflineResult>(
        `SELECT
          id,
          content,
          page_number,
          document_title,
          source_url
        FROM chunks
        WHERE content LIKE ?
        ORDER BY page_number ASC
        LIMIT ?`,
        [`%${cfrNumber}%`, limit]
      );
      if (contentResults.length > 0) return contentResults;
    } catch (error) {
      console.error('CFR lookup error:', error);
    }
  }

  // Clean and split query into keywords
  const keywords = query
    .toLowerCase()
    .replace(/[\/\-\_]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter((word) => word.length > 2)
    .filter((word) => !['the', 'and', 'for', 'are', 'what', 'when', 'how', 'is', 'in', 'of', 'to', 'a', 'an'].includes(word));

  if (keywords.length === 0) {
    return [];
  }

  try {
    // Build FTS5 query with OR logic between keywords
    const ftsQuery = keywords.join(' OR ');
    const results = await db.getAllAsync<OfflineResult>(
      `SELECT
        c.id,
        c.content,
        c.page_number,
        c.document_title,
        c.source_url
      FROM chunks_fts
      JOIN chunks c ON chunks_fts.rowid = c.id
      WHERE chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?`,
      [ftsQuery, limit]
    );
    if (results.length > 0) return results;

    // Fallback — LIKE search on each keyword
    const likeConditions = keywords.map(() => 'content LIKE ?').join(' OR ');
    const likeParams = keywords.map((k) => `%${k}%`);
    const fallbackResults = await db.getAllAsync<OfflineResult>(
      `SELECT
        id,
        content,
        page_number,
        document_title,
        source_url
      FROM chunks
      WHERE ${likeConditions}
      LIMIT ?`,
      [...likeParams, limit]
    );
    return fallbackResults;
  } catch (error) {
    console.error('Offline search error:', error);
    return [];
  }
}
