/**
 * Common shared functionality between implementations.
 * 
 * @module common
 * @protected 
 */

import { text } from 'node:stream/consumers';

import type {
  ALBEvent,
  APIGatewayProxyEvent,
  LambdaFunctionURLEvent,

  APIGatewayProxyResult,
  ALBResult,
  LambdaFunctionURLResult,

  ALBEventHeaders,
  ALBEventMultiValueHeaders,

  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,

  ALBEventQueryStringParameters,
  ALBEventMultiValueQueryStringParameters,

  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventMultiValueQueryStringParameters,
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

export interface EventOptions {
  /**
   * @defaultValue `GET`
   */
  defaultMethod: string;
}

export interface ResponseOptions {
  /**
   * @defaultValue `false`
   */
  base64Encode: boolean;
  /**
   * @defaultValue `404`
   */
  fallbackStatus: number;
  /**
   * @defaultValue `false`
   */
  multiValueHeaders: boolean;
}

/** @ignore */
export enum RoutingMode {
  Ag = 'api-gateway',
  Alb = 'application-load-balancer',
  Url = 'lambda-function-url',
}

/** @ignore */
export async function eventToRequest(
  mode: RoutingMode,
  event: APIGatewayProxyEvent | ALBEvent | LambdaFunctionURLEvent,
  options : EventOptions | undefined
): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  output.headers = objectsToHeaders(
    event?.headers,
    // account for lambda function urls not supporting multi values
    (mode != RoutingMode.Url ? (event as APIGatewayProxyEvent | ALBEvent).multiValueHeaders : undefined)
  );

  // infer protocol from headers when available
  const proto = output.headers.get('x-forwarded-proto')
    ?? output.headers.get('forwarded')?.match(/proto=(\w+)/)?.[1]
    ?? 'http'
  ;

  // infer host when available
  const host = (
      // ag or url may have requestContext.domainName
      (mode != RoutingMode.Alb ? (event as APIGatewayProxyEvent | LambdaFunctionURLEvent).requestContext?.domainName : undefined)
    )
    ?? output.headers.get('host')
    ?? output.headers.get('x-forwarded-host')
    ?? output.headers.get('forwarded')?.match(/host=([^;]+)/)?.[1]
    ?? 'localhost.localdomain'
  ;

  // infer path when available
  const path = (
      // ag or alb may have path
      (mode != RoutingMode.Url ? (event as APIGatewayProxyEvent | ALBEvent).path : undefined)
    )
    ?? (
      // url may have rawPath
      (mode == RoutingMode.Url ? (event as LambdaFunctionURLEvent).rawPath : undefined)
    )
    ?? (
      // ag may have requestContext.path
      (mode == RoutingMode.Ag ? (event as APIGatewayProxyEvent).requestContext?.path : undefined)
    )
    ?? (
      // url may have requestContext.http.path
      (mode == RoutingMode.Url ? (event as LambdaFunctionURLEvent).requestContext?.http?.path : undefined)
    )
    ?? ''
  ;

  // infer querystring and convert to string as necessary
  const queryString = (
      // url may have rawQueryString
      (mode == RoutingMode.Url ? (event as LambdaFunctionURLEvent).rawQueryString : undefined)
    )
    ?? objectsToQueryString(
      event?.queryStringParameters,
      (
        // ag or alb may have multiValueQueryStringParameters
        (mode != RoutingMode.Url ? (event as APIGatewayProxyEvent | ALBEvent).multiValueQueryStringParameters : undefined)
      )
    )
  ;

  // assemble well-formed url from inferred values above
  output.url = `${proto}://${host}${path}?${queryString}`;

  // infer or default http method
  output.method =
    (
      // ag or alb may have httpMethod
      (mode != RoutingMode.Url ? (event as APIGatewayProxyEvent | ALBEvent).httpMethod : undefined)
    )
    ?? (
      // ag may have requestContext.httpMethod
      (mode != RoutingMode.Ag ? (event as APIGatewayProxyEvent).requestContext?.httpMethod : undefined)
    )
    ?? (
      // url may have requestContext.http.method
      (mode == RoutingMode.Url ? (event as LambdaFunctionURLEvent).requestContext?.http?.method : undefined)
    )
    ?? options?.defaultMethod
    ?? 'GET'
  ;

  // get and decode as necessary any request body
  if (event?.body) {
    output.body = event?.isBase64Encoded
      ? Buffer.from(`${event?.body}`, 'base64').toString('ascii')
      : event?.body
    ;
  }

  return output;
}

