const { assert, config: chaiConfig } = require('chai');

const { error, json, html, status, StatusError } = require('itty-router');

chaiConfig.truncateThreshold = 0;

const alb = require('itty-lambda/alb');

describe('Application load balancers (CJS)', function () {

  describe('eventToRequest', function () {

    it('well formed event', async function () {
      const event = {
        httpMethod: 'POST',
        path: '/path/to/resource',
        queryStringParameters: {
          query: '1234ABCD',
        },
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          host: 'lambda-alb-123578498.us-east-2.elb.amazonaws.com',
          'x-forwarded-port': '80',
          'x-forwarded-proto': 'https',
        },
        body: 'eyJ0ZXN0IjoiYm9keSJ9',
        isBase64Encoded: true,
      };
      const req = await alb.eventToRequest(event);

      assert.equal(req.method, 'POST');

      // assembled url
      assert.equal(req.url, 'https://lambda-alb-123578498.us-east-2.elb.amazonaws.com/path/to/resource?query=1234ABCD')

      // base64 decoded body
      assert.equal(req.body, '{"test":"body"}');

      assert.equal(req.headers.get('x-forwarded-port'), '80');
      assert.include(req.headers.get('accept'), 'text/html');
      assert.include(req.headers.get('accept'), 'application/xhtml+xml');
      assert.include(req.headers.get('accept'), '*/*');
    });

    it('sparse event', async function () {
      const event = {
        queryStringParameters: {
          query: '5678EFGH',
        },
        isBase64Encoded: true,
      };
      const req = await alb.eventToRequest(event);

      // default method (i _think_ this is correct behaviour)
      assert.equal(req.method, 'GET');

      // assembled url from mostly defaults
      assert.equal(req.url, 'http://localhost.localdomain?query=5678EFGH')

      // body not defined, should ignore base64 flag
      assert.equal(req.body, undefined);

      // empty headers
      assert.deepEqual(
        Array.from(
          req.headers.entries()
        ),
        []
      );
    });

    it('empty event', async function () {
      const req = await alb.eventToRequest({}, { defaultMethod: 'HEAD' });

      assert.equal(req.method, 'HEAD');

      // assembled url from ALL defaults
      assert.equal(req.url, 'http://localhost.localdomain?')

      assert.equal(req.body, undefined);
    });

    it('request body w/o base64 encoding', async function () {
      const body = '{"lorem":"ipsum"}';
      const req = await alb.eventToRequest({
        body,
        isBase64Encoded: false,
      });

      assert.equal(req.body, body);
    });

    it('multi value headers and query strings', async function () {
      const req = await alb.eventToRequest({
        queryStringParameters: {
          a: '123zyx',
          z: '987abc',
        },
        multiValueQueryStringParameters: {
          a: ['456wvu', '789tsr'],
          b: ['lorem', 'ipsum'],
        },
        headers: {
          Accept: 'text/html ',
          'Accept-encoding': 'gzip',
        },
        multiValueHeaders: {
          accept: ['	application/xml', ' application/json', 'text/html'],
          'X-Forwarded-Port': ['80','443']
        },
      });

      assert.include(req.url, 'a=123zyx&z=987abc&a=456wvu&a=789tsr&b=lorem&b=ipsum');

      assert.deepEqual(
        Array.from(
          req.headers.entries()
        ),
        [
          [ 'accept', 'text/html, application/xml, application/json' ],
          [ 'accept-encoding', 'gzip' ],
          [ 'x-forwarded-port', '80, 443' ],
        ]
      );
    });

  });

  describe('responseToResult', function () {

    it('well formed response', async function () {
      // simple json encoding with addtl status
      const res = await alb.responseToResult(
        json({ message: "received" }, { status: 202 })
      );

      assert.equal(res.statusCode, 202);
      assert.equal(res.body, '{"message":"received"}');
    });
  
    it('undefined response', async function () {
      // first, implicit undefined
      const res1 = await alb.responseToResult();

      assert.equal(res1.statusCode, 404);
      assert.equal(res1.body, '{"status":404,"error":"Response not found"}');

      // then explicitly with different default status
      const res = await alb.responseToResult(undefined, { fallbackStatus: 420});

      assert.equal(res.statusCode, 420);
      assert.equal(res.body, '{"status":420,"error":"Response not found"}');
    });

    it('status without body', async function () {
      // feed response with null body
      const res = await alb.responseToResult(
        status(301, { headers: { location: '/new/path' } })
      );

      assert.equal(res.statusCode, 301);
      assert.equal(res.body, undefined);
      assert.equal(res.headers.location, '/new/path');
    });

    it('response encoding', async function () {
      // base64 encode response body
      const res = await alb.responseToResult(
        html('howdy'),
        { base64Encode: true }
      );

      assert.equal(res.isBase64Encoded, true);
      assert.equal(res.body, 'aG93ZHk=');
    });

    it('multivalue headers', async function () {
      const cookies = [ 'path=/; domain=xyz.com', 'path=/; domain=abc.org; httponly' ];
      const res = await alb.responseToResult(
        status(
          204,
          {
            headers: {
              'access-control-allow-origin': '*',
              'Set-Cookie': cookies.join(','),
              'CACHE-CONTROL': 'no-cache ,	no-store,no-transform, must-revalidate	',
            }
          }
        ),
        { multiValueHeaders: true }
      );

      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.deepEqual(
        res.multiValueHeaders['access-control-allow-origin'],
        ['*']
      );

      assert.equal(res.headers['set-cookie'], undefined);
      assert.deepEqual(
        res.multiValueHeaders['set-cookie'],
        cookies
      );

      assert.equal(res.headers['cache-control'], undefined);
      assert.deepEqual(
        res.multiValueHeaders['cache-control'],
        [ 'no-cache', 'no-store', 'no-transform', 'must-revalidate' ]
      );
    });

    it('plain error', async function () {
      const err = new Error('shit done broke');
      const res = await alb.responseToResult(error(err));

      assert.equal(res.isBase64Encoded, false);
      assert.equal(res.body, '{"status":500,"error":"shit done broke"}');
    });

    it('status error', async function () {
      const err = new StatusError(418, 'im a little teapot');
      const res = await alb.responseToResult(error(err));

      assert.equal(res.isBase64Encoded, false);
      assert.equal(res.body, '{"status":418,"error":"im a little teapot"}');
    });

    it('malformed response', async function () {
      const res = await alb.responseToResult({ body: 'this should have been a Response instance with headers and a status' });

      assert.equal(res.statusCode, 500);
      assert.include(res.body, '"error":"Cannot read properties of undefined (reading \'entries\')"');
    });

  });

});
