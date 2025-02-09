import { cmp } from '../../util.js';
import { encode, decode } from '../struct.js';

function tryValue(value) {
  const enc = encode(value);
  const dec = decode(enc);
  expect(dec).toEqual(value);
}

test('emptyobj', () => {
  tryValue({});
});

test('emptyarr', () => {
  tryValue([]);
});

test('simpleobj', () => {
  tryValue({ f: 3 });
});

test('simplearr', () => {
  tryValue([33]);
});

test('sink', () => {
  tryValue({
    a: '',
    b: -23.6,
    c: [1, false, 'Hello!', {}, []],
    d: true,
    e: null,
  });
});

test('num', () => tryValue(123));
test('str', () => tryValue('potatoes'));

test('arrayorder', () => {
  expect(cmp(encode([15.6, 'abc']), encode([15.7])) < 0).toBe(true);
  expect(cmp(encode([15.6, 'abc']), encode([15.6])) > 0).toBe(true);
});

test('emptystr', () => tryValue(''));
