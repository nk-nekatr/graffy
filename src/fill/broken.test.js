import Graffy from '@graffy/core';
import { page, link, makeGraph, makeQuery } from '@graffy/common';
import { mockBackend } from '@graffy/testing';
import fill from './index.js';

const expectNext = async (subscription, expected, version = 0) => {
  // console.log('assert', expected);
  expect((await subscription.next()).value).toEqual(
    Array.isArray(expected) ? expected : makeGraph(expected, version),
  );
};

describe('nonlive', () => {
  let store;
  let backend;

  beforeEach(() => {
    store = new Graffy();
    store.use(fill());
    backend = mockBackend();
    store.use(backend.middleware);
    backend.write(makeGraph({ foo: link('/bar') }, 0));
  });

  test('read broken link', async () => {
    const promise = store.read({ foo: { x: true } });
    await expect(promise).rejects.toThrow('fill.max_recursion');
  });

  test('watch broken link', async () => {
    const stream = store.watch({ foo: { x: true } });
    expect(stream.next()).rejects.toThrow('fill.max_recursion');
  });
});

describe('live', () => {
  let store;
  let backend;

  beforeEach(() => {
    store = new Graffy();
    store.use(fill());
    backend = mockBackend({ liveQuery: true });
    store.use(backend.middleware);
    backend.write(makeGraph({ foo: link('/bar') }, 0));
  });

  test.only('watch broken link', async () => {
    const stream = store.watch({ foo: { x: true } });
    expect(stream.next()).rejects.toThrow('fill.max_recursion');
  });
});
