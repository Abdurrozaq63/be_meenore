import { Injectable } from '@nestjs/common';
import { CreateSessionData } from './types/create-session.type';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll({
    userId,
    limit,
    offset,
    favourite,
    tagId,
  }: {
    userId: string;
    limit: number;
    offset: number;
    favourite?: boolean;
    tagId?: string;
  }) {
    const conditions: string[] = ['s.user_id = $1'];
    const values: unknown[] = [userId];
    const countParam: unknown[] = [userId];

    if (favourite !== undefined) {
      values.push(favourite);
      countParam.push(favourite);
      conditions.push(`s.is_favourite = $${values.length}`);
    }
    if (tagId !== undefined) {
      values.push(tagId);
      countParam.push(tagId);
      conditions.push(`s.tag_id = $${values.length}`);
    }
    const whereClause = conditions.join(' AND ');

    const limitParam = `$${values.length + 1}`;
    const offsetParam = `$${values.length + 2}`;
    values.push(limit, offset);

    const [sessionsResult, countResult] = await Promise.all([
      this.databaseService.query(
        `SELECT
      s.id AS "id",
      s.title,
      s.audio_duration_seconds AS "audioDurationSeconds",
      s.is_favourite AS "isFavourite",
      t.id AS "tagId",
      t.title AS "tagTitle",
      t.type AS "tagType",
      s.created_at AS "createdAt"
      FROM sessions s
      LEFT JOIN tags t
      ON s.tag_id = t.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ${limitParam} 
      OFFSET ${offsetParam}`,
        values,
      ),
      this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM sessions s WHERE ${whereClause}`,
        countParam,
      ),
    ]);

    return {
      sessions: sessionsResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }

  async create(data: CreateSessionData, client: PoolClient) {
    const result = await client.query(
      `INSERT INTO sessions(
            user_id,
            tag_id,
            title,
            audio_url,
            audio_duration_seconds,
            raw_transcript
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
            id,
            user_id AS "userId",
            tag_id AS "tagId",
            title,
            audio_url AS "audioUrl",
            audio_duration_seconds AS "audioDurationSeconds",
            raw_transcript AS "rawTranscript",
            is_favourite AS "isFavourite",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
            `,
      [
        data.userId,
        data.tagId,
        data.title,
        data.audioUrl,
        data.audioDurationSeconds,
        data.rawTranscript,
      ],
    );

    return result.rows[0];
  }

  async findById(id: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT
      s.id AS "sessionId",
      s.title AS "sessionTitle",
      s.audio_url AS "audioUrl",
      s.audio_duration_seconds AS "audioDurationSeconds",
      s.raw_transcript AS "rawTranscript",
      s.is_favourite AS "isFavourite",
      s.created_at AS "createdAt",

      st.id AS "themeId",
      st.theme_title AS "themeTitle",
      st.theme_order AS "themeOrder",

      tp.id AS "pointId",
      tp.point_text AS "pointText",
      tp.point_order AS "pointOrder"

      FROM sessions s

      LEFT JOIN session_themes st
      ON st.session_id = s.id

      LEFT JOIN theme_points tp
      ON tp.theme_id = st.id

      where s.id = $1
      AND s.user_id = $2
      ORDER BY st.theme_order ASC, tp.point_order ASC`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const firstRow = result.rows[0];

    const session = {
      id: firstRow.sessionId,
      title: firstRow.sessionTitle,
      audioUrl: firstRow.audioUrl,
      audioDurationSeconds: firstRow.audioDurationSeconds,
      rawTranscript: firstRow.rawTranscript,
      isFavourite: firstRow.isFavourite,
      createdAt: firstRow.createdAt,
      themes: [] as {
        id: string;
        title: string;
        order: number;
        points: {
          id: string;
          text: string;
          order: number;
        }[];
      }[],
    };

    const themesMap = new Map<
      string,
      {
        id: string;
        title: string;
        order: number;
        points: {
          id: string;
          text: string;
          order: number;
        }[];
      }
    >();

    for (const row of result.rows) {
      if (!row.themeId) {
        continue;
      }

      let theme = themesMap.get(row.themeId);

      if (!theme) {
        theme = {
          id: row.themeId,
          title: row.themeTitle,
          order: row.themeOrder,
          points: [],
        };

        themesMap.set(row.themeId, theme);
        session.themes.push(theme);
      }

      if (row.pointId) {
        theme.points.push({
          id: row.pointId,
          text: row.pointText,
          order: row.pointOrder,
        });
      }
    }
    return session;
  }

  async updateFavourite(id: string, userId: string, favourite: boolean) {
    const result = await this.databaseService.query(
      `UPDATE sessions
      SET
      is_favourite = $1,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      AND user_id = $3
      RETURNING
       id,
       title,
       audio_url AS "audioUrl",
       audio_duration_seconds AS "audioDurationSeconds",
       raw_transcript AS "rawTranscript",
       is_favourite AS "isFavourite",
       tag_id AS "tagId",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
      [favourite, id, userId],
    );

    return result.rows[0];
  }

  async delete(id: string, userId: string) {
    const result = await this.databaseService.query(
      `DELETE FROM sessions
      WHERE id = $1
      AND user_id = $2
      RETURNING id`,
      [id, userId],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      audioUrl?: string;
      audioDurationSeconds?: number;
      rawTranscript?: string;
      tagId?: string | null;
    },
    client: PoolClient,
  ) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      values.push(data.title);
      fields.push(`title = $${values.length}`);
    }

    if (data.audioUrl !== undefined) {
      values.push(data.audioUrl);
      fields.push(`audio_url = $${values.length}`);
    }

    if (data.audioDurationSeconds !== undefined) {
      values.push(data.audioDurationSeconds);
      fields.push(`audio_duration_seconds = $${values.length}`);
    }

    if (data.rawTranscript !== undefined) {
      values.push(data.rawTranscript);
      fields.push(`raw_transcript = $${values.length}`);
    }

    if (data.tagId !== undefined) {
      values.push(data.tagId);
      fields.push(`tag_id = $${values.length}`);
    }

    // Tetap perbarui updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const idParam = `$${values.length}`;

    values.push(userId);
    const userIdParam = `$${values.length}`;

    const result = await client.query(
      `UPDATE sessions
     SET ${fields.join(', ')}
     WHERE id = ${idParam}
       AND user_id = ${userIdParam}
     RETURNING
       id,
       title,
       audio_url AS "audioUrl",
       audio_duration_seconds AS "audioDurationSeconds",
       raw_transcript AS "rawTranscript",
       is_favourite AS "isFavourite",
       tag_id AS "tagId",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
      values,
    );

    // Jika result.rows[0] undefined, berartii ID atau userId memang benar-benar tidak cocok di DB
    return result.rows[0];
  }
}
