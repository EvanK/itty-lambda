const { assert } = require('chai');

// NOTE: to properly test export formats, its necessary to first run:
// npm link && npm link itty-lambda

describe('CJS exports', function () {

  it('top level default export', async function () {
    const ittyLambda = require('itty-lambda');

    // assert.property(ittyLambda, 'ag');

    // assert.equal(ittyLambda.ag.eventToRequest.constructor.name, 'AsyncFunction');
    // assert.equal(ittyLambda.ag.responseToResult.constructor.name, 'AsyncFunction');

    assert.property(ittyLambda, 'alb');

    assert.equal(ittyLambda.alb.eventToRequest.constructor.name, 'AsyncFunction');
    assert.equal(ittyLambda.alb.responseToResult.constructor.name, 'AsyncFunction');

    assert.property(ittyLambda, 'url');

    assert.equal(ittyLambda.url.eventToRequest.constructor.name, 'AsyncFunction');
    assert.equal(ittyLambda.url.responseToResult.constructor.name, 'AsyncFunction');
  });

  it('implementation specific exports', async function () {

    // const ittyLambdaAg = require('itty-lambda/ag');

    // assert.equal(ittyLambdaAg.eventToRequest.constructor.name, 'AsyncFunction');
    // assert.equal(ittyLambdaAg.responseToResult.constructor.name, 'AsyncFunction');

    const ittyLambdaAlb = require('itty-lambda/alb');

    assert.equal(ittyLambdaAlb.eventToRequest.constructor.name, 'AsyncFunction');
    assert.equal(ittyLambdaAlb.responseToResult.constructor.name, 'AsyncFunction');

    const ittyLambdaUrl = require('itty-lambda/url');

    assert.equal(ittyLambdaUrl.eventToRequest.constructor.name, 'AsyncFunction');
    assert.equal(ittyLambdaUrl.responseToResult.constructor.name, 'AsyncFunction');
  });

});
