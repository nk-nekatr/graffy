import sql, { raw, join } from 'sql-template-tag';
import { isPlainObject } from '@graffy/common';
import getArgSql from './getArgSql.js';
import { getIdMeta } from './getMeta.js';
import { getInsert, getSelectCols, getUpdates } from './clauses.js';

function getSingleSql(arg, options) {
  const { table, idCol } = options;
  if (!isPlainObject(arg)) {
    return {
      where: sql`"${raw(idCol)}" = ${arg}`,
      meta: getIdMeta(options),
    };
  }

  const { where, meta } = getArgSql(arg, options);
  if (!where?.length) throw Error('pg_write.no_condition');

  // We use a subquery with limit 2 to ensure an error is thrown if the filter
  // matches multiple rows.
  return {
    where: sql`"${raw(idCol)}" = (
        SELECT "${raw(idCol)}"
        FROM "${raw(table)}"
        WHERE ${join(where, ' AND ')}
        LIMIT 2
      )`,
    meta,
  };
}

export function patch(object, arg, options) {
  const { table } = options;
  const { where, meta } = getSingleSql(arg, options);

  const row = object; // objectToRow(object, options);

  return sql`
    UPDATE "${raw(table)}" SET ${getUpdates(row, options)}
    WHERE ${where}
    RETURNING ${getSelectCols(options)}, ${meta}`;
}

export function put(object, arg, options) {
  const { idCol, table } = options;
  const row = object; // objectToRow(object, options);

  let meta;
  let conflictTarget;
  if (isPlainObject(arg)) {
    ({ meta } = getArgSql(arg, options));
    conflictTarget = join(Object.keys(arg).map((col) => sql`"${raw(col)}"`));
  } else {
    meta = getIdMeta(options);
    conflictTarget = sql`"${raw(idCol)}"`;
  }

  const { cols, vals } = getInsert(row, options);

  return sql`
    INSERT INTO "${raw(table)}" (${cols}) VALUES (${vals})
    ON CONFLICT (${conflictTarget}) DO UPDATE SET (${cols}) = (${vals})
    RETURNING ${getSelectCols(options)}, ${meta}`;
}

export function del(arg, options) {
  const { table } = options;
  const { where } = getSingleSql(arg, options);

  return sql`
    DELETE FROM "${raw(table)}"
    WHERE ${where}
    RETURNING ${arg} "$key"`;
}
