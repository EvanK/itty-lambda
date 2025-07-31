import { text } from 'node:stream/consumers';

import type {
  ALBEvent,
  ALBResult
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

import { combineHeaders, combineQuery, splitHeaders } from './util';

/**
 * Accepts an event from an AWS Lambda function invocation by way of an
 * application load balancer target, and formats it into a request
 * suitable for routing through itty-router.
 * 
 * @param {ALBEvent} event 
 * @returns {Promise<RequestLike>}
 */
export async function eventToRequest(event: ALBEvent): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  // combine any single and/or multi value headers
  output.headers = combineHeaders(event?.headers, event?.multiValueHeaders);

  // assemble well-formed url with sane defaults
  const proto = event?.headers?.['x-forwarded-proto'] ?? 'http';
  const host = event?.headers?.host ?? 'localhost.localdomain';
  const path = event?.path ?? '';
  const queryString = combineQuery(event?.queryStringParameters, event?.multiValueQueryStringParameters);
  output.url = `${proto}://${host}${path}?${queryString}`;

  // and http method
  output.method = event?.httpMethod ?? 'GET';

  // base64 decode body, if necessary
  if (event?.body) {
    output.body = event?.isBase64Encoded
      ? Buffer.from(`${event?.body}`, 'base64').toString('ascii')
      : event?.body
    ;
  }

  return output;
}

/**
 * Accepts a response from itty-router (or undefined if no route was matched),
 * and formats it into a result suitable to return to the Lambda service and
 * subsequently to an application load balancer.
 * 
 * If no response was provided, an error response is built with the given
 * fallback HTTP status, defaulting to 404.
 * 
 * @param {Response|undefined} response 
 * @param {number} [fallbackStatus=404] 
 * @returns {Promise<ALBResult>}
 */
export async function responseToResult(response: Response | undefined, fallbackStatus: number = 404): Promise<ALBResult> {
  try {
    return await parseResponseOrError(response ?? error(fallbackStatus, 'Response not found'));
  } catch(err: any) {
    return await parseResponseOrError(error(err));
  }
}

async function parseResponseOrError(input: Response): Promise<ALBResult> {
  const output: ALBResult = { statusCode: 200, isBase64Encoded: false };

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // handle single or multi headers
  const { headers: singleHeaders, multiValueHeaders } = splitHeaders(headers);

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
  }

  return output;
}