/** @ignore */
export async function responseToResult(mode: RoutingMode, response: Response | undefined, options: ResponseOptions | undefined): Promise<APIGatewayProxyResult | ALBResult | LambdaFunctionURLResult> {
  options = Object.assign({ base64Encode: false, fallbackStatus: 404, multiValueHeaders: false }, options);

  // function urls do not support multi values
  if (options && mode === RoutingMode.Url) {
    options.multiValueHeaders = false;
  }

  try {
    return await parseResponseOrError(mode, response ?? error(options.fallbackStatus, 'Response not found'), options);
  } catch(err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return await parseResponseOrError(mode, error(err), options);
  }
}

async function parseResponseOrError(mode: RoutingMode, input: Response, options: ResponseOptions): Promise<APIGatewayProxyResult | ALBResult | LambdaFunctionURLResult> {
  let output: APIGatewayProxyResult | ALBResult | LambdaFunctionURLResult;
  
  switch (mode) {
    case RoutingMode.Ag:
      output = { statusCode: 200, isBase64Encoded: !!options.base64Encode, body: '' };
      break;
    case RoutingMode.Alb:
      output = { statusCode: 200, isBase64Encoded: !!options.base64Encode };
      break;
    case RoutingMode.Url:
      output = { statusCode: 200, isBase64Encoded: !!options.base64Encode };
      break;
  }

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // handle single or multi headers
  const { headers: singleHeaders, multiValueHeaders } = headersToObjects(headers, options.multiValueHeaders);

  output.headers = {};
  for (const [key, value] of Object.entries(singleHeaders)) {
    if (undefined !== value) output.headers[key] = value;
  }

  if (mode !== RoutingMode.Url) {
    (output as APIGatewayProxyResult | ALBResult).multiValueHeaders = {};
    if ('multiValueHeaders' in output && output.multiValueHeaders) {
      for (const [key, value] of Object.entries(multiValueHeaders)) {
        if (undefined !== value) output.multiValueHeaders[key] = value;
      }
    }
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

/**
 * Combine single and multi value header objects and convert to standardized
 * Headers instance.
 */
function objectsToHeaders(
  single: ALBEventHeaders | APIGatewayProxyEventHeaders | undefined,
  multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders | undefined
): Headers {
  const input: Record<string, string[]> = {};

  // add each single value header, wrapped in array
  if (single) {
    for (let [key, value] of Object.entries(single)) {
      key = key.toLowerCase();
      value = value?.trim();
      if (value) input[key] = [ value ];
    }
  }

  // and each multi value header
  if (multi) {
    // eslint-disable-next-line prefer-const
    for (let [key, values] of Object.entries(multi)) {
      key = key.toLowerCase();
      if (values) {
        // merge with any existing arrays of values
        if (undefined === input?.[key]) {
          input[key] = values;
        } else {
          for (let value of values) {
            value = value.trim();
            if (!input[key].includes(value)) input[key].push(value);
          }
        }
      }
    }
  }

  // append each normalized array to new Headers instance
  const output = new Headers();
  for (const [key, values] of Object.entries(input)) {
    for (const value of values) {
      output.append(key, value);
    }
  }

  return output;
}

/**
 * Split Headers instance into single and (when explicitly enabled) multi value
 * header objects.
 */
function headersToObjects(headers: Headers, splitIntoMultiValues = false): {
  headers: ALBEventHeaders | APIGatewayProxyEventHeaders,
  multiValueHeaders: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders
} {
  const single: ALBEventHeaders | APIGatewayProxyEventHeaders = {};
  const multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders = {};

  for (const [key, value] of headers.entries() ) {
    if (splitIntoMultiValues) {
      multi[key] = value.split(',').map(v=> v.trim());
    } else {
      single[key] = value;
    }
  }

  return { headers: single, multiValueHeaders: multi };
}

/**
 * Combine single and multi value query string parameters into a well formed
 * query string, as produced by the URLSearchParams global.
 */
function objectsToQueryString(
  single: ALBEventQueryStringParameters | APIGatewayProxyEventQueryStringParameters | undefined | null,
  multi: ALBEventMultiValueQueryStringParameters | APIGatewayProxyEventMultiValueQueryStringParameters | undefined | null
): string {
  const output = new URLSearchParams();

  // include all single value query params by default
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (undefined !== value) output.append(key, value);
    }
  }

  // and all multi value query params that don't already contain same value
  if (multi) {
    for (const [key, value] of Object.entries(multi)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (!output.has(key, v)) output.append(key, v);
        }
      }
    }
  }

  return output.toString();
}
