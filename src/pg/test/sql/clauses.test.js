import sql, { raw } from 'sql-template-tag';
import expectSql from '../expectSql';
import {
  getInsert,
  getUpdates,
  nowTimestamp,
  getJsonBuildTrusted,
  getSelectCols,
} from '../../sql/clauses';

describe('clauses', () => {
  const data = { a: 1, b: 1 };

  test('insert', () => {
    const { cols, vals } = getInsert(data, {
      verCol: 'version',
      schema: { types: { a: 'int8', b: 'float', version: 'int8' } },
    });
    expectSql(cols, sql`"a", "b", "version"`);
    expectSql(vals, sql`${data.a} , ${data.b} , ${nowTimestamp}`);
  });

  test('updates', () => {
    const options = {
      idCol: 'id',
      verCol: 'version',
      schema: { types: { a: 'int8', b: 'float', version: 'int8' } },
    };
    const update = getUpdates(data, options);
    expectSql(
      update,
      sql`"a" = ${data.a}, "b" = ${data.b}, "version" =  ${nowTimestamp}`,
    );
  });

  test('jsonBuildObject', () => {
    const data = { a: 1, b: 2, version: nowTimestamp };
    const query = getJsonBuildTrusted(data);
    expectSql(
      query,
      sql`jsonb_build_object('a', ${'1'}::jsonb, 'b', ${'2'}::jsonb, 'version', ${nowTimestamp})`,
    );
  });

  test('selectCols', () => {
    const table = 'test';
    const query = getSelectCols(table);
    expectSql(query, sql`to_jsonb("${raw(table)}")`);
  });
});
