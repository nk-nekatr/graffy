import {
  decodeGraph,
  decodeQuery,
  encodeGraph,
  encodeQuery,
} from '../index.js';

import { keyref, put } from '@graffy/testing';

describe('graph', () => {
  function roundTrip(original, expected = original, callback = null) {
    const encoded = encodeGraph(original);
    const decoded = decodeGraph(encoded);
    expect(decoded).toEqual(expected);
    if (callback) callback(decoded);
  }

  test('cursor', () => {
    roundTrip([
      {
        $key: { $order: ['id'], $cursor: [123] },
        name: 'Alice',
      },
    ]);
  });

  test('simple', () => {
    const users = [
      { $key: '1', name: 'Alice', settings: { $val: ['hi'] } },
      { $key: '2', name: 'Bob', manager: { $ref: 'users.1' }, foo: null },
    ];

    const expectedUsers = {
      1: { name: 'Alice', settings: ['hi'] },
      2: { name: 'Bob', manager: {}, foo: null },
    };

    const posts = [];
    const tags = { a: true, b: true };

    roundTrip(
      { users, posts, tags },
      { users: expectedUsers, tags },
      (decoded) => {
        expect(decoded.users['2'].manager.$ref).toEqual(['users', '1']);
        expect(decoded.users['1'].settings.$val).toBe(true);
      },
    );
  });

  test('skipped_array', () => {
    roundTrip(
      { foo: { $key: { email: 'a' }, name: 'x' } },
      { foo: [{ $key: { email: 'a' }, name: 'x' }] },
    );
  });

  test('point_deletion', () => {
    roundTrip({ foo: null });
  });

  test('point_in_range_deletion', () => {
    roundTrip([{ $key: { $cursor: ['foo'] } }]);
  });

  test('plain_range', () => {
    roundTrip({ $put: { $before: ['a'] } }, {}, (decoded) => {
      expect(decoded.$put).toEqual([{ $before: ['a'] }]);
    });
  });

  test('arrayCursor.encode', () => {
    roundTrip([{ $key: [23], $val: 25 }]);
  });

  test('bounded_range', () => {
    roundTrip({ $put: { $after: ['a'], $before: ['b'] } }, {}, (decoded) => {
      expect(decoded.$put).toEqual([{ $after: ['a'], $before: ['b'] }]);
    });
  });

  test('put_true', () => {
    roundTrip({ foo: 3, $put: true }, { foo: 3 }, (decoded) => {
      expect(decoded.$put).toBe(true);
    });
  });

  test('put_partial', () => {
    roundTrip({ foo: 3, $put: [{ $until: 'goo' }] }, { foo: 3 }, (decoded) => {
      expect(decoded.$put).toEqual([{ $until: 'goo' }]);
    });
  });

  test('empty', () => {
    roundTrip({ foo: {} }, {});
  });

  test('empty2', () => {
    roundTrip({});
  });

  test('empty3', () => {
    roundTrip(undefined, {});
  });

  test('plain_array', () => {
    roundTrip(['js', 'css']);
  });

  test('array_update', () => {
    roundTrip([{ $key: 0, $val: 'ts' }]);
  });

  test('refWithProperties', () => {
    roundTrip(
      { foo: { $ref: ['bar'], baz: 42 } },
      { foo: {}, bar: { baz: 42 } },
      (dec) => {
        expect(dec.foo.$ref).toEqual(['bar']);
      },
    );
  });

  test('refWithValue', () => {
    roundTrip(
      { foo: { $ref: ['bar'], $val: 42 } },
      { foo: {}, bar: 42 },
      (dec) => {
        expect(dec.foo.$ref).toEqual(['bar']);
      },
    );
  });

  test('rangeRef', () => {
    roundTrip(
      {
        foo: [
          {
            $key: { $all: true, tag: 'x' },
            $ref: ['bar', { $all: true, tag: 'x', id: 'y' }],
          },
        ],
      },
      { foo: [{ $key: { $all: true, tag: 'x' } }] },
      (decoded) =>
        expect(decoded.foo[0].$ref).toEqual([
          'bar',
          { $all: true, tag: 'x', id: 'y' },
        ]),
    );
  });

  test('rangeWithChi', () => {
    roundTrip(
      [
        {
          $key: { tag: 'x', $first: 2 },
          $chi: [
            { $key: { i: 1 }, foo: 1 },
            { $key: { i: 2 }, foo: 2 },
          ],
        },
      ],
      [
        { $key: { tag: 'x', $cursor: { i: 1 } }, foo: 1 },
        { $key: { tag: 'x', $cursor: { i: 2 } }, foo: 2 },
      ],
    );
  });

  test('rangeWithCursor', () => {
    const arr = [
      { $key: { tag: 'x', $cursor: { i: 1 } }, foo: 1 },
      { $key: { tag: 'x', $cursor: { i: 2 } }, foo: 2 },
    ];

    roundTrip(arr);
  });

  test('emptyString', () => {
    roundTrip({ $key: '', $val: 4 }, { '': 4 });
  });

  test('ranges', () => {
    roundTrip({ foo: [{ $key: { $until: 'a' } }] }, { foo: {} }, (decoded) => {
      expect(decoded.foo.$put).toEqual([{ $until: 'a' }]);
    });
  });

  test('emptyNestedObjects', () => {
    roundTrip({ foo: { bar: { baz: {} } } }, {});
  });

  test('cursor_only', () => {
    roundTrip([{ $key: { $cursor: ['a'] }, name: 'A' }]);
  });

  const original1 = {
    tenant: put(
      [
        {
          id: 'bar',
          name: 'Bar',
          $key: 'bar',
        },
        {
          id: 'foo',
          name: 'Foo',
          $key: 'foo',
        },
        keyref({ $order: ['id'], $cursor: ['bar'] }, ['tenant', 'bar']),
        keyref({ $order: ['id'], $cursor: ['foo'] }, ['tenant', 'foo']),

        // {
        //   $key: { $order: ['id'], $cursor: ['foo'] },
        //   $ref: ['tenant', 'foo'],
        // },
      ],
      [{ $order: ['id'], $all: true }],
    ),
  };

  const original2 = {
    tenant: [
      {
        id: 'foo',
        name: 'Foo',
        $key: 'foo',
      },
      {
        id: 'bar',
        name: 'Bar',
        $key: 'bar',
      },
      {
        $key: { $order: ['id'], $all: true },
        $chi: [
          { $key: ['foo'], $ref: ['tenant', 'foo'] },
          { $key: ['bar'], $ref: ['tenant', 'bar'] },
        ],
      },
    ],
  };

  const original3 = {
    gParticipant: put(
      [ 
        { 
          domains: { 'nektartest.page': true },
          emailAddresses: { 
            'minato@nektartest.page': { 
              tags: { 
                work: true,
              },
            },
          },
          id: 'c0661bc9-991b-4701-a9ad-4421f722531e',
          integrationId: 'minato@nektartest.page',
          isDeleted: false,
          jobTitle: null,
          name: 'Minato',
          phoneNumbers: null,
          tenantId: 'c126cf52-2c80-45e3-8419-eb8fbff041f0',
          '$key': 'c0661bc9-991b-4701-a9ad-4421f722531e'
        },
        { 
          domains: { 'nektartest.page': true },
          emailAddresses: { 
            'minato@nektartest.page': { 
              tags: { 
                work: true,
              },
            },
          },
          id: 'cd57af2f-274e-4ff8-ada2-b5c97e589ed9',
          integrationId: 'minato@nektartest.page',
          isDeleted: false,
          jobTitle: null,
          name: 'Minato',
          phoneNumbers: null,
          tenantId: 'c126cf52-2c80-45e3-8419-eb8fbff041f0',
          '$key': 'cd57af2f-274e-4ff8-ada2-b5c97e589ed9'
        },
        {
          '$key': {
            '$or': [ 
              { 
                '$or': [
                  { 
                    emailAddresses: { 
                      '$cts': { 
                        'minato@nektartest.page': {} 
                      } 
                    } 
                  },
                ] 
              },
            ],
           '$order': [ 'createdAt', 'id',  ],
           isDeleted: false,
           tenantId: 'c126cf52-2c80-45e3-8419-eb8fbff041f0',
           '$cursor': [ 1674050462847, 'c0661bc9-991b-4701-a9ad-4421f722531e',  ] },
          $ref: [ 'gParticipant', 'c0661bc9-991b-4701-a9ad-4421f722531e' ]
        },
        { 
          '$key': {
            '$or':[ 
              {
                '$or': [ 
                  { 
                    emailAddresses: { 
                      '$cts': { 
                        'minato@nektartest.page': {}
                      } 
                    } 
                  },
                ] 
              },
            ],
            '$order': [ 'createdAt', 'id',  ],
            isDeleted: false,
            tenantId: 'c126cf52-2c80-45e3-8419-eb8fbff041f0',
            '$cursor': [ 1674050462870, 'cd57af2f-274e-4ff8-ada2-b5c97e589ed9']
          },
          $ref: [ 'gParticipant', 'cd57af2f-274e-4ff8-ada2-b5c97e589ed9' ]
        },
      ]
    )
  }

  test ('rangeQuery test case with $ref', () => {
    roundTrip(original3);
  });

  test('mix1', () => {
    roundTrip(original1, original1, (decoded) => {
      expect(decoded.tenant[2].$ref).toEqual(['tenant', 'bar']);
      expect(decoded.tenant[3].$ref).toEqual(['tenant', 'foo']);
    });
    // const encoded = encodeGraph(original1, 1);
    // console.log(encoded);
    // const decoded = decodeGraph(encoded);
    // console.log(decoded);
  });

  test('mix2', () => {
    roundTrip(original2, original1, (decoded) => {
      expect(decoded.tenant[2].$ref).toEqual(['tenant', 'bar']);
      expect(decoded.tenant[3].$ref).toEqual(['tenant', 'foo']);
    });

    // const encoded = encodeGraph(original2, 0);
    // console.log(encoded);
    // const decoded = decodeGraph(encoded);
    // console.log(decoded);
  });

  test('nested_empty_object', () => {
    roundTrip(
      {
        person: [
          {
            $key: { example: 'filter', $cursor: ['something'] },
            $ref: ['person', 'exampleId'],
            domains: {},
          },
        ],
      },
      {
        person: [
          {
            $key: { example: 'filter', $cursor: ['something'] },
          },
        ],
      },
      (decoded) =>
        expect(decoded.person[0].$ref).toEqual(['person', 'exampleId']),
    );
  });
});

