import { selectUpdatedSince, readSql } from './sql';
import { filterObject } from './filter';
import makeOptions from './options';
import {
  isArgObject,
  decodeArgs,
  encodeGraph,
  finalize,
  slice,
  wrap,
  wrapObject,
  unwrap,
} from '@graffy/common';
import { makeStream } from '@graffy/stream';
import dbRead from './dbRead';
import dbWrite from './dbWrite';
import pool from './pool';

import debug from 'debug';
const log = debug('graffy:pg:index');
import { format } from '@graffy/testing';

export default (opts = {}) => (store) => {
  store.on('read', read);
  store.on('write', write);
  store.on('watch', watch);

  const pgOptions = makeOptions(store.path, opts);

  const watchers = new Set();
  let timestamp = Date.now();

  async function poll() {
    if (!watchers.size) return;
    const res = await readSql(selectUpdatedSince(timestamp, pgOptions), pool);

    for (const [object] of res) {
      for (const { query, push } of watchers) {
        const payload = [];

        for (const node of query) {
          const args = decodeArgs(node);
          if (isArgObject(args)) {
            if (filterObject(args, object)) payload.push(object);
          } else {
            if (object.id === node.key) payload.push(object);
          }
        }

        push(wrap(slice(encodeGraph(payload), query).known, store.path));
      }
    }
  }

  setInterval(poll, pgOptions.pollInterval);

  async function read(rootQuery) {
    const query = unwrap(rootQuery, store.path);
    log(format(query));
    const res = await dbRead(query, pgOptions);
    log(format(encodeGraph(wrapObject(res, store.path))));
    const rootResult = finalize(
      encodeGraph(wrapObject(res, store.path)),
      rootQuery,
    );
    log(format(rootResult));
    return rootResult;
  }

  async function write(change) {
    change = unwrap(change, store.path);
    await dbWrite(change, pgOptions);
    return wrap(change, store.path);
  }

  function watch(query) {
    query = unwrap(query, store.path);

    return makeStream((push) => {
      const watcher = { query, push };
      dbRead(query, pgOptions).then((init) => {
        push(wrap(finalize(encodeGraph(init), query), store.path));
        watchers.add(watcher);
      });

      return () => watchers.delete(watcher);
    });
  }
};