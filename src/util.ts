import type {
  ALBEventHeaders,
  ALBEventMultiValueHeaders,

  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,

  ALBEventQueryStringParameters,
  ALBEventMultiValueQueryStringParameters,

  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventMultiValueQueryStringParameters,
} from 'aws-lambda';

export interface AWSEventMixedHeaders {
  [name: string]: string | string[] | undefined;
}

/**
 * Combine single and multi value headers into one object where each header
 * may or may not be an array of values.
 * 
 * ```
 * combineHeaders(
 *   { alpha: 'abc', bravo: 'def', charlie: 'ghi' },
 *   { alpha: ['xyz'], charlie: ['uvw', 'wvu'], delta, ['jlk'] }
 * ) : {
 *   alpha: ['abc', 'xyz'],
 *   bravo: 'def',
 *   charlie: ['uvw', 'wvu'],
 *   delta, 'jlk'
 * }
 * ```
 */
export function combineHeaders(
  single: ALBEventHeaders | APIGatewayProxyEventHeaders,
  multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders
): AWSEventMixedHeaders {
  // include all single value headers by default
  const output: AWSEventMixedHeaders = Object.assign({}, single ?? {});

  // and all multi value headers that...
  for (const [key, value] of Object.entries(multi)) {
    if (undefined === output?.[key]) {
      output[key] = value;
    } else {
      if (Array.isArray(value)) {
        if (!Array.isArray(output[key])) output[key] = [ output[key] ];
        for (const v of value) {
          if (!output[key].includes(v)) output[key].push(v);
        }
      }
    }
  }

  return output;
}

/**
 * Split headers into single and multi value headers, where the former will
 * contain only single values while the latter may contain arrays of values.
 * 
 * ```
 * splitHeaders(
 *   { alpha: 'abc', bravo: 'def', charlie: ['uvw', 'wvu'], delta, 'jlk' }
 * ) : {
 *   headers: { alpha: 'abc', bravo: 'def', charlie: 'uvw,wvu', delta, 'jlk' },
 *   multiValueHeaders: { alpha: ['abc'], bravo: ['def'], charlie: ['uvw', 'wvu'], delta, ['jlk'] }
 * }
 * ```
 */
export function splitHeaders(headers: AWSEventMixedHeaders): {
  headers: ALBEventHeaders | APIGatewayProxyEventHeaders,
  multiValueHeaders: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders
} {
  const single: ALBEventHeaders | APIGatewayProxyEventHeaders = {};
  const multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      multi[key] = value;
      single[key] = value.join(',');
    } else {
      if (undefined !== value) {
        single[key] = value;
        multi[key] = [ value ];
      }
    }
  }

  return { headers: single, multiValueHeaders: multi };
}

/**
 * Combine single and multi value query string parameters into a well formed
 * query string, as produced by the URLSearchParams global.
 * 
 * ```
 * combineQuery(
 *   { alpha: 'abc', bravo: 'def', charlie: 'ghi' },
 *   { alpha: ['xyz'], charlie: ['uvw', 'wvu'], delta, ['jlk'] }
 * ) : 'alpha=abc&alpha=xyz&bravo=def&charlie=ghi&charlie=uvw&charlie=wvu&delta=jlk'
 * ```
 */
export function combineQuery(
  single: ALBEventQueryStringParameters | APIGatewayProxyEventQueryStringParameters,
  multi: ALBEventMultiValueQueryStringParameters | APIGatewayProxyEventMultiValueQueryStringParameters
): string {
  const output = new URLSearchParams();

  // include all single value query params by default
  for (const [key, value] of Object.entries(single)) {
    if (undefined !== value) output.append(key, value);
  }

  // and all multi value query params that don't already contain same value
  // 
  for (const [key, value] of Object.entries(multi)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        if (!output.has(key, v)) output.append(key, v);
      }
    }
  }

  return output.toString();
}
