import { text } from 'node:stream/consumers';

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
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
 * API gateway proxy integration, and formats it into a request suitable
 * for routing through itty-router.
 * 
 * @param event 
 * @param options
 */
export async function eventToRequest(event: APIGatewayProxyEvent, options: EventOptions | undefined): Promise<RequestLike> {
  return await commonEventToRequest(event, options);
}
// export async function eventToRequest(event: APIGatewayProxyEvent, options: EventOptions): Promise<RequestLike> {
//   const output: RequestLike = { method: '', url: '' };

//   // combine any single and/or multi value headers
//   output.headers = objectsToHeaders(event?.headers, event?.multiValueHeaders);

//   // assemble well-formed url with sane defaults
//   const proto = output.headers.get('x-forwarded-proto')
//     ?? output.headers.get('forwarded')?.match(/proto=(\w+)/)?.[1]
//     ?? 'http'
//   ;
//   // host from req context, Host header or from forwarded headers as applicable
//   const host = event?.requestContext?.domainName
//     ?? output.headers.get('host')
//     ?? output.headers.get('x-forwarded-host')
//     ?? output.headers.get('forwarded')?.match(/host=([^;]+)/)?.[1]
//     ?? 'localhost.localdomain'
//   ;
//   const path = event?.path ?? event?.requestContext?.path ?? '';
//   const queryString = objectsToQueryString(event?.queryStringParameters ?? {}, event?.multiValueQueryStringParameters ?? {});
//   output.url = `${proto}://${host}${path}?${queryString}`;

//   // and http method
//   output.method = event?.httpMethod ?? event?.requestContext?.httpMethod ?? options?.defaultMethod ?? 'GET';

//   // and request body, if any
//   output.body = prepareBody(event);

//   return output;
// }

/**
 * Accepts a response from itty-router (or undefined if no route was matched),
 * and formats it into a result suitable to return to the Lambda service and
 * subsequently to an API gateway proxy integration.
 * 
 * If no response was provided, an error response is built with the given
 * fallback HTTP status, defaulting to 404.
 * 
 * @param response 
 * @param options 
 */
export async function responseToResult(response: Response | undefined, options: ResponseOptions): Promise<APIGatewayProxyResult> {
  options = Object.assign({ base64Encode: false, fallbackStatus: 404, multiValueHeaders: false }, options);
  try {
    return parseResponseOrError(response ?? error(options.fallbackStatus, 'Response not found'), options);
  } catch(err: any) {
    return parseResponseOrError(error(err), options);
  }
}

async function parseResponseOrError(input: Response, options: ResponseOptions): Promise<APIGatewayProxyResult> {
  const output: APIGatewayProxyResult = { statusCode: 200, isBase64Encoded: !!options.base64Encode, body: '' };

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
