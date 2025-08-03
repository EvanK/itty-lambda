// API Gateways
import * as ag from './ag';

// Application Load Balancers
import * as alb from './alb';

// Lambda function urls
import * as url from './url';

/**
 * Each implements the following functions:
 * 
 * @see eventToRequest
 * Expects an event as provided by the AWS Lambda service to an invoked
 * function, and returns a request-like object for use by itty-router.
 * 
 * @see responseToResult
 * Expects a response as returned by itty-router (or undefined if no route
 * match found), and returns a result as expected by the Lambda service.
 * 
 * The format of each incoming event and outgoing result vary depending on
 * how the Lambda has been invoked, hence the multiple implementations.
 */
export {
  ag,
  alb,
  url,
}
