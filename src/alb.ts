import type {
  ALBEvent,
  ALBResult,
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import type { EventOptions, ResponseOptions } from './common'; 

import {
  eventToRequest as commonEventToRequest,
  responseToResult as commonResponseToResult,
  RoutingMode,
} from './common';

/**
 * Accepts an event from an AWS Lambda function invocation by way of an
 * application load balancer target, and formats it into a request
 * suitable for routing through itty-router.
 * 
 * @param event 
 * @param options
 */
export async function eventToRequest(event: ALBEvent, options: EventOptions | undefined): Promise<RequestLike> {
  return await commonEventToRequest(RoutingMode.Alb, event, options);
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
export async function responseToResult(response: Response | undefined, options: ResponseOptions): Promise<ALBResult> {
  return (
    (await commonResponseToResult(RoutingMode.Alb, response, options)) as ALBResult
  );
}

/** @ignore */
export default {
  eventToRequest,
  responseToResult,
}