describe('query', () => {
  function roundTrip(original, expected = original, callback = null) {
    const encoded = encodeQuery(original);
    const decoded = decodeQuery(encoded);
    expect(decoded).toEqual(expected);
    if (callback) callback(decoded);
  }

  test('firstN', () => {
    roundTrip([{ $key: { $order: ['id'], $first: 3 }, name: true }]);
  });

  test('sink', () => {
    roundTrip(
      {
        postCount: 1,
        posts: {
          $key: { $first: 10, $since: '1984' },
          title: 1,
          body: 1,
          author: { name: 1 },
        },
        tags: { $key: { $first: 10 } },
        reactions: { $key: { $last: 100 } },
      },
      {
        postCount: true,
        posts: [
          {
            $key: { $first: 10, $since: '1984' },
            title: true,
            body: true,
            author: { name: true },
          },
        ],
        tags: [{ $key: { $first: 10 } }],
        reactions: [{ $key: { $last: 100 } }],
      },
    );
  });

  test('rangeRef1', () => {
    roundTrip({ foo: [{ $key: { $all: true, tag: 'x' } }] });
  });

  test('rangeRef2', () => {
    roundTrip(
      { foo: { $key: { $all: true, tag: 'x' } } },
      { foo: [{ $key: { $all: true, tag: 'x' } }] },
    );
  });

  describe('alias', () => {
    test('simple', () => {
      roundTrip({ foo: { $ref: ['bar'] } }, { bar: true });
    });

    test('children', () => {
      roundTrip({ foo: { $ref: ['bar'], x: true } }, { bar: { x: true } });
    });

    test('range', () => {
      roundTrip(
        { foo: { $ref: ['bar', { $first: 4, t: '3' }], x: true } },
        { bar: [{ $key: { $first: 4, t: '3' }, x: true }] },
      );
    });

    test('emptyNestedObjects', () => {
      roundTrip({ foo: { bar: { baz: {} } } }, {});
    });
  });
});
