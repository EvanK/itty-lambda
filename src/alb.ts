import { text } from 'node:stream/consumers';

import type {
  ALBEvent,
  ALBResult
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

import type { EventOptions, ResponseOptions } from './util'; 

import {
  eventToRequest as commonEventToRequest,
  headersToObjects,
} from './util';

/**
 * Accepts an event from an AWS Lambda function invocation by way of an
 * application load balancer target, and formats it into a request
 * suitable for routing through itty-router.
 * 
 * @param event 
 * @param options
 */
export async function eventToRequest(event: ALBEvent, options: EventOptions | undefined): Promise<RequestLike> {
  return await commonEventToRequest(event, options);
}

/**
 * Accepts a response from itty-router (or undefined if no route was matched),
 * and formats it into a result suitable to return to the Lambda service and
 * subsequently to an application load balancer.
 * 
 * If no response was provided, an error response is built with the given
 * fallback HTTP status, defaulting to 404.
 * 
 * @param response 
 * @param options 
 */
export async function responseToResult(response: Response | undefined, options: ResponseOptions | undefined): Promise<ALBResult> {
  options = Object.assign({ base64Encode: false, fallbackStatus: 404, multiValueHeaders: false }, options);
  try {
    return await parseResponseOrError(response ?? error(options.fallbackStatus, 'Response not found'), options);
  } catch(err: any) {
    return await parseResponseOrError(error(err), options);
  }
}

async function parseResponseOrError(input: Response, options: ResponseOptions): Promise<ALBResult> {
  const output: ALBResult = { statusCode: 200, isBase64Encoded: !!options.base64Encode };

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // handle single or multi headers
  const { headers: singleHeaders, multiValueHeaders } = headersToObjects(headers, options.multiValueHeaders);

  output.headers = {};
  for (const [key, value] of Object.entries(singleHeaders)) {
    if (undefined !== value) output.headers[key] = value;
  }

  output.multiValueHeaders = {};
  for (const [key, value] of Object.entries(multiValueHeaders)) {
    if (undefined !== value) output.multiValueHeaders[key] = value;
  }

  // un-streamify body as necessary
  if (body) {
    output.body = await text(body);
    if (options.base64Encode) {
      output.body = Buffer.from(output.body, 'utf-8').toString('base64');
    }
  }

  return output;
}
