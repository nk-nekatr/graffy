import {
  /* selectByArgs, selectByIds, readSql, */
  put,
  patch,
} from './sql';
import { linkChange } from './link';
import pool from './pool';
import {
  isRange,
  decodeArgs,
  decodeGraph,
  // mergeObject,
} from '@graffy/common';
import debug from 'debug';
import sql from 'sql-template-tag';
const log = debug('graffy:pg:dbWrite');

export default async function dbWrite(change, pgOptions) {
  const sqls = [];
  // const ids = [];
  // const writers = [];
  // const idChanges = [];

  for (const node of change) {
    if (isRange(node)) {
      throw Error(
        node.key === node.end
          ? 'pg_write.delete_unsupported'
          : 'pg_write.write_range_unsupported',
      );
    }

    const object = linkChange(decodeGraph(node.children), pgOptions);
    const arg = decodeArgs(node);

    if (object.$put) {
      if (object.$put !== true) throw Error('pg_write.partial_put_unsupported');
      sqls.push(put(object, arg, pgOptions));
    } else {
      sqls.push(patch(object, arg, pgOptions));
    }

    // if (isArgObject(args)) {
    //   sqls.push(selectByArgs(args, pgOptions, { forUpdate: true }));
    //   writers.push((res) => writeObject(res[0][0], object));
    // } else {
    //   ids.push(node.key);
    //   idChanges.push(object);
    // }
  }

  // if (ids.length) {
  //   sqls.push(selectByIds(ids, pgOptions, { forUpdate: true }));
  //   writers.push((res) =>
  //     Promise.all(
  //       res.map((current, i) => writeObject(current[0], idChanges[i])),
  //     ),
  //   );
  // }

  // const client = await pool.connect();
  // await client.query(sql`BEGIN TRANSACTION`);

  // function writeObject(current, object) {
  //   if (current) {
  //     const updated = object.$put ? object : mergeObject(current, object);
  //     return writeSql(update(updated, pgOptions), client);
  //   } else {
  //     if (!object[pgOptions.idCol] || !object.$put) {
  //       throw Error('pg_insert.not_full_object');
  //     }
  //     return writeSql(insert(object, pgOptions), client);
  //   }
  // }

  // await Promise.all(
  //   sqls.map(async (sql, i) => {
  //     const res = await readSql(sql, client);
  //     log('Writing', res, i);
  //     return writers[i](res);
  //   }),
  // );

  await Promise.all(sqls.map((sql) => writeSql(sql, pool)));

  // await client.query(sql`COMMIT`);
  // client.release();
  log(change);
  return change;
}

async function writeSql(query, client) {
  log(query.text);
  log(query.values);
  const res = await client.query(query);
  log('Rows written', res.rowCount);
  return res.rowCount;
}
