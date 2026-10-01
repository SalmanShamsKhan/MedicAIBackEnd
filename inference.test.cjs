const test = require('node:test');
const assert = require('node:assert/strict');
const { createPredictHandler, MAX_IMAGE_BYTES } = require('./inference.cjs');
const valid = Buffer.from('fixture').toString('base64');
async function run(image, request = async () => ({ data: 'NORMAL' }), url = 'https://example.test/predict') {
  let status = 200;
  let body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await createPredictHandler({ request, url })({ body: { image } }, res);
  return { status, body };
}
test('accepts data URLs, forwards binary data with a timeout and preserves result contract', async () => {
  const result = await run('data:image/png;base64,' + valid, async options => {
    assert.equal(options.timeout, 15000);
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.data.toString(), 'fixture');
    return { data: 'NORMAL' };
  });
  assert.deepEqual(result, { status: 200, body: { message: 'NORMAL' } });
});
test('rejects malformed input without invoking the service', async () => {
  for (const image of [undefined, {}, '', '%%%%', 'abc', 'abcd====']) {
    assert.equal((await run(image, () => { throw new Error('must not call'); })).status, 400);
  }
});
test('bounds uploads before making a request', async () => {
  assert.equal((await run(Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64'))).status, 413);
});
test('fails closed for missing or non-HTTPS inference configuration', async () => {
  for (const url of ['', 'http://example.test', 'https://user:password@example.test']) {
    assert.equal((await run(valid, undefined, url)).status, 503);
  }
});
test('returns 504 for timeout and 502 for an upstream error or absent result', async () => {
  assert.equal((await run(valid, async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); })).status, 504);
  assert.equal((await run(valid, async () => { throw new Error('private provider error'); })).status, 502);
  assert.equal((await run(valid, async () => ({}))).status, 502);
});
