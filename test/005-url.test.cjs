const { assert, config: chaiConfig } = require('chai');

const { error, json, html, status, StatusError } = require('itty-router');

chaiConfig.truncateThreshold = 0;

const url = require('itty-lambda/url');

describe('Lambda function urls', function () {

  describe('eventToRequest', function () {

    it('well formed event', async function () {
      const event = {
        requestContext: {
          domainName: 'supercalifragilistic.abc',
          http: {
            method: 'POST',
            path: 'POST',
          },
        },
        rawPath: '/path/to/resource',
        rawQueryString: 'query=1234ABCD',
        queryStringParameters: {
          query: '5678EFGH',
        },
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          host: 'expialadocious.xyz',
          'x-forwarded-port': '80',
          'x-forwarded-proto': 'https',
        },
        body: 'eyJ0ZXN0IjoiYm9keSJ9',
        isBase64Encoded: true,
      };
      const req = await url.eventToRequest(event);

      assert.equal(req.method, 'POST');

      // assembled url
      assert.equal(req.url, 'https://supercalifragilistic.abc/path/to/resource?query=1234ABCD')

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
      const req = await url.eventToRequest(event);

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
      const req = await url.eventToRequest({}, { defaultMethod: 'HEAD' });

      assert.equal(req.method, 'HEAD');

      // assembled url from ALL defaults
      assert.equal(req.url, 'http://localhost.localdomain?')

      assert.equal(req.body, undefined);
    });

    it('request body w/o base64 encoding', async function () {
      const body = '{"lorem":"ipsum"}';
      const req = await url.eventToRequest({
        body,
        isBase64Encoded: false,
      });

      assert.equal(req.body, body);
    });

    it('multi value headers/querystrings not supported by func urls', async function () {
      const req = await url.eventToRequest({
        headers: {
          'Accept': 'text/html'
        },
        // we shouldn't have these for a function url
        multiValueHeaders: {
          'Accept': ['text/plain', 'application/json', 'application/xml']
        }
      });

      assert.equal(req.headers.get('accept'), 'text/html');
    });

  });

  describe('responseToResult', function () {

    it('well formed response', async function () {
      // simple json encoding with addtl status
      const res = await url.responseToResult(
        json({ message: "received" }, { status: 202 })
      );

      assert.equal(res.statusCode, 202);
      assert.equal(res.body, '{"message":"received"}');
    });
  
    it('undefined response', async function () {
      // first, implicit undefined
      const res1 = await url.responseToResult();

      assert.equal(res1.statusCode, 404);
      assert.equal(res1.body, '{"status":404,"error":"Response not found"}');

      // then explicitly with different default status
      const res = await url.responseToResult(undefined, { fallbackStatus: 420});

      assert.equal(res.statusCode, 420);
      assert.equal(res.body, '{"status":420,"error":"Response not found"}');
    });

    it('status without body', async function () {
      // feed response with null body
      const res = await url.responseToResult(
        status(301, { headers: { location: '/new/path' } })
      );

      assert.equal(res.statusCode, 301);
      assert.equal(res.body, undefined);
      assert.equal(res.headers.location, '/new/path');
    });

    it('response encoding', async function () {
      // base64 encode response body
      const res = await url.responseToResult(
        html('howdy'),
        { base64Encode: true }
      );

      assert.equal(res.isBase64Encoded, true);
      assert.equal(res.body, 'aG93ZHk=');
    });

    it('multivalue headers not supported for function urls', async function () {
      const cookies = [ 'path=/; domain=xyz.com', 'path=/; domain=abc.org; httponly' ];
      const res = await url.responseToResult(
        status(
          204,
          { headers: { 'Cookie-set': cookies.join(',') } }
        ),
        { multiValueHeaders: true }
      );

      assert.deepEqual(res.headers['cookie-set'], cookies.join(','));
      assert.equal(res.multiValueHeaders, undefined);
    });

    it('plain error', async function () {
      const err = new Error('shit done broke');
      const res = await url.responseToResult(error(err));

      assert.equal(res.isBase64Encoded, false);
      assert.equal(res.body, '{"status":500,"error":"shit done broke"}');
    });

    it('status error', async function () {
      const err = new StatusError(418, 'im a little teapot');
      const res = await url.responseToResult(error(err));

      assert.equal(res.isBase64Encoded, false);
      assert.equal(res.body, '{"status":418,"error":"im a little teapot"}');
    });

  });

});
