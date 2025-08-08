output "endpoint_url" {
  value = aws_apigatewayv2_stage.lambda.invoke_url
}

output "lambda_arn" {
  value = aws_lambda_function.il_test_ag_function.arn
}
