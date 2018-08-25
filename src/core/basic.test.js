import { Grue, FN_QUERY, RANGE_PATTERN } from './index.js';

describe('query', () => {
  let g;
  beforeEach(() => { g = new Grue(); });

  test('simple', async () => {
    g.use('foo/bar', FN_QUERY, () => Promise.resolve({ foo: { bar:42 }}));
    expect(await g.get({ foo: { bar: 1 }})).toEqual({ foo: { bar: 42 }});
  });

  test('overlap', async () => {
    g.use('foo', FN_QUERY, () => Promise.resolve({ foo: { baz: 15 }}));
    g.use('foo/bar', FN_QUERY, () => Promise.resolve({ foo: { bar:42 }}));
    expect(await g.get({ foo: { bar: 1, baz: 1 }}))
      .toEqual({ foo: { bar: 42, baz: 15 }});
  });

  test('prune', async () => {
    g.use('foo', FN_QUERY, () => Promise.resolve({ foo: { baz: 15, bar: 42 }}));
    expect(await g.get({foo: { bar: 1 }}))
      .toEqual({ foo: { bar: 42 }});
  });

  describe('range', () => {
    let resolver;
    beforeEach(() => {
      resolver = jest.fn();
      resolver.mockReturnValue({ foo: {
        a: { baz: 15, bar: 42 },
        b: { baz: 16, bar: 41 }
      }});
      g.use('foo/*', FN_QUERY, resolver);
    });

    test('all', async () => {
      const result = await g.get({ foo: { '*': { bar: 1 }}});
      expect(resolver).toBeCalledWith(['foo', { all: true }], { bar: 1 });
      expect(result).toEqual({ foo: { a: { bar: 42 }, b: { bar: 41 }}});
    });

    test('multi', async () => {
      const result = await g.get({ foo: { a: { bar: 1 }, b: { baz: 1 }}});
      expect(resolver).toBeCalledWith(['foo', ['a', 'b']], { bar: 1, baz: 1 });
      expect(result).toEqual({ foo: { a: { bar: 42 }, b: { baz: 16 }}});
    });
  });

  describe('link', () => {
    test('basic', async () => {
      g.use('foo', FN_QUERY, () => ({ foo: 'bar' }));
      g.use('bar', FN_QUERY, () => ({ bar: { baz: 3 }}));
      expect(await g.get({ foo: { baz: 1 }}))
        .toEqual({ foo: 'bar', bar: { baz: 3 } });
    });
  });
});

describe('range pattern', () => {
  const testRange = (str, groups) =>
    test(str, () => expect([...(str.match(RANGE_PATTERN))]).toEqual([ str, ...groups ]));

  test('non-range', () => expect('key'.match(RANGE_PATTERN)).toEqual(null));
  testRange('*', ['', '*', '', '', '']);
  testRange('key1*', ['key1', '*', '', '', '']);
  testRange('*key1', ['', '*', 'key1', '', '']);
  testRange('key0*key1', ['key0', '*', 'key1', '', '']);
  testRange('*key1*n', ['', '*', 'key1', '*', 'n']);
  testRange('n*key1*', ['n', '*', 'key1', '*', '']);
  testRange('m*key1*n', ['m', '*', 'key1', '*', 'n']);
  testRange('key0*n**key1', ['key0', '*', 'n', '**', 'key1']);
  testRange('key0**n*key1', ['key0', '**', 'n', '*', 'key1']);
});
