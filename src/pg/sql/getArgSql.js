import sql, { join, raw } from 'sql-template-tag';
import { isEmpty, encodePath } from '@graffy/common';
import { getFilterSql } from '../filter/index.js';
import { getArgMeta, getAggMeta } from './getMeta';
import { getJsonBuildObject } from './clauses.js';

/**
  Uses the args object (typically passed in the $key attribute)

  @param {object} args
  @param {object} options

  @typedef { import('sql-template-tag').Sql } Sql
  @return {{ meta: Sql, where: Sql[], order?: Sql, group?: Sql, limit: number }}
*/
export default function getArgSql(
  { $first, $last, $after, $before, $since, $until, $all, $cursor: _, ...rest },
  options,
) {
  const { $order, $group, ...filter } = rest;
  const { prefix, idCol } = options;

  if ($order && $group) {
    // TODO: Allow this.
    throw Error('pg_arg.order_and_group_unsupported in ' + prefix);
  }

  const lookup = (prop, type) => {
    const [prefix, ...suffix] = encodePath(prop);
    const op = type === 'text' ? sql`#>>` : sql`#>`;
    return suffix.length
      ? sql`"${raw(prefix)}" ${op} ${suffix}`
      : sql`"${raw(prefix)}"`;
  };

  const getType = (prop) => {
    const [_prefix, ...suffix] = encodePath(prop);
    // TODO: Get the actual type using the information_schema
    // and initialization time and stop using any.
    return suffix.length ? 'jsonb' : 'any';
  };

  const meta = (key) =>
    $group ? getAggMeta(key, $group) : getArgMeta(key, prefix, idCol);

  const groupCols =
    Array.isArray($group) && $group.length
      ? $group.map((col) => lookup(col))
      : undefined;

  const group = groupCols ? join(groupCols, ', ') : undefined;

  const hasRangeArg =
    $before || $after || $since || $until || $first || $last || $all || $order;

  let key;
  const where = [];
  if (!isEmpty(filter)) {
    where.push(getFilterSql(filter, lookup, getType));
    key = sql`${JSON.stringify(filter)}::jsonb`;
  }

  if (!hasRangeArg) return { meta: meta(key), where, group, limit: 1 };

  if (isEmpty(rest)) {
    // TODO: Allow these.
    throw Error('pg_arg.pagination_only_unsupported in ' + prefix);
  }

  const orderCols = ($order || [idCol]).map(lookup);
  Object.entries({ $after, $before, $since, $until }).forEach(
    ([name, value]) => {
      if (value) where.push(getBoundCond(orderCols, value, name));
    },
  );

  const orderQuery =
    $order &&
    getJsonBuildObject({ $order: sql`${JSON.stringify($order)}::jsonb` });

  const cursorQuery = getJsonBuildObject({
    $cursor: sql`jsonb_build_array(${join(groupCols || orderCols)})`,
  });

  key = sql`(${join([key, orderQuery, cursorQuery].filter(Boolean), ` || `)})`;

  return {
    meta: meta(key),
    where,
    order:
      $order &&
      join(
        orderCols.map((col) => sql`${col} ${$last ? sql`DESC` : sql`ASC`}`),
        `, `,
      ),
    group,
    limit: $first || $last,
  };
}

function getBoundCond(orderCols, bound, kind) {
  if (!Array.isArray(bound)) {
    throw Error('pg_arg.bad_query bound : ' + JSON.stringify(bound));
  }

  const lhs = orderCols[0];
  const rhs = bound[0];
  if (orderCols.length > 1 && bound.length > 1) {
    const subCond = getBoundCond(orderCols.slice(1), bound.slice(1), kind);
    switch (kind) {
      case '$after':
      case '$since':
        return sql`${lhs} > ${rhs} OR ${lhs} = ${rhs} AND (${subCond})`;
      case '$before':
      case '$until':
        return sql`${lhs} < ${rhs} OR ${lhs} = ${rhs} AND (${subCond})`;
    }
  } else {
    switch (kind) {
      case '$after':
        return sql`${lhs} > ${rhs}`;
      case '$since':
        return sql`${lhs} >= ${rhs}`;
      case '$before':
        return sql`${lhs} < ${rhs}`;
      case '$until':
        return sql`${lhs} <= ${rhs}`;
    }
  }
}
