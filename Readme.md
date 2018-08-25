Grue
===

**Grue is, at this point, a work of fiction. We follow RDD (Readme-driven development)!**
Feel free to open an issue with your thoughts, though.

Grue is an HTTP-based API technology inspired by GraphQL and Falcor. Like them, Grue clients specify exact data requirements - this allows servers to evolve the schema without fear of breaking clients.

Unlike GraphQL and Falcor, Grue is built with live queries and efficient caching as a first-order concern. It also creates APIs that follow familiar REST semantics.

### Conceptual Model

- All the backend data is modelled as a single strongly-typed tree. Every node has a unique path from the root.
- Leaf nodes may be scalar values, _links_ to another point in the tree (making the model a graph), or _actions_ (endpoints to perform actions with side-effects).
- Interior nodes may be _structs_ (with a fixed set of children that may have different types) or _collections_ (with a variable set of children that all have the same type).
- Keys (path segments) may be any scalar value or a fixed-size array of scalar values. All values are encoded as strings in transit.

Grue supports four operations:
- GET: Query or subscribe to a sub-graph, or subscribe to method calls
- PUT, DELETE: Idempotent, side-effect-free mutations of parts of the data model
- POST: Calls a method, which may mutate data and have side-effects

# How to use

For these examples, let's imagine we're building an app that allows users to send pokes to each other. Its data may look like:

```js
{
  users: {
    1: {
      name: 'Alice',
      pokes: {
        1: { __link__: 'pokes/1' },
        ...
      },
      poke()
    },
    2: {
      name: 'Bob',
      pokes: {
        1: { __link__: 'pokes/1' },
        ...
      },
      poke()
    },
    ...
  },
  pokes: {
    1: {
      time: '2018-01-01T00:00:00',
      participants: {
        poker: { __link__: 'users/1' },
        pokee: { __link__: 'users/2' }
      },
      message: 'Hi!'
    },
    ...
  }
}
```

The `{ __link__: '...' }` object represents a link. The `poke()` function is an `action`.

Typically the data will not be stored in this format anywhere; a server would usually load data on demand from traditional databases. It's even possible (and typical) to store different parts of the graph in different data stores!

## Making Simple Queries (Client)

Leaf nodes can be fetched directly using REST:

```js
grue.get('users/1/name')
// Returns a promise resolving to:
"Alice"
```
Under the hood, this is an HTTP request:
```http
GET /users/1/name
```

However, querying objects and arrays in a similar way does not work as expected:

```js
grue.get('pokes/1')
{}
```

This is because Grue does not include child fields by default.

The client must specify the fields it is interested in, using a GraphQL-like JSON structure we call the _shape_:

```js
grue.get('pokes/1', { time: true, message: true })
{ time: '2018-01-01T00:00:00', message: 'Hi!' }
```
Any truthy value can be used in place of `true` to indicate fields to request. The HTTP request is:

```http
GET /pokes/1?include=time,message
```

Links can be traversed transparently:
```js
grue.get(['pokes', 1, 'participants', 'poker', 'name'])
"Alice"
```
The HTTP response contains headers listing the redirects made in resolving the query. This information helps the client library cache the request efficiently:
```http
GET /pokes/1/participants/poker/name

200 Ok
X-Grue-Link: pokes/1/participants/poker users/1

"Alice"
```
There can be muliple `X-Grue-Link` headers in a response.

Links themselves are considered scalars, which allow them to be modified with PUT and DELETE:
```js
grue.get(['pokes', 1, 'participants', 'poker'])
{ __link__: 'users/1' }
```

What if we need the names of all participants? We can use the `*` wildcard:

```js
grue.get(['pokes', 1, 'participants'], { '*': { name: true } })
{ poker: { name: 'Alice' },
  pokee: { name: 'Bob' } }
```
```http
GET /pokes/1/participants?include=*/name
```

## Making Complex Queries (Client)

`*` should only be used for nodes that we know to have a limited number of keys. For nodes with many keys, a better approach is to use key ranges that allow retrieving only some of the keys.

### Key Ranges

