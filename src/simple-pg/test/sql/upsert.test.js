import { put, patch } from '../../sql';

import sql from 'sql-template-tag';
import expectSql from '../expectSql.js';
import { nowTimestamp } from '../../sql/helper';

describe('test upset', () => {
  const options = { id: 'id', table: 'post', version: 'version' };
  const id = 'post22';
  const data = {
    type: 'post',
    name: 'hello',
    email: 'world',
  };
  test('should return correct upsert fof put sql with right params and values', async () => {
    const sqlQuery = put(data, id, options);
    expectSql(
      sqlQuery,
      sql`INSERT INTO "post" ("id", "type", "name", "email", "version")
      VALUES (${id}, ${data.type}, ${data.name}, ${data.email}, ${nowTimestamp} )
      ON CONFLICT ("id") DO UPDATE SET
      ("type", "name", "email", "version") = (${data.type},${data.name}, ${data.email}, ${nowTimestamp})
      RETURNING row_to_json ( post.*  ) 
    `,
    );
  });

  test('should return correct upsert fof patch sql with right params and values', async () => {
    const sqlQuery = patch(data, data.id, options);
    expectSql(
      sqlQuery,
      sql`UPDATE "post" SET
        "type" = ${data.type},
        "name" = ${data.name},
        "email" = ${data.email},
        "version" = ${nowTimestamp}
      WHERE "id" = ${data.id}
      RETURNING row_to_json (  post.*  ) 
    `,
    );
  });
});