Let's say we want the first 10 users, ordered by user ID:
```js
grue.get('users', { [grue.range({ first: 10 })]: { name: true } })
{ __range__: { hasFirst: true, hasLast: false },
  1: { name: 'Alice' },
  2: { name: 'Bob' },
  ... }
```
```http
GET /users?include=(f:10)/name
```

`grue.range()` returns a string representing a _key range_.

Key ranges support four parameters (`first`, `after`, `last` and `before`) that work similarly to GraphQL Connections for cursor-based pagination. `after` and `before` are interpreted as keys, while `first` and `last` are positive integers. The `__range__` object in the response is similar to a GraphQL Connection's `PageInfo`.

### Indexes

Paginating over things by ID alone isn't very useful. More realistically, we might want the latest 10 pokes by `time`:

```js
grue.get(['pokesByTime', grue.filter({})], {
  [grue.range(last: 10)]: { message }
})
{ __range__: { hasFirst: false, hasLast: true },
  ...
  1999: { message: 'Poke!' },
  2000: { message: 'Hey.' } }
```
The HTTP query is:

```http
GET /pokesByTime/(:)?include=(l:10)/message
```

`pokesByTime` is an _index_ of the `pokes` collection.

Note that all objects returned by grue have a `[Symbol.iterator]` property, so they can be used in for-of loops to iterate over the values in key order. This is particularly useful with views.

View keys can be used both in the `path` and `shape` arguments of `grue.get`.

```js
grue.get('users', { grue.range(first: 2): {
  name: true,
  grue.viewRange('pokes', { role: 'pokee', by: 'time', last: 3 }): {
    message: true
  }
} })
```
```http
GET /users?include=(f:2)/(name,pokesByTime/role:pokee/(l:3)/message)
```

## Making Live Queries (Client)

`grue.watch()` works with the same arguments as `grue.get()` but returns a stream of responses. The responses are _immutable_, i.e. when the data changes it emits a new object rather than modifying objects that were emitted previously.

Two APIs are being considered. Observables:
```js
const subscription = grue.watch('/users/1', { name })
  .subscribe(value => { /* do something */ });

// When we're done
subscription.unsubscribe();
```

and Async Iterators:
```js
const stream = grue.watch('/users/1', { name });

for await (const value of stream) { /* do something */ }

// When we're done
stream.close();
```
Over HTTP, live queries use Server-Sent-Events.

```http
GET /users/1?include=name
Accept: text/event-stream
```

## Serving Queries (Server)

Grue servers can be created using `grue.server(schema)`.

### Schema

The schema object describes the shape of the data store and is a tree of objects, using Grue's type system for scalars. For example, the schema for a Poke is:
```js
const Poke = {
  startTime: grue.date.required,
  message: grue.string,
  participants: {
    poker: grue.link.required,
    pokee: grue.link.required
  }
}
```

Here `Poke` and `Poke.participants` are _structs_, because their keys are known ahead of time. The other kind of node in schemas is the _collection_, whose keys are not known, although their types are.

An example is the PokeCollection:

```js
const PokeCollection = {
  [grue.keyType]: grue.string,
  [grue.valueType]: Poke
}
```

The root schema can be defined as:
```js
{
  users: UserCollection,
  pokes: PokeCollection
}
```

### Handlers

Functions may be attached at nodes in the Schema tree to handle requests (such as queries and actions) from the client.

The `read` handler is a function that returns a stream of values. On an action node it creates subscriptions to events. On any other node it fetches the node's data from the data store, and optionally watches the data store for any changes to the node.

The `write` handler on an action node implements the action, and on any other node writes an update to the node's data.

For example, say we store users in an database and push an event to a queue whenever a user is created or changed:

```js
const server = grue.server(schema);

server.read('pokes', shape => {

  const pokeIds = Object.keys(shape);
  const initial = await db.getPokes(pokeIds); // { id1: Poke1, id2: Poke2 }
  yield current;

  while (!cancelToken.isCancelled()) {
    const event = await queue.readNext('poke');
    if (pokeIds.includes(event.id)) yield { [event.id]: event };
  }
});
```
Here, shape is a subtree of what was passed to the `grue.get()` function.

### Default Handlers



### Changesets

The values returned by the read handler (except the first value) and expected by the write handler are _changeset_ objects. They are represented by JSON Merge Patch sets.
{
  "abc/def/ghi": {}
}
